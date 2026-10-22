import type { AppId } from './apps'

export interface Notificacao { id: string; app: AppId; titulo: string; texto: string; ha: string }

export const NOTIFICACOES: Notificacao[] = [
  { id: 'n1', app: 'discord', titulo: 'Renata Lobo', texto: 'subi o arquivo novo no canal', ha: '2 min' },
  { id: 'n2', app: 'meet', titulo: 'Reunião semanal de produto', texto: 'começa em 10 minutos', ha: 'agora' },
  { id: 'n3', app: 'arquivos', titulo: 'Download concluído', texto: 'apresentacao-q4-versao-final-de-verdade.pdf', ha: '8 min' },
]
