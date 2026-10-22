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

test('prender e soltar uma tecla', () => {
  useSim.getState().alternarPresa('Ctrl')
  expect(useSim.getState().teclasPresas).toEqual(['Ctrl'])
  useSim.getState().alternarPresa('Ctrl')
  expect(useSim.getState().teclasPresas).toEqual([])
})

test('desconectar solta as teclas presas', () => {
  useSim.getState().alternarPresa('Shift')
  useSim.getState().conectar('nenhuma')
  expect(useSim.getState().teclasPresas).toEqual([])
})

test('volume fica entre 0 e 100 e mostra o aviso no computador', () => {
  useSim.getState().mudarVolume(500)
  expect(useSim.getState().volume).toBe(100)
  expect(useSim.getState().osdVolume).toBeGreaterThan(0)
  useSim.getState().mudarVolume(-500)
  expect(useSim.getState().volume).toBe(0)
})

test('travado não deixa trocar de tela', () => {
  useSim.getState().travar(true)
  useSim.getState().irPara('atalhos')
  expect(useSim.getState().tela).toBe('trackpad')
  useSim.getState().travar(false)
  useSim.getState().irPara('atalhos')
  expect(useSim.getState().tela).toBe('atalhos')
})

test('disparar um atalho mostra a combinação do sistema no computador', () => {
  useSim.getState().dispararAtalho('copiar')
  expect(useSim.getState().ultimoAtalho?.texto).toBe('Ctrl + C')
  useSim.getState().setSistema('macos')
  useSim.getState().dispararAtalho('copiar')
  expect(useSim.getState().ultimoAtalho?.texto).toBe('⌘ + C')
})

test('atalhos de liga e desliga guardam o estado', () => {
  expect(useSim.getState().ligados.mudo).toBeFalsy()
  useSim.getState().dispararAtalho('mudo')
  expect(useSim.getState().ligados.mudo).toBe(true)
  useSim.getState().dispararAtalho('mudo')
  expect(useSim.getState().ligados.mudo).toBe(false)
})

test('digitar e apagar mandam texto para o computador', () => {
  useSim.getState().digitar('Olá')
  useSim.getState().digitar(' mundo')
  expect(useSim.getState().textoDigitado).toBe('Olá mundo')
  useSim.getState().apagar()
  expect(useSim.getState().textoDigitado).toBe('Olá mund')
})

test('opções ligam e desligam', () => {
  expect(useSim.getState().opcoes.zonas).toBe(false)
  useSim.getState().setOpcao('zonas', true)
  expect(useSim.getState().opcoes.zonas).toBe(true)
})

test('desenhar guarda traços e limpar apaga', () => {
  useSim.getState().desenhar([{ x: 0.1, y: 0.1, p: 0.5 }, { x: 0.2, y: 0.2, p: 0.5 }])
  expect(useSim.getState().tracos).toHaveLength(1)
  useSim.getState().limparDesenho()
  expect(useSim.getState().tracos).toHaveLength(0)
})

test('trocar para uma janela põe o app dela em foco', () => {
  useSim.getState().trocarParaJanela('j5')
  expect(useSim.getState().appEmFoco).toBe('meet')
})
