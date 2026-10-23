import { APPS } from '../../dados/apps'
import { COMPUTADORES, type Computador, type Sistema } from '../../dados/computadores'
import { IconeApp } from '../../kit/IconeApp'
import { Led } from '../../kit/Led'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'
import './computadores.css'

const NOME_SISTEMA: Record<Sistema, string> = { linux: 'Linux', windows: 'Windows', macos: 'macOS' }

/* Estado só com o que os dados trazem. Não pareado não se controla daqui: o celular não
   manda teclas a um computador que ainda não conhece. */
function estadoDe(c: Computador, atual: boolean) {
  if (atual) return { rotulo: 'Em uso', aceso: true, livre: true }
  if (!c.confiavel) return { rotulo: 'Não pareado', aceso: false, livre: false }
  return { rotulo: 'Disponível', aceso: true, livre: true }
}

/* Troca com um toque. O computador em uso não troca nada. */
function trocar(c: Computador) {
  const s = useSim.getState()
  if (s.computador === c.id) return
  s.trocarComputador(c.id)
  s.setSistema(c.sistema)
  s.avisar(`Controlando ${c.nome}`)
  vibrar(10)
}

/* Desenho do computador: monitor com pé. Aceso, a tela mostra a cor do app em foco. */
function Glifo({ tam, aceso, cor }: { tam: number; aceso: boolean; cor?: string }) {
  return (
    <span className={`pc-glifo${aceso ? ' pc-aceso' : ''}`} aria-hidden="true"
      style={{ ['--tam' as string]: `${tam}px`, ...(cor ? { ['--cor' as string]: cor } : {}) }}>
      <span className="pc-moldura"><span className="pc-vidro" /></span>
      <span className="pc-pe" />
      <span className="pc-base" />
    </span>
  )
}

/* Um computador como cartão. O nome acessível traz nome, sistema e estado. */
function Pc({ c }: { c: Computador }) {
  const atual = useSim((s) => s.computador) === c.id
  const app = useSim((s) => s.appEmFoco)
  const e = estadoDe(c, atual)
  const sistema = NOME_SISTEMA[c.sistema]
  const cor = atual ? APPS[app].cor : undefined

  return (
    <button type="button" className={`pc pc-cartao${atual ? ' pc-atual' : ''}`} disabled={!e.livre}
      aria-current={atual || undefined} aria-label={`${c.nome}, ${sistema}, ${e.rotulo}`} onClick={() => trocar(c)}>
      <span className="pc-selo">{sistema}</span>
      <Glifo tam={56} aceso={e.aceso} cor={cor} />
      <span className="pc-nome">{c.nome}</span>
      <span className="pc-estado"><Led aceso={e.aceso} />{e.rotulo}</span>
      {atual && <span className="pc-app"><IconeApp app={app} tamanho={18} /><span>{APPS[app].nome}</span></span>}
    </button>
  )
}

/* Um celular, vários computadores (seção 26): trocar com um toque. Cada computador guarda
   o seu app em foco. */
export function TelaComputadores() {
  return (
    <div className="pc-raiz pc-cartoes" data-lab="26">
      <ul className="pc-grade" aria-label="Computadores encontrados">
        {COMPUTADORES.map((c) => <li key={c.id}><Pc c={c} /></li>)}
      </ul>
    </div>
  )
}
