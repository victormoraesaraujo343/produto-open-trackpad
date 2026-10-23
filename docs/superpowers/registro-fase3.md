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

APK de depuração: `entregas/opentrackpad-debug.apk` (fora do git). Capturas do emulador também em `entregas/`.

## 2. Para o Victor de manhã

- Nada exigiu `sudo`: o `/dev/uinput` já está liberado para o seu usuário.
- **Rodar o serviço:** `cd desktop && cargo run --release` (ou `desktop/target/release/otpd`). Ele
  mostra o endereço da tela de parear: abra http://127.0.0.1:47802 no navegador.
- **Instalar no celular:** `adb install entregas/opentrackpad-debug.apk` (ou copie o APK para o celular).
  Pelo cabo: `adb reverse tcp:47800 tcp:47800` e abra o app; no Wi-Fi: "Ler o QR" na tela do app.
- **O que só o celular de verdade prova:** sensação do toque, gestos de 2/3/4 dedos (rolagem,
  trocar de área de trabalho), vibração, câmera lendo o QR.
- **A v0.2 ainda está instalada e rodando neste PC** (serviços de usuário `opentrackpad.service`,
  `opentrackpad-tray.service`, `opentrackpad-usb.service`, porta 4242). Não conflita com a nova
  (portas 47800–47802), mas são dois ícones na bandeja e o `opentrackpad-usb` faz `adb reverse`
  para a v0.2. Para desligar a antiga, quando quiser:
  `systemctl --user disable --now opentrackpad.service opentrackpad-tray.service opentrackpad-usb.service`
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
- **Cabo sem TLS só em 127.0.0.1**; no Wi-Fi é TLS com o certificado fixado pelo QR.
- **Pareado pelo cabo vale no Wi-Fi**: o computador manda a impressão digital e os endereços
  logo depois de aceitar o celular, então o mesmo pareamento serve nos dois caminhos.
- **Tela de parear só responde a `127.0.0.1`/`localhost`** (proteção contra DNS rebinding) e só
  aceita ações vindas dela mesma.

## 4. Pendências

- Seção 30 (atalhos por app): aprovada por enquanto, mas "tá bem ruim"; mexer em outro momento.
- Fonte Archivo no app Android (hoje usa a fonte do sistema).
- Medida de vazão só na abertura; refazer quando o atraso mudar muito.
