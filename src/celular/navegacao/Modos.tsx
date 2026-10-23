import { useEffect, useRef, useState } from 'react'
import { Camada } from '../../kit/Camada'
import { Icone } from '../../kit/Icone'
import { Led } from '../../kit/Led'
import { Modulo } from '../../kit/Modulo'
import { liberado } from '../../sim/conexao'
import { nivelAtual, useSim } from '../../sim/loja'
import { TELAS_CELULAR, type TelaCelular } from '../../sim/telas'
import { vibrar } from '../../sim/vibrar'
import { GRUPOS, MODOS } from './modos'

/* abre o menu de fora (laboratório e testes) */
export const ABRIR_MODOS = 'otp:abrir-modos'
const SEGURAR_MS = 3000

function useModos() {
  const tela = useSim((s) => s.tela)
  const nivel = nivelAtual(useSim((s) => s.preset))
  const variosPcs = useSim((s) => s.opcoes.variosPcs)
  return MODOS.filter((m) => m.tela !== 'computadores' || variosPcs).map((m) => ({ ...m, ativo: m.tela === tela, livre: liberado(TELAS_CELULAR[m.tela].nivel, nivel) }))
}

/* A tecla Modos, na lateral (seção 3). Abre o menu com os modos e a trava.
   Travado (seção 13), ela vira o controle de destravar. */
export function TeclaModos() {
  const travado = useSim((s) => s.travado)
  const tela = useSim((s) => s.tela)
  const [menu, setMenu] = useState(false)
  const atual = MODOS.find((m) => m.tela === tela)

  useEffect(() => {
    const abrir = () => { if (!useSim.getState().travado) setMenu(true) }
    window.addEventListener(ABRIR_MODOS, abrir)
    return () => window.removeEventListener(ABRIR_MODOS, abrir)
  }, [])

  if (travado) return <Destravar />

  const escolher = (t: TelaCelular) => { useSim.getState().irPara(t); setMenu(false); vibrar(8) }

  return (
    <div className="cel-lugar-modos" data-lab="3">
      <button type="button" className="k-tecla cel-tecla-modos" aria-haspopup="menu" aria-expanded={menu} aria-label={`Modo atual: ${atual?.nome}. Abrir modos`}
        onClick={() => setMenu(true)}>
        <span className="cel-modos-icone" aria-hidden="true"><Icone nome={atual?.icone ?? 'atalhos'} tamanho={18} /></span>
        <span className="k-presa"><b>{atual?.nome ?? 'Modos'}</b><small>modos</small></span>
      </button>
      <MenuModos aberto={menu} aoFechar={() => setMenu(false)} aoEscolher={escolher} />
    </div>
  )
}

function AcoesDoMenu({ aoFechar }: { aoFechar: () => void }) {
  return (
    <div className="cel-menu-acoes">
      <button type="button" className="cel-acao-menu" aria-label="Fechar" onClick={aoFechar}><Icone nome="fechar" tamanho={18} /></button>
      <button type="button" role="menuitem" className="cel-acao-menu" data-lab="27" aria-label="Ajustes" onClick={() => { useSim.getState().irPara('ajustes'); aoFechar() }}>
        <Icone nome="ajustes" tamanho={18} /><span>Ajustes</span>
      </button>
      <button type="button" role="menuitem" className="cel-acao-menu" data-lab="13" aria-label="Travar no OpenTrackpad"
        onClick={() => { useSim.getState().travar(true); aoFechar(); vibrar(12); useSim.getState().avisar('Travado') }}>
        <Icone nome="cadeado" tamanho={18} /><span>Travar</span>
      </button>
    </div>
  )
}

type ItemModo = ReturnType<typeof useModos>[number]

function ItemTile({ m, aoEscolher }: { m: ItemModo; aoEscolher: (t: TelaCelular) => void }) {
  return (
    <button type="button" role="menuitem" className={`cel-tile-modo${m.ativo ? ' cel-modo-ativo' : ''}`} aria-current={m.ativo ? 'page' : undefined}
      aria-label={m.livre ? m.nome : `${m.nome}: precisa de conexão melhor`} disabled={!m.livre} onClick={() => aoEscolher(m.tela)}>
      <Icone nome={m.icone} tamanho={24} />
      <span>{m.nome}</span>
    </button>
  )
}

/* O menu de modos (seção 3): grupos como abas, modos grandes. */
function MenuModos({ aberto, aoFechar, aoEscolher }: { aberto: boolean; aoFechar: () => void; aoEscolher: (t: TelaCelular) => void }) {
  const modos = useModos()
  const grupoAtual = modos.find((m) => m.ativo)?.grupo ?? GRUPOS[0]
  const [aba, setAba] = useState<string>(grupoAtual)
  const grupos = GRUPOS.map((g) => ({ g, itens: modos.filter((m) => m.grupo === g) })).filter((x) => x.itens.length)
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

/* Modo travado (seção 13): segurar 3 s para destravar, com o progresso na tecla. */
function Destravar() {
  const [progresso, setProgresso] = useState(0)
  const relogio = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  useEffect(() => () => clearInterval(relogio.current), [])
  const destravar = () => { useSim.getState().travar(false); vibrar([10, 30, 10]); useSim.getState().avisar('Destravado') }
  const parar = () => { clearInterval(relogio.current); setProgresso(0) }

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
