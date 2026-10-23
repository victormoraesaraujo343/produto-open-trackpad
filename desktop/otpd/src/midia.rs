//! Mídia: o que está tocando no computador (MPRIS pelo D-Bus da sessão), com capa e controles.
//!
//! Dois lados separados. `iniciar_leitor` roda numa tarefa tokio e, a cada segundo, grava o estado
//! num `Arc<Mutex<..>>`. `Midia` (uma por sessão) só lê esse estado, então os métodos síncronos da
//! `Extensao` nunca falam com o D-Bus. Os comandos saem por `comandar`, também numa tarefa, e só
//! para uma lista fechada de métodos.

use std::collections::HashMap;
use std::ffi::OsStr;
use std::os::unix::ffi::OsStrExt;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use serde_json::{json, Value};
use zbus::fdo::{DBusProxy, PropertiesProxy};
use zbus::names::InterfaceName;
use zbus::zvariant::OwnedValue;

use crate::pareamento::base64;
use crate::protocolo::{controle, Mensagem};
use crate::sessao::{Evento, Extensao};

const PREFIXO: &str = "org.mpris.MediaPlayer2.";
const CAMINHO: &str = "/org/mpris/MediaPlayer2";
const INTERFACE: &str = "org.mpris.MediaPlayer2.Player";
const INTERVALO: Duration = Duration::from_secs(1);
const TELA: &str = "midia";

/// Maior capa aceita, em bytes do arquivo. Em base64 ela cresce 4/3: com 40 KiB a mensagem fica
/// abaixo do limite de 64 KiB do CONTROLE (protocolo). Um PNG de 300 KB estouraria o limite e o
/// celular fecharia a conexão a cada segundo.
pub const CAPA_MAX_BYTES: u64 = 40 * 1024;

/// Métodos MPRIS que a extensão pode disparar. Qualquer outro é ignorado.
const METODOS: &[&str] = &["PlayPause", "Next", "Previous"];

/// Faixa que está (ou esteve) tocando no computador.
#[derive(Clone, Debug, PartialEq)]
pub struct Tocando {
    /// Nome do barramento do player, ex. `org.mpris.MediaPlayer2.vlc`.
    pub player: String,
    pub titulo: String,
    pub artista: String,
    pub album: String,
    pub tocando: bool,
    /// Capa em base64 (PNG ou JPG; o celular decodifica os dois). `None` = sem capa.
    pub capa_base64: Option<String>,
    pub posicao_s: f64,
    pub duracao_s: f64,
}

/// Inicia o leitor MPRIS numa tarefa tokio. Chamar uma vez por processo.
pub fn iniciar_leitor(estado: Arc<Mutex<Option<Tocando>>>) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut leitor = Leitor::default();
        let mut intervalo = tokio::time::interval(INTERVALO);
        loop {
            intervalo.tick().await;
            let lido = leitor.uma_vez().await;
            *trancar(&estado) = lido;
        }
    })
}

/// Manda um método MPRIS ao player, numa tarefa. Métodos fora de `METODOS` e players fora do
/// prefixo MPRIS são ignorados sem tocar no D-Bus.
pub fn comandar(player: &str, metodo: &str) {
    if !player.starts_with(PREFIXO) || !METODOS.contains(&metodo) {
        return;
    }
    let (player, metodo) = (player.to_owned(), metodo.to_owned());
    tokio::spawn(async move {
        if let Err(e) = chamar(&player, &metodo).await {
            eprintln!("midia: {metodo} em {player} falhou: {e}");
        }
    });
}

async fn chamar(player: &str, metodo: &str) -> zbus::Result<()> {
    let conexao = zbus::Connection::session().await?;
    let proxy = zbus::Proxy::new(&conexao, player, CAMINHO, INTERFACE).await?;
    proxy.call_noreply(metodo, &()).await
}

/// Estado do leitor entre uma leitura e outra.
#[derive(Default)]
struct Leitor {
    conexao: Option<zbus::Connection>,
    /// Último player que estava tocando (desempata quando nenhum toca).
    ultimo: Option<String>,
    /// (`mpris:artUrl`, capa) da última leitura: a capa só é relida quando a URL muda.
    capa: Option<(Option<String>, Option<String>)>,
}

impl Leitor {
    async fn uma_vez(&mut self) -> Option<Tocando> {
        match self.ler().await {
            Ok(tocando) => tocando,
            Err(_) => {
                // Bus caiu ou o player sumiu no meio da leitura: tenta de novo no próximo segundo.
                self.conexao = None;
                None
            }
        }
    }

    async fn ler(&mut self) -> zbus::Result<Option<Tocando>> {
        let conexao = match self.conexao.take() {
            Some(c) => c,
            None => zbus::Connection::session().await?,
        };
        let resultado = self.ler_com(&conexao).await;
        if resultado.is_ok() {
            self.conexao = Some(conexao);
        }
        resultado
    }

    async fn ler_com(&mut self, conexao: &zbus::Connection) -> zbus::Result<Option<Tocando>> {
        let mut nomes: Vec<String> = DBusProxy::new(conexao)
            .await?
            .list_names()
            .await?
            .iter()
            .map(|n| n.to_string())
            .filter(|n| n.starts_with(PREFIXO))
            .collect();
        nomes.sort();

        // Um player que não responde (sumiu, sem a interface) fica de fora desta leitura.
        let mut players: Vec<(String, bool)> = Vec::new();
        for nome in nomes {
            if let Ok(status) = propriedade(conexao, &nome, "PlaybackStatus").await {
                let tocando = String::try_from(status).is_ok_and(|s| s == "Playing");
                players.push((nome, tocando));
            }
        }

        // Escolhe: o que está tocando; senão o último que tocou; senão o primeiro.
        let escolhido = players
            .iter()
            .find(|(_, tocando)| *tocando)
            .or_else(|| self.ultimo.as_ref().and_then(|u| players.iter().find(|(n, _)| n == u)))
            .or_else(|| players.first())
            .cloned();
        let Some((nome, tocando)) = escolhido else {
            return Ok(None);
        };
        if tocando {
            self.ultimo = Some(nome.clone());
        }

        let meta: HashMap<String, OwnedValue> = HashMap::try_from(propriedade(conexao, &nome, "Metadata").await?)?;
        let posicao = propriedade(conexao, &nome, "Position").await.ok().and_then(|v| como_numero(&v)).unwrap_or(0.0);

        let url = meta.get("mpris:artUrl").and_then(|v| String::try_from(v.clone()).ok()).filter(|s| !s.is_empty());
        let capa = self.capa_de(url);
        let titulo = texto(&meta, "xesam:title");

        Ok(Some(Tocando {
            player: nome,
            titulo: if titulo.is_empty() { "Sem título".to_owned() } else { titulo },
            artista: lista(&meta, "xesam:artist"),
            album: texto(&meta, "xesam:album"),
            tocando,
            capa_base64: capa,
            posicao_s: posicao / 1e6,
            duracao_s: meta.get("mpris:length").and_then(como_numero).unwrap_or(0.0) / 1e6,
        }))
    }

    /// Capa da URL; relê o arquivo só quando a URL muda.
    fn capa_de(&mut self, url: Option<String>) -> Option<String> {
        if let Some((antes, capa)) = &self.capa {
            if *antes == url {
                return capa.clone();
            }
        }
        let capa = url.as_deref().and_then(capa_de_url);
        self.capa = Some((url, capa.clone()));
        capa
    }
}

async fn propriedade(conexao: &zbus::Connection, nome: &str, prop: &str) -> zbus::Result<OwnedValue> {
    let props = PropertiesProxy::new(conexao, nome, CAMINHO).await?;
    Ok(props.get(InterfaceName::try_from(INTERFACE)?, prop).await?)
}

fn texto(meta: &HashMap<String, OwnedValue>, chave: &str) -> String {
    meta.get(chave).and_then(|v| String::try_from(v.clone()).ok()).unwrap_or_default()
}

/// `xesam:artist` é uma lista de textos (alguns players mandam um texto só).
fn lista(meta: &HashMap<String, OwnedValue>, chave: &str) -> String {
    meta.get(chave)
        .and_then(|v| {
            Vec::<String>::try_from(v.clone()).ok().map(|l| l.join(", ")).or_else(|| String::try_from(v.clone()).ok())
        })
        .unwrap_or_default()
}

/// Inteiro de 64 bits (microssegundos no MPRIS), aceitando também sem sinal.
fn como_numero(v: &OwnedValue) -> Option<f64> {
    i64::try_from(v.clone())
        .map(|x| x as f64)
        .or_else(|_| u64::try_from(v.clone()).map(|x| x as f64))
        .ok()
}

/// Lê a capa de um `file://` local: só png/jpg/jpeg, até `CAPA_MAX_BYTES`. Qualquer outra coisa é
/// `None` (sem capa), sem erro.
pub fn capa_de_url(url: &str) -> Option<String> {
    let caminho = caminho_de_file_url(url)?;
    let extensao = caminho.extension()?.to_str()?.to_ascii_lowercase();
    if !matches!(extensao.as_str(), "png" | "jpg" | "jpeg") {
        return None;
    }
    let info = std::fs::metadata(&caminho).ok()?;
    if !info.is_file() || info.len() > CAPA_MAX_BYTES {
        return None;
    }
    std::fs::read(&caminho).ok().map(|bytes| base64(&bytes))
}

/// `file:///caminho/%20com%20espaco.png` -> `/caminho/ com espaco.png`. Só caminho local.
fn caminho_de_file_url(url: &str) -> Option<PathBuf> {
    let resto = url.strip_prefix("file://")?;
    if !resto.starts_with('/') {
        return None;
    }
    let bytes = desfazer_percentual(resto.as_bytes())?;
    Some(PathBuf::from(OsStr::from_bytes(&bytes)))
}

fn desfazer_percentual(s: &[u8]) -> Option<Vec<u8>> {
    let mut saida = Vec::with_capacity(s.len());
    let mut i = 0;
    while i < s.len() {
        if s[i] == b'%' {
            let alto = (*s.get(i + 1)? as char).to_digit(16)?;
            let baixo = (*s.get(i + 2)? as char).to_digit(16)?;
            saida.push((alto * 16 + baixo) as u8);
            i += 3;
        } else {
            saida.push(s[i]);
            i += 1;
        }
    }
    Some(saida)
}

/// Função que manda um comando MPRIS: `(player, metodo)`. Injetável para testar.
pub type Comando = Box<dyn FnMut(&str, &str) + Send>;

/// Extensão da tela `midia`. Uma por sessão.
pub struct Midia {
    estado: Arc<Mutex<Option<Tocando>>>,
    comando: Comando,
    /// A tela `midia` está aberta no celular agora.
    aberta: bool,
    /// O que foi mandado por último ao celular (base da comparação no `tique`).
    mostrado: Option<Tocando>,
}

impl Midia {
    /// Extensão com o comando real (`comandar`, D-Bus).
    pub fn nova(estado: Arc<Mutex<Option<Tocando>>>) -> Self {
        Self::com_comando(estado, Box::new(comandar))
    }

    pub fn com_comando(estado: Arc<Mutex<Option<Tocando>>>, comando: Comando) -> Self {
        Self { estado, comando, aberta: false, mostrado: None }
    }

    fn lido(&self) -> Option<Tocando> {
        trancar(&self.estado).clone()
    }
}

impl Extensao for Midia {
    fn controle(&mut self, t: &str, msg: &Value, respostas: &mut Vec<Mensagem>) -> bool {
        match t {
            "abrir" => {
                if msg["tela"].as_str() != Some(TELA) {
                    self.aberta = false;
                    return false;
                }
                let atual = self.lido();
                respostas.push(controle(tela_json(atual.as_ref())));
                self.aberta = true;
                self.mostrado = atual;
                true
            }
            "acao" => {
                let Some(metodo) = msg["id"].as_str().and_then(metodo_da_acao) else {
                    return false;
                };
                if let Some(tocando) = self.lido() {
                    (self.comando)(&tocando.player, metodo);
                }
                true
            }
            _ => false,
        }
    }

    fn telas(&self) -> Vec<Value> {
        vec![json!({"id":TELA,"nome":"Mídia","icone":"musica","grupo":"Atalhos","nivel":2})]
    }

    fn evento(&mut self, e: &Evento, respostas: &mut Vec<Mensagem>) {
        if e.tipo != "tique" || !self.aberta {
            return;
        }
        let atual = self.lido();
        if troca_de_tela(self.mostrado.as_ref(), atual.as_ref()) {
            respostas.push(controle(tela_json(atual.as_ref())));
        } else if let (Some(antes), Some(agora)) = (self.mostrado.as_ref(), atual.as_ref()) {
            if antes.tocando != agora.tocando {
                respostas.push(controle(estado_json(agora)));
            }
        }
        self.mostrado = atual;
    }
}

fn metodo_da_acao(id: &str) -> Option<&'static str> {
    match id {
        "midia:tocar" => Some("PlayPause"),
        "midia:proxima" => Some("Next"),
        "midia:anterior" => Some("Previous"),
        _ => None,
    }
}

/// Muda o que a tela mostra além de tocando/pausado: faixa, capa, ou ir de "nada" a algo.
fn troca_de_tela(antes: Option<&Tocando>, agora: Option<&Tocando>) -> bool {
    match (antes, agora) {
        (None, None) => false,
        (Some(a), Some(b)) => {
            a.player != b.player
                || a.titulo != b.titulo
                || a.artista != b.artista
                || a.album != b.album
                || a.capa_base64 != b.capa_base64
        }
        _ => true,
    }
}

fn rotulo_icone_tocar(tocando: bool) -> (&'static str, &'static str) {
    if tocando {
        ("Pausar", "pausa")
    } else {
        ("Tocar", "play")
    }
}

fn tela_json(tocando: Option<&Tocando>) -> Value {
    let pecas = match tocando {
        None => vec![json!({"p":"texto","id":"vazio","texto":"Nada tocando","tamanho":"m"})],
        Some(t) => {
            let mut pecas = Vec::new();
            if let Some(png) = &t.capa_base64 {
                pecas.push(json!({"p":"icone_app","id":"capa","rotulo":"Capa","png":png}));
            }
            pecas.push(json!({"p":"texto","id":"titulo","texto":t.titulo,"tamanho":"g"}));
            pecas.push(json!({"p":"texto","id":"artista","texto":t.artista,"tamanho":"m"}));
            let (rotulo, icone) = rotulo_icone_tocar(t.tocando);
            pecas.push(json!({"p":"linha","id":"controles","pecas":[
                {"p":"tecla","id":"midia:anterior","rotulo":"Anterior","icone":"proxima"},
                {"p":"tecla","id":"midia:tocar","rotulo":rotulo,"icone":icone},
                {"p":"tecla","id":"midia:proxima","rotulo":"Próxima","icone":"proxima"},
            ]}));
            pecas
        }
    };
    json!({"t":"tela","id":TELA,"nome":"Mídia","nivel":2,"pecas":pecas})
}

fn estado_json(t: &Tocando) -> Value {
    let (rotulo, icone) = rotulo_icone_tocar(t.tocando);
    json!({"t":"estado","tela":TELA,"pecas":[{"id":"midia:tocar","rotulo":rotulo,"icone":icone}]})
}

fn trancar<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex as StdMutex;

    type Gravadas = Arc<StdMutex<Vec<(String, String)>>>;

    fn exemplo(tocando: bool) -> Tocando {
        Tocando {
            player: "org.mpris.MediaPlayer2.vlc".into(),
            titulo: "Faixa".into(),
            artista: "Banda".into(),
            album: "Disco".into(),
            tocando,
            capa_base64: None,
            posicao_s: 10.0,
            duracao_s: 200.0,
        }
    }

    fn montar(inicial: Option<Tocando>) -> (Midia, Arc<Mutex<Option<Tocando>>>, Gravadas) {
        let estado = Arc::new(Mutex::new(inicial));
        let gravadas: Gravadas = Arc::new(StdMutex::new(Vec::new()));
        let g = gravadas.clone();
        let comando: Comando = Box::new(move |p: &str, m: &str| g.lock().unwrap().push((p.to_owned(), m.to_owned())));
        (Midia::com_comando(estado.clone(), comando), estado, gravadas)
    }

    fn de(m: &Mensagem) -> &Value {
        match m {
            Mensagem::Controle(v) => v,
            outra => panic!("esperava CONTROLE, veio {outra:?}"),
        }
    }

    fn abrir(m: &mut Midia) -> Vec<Mensagem> {
        let mut r = Vec::new();
        assert!(m.controle("abrir", &json!({"tela":"midia"}), &mut r));
        r
    }

    fn tique(m: &mut Midia) -> Vec<Mensagem> {
        let mut r = Vec::new();
        m.evento(&Evento::novo("tique", Value::Null), &mut r);
        r
    }

    fn ids(pecas: &Value) -> Vec<String> {
        pecas.as_array().unwrap().iter().map(|p| p["id"].as_str().unwrap().to_owned()).collect()
    }

    #[test]
    fn tela_sem_faixa_mostra_nada_tocando() {
        let (mut m, _, _) = montar(None);
        let r = abrir(&mut m);
        let v = de(&r[0]);
        assert_eq!(v["t"], "tela");
        assert_eq!(v["id"], "midia");
        assert_eq!(v["pecas"].as_array().unwrap().len(), 1);
        assert_eq!(v["pecas"][0]["texto"], "Nada tocando");
    }

    #[test]
    fn tela_com_faixa_e_capa() {
        let mut t = exemplo(true);
        t.capa_base64 = Some("AAAA".into());
        let (mut m, _, _) = montar(Some(t));
        let r = abrir(&mut m);
        let v = de(&r[0]);
        assert_eq!(ids(&v["pecas"]), ["capa", "titulo", "artista", "controles"]);
        assert_eq!(v["pecas"][0]["png"], "AAAA");
        assert_eq!(v["pecas"][1]["texto"], "Faixa");
        assert_eq!(v["pecas"][2]["texto"], "Banda");
        let linha = &v["pecas"][3]["pecas"];
        assert_eq!(ids(linha), ["midia:anterior", "midia:tocar", "midia:proxima"]);
        assert_eq!(linha[1]["rotulo"], "Pausar");
        assert_eq!(linha[1]["icone"], "pausa");
    }

    #[test]
    fn tela_sem_capa_omite_a_peca() {
        let (mut m, _, _) = montar(Some(exemplo(false)));
        let r = abrir(&mut m);
        let v = de(&r[0]);
        assert_eq!(ids(&v["pecas"]), ["titulo", "artista", "controles"]);
        assert_eq!(v["pecas"][2]["pecas"][1]["rotulo"], "Tocar");
        assert_eq!(v["pecas"][2]["pecas"][1]["icone"], "play");
    }

    #[test]
    fn acao_chama_o_comando_certo_com_o_player_certo() {
        let (mut m, _, g) = montar(Some(exemplo(true)));
        let mut r = Vec::new();
        assert!(m.controle("acao", &json!({"t":"acao","id":"midia:proxima"}), &mut r));
        assert!(m.controle("acao", &json!({"t":"acao","id":"midia:anterior"}), &mut r));
        assert!(m.controle("acao", &json!({"t":"acao","id":"midia:tocar"}), &mut r));
        let feitas = g.lock().unwrap().clone();
        let vlc = "org.mpris.MediaPlayer2.vlc".to_owned();
        assert_eq!(
            feitas,
            vec![
                (vlc.clone(), "Next".to_owned()),
                (vlc.clone(), "Previous".to_owned()),
                (vlc, "PlayPause".to_owned()),
            ]
        );
        assert!(r.is_empty());
    }

    #[test]
    fn acao_fora_da_lista_e_ignorada() {
        let (mut m, _, g) = montar(Some(exemplo(true)));
        let mut r = Vec::new();
        assert!(!m.controle("acao", &json!({"t":"acao","id":"midia:apagar"}), &mut r));
        assert!(!m.controle("acao", &json!({"t":"acao","id":"volume","valor":0.5}), &mut r));
        assert!(!m.controle("acao", &json!({"t":"acao"}), &mut r));
        assert!(g.lock().unwrap().is_empty());
    }

    #[test]
    fn acao_sem_faixa_nao_manda_comando() {
        let (mut m, _, g) = montar(None);
        let mut r = Vec::new();
        assert!(m.controle("acao", &json!({"t":"acao","id":"midia:tocar"}), &mut r));
        assert!(g.lock().unwrap().is_empty());
    }

    #[test]
    fn abrir_outra_tela_nao_e_tratado() {
        let (mut m, _, _) = montar(Some(exemplo(true)));
        let mut r = Vec::new();
        assert!(!m.controle("abrir", &json!({"t":"abrir","tela":"giro"}), &mut r));
        assert!(r.is_empty());
    }

    #[test]
    fn comando_com_metodo_ou_player_invalido_nao_toca_no_dbus() {
        // Sem runtime tokio: se tentasse disparar a tarefa, daria pânico.
        comandar("org.mpris.MediaPlayer2.vlc", "Quit");
        comandar("org.mpris.MediaPlayer2.vlc", "PlayPause; rm -rf /");
        comandar("outro.app", "PlayPause");
    }

    #[test]
    fn tique_sem_mudanca_nao_manda_nada() {
        let (mut m, _, _) = montar(Some(exemplo(true)));
        abrir(&mut m);
        assert!(tique(&mut m).is_empty());
        assert!(tique(&mut m).is_empty());
    }

    #[test]
    fn tique_sem_tela_aberta_nao_manda_nada() {
        let (mut m, estado, _) = montar(Some(exemplo(true)));
        let mut r = Vec::new();
        assert!(!m.controle("abrir", &json!({"tela":"giro"}), &mut r));
        estado.lock().unwrap().as_mut().unwrap().titulo = "Outra".into();
        assert!(tique(&mut m).is_empty());
    }

    #[test]
    fn tique_com_pausa_manda_estado() {
        let (mut m, estado, _) = montar(Some(exemplo(true)));
        abrir(&mut m);
        estado.lock().unwrap().as_mut().unwrap().tocando = false;
        let r = tique(&mut m);
        assert_eq!(r.len(), 1);
        let v = de(&r[0]);
        assert_eq!(v["t"], "estado");
        assert_eq!(v["tela"], "midia");
        assert_eq!(v["pecas"][0]["id"], "midia:tocar");
        assert_eq!(v["pecas"][0]["rotulo"], "Tocar");
        assert_eq!(v["pecas"][0]["icone"], "play");
        // Já mandado: o próximo tique não repete.
        assert!(tique(&mut m).is_empty());
    }

    #[test]
    fn tique_com_nova_faixa_manda_tela() {
        let (mut m, estado, _) = montar(Some(exemplo(true)));
        abrir(&mut m);
        estado.lock().unwrap().as_mut().unwrap().titulo = "Outra".into();
        let r = tique(&mut m);
        assert_eq!(r.len(), 1);
        assert_eq!(de(&r[0])["t"], "tela");
        assert_eq!(de(&r[0])["pecas"][0]["texto"], "Outra");
    }

    #[test]
    fn tique_de_nada_para_algo_manda_tela() {
        let (mut m, estado, _) = montar(None);
        abrir(&mut m);
        *estado.lock().unwrap() = Some(exemplo(true));
        let r = tique(&mut m);
        assert_eq!(r.len(), 1);
        assert_eq!(de(&r[0])["t"], "tela");
    }

    #[test]
    fn tique_com_nova_capa_manda_tela() {
        let (mut m, estado, _) = montar(Some(exemplo(true)));
        abrir(&mut m);
        estado.lock().unwrap().as_mut().unwrap().capa_base64 = Some("QQ==".into());
        let r = tique(&mut m);
        assert_eq!(r.len(), 1);
        assert_eq!(de(&r[0])["t"], "tela");
    }

    #[test]
    fn tique_so_de_posicao_nao_manda_nada() {
        let (mut m, estado, _) = montar(Some(exemplo(true)));
        abrir(&mut m);
        estado.lock().unwrap().as_mut().unwrap().posicao_s = 99.0;
        assert!(tique(&mut m).is_empty());
    }

    #[test]
    fn file_url_com_percentual_vira_caminho() {
        assert_eq!(caminho_de_file_url("file:///tmp/a%20b.png"), Some(PathBuf::from("/tmp/a b.png")));
        assert_eq!(caminho_de_file_url("file://servidor/x.png"), None);
        assert_eq!(caminho_de_file_url("https://exemplo.com/x.png"), None);
        assert_eq!(caminho_de_file_url("file:///tmp/quebrado%2"), None);
    }

    #[test]
    fn capa_so_de_imagem_local_pequena() {
        assert_eq!(capa_de_url("https://exemplo.com/capa.png"), None);
        assert_eq!(capa_de_url("file:///nao/existe/capa.png"), None);

        let dir = std::env::temp_dir();
        let pid = std::process::id();

        let gif = dir.join(format!("otp-midia-{pid}-a.gif"));
        std::fs::write(&gif, b"GIF89a").unwrap();
        assert_eq!(capa_de_url(&format!("file://{}", gif.display())), None);
        std::fs::remove_file(&gif).ok();

        let png = dir.join(format!("otp-midia-{pid}-b.png"));
        std::fs::write(&png, b"\x89PNG").unwrap();
        assert_eq!(capa_de_url(&format!("file://{}", png.display())), Some(base64(b"\x89PNG")));
        std::fs::remove_file(&png).ok();

        let grande = dir.join(format!("otp-midia-{pid}-c.jpg"));
        std::fs::write(&grande, vec![0u8; CAPA_MAX_BYTES as usize + 1]).unwrap();
        assert_eq!(capa_de_url(&format!("file://{}", grande.display())), None);
        std::fs::remove_file(&grande).ok();
    }

    #[tokio::test]
    #[ignore]
    async fn leitura_real() {
        let estado = Arc::new(Mutex::new(None));
        let _leitor = iniciar_leitor(estado.clone());
        tokio::time::sleep(Duration::from_secs(2)).await;
        println!("estado: {:?}", *trancar(&estado));
    }
}
