//! `otpd`: o serviço do OpenTrackpad no computador.
//!
//! Uso: `otpd [--teste] [--porta N] [--codigo NNNNNN]`
//! - `--teste`: não cria dispositivos; só registra os eventos no terminal.
//! - `--codigo`: fixa o código de pareamento (testes com o emulador).

use std::sync::{Arc, Mutex};

use otpd::pareamento::Pareamento;
use otpd::protocolo::PORTA;
use otpd::saida::{Registro, Saida};
use otpd::servidor::{escutar_cabo, Contexto};
use otpd::sessao::Computador;

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    let tem = |f: &str| args.iter().any(|a| a == f);
    let valor = |f: &str| args.iter().position(|a| a == f).and_then(|i| args.get(i + 1)).cloned();

    let porta = valor("--porta").and_then(|p| p.parse().ok()).unwrap_or(PORTA);

    let mut saida: Box<dyn Saida> = if tem("--teste") {
        Box::new(Registro::no_terminal())
    } else {
        match otpd::uinput::verificar_acesso().and_then(|_| otpd::uinput::Uinput::abrir()) {
            Ok(u) => Box::new(u),
            Err(e) => {
                eprintln!("sem acesso a /dev/uinput ({e}); usando a saída de teste");
                eprintln!("para liberar: sudo cp desktop/60-opentrackpad-uinput.rules /etc/udev/rules.d/ && sudo udevadm control --reload && sudo udevadm trigger");
                Box::new(Registro::no_terminal())
            }
        }
    };
    eprintln!("{}", saida.descrever());

    let mut pareamento = if tem("--teste") { Pareamento::em_memoria() } else { Pareamento::do_arquivo(Pareamento::arquivo_padrao()) };
    let codigo = match valor("--codigo") {
        Some(c) => pareamento.fixar_codigo(&c),
        None => pareamento.novo_codigo(),
    };
    eprintln!("código para parear: {codigo} (vale 5 minutos, uma vez)");

    let ctx = Contexto {
        saida: Arc::new(Mutex::new(saida)),
        pareamento: Arc::new(Mutex::new(pareamento)),
        computador: Computador::deste(),
        extensoes: Arc::new(Vec::new),
    };

    if let Err(e) = escutar_cabo(porta, ctx).await {
        eprintln!("não deu para ouvir na porta {porta}: {e}");
        std::process::exit(1);
    }
}
