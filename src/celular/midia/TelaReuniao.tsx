import { useEffect, useState } from 'react'
import { AGENDA } from '../../dados/agenda'
import { Icone } from '../../kit/Icone'
import { Led } from '../../kit/Led'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'

const INICIO = 12 * 60 + 4

/* Modo reunião (seção 17): mudo, câmera, mão e sair, grandes, com o estado em texto. */
export function TelaReuniao({ extra }: { extra?: React.ReactNode }) {
  const ligados = useSim((s) => s.ligados)
  const [seg, setSeg] = useState(INICIO)
  useEffect(() => { const t = setInterval(() => setSeg((s) => s + 1), 1000); return () => clearInterval(t) }, [])
  const disparar = (id: string) => { useSim.getState().dispararAtalho(id); vibrar(10) }
  const botoes = [
    { id: 'mudo', nome: 'Microfone', icone: ligados.mudo ? 'mudo' : 'microfone', estado: ligados.mudo ? 'mudo' : 'aberto', ligado: !!ligados.mudo },
    { id: 'camera', nome: 'Câmera', icone: 'camera', estado: ligados.camera ? 'desligada' : 'ligada', ligado: !!ligados.camera },
    { id: 'mao', nome: 'Mão', icone: 'mao', estado: ligados.mao ? 'levantada' : 'abaixada', ligado: !!ligados.mao },
  ]
  return (
    <div className="cel-reuniao" data-lab="17">
      <div className="cel-reuniao-topo">
        <span className="cel-reuniao-nome"><Led aceso cor="laranja" />{AGENDA[0].titulo}</span>
        <span className="cel-reuniao-tempo">{Math.floor(seg / 60)}:{String(seg % 60).padStart(2, '0')}</span>
      </div>
      <div className="cel-reuniao-botoes">
        {botoes.map((b) => (
          <button key={b.id} type="button" className={`k-tecla cel-reuniao-botao${b.ligado ? ' k-ligada' : ''}`} aria-pressed={b.ligado} aria-label={`${b.nome}: ${b.estado}`} onClick={() => disparar(b.id)}>
            <Icone nome={b.icone} tamanho={26} />
            <span className="k-presa"><b>{b.nome}</b><small>{b.estado}</small></span>
          </button>
        ))}
        <button type="button" className="k-tecla cel-reuniao-botao cel-reuniao-sair" onClick={() => { disparar('sair'); useSim.getState().avisar('Você saiu da chamada') }}>
          <Icone nome="sair" tamanho={26} /><span className="k-presa"><b>Sair</b><small>da chamada</small></span>
        </button>
      </div>
      {extra}
    </div>
  )
}
