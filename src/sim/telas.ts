/* Catálogo de telas. Cada tela do celular declara o nível de conexão que exige (spec).
   `conexao` é a única que existe sem conexão nenhuma. */
export type Area = 'controle' | 'atalhos' | 'tela' | 'ponte' | 'conexao' | 'ajustes' | 'aparelho'

export const TELAS_CELULAR = {
  trackpad: { nome: 'Trackpad', nivel: 1, area: 'controle' },
  atalhos: { nome: 'Atalhos', nivel: 1, area: 'atalhos' },
  espelho: { nome: 'Tela espelhada', nivel: 3, area: 'tela' },
  monitor: { nome: 'Segundo monitor', nivel: 3, area: 'tela' },
  janela: { nome: 'Uma janela', nivel: 3, area: 'tela' },
  recorte: { nome: 'Recorte', nivel: 3, area: 'tela' },
  vertical: { nome: 'Monitor vertical', nivel: 3, area: 'tela' },
  painel: { nome: 'Informações', nivel: 2, area: 'tela' },
  mixer: { nome: 'Som', nivel: 2, area: 'atalhos' },
  teclado: { nome: 'Teclado', nivel: 1, area: 'controle' },
  voz: { nome: 'Voz', nivel: 2, area: 'controle' },
  mesa: { nome: 'Mesa digitalizadora', nivel: 1, area: 'controle' },
  midia: { nome: 'Mídia', nivel: 2, area: 'atalhos' },
  janelas: { nome: 'Janelas', nivel: 2, area: 'atalhos' },
  reuniao: { nome: 'Reunião', nivel: 2, area: 'atalhos' },
  lancador: { nome: 'Abrir', nivel: 1, area: 'atalhos' },
  giro: { nome: 'Volume', nivel: 1, area: 'controle' },
  transferencia: { nome: 'Transferência', nivel: 1, area: 'ponte' },
  camera: { nome: 'Câmera', nivel: 3, area: 'ponte' },
  microfone: { nome: 'Microfone', nivel: 2, area: 'ponte' },
  computadores: { nome: 'Computadores', nivel: 1, area: 'conexao' },
  conexao: { nome: 'Conexão', nivel: 1, area: 'conexao' },
  ajustes: { nome: 'Ajustes', nivel: 1, area: 'ajustes' },
} as const satisfies Record<string, { nome: string; nivel: 1 | 2 | 3; area: Area }>

export type TelaCelular = keyof typeof TELAS_CELULAR

export const TELAS_PC = {
  area: { nome: 'Área de trabalho' },
  central: { nome: 'Central do OpenTrackpad' },
  pareamento: { nome: 'Parear um celular' },
  bandeja: { nome: 'Menu da bandeja' },
  assistente: { nome: 'Assistente de primeira vez' },
  gravador: { nome: 'Gravar atalho' },
} as const satisfies Record<string, { nome: string }>

export type TelaPc = keyof typeof TELAS_PC
