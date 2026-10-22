import { useEffect, useState } from 'react'
import { FAIXA } from '../../dados/audio'
import { Icone } from '../../kit/Icone'
import { Tecla } from '../../kit/Tecla'
import { useSim } from '../../sim/loja'

const tempo = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/* Mídia com a capa do que está tocando (seção 16). */
export function TelaMidia() {
  const [tocando, setTocando] = useState(true)
  const [pos, setPos] = useState(FAIXA.posicao)
  const curtido = useSim((s) => !!s.ligados.curtir)
  const { dispararAtalho } = useSim.getState()
  useEffect(() => {
    if (!tocando) return
    const t = setInterval(() => setPos((p) => (p + 1) % FAIXA.duracao), 1000)
    return () => clearInterval(t)
  }, [tocando])
  return (
    <div className="cel-midia" data-lab="16">
      <div className="cel-capa" aria-hidden="true"><span>{FAIXA.album}</span></div>
      <div className="cel-midia-info">
        <div>
          <h2>{FAIXA.titulo}</h2>
          <p>{FAIXA.artista} · {FAIXA.album}</p>
        </div>
        <div className="cel-progresso-faixa" role="progressbar" aria-label="Posição na faixa" aria-valuemin={0} aria-valuemax={FAIXA.duracao} aria-valuenow={pos}>
          <span className="cel-trilho-faixa"><i style={{ width: `${(pos / FAIXA.duracao) * 100}%` }} /></span>
          <span className="cel-tempos"><span>{tempo(pos)}</span><span>{tempo(FAIXA.duracao)}</span></span>
        </div>
        <div className="cel-midia-botoes">
          <Tecla rotulo="Anterior" mostrarRotulo={false} aoTocar={() => { setPos(0); useSim.getState().mostrarNoPc('Faixa anterior') }}><span className="cel-espelhar"><Icone nome="proxima" /></span></Tecla>
          <Tecla rotulo={tocando ? 'Pausar' : 'Tocar'} ligada={tocando} mostrarRotulo={false} aoTocar={() => { setTocando(!tocando); dispararAtalho('play') }}>
            <Icone nome={tocando ? 'pausa' : 'play'} tamanho={26} />
          </Tecla>
          <Tecla rotulo="Próxima" icone="proxima" mostrarRotulo={false} aoTocar={() => { setPos(0); dispararAtalho('proxima') }} />
          <Tecla rotulo={curtido ? 'Curtida' : 'Curtir'} icone="curtir" ligada={curtido} led={curtido} mostrarRotulo={false} aoTocar={() => useSim.setState((s) => ({ ligados: { ...s.ligados, curtir: !s.ligados.curtir } }))} />
        </div>
      </div>
    </div>
  )
}
