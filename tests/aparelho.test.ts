import { useSim } from '../src/sim/loja'
import { vibrar } from '../src/sim/vibrar'

beforeEach(() => useSim.getState().reiniciar())

test('parado sem a opção de painel, o celular só escurece', () => {
  useSim.getState().setOpcao('paradoViraPainel', false)
  useSim.getState().ficarOcioso()
  expect(useSim.getState().ocioso).toBe(true)
  useSim.getState().tocar()
  expect(useSim.getState().ocioso).toBe(false)
})

test('bateria fraca e calor avisam', () => {
  useSim.getState().setSaude('quente')
  expect(useSim.getState().saude).toBe('quente')
  expect(useSim.getState().aviso).toMatch(/quente/i)
})

test('mão, sensação e giro ficam guardados', () => {
  useSim.getState().setAjuste('mao', 'esquerda')
  useSim.getState().setAjuste('velocidade', 80)
  useSim.getState().setAjuste('girado', true)
  const a = useSim.getState().ajustes
  expect(a.mao).toBe('esquerda')
  expect(a.velocidade).toBe(80)
  expect(a.girado).toBe(true)
})

test('com a vibração desligada, o celular não vibra', () => {
  const v = vi.fn()
  Object.defineProperty(navigator, 'vibrate', { value: v, configurable: true })
  vibrar(10)
  expect(v).toHaveBeenCalledTimes(1)
  useSim.getState().setOpcao('vibracao', false)
  vibrar(10)
  expect(v).toHaveBeenCalledTimes(1)
})
