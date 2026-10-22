import { useState, type ReactNode } from 'react'
import { APPS, type AppId } from '../dados/apps'
import { ATALHOS, teclasDoSistema } from '../dados/atalhos'
import { CELULARES } from '../dados/computadores'
import { Basculante } from '../kit/Basculante'
import { Fader } from '../kit/Fader'
import { Icone } from '../kit/Icone'
import { IconeApp } from '../kit/IconeApp'
import { Led } from '../kit/Led'
import { Poco } from '../kit/Poco'
import { useVariante } from '../lab/refinamento'
import { PRESETS, liberado } from '../sim/conexao'
import { nivelAtual, useSim, type Lado, type Opcoes } from '../sim/loja'
import { nomeDoItem, opcoesDeItem } from '../celular/laterais/itens'
import { Janela } from './Janela'

type Secao = 'aparelhos' | 'conexao' | 'atalhos' | 'laterais' | 'telas' | 'funcoes' | 'sensacao'
const SECOES: { id: Secao; nome: string; icone: string }[] = [
  { id: 'aparelhos', nome: 'Aparelhos', icone: 'celular' },
  { id: 'conexao', nome: 'Conexão', icone: 'wifi' },
  { id: 'atalhos', nome: 'Atalhos', icone: 'atalhos' },
  { id: 'laterais', nome: 'Laterais', icone: 'laterais' },
  { id: 'telas', nome: 'Telas', icone: 'tela' },
  { id: 'funcoes', nome: 'Funções', icone: 'ajustes' },
  { id: 'sensacao', nome: 'Sensação', icone: 'trackpad' },
]

/* Atalhos que o sistema já tem configurados, por sistema (o que "Importar do sistema" acha). */
const DO_SISTEMA: Record<'linux' | 'windows' | 'macos', { rotulo: string; teclas: string[] }[]> = {
  linux: [{ rotulo: 'Captura de região', teclas: ['Super', 'Shift', 'S'] }, { rotulo: 'Abrir o terminal', teclas: ['Ctrl', 'Alt', 'T'] }, { rotulo: 'Visão geral', teclas: ['Super', 'W'] }, { rotulo: 'Bloquear a sessão', teclas: ['Super', 'L'] }],
  windows: [{ rotulo: 'Ferramenta de Captura', teclas: ['Win', 'Shift', 'S'] }, { rotulo: 'Mostrar a área de trabalho', teclas: ['Win', 'D'] }, { rotulo: 'Explorador de Arquivos', teclas: ['Win', 'E'] }, { rotulo: 'Bloquear', teclas: ['Win', 'L'] }],
  macos: [{ rotulo: 'Captura de uma área', teclas: ['⌘', 'Shift', '4'] }, { rotulo: 'Mission Control', teclas: ['⌃', '↑'] }, { rotulo: 'Spotlight', teclas: ['⌘', 'Espaço'] }, { rotulo: 'Bloquear a tela', teclas: ['⌃', '⌘', 'Q'] }],
}

/* Central do OpenTrackpad no computador (seção 8; atalhos na seção 30). */
export function Central() {
  const forma = useVariante('central')
  const secao = useSim((s) => s.secaoCentral) as Secao
  const setSecao = useSim((s) => s.setSecaoCentral)
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
    <Janela titulo="OpenTrackpad" aoFechar={fechar} largura={780} altura={500} lab="8">
      <div className={`pc-central pc-central-${forma}`}>
        {nav}
        <div className="pc-conteudo" role="tabpanel" aria-label={SECOES.find((s) => s.id === secao)?.nome} data-lab={secao === 'atalhos' ? '30' : undefined}>
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
  const opcoes = useSim((s) => s.opcoes)
  const ajustes = useSim((s) => s.ajustes)
  const { setOpcao, setAjuste } = useSim.getState()
  const nivel = nivelAtual(preset)
  const p = PRESETS[preset]

  if (secao === 'aparelhos') {
    return (
      <div className="pc-lista">
        {CELULARES.slice(0, opcoes.variosCelulares ? 2 : 1).map((c, i) => (
          <Linha key={c.id} nome={<><Icone nome="celular" tamanho={16} />{c.nome}{opcoes.variosCelulares && <small className="pc-papel">{i === 0 ? 'trackpad' : 'atalhos'}</small>}</>}>
            {nivel > 0 ? <><Led aceso /> conectado por {i === 0 ? p.rotulo : 'Wi-Fi 6'}</> : <><Led aceso={false} /> fora de alcance</>}
          </Linha>
        ))}
        {!opcoes.variosCelulares && <Linha nome={<><Icone nome="celular" tamanho={16} />{CELULARES[1].nome}</>}><Led aceso={false} /> conhecido, desligado</Linha>}
        {!compacto && (
          <div className="pc-acoes-linha">
            <button type="button" className="pc-botao" onClick={() => useSim.getState().irParaPc('pareamento')}>Parear outro celular</button>
            <button type="button" className="pc-botao" onClick={() => useSim.getState().irParaPc('assistente')}>Assistente de primeira vez</button>
          </div>
        )}
      </div>
    )
  }
  if (secao === 'conexao') {
    const camadas = [
      { nome: 'Trackpad, teclado e atalhos', nivel: 1 as const },
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
  if (secao === 'atalhos') return compacto ? <ListaPerfis /> : <EditorAtalhos />
  if (secao === 'laterais') return <EditorLaterais compacto={compacto} />
  if (secao === 'telas') {
    const ok = liberado(3, nivel)
    return (
      <div className="pc-lista">
        {['Espelhar a tela', 'Segundo monitor', 'Uma janela só', 'Recorte', 'Monitor vertical'].map((t) => (
          <Linha key={t} nome={t}>{ok ? <><Led aceso /> disponível</> : <><Led aceso={false} /> precisa de cabo rápido ou Wi-Fi recente</>}</Linha>
        ))}
      </div>
    )
  }
  if (secao === 'funcoes') {
    const nomes: [keyof Opcoes, string][] = [['confianca', 'Conectar sozinho a celulares conhecidos'], ['variosPcs', 'Um celular, vários computadores'], ['variosCelulares', 'Vários celulares neste computador'], ['zonas', 'Zonas no trackpad'], ['paradoViraPainel', 'Parado, o celular vira painel'], ['noturno', 'Modo noturno no celular'], ['abrirSozinho', 'Abrir sozinho ao conectar'], ['vibracao', 'Vibrar no celular']]
    return (
      <div className="pc-lista">
        {nomes.slice(0, compacto ? 4 : nomes.length).map(([k, nome]) => (
          <Linha key={k} nome={nome}><Basculante ligado={opcoes[k]} rotulo={nome} aoMudar={(v) => setOpcao(k, v)} /></Linha>
        ))}
      </div>
    )
  }
  return (
    <div className="pc-lista">
      <Linha nome="Velocidade do cursor"><span className="pc-fader"><Fader orientacao="horizontal" valor={ajustes.velocidade} rotulo="Velocidade do cursor" aoMudar={(v) => setAjuste('velocidade', v)} ativo /></span></Linha>
      <Linha nome="Aceleração"><span className="pc-fader"><Fader orientacao="horizontal" valor={ajustes.aceleracao} rotulo="Aceleração" aoMudar={(v) => setAjuste('aceleracao', v)} ativo /></span></Linha>
      <Linha nome="Rolagem natural"><Basculante ligado={ajustes.rolagemNatural} rotulo="Rolagem natural" aoMudar={(v) => setAjuste('rolagemNatural', v)} /></Linha>
    </div>
  )
}

function ListaPerfis() {
  const perfis = useSim((s) => s.perfis)
  return (
    <div className="pc-lista">
      {(Object.keys(perfis) as AppId[]).slice(0, 4).map((a) => (
        <Linha key={a} nome={<><IconeApp app={a} tamanho={18} />{APPS[a].nome}</>}>{perfis[a].length} atalhos</Linha>
      ))}
    </div>
  )
}

/* Editor de atalhos por app: a ordem é a ordem das teclas na lateral do celular (as 5
   primeiras aparecem nela). */
function EditorAtalhos() {
  const perfis = useSim((s) => s.perfis)
  const proprios = useSim((s) => s.atalhosProprios)
  const sistema = useSim((s) => s.sistema)
  const [app, setApp] = useState<AppId>(useSim.getState().appEmFoco)
  const [painel, setPainel] = useState<'nada' | 'biblioteca' | 'importar'>('nada')
  const [marcados, setMarcados] = useState<number[]>([])
  const { moverAtalho, removerAtalho, adicionarAtalho, criarAtalho } = useSim.getState()
  const biblioteca = { ...ATALHOS, ...proprios }
  const ids = perfis[app]
  const fora = Object.keys(biblioteca).filter((id) => !ids.includes(id))
  return (
    <div className="pc-editor">
      <div className="pc-apps" role="listbox" aria-label="Apps">
        {(Object.keys(perfis) as AppId[]).map((a) => (
          <button key={a} type="button" role="option" aria-selected={a === app} className={a === app ? 'pc-nav-ativo' : ''} onClick={() => { setApp(a); setPainel('nada') }}>
            <IconeApp app={a} tamanho={20} /><span>{APPS[a].nome}</span>
          </button>
        ))}
      </div>
      <div className="pc-perfil">
        <ol className="pc-ordem" aria-label={`Atalhos de ${APPS[app].nome}, na ordem da lateral`}>
          {ids.map((id, i) => {
            const a = biblioteca[id]
            if (!a) return null
            return (
              <li key={id} className={i < 5 ? 'pc-na-lateral' : ''}>
                <span className="pc-pos">{i + 1}</span>
                <Icone nome={a.icone} tamanho={16} />
                <span className="pc-ordem-nome">{a.rotulo}</span>
                <span className="pc-teclas">{teclasDoSistema(a.teclas, sistema).map((t) => <kbd key={t}>{t}</kbd>)}</span>
                <span className="pc-ordem-acoes">
                  <button type="button" aria-label={`Subir ${a.rotulo}`} disabled={i === 0} onClick={() => moverAtalho(app, i, -1)}>↑</button>
                  <button type="button" aria-label={`Descer ${a.rotulo}`} disabled={i === ids.length - 1} onClick={() => moverAtalho(app, i, 1)}>↓</button>
                  <button type="button" aria-label={`Tirar ${a.rotulo}`} onClick={() => removerAtalho(app, id)}>✕</button>
                </span>
              </li>
            )
          })}
        </ol>
        <p className="pc-dica">Esta é a ordem do modo Atalhos no celular. As laterais se ajustam em Laterais.</p>
        <div className="pc-acoes-linha">
          <button type="button" className="pc-botao" aria-expanded={painel === 'biblioteca'} onClick={() => setPainel(painel === 'biblioteca' ? 'nada' : 'biblioteca')}>Adicionar da biblioteca</button>
          <button type="button" className="pc-botao" aria-expanded={painel === 'importar'} onClick={() => { setPainel(painel === 'importar' ? 'nada' : 'importar'); setMarcados([]) }}>Importar do sistema</button>
          <button type="button" className="pc-botao pc-botao-principal" onClick={() => { useSim.getState().focar(app); useSim.getState().irParaPc('gravador') }}>Gravar novo atalho</button>
        </div>
        {painel === 'biblioteca' && (
          <div className="pc-biblioteca" role="list" aria-label="Biblioteca">
            {fora.map((id) => (
              <button key={id} type="button" role="listitem" onClick={() => adicionarAtalho(app, id)}><Icone nome={biblioteca[id].icone} tamanho={14} />{biblioteca[id].rotulo}</button>
            ))}
          </div>
        )}
        {painel === 'importar' && (
          <div className="pc-importar">
            {DO_SISTEMA[sistema].map((a, i) => (
              <label key={a.rotulo} className="pc-marcar">
                <input id={`importar-${i}`} type="checkbox" checked={marcados.includes(i)} onChange={(e) => setMarcados(e.target.checked ? [...marcados, i] : marcados.filter((x) => x !== i))} />
                <span>{a.rotulo}</span><span className="pc-teclas">{a.teclas.map((t) => <kbd key={t}>{t}</kbd>)}</span>
              </label>
            ))}
            <button type="button" className="pc-botao" disabled={!marcados.length} onClick={() => {
              for (const i of marcados) {
                const a = DO_SISTEMA[sistema][i]
                const ja = Object.values(useSim.getState().atalhosProprios).find((x) => x.rotulo === a.rotulo && x.teclas.join() === a.teclas.join())
                adicionarAtalho(app, ja ? ja.id : criarAtalho(a.rotulo, a.teclas))
              }
              useSim.getState().avisar(`${marcados.length} atalho${marcados.length > 1 ? 's' : ''} importado${marcados.length > 1 ? 's' : ''}`)
              setPainel('nada')
            }}>Importar {marcados.length || ''}</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* Laterais por app (issue #5): as 5 posições da esquerda e as 3 livres da direita.
   Modos (posição 1 da direita) e a última (muda com o modo) ficam fixas. */
function EditorLaterais({ compacto = false }: { compacto?: boolean }) {
  const laterais = useSim((s) => s.laterais)
  const perfis = useSim((s) => s.perfis)
  const proprios = useSim((s) => s.atalhosProprios)
  const [app, setApp] = useState<AppId>(useSim.getState().appEmFoco)
  const opcoes = opcoesDeItem(perfis[app], proprios)
  const seletor = (lado: Lado, i: number) => (
    <select id={`lateral-${app}-${lado}-${i}`} aria-label={`Lateral ${lado}, posição ${lado === 'direita' ? i + 2 : i + 1}`} value={laterais[app][lado][i]}
      onChange={(e) => useSim.getState().trocarNaLateral(app, lado, i, e.target.value)}>
      {opcoes.map((o) => <option key={o} value={o}>{nomeDoItem(o, proprios)}</option>)}
    </select>
  )
  if (compacto) return <ListaPerfis />
  return (
    <div className="pc-editor" data-lab="33">
      <div className="pc-apps" role="listbox" aria-label="Apps">
        {(Object.keys(laterais) as AppId[]).map((a) => (
          <button key={a} type="button" role="option" aria-selected={a === app} className={a === app ? 'pc-nav-ativo' : ''} onClick={() => setApp(a)}>
            <IconeApp app={a} tamanho={20} /><span>{APPS[a].nome}</span>
          </button>
        ))}
      </div>
      <div className="pc-laterais">
        <section aria-label="Lateral esquerda">
          <h3>Esquerda</h3>
          {[0, 1, 2, 3, 4].map((i) => <label key={i} className="pc-posicao"><span className="pc-pos">{i + 1}</span>{seletor('esquerda', i)}</label>)}
        </section>
        <section aria-label="Lateral direita">
          <h3>Direita</h3>
          <div className="pc-posicao pc-fixa"><span className="pc-pos">1</span><span>Modos</span><Icone nome="cadeado" tamanho={14} /></div>
          {[0, 1, 2].map((i) => <label key={i} className="pc-posicao"><span className="pc-pos">{i + 2}</span>{seletor('direita', i)}</label>)}
          <div className="pc-posicao pc-fixa"><span className="pc-pos">5</span><span>Muda com o modo</span><Icone nome="cadeado" tamanho={14} /></div>
        </section>
      </div>
    </div>
  )
}
