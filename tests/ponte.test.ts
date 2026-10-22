import { useSim } from '../src/sim/loja'

beforeEach(() => useSim.getState().reiniciar())

test('trocar o cabo pelo Wi-Fi mantém a tela e avisa que nada caiu', () => {
  useSim.getState().conectar('usb3')
  useSim.getState().irPara('espelho')
  useSim.getState().conectar('wifi6')
  expect(useSim.getState().tela).toBe('espelho')
  expect(useSim.getState().aviso).toMatch(/Wi-Fi 6/)
})

test('copiar no computador aparece primeiro na área de transferência', () => {
  useSim.getState().copiar('https://opentrackpad.dev', 'computador')
  useSim.getState().copiar('Lista de compras', 'celular')
  const [ultimo, anterior] = useSim.getState().transferencia
  expect(ultimo.texto).toBe('Lista de compras')
  expect(ultimo.origem).toBe('celular')
  expect(anterior.origem).toBe('computador')
})

test('cada computador guarda o seu app em foco', () => {
  useSim.getState().focar('figma')
  useSim.getState().trocarComputador('c3')
  expect(useSim.getState().computador).toBe('c3')
  expect(useSim.getState().appEmFoco).toBe('area')
  useSim.getState().trocarComputador('c1')
  expect(useSim.getState().appEmFoco).toBe('figma')
})

test('câmera e microfone do celular ligam e desligam', () => {
  useSim.getState().usarCamera(true)
  useSim.getState().usarMicrofone(true)
  expect(useSim.getState().cameraEmUso).toBe(true)
  expect(useSim.getState().micEmUso).toBe(true)
  useSim.getState().conectar('nenhuma')
  expect(useSim.getState().cameraEmUso).toBe(false)
})
