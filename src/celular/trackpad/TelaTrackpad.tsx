import { useRef, useState } from 'react'
import { PERFIS } from '../../dados/atalhos'
import { Camada } from '../../kit/Camada'
import { Modulo } from '../../kit/Modulo'
import { Poco } from '../../kit/Poco'
import { SuperficieTrackpad } from '../../kit/SuperficieTrackpad'
import { TeclaAtalho } from '../../kit/TeclaAtalho'
import { useVariante } from '../../lab/refinamento'
import { useSim } from '../../sim/loja'
import { AppEmFoco } from '../atalhos/AppEmFoco'

const LARGURA_MIN = 200
const LARGURA_MAX = 420

/* O trackpad principal (seção 2), em três formas. */
export function TelaTrackpad() {
  const forma = useVariante('trackpad')
  const ids = PERFIS[useSim((s) => s.appEmFoco)]
  const [gaveta, setGaveta] = useState(false)
  const [largura, setLargura] = useState(260)
  const arrasto = useRef<{ x: number; l: number } | null>(null)

  if (forma === 'faixa') {
    return (
      <div className="cel-tp cel-tp-faixa" data-lab="2">
        <SuperficieTrackpad />
        <div className="cel-faixa-atalhos">
          <AppEmFoco compacto />
          <div className="cel-faixa-teclas">{ids.slice(0, 6).map((id) => <TeclaAtalho key={id} id={id} />)}</div>
        </div>
      </div>
    )
  }

  if (forma === 'dividido') {
    return (
      <div className="cel-tp cel-tp-dividido" data-lab="2">
        <SuperficieTrackpad />
        <button type="button" className="cel-divisor" aria-label="Arrastar para mudar o tamanho do painel"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); arrasto.current = { x: e.clientX, l: largura } }}
          onPointerMove={(e) => {
            if (!arrasto.current) return
            const k = e.currentTarget.getBoundingClientRect().width / (e.currentTarget.offsetWidth || 1) || 1
            setLargura(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, arrasto.current.l - (e.clientX - arrasto.current.x) / k)))
          }}
          onPointerUp={() => { arrasto.current = null }}
          onKeyDown={(e) => { if (e.key === 'ArrowLeft') setLargura((l) => Math.min(LARGURA_MAX, l + 20)); if (e.key === 'ArrowRight') setLargura((l) => Math.max(LARGURA_MIN, l - 20)) }}>
          <i />
        </button>
        <Poco className="cel-painel-lado" style={{ width: largura }}>
          <AppEmFoco />
          <div className="cel-grade-lado">{ids.slice(0, largura > 320 ? 9 : 6).map((id) => <TeclaAtalho key={id} id={id} />)}</div>
        </Poco>
      </div>
    )
  }

  return (
    <div className="cel-tp cel-tp-gesto" data-lab="2">
      <SuperficieTrackpad />
      <button type="button" className="cel-alca" aria-label="Abrir atalhos" aria-expanded={gaveta}
        onClick={() => setGaveta(true)}
        onPointerMove={(e) => { if (e.buttons && e.movementX < -2) setGaveta(true) }}>
        <i />
      </button>
      <Camada aberta={gaveta} aoFechar={() => setGaveta(false)} className="cel-camada-direita">
        <Modulo className="cel-gaveta">
          <AppEmFoco />
          <div className="cel-grade-gaveta">{ids.map((id) => <TeclaAtalho key={id} id={id} />)}</div>
        </Modulo>
      </Camada>
    </div>
  )
}
