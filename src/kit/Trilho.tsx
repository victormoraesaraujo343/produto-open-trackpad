import { Children, type ReactNode } from 'react'
import './kit.css'

/* Trilho: sempre cinco posições. Posição vazia continua ocupando o lugar,
   para nenhuma tecla mudar de posição sob o dedo. */
export function Trilho({ children, lado }: { children?: ReactNode; lado: 'esquerda' | 'direita' }) {
  const itens = Children.toArray(children).slice(0, 5)
  return (
    <div className={`k-trilho k-trilho-${lado}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="k-posicao" data-posicao={i + 1}>{itens[i] ?? null}</div>
      ))}
    </div>
  )
}
