import { useEffect, useState } from 'react'
import { Basculante } from '../../kit/Basculante'
import { Icone } from '../../kit/Icone'
import { useSim } from '../../sim/loja'

/* Celular como microfone do computador (seção 25). */
export function TelaMicrofone() {
  const emUso = useSim((s) => s.micEmUso)
  const [nivel, setNivel] = useState(0)
  useEffect(() => {
    if (!emUso) { setNivel(0); return }
    const t = setInterval(() => setNivel(0.15 + Math.random() * 0.75), 160)
    return () => clearInterval(t)
  }, [emUso])
  return (
    <div className="cel-microfone" data-lab="25">
      <div className="cel-mic-icone"><Icone nome="microfone" tamanho={40} /></div>
      <div className="cel-mic-nivel" role="meter" aria-label="Nível do microfone" aria-valuenow={Math.round(nivel * 100)} aria-valuemin={0} aria-valuemax={100}>
        {Array.from({ length: 20 }, (_, i) => <i key={i} className={i / 20 < nivel ? (i > 16 ? 'pico' : 'aceso') : ''} />)}
      </div>
      <div className="cel-linha-controle"><span>Microfone do computador</span><Basculante ligado={emUso} rotulo="Usar como microfone do computador" aoMudar={(v) => useSim.getState().usarMicrofone(v)} /></div>
    </div>
  )
}
