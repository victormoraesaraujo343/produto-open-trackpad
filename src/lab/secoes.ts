/* Seções e variações do painel de Refinamento — rodada R1 (telas-chave).
   A PRIMEIRA opção de cada variação é a proposta; as outras são alternativas reais.
   Nenhuma reproduz tela da v1: da v1 só vem a identidade (cores, materiais, tipografia).
   Cada seção é marcada na tela com data-lab="<n>"; a variação é lida com useVariante('<chave>').
   Protocolo do painel: laboratorio/refinamento/README.md */

export const SECOES = [
  { n: '1', nome: 'Acabamento' },
  { n: '2', nome: 'Trackpad principal' },
  { n: '3', nome: 'Trocar de modo' },
  { n: '4', nome: 'Painel de atalhos' },
  { n: '5', nome: 'Tela espelhada e modos de toque' },
  { n: '6', nome: 'Parear pela primeira vez' },
  { n: '7', nome: 'Estado da conexão' },
  { n: '8', nome: 'Central do computador' },
  { n: '9', nome: 'Ver na prática: teclas presas (nas laterais)' },
  { n: '10', nome: 'Ver na prática: botão giratório' },
  { n: '11', nome: 'Mesa de som: saídas, entradas e apps' },
  { n: '12', nome: 'Ver na prática: botões de volume do celular' },
  { n: '13', nome: 'Ver na prática: modo travado' },
  { n: '14', nome: 'Teclado e voz' },
  { n: '15', nome: 'Mesa digitalizadora' },
  { n: '16', nome: 'Mídia, janelas e abrir' },
  { n: '17', nome: 'Reunião' },
  { n: '18', nome: 'Zonas no trackpad' },
  { n: '19', nome: 'Segundo monitor' },
  { n: '20', nome: 'Uma janela e recorte' },
  { n: '21', nome: 'Monitor vertical' },
  { n: '22', nome: 'Painel de informações' },
  { n: '23', nome: 'Tela de descanso' },
  { n: '24', nome: 'Área de transferência' },
  { n: '25', nome: 'Câmera e microfone do celular' },
  { n: '26', nome: 'Vários computadores' },
  { n: '27', nome: 'Ajustes do celular' },
  { n: '28', nome: 'Aparelho dedicado: escurecer, bateria, calor, noturno' },
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
  descanso: { secao: '23', rotulo: 'Descanso', opcoes: [['painel', 'Painel de informações, escurecido'], ['relogio', 'Só o relógio']] },
} satisfies Record<string, { secao: string; rotulo: string; opcoes: [string, string][] }>

export type ChaveVariante = keyof typeof VARIANTES
