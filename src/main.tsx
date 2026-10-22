import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design/fontes'
import './design/tokens.css'
import { montarRefinamento } from './lab/refinamento'
import App from './App'

document.documentElement.dataset.acabamento ??= 'escuro'
montarRefinamento()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
