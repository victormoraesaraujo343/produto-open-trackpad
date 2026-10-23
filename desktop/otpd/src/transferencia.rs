//! Área de transferência compartilhada (tela `transferencia`, "Copiados"; seção 24 do protótipo).
//!
//! O computador lê a área de transferência do KDE (Klipper, D-Bus da sessão) a cada 1 s e guarda
//! o que está copiado. Esse texto só vai ao celular quando ele pede (`abrir` da tela, ou a ação
//! `transferencia:trazer`): o que se copia no computador não sai sozinho.
//!
//! O D-Bus é assíncrono e as extensões são síncronas: a leitura roda numa tarefa tokio e as
//! extensões só leem o estado guardado. A gravação (`setClipboardContents`) também é assíncrona e
//! fica atrás de `Gravacao`, para os testes não precisarem de D-Bus.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::{json, Value};

use crate::protocolo::{controle, Mensagem};
use crate::sessao::{Evento, Extensao};

const SERVICO: &str = "org.kde.klipper";
const OBJETO: &str = "/klipper";
const INTERFACE: &str = "org.kde.klipper.klipper";

/// Tamanho máximo do texto guardado (caracteres).
pub const LIMITE_CARACTERES: usize = 100_000;
/// Até quanto o celular manda em `area_transferencia` (bytes, contrato do protocolo).
pub const LIMITE_DO_CELULAR: usize = 15_000;
/// Até quanto o computador manda ao celular (bytes; a mensagem tem no máximo 64 KiB).
pub const LIMITE_PARA_O_CELULAR: usize = 60_000;
/// Tamanho da prévia na tela.
pub const PREVIA_CARACTERES: usize = 140;

/// O que está copiado no computador agora.
#[derive(Debug, Clone)]
pub struct Copiado {
    pub texto: String,
    /// Quando o texto mudou pela última vez (é a marca de mudança para o tique).
    pub quando: Instant,
    /// `"computador"` (lido do Klipper) ou `"celular"` (o celular mandou).
    pub origem: &'static str,
}

pub type Compartilhado = Arc<Mutex<Copiado>>;
/// Como gravar na área de transferência do computador. O padrão é `gravar` (Klipper).
pub type Gravacao = Arc<dyn Fn(String) + Send + Sync>;

impl Copiado {
    fn vazio() -> Self {
        Self { texto: String::new(), quando: Instant::now(), origem: "computador" }
    }
}

/// Começa a ler a área de transferência numa tarefa tokio (uma vez por serviço) e devolve o
/// estado compartilhado. Chamar dentro do runtime tokio.
pub fn iniciar() -> Compartilhado {
    let estado = Arc::new(Mutex::new(Copiado::vazio()));
    tokio::spawn(laco_de_leitura(estado.clone()));
    estado
}

async fn laco_de_leitura(estado: Compartilhado) {
    let mut conexao: Option<zbus::Connection> = None;
    let mut ultimo_lido = String::new();
    let mut relogio = tokio::time::interval(Duration::from_secs(1));
    loop {
        relogio.tick().await;
        if conexao.is_none() {
            conexao = zbus::Connection::session().await.ok();
        }
        let Some(c) = conexao.as_ref() else { continue };
        let resultado = ler_klipper(c).await;
        match resultado {
            Ok(lido) => {
                let mut atual = estado.lock().unwrap();
                registrar_leitura(&mut atual, &mut ultimo_lido, lido, Instant::now());
            }
            // Klipper parado ou barramento caído: tenta de novo no próximo tique.
            Err(_) => conexao = None,
        }
    }
}

/// Aplica uma leitura do Klipper ao estado. Só conta como mudança o que é diferente da leitura
/// anterior do Klipper, e ainda assim não troca a origem quando o texto já é o guardado (o celular
/// põe o texto no estado antes de o Klipper refletir a gravação).
pub fn registrar_leitura(c: &mut Copiado, ultimo_lido: &mut String, lido: String, agora: Instant) {
    if lido == *ultimo_lido {
        return;
    }
    let texto = limitar_caracteres(&lido);
    *ultimo_lido = lido;
    if texto == c.texto {
        return;
    }
    *c = Copiado { texto, quando: agora, origem: "computador" };
}

async fn ler_klipper(c: &zbus::Connection) -> zbus::Result<String> {
    let resposta = c.call_method(Some(SERVICO), OBJETO, Some(INTERFACE), "getClipboardContents", &()).await?;
    resposta.body().deserialize::<String>()
}

/// Grava no Klipper numa tarefa tokio (não bloqueia a sessão). Erros são ignorados.
pub fn gravar(texto: String) {
    tokio::spawn(async move {
        let Ok(c) = zbus::Connection::session().await else { return };
        let _ = c.call_method(Some(SERVICO), OBJETO, Some(INTERFACE), "setClipboardContents", &texto).await;
    });
}

/// Extensão da tela `transferencia`. Uma por sessão; o estado é compartilhado entre todas.
pub struct Transferencia {
    estado: Compartilhado,
    gravar: Gravacao,
    /// Tela que o celular tem aberta agora (vem do `abrir`).
    tela: Option<String>,
    /// Última marca de mudança (`quando`) já tratada pelo tique.
    visto: Option<Instant>,
}

impl Transferencia {
    /// Extensão com a gravação real (Klipper).
    pub fn nova(estado: Compartilhado) -> Self {
        Self::com_gravacao(estado, Arc::new(gravar))
    }

    pub fn com_gravacao(estado: Compartilhado, gravar: Gravacao) -> Self {
        Self { estado, gravar, tela: None, visto: None }
    }

    /// `area_transferencia` vindo do celular: guarda como `celular` e grava no computador.
    fn do_celular(&mut self, msg: &Value) {
        let Some(s) = msg["s"].as_str() else { return };
        let texto = limitar_caracteres(cortar_bytes(s, LIMITE_DO_CELULAR));
        // Vazio não apaga a área de transferência do computador por engano.
        if texto.is_empty() {
            return;
        }
        *self.estado.lock().unwrap() = Copiado { texto: texto.clone(), quando: Instant::now(), origem: "celular" };
        (self.gravar)(texto);
    }

    /// `transferencia:trazer`: manda ao celular o que está copiado no computador.
    fn trazer(&self, respostas: &mut Vec<Mensagem>) {
        let texto = self.estado.lock().unwrap().texto.clone();
        if texto.is_empty() {
            respostas.push(controle(json!({"t":"aviso","texto":"Nada copiado no computador"})));
            return;
        }
        let s = cortar_bytes(&texto, LIMITE_PARA_O_CELULAR);
        respostas.push(controle(json!({"t":"area_transferencia","s":s})));
    }

    /// Abre a tela: responde a tela com a prévia atual.
    fn tela_aberta(&mut self, respostas: &mut Vec<Mensagem>) {
        let (quando, previa) = {
            let c = self.estado.lock().unwrap();
            (c.quando, previa(&c.texto))
        };
        self.visto = Some(quando);
        respostas.push(controle(tela_transferencia(&previa)));
    }

    /// Tique de 1 s: se o copiado mudou e a tela está aberta, manda só a prévia nova.
    fn tique(&mut self, respostas: &mut Vec<Mensagem>) {
        let quando = self.estado.lock().unwrap().quando;
        if self.visto == Some(quando) {
            return;
        }
        self.visto = Some(quando);
        if self.tela.as_deref() != Some("transferencia") {
            return;
        }
        let previa = previa(&self.estado.lock().unwrap().texto);
        respostas.push(controle(json!({
            "t":"estado","tela":"transferencia","pecas":[{"id":"previa","texto":previa}],
        })));
    }
}

impl Extensao for Transferencia {
    fn controle(&mut self, t: &str, msg: &Value, respostas: &mut Vec<Mensagem>) -> bool {
        match t {
            "area_transferencia" => {
                self.do_celular(msg);
                true
            }
            "abrir" => {
                // Guarda a tela de qualquer modo (o celular manda `abrir` para todos).
                self.tela = msg["tela"].as_str().map(String::from);
                if self.tela.as_deref() == Some("transferencia") {
                    self.tela_aberta(respostas);
                    true
                } else {
                    false
                }
            }
            "acao" if msg["id"].as_str() == Some("transferencia:trazer") => {
                self.trazer(respostas);
                true
            }
            _ => false,
        }
    }

    fn telas(&self) -> Vec<Value> {
        vec![json!({"id":"transferencia","nome":"Copiados","icone":"copiar","grupo":"Ponte","nivel":1})]
    }

    fn evento(&mut self, e: &Evento, respostas: &mut Vec<Mensagem>) {
        if e.tipo == "tique" {
            self.tique(respostas);
        }
    }
}

fn previa(texto: &str) -> String {
    if texto.is_empty() {
        return "Nada copiado".into();
    }
    texto.chars().take(PREVIA_CARACTERES).collect()
}

fn tela_transferencia(previa: &str) -> Value {
    json!({
        "t":"tela","id":"transferencia","nome":"Copiados","nivel":1,
        "pecas":[
            {"p":"texto","id":"previa","texto":previa,"tamanho":"m"},
            {"p":"tecla","id":"celular:enviar","rotulo":"Enviar o que copiei aqui","icone":"celular"},
            {"p":"tecla","id":"transferencia:trazer","rotulo":"Trazer para o celular","icone":"copiar"}
        ]
    })
}

/// Corta `s` no máximo em `max` bytes, no último caractere inteiro que cabe.
fn cortar_bytes(s: &str, max: usize) -> &str {
    if s.len() <= max {
        return s;
    }
    let mut fim = max;
    while !s.is_char_boundary(fim) {
        fim -= 1;
    }
    &s[..fim]
}

fn limitar_caracteres(s: &str) -> String {
    s.chars().take(LIMITE_CARACTERES).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    type Gravados = Arc<Mutex<Vec<String>>>;

    /// Transferência com estado `texto`/`origem` e gravação que anota o que recebe.
    fn montar(texto: &str, origem: &'static str) -> (Transferencia, Compartilhado, Gravados) {
        let estado: Compartilhado = Arc::new(Mutex::new(Copiado { texto: texto.into(), quando: Instant::now(), origem }));
        let gravados: Gravados = Arc::new(Mutex::new(Vec::new()));
        let g = gravados.clone();
        let gravar: Gravacao = Arc::new(move |s: String| g.lock().unwrap().push(s));
        (Transferencia::com_gravacao(estado.clone(), gravar), estado, gravados)
    }

    fn de(m: &Mensagem) -> &Value {
        match m {
            Mensagem::Controle(v) => v,
            outra => panic!("esperava CONTROLE, veio {outra:?}"),
        }
    }

    fn abrir_tela(t: &mut Transferencia, tela: &str) -> Vec<Mensagem> {
        let mut r = Vec::new();
        t.controle("abrir", &json!({"t":"abrir","tela":tela}), &mut r);
        r
    }

    fn tique(t: &mut Transferencia) -> Vec<Mensagem> {
        let mut r = Vec::new();
        t.evento(&Evento::novo("tique", Value::Null), &mut r);
        r
    }

    /// Simula o Klipper mudando o texto (a marca `quando` avança 1 s).
    fn mudar_no_computador(estado: &Compartilhado, texto: &str) {
        let mut c = estado.lock().unwrap();
        c.texto = texto.into();
        c.quando += Duration::from_secs(1);
        c.origem = "computador";
    }

    #[test]
    fn tela_sem_texto_mostra_nada_copiado() {
        let (mut t, _, _) = montar("", "computador");
        let r = abrir_tela(&mut t, "transferencia");
        assert_eq!(r.len(), 1);
        let tela = de(&r[0]);
        assert_eq!(tela["t"], "tela");
        assert_eq!(tela["id"], "transferencia");
        assert_eq!(tela["nome"], "Copiados");
        let pecas = tela["pecas"].as_array().unwrap();
        assert_eq!(pecas[0]["id"], "previa");
        assert_eq!(pecas[0]["texto"], "Nada copiado");
        assert_eq!(pecas[1]["id"], "celular:enviar");
        assert_eq!(pecas[1]["rotulo"], "Enviar o que copiei aqui");
        assert_eq!(pecas[1]["icone"], "celular");
        assert_eq!(pecas[2]["id"], "transferencia:trazer");
        assert_eq!(pecas[2]["rotulo"], "Trazer para o celular");
        assert_eq!(pecas[2]["icone"], "copiar");
    }

    #[test]
    fn tela_com_texto_mostra_a_previa() {
        let (mut t, _, _) = montar("senha da sala", "computador");
        let r = abrir_tela(&mut t, "transferencia");
        assert_eq!(de(&r[0])["pecas"][0]["texto"], "senha da sala");
    }

    #[test]
    fn abrir_outra_tela_nao_e_tratada_mas_fica_guardada() {
        let (mut t, _, _) = montar("x", "computador");
        let mut r = Vec::new();
        assert!(!t.controle("abrir", &json!({"t":"abrir","tela":"trackpad"}), &mut r));
        assert!(r.is_empty());
        // com a tela trocada, o tique não manda estado
        mudar_no_computador(&t.estado, "novo");
        assert!(tique(&mut t).is_empty());
    }

    #[test]
    fn area_transferencia_do_celular_grava_e_marca_celular() {
        let (mut t, estado, gravados) = montar("", "computador");
        let mut r = Vec::new();
        assert!(t.controle("area_transferencia", &json!({"t":"area_transferencia","s":"oi"}), &mut r));
        assert!(r.is_empty());
        assert_eq!(*gravados.lock().unwrap(), vec!["oi".to_owned()]);
        let c = estado.lock().unwrap();
        assert_eq!(c.texto, "oi");
        assert_eq!(c.origem, "celular");
    }

    #[test]
    fn area_transferencia_vazia_nao_grava() {
        let (mut t, _, gravados) = montar("antes", "computador");
        let mut r = Vec::new();
        assert!(t.controle("area_transferencia", &json!({"t":"area_transferencia","s":""}), &mut r));
        assert!(gravados.lock().unwrap().is_empty());
    }

    #[test]
    fn area_transferencia_do_celular_corta_em_15000_bytes_sem_partir_acento() {
        let (mut t, estado, gravados) = montar("", "computador");
        let grande = "á".repeat(20_000); // 40 000 bytes
        let mut r = Vec::new();
        t.controle("area_transferencia", &json!({"t":"area_transferencia","s":grande}), &mut r);
        let gravado = gravados.lock().unwrap()[0].clone();
        assert!(gravado.len() <= LIMITE_DO_CELULAR);
        assert_eq!(gravado.chars().count(), 7_500); // 15 000 bytes = 7 500 "á"
        assert_eq!(estado.lock().unwrap().texto, gravado);
    }

    #[test]
    fn trazer_responde_com_o_texto_copiado() {
        let (mut t, _, _) = montar("ola mundo", "computador");
        let mut r = Vec::new();
        assert!(t.controle("acao", &json!({"t":"acao","id":"transferencia:trazer"}), &mut r));
        let m = de(&r[0]);
        assert_eq!(m["t"], "area_transferencia");
        assert_eq!(m["s"], "ola mundo");
        assert_eq!(r.len(), 1);
    }

    #[test]
    fn trazer_sem_texto_avisa_e_nao_apaga_o_celular() {
        let (mut t, _, _) = montar("", "computador");
        let mut r = Vec::new();
        assert!(t.controle("acao", &json!({"t":"acao","id":"transferencia:trazer"}), &mut r));
        assert_eq!(de(&r[0])["t"], "aviso");
        assert_eq!(r.len(), 1);
    }

    #[test]
    fn trazer_corta_em_60000_bytes_sem_partir_acento() {
        // "x" + 40 000 "é" (2 bytes cada): o byte 60 000 cai no meio de um "é".
        let texto = format!("x{}", "é".repeat(40_000));
        let (mut t, _, _) = montar(&texto, "computador");
        let mut r = Vec::new();
        t.controle("acao", &json!({"t":"acao","id":"transferencia:trazer"}), &mut r);
        let s = de(&r[0])["s"].as_str().unwrap();
        assert!(s.len() <= LIMITE_PARA_O_CELULAR);
        assert_eq!(s.len(), 59_999);
        assert_eq!(s.chars().count(), 30_000);
        assert!(s.ends_with('é'));
        assert!(texto.starts_with(s));
    }

    #[test]
    fn corte_de_bytes_nao_parte_caractere() {
        assert_eq!(cortar_bytes("ação", 2), "a");
        assert_eq!(cortar_bytes("ação", 3), "aç");
        assert_eq!(cortar_bytes("ação", 4), "aç");
        assert_eq!(cortar_bytes("ação", 5), "açã");
        assert_eq!(cortar_bytes("ação", 6), "ação");
        assert_eq!(cortar_bytes("abc", 10), "abc");
    }

    #[test]
    fn previa_corta_em_140_caracteres() {
        let (mut t, _, _) = montar(&"á".repeat(200), "computador");
        let r = abrir_tela(&mut t, "transferencia");
        let texto = de(&r[0])["pecas"][0]["texto"].as_str().unwrap();
        assert_eq!(texto.chars().count(), PREVIA_CARACTERES);
        assert_eq!(texto, "á".repeat(140));
    }

    #[test]
    fn tique_sem_mudanca_nao_manda_nada() {
        let (mut t, _, _) = montar("x", "computador");
        abrir_tela(&mut t, "transferencia");
        assert!(tique(&mut t).is_empty());
        assert!(tique(&mut t).is_empty());
    }

    #[test]
    fn tique_com_mudanca_e_tela_aberta_manda_so_a_previa() {
        let (mut t, estado, _) = montar("antes", "computador");
        abrir_tela(&mut t, "transferencia");
        mudar_no_computador(&estado, "depois");
        let r = tique(&mut t);
        assert_eq!(r.len(), 1);
        let m = de(&r[0]);
        assert_eq!(m["t"], "estado");
        assert_eq!(m["tela"], "transferencia");
        assert_eq!(m["pecas"][0], json!({"id":"previa","texto":"depois"}));
        // a mesma mudança não se repete
        assert!(tique(&mut t).is_empty());
    }

    #[test]
    fn tique_com_mudanca_sem_a_tela_aberta_nao_manda() {
        let (mut t, estado, _) = montar("antes", "computador");
        mudar_no_computador(&estado, "depois");
        assert!(tique(&mut t).is_empty());
        // ao abrir, a tela já mostra o texto novo
        let r = abrir_tela(&mut t, "transferencia");
        assert_eq!(de(&r[0])["pecas"][0]["texto"], "depois");
    }

    #[test]
    fn celular_envia_e_o_tique_manda_a_previa_nova() {
        let (mut t, _, _) = montar("", "computador");
        abrir_tela(&mut t, "transferencia");
        let mut r = Vec::new();
        t.controle("area_transferencia", &json!({"t":"area_transferencia","s":"do celular"}), &mut r);
        let m = tique(&mut t);
        assert_eq!(m.len(), 1);
        assert_eq!(de(&m[0])["pecas"][0]["texto"], "do celular");
    }

    #[test]
    fn leitura_repetida_nao_muda_nada() {
        let agora = Instant::now();
        let mut c = Copiado { texto: "a".into(), quando: agora, origem: "computador" };
        let mut ultimo = "a".to_owned();
        registrar_leitura(&mut c, &mut ultimo, "a".into(), agora + Duration::from_secs(1));
        assert_eq!(c.quando, agora);
    }

    #[test]
    fn leitura_nova_vira_computador() {
        let agora = Instant::now();
        let mut c = Copiado { texto: "a".into(), quando: agora, origem: "celular" };
        let mut ultimo = "a".to_owned();
        let depois = agora + Duration::from_secs(1);
        registrar_leitura(&mut c, &mut ultimo, "b".into(), depois);
        assert_eq!((c.texto.as_str(), c.origem, c.quando), ("b", "computador", depois));
        assert_eq!(ultimo, "b");
    }

    #[test]
    fn leitura_igual_ao_que_o_celular_mandou_mantem_a_origem() {
        // o celular grava "b" e guarda; o Klipper ainda devolve "a" e depois "b"
        let agora = Instant::now();
        let mut c = Copiado { texto: "b".into(), quando: agora, origem: "celular" };
        let mut ultimo = "a".to_owned();
        registrar_leitura(&mut c, &mut ultimo, "b".into(), agora + Duration::from_secs(1));
        assert_eq!((c.origem, c.quando), ("celular", agora));
    }

    #[test]
    fn telas_anunciam_a_transferencia() {
        let (t, _, _) = montar("", "computador");
        let telas = t.telas();
        assert_eq!(telas, vec![json!({"id":"transferencia","nome":"Copiados","icone":"copiar","grupo":"Ponte","nivel":1})]);
    }

    #[test]
    fn acao_com_outro_id_nao_e_tratada() {
        let (mut t, _, _) = montar("x", "computador");
        let mut r = Vec::new();
        assert!(!t.controle("acao", &json!({"t":"acao","id":"copiar"}), &mut r));
        assert!(r.is_empty());
    }

    #[tokio::test]
    #[ignore]
    async fn klipper_real() {
        // Só lê: não grava nada na área de transferência. Imprime o tamanho, não o texto.
        let c = zbus::Connection::session().await.expect("barramento de sessão");
        let texto = ler_klipper(&c).await.expect("getClipboardContents");
        println!("Klipper: {} caracteres ({} bytes)", texto.chars().count(), texto.len());
    }
}
