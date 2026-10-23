//! Câmera e microfone do celular como webcam e microfone do computador (ver "Câmera e
//! microfone do celular" em `protocolo/README.md`).
//!
//! A câmera chega em CAMERA (pedaços de um quadro H.264). `Montagem` junta os pedaços e cada
//! quadro inteiro vai para um `gst-launch-1.0` (processo filho, sem shell), que o publica no
//! PipeWire. O microfone chega em AUDIO (PCM s16le 16 kHz mono) e vai para o FIFO de um
//! `module-pipe-source` do PulseAudio. Processos e `pactl` ficam atrás do trait `Sistema`, para
//! que os testes usem executores falsos.

use std::path::PathBuf;
use std::process::Stdio;

use serde_json::{json, Value};
use tokio::io::AsyncWriteExt;
use tokio::sync::mpsc;

use crate::protocolo::{controle, Mensagem};
use crate::sessao::Extensao;
use crate::video::{Quadro, MARCA_CHAVE, MARCA_PRIMEIRO, MARCA_ULTIMO};

pub const CAMERA_W: u32 = 1280;
pub const CAMERA_H: u32 = 720;
pub const CAMERA_KBPS: u32 = 2500;
/// Maior quadro montado a partir dos pedaços (um quadro-chave 720p cabe com folga).
pub const MAX_QUADRO: usize = 2 * 1024 * 1024;
/// Quadros e blocos de áudio na fila até o processo. Cheia: descarta (nunca trava a sessão).
const FILA_QUADROS: usize = 6;
const FILA_AUDIO: usize = 10;
const NOME_FIFO: &str = "opentrackpad-mic";

/// Junta os pedaços CAMERA em quadros inteiros. Pedaço perdido (primeiro ou último, ou
/// `pts_us` que muda no meio), ou quadro grande demais: descarta e espera o próximo
/// quadro-chave. O formato não tem índice de pedaço, então um pedaço do meio perdido não é
/// notado (o mesmo que o decodificador do celular faz).
pub struct Montagem {
    em_montagem: Option<(u64, Quadro)>,
    perdido: bool,
}

impl Default for Montagem {
    fn default() -> Self {
        // Começa esperando um quadro-chave: um quadro de diferença sozinho não decodifica.
        Self { em_montagem: None, perdido: true }
    }
}

impl Montagem {
    /// Um pedaço. Devolve o quadro inteiro quando chega o último pedaço dele.
    pub fn pedaco(&mut self, pts_us: u64, marcas: u8, dados: &[u8]) -> Option<Quadro> {
        if marcas & MARCA_PRIMEIRO != 0 {
            if self.em_montagem.take().is_some() {
                self.perdido = true;
            }
            let chave = marcas & MARCA_CHAVE != 0;
            if self.perdido && !chave {
                return None;
            }
            self.perdido = false;
            self.em_montagem = Some((pts_us, Quadro { dados: Vec::new(), chave }));
        }
        let Some((pts, quadro)) = self.em_montagem.as_mut() else {
            self.perdido = true;
            return None;
        };
        if *pts != pts_us || quadro.dados.len() + dados.len() > MAX_QUADRO {
            self.em_montagem = None;
            self.perdido = true;
            return None;
        }
        quadro.dados.extend_from_slice(dados);
        if marcas & MARCA_ULTIMO == 0 {
            return None;
        }
        self.em_montagem.take().map(|(_, quadro)| quadro)
    }

    /// Um quadro montado não foi entregue (fila cheia): espera o próximo quadro-chave.
    pub fn perdeu(&mut self) {
        self.perdido = true;
    }
}

/// O que o computador faz de verdade: processos e PulseAudio. Nos testes, executores falsos.
pub trait Sistema: Send {
    /// Começa o `gst-launch-1.0` da câmera. Devolve o canal por onde entram os quadros
    /// inteiros (H.264 em Annex B). Fechar o canal (soltar o remetente) para o processo.
    fn iniciar_camera(&mut self) -> Option<mpsc::Sender<Vec<u8>>>;
    /// `pactl load-module module-pipe-source ...`: devolve o número do módulo.
    fn carregar_microfone(&mut self) -> Option<u32>;
    /// Abre o FIFO da fonte para escrita. Devolve o canal dos blocos de PCM.
    fn abrir_microfone(&mut self) -> Option<mpsc::Sender<Vec<u8>>>;
    /// `pactl unload-module <n>`.
    fn descarregar_microfone(&mut self, modulo: u32);
}

/// O computador de verdade: `gst-launch-1.0` para a câmera e `pactl` para o microfone.
pub struct SistemaDeste;

impl Sistema for SistemaDeste {
    fn iniciar_camera(&mut self) -> Option<mpsc::Sender<Vec<u8>>> {
        let mut filho = tokio::process::Command::new("gst-launch-1.0")
            .args(argumentos_camera())
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| eprintln!("câmera: gst-launch-1.0: {e}"))
            .ok()?;
        let mut entrada = filho.stdin.take()?;
        let (canal, mut quadros) = mpsc::channel::<Vec<u8>>(FILA_QUADROS);
        tokio::spawn(async move {
            while let Some(quadro) = quadros.recv().await {
                if entrada.write_all(&quadro).await.is_err() {
                    break;
                }
            }
            // Canal fechado (câmera desligada, sessão encerrada) ou processo morto: sai.
            let _ = filho.kill().await;
        });
        Some(canal)
    }

    fn carregar_microfone(&mut self) -> Option<u32> {
        let caminho = caminho_do_fifo()?;
        let arquivo = format!("file={}", caminho.display());
        let saida = std::process::Command::new("pactl")
            .args([
                "load-module",
                "module-pipe-source",
                "source_name=opentrackpad_mic",
                &arquivo,
                "format=s16le",
                "rate=16000",
                "channels=1",
                "source_properties=device.description=OpenTrackpad",
            ])
            .output()
            .map_err(|e| eprintln!("microfone: pactl: {e}"))
            .ok()?;
        if !saida.status.success() {
            eprintln!("microfone: pactl: {}", String::from_utf8_lossy(&saida.stderr).trim());
            return None;
        }
        String::from_utf8_lossy(&saida.stdout).trim().parse().ok()
    }

    fn abrir_microfone(&mut self) -> Option<mpsc::Sender<Vec<u8>>> {
        let caminho = caminho_do_fifo()?;
        // Escrita sem bloquear: falha se ninguém lê o FIFO (módulo não carregado).
        let mut fifo = tokio::net::unix::pipe::OpenOptions::new()
            .open_sender(&caminho)
            .map_err(|e| eprintln!("microfone: {}: {e}", caminho.display()))
            .ok()?;
        let (canal, mut blocos) = mpsc::channel::<Vec<u8>>(FILA_AUDIO);
        tokio::spawn(async move {
            while let Some(bloco) = blocos.recv().await {
                if fifo.write_all(&bloco).await.is_err() {
                    break;
                }
            }
        });
        Some(canal)
    }

    fn descarregar_microfone(&mut self, modulo: u32) {
        let _ = std::process::Command::new("pactl").args(["unload-module", &modulo.to_string()]).output();
    }
}

fn caminho_do_fifo() -> Option<PathBuf> {
    let pasta = std::env::var_os("XDG_RUNTIME_DIR").filter(|p| !p.is_empty())?;
    Some(PathBuf::from(pasta).join(NOME_FIFO))
}

/// Argumentos do `gst-launch-1.0` da câmera (sem shell). `stream-properties` é um único
/// argumento; o gst-launch junta os argumentos e lê as aspas e as barras invertidas, que
/// precisam estar aqui porque `node.description` tem espaço e parênteses.
pub fn argumentos_camera() -> Vec<String> {
    [
        "-q",
        "fdsrc",
        "fd=0",
        "!",
        "h264parse",
        "!",
        "video/x-h264,stream-format=byte-stream",
        "!",
        "avdec_h264",
        "!",
        "videoconvert",
        "!",
        "pipewiresink",
        "mode=provide",
        r#"stream-properties="props,media.class=Video/Source,node.name=opentrackpad-camera,node.description=\"OpenTrackpad (câmera)\"""#,
    ]
    .map(String::from)
    .to_vec()
}

/// Um microfone ligado: o módulo carregado e o canal de escrita no FIFO.
struct Microfone {
    modulo: u32,
    canal: mpsc::Sender<Vec<u8>>,
}

/// Extensão das telas `camera` (nível 3) e `microfone` (nível 2), grupo Ponte. Uma por sessão.
pub struct PonteMidia {
    sistema: Box<dyn Sistema>,
    /// Tela `camera` ou `microfone` aberta no celular agora (só ela recebe `estado`).
    aberta: Option<&'static str>,
    /// Câmera frontal (padrão: videochamada). Vale na próxima vez que ligar.
    frente: bool,
    /// Com a câmera ligada: por onde mandar os quadros montados.
    camera: Option<mpsc::Sender<Vec<u8>>>,
    montagem: Montagem,
    microfone: Option<Microfone>,
}

impl PonteMidia {
    /// A extensão real (processos e PulseAudio deste computador).
    pub fn nova() -> Self {
        Self::com_sistema(Box::new(SistemaDeste))
    }

    pub fn com_sistema(sistema: Box<dyn Sistema>) -> Self {
        Self { sistema, aberta: None, frente: true, camera: None, montagem: Montagem::default(), microfone: None }
    }

    fn ligar_camera(&mut self) -> bool {
        match self.sistema.iniciar_camera() {
            Some(canal) => {
                self.camera = Some(canal);
                self.montagem = Montagem::default();
                true
            }
            None => false,
        }
    }

    fn desligar_camera(&mut self) {
        self.camera = None;
        self.montagem = Montagem::default();
    }

    fn ligar_microfone(&mut self) -> bool {
        let Some(modulo) = self.sistema.carregar_microfone() else {
            return false;
        };
        match self.sistema.abrir_microfone() {
            Some(canal) => {
                self.microfone = Some(Microfone { modulo, canal });
                true
            }
            None => {
                self.sistema.descarregar_microfone(modulo);
                false
            }
        }
    }

    fn desligar_microfone(&mut self) {
        if let Some(Microfone { modulo, canal }) = self.microfone.take() {
            // Primeiro para de escrever (solta o canal), depois descarrega o módulo.
            drop(canal);
            self.sistema.descarregar_microfone(modulo);
        }
    }

    fn parar_tudo(&mut self) {
        self.desligar_camera();
        self.desligar_microfone();
        self.aberta = None;
    }

    fn alternar_camera(&mut self, r: &mut Vec<Mensagem>) {
        if self.camera.is_some() {
            self.desligar_camera();
            r.push(controle(json!({"t":"camera","ligar":false})));
        } else if self.ligar_camera() {
            r.push(controle(self.pedido_camera(true)));
        } else {
            r.push(controle(json!({"t":"aviso","texto":"Não deu para ligar a câmera"})));
        }
        self.estado_da_tela(r);
    }

    fn virar_camera(&mut self, r: &mut Vec<Mensagem>) {
        self.frente = !self.frente;
        if self.camera.is_some() {
            // O celular troca de câmera: o que estava no meio do quadro não serve mais.
            self.montagem = Montagem::default();
            r.push(controle(self.pedido_camera(true)));
        }
        self.estado_da_tela(r);
    }

    fn alternar_microfone(&mut self, r: &mut Vec<Mensagem>) {
        if self.microfone.is_some() {
            self.desligar_microfone();
            r.push(controle(json!({"t":"microfone","ligar":false})));
        } else if self.ligar_microfone() {
            r.push(controle(json!({"t":"microfone","ligar":true})));
        } else {
            r.push(controle(json!({"t":"aviso","texto":"Não deu para ligar o microfone"})));
        }
        self.estado_da_tela(r);
    }

    fn pedido_camera(&self, ligar: bool) -> Value {
        json!({"t":"camera","ligar":ligar,"w":CAMERA_W,"h":CAMERA_H,"kbps":CAMERA_KBPS,"frente":self.frente})
    }

    /// Depois de cada mudança: o LED e o rótulo da tecla, só se a tela deles está aberta.
    fn estado_da_tela(&self, r: &mut Vec<Mensagem>) {
        match self.aberta {
            Some("camera") => r.push(controle(self.estado_camera())),
            Some("microfone") => r.push(controle(self.estado_microfone())),
            _ => {}
        }
    }

    fn tela_camera(&self) -> Value {
        let ligada = self.camera.is_some();
        json!({"t":"tela","id":"camera","nome":"Câmera","nivel":3,"pecas":[
            {"p":"previa_camera","id":"previa"},
            {"p":"linha","id":"l","pecas":[
                {"p":"led","id":"estado_camera","rotulo":"Câmera","ligado":ligada,"texto":texto_camera(ligada)},
                {"p":"tecla","id":"camera:alternar","rotulo":rotulo_alternar(ligada),"icone":"camera"},
                {"p":"tecla","id":"camera:virar","rotulo":"Virar","icone":"recarregar"},
            ]},
        ]})
    }

    fn estado_camera(&self) -> Value {
        let ligada = self.camera.is_some();
        json!({"t":"estado","tela":"camera","pecas":[
            {"id":"estado_camera","ligado":ligada,"texto":texto_camera(ligada)},
            {"id":"camera:alternar","rotulo":rotulo_alternar(ligada)},
        ]})
    }

    fn tela_microfone(&self) -> Value {
        let ligado = self.microfone.is_some();
        json!({"t":"tela","id":"microfone","nome":"Microfone","nivel":2,"pecas":[
            {"p":"linha","id":"l","pecas":[
                {"p":"led","id":"estado_microfone","rotulo":"Microfone","ligado":ligado,"texto":texto_microfone(ligado)},
                {"p":"tecla","id":"microfone:alternar","rotulo":rotulo_alternar(ligado),"icone":"microfone"},
            ]},
        ]})
    }

    fn estado_microfone(&self) -> Value {
        let ligado = self.microfone.is_some();
        json!({"t":"estado","tela":"microfone","pecas":[
            {"id":"estado_microfone","ligado":ligado,"texto":texto_microfone(ligado)},
            {"id":"microfone:alternar","rotulo":rotulo_alternar(ligado)},
        ]})
    }
}

fn texto_camera(ligada: bool) -> &'static str {
    if ligada {
        "enviando"
    } else {
        "desligada"
    }
}

fn texto_microfone(ligado: bool) -> &'static str {
    if ligado {
        "enviando"
    } else {
        "desligado"
    }
}

fn rotulo_alternar(ligado: bool) -> &'static str {
    if ligado {
        "Desligar"
    } else {
        "Ligar"
    }
}

impl Drop for PonteMidia {
    /// Se a sessão cair sem `encerrar`, ainda assim não fica processo nem módulo para trás.
    fn drop(&mut self) {
        self.parar_tudo();
    }
}

impl Extensao for PonteMidia {
    fn telas(&self) -> Vec<Value> {
        vec![
            json!({"id":"camera","nome":"Câmera","icone":"camera","grupo":"Ponte","nivel":3}),
            json!({"id":"microfone","nome":"Microfone","icone":"microfone","grupo":"Ponte","nivel":2}),
        ]
    }

    fn controle(&mut self, t: &str, msg: &Value, r: &mut Vec<Mensagem>) -> bool {
        match t {
            "abrir" => {
                let tela = match msg["tela"].as_str() {
                    Some("camera") => "camera",
                    Some("microfone") => "microfone",
                    _ => {
                        self.aberta = None;
                        return false;
                    }
                };
                self.aberta = Some(tela);
                r.push(controle(if tela == "camera" { self.tela_camera() } else { self.tela_microfone() }));
                true
            }
            "acao" => match msg["id"].as_str().unwrap_or_default() {
                "camera:alternar" => {
                    self.alternar_camera(r);
                    true
                }
                "camera:virar" => {
                    self.virar_camera(r);
                    true
                }
                "microfone:alternar" => {
                    self.alternar_microfone(r);
                    true
                }
                _ => false,
            },
            _ => false,
        }
    }

    fn midia_do_celular(&mut self, m: &Mensagem) {
        match m {
            Mensagem::Camera { pts_us, marcas, dados } => {
                let Some(canal) = &self.camera else {
                    return;
                };
                if let Some(quadro) = self.montagem.pedaco(*pts_us, *marcas, dados) {
                    if canal.try_send(quadro.dados).is_err() {
                        self.montagem.perdeu();
                    }
                }
            }
            Mensagem::Audio { dados, .. } => {
                if let Some(mic) = &self.microfone {
                    let _ = mic.canal.try_send(dados.to_vec());
                }
            }
            _ => {}
        }
    }

    fn encerrar(&mut self) {
        self.parar_tudo();
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};
    use std::time::{Duration, Instant};

    use tokio::io::AsyncReadExt;

    use super::*;
    use crate::video::{fatiar, Separador, MAX_PEDACO};

    /// O que o teste observa no fake: chamadas feitas e os canais dos sumidouros.
    #[derive(Clone, Default)]
    struct Painel {
        log: Arc<Mutex<Vec<String>>>,
        cameras: Arc<Mutex<Vec<mpsc::Receiver<Vec<u8>>>>>,
        fifos: Arc<Mutex<Vec<mpsc::Receiver<Vec<u8>>>>>,
    }

    impl Painel {
        fn log(&self) -> Vec<String> {
            self.log.lock().unwrap().clone()
        }
        /// Canal do último sumidouro de câmera iniciado.
        fn camera(&self) -> mpsc::Receiver<Vec<u8>> {
            self.cameras.lock().unwrap().pop().expect("câmera não iniciada")
        }
        fn fifo(&self) -> mpsc::Receiver<Vec<u8>> {
            self.fifos.lock().unwrap().pop().expect("microfone não aberto")
        }
    }

    struct Falso {
        painel: Painel,
        falha_camera: bool,
        falha_microfone: bool,
    }

    impl Sistema for Falso {
        fn iniciar_camera(&mut self) -> Option<mpsc::Sender<Vec<u8>>> {
            self.painel.log.lock().unwrap().push("camera iniciada".into());
            if self.falha_camera {
                return None;
            }
            let (canal, rx) = mpsc::channel(64);
            self.painel.cameras.lock().unwrap().push(rx);
            Some(canal)
        }

        fn carregar_microfone(&mut self) -> Option<u32> {
            self.painel.log.lock().unwrap().push("modulo carregado".into());
            (!self.falha_microfone).then_some(7)
        }

        fn abrir_microfone(&mut self) -> Option<mpsc::Sender<Vec<u8>>> {
            let (canal, rx) = mpsc::channel(64);
            self.painel.fifos.lock().unwrap().push(rx);
            Some(canal)
        }

        fn descarregar_microfone(&mut self, modulo: u32) {
            self.painel.log.lock().unwrap().push(format!("modulo {modulo} descarregado"));
        }
    }

    fn montar() -> (PonteMidia, Painel) {
        montar_com(false, false)
    }

    fn montar_com(falha_camera: bool, falha_microfone: bool) -> (PonteMidia, Painel) {
        let painel = Painel::default();
        let falso = Falso { painel: painel.clone(), falha_camera, falha_microfone };
        (PonteMidia::com_sistema(Box::new(falso)), painel)
    }

    fn acao(id: &str) -> Value {
        json!({"t":"acao","id":id})
    }

    fn controles(r: &[Mensagem]) -> Vec<Value> {
        r.iter()
            .filter_map(|m| match m {
                Mensagem::Controle(v) => Some(v.clone()),
                _ => None,
            })
            .collect()
    }

    fn com_tela_aberta(p: &mut PonteMidia, tela: &str) {
        let mut r = Vec::new();
        p.controle("abrir", &json!({"t":"abrir","tela":tela}), &mut r);
    }

    /// Um `Mensagem::Video` de `fatiar` vira o pedaço CAMERA de mesmo conteúdo.
    fn como_camera(m: Mensagem) -> Mensagem {
        match m {
            Mensagem::Video { pts_us, marcas, dados } => Mensagem::Camera { pts_us, marcas, dados },
            outro => outro,
        }
    }

    fn pedacos_da_camera(quadro: &Quadro, pts_us: u64) -> Vec<Mensagem> {
        fatiar(quadro, pts_us).into_iter().map(como_camera).collect()
    }

    #[test]
    fn telas_no_grupo_ponte() {
        let (p, _) = montar();
        assert_eq!(
            p.telas(),
            vec![
                json!({"id":"camera","nome":"Câmera","icone":"camera","grupo":"Ponte","nivel":3}),
                json!({"id":"microfone","nome":"Microfone","icone":"microfone","grupo":"Ponte","nivel":2}),
            ]
        );
    }

    #[test]
    fn abrir_responde_so_as_suas() {
        let (mut p, _) = montar();
        let mut r = Vec::new();
        assert!(p.controle("abrir", &json!({"t":"abrir","tela":"camera"}), &mut r));
        let t = controles(&r);
        assert_eq!(t.len(), 1);
        assert_eq!(t[0]["t"], "tela");
        assert_eq!(t[0]["id"], "camera");
        assert_eq!(t[0]["nivel"], 3);
        assert_eq!(t[0]["pecas"][0]["p"], "previa_camera");
        assert_eq!(t[0]["pecas"][1]["pecas"][0]["ligado"], false);
        assert_eq!(t[0]["pecas"][1]["pecas"][1]["rotulo"], "Ligar");

        let mut r = Vec::new();
        assert!(!p.controle("abrir", &json!({"t":"abrir","tela":"mixer"}), &mut r));
        assert!(r.is_empty());

        let mut r = Vec::new();
        assert!(p.controle("abrir", &json!({"t":"abrir","tela":"microfone"}), &mut r));
        let t = controles(&r);
        assert_eq!(t[0]["id"], "microfone");
        assert_eq!(t[0]["nivel"], 2);
    }

    #[test]
    fn alternar_camera_liga_e_manda_estado() {
        let (mut p, painel) = montar();
        com_tela_aberta(&mut p, "camera");
        let mut r = Vec::new();
        assert!(p.controle("acao", &acao("camera:alternar"), &mut r));
        let t = controles(&r);
        assert_eq!(t[0], json!({"t":"camera","ligar":true,"w":1280,"h":720,"kbps":2500,"frente":true}));
        assert_eq!(
            t[1],
            json!({"t":"estado","tela":"camera","pecas":[
                {"id":"estado_camera","ligado":true,"texto":"enviando"},
                {"id":"camera:alternar","rotulo":"Desligar"},
            ]})
        );
        assert_eq!(painel.log(), vec!["camera iniciada"]);
    }

    #[test]
    fn estado_so_com_a_tela_aberta() {
        let (mut p, _) = montar();
        let mut r = Vec::new();
        p.controle("acao", &acao("camera:alternar"), &mut r);
        let t = controles(&r);
        assert_eq!(t.len(), 1);
        assert_eq!(t[0]["t"], "camera");
    }

    #[test]
    fn virar_com_camera_ligada_reenvia() {
        let (mut p, _) = montar();
        // Desligada: vira só o lado, sem mandar nada de câmera.
        let mut r = Vec::new();
        p.controle("acao", &acao("camera:virar"), &mut r);
        assert!(controles(&r).iter().all(|v| v["t"] != "camera"));

        let mut r = Vec::new();
        p.controle("acao", &acao("camera:alternar"), &mut r);
        assert_eq!(controles(&r)[0]["frente"], false);

        let mut r = Vec::new();
        p.controle("acao", &acao("camera:virar"), &mut r);
        let t = controles(&r);
        assert_eq!(t[0], json!({"t":"camera","ligar":true,"w":1280,"h":720,"kbps":2500,"frente":true}));
    }

    #[test]
    fn alternar_camera_de_novo_desliga_e_para() {
        let (mut p, painel) = montar();
        let mut r = Vec::new();
        p.controle("acao", &acao("camera:alternar"), &mut r);
        let mut rx = painel.camera();
        let mut r = Vec::new();
        p.controle("acao", &acao("camera:alternar"), &mut r);
        assert_eq!(controles(&r)[0], json!({"t":"camera","ligar":false}));
        assert!(matches!(rx.try_recv(), Err(mpsc::error::TryRecvError::Disconnected)));
    }

    #[test]
    fn falha_ao_ligar_camera_avisa_e_fica_desligada() {
        let (mut p, _) = montar_com(true, false);
        com_tela_aberta(&mut p, "camera");
        let mut r = Vec::new();
        p.controle("acao", &acao("camera:alternar"), &mut r);
        let t = controles(&r);
        assert_eq!(t[0]["t"], "aviso");
        assert_eq!(t[1]["pecas"][0]["ligado"], false);
        assert!(t.iter().all(|v| v["ligar"] != true));
    }

    #[test]
    fn pedacos_da_camera_viram_quadros() {
        let (mut p, painel) = montar();
        let mut r = Vec::new();
        p.controle("acao", &acao("camera:alternar"), &mut r);
        let mut rx = painel.camera();

        // Quadro-chave grande, em 3 pedaços.
        let grande = Quadro { dados: vec![7; MAX_PEDACO * 2 + 10], chave: true };
        assert_eq!(pedacos_da_camera(&grande, 1).len(), 3);
        for m in pedacos_da_camera(&grande, 1) {
            p.midia_do_celular(&m);
        }
        assert_eq!(rx.try_recv(), Ok(grande.dados.clone()));

        // Quadro de diferença (pts 2) com o primeiro pedaço perdido: nada sai, e o outro
        // de diferença inteiro também fica de fora (espera chave).
        let diferenca = Quadro { dados: vec![3; MAX_PEDACO * 2 + 10], chave: false };
        let pedacos = pedacos_da_camera(&diferenca, 2);
        p.midia_do_celular(&pedacos[1]);
        p.midia_do_celular(&pedacos[2]);
        let pequeno = Quadro { dados: vec![4; 50], chave: false };
        for m in pedacos_da_camera(&pequeno, 3) {
            p.midia_do_celular(&m);
        }
        assert!(rx.try_recv().is_err());

        // Quadro-chave inteiro volta a sair.
        let chave = Quadro { dados: vec![5; 80], chave: true };
        for m in pedacos_da_camera(&chave, 4) {
            p.midia_do_celular(&m);
        }
        assert_eq!(rx.try_recv(), Ok(chave.dados.clone()));

        // De diferença com o último pedaço perdido: o começo do próximo quadro denuncia a
        // perda; o próximo de diferença fica de fora, e o chave seguinte volta a sair.
        let sem_fim = Quadro { dados: vec![6; MAX_PEDACO * 2 + 10], chave: false };
        let pedacos = pedacos_da_camera(&sem_fim, 5);
        p.midia_do_celular(&pedacos[0]);
        p.midia_do_celular(&pedacos[1]);
        let proximo = Quadro { dados: vec![8; 60], chave: false };
        for m in pedacos_da_camera(&proximo, 6) {
            p.midia_do_celular(&m);
        }
        assert!(rx.try_recv().is_err());
        let chave2 = Quadro { dados: vec![9; 70], chave: true };
        for m in pedacos_da_camera(&chave2, 7) {
            p.midia_do_celular(&m);
        }
        assert_eq!(rx.try_recv(), Ok(chave2.dados.clone()));
        assert!(rx.try_recv().is_err());
    }

    #[test]
    fn montagem_descarta_pts_diferente_e_quadro_grande() {
        let mut m = Montagem::default();
        // Primeiro pedaço de um quadro-chave; o último chega com outro pts: descarta.
        assert!(m.pedaco(10, MARCA_CHAVE | MARCA_PRIMEIRO, &[1]).is_none());
        assert!(m.pedaco(11, MARCA_CHAVE | MARCA_ULTIMO, &[2]).is_none());
        // Quadro-chave seguinte, inteiro, sai.
        let q = m.pedaco(12, MARCA_CHAVE | MARCA_PRIMEIRO | MARCA_ULTIMO, &[3, 4]).unwrap();
        assert_eq!(q, Quadro { dados: vec![3, 4], chave: true });
        // Quadro acima do limite: descarta e espera chave.
        let grande = vec![0u8; MAX_QUADRO / 2 + 1];
        assert!(m.pedaco(13, MARCA_CHAVE | MARCA_PRIMEIRO, &grande).is_none());
        assert!(m.pedaco(13, MARCA_ULTIMO, &grande).is_none());
        assert!(m.pedaco(13, MARCA_CHAVE | MARCA_PRIMEIRO, &grande).is_none());
    }

    #[test]
    fn audio_so_com_microfone_ligado() {
        let (mut p, painel) = montar();
        let bloco = vec![1u8; 640];
        // Desligado: nada é aberto nem escrito.
        p.midia_do_celular(&Mensagem::Audio { pts_us: 0, dados: bloco.clone() });
        assert!(painel.log().is_empty());

        com_tela_aberta(&mut p, "microfone");
        let mut r = Vec::new();
        p.controle("acao", &acao("microfone:alternar"), &mut r);
        let t = controles(&r);
        assert_eq!(t[0], json!({"t":"microfone","ligar":true}));
        assert_eq!(t[1]["tela"], "microfone");
        assert_eq!(t[1]["pecas"][0]["texto"], "enviando");

        let mut rx = painel.fifo();
        p.midia_do_celular(&Mensagem::Audio { pts_us: 20_000, dados: bloco.clone() });
        assert_eq!(rx.try_recv(), Ok(bloco.clone()));

        let mut r = Vec::new();
        p.controle("acao", &acao("microfone:alternar"), &mut r);
        assert_eq!(controles(&r)[0], json!({"t":"microfone","ligar":false}));
        assert!(painel.log().contains(&"modulo 7 descarregado".to_string()));
        // Desligado de novo: o canal está fechado e nada mais é escrito.
        assert!(matches!(rx.try_recv(), Err(mpsc::error::TryRecvError::Disconnected)));
        p.midia_do_celular(&Mensagem::Audio { pts_us: 40_000, dados: bloco });
    }

    #[test]
    fn falha_ao_ligar_microfone_nao_deixa_modulo_carregado() {
        let (mut p, painel) = montar_com(false, true);
        let mut r = Vec::new();
        p.controle("acao", &acao("microfone:alternar"), &mut r);
        assert_eq!(controles(&r)[0]["t"], "aviso");
        assert!(!painel.log().iter().any(|l| l.starts_with("modulo") && l.contains("descarregado")));
    }

    #[test]
    fn encerrar_desliga_tudo() {
        let (mut p, painel) = montar();
        let mut r = Vec::new();
        p.controle("acao", &acao("camera:alternar"), &mut r);
        p.controle("acao", &acao("microfone:alternar"), &mut r);
        let mut cam = painel.camera();
        let mut fifo = painel.fifo();
        p.encerrar();
        assert!(matches!(cam.try_recv(), Err(mpsc::error::TryRecvError::Disconnected)));
        assert!(matches!(fifo.try_recv(), Err(mpsc::error::TryRecvError::Disconnected)));
        assert!(painel.log().contains(&"modulo 7 descarregado".to_string()));
        // Repetir não faz nada de novo.
        p.encerrar();
        drop(p);
        assert_eq!(painel.log().iter().filter(|l| l.contains("descarregado")).count(), 1);
    }

    #[test]
    fn ids_de_outras_extensoes_sao_recusados() {
        let (mut p, painel) = montar();
        let mut r = Vec::new();
        assert!(!p.controle("acao", &acao("mixer:geral"), &mut r));
        assert!(!p.controle("acao", &json!({"t":"acao"}), &mut r));
        assert!(r.is_empty());
        assert!(painel.log().is_empty());
    }

    fn existe_no_pipewire(nome: &str) -> bool {
        saida_de("pw-cli", &["ls", "Node"]).contains(nome)
    }

    fn saida_de(programa: &str, args: &[&str]) -> String {
        std::process::Command::new(programa)
            .args(args)
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
            .unwrap_or_default()
    }

    /// Roda com `cargo test -q -- --ignored sumidouros_reais --nocapture`. Usa o PipeWire e o
    /// PulseAudio deste computador e deixa tudo desligado no fim.
    #[tokio::test]
    #[ignore]
    async fn sumidouros_reais() {
        let mut p = PonteMidia::nova();

        // Microfone: módulo carregado, 1 s de silêncio, descarregado.
        let mut r = Vec::new();
        p.controle("acao", &acao("microfone:alternar"), &mut r);
        println!("microfone ligado: {:?}", controles(&r)[0]);
        assert_eq!(controles(&r)[0], json!({"t":"microfone","ligar":true}));
        let fontes = saida_de("pactl", &["list", "sources", "short"]);
        println!("pactl list sources short | grep opentrackpad_mic:");
        for l in fontes.lines().filter(|l| l.contains("opentrackpad_mic")) {
            println!("  {l}");
        }
        assert!(fontes.contains("opentrackpad_mic"));
        for _ in 0..50 {
            p.midia_do_celular(&Mensagem::Audio { pts_us: 0, dados: vec![0u8; 640] });
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let mut r = Vec::new();
        p.controle("acao", &acao("microfone:alternar"), &mut r);
        assert_eq!(controles(&r)[0], json!({"t":"microfone","ligar":false}));
        let fontes = saida_de("pactl", &["list", "sources", "short"]);
        println!("depois de descarregar, opentrackpad_mic presente: {}", fontes.contains("opentrackpad_mic"));
        assert!(!fontes.contains("opentrackpad_mic"));

        // Câmera: 2 s de quadros de um gst-launch, passados pela ponte como pedaços CAMERA.
        let mut r = Vec::new();
        p.controle("acao", &acao("camera:alternar"), &mut r);
        assert_eq!(controles(&r)[0]["ligar"], true);
        let mut gerador = tokio::process::Command::new("gst-launch-1.0")
            .args([
                "-q",
                "videotestsrc",
                "num-buffers=60",
                "!",
                "x264enc",
                "tune=zerolatency",
                "!",
                "video/x-h264,stream-format=byte-stream",
                "!",
                "fdsink",
                "fd=1",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .expect("gst-launch-1.0 do gerador");
        let mut saida_gst = gerador.stdout.take().unwrap();
        let mut sep = Separador::default();
        let mut buf = vec![0u8; 64 * 1024];
        let inicio = Instant::now();
        let mut quadros = 0;
        let mut no_pipewire = false;
        loop {
            let n = saida_gst.read(&mut buf).await.unwrap();
            let prontos = if n == 0 { sep.terminar() } else { sep.alimentar(&buf[..n]) };
            for q in prontos {
                for m in pedacos_da_camera(&q, inicio.elapsed().as_micros() as u64) {
                    p.midia_do_celular(&m);
                }
                quadros += 1;
                tokio::time::sleep(Duration::from_millis(33)).await;
            }
            if !no_pipewire && inicio.elapsed() > Duration::from_secs(1) {
                no_pipewire = existe_no_pipewire("opentrackpad-camera");
                println!("enquanto roda, pw-cli ls Node tem opentrackpad-camera: {no_pipewire}");
            }
            if n == 0 {
                break;
            }
        }
        gerador.wait().await.unwrap();
        println!("quadros repassados: {quadros} em {:.1} s", inicio.elapsed().as_secs_f32());
        assert!(quadros >= 50, "poucos quadros: {quadros}");
        assert!(no_pipewire, "o nó da câmera não apareceu no PipeWire");

        let mut r = Vec::new();
        p.controle("acao", &acao("camera:alternar"), &mut r);
        assert_eq!(controles(&r)[0], json!({"t":"camera","ligar":false}));
        tokio::time::sleep(Duration::from_millis(500)).await;
        println!("depois de desligar, opentrackpad-camera no PipeWire: {}", existe_no_pipewire("opentrackpad-camera"));
        // Só o sumidouro desta feature: outros gst-launch-1.0 da máquina não contam.
        let restos: Vec<String> = saida_de("pgrep", &["-a", "-x", "gst-launch-1.0"])
            .lines()
            .filter(|l| l.contains("opentrackpad-camera"))
            .map(String::from)
            .collect();
        println!("sumidouros da câmera restantes: {restos:?}");
        assert!(!existe_no_pipewire("opentrackpad-camera"));
        assert!(restos.is_empty());
    }
}
