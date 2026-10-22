import { useEffect, useRef, useState } from 'react'
import { Icone } from '../../kit/Icone'
import { Led } from '../../kit/Led'
import { useVariante } from '../../lab/refinamento'
import { PRESETS, type PresetId } from '../../sim/conexao'
import { nivelAtual, useSim } from '../../sim/loja'

const ICONE_VIA = { cabo: 'usb', wifi: 'wifi', roteador: 'roteador', nenhuma: 'desligado' } as const
const CURTO: Record<PresetId, string> = { usb3: 'USB 3', usb2: 'USB 2', wifi6: 'Wi-Fi 6', wifi4: 'Wi-Fi', roteador: 'Roteador', congestionado: 'Wi-Fi', nenhuma: 'Sem conexão' }
const NOME_NIVEL = { 0: 'sem conexão', 1: 'fraca', 2: 'boa', 3: 'rápida' } as const

/* Estado da conexão (seção 7), na cabeça da lateral direita. O LED nunca fala sozinho:
   vem com o nome da conexão ou o nível. */
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

  const descricao = `Conexão: ${p.rotulo}, ${NOME_NIVEL[nivel]}`
  if (forma === 'silencioso') {
    const mostrar = alerta || nivel <= 1
    return (
      <span className={`cel-ind${mostrar ? ' cel-ind-alerta' : ''}`} data-lab="7" role="status" aria-label={descricao}>
        {mostrar && <><Led aceso cor={nivel === 0 ? 'laranja' : 'ambar'} /><span>{nivel === 0 ? 'Sem conexão' : 'Conexão fraca'}</span></>}
      </span>
    )
  }
  if (forma === 'medidor') {
    return (
      <span className="cel-ind" data-lab="7" role="status" aria-label={descricao}>
        <span className={`cel-medidor cel-m${nivel}`} aria-hidden="true"><i /><i /><i /></span>
        <span>{nivel === 0 ? 'Sem conexão' : `Conexão ${NOME_NIVEL[nivel]}`}</span>
      </span>
    )
  }
  return (
    <span className="cel-ind" data-lab="7" role="status" aria-label={descricao}>
      <Led aceso={nivel > 0} cor={nivel === 1 ? 'ambar' : undefined} />
      <Icone nome={ICONE_VIA[p.via]} tamanho={14} />
      <span>{CURTO[preset]}</span>
    </span>
  )
}
