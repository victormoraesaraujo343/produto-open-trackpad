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
  const itens: { nome: string; icone: string; acao: () => void }[] = [
    { nome: 'Abrir o OpenTrackpad', icone: 'trackpad', acao: () => ir('central') },
    { nome: 'Parear um celular', icone: 'qr', acao: () => ir('pareamento') },
    { nome: 'Gravar atalho', icone: 'gravar', acao: () => ir('gravador') },
    { nome: 'Assistente de primeira vez', icone: 'info', acao: () => ir('assistente') },
  ]
  return (
    <div className={`pc-bandeja pc-bandeja-${sistema}`} role="menu" aria-label="OpenTrackpad" data-lab="29">
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
