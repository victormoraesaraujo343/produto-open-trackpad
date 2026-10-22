import { useEffect, useRef, useState } from 'react'
import { APPS } from '../dados/apps'
import { IconeApp } from '../kit/IconeApp'
import { useSim } from '../sim/loja'
import { Janela } from './Janela'

const NOMES: Record<string, string> = { Control: 'Ctrl', Meta: 'Super', ' ': 'Espaço', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc' }
const MODIFICADORES = ['Control', 'Shift', 'Alt', 'Meta']

/* Janela do gravador de atalho (seção 32): aperte a combinação no teclado de verdade. */
export function Gravador() {
  const app = useSim((s) => s.appEmFoco)
  const [teclas, setTeclas] = useState<string[]>([])
  const [nome, setNome] = useState('')
  const fechar = () => useSim.getState().irParaPc('central')
  const area = useRef<HTMLDivElement>(null)

  useEffect(() => {
    area.current?.focus()
    const ouvir = (e: KeyboardEvent) => {
      if (e.target !== area.current) return
      if (e.key === 'Tab') return
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) { fechar(); return }
      e.preventDefault()
      e.stopImmediatePropagation()
      const mods = MODIFICADORES.filter((m) => e.getModifierState(m)).map((m) => NOMES[m] ?? m)
      const principal = MODIFICADORES.includes(e.key) ? null : NOMES[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key)
      setTeclas([...mods, ...(principal ? [principal] : [])])
    }
    window.addEventListener('keydown', ouvir, true)
    return () => window.removeEventListener('keydown', ouvir, true)
  }, [])

  const salvar = () => {
    const s = useSim.getState()
    const mac = s.sistema === 'macos'
    const id = s.criarAtalho(nome.trim() || teclas.join(' + '), teclas.map((t) => (mac ? (t === 'Super' ? 'mod' : t === 'Ctrl' ? '⌃' : t) : t === 'Ctrl' ? 'mod' : t)))
    s.adicionarAtalho(app, id)
    s.avisar(`Atalho gravado em ${APPS[app].nome}`)
    s.setSecaoCentral('atalhos')
    fechar()
  }

  return (
    <Janela titulo="Gravar atalho" aoFechar={fechar} largura={460} altura={330} lab="32">
      <div className="pc-gravador">
        <p>Aperte a combinação no teclado.</p>
        <div ref={area} tabIndex={0} role="textbox" aria-label="Combinação do atalho: aperte as teclas" className={`pc-captura${teclas.length ? ' pc-captura-cheia' : ''}`} aria-live="polite">
          {teclas.length ? teclas.map((t) => <kbd key={t}>{t}</kbd>) : <span>esperando…</span>}
        </div>
        <label className="pc-campo">
          <span>Nome</span>
          <input id="gravador-nome" type="text" value={nome} placeholder="Ex.: Exportar PDF" onChange={(e) => setNome(e.target.value)} />
        </label>
        <div className="pc-gravador-rodape">
          <span className="pc-app-destino"><IconeApp app={app} tamanho={18} />Vai para {APPS[app].nome}</span>
          <div className="pc-acoes">
            <button type="button" className="pc-botao" onClick={fechar}>Cancelar</button>
            <button type="button" className="pc-botao pc-botao-principal" disabled={!teclas.length} onClick={salvar}>Salvar</button>
          </div>
        </div>
      </div>
    </Janela>
  )
}
