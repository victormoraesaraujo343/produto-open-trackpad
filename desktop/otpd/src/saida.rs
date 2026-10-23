//! Para onde vão os eventos: os dispositivos virtuais de verdade ou um registro (testes,
//! e quando `/dev/uinput` não está acessível).

use std::io;
use std::sync::{Arc, Mutex};

use evdev::KeyCode;

use crate::pad::{PadEvent, PadGeometry};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Botao {
    Esquerdo,
    Direito,
    Meio,
}

impl Botao {
    pub fn de(nome: &str) -> Option<Self> {
        match nome {
            "esquerdo" => Some(Botao::Esquerdo),
            "direito" => Some(Botao::Direito),
            "meio" => Some(Botao::Meio),
            _ => None,
        }
    }
}

pub trait Saida: Send {
    /// Um lote de eventos do touchpad (termina em `Sync`).
    fn pad(&mut self, eventos: &[PadEvent]) -> io::Result<()>;
    /// Faz o touchpad ter este tamanho; devolve se o dispositivo foi recriado.
    fn configurar(&mut self, g: PadGeometry) -> io::Result<bool>;
    fn botao(&mut self, b: Botao, apertado: bool) -> io::Result<()>;
    fn tecla(&mut self, k: KeyCode, apertada: bool) -> io::Result<()>;
    /// Rolagem em passos (positivo = para cima / para a direita).
    fn rolar(&mut self, dx: i32, dy: i32) -> io::Result<()>;
    fn descrever(&mut self) -> String;
    /// Caneta da mesa digitalizadora: posição 0..65535, pressão 0..1023.
    fn caneta(&mut self, x: u16, y: u16, pressao: u16, encostada: bool, perto: bool) -> io::Result<()>;
}

/// Registra cada evento como texto. Compartilhável para os testes lerem depois.
#[derive(Clone, Default)]
pub struct Registro {
    pub linhas: Arc<Mutex<Vec<String>>>,
    pub imprimir: bool,
}

impl Registro {
    pub fn novo() -> Self {
        Self::default()
    }

    pub fn no_terminal() -> Self {
        Self { imprimir: true, ..Self::default() }
    }

    pub fn linhas(&self) -> Vec<String> {
        self.linhas.lock().unwrap().clone()
    }

    fn anotar(&self, s: String) {
        if self.imprimir {
            println!("    {s}");
        }
        self.linhas.lock().unwrap().push(s);
    }
}

impl Saida for Registro {
    fn pad(&mut self, eventos: &[PadEvent]) -> io::Result<()> {
        if !eventos.is_empty() {
            let s: Vec<String> = eventos.iter().map(|e| format!("{e:?}")).collect();
            self.anotar(format!("pad {}", s.join(" ")));
        }
        Ok(())
    }

    fn configurar(&mut self, g: PadGeometry) -> io::Result<bool> {
        self.anotar(format!("configurar {}x{} mm", g.width_mm(), g.height_mm()));
        Ok(false)
    }

    fn botao(&mut self, b: Botao, apertado: bool) -> io::Result<()> {
        self.anotar(format!("botao {b:?} {}", if apertado { "aperta" } else { "solta" }));
        Ok(())
    }

    fn tecla(&mut self, k: KeyCode, apertada: bool) -> io::Result<()> {
        self.anotar(format!("tecla {k:?} {}", if apertada { "aperta" } else { "solta" }));
        Ok(())
    }

    fn rolar(&mut self, dx: i32, dy: i32) -> io::Result<()> {
        self.anotar(format!("rolar {dx} {dy}"));
        Ok(())
    }

    fn descrever(&mut self) -> String {
        "saída de teste (eventos só registrados, nada chega ao sistema)".to_owned()
    }

    fn caneta(&mut self, x: u16, y: u16, pressao: u16, encostada: bool, perto: bool) -> io::Result<()> {
        self.anotar(format!("caneta {x} {y} {pressao} {}", if encostada { "encostada" } else if perto { "perto" } else { "longe" }));
        Ok(())
    }
}
