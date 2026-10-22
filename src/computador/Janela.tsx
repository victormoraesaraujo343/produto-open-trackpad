import { useEffect, useRef, type ReactNode } from 'react'
import { useSim } from '../sim/loja'

const FOCAVEL = 'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/* Janela do app do OpenTrackpad no computador: barra de título do sistema escolhido, corpo na
   identidade metalizada. Ao abrir, o foco vai para dentro; Esc fecha e devolve o foco. */
export function Janela({ titulo, aoFechar, children, largura = 720, altura = 460, lab }: { titulo: string; aoFechar: () => void; children: ReactNode; largura?: number; altura?: number; lab?: string }) {
  const sistema = useSim((s) => s.sistema)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    const corpo = ref.current?.querySelector<HTMLElement>('.pc-janela-corpo')
    ;(corpo?.querySelector<HTMLElement>(FOCAVEL) ?? ref.current)?.focus()
    return () => { if (antes && document.contains(antes)) antes.focus() }
  }, [])
  return (
    <div ref={ref} tabIndex={-1} className={`pc-janela pc-janela-${sistema}`} role="dialog" aria-label={titulo} style={{ width: largura, height: altura }} data-lab={lab}
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.stopPropagation(); aoFechar() } }}>
      <div className="pc-janela-titulo">
        <button type="button" className="pc-fechar" aria-label={`Fechar ${titulo}`} onClick={aoFechar}><i /></button>
        <span>{titulo}</span>
      </div>
      <div className="pc-janela-corpo">{children}</div>
    </div>
  )
}
