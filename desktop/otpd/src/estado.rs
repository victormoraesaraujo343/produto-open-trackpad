//! Quadros de toque do celular → slots multitoque do touchpad virtual.
//!
//! O Android reaproveita o id do ponteiro assim que o dedo sai, então ele não serve
//! de tracking id do kernel. Este módulo mapeia id do ponteiro → slot estável +
//! tracking id nunca reaproveitado, e é o único que sabe se um contato está em baixo.
//! Portado de `host/src/state.rs` da v0.2.

use crate::pad::*;
use crate::protocolo::{Contato, Superficie};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Slot {
    pointer_id: u8,
    tracking_id: i32,
    /// Ordem de nascimento, para achar o contato mais antigo.
    age: u64,
    x: i32,
    y: i32,
    major: i32,
}

#[derive(Debug)]
pub struct ContactState {
    slots: [Option<Slot>; MAX_SLOTS],
    next_contact: u64,
    selected_slot: Option<i32>,
    emulated: Option<(i32, i32)>,
    fingers: u8,
    touching: bool,
    /// Tamanho da superfície do celular, em pixels.
    surface: (u32, u32),
    geometry: PadGeometry,
    dropped_contacts: u64,
}

impl Default for ContactState {
    fn default() -> Self {
        Self::new()
    }
}

impl ContactState {
    pub fn new() -> Self {
        Self {
            slots: [None; MAX_SLOTS],
            next_contact: 0,
            selected_slot: None,
            emulated: None,
            fingers: 0,
            touching: false,
            surface: (1, 1),
            geometry: PadGeometry::DEFAULT,
            dropped_contacts: 0,
        }
    }

    pub fn dropped_contacts(&self) -> u64 {
        self.dropped_contacts
    }

    pub fn active_contacts(&self) -> usize {
        self.slots.iter().flatten().count()
    }

    pub fn geometry(&self) -> PadGeometry {
        self.geometry
    }

    /// Nova superfície (início de sessão ou área do trackpad mudou). Solta antes
    /// qualquer contato que tenha sobrado, para uma reconexão nunca herdar dedo preso.
    pub fn configurar(&mut self, s: &Superficie) -> Vec<PadEvent> {
        let events = self.release_all();
        self.surface = (s.w.max(1), s.h.max(1));
        self.geometry = PadGeometry::from_micrometres(s.w_um, s.h_um);
        events
    }

    /// Esquece o que sabia do dispositivo, sem emitir nada (ele foi recriado vazio).
    pub fn device_replaced(&mut self) {
        self.slots = [None; MAX_SLOTS];
        self.selected_slot = None;
        self.emulated = None;
        self.fingers = 0;
        self.touching = false;
    }

    /// Solta todos os contatos. Sem nada em baixo, não emite nada.
    pub fn release_all(&mut self) -> Vec<PadEvent> {
        let mut events = Vec::new();
        for index in 0..MAX_SLOTS {
            if self.slots[index].is_some() {
                self.select_slot(&mut events, index as i32);
                events.push(PadEvent::TrackingId(-1));
                self.slots[index] = None;
            }
        }
        if self.touching {
            events.push(PadEvent::Touch(false));
            self.touching = false;
        }
        if self.fingers != 0 {
            events.push(PadEvent::ToolFingers(0));
            self.fingers = 0;
        }
        if !events.is_empty() {
            events.push(PadEvent::Sync);
        }
        self.emulated = None;
        events
    }

    /// Aplica um retrato completo: contato que não aparece foi solto; id novo ganha
    /// slot livre e tracking id novo.
    pub fn apply(&mut self, contatos: &[Contato]) -> Vec<PadEvent> {
        let mut events = Vec::new();

        // Solta primeiro: assim um quadro que troca um dedo por outro reaproveita o slot.
        for index in 0..MAX_SLOTS {
            let Some(slot) = self.slots[index] else { continue };
            if !contatos.iter().any(|c| c.id == slot.pointer_id) {
                self.select_slot(&mut events, index as i32);
                events.push(PadEvent::TrackingId(-1));
                self.slots[index] = None;
            }
        }

        for c in contatos {
            let (x, y, major) = self.scale(c.x, c.y, c.major);
            match self.slot_of(c.id) {
                Some(index) => {
                    let previous = self.slots[index].expect("slot_of devolve slot ocupado");
                    let updated = Slot { x, y, major, ..previous };
                    if updated == previous {
                        continue;
                    }
                    self.select_slot(&mut events, index as i32);
                    push_axes(&mut events, Some(previous), &updated);
                    self.slots[index] = Some(updated);
                }
                None => {
                    let Some(index) = self.slots.iter().position(Option::is_none) else {
                        self.dropped_contacts += 1;
                        continue;
                    };
                    let age = self.next_contact;
                    self.next_contact += 1;
                    let tracking_id = (age % i32::MAX as u64) as i32;
                    let slot = Slot { pointer_id: c.id, tracking_id, age, x, y, major };
                    self.select_slot(&mut events, index as i32);
                    events.push(PadEvent::TrackingId(tracking_id));
                    push_axes(&mut events, None, &slot);
                    self.slots[index] = Some(slot);
                }
            }
        }

        self.push_pointer_emulation(&mut events);
        if !events.is_empty() {
            events.push(PadEvent::Sync);
        }
        events
    }

    /// `BTN_TOUCH`, `BTN_TOOL_*` e `ABS_X`/`ABS_Y`: o kernel faz isso para drivers de
    /// verdade; num uinput é preciso fazer à mão, senão o libinput não vê um touchpad.
    fn push_pointer_emulation(&mut self, events: &mut Vec<PadEvent>) {
        let fingers = (self.active_contacts() as u8).min(MAX_REPORTED_FINGERS);
        if fingers != self.fingers {
            events.push(PadEvent::ToolFingers(fingers));
            self.fingers = fingers;
        }
        let touching = self.active_contacts() > 0;
        if touching != self.touching {
            events.push(PadEvent::Touch(touching));
            self.touching = touching;
        }
        // O contato mais antigo guia o ponteiro emulado (pela idade, não pelo slot).
        let Some(oldest) = self.slots.iter().flatten().min_by_key(|s| s.age).copied() else {
            self.emulated = None;
            return;
        };
        let current = (oldest.x, oldest.y);
        if self.emulated == Some(current) {
            return;
        }
        let previous = self.emulated;
        if previous.map(|v| v.0) != Some(current.0) {
            events.push(PadEvent::PositionX(current.0));
        }
        if previous.map(|v| v.1) != Some(current.1) {
            events.push(PadEvent::PositionY(current.1));
        }
        self.emulated = Some(current);
    }

    fn slot_of(&self, pointer_id: u8) -> Option<usize> {
        self.slots.iter().position(|s| s.is_some_and(|s| s.pointer_id == pointer_id))
    }

    fn select_slot(&mut self, events: &mut Vec<PadEvent>, index: i32) {
        if self.selected_slot != Some(index) {
            events.push(PadEvent::Slot(index));
            self.selected_slot = Some(index);
        }
    }

    fn scale(&self, x: u16, y: u16, major: u16) -> (i32, i32, i32) {
        (
            scale_axis(u32::from(x), self.surface.0, self.geometry.max_x),
            scale_axis(u32::from(y), self.surface.1, self.geometry.max_y),
            // A largura do contato escala com o eixo horizontal.
            scale_axis(u32::from(major), self.surface.0, self.geometry.max_x),
        )
    }
}

fn push_axes(events: &mut Vec<PadEvent>, previous: Option<Slot>, slot: &Slot) {
    if previous.map(|v| v.x) != Some(slot.x) {
        events.push(PadEvent::MtPositionX(slot.x));
    }
    if previous.map(|v| v.y) != Some(slot.y) {
        events.push(PadEvent::MtPositionY(slot.y));
    }
    if previous.map(|v| v.major) != Some(slot.major) {
        events.push(PadEvent::MtTouchMajor(slot.major));
    }
}

/// Leva `value` de um eixo de `span` pixels para `0..=to_max`.
fn scale_axis(value: u32, span: u32, to_max: i32) -> i32 {
    let from_max = u64::from(span.saturating_sub(1)).max(1);
    let clamped = u64::from(value).min(from_max);
    ((clamped * to_max as u64) / from_max) as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sup() -> Superficie {
        Superficie { w: 1180, h: 738, w_um: 96_000, h_um: 60_000, max: 10 }
    }

    fn c(id: u8, x: u16, y: u16) -> Contato {
        Contato { id, x, y, major: 12 }
    }

    fn started() -> ContactState {
        let mut s = ContactState::new();
        s.configurar(&sup());
        s
    }

    fn tracking_ids(events: &[PadEvent]) -> Vec<i32> {
        events.iter().filter_map(|e| match e { PadEvent::TrackingId(id) => Some(*id), _ => None }).collect()
    }

    #[test]
    fn um_dedo_desce_move_e_sobe() {
        let mut s = started();
        let down = s.apply(&[c(0, 500, 300)]);
        assert_eq!(down.first(), Some(&PadEvent::Slot(0)));
        assert_eq!(tracking_ids(&down).len(), 1);
        assert!(down.contains(&PadEvent::Touch(true)));
        assert!(down.contains(&PadEvent::ToolFingers(1)));
        assert_eq!(down.last(), Some(&PadEvent::Sync));

        let moved = s.apply(&[c(0, 600, 300)]);
        assert!(tracking_ids(&moved).is_empty());
        assert!(moved.iter().any(|e| matches!(e, PadEvent::MtPositionX(_))));
        assert!(!moved.iter().any(|e| matches!(e, PadEvent::MtPositionY(_))));

        let up = s.apply(&[]);
        assert_eq!(tracking_ids(&up), vec![-1]);
        assert!(up.contains(&PadEvent::Touch(false)));
        assert!(up.contains(&PadEvent::ToolFingers(0)));
        assert_eq!(s.active_contacts(), 0);
    }

    #[test]
    fn quadro_igual_nao_emite_nada() {
        let mut s = started();
        s.apply(&[c(0, 500, 300)]);
        assert!(s.apply(&[c(0, 500, 300)]).is_empty());
    }

    #[test]
    fn dois_tres_e_quatro_dedos_tem_seu_bit() {
        let mut s = started();
        for n in 1..=4usize {
            let cs: Vec<_> = (0..n).map(|i| c(i as u8, 100 + 200 * i as u16, 300)).collect();
            let ev = s.apply(&cs);
            assert!(ev.contains(&PadEvent::ToolFingers(n as u8)), "{n} dedos: {ev:?}");
        }
    }

    #[test]
    fn id_reaproveitado_ganha_tracking_id_novo() {
        let mut s = started();
        let a = tracking_ids(&s.apply(&[c(0, 1, 1)]))[0];
        s.apply(&[]);
        let b = tracking_ids(&s.apply(&[c(0, 9, 9)]))[0];
        assert_ne!(a, b);
    }

    #[test]
    fn soltar_um_de_dois_deixa_o_outro() {
        let mut s = started();
        s.apply(&[c(0, 100, 100), c(1, 900, 600)]);
        let ev = s.apply(&[c(1, 900, 600)]);
        assert_eq!(tracking_ids(&ev), vec![-1]);
        assert!(ev.contains(&PadEvent::ToolFingers(1)));
        assert!(!ev.contains(&PadEvent::Touch(false)));
    }

    #[test]
    fn reconfigurar_solta_o_que_estava_em_baixo() {
        let mut s = started();
        s.apply(&[c(0, 100, 100), c(1, 900, 600)]);
        let ev = s.configurar(&sup());
        assert_eq!(tracking_ids(&ev), vec![-1, -1]);
        assert!(ev.contains(&PadEvent::Touch(false)));
        assert_eq!(s.active_contacts(), 0);
    }

    #[test]
    fn canto_vai_para_o_maximo() {
        let mut s = started();
        let ev = s.apply(&[c(0, 1179, 737)]);
        assert!(ev.contains(&PadEvent::MtPositionX(3840)));
        assert!(ev.contains(&PadEvent::MtPositionY(2400)));
    }

    #[test]
    fn onze_dedos_descarta_o_excedente() {
        let mut s = started();
        let cs: Vec<_> = (0..MAX_SLOTS as u8 + 1).map(|i| c(i, 10 * i as u16, 10)).collect();
        s.apply(&cs);
        assert_eq!(s.active_contacts(), MAX_SLOTS);
        assert_eq!(s.dropped_contacts(), 1);
    }
}
