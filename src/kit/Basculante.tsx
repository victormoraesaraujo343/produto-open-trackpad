import { Led } from './Led'
import './kit.css'

/* Liga e desliga (issue #8, seção 34): trilho com pino que corre e leva o LED. O estado nunca é
   só cor: tem posição, e o nome acessível diz "ligado"/"desligado" (aria-checked). */
export function Basculante({ ligado, aoMudar, rotulo }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} onClick={() => aoMudar(!ligado)} data-lab="34"
      className={`k-alt-trilho${ligado ? ' k-ligada' : ''}`}>
      <span className="k-alt-pino"><Led aceso={ligado} /></span>
    </button>
  )
}
