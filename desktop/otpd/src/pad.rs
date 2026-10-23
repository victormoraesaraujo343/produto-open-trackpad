//! Geometria do touchpad virtual e o vocabulário de eventos, sem saber de Linux.
//!
//! O estado (`estado.rs`) fala `PadEvent` para poder ser testado sem `/dev/uinput`;
//! só `uinput.rs` sabe virar isso em evento do kernel. Aprendizados da v0.2 (tag
//! `v0.2-archive`, `host/src/pad.rs`) mantidos aqui.

/// Unidades do dispositivo por milímetro.
pub const PAD_RESOLUTION: i32 = 40;

/// Quanto um contato pode tremer antes de o movimento valer (¼ mm).
///
/// Fuzz zero é pior do que parece: o libinput desliga a própria histerese quando o
/// dispositivo declara zero, supondo que o hardware já filtra. Sem fuzz, todo
/// tremor do dedo chega ao cursor.
pub const PAD_FUZZ: i32 = PAD_RESOLUTION / 4;

/// Slots multitoque expostos. Nenhum gesto real precisa de mais.
pub const MAX_SLOTS: usize = 10;

/// Maior número de dedos com bit `BTN_TOOL_*` próprio.
pub const MAX_REPORTED_FINGERS: u8 = 5;

/// Tamanho que o touchpad virtual declara ter.
///
/// Não é cosmético: o libinput pensa em milímetros (velocidade do cursor, rolagem,
/// limiares de gesto, bordas). O celular informa o tamanho físico real da área do
/// trackpad, então cada celular se comporta como um touchpad daquele tamanho.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PadGeometry {
    pub max_x: i32,
    pub max_y: i32,
}

impl PadGeometry {
    /// Menor e maior superfície aceitáveis, em µm. Fora disso é erro do cliente.
    const MIN_UM: u32 = 20_000;
    const MAX_UM: u32 = 500_000;

    /// Antes de qualquer celular dizer seu tamanho (autoteste).
    pub const DEFAULT: Self = Self {
        max_x: 100 * PAD_RESOLUTION,
        max_y: 62 * PAD_RESOLUTION,
    };

    /// Uma unidade é 1/40 mm = 25 µm.
    pub fn from_micrometres(width_um: u32, height_um: u32) -> Self {
        let axis = |um: u32| (um.clamp(Self::MIN_UM, Self::MAX_UM) / (1000 / PAD_RESOLUTION as u32)) as i32;
        Self { max_x: axis(width_um), max_y: axis(height_um) }
    }

    pub fn width_mm(&self) -> i32 {
        self.max_x / PAD_RESOLUTION
    }

    pub fn height_mm(&self) -> i32 {
        self.max_y / PAD_RESOLUTION
    }
}

/// Uma mudança no touchpad virtual. A ordem importa: `Slot` escolhe o contato dos
/// `Mt*` seguintes e `Sync` fecha um relatório atômico.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PadEvent {
    Slot(i32),
    /// Id novo começa um contato; `-1` solta.
    TrackingId(i32),
    MtPositionX(i32),
    MtPositionY(i32),
    MtTouchMajor(i32),
    /// Emulação de toque único do contato mais antigo (`ABS_X`/`ABS_Y`).
    PositionX(i32),
    PositionY(i32),
    Touch(bool),
    ToolFingers(u8),
    Sync,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tamanho_fisico_vira_unidades() {
        let g = PadGeometry::from_micrometres(96_000, 60_000);
        assert_eq!((g.max_x, g.max_y), (3840, 2400));
        assert_eq!((g.width_mm(), g.height_mm()), (96, 60));
    }

    #[test]
    fn tamanhos_absurdos_sao_limitados() {
        assert_eq!(PadGeometry::from_micrometres(1, 1).width_mm(), 20);
        assert_eq!(PadGeometry::from_micrometres(u32::MAX, u32::MAX).width_mm(), 500);
    }
}
