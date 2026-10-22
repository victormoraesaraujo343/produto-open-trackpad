import { useEffect, useRef, useState } from 'react'
import { Icone } from '../../kit/Icone'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'

const FRASE = 'A reunião de quinta foi remarcada para as dez horas.'

/* Ditado (seção 14): o celular só ouve; quem transcreve é o computador, com um modelo
   pequeno e local. O texto aparece no computador, palavra por palavra. */
export function TelaVoz() {
  const [ouvindo, setOuvindo] = useState(false)
  const [nivel, setNivel] = useState(0)
  const relogio = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    if (!ouvindo) { setNivel(0); return }
    const palavras = FRASE.split(' ')
    let i = 0
    relogio.current = setInterval(() => {
      setNivel(0.3 + Math.random() * 0.7)
      if (i < palavras.length) { useSim.getState().digitar((i ? ' ' : '') + palavras[i]); i++ }
      else { setOuvindo(false) }
    }, 320)
    return () => clearInterval(relogio.current)
  }, [ouvindo])

  return (
    <div className="cel-voz" data-lab="14">
      <button type="button" className={`cel-voz-botao${ouvindo ? ' k-ligada' : ''}`} aria-pressed={ouvindo}
        aria-label={ouvindo ? 'Parar de ouvir' : 'Começar a ditar'} onClick={() => { setOuvindo(!ouvindo); vibrar(10) }}>
        <Icone nome="microfone" tamanho={34} />
      </button>
      <div className="cel-voz-nivel" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => <i key={i} style={{ height: `${8 + Math.abs(Math.sin(i * 1.7 + nivel * 6)) * 40 * nivel}px` }} />)}
      </div>
      <p className="cel-voz-estado" role="status">{ouvindo ? 'Ouvindo. O texto aparece no computador.' : 'Toque para ditar'}</p>
    </div>
  )
}
