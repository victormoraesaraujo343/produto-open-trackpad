//! Portal ScreenCast (xdg-desktop-portal): pede ao sistema para ver a tela e devolve o nó do
//! PipeWire. O KDE mostra um diálogo para escolher a tela na primeira vez; com o
//! `restore_token` guardado, as próximas vezes não perguntam.
//!
//! Fluxo do portal: CreateSession → SelectSources → Start (diálogo) → OpenPipeWireRemote.
//! Cada passo responde por um sinal `Response` num objeto de pedido próprio.

use std::collections::HashMap;
use std::os::fd::{AsRawFd, OwnedFd};

use futures_util::StreamExt;
use zbus::zvariant::{OwnedObjectPath, OwnedValue, Value};

const DESTINO: &str = "org.freedesktop.portal.Desktop";
const CAMINHO: &str = "/org/freedesktop/portal/desktop";
const INTERFACE: &str = "org.freedesktop.portal.ScreenCast";

/// Tela liberada: o descritor do PipeWire, o nó, o tamanho e a conexão que mantém a sessão
/// viva (soltar a conexão encerra a captura).
pub struct TelaLiberada {
    pub fd: OwnedFd,
    pub no: u32,
    pub tamanho: Option<(u32, u32)>,
    pub _conexao: zbus::Connection,
}

impl TelaLiberada {
    pub fn fd_bruto(&self) -> i32 {
        self.fd.as_raw_fd()
    }
}

fn arquivo_do_token() -> std::path::PathBuf {
    crate::pareamento::config_dir().join("portal-token")
}

/// `types`: 1 = monitor, 4 = virtual (segundo monitor).
pub async fn pedir(tipos: u32) -> Result<TelaLiberada, String> {
    let conn = zbus::Connection::session().await.map_err(|e| format!("D-Bus: {e}"))?;
    let portal = zbus::Proxy::new(&conn, DESTINO, CAMINHO, INTERFACE).await.map_err(|e| e.to_string())?;
    let remetente = conn.unique_name().map(|n| n.trim_start_matches(':').replace('.', "_")).ok_or("sem nome no D-Bus")?;
    let sufixo = format!("{:08x}", u32::from_le_bytes(crate::pareamento::aleatorio::<4>()));

    // 1. Sessão.
    let mut op: HashMap<&str, Value> = HashMap::new();
    op.insert("handle_token", Value::from(format!("otpc{sufixo}")));
    op.insert("session_handle_token", Value::from(format!("otps{sufixo}")));
    let r = pedido(&conn, &portal, &remetente, &format!("otpc{sufixo}"), "CreateSession", &(op,)).await?;
    let sessao: String = r.get("session_handle").and_then(|v| String::try_from(v.clone()).ok()).ok_or("sessão sem nome")?;
    let sessao = OwnedObjectPath::try_from(sessao).map_err(|e| e.to_string())?;

    // 2. O que capturar: monitor, cursor desenhado na imagem, e lembrar a escolha.
    let mut op: HashMap<&str, Value> = HashMap::new();
    op.insert("handle_token", Value::from(format!("otpf{sufixo}")));
    op.insert("types", Value::from(tipos));
    op.insert("multiple", Value::from(false));
    op.insert("cursor_mode", Value::from(2u32));
    op.insert("persist_mode", Value::from(2u32));
    if let Ok(token) = std::fs::read_to_string(arquivo_do_token()) {
        if !token.trim().is_empty() {
            op.insert("restore_token", Value::from(token.trim().to_owned()));
        }
    }
    pedido(&conn, &portal, &remetente, &format!("otpf{sufixo}"), "SelectSources", &(&sessao, op)).await?;

    // 3. Começar (aqui o sistema pode mostrar o diálogo).
    let mut op: HashMap<&str, Value> = HashMap::new();
    op.insert("handle_token", Value::from(format!("otpi{sufixo}")));
    let r = pedido(&conn, &portal, &remetente, &format!("otpi{sufixo}"), "Start", &(&sessao, "", op)).await?;
    if let Some(token) = r.get("restore_token").and_then(|v| String::try_from(v.clone()).ok()) {
        let _ = std::fs::create_dir_all(crate::pareamento::config_dir());
        let _ = std::fs::write(arquivo_do_token(), token);
    }
    let fluxos = r.get("streams").ok_or("sem tela escolhida")?;
    let fluxos: Vec<(u32, HashMap<String, OwnedValue>)> = fluxos.clone().try_into().map_err(|e| format!("streams: {e}"))?;
    let (no, props) = fluxos.into_iter().next().ok_or("nenhuma tela")?;
    let tamanho = props.get("size").and_then(|v| <(i32, i32)>::try_from(v.clone()).ok()).map(|(w, h)| (w.max(1) as u32, h.max(1) as u32));

    // 4. O descritor do PipeWire.
    let op: HashMap<&str, Value> = HashMap::new();
    let msg = portal.call_method("OpenPipeWireRemote", &(&sessao, op)).await.map_err(|e| format!("OpenPipeWireRemote: {e}"))?;
    let fd: zbus::zvariant::OwnedFd = msg.body().deserialize().map_err(|e| e.to_string())?;
    Ok(TelaLiberada { fd: fd.into(), no, tamanho, _conexao: conn })
}

/// Chama um método do portal e espera o `Response` do pedido (inscreve antes de chamar,
/// para não perder a resposta).
async fn pedido<B>(conn: &zbus::Connection, portal: &zbus::Proxy<'_>, remetente: &str, token: &str, metodo: &str, corpo: &B) -> Result<HashMap<String, OwnedValue>, String>
where
    B: serde::Serialize + zbus::zvariant::DynamicType,
{
    let caminho = format!("/org/freedesktop/portal/desktop/request/{remetente}/{token}");
    let req = zbus::Proxy::new(conn, DESTINO, caminho, "org.freedesktop.portal.Request").await.map_err(|e| e.to_string())?;
    let mut respostas = req.receive_signal("Response").await.map_err(|e| e.to_string())?;
    portal.call_method(metodo, corpo).await.map_err(|e| format!("{metodo}: {e}"))?;
    // O diálogo do Start pode esperar a pessoa; 2 minutos e desiste.
    let msg = tokio::time::timeout(std::time::Duration::from_secs(120), respostas.next())
        .await
        .map_err(|_| format!("{metodo}: sem resposta"))?
        .ok_or_else(|| format!("{metodo}: pedido sumiu"))?;
    let (codigo, resultados): (u32, HashMap<String, OwnedValue>) = msg.body().deserialize().map_err(|e| e.to_string())?;
    match codigo {
        0 => Ok(resultados),
        1 => Err("a pessoa recusou".into()),
        _ => Err(format!("{metodo}: o portal recusou")),
    }
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    #[ignore]
    async fn portal_real() {
        // Abre o diálogo do sistema: `cargo test -q -- --ignored portal_real --nocapture`.
        match super::pedir(1).await {
            Ok(t) => println!("nó {} tamanho {:?} fd {}", t.no, t.tamanho, t.fd_bruto()),
            Err(e) => println!("portal: {e}"),
        }
    }
}
