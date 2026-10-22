/* Refinamento no navegador (só em dev). Motor genérico: laboratorio/refinamento/painel.js. */
import { useSyncExternalStore } from 'react'
import { criarRefinamento } from '../../laboratorio/refinamento/painel.js'
import { SECOES, VARIANTES, type ChaveVariante } from './secoes'

let irPara: (n: string) => void = () => {}
/* rotas.ts registra aqui como chegar à tela de cada seção */
export function definirIrPara(fn: (n: string) => void) { irPara = fn }

const rf = criarRefinamento({ pagina: 'app', secoes: SECOES, variantes: VARIANTES, irPara: (n) => irPara(n) })

// Ponte com o React: cada variação vira uma assinatura que re-renderiza quem usa.
const ouvintes = new Map<string, Set<() => void>>()
for (const k of Object.keys(VARIANTES)) rf.aoMudar(k, () => ouvintes.get(k)?.forEach((f) => f()))

export const variante = (k: ChaveVariante) => rf.variante(k)

export function useVariante(k: ChaveVariante): string {
  return useSyncExternalStore(
    (f) => { const s = ouvintes.get(k) ?? new Set(); s.add(f); ouvintes.set(k, s); return () => { s.delete(f) } },
    () => rf.variante(k),
  )
}

let montado = false
export function montarRefinamento() {
  if (import.meta.env.DEV && !montado) { montado = true; rf.montar() }
}
