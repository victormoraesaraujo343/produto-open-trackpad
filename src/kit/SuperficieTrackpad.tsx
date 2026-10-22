import { useRef, useState } from 'react'
import { useSim } from '../sim/loja'
import { vibrar } from '../sim/vibrar'
import './kit.css'

const TOQUE_MS = 260
const TOQUE_PX = 10
const FIRME_MS = 400
const GANHO = 1 / 900

interface Anel { id: number; x: number; y: number; firme: boolean }
type Ponto = { x: number; y: number }

/* A superfície do trackpad. Num celular de verdade conta os dedos que estão na tela;
   com mouse, usa os "dedos" escolhidos na barra de simulação.
   1 dedo move o cursor do computador falso (com aceleração: rápido anda mais),
   2 rolam, 3 e 4 deslizam entre áreas e janelas. Toque curto = clique; segurar = clique firme. */
export function SuperficieTrackpad() {
  const ref = useRef<HTMLDivElement>(null)
  const ponteiros = useRef(new Map<number, Ponto>())
  const inicio = useRef<{ t: number; x: number; y: number; andou: number; firme: boolean } | null>(null)
  const relogioFirme = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [dedos, setDedos] = useState<Ponto[]>([])
  const [aneis, setAneis] = useState<Anel[]>([])
  const [gesto, setGesto] = useState<string | null>(null)
  const dedosSimulados = useSim((s) => s.dedos)
  const { moverCursor, tocar } = useSim.getState()

  const local = (x: number, y: number): Ponto => {
    const r = ref.current!.getBoundingClientRect()
    const k = r.width / (ref.current!.offsetWidth || r.width) || 1
    return { x: (x - r.left) / k, y: (y - r.top) / k }
  }
  const anel = (p: Ponto, firme: boolean) => {
    const id = Date.now() + Math.random()
    setAneis((a) => [...a, { id, ...p, firme }])
    setTimeout(() => setAneis((a) => a.filter((x) => x.id !== id)), 650)
  }
  const quantos = () => (ponteiros.current.size > 1 ? ponteiros.current.size : dedosSimulados)

  return (
    <div ref={ref} className="k-superficie" role="application" aria-label="Trackpad"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        tocar()
        const p = local(e.clientX, e.clientY)
        ponteiros.current.set(e.pointerId, p)
        setDedos([...ponteiros.current.values()])
        if (ponteiros.current.size === 1) {
          inicio.current = { t: Date.now(), x: p.x, y: p.y, andou: 0, firme: false }
          clearTimeout(relogioFirme.current)
          relogioFirme.current = setTimeout(() => {
            const i = inicio.current
            if (i && i.andou < TOQUE_PX && quantos() === 1) { i.firme = true; vibrar([8, 40, 6]); anel({ x: i.x, y: i.y }, true); useSim.getState().avisar('Clique firme') }
          }, FIRME_MS)
        }
      }}
      onPointerMove={(e) => {
        const antes = ponteiros.current.get(e.pointerId)
        if (!antes) return
        const p = local(e.clientX, e.clientY)
        ponteiros.current.set(e.pointerId, p)
        setDedos([...ponteiros.current.values()])
        const dx = p.x - antes.x, dy = p.y - antes.y
        if (inicio.current) inicio.current.andou += Math.abs(dx) + Math.abs(dy)
        const n = quantos()
        if (n === 1) {
          const velocidade = Math.hypot(dx, dy)
          const acel = 1 + Math.min(2.5, velocidade / 6)
          moverCursor(dx * GANHO * acel, (dy * GANHO * acel * 16) / 10)
          setGesto(null)
        } else if (n === 2) setGesto('rolando')
        else setGesto(Math.abs(dx) > Math.abs(dy) ? `${n} dedos: trocar de área` : `${n} dedos: ver janelas`)
      }}
      onPointerUp={(e) => {
        const p = ponteiros.current.get(e.pointerId)
        ponteiros.current.delete(e.pointerId)
        setDedos([...ponteiros.current.values()])
        if (ponteiros.current.size > 0) return
        clearTimeout(relogioFirme.current)
        const i = inicio.current
        inicio.current = null
        setTimeout(() => setGesto(null), 500)
        if (i && p && !i.firme && Date.now() - i.t < TOQUE_MS && i.andou < TOQUE_PX) {
          vibrar(10)
          anel(p, false)
          if (quantos() === 2) useSim.getState().avisar('Clique direito')
        }
      }}
      onPointerCancel={(e) => { ponteiros.current.delete(e.pointerId); setDedos([...ponteiros.current.values()]); inicio.current = null; clearTimeout(relogioFirme.current) }}>
      {dedos.map((d, i) => <span key={i} className="k-dedo" style={{ left: d.x, top: d.y }} />)}
      {aneis.map((a) => <span key={a.id} className={`k-anel${a.firme ? ' k-firme' : ''}`} style={{ left: a.x, top: a.y }} />)}
      {gesto && <div className="k-gesto">{gesto}</div>}
    </div>
  )
}
