//! Uma conexão com um celular, sem rede: recebe `Mensagem`, mexe na `Saida` e devolve
//! as respostas. O laço de I/O (`servidor.rs`) só lê, chama `receber` e escreve.
//! Assim toda a lógica é testável com a saída de registro.

use std::sync::{Arc, Mutex};

use serde_json::{json, Value};

use crate::estado::ContactState;
use crate::pareamento::{Pareamento, Resultado};
use crate::protocolo::{controle, Mensagem, Superficie, VERSAO};
use crate::saida::{Botao, Saida};
use crate::teclas;

pub type SaidaCompartilhada = Arc<Mutex<Box<dyn Saida>>>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Fase {
    Aguardando,
    Aberta { aparelho_id: String },
    Fechada,
}

/// Informações do computador mandadas no `bemvindo`.
#[derive(Debug, Clone)]
pub struct Computador {
    pub nome: String,
    pub sistema: String,
    pub ambiente: String,
}

impl Computador {
    pub fn deste() -> Self {
        let nome = std::fs::read_to_string("/etc/hostname").map(|s| s.trim().to_owned()).unwrap_or_else(|_| "Computador".into());
        let ambiente = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default().to_lowercase();
        let ambiente = if ambiente.contains("kde") {
            "kde"
        } else if ambiente.contains("gnome") {
            "gnome"
        } else {
            "outro"
        };
        Self { nome, sistema: "linux".into(), ambiente: ambiente.into() }
    }
}

/// Algo que trata mensagens de controle que esta sessão não conhece (atalhos, mixer,
/// telas…). As ondas seguintes registram extensões aqui, sem mexer no núcleo.
pub trait Extensao: Send {
    /// Devolve `true` se tratou a mensagem.
    fn controle(&mut self, t: &str, msg: &Value, respostas: &mut Vec<Mensagem>) -> bool;
    /// Chamado logo depois do `bemvindo`, para mandar telas e estado iniciais.
    fn abertura(&mut self, _respostas: &mut Vec<Mensagem>) {}
    /// Telas que esta extensão sabe descrever (entram no menu de modos do celular):
    /// `{"id","nome","icone","grupo","nivel"}`.
    fn telas(&self) -> Vec<Value> {
        Vec::new()
    }
    /// Algo mudou no computador (app em foco, tique de 1 s, mídia…). Só com a sessão aberta.
    fn evento(&mut self, _e: &Evento, _respostas: &mut Vec<Mensagem>) {}
}

/// Ordem dos modos no menu (`src/celular/navegacao/modos.ts`).
pub const ORDEM_DAS_TELAS: &[&str] = &[
    "trackpad", "teclado", "voz", "mesa", "giro", "atalhos", "lancador", "janelas", "mixer", "midia", "reuniao",
    "espelho", "monitor", "janela", "recorte", "vertical", "painel", "recursos", "transferencia", "camera",
    "microfone", "computadores",
];

/// Acontecimento do computador espalhado para todas as sessões abertas.
#[derive(Debug, Clone, PartialEq)]
pub struct Evento {
    /// `tique` (a cada 1 s), `foco` (app em foco mudou), ou o que uma extensão definir.
    pub tipo: String,
    pub dados: Value,
}

impl Evento {
    pub fn novo(tipo: &str, dados: Value) -> Self {
        Self { tipo: tipo.to_owned(), dados }
    }
}

pub struct Sessao {
    pub fase: Fase,
    saida: SaidaCompartilhada,
    pareamento: Arc<Mutex<Pareamento>>,
    computador: Computador,
    contatos: ContactState,
    ultimo_seq: Option<u32>,
    superficie: Option<Superficie>,
    teclas_presas: Vec<evdev::KeyCode>,
    botoes_presos: Vec<Botao>,
    extensoes: Vec<Box<dyn Extensao>>,
    pub log: Vec<String>,
}

impl Sessao {
    pub fn nova(saida: SaidaCompartilhada, pareamento: Arc<Mutex<Pareamento>>, computador: Computador) -> Self {
        Self {
            fase: Fase::Aguardando,
            saida,
            pareamento,
            computador,
            contatos: ContactState::new(),
            ultimo_seq: None,
            superficie: None,
            teclas_presas: Vec::new(),
            botoes_presos: Vec::new(),
            extensoes: Vec::new(),
            log: Vec::new(),
        }
    }

    pub fn com_extensao(mut self, e: Box<dyn Extensao>) -> Self {
        self.extensoes.push(e);
        self
    }

    pub fn aberta(&self) -> bool {
        matches!(self.fase, Fase::Aberta { .. })
    }

    /// Trata uma mensagem. `Err` = violação de protocolo: quem chama fecha a conexão
    /// (e chama `encerrar`).
    pub fn receber(&mut self, m: Mensagem) -> Result<Vec<Mensagem>, String> {
        let mut r = Vec::new();
        match m {
            Mensagem::Ping { nonce, t_us } => r.push(Mensagem::Pong { nonce, t_us }),
            Mensagem::Pong { .. } | Mensagem::Carga(_) => {}
            Mensagem::Controle(v) => self.controle(v, &mut r)?,
            Mensagem::Toque { seq, contatos } => {
                if !self.aberta() || self.superficie.is_none() {
                    return Err("toque antes da abertura".into());
                }
                // Quadro atrasado ou repetido: o mais novo já foi aplicado.
                if self.ultimo_seq.is_some_and(|u| seq <= u) {
                    return Ok(r);
                }
                self.ultimo_seq = Some(seq);
                let ev = self.contatos.apply(&contatos);
                self.saida().pad(&ev).map_err(|e| format!("touchpad: {e}"))?;
            }
            Mensagem::Video { .. } | Mensagem::Audio { .. } => {}
        }
        Ok(r)
    }

    fn controle(&mut self, v: Value, r: &mut Vec<Mensagem>) -> Result<(), String> {
        let t = v["t"].as_str().unwrap_or_default().to_owned();
        if !self.aberta() {
            return match t.as_str() {
                "ola" => self.ola(&v, r),
                "tchau" => {
                    self.fase = Fase::Fechada;
                    Ok(())
                }
                _ => Err(format!("'{t}' antes do ola")),
            };
        }
        match t.as_str() {
            "superficie" => {
                let s: Superficie = serde_json::from_value(v).map_err(|e| format!("superficie: {e}"))?;
                let soltar = self.contatos.configurar(&s);
                let mut saida = self.saida();
                saida.pad(&soltar).map_err(|e| e.to_string())?;
                let recriado = saida.configurar(self.contatos.geometry()).map_err(|e| format!("touchpad: {e}"))?;
                drop(saida);
                if recriado {
                    self.contatos.device_replaced();
                }
                self.superficie = Some(s);
                self.ultimo_seq = None;
            }
            "botao" => {
                let b = Botao::de(v["b"].as_str().unwrap_or_default()).ok_or("botão desconhecido")?;
                match v["acao"].as_str().unwrap_or("clica") {
                    "aperta" => self.apertar_botao(b)?,
                    "solta" => self.soltar_botao(b)?,
                    _ => {
                        self.apertar_botao(b)?;
                        self.soltar_botao(b)?;
                    }
                }
            }
            "tecla" => {
                let nome = v["k"].as_str().unwrap_or_default();
                let Some(k) = teclas::codigo(nome) else {
                    self.log.push(format!("tecla recusada: {nome:?}"));
                    return Ok(());
                };
                match v["acao"].as_str().unwrap_or("toca") {
                    "aperta" => self.apertar_tecla(k)?,
                    "solta" => self.soltar_tecla(k)?,
                    _ => {
                        self.apertar_tecla(k)?;
                        self.soltar_tecla(k)?;
                    }
                }
            }
            "combo" => {
                let nomes: Vec<&str> = v["k"].as_array().map(|a| a.iter().filter_map(Value::as_str).collect()).unwrap_or_default();
                let codigos: Option<Vec<_>> = nomes.iter().map(|n| teclas::codigo(n)).collect();
                match codigos {
                    Some(ks) if !ks.is_empty() && ks.len() <= 5 => {
                        for k in &ks {
                            self.apertar_tecla(*k)?;
                        }
                        for k in ks.iter().rev() {
                            self.soltar_tecla(*k)?;
                        }
                    }
                    _ => self.log.push(format!("combo recusado: {nomes:?}")),
                }
            }
            "rolar" => {
                let dx = v["dx"].as_i64().unwrap_or(0).clamp(-20, 20) as i32;
                let dy = v["dy"].as_i64().unwrap_or(0).clamp(-20, 20) as i32;
                self.saida().rolar(dx, dy).map_err(|e| e.to_string())?;
            }
            "tchau" => {
                self.encerrar();
            }
            _ => {
                let mut tratado = false;
                for e in &mut self.extensoes {
                    if e.controle(&t, &v, r) {
                        tratado = true;
                        break;
                    }
                }
                if !tratado {
                    // `t` desconhecido: ignora (é como mensagens novas entram sem trocar de versão).
                    self.log.push(format!("ignorado: {t}"));
                }
            }
        }
        Ok(())
    }

    /// Repassa um evento às extensões (só com a sessão aberta).
    pub fn evento(&mut self, e: &Evento) -> Vec<Mensagem> {
        let mut r = Vec::new();
        if self.aberta() {
            for x in &mut self.extensoes {
                x.evento(e, &mut r);
            }
        }
        r
    }

    fn ola(&mut self, v: &Value, r: &mut Vec<Mensagem>) -> Result<(), String> {
        let versao = v["v"].as_u64().unwrap_or(0);
        if versao != u64::from(VERSAO) {
            r.push(controle(json!({"t":"recusado","motivo":"versao"})));
            self.fase = Fase::Fechada;
            return Ok(());
        }
        let nome = v["aparelho"]["nome"].as_str().unwrap_or("Celular");
        let p = &v["pareamento"];
        let resultado = {
            let mut pareamento = self.pareamento.lock().unwrap();
            if let Some(codigo) = p["codigo"].as_str() {
                pareamento.com_codigo(codigo, nome)
            } else if let (Some(id), Some(segredo)) = (p["id"].as_str(), p["segredo"].as_str()) {
                pareamento.com_segredo(id, segredo)
            } else {
                Resultado::Recusado("codigo")
            }
        };
        let mut bemvindo = json!({
            "t":"bemvindo","v":VERSAO,
            "computador":{"nome":self.computador.nome,"sistema":self.computador.sistema,"ambiente":self.computador.ambiente},
        });
        match resultado {
            Resultado::Novo { id, segredo } => {
                bemvindo["aparelho_id"] = json!(id);
                bemvindo["segredo"] = json!(segredo);
                self.fase = Fase::Aberta { aparelho_id: id };
            }
            Resultado::Conhecido { id } => {
                bemvindo["aparelho_id"] = json!(id);
                self.fase = Fase::Aberta { aparelho_id: id };
            }
            Resultado::Recusado(motivo) => {
                r.push(controle(json!({"t":"recusado","motivo":motivo})));
                self.fase = Fase::Fechada;
                return Ok(());
            }
        }
        r.push(controle(bemvindo));
        // O menu de modos é a soma das telas de todas as extensões, na ordem fixa do
        // protótipo (nada muda de lugar).
        let mut telas: Vec<Value> = self.extensoes.iter().flat_map(|e| e.telas()).collect();
        telas.sort_by_key(|t| ORDEM_DAS_TELAS.iter().position(|id| t["id"] == *id).unwrap_or(usize::MAX));
        telas.dedup_by(|a, b| a["id"] == b["id"]);
        if !telas.is_empty() {
            r.push(controle(json!({"t":"telas","lista":telas})));
        }
        for e in &mut self.extensoes {
            e.abertura(r);
        }
        Ok(())
    }

    fn saida(&self) -> std::sync::MutexGuard<'_, Box<dyn Saida>> {
        self.saida.lock().unwrap()
    }

    fn apertar_tecla(&mut self, k: evdev::KeyCode) -> Result<(), String> {
        if !self.teclas_presas.contains(&k) {
            self.teclas_presas.push(k);
        }
        self.saida().tecla(k, true).map_err(|e| e.to_string())
    }

    fn soltar_tecla(&mut self, k: evdev::KeyCode) -> Result<(), String> {
        self.teclas_presas.retain(|x| *x != k);
        self.saida().tecla(k, false).map_err(|e| e.to_string())
    }

    fn apertar_botao(&mut self, b: Botao) -> Result<(), String> {
        if !self.botoes_presos.contains(&b) {
            self.botoes_presos.push(b);
        }
        self.saida().botao(b, true).map_err(|e| e.to_string())
    }

    fn soltar_botao(&mut self, b: Botao) -> Result<(), String> {
        self.botoes_presos.retain(|x| *x != b);
        self.saida().botao(b, false).map_err(|e| e.to_string())
    }

    /// Queda, `tchau` ou silêncio: solta tudo na hora (dedos, botões, teclas presas).
    pub fn encerrar(&mut self) {
        let ev = self.contatos.release_all();
        let mut saida = self.saida.lock().unwrap();
        let _ = saida.pad(&ev);
        for b in self.botoes_presos.drain(..) {
            let _ = saida.botao(b, false);
        }
        for k in self.teclas_presas.drain(..).rev() {
            let _ = saida.tecla(k, false);
        }
        self.fase = Fase::Fechada;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocolo::Contato;
    use crate::saida::Registro;

    fn montar() -> (Sessao, Registro, String) {
        let reg = Registro::novo();
        let saida: SaidaCompartilhada = Arc::new(Mutex::new(Box::new(reg.clone())));
        let mut p = Pareamento::em_memoria();
        let codigo = p.novo_codigo();
        let comp = Computador { nome: "Teste".into(), sistema: "linux".into(), ambiente: "kde".into() };
        (Sessao::nova(saida, Arc::new(Mutex::new(p)), comp), reg, codigo)
    }

    fn ola(codigo: &str) -> Mensagem {
        controle(json!({"t":"ola","v":1,"app":"t","aparelho":{"nome":"Cel","sistema":"android","versao":28},"pareamento":{"codigo":codigo}}))
    }

    fn sup() -> Mensagem {
        controle(json!({"t":"superficie","w":1180,"h":738,"w_um":96000,"h_um":60000,"max":10}))
    }

    fn t(r: &[Mensagem]) -> Vec<String> {
        r.iter().filter_map(|m| match m { Mensagem::Controle(v) => v["t"].as_str().map(String::from), _ => None }).collect()
    }

    #[test]
    fn abertura_com_codigo_e_depois_com_segredo() {
        let (mut s, _, codigo) = montar();
        let r = s.receber(ola(&codigo)).unwrap();
        assert_eq!(t(&r), vec!["bemvindo"]);
        let Mensagem::Controle(b) = &r[0] else { panic!() };
        let (id, segredo) = (b["aparelho_id"].as_str().unwrap().to_owned(), b["segredo"].as_str().unwrap().to_owned());
        assert!(s.aberta());

        // Segunda conexão do mesmo celular: só com o segredo, e o segredo não volta.
        let mut s2 = Sessao::nova(s.saida.clone(), s.pareamento.clone(), s.computador.clone());
        let r = s2.receber(controle(json!({"t":"ola","v":1,"pareamento":{"id":id,"segredo":segredo}}))).unwrap();
        let Mensagem::Controle(b) = &r[0] else { panic!() };
        assert_eq!(b["t"], "bemvindo");
        assert!(b.get("segredo").is_none());
    }

    #[test]
    fn codigo_errado_e_recusado() {
        let (mut s, _, _) = montar();
        let r = s.receber(ola("999999x")).unwrap();
        assert_eq!(t(&r), vec!["recusado"]);
        assert_eq!(s.fase, Fase::Fechada);
    }

    #[test]
    fn versao_errada_e_recusada() {
        let (mut s, _, _) = montar();
        let r = s.receber(controle(json!({"t":"ola","v":99}))).unwrap();
        let Mensagem::Controle(v) = &r[0] else { panic!() };
        assert_eq!(v["motivo"], "versao");
    }

    #[test]
    fn nada_antes_do_ola() {
        let (mut s, _, _) = montar();
        assert!(s.receber(controle(json!({"t":"tecla","k":"a"}))).is_err());
        assert!(s.receber(Mensagem::Toque { seq: 1, contatos: vec![] }).is_err());
    }

    #[test]
    fn toque_vira_eventos_do_touchpad() {
        let (mut s, reg, codigo) = montar();
        s.receber(ola(&codigo)).unwrap();
        s.receber(sup()).unwrap();
        s.receber(Mensagem::Toque { seq: 1, contatos: vec![Contato { id: 0, x: 100, y: 100, major: 10 }] }).unwrap();
        let l = reg.linhas();
        assert!(l.iter().any(|x| x.starts_with("configurar 96x60")), "{l:?}");
        assert!(l.iter().any(|x| x.contains("Touch(true)")), "{l:?}");
    }

    #[test]
    fn quadro_atrasado_e_descartado() {
        let (mut s, reg, codigo) = montar();
        s.receber(ola(&codigo)).unwrap();
        s.receber(sup()).unwrap();
        s.receber(Mensagem::Toque { seq: 5, contatos: vec![Contato { id: 0, x: 100, y: 100, major: 0 }] }).unwrap();
        let n = reg.linhas().len();
        s.receber(Mensagem::Toque { seq: 4, contatos: vec![] }).unwrap();
        assert_eq!(reg.linhas().len(), n);
    }

    #[test]
    fn queda_solta_dedos_botoes_e_teclas() {
        let (mut s, reg, codigo) = montar();
        s.receber(ola(&codigo)).unwrap();
        s.receber(sup()).unwrap();
        s.receber(Mensagem::Toque { seq: 1, contatos: vec![Contato { id: 0, x: 1, y: 1, major: 0 }] }).unwrap();
        s.receber(controle(json!({"t":"tecla","k":"ctrl","acao":"aperta"}))).unwrap();
        s.receber(controle(json!({"t":"botao","b":"esquerdo","acao":"aperta"}))).unwrap();
        s.encerrar();
        let l = reg.linhas();
        assert!(l.iter().any(|x| x.contains("TrackingId(-1)")), "{l:?}");
        assert!(l.iter().any(|x| x == "botao Esquerdo solta"), "{l:?}");
        assert!(l.iter().any(|x| x == "tecla KEY_LEFTCTRL solta"), "{l:?}");
    }

    #[test]
    fn combo_aperta_em_ordem_e_solta_ao_contrario() {
        let (mut s, reg, codigo) = montar();
        s.receber(ola(&codigo)).unwrap();
        s.receber(controle(json!({"t":"combo","k":["ctrl","shift","t"]}))).unwrap();
        let l: Vec<_> = reg.linhas().into_iter().filter(|x| x.starts_with("tecla")).collect();
        assert_eq!(l, vec![
            "tecla KEY_LEFTCTRL aperta", "tecla KEY_LEFTSHIFT aperta", "tecla KEY_T aperta",
            "tecla KEY_T solta", "tecla KEY_LEFTSHIFT solta", "tecla KEY_LEFTCTRL solta",
        ]);
    }

    #[test]
    fn tecla_fora_da_lista_nao_faz_nada() {
        let (mut s, reg, codigo) = montar();
        s.receber(ola(&codigo)).unwrap();
        s.receber(controle(json!({"t":"tecla","k":"rm -rf /"}))).unwrap();
        s.receber(controle(json!({"t":"combo","k":["ctrl","bomba"]}))).unwrap();
        assert!(!reg.linhas().iter().any(|x| x.starts_with("tecla")));
    }

    #[test]
    fn ping_vira_pong() {
        let (mut s, _, _) = montar();
        assert_eq!(s.receber(Mensagem::Ping { nonce: 3, t_us: 9 }).unwrap(), vec![Mensagem::Pong { nonce: 3, t_us: 9 }]);
    }
}
