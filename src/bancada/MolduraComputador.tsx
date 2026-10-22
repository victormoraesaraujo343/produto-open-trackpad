import { useRef, type ReactNode } from 'react'
import { escalaDaMoldura } from '../design/escala'
import { useTamanho } from '../design/useTamanho'
import './moldura-computador.css'

export const DESENHO_COMPUTADOR = { largura: 1024, altura: 640 }
const BORDA = 14
const QUEIXO = 22
const MONITOR = { largura: DESENHO_COMPUTADOR.largura + BORDA * 2, altura: DESENHO_COMPUTADOR.altura + BORDA + QUEIXO }

/* O computador falso: um monitor desenhado a 1024 × 640 e escalado para caber. */
export function MolduraComputador({ children }: { children: ReactNode }) {
  const area = useRef<HTMLDivElement>(null)
  const k = escalaDaMoldura(useTamanho(area), MONITOR)
  return (
    <div ref={area} className="pc-area">
      <div className="pc-encaixe" style={{ width: MONITOR.largura * k, height: MONITOR.altura * k }}>
        <div className="pc-monitor" style={{ width: MONITOR.largura, height: MONITOR.altura, transform: `scale(${k})`, padding: `${BORDA}px ${BORDA}px ${QUEIXO}px` }}>
          <div className="pc-tela" style={{ width: DESENHO_COMPUTADOR.largura, height: DESENHO_COMPUTADOR.altura }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
