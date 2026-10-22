import { useEffect, useState } from 'react'
import { DesktopFalso } from '../bancada/DesktopFalso'
import { useSim } from '../sim/loja'
import { Central } from './Central'
import { Pareamento } from './Pareamento'
import './computador.css'

function useRecente(em: number | undefined, ms: number) {
  const [vivo, setVivo] = useState(false)
  useEffect(() => {
    if (!em) return
    setVivo(true)
    const t = setTimeout(() => setVivo(false), ms)
    return () => clearTimeout(t)
  }, [em, ms])
  return vivo
}

/* O computador falso da bancada: área de trabalho, o app do OpenTrackpad e o que o celular
   provoca nele (atalho enviado, volume, teclas presas). */
export function Computador() {
  const telaPc = useSim((s) => s.telaPc)
  const atalho = useSim((s) => s.ultimoAtalho)
  const volume = useSim((s) => s.volume)
  const osd = useSim((s) => s.osdVolume)
  const presas = useSim((s) => s.teclasPresas)
  const cursor = useSim((s) => s.cursor)
  const camera = useSim((s) => s.cameraEmUso)
  const mic = useSim((s) => s.micEmUso)
  const mostraAtalho = useRecente(atalho?.em, 1300)
  const mostraVolume = useRecente(osd || undefined, 1500)
  return (
    <div className="pc">
      <DesktopFalso />
      <div className="pc-janelas">
        {telaPc === 'central' && <Central />}
        {telaPc === 'pareamento' && <Pareamento />}
      </div>
      {(camera || mic) && (
        <div className="pc-em-uso" role="status">
          {camera && <span><i />Câmera do OpenTrackpad em uso</span>}
          {mic && <span><i />Microfone do OpenTrackpad em uso</span>}
        </div>
      )}
      {presas.length > 0 && (
        <div className="pc-presas" style={{ left: `calc(${cursor.x * 100}% + 18px)`, top: `calc(${cursor.y * 100}% + 18px)` }}>{presas.join(' + ')}</div>
      )}
      {mostraAtalho && atalho && <div className="pc-hud" role="status">{atalho.texto}</div>}
      {mostraVolume && (
        <div className="pc-osd" role="status" aria-label={`Volume ${volume}%`}>
          <span>Volume</span><span className="pc-osd-barra"><i style={{ width: `${volume}%` }} /></span><b>{volume}%</b>
        </div>
      )}
    </div>
  )
}
