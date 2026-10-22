import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Camada } from '../src/kit/Camada'
import { Lateral } from '../src/kit/Lateral'
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

test('Lateral mantém cinco posições, mesmo com menos teclas', () => {
  const { container } = render(<Lateral lado="direita" rotulo="Sistema"><Tecla rotulo="a" aoTocar={() => {}} /></Lateral>)
  expect(container.querySelectorAll('[data-posicao]')).toHaveLength(5)
})

test('Lateral dupla tem dez posições', () => {
  const { container } = render(<Lateral lado="direita" rotulo="Tudo" colunas={2} />)
  expect(container.querySelectorAll('[data-posicao]')).toHaveLength(10)
})

test('Lateral mostra a cabeça acima das posições', () => {
  render(<Lateral lado="direita" rotulo="Sistema" cabeca={<span>Cabo USB 3</span>} />)
  expect(screen.getByText('Cabo USB 3')).toBeInTheDocument()
})
