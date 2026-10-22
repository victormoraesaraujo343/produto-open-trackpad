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
}

export function irParaSecao(n: string) {
  ROTAS[n]?.()
}
