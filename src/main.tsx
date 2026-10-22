import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design/fontes'
import './design/tokens.css'
import App from './App'

document.documentElement.dataset.acabamento ??= 'escuro'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
