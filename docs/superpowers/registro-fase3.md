# Registro da fase 3 (apps de verdade)

Noite autônoma de 22 para 23/10/2026 no PC principal (KiwiPC-Cachy: CachyOS, KDE Plasma 6 no
Wayland, 16 núcleos, 31 GiB, teclado US internacional). Ordem de serviço:
`docs/superpowers/plans/2026-10-23-noite-fase3.md`. Rótulos de evidência como no `sistema-ia`:
**AUTOMÁTICO** (teste ou script), **EMULADOR** (provado no emulador Android 9), **PENDENTE**
(falta o celular de verdade ou o Victor).

## 1. O que funciona

| Item | Evidência |
|---|---|
| R2 do laboratório fechada (variações decididas viraram código; giratório ganhou a opção "botão do mixer") | AUTOMÁTICO: 61 testes de unidade e 108 do passeio |
| Protocolo OTP/1 (`protocolo/`), com vetores que os dois lados usam | AUTOMÁTICO: Rust e Kotlin passam nos mesmos vetores |
| Touchpad virtual: o Linux o reconhece como touchpad de verdade (`ID_INPUT_TOUCHPAD=1`, tamanho físico do celular, fuzz declarado) | AUTOMÁTICO: `udevadm info` neste PC |
| Parear pelo cabo com código; o celular guarda o segredo e reconecta sozinho | EMULADOR |
| Parear direto pelo Wi-Fi com o QR (TLS com o certificado do computador fixado; TLS 1.2 no Android 9) | EMULADOR |
| Pareado pelo cabo, tirou o cabo: volta sozinho pelo Wi-Fi, sem parear de novo | EMULADOR |
| Descoberta do computador na rede (mDNS `_opentrackpad._tcp`) | AUTOMÁTICO no computador; o celular usa quando o IP muda |
| Nível da conexão medido (atraso + vazão) e regra L/M/P igual ao protótipo | EMULADOR (deu M/P no emulador) |
| Laterais vindas do computador: atalhos do app à esquerda; Ctrl e Shift presos (toque prende/solta) e clique direito à direita | EMULADOR: Copiar chegou como Ctrl+C |
| Menu de modos em abas (aprovado), com trava e destravar segurando 3 s | EMULADOR |
| Teclado do celular (Gboard pt; ç e acentos segurando) digitando no layout do computador | EMULADOR + AUTOMÁTICO: "olá" saiu como o, l, AltGr+a no US internacional; ABNT2 testado |
| Volume do computador pelo celular (tela Volume e botões de volume do celular) | EMULADOR (com `wpctl` simulado) |
| Tela de parear no navegador do computador (QR, código, aparelhos de confiança, novo código, esquecer) | AUTOMÁTICO + conferida no navegador |
| Queda de conexão solta dedos, botões e teclas presas na hora | AUTOMÁTICO |
| **Onda 2.** Atalhos do app em foco: o KWin avisa a janela ativa e as laterais trocam (Firefox, VS Code, Figma, Spotify, OBS, Discord, DaVinci, Dolphin…) | EMULADOR + este PC: com o Dolphin em foco, o celular mostrou Renomear e Nova pasta |
| Informações e Recursos com dados reais (hora, CPU, memória, temperatura, rede; bateria quando houver), atualizando a cada segundo só quando a tela está aberta | EMULADOR + este PC |
| Mixer por app (PipeWire): volume geral, um controle por app tocando, trocar a saída de som | AUTOMÁTICO (formato real do `pactl` nas saídas; app tocando só com o formato documentado) |
| Mídia (MPRIS): capa, título, artista, tocar/pausar, próxima, anterior | AUTOMÁTICO (com um player falso no D-Bus); "Nada tocando" no emulador |
| Área de transferência (Klipper): trazer o que foi copiado no computador, mandar o que foi copiado no celular | EMULADOR (leu a área real do KDE) |
| Ícone na bandeja com o celular conectado, a via e o nível; menu para parear | este PC (registrado no StatusNotifier) |
| Tela de descanso do celular: parado 20 s, relógio que deriva devagar; qualquer toque volta | AUTOMÁTICO (lógica); falta conferir no celular |
| **Onda 3.** Espelhar a tela: H.264 pela GPU (VA-API da Radeon) ou x264, quadros fatiados, decodificação pelo hardware do celular, trackpad por cima da imagem | EMULADOR com a fonte de teste (barras de cor); a captura de verdade passa pelo diálogo do sistema (abaixo) |
| Captura da tela pelo portal do sistema, lembrando a escolha; segundo monitor como monitor virtual do KDE | PENDENTE: o código chega até o diálogo; falta você escolher a tela uma vez |
| Telas pesadas (espelho, monitor) só aparecem com conexão P; abaixo disso ficam apagadas com "conexão fraca" | EMULADOR |
| Câmera do celular como câmera do computador (nó "OpenTrackpad (câmera)" no PipeWire), com prévia no celular | EMULADOR: a imagem da câmera virtual chegou ao PipeWire (quadro capturado em `entregas/camera-no-pc.png`) |
| Microfone do celular como microfone do computador (fonte `opentrackpad_mic`) | EMULADOR: a fonte aparece, grava, e some ao desligar |
| Mesa digitalizadora: o computador vê uma mesa de verdade (`ID_INPUT_TABLET=1`), com pressão da caneta quando o celular tem; modos Desenhar e Posicionar | AUTOMÁTICO + EMULADOR |
| Fonte Archivo em todo o app | EMULADOR |
| **Onda 4.** APK de release assinado com uma chave de desenvolvimento local (3 MB) | EMULADOR: o release pareia, toca, digita e espelha |
| Instalador do serviço para o usuário (`desktop/instalar.sh`, systemd, sem sudo) | AUTOMÁTICO (instalado numa pasta descartável) |
| Pareamento resiste a força bruta: 5 códigos errados invalidam os abertos | AUTOMÁTICO |

APKs em `entregas/` (fora do git): `opentrackpad.apk` (release, assinado com a chave de
desenvolvimento em `~/.config/opentrackpad/android-dev.jks`, senha em `android/keystore.properties`,
ambos fora do git) e `opentrackpad-debug.apk`. Capturas do emulador também em `entregas/`.

## 2. Para o Victor de manhã

- Nada exigiu `sudo`: o `/dev/uinput` já está liberado para o seu usuário.
- **Instalar o serviço:** `desktop/instalar.sh --ativar` (compila, instala em `~/.local/bin/otpd`
  e liga o serviço `opentrackpad3` no login). Para só testar: `cd desktop && cargo run --release`.
  Tela de parear: http://127.0.0.1:47802 (ou o ícone na bandeja).
- **Instalar no celular:** `adb install entregas/opentrackpad.apk` (ou copie o APK para o celular).
- **Espelhar a tela pela primeira vez:** no celular, Modos → Tela → Espelho; no computador aparece o
  diálogo do KDE para escolher a tela (uma vez só: a escolha fica lembrada). O mesmo para Monitor
  (o KDE cria um monitor virtual).
  Pelo cabo: `adb reverse tcp:47800 tcp:47800` e abra o app; no Wi-Fi: "Ler o QR" na tela do app.
- **O que só o celular de verdade prova:** sensação do toque, gestos de 2/3/4 dedos (rolagem,
  trocar de área de trabalho), vibração, câmera lendo o QR.
- **A v0.2 ainda está instalada e rodando neste PC** (serviços de usuário `opentrackpad.service`,
  `opentrackpad-tray.service`, `opentrackpad-usb.service`, porta 4242). Não conflita com a nova
  (portas 47800–47802), mas são dois ícones na bandeja e o `opentrackpad-usb` faz `adb reverse`
  para a v0.2. Para desligar a antiga, quando quiser:
  `systemctl --user disable --now opentrackpad.service opentrackpad-tray.service opentrackpad-usb.service`
- **Câmera em apps que só usam V4L2** (Zoom, Chrome sem PipeWire): hoje a câmera do celular
  aparece no PipeWire (OBS, Firefox, apps com o portal de câmera veem). Para os outros, precisa do
  módulo `v4l2loopback` (pede sudo); fica para quando você quiser.
- Conferir o gesto nativo no computador (precisa de root para ler os eventos):
  `sudo libinput debug-events` com o serviço rodando e o celular ligado.

## 3. Decidido sem o Victor (revisar de manhã)

- **Laterais com largura mínima (88 dp).** O protótipo foi desenhado a 780 × 360 (≈ 2,2 : 1). Num
  celular 16:9, o centro 16:10 na altura toda deixaria laterais de ~35 dp. Nesses celulares o
  centro encolhe um pouco e mantém o formato.
- **Vista simples do monitor de recursos abre em LEDs** (era Anéis): foi a opção aprovada na R2.
- **Giratório "botão do mixer"** usa o fader do mixer. Se a ideia era um botão de girar, o
  protótipo tem um anel parado sem uso (`controle/Anel.tsx`).
- **Botões de volume do celular mudam o volume do computador** enquanto o app está aberto
  (era "ver na prática"; dá para virar ajuste).
- **Tecla de modos com ícone em cima e nome embaixo**: a lateral é estreita demais para o
  desenho em linha do protótipo.
- **Câmera da frente por padrão** (videochamada); sem ela, o app usa a de trás e avisa.
- **Tela de descanso opaca** (não escurecida pela metade): cobre a interface parada, que é o que evita marcar a tela.
- **Cabo sem TLS só em 127.0.0.1**; no Wi-Fi é TLS com o certificado fixado pelo QR.
- **Pareado pelo cabo vale no Wi-Fi**: o computador manda a impressão digital e os endereços
  logo depois de aceitar o celular, então o mesmo pareamento serve nos dois caminhos.
- **Tela de parear só responde a `127.0.0.1`/`localhost`** (proteção contra DNS rebinding) e só
  aceita ações vindas dela mesma.

## 4. Para a próxima noite

- **Central do computador** (perfis e atalhos editáveis, gravador de atalho, assistente de primeira
  vez): o plano é servir as telas React do protótipo pelo próprio serviço, ligadas a uma API local.
  Hoje só existe a tela de parear (HTML próprio, na identidade).
- **Toque direto na tela espelhada** (modo `toque`): precisa de um dispositivo de toque absoluto
  mapeado na tela certa; hoje o espelho usa o trackpad por cima.
- **Recorte, uma janela só, monitor vertical** (telas pesadas que faltam).
- **Ícones das janelas abertas** (lista de janelas por ícone): o KWin dá as janelas; falta achar o
  ícone de cada app no tema e mandar como PNG.
- **Ditado por voz** (o celular capta, o computador transcreve com um modelo local).
- **Mesa digitalizadora** (pressão) e **giratório** com vibração por passo no celular de verdade.
- **Atalhos por app** (seção 30): aprovado por enquanto, mas "tá bem ruim"; mexer em outro momento.
- Medida de vazão só na abertura; refazer quando o atraso mudar muito.
- Vídeo e câmera: o pedaço de quadro não tem número; perder um pedaço do meio só é notado no
  quadro seguinte. Sugestão do agente: pôr o índice do pedaço no protocolo.
- Câmera/microfone não desligam sozinhos se a conexão cair abaixo do nível (só ao desligar ou desconectar).
- Windows e macOS: nada ainda (o protocolo e o app Android já servem; falta o serviço de cada um).
