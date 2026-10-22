import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import laboratorio from './laboratorio/plugin-vite.mjs'

export default defineConfig({
  plugins: [react(), laboratorio()],
})
