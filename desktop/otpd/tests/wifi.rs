//! Wi-Fi de ponta a ponta: TLS com a impressão digital fixada, como o celular faz.

use std::sync::{Arc, Mutex};

use otpd::pareamento::{hex, Pareamento};
use otpd::protocolo::{codificar, controle, Mensagem};
use otpd::saida::{Registro, Saida};
use otpd::servidor::{atender, ler_async, Contexto};
use otpd::sessao::Computador;
use otpd::wifi::Identidade;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{DigitallySignedStruct, SignatureScheme};
use serde_json::json;
use sha2::{Digest, Sha256};
use tokio::io::AsyncWriteExt;
use tokio::net::{TcpListener, TcpStream};

/// Aceita só o certificado com esta impressão digital (o que o celular faz com a do QR).
#[derive(Debug)]
struct Fixado(String, Arc<rustls::crypto::CryptoProvider>);

impl ServerCertVerifier for Fixado {
    fn verify_server_cert(&self, cert: &CertificateDer<'_>, _: &[CertificateDer<'_>], _: &ServerName<'_>, _: &[u8], _: UnixTime) -> Result<ServerCertVerified, rustls::Error> {
        if hex(&Sha256::digest(cert.as_ref())) == self.0 {
            Ok(ServerCertVerified::assertion())
        } else {
            Err(rustls::Error::General("computador desconhecido".into()))
        }
    }
    fn verify_tls12_signature(&self, m: &[u8], c: &CertificateDer<'_>, d: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls12_signature(m, c, d, &self.1.signature_verification_algorithms)
    }
    fn verify_tls13_signature(&self, m: &[u8], c: &CertificateDer<'_>, d: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls13_signature(m, c, d, &self.1.signature_verification_algorithms)
    }
    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.1.signature_verification_algorithms.supported_schemes()
    }
}

fn cliente(impressao: &str) -> tokio_rustls::TlsConnector {
    let prov = Arc::new(rustls::crypto::ring::default_provider());
    let cfg = rustls::ClientConfig::builder_with_provider(prov.clone())
        .with_safe_default_protocol_versions()
        .unwrap()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(Fixado(impressao.to_owned(), prov)))
        .with_no_client_auth();
    tokio_rustls::TlsConnector::from(Arc::new(cfg))
}

async fn servidor(id: &Identidade) -> std::net::SocketAddr {
    let saida: Box<dyn Saida> = Box::new(Registro::novo());
    let mut p = Pareamento::em_memoria();
    p.fixar_codigo("111222");
    let ctx = Contexto {
        saida: Arc::new(Mutex::new(saida)),
        pareamento: Arc::new(Mutex::new(p)),
        computador: Computador { nome: "Teste".into(), sistema: "linux".into(), ambiente: "kde".into() },
        extensoes: Arc::new(Vec::new),
    };
    let aceitador = id.aceitador().unwrap();
    let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = l.local_addr().unwrap();
    tokio::spawn(async move {
        loop {
            let (s, _) = l.accept().await.unwrap();
            let (a, c) = (aceitador.clone(), ctx.clone());
            tokio::spawn(async move {
                if let Ok(t) = a.accept(s).await {
                    atender(t, c, "wifi").await
                }
            });
        }
    });
    addr
}

#[tokio::test]
async fn tls_com_impressao_certa_pareia() {
    let id = Identidade::gerar().unwrap();
    let addr = servidor(&id).await;
    let tcp = TcpStream::connect(addr).await.unwrap();
    let mut s = cliente(&id.impressao()).connect(ServerName::try_from("opentrackpad.local").unwrap(), tcp).await.unwrap();
    s.write_all(&codificar(&controle(json!({"t":"ola","v":1,"pareamento":{"codigo":"111222"}}))).unwrap()).await.unwrap();
    let Some(Mensagem::Controle(b)) = ler_async(&mut s).await.unwrap() else { panic!() };
    assert_eq!(b["t"], "bemvindo");
    // Logo depois da abertura o computador pede a medida de vazão.
    let Some(Mensagem::Controle(m)) = ler_async(&mut s).await.unwrap() else { panic!() };
    assert_eq!(m["t"], "medir");
}

#[tokio::test]
async fn tls_com_outra_impressao_e_recusado_pelo_celular() {
    let id = Identidade::gerar().unwrap();
    let addr = servidor(&id).await;
    let tcp = TcpStream::connect(addr).await.unwrap();
    let errada = "0".repeat(64);
    assert!(cliente(&errada).connect(ServerName::try_from("opentrackpad.local").unwrap(), tcp).await.is_err());
}
