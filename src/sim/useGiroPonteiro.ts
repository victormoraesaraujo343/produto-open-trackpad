import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { anguloDe, criarGiro } from './giro'
import { vibrar } from './vibrar'

/* Liga um giro relativo a um elemento: cada passo inteiro chama `aoPasso(+1 | -1)` e vibra.
   `centro` devolve o centro do giro em coordenadas da página (padrão: centro do elemento). */
export function useGiroPonteiro(aoPasso: (d: number) => void, passos = 36, centro?: (el: HTMLElement) => { x: number; y: number }) {
  const giro = useRef(criarGiro(passos))
  const ultimo = useRef(0)
  const ativo = useRef(false)
  const c = (el: HTMLElement) => {
    if (centro) return centro(el)
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  return {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      e.currentTarget.setPointerCapture?.(e.pointerId)
      const p = c(e.currentTarget)
      giro.current.comecar(anguloDe(p.x, p.y, e.clientX, e.clientY))
      ultimo.current = 0
      ativo.current = true
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      if (!ativo.current) return
      const p = c(e.currentTarget)
      const total = giro.current.mover(anguloDe(p.x, p.y, e.clientX, e.clientY))
      const d = total - ultimo.current
      if (d !== 0) { ultimo.current = total; vibrar(4); aoPasso(d) }
    },
    onPointerUp() { ativo.current = false },
    onPointerCancel() { ativo.current = false },
  }
}
