import type { TelaCelular } from '../../sim/telas'

export type Grupo = 'Controlar' | 'Atalhos' | 'Tela' | 'Ponte'

/* Os modos do menu, em grupos e na ordem fixa (nada muda de lugar). */
export const MODOS: { tela: TelaCelular; nome: string; icone: string; grupo: Grupo }[] = [
  { tela: 'trackpad', nome: 'Trackpad', icone: 'trackpad', grupo: 'Controlar' },
  { tela: 'teclado', nome: 'Teclado', icone: 'teclado', grupo: 'Controlar' },
  { tela: 'voz', nome: 'Voz', icone: 'microfone', grupo: 'Controlar' },
  { tela: 'mesa', nome: 'Desenho', icone: 'caneta', grupo: 'Controlar' },
  { tela: 'giro', nome: 'Volume', icone: 'volume', grupo: 'Controlar' },
  { tela: 'atalhos', nome: 'Atalhos', icone: 'atalhos', grupo: 'Atalhos' },
  { tela: 'lancador', nome: 'Abrir', icone: 'mais', grupo: 'Atalhos' },
  { tela: 'janelas', nome: 'Janelas', icone: 'trocar', grupo: 'Atalhos' },
  { tela: 'mixer', nome: 'Som', icone: 'mixer', grupo: 'Atalhos' },
  { tela: 'midia', nome: 'Mídia', icone: 'musica', grupo: 'Atalhos' },
  { tela: 'reuniao', nome: 'Reunião', icone: 'camera', grupo: 'Atalhos' },
  { tela: 'espelho', nome: 'Espelho', icone: 'tela', grupo: 'Tela' },
  { tela: 'monitor', nome: 'Monitor', icone: 'computador', grupo: 'Tela' },
  { tela: 'janela', nome: 'Uma janela', icone: 'janelas', grupo: 'Tela' },
  { tela: 'recorte', nome: 'Recorte', icone: 'lupa', grupo: 'Tela' },
  { tela: 'vertical', nome: 'Vertical', icone: 'celular', grupo: 'Tela' },
  { tela: 'painel', nome: 'Informações', icone: 'info', grupo: 'Tela' },
  { tela: 'recursos', nome: 'Recursos', icone: 'mixer', grupo: 'Tela' },
  { tela: 'transferencia', nome: 'Copiados', icone: 'copiar', grupo: 'Ponte' },
  { tela: 'camera', nome: 'Câmera', icone: 'camera', grupo: 'Ponte' },
  { tela: 'microfone', nome: 'Microfone', icone: 'microfone', grupo: 'Ponte' },
  { tela: 'computadores', nome: 'Computadores', icone: 'computador', grupo: 'Ponte' },
]

export const GRUPOS: Grupo[] = ['Controlar', 'Atalhos', 'Tela', 'Ponte']
