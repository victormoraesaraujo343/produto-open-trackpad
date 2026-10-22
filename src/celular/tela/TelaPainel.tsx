import { useEffect, useState } from 'react'
import { AGENDA } from '../../dados/agenda'
import { NOTIFICACOES } from '../../dados/notificacoes'
import { IconeApp } from '../../kit/IconeApp'
import { Tecla } from '../../kit/Tecla'
import { useVariante } from '../../lab/refinamento'
import { useSim } from '../../sim/loja'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function useAgora() {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 15000); return () => clearInterval(t) }, [])
  return agora
}

function Medidor({ nome, valor, detalhe }: { nome: string; valor: number; detalhe: string }) {
  return (
    <div className="cel-medida" role="meter" aria-label={nome} aria-valuenow={valor} aria-valuemin={0} aria-valuemax={100}>
      <span className="cel-medida-nome">{nome}</span>
      <span className="cel-medida-trilho"><i style={{ width: `${valor}%` }} className={valor > 80 ? 'alto' : ''} /></span>
      <span className="cel-medida-valor">{detalhe}</span>
    </div>
  )
}

/* Painel de informações (seção 22): relógio, máquina, próxima reunião e notificações.
   `descanso` é a versão de quando o celular fica parado (seção 23): escura e com o conteúdo
   se movendo devagar para a tela não marcar. */
export function TelaPainel({ descanso = false }: { descanso?: boolean }) {
  const agora = useAgora()
  const forma = useVariante('descanso')
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const data = `${DIAS[agora.getDay()]}, ${agora.getDate()} ${MESES[agora.getMonth()]}`
  const proxima = AGENDA[0]

  if (descanso && forma === 'relogio') {
    return (
      <div className="cel-painel cel-descanso cel-descanso-relogio" data-lab="23">
        <div className="cel-deriva"><span className="cel-hora-grande">{hora}</span><span className="cel-data">{data}</span></div>
      </div>
    )
  }

  return (
    <div className={`cel-painel${descanso ? ' cel-descanso' : ''}`} data-lab={descanso ? '23' : '22'}>
      <div className={descanso ? 'cel-deriva cel-painel-grade' : 'cel-painel-grade'}>
        <section className="cel-bloco cel-bloco-hora" aria-label="Hora">
          <span className="cel-hora">{hora}</span>
          <span className="cel-data">{data}</span>
        </section>
        <section className="cel-bloco" aria-label="Computador">
          <Medidor nome="Processador" valor={23} detalhe="23%" />
          <Medidor nome="Memória" valor={61} detalhe="9,8 GB" />
          <Medidor nome="Temperatura" valor={48} detalhe="54 °C" />
          <Medidor nome="Bateria" valor={78} detalhe="78% carregando" />
        </section>
        <section className="cel-bloco" aria-label="Próxima reunião">
          <span className="cel-bloco-titulo">Próxima reunião</span>
          <b className="cel-reuniao-prox">{proxima.titulo}</b>
          <span className="cel-data">{proxima.inicio} · {proxima.local}</span>
          {!descanso && <Tecla rotulo="Entrar" icone="camera" className="cel-tecla-texto" aoTocar={() => { useSim.getState().focar('meet'); useSim.getState().irPara('reuniao') }} />}
        </section>
        <section className="cel-bloco cel-bloco-notificacoes" aria-label="Notificações do computador">
          <span className="cel-bloco-titulo">Notificações</span>
          {NOTIFICACOES.map((n) => (
            <div key={n.id} className="cel-notificacao">
              <IconeApp app={n.app} tamanho={22} />
              <div><b>{n.titulo}</b><span>{n.texto}</span></div>
              <small>{n.ha}</small>
            </div>
          ))}
        </section>
      </div>
      {descanso && <span className="cel-descanso-dica">Toque para voltar</span>}
    </div>
  )
}
