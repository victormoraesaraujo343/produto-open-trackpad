//! Enquadramento do protocolo OTP/1 (ver `protocolo/README.md`). Sem I/O de rede:
//! tudo aqui é testável contra os vetores em `protocolo/vetores/`.

use std::io::{self, Read, Write};

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const VERSAO: u32 = 1;
pub const PORTA: u16 = 47800;
pub const MAX_CONTATOS: usize = 10;
/// Limite do CONTROLE vindo do celular.
pub const MAX_CONTROLE_CELULAR: usize = 16 * 1024;

pub const T_CONTROLE: u8 = 0x01;
pub const T_TOQUE: u8 = 0x10;
pub const T_CANETA: u8 = 0x11;
pub const T_PING: u8 = 0x20;
pub const T_PONG: u8 = 0x21;
pub const T_CARGA: u8 = 0x22;
pub const T_VIDEO: u8 = 0x30;
pub const T_AUDIO: u8 = 0x31;
pub const T_CAMERA: u8 = 0x32;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Contato {
    pub id: u8,
    pub x: u16,
    pub y: u16,
    pub major: u16,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Mensagem {
    Controle(Value),
    Toque { seq: u32, contatos: Vec<Contato> },
    /// Mesa digitalizadora: posição normalizada 0..65535, pressão 0..1023; `marcas` bit 0
    /// encostada, bit 1 perto.
    Caneta { seq: u32, x: u16, y: u16, pressao: u16, marcas: u8 },
    Ping { nonce: u32, t_us: u64 },
    Pong { nonce: u32, t_us: u64 },
    Carga(Vec<u8>),
    /// Pedaço de um quadro H.264 (ver "Vídeo" no protocolo); `marcas`: bit 0 chave, bit 1
    /// último pedaço, bit 2 primeiro pedaço.
    Video { pts_us: u64, marcas: u8, dados: Vec<u8> },
    Audio { pts_us: u64, dados: Vec<u8> },
    /// Pedaço de quadro H.264 da câmera do celular (mesmo formato de `Video`).
    Camera { pts_us: u64, marcas: u8, dados: Vec<u8> },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Erro {
    Comprimento,
    Tipo,
    Tamanho,
    Contatos,
    Json,
}

impl std::fmt::Display for Erro {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Erro::Comprimento => "comprimento inválido",
            Erro::Tipo => "tipo de mensagem desconhecido",
            Erro::Tamanho => "carga com tamanho errado",
            Erro::Contatos => "contatos inválidos",
            Erro::Json => "controle não é um objeto JSON com t",
        };
        f.write_str(s)
    }
}

impl std::error::Error for Erro {}

/// Superfície do trackpad informada pelo celular (`t: superficie`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Superficie {
    pub w: u32,
    pub h: u32,
    pub w_um: u32,
    pub h_um: u32,
    #[serde(default = "max_padrao")]
    pub max: u8,
}

fn max_padrao() -> u8 {
    MAX_CONTATOS as u8
}

/// Decodifica a carga de uma mensagem já separada pelo comprimento.
pub fn decodificar(tipo: u8, carga: &[u8]) -> Result<Mensagem, Erro> {
    match tipo {
        T_CONTROLE => {
            let v: Value = serde_json::from_slice(carga).map_err(|_| Erro::Json)?;
            match v.get("t") {
                Some(Value::String(_)) if v.is_object() => Ok(Mensagem::Controle(v)),
                _ => Err(Erro::Json),
            }
        }
        T_TOQUE => {
            if carga.len() < 5 {
                return Err(Erro::Tamanho);
            }
            let seq = u32::from_be_bytes(carga[0..4].try_into().unwrap());
            let n = carga[4] as usize;
            if n > MAX_CONTATOS {
                return Err(Erro::Contatos);
            }
            if carga.len() != 5 + 7 * n {
                return Err(Erro::Tamanho);
            }
            let mut contatos = Vec::with_capacity(n);
            for i in 0..n {
                let b = &carga[5 + 7 * i..12 + 7 * i];
                let c = Contato {
                    id: b[0],
                    x: u16::from_be_bytes([b[1], b[2]]),
                    y: u16::from_be_bytes([b[3], b[4]]),
                    major: u16::from_be_bytes([b[5], b[6]]),
                };
                if contatos.iter().any(|o: &Contato| o.id == c.id) {
                    return Err(Erro::Contatos);
                }
                contatos.push(c);
            }
            Ok(Mensagem::Toque { seq, contatos })
        }
        T_CANETA => {
            if carga.len() != 11 {
                return Err(Erro::Tamanho);
            }
            let pressao = u16::from_be_bytes([carga[8], carga[9]]);
            if pressao > 1023 {
                return Err(Erro::Tamanho);
            }
            Ok(Mensagem::Caneta {
                seq: u32::from_be_bytes(carga[0..4].try_into().unwrap()),
                x: u16::from_be_bytes([carga[4], carga[5]]),
                y: u16::from_be_bytes([carga[6], carga[7]]),
                pressao,
                marcas: carga[10],
            })
        }
        T_PING | T_PONG => {
            if carga.len() != 12 {
                return Err(Erro::Tamanho);
            }
            let nonce = u32::from_be_bytes(carga[0..4].try_into().unwrap());
            let t_us = u64::from_be_bytes(carga[4..12].try_into().unwrap());
            Ok(if tipo == T_PING { Mensagem::Ping { nonce, t_us } } else { Mensagem::Pong { nonce, t_us } })
        }
        T_CARGA => Ok(Mensagem::Carga(carga.to_vec())),
        T_VIDEO | T_CAMERA => {
            if carga.len() < 9 {
                return Err(Erro::Tamanho);
            }
            let pts_us = u64::from_be_bytes(carga[0..8].try_into().unwrap());
            let (marcas, dados) = (carga[8], carga[9..].to_vec());
            Ok(if tipo == T_VIDEO { Mensagem::Video { pts_us, marcas, dados } } else { Mensagem::Camera { pts_us, marcas, dados } })
        }
        T_AUDIO => {
            if carga.len() < 8 {
                return Err(Erro::Tamanho);
            }
            let pts_us = u64::from_be_bytes(carga[0..8].try_into().unwrap());
            Ok(Mensagem::Audio { pts_us, dados: carga[8..].to_vec() })
        }
        _ => Err(Erro::Tipo),
    }
}

/// Codifica tipo + carga (sem o comprimento).
pub fn carga_de(m: &Mensagem) -> (u8, Vec<u8>) {
    match m {
        Mensagem::Controle(v) => (T_CONTROLE, serde_json::to_vec(v).expect("Value sempre serializa")),
        Mensagem::Toque { seq, contatos } => {
            let mut b = Vec::with_capacity(5 + 7 * contatos.len());
            b.extend_from_slice(&seq.to_be_bytes());
            b.push(contatos.len() as u8);
            for c in contatos {
                b.push(c.id);
                b.extend_from_slice(&c.x.to_be_bytes());
                b.extend_from_slice(&c.y.to_be_bytes());
                b.extend_from_slice(&c.major.to_be_bytes());
            }
            (T_TOQUE, b)
        }
        Mensagem::Caneta { seq, x, y, pressao, marcas } => {
            let mut b = Vec::with_capacity(11);
            b.extend_from_slice(&seq.to_be_bytes());
            b.extend_from_slice(&x.to_be_bytes());
            b.extend_from_slice(&y.to_be_bytes());
            b.extend_from_slice(&pressao.to_be_bytes());
            b.push(*marcas);
            (T_CANETA, b)
        }
        Mensagem::Ping { nonce, t_us } | Mensagem::Pong { nonce, t_us } => {
            let mut b = Vec::with_capacity(12);
            b.extend_from_slice(&nonce.to_be_bytes());
            b.extend_from_slice(&t_us.to_be_bytes());
            (if matches!(m, Mensagem::Ping { .. }) { T_PING } else { T_PONG }, b)
        }
        Mensagem::Carga(d) => (T_CARGA, d.clone()),
        Mensagem::Video { pts_us, marcas, dados } | Mensagem::Camera { pts_us, marcas, dados } => {
            let mut b = Vec::with_capacity(9 + dados.len());
            b.extend_from_slice(&pts_us.to_be_bytes());
            b.push(*marcas);
            b.extend_from_slice(dados);
            (if matches!(m, Mensagem::Video { .. }) { T_VIDEO } else { T_CAMERA }, b)
        }
        Mensagem::Audio { pts_us, dados } => {
            let mut b = Vec::with_capacity(8 + dados.len());
            b.extend_from_slice(&pts_us.to_be_bytes());
            b.extend_from_slice(dados);
            (T_AUDIO, b)
        }
    }
}

/// Mensagem inteira, com comprimento. Falha se passar de 65535 bytes.
pub fn codificar(m: &Mensagem) -> io::Result<Vec<u8>> {
    let (tipo, carga) = carga_de(m);
    let len = carga.len() + 1;
    if len > u16::MAX as usize {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "mensagem grande demais"));
    }
    let mut out = Vec::with_capacity(len + 2);
    out.extend_from_slice(&(len as u16).to_be_bytes());
    out.push(tipo);
    out.extend_from_slice(&carga);
    Ok(out)
}

pub fn controle(v: Value) -> Mensagem {
    Mensagem::Controle(v)
}

pub fn escrever<W: Write>(w: &mut W, m: &Mensagem) -> io::Result<()> {
    w.write_all(&codificar(m)?)?;
    w.flush()
}

/// Lê uma mensagem. `limite_controle` restringe o tamanho de CONTROLE recebido.
/// `Ok(None)` = o outro lado fechou entre mensagens.
pub fn ler<R: Read>(r: &mut R, limite_controle: usize) -> io::Result<Option<Mensagem>> {
    let mut cab = [0u8; 2];
    match r.read_exact(&mut cab) {
        Ok(()) => {}
        Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let len = u16::from_be_bytes(cab) as usize;
    if len == 0 {
        return Err(invalido(Erro::Comprimento));
    }
    let mut corpo = vec![0u8; len];
    r.read_exact(&mut corpo)?;
    let tipo = corpo[0];
    if tipo == T_CONTROLE && len - 1 > limite_controle {
        return Err(invalido(Erro::Tamanho));
    }
    decodificar(tipo, &corpo[1..]).map(Some).map_err(invalido)
}

fn invalido(e: Erro) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, e)
}

/// Nível da conexão (igual a `nivelDe` em `src/sim/conexao.ts`).
pub fn nivel_de(mbps: f64, rtt_ms: f64) -> u8 {
    if mbps <= 0.0 {
        0
    } else if mbps >= 40.0 && rtt_ms <= 15.0 {
        3
    } else if mbps >= 5.0 && rtt_ms <= 40.0 {
        2
    } else {
        1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn vetores(nome: &str) -> Value {
        let p = concat!(env!("CARGO_MANIFEST_DIR"), "/../../protocolo/vetores/");
        serde_json::from_str(&std::fs::read_to_string(format!("{p}{nome}")).unwrap()).unwrap()
    }

    fn hex(s: &str) -> Vec<u8> {
        (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect()
    }

    fn como_json(m: &Mensagem) -> Value {
        match m {
            Mensagem::Controle(v) => json!({"tipo":"controle","json":v}),
            Mensagem::Toque { seq, contatos } => json!({"tipo":"toque","seq":seq,"contatos":
                contatos.iter().map(|c| json!({"id":c.id,"x":c.x,"y":c.y,"major":c.major})).collect::<Vec<_>>()}),
            Mensagem::Ping { nonce, t_us } => json!({"tipo":"ping","nonce":nonce,"t_us":t_us}),
            Mensagem::Caneta { seq, x, y, pressao, marcas } => json!({"tipo":"caneta","seq":seq,"x":x,"y":y,"pressao":pressao,"marcas":marcas}),
            Mensagem::Pong { nonce, t_us } => json!({"tipo":"pong","nonce":nonce,"t_us":t_us}),
            Mensagem::Carga(d) => json!({"tipo":"carga","bytes":d.len()}),
            Mensagem::Video { pts_us, marcas, dados } => json!({"tipo":"video","pts_us":pts_us,"marcas":marcas,"bytes":dados.len()}),
            Mensagem::Camera { pts_us, marcas, dados } => json!({"tipo":"camera","pts_us":pts_us,"marcas":marcas,"bytes":dados.len()}),
            Mensagem::Audio { pts_us, dados } => json!({"tipo":"audio","pts_us":pts_us,"bytes":dados.len()}),
        }
    }

    #[test]
    fn vetores_validos_decodificam_e_voltam_iguais() {
        let v = vetores("enquadramento.json");
        for caso in v["validos"].as_array().unwrap() {
            let bytes = hex(caso["hex"].as_str().unwrap());
            let m = ler(&mut bytes.as_slice(), MAX_CONTROLE_CELULAR).unwrap().unwrap();
            assert_eq!(como_json(&m), caso["esperado"], "{}", caso["nome"]);
            // JSON não tem ordem de campos garantida: o binário volta byte a byte, o
            // controle volta com o mesmo conteúdo.
            let volta = codificar(&m).unwrap();
            if matches!(m, Mensagem::Controle(_)) {
                assert_eq!(ler(&mut volta.as_slice(), MAX_CONTROLE_CELULAR).unwrap().unwrap(), m);
            } else {
                assert_eq!(volta, bytes, "recodificar: {}", caso["nome"]);
            }
        }
    }

    #[test]
    fn vetores_invalidos_sao_recusados() {
        let v = vetores("enquadramento.json");
        for caso in v["invalidos"].as_array().unwrap() {
            let bytes = hex(caso["hex"].as_str().unwrap());
            let r = ler(&mut bytes.as_slice(), MAX_CONTROLE_CELULAR);
            assert!(r.is_err(), "deveria recusar: {}", caso["nome"]);
        }
    }

    #[test]
    fn regra_de_nivel() {
        let v = vetores("nivel.json");
        for caso in v["casos"].as_array().unwrap() {
            let n = nivel_de(caso["mbps"].as_f64().unwrap(), caso["rtt_ms"].as_f64().unwrap());
            assert_eq!(n as u64, caso["n"].as_u64().unwrap(), "{caso}");
        }
    }

    #[test]
    fn fim_entre_mensagens_e_none() {
        assert!(ler(&mut [].as_slice(), 100).unwrap().is_none());
    }

    #[test]
    fn controle_grande_demais_e_recusado() {
        let grande = json!({"t":"texto","s":"x".repeat(MAX_CONTROLE_CELULAR)});
        let b = codificar(&controle(grande)).unwrap();
        assert!(ler(&mut b.as_slice(), MAX_CONTROLE_CELULAR).is_err());
    }
}
