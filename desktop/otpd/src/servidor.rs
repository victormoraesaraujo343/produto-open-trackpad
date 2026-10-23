//! Laço de rede: aceita conexões, lê mensagens, entrega à `Sessao` e escreve respostas.
//!
//! Cada conexão tem uma tarefa de leitura (dona da `Sessao`) e uma de escrita, ligadas
//! por um canal; assim o computador pode mandar mensagens a qualquer hora (nível,
//! estado, telas) sem esperar o celular falar. Genérico em `AsyncRead`/`AsyncWrite` para
//! servir TCP puro (cabo, 127.0.0.1) e TLS (Wi-Fi) com o mesmo código.

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::json;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::mpsc;

use crate::pareamento::Pareamento;
use crate::protocolo::{self, controle, Mensagem, MAX_CONTROLE_CELULAR};
use crate::sessao::{Computador, Extensao, SaidaCompartilhada, Sessao};

/// Silêncio máximo do celular (ele manda PING a cada 3 s).
pub const SILENCIO_MAXIMO: Duration = Duration::from_secs(15);
/// De quanto em quanto tempo o computador mede o atraso.
pub const INTERVALO_MEDIDA: Duration = Duration::from_secs(3);
/// Quanto o celular manda para medir a vazão (na abertura).
pub const BYTES_MEDIDA: usize = 256 * 1024;

/// O que o servidor precisa para atender conexões.
#[derive(Clone)]
pub struct Contexto {
    pub saida: SaidaCompartilhada,
    pub pareamento: Arc<Mutex<Pareamento>>,
    pub computador: Computador,
    /// Cria as extensões de cada sessão nova.
    pub extensoes: Arc<dyn Fn() -> Vec<Box<dyn Extensao>> + Send + Sync>,
}

pub async fn ler_async<R: AsyncRead + Unpin>(r: &mut R) -> std::io::Result<Option<Mensagem>> {
    let mut cab = [0u8; 2];
    match r.read_exact(&mut cab).await {
        Ok(_) => {}
        Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let len = u16::from_be_bytes(cab) as usize;
    let mut corpo = vec![0u8; len];
    r.read_exact(&mut corpo).await?;
    let mut tudo = Vec::with_capacity(len + 2);
    tudo.extend_from_slice(&cab);
    tudo.extend_from_slice(&corpo);
    protocolo::ler(&mut tudo.as_slice(), MAX_CONTROLE_CELULAR)
}

/// Atende uma conexão até ela acabar. Sempre solta tudo no fim.
pub async fn atender<S>(stream: S, ctx: Contexto, via: &'static str)
where
    S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    let (mut leitor, mut escritor) = tokio::io::split(stream);
    let (tx, mut rx) = mpsc::channel::<Mensagem>(256);

    let escrita = tokio::spawn(async move {
        while let Some(m) = rx.recv().await {
            let Ok(bytes) = protocolo::codificar(&m) else { continue };
            if escritor.write_all(&bytes).await.is_err() {
                break;
            }
        }
        let _ = escritor.shutdown().await;
    });

    let mut sessao = Sessao::nova(ctx.saida.clone(), ctx.pareamento.clone(), ctx.computador.clone());
    for e in (ctx.extensoes)() {
        sessao = sessao.com_extensao(e);
    }

    let mut medida = tokio::time::interval(INTERVALO_MEDIDA);
    let mut nonce: u32 = 0;
    let mut enviado: Option<(u32, Instant)> = None;
    let mut rtts: Vec<f64> = Vec::new();
    let mut ultimo_nivel: Option<u8> = None;
    // Vazão: na abertura o computador pede `medir` e cronometra a CARGA que volta.
    let mut vazao: Option<f64> = None;
    let mut medindo: Option<(Instant, usize)> = None;

    loop {
        tokio::select! {
            lido = tokio::time::timeout(SILENCIO_MAXIMO, ler_async(&mut leitor)) => {
                let m = match lido {
                    Err(_) => { eprintln!("[{via}] silêncio de {}s: conexão encerrada", SILENCIO_MAXIMO.as_secs()); break }
                    Ok(Ok(Some(m))) => m,
                    Ok(Ok(None)) => break,
                    Ok(Err(e)) => { eprintln!("[{via}] erro de leitura: {e}"); break }
                };
                if let Mensagem::Carga(d) = &m {
                    if let Some((t0, recebido)) = medindo.as_mut() {
                        *recebido += d.len() + 3;
                        if *recebido >= BYTES_MEDIDA {
                            let s = t0.elapsed().as_secs_f64().max(1e-4);
                            vazao = Some((*recebido as f64 * 8.0 / s / 1e6).min(1000.0));
                            medindo = None;
                            medida.reset_immediately();
                        }
                    }
                }
                if let Mensagem::Pong { nonce: n, .. } = &m {
                    if let Some((esperado, t0)) = enviado {
                        if *n == esperado {
                            rtts.push(t0.elapsed().as_secs_f64() * 1000.0);
                            enviado = None;
                        }
                    }
                }
                let abria = sessao.aberta();
                match sessao.receber(m) {
                    Ok(respostas) => {
                        for r in respostas {
                            if tx.send(r).await.is_err() { break }
                        }
                    }
                    Err(e) => { eprintln!("[{via}] protocolo: {e}"); break }
                }
                for linha in sessao.log.drain(..) {
                    eprintln!("[{via}] {linha}");
                }
                if !abria && sessao.aberta() {
                    eprintln!("[{via}] celular conectado ({:?})", sessao.fase);
                    medindo = Some((Instant::now(), 0));
                    let _ = tx.send(controle(json!({"t":"medir","bytes":BYTES_MEDIDA}))).await;
                    medida.reset_immediately();
                }
                if matches!(sessao.fase, crate::sessao::Fase::Fechada) { break }
            }
            _ = medida.tick(), if sessao.aberta() => {
                // Mediana das 5 últimas amostras de RTT; a vazão vem da medida da abertura.
                if rtts.len() >= 5 { rtts.drain(..rtts.len() - 5); }
                if let (Some(rtt), Some(mbps)) = (mediana(&rtts), vazao) {
                    let mbps = (mbps * 10.0).round() / 10.0;
                    let n = protocolo::nivel_de(mbps, rtt);
                    if ultimo_nivel != Some(n) {
                        ultimo_nivel = Some(n);
                        let _ = tx.send(controle(json!({"t":"nivel","n":n,"rtt_ms":(rtt * 10.0).round() / 10.0,"mbps":mbps,"via":via}))).await;
                    }
                }
                nonce = nonce.wrapping_add(1);
                enviado = Some((nonce, Instant::now()));
                let t_us = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_micros() as u64).unwrap_or(0);
                let _ = tx.send(Mensagem::Ping { nonce, t_us }).await;
            }
        }
    }

    sessao.encerrar();
    for linha in sessao.log.drain(..) {
        eprintln!("[{via}] {linha}");
    }
    eprintln!("[{via}] celular desconectado; dedos, botões e teclas soltos");
    drop(tx);
    let _ = escrita.await;
}

fn mediana(v: &[f64]) -> Option<f64> {
    if v.is_empty() {
        return None;
    }
    let mut s = v.to_vec();
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    Some(s[s.len() / 2])
}

/// Escuta só em 127.0.0.1 (cabo via `adb reverse`): sem TLS, o tráfego não sai da máquina.
pub async fn escutar_cabo(porta: u16, ctx: Contexto) -> std::io::Result<()> {
    let endereco: SocketAddr = ([127, 0, 0, 1], porta).into();
    let listener = TcpListener::bind(endereco).await?;
    eprintln!("ouvindo o cabo em {endereco}");
    loop {
        let (sock, de) = listener.accept().await?;
        let _ = sock.set_nodelay(true);
        eprintln!("[cabo] conexão de {de}");
        tokio::spawn(atender(sock, ctx.clone(), "cabo"));
    }
}
