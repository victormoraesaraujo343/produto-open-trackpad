import { PRESETS, qualidadeDe } from '../src/sim/conexao'
import { mostrarDescanso, useSim } from '../src/sim/loja'
import { TELAS_CELULAR, type TelaCelular } from '../src/sim/telas'

beforeEach(() => useSim.getState().reiniciar())

test('a qualidade da imagem acompanha a conexão', () => {
  expect(qualidadeDe(PRESETS.usb3)).toBe('alta')
  expect(qualidadeDe(PRESETS.wifi6)).toBe('alta')
  expect(qualidadeDe(PRESETS.roteador)).toBe('média')
})

test('toda tela pesada volta ao trackpad quando a conexão piora', () => {
  const pesadas = (Object.keys(TELAS_CELULAR) as TelaCelular[]).filter((t) => TELAS_CELULAR[t].nivel === 3)
  expect(pesadas).toEqual(expect.arrayContaining(['espelho', 'monitor', 'janela', 'recorte', 'vertical']))
  for (const t of pesadas) {
    useSim.getState().conectar('usb3')
    useSim.getState().irPara(t)
    expect(useSim.getState().tela).toBe(t)
    useSim.getState().conectar('wifi4')
    expect(useSim.getState().tela).toBe('trackpad')
  }
})

test('monitor vertical põe o celular em pé e sair deita de novo', () => {
  useSim.getState().irPara('vertical')
  expect(useSim.getState().orientacao).toBe('empe')
  useSim.getState().irPara('trackpad')
  expect(useSim.getState().orientacao).toBe('deitado')
})

test('parado vira painel só com a opção ligada', () => {
  useSim.getState().ficarOcioso()
  expect(mostrarDescanso(useSim.getState())).toBe(true)
  useSim.getState().setOpcao('paradoViraPainel', false)
  expect(mostrarDescanso(useSim.getState())).toBe(false)
  useSim.getState().setOpcao('paradoViraPainel', true)
  useSim.getState().tocar()
  expect(mostrarDescanso(useSim.getState())).toBe(false)
})
