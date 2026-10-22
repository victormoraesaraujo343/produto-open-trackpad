import { useEffect, useRef } from 'react'
import { ATALHOS, PERFIS } from '../dados/atalhos'
import { Aviso } from '../kit/Aviso'
import { useVariante, variante } from '../lab/refinamento'
import { useSim } from '../sim/loja'
import type { TelaCelular } from '../sim/telas'
import { vibrar } from '../sim/vibrar'
import { TelaAtalhos } from './atalhos/TelaAtalhos'
import { TelaMixer } from './atalhos/TelaMixer'
import { TelaConexao } from './conexao/TelaConexao'
import { TelaGiro } from './controle/TelaGiro'
import { TelaPresas } from './controle/TelaPresas'
import { ABRIR_MODOS, Modos } from './navegacao/Modos'
import { TelaEspelho } from './tela/TelaEspelho'
import { TelaTrackpad } from './trackpad/TelaTrackpad'
import './celular.css'

const TELAS: Record<TelaCelular, () => React.ReactNode> = {
  trackpad: () => <TelaTrackpad />,
  atalhos: () => <TelaAtalhos />,
  mixer: () => <TelaMixer />,
  espelho: () => <TelaEspelho />,
  presas: () => <TelaPresas />,
  giro: () => <TelaGiro />,
  conexao: () => <TelaConexao />,
  ajustes: () => <TelaTrackpad />,
}

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

/* O celular inteiro: faixa do topo (modos, conexão, trava) e a tela do modo atual. */
export function Celular() {
  const tela = useSim((s) => s.tela)
  const laterais = useVariante('laterais')
  const longo = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dedos = useRef(new Set<number>())
  const appEmFoco = useSim((s) => s.appEmFoco)
  const [a, b] = PERFIS[appEmFoco]

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, select, [role="slider"]')) return
      if (e.key === 'ArrowUp') apertarBotaoLateral('mais')
      if (e.key === 'ArrowDown') apertarBotaoLateral('menos')
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

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
      <Modos />
      <div className="cel-conteudo">{TELAS[tela]()}</div>
      {laterais === 'legenda' && (
        <div className="cel-legenda-laterais" data-lab="12" aria-hidden="true">
          <span>Volume +: {ATALHOS[a].rotulo}</span><span>Volume −: {ATALHOS[b].rotulo}</span>
        </div>
      )}
      <Aviso />
    </div>
  )
}
