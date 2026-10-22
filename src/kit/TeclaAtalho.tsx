import { ATALHOS, teclasDoSistema } from '../dados/atalhos'
import { useSim } from '../sim/loja'
import { Tecla } from './Tecla'

/* Atalhos que ligam e desligam algo: a palavra do estado em cada caso (ligado = valor true). */
const ESTADOS: Record<string, { nome: string; ligado: string; desligado: string }> = {
  mudo: { nome: 'Microfone', ligado: 'mudo', desligado: 'aberto' },
  camera: { nome: 'Câmera', ligado: 'desligada', desligado: 'ligada' },
  mao: { nome: 'Mão', ligado: 'levantada', desligado: 'abaixada' },
  gravar: { nome: 'Gravar', ligado: 'gravando', desligado: 'parado' },
}

/* Tecla que dispara um atalho da biblioteca. As de liga e desliga mostram o LED e o estado
   também em texto, para não depender só da cor. */
export function TeclaAtalho({ id, combinacao = false, className }: { id: string; combinacao?: boolean; className?: string }) {
  const a = ATALHOS[id]
  const ligado = useSim((s) => !!s.ligados[id])
  const sistema = useSim((s) => s.sistema)
  const disparar = useSim((s) => s.dispararAtalho)
  if (!a) return null
  const estado = ESTADOS[id]
  if (estado) {
    const palavra = ligado ? estado.ligado : estado.desligado
    return (
      <Tecla rotulo={`${estado.nome}: ${palavra}`} icone={a.icone} led={ligado} ligada={ligado} mostrarRotulo={false} className={className} aoTocar={() => disparar(id)}>
        <span className="k-presa"><b>{estado.nome}</b><small>{palavra}</small></span>
      </Tecla>
    )
  }
  return (
    <Tecla rotulo={a.rotulo} icone={a.icone} mostrarRotulo={!combinacao} className={className} aoTocar={() => disparar(id)}>
      {combinacao && (
        <span className="k-combo">
          <span className="k-combo-nome">{a.rotulo}</span>
          <span className="k-combo-teclas">{teclasDoSistema(a.teclas, sistema).map((t) => <kbd key={t}>{t}</kbd>)}</span>
        </span>
      )}
    </Tecla>
  )
}
