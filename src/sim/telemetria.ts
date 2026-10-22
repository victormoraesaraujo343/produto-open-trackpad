/* Telemetria de mentira do computador: cada métrica anda devagar (passeio aleatório puxado
   para um valor típico), com histórico curto para os gráficos. */
import { create } from 'zustand'

export type Metrica = 'cpu' | 'memoria' | 'temperatura' | 'gpu' | 'disco' | 'rede' | 'bateria'
export interface Leitura { valor: number; historico: number[] }
export type Telemetria = Record<Metrica, Leitura>

export const METRICAS: Record<Metrica, { nome: string; curto: string; icone: string; texto: (v: number) => string }> = {
  cpu: { nome: 'Processador', curto: 'CPU', icone: 'computador', texto: (v) => `${Math.round(v)}%` },
  memoria: { nome: 'Memória', curto: 'Memória', icone: 'atalhos', texto: (v) => `${((v / 100) * 16).toFixed(1).replace('.', ',')} GB` },
  temperatura: { nome: 'Temperatura', curto: 'Temp.', icone: 'info', texto: (v) => `${Math.round(30 + v * 0.6)} °C` },
  gpu: { nome: 'Placa de vídeo', curto: 'GPU', icone: 'tela', texto: (v) => `${Math.round(v)}%` },
  disco: { nome: 'Disco', curto: 'Disco', icone: 'pasta', texto: (v) => `${Math.round(v)}%` },
  rede: { nome: 'Rede', curto: 'Rede', icone: 'wifi', texto: (v) => `${Math.round(v * 0.9)} Mb/s` },
  bateria: { nome: 'Bateria', curto: 'Bateria', icone: 'usb', texto: (v) => `${Math.round(v)}%` },
}

const ALVO: Record<Metrica, number> = { cpu: 28, memoria: 61, temperatura: 40, gpu: 18, disco: 72, rede: 22, bateria: 78 }
const SOLTURA: Record<Metrica, number> = { cpu: 14, memoria: 2, temperatura: 3, gpu: 12, disco: 0.2, rede: 20, bateria: 0.1 }
const HISTORICO = 40

const BASE: Telemetria = Object.fromEntries(
  (Object.keys(ALVO) as Metrica[]).map((m) => [m, { valor: ALVO[m], historico: Array(HISTORICO).fill(ALVO[m]) }]),
) as Telemetria

export function passoTelemetria(t: Telemetria, sorte: () => number = Math.random): Telemetria {
  const novo = {} as Telemetria
  for (const m of Object.keys(t) as Metrica[]) {
    const atual = t[m].valor
    const v = Math.min(100, Math.max(0, atual + (sorte() - 0.5) * 2 * SOLTURA[m] + (ALVO[m] - atual) * 0.15))
    novo[m] = { valor: v, historico: [...t[m].historico, v].slice(-HISTORICO) }
  }
  return novo
}

/* Já começa com um histórico variado (semente fixa), para os gráficos não nascerem retos. */
function semente(n: number) { let x = n; return () => { x = (x * 16807) % 2147483647; return x / 2147483647 } }
export const TELEMETRIA_INICIAL: Telemetria = (() => { const r = semente(42); let t = BASE; for (let i = 0; i < HISTORICO; i++) t = passoTelemetria(t, r); return t })()

/* Começa a andar quando alguém olha, e para quando ninguém olha. */
let olhando = 0
let relogio: ReturnType<typeof setInterval> | undefined
export const useTelemetria = create<Telemetria>()(() => TELEMETRIA_INICIAL)
export function olharTelemetria() {
  olhando++
  if (olhando === 1) relogio = setInterval(() => useTelemetria.setState((t) => passoTelemetria(t)), 1000)
  return () => { olhando--; if (olhando === 0) clearInterval(relogio) }
}
