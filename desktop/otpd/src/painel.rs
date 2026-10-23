//! Extensão do painel do celular: laterais, menu de modos e ações da biblioteca de atalhos
//! (`atalhos.rs`). Só executa o que está numa lista fechada: um `id` da biblioteca ou `volume`.
//! Nunca recebe comando de texto. O volume passa por `wpctl` com argumentos separados (sem shell).

use std::io;
use std::process::Command;

use evdev::KeyCode;
use serde_json::{json, Value};

use crate::atalhos::{self, Atalho, Gesto};
use crate::protocolo::{controle, Mensagem};
use crate::saida::{Botao, Saida};
use crate::sessao::{Extensao, SaidaCompartilhada};
use crate::teclas;

/// Roda `wpctl` com estes argumentos (sem o nome do programa). `None` = não deu certo.
pub type Executor = Box<dyn FnMut(&[&str]) -> Option<String> + Send>;

const SINK: &str = "@DEFAULT_AUDIO_SINK@";
const PASSOS_VOLUME: u32 = 50;
/// Número de peças da lateral esquerda (atalhos do app em foco).
const ESQUERDA: usize = 5;

/// Telas que o celular pode abrir (`src/celular/navegacao/modos.ts`, nível de `src/sim/telas.ts`).
/// Só as implementadas por enquanto.
struct Tela {
    id: &'static str,
    nome: &'static str,
    icone: &'static str,
    grupo: &'static str,
    nivel: u8,
}

const TELAS: &[Tela] = &[
    Tela { id: "trackpad", nome: "Trackpad", icone: "trackpad", grupo: "Controlar", nivel: 1 },
    Tela { id: "teclado", nome: "Teclado", icone: "teclado", grupo: "Controlar", nivel: 1 },
    Tela { id: "giro", nome: "Volume", icone: "volume", grupo: "Controlar", nivel: 1 },
    Tela { id: "atalhos", nome: "Atalhos", icone: "atalhos", grupo: "Atalhos", nivel: 1 },
];

/// Executor real: `wpctl` do sistema.
pub fn wpctl_do_sistema() -> Executor {
    Box::new(|args: &[&str]| -> Option<String> {
        let saida = Command::new("wpctl").args(args).output().ok()?;
        saida.status.success().then(|| String::from_utf8_lossy(&saida.stdout).into_owned())
    })
}

/// Executor do modo `--teste`: só escreve o que seria rodado, sem mexer no volume.
pub fn wpctl_de_teste() -> Executor {
    Box::new(|args: &[&str]| -> Option<String> {
        eprintln!("    wpctl {}", args.join(" "));
        Some("Volume: 0.50".to_owned())
    })
}

pub struct Painel {
    saida: SaidaCompartilhada,
    wpctl: Executor,
    /// App em foco. Por enquanto sempre a área de trabalho.
    app: &'static str,
}

impl Painel {
    pub fn new(saida: SaidaCompartilhada, wpctl: Executor) -> Self {
        Self { saida, wpctl, app: "area" }
    }

    fn atalhos_do_app(&self) -> Vec<&'static Atalho> {
        atalhos::perfil(self.app).unwrap_or(&[]).iter().filter_map(|id| atalhos::buscar(id)).collect()
    }

    fn acao(&mut self, msg: &Value, respostas: &mut Vec<Mensagem>) {
        let Some(id) = msg["id"].as_str() else { return };
        if id == "volume" {
            if let Some(valor) = msg["valor"].as_f64() {
                self.ajustar_volume(valor, respostas);
            }
            return;
        }
        // Id fora da biblioteca: não faz nada.
        let Some(atalho) = atalhos::buscar(id) else { return };
        let feito = match atalho.gesto {
            Gesto::Teclas(nomes) => self.apertar_combo(nomes),
            Gesto::CliqueDireito => self.clicar_direito(),
        };
        if feito.is_err() {
            respostas.push(controle(json!({"t":"aviso","texto":format!("Não deu para: {}", atalho.rotulo)})));
        }
    }

    fn apertar_combo(&self, nomes: &[&str]) -> io::Result<()> {
        let codigos = nomes
            .iter()
            .map(|n| teclas::codigo(n).ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, format!("tecla {n}"))))
            .collect::<io::Result<Vec<KeyCode>>>()?;
        let mut saida = self.saida.lock().unwrap();
        combo(&mut **saida, &codigos)
    }

    fn clicar_direito(&self) -> io::Result<()> {
        let mut saida = self.saida.lock().unwrap();
        saida.botao(Botao::Direito, true)?;
        saida.botao(Botao::Direito, false)
    }

    fn ajustar_volume(&mut self, valor: f64, respostas: &mut Vec<Mensagem>) {
        let pct = format!("{}%", (valor.clamp(0.0, 1.0) * 100.0).round() as u32);
        let args: &[&str] = &["set-volume", SINK, pct.as_str()];
        if (self.wpctl)(args).is_none() {
            respostas.push(controle(json!({"t":"aviso","texto":"Não deu para mudar o volume"})));
        }
    }

    /// Volume atual (0..1), ou meio-termo se o `wpctl` não responde.
    fn volume_atual(&mut self) -> f64 {
        let args: &[&str] = &["get-volume", SINK];
        (self.wpctl)(args)
            .and_then(|s| s.split_whitespace().nth(1)?.parse::<f64>().ok())
            .filter(|v| v.is_finite())
            .map_or(0.5, |v| v.clamp(0.0, 1.0))
    }

    fn abrir(&mut self, msg: &Value, respostas: &mut Vec<Mensagem>) -> bool {
        match msg["tela"].as_str() {
            Some("atalhos") => {
                let pecas: Vec<Value> = self.atalhos_do_app().into_iter().map(peca_tecla).collect();
                respostas.push(controle(json!({
                    "t":"tela","id":"atalhos","nome":"Atalhos","nivel":1,
                    "pecas":[{"p":"grade","id":"g","colunas":4,"pecas":pecas}],
                })));
                true
            }
            Some("giro") => {
                let valor = self.volume_atual();
                respostas.push(controle(json!({
                    "t":"tela","id":"giro","nome":"Volume","nivel":1,
                    "pecas":[{"p":"giro","id":"volume","rotulo":"Volume","valor":valor,"passos":PASSOS_VOLUME}],
                })));
                true
            }
            _ => false,
        }
    }
}

impl Extensao for Painel {
    fn controle(&mut self, t: &str, msg: &Value, respostas: &mut Vec<Mensagem>) -> bool {
        match t {
            "acao" => {
                self.acao(msg, respostas);
                true
            }
            "abrir" => self.abrir(msg, respostas),
            _ => false,
        }
    }

    fn abertura(&mut self, respostas: &mut Vec<Mensagem>) {
        let lista: Vec<Value> = TELAS
            .iter()
            .map(|t| json!({"id":t.id,"nome":t.nome,"icone":t.icone,"grupo":t.grupo,"nivel":t.nivel}))
            .collect();
        respostas.push(controle(json!({"t":"telas","lista":lista})));

        let esquerda: Vec<Value> = self.atalhos_do_app().into_iter().take(ESQUERDA).map(peca_tecla).collect();
        let direita: Vec<Value> = [
            json!({"p":"tecla_presa","id":"presa-ctrl","rotulo":"Ctrl","k":"ctrl"}),
            json!({"p":"tecla_presa","id":"presa-shift","rotulo":"Shift","k":"shift"}),
        ]
        .into_iter()
        .chain(atalhos::buscar("cliqueDireito").map(peca_tecla))
        .collect();
        respostas.push(controle(json!({
            "t":"laterais",
            "app":{"nome":"Área de trabalho","icone":"computador"},
            "esquerda":esquerda,
            "direita":direita,
        })));
    }
}

fn peca_tecla(a: &Atalho) -> Value {
    json!({"p":"tecla","id":a.id,"rotulo":a.rotulo,"icone":a.icone})
}

/// Aperta as teclas em ordem e solta ao contrário. Se uma falhar, solta as que já apertou.
fn combo(saida: &mut dyn Saida, codigos: &[KeyCode]) -> io::Result<()> {
    let mut apertadas = Vec::with_capacity(codigos.len());
    let mut resultado: io::Result<()> = Ok(());
    for k in codigos {
        match saida.tecla(*k, true) {
            Ok(()) => apertadas.push(*k),
            Err(e) => {
                resultado = Err(e);
                break;
            }
        }
    }
    for k in apertadas.iter().rev() {
        resultado = resultado.and(saida.tecla(*k, false));
    }
    resultado
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::saida::Registro;
    use std::sync::{Arc, Mutex};

    type Chamadas = Arc<Mutex<Vec<Vec<String>>>>;

    /// Painel com saída de registro e um `wpctl` falso. `vol` é a resposta do `get-volume`.
    fn montar(vol: Option<&'static str>) -> (Painel, Registro, Chamadas) {
        let reg = Registro::novo();
        let saida: SaidaCompartilhada = Arc::new(Mutex::new(Box::new(reg.clone())));
        let chamadas: Chamadas = Arc::new(Mutex::new(Vec::new()));
        let gravadas = chamadas.clone();
        let falso: Executor = Box::new(move |args: &[&str]| {
            gravadas.lock().unwrap().push(args.iter().map(|s| s.to_string()).collect());
            if args[0] == "get-volume" {
                vol.map(String::from)
            } else {
                Some(String::new())
            }
        });
        (Painel::new(saida, falso), reg, chamadas)
    }

    fn de(m: &Mensagem) -> &Value {
        match m {
            Mensagem::Controle(v) => v,
            outra => panic!("esperava CONTROLE, veio {outra:?}"),
        }
    }

    fn ids(pecas: &Value) -> Vec<String> {
        pecas.as_array().unwrap().iter().map(|p| p["id"].as_str().unwrap().to_owned()).collect()
    }

    #[test]
    fn abertura_manda_telas_e_laterais() {
        let (mut p, _, _) = montar(None);
        let mut r = Vec::new();
        p.abertura(&mut r);
        assert_eq!(r.len(), 2);

        let telas = de(&r[0]);
        assert_eq!(telas["t"], "telas");
        assert_eq!(telas["lista"].as_array().unwrap().len(), TELAS.len());
        assert_eq!(telas["lista"][0]["id"], "trackpad");

        let laterais = de(&r[1]);
        assert_eq!(laterais["t"], "laterais");
        let esquerda = &laterais["esquerda"];
        let direita = &laterais["direita"];
        assert_eq!(esquerda.as_array().unwrap().len(), 5);
        assert_eq!(direita.as_array().unwrap().len(), 3);
        assert_eq!(ids(esquerda), vec!["copiar", "colar", "alttab", "areas", "maximizar"]);
        assert_eq!(direita[0], json!({"p":"tecla_presa","id":"presa-ctrl","rotulo":"Ctrl","k":"ctrl"}));
        assert_eq!(direita[2]["id"], "cliqueDireito");
        assert_eq!(direita[2]["p"], "tecla");
    }

    #[test]
    fn acao_copiar_aperta_e_solta_ao_contrario() {
        let (mut p, reg, chamadas) = montar(None);
        let mut r = Vec::new();
        assert!(p.controle("acao", &json!({"t":"acao","id":"copiar"}), &mut r));
        assert_eq!(
            reg.linhas(),
            vec!["tecla KEY_LEFTCTRL aperta", "tecla KEY_C aperta", "tecla KEY_C solta", "tecla KEY_LEFTCTRL solta"]
        );
        assert!(r.is_empty());
        assert!(chamadas.lock().unwrap().is_empty());
    }

    #[test]
    fn acao_clique_direito_clica_com_o_botao() {
        let (mut p, reg, _) = montar(None);
        let mut r = Vec::new();
        assert!(p.controle("acao", &json!({"t":"acao","id":"cliqueDireito"}), &mut r));
        assert_eq!(reg.linhas(), vec!["botao Direito aperta", "botao Direito solta"]);
    }

    #[test]
    fn acao_com_id_inventado_nao_faz_nada() {
        let (mut p, reg, chamadas) = montar(None);
        let mut r = Vec::new();
        assert!(p.controle("acao", &json!({"t":"acao","id":"rm -rf /"}), &mut r));
        assert!(p.controle("acao", &json!({"t":"acao"}), &mut r));
        assert!(reg.linhas().is_empty());
        assert!(chamadas.lock().unwrap().is_empty());
        assert!(r.is_empty());
    }

    #[test]
    fn acao_volume_ajusta_pelo_wpctl_e_limita() {
        let (mut p, reg, chamadas) = montar(None);
        let mut r = Vec::new();
        assert!(p.controle("acao", &json!({"t":"acao","id":"volume","valor":0.4}), &mut r));
        assert_eq!(
            *chamadas.lock().unwrap(),
            vec![vec!["set-volume".to_owned(), "@DEFAULT_AUDIO_SINK@".to_owned(), "40%".to_owned()]]
        );
        assert!(reg.linhas().is_empty());

        p.controle("acao", &json!({"t":"acao","id":"volume","valor":7}), &mut r);
        p.controle("acao", &json!({"t":"acao","id":"volume","valor":-3}), &mut r);
        let todas = chamadas.lock().unwrap().clone();
        assert_eq!(todas[1][2], "100%");
        assert_eq!(todas[2][2], "0%");
        assert!(r.is_empty());
    }

    #[test]
    fn abrir_atalhos_devolve_a_grade_do_perfil() {
        let (mut p, _, _) = montar(None);
        let mut r = Vec::new();
        assert!(p.controle("abrir", &json!({"t":"abrir","tela":"atalhos"}), &mut r));
        let tela = de(&r[0]);
        assert_eq!(tela["t"], "tela");
        assert_eq!(tela["id"], "atalhos");
        let grade = &tela["pecas"][0];
        assert_eq!(grade["p"], "grade");
        assert_eq!(grade["colunas"], 4);
        assert_eq!(ids(&grade["pecas"]), vec!["copiar", "colar", "alttab", "areas", "maximizar", "captura", "desfazer", "refazer"]);
        assert!(grade["pecas"].as_array().unwrap().iter().all(|p| p["p"] == "tecla"));
    }

    #[test]
    fn abrir_giro_le_o_volume_atual() {
        let (mut p, _, _) = montar(Some("Volume: 0.30"));
        let mut r = Vec::new();
        assert!(p.controle("abrir", &json!({"t":"abrir","tela":"giro"}), &mut r));
        let peca = &de(&r[0])["pecas"][0];
        assert_eq!(peca["p"], "giro");
        assert_eq!(peca["id"], "volume");
        assert_eq!(peca["passos"], 50);
        assert!((peca["valor"].as_f64().unwrap() - 0.3).abs() < 1e-9);
    }

    #[test]
    fn abrir_giro_sem_wpctl_usa_meio() {
        let (mut p, _, _) = montar(None);
        let mut r = Vec::new();
        p.controle("abrir", &json!({"t":"abrir","tela":"giro"}), &mut r);
        assert_eq!(de(&r[0])["pecas"][0]["valor"], 0.5);
    }

    #[test]
    fn abrir_tela_que_nao_existe_aqui_e_ignorado() {
        let (mut p, _, _) = montar(None);
        let mut r = Vec::new();
        assert!(!p.controle("abrir", &json!({"t":"abrir","tela":"espelho"}), &mut r));
        assert!(!p.controle("outro", &json!({"t":"outro"}), &mut r));
        assert!(r.is_empty());
    }
}
