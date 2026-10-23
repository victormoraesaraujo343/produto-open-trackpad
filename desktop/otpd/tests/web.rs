//! Tela de parear (HTTP em 127.0.0.1) e texto do QR.

use std::net::Ipv4Addr;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use otpd::pareamento::{Pareamento, Resultado};
use otpd::web::{qr_svg, servir_em, texto_do_qr, EstadoWeb};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

/// Sobe a tela numa porta livre de 127.0.0.1. Devolve a porta.
async fn subir(pareamento: Pareamento, codigo: &str) -> u16 {
    let estado = EstadoWeb {
        pareamento: Arc::new(Mutex::new(pareamento)),
        hosts: Arc::new(|| vec![Ipv4Addr::new(192, 168, 0, 10)]),
        porta_wifi: 47801,
        impressao: Arc::new(Mutex::new("ab".repeat(32))),
        nome: "KiwiPC".to_owned(),
        codigo_atual: Arc::new(Mutex::new((codigo.to_owned(), Instant::now()))),
    };
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let porta = listener.local_addr().unwrap().port();
    tokio::spawn(servir_em(listener, estado));
    porta
}

async fn subir_com_codigo() -> (u16, String) {
    let mut p = Pareamento::em_memoria();
    let codigo = p.novo_codigo();
    let porta = subir(p, &codigo).await;
    (porta, codigo)
}

struct Resposta {
    status: u16,
    cabecalhos: String,
    corpo: String,
}

async fn pedir(porta: u16, requisicao: &str) -> Resposta {
    let mut s = TcpStream::connect(("127.0.0.1", porta)).await.unwrap();
    s.write_all(requisicao.as_bytes()).await.unwrap();
    let mut bruta = Vec::new();
    s.read_to_end(&mut bruta).await.unwrap();
    let texto = String::from_utf8_lossy(&bruta).into_owned();
    let (cab, corpo) = texto.split_once("\r\n\r\n").expect("resposta HTTP sem cabeçalhos");
    let status = cab.split(' ').nth(1).unwrap().parse().unwrap();
    Resposta { status, cabecalhos: cab.to_owned(), corpo: corpo.to_owned() }
}

fn get(caminho: &str) -> String {
    format!("GET {caminho} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n")
}

fn post(caminho: &str, origem: Option<&str>) -> String {
    let linha = origem.map(|o| format!("Origin: {o}\r\n")).unwrap_or_default();
    format!("POST {caminho} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 0\r\n{linha}\r\n")
}

async fn codigo_do_estado(porta: u16) -> String {
    let r = pedir(porta, &get("/estado.json")).await;
    assert_eq!(r.status, 200);
    let v: serde_json::Value = serde_json::from_str(&r.corpo).unwrap();
    v["codigo"].as_str().unwrap().to_owned()
}

#[tokio::test]
async fn pagina_inicial_responde() {
    let (porta, _) = subir_com_codigo().await;
    let r = pedir(porta, &get("/")).await;
    assert_eq!(r.status, 200);
    assert!(r.corpo.contains("Parear um celular"));
    assert!(r.cabecalhos.contains("Cache-Control: no-store"));
    assert!(r.cabecalhos.contains("X-Frame-Options: DENY"));
}

#[tokio::test]
async fn qr_e_svg() {
    let (porta, _) = subir_com_codigo().await;
    let r = pedir(porta, &get("/qr.svg")).await;
    assert_eq!(r.status, 200);
    assert!(r.corpo.starts_with("<?xml") || r.corpo.starts_with("<svg"));
}

#[tokio::test]
async fn estado_traz_o_codigo_e_o_qr() {
    let (porta, codigo) = subir_com_codigo().await;
    let r = pedir(porta, &get("/estado.json")).await;
    assert_eq!(r.status, 200);
    let v: serde_json::Value = serde_json::from_str(&r.corpo).unwrap();
    assert_eq!(v["codigo"], codigo.as_str());
    assert!(v["expira_em_s"].as_u64().unwrap() > 0);
    assert_eq!(v["aparelhos"], serde_json::json!([]));
    let qr = v["qr"].as_str().unwrap();
    assert!(qr.starts_with("otp1:?h=192.168.0.10&p=47801&fp="));
    assert!(qr.ends_with(&format!("&c={codigo}&n=KiwiPC")));
}

#[tokio::test]
async fn novo_codigo_sem_origem_e_recusado() {
    let (porta, codigo) = subir_com_codigo().await;
    let r = pedir(porta, &post("/novo-codigo", None)).await;
    assert_eq!(r.status, 403);
    assert_eq!(codigo_do_estado(porta).await, codigo);
}

#[tokio::test]
async fn novo_codigo_com_origem_troca_o_codigo() {
    let (porta, antes) = subir_com_codigo().await;
    let origem = format!("http://127.0.0.1:{porta}");
    let r = pedir(porta, &post("/novo-codigo", Some(&origem))).await;
    assert_eq!(r.status, 303);
    assert!(r.cabecalhos.contains("Location: /"));
    // Um código de 6 dígitos sorteado de novo coincide com probabilidade 1e-6.
    assert_ne!(codigo_do_estado(porta).await, antes);
}

#[tokio::test]
async fn novo_codigo_com_sec_fetch_site_do_mesmo_site() {
    let (porta, antes) = subir_com_codigo().await;
    let req = "POST /novo-codigo HTTP/1.1\r\nHost: 127.0.0.1\r\nSec-Fetch-Site: same-origin\r\nContent-Length: 0\r\n\r\n";
    let r = pedir(porta, req).await;
    assert_eq!(r.status, 303);
    assert_ne!(codigo_do_estado(porta).await, antes);
}

#[tokio::test]
async fn origem_de_outro_site_e_recusada() {
    let (porta, codigo) = subir_com_codigo().await;
    let r = pedir(porta, &post("/novo-codigo", Some("http://evil.example"))).await;
    assert_eq!(r.status, 403);
    assert_eq!(codigo_do_estado(porta).await, codigo);
}

#[tokio::test]
async fn rota_inventada_da_404() {
    let (porta, _) = subir_com_codigo().await;
    let r = pedir(porta, &get("/nada-aqui")).await;
    assert_eq!(r.status, 404);
}

#[tokio::test]
async fn esquecer_aparelho_e_lista_atualiza() {
    let mut p = Pareamento::em_memoria();
    let codigo = p.fixar_codigo("123456");
    let Resultado::Novo { id, .. } = p.com_codigo(&codigo, "Celular <teste>") else {
        panic!("deveria parear")
    };
    let porta = subir(p, "000000").await;

    // O nome aparece escapado na página.
    let pagina = pedir(porta, &get("/")).await;
    assert!(pagina.corpo.contains("Celular &lt;teste&gt;"));
    assert!(!pagina.corpo.contains("Celular <teste>"));

    let r = pedir(porta, &get("/estado.json")).await;
    let v: serde_json::Value = serde_json::from_str(&r.corpo).unwrap();
    assert_eq!(v["aparelhos"][0]["id"], id.as_str());
    assert_eq!(v["aparelhos"][0]["nome"], "Celular <teste>");

    let origem = format!("http://127.0.0.1:{porta}");
    let r = pedir(porta, &post(&format!("/esquecer?id={id}"), Some(&origem))).await;
    assert_eq!(r.status, 303);

    let r = pedir(porta, &get("/estado.json")).await;
    let v: serde_json::Value = serde_json::from_str(&r.corpo).unwrap();
    assert_eq!(v["aparelhos"], serde_json::json!([]));
}

#[tokio::test]
async fn esquecer_sem_origem_e_recusado() {
    let mut p = Pareamento::em_memoria();
    let codigo = p.fixar_codigo("123456");
    let Resultado::Novo { id, .. } = p.com_codigo(&codigo, "Celular") else {
        panic!("deveria parear")
    };
    let porta = subir(p, "000000").await;
    let r = pedir(porta, &post(&format!("/esquecer?id={id}"), None)).await;
    assert_eq!(r.status, 403);
    let r = pedir(porta, &get("/estado.json")).await;
    let v: serde_json::Value = serde_json::from_str(&r.corpo).unwrap();
    assert_eq!(v["aparelhos"][0]["id"], id.as_str());
}

#[test]
fn texto_do_qr_escapa_o_nome() {
    let hosts = [Ipv4Addr::new(192, 168, 0, 10), Ipv4Addr::new(10, 0, 0, 5)];
    let texto = texto_do_qr(&hosts, 47801, "abcd", "428913", "Kiwi PC é");
    assert_eq!(texto, "otp1:?h=192.168.0.10,10.0.0.5&p=47801&fp=abcd&c=428913&n=Kiwi%20PC%20%C3%A9");
}

#[test]
fn texto_do_qr_sem_hosts_leva_so_codigo_e_nome() {
    let texto = texto_do_qr(&[], 47801, "abcd", "428913", "KiwiPC");
    assert_eq!(texto, "otp1:?c=428913&n=KiwiPC");
}

#[test]
fn texto_do_qr_sem_impressao_leva_so_codigo_e_nome() {
    let hosts = [Ipv4Addr::new(192, 168, 0, 10)];
    let texto = texto_do_qr(&hosts, 47801, "", "428913", "KiwiPC");
    assert_eq!(texto, "otp1:?c=428913&n=KiwiPC");
}

#[test]
fn qr_svg_e_um_svg() {
    let svg = qr_svg("otp1:?c=428913&n=KiwiPC");
    assert!(svg.starts_with("<?xml") || svg.starts_with("<svg"));
    assert!(svg.contains("#151618"));
    assert!(svg.contains("#DDE0DC"));
}

#[tokio::test]
async fn host_de_fora_e_recusado() {
    // DNS rebinding: um nome qualquer apontado para 127.0.0.1.
    let (porta, _) = subir_com_codigo().await;
    let r = pedir(porta, "GET /estado.json HTTP/1.1\r\nHost: malicioso.example:47802\r\n\r\n").await;
    assert_eq!(r.status, 421);
}
