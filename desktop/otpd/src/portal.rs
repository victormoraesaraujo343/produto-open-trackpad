//! Portal ScreenCast (xdg-desktop-portal): pede ao sistema para ver a tela e devolve o nó do
//! PipeWire. O KDE mostra um diálogo para escolher a tela na primeira vez; com o
//! `restore_token` guardado, as próximas vezes não perguntam.

use crate::video::Fonte;

/// Chamado na hora de abrir o espelho. Sem portal ou com o pedido negado: `None`.
pub fn abrir_tela() -> Option<Fonte> {
    None
}
