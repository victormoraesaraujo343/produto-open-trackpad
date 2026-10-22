/// <reference types="node" />
import { createRequire } from 'node:module'

const { emMarkdown, pastaDa } = createRequire(import.meta.url)('../laboratorio/servidor.cjs')

describe('servidor do laboratório', () => {
  it('lista só seções com algo anotado', () => {
    const md = emMarkdown({ rodada: { numero: 1 }, secoes: { '1': { nome: 'Acabamento', status: 'ajustar', nota: 'mais brilho' }, '2': { nome: 'Trackpad' } } }, 'app')
    expect(md).toContain('## 1 · Acabamento')
    expect(md).toContain('mais brilho')
    expect(md).not.toContain('## 2 · Trackpad')
  })
  it('recusa página com caminho', () => {
    expect(() => pastaDa('../x')).toThrow()
    expect(() => pastaDa('app')).not.toThrow()
  })
})
