import { useEffect, useState } from 'react'
import { Camada } from '../../kit/Camada'
import { Icone } from '../../kit/Icone'
import { Modulo } from '../../kit/Modulo'
import { useVariante } from '../../lab/refinamento'
import { liberado } from '../../sim/conexao'
import { nivelAtual, useSim } from '../../sim/loja'
import { TELAS_CELULAR } from '../../sim/telas'
import { Indicador } from '../conexao/Indicador'
import { BotaoTrava } from '../aparelho/Trava'
import { MODOS } from './modos'

function useModos() {
  const tela = useSim((s) => s.tela)
  const nivel = nivelAtual(useSim((s) => s.preset))
  const irPara = useSim((s) => s.irPara)
  return MODOS.map((m) => ({ ...m, ativo: m.tela === tela, livre: liberado(TELAS_CELULAR[m.tela].nivel, nivel), ir: () => irPara(m.tela) }))
}

function ListaDeModos({ aoEscolher }: { aoEscolher: () => void }) {
  const modos = useModos()
  return (
    <nav className="cel-modos-lista" aria-label="Modos">
      {modos.map((m) => (
        <button key={m.tela} type="button" className={`cel-modo${m.ativo ? ' cel-modo-ativo' : ''}`} aria-current={m.ativo ? 'page' : undefined}
          disabled={!m.livre} onClick={() => { m.ir(); aoEscolher() }}>
          <Icone nome={m.icone} />
          <span>{m.nome}</span>
          {!m.livre && <small>precisa de conexão melhor</small>}
        </button>
      ))}
    </nav>
  )
}

/* A faixa do topo do celular: indicador de conexão, trava e o jeito de trocar de modo
   (seção 3 do laboratório). */
export function Modos() {
  const forma = useVariante('modos')
  const travado = useSim((s) => s.travado)
  const [aberto, setAberto] = useState(false)
  const modos = useModos()
  useEffect(() => {
    if (forma !== 'doisdedos') return
    const abrir = () => { if (!useSim.getState().travado) setAberto(true) }
    window.addEventListener(ABRIR_MODOS, abrir)
    return () => window.removeEventListener(ABRIR_MODOS, abrir)
  }, [forma])

  if (forma === 'topo') {
    return (
      <header className="cel-faixa cel-faixa-alta" data-lab="3">
        <BotaoTrava />
        <nav className="cel-abas" aria-label="Modos">
          {modos.map((m) => (
            <button key={m.tela} type="button" className={`cel-aba${m.ativo ? ' cel-modo-ativo' : ''}`} aria-current={m.ativo ? 'page' : undefined}
              disabled={!m.livre || travado} onClick={m.ir} title={m.livre ? m.nome : `${m.nome}: precisa de conexão melhor`}>
              <Icone nome={m.icone} tamanho={18} /><span>{m.nome}</span>
            </button>
          ))}
        </nav>
        <Indicador />
      </header>
    )
  }

  return (
    <header className="cel-faixa" data-lab="3">
      <BotaoTrava />
      {forma === 'borda' ? (
        <button type="button" className="cel-puxador" aria-label="Abrir modos" aria-expanded={aberto} disabled={travado}
          onClick={() => setAberto(true)}>
          <i /><span>{modos.find((m) => m.ativo)?.nome ?? 'Modos'}</span>
        </button>
      ) : (
        <button type="button" className="cel-so-leitor" aria-label="Abrir modos" disabled={travado} onClick={() => setAberto(true)}>Modos</button>
      )}
      <Indicador />
      <Camada aberta={aberto} aoFechar={() => setAberto(false)} className={forma === 'borda' ? 'cel-camada-topo' : ''}>
        <Modulo className="cel-modos-modulo"><ListaDeModos aoEscolher={() => setAberto(false)} /></Modulo>
      </Camada>
    </header>
  )
}

/* Abrir os modos por toque longo com dois dedos (forma "doisdedos"). Com mouse, vale o
   número de dedos escolhido na barra de simulação. */
export const ABRIR_MODOS = 'otp:abrir-modos'
