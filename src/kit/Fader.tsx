import { useRef } from 'react'
import { vibrar } from '../sim/vibrar'
import './kit.css'

const PASSO = 2

/* Fader de mesa de som, vertical ou horizontal: fenda rebaixada, nível aceso em verde quando
   o canal está ativo, e uma tampa com ranhuras para pegar. O valor também vai em texto
   (aria e o número ao lado), nunca só pela altura. */
export function Fader({ valor, aoMudar, rotulo, orientacao, ativo = false, mudo = false }: {
  valor: number; aoMudar: (v: number) => void; rotulo: string; orientacao: 'vertical' | 'horizontal'; ativo?: boolean; mudo?: boolean
}) {
  const fenda = useRef<HTMLDivElement>(null)
  const arrastando = useRef(false)
  const ultimo = useRef(valor)
  const vertical = orientacao === 'vertical'
  const ler = (x: number, y: number) => {
    const r = fenda.current!.getBoundingClientRect()
    const t = vertical ? 1 - (y - r.top) / (r.height || 1) : (x - r.left) / (r.width || 1)
    return Math.round(Math.min(100, Math.max(0, t * 100)))
  }
  const mudar = (v: number) => {
    if (Math.floor(v / 10) !== Math.floor(ultimo.current / 10)) vibrar(3)
    ultimo.current = v
    aoMudar(v)
  }
  return (
    <div className={`k-fader k-fader-${orientacao}${mudo ? ' k-fader-mudo' : ''}`} role="slider" tabIndex={0} aria-label={rotulo}
      aria-orientation={orientacao} aria-valuemin={0} aria-valuemax={100} aria-valuenow={valor} aria-valuetext={mudo ? 'mudo' : `${valor}%`}
      onKeyDown={(e) => {
        const d = ['ArrowUp', 'ArrowRight'].includes(e.key) ? PASSO : ['ArrowDown', 'ArrowLeft'].includes(e.key) ? -PASSO : 0
        if (!d) return
        e.preventDefault()
        mudar(Math.min(100, Math.max(0, valor + d)))
      }}
      onPointerDown={(e) => { arrastando.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); mudar(ler(e.clientX, e.clientY)) }}
      onPointerMove={(e) => { if (arrastando.current) mudar(ler(e.clientX, e.clientY)) }}
      onPointerUp={() => { arrastando.current = false }}
      onPointerCancel={() => { arrastando.current = false }}>
      <div ref={fenda} className="k-fenda">
        <div className={`k-nivel${ativo && !mudo ? ' k-vivo' : ''}`} style={vertical ? { height: `${valor}%` } : { width: `${valor}%` }} />
        <div className="k-marcas" aria-hidden="true">{Array.from({ length: 11 }, (_, i) => <i key={i} />)}</div>
        <div className="k-tampa" style={vertical ? { bottom: `${valor}%` } : { left: `${valor}%` }} aria-hidden="true"><i /><i /><i /></div>
      </div>
    </div>
  )
}
