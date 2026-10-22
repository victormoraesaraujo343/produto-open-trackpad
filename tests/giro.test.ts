import { criarGiro } from '../src/sim/giro'

test('um quarto de volta com 40 passos anda 10', () => {
  const g = criarGiro(40)
  g.comecar(0)
  g.mover(45)
  expect(g.mover(90)).toBe(10)
})

test('girar para trás devolve passos negativos e atravessa 180°', () => {
  const g = criarGiro(40)
  g.comecar(170)
  expect(g.mover(-170)).toBe(2) // 170 → 190 (= -170): 20° à frente
  const h = criarGiro(40)
  h.comecar(0)
  expect(h.mover(-45)).toBe(-5)
})
