import { fireEvent, render } from '@testing-library/react'
import { SuperficieTrackpad } from '../src/kit/SuperficieTrackpad'
import { useSim } from '../src/sim/loja'

beforeEach(() => useSim.getState().reiniciar())

test('piorar a conexão desliga a câmera e o microfone que ela não aguenta', () => {
  useSim.getState().usarCamera(true)
  useSim.getState().usarMicrofone(true)
  useSim.getState().conectar('wifi4')
  expect(useSim.getState().cameraEmUso).toBe(false)
  expect(useSim.getState().micEmUso).toBe(true)
  useSim.getState().conectar('congestionado')
  expect(useSim.getState().micEmUso).toBe(false)
})

test('desconectar no monitor vertical deita o celular de novo', () => {
  useSim.getState().irPara('vertical')
  useSim.getState().conectar('nenhuma')
  expect(useSim.getState().orientacao).toBe('deitado')
})

test('travado continua navegando dentro do app', () => {
  useSim.getState().travar(true)
  useSim.getState().irPara('atalhos')
  expect(useSim.getState().tela).toBe('atalhos')
})

test('toque rápido com dois dedos de verdade faz clique direito', () => {
  const { container } = render(<SuperficieTrackpad />)
  const s = container.querySelector('.k-superficie')!
  fireEvent.pointerDown(s, { pointerId: 1, clientX: 100, clientY: 100 })
  fireEvent.pointerDown(s, { pointerId: 2, clientX: 140, clientY: 100 })
  fireEvent.pointerUp(s, { pointerId: 1, clientX: 100, clientY: 100 })
  fireEvent.pointerUp(s, { pointerId: 2, clientX: 140, clientY: 100 })
  expect(useSim.getState().ultimoAtalho?.texto).toBe('Clique direito')
})
