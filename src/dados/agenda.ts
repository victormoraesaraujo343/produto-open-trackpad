export interface Compromisso { id: string; titulo: string; inicio: string; fim: string; local: string }

export const AGENDA: Compromisso[] = [
  { id: 'a1', titulo: 'Reunião semanal de produto', inicio: '14:00', fim: '14:45', local: 'Google Meet' },
  { id: 'a2', titulo: 'Revisão das telas', inicio: '16:30', fim: '17:00', local: 'Sala 2' },
]
