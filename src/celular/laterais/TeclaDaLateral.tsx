import { useRef, useState } from 'react'
import { Camada } from '../../kit/Camada'
import { Icone } from '../../kit/Icone'
import { Modulo } from '../../kit/Modulo'
import { TeclaAtalho } from '../../kit/TeclaAtalho'
import { TeclaPresa } from '../../kit/TeclaPresa'
import { ATALHOS } from '../../dados/atalhos'
import { useSim, type Lado } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'
import { nomeDoItem, opcoesDeItem } from './itens'

const SEGURAR_MS = 650

/* Uma posição da lateral (issue #5): mostra o atalho ou a tecla presa configurada para o app
   em foco. Segurar abre a troca, só para esta posição e este app. */
export function TeclaDaLateral({ lado, posicao }: { lado: Lado; posicao: number }) {
  const app = useSim((s) => s.appEmFoco)
  const item = useSim((s) => s.laterais[s.appEmFoco][lado][posicao])
  const proprios = useSim((s) => s.atalhosProprios)
  const perfil = useSim((s) => s.perfis[s.appEmFoco])
  const [trocar, setTrocar] = useState(false)
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const engolir = useRef(false)

  return (
    <div className="k-lugar-item" data-lab="33"
      onPointerDownCapture={() => { engolir.current = false; relogio.current = setTimeout(() => { engolir.current = true; vibrar([6, 30, 6]); setTrocar(true) }, SEGURAR_MS) }}
      onPointerUpCapture={() => clearTimeout(relogio.current)}
      onPointerLeave={() => clearTimeout(relogio.current)}
      onPointerCancelCapture={() => clearTimeout(relogio.current)}
      onClickCapture={(e) => { if (engolir.current) { e.stopPropagation(); e.preventDefault(); engolir.current = false } }}
      onKeyDown={(e) => { if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); setTrocar(true) } }}>
      {item?.startsWith('presa:') ? <TeclaPresa tecla={item.slice(6)} /> : item ? <TeclaAtalho id={item} /> : null}
      <Camada aberta={trocar} aoFechar={() => setTrocar(false)} className="cel-camada-menu">
        <Modulo className="cel-trocar" role="dialog" aria-label={`Trocar ${nomeDoItem(item, proprios)}`}>
          <div className="cel-trocar-topo">
            <span>Trocar <b>{nomeDoItem(item, proprios)}</b></span>
            <button type="button" className="cel-acao-menu" aria-label="Fechar" onClick={() => setTrocar(false)}><Icone nome="fechar" tamanho={18} /></button>
          </div>
          <div className="cel-trocar-opcoes" role="listbox" aria-label="Opções">
            {opcoesDeItem(perfil, proprios).map((op) => (
              <button key={op} type="button" role="option" aria-selected={op === item} className={op === item ? 'cel-modo-ativo' : ''}
                onClick={() => { useSim.getState().trocarNaLateral(app, lado, posicao, op); setTrocar(false); vibrar(8) }}>
                <Icone nome={op.startsWith('presa:') ? 'segurar' : (ATALHOS[op] ?? proprios[op])?.icone ?? 'atalhos'} tamanho={16} />
                <span>{nomeDoItem(op, proprios)}</span>
              </button>
            ))}
          </div>
        </Modulo>
      </Camada>
    </div>
  )
}
