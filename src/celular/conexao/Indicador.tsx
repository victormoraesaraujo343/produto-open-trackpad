import { useEffect, useRef, useState } from 'react'
import { Icone } from '../../kit/Icone'
import { Led } from '../../kit/Led'
import { useVariante } from '../../lab/refinamento'
import { PRESETS, ROTULO_NIVEL } from '../../sim/conexao'
import { nivelAtual, useSim } from '../../sim/loja'

const ICONE_VIA = { cabo: 'usb', wifi: 'wifi', roteador: 'roteador', nenhuma: 'desligado' } as const
const NOME_NIVEL = { 0: 'sem conexão', 1: 'conexão fraca', 2: 'conexão boa', 3: 'conexão rápida' } as const

/* Estado da conexão (seção 7). O LED nunca fala sozinho: vem com o nome da conexão ou o nível. */
export function Indicador() {
  const forma = useVariante('indicador')
  const preset = useSim((s) => s.preset)
  const p = PRESETS[preset]
  const nivel = nivelAtual(preset)
  const anterior = useRef(nivel)
  const [alerta, setAlerta] = useState(false)

  useEffect(() => {
    if (nivel < anterior.current) { setAlerta(true); const t = setTimeout(() => setAlerta(false), 4000); anterior.current = nivel; return () => clearTimeout(t) }
    anterior.current = nivel
  }, [nivel])

  const descricao = `${p.rotulo}, ${NOME_NIVEL[nivel]}`
  if (forma === 'silencioso') {
    const mostrar = alerta || nivel <= 1
    return (
      <div className={`cel-ind cel-ind-silencioso${mostrar ? ' cel-ind-mostra' : ''}`} data-lab="7" role="status" aria-label={descricao}>
        {mostrar && <><Led aceso cor={nivel === 0 ? 'laranja' : 'ambar'} /><span>{nivel === 0 ? 'Sem conexão' : 'Conexão fraca'}</span></>}
      </div>
    )
  }
  if (forma === 'medidor') {
    return (
      <div className="cel-ind" data-lab="7" role="status" aria-label={descricao}>
        <span className={`cel-medidor cel-m${nivel}`} aria-hidden="true"><i /><i /><i /></span>
        <span>{ROTULO_NIVEL[nivel] === '—' ? 'Sem conexão' : NOME_NIVEL[nivel].replace('conexão ', '')}</span>
      </div>
    )
  }
  return (
    <div className="cel-ind" data-lab="7" role="status" aria-label={descricao}>
      <Led aceso={nivel > 0} cor={nivel === 1 ? 'ambar' : undefined} />
      <Icone nome={ICONE_VIA[p.via]} tamanho={16} />
      <span>{nivel === 0 ? 'Sem conexão' : p.rotulo}</span>
    </div>
  )
}
