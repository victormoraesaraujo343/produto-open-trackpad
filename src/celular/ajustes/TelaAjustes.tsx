import type { ReactNode } from 'react'
import { Basculante } from '../../kit/Basculante'
import { Fader } from '../../kit/Fader'
import { Segmentos } from '../../kit/Segmentos'
import { Tecla } from '../../kit/Tecla'
import { useSim, type JeitoDescanso, type Opcoes } from '../../sim/loja'
import { ConfigBlocos } from '../tela/TelaPainel'
import { DESENHO, Escolha } from './Escolha'
import './ajustes.css'

function Bloco({ nome, extra, children }: { nome: string; extra?: ReactNode; children: ReactNode }) {
  return <div className="aj-bloco"><div className="aj-titulo"><span>{nome}</span>{extra}</div>{children}</div>
}

const JEITOS: [JeitoDescanso, string][] = [['relogio', 'Relógio'], ['analogico', 'Ponteiros'], ['digitos', 'LED'], ['aluminio', 'Alumínio'], ['painel', 'Infos'], ['medidores', 'Medidores'], ['foto', 'Foto'], ['escuro', 'Nada']]

function Linha({ nome, detalhe, children }: { nome: string; detalhe?: string; children: ReactNode }) {
  return (
    <div className="cel-ajuste">
      <div className="cel-ajuste-texto"><span>{nome}</span>{detalhe && <small>{detalhe}</small>}</div>
      {children}
    </div>
  )
}

/* Ajustes do celular (seção 27). As funções opcionais ligam e desligam aqui e na central
   do computador; é o mesmo ajuste nos dois lugares. */
export function TelaAjustes() {
  const a = useSim((s) => s.ajustes)
  const o = useSim((s) => s.opcoes)
  const jeito = useSim((s) => s.descanso.jeito)
  const { setAjuste, setOpcao } = useSim.getState()
  const chave = (k: keyof Opcoes, nome: string, detalhe?: string) => (
    <Linha nome={nome} detalhe={detalhe}><Basculante ligado={o[k]} rotulo={nome} aoMudar={(v) => setOpcao(k, v)} /></Linha>
  )
  return (
    <div className="cel-ajustes" data-lab="27">
      <section aria-label="Laterais e botões">
        <h3>Laterais e botões</h3>
        <Linha nome="Mão"><Segmentos rotulo="Mão" valor={a.mao} opcoes={[['direita', 'Direita'], ['esquerda', 'Esquerda']]} aoMudar={(v) => setAjuste('mao', v)} /></Linha>
        <Bloco nome="Laterais">
          <Escolha rotulo="Laterais" valor={a.disposicao} aoMudar={(v) => setAjuste('disposicao', v)} opcoes={[
            { valor: 'dois-lados', nome: 'Dos dois lados', linha: 'App de um lado, sistema do outro', desenho: DESENHO.doisLados },
            { valor: 'um-lado', nome: 'Tudo de um lado', linha: 'Tudo perto do polegar', desenho: DESENHO.umLado(a.mao === 'esquerda') },
          ]} />
        </Bloco>
        <Bloco nome="Teclas presas (Ctrl, Shift…)">
          <Escolha rotulo="Teclas presas" valor={a.presas} aoMudar={(v) => setAjuste('presas', v)} opcoes={[
            { valor: 'trava', nome: 'Toque', linha: 'Um toque prende, outro solta', desenho: DESENHO.presas([['toque', true], ['', true], ['toque', false]]) },
            { valor: 'segurar', nome: 'Segurar', linha: 'Presa só com o dedo em cima', desenho: DESENHO.presas([['segura', true], ['', false], ['segura', true]]) },
            { valor: 'misto', nome: 'Misto', linha: 'Segurar prende; dois toques travam', desenho: DESENHO.presas([['segura', true], ['dois', true], ['', true]]) },
          ]} />
        </Bloco>
        <Bloco nome="Botões de volume do celular">
          <Escolha rotulo="Botões de volume do celular" valor={a.botoesVolume} aoMudar={(v) => setAjuste('botoesVolume', v)} opcoes={[
            { valor: 'atalhos', nome: 'Atalhos', linha: 'Os 2 primeiros atalhos do app', desenho: DESENHO.volume('atalhos') },
            { valor: 'legenda', nome: 'Com nome', linha: 'Atalhos, com o nome na borda', desenho: DESENHO.volume('legenda') },
            { valor: 'sistema', nome: 'Volume', linha: 'Volume do celular, como sempre', desenho: DESENHO.volume('sistema') },
          ]} />
        </Bloco>
        <Linha nome="Girar 180°"><Basculante ligado={a.girado} rotulo="Girar a tela" aoMudar={(v) => setAjuste('girado', v)} /></Linha>
      </section>
      <section aria-label="Trackpad">
        <h3>Trackpad</h3>
        <Linha nome="Velocidade"><Fader orientacao="horizontal" valor={a.velocidade} rotulo="Velocidade do cursor" aoMudar={(v) => setAjuste('velocidade', v)} ativo /></Linha>
        <Linha nome="Aceleração"><Fader orientacao="horizontal" valor={a.aceleracao} rotulo="Aceleração" aoMudar={(v) => setAjuste('aceleracao', v)} ativo /></Linha>
        <Linha nome="Rolagem natural"><Basculante ligado={a.rolagemNatural} rotulo="Rolagem natural" aoMudar={(v) => setAjuste('rolagemNatural', v)} /></Linha>
        {chave('cantoClica', 'Clique direito no canto')}
        {chave('bordaRola', 'Rolar pela borda')}
        {chave('rastro', 'Rastro no trackpad')}
      </section>
      <section aria-label="Aparelho">
        <h3>Aparelho</h3>
        {chave('vibracao', 'Vibrar ao tocar')}
        {chave('paradoViraPainel', 'Tela de descanso')}
        {o.paradoViraPainel && (
          <Bloco nome="A tela de descanso mostra" extra={<Tecla rotulo="Ver agora" icone="tela" className="cel-tecla-texto" aoTocar={() => useSim.getState().ficarOcioso()} />}>
            <Escolha rotulo="O que a tela de descanso mostra" colunas={4} valor={jeito} aoMudar={(v) => useSim.getState().setJeitoDescanso(v)}
              opcoes={JEITOS.map(([valor, nome]) => ({ valor, nome, desenho: DESENHO.descanso(valor) }))} />
            {jeito === 'painel' && <ConfigBlocos onde="descanso" />}
          </Bloco>
        )}
        {chave('noturno', 'Modo noturno')}
        {chave('abrirSozinho', 'Abrir sozinho ao conectar')}
        <Linha nome="Carregar só até 80%"><Basculante ligado={a.limitarCarga} rotulo="Limitar a carga em 80%" aoMudar={(v) => setAjuste('limitarCarga', v)} /></Linha>
      </section>
      <section aria-label="Conexão">
        <h3>Conexão</h3>
        {chave('confianca', 'Conectar sozinho aos conhecidos')}
        {chave('variosPcs', 'Um celular, vários computadores')}
        {chave('variosCelulares', 'Vários celulares neste computador')}
      </section>
    </div>
  )
}
