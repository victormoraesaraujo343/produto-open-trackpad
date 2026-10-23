import { Icone } from '../../kit/Icone'
import { Led } from '../../kit/Led'
import { PRESETS, type PresetId } from '../../sim/conexao'
import { nivelAtual, useSim } from '../../sim/loja'

const ICONE_VIA = { cabo: 'usb', wifi: 'wifi', roteador: 'roteador', nenhuma: 'desligado' } as const
const CURTO: Record<PresetId, string> = { usb3: 'USB 3', usb2: 'USB 2', wifi6: 'Wi-Fi 6', wifi4: 'Wi-Fi', roteador: 'Roteador', congestionado: 'Wi-Fi', nenhuma: 'Sem conexão' }
const NOME_NIVEL = { 0: 'sem conexão', 1: 'fraca', 2: 'boa', 3: 'rápida' } as const

/* Estado da conexão (seção 7), na cabeça da lateral direita: LED, ícone e nome da conexão.
   O LED nunca fala sozinho: vem com o nome. */
export function Indicador() {
  const preset = useSim((s) => s.preset)
  const p = PRESETS[preset]
  const nivel = nivelAtual(preset)
  const descricao = `Conexão: ${p.rotulo}, ${NOME_NIVEL[nivel]}`
  return (
    <span className="cel-ind" data-lab="7" role="status" aria-label={descricao}>
      <Led aceso={nivel > 0} cor={nivel === 1 ? 'ambar' : undefined} />
      <Icone nome={ICONE_VIA[p.via]} tamanho={14} />
      <span>{CURTO[preset]}</span>
    </span>
  )
}
