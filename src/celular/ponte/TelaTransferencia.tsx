import { useEffect, useRef, useState, type ReactNode } from 'react'
import { COMPUTADORES } from '../../dados/computadores'
import { Icone } from '../../kit/Icone'
import { useSim, type Copia } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'
import './transferencia.css'

const origemDe = (o: string) => (o === 'celular' ? 'Do celular' : o === 'computador' ? 'Do computador' : `De ${COMPUTADORES.find((c) => c.id === o)?.nome ?? o}`)

/* Prévia do celular antes de qualquer cópia (depois, mostra o último copiado no celular). */
const TEXTO_DO_CELULAR = 'Senha do Wi-Fi da sala: ver no cartão'
const CONFIRMA_MS = 1200

/* Seta entre os dois aparelhos; a ordem dos ícones diz o sentido. */
function Seta() {
  return (
    <svg width={16} height={16} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.6 10h12.6M12.6 6.4 16.2 10l-3.6 3.6" />
    </svg>
  )
}

/* Tecla grande com o material do kit. A faixa de baixo mostra a prévia (num poço) ou,
   por um instante depois do toque, a confirmação com ícone e palavra. */
function Chave({ rotulo, icones, previa, confirmada, aoTocar }: {
  rotulo: string; icones: ReactNode; previa: string; confirmada: string | null; aoTocar: () => void
}) {
  return (
    <button type="button" className="tr-chave tr-enviar" onClick={aoTocar}>
      <span className="tr-topo">
        <span className="tr-icones">{icones}</span>
        <span className="tr-rotulo">{rotulo}</span>
      </span>
      <span className="tr-faixa">
        {confirmada ? <span className="tr-ok"><Icone nome="tick" tamanho={18} />{confirmada}</span>
          : <span className="tr-previa">{previa}</span>}
      </span>
    </button>
  )
}

/* Área de transferência compartilhada (seção 24): copiou num aparelho, cola no outro. Uma tecla
   de envio ao computador e a lista dos copiados; tocar num item copia para o celular. */
export function TelaTransferencia() {
  const itens = useSim((s) => s.transferencia)
  const [aviso, setAviso] = useState<{ quem: string; palavra: string } | null>(null)
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(relogio.current), [])

  const avisa = (quem: string, palavra: string) => {
    clearTimeout(relogio.current)
    setAviso({ quem, palavra })
    relogio.current = setTimeout(() => setAviso(null), CONFIRMA_MS)
  }
  const confirmada = (quem: string) => (aviso?.quem === quem ? aviso.palavra : null)

  // o que o celular tem na área: o último copiado no celular
  const previa = itens.find((c) => c.origem === 'celular')?.texto ?? TEXTO_DO_CELULAR

  const enviar = () => { vibrar(10); useSim.getState().copiar(previa, 'celular'); avisa('enviar', 'Enviado') }
  const copiarParaCelular = (c: Copia) => { vibrar(8); useSim.getState().copiar(c.texto, 'celular'); avisa(`item${c.id}`, 'Copiado') }

  const iconesEnviar = <><Icone nome="celular" tamanho={18} /><Seta /><Icone nome="computador" tamanho={18} /></>

  return (
    <div className="tr-raiz tr-grande" data-lab="24">
      <span className="tr-so-leitor" role="status">{aviso?.palavra ?? ''}</span>
      <Chave rotulo="Enviar ao computador" icones={iconesEnviar} previa={previa}
        confirmada={confirmada('enviar')} aoTocar={enviar} />
      {itens.length === 0 ? (
        <div className="cel-vazio"><Icone nome="copiar" tamanho={22} /><span>Nada copiado ainda</span></div>
      ) : (
        <ul className="tr-lista" aria-label="Copiados recentemente">
          {itens.map((c) => {
            const ok = confirmada(`item${c.id}`)
            return (
              <li key={c.id}>
                <button type="button" className="tr-item" onClick={() => copiarParaCelular(c)}
                  aria-label={`${c.texto}. ${origemDe(c.origem)}. Tocar copia para o celular`}>
                  <Icone nome={c.origem === 'celular' ? 'celular' : 'computador'} tamanho={16} />
                  <span className="tr-item-texto">{c.texto}</span>
                  {ok ? <span className="tr-ok"><Icone nome="tick" tamanho={14} />{ok}</span> : <small>{origemDe(c.origem)}</small>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
