import type { ReactNode } from 'react'
import { vibrar } from '../sim/vibrar'
import { Icone } from './Icone'
import { Led } from './Led'
import './kit.css'

/* Tecla física: face metálica, chanfro, afunda 1 px ao tocar. `led` mostra o LED de estado
   (aceso = ligado); `destaque` é o botão laranja redondo. */
export function Tecla({ rotulo, icone, ligada, led, destaque, aoTocar, mostrarRotulo = true, className = '', children }: {
  rotulo: string; icone?: string; ligada?: boolean; led?: boolean; destaque?: boolean
  aoTocar: () => void; mostrarRotulo?: boolean; className?: string; children?: ReactNode
}) {
  const classe = ['k-tecla', ligada && 'k-ligada', destaque && 'k-destaque', className].filter(Boolean).join(' ')
  return (
    <button type="button" className={classe} aria-label={rotulo} aria-pressed={ligada}
      onClick={() => { vibrar(8); aoTocar() }}>
      {led !== undefined && <Led aceso={led} canto />}
      {icone && <Icone nome={icone} />}
      {children}
      {mostrarRotulo && !destaque && <span className="k-rotulo">{rotulo}</span>}
    </button>
  )
}
