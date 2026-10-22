import { useRef, useState } from 'react'
import { DesktopFalso } from '../../bancada/DesktopFalso'
import { DESENHO_COMPUTADOR } from '../../bancada/MolduraComputador'
import { Icone } from '../../kit/Icone'
import { useVariante } from '../../lab/refinamento'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'

type Modo = 'direto' | 'trackpad'
const ALTURA = 304
const ESCALA = ALTURA / DESENHO_COMPUTADOR.altura

/* Tela espelhada (seção 5). Dois jeitos de tocar, e o dono escolhe:
   direto (tocar num ponto clica ali) ou trackpad (o toque continua relativo, cursor na imagem). */
export function TelaEspelho() {
  const forma = useVariante('espelho')
  const [modo, setModo] = useState<Modo>('direto')
  const [aviso, setAviso] = useState<string | null>(null)
  const ultimo = useRef<{ x: number; y: number } | null>(null)
  const ponteiros = useRef(new Set<number>())
  const { moverCursor } = useSim.getState()

  const trocar = (m: Modo) => {
    setModo(m); vibrar(10)
    setAviso(m === 'direto' ? 'Toque direto: toque onde quer clicar' : 'Trackpad: arraste para mover o cursor')
    setTimeout(() => setAviso(null), 1800)
  }
  const local = (el: HTMLElement, x: number, y: number) => {
    const r = el.getBoundingClientRect()
    return { x: (x - r.left) / r.width, y: (y - r.top) / r.height }
  }

  const alternador = forma === 'chave' ? (
    <div className="cel-chave-modo" role="radiogroup" aria-label="Jeito de tocar na tela">
      {(['direto', 'trackpad'] as Modo[]).map((m) => (
        <button key={m} type="button" role="radio" aria-checked={modo === m} className={modo === m ? 'cel-modo-ativo' : ''} onClick={() => trocar(m)}>
          <Icone nome={m === 'direto' ? 'caneta' : 'trackpad'} /><span>{m === 'direto' ? 'Toque direto' : 'Trackpad'}</span>
        </button>
      ))}
    </div>
  ) : forma === 'flutuante' ? (
    <button type="button" className="cel-flutuante" onPointerDown={(e) => e.stopPropagation()} aria-label={`Jeito de tocar: ${modo === 'direto' ? 'toque direto' : 'trackpad'}. Tocar para trocar`}
      onClick={() => trocar(modo === 'direto' ? 'trackpad' : 'direto')}>
      <Icone nome={modo === 'direto' ? 'caneta' : 'trackpad'} /><span>{modo === 'direto' ? 'Toque direto' : 'Trackpad'}</span>
    </button>
  ) : (
    <button type="button" className="cel-so-leitor" onClick={() => trocar(modo === 'direto' ? 'trackpad' : 'direto')}>Trocar jeito de tocar</button>
  )

  return (
    <div className={`cel-espelho cel-espelho-${forma}`} data-lab="5">
      {forma === 'chave' && alternador}
      <div className="cel-espelho-imagem" style={{ width: DESENHO_COMPUTADOR.largura * ESCALA, height: ALTURA }}
        onPointerDown={(e) => {
          ponteiros.current.add(e.pointerId)
          e.currentTarget.setPointerCapture?.(e.pointerId)
          const dedos = Math.max(ponteiros.current.size, useSim.getState().dedos)
          if (forma === 'gesto' && dedos >= 3) { trocar(modo === 'direto' ? 'trackpad' : 'direto'); return }
          const p = local(e.currentTarget, e.clientX, e.clientY)
          if (modo === 'direto') { const c = useSim.getState().cursor; moverCursor(p.x - c.x, p.y - c.y); vibrar(10) }
          ultimo.current = p
        }}
        onPointerMove={(e) => {
          if (modo !== 'trackpad' || !ultimo.current) return
          const p = local(e.currentTarget, e.clientX, e.clientY)
          moverCursor(p.x - ultimo.current.x, p.y - ultimo.current.y)
          ultimo.current = p
        }}
        onPointerUp={(e) => { ponteiros.current.delete(e.pointerId); ultimo.current = null }}>
        <div style={{ transform: `scale(${ESCALA})`, transformOrigin: '0 0', pointerEvents: 'none' }}><DesktopFalso /></div>
        {forma === 'flutuante' && alternador}
        {forma === 'gesto' && alternador}
        {aviso && <div className="cel-espelho-aviso" role="status">{aviso}</div>}
        {forma === 'gesto' && !aviso && <div className="cel-espelho-dica">{modo === 'direto' ? 'Toque direto' : 'Trackpad'} · três dedos trocam</div>}
      </div>
    </div>
  )
}
