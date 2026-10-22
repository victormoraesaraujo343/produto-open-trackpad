import { Led } from './Led'
import './kit.css'

/* Chave basculante: uma peça só que afunda de um lado ou do outro. O lado ligado acende o LED
   e o texto diz o estado (não depende só da cor). */
export function Basculante({ ligado, aoMudar, rotulo }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo}
      className={`k-basculante${ligado ? ' k-ligada' : ''}`} onClick={() => aoMudar(!ligado)}>
      <span className="k-bas-face"><Led aceso={ligado} /><span>{ligado ? 'Ligado' : 'Desligado'}</span></span>
    </button>
  )
}
