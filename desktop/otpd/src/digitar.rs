//! Texto → sequência de teclas no layout do teclado do usuário.
//!
//! O teclado virtual manda códigos de tecla, não letras: qual letra sai depende do layout
//! ativo no sistema. Então o texto é traduzido com o mesmo mapa de teclas (xkbcommon):
//! para cada caractere, acha a tecla e o nível (Shift, AltGr) que o produzem; se não
//! houver tecla direta, compõe com tecla morta (´ ` ~ ^ ¨ ¸ + letra), como no US
//! internacional e no ABNT2. Caractere sem caminho é pulado e registrado.

use evdev::KeyCode;
use xkbcommon::xkb;

/// Um toque: modificadores segurados + a tecla.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Toque {
    pub modificadores: Vec<KeyCode>,
    pub tecla: KeyCode,
}

pub struct Digitador {
    /// keysym → toque mais simples que o produz.
    mapa: std::collections::HashMap<u32, Toque>,
    pub layout: String,
}

/// Layout ativo: `~/.config/kxkbrc` (KDE) ou `XKB_DEFAULT_LAYOUT`, senão `us`.
pub fn layout_do_sistema() -> (String, String) {
    let kxkb = std::env::var_os("HOME")
        .map(|h| std::path::PathBuf::from(h).join(".config/kxkbrc"))
        .and_then(|p| std::fs::read_to_string(p).ok())
        .unwrap_or_default();
    let campo = |nome: &str| {
        kxkb.lines()
            .find_map(|l| l.strip_prefix(&format!("{nome}=")))
            .and_then(|v| v.split(',').next())
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(String::from)
    };
    let layout = campo("LayoutList").or_else(|| std::env::var("XKB_DEFAULT_LAYOUT").ok()).unwrap_or_else(|| "us".into());
    let variante = campo("VariantList").or_else(|| std::env::var("XKB_DEFAULT_VARIANT").ok()).unwrap_or_default();
    (layout, variante)
}

impl Digitador {
    pub fn do_sistema() -> Option<Self> {
        let (l, v) = layout_do_sistema();
        Self::novo(&l, &v)
    }

    pub fn novo(layout: &str, variante: &str) -> Option<Self> {
        let ctx = xkb::Context::new(xkb::CONTEXT_NO_FLAGS);
        let keymap = xkb::Keymap::new_from_names(&ctx, "evdev", "pc105", layout, variante, None, xkb::COMPILE_NO_FLAGS)?;
        let mut mapa = std::collections::HashMap::new();
        let (min, max) = (keymap.min_keycode().raw(), keymap.max_keycode().raw());
        // Nível 0 primeiro: a forma mais simples de produzir cada símbolo ganha.
        for nivel in 0..4u32 {
            for kc in min..=max.min(255 + 8) {
                let k = xkb::Keycode::new(kc);
                if nivel >= keymap.num_levels_for_key(k, 0) {
                    continue;
                }
                for sym in keymap.key_get_syms_by_level(k, 0, nivel) {
                    mapa.entry(sym.raw()).or_insert_with(|| Toque {
                        modificadores: modificadores_do_nivel(nivel),
                        // evdev = xkb - 8
                        tecla: KeyCode::new((kc - 8) as u16),
                    });
                }
            }
        }
        Some(Self { mapa, layout: if variante.is_empty() { layout.into() } else { format!("{layout}({variante})") } })
    }

    /// Toques para digitar `texto`. Devolve também o que não deu para digitar.
    pub fn traduzir(&self, texto: &str) -> (Vec<Toque>, Vec<char>) {
        let mut toques = Vec::new();
        let mut faltou = Vec::new();
        for c in texto.chars() {
            match self.caractere(c) {
                Some(mut t) => toques.append(&mut t),
                None => faltou.push(c),
            }
        }
        (toques, faltou)
    }

    fn caractere(&self, c: char) -> Option<Vec<Toque>> {
        let sym = match c {
            '\n' => xkb::keysyms::KEY_Return,
            '\t' => xkb::keysyms::KEY_Tab,
            _ => xkb::utf32_to_keysym(c as u32).raw(),
        };
        if let Some(t) = self.mapa.get(&sym) {
            return Some(vec![t.clone()]);
        }
        // Sem tecla direta: tecla morta + letra base.
        let (base, morta) = decompor(c)?;
        let morta = self.mapa.get(&morta)?;
        let base = self.mapa.get(&xkb::utf32_to_keysym(base as u32).raw())?;
        Some(vec![morta.clone(), base.clone()])
    }
}

/// Nível do xkb → modificadores (layouts de quatro níveis: 1 Shift, 2 AltGr, 3 os dois).
fn modificadores_do_nivel(nivel: u32) -> Vec<KeyCode> {
    match nivel {
        1 => vec![KeyCode::KEY_LEFTSHIFT],
        2 => vec![KeyCode::KEY_RIGHTALT],
        3 => vec![KeyCode::KEY_RIGHTALT, KeyCode::KEY_LEFTSHIFT],
        _ => vec![],
    }
}

/// Letra acentuada → (base, tecla morta). Cobre o português e o espanhol.
fn decompor(c: char) -> Option<(char, u32)> {
    use xkb::keysyms::*;
    let (agudo, grave, til, circ, trema, cedilha) =
        (KEY_dead_acute, KEY_dead_grave, KEY_dead_tilde, KEY_dead_circumflex, KEY_dead_diaeresis, KEY_dead_cedilla);
    let r = match c {
        'á' => ('a', agudo), 'é' => ('e', agudo), 'í' => ('i', agudo), 'ó' => ('o', agudo), 'ú' => ('u', agudo), 'ý' => ('y', agudo),
        'Á' => ('A', agudo), 'É' => ('E', agudo), 'Í' => ('I', agudo), 'Ó' => ('O', agudo), 'Ú' => ('U', agudo),
        'à' => ('a', grave), 'è' => ('e', grave), 'ì' => ('i', grave), 'ò' => ('o', grave), 'ù' => ('u', grave),
        'À' => ('A', grave), 'È' => ('E', grave), 'Ò' => ('O', grave),
        'ã' => ('a', til), 'õ' => ('o', til), 'ñ' => ('n', til), 'Ã' => ('A', til), 'Õ' => ('O', til), 'Ñ' => ('N', til),
        'â' => ('a', circ), 'ê' => ('e', circ), 'î' => ('i', circ), 'ô' => ('o', circ), 'û' => ('u', circ),
        'Â' => ('A', circ), 'Ê' => ('E', circ), 'Ô' => ('O', circ),
        'ä' => ('a', trema), 'ë' => ('e', trema), 'ï' => ('i', trema), 'ö' => ('o', trema), 'ü' => ('u', trema),
        'Ü' => ('U', trema),
        'ç' => ('c', cedilha), 'Ç' => ('C', cedilha),
        _ => return None,
    };
    Some(r)
}

/// Extensão da sessão que trata `{"t":"texto","s":...}` (teclado do celular, ditado).
pub struct ExtensaoTexto {
    saida: crate::sessao::SaidaCompartilhada,
    digitador: std::sync::Arc<Digitador>,
}

impl ExtensaoTexto {
    pub fn nova(saida: crate::sessao::SaidaCompartilhada, digitador: std::sync::Arc<Digitador>) -> Self {
        Self { saida, digitador }
    }
}

/// Limite do protocolo para uma mensagem `texto`.
pub const MAX_CARACTERES: usize = 1000;

impl crate::sessao::Extensao for ExtensaoTexto {
    fn controle(&mut self, t: &str, msg: &serde_json::Value, _r: &mut Vec<crate::protocolo::Mensagem>) -> bool {
        if t != "texto" {
            return false;
        }
        let texto: String = msg["s"].as_str().unwrap_or_default().chars().take(MAX_CARACTERES).collect();
        let (toques, faltou) = self.digitador.traduzir(&texto);
        if !faltou.is_empty() {
            eprintln!("texto: sem tecla para {faltou:?} no layout {}", self.digitador.layout);
        }
        let mut saida = self.saida.lock().unwrap();
        for t in toques {
            for m in &t.modificadores {
                let _ = saida.tecla(*m, true);
            }
            let _ = saida.tecla(t.tecla, true);
            let _ = saida.tecla(t.tecla, false);
            for m in t.modificadores.iter().rev() {
                let _ = saida.tecla(*m, false);
            }
        }
        true
    }
}

/// Todos os códigos de tecla que o teclado virtual precisa declarar para digitar qualquer coisa.
pub fn todas_as_teclas() -> impl Iterator<Item = KeyCode> {
    (1u16..=248).map(KeyCode::new)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(layout: &str, variante: &str) -> Digitador {
        Digitador::novo(layout, variante).expect("o sistema tem os mapas do xkb")
    }

    #[test]
    fn letras_e_maiusculas_no_us() {
        let d = d("us", "");
        let (t, faltou) = d.traduzir("aB");
        assert!(faltou.is_empty());
        assert_eq!(t[0], Toque { modificadores: vec![], tecla: KeyCode::KEY_A });
        assert_eq!(t[1], Toque { modificadores: vec![KeyCode::KEY_LEFTSHIFT], tecla: KeyCode::KEY_B });
    }

    #[test]
    fn us_internacional_acento_direto_e_composto() {
        let d = d("us", "intl");
        // á tem tecla direta (AltGr+a); ã só por tecla morta (~ e a).
        let (t, faltou) = d.traduzir("áã");
        assert!(faltou.is_empty(), "{faltou:?}");
        assert_eq!(t[0].modificadores, vec![KeyCode::KEY_RIGHTALT]);
        assert_eq!(t.len(), 3);
        // Apóstrofo no intl é tecla morta no nível 0; o apóstrofo de verdade vem com AltGr.
        let (t, _) = d.traduzir("'");
        assert_eq!(t[0].modificadores, vec![KeyCode::KEY_RIGHTALT]);
    }

    #[test]
    fn abnt2_cedilha_direto() {
        let d = d("br", "");
        let (t, faltou) = d.traduzir("ção");
        assert!(faltou.is_empty(), "{faltou:?}");
        assert_eq!(t[0], Toque { modificadores: vec![], tecla: KeyCode::KEY_SEMICOLON });
    }

    #[test]
    fn extensao_digita_com_modificadores() {
        use crate::sessao::Extensao;
        let reg = crate::saida::Registro::novo();
        let saida: crate::sessao::SaidaCompartilhada = std::sync::Arc::new(std::sync::Mutex::new(Box::new(reg.clone())));
        let mut e = ExtensaoTexto::nova(saida, std::sync::Arc::new(d("us", "")));
        assert!(e.controle("texto", &serde_json::json!({"t":"texto","s":"A"}), &mut vec![]));
        assert_eq!(reg.linhas(), vec![
            "tecla KEY_LEFTSHIFT aperta", "tecla KEY_A aperta", "tecla KEY_A solta", "tecla KEY_LEFTSHIFT solta",
        ]);
        assert!(!e.controle("outra", &serde_json::json!({}), &mut vec![]));
    }

    #[test]
    fn emoji_nao_tem_caminho() {
        let (_, faltou) = d("us", "").traduzir("a🙂");
        assert_eq!(faltou, vec!['🙂']);
    }
}
