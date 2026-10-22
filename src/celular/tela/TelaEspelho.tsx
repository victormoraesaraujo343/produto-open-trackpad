import { useRef, useState } from 'react'
import { DesktopFalso } from '../../bancada/DesktopFalso'
import { DESENHO_COMPUTADOR } from '../../bancada/MolduraComputador'
import { useTamanho } from '../../design/useTamanho'
import { Icone } from '../../kit/Icone'
import { Tecla } from '../../kit/Tecla'
import { useVariante } from '../../lab/refinamento'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'
import { ComLaterais } from '../laterais/ComLaterais'

type Modo = 'direto' | 'trackpad'
const NOME: Record<Modo, string> = { direto: 'Toque direto', trackpad: 'Trackpad' }

/* Tela espelhada (seção 5): ocupa o mesmo centro 16:10 do trackpad, entre as mesmas laterais.
   Dois jeitos de tocar, e o dono escolhe: direto (tocar num ponto clica ali) ou trackpad
   (o toque continua relativo, com o cursor na imagem). */
export function TelaEspelho() {
  const forma = useVariante('espelho')
  const [modo, setModo] = useState<Modo>('direto')
  const [aviso, setAviso] = useState<string | null>(null)
  const ultimo = useRef<{ x: number; y: number } | null>(null)
  const ponteiros = useRef(new Set<number>())
  const area = useRef<HTMLDivElement>(null)
  const { largura } = useTamanho(area)
  const escala = largura / DESENHO_COMPUTADOR.largura
  const { moverCursor, irPara } = useSim.getState()
  const outro: Modo = modo === 'direto' ? 'trackpad' : 'direto'

  const trocar = (m: Modo) => {
    setModo(m); vibrar(10)
    setAviso(m === 'direto' ? 'Toque direto: toque onde quer clicar' : 'Trackpad: arraste para mover o cursor')
    setTimeout(() => setAviso(null), 1800)
  }
  const local = (el: HTMLElement, x: number, y: number) => {
    const r = el.getBoundingClientRect()
    return { x: (x - r.left) / r.width, y: (y - r.top) / r.height }
  }

  const doModo = forma === 'lateral'
    ? (
      <Tecla rotulo={`Jeito de tocar: ${NOME[modo]}. Tocar para trocar`} icone={modo === 'direto' ? 'caneta' : 'trackpad'} ligada={modo === 'direto'} mostrarRotulo={false} aoTocar={() => trocar(outro)}>
        <span className="k-presa"><b>{modo === 'direto' ? 'Direto' : 'Trackpad'}</b><small>jeito de tocar</small></span>
      </Tecla>
    )
    : <Tecla rotulo="Voltar ao trackpad" icone="trackpad" aoTocar={() => irPara('trackpad')} />

  const imagem = (
    <div ref={area} className="cel-espelho-imagem" data-lab="5"
      onPointerDown={(e) => {
        ponteiros.current.add(e.pointerId)
        e.currentTarget.setPointerCapture?.(e.pointerId)
        const dedos = Math.max(ponteiros.current.size, useSim.getState().dedos)
        if (forma === 'gesto' && dedos >= 3) { trocar(outro); return }
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
      {escala > 0 && <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${escala})`, transformOrigin: '0 0', pointerEvents: 'none' }}><DesktopFalso /></div>}
      {forma === 'flutuante' && (
        <button type="button" className="cel-flutuante" onPointerDown={(e) => e.stopPropagation()} onClick={() => trocar(outro)}
          aria-label={`Jeito de tocar: ${NOME[modo]}. Tocar para trocar`}>
          <Icone nome={modo === 'direto' ? 'caneta' : 'trackpad'} /><span>{NOME[modo]}</span>
        </button>
      )}
      {forma === 'gesto' && <button type="button" className="cel-so-leitor" onClick={() => trocar(outro)}>Trocar jeito de tocar</button>}
      {aviso && <div className="cel-espelho-aviso" role="status">{aviso}</div>}
      {forma === 'gesto' && !aviso && <div className="cel-espelho-dica">{NOME[modo]} · três dedos trocam</div>}
    </div>
  )

  return <ComLaterais centro={imagem} doModo={doModo} />
}
