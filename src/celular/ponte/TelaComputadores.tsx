import { COMPUTADORES } from '../../dados/computadores'
import { Icone } from '../../kit/Icone'
import { Led } from '../../kit/Led'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'

const NOME_SISTEMA = { linux: 'Linux', windows: 'Windows', macos: 'macOS' } as const

/* Um celular, vários computadores (seção 26): trocar com um toque. Cada computador guarda
   o seu app em foco e os seus atalhos. */
export function TelaComputadores() {
  const atual = useSim((s) => s.computador)
  return (
    <div className="cel-computadores" data-lab="26" role="list">
      {COMPUTADORES.map((c) => (
        <button key={c.id} type="button" role="listitem" className={`cel-pc-tecla${c.id === atual ? ' cel-pc-atual' : ''}`} aria-current={c.id === atual || undefined}
          onClick={() => { const s = useSim.getState(); s.trocarComputador(c.id); s.setSistema(c.sistema); s.avisar(`Controlando ${c.nome}`); vibrar(10) }}>
          <Icone nome="computador" tamanho={26} />
          <span className="cel-pc-nome">{c.nome}</span>
          <span className="cel-pc-estado"><Led aceso={c.id === atual} />{c.id === atual ? 'controlando' : NOME_SISTEMA[c.sistema]}</span>
        </button>
      ))}
    </div>
  )
}
