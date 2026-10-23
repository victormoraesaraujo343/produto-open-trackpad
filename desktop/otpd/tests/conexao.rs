//! Conexão de ponta a ponta pela rede local, com a saída de registro.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use otpd::pareamento::Pareamento;
use otpd::protocolo::{codificar, controle, Contato, Mensagem};
use otpd::saida::{Registro, Saida};
use otpd::servidor::{atender, ler_async, Contexto};
use otpd::sessao::Computador;
use serde_json::json;
use tokio::io::AsyncWriteExt;
use tokio::net::{TcpListener, TcpStream};

async fn servidor() -> (std::net::SocketAddr, Registro) {
    let reg = Registro::novo();
    let saida: Box<dyn Saida> = Box::new(reg.clone());
    let mut p = Pareamento::em_memoria();
    p.fixar_codigo("123456");
    let ctx = Contexto {
        saida: Arc::new(Mutex::new(saida)),
        pareamento: Arc::new(Mutex::new(p)),
        computador: Computador { nome: "Teste".into(), sistema: "linux".into(), ambiente: "kde".into() },
        extensoes: Arc::new(Vec::new),
    };
    let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = l.local_addr().unwrap();
    tokio::spawn(async move {
        loop {
            let (s, _) = l.accept().await.unwrap();
            tokio::spawn(atender(s, ctx.clone(), "cabo"));
        }
    });
    (addr, reg)
}

async fn mandar(s: &mut TcpStream, m: Mensagem) {
    s.write_all(&codificar(&m).unwrap()).await.unwrap();
}

async fn esperar(reg: &Registro, f: impl Fn(&[String]) -> bool) -> Vec<String> {
    for _ in 0..100 {
        let l = reg.linhas();
        if f(&l) {
            return l;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    reg.linhas()
}

#[tokio::test]
async fn parear_tocar_e_cair_solta_tudo() {
    let (addr, reg) = servidor().await;
    let mut s = TcpStream::connect(addr).await.unwrap();
    mandar(&mut s, controle(json!({"t":"ola","v":1,"aparelho":{"nome":"Emulador"},"pareamento":{"codigo":"123456"}}))).await;
    let Some(Mensagem::Controle(b)) = ler_async(&mut s).await.unwrap() else { panic!("sem resposta") };
    assert_eq!(b["t"], "bemvindo");
    assert!(b["segredo"].is_string());

    mandar(&mut s, controle(json!({"t":"superficie","w":1180,"h":738,"w_um":96000,"h_um":60000}))).await;
    mandar(&mut s, Mensagem::Toque { seq: 1, contatos: vec![Contato { id: 0, x: 10, y: 10, major: 0 }, Contato { id: 1, x: 500, y: 300, major: 0 }] }).await;
    let l = esperar(&reg, |l| l.iter().any(|x| x.contains("ToolFingers(2)"))).await;
    assert!(l.iter().any(|x| x.contains("ToolFingers(2)")), "{l:?}");

    drop(s); // queda sem tchau
    let l = esperar(&reg, |l| l.iter().any(|x| x.contains("Touch(false)"))).await;
    assert!(l.iter().any(|x| x.contains("Touch(false)")), "{l:?}");
}

#[tokio::test]
async fn codigo_errado_recebe_recusado() {
    let (addr, _) = servidor().await;
    let mut s = TcpStream::connect(addr).await.unwrap();
    mandar(&mut s, controle(json!({"t":"ola","v":1,"pareamento":{"codigo":"000000"}}))).await;
    let Some(Mensagem::Controle(r)) = ler_async(&mut s).await.unwrap() else { panic!() };
    assert_eq!(r["t"], "recusado");
    // e o computador fecha
    assert!(ler_async(&mut s).await.unwrap().is_none());
}
