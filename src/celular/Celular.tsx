import { useEffect, useState, type ReactNode } from 'react'
import { ATALHOS } from '../dados/atalhos'
import { Aviso } from '../kit/Aviso'
import { SuperficieTrackpad } from '../kit/SuperficieTrackpad'
import { Tecla } from '../kit/Tecla'
import { mostrarDescanso, useSim } from '../sim/loja'
import type { TelaCelular } from '../sim/telas'
import { vibrar } from '../sim/vibrar'
import { TelaAtalhos } from './atalhos/TelaAtalhos'
import { TelaMixer } from './atalhos/TelaMixer'
import { TelaConexao } from './conexao/TelaConexao'
import { TelaGiro } from './controle/TelaGiro'
import { ComLaterais } from './laterais/ComLaterais'
import { TelaEspelho } from './tela/TelaEspelho'
import { JanelaUnica, MonitorExtra, Recorte } from './tela/Conteudos'
import { TelaPainel } from './tela/TelaPainel'
import { TelaRecursos } from './recursos/TelaRecursos'
import { TelaAjustes } from './ajustes/TelaAjustes'
import { TelaCamera } from './ponte/TelaCamera'
import { TelaComputadores } from './ponte/TelaComputadores'
import { TelaMicrofone } from './ponte/TelaMicrofone'
import { TelaTransferencia } from './ponte/TelaTransferencia'
import { TelaVertical } from './tela/TelaVertical'
import { ChaveModoMesa, TelaMesa, podeVerTela } from './entrada/TelaMesa'
import { TelaTeclado } from './entrada/TelaTeclado'
import { TelaVoz } from './entrada/TelaVoz'
import { TelaJanelas } from './midia/TelaJanelas'
import { TelaLancador } from './midia/TelaLancador'
import { TelaMidia } from './midia/TelaMidia'
import { TelaReuniao } from './midia/TelaReuniao'
import './celular.css'

const PARADO_MS = 20000

/* Botões de volume do celular (seção 12). No navegador, os de verdade não chegam à página:
   valem os desenhados na moldura e as setas ↑/↓ do teclado. */
export function apertarBotaoLateral(qual: 'mais' | 'menos') {
  const s = useSim.getState()
  if (s.ajustes.botoesVolume === 'sistema') { s.avisar(`Volume do celular ${qual === 'mais' ? 'mais alto' : 'mais baixo'}`); return }
  const [a, b] = s.perfis[s.appEmFoco]
  s.dispararAtalho(qual === 'mais' ? a : b)
  vibrar(8)
}

function Voltar() {
  return <Tecla rotulo="Voltar ao trackpad" icone="trackpad" aoTocar={() => useSim.getState().irPara('trackpad')} />
}

/* O que cada modo põe no centro e na última tecla da lateral do sistema. */
function conteudo(t: TelaCelular, verTela: boolean, setVerTela: (v: boolean) => void, editarPainel: boolean, setEditarPainel: (v: boolean) => void): { centro: ReactNode; doModo: ReactNode } {
  switch (t) {
    case 'teclado': return { centro: <TelaTeclado />, doModo: <Voltar /> }
    case 'voz': return { centro: <TelaVoz />, doModo: <Voltar /> }
    case 'mesa': return {
      centro: <TelaMesa verTela={verTela && podeVerTela()} aoVerTela={podeVerTela() ? () => setVerTela(!verTela) : undefined} />,
      doModo: <ChaveModoMesa />,
    }
    case 'transferencia': return { centro: <TelaTransferencia />, doModo: <Voltar /> }
    case 'camera': return { centro: <TelaCamera />, doModo: <Voltar /> }
    case 'microfone': return { centro: <TelaMicrofone />, doModo: <Voltar /> }
    case 'computadores': return { centro: <TelaComputadores />, doModo: <Voltar /> }
    case 'ajustes': return { centro: <TelaAjustes />, doModo: <Voltar /> }
    case 'recursos': return {
      centro: <TelaRecursos editar={editarPainel} />,
      doModo: useSim.getState().monitor.vista === 'avancada'
        ? <Tecla rotulo={editarPainel ? 'Pronto' : 'Editar'} icone={editarPainel ? 'tick' : 'ajustes'} ligada={editarPainel} aoTocar={() => setEditarPainel(!editarPainel)} />
        : <Voltar />,
    }
    case 'painel': return {
      centro: <TelaPainel editar={editarPainel} />,
      doModo: <Tecla rotulo={editarPainel ? 'Pronto' : 'Editar'} icone={editarPainel ? 'tick' : 'ajustes'} ligada={editarPainel} aoTocar={() => setEditarPainel(!editarPainel)} />,
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
  const botoes = useSim((s) => s.ajustes.botoesVolume)
  const [a, b] = useSim((s) => s.perfis[s.appEmFoco])
  const proprios = useSim((s) => s.atalhosProprios)
  const nomeAtalho = (id: string) => (ATALHOS[id] ?? proprios[id])?.rotulo ?? '—'

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if ((e.target as HTMLElement).closest?.('input, textarea, select, [role="slider"], [role="tablist"], [role="menu"], [role="listbox"], [role="radiogroup"], .bancada-computador, [class^="rf-"], [class*=" rf-"]')) return
      if (e.key === 'ArrowUp') apertarBotaoLateral('mais')
      if (e.key === 'ArrowDown') apertarBotaoLateral('menos')
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  const [verTela, setVerTela] = useState(false)
  const descanso = useSim(mostrarDescanso)
  useSim((s) => s.monitor.vista)
  const escuro = useSim((s) => s.ocioso && (!s.opcoes.paradoViraPainel || s.descanso.jeito === 'escuro'))
  const noturno = useSim((s) => s.opcoes.noturno)
  const quente = useSim((s) => s.saude === 'quente')
  const girado = useSim((s) => s.ajustes.girado)
  useEffect(() => {
    if (descanso) return
    let t = setTimeout(() => useSim.getState().ficarOcioso(), PARADO_MS)
    const mexeu = () => { clearTimeout(t); t = setTimeout(() => useSim.getState().ficarOcioso(), PARADO_MS) }
    window.addEventListener('pointerdown', mexeu)
    window.addEventListener('keydown', mexeu)
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', mexeu); window.removeEventListener('keydown', mexeu) }
  }, [descanso, tela])
  const [editarPainel, setEditarPainel] = useState(false)
  const { centro, doModo } = conteudo(tela, verTela, setVerTela, editarPainel, setEditarPainel)
  return (
    <div className={`cel${noturno ? ' cel-noturno' : ''}${quente ? ' cel-quente' : ''}${girado ? ' cel-girado' : ''}`} data-lab="1">
      {tela === 'conexao' ? <TelaConexao />
        : tela === 'espelho' ? <TelaEspelho />
        : tela === 'monitor' ? <TelaEspelho conteudo={<MonitorExtra />} lab="19" cursorProprio />
        : tela === 'janela' ? <TelaEspelho conteudo={<JanelaUnica />} lab="20" cursorProprio />
        : tela === 'recorte' ? <TelaEspelho conteudo={<Recorte />} lab="20" />
        : tela === 'vertical' ? <TelaVertical />
        : <ComLaterais centro={<div key={tela} className="cel-troca-modo">{centro}</div>} doModo={doModo} compacto={tela === 'teclado'} />}
      {botoes === 'legenda' && (
        <div className="cel-legenda-laterais" data-lab="12" aria-hidden="true">
          <span>Volume +: {nomeAtalho(a)}</span><span>Volume −: {nomeAtalho(b)}</span>
        </div>
      )}
      {escuro && (
        <div className="cel-camada-escura" role="button" tabIndex={0} aria-label="Tela escurecida. Toque para acordar" data-lab="28"
          onPointerDown={(e) => { e.stopPropagation(); useSim.getState().tocar() }} onKeyDown={() => useSim.getState().tocar()} />
      )}
      {descanso && (
        <div className="cel-camada-descanso" role="button" tabIndex={0} aria-label="Celular parado. Toque para voltar"
          onPointerDown={(e) => { e.stopPropagation(); useSim.getState().tocar() }} onKeyDown={() => useSim.getState().tocar()}>
          <TelaPainel descanso />
        </div>
      )}
      <Aviso />
    </div>
  )
}
