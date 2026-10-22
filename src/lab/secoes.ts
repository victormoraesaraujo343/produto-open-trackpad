/* Seções e variações do painel de Refinamento — rodada R1 (telas-chave).
   A PRIMEIRA opção de cada variação é a proposta; as outras são alternativas reais.
   Nenhuma reproduz tela da v1: da v1 só vem a identidade (cores, materiais, tipografia).
   Cada seção é marcada na tela com data-lab="<n>"; a variação é lida com useVariante('<chave>').
   Protocolo do painel: laboratorio/refinamento/README.md */

/* Agrupadas pelo uso do OpenTrackpad. O número de cada seção não muda: as anotações e o
   data-lab das telas apontam para ele. */
export const SECOES = [
  // Base visual
  { n: '1', nome: 'Acabamento', grupo: 'Base visual' },
  { n: '34', nome: 'Liga e desliga (#8)', grupo: 'Base visual' },
  { n: '35', nome: 'Rastro no trackpad (#4)', grupo: 'Base visual' },
  // Celular · laterais e navegação
  { n: '2', nome: 'Arranjo das laterais', grupo: 'Celular · laterais e navegação' },
  { n: '33', nome: 'Laterais por app (#5)', grupo: 'Celular · laterais e navegação' },
  { n: '3', nome: 'Trocar de modo', grupo: 'Celular · laterais e navegação' },
  { n: '7', nome: 'Estado da conexão', grupo: 'Celular · laterais e navegação' },
  { n: '9', nome: 'Teclas presas', grupo: 'Celular · laterais e navegação' },
  { n: '12', nome: 'Botões de volume do celular', grupo: 'Celular · laterais e navegação' },
  { n: '13', nome: 'Modo travado', grupo: 'Celular · laterais e navegação' },
  // Celular · controlar
  { n: '14', nome: 'Teclado e voz', grupo: 'Celular · controlar' },
  { n: '10', nome: 'Giratório de volume', grupo: 'Celular · controlar' },
  { n: '15', nome: 'Desenho', grupo: 'Celular · controlar' },
  { n: '18', nome: 'Zonas no trackpad', grupo: 'Celular · controlar' },
  // Celular · atalhos e som
  { n: '4', nome: 'Painel de atalhos', grupo: 'Celular · atalhos e som' },
  { n: '11', nome: 'Mesa de som', grupo: 'Celular · atalhos e som' },
  { n: '16', nome: 'Mídia, janelas e abrir', grupo: 'Celular · atalhos e som' },
  { n: '17', nome: 'Reunião', grupo: 'Celular · atalhos e som' },
  // Celular · tela
  { n: '5', nome: 'Tela espelhada', grupo: 'Celular · tela' },
  { n: '19', nome: 'Segundo monitor', grupo: 'Celular · tela' },
  { n: '20', nome: 'Uma janela e recorte', grupo: 'Celular · tela' },
  { n: '21', nome: 'Monitor vertical', grupo: 'Celular · tela' },
  { n: '22', nome: 'Painel de informações (#6)', grupo: 'Celular · tela' },
  { n: '36', nome: 'Monitor de recursos (#11)', grupo: 'Celular · tela' },
  { n: '23', nome: 'Tela de descanso (#7)', grupo: 'Celular · tela' },
  // Celular · ponte e conexão
  { n: '6', nome: 'Parear pela primeira vez', grupo: 'Celular · ponte e conexão' },
  { n: '24', nome: 'Área de transferência', grupo: 'Celular · ponte e conexão' },
  { n: '25', nome: 'Câmera e microfone', grupo: 'Celular · ponte e conexão' },
  { n: '26', nome: 'Vários computadores', grupo: 'Celular · ponte e conexão' },
  // Celular · aparelho
  { n: '27', nome: 'Ajustes do celular', grupo: 'Celular · aparelho' },
  { n: '28', nome: 'Escurecer, bateria e calor', grupo: 'Celular · aparelho' },
  // Computador
  { n: '8', nome: 'Central', grupo: 'Computador' },
  { n: '30', nome: 'Atalhos por app', grupo: 'Computador' },
  { n: '29', nome: 'Menu da bandeja', grupo: 'Computador' },
  { n: '31', nome: 'Primeira vez', grupo: 'Computador' },
  { n: '32', nome: 'Gravar atalho', grupo: 'Computador' },
]

export const VARIANTES = {
  acabamento: { secao: '1', rotulo: 'Acabamento', opcoes: [['escuro', 'Alumínio escuro'], ['claro', 'Alumínio claro'], ['escuro-pad-claro', 'Escuro com trackpad claro']] },
  trackpad: { secao: '2', rotulo: 'Laterais', opcoes: [['app-sistema', 'Esquerda: app em foco · direita: sistema'], ['uma-mao', 'Tudo numa lateral dupla, do lado da mão'], ['polegar', 'Teclas só embaixo, informação em cima']] },
  modos: { secao: '3', rotulo: 'Modos', opcoes: [['tecla', 'Tecla Modos abre o menu'], ['deslizar', 'Segurar a tecla e soltar no modo'], ['doisdedos', 'Só o gesto: dois dedos parados']] },
  atalhos: { secao: '4', rotulo: 'Atalhos', opcoes: [['grade', 'Grade de teclas'], ['largas', 'Teclas largas com a combinação'], ['grupos', 'Colunas por grupo'], ['paginas', 'Páginas de lado']] },
  espelho: { secao: '5', rotulo: 'Alternar toque', opcoes: [['lateral', 'Alternador na lateral'], ['flutuante', 'Alternador flutuante'], ['gesto', 'Três dedos alternam']] },
  pareamento: { secao: '6', rotulo: 'Parear', opcoes: [['qr', 'QR no computador'], ['lista', 'Computadores por perto'], ['passos', 'Escolher a conexão primeiro']] },
  indicador: { secao: '7', rotulo: 'Indicador', opcoes: [['led', 'LED com o tipo de conexão'], ['medidor', 'Medidor de sinal'], ['silencioso', 'Só aparece quando piora']] },
  central: { secao: '8', rotulo: 'Central', opcoes: [['lateral', 'Barra lateral'], ['abas', 'Abas no topo'], ['rack', 'Módulos lado a lado']] },
  presas: { secao: '9', rotulo: 'Teclas presas', opcoes: [['trava', 'Toque prende, toque solta'], ['segurar', 'Presa enquanto o dedo está em cima'], ['misto', 'Segurar prende; dois toques travam']] },
  giro: { secao: '10', rotulo: 'Giratório', opcoes: [['arco', 'Arco no canto do polegar'], ['aro', 'Contorno do trackpad'], ['roda', 'Roda onde o dedo pousa']] },
  mixer: { secao: '11', rotulo: 'Mesa de som', opcoes: [['vertical', 'Faders na vertical, todos os canais'], ['horizontal', 'Faders na horizontal, por grupo'], ['giratorio', 'Giratório (para comparar)']] },
  laterais: { secao: '12', rotulo: 'Botões de volume', opcoes: [['atalhos', 'Disparam atalhos'], ['legenda', 'Disparam atalhos, com legenda'], ['sistema', 'Volume do celular, como sempre']] },
  trava: { secao: '13', rotulo: 'Destravar', opcoes: [['segurar', 'Segurar 3 segundos'], ['desenho', 'Desenhar um traço'], ['sem', 'Sem trava']] },
  teclado: { secao: '14', rotulo: 'Teclado', opcoes: [['centro', 'Inteiro, entre as laterais'], ['dividido', 'Dividido para os dois polegares']] },
  lateraisTeclado: { secao: '14', rotulo: 'Laterais no teclado', opcoes: [['icones', 'Viram ícones; crescem ao tocar'], ['recolhidas', 'Recolhidas na borda; abrem por cima'], ['normais', 'Normais (para comparar)']] },
  menuModos: { secao: '3', rotulo: 'Menu de modos', opcoes: [['colunas', 'Uma coluna por grupo'], ['abas', 'Grupos como abas, modos grandes'], ['icones', 'Grade de ícones'], ['gaveta', 'Gaveta saindo da lateral']] },
  alternador: { secao: '34', rotulo: 'Liga e desliga', opcoes: [['tecla', 'Tecla de trava que afunda'], ['trilho', 'Trilho com pino'], ['segmento', 'Desl. / Lig. lado a lado'], ['basculante', 'Basculante (o atual)']] },
  rastro: { secao: '35', rotulo: 'Rastro', opcoes: [['grade', 'Grade de pontos que acende e apaga'], ['ondas', 'Ondas suaves'], ['cometa', 'Cometa que segue o dedo']] },
  estiloSimples: { secao: '36', rotulo: 'Vista simples', opcoes: [['anel', 'Anéis'], ['ponteiro', 'Ponteiros analógicos'], ['numero', 'Números grandes'], ['segmentos', 'LEDs'], ['barra', 'Barras']] },
  layoutPadrao: { secao: '36', rotulo: 'Vista padrão', opcoes: [['painel', 'Painel misto'], ['instrumentos', 'Instrumentos analógicos'], ['graficos', 'Gráficos no tempo']] },
} satisfies Record<string, { secao: string; rotulo: string; opcoes: [string, string][] }>

export type ChaveVariante = keyof typeof VARIANTES
