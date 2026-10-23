# Fase 3: apps de verdade (Linux + Android), numa tacada só

Plano estratégico. O plano tarefa a tarefa (com código) é escrito no dia em que a fase começar,
depois da rodada de apontamentos do Victor no laboratório, porque ela ainda muda as telas.

## Objetivo
Ao fim: um APK instalável (Android 9+) e um app de Linux que, juntos, fazem o celular funcionar como
trackpad nativo e entregam as outras funções na ordem em que a conexão permite (L → M → P). Tudo
desenvolvido e testado sem plugar o celular do Victor; o celular real só entra na prova final de sensação.

## Decisões técnicas (minhas)
| Peça | Escolha | Por quê |
|---|---|---|
| Serviço no Linux | Rust | Rápido, baixo consumo, mesmo código depois serve Windows e macOS; o núcleo de trackpad da v0.2 (uinput) já era Rust e os aprendizados entram de novo. |
| Telas do computador (central, bandeja, pareamento, gravador) | Tauri + as telas React do protótipo | Reaproveita o front que já fizemos quase direto; o app final fica pequeno. |
| App Android | Kotlin + Jetpack Compose, nativo | O trackpad precisa de toque sem atraso; nativo é o único jeito confiável. As telas são redesenhadas em Compose a partir do protótipo (mesmos tokens, ícones e medidas). |
| Trackpad no Linux | touchpad virtual (uinput) | O Linux enxerga um trackpad de verdade: gestos, rolagem e aceleração nativos do GNOME/KDE. |
| Conexão | Wi-Fi (descoberta automática na rede) + cabo pelo ADB no começo | Dá para testar tudo no emulador. Cabo sem "modo desenvolvedor" (AOA) e celular como roteador vêm depois. |
| Espelhar / segundo monitor | PipeWire (captura e monitor virtual do próprio GNOME/KDE) + vídeo H.264 | O computador faz o trabalho pesado; o celular só decodifica. |
| Som, mixer, câmera, microfone | PipeWire | Padrão atual do Linux. |

## Ambiente (eu preparo, ~30 min, antes de qualquer código)
- Rust (rustup), JDK 21 (o Gradle não roda com o JDK 25 instalado), dependências do Tauri.
- Android SDK já existe em `~/Android/Sdk`; falta o emulador e duas imagens: Android 9 (o mínimo
  suportado) e Android 15 (atual). Android Studio é opcional: o emulador abre sozinho numa janela.
- Acesso ao `/dev/uinput` para o usuário (regra udev), sem precisar de root para testar.

## Como testar sem o celular
- O emulador abre o app numa janela. Arrastar o mouse nele move o cursor **do computador de verdade**
  (o emulador alcança o computador pela rede interna dele e pelo ADB, igual ao cabo).
- Gestos de vários dedos não dão para fazer com mouse: são testados por toques injetados por script no
  emulador, e o lado do Linux confere com as ferramentas do libinput se o gesto chegou como gesto nativo.
- Testes automáticos dos dois lados rodam a cada tarefa; cada onda termina com um passeio no emulador.
- O que o emulador **não** prova: sensação real do toque, vibração, cabo físico, celular como roteador.
  Isso fica para uma prova final de ~1 hora com o celular.

## Ondas
Cada onda termina com algo que o Victor consegue usar no emulador.

0. **Contrato** (Opus): estrutura do repositório (`prototipo/`, `desktop/`, `android/`), protocolo de
   mensagens entre celular e computador com testes, e a lista de telas a portar. Tudo o que vem
   depois depende disso, então não vai para os Haiku.
1. **Trackpad de ponta a ponta** (nível L): pareamento com código, conexão Wi-Fi e cabo, trackpad
   nativo com gestos, cliques, laterais, menu de modos, teclado, teclas presas, volume, trava.
   *Prova:* usar o computador só pelo emulador.
2. **Funções leves e médias** (L/M): atalhos e atalhos por app, mixer, mídia, ícones de janelas,
   painel de informações, monitor de recursos com dados reais, descanso, central do computador,
   bandeja, gravador de atalhos, transferência de arquivos.
3. **Funções pesadas** (P): espelhar, segundo monitor (deitado e em pé), recorte, câmera e microfone
   do celular no computador.
4. **Empacotar**: APK assinado + pacote para Fedora (rpm) e AppImage; prova final com o celular.

Dentro de cada onda, Android e Linux andam em paralelo (o contrato da onda 0 é o que os mantém
compatíveis).

## Como os agentes trabalham (economia de tokens)
- **Opus (eu):** escreve o contrato e as partes difíceis (touchpad virtual, vídeo, monitor virtual,
  descoberta na rede), quebra o resto em tarefas pequenas e fechadas, e **revisa cada entrega**:
  roda os testes, lê o código contra a tarefa e o spec, devolve correções.
- **Haiku 5.5:** escreve o grosso: telas Compose, telas Tauri, ligações entre telas e serviço,
  mensagens do protocolo, testes. Uma tarefa por agente, com arquivos e critérios de aceite explícitos.
- Regra: tarefa que o Haiku errar duas vezes sobe para Opus (refazer custa mais que fazer certo).
- Haiku nunca decide desenho de tela: segue o protótipo e os tokens. Dúvida de produto vem para o Victor.

## Riscos conhecidos
- **GNOME no Wayland esconde qual janela está em foco** (precisa de uma extensão do GNOME para os
  ícones de janelas e atalhos por app). No KDE isso é bem mais simples.
- Segundo monitor depende da versão do GNOME/KDE oferecer monitor virtual (as atuais oferecem).
- Multitoque e sensação só se validam de verdade no celular.
