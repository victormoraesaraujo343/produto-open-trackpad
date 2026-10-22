import { useVariante } from '../lab/refinamento'
import { Led } from './Led'
import './kit.css'

/* Liga e desliga (issue #8, seção 34). O estado nunca é só cor: tem posição ou profundidade,
   e o nome acessível diz "ligado"/"desligado". Quatro desenhos para comparar no laboratório. */
export function Basculante({ ligado, aoMudar, rotulo }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  const forma = useVariante('alternador')
  const comum = { type: 'button' as const, role: 'switch', 'aria-checked': ligado, 'aria-label': rotulo, onClick: () => aoMudar(!ligado), 'data-lab': '34' }

  if (forma === 'trilho') {
    return (
      <button {...comum} className={`k-alt-trilho${ligado ? ' k-ligada' : ''}`}>
        <span className="k-alt-pino"><Led aceso={ligado} /></span>
      </button>
    )
  }
  if (forma === 'segmento') {
    return (
      <button {...comum} className="k-alt-segmento">
        <span className={ligado ? '' : 'k-alt-escolhido'}>Desl.</span>
        <span className={ligado ? 'k-alt-escolhido' : ''}>Lig.</span>
      </button>
    )
  }
  if (forma === 'basculante') {
    return (
      <button {...comum} className={`k-basculante${ligado ? ' k-ligada' : ''}`}>
        <span className="k-bas-face"><Led aceso={ligado} /><span>{ligado ? 'Ligado' : 'Desligado'}</span></span>
      </button>
    )
  }
  return (
    <button {...comum} className={`k-alt-tecla${ligado ? ' k-ligada' : ''}`}>
      <Led aceso={ligado} />
    </button>
  )
}
