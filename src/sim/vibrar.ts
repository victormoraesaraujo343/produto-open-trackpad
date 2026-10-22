import { useSim } from './loja'

/* Vibração quando o aparelho deixa (Android) e a opção está ligada. iPhone e computador não
   vibram: toda vibração tem resposta visual junto. */
export function vibrar(padrao: number | number[]): void {
  if (!useSim.getState().opcoes.vibracao) return
  try { navigator.vibrate?.(padrao) } catch { /* sem vibração */ }
}
