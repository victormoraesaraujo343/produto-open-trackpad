import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Camada } from '../src/kit/Camada'
import { Disco } from '../src/kit/Disco'
import { Tecla } from '../src/kit/Tecla'
import { Trilho } from '../src/kit/Trilho'

test('Camada bloqueia toques', async () => {
  const tecla = vi.fn()
  render(
    <div>
      <Tecla rotulo="copiar" aoTocar={tecla} />
      <Camada aberta aoFechar={() => {}}><p>painel</p></Camada>
    </div>,
  )
  await userEvent.click(screen.getByText('copiar')).catch(() => {})
  expect(tecla).not.toHaveBeenCalled()
})

test('Camada deixa tocar dentro dela', async () => {
  const dentro = vi.fn()
  render(<div><Camada aberta aoFechar={() => {}}><button type="button" onClick={dentro}>ok</button></Camada></div>)
  await userEvent.click(screen.getByText('ok'))
  expect(dentro).toHaveBeenCalledOnce()
})

test('Trilho mantém cinco posições', () => {
  const { container } = render(<Trilho lado="direita"><Tecla rotulo="a" aoTocar={() => {}} /></Trilho>)
  expect(container.querySelectorAll('[data-posicao]')).toHaveLength(5)
})

test('Disco devolve passos inteiros', () => {
  const aoMudar = vi.fn()
  render(<Disco valor={0} aoMudar={aoMudar} passos={40} />)
  const disco = screen.getByRole('slider')
  fireEvent.pointerDown(disco, { clientX: 100, clientY: 0, pointerId: 1 })
  fireEvent.pointerMove(disco, { clientX: 71, clientY: 71, pointerId: 1 })
  fireEvent.pointerMove(disco, { clientX: 0, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(disco, { pointerId: 1 })
  expect(aoMudar).toHaveBeenLastCalledWith(10)
})
