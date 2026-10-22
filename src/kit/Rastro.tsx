import { useEffect, useRef } from 'react'
import { useVariante } from '../lab/refinamento'

const VIDA_MS = 700
const PASSO = 14
const RAIO = 56

interface Marca { x: number; y: number; t: number }

/* Rastro no trackpad (issue #4, seção 35): uma grade de pontos circulares que acende em volta
   do dedo e se apaga com fade. Opcional (Ajustes) e desligado com "reduzir movimento".
   Desenha num canvas por cima, sem pegar toque; o laço só roda enquanto há rastro. */
export function Rastro({ alvo }: { alvo: React.RefObject<HTMLElement | null> }) {
  const forma = useVariante('rastro')
  const canvas = useRef<HTMLCanvasElement>(null)
  const marcas = useRef<Marca[]>([])
  const quadro = useRef(0)

  useEffect(() => {
    const el = alvo.current
    const c = canvas.current
    if (!el || !c) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const cor = getComputedStyle(el).getPropertyValue('--pad-ink').trim() || '#8F9295'

    const medir = () => {
      const dpr = window.devicePixelRatio || 1
      c.width = el.offsetWidth * dpr
      c.height = el.offsetHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    medir()

    const desenhar = () => {
      const agora = performance.now()
      marcas.current = marcas.current.filter((m) => agora - m.t < VIDA_MS)
      ctx.clearRect(0, 0, el.offsetWidth, el.offsetHeight)
      const ms = marcas.current
      if (forma === 'ondas') {
        for (const m of ms) {
          const p = (agora - m.t) / VIDA_MS
          ctx.beginPath()
          ctx.arc(m.x, m.y, 8 + p * 46, 0, Math.PI * 2)
          ctx.strokeStyle = cor
          ctx.globalAlpha = (1 - p) * 0.35
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
      } else if (forma === 'cometa') {
        ms.forEach((m) => {
          const p = (agora - m.t) / VIDA_MS
          ctx.beginPath()
          ctx.arc(m.x, m.y, 3.2 * (1 - p) + 0.6, 0, Math.PI * 2)
          ctx.fillStyle = cor
          ctx.globalAlpha = (1 - p) * 0.55
          ctx.fill()
        })
      } else if (ms.length) {
        const x0 = Math.min(...ms.map((m) => m.x)) - RAIO, x1 = Math.max(...ms.map((m) => m.x)) + RAIO
        const y0 = Math.min(...ms.map((m) => m.y)) - RAIO, y1 = Math.max(...ms.map((m) => m.y)) + RAIO
        for (let gx = Math.max(PASSO / 2, Math.floor(x0 / PASSO) * PASSO + PASSO / 2); gx < Math.min(el.offsetWidth, x1); gx += PASSO) {
          for (let gy = Math.max(PASSO / 2, Math.floor(y0 / PASSO) * PASSO + PASSO / 2); gy < Math.min(el.offsetHeight, y1); gy += PASSO) {
            let k = 0
            for (const m of ms) {
              const d2 = (gx - m.x) ** 2 + (gy - m.y) ** 2
              if (d2 > RAIO * RAIO) continue
              k = Math.max(k, (1 - Math.sqrt(d2) / RAIO) * (1 - (agora - m.t) / VIDA_MS))
            }
            if (k < 0.04) continue
            ctx.beginPath()
            ctx.arc(gx, gy, 0.8 + 1.6 * k, 0, Math.PI * 2)
            ctx.fillStyle = cor
            ctx.globalAlpha = k * 0.75
            ctx.fill()
          }
        }
      }
      ctx.globalAlpha = 1
      quadro.current = marcas.current.length ? requestAnimationFrame(desenhar) : 0
    }

    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const k = r.width / (el.offsetWidth || r.width) || 1
      return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }
    }
    let ultimo = 0
    const mexeu = (e: PointerEvent) => {
      if (e.type === 'pointermove' && e.buttons === 0 && e.pointerType === 'mouse') return
      const agora = performance.now()
      if (forma === 'ondas' && e.type === 'pointermove' && agora - ultimo < 90) return
      ultimo = agora
      marcas.current.push({ ...local(e), t: agora })
      if (!quadro.current) quadro.current = requestAnimationFrame(desenhar)
    }
    el.addEventListener('pointerdown', mexeu)
    el.addEventListener('pointermove', mexeu)
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => {
      el.removeEventListener('pointerdown', mexeu)
      el.removeEventListener('pointermove', mexeu)
      ro.disconnect()
      cancelAnimationFrame(quadro.current)
      quadro.current = 0
    }
  }, [alvo, forma])

  return <canvas ref={canvas} className="k-rastro" aria-hidden="true" data-lab="35" />
}
