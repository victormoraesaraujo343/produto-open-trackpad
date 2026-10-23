//! Mixer de som (tela `mixer`, nome "Som", seção 11 do protótipo): o volume geral, um fader
//! por app que toca som e a escolha da saída. Fala com o `pactl` (PipeWire com
//! `pipewire-pulse`) com argumentos separados, nunca por shell.
//!
//! Só age sobre o que o celular recebeu na última leitura: um `app:<id>` ou `saida:<nome>`
//! que não estava na tela é ignorado. O `geral` não tem argumento vindo do celular (o
//! volume é um número 0..1 e o alvo é sempre `@DEFAULT_SINK@`).

use std::process::Command;

use serde_json::{json, Value};

use crate::painel::Executor;
use crate::protocolo::{controle, Mensagem};
use crate::sessao::{Evento, Extensao};

const TELA: &str = "mixer";
const SINK_PADRAO: &str = "@DEFAULT_SINK@";
/// Tamanho máximo de rótulo que o celular recebe (o resto vira "…").
const ROTULO_MAX: usize = 24;

/// Um app tocando som (sink-input do `pactl`).
#[derive(Debug, Clone, PartialEq)]
pub struct Fluxo {
    pub id: u32,
    pub app: String,
    /// `application.icon_name`, só o texto. O celular só tem os ícones do kit, então por
    /// enquanto não vai para a tela.
    pub icone: String,
    /// Média dos canais, 0..1 (acima de 100% vira 1,0).
    pub volume: f64,
    pub mudo: bool,
    /// `corked`: app pausado. Fica de fora da tela (a tela é "o que está tocando").
    pub pausado: bool,
}

/// Uma saída de som (sink do `pactl`).
#[derive(Debug, Clone, PartialEq)]
pub struct Destino {
    pub nome: String,
    pub descricao: String,
    /// `node.nick` quando existe ("GP2711", "USB-MIC"), senão a descrição.
    pub rotulo: String,
    pub padrao: bool,
    pub volume: f64,
    pub mudo: bool,
}

/// Como estava o som numa leitura: o geral (é o sink padrão), os apps e as saídas.
#[derive(Debug, Clone, PartialEq)]
struct Leitura {
    geral: Destino,
    apps: Vec<Fluxo>,
    saidas: Vec<Destino>,
}

/// Identidade da tela: (id e nome de cada app; nome, rótulo e padrão de cada saída).
type Chave = (Vec<(u32, String)>, Vec<(String, String, bool)>);

impl Leitura {
    /// O que muda a estrutura da tela (apps e saídas, e qual é o padrão). Se só mudou
    /// volume ou mudo, basta mandar `estado`.
    fn chave(&self) -> Chave {
        (
            self.apps.iter().map(|a| (a.id, a.app.clone())).collect(),
            self.saidas.iter().map(|s| (s.nome.clone(), s.rotulo.clone(), s.padrao)).collect(),
        )
    }
}

/// Lista de sink-inputs do `pactl -f json list sink-inputs`. `None` = JSON inválido.
pub fn fluxos(json: &str) -> Option<Vec<Fluxo>> {
    let v: Value = serde_json::from_str(json).ok()?;
    Some(v.as_array()?.iter().filter_map(fluxo).collect())
}

/// Lista de saídas do `pactl -f json list sinks`. `padrao` é o nome que veio de
/// `pactl get-default-sink`. `None` = JSON inválido.
pub fn destinos(json: &str, padrao: &str) -> Option<Vec<Destino>> {
    let v: Value = serde_json::from_str(json).ok()?;
    Some(v.as_array()?.iter().filter_map(|s| destino(s, padrao)).collect())
}

fn fluxo(v: &Value) -> Option<Fluxo> {
    let id = u32::try_from(v["index"].as_u64()?).ok()?;
    let p = &v["properties"];
    let app = texto(&p["application.name"])
        .or_else(|| texto(&p["application.process.binary"]))
        .unwrap_or_else(|| "Aplicativo".to_owned());
    Some(Fluxo {
        id,
        app,
        icone: texto(&p["application.icon_name"]).unwrap_or_default(),
        volume: normalizar(volume_percentual(v).unwrap_or(0.0)),
        mudo: v["mute"].as_bool().unwrap_or(false),
        pausado: v["corked"].as_bool().unwrap_or(false),
    })
}

fn destino(v: &Value, padrao: &str) -> Option<Destino> {
    let nome = texto(&v["name"])?;
    let descricao = texto(&v["description"]).unwrap_or_else(|| nome.clone());
    let rotulo = texto(&v["properties"]["node.nick"]).unwrap_or_else(|| descricao.clone());
    Some(Destino {
        padrao: nome == padrao,
        volume: normalizar(volume_percentual(v).unwrap_or(0.0)),
        mudo: v["mute"].as_bool().unwrap_or(false),
        nome,
        descricao,
        rotulo,
    })
}

fn texto(v: &Value) -> Option<String> {
    v.as_str().map(str::trim).filter(|s| !s.is_empty()).map(String::from)
}

/// Média, em %, dos canais. Usa `value_percent` ("61%"); sem ele, `value` (65536 = 100%).
fn volume_percentual(v: &Value) -> Option<f64> {
    let pcts: Vec<f64> = v["volume"]
        .as_object()?
        .values()
        .filter_map(|c| {
            c["value_percent"]
                .as_str()
                .and_then(|s| s.trim().trim_end_matches('%').trim().parse::<f64>().ok())
                .or_else(|| c["value"].as_f64().map(|x| x / 65536.0 * 100.0))
        })
        .filter(|p| p.is_finite())
        .collect();
    if pcts.is_empty() {
        return None;
    }
    Some(pcts.iter().sum::<f64>() / pcts.len() as f64)
}

/// Percentual (0..150 no PulseAudio) para o 0..1 do protocolo, limitado a 1,0.
fn normalizar(pct: f64) -> f64 {
    (pct / 100.0).clamp(0.0, 1.0)
}

fn percentual(valor: f64) -> String {
    format!("{}%", (valor.clamp(0.0, 1.0) * 100.0).round() as u32)
}

/// Inteiro em %: é o que decide se o celular precisa de uma atualização de volume.
fn pct(valor: f64) -> u32 {
    (valor * 100.0).round() as u32
}

fn curto(s: &str) -> String {
    if s.chars().count() > ROTULO_MAX {
        format!("{}…", s.chars().take(ROTULO_MAX - 1).collect::<String>())
    } else {
        s.to_owned()
    }
}

/// Executor real: `pactl` do sistema, com argumentos separados (sem shell).
fn pactl_do_sistema() -> Executor {
    Box::new(|args: &[&str]| -> Option<String> {
        let saida = Command::new("pactl").args(args).output().ok()?;
        saida.status.success().then(|| String::from_utf8_lossy(&saida.stdout).into_owned())
    })
}

pub struct Mixer {
    executor: Executor,
    /// A tela `mixer` está aberta no celular (tique só age então).
    aberta: bool,
    /// Última leitura mandada ao celular. Base para validar ações e para o diff dos tiques.
    ultima: Option<Leitura>,
}

impl Mixer {
    /// Mixer com um executor qualquer (o `pactl` real ou um falso nos testes).
    pub fn new(executor: Executor) -> Self {
        Self { executor, aberta: false, ultima: None }
    }

    /// Mixer que roda o `pactl` do sistema.
    pub fn do_sistema() -> Self {
        Self::new(pactl_do_sistema())
    }

    fn pactl(&mut self, args: &[&str]) -> Option<String> {
        (self.executor)(args)
    }

    /// Lê o som agora. `None` se algum comando falhou ou não há saída padrão na lista.
    fn ler(&mut self) -> Option<Leitura> {
        let json_apps = self.pactl(&["-f", "json", "list", "sink-inputs"])?;
        let json_saidas = self.pactl(&["-f", "json", "list", "sinks"])?;
        let padrao = self.pactl(&["get-default-sink"])?;
        let apps: Vec<Fluxo> = fluxos(&json_apps)?.into_iter().filter(|f| !f.pausado).collect();
        let saidas = destinos(&json_saidas, padrao.trim())?;
        let geral = saidas.iter().find(|d| d.padrao)?.clone();
        Some(Leitura { geral, apps, saidas })
    }

    fn executar(&mut self, args: &[&str], respostas: &mut Vec<Mensagem>) {
        if self.pactl(args).is_none() {
            respostas.push(controle(json!({"t":"aviso","texto":"Não deu para mudar o som"})));
        }
    }

    fn abrir(&mut self, msg: &Value, respostas: &mut Vec<Mensagem>) -> bool {
        if msg["tela"].as_str() != Some(TELA) {
            // Outra tela: o celular não está mais mostrando o mixer.
            self.aberta = false;
            self.ultima = None;
            return false;
        }
        self.aberta = true;
        match self.ler() {
            Some(l) => {
                respostas.push(controle(tela(&l)));
                self.ultima = Some(l);
            }
            None => {
                self.ultima = None;
                respostas.push(controle(json!({"t":"aviso","texto":"Não deu para ler o som"})));
            }
        }
        true
    }

    /// `true` se o id é deste mixer (mesmo que a ação seja ignorada).
    fn acao(&mut self, msg: &Value, respostas: &mut Vec<Mensagem>) -> bool {
        let Some(id) = msg["id"].as_str() else { return false };
        if id != "geral" && !id.starts_with("app:") && !id.starts_with("saida:") {
            return false;
        }
        // Valor: número ou ausente. Qualquer outra coisa não vira "mudo" por engano.
        let valor = match &msg["valor"] {
            Value::Null => None,
            v => match v.as_f64() {
                Some(x) => Some(x),
                None => return true,
            },
        };

        if id == "geral" {
            match valor {
                Some(v) => {
                    let alvo = percentual(v);
                    self.executar(&["set-sink-volume", SINK_PADRAO, &alvo], respostas);
                }
                None => self.executar(&["set-sink-mute", SINK_PADRAO, "toggle"], respostas),
            }
        } else if let Some(n) = id.strip_prefix("app:") {
            // Só app que estava na tela (id numérico, da última leitura).
            let Ok(idx) = n.parse::<u32>() else { return true };
            if !self.ultima.as_ref().is_some_and(|l| l.apps.iter().any(|a| a.id == idx)) {
                return true;
            }
            let idx = idx.to_string();
            match valor {
                Some(v) => {
                    let alvo = percentual(v);
                    self.executar(&["set-sink-input-volume", &idx, &alvo], respostas);
                }
                None => self.executar(&["set-sink-input-mute", &idx, "toggle"], respostas),
            }
        } else if let Some(nome) = id.strip_prefix("saida:") {
            // Só saída que estava na lista da última leitura.
            let Some(nome) = self.ultima.as_ref().and_then(|l| l.saidas.iter().find(|d| d.nome == nome)).map(|d| d.nome.clone())
            else {
                return true;
            };
            self.executar(&["set-default-sink", &nome], respostas);
        }
        true
    }

    fn tique(&mut self, respostas: &mut Vec<Mensagem>) {
        if !self.aberta {
            return;
        }
        let Some(nova) = self.ler() else { return };
        match self.ultima.take() {
            Some(antes) if antes.chave() == nova.chave() => {
                let pecas = mudancas(&antes, &nova);
                if !pecas.is_empty() {
                    respostas.push(controle(json!({"t":"estado","tela":TELA,"pecas":pecas})));
                }
            }
            // App ou saída mudou (ou ainda não tinha tela mandada): a tela inteira de novo.
            _ => respostas.push(controle(tela(&nova))),
        }
        self.ultima = Some(nova);
    }
}

impl Extensao for Mixer {
    fn controle(&mut self, t: &str, msg: &Value, respostas: &mut Vec<Mensagem>) -> bool {
        match t {
            "abrir" => self.abrir(msg, respostas),
            "acao" => self.acao(msg, respostas),
            _ => false,
        }
    }

    fn telas(&self) -> Vec<Value> {
        vec![json!({"id":TELA,"nome":"Som","icone":"mixer","grupo":"Atalhos","nivel":2})]
    }

    fn evento(&mut self, e: &Evento, respostas: &mut Vec<Mensagem>) {
        if e.tipo == "tique" {
            self.tique(respostas);
        }
    }
}

fn fader(id: String, rotulo: &str, valor: f64, mudo: bool) -> Value {
    json!({"p":"fader","id":id,"rotulo":curto(rotulo),"valor":valor,"mudo":mudo})
}

/// A tela inteira: uma grade de faders (geral e apps) e, embaixo, uma linha de teclas
/// com as saídas. A saída padrão leva a dica "em uso".
fn tela(l: &Leitura) -> Value {
    let mut faders = vec![fader("geral".to_owned(), "Geral", l.geral.volume, l.geral.mudo)];
    faders.extend(l.apps.iter().map(|a| fader(format!("app:{}", a.id), &a.app, a.volume, a.mudo)));
    let mut pecas = vec![json!({"p":"grade","id":"faders","colunas":1,"pecas":faders})];
    if !l.saidas.is_empty() {
        let saidas: Vec<Value> = l
            .saidas
            .iter()
            .map(|s| {
                let mut tecla = json!({"p":"tecla","id":format!("saida:{}", s.nome),"rotulo":curto(&s.rotulo)});
                if s.padrao {
                    tecla["dica"] = json!("em uso");
                }
                tecla
            })
            .collect();
        pecas.push(json!({"p":"linha","id":"saidas","pecas":saidas}));
    }
    json!({"t":"tela","id":TELA,"nome":"Som","nivel":2,"pecas":pecas})
}

/// Só as peças cujo volume ou mudo mudou, e só esses campos. Vazio = nada a mandar.
fn mudancas(antes: &Leitura, depois: &Leitura) -> Vec<Value> {
    let mut pecas = Vec::new();
    let geral = (antes.geral.volume, antes.geral.mudo);
    let agora = (depois.geral.volume, depois.geral.mudo);
    pecas.extend(peca_mudou("geral".to_owned(), geral, agora));
    for d in &depois.apps {
        if let Some(a) = antes.apps.iter().find(|a| a.id == d.id) {
            pecas.extend(peca_mudou(format!("app:{}", d.id), (a.volume, a.mudo), (d.volume, d.mudo)));
        }
    }
    pecas
}

fn peca_mudou(id: String, antes: (f64, bool), depois: (f64, bool)) -> Option<Value> {
    let mut peca = json!({"id": id});
    let mut mudou = false;
    if pct(antes.0) != pct(depois.0) {
        peca["valor"] = json!(depois.0);
        mudou = true;
    }
    if antes.1 != depois.1 {
        peca["mudo"] = json!(depois.1);
        mudou = true;
    }
    mudou.then_some(peca)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    /// Saídas reais de `pactl -f json list sinks` (3 saídas deste computador), com os campos
    /// que o parser não usa tirados.
    const SINKS_REAIS: &str = r#"[
      {"index":49,"state":"SUSPENDED","name":"alsa_output.usb-USB-MIC_USB-MIC_20180508-00.analog-stereo",
       "description":"USB-MIC Analog Stereo","mute":false,
       "volume":{"front-left":{"value":39977,"value_percent":"61%","db":"-12.88 dB"},
                 "front-right":{"value":39977,"value_percent":"61%","db":"-12.88 dB"}},
       "properties":{"device.description":"USB-MIC","node.nick":"USB-MIC","media.class":"Audio/Sink"}},
      {"index":54,"state":"SUSPENDED","name":"alsa_output.pci-0000_0a_00.1.hdmi-stereo-extra2",
       "description":"Navi 48 HDMI/DP Audio Controller Digital Stereo (HDMI 3) [GP2711]","mute":false,
       "volume":{"front-left":{"value":26214,"value_percent":"40%","db":"-23.88 dB"},
                 "front-right":{"value":26214,"value_percent":"40%","db":"-23.88 dB"}},
       "properties":{"device.description":"Navi 48 HDMI/DP Audio Controller","node.nick":"GP2711","media.class":"Audio/Sink"}},
      {"index":55,"state":"SUSPENDED","name":"alsa_output.pci-0000_0c_00.4.iec958-stereo",
       "description":"Starship/Matisse HD Audio Controller Digital Stereo (IEC958)","mute":false,
       "volume":{"front-left":{"value":26214,"value_percent":"40%","db":"-23.88 dB"},
                 "front-right":{"value":26214,"value_percent":"40%","db":"-23.88 dB"}},
       "properties":{"device.description":"Starship/Matisse HD Audio Controller","node.nick":"ALC887-VD Digital","media.class":"Audio/Sink"}}
    ]"#;

    const PADRAO: &str = "alsa_output.usb-USB-MIC_USB-MIC_20180508-00.analog-stereo\n";

    /// Apps tocando, no formato de `pactl -f json list sink-inputs`. Sem sink-input ativo
    /// na máquina de desenvolvimento, a forma segue a saída documentada do `pactl`.
    const FLUXOS_DOIS: &str = r#"[
      {"index":42,"driver":"protocol-native.c","owner_module":30,"client":51,"sink":49,
       "sample_specification":"s16le 2ch 44100Hz","channel_map":"front-left,front-right",
       "format":"pcm","corked":false,"mute":false,
       "volume":{"front-left":{"value":35389,"value_percent":"54%","db":"-16.34 dB"},
                 "front-right":{"value":35389,"value_percent":"54%","db":"-16.34 dB"}},
       "balance":0.00,
       "properties":{"application.name":"Spotify","application.process.binary":"spotify",
                     "application.icon_name":"spotify-client","media.name":"Spotify"}},
      {"index":57,"driver":"protocol-native.c","owner_module":31,"client":60,"sink":49,
       "corked":false,"mute":false,
       "volume":{"front-left":{"value":65536,"value_percent":"100%","db":"0.00 dB"},
                 "front-right":{"value":65536,"value_percent":"100%","db":"0.00 dB"}},
       "properties":{"application.process.binary":"firefox","media.name":"AudioStream"}}
    ]"#;

    /// Quatro sink-inputs: um de Discord mudo, um pausado (fica de fora) e um com volume
    /// acima de 100%.
    const FLUXOS_VARIOS: &str = r#"[
      {"index":42,"corked":false,"mute":false,
       "volume":{"front-left":{"value":35389,"value_percent":"54%"},"front-right":{"value":35389,"value_percent":"54%"}},
       "properties":{"application.name":"Spotify","application.process.binary":"spotify"}},
      {"index":57,"corked":false,"mute":false,
       "volume":{"front-left":{"value":65536,"value_percent":"100%"},"front-right":{"value":65536,"value_percent":"100%"}},
       "properties":{"application.process.binary":"firefox"}},
      {"index":61,"corked":false,"mute":true,
       "volume":{"front-left":{"value":42598,"value_percent":"65%"},"front-right":{"value":42598,"value_percent":"65%"}},
       "properties":{"application.name":"Discord"}},
      {"index":66,"corked":true,"mute":false,
       "volume":{"front-left":{"value":65536,"value_percent":"100%"},"front-right":{"value":65536,"value_percent":"100%"}},
       "properties":{"application.process.binary":"vlc"}}
    ]"#;

    #[derive(Default)]
    struct Sistema {
        fluxos: String,
        sinks: String,
        padrao: String,
        /// Comandos que mudam o som (leituras não entram aqui).
        chamadas: Vec<Vec<String>>,
    }

    type Compartilhado = Arc<Mutex<Sistema>>;

    /// Mixer com um `pactl` falso. O estado do "sistema" fica em `Compartilhado`, para o
    /// teste mudar volumes entre um tique e outro.
    fn montar(fluxos: &str, sinks: &str) -> (Mixer, Compartilhado) {
        let sistema = Arc::new(Mutex::new(Sistema {
            fluxos: fluxos.to_owned(),
            sinks: sinks.to_owned(),
            padrao: PADRAO.to_owned(),
            chamadas: Vec::new(),
        }));
        let do_teste = sistema.clone();
        let falso: Executor = Box::new(move |args: &[&str]| {
            let mut s = do_teste.lock().unwrap();
            let r = match args {
                ["-f", "json", "list", "sink-inputs"] => s.fluxos.clone(),
                ["-f", "json", "list", "sinks"] => s.sinks.clone(),
                ["get-default-sink"] => s.padrao.clone(),
                _ => {
                    s.chamadas.push(args.iter().map(|a| a.to_string()).collect());
                    String::new()
                }
            };
            Some(r)
        });
        (Mixer::new(falso), sistema)
    }

    fn de(m: &Mensagem) -> &Value {
        match m {
            Mensagem::Controle(v) => v,
            outra => panic!("esperava CONTROLE, veio {outra:?}"),
        }
    }

    fn msg_abrir() -> Value {
        json!({"t":"abrir","tela":"mixer"})
    }

    fn acao(id: &str, valor: Option<Value>) -> Value {
        match valor {
            Some(v) => json!({"t":"acao","id":id,"valor":v}),
            None => json!({"t":"acao","id":id}),
        }
    }

    fn chamadas(s: &Compartilhado) -> Vec<Vec<String>> {
        s.lock().unwrap().chamadas.clone()
    }

    fn tique(m: &mut Mixer) -> Vec<Mensagem> {
        let mut r = Vec::new();
        m.evento(&Evento::novo("tique", json!({})), &mut r);
        r
    }

    #[test]
    fn parser_sinks_reais() {
        let s = destinos(SINKS_REAIS, PADRAO.trim()).unwrap();
        assert_eq!(s.len(), 3);
        assert_eq!(s.iter().filter(|d| d.padrao).count(), 1);
        assert_eq!(s[0].nome, "alsa_output.usb-USB-MIC_USB-MIC_20180508-00.analog-stereo");
        assert!(s[0].padrao);
        assert!((s[0].volume - 0.61).abs() < 1e-9);
        assert_eq!(s[0].rotulo, "USB-MIC");
        assert_eq!(s[0].descricao, "USB-MIC Analog Stereo");
        assert_eq!(s[1].rotulo, "GP2711");
        assert!(!s[1].padrao);
        assert!((s[1].volume - 0.40).abs() < 1e-9);
        assert!(!s[2].mudo);
    }

    #[test]
    fn parser_sink_inputs_e_pausados() {
        let todos = fluxos(FLUXOS_VARIOS).unwrap();
        assert_eq!(todos.len(), 4);
        let spotify = &todos[0];
        assert_eq!(spotify.app, "Spotify");
        assert!((spotify.volume - 0.54).abs() < 1e-9);
        assert!(!spotify.mudo && !spotify.pausado);
        // Sem `application.name`: usa o nome do binário.
        assert_eq!(todos[1].app, "firefox");
        assert_eq!(todos[1].volume, 1.0);
        assert!(todos[2].mudo);
        assert!(todos[3].pausado);
        assert_eq!(todos[3].app, "vlc");
    }

    #[test]
    fn parser_media_dos_canais_e_limite() {
        let json_ = r#"[{"index":7,"corked":false,"mute":false,
            "volume":{"front-left":{"value_percent":"61%"},"front-right":{"value_percent":"59%"}},
            "properties":{"application.name":"X","application.icon_name":"  x-icon  "}},
          {"index":8,"corked":false,"mute":false,
            "volume":{"front-left":{"value_percent":"150%"},"front-right":{"value_percent":"150%"}},
            "properties":{"application.name":"Alto"}}]"#;
        let f = fluxos(json_).unwrap();
        assert!((f[0].volume - 0.60).abs() < 1e-9);
        assert_eq!(f[0].icone, "x-icon");
        assert_eq!(f[1].volume, 1.0);
    }

    #[test]
    fn parser_recusa_json_ruim() {
        assert!(fluxos("não é json").is_none());
        assert!(destinos("{}", "x").is_none());
        // Lista vazia é uma resposta válida (ninguém tocando).
        assert_eq!(fluxos("[]").unwrap(), Vec::new());
    }

    #[test]
    fn tela_com_dois_apps() {
        let (mut m, _) = montar(FLUXOS_DOIS, SINKS_REAIS);
        let mut r = Vec::new();
        assert!(m.controle("abrir", &msg_abrir(), &mut r));
        assert_eq!(r.len(), 1);
        let tela = de(&r[0]);
        assert_eq!(tela["t"], "tela");
        assert_eq!(tela["id"], "mixer");
        assert_eq!(tela["nome"], "Som");
        assert_eq!(tela["nivel"], 2);

        let faders = &tela["pecas"][0];
        assert_eq!(faders["p"], "grade");
        let pecas = faders["pecas"].as_array().unwrap();
        assert_eq!(pecas.len(), 3);
        assert_eq!(pecas[0], json!({"p":"fader","id":"geral","rotulo":"Geral","valor":0.61,"mudo":false}));
        assert_eq!(pecas[1]["id"], "app:42");
        assert_eq!(pecas[1]["rotulo"], "Spotify");
        assert_eq!(pecas[2]["id"], "app:57");
        assert_eq!(pecas[2]["rotulo"], "firefox");
        assert_eq!(pecas[2]["valor"], 1.0);

        let saidas = &tela["pecas"][1];
        assert_eq!(saidas["p"], "linha");
        let teclas = saidas["pecas"].as_array().unwrap();
        assert_eq!(teclas.len(), 3);
        assert_eq!(
            teclas[0],
            json!({"p":"tecla","id":"saida:alsa_output.usb-USB-MIC_USB-MIC_20180508-00.analog-stereo","rotulo":"USB-MIC","dica":"em uso"})
        );
        assert!(teclas[1].get("dica").is_none());
        assert_eq!(teclas[2]["rotulo"], "ALC887-VD Digital");
    }

    #[test]
    fn tela_sem_app_so_geral_e_saidas() {
        let (mut m, _) = montar("[]", SINKS_REAIS);
        let mut r = Vec::new();
        m.controle("abrir", &msg_abrir(), &mut r);
        let pecas = de(&r[0])["pecas"].as_array().unwrap().clone();
        assert_eq!(pecas[0]["pecas"].as_array().unwrap().len(), 1);
        assert_eq!(pecas[1]["pecas"].as_array().unwrap().len(), 3);
    }

    #[test]
    fn pausado_nao_entra_na_tela() {
        let (mut m, _) = montar(FLUXOS_VARIOS, SINKS_REAIS);
        let mut r = Vec::new();
        m.controle("abrir", &msg_abrir(), &mut r);
        let ids: Vec<&str> = de(&r[0])["pecas"][0]["pecas"].as_array().unwrap().iter().map(|p| p["id"].as_str().unwrap()).collect();
        assert_eq!(ids, vec!["geral", "app:42", "app:57", "app:61"]);
    }

    #[test]
    fn volume_de_app_chama_set_sink_input_volume() {
        let (mut m, s) = montar(FLUXOS_DOIS, SINKS_REAIS);
        let mut r = Vec::new();
        m.controle("abrir", &msg_abrir(), &mut r);
        let mut resp = Vec::new();
        assert!(m.controle("acao", &acao("app:42", Some(json!(0.4))), &mut resp));
        assert_eq!(chamadas(&s), vec![vec!["set-sink-input-volume", "42", "40%"]]);
        assert!(resp.is_empty());
    }

    #[test]
    fn mudo_de_app_e_volume_geral() {
        let (mut m, s) = montar(FLUXOS_DOIS, SINKS_REAIS);
        let mut r = Vec::new();
        m.controle("abrir", &msg_abrir(), &mut r);
        m.controle("acao", &acao("app:57", None), &mut r);
        m.controle("acao", &acao("geral", Some(json!(0.7))), &mut r);
        m.controle("acao", &acao("geral", None), &mut r);
        m.controle("acao", &acao("app:42", Some(json!(3))), &mut r);
        assert_eq!(
            chamadas(&s),
            vec![
                vec!["set-sink-input-mute", "57", "toggle"],
                vec!["set-sink-volume", "@DEFAULT_SINK@", "70%"],
                vec!["set-sink-mute", "@DEFAULT_SINK@", "toggle"],
                vec!["set-sink-input-volume", "42", "100%"],
            ]
        );
    }

    #[test]
    fn app_fora_da_tela_e_ignorado() {
        let (mut m, s) = montar(FLUXOS_DOIS, SINKS_REAIS);
        let mut r = Vec::new();
        m.controle("abrir", &msg_abrir(), &mut r);
        assert!(m.controle("acao", &acao("app:999", Some(json!(0.2))), &mut r));
        assert!(m.controle("acao", &acao("app:abc", None), &mut r));
        assert!(m.controle("acao", &acao("app:42; rm", None), &mut r));
        assert!(chamadas(&s).is_empty());
    }

    #[test]
    fn saida_desconhecida_e_ignorada() {
        let (mut m, s) = montar(FLUXOS_DOIS, SINKS_REAIS);
        let mut r = Vec::new();
        m.controle("abrir", &msg_abrir(), &mut r);
        assert!(m.controle("acao", &acao("saida:fantasma", None), &mut r));
        assert!(m.controle("acao", &acao("saida:", None), &mut r));
        assert!(chamadas(&s).is_empty());

        let hdmi = "alsa_output.pci-0000_0a_00.1.hdmi-stereo-extra2";
        assert!(m.controle("acao", &acao(&format!("saida:{hdmi}"), None), &mut r));
        assert_eq!(chamadas(&s), vec![vec!["set-default-sink".to_owned(), hdmi.to_owned()]]);
    }

    #[test]
    fn id_que_nao_e_do_mixer_devolve_false() {
        let (mut m, s) = montar(FLUXOS_DOIS, SINKS_REAIS);
        let mut r = Vec::new();
        m.controle("abrir", &msg_abrir(), &mut r);
        assert!(!m.controle("acao", &acao("volume", Some(json!(0.5))), &mut r));
        assert!(!m.controle("acao", &json!({"t":"acao"}), &mut r));
        assert!(!m.controle("abrir", &json!({"t":"abrir","tela":"giro"}), &mut r));
        assert!(!m.controle("outro", &json!({}), &mut r));
        assert!(chamadas(&s).is_empty());
    }

    #[test]
    fn valor_que_nao_e_numero_nao_vira_mudo() {
        let (mut m, s) = montar(FLUXOS_DOIS, SINKS_REAIS);
        let mut r = Vec::new();
        m.controle("abrir", &msg_abrir(), &mut r);
        assert!(m.controle("acao", &acao("app:42", Some(json!("alto"))), &mut r));
        assert!(chamadas(&s).is_empty());
    }

    #[test]
    fn falha_do_pactl_vira_aviso() {
        let mut m = Mixer::new(Box::new(|args: &[&str]| if args.contains(&"list") { None } else { Some(String::new()) }));
        let mut r = Vec::new();
        assert!(m.controle("abrir", &msg_abrir(), &mut r));
        assert_eq!(de(&r[0])["t"], "aviso");
    }

    #[test]
    fn tique_sem_mudanca_nao_manda_nada() {
        let (mut m, _) = montar(FLUXOS_DOIS, SINKS_REAIS);
        let mut r = Vec::new();
        m.controle("abrir", &msg_abrir(), &mut r);
        assert!(tique(&mut m).is_empty());
        assert!(tique(&mut m).is_empty());
    }

    #[test]
    fn tique_so_com_tela_aberta() {
        let (mut m, _) = montar(FLUXOS_DOIS, SINKS_REAIS);
        let mut r = Vec::new();
        assert!(tique(&mut m).is_empty());
        m.controle("abrir", &json!({"t":"abrir","tela":"atalhos"}), &mut r);
        assert!(tique(&mut m).is_empty());
    }

    #[test]
    fn tique_so_volume_manda_estado_so_do_que_mudou() {
        let (mut m, s) = montar(FLUXOS_DOIS, SINKS_REAIS);
        let mut r = Vec::new();
        m.controle("abrir", &msg_abrir(), &mut r);

        // Spotify baixou para 30% e o geral ficou mudo, por fora do celular.
        s.lock().unwrap().fluxos = FLUXOS_DOIS.replace(r#""54%""#, r#""30%""#).replace(r#""value":35389"#, r#""value":19661"#);
        s.lock().unwrap().sinks = SINKS_REAIS.replacen(r#""mute":false"#, r#""mute":true"#, 1);

        let t = tique(&mut m);
        assert_eq!(t.len(), 1);
        let v = de(&t[0]);
        assert_eq!(v["t"], "estado");
        assert_eq!(v["tela"], "mixer");
        assert_eq!(
            v["pecas"],
            json!([
                {"id":"geral","mudo":true},
                {"id":"app:42","valor":0.3}
            ])
        );
        // Depois da mesma leitura, nada novo.
        assert!(tique(&mut m).is_empty());
    }

    #[test]
    fn tique_com_app_novo_manda_a_tela() {
        let (mut m, s) = montar(FLUXOS_DOIS, SINKS_REAIS);
        let mut r = Vec::new();
        m.controle("abrir", &msg_abrir(), &mut r);

        let mais = FLUXOS_DOIS.replace("]", r#",{"index":70,"corked":false,"mute":false,
            "volume":{"front-left":{"value_percent":"20%"},"front-right":{"value_percent":"20%"}},
            "properties":{"application.name":"Meet"}}]"#);
        s.lock().unwrap().fluxos = mais;

        let t = tique(&mut m);
        assert_eq!(t.len(), 1);
        let v = de(&t[0]);
        assert_eq!(v["t"], "tela");
        assert_eq!(v["pecas"][0]["pecas"][3]["id"], "app:70");
        assert_eq!(v["pecas"][0]["pecas"][3]["rotulo"], "Meet");
    }

    #[test]
    fn tique_com_padrao_mudado_manda_a_tela_com_a_dica_nova() {
        let (mut m, s) = montar(FLUXOS_DOIS, SINKS_REAIS);
        let mut r = Vec::new();
        m.controle("abrir", &msg_abrir(), &mut r);
        s.lock().unwrap().padrao = "alsa_output.pci-0000_0a_00.1.hdmi-stereo-extra2\n".to_owned();

        let t = tique(&mut m);
        assert_eq!(t.len(), 1);
        assert_eq!(de(&t[0])["t"], "tela");
        let saidas = de(&t[0])["pecas"][1]["pecas"].as_array().unwrap().clone();
        assert!(saidas[0].get("dica").is_none());
        assert_eq!(saidas[1]["dica"], "em uso");
    }

    #[test]
    fn telas_anunciam_o_mixer() {
        let (m, _) = montar("[]", "[]");
        let telas = m.telas();
        assert_eq!(telas, vec![json!({"id":"mixer","nome":"Som","icone":"mixer","grupo":"Atalhos","nivel":2})]);
    }

    #[test]
    fn rotulo_longo_e_cortado() {
        assert_eq!(curto("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), "ABCDEFGHIJKLMNOPQRSTUVW…");
        assert_eq!(curto("Spotify"), "Spotify");
    }
}
