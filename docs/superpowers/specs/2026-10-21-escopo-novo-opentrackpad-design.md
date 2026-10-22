# OpenTrackpad — escopo do recomeço

Data: 2026-10-21. Decisões item a item registradas em
https://claude.ai/artifact/7gnDPKoxBCYuKZuA4kb5xW (101 itens: 71 Fica, 20 Talvez, 10 Sai).

## Intenção

Transformar um celular antigo num periférico do computador. O celular pode ser
Android ou iPhone; o computador pode ser Linux, Windows ou macOS; a ligação pode
ser por cabo ou por Wi-Fi.

O ponto de partida é o trackpad de verdade (o computador enxerga um touchpad,
não um mouse), mas o produto é maior que isso: painel de atalhos, tela
espelhada ou segundo monitor, e uma ponte entre os dois aparelhos.

O porquê que deve guiar decisões não escritas aqui:

- **Celular velho e fraco precisa funcionar.** O computador faz todo o trabalho
  pesado. O app do celular faz o mínimo: desenha o que o computador manda e
  devolve toques, sensores, câmera e microfone.
- **A conexão decide o que aparece.** O app mede o que a ligação aguenta e só
  mostra as funções que cabem nela. Funções pesadas (vídeo) aparecem com cabo
  rápido ou Wi-Fi recente; as leves funcionam em qualquer ligação.
- **Opcional por padrão.** Quase tudo além do básico é uma opção que se liga e
  desliga. Nas notas do dono, "sim, mas opcional" foi a resposta mais comum.

## Ordem de trabalho (decidida pelo dono)

1. **Escopo** — este documento.
2. **Front-end inteiro** — todas as telas do celular e do computador, antes de
   qualquer função real. É também onde os itens "ver na prática" são
   prototipados para o dono decidir sentindo.
3. **Fazer funcionar** — ligar as telas às funções de verdade.

## Princípios de estrutura (todos Fica)

- **Celular faz o mínimo.** Computador processa; celular desenha e devolve
  entrada.
- **O computador decide a tela do celular.** O celular é um renderizador
  genérico de telas descritas pelo computador, para que funções novas cheguem
  sem atualizar o app do celular. Isso molda o front-end: as telas do celular
  devem ser compostas a partir de um conjunto pequeno de peças reutilizáveis
  que o computador consegue descrever.
- **Nada roda sem permissão.** O celular só pede ações que o computador já
  autorizou. Ele nunca envia um comando arbitrário para ser executado.
- **Funções como extensões.** Cada função é uma peça que liga e desliga, e
  terceiros poderão criar novas.
- **Tudo local.** Nada passa pela internet nem por servidor de terceiros.

## O que entra

O nível de conexão de cada item está entre colchetes: [L] leve, qualquer
conexão; [M] médio, conexão estável; [P] pesado, cabo rápido ou Wi-Fi recente.

### Conexão e pareamento

- Cabo USB, carregando enquanto usa [L]
- Wi-Fi com descoberta automática, no estilo AirDrop [L]
- Celular como roteador: sem Wi-Fi por perto, o celular cria a rede e o computador entra nela [L]
- Conexão direta por Wi-Fi, sem roteador [L]
- Parear com QR code [L]
- Funções liberadas pela conexão (o app mede e mostra só o que cabe) [L]
- Trocar de conexão sem cair (tirou o cabo, segue no Wi-Fi) [L]
- Aparelhos de confiança, que conectam sempre depois do primeiro pareamento — **opcional** [L]
- Um celular, vários computadores — **opcional** [L]
- Vários celulares, um computador — **opcional** [L]

### Controlar o computador

- Trackpad com gestos do sistema: o computador enxerga um touchpad de verdade [L]
- Zonas no trackpad (borda rola, canto clica com o direito) — **opcional** [L]
- Clique firme: pressionar e segurar vira clique, com vibração [L]
- Teclado completo — **fica, sem prioridade** [L]
- Teclado numérico avulso [L]
- Ditado por voz: o celular só capta o áudio e o computador transcreve com um
  modelo pequeno e local, como faz o app Handy [M]
- Mesa digitalizadora, com pressão onde o celular tiver [L]
- Vibração como resposta (clique, fim da rolagem) [L]
- Lado e orientação (canhoto, de pé ou deitado, rotação travada) [L]

### Painel de atalhos

- Botões de atalho [L]
- Perfis automáticos por app em foco [L]
- Páginas e pastas [L]
- Botões que mostram estado (mudo, gravando) [M]
- Gravar atalho apertando no teclado de verdade [L]
- Perfis prontos por app (Figma, Photoshop, VS Code, DaVinci, OBS…), **editáveis
  no computador** [L]
- Importar atalhos já configurados no sistema [L]
- Lançador de apps, pastas, sites e arquivos [L]
- Mixer de áudio por app e troca de saída de som [M]
- Controle de mídia com capa [M]
- Lista de janelas abertas para trocar com um toque [M]
- Modo reunião (mutar, câmera, levantar a mão, sair) [M]
- Montar os painéis no computador; o celular só mostra [L]

### Tela

- Espelhar a tela [P]
- Segundo monitor [P]
- Uma janela só [P]
- Recorte de tela (lupa fixa, barra de ferramentas) [P]
- Monitor vertical [P]
- Qualidade que se adapta à conexão [P]
- Painel de informações (relógio, CPU, memória, temperatura, rede, bateria) [M]
- Notificações do computador no celular [M]
- Agenda e próxima reunião [M]
- Tela de descanso [M]

### Ponte entre os aparelhos

- Área de transferência compartilhada [L]
- Celular como webcam [P]
- Celular como microfone [M]

### Jeito de aparelho dedicado

- Abre sozinho ao conectar [L]
- Tela sempre pronta: não apaga em uso, escurece parada [L]
- Proteção contra marcas na tela [L]
- Cuidado com bateria e calor, incluindo limitar a carga [L]
- Modo noturno — **opcional** [L]

### App do computador

- Ícone na bandeja com estado e tipo de conexão [L]
- Central de configurações (perfis, atalhos, telas, conexões) [L]
- Assistente de primeira vez, por sistema [L]
- Diagnóstico de conexão (atraso, velocidade, o que está liberado) [L]
- Instalação simples, sem terminal [L]
- Ajuste de sensação do trackpad feito com o dedo no celular [L]

### Combinações que entram

- Com a tela espelhada, o dono **escolhe** entre dois modos e alterna entre
  eles por gesto ou botão:
  - toque direto: tocar num ponto clica ali (o celular vira tela de toque);
  - trackpad por cima: a imagem fica de fundo e o toque segue relativo, com o
    cursor desenhado na imagem.
- Segundo monitor com toque na própria tela, com o cursor passando dele para o
  monitor principal; também com escolha entre esse modo e o modo trackpad.
- Desenhar vendo a tela: mesa digitalizadora com a tela espelhada embaixo.
- Reunião completa: webcam do celular, mudo e tempo de reunião juntos.
- Colar pelo teclado do celular o que foi copiado no computador.
- Copiar num computador e colar no outro, com um celular ligado aos dois.
- Quando a conexão piora, as funções pesadas saem sem susto e o trackpad
  continua.
- Parado, o trackpad dá lugar ao painel de informações; um toque volta.

## Ver na prática (prototipar no front-end, decidir depois)

O dono só decide estes itens depois de experimentar:

- Teclas seguradas (Ctrl, Shift ou Espaço presos enquanto a outra mão usa o
  trackpad) e a combinação "tecla segurada numa borda + trackpad no resto"
- Botão giratório (volume, zoom, linha do tempo, pincel, com vibração por passo)
- Botão giratório com o mixer (girar para o volume de um app)
- Botões físicos de volume do celular como atalhos
- Modo travado (o celular não sai do app)

## Talvez (fora do primeiro corte, sem decisão)

Botões de mouse na tela, macros, ícones e cores próprios, modo transmissão
(OBS), modo apresentação e apresentação completa, monitor de prévia, enviar
arquivos, som do computador no celular, pinça como lupa na tela espelhada,
faixa de atalhos sobre a tela espelhada, tela dividida, arrastar arquivo da
tela espelhada, painel que muda sozinho conforme o contexto (se entrar, tem
que ser opcional).

## Fora (decidido)

Bluetooth, air mouse, laser virtual, controle de jogo, controle remoto de sofá,
achar o celular, bloquear o computador ao se afastar, notificações do celular
no computador, celular como scanner, jogar no celular.

## Restrições

- Plataformas do celular: Android e iPhone. Plataformas do computador: Linux,
  Windows e macOS. Nenhuma pode ser tratada como "depois" no desenho das telas.
- Celulares antigos e fracos são o público-alvo; o app do celular não pode
  depender de processamento pesado.
- Sem servidor na nuvem; toda comunicação é entre os aparelhos do dono.
- Segurança: um aparelho só controla o computador depois de pareado, e o
  computador só aceita ações que ele mesmo autorizou.

## Riscos conhecidos (não mudam o escopo, mudam o esforço)

- **Trackpad nativo varia por sistema.** No Linux já foi provado (`uinput` +
  libinput, ver o projeto anterior). No Windows exige um driver de touchpad
  virtual. No macOS os gestos nativos do sistema são os mais difíceis de
  imitar.
- **Segundo monitor exige monitor virtual em cada sistema**, e cada um faz isso
  de um jeito.
- **iPhone por cabo** não tem o atalho que o Android tem (`adb`), e o iOS é mais
  restrito com apps que ficam em segundo plano, com webcam e com microfone.
- **Algumas funções do painel dependem do ambiente gráfico** (janelas abertas,
  mixer), principalmente no Linux, onde KDE e GNOME diferem.

## O que vem do projeto anterior (v0.2)

O código antigo fica guardado como referência, não como base. Dele se
aproveitam:

- as descobertas sobre como o Linux classifica e trata um touchpad virtual
  (não declarar pressão, fuzz diferente de zero, tamanho físico real em
  micrômetros, enviar só a amostra mais recente de cada movimento, botões num
  dispositivo separado, soltar tudo quando a conexão cai);
- o caminho de toque do app Android (captura de contatos, fila que agrupa
  movimento sem perder um dedo levantado, tamanho físico da tela);
- os scripts de conexão USB e de validação com libinput.

O detalhamento está em `docs/ARCHITECTURE.md`, `docs/TESTING.md` e
`docs/RESUMING.md`, guardados na tag `v0.2-archive`.

## O que fica com quem constrói

- A divisão do front-end em telas e a navegação entre elas, respeitando os
  princípios acima.
- O visual, desde que pareça um periférico dedicado e não um app genérico.
- O formato da comunicação entre celular e computador.
- A ordem de construção dentro de cada fase.

## A fase 2 (front-end), decidida pelo dono

- **É um site interativo**, não o app de verdade: todas as telas do celular
  (dentro de uma moldura de celular deitado) e as do computador (bandeja,
  central de configurações, assistente), com dados de mentira, clicáveis e com
  os protótipos "ver na prática" funcionando no toque.
- **Identidade visual: a metalizada, e só a identidade.** A referência é o
  artifact "OpenTrackpad em Alumínio"
  (https://claude.ai/artifact/H5RKqhyPBYRie91C5CUuRt). Dele vêm **apenas**:
  cores (alumínio escuro e claro, LED verde para "ligado", laranja de
  destaque), materiais (grão do metal, bordas chanfradas, profundidade e
  sombras), tipografia (Archivo) e o traço dos ícones. **Nada das telas da
  v1 entra**: layouts, trilhos de teclas, anel de atalhos, botão redondo de
  destaque, disco, faders, organização dos painéis. As telas e os controles
  novos nascem do zero no laboratório. A identidade minimalista da v0.2
  (grafite e verde-limão) também sai.
- **Laterais fixas em volta de um centro no formato do trackpad do MacBook**
  (decisão do dono, 2026-10-21). O celular deitado é largo demais para um
  trackpad bom; o centro fica com a proporção do trackpad do MacBook (cerca de
  1,6 : 1, a mesma 16:10 da tela do computador) e sobram duas laterais com
  funções sempre à mão. Vale para o trackpad, o espelho e o segundo monitor:
  o centro troca, as laterais ficam no mesmo lugar. O **conceito** vem da v1;
  o desenho das laterais é novo, na identidade.
- **Usabilidade e acessibilidade valem acima do estilo.** Alvo de toque de
  pelo menos 48 dp no celular (44 px no computador); contraste WCAG AA (4,5:1
  para texto, 3:1 para ícones e bordas de controle); estado nunca só por cor
  (o LED vem com forma, texto ou posição); todo controle com nome acessível e
  foco visível; tudo do computador usável pelo teclado; respeitar "reduzir
  movimento" e o tamanho de fonte do sistema; vibração sempre acompanhada de
  resposta visual; o celular é usado de relance, então o que importa fica onde
  o polegar alcança e não muda de lugar.
- **Com um laboratório de refinamento**, copiado do projeto Bora Vê
  (`laboratorio/refinamento/` e `laboratorio/servidor.cjs` de lá): painel que
  abre com a tecla R, status e anotação por seção, variações lado a lado,
  alfinetes presos a um ponto da tela, antes e depois por commit, rodadas de
  revisão. É uma **cópia independente** dentro deste repositório; os dois
  projetos não compartilham nada.
- O dono não é desenvolvedor: revisa telas no laboratório, não código.

## Decisões técnicas tomadas por quem constrói (o dono pode vetar)

- **Site do protótipo:** Vite + React + TypeScript. O painel do laboratório é
  JavaScript puro e entra como está; os endpoints de desenvolvimento que no
  Bora Vê vivem no Metro passam a ser um plugin do Vite. O protótipo é
  descartável como código: o que se aproveita são as telas aprovadas, as
  peças visuais e as decisões.
- **Tecnologia dos apps de verdade** (celular e computador) fica para o início
  da fase 3, quando o protótipo já tiver mostrado o que as telas precisam.
- **Extensões:** organização interna em peças independentes desde já; API
  pública para terceiros só depois da primeira versão.
- **Linux:** KDE e GNOME no Wayland primeiro; X11 e outros ambientes depois.
- **Repositório:** a v0.2 fica guardada numa tag (`v0.2-archive`); o trabalho
  novo começa num histórico limpo no mesmo repositório.

## Em aberto (perguntas ao dono)

- ~~Trackpad nativo onde for difícil~~ **Respondido:** a meta é trackpad de
  verdade nos três sistemas (Linux, Windows e macOS). Um modo mouse só entra
  em discussão se o trackpad de verdade se provar inviável num deles; até lá,
  não se planeja plano B.
- ~~Rede própria fora de casa~~ **Respondido:** é usar o celular como roteador
  (o celular cria a rede e o computador entra nela) quando não há Wi-Fi.
  Controle pela internet, de outro lugar, não entra.
- ~~Celular mais antigo~~ **Respondido:** Android 9. Equivalente no iPhone
  (decisão de quem constrói): iOS 15, que roda do iPhone 6s em diante.
- Distribuição (lojas de apps, contas de desenvolvedor, assinatura de driver
  no Windows): decidir antes da fase 3.
