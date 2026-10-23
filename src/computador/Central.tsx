import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { APPS, type AppId } from '../dados/apps'
import { ATALHOS, teclasDoSistema } from '../dados/atalhos'
import { CELULARES } from '../dados/computadores'
import { Basculante } from '../kit/Basculante'
import { Fader } from '../kit/Fader'
import { Icone } from '../kit/Icone'
import { IconeApp } from '../kit/IconeApp'
import { Lateral } from '../kit/Lateral'
import { Led } from '../kit/Led'
import './atalhos.css'
import { PRESETS, liberado } from '../sim/conexao'
import { nivelAtual, useSim, type Lado, type Opcoes } from '../sim/loja'
import { nomeDoItem, opcoesDeItem } from '../celular/laterais/itens'
import { Janela } from './Janela'
import { ConfigBlocos } from '../celular/tela/TelaPainel'

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
  const secao = useSim((s) => s.secaoCentral) as Secao
  const setSecao = useSim((s) => s.setSecaoCentral)
  const fechar = () => useSim.getState().irParaPc('area')

  const nav = (
    <div className="pc-lateral" role="tablist" aria-label="Seções" aria-orientation="vertical"
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
      <div className="pc-central">
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

function Conteudo({ secao }: { secao: Secao }) {
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
        <div className="pc-acoes-linha">
          <button type="button" className="pc-botao" onClick={() => useSim.getState().irParaPc('pareamento')}>Parear outro celular</button>
          <button type="button" className="pc-botao" onClick={() => useSim.getState().irParaPc('assistente')}>Assistente de primeira vez</button>
        </div>
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
        <Linha nome="Velocidade (simulação)">{p.mbps} Mb/s</Linha>
        <Linha nome="Atraso (simulação)">{p.atrasoMs} ms</Linha>
        {camadas.map((c) => (
          <Linha key={c.nome} nome={c.nome}>{liberado(c.nivel, nivel) ? <><Led aceso /> disponível</> : <><Led aceso={false} /> precisa de conexão melhor</>}</Linha>
        ))}
      </div>
    )
  }
  if (secao === 'atalhos') return <EditorAtalhos />
  if (secao === 'laterais') return <EditorLaterais />
  if (secao === 'telas') {
    const ok = liberado(3, nivel)
    return (
      <div className="pc-lista">
        <h3 className="pc-subtitulo">Painel de informações</h3>
        <div className="pc-config"><ConfigBlocos onde="painel" /></div>
        <h3 className="pc-subtitulo">Telas do computador no celular</h3>
        {['Espelhar a tela', 'Segundo monitor', 'Uma janela só', 'Recorte', 'Monitor vertical'].map((t) => (
          <Linha key={t} nome={t}>{ok ? <><Led aceso /> disponível</> : <><Led aceso={false} /> precisa de cabo rápido ou Wi-Fi recente</>}</Linha>
        ))}
      </div>
    )
  }
  if (secao === 'funcoes') {
    const nomes: [keyof Opcoes, string][] = [['confianca', 'Conectar sozinho a celulares conhecidos'], ['variosPcs', 'Um celular, vários computadores'], ['variosCelulares', 'Vários celulares neste computador'], ['cantoClica', 'Clique direito no canto do trackpad'], ['bordaRola', 'Rolar pela borda do trackpad'], ['paradoViraPainel', 'Parado, o celular vira painel'], ['noturno', 'Modo noturno no celular'], ['abrirSozinho', 'Abrir sozinho ao conectar'], ['vibracao', 'Vibrar no celular']]
    return (
      <div className="pc-lista">
        {nomes.map(([k, nome]) => (
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

/* Editor de atalhos por app (seção 30). Apps à esquerda. À direita, a lateral do celular: as 5
   primeiras teclas, na ordem (a ordem é a da lateral); o resto em "Mais atalhos". Embaixo,
   o que dá para adicionar e gravar. Os botões de ordem aparecem ao lado da tecla escolhida. */
function EditorAtalhos() {
  const perfis = useSim((s) => s.perfis)
  const proprios = useSim((s) => s.atalhosProprios)
  const sistema = useSim((s) => s.sistema)
  const [app, setApp] = useState<AppId>(useSim.getState().appEmFoco)
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [importar, setImportar] = useState(false)
  const [marcados, setMarcados] = useState<number[]>([])
  const raiz = useRef<HTMLDivElement>(null)
  /* Foco depois de uma ação: a tecla some ou muda de lugar. Vale o primeiro alvo que existir e estiver ativo. */
  const foco = useRef<string[]>([])
  const { moverAtalho, removerAtalho, adicionarAtalho, criarAtalho } = useSim.getState()

  useLayoutEffect(() => {
    const pedido = foco.current
    if (!pedido.length) return
    foco.current = []
    for (const alvo of pedido) {
      const el = raiz.current?.querySelector<HTMLElement>(`[data-foco="${alvo}"]:not(:disabled)`)
      if (el) { el.focus(); return }
    }
  })

  const biblioteca = { ...ATALHOS, ...proprios }
  const apps = Object.keys(perfis) as AppId[]
  const ids = perfis[app]
  const sel = escolhido && ids.includes(escolhido) ? escolhido : (ids[0] ?? null)
  const pos = sel ? ids.indexOf(sel) : -1
  const escolha = sel ? biblioteca[sel] : undefined
  const fora = Object.keys(biblioteca).filter((id) => !ids.includes(id))
  const resto = ids.slice(5)
  const contar = (a: AppId) => perfis[a].filter((id) => biblioteca[id]).length

  const escolherApp = (a: AppId) => { setApp(a); setEscolhido(null); setImportar(false); setMarcados([]) }
  const mover = (d: -1 | 1) => {
    foco.current = d < 0 ? ['subir', 'descer'] : ['descer', 'subir']
    moverAtalho(app, pos, d)
  }
  const tirar = () => {
    if (!sel) return
    const prox = ids[pos + 1] ?? ids[pos - 1] ?? null
    foco.current = prox ? [`tecla:${prox}`] : ['gravar']
    setEscolhido(prox)
    removerAtalho(app, sel)
  }
  const adicionar = (id: string) => { foco.current = ['chip', 'gravar']; adicionarAtalho(app, id) }
  const importarMarcados = () => {
    for (const n of marcados) {
      const a = DO_SISTEMA[sistema][n]
      const ja = Object.values(useSim.getState().atalhosProprios).find((x) => x.rotulo === a.rotulo && x.teclas.join() === a.teclas.join())
      adicionarAtalho(app, ja ? ja.id : criarAtalho(a.rotulo, a.teclas))
    }
    useSim.getState().avisar(`${marcados.length} atalho${marcados.length > 1 ? 's' : ''} importado${marcados.length > 1 ? 's' : ''}`)
    foco.current = ['importar']
    setImportar(false)
    setMarcados([])
  }

  /* Setas para cima e para baixo trocam de app (Início e Fim vão ao primeiro e ao último). */
  const teclarApps = (e: { key: string; currentTarget: HTMLDivElement; preventDefault: () => void }) => {
    const mapa: Record<string, number> = { ArrowDown: (apps.indexOf(app) + 1) % apps.length, ArrowUp: (apps.indexOf(app) - 1 + apps.length) % apps.length, Home: 0, End: apps.length - 1 }
    if (!(e.key in mapa)) return
    e.preventDefault()
    const a = apps[mapa[e.key]]
    escolherApp(a)
    e.currentTarget.querySelector<HTMLElement>(`[data-app="${a}"]`)?.focus()
  }

  const slots = Array.from({ length: 5 }, (_, p) => {
    const id = ids[p]
    const a = id ? biblioteca[id] : undefined
    if (!id || !a) return <div key={`vazia${p}`} className="pc-at-slot"><span className="pc-pos" aria-hidden="true">{p + 1}</span><span className="pc-at-vazia">vazia</span></div>
    const teclas = teclasDoSistema(a.teclas, sistema)
    return (
      <div key={id} className="pc-at-slot">
        <span className="pc-pos" aria-hidden="true">{p + 1}</span>
        <button type="button" className={`k-tecla pc-at-tecla${sel === id ? ' pc-at-sel' : ''}`} data-foco={`tecla:${id}`}
          aria-current={sel === id ? 'true' : undefined} aria-label={`${p + 1}, ${a.rotulo}, ${teclas.join(' + ')}`}
          onClick={() => setEscolhido(id)}>
          <Icone nome={a.icone} tamanho={15} />
          <span className="k-rotulo">{a.rotulo}</span>
          <Combinacao teclas={teclas} />
        </button>
      </div>
    )
  })

  return (
    <div className="pc-at" ref={raiz}>
      <div className="pc-at-corpo">
        <div className="pc-at-apps" role="listbox" aria-label="Apps" aria-orientation="vertical" onKeyDown={teclarApps}>
          {apps.map((a) => {
            const n = contar(a)
            return (
              <button key={a} type="button" role="option" data-app={a} aria-selected={a === app} tabIndex={a === app ? 0 : -1}
                aria-label={`${APPS[a].nome}, ${n} ${n === 1 ? 'atalho' : 'atalhos'}`}
                className={`pc-at-app${a === app ? ' pc-at-app-sel' : ''}`} onClick={() => escolherApp(a)}>
                <IconeApp app={a} tamanho={26} />
                <span className="pc-at-app-nome">{APPS[a].nome}</span>
                <small aria-hidden="true">{n}</small>
              </button>
            )
          })}
        </div>
        <div className="pc-at-direita">
          <h3>Na lateral do celular</h3>
          <div className="pc-at-topo">
            <div className="pc-at-lateral">
              <Lateral lado="esquerda" rotulo="Lateral do celular">{slots}</Lateral>
            </div>
            {escolha && (
              <div className="pc-at-controles" role="group" aria-label={`Ordem de ${escolha.rotulo}`}>
                <span className="pc-at-nome">{escolha.rotulo}</span>
                <button type="button" data-foco="subir" aria-label={`Subir ${escolha.rotulo}`} disabled={pos <= 0} onClick={() => mover(-1)}><span aria-hidden="true">↑</span>Subir</button>
                <button type="button" data-foco="descer" aria-label={`Descer ${escolha.rotulo}`} disabled={pos >= ids.length - 1} onClick={() => mover(1)}><span aria-hidden="true">↓</span>Descer</button>
                <button type="button" data-foco="tirar" aria-label={`Tirar ${escolha.rotulo}`} onClick={tirar}><span aria-hidden="true">✕</span>Tirar</button>
              </div>
            )}
          </div>
          {resto.length > 0 && (
            <section aria-label="Mais atalhos">
              <h3>Mais atalhos</h3>
              <div className="pc-at-grade">
                {resto.map((id) => {
                  const a = biblioteca[id]
                  const teclas = teclasDoSistema(a.teclas, sistema)
                  return (
                    <button key={id} type="button" className={`pc-at-tile${sel === id ? ' pc-at-sel' : ''}`} data-foco={`tecla:${id}`}
                      aria-current={sel === id ? 'true' : undefined} onClick={() => setEscolhido(id)}>
                      <Icone nome={a.icone} tamanho={16} />
                      <span className="pc-at-tile-texto"><b>{a.rotulo}</b><Combinacao teclas={teclas} /></span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
      <section className="pc-at-add" aria-labelledby="pc-at-add-titulo">
        <div className="pc-at-add-topo">
          <h3 id="pc-at-add-titulo">Adicionar</h3>
          <div className="pc-at-add-acoes">
            <button type="button" className="pc-botao" data-foco="importar" aria-expanded={importar}
              onClick={() => { setImportar(!importar); setMarcados([]) }}>Importar do sistema</button>
            <button type="button" className="pc-botao pc-botao-principal" data-foco="gravar"
              onClick={() => { useSim.getState().focar(app); useSim.getState().irParaPc('gravador') }}>Gravar atalho</button>
          </div>
        </div>
        {fora.length > 0 ? (
          <ul className="pc-at-chips" aria-label="Atalhos para adicionar">
            {fora.map((id) => (
              <li key={id}>
                <button type="button" className="pc-at-chip" data-foco="chip" onClick={() => adicionar(id)}>
                  <Icone nome="mais" tamanho={14} />{biblioteca[id].rotulo}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pc-dica">Todos os atalhos já estão neste app.</p>
        )}
        {importar && (
          <div className="pc-at-importar">
            {DO_SISTEMA[sistema].map((a, n) => (
              <label key={a.rotulo} className="pc-at-marcar">
                <input id={`importar-${n}`} type="checkbox" checked={marcados.includes(n)} onChange={(e) => setMarcados(e.target.checked ? [...marcados, n] : marcados.filter((x) => x !== n))} />
                <span>{a.rotulo}</span><Combinacao teclas={a.teclas} />
              </label>
            ))}
            <button type="button" className="pc-botao" disabled={!marcados.length} onClick={importarMarcados}>Importar {marcados.length || ''}</button>
          </div>
        )}
      </section>
    </div>
  )
}

/* Combinação de teclas em pequenas caixas (kbd), como ficam na lateral. */
function Combinacao({ teclas }: { teclas: string[] }) {
  return <span className="pc-combo">{teclas.map((t, i) => <kbd key={i}>{t}</kbd>)}</span>
}

/* Laterais por app (issue #5): as 5 posições da esquerda e as 3 livres da direita.
   Modos (posição 1 da direita) e a última (muda com o modo) ficam fixas. */
function EditorLaterais() {
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
