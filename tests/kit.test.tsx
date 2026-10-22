import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Camada } from '../src/kit/Camada'
import { Tecla } from '../src/kit/Tecla'

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
