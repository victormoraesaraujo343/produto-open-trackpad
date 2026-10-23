//! App em foco no computador (KDE Plasma 6 no Wayland). Só o KWin sabe qual janela está ativa:
//! um script dele chama este serviço D-Bus a cada troca de janela, e o serviço espalha um
//! `Evento::novo("foco", ..)` para as sessões abertas (o `Painel` troca as laterais).

use serde_json::json;
use tokio::sync::broadcast;
use zbus::{connection, interface, Connection, Proxy};

use crate::sessao::Evento;

const NOME: &str = "org.opentrackpad.Foco";
const CAMINHO: &str = "/foco";
const SCRIPT_NOME: &str = "opentrackpad-foco";
const TITULO_MAX: usize = 80;

/// Script carregado no KWin. Avisa o serviço a cada janela ativada; `null` não é avisado.
const SCRIPT_KWIN: &str = r#"
// Gerado pelo OpenTrackpad (desktop/otpd/src/foco.rs): avisa a janela em foco ao serviço.
function avisar(janela) {
    if (!janela) {
        return;
    }
    callDBus("org.opentrackpad.Foco", "/foco", "org.opentrackpad.Foco", "Ativou",
             String(janela.resourceClass), String(janela.caption));
}
workspace.windowActivated.connect(avisar);
avisar(workspace.activeWindow);
"#;

/// Objeto `/foco` da interface `org.opentrackpad.Foco`.
struct Foco {
    eventos: broadcast::Sender<Evento>,
}

#[interface(name = "org.opentrackpad.Foco")]
impl Foco {
    /// Chamado pelo script do KWin: `app` é a classe da janela, `titulo` a legenda.
    async fn ativou(&self, app: String, titulo: String) {
        let titulo: String = titulo.chars().take(TITULO_MAX).collect();
        let evento = Evento::novo("foco", json!({"app": app.to_lowercase(), "titulo": titulo}));
        // Sem sessão aberta ninguém ouve: não é erro.
        let _ = self.eventos.send(evento);
    }
}

/// Registra `org.opentrackpad.Foco` na sessão e carrega o script no KWin. A conexão tem de
/// ficar viva enquanto o serviço for necessário (quem chama guarda).
pub async fn iniciar(eventos: broadcast::Sender<Evento>) -> Result<Connection, String> {
    let conexao = connection::Builder::session()
        .map_err(|e| format!("D-Bus da sessão: {e}"))?
        .name(NOME)
        .map_err(|e| format!("nome {NOME}: {e}"))?
        .serve_at(CAMINHO, Foco { eventos })
        .map_err(|e| format!("objeto {CAMINHO}: {e}"))?
        .build()
        .await
        .map_err(|e| format!("serviço de foco: {e}"))?;
    carregar_script(&conexao).await?;
    Ok(conexao)
}

async fn carregar_script(conexao: &Connection) -> Result<(), String> {
    let pasta = std::env::var_os("XDG_RUNTIME_DIR").ok_or("XDG_RUNTIME_DIR não definido")?;
    let caminho = std::path::PathBuf::from(pasta).join(format!("{SCRIPT_NOME}.js"));
    std::fs::write(&caminho, SCRIPT_KWIN).map_err(|e| format!("gravar {}: {e}", caminho.display()))?;
    let caminho = caminho.to_str().ok_or("caminho do script não é UTF-8")?;

    let kwin = Proxy::new(conexao, "org.kde.KWin", "/Scripting", "org.kde.kwin.Scripting")
        .await
        .map_err(|e| format!("KWin Scripting: {e}"))?;
    // Um script com este nome pode ter sobrado de outra execução: descarrega antes de carregar.
    let _: bool = kwin.call("unloadScript", &(SCRIPT_NOME,)).await.map_err(|e| format!("unloadScript: {e}"))?;
    let id: i32 = kwin.call("loadScript", &(caminho, SCRIPT_NOME)).await.map_err(|e| format!("loadScript: {e}"))?;
    if id < 0 {
        return Err(format!("KWin recusou o script {SCRIPT_NOME} (id {id})"));
    }
    let script = Proxy::new(conexao, "org.kde.KWin", format!("/Scripting/Script{id}"), "org.kde.kwin.Script")
        .await
        .map_err(|e| format!("script {id}: {e}"))?;
    script.call::<_, _, ()>("run", &()).await.map_err(|e| format!("run: {e}"))?;
    Ok(())
}

/// Perfil de atalhos (`atalhos::PERFIS`) para a classe de janela do app em foco.
pub fn perfil_do_app(resource_class: &str) -> &'static str {
    match resource_class.to_ascii_lowercase().as_str() {
        "firefox" | "org.mozilla.firefox" | "chromium" | "google-chrome" | "brave-browser" => "firefox",
        "code" | "code-oss" | "codium" | "vscodium" => "vscode",
        "figma-linux" => "figma",
        "spotify" => "spotify",
        "com.obsproject.studio" | "obs" => "obs",
        "discord" | "vesktop" => "discord",
        "resolve" => "davinci",
        "org.kde.dolphin" | "dolphin" | "org.gnome.nautilus" => "arquivos",
        _ => "area",
    }
}

/// Nome e ícone de um perfil, como aparecem no celular. Perfil desconhecido: área de trabalho.
pub fn nome_do_perfil(perfil: &str) -> (&'static str, &'static str) {
    match perfil {
        "firefox" => ("Firefox", "globo"),
        "vscode" => ("VS Code", "codigo"),
        "figma" => ("Figma", "frame"),
        "spotify" => ("Spotify", "musica"),
        "obs" => ("OBS", "gravar"),
        "discord" => ("Discord", "bolha"),
        "davinci" => ("DaVinci", "filme"),
        "arquivos" => ("Arquivos", "pasta"),
        _ => ("Área de trabalho", "computador"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn classes_conhecidas_viram_perfis() {
        assert_eq!(perfil_do_app("firefox"), "firefox");
        assert_eq!(perfil_do_app("Google-Chrome"), "firefox");
        assert_eq!(perfil_do_app("code"), "vscode");
        assert_eq!(perfil_do_app("figma-linux"), "figma");
        assert_eq!(perfil_do_app("com.obsproject.studio"), "obs");
        assert_eq!(perfil_do_app("vesktop"), "discord");
        assert_eq!(perfil_do_app("resolve"), "davinci");
        assert_eq!(perfil_do_app("org.kde.dolphin"), "arquivos");
        assert_eq!(perfil_do_app("xterm"), "area");
        assert_eq!(perfil_do_app(""), "area");
    }

    #[test]
    fn todo_perfil_tem_nome_e_icone() {
        for (perfil, _) in crate::atalhos::PERFIS {
            let (nome, icone) = nome_do_perfil(perfil);
            assert!(!nome.is_empty() && !icone.is_empty(), "{perfil}");
        }
        assert_eq!(nome_do_perfil("area"), ("Área de trabalho", "computador"));
        assert_eq!(nome_do_perfil("nada"), ("Área de trabalho", "computador"));
    }

    /// Precisa de uma sessão Plasma com KWin. Imprime os eventos de foco por 3 s.
    #[tokio::test]
    #[ignore = "precisa do KWin rodando nesta sessão"]
    async fn foco_real() {
        let (tx, mut rx) = broadcast::channel(64);
        let conexao = iniciar(tx).await.expect("iniciar o serviço de foco");
        println!("serviço de foco e script carregados sem erro");
        let fim = tokio::time::Instant::now() + Duration::from_secs(3);
        loop {
            match tokio::time::timeout_at(fim, rx.recv()).await {
                Ok(Ok(e)) => println!("evento: {e:?}"),
                Ok(Err(broadcast::error::RecvError::Lagged(_))) => continue,
                _ => break,
            }
        }
        drop(conexao);
    }
}
