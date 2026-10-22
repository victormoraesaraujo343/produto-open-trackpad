import { useSim } from '../src/sim/loja'

beforeEach(() => useSim.getState().reiniciar())

test('cada app tem as suas duas laterais; a direita começa com o sistema', () => {
  const l = useSim.getState().laterais.figma
  expect(l.esquerda).toHaveLength(5)
  expect(l.direita).toEqual(['cliqueDireito', 'presa:Ctrl', 'presa:Shift'])
})

test('trocar uma tecla de uma lateral só mexe naquele app e naquela posição', () => {
  useSim.getState().trocarNaLateral('figma', 'direita', 1, 'presa:Alt')
  expect(useSim.getState().laterais.figma.direita).toEqual(['cliqueDireito', 'presa:Alt', 'presa:Shift'])
  expect(useSim.getState().laterais.vscode.direita[1]).toBe('presa:Ctrl')
  useSim.getState().trocarNaLateral('figma', 'esquerda', 0, 'captura')
  expect(useSim.getState().laterais.figma.esquerda[0]).toBe('captura')
})

test('blocos do painel de informações: liga, desliga e muda de ordem', () => {
  expect(useSim.getState().blocosPainel.map((b) => b.id)).toEqual(['hora', 'maquina', 'reuniao', 'notificacoes', 'musica', 'rede'])
  useSim.getState().alternarBloco('painel', 'musica')
  expect(useSim.getState().blocosPainel.find((b) => b.id === 'musica')?.ligado).toBe(true)
  useSim.getState().moverBloco('painel', 'reuniao', -1)
  expect(useSim.getState().blocosPainel.map((b) => b.id).slice(0, 3)).toEqual(['hora', 'reuniao', 'maquina'])
})

test('a tela de descanso tem o seu jeito e os seus blocos', () => {
  expect(useSim.getState().descanso.jeito).toBe('relogio')
  useSim.getState().setJeitoDescanso('foto')
  expect(useSim.getState().descanso.jeito).toBe('foto')
  useSim.getState().alternarBloco('descanso', 'reuniao')
  expect(useSim.getState().descanso.blocos.find((b) => b.id === 'reuniao')?.ligado).toBe(true)
})
