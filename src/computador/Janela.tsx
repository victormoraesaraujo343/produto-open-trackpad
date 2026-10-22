import type { ReactNode } from 'react'
import { useSim } from '../sim/loja'

/* Janela do app do OpenTrackpad no computador: barra de título do sistema escolhido,
   corpo na identidade metalizada. */
export function Janela({ titulo, aoFechar, children, largura = 720, altura = 460, lab }: { titulo: string; aoFechar: () => void; children: ReactNode; largura?: number; altura?: number; lab?: string }) {
  const sistema = useSim((s) => s.sistema)
  return (
    <div className={`pc-janela pc-janela-${sistema}`} role="dialog" aria-label={titulo} style={{ width: largura, height: altura }} data-lab={lab}>
      <div className="pc-janela-titulo">
        <button type="button" className="pc-fechar" aria-label={`Fechar ${titulo}`} onClick={aoFechar}><i /></button>
        <span>{titulo}</span>
      </div>
      <div className="pc-janela-corpo">{children}</div>
    </div>
  )
}
