import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { defineConfig } from '@playwright/test'

/* Usa o Chromium que já estiver na máquina, se a versão do Playwright não tiver o seu baixado. */
const local = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  use: { baseURL: 'http://localhost:5173', launchOptions: existsSync(local) ? { executablePath: local } : {} },
  webServer: { command: 'npm run lab -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
})
