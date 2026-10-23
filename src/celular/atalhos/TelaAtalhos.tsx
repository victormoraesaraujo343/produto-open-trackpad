import { TeclaAtalho } from '../../kit/TeclaAtalho'
import { useSim } from '../../sim/loja'

/* Painel de atalhos (seção 4): os atalhos do app em foco, numa grade de quatro colunas. */
export function TelaAtalhos() {
  const ids = useSim((s) => s.perfis[s.appEmFoco])
  return (
    <div className="cel-atalhos" data-lab="4">
      <div className="cel-grade cel-grade-4">{ids.map((id) => <TeclaAtalho key={id} id={id} />)}</div>
    </div>
  )
}
