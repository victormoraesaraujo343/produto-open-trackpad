//! Espelhar a tela: captura (portal ScreenCast + PipeWire), H.264 pelo GStreamer e envio em
//! pedaços (ver "Vídeo" em `protocolo/README.md`).
//!
//! O GStreamer roda como processo filho (`gst-launch-1.0`) e entrega o H.264 em Annex B na
//! saída padrão; aqui o fluxo é separado em quadros (unidades de acesso) e cada quadro vira
//! uma ou mais mensagens VIDEO. Celular atrasado: quadros que não são chave são descartados.

use std::process::Stdio;
use std::time::Instant;

use serde_json::{json, Value};
use tokio::io::AsyncReadExt;
use tokio::sync::mpsc;

use crate::protocolo::{controle, Mensagem};
use crate::sessao::Extensao;

/// Maior pedaço de quadro numa mensagem (65 535 − tipo − pts − marcas).
pub const MAX_PEDACO: usize = 65_535 - 1 - 8 - 1;

pub const MARCA_CHAVE: u8 = 1;
pub const MARCA_ULTIMO: u8 = 2;
pub const MARCA_PRIMEIRO: u8 = 4;

/// Um quadro H.264 completo (Annex B, com os códigos de início).
#[derive(Debug, Clone, PartialEq)]
pub struct Quadro {
    pub dados: Vec<u8>,
    pub chave: bool,
}

/// Separa um fluxo Annex B em quadros. Recebe bytes em qualquer tamanho.
#[derive(Default)]
pub struct Separador {
    buffer: Vec<u8>,
    /// NALs do quadro em montagem.
    atual: Vec<u8>,
    atual_tem_vcl: bool,
    atual_chave: bool,
}

impl Separador {
    pub fn alimentar(&mut self, bytes: &[u8]) -> Vec<Quadro> {
        self.buffer.extend_from_slice(bytes);
        let mut prontos = Vec::new();
        // Só processa NALs que têm o início do próximo depois (a última pode estar incompleta).
        let inicios = inicios_de_nal(&self.buffer);
        if inicios.len() < 2 {
            return prontos;
        }
        for par in inicios.windows(2) {
            let nal = self.buffer[par[0]..par[1]].to_vec();
            self.nal(nal, &mut prontos);
        }
        let ultimo = *inicios.last().unwrap();
        self.buffer.drain(..ultimo);
        prontos
    }

    /// Fim do fluxo: entrega o que sobrou.
    pub fn terminar(&mut self) -> Vec<Quadro> {
        let mut prontos = Vec::new();
        if !self.buffer.is_empty() {
            let nal = std::mem::take(&mut self.buffer);
            self.nal(nal, &mut prontos);
        }
        self.fechar(&mut prontos);
        prontos
    }

    fn nal(&mut self, nal: Vec<u8>, prontos: &mut Vec<Quadro>) {
        let cab = tamanho_do_inicio(&nal);
        let Some(&byte) = nal.get(cab) else { return };
        let tipo = byte & 0x1f;
        let vcl = tipo == 1 || tipo == 5;
        // Começa um quadro novo: delimitador (9), SPS/PPS/SEI (7, 8, 6) depois de um
        // quadro com imagem, ou fatia com first_mb_in_slice == 0 (primeiro bit 1).
        let primeira_fatia = vcl && nal.get(cab + 1).is_some_and(|b| b & 0x80 != 0);
        let novo = self.atual_tem_vcl && (matches!(tipo, 6..=9) || primeira_fatia);
        if novo {
            self.fechar(prontos);
        }
        self.atual.extend_from_slice(&nal);
        self.atual_tem_vcl |= vcl;
        self.atual_chave |= tipo == 5;
    }

    fn fechar(&mut self, prontos: &mut Vec<Quadro>) {
        if self.atual_tem_vcl {
            prontos.push(Quadro { dados: std::mem::take(&mut self.atual), chave: self.atual_chave });
        } else {
            self.atual.clear();
        }
        self.atual_tem_vcl = false;
        self.atual_chave = false;
    }
}

/// Posições onde começa cada código de início (`00 00 01` ou `00 00 00 01`).
fn inicios_de_nal(b: &[u8]) -> Vec<usize> {
    let mut v = Vec::new();
    let mut i = 0;
    while i + 3 <= b.len() {
        if b[i] == 0 && b[i + 1] == 0 && b[i + 2] == 1 {
            v.push(if i > 0 && b[i - 1] == 0 { i - 1 } else { i });
            i += 3;
        } else {
            i += 1;
        }
    }
    v
}

fn tamanho_do_inicio(nal: &[u8]) -> usize {
    if nal.starts_with(&[0, 0, 0, 1]) {
        4
    } else if nal.starts_with(&[0, 0, 1]) {
        3
    } else {
        0
    }
}

/// Quadro → mensagens VIDEO (pedaços de até `MAX_PEDACO`).
pub fn fatiar(q: &Quadro, pts_us: u64) -> Vec<Mensagem> {
    let pedacos: Vec<&[u8]> = q.dados.chunks(MAX_PEDACO).collect();
    let n = pedacos.len();
    pedacos
        .into_iter()
        .enumerate()
        .map(|(i, p)| {
            let mut marcas = if q.chave { MARCA_CHAVE } else { 0 };
            if i == 0 {
                marcas |= MARCA_PRIMEIRO;
            }
            if i + 1 == n {
                marcas |= MARCA_ULTIMO;
            }
            Mensagem::Video { pts_us, marcas, dados: p.to_vec() }
        })
        .collect()
}

/// De onde vem a imagem.
#[derive(Debug, Clone)]
pub enum Fonte {
    /// Barras de cor do GStreamer: prova o caminho inteiro sem capturar a tela.
    Teste,
    /// Nó do PipeWire aberto pelo portal ScreenCast (`fd` herdado como 3).
    Portal { fd: std::os::fd::RawFd, no: u32 },
}

/// Codificador disponível: VA-API (GPU) se houver, senão x264.
pub fn codificador() -> &'static str {
    static ESCOLHA: std::sync::OnceLock<&'static str> = std::sync::OnceLock::new();
    ESCOLHA.get_or_init(|| {
        let tem = |e: &str| std::process::Command::new("gst-inspect-1.0").arg(e).stdout(Stdio::null()).stderr(Stdio::null()).status().is_ok_and(|s| s.success());
        if tem("vah264enc") { "vah264enc" } else { "x264enc" }
    })
}

/// Argumentos do `gst-launch-1.0` (sem shell).
pub fn argumentos(fonte: &Fonte, w: u32, h: u32, kbps: u32, enc: &str) -> Vec<String> {
    let mut a: Vec<String> = vec!["-q".into()];
    match fonte {
        Fonte::Teste => a.extend(["videotestsrc", "is-live=true", "pattern=smpte"].map(String::from)),
        Fonte::Portal { no, .. } => {
            a.extend(["pipewiresrc".to_owned(), "fd=3".to_owned(), format!("path={no}"), "do-timestamp=true".to_owned(), "keepalive-time=1000".to_owned()])
        }
    }
    a.extend(["!", "videoconvert", "!", "videoscale", "!", "videorate", "!"].map(String::from));
    a.push(format!("video/x-raw,format=NV12,width={w},height={h},framerate=30/1"));
    a.push("!".into());
    if enc == "vah264enc" {
        // Sem quadros B (o celular decodifica na ordem) e chave a cada 2 s.
        a.extend(["vah264enc".to_owned(), "b-frames=0".to_owned(), format!("bitrate={kbps}"), "key-int-max=60".to_owned(), "rate-control=cbr".to_owned()]);
        a.extend(["!".to_owned(), "video/x-h264,profile=main".to_owned()]);
    } else {
        a.extend(["x264enc".to_owned(), "tune=zerolatency".to_owned(), "speed-preset=ultrafast".to_owned(), format!("bitrate={kbps}"), "key-int-max=60".to_owned()]);
        a.extend(["!".to_owned(), "video/x-h264,profile=constrained-baseline".to_owned()]);
    }
    a.extend(["!", "h264parse", "config-interval=-1", "!", "video/x-h264,stream-format=byte-stream,alignment=au", "!", "fdsink", "fd=1", "sync=false"].map(String::from));
    a
}

/// Roda o codificador e manda os quadros até `parar` ou o canal fechar.
pub async fn transmitir(fonte: Fonte, w: u32, h: u32, kbps: u32, enviar: mpsc::Sender<Mensagem>, mut parar: tokio::sync::oneshot::Receiver<()>) {
    let args = argumentos(&fonte, w, h, kbps, codificador());
    let mut cmd = tokio::process::Command::new("gst-launch-1.0");
    cmd.args(&args).stdout(Stdio::piped()).stderr(Stdio::null()).stdin(Stdio::null()).kill_on_drop(true);
    if let Fonte::Portal { fd, .. } = fonte {
        // O pipewiresrc lê o nó pelo descritor 3.
        unsafe {
            cmd.pre_exec(move || {
                if libc_dup2(fd, 3) < 0 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }
    }
    let mut filho = match cmd.spawn() {
        Ok(f) => f,
        Err(e) => {
            let _ = enviar.try_send(controle(json!({"t":"aviso","texto":"Não deu para começar o vídeo"})));
            eprintln!("vídeo: gst-launch-1.0: {e}");
            return;
        }
    };
    let mut saida = filho.stdout.take().expect("stdout com pipe");
    let mut sep = Separador::default();
    let inicio = Instant::now();
    let mut buf = vec![0u8; 256 * 1024];
    let mut esperando_chave = true;
    loop {
        tokio::select! {
            _ = &mut parar => break,
            lido = saida.read(&mut buf) => {
                let n = match lido { Ok(0) | Err(_) => break, Ok(n) => n };
                for q in sep.alimentar(&buf[..n]) {
                    // Fila curta: com o celular atrasado, só passa quadro-chave.
                    let folga = enviar.capacity();
                    if !q.chave && (esperando_chave || folga < enviar.max_capacity().saturating_sub(24)) {
                        esperando_chave = true;
                        continue;
                    }
                    let pts = inicio.elapsed().as_micros() as u64;
                    let msgs = fatiar(&q, pts);
                    if folga < msgs.len() + 8 {
                        esperando_chave = true;
                        continue;
                    }
                    esperando_chave = false;
                    for m in msgs {
                        if enviar.try_send(m).is_err() {
                            esperando_chave = true;
                            break;
                        }
                    }
                }
            }
        }
    }
    let _ = filho.kill().await;
}

extern "C" {
    #[link_name = "dup2"]
    fn dup2_c(old: i32, new: i32) -> i32;
}

fn libc_dup2(old: i32, new: i32) -> i32 {
    unsafe { dup2_c(old, new) }
}

/// Extensão da tela `espelho` (grupo Tela, nível 3).
pub struct Espelho {
    enviar: Option<mpsc::Sender<Mensagem>>,
    parar: Option<tokio::sync::oneshot::Sender<()>>,
    /// Abre a fonte (portal na vida real, teste nos testes/emulador).
    abrir_fonte: Box<dyn FnMut() -> Option<Fonte> + Send>,
    pub tamanho: (u32, u32),
    pub kbps: u32,
}

impl Espelho {
    pub fn novo(abrir_fonte: Box<dyn FnMut() -> Option<Fonte> + Send>) -> Self {
        Self { enviar: None, parar: None, abrir_fonte, tamanho: (1280, 720), kbps: 4000 }
    }

    fn parar(&mut self) {
        if let Some(p) = self.parar.take() {
            let _ = p.send(());
        }
    }
}

impl Extensao for Espelho {
    fn telas(&self) -> Vec<Value> {
        vec![json!({"id":"espelho","nome":"Espelho","icone":"tela","grupo":"Tela","nivel":3})]
    }

    fn conectar(&mut self, enviar: mpsc::Sender<Mensagem>) {
        self.enviar = Some(enviar);
    }

    fn encerrar(&mut self) {
        self.parar();
    }

    fn controle(&mut self, t: &str, msg: &Value, r: &mut Vec<Mensagem>) -> bool {
        if t != "abrir" {
            return false;
        }
        if msg["tela"] != "espelho" {
            self.parar();
            return false;
        }
        self.parar();
        let (w, h) = self.tamanho;
        r.push(controle(json!({"t":"tela","id":"espelho","nome":"Espelho","nivel":3,
            "pecas":[{"p":"video","id":"tela","w":w,"h":h,"modo":"trackpad"}]})));
        let (Some(enviar), Some(fonte)) = (self.enviar.clone(), (self.abrir_fonte)()) else {
            r.push(controle(json!({"t":"aviso","texto":"Sem permissão para ver a tela"})));
            return true;
        };
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.parar = Some(tx);
        tokio::spawn(transmitir(fonte, w, h, self.kbps, enviar, rx));
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nal(tipo: u8, resto: &[u8]) -> Vec<u8> {
        let mut v = vec![0, 0, 0, 1, tipo];
        v.extend_from_slice(resto);
        v
    }

    #[test]
    fn separa_quadros_por_fatia_inicial() {
        let mut s = Separador::default();
        let mut fluxo = Vec::new();
        fluxo.extend(nal(0x67, &[1, 2])); // SPS
        fluxo.extend(nal(0x68, &[3])); // PPS
        fluxo.extend(nal(0x65, &[0x88, 9])); // IDR, primeira fatia
        fluxo.extend(nal(0x41, &[0x9a, 7])); // P, primeira fatia
        fluxo.extend(nal(0x41, &[0x9a, 8])); // P, primeira fatia
        let mut q = s.alimentar(&fluxo);
        q.extend(s.terminar());
        assert_eq!(q.len(), 3);
        assert!(q[0].chave);
        assert!(q[0].dados.starts_with(&[0, 0, 0, 1, 0x67]));
        assert!(!q[1].chave);
        assert_eq!(q[2].dados, nal(0x41, &[0x9a, 8]));
    }

    #[test]
    fn bytes_aos_pedacos_dao_o_mesmo_resultado() {
        let mut fluxo = Vec::new();
        for _ in 0..5 {
            fluxo.extend(nal(0x65, &[0x88, 1, 2, 3]));
        }
        let mut s = Separador::default();
        let mut q = Vec::new();
        for b in fluxo.chunks(3) {
            q.extend(s.alimentar(b));
        }
        q.extend(s.terminar());
        assert_eq!(q.len(), 5);
        assert!(q.iter().all(|x| x.chave && x.dados.len() == 9));
    }

    #[test]
    fn segunda_fatia_do_mesmo_quadro_nao_abre_outro() {
        let mut s = Separador::default();
        let mut fluxo = nal(0x65, &[0x88]);
        fluxo.extend(nal(0x65, &[0x40])); // first_mb_in_slice != 0
        let mut q = s.alimentar(&fluxo);
        q.extend(s.terminar());
        assert_eq!(q.len(), 1);
    }

    #[test]
    fn fatiar_quadro_grande() {
        let q = Quadro { dados: vec![7; MAX_PEDACO * 2 + 10], chave: true };
        let m = fatiar(&q, 99);
        assert_eq!(m.len(), 3);
        let marcas: Vec<u8> = m.iter().map(|x| match x { Mensagem::Video { marcas, .. } => *marcas, _ => 0 }).collect();
        assert_eq!(marcas, vec![MARCA_CHAVE | MARCA_PRIMEIRO, MARCA_CHAVE, MARCA_CHAVE | MARCA_ULTIMO]);
        for x in &m {
            assert!(crate::protocolo::codificar(x).is_ok());
        }
    }

    #[test]
    fn argumentos_do_teste_sem_shell() {
        let a = argumentos(&Fonte::Teste, 1280, 720, 4000, "x264enc");
        assert_eq!(a[1], "videotestsrc");
        assert!(a.contains(&"video/x-raw,format=NV12,width=1280,height=720,framerate=30/1".to_owned()));
        assert!(a.iter().any(|x| x == "fdsink"));
    }

    #[tokio::test]
    #[ignore]
    async fn codifica_de_verdade() {
        // `cargo test -q -- --ignored codifica_de_verdade --nocapture`
        let (tx, mut rx) = mpsc::channel(256);
        let (parar, rx_parar) = tokio::sync::oneshot::channel();
        tokio::spawn(transmitir(Fonte::Teste, 640, 360, 1500, tx, rx_parar));
        let mut quadros = 0;
        let mut chaves = 0;
        let fim = Instant::now() + std::time::Duration::from_secs(3);
        while Instant::now() < fim {
            if let Ok(Some(Mensagem::Video { marcas, .. })) = tokio::time::timeout(std::time::Duration::from_millis(500), rx.recv()).await {
                if marcas & MARCA_ULTIMO != 0 {
                    quadros += 1;
                }
                if marcas & MARCA_CHAVE != 0 && marcas & MARCA_PRIMEIRO != 0 {
                    chaves += 1;
                }
            }
        }
        let _ = parar.send(());
        println!("codificador {}: {quadros} quadros, {chaves} chave em 3 s", codificador());
        assert!(quadros > 30 && chaves >= 1);
    }
}
