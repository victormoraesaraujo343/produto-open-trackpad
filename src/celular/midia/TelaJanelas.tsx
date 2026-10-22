import { APPS, type AppId } from '../../dados/apps'
import { JANELAS } from '../../dados/janelas'
import { IconeApp } from '../../kit/IconeApp'
import { Led } from '../../kit/Led'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'

/* Janelas abertas no computador, por ícone (seção 16): menos texto, reconhecimento na hora.
   O computador manda o ícone do app de cada janela. Um toque troca para ela. */
export function TelaJanelas() {
  const foco = useSim((s) => s.appEmFoco)
  const porApp = new Map<AppId, typeof JANELAS>()
  for (const j of JANELAS) porApp.set(j.app, [...(porApp.get(j.app) ?? []), j])
  return (
    <div className="cel-janelas" data-lab="16" role="list" aria-label="Janelas abertas">
      {[...porApp].map(([app, js]) => (
        <button key={app} type="button" role="listitem" className={`cel-janela${app === foco ? ' cel-janela-foco' : ''}`}
          aria-current={app === foco || undefined} aria-label={`${APPS[app].nome}: ${js.map((j) => j.titulo).join(', ')}`}
          onClick={() => { useSim.getState().trocarParaJanela(js[0].id); vibrar(8) }}>
          <IconeApp app={app} tamanho={52} />
          {js.length > 1 && <span className="cel-janela-qtd">{js.length}</span>}
          <span className="cel-janela-nome">{APPS[app].nome}</span>
          {app === foco && <Led aceso />}
        </button>
      ))}
    </div>
  )
}
