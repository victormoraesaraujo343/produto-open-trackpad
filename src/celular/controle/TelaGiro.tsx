import { useRef, useState } from 'react'
import { Icone } from '../../kit/Icone'
import { SuperficieTrackpad } from '../../kit/SuperficieTrackpad'
import { useVariante } from '../../lab/refinamento'
import { useSim } from '../../sim/loja'
import { anguloDe, criarGiro } from '../../sim/giro'
import { useGiroPonteiro } from '../../sim/useGiroPonteiro'
import { vibrar } from '../../sim/vibrar'
import { Anel } from './Anel'

const PASSO = 2
const SEGURAR_MS = 350

/* Botão giratório do volume (seção 10). O valor aparece no computador (aviso de volume) e,
   no celular, pelo tamanho do arco, nunca só pela cor. */
export function TelaGiro() {
  const forma = useVariante('giro')
  const volume = useSim((s) => s.volume)
  const mudar = useSim((s) => s.mudarVolume)
  const passo = (d: number) => mudar(d * PASSO)
  const teclado = (e: React.KeyboardEvent) => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') mudar(PASSO); if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') mudar(-PASSO) }

  const canto = useGiroPonteiro(passo, 40, (el) => { const r = el.getBoundingClientRect(); return { x: r.right, y: r.bottom } })
  const aro = useGiroPonteiro(passo, 48)

  if (forma === 'aro') {
    return (
      <div className="cel-tp cel-giro" data-lab="10">
        <div className="cel-aro" role="slider" aria-label="Volume: deslize o dedo pela borda, em círculo" aria-valuenow={volume} aria-valuemin={0} aria-valuemax={100} tabIndex={0} onKeyDown={teclado} {...aro}
          style={{ ['--v' as string]: `${volume * 3.6}deg` }}>
          <div className="cel-aro-dentro" onPointerDown={(e) => e.stopPropagation()}><SuperficieTrackpad /></div>
        </div>
      </div>
    )
  }

  if (forma === 'roda') return <Roda volume={volume} passo={passo} teclado={teclado} />

  return (
    <div className="cel-tp cel-giro" data-lab="10">
      <SuperficieTrackpad />
      <div className="cel-arco" role="slider" aria-label="Volume: deslize pelo arco" aria-valuenow={volume} aria-valuemin={0} aria-valuemax={100} tabIndex={0} onKeyDown={teclado} {...canto}>
        <svg viewBox="0 0 160 160" width="160" height="160" aria-hidden="true">
          <path d="M160 20 A140 140 0 0 0 20 160" className="cel-arco-trilho" />
          <path d="M160 20 A140 140 0 0 0 20 160" className="cel-arco-valor" pathLength={100} strokeDasharray={`${volume} 100`} />
        </svg>
        <span className="cel-arco-texto">Volume<br /><b>{volume}%</b></span>
      </div>
    </div>
  )
}

function Roda({ volume, passo, teclado }: { volume: number; passo: (d: number) => void; teclado: (e: React.KeyboardEvent) => void }) {
  const [roda, setRoda] = useState<{ x: number; y: number } | null>(null)
  const centro = useRef({ x: 0, y: 0 })
  const giro = useRef(criarGiro(40))
  const girando = useRef(false)
  const ultimo = useRef(0)
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fechar = () => { clearTimeout(relogio.current); setRoda(null); girando.current = false }
  return (
    <div className="cel-tp cel-giro" data-lab="10" role="slider" aria-label="Volume: segure no trackpad e gire" aria-valuenow={volume} aria-valuemin={0} aria-valuemax={100} tabIndex={0} onKeyDown={teclado}
      onPointerDownCapture={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        const k = r.width / (e.currentTarget.offsetWidth || r.width)
        const local = { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }
        centro.current = { x: e.clientX, y: e.clientY }
        clearTimeout(relogio.current)
        relogio.current = setTimeout(() => { setRoda(local); vibrar([6, 30, 6]) }, SEGURAR_MS)
      }}
      onPointerMoveCapture={(e) => {
        if (!roda) { if (Math.hypot(e.clientX - centro.current.x, e.clientY - centro.current.y) > 8) clearTimeout(relogio.current); return }
        e.stopPropagation()
        const a = anguloDe(centro.current.x, centro.current.y, e.clientX, e.clientY)
        if (!girando.current) { if (Math.hypot(e.clientX - centro.current.x, e.clientY - centro.current.y) > 20) { giro.current.comecar(a); ultimo.current = 0; girando.current = true } return }
        const total = giro.current.mover(a)
        if (total !== ultimo.current) { vibrar(4); passo(total - ultimo.current); ultimo.current = total }
      }}
      onPointerUpCapture={fechar} onPointerCancelCapture={fechar}>
      <SuperficieTrackpad cliqueFirme={false} />
      {roda && <div className="cel-roda" style={{ left: roda.x, top: roda.y }}><Anel valor={volume} tamanho={150} rotulo="Volume" /></div>}
      {!roda && <span className="cel-dica-icone" aria-hidden="true"><Icone nome="recarregar" tamanho={26} /></span>}
    </div>
  )
}
