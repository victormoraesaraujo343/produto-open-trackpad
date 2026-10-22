import { useRef } from 'react'
import { useVariante } from '../lab/refinamento'
import { useSim } from '../sim/loja'
import { vibrar } from '../sim/vibrar'
import { Led } from './Led'

const DOIS_TOQUES_MS = 320

/* Tecla que prende um modificador (Ctrl, Shift…) enquanto a outra mão usa o centro.
   Comportamento é a seção 9 do laboratório: trava (toque prende/solta), segurar (presa só
   com o dedo em cima) ou misto (segurar prende; dois toques travam até o próximo toque).
   LED e texto dizem o estado. */
export function TeclaPresa({ tecla }: { tecla: string }) {
  const forma = useVariante('presas')
  const presa = useSim((s) => s.teclasPresas.includes(tecla))
  const pôr = (sim: boolean) => { const s = useSim.getState(); if (s.teclasPresas.includes(tecla) !== sim) { s.alternarPresa(tecla); vibrar(sim ? 10 : 5) } }
  const travada = useRef(false)
  const ultimoToque = useRef(0)

  const handlers = forma === 'trava'
    ? { onClick: () => pôr(!presa) }
    : {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        if (forma === 'misto' && travada.current) { travada.current = false; pôr(false); return }
        pôr(true)
      },
      onPointerUp: () => {
        if (forma === 'misto') {
          const agora = Date.now()
          if (agora - ultimoToque.current < DOIS_TOQUES_MS) { travada.current = true; vibrar([8, 30, 8]); ultimoToque.current = 0; return }
          ultimoToque.current = agora
          if (travada.current) return
        }
        pôr(false)
      },
      onPointerCancel: () => { if (!travada.current) pôr(false) },
      onKeyDown: (e: React.KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pôr(!presa) } },
    }
  const estado = presa ? (travada.current ? 'travado' : 'preso') : 'solto'
  return (
    <button type="button" className={`k-tecla k-tecla-presa${presa ? ' k-ligada' : ''}`} aria-pressed={presa} aria-label={`${tecla} ${estado}`} {...handlers}>
      {presa && <Led aceso canto />}
      <span className="k-presa"><b>{tecla}</b><small>{estado}</small></span>
    </button>
  )
}
