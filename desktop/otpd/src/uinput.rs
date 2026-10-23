//! Dispositivos virtuais em `/dev/uinput`: o único módulo que sabe de entrada do Linux.
//!
//! São três dispositivos, como na v0.2: o touchpad (o libinput o classifica como
//! touchpad e faz gestos, rolagem e aceleração nativos), os botões num dispositivo
//! separado (o touchpad é clickpad e não aperta botão), e um teclado.

use std::io;

use evdev::uinput::VirtualDevice;
use evdev::{
    AbsInfo, AbsoluteAxisCode, AttributeSet, BusType, EventType, InputEvent, InputId, KeyCode, PropType,
    RelativeAxisCode, SynchronizationCode, UinputAbsSetup,
};

use crate::pad::*;
use crate::saida::{Botao, Saida};

pub const NOME_TOUCHPAD: &str = "OpenTrackpad Touchpad";
pub const NOME_BOTOES: &str = "OpenTrackpad Botões";
pub const NOME_TECLADO: &str = "OpenTrackpad Teclado";

const TOOL_KEYS: [KeyCode; MAX_REPORTED_FINGERS as usize] = [
    KeyCode::BTN_TOOL_FINGER,
    KeyCode::BTN_TOOL_DOUBLETAP,
    KeyCode::BTN_TOOL_TRIPLETAP,
    KeyCode::BTN_TOOL_QUADTAP,
    KeyCode::BTN_TOOL_QUINTTAP,
];

/// Falha cedo se `/dev/uinput` não puder ser escrito.
pub fn verificar_acesso() -> io::Result<()> {
    std::fs::OpenOptions::new().write(true).open("/dev/uinput").map(drop)
}

fn criar_touchpad(g: PadGeometry) -> io::Result<VirtualDevice> {
    let mut keys = AttributeSet::<KeyCode>::new();
    // BTN_TOOL_FINGER sem BTN_TOOL_PEN e sem INPUT_PROP_DIRECT: o udev marca touchpad,
    // não tela de toque.
    keys.insert(KeyCode::BTN_TOUCH);
    for k in TOOL_KEYS {
        keys.insert(k);
    }
    // O libinput espera que um touchpad tenha botão esquerdo; o clique vem do toque.
    keys.insert(KeyCode::BTN_LEFT);

    let mut props = AttributeSet::<PropType>::new();
    props.insert(PropType::POINTER);
    props.insert(PropType::BUTTONPAD);

    let pos = |max: i32| AbsInfo::new(0, 0, max, PAD_FUZZ, 0, PAD_RESOLUTION);
    // Sem ABS_MT_PRESSURE: declarar pressão muda a classificação de toque do libinput
    // e a tela do celular não mede pressão de verdade (aprendizado da v0.2).
    VirtualDevice::builder()?
        .name(NOME_TOUCHPAD)
        .input_id(InputId::new(BusType::BUS_VIRTUAL, 0x1d6b, 0x0f0f, 0x0003))
        .with_properties(&props)?
        .with_keys(&keys)?
        .with_absolute_axis(&UinputAbsSetup::new(AbsoluteAxisCode::ABS_X, pos(g.max_x)))?
        .with_absolute_axis(&UinputAbsSetup::new(AbsoluteAxisCode::ABS_Y, pos(g.max_y)))?
        .with_absolute_axis(&UinputAbsSetup::new(
            AbsoluteAxisCode::ABS_MT_SLOT,
            AbsInfo::new(0, 0, MAX_SLOTS as i32 - 1, 0, 0, 0),
        ))?
        .with_absolute_axis(&UinputAbsSetup::new(
            AbsoluteAxisCode::ABS_MT_TRACKING_ID,
            AbsInfo::new(0, -1, i32::MAX, 0, 0, 0),
        ))?
        .with_absolute_axis(&UinputAbsSetup::new(AbsoluteAxisCode::ABS_MT_POSITION_X, pos(g.max_x)))?
        .with_absolute_axis(&UinputAbsSetup::new(AbsoluteAxisCode::ABS_MT_POSITION_Y, pos(g.max_y)))?
        .with_absolute_axis(&UinputAbsSetup::new(AbsoluteAxisCode::ABS_MT_TOUCH_MAJOR, pos(g.max_x)))?
        .build()
}

fn criar_botoes() -> io::Result<VirtualDevice> {
    let mut keys = AttributeSet::<KeyCode>::new();
    keys.insert(KeyCode::BTN_LEFT);
    keys.insert(KeyCode::BTN_RIGHT);
    keys.insert(KeyCode::BTN_MIDDLE);
    let mut rel = AttributeSet::<RelativeAxisCode>::new();
    // REL_X/REL_Y fazem o libinput tratar como ponteiro; nunca se move por aqui.
    rel.insert(RelativeAxisCode::REL_X);
    rel.insert(RelativeAxisCode::REL_Y);
    rel.insert(RelativeAxisCode::REL_WHEEL);
    rel.insert(RelativeAxisCode::REL_HWHEEL);
    VirtualDevice::builder()?
        .name(NOME_BOTOES)
        .input_id(InputId::new(BusType::BUS_VIRTUAL, 0x1d6b, 0x0f0f, 0x0004))
        .with_keys(&keys)?
        .with_relative_axes(&rel)?
        .build()
}

fn criar_teclado() -> io::Result<VirtualDevice> {
    let mut keys = AttributeSet::<KeyCode>::new();
    for k in crate::teclas::todos() {
        keys.insert(k);
    }
    VirtualDevice::builder()?
        .name(NOME_TECLADO)
        .input_id(InputId::new(BusType::BUS_VIRTUAL, 0x1d6b, 0x0f0f, 0x0005))
        .with_keys(&keys)?
        .build()
}

fn syn() -> InputEvent {
    InputEvent::new(EventType::SYNCHRONIZATION.0, SynchronizationCode::SYN_REPORT.0, 0)
}

fn abs(axis: AbsoluteAxisCode, v: i32) -> InputEvent {
    InputEvent::new(EventType::ABSOLUTE.0, axis.0, v)
}

fn key(k: KeyCode, down: bool) -> InputEvent {
    InputEvent::new(EventType::KEY.0, k.0, i32::from(down))
}

fn encode(e: PadEvent, out: &mut Vec<InputEvent>) {
    use AbsoluteAxisCode as A;
    match e {
        PadEvent::Slot(i) => out.push(abs(A::ABS_MT_SLOT, i)),
        PadEvent::TrackingId(i) => out.push(abs(A::ABS_MT_TRACKING_ID, i)),
        PadEvent::MtPositionX(v) => out.push(abs(A::ABS_MT_POSITION_X, v)),
        PadEvent::MtPositionY(v) => out.push(abs(A::ABS_MT_POSITION_Y, v)),
        PadEvent::MtTouchMajor(v) => out.push(abs(A::ABS_MT_TOUCH_MAJOR, v)),
        PadEvent::PositionX(v) => out.push(abs(A::ABS_X, v)),
        PadEvent::PositionY(v) => out.push(abs(A::ABS_Y, v)),
        PadEvent::Touch(d) => out.push(key(KeyCode::BTN_TOUCH, d)),
        PadEvent::ToolFingers(n) => {
            // Só um bit de ferramenta por vez; o kernel descarta os que não mudaram.
            for (i, k) in TOOL_KEYS.into_iter().enumerate() {
                out.push(key(k, n as usize == i + 1));
            }
        }
        PadEvent::Sync => out.push(syn()),
    }
}

/// Os três dispositivos. O touchpad só nasce quando o primeiro celular diz o tamanho
/// (criar e trocar logo depois seriam dois hotplugs, e painéis de ajuste do sistema
/// nem sempre aguentam um dispositivo sumindo).
pub struct Uinput {
    touchpad: Option<(VirtualDevice, PadGeometry)>,
    botoes: VirtualDevice,
    teclado: VirtualDevice,
    buffer: Vec<InputEvent>,
}

impl Uinput {
    pub fn abrir() -> io::Result<Self> {
        Ok(Self { touchpad: None, botoes: criar_botoes()?, teclado: criar_teclado()?, buffer: Vec::with_capacity(64) })
    }
}

impl Saida for Uinput {
    fn pad(&mut self, eventos: &[PadEvent]) -> io::Result<()> {
        let Some((dev, _)) = &mut self.touchpad else { return Ok(()) };
        if eventos.is_empty() {
            return Ok(());
        }
        self.buffer.clear();
        for e in eventos {
            encode(*e, &mut self.buffer);
        }
        // Um único write: o relatório chega inteiro ao kernel.
        dev.emit(&self.buffer)
    }

    fn configurar(&mut self, g: PadGeometry) -> io::Result<bool> {
        if let Some((_, atual)) = &self.touchpad {
            if *atual == g {
                return Ok(false);
            }
        }
        // Cria o novo antes de soltar o velho: se falhar, o que funciona fica.
        let novo = criar_touchpad(g)?;
        self.touchpad = Some((novo, g));
        Ok(true)
    }

    fn botao(&mut self, b: Botao, apertado: bool) -> io::Result<()> {
        let k = match b {
            Botao::Esquerdo => KeyCode::BTN_LEFT,
            Botao::Direito => KeyCode::BTN_RIGHT,
            Botao::Meio => KeyCode::BTN_MIDDLE,
        };
        self.botoes.emit(&[key(k, apertado), syn()])
    }

    fn tecla(&mut self, k: KeyCode, apertada: bool) -> io::Result<()> {
        self.teclado.emit(&[key(k, apertada), syn()])
    }

    fn rolar(&mut self, dx: i32, dy: i32) -> io::Result<()> {
        let mut ev = Vec::with_capacity(3);
        if dy != 0 {
            ev.push(InputEvent::new(EventType::RELATIVE.0, RelativeAxisCode::REL_WHEEL.0, dy));
        }
        if dx != 0 {
            ev.push(InputEvent::new(EventType::RELATIVE.0, RelativeAxisCode::REL_HWHEEL.0, dx));
        }
        if ev.is_empty() {
            return Ok(());
        }
        ev.push(syn());
        self.botoes.emit(&ev)
    }

    fn descrever(&mut self) -> String {
        let tp = match &mut self.touchpad {
            Some((dev, g)) => {
                let nos = dev
                    .enumerate_dev_nodes_blocking()
                    .map(|it| it.filter_map(Result::ok).map(|p| p.display().to_string()).collect::<Vec<_>>().join(", "))
                    .unwrap_or_default();
                format!("touchpad {}x{} mm em {nos}", g.width_mm(), g.height_mm())
            }
            None => "touchpad nasce quando o primeiro celular conectar".to_owned(),
        };
        format!("dispositivos virtuais: {tp}; botões e teclado prontos")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encoded(e: PadEvent) -> Vec<InputEvent> {
        let mut out = Vec::new();
        encode(e, &mut out);
        out
    }

    #[test]
    fn numero_de_dedos_liga_um_bit_so() {
        let ev = encoded(PadEvent::ToolFingers(3));
        let ligados: Vec<_> = ev.iter().filter(|e| e.value() == 1).map(|e| e.code()).collect();
        assert_eq!(ligados, vec![KeyCode::BTN_TOOL_TRIPLETAP.0]);
    }

    #[test]
    fn soltar_usa_tracking_id_menos_um() {
        let ev = encoded(PadEvent::TrackingId(-1));
        assert_eq!(ev[0].code(), AbsoluteAxisCode::ABS_MT_TRACKING_ID.0);
        assert_eq!(ev[0].value(), -1);
    }
}
