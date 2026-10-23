import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DesktopFalso } from '../../bancada/DesktopFalso'
import { DESENHO_COMPUTADOR } from '../../bancada/MolduraComputador'
import { useTamanho } from '../../design/useTamanho'
import { Tecla } from '../../kit/Tecla'
import { PRESETS, qualidadeDe } from '../../sim/conexao'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'
import { ComLaterais } from '../laterais/ComLaterais'

type Modo = 'direto' | 'trackpad'
const NOME: Record<Modo, string> = { direto: 'Toque direto', trackpad: 'Trackpad' }

/* Tela espelhada (seção 5): ocupa o mesmo centro 16:10 do trackpad, entre as mesmas laterais.
   Dois jeitos de tocar, e o dono escolhe: direto (tocar num ponto clica ali) ou trackpad
   (o toque continua relativo, com o cursor na imagem). A tecla Modos fica na lateral do sistema. */
export function TelaEspelho({ conteudo, lab = '5', cursorProprio = false }: { conteudo?: ReactNode; lab?: string; cursorProprio?: boolean } = {}) {
  const [modo, setModo] = useState<Modo>('direto')
  const [aviso, setAviso] = useState<string | null>(null)
  const ultimo = useRef<{ x: number; y: number } | null>(null)
  const area = useRef<HTMLDivElement>(null)
  const { largura } = useTamanho(area)
  const escala = largura / DESENHO_COMPUTADOR.largura
  const { moverCursor } = useSim.getState()
  const outro: Modo = modo === 'direto' ? 'trackpad' : 'direto'
  const qualidade = qualidadeDe(PRESETS[useSim((s) => s.preset)])
  const [proprio, setProprio] = useState({ x: 0.5, y: 0.5 })
  const [verQualidade, setVerQualidade] = useState(true)
  useEffect(() => { setVerQualidade(true); const t = setTimeout(() => setVerQualidade(false), 2600); return () => clearTimeout(t) }, [qualidade])
  const mover = (dx: number, dy: number) => cursorProprio ? setProprio((c) => ({ x: Math.min(1, Math.max(0, c.x + dx)), y: Math.min(1, Math.max(0, c.y + dy)) })) : moverCursor(dx, dy)
  const cursorAtual = () => (cursorProprio ? proprio : useSim.getState().cursor)

  const trocar = (m: Modo) => {
    setModo(m); vibrar(10)
    setAviso(m === 'direto' ? 'Toque direto: toque onde quer clicar' : 'Trackpad: arraste para mover o cursor')
    setTimeout(() => setAviso(null), 1800)
  }
  const local = (el: HTMLElement, x: number, y: number) => {
    const r = el.getBoundingClientRect()
    return { x: (x - r.left) / r.width, y: (y - r.top) / r.height }
  }

  const doModo = (
    <Tecla rotulo={`Jeito de tocar: ${NOME[modo]}. Tocar para trocar`} icone={modo === 'direto' ? 'caneta' : 'trackpad'} ligada={modo === 'direto'} mostrarRotulo={false} aoTocar={() => trocar(outro)}>
      <span className="k-presa"><b>{modo === 'direto' ? 'Direto' : 'Trackpad'}</b><small>jeito de tocar</small></span>
    </Tecla>
  )

  const imagem = (
    <div ref={area} className={`cel-espelho-imagem cel-qualidade-${qualidade === 'alta' ? 'alta' : 'media'}`} data-lab={lab}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        const p = local(e.currentTarget, e.clientX, e.clientY)
        if (modo === 'direto') { const c = cursorAtual(); mover(p.x - c.x, p.y - c.y); vibrar(10) }
        ultimo.current = p
      }}
      onPointerMove={(e) => {
        if (modo !== 'trackpad' || !ultimo.current) return
        const p = local(e.currentTarget, e.clientX, e.clientY)
        mover(p.x - ultimo.current.x, p.y - ultimo.current.y)
        ultimo.current = p
      }}
      onPointerUp={() => { ultimo.current = null }}
      onPointerCancel={() => { ultimo.current = null }}>
      {escala > 0 && <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${escala})`, transformOrigin: '0 0', pointerEvents: 'none' }}>{conteudo ?? <DesktopFalso />}</div>}
      {cursorProprio && <svg className="cel-cursor-proprio" style={{ left: `${proprio.x * 100}%`, top: `${proprio.y * 100}%` }} width="14" height="19" viewBox="0 0 18 24" aria-hidden="true"><path d="M1 1v19l5-5 3.5 7.5 3-1.4L9 13.8h7z" fill="#fff" stroke="#000" strokeWidth="1.2" /></svg>}
      <span className={`cel-qualidade${verQualidade ? ' cel-qualidade-ve' : ''}`} role="img" aria-label={`Qualidade ${qualidade}`}>
        <i className="aceso" /><i className="aceso" /><i className={qualidade === 'alta' ? 'aceso' : ''} />
      </span>
      {aviso && <div className="cel-espelho-aviso" role="status">{aviso}</div>}
    </div>
  )

  return <ComLaterais centro={imagem} doModo={doModo} />
}
