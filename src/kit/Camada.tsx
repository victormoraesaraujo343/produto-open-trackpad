import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './kit.css'

const EVENTOS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend'] as const

/* Camada por cima da tela do celular. Enquanto aberta, nenhum toque fora dela chega ao que
   está embaixo (o defeito #2 da v0.2 era o contrário): os eventos são parados na fase de
   captura, no elemento da tela. Tocar no fundo escurecido fecha. */
export function Camada({ aberta, aoFechar, children, className = '' }: { aberta: boolean; aoFechar: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const fecharRef = useRef(aoFechar)
  fecharRef.current = aoFechar
  useEffect(() => {
    const no = ref.current
    if (!aberta || !no) return
    const raiz = (no.closest('[data-tela-celular]') as HTMLElement | null) ?? no.parentElement
    if (!raiz) return
    const barrar = (e: Event) => {
      if (no.contains(e.target as Node)) return
      e.stopPropagation()
      e.preventDefault()
    }
    for (const t of EVENTOS) raiz.addEventListener(t, barrar, true)
    // teclado: o que está embaixo sai da ordem do Tab; o foco entra na camada; Esc fecha
    const embaixo = [...raiz.children].filter((c) => c !== no && !c.contains(no)) as HTMLElement[]
    embaixo.forEach((c) => c.setAttribute('inert', ''))
    const antes = document.activeElement as HTMLElement | null
    no.querySelector<HTMLElement>('button:not(:disabled), [href], input, [tabindex]:not([tabindex="-1"])')?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); fecharRef.current() } }
    window.addEventListener('keydown', esc)
    return () => {
      for (const t of EVENTOS) raiz.removeEventListener(t, barrar, true)
      embaixo.forEach((c) => c.removeAttribute('inert'))
      window.removeEventListener('keydown', esc)
      if (antes && document.contains(antes)) antes.focus()
    }
  }, [aberta])
  if (!aberta) return null
  /* sempre por cima da tela inteira do celular, de onde quer que seja aberta */
  const tela = document.querySelector('[data-tela-celular]')
  const camada = (
    <div ref={ref} className={`k-camada ${className}`} onClick={(e) => { if (e.target === e.currentTarget) aoFechar() }}>
      {children}
    </div>
  )
  return tela ? createPortal(camada, tela) : camada
}
