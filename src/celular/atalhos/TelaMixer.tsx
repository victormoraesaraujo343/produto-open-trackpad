import { useRef, useState } from 'react'
import { APPS } from '../../dados/apps'
import { APPS_TOCANDO, type CanalApp } from '../../dados/audio'
import { Icone } from '../../kit/Icone'
import { Led } from '../../kit/Led'
import { Poco } from '../../kit/Poco'
import { useVariante } from '../../lab/refinamento'
import { anguloDe, criarGiro } from '../../sim/giro'
import { useGiroPonteiro } from '../../sim/useGiroPonteiro'
import { vibrar } from '../../sim/vibrar'
import { Anel } from '../controle/Anel'

const PASSO = 2
const SEGURAR_MS = 350
const prender = (v: number) => Math.min(100, Math.max(0, v))

/* Som por aplicativo com giratório (seção 11). */
export function TelaMixer() {
  const forma = useVariante('mixer')
  const [canais, setCanais] = useState<CanalApp[]>(APPS_TOCANDO)
  const [sel, setSel] = useState(0)
  const ajustar = (i: number, d: number) => setCanais((c) => c.map((x, j) => (j === i ? { ...x, volume: prender(x.volume + d * PASSO), mudo: false } : x)))
  const mudo = (i: number) => setCanais((c) => c.map((x, j) => (j === i ? { ...x, mudo: !x.mudo } : x)))
  const teclado = (i: number) => (e: React.KeyboardEvent) => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') ajustar(i, 1); if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') ajustar(i, -1) }
  const giroSel = useGiroPonteiro((d) => ajustar(sel, d), 40)

  const botaoMudo = (c: CanalApp, i: number) => (
    <button type="button" className={`cel-mudo${c.mudo ? ' k-ligada' : ''}`} aria-pressed={c.mudo} aria-label={`${APPS[c.app].nome}: ${c.mudo ? 'tirar do mudo' : 'pôr no mudo'}`}
      onPointerDown={(e) => e.stopPropagation()} onClick={() => { mudo(i); vibrar(8) }}>
      <Icone nome={c.mudo ? 'mudo' : 'volume'} tamanho={16} />
    </button>
  )

  if (forma === 'cada') {
    return (
      <div className="cel-mixer cel-mixer-cada" data-lab="11">
        {canais.map((c, i) => <Knob key={c.app} canal={c} aoPasso={(d) => ajustar(i, d)} teclado={teclado(i)} mudo={botaoMudo(c, i)} />)}
      </div>
    )
  }

  if (forma === 'segura') return <Segurar canais={canais} ajustar={ajustar} botaoMudo={botaoMudo} teclado={teclado} />

  const atual = canais[sel]
  return (
    <div className="cel-mixer" data-lab="11">
      <Poco className="cel-mixer-lista" role="listbox" aria-label="Aplicativos tocando">
        {canais.map((c, i) => (
          <div key={c.app} role="option" aria-selected={i === sel} tabIndex={0} className={`cel-canal${i === sel ? ' cel-canal-sel' : ''}`}
            onClick={() => { setSel(i); vibrar(6) }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSel(i) }}>
            <Led aceso={i === sel} />
            <i className="cel-canal-cor" style={{ background: APPS[c.app].cor }} aria-hidden="true" />
            <span className="cel-canal-nome">{APPS[c.app].nome}</span>
            <Nivel valor={c.mudo ? 0 : c.volume} />
            {botaoMudo(c, i)}
          </div>
        ))}
      </Poco>
      <div className="cel-mixer-giro" role="slider" tabIndex={0} aria-label={`Volume de ${APPS[atual.app].nome}`} aria-valuenow={atual.volume} aria-valuemin={0} aria-valuemax={100}
        onKeyDown={teclado(sel)} {...giroSel}>
        <Anel valor={atual.mudo ? 0 : atual.volume} tamanho={210} rotulo={APPS[atual.app].nome} detalhe={atual.mudo ? 'no mudo' : 'gire para ajustar'} />
      </div>
    </div>
  )
}

/* Nível em segmentos: o comprimento diz o valor, não só a cor. */
function Nivel({ valor }: { valor: number }) {
  return <span className="cel-nivel" aria-label={`${valor}%`}>{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < Math.round(valor / 12.5) ? 'aceso' : ''} />)}</span>
}

function Knob({ canal, aoPasso, teclado, mudo }: { canal: CanalApp; aoPasso: (d: number) => void; teclado: (e: React.KeyboardEvent) => void; mudo: React.ReactNode }) {
  const giro = useGiroPonteiro(aoPasso, 40)
  return (
    <div className="cel-knob">
      <div role="slider" tabIndex={0} aria-label={`Volume de ${APPS[canal.app].nome}`} aria-valuenow={canal.volume} aria-valuemin={0} aria-valuemax={100} onKeyDown={teclado} {...giro}>
        <Anel valor={canal.mudo ? 0 : canal.volume} tamanho={112} detalhe={canal.mudo ? 'no mudo' : undefined} />
      </div>
      <div className="cel-knob-nome"><i style={{ background: APPS[canal.app].cor }} aria-hidden="true" /><span>{APPS[canal.app].nome}</span>{mudo}</div>
    </div>
  )
}

function Segurar({ canais, ajustar, botaoMudo, teclado }: {
  canais: CanalApp[]; ajustar: (i: number, d: number) => void; botaoMudo: (c: CanalApp, i: number) => React.ReactNode; teclado: (i: number) => (e: React.KeyboardEvent) => void
}) {
  const [ativo, setAtivo] = useState<{ i: number; x: number; y: number } | null>(null)
  const centro = useRef({ x: 0, y: 0 })
  const giro = useRef(criarGiro(40))
  const girando = useRef(false)
  const ultimo = useRef(0)
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fechar = () => { clearTimeout(relogio.current); setAtivo(null); girando.current = false }
  return (
    <div className="cel-mixer cel-mixer-segura" data-lab="11"
      onPointerMove={(e) => {
        if (!ativo) { if (Math.hypot(e.clientX - centro.current.x, e.clientY - centro.current.y) > 8) clearTimeout(relogio.current); return }
        const a = anguloDe(centro.current.x, centro.current.y, e.clientX, e.clientY)
        if (!girando.current) { if (Math.hypot(e.clientX - centro.current.x, e.clientY - centro.current.y) > 20) { giro.current.comecar(a); ultimo.current = 0; girando.current = true } return }
        const total = giro.current.mover(a)
        if (total !== ultimo.current) { vibrar(4); ajustar(ativo.i, total - ultimo.current); ultimo.current = total }
      }}
      onPointerUp={fechar} onPointerCancel={fechar}>
      {canais.map((c, i) => (
        <div key={c.app} className="cel-barra" role="slider" tabIndex={0} aria-label={`Volume de ${APPS[c.app].nome}: segure e gire`} aria-valuenow={c.volume} aria-valuemin={0} aria-valuemax={100}
          onKeyDown={teclado(i)}
          onPointerDown={(e) => {
            const raiz = e.currentTarget.parentElement!.getBoundingClientRect()
            const k = raiz.width / (e.currentTarget.parentElement!.offsetWidth || raiz.width)
            const local = { x: (e.clientX - raiz.left) / k, y: (e.clientY - raiz.top) / k }
            centro.current = { x: e.clientX, y: e.clientY }
            clearTimeout(relogio.current)
            relogio.current = setTimeout(() => { setAtivo({ i, ...local }); vibrar([6, 30, 6]) }, SEGURAR_MS)
          }}>
          <i className="cel-canal-cor" style={{ background: APPS[c.app].cor }} aria-hidden="true" />
          <span className="cel-canal-nome">{APPS[c.app].nome}</span>
          <span className="cel-barra-trilho"><span style={{ width: `${c.mudo ? 0 : c.volume}%` }} /></span>
          <span className="cel-barra-valor">{c.mudo ? 'mudo' : `${c.volume}%`}</span>
          {botaoMudo(c, i)}
        </div>
      ))}
      {ativo && <div className="cel-roda" style={{ left: ativo.x, top: ativo.y }}><Anel valor={canais[ativo.i].volume} tamanho={150} rotulo={APPS[canais[ativo.i].app].nome} /></div>}
      {!ativo && <div className="cel-dica-rodape">Segure uma linha e gire para ajustar</div>}
    </div>
  )
}
