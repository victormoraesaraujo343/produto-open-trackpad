export type Sistema = 'linux' | 'windows' | 'macos'

export interface Computador { id: string; nome: string; sistema: Sistema; confiavel: boolean }
export interface Celular { id: string; nome: string; plataforma: 'android' | 'iphone' }

/* Computadores achados no Wi-Fi. Um tem nome longo de propósito. */
export const COMPUTADORES: Computador[] = [
  { id: 'c1', nome: 'mesa-do-victor', sistema: 'linux', confiavel: true },
  { id: 'c2', nome: 'Estação-de-trabalho-do-escritório-segundo-andar', sistema: 'windows', confiavel: true },
  { id: 'c3', nome: 'MacBook da Renata', sistema: 'macos', confiavel: false },
]

export const CELULARES: Celular[] = [
  { id: 'p1', nome: 'Moto G7 da gaveta', plataforma: 'android' },
  { id: 'p2', nome: 'iPhone 8 antigo', plataforma: 'iphone' },
]
