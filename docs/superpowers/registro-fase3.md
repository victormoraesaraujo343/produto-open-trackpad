# Registro da fase 3 (apps de verdade)

Noite autônoma de 22 para 23/10/2026 no PC principal (KiwiPC-Cachy: CachyOS, KDE Plasma no
Wayland, 16 núcleos, 31 GiB). Ordem de serviço: `docs/superpowers/plans/2026-10-23-noite-fase3.md`.
Rótulos de evidência como no `sistema-ia`: **AUTOMÁTICO** (teste ou script), **EMULADOR**
(provado no emulador), **PENDENTE** (falta o celular de verdade ou o Victor).

## 1. O que funciona

| Item | Evidência |
|---|---|
| R2 do laboratório fechada (variações decididas viraram código; giratório ganhou a opção "botão do mixer") | AUTOMÁTICO: 61 testes de unidade e 108 do passeio |
| Protocolo OTP/1 escrito, com vetores de teste que os dois lados usam (`protocolo/`) | AUTOMÁTICO: Rust e Kotlin passam nos mesmos vetores |
| Serviço do computador (`desktop/otpd`, Rust): touchpad virtual, botões, teclado, pareamento por código, sessão, servidor do cabo | AUTOMÁTICO: 33 testes |
| O Linux reconhece o dispositivo como touchpad de verdade (`ID_INPUT_TOUCHPAD=1`, 96×60 mm, fuzz declarado) | AUTOMÁTICO: `udevadm info` neste PC |
| App Android (Kotlin + Compose): trackpad 16:10 com laterais, pareamento por código, reconexão com o segredo guardado, nível da conexão | EMULADOR: Android 9 (`otp28`) |
| Celular → computador de ponta a ponta pelo cabo (`adb reverse`): parear, medir, tocar, soltar tudo na queda | EMULADOR |

## 2. Para o Victor de manhã

- Nada exigiu `sudo` até aqui: o `/dev/uinput` já está liberado para o seu usuário.
- Conferir o gesto nativo (precisa de root para ler os eventos):
  `sudo libinput debug-events` com o serviço rodando e o celular ligado.

## 3. Decidido sem o Victor (revisar de manhã)

- **Laterais com largura mínima (88 dp).** O protótipo foi desenhado a 780 × 360 (≈ 2,2 : 1).
  Num celular 16:9, o centro 16:10 na altura toda deixaria laterais de ~35 dp, finas demais
  para o polegar. Nesses celulares o centro encolhe um pouco e mantém o formato.
- **Vista simples do monitor de recursos agora abre em LEDs** (era Anéis), porque foi a opção
  aprovada na R2.
- **Giratório "botão do mixer"** usa o mesmo controle de volume do mixer (o fader horizontal
  com marcas). Se a ideia era um botão de girar, o protótipo tem um anel parado sem uso
  (`controle/Anel.tsx`).
- **Cabo sem TLS só em 127.0.0.1.** Pelo `adb reverse` o tráfego não sai do computador; no
  Wi-Fi é TLS com o certificado fixado pelo QR.

## 4. Pendências

- Seção 30 (atalhos por app): aprovada por enquanto, mas "tá bem ruim"; mexer em outro momento.
