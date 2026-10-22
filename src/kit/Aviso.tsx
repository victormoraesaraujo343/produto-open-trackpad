import { useSim } from '../sim/loja'
import './kit.css'

export function Aviso() {
  const aviso = useSim((s) => s.aviso)
  return <div className={`k-aviso${aviso ? ' k-mostra' : ''}`} role="status" aria-live="polite">{aviso}</div>
}
