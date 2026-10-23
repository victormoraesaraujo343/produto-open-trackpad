import { useEffect, useState } from 'react'
import { Icone } from '../../kit/Icone'
import { Segmentos } from '../../kit/Segmentos'
import { useSim, type BlocoMonitor, type EstiloMedidor, type VistaMonitor } from '../../sim/loja'
import { METRICAS, olharTelemetria, type Metrica } from '../../sim/telemetria'
import { vibrar } from '../../sim/vibrar'
import { ESTILOS, Medidor } from './Medidor'

/* Vista padrão: o painel misto (seção 36). */
const PADRAO: BlocoMonitor[] = [
  { id: 'p1', metrica: 'cpu', estilo: 'grafico', largura: 2 }, { id: 'p2', metrica: 'memoria', estilo: 'anel', largura: 1 }, { id: 'p3', metrica: 'temperatura', estilo: 'ponteiro', largura: 1 },
  { id: 'p4', metrica: 'rede', estilo: 'colunas', largura: 2 }, { id: 'p5', metrica: 'gpu', estilo: 'segmentos', largura: 1 }, { id: 'p6', metrica: 'bateria', estilo: 'numero', largura: 1 },
]
const METRICAS_ORDEM = Object.keys(METRICAS) as Metrica[]
const proximo = <T,>(lista: T[], atual: T) => lista[(lista.indexOf(atual) + 1) % lista.length]

function Grade({ blocos }: { blocos: BlocoMonitor[] }) {
  return (
    <div className="rc-grade">
      {blocos.map((b) => <div key={b.id} className={`rc-celula rc-l${b.largura}`}><Medidor metrica={b.metrica} estilo={b.estilo} /></div>)}
    </div>
  )
}

/* Avançada: a grade é sua. Em Editar, toque num bloco para selecionar e ajuste na barra de
   baixo (métrica, estilo, largura, mover, tirar); a alça de cada bloco arrasta para outro lugar.
   Arrastar não é o único jeito: os botões ‹ › também movem. */
function Avancada({ editar }: { editar: boolean }) {
  const blocos = useSim((s) => s.monitor.blocos)
  const { configurarBlocoMonitor, moverBlocoMonitor, removerBlocoMonitor, adicionarBlocoMonitor } = useSim.getState()
  const [sel, setSel] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<number | null>(null)
  const indiceSob = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-bloco]') as HTMLElement | null
    return el ? blocos.findIndex((b) => b.id === el.dataset.bloco) : null
  }
  if (!editar) return blocos.length ? <Grade blocos={blocos} /> : <div className="cel-vazio"><Icone nome="info" tamanho={22} /><span>Nenhum bloco. Toque em Editar.</span></div>
  const i = blocos.findIndex((b) => b.id === sel)
  const b = i >= 0 ? blocos[i] : null
  return (
    <div className="rc-edicao">
      <div className="rc-grade rc-editando"
        onPointerMove={(e) => { if (arrastando) setAlvo(indiceSob(e.clientX, e.clientY)) }}
        onPointerUp={() => { if (arrastando && alvo !== null) { moverBlocoMonitor(arrastando, alvo); vibrar(8) } setArrastando(null); setAlvo(null) }}>
        {blocos.map((x, j) => (
          <div key={x.id} data-bloco={x.id} role="button" tabIndex={0} aria-pressed={x.id === sel} aria-label={`${METRICAS[x.metrica].nome}, ${ESTILOS.find((e) => e[0] === x.estilo)?.[1]}. Selecionar`}
            className={`rc-celula rc-l${x.largura}${x.id === sel ? ' rc-selecionado' : ''}${arrastando === x.id ? ' rc-erguido' : ''}${alvo === j && arrastando !== x.id ? ' rc-alvo' : ''}`}
            onClick={() => setSel(x.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(x.id) } }}>
            <Medidor metrica={x.metrica} estilo={x.estilo} />
            <button type="button" className="rc-alca" aria-label={`Arrastar ${METRICAS[x.metrica].nome}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.releasePointerCapture?.(e.pointerId); setArrastando(x.id); setSel(x.id); vibrar(6) }}>
              <Icone nome="maximizar" tamanho={14} />
            </button>
          </div>
        ))}
        <button type="button" className="rc-celula rc-l1 rc-mais" onClick={() => { setSel(adicionarBlocoMonitor()); vibrar(8) }} aria-label="Adicionar bloco"><Icone nome="mais" tamanho={22} /></button>
      </div>
      <div className="rc-barra-edicao" role="toolbar" aria-label="Ajustar o bloco selecionado">
        {b ? (<>
          <button type="button" onClick={() => configurarBlocoMonitor(b.id, { metrica: proximo(METRICAS_ORDEM, b.metrica) })} aria-label={`Métrica: ${METRICAS[b.metrica].nome}. Trocar`}><small>Métrica</small>{METRICAS[b.metrica].curto}</button>
          <button type="button" onClick={() => configurarBlocoMonitor(b.id, { estilo: proximo(ESTILOS.map((x) => x[0]) as EstiloMedidor[], b.estilo) })} aria-label={`Estilo: ${ESTILOS.find((x) => x[0] === b.estilo)?.[1]}. Trocar`}><small>Estilo</small>{ESTILOS.find((x) => x[0] === b.estilo)?.[1]}</button>
          <button type="button" onClick={() => configurarBlocoMonitor(b.id, { largura: b.largura === 1 ? 2 : 1 })}><small>Largura</small>{b.largura === 1 ? 'Normal' : 'Larga'}</button>
          <button type="button" disabled={i === 0} onClick={() => moverBlocoMonitor(b.id, i - 1)} aria-label="Mover para trás">‹</button>
          <button type="button" disabled={i === blocos.length - 1} onClick={() => moverBlocoMonitor(b.id, i + 1)} aria-label="Mover para frente">›</button>
          <button type="button" onClick={() => { removerBlocoMonitor(b.id); setSel(null) }} aria-label={`Tirar ${METRICAS[b.metrica].nome}`}><Icone nome="fechar" tamanho={16} /></button>
        </>) : <span className="rc-dica-edicao"><Icone nome="info" tamanho={14} />Toque num bloco</span>}
      </div>
    </div>
  )
}

/* Recursos do computador (seção 36, issue #11): vistas Simples e Padrão prontas; Avançada
   montada pelo usuário, misturando estilos. A Simples mostra LEDs em pé. */
export function TelaRecursos({ editar }: { editar: boolean }) {
  const vista = useSim((s) => s.monitor.vista)
  useEffect(() => olharTelemetria(), [])
  return (
    <div className="rc-tela" data-lab="36">
      <Segmentos rotulo="Vista" valor={vista} opcoes={[['simples', 'Simples'], ['padrao', 'Padrão'], ['avancada', 'Avançada']]} aoMudar={(v) => useSim.getState().setVistaMonitor(v as VistaMonitor)} />
      {vista === 'simples' && (
        <div className="rc-simples">{(['cpu', 'memoria', 'temperatura'] as Metrica[]).map((m) => <Medidor key={m} metrica={m} estilo="segmentos" grande />)}</div>
      )}
      {vista === 'padrao' && <Grade blocos={PADRAO} />}
      {vista === 'avancada' && <Avancada editar={editar} />}
    </div>
  )
}
