import { useLayoutEffect, useState, type RefObject } from 'react'
import type { Medida } from './escala'

/* Tamanho atual de um elemento, atualizado quando ele muda. */
export function useTamanho(ref: RefObject<HTMLElement | null>): Medida {
  const [m, setM] = useState<Medida>({ largura: 0, altura: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setM({ largura: el.clientWidth, altura: el.clientHeight })
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return m
}
