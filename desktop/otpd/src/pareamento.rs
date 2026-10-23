//! Aparelhos de confiança e códigos de uso único do QR.
//!
//! O código vale uma vez e por 5 minutos. No primeiro contato o computador entrega um
//! segredo de 32 bytes; o celular guarda e usa nas conexões seguintes. Aqui só fica o
//! SHA-256 do segredo, nunca o segredo.

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const VALIDADE_CODIGO: Duration = Duration::from_secs(5 * 60);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Aparelho {
    pub id: String,
    pub nome: String,
    /// SHA-256 do segredo, em hex.
    pub segredo_sha256: String,
}

#[derive(Debug, Default)]
pub struct Pareamento {
    aparelhos: Vec<Aparelho>,
    codigos: HashMap<String, Instant>,
    arquivo: Option<PathBuf>,
}

pub enum Resultado {
    /// Aparelho novo: devolve o segredo para mandar ao celular uma vez.
    Novo { id: String, segredo: String },
    Conhecido { id: String },
    Recusado(&'static str),
}

impl Pareamento {
    /// Sem arquivo (testes).
    pub fn em_memoria() -> Self {
        Self::default()
    }

    /// Lê `~/.config/opentrackpad/aparelhos.json` (ou o caminho dado), se existir.
    pub fn do_arquivo(arquivo: PathBuf) -> Self {
        let aparelhos = std::fs::read_to_string(&arquivo)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Self { aparelhos, codigos: HashMap::new(), arquivo: Some(arquivo) }
    }

    pub fn arquivo_padrao() -> PathBuf {
        config_dir().join("aparelhos.json")
    }

    pub fn aparelhos(&self) -> &[Aparelho] {
        &self.aparelhos
    }

    /// Gera um código de 6 dígitos para o QR.
    pub fn novo_codigo(&mut self) -> String {
        let n = u32::from_le_bytes(aleatorio::<4>()) % 1_000_000;
        let codigo = format!("{n:06}");
        self.codigos.retain(|_, t| t.elapsed() < VALIDADE_CODIGO);
        self.codigos.insert(codigo.clone(), Instant::now());
        codigo
    }

    /// Usa um código escolhido (testes com o emulador). Mesmas regras de validade.
    pub fn fixar_codigo(&mut self, codigo: &str) -> String {
        self.codigos.insert(codigo.to_owned(), Instant::now());
        codigo.to_owned()
    }

    /// Quanto falta para o código expirar. `None` se ele nunca foi gerado, já foi usado ou
    /// já expirou.
    pub fn validade_restante(&self, codigo: &str) -> Option<Duration> {
        let t = self.codigos.get(codigo)?;
        VALIDADE_CODIGO.checked_sub(t.elapsed())
    }

    pub fn com_codigo(&mut self, codigo: &str, nome: &str) -> Resultado {
        match self.codigos.remove(codigo) {
            Some(t) if t.elapsed() < VALIDADE_CODIGO => {
                let id = hex(&aleatorio::<6>());
                let segredo_bytes = aleatorio::<32>();
                let segredo = base64(&segredo_bytes);
                self.aparelhos.push(Aparelho {
                    id: id.clone(),
                    nome: nome.chars().take(60).collect(),
                    segredo_sha256: hex(&Sha256::digest(segredo.as_bytes())),
                });
                self.salvar();
                Resultado::Novo { id, segredo }
            }
            _ => Resultado::Recusado("codigo"),
        }
    }

    pub fn com_segredo(&self, id: &str, segredo: &str) -> Resultado {
        let h = hex(&Sha256::digest(segredo.as_bytes()));
        match self.aparelhos.iter().find(|a| a.id == id) {
            // Comparação em tempo constante: não vaza quantos bytes acertaram.
            Some(a) if iguais(a.segredo_sha256.as_bytes(), h.as_bytes()) => Resultado::Conhecido { id: id.to_owned() },
            _ => Resultado::Recusado("desconhecido"),
        }
    }

    pub fn esquecer(&mut self, id: &str) {
        self.aparelhos.retain(|a| a.id != id);
        self.salvar();
    }

    fn salvar(&self) {
        let Some(arquivo) = &self.arquivo else { return };
        if let Some(pasta) = arquivo.parent() {
            let _ = std::fs::create_dir_all(pasta);
        }
        let tmp = arquivo.with_extension("json.tmp");
        if std::fs::write(&tmp, serde_json::to_string_pretty(&self.aparelhos).unwrap()).is_ok() {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600));
            }
            let _ = std::fs::rename(&tmp, arquivo);
        }
    }
}

pub fn config_dir() -> PathBuf {
    std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))
        .unwrap_or_else(|| PathBuf::from("."))
        .join("opentrackpad")
}

fn iguais(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

pub fn aleatorio<const N: usize>() -> [u8; N] {
    let mut b = [0u8; N];
    getrandom::fill(&mut b).expect("fonte de aleatoriedade do sistema");
    b
}

pub fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

pub fn base64(b: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = String::new();
    for c in b.chunks(3) {
        let n = (u32::from(c[0]) << 16) | (u32::from(*c.get(1).unwrap_or(&0)) << 8) | u32::from(*c.get(2).unwrap_or(&0));
        s.push(A[(n >> 18) as usize & 63] as char);
        s.push(A[(n >> 12) as usize & 63] as char);
        s.push(if c.len() > 1 { A[(n >> 6) as usize & 63] as char } else { '=' });
        s.push(if c.len() > 2 { A[n as usize & 63] as char } else { '=' });
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codigo_vale_uma_vez() {
        let mut p = Pareamento::em_memoria();
        let c = p.novo_codigo();
        assert_eq!(c.len(), 6);
        let Resultado::Novo { id, segredo } = p.com_codigo(&c, "Celular") else { panic!("deveria parear") };
        assert!(matches!(p.com_codigo(&c, "Outro"), Resultado::Recusado("codigo")));
        assert!(matches!(p.com_segredo(&id, &segredo), Resultado::Conhecido { .. }));
        assert!(matches!(p.com_segredo(&id, "errado"), Resultado::Recusado(_)));
        p.esquecer(&id);
        assert!(matches!(p.com_segredo(&id, &segredo), Resultado::Recusado(_)));
    }

    #[test]
    fn codigo_inventado_e_recusado() {
        let mut p = Pareamento::em_memoria();
        assert!(matches!(p.com_codigo("000000", "x"), Resultado::Recusado(_)));
    }

    #[test]
    fn base64_confere() {
        assert_eq!(base64(b"Man"), "TWFu");
        assert_eq!(base64(b"Ma"), "TWE=");
        assert_eq!(base64(b"M"), "TQ==");
    }
}
