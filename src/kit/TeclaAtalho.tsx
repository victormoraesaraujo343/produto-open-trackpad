import { ATALHOS, teclasDoSistema } from '../dados/atalhos'
import { useSim } from '../sim/loja'
import { Tecla } from './Tecla'

const LIGA_DESLIGA = new Set(['mudo', 'camera', 'gravar', 'mao'])

/* Tecla que dispara um atalho da biblioteca. As de liga e desliga mostram o LED e o estado
   também em texto, para não depender só da cor. */
export function TeclaAtalho({ id, combinacao = false, className }: { id: string; combinacao?: boolean; className?: string }) {
  const a = ATALHOS[id]
  const ligado = useSim((s) => !!s.ligados[id])
  const sistema = useSim((s) => s.sistema)
  const disparar = useSim((s) => s.dispararAtalho)
  if (!a) return null
  const estado = LIGA_DESLIGA.has(id)
  const rotulo = estado ? `${a.rotulo} ${ligado ? 'ligado' : 'desligado'}` : a.rotulo
  return (
    <Tecla rotulo={rotulo} icone={a.icone} led={estado ? ligado : undefined} ligada={estado ? ligado : undefined}
      mostrarRotulo={!combinacao} className={className} aoTocar={() => disparar(id)}>
      {combinacao && (
        <span className="k-combo">
          <span className="k-combo-nome">{a.rotulo}</span>
          <span className="k-combo-teclas">{teclasDoSistema(a.teclas, sistema).map((t) => <kbd key={t}>{t}</kbd>)}</span>
        </span>
      )}
    </Tecla>
  )
}
