import { useSim } from '../src/sim/loja'

beforeEach(() => useSim.getState().reiniciar())

test('conectar rebaixa a tela que a conexão não aguenta', () => {
  useSim.getState().conectar('usb3')
  useSim.getState().irPara('espelho')
  expect(useSim.getState().tela).toBe('espelho')
  useSim.getState().conectar('congestionado')
  expect(useSim.getState().tela).toBe('trackpad')
  expect(useSim.getState().aviso).toMatch(/conexão/i)
})

test('irPara recusa tela acima do nível atual', () => {
  useSim.getState().conectar('wifi4')
  useSim.getState().irPara('espelho')
  expect(useSim.getState().tela).toBe('trackpad')
})

test('o cursor fica dentro da tela', () => {
  useSim.getState().moverCursor(5, -5)
  expect(useSim.getState().cursor).toEqual({ x: 1, y: 0 })
})

test('desconectar mostra a tela de conexão', () => {
  useSim.getState().conectar('nenhuma')
  expect(useSim.getState().tela).toBe('conexao')
})

test('reconectar sai da tela de conexão para o trackpad', () => {
  useSim.getState().conectar('nenhuma')
  useSim.getState().conectar('wifi6')
  expect(useSim.getState().tela).toBe('trackpad')
})
