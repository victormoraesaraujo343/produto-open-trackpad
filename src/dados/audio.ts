import type { AppId } from './apps'

export interface Canal { id: string; nome: string; porta: string; volume: number; ativo: boolean; mudo: boolean }
export interface CanalApp { app: AppId; volume: number; mudo: boolean }

export const SAIDAS: Canal[] = [
  { id: 's1', nome: 'Alto-falantes', porta: 'analógico', volume: 62, ativo: true, mudo: false },
  { id: 's2', nome: 'Fone USB', porta: 'usb', volume: 45, ativo: false, mudo: false },
  { id: 's3', nome: 'Monitor', porta: 'hdmi', volume: 80, ativo: false, mudo: true },
]
export const ENTRADAS: Canal[] = [
  { id: 'e1', nome: 'Microfone', porta: 'analógico', volume: 74, ativo: true, mudo: false },
  { id: 'e2', nome: 'Fone USB', porta: 'usb', volume: 52, ativo: false, mudo: false },
  { id: 'e3', nome: 'Celular', porta: 'opentrackpad', volume: 60, ativo: false, mudo: false },
]
export const APPS_TOCANDO: CanalApp[] = [
  { app: 'spotify', volume: 55, mudo: false },
  { app: 'firefox', volume: 100, mudo: false },
  { app: 'meet', volume: 80, mudo: false },
  { app: 'discord', volume: 65, mudo: true },
]

export const FAIXA = { titulo: 'Anunciação', artista: 'Alceu Valença', album: 'Anjo Avesso', duracao: 214, posicao: 71 }
