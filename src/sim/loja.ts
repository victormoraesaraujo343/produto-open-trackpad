/* Estado simulado que o celular e o computador falso compartilham. */
import { create } from 'zustand'
import type { AppId } from '../dados/apps'
import type { Sistema } from '../dados/computadores'
import { PRESETS, liberado, nivelDe, type Nivel, type PresetId } from './conexao'
import { TELAS_CELULAR, type TelaCelular, type TelaPc } from './telas'

export type Plataforma = 'android' | 'iphone'
export type Dedos = 1 | 2 | 3 | 4

interface Estado {
  plataforma: Plataforma
  sistema: Sistema
  preset: PresetId
  tela: TelaCelular
  telaPc: TelaPc
  appEmFoco: AppId
  cursor: { x: number; y: number }
  dedos: Dedos
  aviso: string | null
  ocioso: boolean
}

interface Acoes {
  conectar(p: PresetId): void
  irPara(t: TelaCelular): void
  irParaPc(t: TelaPc): void
  focar(a: AppId): void
  moverCursor(dx: number, dy: number): void
  setDedos(d: Dedos): void
  setPlataforma(p: Plataforma): void
  setSistema(s: Sistema): void
  avisar(texto: string): void
  tocar(): void
  ficarOcioso(): void
  reiniciar(): void
}

const INICIAL: Estado = {
  plataforma: 'android',
  sistema: 'linux',
  preset: 'usb3',
  tela: 'trackpad',
  telaPc: 'area',
  appEmFoco: 'area',
  cursor: { x: 0.5, y: 0.5 },
  dedos: 1,
  aviso: null,
  ocioso: false,
}

const AVISO_MS = 3000
const prender = (v: number) => Math.min(1, Math.max(0, v))
export const nivelAtual = (p: PresetId): Nivel => nivelDe(PRESETS[p])
const cabe = (t: TelaCelular, n: Nivel) => (t === 'conexao' ? true : n > 0 && liberado(TELAS_CELULAR[t].nivel, n))

let relogioAviso: ReturnType<typeof setTimeout> | undefined

export const useSim = create<Estado & Acoes>()((set, get) => ({
  ...INICIAL,

  conectar(p) {
    const n = nivelAtual(p)
    const { tela } = get()
    if (n === 0) return set({ preset: p, tela: 'conexao' })
    if (tela === 'conexao') return set({ preset: p, tela: 'trackpad' })
    if (!cabe(tela, n)) {
      set({ preset: p, tela: 'trackpad' })
      return get().avisar('A conexão piorou. Voltamos ao trackpad.')
    }
    set({ preset: p })
  },

  irPara(t) {
    if (!cabe(t, nivelAtual(get().preset))) return
    set({ tela: t, ocioso: false })
  },

  irParaPc: (t) => set({ telaPc: t }),
  focar: (a) => set({ appEmFoco: a }),
  moverCursor: (dx, dy) => set(({ cursor }) => ({ cursor: { x: prender(cursor.x + dx), y: prender(cursor.y + dy) } })),
  setDedos: (d) => set({ dedos: d }),
  setPlataforma: (p) => set({ plataforma: p }),
  setSistema: (s) => set({ sistema: s }),

  avisar(texto) {
    clearTimeout(relogioAviso)
    set({ aviso: texto })
    relogioAviso = setTimeout(() => set({ aviso: null }), AVISO_MS)
  },

  tocar: () => { if (get().ocioso) set({ ocioso: false }) },
  ficarOcioso: () => set({ ocioso: true }),
  reiniciar: () => { clearTimeout(relogioAviso); set({ ...INICIAL }) },
}))
