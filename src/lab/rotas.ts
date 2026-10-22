/* "Ir para a seção" do painel: monta o estado que a seção precisa e navega até ela. */
import type { PresetId } from '../sim/conexao'
import { nivelAtual, useSim } from '../sim/loja'
import type { TelaCelular, TelaPc } from '../sim/telas'

function garantirNivel(minimo: 1 | 2 | 3, preferido: PresetId = 'usb3') {
  const s = useSim.getState()
  if (nivelAtual(s.preset) < minimo) s.conectar(preferido)
}

function celular(t: TelaCelular, nivel: 1 | 2 | 3 = 1, pc: TelaPc = 'area') {
  const s = useSim.getState()
  s.travar(false)
  garantirNivel(nivel)
  s.irPara(t)
  s.irParaPc(pc)
}

const ROTAS: Record<string, () => void> = {
  '1': () => celular('trackpad'),
  '2': () => celular('trackpad'),
  '3': () => celular('trackpad'),
  '4': () => celular('atalhos'),
  '5': () => celular('espelho', 3),
  '6': () => { const s = useSim.getState(); s.travar(false); s.conectar('nenhuma'); s.irParaPc('pareamento') },
  '7': () => celular('trackpad'),
  '8': () => { garantirNivel(1); useSim.getState().irParaPc('central') },
  '9': () => celular('trackpad'),
  '10': () => celular('giro'),
  '11': () => celular('mixer', 2),
  '12': () => celular('trackpad'),
  '13': () => celular('trackpad'),
  '14': () => celular('teclado'),
  '15': () => celular('mesa'),
  '16': () => celular('midia', 2),
  '17': () => { celular('reuniao', 2); useSim.getState().focar('meet') },
  '19': () => celular('monitor', 3),
  '20': () => celular('janela', 3),
  '21': () => celular('vertical', 3),
  '22': () => celular('painel', 2),
  '23': () => { celular('trackpad'); useSim.getState().setOpcao('paradoViraPainel', true); useSim.getState().ficarOcioso() },
  '24': () => celular('transferencia'),
  '25': () => celular('camera', 3),
  '26': () => { useSim.getState().setOpcao('variosPcs', true); celular('computadores') },
  '27': () => celular('ajustes'),
  '28': () => { celular('trackpad'); useSim.getState().setSaude('bateria') },
  '18': () => { celular('trackpad'); useSim.getState().setOpcao('zonas', true) },
}

export function irParaSecao(n: string) {
  ROTAS[n]?.()
}
