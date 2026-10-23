//! Biblioteca de atalhos: o que cada ação faz no computador. Portada de `src/dados/atalhos.ts`.
//! Lista fechada: o celular só pede um `id` daqui (ou `volume`), nunca um comando.
//! As teclas usam o vocabulário do protocolo (`teclas.rs`): `mod` vira `ctrl` (Linux).

/// O que o atalho faz: aperta teclas (em ordem, solta ao contrário) ou clica com o botão direito.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Gesto {
    Teclas(&'static [&'static str]),
    CliqueDireito,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Atalho {
    pub id: &'static str,
    pub rotulo: &'static str,
    pub icone: &'static str,
    pub gesto: Gesto,
}

pub const ATALHOS: &[Atalho] = &[
    Atalho { id: "cliqueDireito", rotulo: "Clique direito", icone: "clique", gesto: Gesto::CliqueDireito },
    Atalho { id: "copiar", rotulo: "Copiar", icone: "copiar", gesto: Gesto::Teclas(&["ctrl", "c"]) },
    Atalho { id: "colar", rotulo: "Colar", icone: "colar", gesto: Gesto::Teclas(&["ctrl", "v"]) },
    Atalho { id: "desfazer", rotulo: "Desfazer", icone: "desfazer", gesto: Gesto::Teclas(&["ctrl", "z"]) },
    Atalho { id: "refazer", rotulo: "Refazer", icone: "refazer", gesto: Gesto::Teclas(&["ctrl", "shift", "z"]) },
    Atalho { id: "alttab", rotulo: "Trocar janela", icone: "trocar", gesto: Gesto::Teclas(&["alt", "tab"]) },
    Atalho { id: "areas", rotulo: "Áreas de trabalho", icone: "areas", gesto: Gesto::Teclas(&["super"]) },
    Atalho { id: "maximizar", rotulo: "Maximizar", icone: "maximizar", gesto: Gesto::Teclas(&["super", "cima"]) },
    Atalho { id: "captura", rotulo: "Captura de tela", icone: "captura", gesto: Gesto::Teclas(&["print"]) },
    Atalho { id: "novaAba", rotulo: "Nova aba", icone: "mais", gesto: Gesto::Teclas(&["ctrl", "t"]) },
    Atalho { id: "fecharAba", rotulo: "Fechar aba", icone: "fechar", gesto: Gesto::Teclas(&["ctrl", "w"]) },
    Atalho { id: "recarregar", rotulo: "Recarregar", icone: "recarregar", gesto: Gesto::Teclas(&["ctrl", "r"]) },
    Atalho { id: "terminal", rotulo: "Terminal", icone: "terminal", gesto: Gesto::Teclas(&["ctrl", "crase"]) },
    Atalho { id: "buscarArquivo", rotulo: "Abrir arquivo", icone: "buscar", gesto: Gesto::Teclas(&["ctrl", "p"]) },
    Atalho { id: "comentar", rotulo: "Comentar linha", icone: "comentar", gesto: Gesto::Teclas(&["ctrl", "barra"]) },
    Atalho { id: "formatar", rotulo: "Formatar", icone: "formatar", gesto: Gesto::Teclas(&["shift", "alt", "f"]) },
    Atalho { id: "frame", rotulo: "Frame", icone: "frame", gesto: Gesto::Teclas(&["f"]) },
    Atalho { id: "componente", rotulo: "Componente", icone: "componente", gesto: Gesto::Teclas(&["ctrl", "alt", "k"]) },
    Atalho { id: "agrupar", rotulo: "Agrupar", icone: "agrupar", gesto: Gesto::Teclas(&["ctrl", "g"]) },
    Atalho { id: "zoomAjustar", rotulo: "Ajustar zoom", icone: "zoom", gesto: Gesto::Teclas(&["shift", "1"]) },
    Atalho { id: "play", rotulo: "Tocar / pausar", icone: "play", gesto: Gesto::Teclas(&["espaco"]) },
    Atalho { id: "proxima", rotulo: "Próxima", icone: "proxima", gesto: Gesto::Teclas(&["ctrl", "direita"]) },
    Atalho { id: "curtir", rotulo: "Curtir", icone: "curtir", gesto: Gesto::Teclas(&["alt", "shift", "b"]) },
    Atalho { id: "gravar", rotulo: "Gravar", icone: "gravar", gesto: Gesto::Teclas(&["ctrl", "shift", "r"]) },
    Atalho { id: "cena1", rotulo: "Cena 1", icone: "cena", gesto: Gesto::Teclas(&["f13"]) },
    Atalho { id: "cena2", rotulo: "Cena 2", icone: "cena", gesto: Gesto::Teclas(&["f14"]) },
    Atalho { id: "cortar", rotulo: "Cortar no cursor", icone: "cortar", gesto: Gesto::Teclas(&["ctrl", "b"]) },
    Atalho { id: "marcar", rotulo: "Marcador", icone: "marcador", gesto: Gesto::Teclas(&["m"]) },
    Atalho { id: "mudo", rotulo: "Microfone", icone: "microfone", gesto: Gesto::Teclas(&["ctrl", "d"]) },
    Atalho { id: "camera", rotulo: "Câmera", icone: "camera", gesto: Gesto::Teclas(&["ctrl", "e"]) },
    Atalho { id: "mao", rotulo: "Levantar a mão", icone: "mao", gesto: Gesto::Teclas(&["ctrl", "alt", "h"]) },
    Atalho { id: "sair", rotulo: "Sair da chamada", icone: "sair", gesto: Gesto::Teclas(&["ctrl", "alt", "q"]) },
    Atalho { id: "renomear", rotulo: "Renomear", icone: "renomear", gesto: Gesto::Teclas(&["f2"]) },
    Atalho { id: "novaPasta", rotulo: "Nova pasta", icone: "pasta", gesto: Gesto::Teclas(&["ctrl", "shift", "n"]) },
];

/// Perfis prontos: os atalhos que aparecem quando cada app está em foco.
pub const PERFIS: &[(&str, &[&str])] = &[
    ("area", &["copiar", "colar", "alttab", "areas", "maximizar", "captura", "desfazer", "refazer"]),
    ("firefox", &["novaAba", "fecharAba", "recarregar", "alttab", "copiar", "colar", "captura", "areas"]),
    ("vscode", &["buscarArquivo", "terminal", "comentar", "formatar", "copiar", "colar", "desfazer", "refazer"]),
    ("figma", &["frame", "componente", "agrupar", "zoomAjustar", "copiar", "colar", "desfazer", "refazer"]),
    ("spotify", &["play", "proxima", "curtir", "alttab", "areas", "captura", "copiar", "colar"]),
    ("obs", &["gravar", "cena1", "cena2", "mudo", "captura", "alttab", "areas", "maximizar"]),
    ("discord", &["mudo", "camera", "alttab", "copiar", "colar", "captura", "areas", "maximizar"]),
    ("davinci", &["cortar", "marcar", "play", "desfazer", "refazer", "copiar", "colar", "zoomAjustar"]),
    ("meet", &["mudo", "camera", "mao", "sair", "alttab", "captura", "areas", "maximizar"]),
    ("arquivos", &["renomear", "novaPasta", "copiar", "colar", "desfazer", "alttab", "areas", "captura"]),
];

/// Atalho da biblioteca com este id.
pub fn buscar(id: &str) -> Option<&'static Atalho> {
    ATALHOS.iter().find(|a| a.id == id)
}

/// Ids dos atalhos do perfil de um app.
pub fn perfil(app: &str) -> Option<&'static [&'static str]> {
    PERFIS.iter().find(|(a, _)| *a == app).map(|(_, ids)| *ids)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::teclas;

    #[test]
    fn toda_tecla_da_biblioteca_existe_no_protocolo() {
        for a in ATALHOS {
            match a.gesto {
                Gesto::Teclas(nomes) => {
                    assert!(!nomes.is_empty(), "{}", a.id);
                    for n in nomes {
                        assert!(teclas::codigo(n).is_some(), "{}: tecla {n}", a.id);
                    }
                }
                Gesto::CliqueDireito => assert_eq!(a.id, "cliqueDireito"),
            }
        }
    }

    #[test]
    fn ids_sao_unicos_e_perfis_so_citam_a_biblioteca() {
        for (i, a) in ATALHOS.iter().enumerate() {
            assert!(!ATALHOS[..i].iter().any(|b| b.id == a.id), "{}", a.id);
        }
        for (app, ids) in PERFIS {
            for id in *ids {
                assert!(buscar(id).is_some(), "perfil {app}: {id}");
            }
        }
        assert_eq!(perfil("area").map(|ids| ids.len()), Some(8));
    }
}
