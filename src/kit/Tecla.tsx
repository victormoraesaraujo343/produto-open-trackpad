import type { ReactNode } from 'react'
import { vibrar } from '../sim/vibrar'
import { Icone } from './Icone'
import { Led } from './Led'
import './kit.css'

/* Tecla: o material da identidade (face metálica, chanfro, sombra) e afunda 1 px ao tocar.
   `led` mostra o LED de estado (aceso = ligado). Forma e lugar de cada tecla são desenho de tela. */
export function Tecla({ rotulo, icone, ligada, led, aoTocar, mostrarRotulo = true, className = '', children }: {
  rotulo: string; icone?: string; ligada?: boolean; led?: boolean
  aoTocar: () => void; mostrarRotulo?: boolean; className?: string; children?: ReactNode
}) {
  const classe = ['k-tecla', ligada && 'k-ligada', className].filter(Boolean).join(' ')
  return (
    <button type="button" className={classe} aria-label={rotulo} aria-pressed={ligada}
      onClick={() => { vibrar(8); aoTocar() }}>
      {led !== undefined && <Led aceso={led} canto />}
      {icone && <Icone nome={icone} />}
      {children}
      {mostrarRotulo && <span className="k-rotulo">{rotulo}</span>}
    </button>
  )
}
