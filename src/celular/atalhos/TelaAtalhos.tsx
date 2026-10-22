import { useState } from 'react'
import { Icone } from '../../kit/Icone'
import { TeclaAtalho } from '../../kit/TeclaAtalho'
import { useVariante } from '../../lab/refinamento'
import { useSim } from '../../sim/loja'

const GRUPOS: { nome: string; ids: string[] }[] = [
  { nome: 'Editar', ids: ['copiar', 'colar', 'desfazer', 'refazer'] },
  { nome: 'Janelas', ids: ['alttab', 'areas', 'maximizar', 'captura'] },
]
const POR_PAGINA = 6

/* Painel de atalhos (seção 4): os atalhos do app em foco, em quatro arranjos. */
export function TelaAtalhos() {
  const forma = useVariante('atalhos')
  const ids = useSim((s) => s.perfis[s.appEmFoco])
  const [pagina, setPagina] = useState(0)

  if (forma === 'largas') {
    return (
      <div className="cel-atalhos" data-lab="4">
        <div className="cel-grade cel-grade-largas">{ids.map((id) => <TeclaAtalho key={id} id={id} combinacao />)}</div>
      </div>
    )
  }

  if (forma === 'grupos') {
    const doApp = ids.filter((id) => !GRUPOS.some((g) => g.ids.includes(id))).slice(0, 4)
    const colunas = [...GRUPOS, { nome: 'Deste app', ids: doApp }].filter((g) => g.ids.length)
    return (
      <div className="cel-atalhos" data-lab="4">
        <div className="cel-colunas">
          {colunas.map((g) => (
            <section key={g.nome} className="cel-coluna" aria-label={g.nome}>
              <h3>{g.nome}</h3>
              {g.ids.map((id) => <TeclaAtalho key={id} id={id} />)}
            </section>
          ))}
        </div>
      </div>
    )
  }

  if (forma === 'paginas') {
    const total = Math.ceil(ids.length / POR_PAGINA)
    const p = Math.min(pagina, total - 1)
    return (
      <div className="cel-atalhos" data-lab="4">
        <div className="cel-atalhos-topo">
            <span className="cel-pagina-texto">Página {p + 1} de {total}</span>
        </div>
        <div className="cel-paginas">
          <button type="button" className="cel-seta" aria-label="Página anterior" disabled={p === 0} onClick={() => setPagina(p - 1)}><Icone nome="voltar" /></button>
          <div className="cel-grade cel-grade-pagina"
            onPointerDown={(e) => { (e.currentTarget as HTMLElement).dataset.x = String(e.clientX) }}
            onPointerUp={(e) => { const x0 = Number((e.currentTarget as HTMLElement).dataset.x); const d = e.clientX - x0; if (d < -60 && p < total - 1) setPagina(p + 1); if (d > 60 && p > 0) setPagina(p - 1) }}>
            {ids.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA).map((id) => <TeclaAtalho key={id} id={id} />)}
          </div>
          <button type="button" className="cel-seta cel-seta-dir" aria-label="Próxima página" disabled={p >= total - 1} onClick={() => setPagina(p + 1)}><Icone nome="voltar" /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="cel-atalhos" data-lab="4">
      <div className="cel-grade cel-grade-4">{ids.map((id) => <TeclaAtalho key={id} id={id} />)}</div>
    </div>
  )
}
