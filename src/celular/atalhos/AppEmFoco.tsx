import { APPS } from '../../dados/apps'
import { useSim } from '../../sim/loja'

/* Qual app está em foco no computador: os atalhos à vista são os dele. */
export function AppEmFoco({ compacto = false }: { compacto?: boolean }) {
  const app = APPS[useSim((s) => s.appEmFoco)]
  return (
    <div className={`cel-app${compacto ? ' cel-app-compacto' : ''}`} aria-live="polite">
      <i style={{ background: app.cor }} aria-hidden="true" />
      <span>{app.nome}</span>
    </div>
  )
}
