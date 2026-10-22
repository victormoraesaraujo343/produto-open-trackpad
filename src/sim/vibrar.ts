/* Vibração quando o aparelho deixa (Android). iPhone e computador não vibram:
   toda vibração tem resposta visual junto. */
export function vibrar(padrao: number | number[]): void {
  try { navigator.vibrate?.(padrao) } catch { /* sem vibração */ }
}
