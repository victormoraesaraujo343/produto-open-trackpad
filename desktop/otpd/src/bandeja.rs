//! Ícone na bandeja (seção 29 do laboratório): o estado de relance e os atalhos.
//!
//! StatusNotifierItem (KDE e a maioria dos painéis do Linux). O estado vem dos eventos
//! `celular` que o servidor espalha (conectado, nível, desconectado).

use ksni::TrayMethods;
use tokio::sync::broadcast;

use crate::sessao::Evento;

/// O que a bandeja mostra.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct EstadoBandeja {
    /// Celulares conectados agora: (nome, via, nível).
    pub celulares: Vec<(String, String, u8)>,
}

impl EstadoBandeja {
    /// Aplica um evento `celular`. Devolve se mudou.
    pub fn aplicar(&mut self, e: &Evento) -> bool {
        if e.tipo != "celular" {
            return false;
        }
        let nome = e.dados["nome"].as_str().unwrap_or("Celular").to_owned();
        let via = e.dados["via"].as_str().unwrap_or("").to_owned();
        let antes = self.clone();
        match e.dados["estado"].as_str() {
            Some("conectado") => {
                self.celulares.retain(|(n, v, _)| !(n == &nome && v == &via));
                self.celulares.push((nome, via, 0));
            }
            Some("nivel") => {
                let n = e.dados["nivel"].as_u64().unwrap_or(0) as u8;
                if let Some(c) = self.celulares.iter_mut().find(|(c, v, _)| c == &nome && v == &via) {
                    c.2 = n;
                }
            }
            Some("desconectado") => self.celulares.retain(|(n, v, _)| !(n == &nome && v == &via)),
            _ => {}
        }
        *self != antes
    }

    /// Linha de estado (texto, nunca só cor): "Moto G7 · Cabo · P" ou "Nenhum celular".
    pub fn resumo(&self) -> String {
        match self.celulares.first() {
            None => "Nenhum celular".to_owned(),
            Some((nome, via, nivel)) => {
                let via = if via == "cabo" { "Cabo" } else { "Wi-Fi" };
                let nivel = match nivel {
                    1 => " · L",
                    2 => " · M",
                    3 => " · P",
                    _ => "",
                };
                let mais = if self.celulares.len() > 1 { format!(" (+{})", self.celulares.len() - 1) } else { String::new() };
                format!("{nome} · {via}{nivel}{mais}")
            }
        }
    }
}

struct Bandeja {
    estado: EstadoBandeja,
    porta_web: u16,
}

impl Bandeja {
    fn abrir_pagina(&self) {
        // xdg-open com argumento separado (sem shell); endereço fixo, local.
        let _ = std::process::Command::new("xdg-open").arg(format!("http://127.0.0.1:{}/", self.porta_web)).spawn();
    }
}

impl ksni::Tray for Bandeja {
    fn id(&self) -> String {
        "opentrackpad".into()
    }

    fn title(&self) -> String {
        "OpenTrackpad".into()
    }

    fn icon_name(&self) -> String {
        // Ícones do tema do sistema: com celular, o de touchpad ligado; sem, o desligado.
        if self.estado.celulares.is_empty() { "input-touchpad-off" } else { "input-touchpad-on" }.into()
    }

    fn tool_tip(&self) -> ksni::ToolTip {
        ksni::ToolTip { title: "OpenTrackpad".into(), description: self.estado.resumo(), ..Default::default() }
    }

    fn activate(&mut self, _x: i32, _y: i32) {
        self.abrir_pagina();
    }

    fn menu(&self) -> Vec<ksni::MenuItem<Self>> {
        use ksni::menu::*;
        vec![
            StandardItem { label: self.estado.resumo(), enabled: false, icon_name: "phone".into(), ..Default::default() }.into(),
            MenuItem::Separator,
            StandardItem {
                label: "Parear um celular".into(),
                icon_name: "view-barcode-qr".into(),
                activate: Box::new(|b: &mut Self| b.abrir_pagina()),
                ..Default::default()
            }
            .into(),
            StandardItem {
                label: "Aparelhos de confiança".into(),
                icon_name: "preferences-system".into(),
                activate: Box::new(|b: &mut Self| b.abrir_pagina()),
                ..Default::default()
            }
            .into(),
        ]
    }
}

/// Põe o ícone na bandeja e o mantém atualizado. Sem bandeja no sistema: avisa e segue.
pub async fn iniciar(eventos: broadcast::Sender<Evento>, porta_web: u16) {
    let handle = match (Bandeja { estado: EstadoBandeja::default(), porta_web }).spawn().await {
        Ok(h) => h,
        Err(e) => {
            eprintln!("sem ícone na bandeja ({e})");
            return;
        }
    };
    let mut rx = eventos.subscribe();
    loop {
        match rx.recv().await {
            Ok(e) if e.tipo == "celular" => {
                handle.update(|b| { b.estado.aplicar(&e); }).await;
            }
            Ok(_) => {}
            Err(broadcast::error::RecvError::Lagged(_)) => {}
            Err(broadcast::error::RecvError::Closed) => return,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn ev(estado: &str, nivel: u8) -> Evento {
        Evento::novo("celular", json!({"estado":estado,"nome":"Moto G7","via":"cabo","nivel":nivel}))
    }

    #[test]
    fn conecta_mede_e_desconecta() {
        let mut e = EstadoBandeja::default();
        assert_eq!(e.resumo(), "Nenhum celular");
        assert!(e.aplicar(&ev("conectado", 0)));
        assert_eq!(e.resumo(), "Moto G7 · Cabo");
        assert!(e.aplicar(&ev("nivel", 3)));
        assert_eq!(e.resumo(), "Moto G7 · Cabo · P");
        assert!(!e.aplicar(&ev("nivel", 3)));
        assert!(e.aplicar(&ev("desconectado", 0)));
        assert_eq!(e.resumo(), "Nenhum celular");
    }

    #[test]
    fn outros_eventos_nao_mudam_nada() {
        let mut e = EstadoBandeja::default();
        assert!(!e.aplicar(&Evento::novo("tique", serde_json::Value::Null)));
    }
}
