import { Tecla } from '../../kit/Tecla'
import { useSim } from '../../sim/loja'
import { JanelaEmPe } from './Conteudos'

/* Monitor vertical (seção 21): o celular fica em pé e mostra uma janela comprida. */
export function TelaVertical() {
  return (
    <div className="cel-vertical" data-lab="21">
      <div className="cel-vertical-imagem"><JanelaEmPe /></div>
      <div className="cel-vertical-barra">
        <Tecla rotulo="Deitar o celular" icone="trackpad" aoTocar={() => useSim.getState().irPara('trackpad')} />
      </div>
    </div>
  )
}
