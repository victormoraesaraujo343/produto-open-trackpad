import { COMPUTADORES } from '../../dados/computadores'
import { Icone } from '../../kit/Icone'
import { Tecla } from '../../kit/Tecla'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'

const origemDe = (o: string) => (o === 'celular' ? 'Do celular' : o === 'computador' ? 'Do computador' : `De ${COMPUTADORES.find((c) => c.id === o)?.nome ?? o}`)

/* Área de transferência compartilhada (seção 24): copiou num aparelho, cola no outro.
   Com vários computadores, também copia num e cola no outro. */
export function TelaTransferencia() {
  const itens = useSim((s) => s.transferencia)
  return (
    <div className="cel-transferencia" data-lab="24">
      <ul className="cel-copias" aria-label="Copiados recentemente">
        {itens.map((c) => (
          <li key={c.id}>
            <button type="button" className="cel-copia" onClick={() => { useSim.getState().mostrarNoPc(`Colado: ${c.texto}`); vibrar(8) }}
              aria-label={`${c.texto}. ${origemDe(c.origem)}. Tocar cola no computador`}>
              <Icone nome={c.origem === 'celular' ? 'celular' : 'computador'} tamanho={16} />
              <span className="cel-copia-texto">{c.texto}</span>
              <small>{origemDe(c.origem)}</small>
            </button>
          </li>
        ))}
      </ul>
      <Tecla rotulo="Copiar texto do celular" icone="copiar" className="cel-tecla-texto"
        aoTocar={() => useSim.getState().copiar('Senha do Wi-Fi da sala: ver no cartão', 'celular')} />
    </div>
  )
}
