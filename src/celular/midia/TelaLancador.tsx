import { IconeApp } from '../../kit/IconeApp'
import type { AppId } from '../../dados/apps'
import { Icone } from '../../kit/Icone'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'

const ITENS: { nome: string; icone: string; app?: AppId; cor?: string }[] = [
  { nome: 'Firefox', icone: 'tela', app: 'firefox' },
  { nome: 'VS Code', icone: 'terminal', app: 'vscode' },
  { nome: 'Figma', icone: 'frame', app: 'figma' },
  { nome: 'Spotify', icone: 'musica', app: 'spotify' },
  { nome: 'Arquivos', icone: 'pasta', app: 'arquivos' },
  { nome: 'Downloads', icone: 'pasta' },
  { nome: 'Projetos', icone: 'pasta' },
  { nome: 'Agenda', icone: 'info' },
]

/* Abrir apps, pastas e sites com um toque (seção 16). */
export function TelaLancador() {
  return (
    <div className="cel-lancador" data-lab="16">
      {ITENS.map((it) => (
        <button key={it.nome} type="button" className="k-tecla cel-lancar" onClick={() => {
          vibrar(8)
          const s = useSim.getState()
          if (it.app) s.focar(it.app)
          s.mostrarNoPc(`Abrindo ${it.nome}`)
        }}>
          {it.app ? <IconeApp app={it.app} tamanho={42} /> : <span className="cel-lancar-icone"><Icone nome={it.icone} tamanho={20} /></span>}
          <span className="k-rotulo">{it.nome}</span>
        </button>
      ))}
    </div>
  )
}
