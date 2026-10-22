import { useRef } from 'react'
import { Icone } from './Icone'
import './kit.css'

/* Fader vertical: arrastar para cima é mais alto. A tampa liga e desliga o mudo. */
export function Fader({ valor, aoMudar, mudo = false, aoMudo, ativo = false, rotulo }: {
  valor: number; aoMudar: (v: number) => void; mudo?: boolean; aoMudo?: () => void; ativo?: boolean; rotulo: string
}) {
  const fenda = useRef<HTMLDivElement>(null)
  const arrastando = useRef(false)
  const ler = (y: number) => {
    const r = fenda.current!.getBoundingClientRect()
    return Math.round(Math.min(100, Math.max(0, 100 - ((y - r.top) / (r.height || 1)) * 100)))
  }
  return (
    <div className="k-fader" role="slider" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={valor} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'ArrowUp') aoMudar(Math.min(100, valor + 2)); if (e.key === 'ArrowDown') aoMudar(Math.max(0, valor - 2)) }}
      onPointerDown={(e) => { if ((e.target as HTMLElement).closest('.k-tampa')) return; arrastando.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); aoMudar(ler(e.clientY)) }}
      onPointerMove={(e) => { if (arrastando.current) aoMudar(ler(e.clientY)) }}
      onPointerUp={() => { arrastando.current = false }}>
      <div ref={fenda} className="k-fenda">
        <div className={`k-enchimento${ativo && !mudo ? ' k-vivo' : ''}`} style={{ height: `${valor}%` }} />
        <button type="button" className={`k-tampa${mudo ? ' k-mudo' : ''}`} style={{ bottom: `${valor}%` }}
          aria-label={mudo ? `Tirar ${rotulo} do mudo` : `Pôr ${rotulo} no mudo`} onClick={aoMudo}>
          <Icone nome={mudo ? 'mudo' : 'volume'} tamanho={13} />
        </button>
      </div>
    </div>
  )
}
