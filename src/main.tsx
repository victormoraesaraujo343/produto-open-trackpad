import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design/fontes'
import './design/tokens.css'
import { definirIrPara, montarRefinamento } from './lab/refinamento'
import { irParaSecao } from './lab/rotas'
import App from './App'

document.documentElement.dataset.acabamento ??= 'escuro'
definirIrPara(irParaSecao)
montarRefinamento()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/* Só em dev: deixa o estado e as rotas do laboratório ao alcance dos testes de navegador. */
if (import.meta.env.DEV) Object.assign(window, { __otp: { useSim: (await import('./sim/loja')).useSim, irParaSecao } })
