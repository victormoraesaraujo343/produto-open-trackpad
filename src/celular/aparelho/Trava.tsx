import { useEffect, useRef, useState } from 'react'
import { Camada } from '../../kit/Camada'
import { Icone } from '../../kit/Icone'
import { Led } from '../../kit/Led'
import { Modulo } from '../../kit/Modulo'
import { useVariante } from '../../lab/refinamento'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'

const SEGURAR_MS = 3000
const PONTOS = [{ x: 60, y: 40 }, { x: 60, y: 140 }, { x: 160, y: 140 }]

/* Modo travado (seção 13): o celular não sai do OpenTrackpad nem troca de modo por engano. */
export function BotaoTrava() {
  const forma = useVariante('trava')
  const travado = useSim((s) => s.travado)
  const travar = useSim((s) => s.travar)
  const [progresso, setProgresso] = useState(0)
  const [desenhar, setDesenhar] = useState(false)
  const relogio = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => () => clearInterval(relogio.current), [])
  if (forma === 'sem') return <span className="cel-trava-vazio" />

  const destravar = () => { travar(false); vibrar([10, 30, 10]); useSim.getState().avisar('Destravado') }

  if (!travado) {
    return (
      <button type="button" className="cel-trava" data-lab="13" aria-label="Travar no OpenTrackpad"
        onClick={() => { travar(true); vibrar(12); useSim.getState().avisar('Travado: o celular fica só no OpenTrackpad') }}>
        <Icone nome="cadeado" tamanho={16} /><span>Travar</span>
      </button>
    )
  }

  if (forma === 'segurar') {
    const parar = () => { clearInterval(relogio.current); setProgresso(0) }
    return (
      <button type="button" className="cel-trava cel-travado" data-lab="13" aria-label="Segure por 3 segundos para destravar"
        style={{ ['--p' as string]: `${progresso * 360}deg` }}
        onPointerDown={() => {
          const t0 = Date.now()
          clearInterval(relogio.current)
          relogio.current = setInterval(() => {
            const p = Math.min(1, (Date.now() - t0) / SEGURAR_MS)
            setProgresso(p)
            if (p >= 1) { parar(); destravar() }
          }, 50)
        }}
        onPointerUp={parar} onPointerLeave={parar} onPointerCancel={parar}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.repeat) destravar() }}>
        <span className="cel-trava-anel" aria-hidden="true" />
        <Led aceso cor="ambar" /><span>{progresso > 0 ? 'Continue segurando' : 'Segure para destravar'}</span>
      </button>
    )
  }

  return (
    <>
      <button type="button" className="cel-trava cel-travado" data-lab="13" onClick={() => setDesenhar(true)}>
        <Led aceso cor="ambar" /><span>Travado</span>
      </button>
      <Camada aberta={desenhar} aoFechar={() => setDesenhar(false)}>
        <Modulo className="cel-desenho">
          <p>Ligue os pontos na ordem para destravar</p>
          <Traco aoAcertar={() => { setDesenhar(false); destravar() }} />
          <button type="button" className="cel-texto-botao" onClick={() => { setDesenhar(false); destravar() }}>Destravar sem desenhar</button>
        </Modulo>
      </Camada>
    </>
  )
}

function Traco({ aoAcertar }: { aoAcertar: () => void }) {
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
