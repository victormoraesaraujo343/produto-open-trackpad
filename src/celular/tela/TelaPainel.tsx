import { useEffect, useState } from 'react'
import { AGENDA } from '../../dados/agenda'
import { FAIXA } from '../../dados/audio'
import { NOTIFICACOES } from '../../dados/notificacoes'
import { Basculante } from '../../kit/Basculante'
import { Icone } from '../../kit/Icone'
import { IconeApp } from '../../kit/IconeApp'
import { Tecla } from '../../kit/Tecla'
import { PRESETS } from '../../sim/conexao'
import { useSim, type Bloco } from '../../sim/loja'
import { olharTelemetria } from '../../sim/telemetria'
import { Medidor as MedidorRecurso } from '../recursos/Medidor'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const NOME_BLOCO: Record<string, string> = { hora: 'Hora', maquina: 'Computador', reuniao: 'Próxima reunião', notificacoes: 'Notificações', musica: 'Música', rede: 'Rede' }

function useAgora() {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 15000); return () => clearInterval(t) }, [])
  useEffect(() => olharTelemetria(), [])
  return agora
}

function ConteudoBloco({ id, descanso }: { id: string; descanso: boolean }) {
  const agora = useAgora()
  const preset = useSim((s) => s.preset)
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (id === 'hora') return <><span className="cel-hora">{hora}</span><span className="cel-data">{DIAS[agora.getDay()]}, {agora.getDate()} {MESES[agora.getMonth()]}</span></>
  if (id === 'maquina') return <div className="cel-maquina">{(['cpu', 'memoria', 'temperatura', 'bateria'] as const).map((m) => <MedidorRecurso key={m} metrica={m} estilo="barra" />)}</div>
  if (id === 'reuniao') return (<>
    <b className="cel-reuniao-prox">{AGENDA[0].titulo}</b>
    <span className="cel-data">{AGENDA[0].inicio} · {AGENDA[0].local}</span>
    {!descanso && <Tecla rotulo="Entrar na reunião" icone="camera" className="cel-tecla-texto" aoTocar={() => { useSim.getState().focar('meet'); useSim.getState().irPara('reuniao') }} />}
  </>)
  if (id === 'notificacoes') return (<>
    {NOTIFICACOES.map((n) => (
      <div key={n.id} className="cel-notificacao">
        <IconeApp app={n.app} tamanho={22} />
        <div><b>{n.titulo}</b><span>{n.texto}</span></div>
        <small>{n.ha}</small>
      </div>
    ))}
  </>)
  if (id === 'musica') return (
    <div className="cel-bloco-musica">
      <span className="cel-capa-mini" aria-hidden="true" />
      <div><b>{FAIXA.titulo}</b><span>{FAIXA.artista}</span></div>
      <Icone nome="musica" tamanho={16} />
    </div>
  )
  return (
    <div className="cel-bloco-rede">
      <span><Icone nome="usb" tamanho={14} />{PRESETS[preset].rotulo}</span>
      <span aria-label="Download 42 megabits por segundo">↓ 42 Mb/s</span>
      <span aria-label="Upload 6 megabits por segundo">↑ 6 Mb/s</span>
    </div>
  )
}

/* Liga, desliga e ordena os blocos (issues #6 e #7). Usado no celular e na central. */
export function ConfigBlocos({ onde }: { onde: 'painel' | 'descanso' }) {
  const blocos = useSim((s) => (onde === 'painel' ? s.blocosPainel : s.descanso.blocos))
  const { alternarBloco, moverBloco } = useSim.getState()
  return (
    <ol className="cel-config-blocos" aria-label={onde === 'painel' ? 'Blocos do painel de informações' : 'Blocos da tela de descanso'}>
      {blocos.map((b, i) => (
        <li key={b.id}>
          <span className="cel-config-nome">{NOME_BLOCO[b.id]}</span>
          <span className="cel-config-ordem">
            <button type="button" aria-label={`Subir ${NOME_BLOCO[b.id]}`} disabled={i === 0} onClick={() => moverBloco(onde, b.id, -1)}>↑</button>
            <button type="button" aria-label={`Descer ${NOME_BLOCO[b.id]}`} disabled={i === blocos.length - 1} onClick={() => moverBloco(onde, b.id, 1)}>↓</button>
          </span>
          <Basculante ligado={b.ligado} rotulo={NOME_BLOCO[b.id]} aoMudar={() => alternarBloco(onde, b.id)} />
        </li>
      ))}
    </ol>
  )
}

function Grade({ blocos, descanso }: { blocos: Bloco[]; descanso: boolean }) {
  const ligados = blocos.filter((b) => b.ligado)
  if (!ligados.length) return <div className="cel-vazio"><Icone nome="info" tamanho={22} /><span>Nenhum bloco ligado</span></div>
  return (
    <div className={`cel-painel-grade cel-blocos-${Math.min(ligados.length, 4)}`}>
      {ligados.map((b) => (
        <section key={b.id} className={`cel-bloco cel-bloco-${b.id}`} aria-label={NOME_BLOCO[b.id]}>
          {b.id !== 'hora' && <span className="cel-bloco-titulo">{NOME_BLOCO[b.id]}</span>}
          <ConteudoBloco id={b.id} descanso={descanso} />
        </section>
      ))}
    </div>
  )
}

/* Painel de informações (seção 22; blocos configuráveis, #6) e tela de descanso (seção 23,
   #7): parado, o celular mostra o relógio, as informações ou uma foto, escurecido e com o
   conteúdo derivando devagar para a tela não marcar. */
export function TelaPainel({ descanso = false, editar = false }: { descanso?: boolean; editar?: boolean }) {
  const agora = useAgora()
  const blocosPainel = useSim((s) => s.blocosPainel)
  const conf = useSim((s) => s.descanso)
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (editar) {
    return (
      <div className="cel-painel cel-painel-editar" data-lab="22">
        <ConfigBlocos onde="painel" />
      </div>
    )
  }
  if (!descanso) {
    return <div className="cel-painel" data-lab="22"><Grade blocos={blocosPainel} descanso={false} /></div>
  }
  if (conf.jeito === 'relogio' || conf.jeito === 'foto') {
    return (
      <div className={`cel-painel cel-descanso cel-descanso-${conf.jeito}`} data-lab="23">
        <div className="cel-deriva">
          <span className="cel-hora-grande">{hora}</span>
          <span className="cel-data">{DIAS[agora.getDay()]}, {agora.getDate()} {MESES[agora.getMonth()]}</span>
        </div>
      </div>
    )
  }
  return (
    <div className="cel-painel cel-descanso" data-lab="23">
      <div className="cel-deriva"><Grade blocos={conf.blocos} descanso /></div>
    </div>
  )
}
