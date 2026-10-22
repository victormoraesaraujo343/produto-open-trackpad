import { useState, type ReactNode } from 'react'
import { APPS, type AppId } from '../dados/apps'
import { PERFIS } from '../dados/atalhos'
import { CELULARES } from '../dados/computadores'
import { Basculante } from '../kit/Basculante'
import { Icone } from '../kit/Icone'
import { Led } from '../kit/Led'
import { Poco } from '../kit/Poco'
import { useVariante } from '../lab/refinamento'
import { PRESETS, liberado } from '../sim/conexao'
import { nivelAtual, useSim } from '../sim/loja'
import { Janela } from './Janela'

type Secao = 'aparelhos' | 'conexao' | 'atalhos' | 'telas' | 'funcoes' | 'sensacao'
const SECOES: { id: Secao; nome: string; icone: string }[] = [
  { id: 'aparelhos', nome: 'Aparelhos', icone: 'celular' },
  { id: 'conexao', nome: 'Conexão', icone: 'wifi' },
  { id: 'atalhos', nome: 'Atalhos', icone: 'atalhos' },
  { id: 'telas', nome: 'Telas', icone: 'tela' },
  { id: 'funcoes', nome: 'Funções', icone: 'ajustes' },
  { id: 'sensacao', nome: 'Sensação', icone: 'trackpad' },
]

/* Central do OpenTrackpad no computador (seção 8). */
export function Central() {
  const forma = useVariante('central')
  const [secao, setSecao] = useState<Secao>('aparelhos')
  const fechar = () => useSim.getState().irParaPc('area')

  if (forma === 'rack') {
    return (
      <Janela titulo="OpenTrackpad" aoFechar={fechar} largura={900} altura={540} lab="8">
        <div className="pc-rack">
          {SECOES.map((s) => (
            <Poco key={s.id} className="pc-modulo-rack" role="region" aria-label={s.nome}>
              <h2><Icone nome={s.icone} tamanho={16} />{s.nome}</h2>
              <Conteudo secao={s.id} compacto />
            </Poco>
          ))}
        </div>
      </Janela>
    )
  }

  const nav = (
    <div className={forma === 'abas' ? 'pc-abas' : 'pc-lateral'} role="tablist" aria-label="Seções" aria-orientation={forma === 'abas' ? 'horizontal' : 'vertical'}
      onKeyDown={(e) => {
        const i = SECOES.findIndex((s) => s.id === secao)
        const prox = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 0
        if (!prox) return
        e.preventDefault()
        const n = SECOES[(i + prox + SECOES.length) % SECOES.length]
        setSecao(n.id)
        ;(e.currentTarget.querySelector(`[data-secao="${n.id}"]`) as HTMLElement | null)?.focus()
      }}>
      {SECOES.map((s) => (
        <button key={s.id} type="button" role="tab" data-secao={s.id} aria-selected={s.id === secao} tabIndex={s.id === secao ? 0 : -1}
          className={s.id === secao ? 'pc-nav-ativo' : ''} onClick={() => setSecao(s.id)}>
          <Icone nome={s.icone} tamanho={18} /><span>{s.nome}</span>
        </button>
      ))}
    </div>
  )
  return (
    <Janela titulo="OpenTrackpad" aoFechar={fechar} lab="8">
      <div className={`pc-central pc-central-${forma}`}>
        {nav}
        <div className="pc-conteudo" role="tabpanel" aria-label={SECOES.find((s) => s.id === secao)?.nome}>
          <h2>{SECOES.find((s) => s.id === secao)?.nome}</h2>
          <Conteudo secao={secao} />
        </div>
      </div>
    </Janela>
  )
}

function Linha({ nome, children }: { nome: ReactNode; children: ReactNode }) {
  return <div className="pc-linha"><span className="pc-linha-nome">{nome}</span><span className="pc-linha-valor">{children}</span></div>
}

function Conteudo({ secao, compacto = false }: { secao: Secao; compacto?: boolean }) {
  const preset = useSim((s) => s.preset)
  const nivel = nivelAtual(preset)
  const p = PRESETS[preset]
  const [funcoes, setFuncoes] = useState({ confianca: true, variosPcs: false, variosCelulares: false, zonas: false, noturno: false })
  const [sensacao, setSensacao] = useState({ velocidade: 60, aceleracao: 40, natural: true })

  if (secao === 'aparelhos') {
    return (
      <div className="pc-lista">
        {CELULARES.map((c, i) => (
          <Linha key={c.id} nome={<><Icone nome="celular" tamanho={16} />{c.nome}</>}>
            {i === 0 && nivel > 0 ? <><Led aceso /> conectado por {p.rotulo}</> : <><Led aceso={false} /> fora de alcance</>}
          </Linha>
        ))}
        <button type="button" className="pc-botao" onClick={() => useSim.getState().irParaPc('pareamento')}>Parear outro celular</button>
      </div>
    )
  }
  if (secao === 'conexao') {
    const camadas = [
      { nome: 'Trackpad e atalhos', nivel: 1 as const },
      { nome: 'Som, informações e microfone', nivel: 2 as const },
      { nome: 'Tela, segundo monitor e câmera', nivel: 3 as const },
    ]
    return (
      <div className="pc-lista">
        <Linha nome="Ligado por">{nivel ? p.rotulo : 'desconectado'}</Linha>
        {!compacto && <Linha nome="Velocidade (simulação)">{p.mbps} Mb/s</Linha>}
        {!compacto && <Linha nome="Atraso (simulação)">{p.atrasoMs} ms</Linha>}
        {camadas.map((c) => (
          <Linha key={c.nome} nome={c.nome}>{liberado(c.nivel, nivel) ? <><Led aceso /> disponível</> : <><Led aceso={false} /> precisa de conexão melhor</>}</Linha>
        ))}
      </div>
    )
  }
  if (secao === 'atalhos') {
    return (
      <div className="pc-lista">
        {(Object.keys(PERFIS) as AppId[]).slice(0, compacto ? 4 : 10).map((a) => (
          <Linha key={a} nome={<><i className="pc-cor" style={{ background: APPS[a].cor }} aria-hidden="true" />{APPS[a].nome}</>}>
            {PERFIS[a].length} atalhos
          </Linha>
        ))}
        <button type="button" className="pc-botao" onClick={() => useSim.getState().avisar('Aperte o atalho no teclado')}>Gravar novo atalho</button>
      </div>
    )
  }
  if (secao === 'telas') {
    const ok = liberado(3, nivel)
    return (
      <div className="pc-lista">
        {['Espelhar a tela', 'Segundo monitor', 'Uma janela só', 'Monitor vertical'].map((t) => (
          <Linha key={t} nome={t}>{ok ? <><Led aceso /> disponível</> : <><Led aceso={false} /> precisa de cabo rápido ou Wi-Fi recente</>}</Linha>
        ))}
      </div>
    )
  }
  if (secao === 'funcoes') {
    const nomes: Record<keyof typeof funcoes, string> = { confianca: 'Conectar sozinho aparelhos de confiança', variosPcs: 'Um celular, vários computadores', variosCelulares: 'Vários celulares neste computador', zonas: 'Zonas no trackpad', noturno: 'Modo noturno' }
    return (
      <div className="pc-lista">
        {(Object.keys(funcoes) as (keyof typeof funcoes)[]).map((k) => (
          <Linha key={k} nome={nomes[k]}><Basculante ligado={funcoes[k]} rotulo={nomes[k]} aoMudar={(v) => setFuncoes({ ...funcoes, [k]: v })} /></Linha>
        ))}
      </div>
    )
  }
  return (
    <div className="pc-lista">
      {(['velocidade', 'aceleracao'] as const).map((k) => (
        <label key={k} className="pc-linha">
          <span className="pc-linha-nome">{k === 'velocidade' ? 'Velocidade do cursor' : 'Aceleração'}</span>
          <input id={`pc-${k}`} type="range" min={0} max={100} value={sensacao[k]} onChange={(e) => setSensacao({ ...sensacao, [k]: Number(e.target.value) })} />
        </label>
      ))}
      <Linha nome="Rolagem natural"><Basculante ligado={sensacao.natural} rotulo="Rolagem natural" aoMudar={(v) => setSensacao({ ...sensacao, natural: v })} /></Linha>
    </div>
  )
}
