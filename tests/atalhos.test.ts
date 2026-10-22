import { useSim } from '../src/sim/loja'

beforeEach(() => useSim.getState().reiniciar())

test('mover um atalho troca a posição dentro do perfil do app', () => {
  const [a, b] = useSim.getState().perfis.vscode
  useSim.getState().moverAtalho('vscode', 1, -1)
  expect(useSim.getState().perfis.vscode.slice(0, 2)).toEqual([b, a])
})

test('remover e adicionar atalhos num perfil', () => {
  useSim.getState().removerAtalho('figma', 'frame')
  expect(useSim.getState().perfis.figma).not.toContain('frame')
  useSim.getState().adicionarAtalho('figma', 'captura')
  expect(useSim.getState().perfis.figma.at(-1)).toBe('captura')
  useSim.getState().adicionarAtalho('figma', 'captura')
  expect(useSim.getState().perfis.figma.filter((x) => x === 'captura')).toHaveLength(1)
})

test('um atalho gravado entra na biblioteca e dispara com a combinação gravada', () => {
  const id = useSim.getState().criarAtalho('Exportar PDF', ['mod', 'Shift', 'E'])
  expect(useSim.getState().atalhosProprios[id].rotulo).toBe('Exportar PDF')
  useSim.getState().dispararAtalho(id)
  expect(useSim.getState().ultimoAtalho?.texto).toBe('Ctrl + Shift + E')
})
