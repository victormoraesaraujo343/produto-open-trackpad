import { Children, type ReactNode } from 'react'
import './kit.css'

/* Lateral: um canal rebaixado no alumínio, com as teclas dentro. Sempre 5 posições por coluna;
   posição vazia continua ocupando o lugar, para nada mudar de posição sob o dedo.
   `cabeca` é uma linha curta de estado no alto do canal (sem toque). */
export function Lateral({ children, lado, rotulo, colunas = 1, cabeca }: { children?: ReactNode; lado: 'esquerda' | 'direita'; rotulo: string; colunas?: 1 | 2; cabeca?: ReactNode }) {
  const total = 5 * colunas
  const itens = Children.toArray(children).slice(0, total)
  return (
    <div className={`k-lateral k-lateral-${lado}${colunas === 2 ? ' k-lateral-dupla' : ''}`} role="group" aria-label={rotulo}>
      {cabeca && <div className="k-cabeca">{cabeca}</div>}
      <div className="k-lugares">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className="k-lugar" data-posicao={i + 1}>{itens[i] ?? null}</div>
        ))}
      </div>
    </div>
  )
}
