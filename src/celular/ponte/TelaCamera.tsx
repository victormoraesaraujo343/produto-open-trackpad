import { useState } from 'react'
import { Basculante } from '../../kit/Basculante'
import { Led } from '../../kit/Led'
import { Segmentos } from '../../kit/Segmentos'
import { useSim } from '../../sim/loja'

/* Celular como webcam (seção 25). O celular só envia o vídeo; o computador o mostra como
   uma câmera a mais, para qualquer app de chamada. */
export function TelaCamera() {
  const emUso = useSim((s) => s.cameraEmUso)
  const [lente, setLente] = useState<'traseira' | 'frontal'>('traseira')
  return (
    <div className="cel-camera" data-lab="25">
      <div className={`cel-camera-imagem cel-lente-${lente}`} role="img" aria-label={emUso ? `Imagem da câmera ${lente}` : 'Câmera desligada'}>
        {!emUso && <span>Câmera desligada</span>}
        {emUso && <span className="cel-camera-em-uso"><Led aceso cor="laranja" />No ar</span>}
      </div>
      <div className="cel-camera-controles">
        <div className="cel-linha-controle"><span>Usar como câmera do computador</span><Basculante ligado={emUso} rotulo="Usar como câmera do computador" aoMudar={(v) => useSim.getState().usarCamera(v)} /></div>
        <div className="cel-linha-controle"><span>Lente</span><Segmentos rotulo="Lente" valor={lente} opcoes={[['traseira', 'Traseira'], ['frontal', 'Frontal']]} aoMudar={setLente} /></div>
        <p className="cel-nota">{emUso ? 'Aparece como “Câmera do OpenTrackpad” no Meet, no Discord e no OBS.' : 'Ligue para aparecer como câmera nos apps de chamada.'}</p>
      </div>
    </div>
  )
}
