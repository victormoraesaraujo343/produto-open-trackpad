import { SECOES } from '../src/lab/secoes'
import { irParaSecao } from '../src/lab/rotas'
import { PRESETS, nivelDe } from '../src/sim/conexao'
import { useSim } from '../src/sim/loja'

beforeEach(() => useSim.getState().reiniciar())

test('ir para a tela espelhada liga uma conexão que aguenta', () => {
  useSim.getState().conectar('congestionado')
  irParaSecao('5')
  expect(nivelDe(PRESETS[useSim.getState().preset])).toBe(3)
  expect(useSim.getState().tela).toBe('espelho')
})

test('ir para o pareamento desconecta e abre o pareamento no computador', () => {
  irParaSecao('6')
  expect(useSim.getState().tela).toBe('conexao')
  expect(useSim.getState().telaPc).toBe('pareamento')
})

test('toda seção tem rota', () => {
  for (const s of SECOES) expect(() => irParaSecao(s.n)).not.toThrow()
})
