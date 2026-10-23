/* "Ir para a seção" do painel: monta o estado que a seção precisa e navega até ela. */
import type { PresetId } from '../sim/conexao'
import { nivelAtual, useSim } from '../sim/loja'
import type { TelaCelular, TelaPc } from '../sim/telas'

function garantirNivel(minimo: 1 | 2 | 3, preferido: PresetId = 'usb3') {
  const s = useSim.getState()
  if (nivelAtual(s.preset) < minimo) s.conectar(preferido)
}

/* Cada rota começa limpa: o que outra seção deixou ligado (bateria fraca, parado, zonas…) volta ao normal. */
function limpar() {
  const s = useSim.getState()
  useSim.setState({ saude: 'ok', ocioso: false, travado: false, opcoes: { ...s.opcoes, cantoClica: false, bordaRola: false, paradoViraPainel: true } })
}

function celular(t: TelaCelular, nivel: 1 | 2 | 3 = 1, pc: TelaPc = 'area') {
  limpar()
  const s = useSim.getState()
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
  '6': () => { limpar(); const s = useSim.getState(); s.conectar('nenhuma'); s.irParaPc('pareamento') },
  '7': () => celular('trackpad'),
  '8': () => { limpar(); garantirNivel(1); useSim.getState().irParaPc('central') },
  '9': () => celular('trackpad'),
  '10': () => celular('giro'),
  '11': () => celular('mixer', 2),
  '12': () => celular('trackpad'),
  '13': () => { celular('trackpad'); useSim.getState().travar(true) },
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
  '28': () => { celular('trackpad'); const s = useSim.getState(); s.setSaude('bateria'); s.setOpcao('paradoViraPainel', false); s.ficarOcioso() },
  '29': () => { garantirNivel(1); useSim.getState().irParaPc('bandeja') },
  '30': () => { garantirNivel(1); useSim.getState().setSecaoCentral('atalhos'); useSim.getState().irParaPc('central') },
  '31': () => useSim.getState().irParaPc('assistente'),
  '32': () => { garantirNivel(1); useSim.getState().irParaPc('gravador') },
  '33': () => { limpar(); garantirNivel(1); useSim.getState().setSecaoCentral('laterais'); useSim.getState().irParaPc('central'); celular('trackpad', 1, 'central') },
  '34': () => celular('ajustes'),
  '35': () => { celular('trackpad'); useSim.getState().setOpcao('rastro', true) },
  '36': () => celular('recursos', 2),
  '18': () => { celular('trackpad'); useSim.getState().setOpcao('cantoClica', true); useSim.getState().setOpcao('bordaRola', true) },
}

export function irParaSecao(n: string) {
  ROTAS[n]?.()
}
