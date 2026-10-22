/* Catálogo de telas. Cada tela do celular declara o nível de conexão que exige (spec).
   `conexao` é a única que existe sem conexão nenhuma. */
export type Area = 'controle' | 'atalhos' | 'tela' | 'ponte' | 'conexao' | 'ajustes' | 'aparelho'

export const TELAS_CELULAR = {
  trackpad: { nome: 'Trackpad', nivel: 1, area: 'controle' },
  atalhos: { nome: 'Atalhos', nivel: 1, area: 'atalhos' },
  espelho: { nome: 'Tela espelhada', nivel: 3, area: 'tela' },
  mixer: { nome: 'Som', nivel: 2, area: 'atalhos' },
  presas: { nome: 'Teclas presas', nivel: 1, area: 'controle' },
  giro: { nome: 'Volume', nivel: 1, area: 'controle' },
  conexao: { nome: 'Conexão', nivel: 1, area: 'conexao' },
  ajustes: { nome: 'Ajustes', nivel: 1, area: 'ajustes' },
} as const satisfies Record<string, { nome: string; nivel: 1 | 2 | 3; area: Area }>

export type TelaCelular = keyof typeof TELAS_CELULAR

export const TELAS_PC = {
  area: { nome: 'Área de trabalho' },
  central: { nome: 'Central do OpenTrackpad' },
  pareamento: { nome: 'Parear um celular' },
} as const satisfies Record<string, { nome: string }>

export type TelaPc = keyof typeof TELAS_PC
