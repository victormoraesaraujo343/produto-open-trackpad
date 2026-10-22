import { APPS } from '../../dados/apps'
import { JANELAS } from '../../dados/janelas'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'

/* Janelas abertas no computador; um toque troca para ela (seção 16). */
export function TelaJanelas() {
  const foco = useSim((s) => s.appEmFoco)
  return (
    <div className="cel-janelas" data-lab="16" role="list">
      {JANELAS.map((j) => (
        <button key={j.id} type="button" role="listitem" className={`cel-janela${j.app === foco ? ' cel-janela-foco' : ''}`} aria-current={j.app === foco || undefined}
          onClick={() => { useSim.getState().trocarParaJanela(j.id); vibrar(8) }}>
          <span className="cel-janela-app"><i style={{ background: APPS[j.app].cor }} aria-hidden="true" />{APPS[j.app].nome}</span>
          <span className="cel-janela-titulo">{j.titulo}</span>
        </button>
      ))}
    </div>
  )
}
