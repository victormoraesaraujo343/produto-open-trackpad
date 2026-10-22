import { IconeApp } from '../../kit/IconeApp'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { APPS } from '../../dados/apps'
import { PERFIS } from '../../dados/atalhos'
import { Lateral } from '../../kit/Lateral'
import { Led } from '../../kit/Led'
import { TeclaAtalho } from '../../kit/TeclaAtalho'
import { TeclaPresa } from '../../kit/TeclaPresa'
import { useVariante } from '../../lab/refinamento'
import { useSim } from '../../sim/loja'
import { Indicador } from '../conexao/Indicador'
import { TeclaModos } from '../navegacao/Modos'

/* No teclado (`compacto`), as laterais encolhem para o teclado ter a largura: o primeiro toque
   só as abre por cima; o segundo usa a tecla. Fecham sozinhas.
   Todo modo usa este arranjo (seção 2): centro com a proporção do trackpad do MacBook
   (16:10, a mesma da tela do computador), na altura inteira, e laterais fixas com o que se
   usa toda hora. Nada no topo: com o celular deitado, a altura é o espaço que falta.
   `doModo` é a única tecla que muda com o modo, sempre na última posição da lateral do sistema. */
export function ComLaterais({ centro, doModo, compacto = false }: { centro: ReactNode; doModo?: ReactNode; compacto?: boolean }) {
  const formaCompacta = useVariante('lateraisTeclado')
  const recolher = compacto && formaCompacta !== 'normais' ? formaCompacta : null
  const [aberta, setAberta] = useState<'esquerda' | 'direita' | null>(null)
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const engolir = useRef(false)
  useEffect(() => () => clearTimeout(relogio.current), [])
  const abrir = (lado: 'esquerda' | 'direita') => { clearTimeout(relogio.current); setAberta(lado); relogio.current = setTimeout(() => setAberta(null), 2600) }
  const forma = useVariante('trackpad')
  const mao = useSim((s) => s.ajustes.mao)
  const appId = useSim((s) => s.appEmFoco)
  const ids = PERFIS[appId]
  const nomeApp = <span className="cel-cabeca-app"><IconeApp app={appId} tamanho={16} /><span>{APPS[appId].nome}</span></span>

  const app = ids.slice(0, 5).map((id) => <TeclaAtalho key={id} id={id} />)
  const sistema = [
    <TeclaModos key="modos" />,
    <TeclaAtalho key="cd" id="cliqueDireito" />,
    <TeclaPresa key="ctrl" tecla="Ctrl" />,
    <TeclaPresa key="shift" tecla="Shift" />,
    <span key="modo" className="k-lugar-modo">{doModo}</span>,
  ]

  let esquerda: ReactNode = null
  let direita: ReactNode = null
  if (forma === 'uma-mao') {
    const dupla = <Lateral lado={mao === 'esquerda' ? 'esquerda' : 'direita'} rotulo="Atalhos e sistema" colunas={2} cabeca={<>{nomeApp}<Indicador /></>}>{[...app, ...sistema]}</Lateral>
    if (mao === 'esquerda') esquerda = dupla; else direita = dupla
  } else if (forma === 'polegar') {
    const a = <Lateral lado="esquerda" rotulo="Atalhos do app em foco" cabeca={nomeApp}>{[<InfoPresas key="i" />, <span key="v" />, ...app.slice(0, 3)]}</Lateral>
    const s = <Lateral lado="direita" rotulo="Sistema" cabeca={<Indicador />}>{[<span key="v1" />, <span key="v2" />, sistema[0], sistema[1], sistema[4]]}</Lateral>
    ;[esquerda, direita] = mao === 'esquerda' ? [s, a] : [a, s]
  } else {
    const a = <Lateral lado="esquerda" rotulo="Atalhos do app em foco" cabeca={nomeApp}>{app}</Lateral>
    const s = <Lateral lado="direita" rotulo="Sistema" cabeca={<><Indicador /><Saude /></>}>{sistema}</Lateral>
    ;[esquerda, direita] = mao === 'esquerda' ? [s, a] : [a, s]
  }

  if (recolher) {
    const lado = (no: ReactNode, l: 'esquerda' | 'direita') => no && (
      <div className={`cel-lado-compacto cel-lado-${recolher} cel-lado-${l}${aberta === l ? ' cel-lado-aberto' : ''}`}
        onPointerDownCapture={(e) => { if (aberta !== l) { e.stopPropagation(); engolir.current = true } abrir(l) }}
        onClickCapture={(e) => { if (engolir.current) { e.stopPropagation(); e.preventDefault(); engolir.current = false } }}
        onFocusCapture={() => abrir(l)}>
        {recolher === 'recolhidas' && aberta !== l && (
          <button type="button" className="cel-alca-lateral" aria-label={`Abrir a lateral ${l}`} onClick={() => abrir(l)}><i /></button>
        )}
        <div className="cel-lado-conteudo">{no}</div>
      </div>
    )
    return (
      <div className={`cel-laterais cel-laterais-compactas cel-laterais-${forma}`} data-lab="2">
        {lado(esquerda, 'esquerda')}
        <div className="cel-centro cel-centro-livre">{centro}</div>
        {lado(direita, 'direita')}
      </div>
    )
  }

  return (
    <div className={`cel-laterais cel-laterais-${forma}`} data-lab="2">
      {esquerda}
      <div className="cel-centro">{centro}</div>
      {direita}
    </div>
  )
}

/* Bateria fraca ou celular quente: aviso fixo na cabeça da lateral, além do aviso que some. */
function Saude() {
  const saude = useSim((s) => s.saude)
  if (saude === 'ok') return null
  return <span className="cel-saude" role="status"><Led aceso cor="ambar" />{saude === 'bateria' ? 'Bateria' : 'Quente'}</span>
}

function InfoPresas() {
  const presas = useSim((s) => s.teclasPresas)
  return (
    <div className="cel-info" aria-live="polite">
      <Led aceso={presas.length > 0} />
      <span>{presas.length ? `${presas.join(' + ')} preso` : 'Nada preso'}</span>
    </div>
  )
}
