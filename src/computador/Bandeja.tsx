import { useEffect, useRef } from 'react'
import { CELULARES } from '../dados/computadores'
import { Icone } from '../kit/Icone'
import { Led } from '../kit/Led'
import { PRESETS } from '../sim/conexao'
import { nivelAtual, useSim } from '../sim/loja'

/* Menu da bandeja (seção 29): estado de relance e os atalhos para o resto. */
export function Bandeja() {
  const preset = useSim((s) => s.preset)
  const sistema = useSim((s) => s.sistema)
  const conectado = nivelAtual(preset) > 0
  const ir = useSim.getState().irParaPc
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus() }, [])
  const teclas = (e: React.KeyboardEvent) => {
    const itens = [...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])]
    const i = itens.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); itens[(i + 1) % itens.length]?.focus() }
    if (e.key === 'ArrowUp') { e.preventDefault(); itens[(i - 1 + itens.length) % itens.length]?.focus() }
    if (e.key === 'Escape') { e.preventDefault(); ir('area') }
  }
  const itens: { nome: string; icone: string; acao: () => void }[] = [
    { nome: 'Abrir o OpenTrackpad', icone: 'trackpad', acao: () => ir('central') },
    { nome: 'Parear um celular', icone: 'qr', acao: () => ir('pareamento') },
    { nome: 'Gravar atalho', icone: 'gravar', acao: () => ir('gravador') },
    { nome: 'Assistente de primeira vez', icone: 'info', acao: () => ir('assistente') },
  ]
  return (
    <div ref={ref} className={`pc-bandeja pc-bandeja-${sistema}`} role="menu" aria-label="OpenTrackpad" data-lab="29" onKeyDown={teclas}>
      <div className="pc-bandeja-estado">
        <Led aceso={conectado} />
        <div><b>{conectado ? CELULARES[0].nome : 'Nenhum celular'}</b><span>{conectado ? PRESETS[preset].rotulo : 'Abra o app no celular'}</span></div>
      </div>
      {itens.map((i) => (
        <button key={i.nome} type="button" role="menuitem" onClick={i.acao}><Icone nome={i.icone} tamanho={16} /><span>{i.nome}</span></button>
      ))}
    </div>
  )
}
