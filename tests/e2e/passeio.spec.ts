import { expect, test, type Page } from '@playwright/test'
import { SECOES } from '../../src/lab/secoes'

/* Seções que só existem no computador: na tela estreita a bancada mostra só o celular. */
const SO_NO_COMPUTADOR = new Set(['8', '29', '30', '31', '32'])
const LARGURAS = [
  { nome: 'larga', width: 1440, height: 900 },
  { nome: 'celular em pé', width: 390, height: 844 },
  { nome: 'estreita', width: 320, height: 640 },
]

async function preparar(page: Page, erros: string[]) {
  // nunca gravar nas anotações reais do laboratório
  await page.route('**/__lab/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  page.on('pageerror', (e) => erros.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
}

for (const l of LARGURAS) {
  for (const s of SECOES) {
    if (l.width < 900 && SO_NO_COMPUTADOR.has(s.n)) continue
    test(`${l.nome} · seção ${s.n} · ${s.nome}`, async ({ page }) => {
      const erros: string[] = []
      await preparar(page, erros)
      await page.setViewportSize({ width: l.width, height: l.height })
      await page.goto('/')
      await page.waitForFunction(() => 'otp' in window || '__otp' in window)
      await page.evaluate((n) => (window as unknown as { __otp: { irParaSecao: (n: string) => void } }).__otp.irParaSecao(n), s.n)
      await page.waitForTimeout(350)
      const visivel = await page.evaluate((n) => [...document.querySelectorAll(`[data-lab="${n}"]`)].some((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
      }), s.n)
      expect(visivel, `[data-lab="${s.n}"] visível`).toBe(true)
      const transborda = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(transborda, 'rolagem horizontal').toBeLessThanOrEqual(0)
      expect(erros).toEqual([])
    })
  }
}

test('celular de verdade, deitado: /celular ocupa a tela sem rolar', async ({ page }) => {
  const erros: string[] = []
  await preparar(page, erros)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/celular')
  await expect(page.locator('[data-tela-celular]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  expect(erros).toEqual([])
})

test('celular em pé fora do monitor vertical pede para virar', async ({ page }) => {
  await page.route('**/__lab/**', (r) => r.fulfill({ status: 200, body: '{}' }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/celular')
  await expect(page.getByText('Vire o celular')).toBeVisible()
})

/* Toda variação de toda seção abre sem erro e sem rolagem lateral (forçada por ?v=, sem tocar
   nas anotações). */
import { VARIANTES } from '../../src/lab/secoes'
for (const [chave, v] of Object.entries(VARIANTES)) {
  for (const [opcao, rotulo] of v.opcoes) {
    test(`variação ${chave} = ${rotulo}`, async ({ page }) => {
      const erros: string[] = []
      await preparar(page, erros)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/?v=${chave}:${opcao}`)
      await page.waitForFunction(() => '__otp' in window)
      await page.evaluate((n) => (window as unknown as { __otp: { irParaSecao: (n: string) => void } }).__otp.irParaSecao(n), v.secao)
      await page.waitForTimeout(300)
      await page.waitForTimeout(200)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      expect(erros).toEqual([])
    })
  }
}

type Otp = { __otp: { irParaSecao: (n: string) => void; useSim: { getState: () => Record<string, any> } } }

test('a conexão piora numa tela pesada: volta ao trackpad com aviso', async ({ page }) => {
  await preparar(page, [])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForFunction(() => '__otp' in window)
  await page.evaluate(() => (window as unknown as Otp).__otp.irParaSecao('5'))
  await page.evaluate(() => (window as unknown as Otp).__otp.useSim.getState().conectar('congestionado'))
  await expect(page.getByText('A conexão piorou. Voltamos ao trackpad.')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as Otp).__otp.useSim.getState().tela)).toBe('trackpad')
})

test('o gravador de atalho não engole o que se digita fora dele', async ({ page }) => {
  await preparar(page, [])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForFunction(() => '__otp' in window)
  await page.evaluate(() => (window as unknown as Otp).__otp.irParaSecao('32'))
  await page.evaluate(() => { const t = document.createElement('textarea'); t.id = 'fora'; document.body.appendChild(t) })
  await page.locator('#fora').fill('')
  await page.locator('#fora').pressSequentially('nota')
  await expect(page.locator('#fora')).toHaveValue('nota')
})

test('setas na central do computador não apertam os botões de volume do celular', async ({ page }) => {
  await preparar(page, [])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForFunction(() => '__otp' in window)
  await page.evaluate(() => { const o = (window as unknown as Otp).__otp; o.irParaSecao('8'); o.useSim.getState().focar('meet') })
  await page.locator('[role=tablist] [aria-selected=true]').focus()
  await page.keyboard.press('ArrowDown')
  expect(await page.evaluate(() => (window as unknown as Otp).__otp.useSim.getState().ligados.camera ?? false)).toBe(false)
})

test('menu de modos aberto: Tab não alcança as teclas de baixo e Esc fecha', async ({ page }) => {
  await preparar(page, [])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForFunction(() => '__otp' in window)
  await page.evaluate(() => { (window as unknown as Otp).__otp.irParaSecao('2'); window.dispatchEvent(new Event('otp:abrir-modos')) })
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab')
  const dentro = await page.evaluate(() => !!document.activeElement?.closest('.k-camada') || !document.activeElement?.closest('[data-tela-celular]'))
  expect(dentro).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('.k-camada')).toHaveCount(0)
})
