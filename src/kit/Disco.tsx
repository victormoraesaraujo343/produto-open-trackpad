import { useRef, type ReactNode } from 'react'
import { vibrar } from '../sim/vibrar'
import './kit.css'

/* Botão giratório. O giro é relativo (pegar em qualquer ponto nunca faz pular) e conta
   passos inteiros: `passos` por volta, vibração a cada passo. Não mostra número: o
   computador já mostra o nível na tela dele. */
export function Disco({ valor, aoMudar, passos = 40, rotulo = 'Botão giratório', tamanho = 236, children }: {
  valor: number; aoMudar: (v: number) => void; passos?: number; rotulo?: string; tamanho?: number; children?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const ultimo = useRef<number | null>(null)
  const acumulado = useRef(0)
  const base = useRef(valor)
  const grausPorPasso = 360 / passos
  const angulo = (x: number, y: number) => {
    const r = ref.current!.getBoundingClientRect()
    return (Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2)) * 180) / Math.PI
  }
  const marcas = Array.from({ length: passos }, (_, i) => i)
  const aceso = ((valor % passos) + passos) % passos
  return (
    <div ref={ref} className="k-disco" role="slider" aria-label={rotulo} aria-valuenow={valor} tabIndex={0}
      style={{ width: tamanho, height: tamanho }}
      onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') aoMudar(valor + 1); if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') aoMudar(valor - 1) }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); ultimo.current = angulo(e.clientX, e.clientY); acumulado.current = 0; base.current = valor }}
      onPointerMove={(e) => {
        if (ultimo.current === null) return
        const a = angulo(e.clientX, e.clientY)
        let d = a - ultimo.current
        if (d > 180) d -= 360
        if (d < -180) d += 360
        ultimo.current = a
        acumulado.current += d
        const novo = base.current + Math.trunc(acumulado.current / grausPorPasso)
        if (novo !== valor) { vibrar(4); aoMudar(novo) }
      }}
      onPointerUp={() => { ultimo.current = null }}
      onPointerCancel={() => { ultimo.current = null }}>
      <div className="k-disco-aro" />
      {marcas.map((i) => (
        <div key={i} className="k-disco-marca" style={{ transform: `rotate(${i * grausPorPasso}deg)`, height: tamanho / 2 - 4, marginTop: -(tamanho / 2 - 4), transformOrigin: `50% ${tamanho / 2 - 4}px` }}>
          <b className={i === aceso ? 'k-aceso' : ''} style={{ height: i % 5 === 0 ? 11 : 7 }} />
        </div>
      ))}
      <div className="k-disco-cubo" style={{ width: tamanho * 0.56, height: tamanho * 0.56 }}>{children}</div>
    </div>
  )
}
