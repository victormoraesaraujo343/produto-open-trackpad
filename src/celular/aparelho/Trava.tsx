import { useRef, useState } from 'react'
import { vibrar } from '../../sim/vibrar'

export const SEGURAR_MS = 3000
const PONTOS = [{ x: 60, y: 40 }, { x: 60, y: 140 }, { x: 160, y: 140 }]

/* Modo travado (seção 13): o desenho para destravar — ligar três pontos em L. */
export function Traco({ aoAcertar }: { aoAcertar: () => void }) {
  const [feitos, setFeitos] = useState(0)
  const ativo = useRef(false)
  const passar = (x: number, y: number) => {
    const alvo = PONTOS[feitos]
    if (alvo && Math.hypot(alvo.x - x, alvo.y - y) < 28) {
      vibrar(6)
      if (feitos + 1 === PONTOS.length) { setFeitos(0); aoAcertar() } else setFeitos(feitos + 1)
    }
  }
  const local = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const k = r.width / 220
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }
  }
  return (
    <svg className="cel-traco" viewBox="0 0 220 180" width="220" height="180" role="img" aria-label="Três pontos para ligar em forma de L"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); ativo.current = true; setFeitos(0); const p = local(e); passar(p.x, p.y) }}
      onPointerMove={(e) => { if (ativo.current) { const p = local(e); passar(p.x, p.y) } }}
      onPointerUp={() => { ativo.current = false; setFeitos(0) }}>
      {feitos > 1 && <polyline points={PONTOS.slice(0, feitos).map((p) => `${p.x},${p.y}`).join(' ')} />}
      {feitos === 1 && null}
      {PONTOS.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i < feitos ? 12 : 9} className={i < feitos ? 'feito' : ''} />)}
    </svg>
  )
}
