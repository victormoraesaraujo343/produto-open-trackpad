/* Estado simulado que o celular e o computador falso compartilham. */
import { create } from 'zustand'
import type { AppId } from '../dados/apps'
import { ATALHOS, PERFIS, teclasDoSistema, type Atalho } from '../dados/atalhos'
import type { Sistema } from '../dados/computadores'
import { JANELAS } from '../dados/janelas'
import { PRESETS, liberado, nivelDe, type Nivel, type PresetId } from './conexao'
import { TELAS_CELULAR, type TelaCelular, type TelaPc } from './telas'

export type Plataforma = 'android' | 'iphone'
export type Dedos = 1 | 2 | 3 | 4
export type Saude = 'ok' | 'bateria' | 'quente'
export interface Ajustes { mao: 'direita' | 'esquerda'; girado: boolean; velocidade: number; aceleracao: number; rolagemNatural: boolean; limitarCarga: boolean }
export interface Copia { id: number; texto: string; origem: string; em: number }
export interface Ponto { x: number; y: number; p: number }
/* funções opcionais (o spec pede "opcional por padrão"): ligam e desligam na central e no celular */
export interface Opcoes { zonas: boolean; noturno: boolean; confianca: boolean; variosPcs: boolean; variosCelulares: boolean; abrirSozinho: boolean; paradoViraPainel: boolean; vibracao: boolean }

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
  teclasPresas: string[]
  volume: number
  osdVolume: number
  travado: boolean
  ultimoAtalho: { texto: string; em: number } | null
  ligados: Record<string, boolean>
  textoDigitado: string
  opcoes: Opcoes
  tracos: Ponto[][]
  orientacao: 'deitado' | 'empe'
  transferencia: Copia[]
  computador: string
  focoPorComputador: Record<string, AppId>
  cameraEmUso: boolean
  micEmUso: boolean
  saude: Saude
  ajustes: Ajustes
  perfis: Record<AppId, string[]>
  atalhosProprios: Record<string, Atalho>
  secaoCentral: string
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
  alternarPresa(tecla: string): void
  mudarVolume(delta: number): void
  travar(sim: boolean): void
  dispararAtalho(id: string): void
  mostrarNoPc(texto: string): void
  digitar(t: string): void
  apagar(): void
  setOpcao<K extends keyof Opcoes>(k: K, v: Opcoes[K]): void
  desenhar(traco: Ponto[]): void
  limparDesenho(): void
  trocarParaJanela(id: string): void
  copiar(texto: string, origem: string): void
  trocarComputador(id: string): void
  usarCamera(sim: boolean): void
  usarMicrofone(sim: boolean): void
  setSaude(s: Saude): void
  setAjuste<K extends keyof Ajustes>(k: K, v: Ajustes[K]): void
  moverAtalho(app: AppId, indice: number, direcao: -1 | 1): void
  removerAtalho(app: AppId, id: string): void
  adicionarAtalho(app: AppId, id: string): void
  criarAtalho(rotulo: string, teclas: string[]): string
  setSecaoCentral(s: string): void
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
  teclasPresas: [],
  volume: 40,
  osdVolume: 0,
  travado: false,
  ultimoAtalho: null,
  ligados: {},
  textoDigitado: '',
  opcoes: { zonas: false, noturno: false, confianca: true, variosPcs: false, variosCelulares: false, abrirSozinho: true, paradoViraPainel: true, vibracao: true },
  tracos: [],
  orientacao: 'deitado',
  transferencia: [
    { id: 2, texto: 'apresentacao-q4-versao-final-de-verdade.pdf', origem: 'computador', em: 2 },
    { id: 1, texto: 'Rua das Palmeiras, 120 — apto 31', origem: 'celular', em: 1 },
  ],
  computador: 'c1',
  focoPorComputador: {},
  cameraEmUso: false,
  micEmUso: false,
  saude: 'ok',
  perfis: PERFIS,
  atalhosProprios: {},
  secaoCentral: 'aparelhos',
  ajustes: { mao: 'direita', girado: false, velocidade: 60, aceleracao: 40, rolagemNatural: true, limitarCarga: true },
}

const AVISO_MS = 3000
/* atalhos que ligam e desligam algo no computador: a tecla mostra o estado */
const LIGA_DESLIGA = new Set(['mudo', 'camera', 'gravar', 'mao'])
const prender = (v: number) => Math.min(1, Math.max(0, v))
export const nivelAtual = (p: PresetId): Nivel => nivelDe(PRESETS[p])
const cabe = (t: TelaCelular, n: Nivel) => (t === 'conexao' ? true : n > 0 && liberado(TELAS_CELULAR[t].nivel, n))

let relogioAviso: ReturnType<typeof setTimeout> | undefined

export const useSim = create<Estado & Acoes>()((set, get) => ({
  ...INICIAL,

  conectar(p) {
    const n = nivelAtual(p)
    const { tela } = get()
    const antes = get().preset
    if (n === 0) return set({ preset: p, tela: 'conexao', teclasPresas: [], cameraEmUso: false, micEmUso: false })
    if (tela === 'conexao') return set({ preset: p, tela: 'trackpad' })
    if (!cabe(tela, n)) {
      set({ preset: p, tela: 'trackpad', orientacao: 'deitado' })
      return get().avisar('A conexão piorou. Voltamos ao trackpad.')
    }
    set({ preset: p })
    if (nivelAtual(antes) > 0 && PRESETS[antes].via !== PRESETS[p].via) get().avisar(`Agora por ${PRESETS[p].rotulo}. Nada foi interrompido.`)
  },

  irPara(t) {
    if (get().travado) return
    if (!cabe(t, nivelAtual(get().preset))) return
    set({ tela: t, ocioso: false, orientacao: t === 'vertical' ? 'empe' : 'deitado' })
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
  alternarPresa: (tecla) => set(({ teclasPresas }) => ({ teclasPresas: teclasPresas.includes(tecla) ? teclasPresas.filter((t) => t !== tecla) : [...teclasPresas, tecla] })),
  mudarVolume: (delta) => set(({ volume }) => ({ volume: Math.min(100, Math.max(0, volume + delta)), osdVolume: Date.now() })),
  travar: (sim) => set({ travado: sim }),
  dispararAtalho(id) {
    const a = ATALHOS[id] ?? get().atalhosProprios[id]
    if (!a) return
    const texto = teclasDoSistema(a.teclas, get().sistema).join(' + ')
    set(({ ligados }) => ({
      ultimoAtalho: { texto, em: Date.now() },
      ligados: LIGA_DESLIGA.has(id) ? { ...ligados, [id]: !ligados[id] } : ligados,
    }))
  },
  mostrarNoPc: (texto) => set({ ultimoAtalho: { texto, em: Date.now() } }),
  digitar: (t) => set(({ textoDigitado }) => ({ textoDigitado: (textoDigitado + t).slice(-120) })),
  apagar: () => set(({ textoDigitado }) => ({ textoDigitado: Array.from(textoDigitado).slice(0, -1).join('') })),
  setOpcao: (k, v) => set(({ opcoes }) => ({ opcoes: { ...opcoes, [k]: v } })),
  desenhar: (traco) => set(({ tracos }) => ({ tracos: [...tracos, traco].slice(-60) })),
  limparDesenho: () => set({ tracos: [] }),
  trocarParaJanela(id) {
    const j = JANELAS.find((x) => x.id === id)
    if (!j) return
    set({ appEmFoco: j.app, ultimoAtalho: { texto: j.titulo, em: Date.now() } })
  },
  copiar: (texto, origem) => set(({ transferencia }) => ({ transferencia: [{ id: Date.now() + Math.random(), texto, origem, em: Date.now() }, ...transferencia].slice(0, 12) })),
  trocarComputador(id) {
    const { computador, appEmFoco, focoPorComputador } = get()
    if (id === computador) return
    const guardado = { ...focoPorComputador, [computador]: appEmFoco }
    set({ computador: id, focoPorComputador: guardado, appEmFoco: guardado[id] ?? 'area', teclasPresas: [] })
  },
  usarCamera: (sim) => set({ cameraEmUso: sim }),
  usarMicrofone: (sim) => set({ micEmUso: sim }),
  setSaude(saude) {
    set({ saude })
    if (saude === 'bateria') get().avisar('Bateria do celular fraca: ligue no cabo')
    if (saude === 'quente') get().avisar('Celular quente: o brilho foi reduzido')
  },
  setAjuste: (k, v) => set(({ ajustes }) => ({ ajustes: { ...ajustes, [k]: v } })),
  moverAtalho: (app, i, d) => set(({ perfis }) => {
    const l = [...perfis[app]]
    const j = i + d
    if (j < 0 || j >= l.length) return {}
    ;[l[i], l[j]] = [l[j], l[i]]
    return { perfis: { ...perfis, [app]: l } }
  }),
  removerAtalho: (app, id) => set(({ perfis }) => ({ perfis: { ...perfis, [app]: perfis[app].filter((x) => x !== id) } })),
  adicionarAtalho: (app, id) => set(({ perfis }) => (perfis[app].includes(id) ? {} : { perfis: { ...perfis, [app]: [...perfis[app], id] } })),
  criarAtalho(rotulo, teclas) {
    const id = `proprio-${Date.now().toString(36)}`
    set(({ atalhosProprios }) => ({ atalhosProprios: { ...atalhosProprios, [id]: { id, rotulo, teclas, icone: 'atalhos' } } }))
    return id
  },
  setSecaoCentral: (secaoCentral) => set({ secaoCentral }),
  reiniciar: () => { clearTimeout(relogioAviso); set({ ...INICIAL }) },
}))

/* Parado, o celular vira painel de informações (opção "parado vira painel"). */
export const mostrarDescanso = (s: { ocioso: boolean; opcoes: Opcoes }) => s.ocioso && s.opcoes.paradoViraPainel
