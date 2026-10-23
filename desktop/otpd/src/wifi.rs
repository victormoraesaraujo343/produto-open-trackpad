//! Wi-Fi: TLS (1.3, ou 1.2 no Android 9) com certificado autoassinado do computador e anúncio por mDNS.
//!
//! O celular não confia em autoridade nenhuma: ele fixa a impressão digital (SHA-256 do
//! certificado) que leu no QR. Por isso o certificado é gerado uma vez e guardado; trocar
//! de certificado obriga a parear de novo.

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};
use sha2::{Digest, Sha256};
use tokio::net::TcpListener;
use tokio_rustls::TlsAcceptor;

use crate::pareamento::hex;
use crate::servidor::{atender, Contexto};

pub const SERVICO_MDNS: &str = "_opentrackpad._tcp.local.";

/// Certificado e chave do computador.
pub struct Identidade {
    pub certificado: Vec<u8>,
    chave: Vec<u8>,
}

impl Identidade {
    /// Lê de `pasta` ou gera e grava (`certificado.der`, `chave.der`, chave com 0600).
    pub fn carregar_ou_criar(pasta: &Path) -> std::io::Result<Self> {
        let (c, k) = (pasta.join("certificado.der"), pasta.join("chave.der"));
        if let (Ok(certificado), Ok(chave)) = (std::fs::read(&c), std::fs::read(&k)) {
            return Ok(Self { certificado, chave });
        }
        let id = Self::gerar()?;
        std::fs::create_dir_all(pasta)?;
        std::fs::write(&c, &id.certificado)?;
        escrever_privado(&k, &id.chave)?;
        Ok(id)
    }

    pub fn gerar() -> std::io::Result<Self> {
        let gerado = rcgen::generate_simple_self_signed(vec!["opentrackpad.local".to_owned()])
            .map_err(|e| std::io::Error::other(format!("certificado: {e}")))?;
        Ok(Self { certificado: gerado.cert.der().to_vec(), chave: gerado.key_pair.serialize_der() })
    }

    /// SHA-256 do certificado DER, hex minúsculo (vai no QR).
    pub fn impressao(&self) -> String {
        hex(&Sha256::digest(&self.certificado))
    }

    pub fn aceitador(&self) -> std::io::Result<TlsAcceptor> {
        let provedor = Arc::new(rustls::crypto::ring::default_provider());
        let config = rustls::ServerConfig::builder_with_provider(provedor)
            // 1.3 sempre que der; 1.2 porque o Android 9 não tem 1.3. Com a impressão
            // digital fixada e só suítes ECDHE, a 1.2 continua segura aqui.
            .with_protocol_versions(&[&rustls::version::TLS13, &rustls::version::TLS12])
            .map_err(std::io::Error::other)?
            .with_no_client_auth()
            .with_single_cert(
                vec![CertificateDer::from(self.certificado.clone())],
                PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(self.chave.clone())),
            )
            .map_err(std::io::Error::other)?;
        Ok(TlsAcceptor::from(Arc::new(config)))
    }
}

fn escrever_privado(caminho: &Path, dados: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let mut op = std::fs::OpenOptions::new();
    op.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        op.mode(0o600);
    }
    op.open(caminho)?.write_all(dados)
}

pub fn pasta_padrao() -> PathBuf {
    crate::pareamento::config_dir()
}

/// IPv4 desta máquina nas redes locais (sem loopback nem link-local), privados primeiro.
pub fn enderecos_locais() -> Vec<Ipv4Addr> {
    let mut v: Vec<Ipv4Addr> = if_addrs::get_if_addrs()
        .unwrap_or_default()
        .into_iter()
        .filter(|i| !i.is_loopback())
        // Interfaces de contêiner e máquina virtual não alcançam o celular.
        .filter(|i| !["docker", "br-", "veth", "virbr", "vmnet", "tailscale"].iter().any(|p| i.name.starts_with(p)))
        .filter_map(|i| match i.ip() {
            IpAddr::V4(ip) if !ip.is_link_local() => Some(ip),
            _ => None,
        })
        .collect();
    v.sort_by_key(|ip| !ip.is_private());
    v.dedup();
    v
}

/// Escuta TLS em todas as interfaces.
pub async fn escutar_wifi(porta: u16, ctx: Contexto, identidade: &Identidade) -> std::io::Result<()> {
    let aceitador = identidade.aceitador()?;
    let endereco: SocketAddr = ([0, 0, 0, 0], porta).into();
    let listener = TcpListener::bind(endereco).await?;
    eprintln!("ouvindo o Wi-Fi (TLS) em {endereco}");
    loop {
        let (sock, de) = listener.accept().await?;
        let _ = sock.set_nodelay(true);
        let (aceitador, ctx) = (aceitador.clone(), ctx.clone());
        tokio::spawn(async move {
            // Aperto de mão com prazo: conexão que não termina o TLS não segura nada.
            match tokio::time::timeout(std::time::Duration::from_secs(10), aceitador.accept(sock)).await {
                Ok(Ok(tls)) => {
                    eprintln!("[wifi] conexão de {de}");
                    atender(tls, ctx, "wifi").await
                }
                Ok(Err(e)) => eprintln!("[wifi] TLS recusado de {de}: {e}"),
                Err(_) => eprintln!("[wifi] TLS sem resposta de {de}"),
            }
        });
    }
}

/// Anuncia o serviço na rede local. Guarde o retorno: soltá-lo encerra o anúncio.
pub fn anunciar(nome: &str, porta: u16, impressao: &str) -> Result<mdns_sd::ServiceDaemon, String> {
    let daemon = mdns_sd::ServiceDaemon::new().map_err(|e| e.to_string())?;
    let ips: Vec<IpAddr> = enderecos_locais().into_iter().map(IpAddr::V4).collect();
    if ips.is_empty() {
        return Err("sem endereço na rede local".into());
    }
    let instancia: String = nome.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').take(40).collect();
    let instancia = if instancia.is_empty() { "OpenTrackpad".to_owned() } else { instancia };
    let fp16 = &impressao[..16.min(impressao.len())];
    let txt = [("v", "1"), ("nome", nome), ("fp", fp16)];
    let info = mdns_sd::ServiceInfo::new(SERVICO_MDNS, &instancia, &format!("{instancia}.local."), &ips[..], porta, &txt[..])
        .map_err(|e| e.to_string())?;
    daemon.register(info).map_err(|e| e.to_string())?;
    Ok(daemon)
}

/// Extensão que, logo depois do `bemvindo`, conta ao celular como achar este computador
/// no Wi-Fi (`{"t":"computador","fp":..,"wifi":{..}}`).
pub struct ExtensaoComputador {
    pub impressao: String,
    pub porta: u16,
    pub hosts: Arc<dyn Fn() -> Vec<Ipv4Addr> + Send + Sync>,
}

impl crate::sessao::Extensao for ExtensaoComputador {
    fn controle(&mut self, _t: &str, _m: &serde_json::Value, _r: &mut Vec<crate::protocolo::Mensagem>) -> bool {
        false
    }

    fn abertura(&mut self, r: &mut Vec<crate::protocolo::Mensagem>) {
        let hosts: Vec<String> = (self.hosts)().iter().map(|h| h.to_string()).collect();
        r.push(crate::protocolo::controle(serde_json::json!({
            "t":"computador","fp":self.impressao,"wifi":{"hosts":hosts,"porta":self.porta}
        })));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identidade_e_guardada_e_relida_igual() {
        let pasta = std::env::temp_dir().join(format!("otpd-teste-{}", hex(&crate::pareamento::aleatorio::<4>())));
        let a = Identidade::carregar_ou_criar(&pasta).unwrap();
        let b = Identidade::carregar_ou_criar(&pasta).unwrap();
        assert_eq!(a.impressao(), b.impressao());
        assert_eq!(a.impressao().len(), 64);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let modo = std::fs::metadata(pasta.join("chave.der")).unwrap().permissions().mode() & 0o777;
            assert_eq!(modo, 0o600);
        }
        let _ = std::fs::remove_dir_all(pasta);
    }

    #[test]
    fn aceitador_monta() {
        Identidade::gerar().unwrap().aceitador().unwrap();
    }
}
