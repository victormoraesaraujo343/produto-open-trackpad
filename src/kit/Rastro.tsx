import { useEffect, useRef } from 'react'

const VIDA_MS = 700
const PASSO = 14
const RAIO = 64

interface Marca { x: number; y: number; t: number }

/* Rastro no trackpad (issue #4, seção 35): uma grade de pontos sempre visível que acende na
   cor de destaque em volta do dedo e volta com fade. O ponto cresce quanto mais perto do dedo.
   Opcional (Ajustes); com "reduzir movimento" a grade fica parada. Canvas por cima, sem pegar toque. */
export function Rastro({ alvo }: { alvo: React.RefObject<HTMLElement | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const marcas = useRef<Marca[]>([])
  const quadro = useRef(0)

  useEffect(() => {
    const el = alvo.current
    const c = canvas.current
    if (!el || !c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const estilo = getComputedStyle(el)
    const base = estilo.getPropertyValue('--pad-ink').trim() || '#8F9295'
    const destaque = estilo.getPropertyValue('--laranja').trim() || '#FF4F1F'
    const parado = matchMedia('(prefers-reduced-motion: reduce)').matches

    const medir = () => {
      const dpr = window.devicePixelRatio || 1
      c.width = el.offsetWidth * dpr
      c.height = el.offsetHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      desenhar()
    }

    function desenhar() {
      const agora = performance.now()
      marcas.current = marcas.current.filter((m) => agora - m.t < VIDA_MS)
      const ms = marcas.current
      const w = el!.offsetWidth, h = el!.offsetHeight
      ctx!.clearRect(0, 0, w, h)
      for (let gx = PASSO / 2; gx < w; gx += PASSO) {
        for (let gy = PASSO / 2; gy < h; gy += PASSO) {
          let k = 0
          for (const m of ms) {
            const d2 = (gx - m.x) ** 2 + (gy - m.y) ** 2
            if (d2 > RAIO * RAIO) continue
            k = Math.max(k, (1 - Math.sqrt(d2) / RAIO) * (1 - (agora - m.t) / VIDA_MS))
          }
          const r = 1 + 1.9 * k
          ctx!.beginPath()
          ctx!.arc(gx, gy, r, 0, Math.PI * 2)
          ctx!.fillStyle = k > 0.04 ? destaque : base
          ctx!.globalAlpha = k > 0.04 ? 0.25 + 0.7 * k : 0.22
          ctx!.fill()
        }
      }
      ctx!.globalAlpha = 1
      quadro.current = ms.length ? requestAnimationFrame(desenhar) : 0
    }
    medir()

    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const k = r.width / (el.offsetWidth || r.width) || 1
      return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }
    }
    const mexeu = (e: PointerEvent) => {
      if (e.type === 'pointermove' && e.buttons === 0 && e.pointerType === 'mouse') return
      marcas.current.push({ ...local(e), t: performance.now() })
      if (!quadro.current) quadro.current = requestAnimationFrame(desenhar)
    }
    if (!parado) {
      el.addEventListener('pointerdown', mexeu)
      el.addEventListener('pointermove', mexeu)
    }
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => {
      el.removeEventListener('pointerdown', mexeu)
      el.removeEventListener('pointermove', mexeu)
      ro.disconnect()
      cancelAnimationFrame(quadro.current)
      quadro.current = 0
    }
  }, [alvo])

  return <canvas ref={canvas} className="k-rastro" aria-hidden="true" data-lab="35" />
}
