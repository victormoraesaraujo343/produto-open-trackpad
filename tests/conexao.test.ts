import { PRESETS, liberado, nivelDe } from '../src/sim/conexao'

test('cada preset cai no nível esperado', () => {
  expect(nivelDe(PRESETS.usb3)).toBe(3)
  expect(nivelDe(PRESETS.wifi6)).toBe(3)
  expect(nivelDe(PRESETS.roteador)).toBe(3)
  expect(nivelDe(PRESETS.usb2)).toBe(2)
  expect(nivelDe(PRESETS.wifi4)).toBe(2)
  expect(nivelDe(PRESETS.congestionado)).toBe(1)
  expect(nivelDe(PRESETS.nenhuma)).toBe(0)
})

test('liberado compara nível exigido com o atual', () => {
  expect(liberado(3, 2)).toBe(false)
  expect(liberado(1, 1)).toBe(true)
  expect(liberado(1, 0)).toBe(false)
})
