//! `otpd`: o serviço do OpenTrackpad no computador.
//!
//! Uso: `otpd [--teste] [--sem-wifi] [--porta N] [--porta-wifi N] [--porta-web N] [--codigo NNNNNN]`
//! - `--teste`: não cria dispositivos nem mexe no volume; só registra os eventos no terminal.
//! - `--sem-wifi`: só o cabo (sem TLS na rede nem anúncio mDNS).
//! - `--codigo`: fixa o código de pareamento (testes com o emulador).
//! - `--video-teste`: o espelho mostra barras de cor em vez da tela (sem pedir permissão).
//!
//! Portas (ver `protocolo/README.md`): cabo 47800 em 127.0.0.1, Wi-Fi 47801 (TLS),
//! tela de parear 47802 em 127.0.0.1 (abra http://127.0.0.1:47802 no navegador).

use std::sync::{Arc, Mutex};
use std::time::Instant;

use otpd::digitar::{Digitador, ExtensaoTexto};
use otpd::painel::{self, Painel};
use otpd::pareamento::Pareamento;
use otpd::protocolo::PORTA;
use otpd::saida::{Registro, Saida};
use otpd::servidor::{escutar_cabo, Contexto};
use otpd::sessao::{Computador, Extensao, SaidaCompartilhada};
use otpd::web::{self, EstadoWeb};
use otpd::wifi::{self, ExtensaoComputador, Identidade};

/// No modo de teste o mixer lê o som de verdade (ler não muda nada) e só imprime as mudanças.
fn pactl_de_teste() -> painel::Executor {
    Box::new(|args: &[&str]| {
        let leitura = args.first() == Some(&"-f") || args.first().is_some_and(|a| a.starts_with("get-"));
        if leitura {
            let s = std::process::Command::new("pactl").args(args).output().ok()?;
            s.status.success().then(|| String::from_utf8_lossy(&s.stdout).into_owned())
        } else {
            eprintln!("    pactl {}", args.join(" "));
            Some(String::new())
        }
    })
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    let tem = |f: &str| args.iter().any(|a| a == f);
    let valor = |f: &str| args.iter().position(|a| a == f).and_then(|i| args.get(i + 1)).cloned();
    let porta_de = |f: &str, padrao: u16| valor(f).and_then(|p| p.parse().ok()).unwrap_or(padrao);

    let teste = tem("--teste");
    // Barras de cor no lugar da tela capturada (prova o vídeo sem o diálogo de permissão).
    let video_teste = tem("--video-teste");
    let sem_wifi = tem("--sem-wifi");
    let porta = porta_de("--porta", PORTA);
    let porta_wifi = porta_de("--porta-wifi", PORTA + 1);
    let porta_web = porta_de("--porta-web", web::PORTA_PAREAMENTO);

    let saida: Box<dyn Saida> = if teste {
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
    let saida: SaidaCompartilhada = Arc::new(Mutex::new(saida));
    eprintln!("{}", saida.lock().unwrap().descrever());

    let mut pareamento = if teste { Pareamento::em_memoria() } else { Pareamento::do_arquivo(Pareamento::arquivo_padrao()) };
    let codigo = match valor("--codigo") {
        Some(c) => pareamento.fixar_codigo(&c),
        None => pareamento.novo_codigo(),
    };
    let pareamento = Arc::new(Mutex::new(pareamento));

    let identidade = match Identidade::carregar_ou_criar(&wifi::pasta_padrao()) {
        Ok(i) => i,
        Err(e) => {
            eprintln!("certificado não guardado ({e}); usando um provisório");
            Identidade::gerar().expect("gerar certificado")
        }
    };
    let impressao = identidade.impressao();
    let computador = Computador::deste();
    let digitador = Digitador::do_sistema().map(Arc::new);
    match &digitador {
        Some(d) => eprintln!("texto digitado no layout {}", d.layout),
        None => eprintln!("layout do teclado não encontrado: o texto do celular não será digitado"),
    }
    let hosts: Arc<dyn Fn() -> Vec<std::net::Ipv4Addr> + Send + Sync> =
        if sem_wifi { Arc::new(Vec::new) } else { Arc::new(wifi::enderecos_locais) };

    // Tique de 1 s para as extensões que atualizam o celular (relógio, recursos…).
    let eventos = otpd::servidor::canal_de_eventos();
    {
        let eventos = eventos.clone();
        tokio::spawn(async move {
            let mut t = tokio::time::interval(std::time::Duration::from_secs(1));
            loop {
                t.tick().await;
                let _ = eventos.send(otpd::sessao::Evento::novo("tique", serde_json::Value::Null));
            }
        });
    }

    // App em foco (KDE): o KWin avisa por D-Bus; o último fica guardado para quem conectar.
    let _foco = match otpd::foco::iniciar(eventos.clone()).await {
        Ok(c) => Some(c),
        Err(e) => {
            eprintln!("app em foco indisponível ({e}); as laterais ficam com os atalhos gerais");
            None
        }
    };
    let ultimo_app: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    {
        let (mut rx, ultimo_app) = (eventos.subscribe(), ultimo_app.clone());
        tokio::spawn(async move {
            loop {
                match rx.recv().await {
                    Ok(e) if e.tipo == "foco" => *ultimo_app.lock().unwrap() = e.dados["app"].as_str().map(String::from),
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => return,
                    _ => {}
                }
            }
        });
    }
    // O que está tocando (MPRIS), lido a cada 1 s.
    let estado_midia = Arc::new(Mutex::new(None::<otpd::midia::Tocando>));
    otpd::midia::iniciar_leitor(estado_midia.clone());
    // Área de transferência (Klipper), lida a cada 1 s.
    let transferencia = otpd::transferencia::iniciar();

    // Ícone na bandeja com o estado (no modo de teste não aparece).
    if !teste {
        tokio::spawn(otpd::bandeja::iniciar(eventos.clone(), porta_web));
    }

    let ctx = {
        let (saida, digitador, impressao, hosts) = (saida.clone(), digitador.clone(), impressao.clone(), hosts.clone());
        let (ultimo_app, transferencia, estado_midia) = (ultimo_app.clone(), transferencia.clone(), estado_midia.clone());
        Contexto {
            saida: saida.clone(),
            pareamento: pareamento.clone(),
            computador: computador.clone(),
            extensoes: Arc::new(move || -> Vec<Box<dyn Extensao>> {
                let wpctl = if teste { painel::wpctl_de_teste() } else { painel::wpctl_do_sistema() };
                let mut v: Vec<Box<dyn Extensao>> = vec![
                    Box::new(ExtensaoComputador { impressao: impressao.clone(), porta: porta_wifi, hosts: hosts.clone() }),
                    Box::new(otpd::transferencia::Transferencia::nova(transferencia.clone())),
                    Box::new(otpd::infos::Informacoes::do_sistema()),
                    Box::new(otpd::midia::Midia::nova(estado_midia.clone())),
                    Box::new(if teste { otpd::mixer::Mixer::new(pactl_de_teste()) } else { otpd::mixer::Mixer::do_sistema() }),
                    Box::new(Painel::new(saida.clone(), wpctl).com_foco(ultimo_app.lock().unwrap().as_deref())),
                ];
                v.push(Box::new(otpd::video::Espelho::novo(if video_teste {
                    Box::new(|| Some(otpd::video::Fonte::Teste))
                } else {
                    Box::new(otpd::portal::abrir_tela)
                })));
                if let Some(d) = &digitador {
                    v.push(Box::new(ExtensaoTexto::nova(saida.clone(), d.clone())));
                }
                v
            }),
            eventos: eventos.clone(),
        }
    };

    // Tela de parear no navegador do computador.
    let estado_web = EstadoWeb {
        pareamento: pareamento.clone(),
        hosts: hosts.clone(),
        porta_wifi,
        impressao: Arc::new(Mutex::new(impressao.clone())),
        nome: computador.nome.clone(),
        codigo_atual: Arc::new(Mutex::new((codigo.clone(), Instant::now()))),
    };
    tokio::spawn(async move {
        if let Err(e) = web::servir(porta_web, estado_web).await {
            eprintln!("tela de parear indisponível na porta {porta_web}: {e}");
        }
    });
    eprintln!("para parear: abra http://127.0.0.1:{porta_web} (código {codigo}, vale 5 minutos, uma vez)");

    // Wi-Fi: TLS na rede local + anúncio mDNS.
    let _anuncio = if sem_wifi {
        None
    } else {
        let ctx_wifi = ctx.clone();
        tokio::spawn(async move {
            if let Err(e) = wifi::escutar_wifi(porta_wifi, ctx_wifi, &identidade).await {
                eprintln!("Wi-Fi indisponível na porta {porta_wifi}: {e}");
            }
        });
        match wifi::anunciar(&computador.nome, porta_wifi, &impressao) {
            Ok(d) => Some(d),
            Err(e) => {
                eprintln!("sem anúncio na rede local ({e}); o celular ainda acha pelo QR");
                None
            }
        }
    };

    if let Err(e) = escutar_cabo(porta, ctx).await {
        eprintln!("não deu para ouvir na porta {porta}: {e}");
        std::process::exit(1);
    }
}
