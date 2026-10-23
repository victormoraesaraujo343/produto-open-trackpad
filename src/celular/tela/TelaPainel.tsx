import { useEffect, useId, useState } from 'react'
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
import './descanso.css'

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

const horaDe = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dataDe = (d: Date) => `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`

/* Descanso analógico: o segundo ponteiro anda de segundo em segundo (só este modo; o resto a cada 15 s). */
function RelogioAnalogico() {
  const [agora, setAgora] = useState(() => new Date())
  const id = useId().replace(/:/g, '')
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 1000); return () => clearInterval(t) }, [])
  const h = agora.getHours() % 12, m = agora.getMinutes(), s = agora.getSeconds()
  return (
    <>
      <svg viewBox="0 0 200 200" className="cel-rosto" role="img" aria-label={`Relógio, ${horaDe(agora)}`}>
        <defs>
          <radialGradient id={`f${id}`} cx="50%" cy="38%" r="62%">
            <stop offset="0" stopColor="#25272B" /><stop offset="1" stopColor="#0C0D0F" />
          </radialGradient>
          <linearGradient id={`a${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8D9094" /><stop offset=".4" stopColor="#3C3F42" /><stop offset=".6" stopColor="#6A6D71" /><stop offset="1" stopColor="#26282B" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="98" fill={`url(#a${id})`} />
        <circle cx="100" cy="100" r="91" fill={`url(#f${id})`} />
        <g className="cel-marcas">
          {Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return <line key={i} x1={100 + 73 * Math.sin(a)} y1={100 - 73 * Math.cos(a)} x2={100 + 84 * Math.sin(a)} y2={100 - 84 * Math.cos(a)} /> })}
        </g>
        <line className="cel-ponteiro-h" transform={`rotate(${(h + m / 60) * 30} 100 100)`} x1="100" y1="112" x2="100" y2="58" />
        <line className="cel-ponteiro-m" transform={`rotate(${(m + s / 60) * 6} 100 100)`} x1="100" y1="116" x2="100" y2="34" />
        <line className="cel-ponteiro-s" transform={`rotate(${s * 6} 100 100)`} x1="100" y1="128" x2="100" y2="24" />
        <circle className="cel-eixo" cx="100" cy="100" r="4.5" />
      </svg>
      <span className="cel-data">{dataDe(agora)}</span>
    </>
  )
}

/* Descanso em dígitos de LED: cada segmento é um polígono; "on" = aceso. Lista em a..g. */
const SEGMENTOS = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg']
const PONTOS: Record<string, string> = (() => {
  const h = 3.6
  const horiz = (y: number) => `5,${y} ${5 + h},${y - h} ${35 - h},${y - h} 35,${y} ${35 - h},${y + h} ${5 + h},${y + h}`
  const vert = (x: number, y1: number, y2: number) => `${x},${y1} ${x + h},${y1 + h} ${x + h},${y2 - h} ${x},${y2} ${x - h},${y2 - h} ${x - h},${y1 + h}`
  return { a: horiz(3.6), g: horiz(32), d: horiz(60.4), f: vert(3.6, 5, 30), b: vert(36.4, 5, 30), e: vert(3.6, 34, 59), c: vert(36.4, 34, 59) }
})()

function Digito({ n }: { n: string }) {
  const acesos = SEGMENTOS[Number(n)]
  return (
    <svg viewBox="0 0 40 64" className="cel-digito" aria-hidden="true">
      {Object.entries(PONTOS).map(([s, p]) => <polygon key={s} points={p} className={acesos.includes(s) ? 'on' : undefined} />)}
    </svg>
  )
}

function Digitos({ agora }: { agora: Date }) {
  const hh = String(agora.getHours()).padStart(2, '0'), mm = String(agora.getMinutes()).padStart(2, '0')
  return (
    <>
      <div className="cel-digitos" role="img" aria-label={`Relógio, ${horaDe(agora)}`}>
        <Digito n={hh[0]} /><Digito n={hh[1]} />
        <svg viewBox="0 0 16 64" className="cel-dois-pontos" aria-hidden="true"><circle cx="8" cy="20" r="3.4" /><circle cx="8" cy="44" r="3.4" /></svg>
        <Digito n={mm[0]} /><Digito n={mm[1]} />
      </div>
      <span className="cel-data">{dataDe(agora)}</span>
    </>
  )
}

/* Descanso de medidores: quatro anéis do computador e o relógio pequeno embaixo. */
function Medidores({ agora }: { agora: Date }) {
  return (
    <>
      <div className="cel-medidores-linha">
        {(['cpu', 'memoria', 'temperatura', 'bateria'] as const).map((m) => <MedidorRecurso key={m} metrica={m} estilo="anel" />)}
      </div>
      <div className="cel-medidores-hora" role="img" aria-label={`Relógio, ${horaDe(agora)}, ${dataDe(agora)}`}>
        <span className="cel-hora-pequena">{horaDe(agora)}</span><span className="cel-data">{dataDe(agora)}</span>
      </div>
    </>
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
  if (conf.jeito === 'analogico') return <div className="cel-painel cel-descanso cel-descanso-analogico" data-lab="23"><div className="cel-deriva"><RelogioAnalogico /></div></div>
  if (conf.jeito === 'digitos') return <div className="cel-painel cel-descanso cel-descanso-digitos" data-lab="23"><div className="cel-deriva"><Digitos agora={agora} /></div></div>
  if (conf.jeito === 'medidores') return <div className="cel-painel cel-descanso cel-descanso-medidores" data-lab="23"><div className="cel-deriva"><Medidores agora={agora} /></div></div>
  if (conf.jeito === 'aluminio') return (
    <div className="cel-painel cel-descanso cel-descanso-aluminio" data-lab="23">
      <div className="cel-deriva cel-superficie">
        <div className="cel-canto" role="img" aria-label={`Relógio, ${hora}, ${dataDe(agora)}`}>
          <span className="cel-hora-pequena">{hora}</span><span className="cel-data">{dataDe(agora)}</span>
        </div>
      </div>
    </div>
  )
  return (
    <div className="cel-painel cel-descanso" data-lab="23">
      <div className="cel-deriva"><Grade blocos={conf.blocos} descanso /></div>
    </div>
  )
}
