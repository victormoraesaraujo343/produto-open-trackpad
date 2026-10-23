//! Tela de parear no computador: HTTP/1.1 só em `127.0.0.1` (porta 47802), para abrir no
//! navegador do próprio computador. Mostra o QR, o código de uso único e os aparelhos de
//! confiança. Sem crate de HTTP: cada conexão atende uma requisição e fecha.

use std::net::Ipv4Addr;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use qrcode::render::{svg, Renderer};
use qrcode::QrCode;
use serde_json::json;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

use crate::pareamento::Pareamento;

/// Porta da tela de parear (só em 127.0.0.1).
pub const PORTA_PAREAMENTO: u16 = 47802;
/// Tamanho máximo do bloco de cabeçalhos.
const LIMITE_CABECALHOS: usize = 8 * 1024;
/// Tempo máximo para a requisição chegar inteira.
const TEMPO_LIMITE: Duration = Duration::from_secs(5);
/// SVG usado se o texto não couber num QR (nunca acontece com nomes razoáveis).
const SVG_VAZIO: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"/>"#;

/// O que a tela precisa para mostrar e agir. Clonável: uma cópia por conexão.
#[derive(Clone)]
pub struct EstadoWeb {
    pub pareamento: Arc<Mutex<Pareamento>>,
    /// IPv4 do computador na rede local, na hora do pedido (a rede pode mudar).
    pub hosts: Arc<dyn Fn() -> Vec<Ipv4Addr> + Send + Sync>,
    pub porta_wifi: u16,
    /// Impressão digital do certificado TLS (hex). Vazia: o QR leva só o código.
    pub impressao: Arc<Mutex<String>>,
    pub nome: String,
    /// Último código gerado e quando saiu.
    pub codigo_atual: Arc<Mutex<(String, Instant)>>,
}

/// Texto do QR do pareamento (ver `protocolo/README.md`, seção "QR do pareamento").
pub fn texto_do_qr(hosts: &[Ipv4Addr], porta: u16, impressao: &str, codigo: &str, nome: &str) -> String {
    let mut texto = String::from("otp1:?");
    if !hosts.is_empty() && !impressao.is_empty() {
        let lista: Vec<String> = hosts.iter().map(|h| h.to_string()).collect();
        texto.push_str(&format!("h={}&p={porta}&fp={impressao}&", lista.join(",")));
    }
    texto.push_str(&format!("c={codigo}&n={}", escapar_url(nome)));
    texto
}

/// SVG do QR: cores do acabamento escuro, margem de 2 módulos, pelo menos 240 px.
pub fn qr_svg(texto: &str) -> String {
    let Ok(codigo) = QrCode::new(texto.as_bytes()) else {
        return SVG_VAZIO.to_owned();
    };
    let modulos = codigo.to_colors();
    Renderer::<svg::Color>::new(&modulos, codigo.width(), 2)
        .dark_color(svg::Color("#151618"))
        .light_color(svg::Color("#DDE0DC"))
        .min_dimensions(240, 240)
        .build()
}

/// Sobe a tela numa porta de 127.0.0.1. Não retorna, salvo erro ao abrir a porta.
pub async fn servir(porta: u16, estado: EstadoWeb) -> std::io::Result<()> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, porta)).await?;
    servir_em(listener, estado).await
}

/// Igual a `servir`, com um ouvinte já aberto (testes usam a porta 0). Recusa ouvinte que
/// não seja de loopback.
pub async fn servir_em(listener: TcpListener, estado: EstadoWeb) -> std::io::Result<()> {
    let endereco = listener.local_addr()?;
    if !endereco.ip().is_loopback() {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "a tela de parear só ouve em 127.0.0.1"));
    }
    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                tokio::spawn(atender(stream, estado.clone(), endereco.port()));
            }
            Err(e) => {
                eprintln!("[web] aceitar conexão: {e}");
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        }
    }
}

/// Uma requisição por conexão: lê os cabeçalhos, responde e fecha.
async fn atender(mut stream: TcpStream, estado: EstadoWeb, porta: u16) {
    let lido = tokio::time::timeout(TEMPO_LIMITE, ler_cabecalho(&mut stream))
        .await
        .unwrap_or(Err("408 Request Timeout"));
    let cabecalho = match lido {
        Ok(c) => c,
        Err(status) => return enviar(&mut stream, status, "text/plain; charset=utf-8", "", b"").await,
    };

    let texto = String::from_utf8_lossy(&cabecalho);
    let mut linhas = texto.split("\r\n");
    let mut partes = linhas.next().unwrap_or_default().split(' ');
    let metodo = partes.next().unwrap_or("");
    let alvo = partes.next().unwrap_or("");
    let cabs: Vec<(&str, &str)> = linhas
        .take_while(|l| !l.is_empty())
        .filter_map(|l| l.split_once(':'))
        .map(|(k, v)| (k.trim(), v.trim()))
        .collect();
    let (caminho, query) = alvo.split_once('?').unwrap_or((alvo, ""));
    let id = query.split('&').find_map(|p| p.strip_prefix("id=")).unwrap_or("");
    let origem_valida = metodo == "POST" && origem_ok(&cabs, porta);
    // Contra DNS rebinding: uma página de fora que aponte um nome para 127.0.0.1 chega
    // aqui com o próprio nome no Host; só atendemos o endereço local de verdade.
    if !host_ok(&cabs, porta) {
        return enviar(&mut stream, "421 Misdirected Request", "text/plain; charset=utf-8", "", b"").await;
    }

    let (status, tipo, extra, corpo): (&str, &str, &str, Vec<u8>) = match (metodo, caminho) {
        ("GET", "/") => {
            let pagina = pagina(&instantanea(&estado));
            ("200 OK", "text/html; charset=utf-8", CSP, pagina.into_bytes())
        }
        ("GET", "/qr.svg") => {
            let texto = instantanea(&estado).qr;
            ("200 OK", "image/svg+xml", "", qr_svg(&texto).into_bytes())
        }
        ("GET", "/estado.json") => {
            let json = estado_json(&instantanea(&estado));
            ("200 OK", "application/json; charset=utf-8", "", json.into_bytes())
        }
        ("POST", "/novo-codigo") if !origem_valida => proibido(),
        ("POST", "/novo-codigo") => {
            let codigo = trava(&estado.pareamento).novo_codigo();
            *trava(&estado.codigo_atual) = (codigo, Instant::now());
            ("303 See Other", "text/plain; charset=utf-8", "Location: /\r\n", Vec::new())
        }
        ("POST", "/esquecer") if !origem_valida => proibido(),
        ("POST", "/esquecer") => {
            trava(&estado.pareamento).esquecer(id);
            ("303 See Other", "text/plain; charset=utf-8", "Location: /\r\n", Vec::new())
        }
        _ => ("404 Not Found", "text/plain; charset=utf-8", "", "Não encontrado".as_bytes().to_vec()),
    };
    enviar(&mut stream, status, tipo, extra, &corpo).await;
}

/// Content-Security-Policy da página: só o que ela usa, tudo inline e local.
const CSP: &str = "Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'\r\n";

fn proibido() -> (&'static str, &'static str, &'static str, Vec<u8>) {
    ("403 Forbidden", "text/plain; charset=utf-8", "", "Acesso negado".as_bytes().to_vec())
}

/// Um POST só vale se veio desta origem. Com `Origin`, ele tem que bater; sem `Origin`,
/// vale `Sec-Fetch-Site: same-origin`.
fn origem_ok(cabs: &[(&str, &str)], porta: u16) -> bool {
    match cabecalho(cabs, "Origin") {
        Some(origem) => origem == format!("http://127.0.0.1:{porta}") || origem == format!("http://localhost:{porta}"),
        None => cabecalho(cabs, "Sec-Fetch-Site") == Some("same-origin"),
    }
}

fn host_ok(cabs: &[(&str, &str)], porta: u16) -> bool {
    let Some(h) = cabecalho(cabs, "Host") else { return false };
    let (nome, p) = h.rsplit_once(':').map_or((h, None), |(n, p)| (n, Some(p)));
    (nome == "127.0.0.1" || nome == "localhost") && p.is_none_or(|p| p == porta.to_string())
}

fn cabecalho<'a>(cabs: &[(&'a str, &'a str)], nome: &str) -> Option<&'a str> {
    cabs.iter().find(|(k, _)| k.eq_ignore_ascii_case(nome)).map(|(_, v)| *v)
}

/// Lê até o fim dos cabeçalhos (`\r\n\r\n`). O corpo, se houver, é ignorado.
async fn ler_cabecalho(stream: &mut TcpStream) -> Result<Vec<u8>, &'static str> {
    let mut buf = Vec::new();
    let mut parte = [0u8; 1024];
    loop {
        if buf.windows(4).any(|w| w == b"\r\n\r\n") {
            return Ok(buf);
        }
        if buf.len() >= LIMITE_CABECALHOS {
            return Err("431 Request Header Fields Too Large");
        }
        match stream.read(&mut parte).await {
            Ok(0) | Err(_) => return Err("400 Bad Request"),
            Ok(n) => buf.extend_from_slice(&parte[..n]),
        }
    }
}

async fn enviar(stream: &mut TcpStream, status: &str, tipo: &str, extra: &str, corpo: &[u8]) {
    let cab = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {tipo}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nX-Frame-Options: DENY\r\nX-Content-Type-Options: nosniff\r\n{extra}Connection: close\r\n\r\n",
        corpo.len()
    );
    let _ = stream.write_all(cab.as_bytes()).await;
    let _ = stream.write_all(corpo).await;
    let _ = stream.shutdown().await;
}

/// Foto do estado no instante do pedido.
struct Instantanea {
    codigo: String,
    expira_em_s: u64,
    aparelhos: Vec<(String, String)>,
    qr: String,
}

fn instantanea(estado: &EstadoWeb) -> Instantanea {
    let codigo = trava(&estado.codigo_atual).0.clone();
    let (expira_em_s, aparelhos) = {
        let p = trava(&estado.pareamento);
        let expira = p.validade_restante(&codigo).map_or(0, |d| d.as_secs_f64().ceil() as u64);
        let aparelhos = p.aparelhos().iter().map(|a| (a.id.clone(), a.nome.clone())).collect();
        (expira, aparelhos)
    };
    let hosts = (estado.hosts)();
    let impressao = trava(&estado.impressao).clone();
    let qr = texto_do_qr(&hosts, estado.porta_wifi, &impressao, &codigo, &estado.nome);
    Instantanea { codigo, expira_em_s, aparelhos, qr }
}

fn estado_json(i: &Instantanea) -> String {
    let aparelhos: Vec<_> = i.aparelhos.iter().map(|(id, nome)| json!({"id": id, "nome": nome})).collect();
    json!({
        "codigo": i.codigo,
        "expira_em_s": i.expira_em_s,
        "aparelhos": aparelhos,
        "qr": i.qr,
    })
    .to_string()
}

fn pagina(i: &Instantanea) -> String {
    let lista = if i.aparelhos.is_empty() {
        "<p class=\"vazio\">Nenhum aparelho ainda.</p>".to_owned()
    } else {
        let itens: String = i
            .aparelhos
            .iter()
            .map(|(id, nome)| {
                let nome = escapar_html(nome);
                format!(
                    "<li><span>{nome}</span><form method=\"post\" action=\"/esquecer?id={}\"><button type=\"submit\" aria-label=\"Esquecer {nome}\">Esquecer</button></form></li>",
                    escapar_html(id)
                )
            })
            .collect();
        format!("<ul>{itens}</ul>")
    };
    format!(
        r##"<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>Parear um celular</title>
<style>{css}</style>
</head>
<body>
<main class="cartao" data-codigo="{codigo}" data-expira="{expira}">
<h1>Parear um celular</h1>
<p class="intro">Abra o OpenTrackpad no celular e aponte a câmera para o código.</p>
<img id="qr" class="qr" src="/qr.svg" width="300" height="300" alt="Código para o celular ler">
<p id="digitos" class="digitos">{digitos}</p>
<p id="tempo" class="tempo">{tempo}</p>
<section>
<h2>Aparelhos de confiança</h2>
<div id="lista">{lista}</div>
</section>
<form method="post" action="/novo-codigo" class="acoes"><button type="submit" class="principal">Novo código</button></form>
</main>
<script>{js}</script>
</body>
</html>
"##,
        css = CSS,
        js = JS,
        codigo = escapar_html(&i.codigo),
        expira = i.expira_em_s,
        digitos = formatar_codigo(&i.codigo),
        tempo = tempo_texto(i.expira_em_s),
    )
}

fn formatar_codigo(codigo: &str) -> String {
    if codigo.len() == 6 {
        format!("{} {}", &codigo[..3], &codigo[3..])
    } else {
        codigo.to_owned()
    }
}

fn tempo_texto(expira_em_s: u64) -> String {
    if expira_em_s == 0 {
        "Código expirado. Crie outro.".to_owned()
    } else {
        format!("Vale por {}:{:02}", expira_em_s / 60, expira_em_s % 60)
    }
}

/// Escape para valores em URL: tudo fora de `A-Za-z0-9-._~` vira `%XX` (UTF-8).
fn escapar_url(texto: &str) -> String {
    let mut s = String::new();
    for b in texto.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'.' | b'_' | b'~') {
            s.push(char::from(b));
        } else {
            s.push_str(&format!("%{b:02X}"));
        }
    }
    s
}

fn escapar_html(texto: &str) -> String {
    texto
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn trava<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Cores do acabamento escuro (padrão) e claro (`prefers-color-scheme: light`), de
/// `src/design/tokens.css`.
const CSS: &str = r##"
:root {
  color-scheme: dark;
  --base: #1D1E20;
  --fundo: linear-gradient(176deg, #262729 0%, #1D1E20 46%, #151618 100%);
  --ink: #DDE0DC; --ink-2: #B6B9B5; --ink-3: #979A9E;
  --linha: #34373B;
  --foco: #FF4F1F;
  --poco: linear-gradient(180deg, #1A1B1E 0%, #1E1F22 100%);
  --tecla: linear-gradient(180deg, #2E2F34 0%, #232429 100%);
  --tecla-ink: #E6E9E5;
  --sombra: 0 12px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.30);
}
@media (prefers-color-scheme: light) {
  :root {
    color-scheme: light;
    --base: #C3C4BF;
    --fundo: linear-gradient(176deg, #CDCEC9 0%, #C3C4BF 46%, #B9BAB5 100%);
    --ink: #232624; --ink-2: #3C3F3B; --ink-3: #464945;
    --linha: #9C9D99;
    --foco: #151618;
    --poco: linear-gradient(180deg, #B6B7B2 0%, #BABBB6 100%);
    --tecla: linear-gradient(180deg, #E2E3DF 0%, #D6D7D3 100%);
    --tecla-ink: #1F221D;
    --sombra: 0 10px 20px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.10);
  }
}
* { box-sizing: border-box; }
html { background: var(--base); }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--fundo) var(--base);
  color: var(--ink);
  font-family: Archivo, 'Helvetica Neue', Arial, sans-serif;
  font-size: 16px;
  line-height: 1.4;
}
.cartao {
  max-width: 480px;
  margin: 0 auto;
  padding: 32px 20px 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
}
h1 { margin: 0; font-size: 26px; font-weight: 600; }
h2 { margin: 0 0 12px; font-size: 18px; font-weight: 600; }
.intro { margin: 0; max-width: 36ch; color: var(--ink-2); }
.qr {
  display: block;
  width: min(78vw, 300px);
  height: auto;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  box-shadow: var(--sombra);
}
.digitos {
  margin: 4px 0 0;
  font-size: 56px;
  font-weight: 700;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
.tempo { margin: 0; min-height: 1.4em; color: var(--ink-2); }
section {
  width: 100%;
  padding-top: 22px;
  border-top: 1px solid var(--linha);
  text-align: left;
}
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  padding: 4px 4px 4px 16px;
  border-radius: 10px;
  background: var(--poco);
  color: var(--ink);
}
li form, .acoes { margin: 0; }
.vazio { margin: 0; color: var(--ink-2); }
button {
  min-height: 44px;
  min-width: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 10px;
  background: var(--tecla);
  color: var(--tecla-ink);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
button:active { transform: translateY(1px); }
.principal {
  min-width: 180px;
  background: linear-gradient(180deg, #FF6A3D 0%, #FF4F1F 100%);
  color: #121315;
}
:focus-visible { outline: 3px solid var(--foco); outline-offset: 3px; }
"##;

/// Atualiza o código e os aparelhos a cada 2 s; a contagem do tempo roda a cada 1 s.
const JS: &str = r##"
(function () {
  var main = document.querySelector('main');
  var digitos = document.getElementById('digitos');
  var tempo = document.getElementById('tempo');
  var qr = document.getElementById('qr');
  var lista = document.getElementById('lista');
  var fim = Date.now() + Number(main.dataset.expira) * 1000;
  var atual = { codigo: main.dataset.codigo, qr: null, aparelhos: null };
  var versao = 0;

  function formatar(c) {
    return c.length === 6 ? c.slice(0, 3) + ' ' + c.slice(3) : c;
  }

  function pintarTempo() {
    var falta = Math.ceil((fim - Date.now()) / 1000);
    tempo.textContent = falta > 0
      ? 'Vale por ' + Math.floor(falta / 60) + ':' + String(falta % 60).padStart(2, '0')
      : 'Código expirado. Crie outro.';
  }

  function desenharLista(itens) {
    lista.textContent = '';
    if (!itens.length) {
      var vazio = document.createElement('p');
      vazio.className = 'vazio';
      vazio.textContent = 'Nenhum aparelho ainda.';
      lista.appendChild(vazio);
      return;
    }
    var ul = document.createElement('ul');
    itens.forEach(function (a) {
      var li = document.createElement('li');
      var nome = document.createElement('span');
      nome.textContent = a.nome;
      var form = document.createElement('form');
      form.method = 'post';
      form.action = '/esquecer?id=' + encodeURIComponent(a.id);
      var botao = document.createElement('button');
      botao.type = 'submit';
      botao.textContent = 'Esquecer';
      botao.setAttribute('aria-label', 'Esquecer ' + a.nome);
      form.appendChild(botao);
      li.appendChild(nome);
      li.appendChild(form);
      ul.appendChild(li);
    });
    lista.appendChild(ul);
  }

  function aplicar(e) {
    fim = Date.now() + e.expira_em_s * 1000;
    if (e.codigo !== atual.codigo) {
      atual.codigo = e.codigo;
      digitos.textContent = formatar(e.codigo);
    }
    if (e.qr !== atual.qr) {
      atual.qr = e.qr;
      qr.src = '/qr.svg?v=' + (++versao);
    }
    var ap = JSON.stringify(e.aparelhos);
    if (ap !== atual.aparelhos) {
      atual.aparelhos = ap;
      desenharLista(e.aparelhos);
    }
    pintarTempo();
  }

  function buscar() {
    fetch('/estado.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (e) { if (e) aplicar(e); })
      .catch(function () {});
  }

  setInterval(pintarTempo, 1000);
  setInterval(buscar, 2000);
})();
"##;
