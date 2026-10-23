//! Nomes de tecla do protocolo → códigos do Linux. Lista fechada: nome fora dela é recusado.

use evdev::KeyCode;

pub fn codigo(nome: &str) -> Option<KeyCode> {
    use KeyCode as K;
    let k = match nome {
        "a" => K::KEY_A, "b" => K::KEY_B, "c" => K::KEY_C, "d" => K::KEY_D, "e" => K::KEY_E,
        "f" => K::KEY_F, "g" => K::KEY_G, "h" => K::KEY_H, "i" => K::KEY_I, "j" => K::KEY_J,
        "k" => K::KEY_K, "l" => K::KEY_L, "m" => K::KEY_M, "n" => K::KEY_N, "o" => K::KEY_O,
        "p" => K::KEY_P, "q" => K::KEY_Q, "r" => K::KEY_R, "s" => K::KEY_S, "t" => K::KEY_T,
        "u" => K::KEY_U, "v" => K::KEY_V, "w" => K::KEY_W, "x" => K::KEY_X, "y" => K::KEY_Y,
        "z" => K::KEY_Z,
        "0" => K::KEY_0, "1" => K::KEY_1, "2" => K::KEY_2, "3" => K::KEY_3, "4" => K::KEY_4,
        "5" => K::KEY_5, "6" => K::KEY_6, "7" => K::KEY_7, "8" => K::KEY_8, "9" => K::KEY_9,
        "f1" => K::KEY_F1, "f2" => K::KEY_F2, "f3" => K::KEY_F3, "f4" => K::KEY_F4,
        "f5" => K::KEY_F5, "f6" => K::KEY_F6, "f7" => K::KEY_F7, "f8" => K::KEY_F8,
        "f9" => K::KEY_F9, "f10" => K::KEY_F10, "f11" => K::KEY_F11, "f12" => K::KEY_F12,
        "ctrl" => K::KEY_LEFTCTRL, "shift" => K::KEY_LEFTSHIFT, "alt" => K::KEY_LEFTALT,
        "super" => K::KEY_LEFTMETA, "altgr" => K::KEY_RIGHTALT,
        "enter" => K::KEY_ENTER, "esc" => K::KEY_ESC, "tab" => K::KEY_TAB, "espaco" => K::KEY_SPACE,
        "apagar" => K::KEY_BACKSPACE, "delete" => K::KEY_DELETE,
        "cima" => K::KEY_UP, "baixo" => K::KEY_DOWN, "esquerda" => K::KEY_LEFT, "direita" => K::KEY_RIGHT,
        "inicio" => K::KEY_HOME, "fim" => K::KEY_END, "pgcima" => K::KEY_PAGEUP, "pgbaixo" => K::KEY_PAGEDOWN,
        "menos" => K::KEY_MINUS, "igual" => K::KEY_EQUAL, "virgula" => K::KEY_COMMA, "ponto" => K::KEY_DOT,
        "barra" => K::KEY_SLASH, "ponto_virgula" => K::KEY_SEMICOLON, "aspas" => K::KEY_APOSTROPHE,
        "colchete_abre" => K::KEY_LEFTBRACE, "colchete_fecha" => K::KEY_RIGHTBRACE,
        "contrabarra" => K::KEY_BACKSLASH, "crase" => K::KEY_GRAVE,
        "volume_mais" => K::KEY_VOLUMEUP, "volume_menos" => K::KEY_VOLUMEDOWN, "mudo" => K::KEY_MUTE,
        "tocar_pausar" => K::KEY_PLAYPAUSE, "proxima" => K::KEY_NEXTSONG, "anterior" => K::KEY_PREVIOUSSONG,
        "print" => K::KEY_SYSRQ,
        _ => return None,
    };
    Some(k)
}

/// Todos os códigos que o teclado virtual declara.
pub fn todos() -> Vec<KeyCode> {
    NOMES.iter().filter_map(|n| codigo(n)).collect()
}

pub const NOMES: &[&str] = &[
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t",
    "u", "v", "w", "x", "y", "z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "f1", "f2", "f3",
    "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12", "ctrl", "shift", "alt", "super", "altgr",
    "enter", "esc", "tab", "espaco", "apagar", "delete", "cima", "baixo", "esquerda", "direita",
    "inicio", "fim", "pgcima", "pgbaixo", "menos", "igual", "virgula", "ponto", "barra",
    "ponto_virgula", "aspas", "colchete_abre", "colchete_fecha", "contrabarra", "crase",
    "volume_mais", "volume_menos", "mudo", "tocar_pausar", "proxima", "anterior", "print",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn todo_nome_da_lista_tem_codigo() {
        for n in NOMES {
            assert!(codigo(n).is_some(), "{n}");
        }
        assert!(codigo("rm -rf").is_none());
    }
}
