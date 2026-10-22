import type { TelaCelular } from '../../sim/telas'

/* Os modos que a navegação oferece, na ordem fixa (nada muda de lugar). */
export const MODOS: { tela: TelaCelular; nome: string; icone: string }[] = [
  { tela: 'trackpad', nome: 'Trackpad', icone: 'trackpad' },
  { tela: 'atalhos', nome: 'Atalhos', icone: 'atalhos' },
  { tela: 'mixer', nome: 'Som', icone: 'mixer' },
  { tela: 'espelho', nome: 'Tela', icone: 'tela' },
  { tela: 'giro', nome: 'Volume', icone: 'volume' },
]
