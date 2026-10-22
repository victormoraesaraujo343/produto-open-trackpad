import type { ReactNode } from 'react'
import { Basculante } from '../../kit/Basculante'
import { Fader } from '../../kit/Fader'
import { Segmentos } from '../../kit/Segmentos'
import { useSim, type Opcoes } from '../../sim/loja'

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
  const { setAjuste, setOpcao } = useSim.getState()
  const chave = (k: keyof Opcoes, nome: string, detalhe?: string) => (
    <Linha nome={nome} detalhe={detalhe}><Basculante ligado={o[k]} rotulo={nome} aoMudar={(v) => setOpcao(k, v)} /></Linha>
  )
  return (
    <div className="cel-ajustes" data-lab="27">
      <section aria-label="Mão e posição">
        <h3>Mão e posição</h3>
        <Linha nome="Mão" detalhe="Inverte as laterais"><Segmentos rotulo="Mão" valor={a.mao} opcoes={[['direita', 'Direita'], ['esquerda', 'Esquerda']]} aoMudar={(v) => setAjuste('mao', v)} /></Linha>
        <Linha nome="Girar a tela" detalhe="Para usar com o cabo do outro lado"><Basculante ligado={a.girado} rotulo="Girar a tela" aoMudar={(v) => setAjuste('girado', v)} /></Linha>
      </section>
      <section aria-label="Trackpad">
        <h3>Trackpad</h3>
        <Linha nome="Velocidade"><Fader orientacao="horizontal" valor={a.velocidade} rotulo="Velocidade do cursor" aoMudar={(v) => setAjuste('velocidade', v)} ativo /></Linha>
        <Linha nome="Aceleração"><Fader orientacao="horizontal" valor={a.aceleracao} rotulo="Aceleração" aoMudar={(v) => setAjuste('aceleracao', v)} ativo /></Linha>
        <Linha nome="Rolagem natural"><Basculante ligado={a.rolagemNatural} rotulo="Rolagem natural" aoMudar={(v) => setAjuste('rolagemNatural', v)} /></Linha>
        {chave('zonas', 'Zonas no trackpad', 'Borda rola, canto faz clique direito')}
      </section>
      <section aria-label="Aparelho">
        <h3>Aparelho</h3>
        {chave('vibracao', 'Vibrar ao tocar')}
        {chave('paradoViraPainel', 'Parado vira painel', 'Senão, só escurece')}
        {chave('noturno', 'Modo noturno')}
        {chave('abrirSozinho', 'Abrir sozinho ao conectar')}
        <Linha nome="Limitar a carga em 80%" detalhe="Para o celular que vive no cabo"><Basculante ligado={a.limitarCarga} rotulo="Limitar a carga em 80%" aoMudar={(v) => setAjuste('limitarCarga', v)} /></Linha>
      </section>
      <section aria-label="Conexão">
        <h3>Conexão</h3>
        {chave('confianca', 'Conectar sozinho a computadores conhecidos')}
        {chave('variosPcs', 'Um celular, vários computadores')}
        {chave('variosCelulares', 'Vários celulares neste computador')}
      </section>
    </div>
  )
}
