import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ATALHOS, PERFIS } from '../dados/atalhos'
import { Aviso } from '../kit/Aviso'
import { SuperficieTrackpad } from '../kit/SuperficieTrackpad'
import { Tecla } from '../kit/Tecla'
import { useVariante, variante } from '../lab/refinamento'
import { useSim } from '../sim/loja'
import type { TelaCelular } from '../sim/telas'
import { vibrar } from '../sim/vibrar'
import { TelaAtalhos } from './atalhos/TelaAtalhos'
import { TelaMixer } from './atalhos/TelaMixer'
import { TelaConexao } from './conexao/TelaConexao'
import { TelaGiro } from './controle/TelaGiro'
import { ComLaterais } from './laterais/ComLaterais'
import { ABRIR_MODOS } from './navegacao/Modos'
import { TelaEspelho } from './tela/TelaEspelho'
import { TelaMesa, podeVerTela } from './entrada/TelaMesa'
import { TelaTeclado } from './entrada/TelaTeclado'
import { TelaVoz } from './entrada/TelaVoz'
import { TelaJanelas } from './midia/TelaJanelas'
import { TelaLancador } from './midia/TelaLancador'
import { TelaMidia } from './midia/TelaMidia'
import { TelaReuniao } from './midia/TelaReuniao'
import './celular.css'

const TOQUE_LONGO_MS = 600

/* Botões de volume do celular (seção 12). No navegador, os de verdade não chegam à página:
   valem os desenhados na moldura e as setas ↑/↓ do teclado. */
export function apertarBotaoLateral(qual: 'mais' | 'menos') {
  const forma = variante('laterais')
  const s = useSim.getState()
  if (forma === 'sistema') { s.avisar(`Volume do celular ${qual === 'mais' ? 'mais alto' : 'mais baixo'}`); return }
  const [a, b] = PERFIS[s.appEmFoco]
  s.dispararAtalho(qual === 'mais' ? a : b)
  vibrar(8)
}

function Voltar() {
  return <Tecla rotulo="Voltar ao trackpad" icone="trackpad" aoTocar={() => useSim.getState().irPara('trackpad')} />
}

/* O que cada modo põe no centro e na última tecla da lateral do sistema. */
function conteudo(t: TelaCelular, verTela: boolean, setVerTela: (v: boolean) => void): { centro: ReactNode; doModo: ReactNode } {
  switch (t) {
    case 'teclado': return { centro: <TelaTeclado />, doModo: <Voltar /> }
    case 'voz': return { centro: <TelaVoz />, doModo: <Voltar /> }
    case 'mesa': return {
      centro: <TelaMesa verTela={verTela && podeVerTela()} />,
      doModo: podeVerTela()
        ? <Tecla rotulo={verTela ? 'Esconder a tela' : 'Ver a tela'} icone="tela" ligada={verTela} aoTocar={() => setVerTela(!verTela)} />
        : <Tecla rotulo="Limpar desenho" icone="fechar" aoTocar={() => useSim.getState().limparDesenho()} />,
    }
    case 'midia': return { centro: <TelaMidia />, doModo: <Voltar /> }
    case 'janelas': return { centro: <TelaJanelas />, doModo: <Voltar /> }
    case 'lancador': return { centro: <TelaLancador />, doModo: <Voltar /> }
    case 'reuniao': return { centro: <TelaReuniao />, doModo: <Voltar /> }
    case 'atalhos': return { centro: <TelaAtalhos />, doModo: <Voltar /> }
    case 'mixer': return { centro: <TelaMixer />, doModo: <Voltar /> }
    case 'giro': return { centro: <TelaGiro />, doModo: <Voltar /> }
    case 'espelho': return { centro: null, doModo: null }
    default: return { centro: <SuperficieTrackpad />, doModo: <Tecla rotulo="Mais atalhos" icone="atalhos" aoTocar={() => useSim.getState().irPara('atalhos')} /> }
  }
}

/* O celular inteiro: sem faixa no topo; tudo nas laterais (ou no menu de modos). */
export function Celular() {
  const tela = useSim((s) => s.tela)
  const laterais = useVariante('laterais')
  const longo = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dedos = useRef(new Set<number>())
  const [a, b] = PERFIS[useSim((s) => s.appEmFoco)]

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, select, [role="slider"]')) return
      if (e.key === 'ArrowUp') apertarBotaoLateral('mais')
      if (e.key === 'ArrowDown') apertarBotaoLateral('menos')
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  const [verTela, setVerTela] = useState(false)
  const teclado = useVariante('teclado')
  const { centro, doModo } = conteudo(tela, verTela, setVerTela)
  const telaInteira = tela === 'teclado' && teclado === 'dividido'
  return (
    <div className="cel" data-lab="1"
      onPointerDownCapture={(e) => {
        dedos.current.add(e.pointerId)
        const n = Math.max(dedos.current.size, useSim.getState().dedos)
        clearTimeout(longo.current)
        if (n >= 2 && tela !== 'espelho') longo.current = setTimeout(() => { vibrar(12); window.dispatchEvent(new Event(ABRIR_MODOS)) }, TOQUE_LONGO_MS)
      }}
      onPointerMoveCapture={(e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) clearTimeout(longo.current) }}
      onPointerUpCapture={(e) => { dedos.current.delete(e.pointerId); clearTimeout(longo.current) }}
      onPointerCancelCapture={(e) => { dedos.current.delete(e.pointerId); clearTimeout(longo.current) }}>
      {tela === 'conexao' ? <TelaConexao /> : tela === 'espelho' ? <TelaEspelho /> : telaInteira ? <div className="cel-inteira">{centro}</div> : <ComLaterais centro={centro} doModo={doModo} />}
      {laterais === 'legenda' && (
        <div className="cel-legenda-laterais" data-lab="12" aria-hidden="true">
          <span>Volume +: {ATALHOS[a].rotulo}</span><span>Volume −: {ATALHOS[b].rotulo}</span>
        </div>
      )}
      <Aviso />
    </div>
  )
}
