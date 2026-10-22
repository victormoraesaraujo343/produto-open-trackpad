import { useEffect, useRef, useState } from 'react'
import { Camada } from '../../kit/Camada'
import { Icone } from '../../kit/Icone'
import { Led } from '../../kit/Led'
import { Modulo } from '../../kit/Modulo'
import { useVariante } from '../../lab/refinamento'
import { liberado } from '../../sim/conexao'
import { nivelAtual, useSim } from '../../sim/loja'
import { TELAS_CELULAR, type TelaCelular } from '../../sim/telas'
import { vibrar } from '../../sim/vibrar'
import { SEGURAR_MS, Traco } from '../aparelho/Trava'
import { GRUPOS, MODOS } from './modos'

export const ABRIR_MODOS = 'otp:abrir-modos'
const SEGURAR_LISTA_MS = 260

function useModos() {
  const tela = useSim((s) => s.tela)
  const nivel = nivelAtual(useSim((s) => s.preset))
  const variosPcs = useSim((s) => s.opcoes.variosPcs)
  return MODOS.filter((m) => m.tela !== 'computadores' || variosPcs).map((m) => ({ ...m, ativo: m.tela === tela, livre: liberado(TELAS_CELULAR[m.tela].nivel, nivel) }))
}

/* A tecla Modos, na lateral (seção 3). Abre o menu escondido com os modos e a trava.
   Travado (seção 13), ela vira o controle de destravar. */
export function TeclaModos() {
  const forma = useVariante('modos')
  const trava = useVariante('trava')
  const travado = useSim((s) => s.travado)
  const tela = useSim((s) => s.tela)
  const [menu, setMenu] = useState(false)
  const [lista, setLista] = useState(false)
  const [destaque, setDestaque] = useState<TelaCelular | null>(null)
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const modos = useModos()
  const atual = MODOS.find((m) => m.tela === tela)

  useEffect(() => {
    const abrir = () => { if (!useSim.getState().travado) setMenu(true) }
    window.addEventListener(ABRIR_MODOS, abrir)
    return () => window.removeEventListener(ABRIR_MODOS, abrir)
  }, [])

  if (travado) return <Destravar forma={trava} />

  const escolher = (t: TelaCelular) => { useSim.getState().irPara(t); setMenu(false); setLista(false); vibrar(8) }
  const nome = (
    <span className="k-presa"><b>{atual?.nome ?? 'Modos'}</b><small>{forma === 'doisdedos' ? 'dois dedos' : 'modos'}</small></span>
  )

  const tecla = forma === 'doisdedos' ? (
    <div className="cel-modo-info" aria-hidden="true"><Icone nome={atual?.icone ?? 'atalhos'} />{nome}</div>
  ) : (
    <button type="button" className="k-tecla cel-tecla-modos" aria-haspopup="menu" aria-expanded={menu || lista} aria-label={`Modo atual: ${atual?.nome}. Abrir modos`}
      onClick={() => { if (!lista) setMenu(true) }}
      onPointerDown={(e) => {
        if (forma !== 'deslizar') return
        e.currentTarget.setPointerCapture?.(e.pointerId)
        relogio.current = setTimeout(() => { setLista(true); vibrar(10) }, SEGURAR_LISTA_MS)
      }}
      onPointerMove={(e) => {
        if (!lista) return
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-modo]') as HTMLElement | null
        setDestaque((el?.dataset.modo as TelaCelular) ?? null)
      }}
      onPointerUp={() => {
        clearTimeout(relogio.current)
        if (lista) { const m = modos.find((x) => x.tela === destaque); if (m?.livre) escolher(m.tela); else setLista(false) }
      }}>
      <span className="cel-modos-icone" aria-hidden="true"><Icone nome={atual?.icone ?? 'atalhos'} tamanho={18} /></span>
      {nome}
    </button>
  )

  return (
    <div className="cel-lugar-modos" data-lab="3">
      {tecla}
      {forma === 'doisdedos' && <button type="button" className="cel-so-leitor" onClick={() => setMenu(true)}>Abrir modos</button>}
      {lista && (
        <div className="cel-lista-deslizar" role="menu" aria-label="Modos">
          {modos.map((m) => (
            <div key={m.tela} role="menuitem" aria-disabled={!m.livre} data-modo={m.tela}
              className={`cel-item-deslizar${m.tela === destaque ? ' cel-item-destaque' : ''}${m.ativo ? ' cel-modo-ativo' : ''}`}>
              <Icone nome={m.icone} tamanho={18} /><span>{m.nome}</span>{!m.livre && <small>conexão melhor</small>}
            </div>
          ))}
        </div>
      )}
      <MenuModos aberto={menu} aoFechar={() => setMenu(false)} aoEscolher={escolher} />
    </div>
  )
}

function AcoesDoMenu({ aoFechar, compacto = false }: { aoFechar: () => void; compacto?: boolean }) {
  const trava = useVariante('trava')
  return (
    <div className={`cel-menu-acoes${compacto ? ' cel-menu-acoes-linha' : ''}`}>
      <button type="button" className="cel-acao-menu" aria-label="Fechar" onClick={aoFechar}><Icone nome="fechar" tamanho={18} />{compacto && <span>Fechar</span>}</button>
      <button type="button" role="menuitem" className="cel-acao-menu" data-lab="27" aria-label="Ajustes" onClick={() => { useSim.getState().irPara('ajustes'); aoFechar() }}>
        <Icone nome="ajustes" tamanho={18} /><span>Ajustes</span>
      </button>
      {trava !== 'sem' && (
        <button type="button" role="menuitem" className="cel-acao-menu" data-lab="13" aria-label="Travar no OpenTrackpad"
          onClick={() => { useSim.getState().travar(true); aoFechar(); vibrar(12); useSim.getState().avisar('Travado: o celular fica só no OpenTrackpad') }}>
          <Icone nome="cadeado" tamanho={18} /><span>Travar</span>
        </button>
      )}
    </div>
  )
}

type ItemModo = ReturnType<typeof useModos>[number]

function ItemLinha({ m, aoEscolher }: { m: ItemModo; aoEscolher: (t: TelaCelular) => void }) {
  return (
    <button type="button" role="menuitem" className={`cel-item-modo${m.ativo ? ' cel-modo-ativo' : ''}`} aria-current={m.ativo ? 'page' : undefined}
      disabled={!m.livre} onClick={() => aoEscolher(m.tela)}>
      <Icone nome={m.icone} tamanho={18} />
      <span className="cel-item-nome">{m.nome}</span>
      {m.ativo && <Led aceso />}
      {!m.livre && <small>conexão</small>}
    </button>
  )
}

function ItemTile({ m, aoEscolher }: { m: ItemModo; aoEscolher: (t: TelaCelular) => void }) {
  return (
    <button type="button" role="menuitem" className={`cel-tile-modo${m.ativo ? ' cel-modo-ativo' : ''}`} aria-current={m.ativo ? 'page' : undefined}
      aria-label={m.livre ? m.nome : `${m.nome}: precisa de conexão melhor`} disabled={!m.livre} onClick={() => aoEscolher(m.tela)}>
      <Icone nome={m.icone} tamanho={24} />
      <span>{m.nome}</span>
    </button>
  )
}

/* O menu de modos (seção 3), em quatro arranjos para comparar no laboratório. */
function MenuModos({ aberto, aoFechar, aoEscolher }: { aberto: boolean; aoFechar: () => void; aoEscolher: (t: TelaCelular) => void }) {
  const modos = useModos()
  const forma = useVariante('menuModos')
  const grupoAtual = modos.find((m) => m.ativo)?.grupo ?? GRUPOS[0]
  const [aba, setAba] = useState<string>(grupoAtual)
  const grupos = GRUPOS.map((g) => ({ g, itens: modos.filter((m) => m.grupo === g) })).filter((x) => x.itens.length)

  if (forma === 'gaveta') {
    return (
      <Camada aberta={aberto} aoFechar={aoFechar} className="cel-camada-gaveta">
        <Modulo className="cel-gaveta-modos" role="menu" aria-label="Modos">
          <div className="cel-gaveta-rolagem">
            {grupos.map(({ g, itens }) => (
              <section key={g} aria-label={g}><h3>{g}</h3>{itens.map((m) => <ItemLinha key={m.tela} m={m} aoEscolher={aoEscolher} />)}</section>
            ))}
          </div>
          <AcoesDoMenu aoFechar={aoFechar} compacto />
        </Modulo>
      </Camada>
    )
  }

  if (forma === 'abas') {
    const atual = grupos.find((x) => x.g === aba) ?? grupos[0]
    return (
      <Camada aberta={aberto} aoFechar={aoFechar} className="cel-camada-menu">
        <Modulo className="cel-menu cel-menu-abas" role="menu" aria-label="Modos">
          <div className="cel-abas-grupos" role="tablist" aria-orientation="vertical" aria-label="Grupos">
            {grupos.map(({ g, itens }) => (
              <button key={g} type="button" role="tab" aria-selected={g === atual.g} className={g === atual.g ? 'cel-modo-ativo' : ''} onClick={() => setAba(g)}>
                <span>{g}</span>{itens.some((m) => m.ativo) && <Led aceso />}
              </button>
            ))}
          </div>
          <div className="cel-abas-itens" role="tabpanel" aria-label={atual.g}>
            {atual.itens.map((m) => <ItemTile key={m.tela} m={m} aoEscolher={aoEscolher} />)}
          </div>
          <AcoesDoMenu aoFechar={aoFechar} />
        </Modulo>
      </Camada>
    )
  }

  if (forma === 'icones') {
    return (
      <Camada aberta={aberto} aoFechar={aoFechar} className="cel-camada-menu">
        <Modulo className="cel-menu cel-menu-icones" role="menu" aria-label="Modos">
          <div className="cel-icones-grupos">
            {grupos.map(({ g, itens }) => (
              <section key={g} className="cel-icones-grupo" aria-label={g}>
                <h3>{g}</h3>
                <div className="cel-icones-grade">{itens.map((m) => <ItemTile key={m.tela} m={m} aoEscolher={aoEscolher} />)}</div>
              </section>
            ))}
          </div>
          <AcoesDoMenu aoFechar={aoFechar} />
        </Modulo>
      </Camada>
    )
  }

  return (
    <Camada aberta={aberto} aoFechar={aoFechar} className="cel-camada-menu">
      <Modulo className="cel-menu" role="menu" aria-label="Modos">
        <div className="cel-menu-colunas">
          {grupos.map(({ g, itens }) => (
            <section key={g} className="cel-menu-coluna" aria-label={g}>
              <h3>{g}</h3>
              {itens.map((m) => <ItemLinha key={m.tela} m={m} aoEscolher={aoEscolher} />)}
            </section>
          ))}
          <AcoesDoMenu aoFechar={aoFechar} />
        </div>
      </Modulo>
    </Camada>
  )
}

function Destravar({ forma }: { forma: string }) {
  const [progresso, setProgresso] = useState(0)
  const [desenhar, setDesenhar] = useState(false)
  const relogio = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  useEffect(() => () => clearInterval(relogio.current), [])
  const destravar = () => { useSim.getState().travar(false); vibrar([10, 30, 10]); useSim.getState().avisar('Destravado') }
  const parar = () => { clearInterval(relogio.current); setProgresso(0) }

  if (forma === 'desenho') {
    return (
      <div className="cel-lugar-modos" data-lab="13">
        <button type="button" className="k-tecla cel-tecla-modos cel-travado" onClick={() => setDesenhar(true)} aria-label="Travado. Tocar para destravar">
          <Led aceso cor="ambar" /><span className="k-presa"><b>Travado</b><small>toque para abrir</small></span>
        </button>
        <Camada aberta={desenhar} aoFechar={() => setDesenhar(false)} className="cel-camada-menu">
          <Modulo className="cel-desenho">
            <p>Ligue os pontos na ordem para destravar</p>
            <Traco aoAcertar={() => { setDesenhar(false); destravar() }} />
            <button type="button" className="cel-texto-botao" onClick={() => { setDesenhar(false); destravar() }}>Destravar sem desenhar</button>
          </Modulo>
        </Camada>
      </div>
    )
  }
  return (
    <div className="cel-lugar-modos" data-lab="13">
      <button type="button" className="k-tecla cel-tecla-modos cel-travado" aria-label="Travado. Segure por 3 segundos para destravar"
        style={{ ['--p' as string]: `${progresso * 100}%` }}
        onPointerDown={() => {
          const t0 = Date.now()
          clearInterval(relogio.current)
          relogio.current = setInterval(() => {
            const p = Math.min(1, (Date.now() - t0) / SEGURAR_MS)
            setProgresso(p)
            if (p >= 1) { parar(); destravar() }
          }, 50)
        }}
        onPointerUp={parar} onPointerLeave={parar} onPointerCancel={parar}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.repeat) destravar() }}>
        <span className="cel-progresso" aria-hidden="true" />
        <Led aceso cor="ambar" /><span className="k-presa"><b>Travado</b><small>{progresso > 0 ? 'continue…' : 'segure 3 s'}</small></span>
      </button>
    </div>
  )
}
