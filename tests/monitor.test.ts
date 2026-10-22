import { passoTelemetria, TELEMETRIA_INICIAL } from '../src/sim/telemetria'
import { useSim } from '../src/sim/loja'

beforeEach(() => useSim.getState().reiniciar())

test('a vista começa na padrão e troca', () => {
  expect(useSim.getState().monitor.vista).toBe('padrao')
  useSim.getState().setVistaMonitor('avancada')
  expect(useSim.getState().monitor.vista).toBe('avancada')
})

test('na avançada dá para adicionar, configurar, mover e tirar blocos', () => {
  const s = () => useSim.getState()
  const antes = s().monitor.blocos.length
  const id = s().adicionarBlocoMonitor()
  expect(s().monitor.blocos).toHaveLength(antes + 1)
  s().configurarBlocoMonitor(id, { metrica: 'gpu', estilo: 'ponteiro', largura: 2 })
  expect(s().monitor.blocos.at(-1)).toMatchObject({ id, metrica: 'gpu', estilo: 'ponteiro', largura: 2 })
  s().moverBlocoMonitor(id, 0)
  expect(s().monitor.blocos[0].id).toBe(id)
  s().removerBlocoMonitor(id)
  expect(s().monitor.blocos.find((b) => b.id === id)).toBeUndefined()
})

test('a telemetria anda dentro dos limites e guarda o histórico', () => {
  let t = TELEMETRIA_INICIAL
  for (let i = 0; i < 100; i++) t = passoTelemetria(t, () => (i % 2 ? 0.99 : 0.01))
  for (const m of Object.values(t)) {
    expect(m.valor).toBeGreaterThanOrEqual(0)
    expect(m.valor).toBeLessThanOrEqual(100)
    expect(m.historico.length).toBeLessThanOrEqual(40)
  }
})
