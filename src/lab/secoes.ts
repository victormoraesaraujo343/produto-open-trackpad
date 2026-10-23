/* Seções e variações do painel de Refinamento — rodada R1 (telas-chave).
   A PRIMEIRA opção de cada variação é a proposta; as outras são alternativas reais.
   Nenhuma reproduz tela da v1: da v1 só vem a identidade (cores, materiais, tipografia).
   Cada seção é marcada na tela com data-lab="<n>"; a variação é lida com useVariante('<chave>').
   Opções já decididas (acabamento, modos, presas…) viraram código fixo ou ajuste do usuário e saíram daqui.
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
  pareamento: { secao: '6', rotulo: 'Parear', opcoes: [['qr', 'QR no computador'], ['lista', 'Computadores por perto'], ['passos', 'Escolher a conexão primeiro']] },
  giro: { secao: '10', rotulo: 'Giratório', opcoes: [['dial', 'Botão grande no centro, com marcas'], ['regua', 'Régua que desliza'], ['rodinha', 'Rodinha de polegar na lateral']] },
  rastro: { secao: '35', rotulo: 'Rastro', opcoes: [['perto', 'Grade fixa; pontos maiores perto do dedo'], ['centro', 'Grade fixa; pontos maiores no centro do trackpad']] },
  transferencia: { secao: '24', rotulo: 'Copiar do celular', opcoes: [['grande', 'Botão grande com a prévia'], ['dois-lados', 'Enviar e trazer lado a lado']] },
  computadores: { secao: '26', rotulo: 'Vários computadores', opcoes: [['cartoes', 'Cartões'], ['fileira', 'Fileira com o atual em destaque']] },
  estiloSimples: { secao: '36', rotulo: 'Vista simples', opcoes: [['anel', 'Anéis'], ['ponteiro', 'Ponteiros analógicos'], ['numero', 'Números grandes'], ['segmentos', 'LEDs'], ['barra', 'Barras']] },
  layoutPadrao: { secao: '36', rotulo: 'Vista padrão', opcoes: [['painel', 'Painel misto'], ['instrumentos', 'Instrumentos analógicos'], ['graficos', 'Gráficos no tempo']] },
} satisfies Record<string, { secao: string; rotulo: string; opcoes: [string, string][] }>

export type ChaveVariante = keyof typeof VARIANTES
