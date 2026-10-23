import { useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { SuperficieTrackpad } from '../../kit/SuperficieTrackpad'
import { useVariante } from '../../lab/refinamento'
import { useSim } from '../../sim/loja'
import { useGiroPonteiro } from '../../sim/useGiroPonteiro'
import { vibrar } from '../../sim/vibrar'
import './giro.css'

const PASSO = 2 // volume por passo
const VOLTA = 50 // passos por volta do botão (50 × 2 = 0 a 100)
const PX_PASSO = 12 // arraste (px) de um passo: um sulco da rodinha, ou 2 pontos na régua
const PX_PONTO = PX_PASSO / PASSO

type Parte = { volume: number; passo: (d: number) => void; teclado: (e: ReactKeyboardEvent) => void }
type Gesto = ReturnType<typeof useGiroPonteiro>

/* Botão giratório do volume (seção 10), em três formas: botão no centro, régua e rodinha.
   O valor sempre aparece em texto; cor e forma não bastam. */
export function TelaGiro() {
  const forma = useVariante('giro')
  const mao = useSim((s) => s.ajustes.mao)
  const volume = useSim((s) => s.volume)
  const mudar = useSim((s) => s.mudarVolume)
  const passo = (d: number) => mudar(d * PASSO)
  const teclado = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); passo(1); vibrar(4) }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); passo(-1); vibrar(4) }
  }
  const parte = { volume, passo, teclado }

  if (forma === 'regua') return <Regua {...parte} />
  if (forma === 'rodinha') return <Rodinha {...parte} direita={mao === 'direita'} />
  return <Botao {...parte} />
}

/* Gestos do giro não chegam ao trackpad: o cursor do computador fica parado. */
function isolar(g: Gesto) {
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => { e.stopPropagation(); g.onPointerDown(e) },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => { e.stopPropagation(); g.onPointerMove(e) },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => { e.stopPropagation(); g.onPointerUp() },
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => { e.stopPropagation(); g.onPointerCancel() },
  }
}

const ponto = (graus: number, raio: number): [number, number] => {
  const t = (graus * Math.PI) / 180
  return [50 + raio * Math.sin(t), 50 - raio * Math.cos(t)]
}

/* Botão grande: o centro inteiro é o botão. Gire com o dedo em círculo; cada marca é um passo. */
function Botao({ volume, passo, teclado }: Parte) {
  const giro = useGiroPonteiro(passo, VOLTA)
  return (
    <div className="cel-tp cel-giro giro-botao-raiz" data-lab="10">
      <div className="giro-botao" role="slider" aria-label="Volume: gire o botão com o dedo" aria-valuenow={volume} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${volume}%`} tabIndex={0} onKeyDown={teclado} {...isolar(giro)}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          {/* 270°, com folga embaixo: 0 e 100 não caem no mesmo lugar */}
          {Array.from({ length: 51 }, (_, i) => {
            const graus = -135 + i * 5.4
            const maior = i % 5 === 0
            const [x0, y0] = ponto(graus, maior ? 35 : 39)
            const [x1, y1] = ponto(graus, 43)
            const classe = `giro-botao-marca${maior ? ' maior' : ''}${i * 2 <= volume && volume > 0 ? ' acesa' : ''}`
            return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className={classe} />
          })}
          <g transform={`rotate(${-135 + volume * 2.7} 50 50)`}>
            <circle cx="50" cy="17" r="2.8" className="giro-botao-ponteiro" />
          </g>
        </svg>
        <div className="giro-botao-centro" aria-hidden="true"><b>{volume}%</b><small>Volume</small></div>
      </div>
    </div>
  )
}

/* Régua embaixo do trackpad: os números deslizam sob um ponteiro fixo no meio, como o anel
   de uma lente. Arrastar para a esquerda sobe o volume. */
function Regua({ volume, passo, teclado }: Parte) {
  const [resto, setResto] = useState(0) // px ainda não convertidos em passo (a faixa segue o dedo)
  const ativo = useRef(false)
  const ultimoX = useRef(0)
  const sobra = useRef(0)
  return (
    <div className="cel-tp cel-giro giro-regua-raiz" data-lab="10">
      <SuperficieTrackpad />
      <div className="giro-regua" role="slider" aria-label="Volume: arraste a régua para os lados" aria-valuenow={volume} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${volume}%`} tabIndex={0} onKeyDown={teclado}
        onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); ativo.current = true; ultimoX.current = e.clientX }}
        onPointerMove={(e) => {
          e.stopPropagation()
          if (!ativo.current) return
          sobra.current -= e.clientX - ultimoX.current
          ultimoX.current = e.clientX
          const n = Math.trunc(sobra.current / PX_PASSO)
          if (n !== 0) { sobra.current -= n * PX_PASSO; vibrar(4); passo(n) }
          setResto(sobra.current)
        }}
        onPointerUp={(e) => { e.stopPropagation(); ativo.current = false }}
        onPointerCancel={(e) => { e.stopPropagation(); ativo.current = false }}>
        <span className="giro-regua-valor" aria-hidden="true">{volume}%</span>
        <div className="k-poco giro-regua-poco" aria-hidden="true">
          <svg className="giro-regua-faixa" width={100 * PX_PONTO} height={64} viewBox={`0 0 ${100 * PX_PONTO} 64`} style={{ marginLeft: -(volume * PX_PONTO) - resto }}>
            {Array.from({ length: 100 / PASSO + 1 }, (_, i) => {
              const v = i * PASSO
              const x = v * PX_PONTO
              const maior = v % 10 === 0
              return (
                <g key={v}>
                  <line x1={x} x2={x} y1={maior ? 30 : 46} y2={64} className={maior ? 'maior' : undefined} />
                  {maior && <text x={x} y={20}>{v}</text>}
                </g>
              )
            })}
          </svg>
          <i className="giro-regua-ponteiro" />
        </div>
      </div>
    </div>
  )
}

/* Rodinha de polegar, na borda do lado do polegar. Arrastar para cima sobe o volume, e os
   sulcos andam com o dedo. */
function Rodinha({ volume, passo, teclado, direita }: Parte & { direita: boolean }) {
  const [sulcos, setSulcos] = useState(0)
  const ativo = useRef(false)
  const ultimoY = useRef(0)
  const sobra = useRef(0)
  const roda = (
    <div className="giro-rodinha-coluna">
      <span className="giro-rodinha-valor" aria-hidden="true">{volume}%</span>
      <div className="giro-rodinha" role="slider" aria-label="Volume: arraste a rodinha para cima e para baixo" aria-valuenow={volume} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${volume}%`} tabIndex={0} onKeyDown={teclado}
        style={{ ['--sulcos' as string]: `${sulcos}px` }}
        onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); ativo.current = true; ultimoY.current = e.clientY }}
        onPointerMove={(e) => {
          e.stopPropagation()
          if (!ativo.current) return
          const dy = e.clientY - ultimoY.current
          ultimoY.current = e.clientY
          setSulcos((s) => ((s + dy) % PX_PASSO + PX_PASSO) % PX_PASSO)
          sobra.current -= dy
          const n = Math.trunc(sobra.current / PX_PASSO)
          if (n !== 0) { sobra.current -= n * PX_PASSO; vibrar(4); passo(n) }
        }}
        onPointerUp={(e) => { e.stopPropagation(); ativo.current = false }}
        onPointerCancel={(e) => { e.stopPropagation(); ativo.current = false }}>
        <span className="giro-rodinha-sulcos" />
      </div>
    </div>
  )
  return (
    <div className="cel-tp cel-giro giro-rodinha-raiz" data-lab="10">
      {!direita && roda}
      <SuperficieTrackpad />
      {direita && roda}
    </div>
  )
}
