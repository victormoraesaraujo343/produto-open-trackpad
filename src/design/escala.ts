/* O celular é desenhado uma vez no tamanho real (780 × 360, um aparelho de 6,7" deitado)
   e escalado inteiro para caber onde estiver, sem refluir. */
export interface Medida { largura: number; altura: number }

export const DESENHO_CELULAR: Medida = { largura: 780, altura: 360 }
const MAXIMO = 1.6

export function escalaDaMoldura(caixa: Medida, desenho: Medida = DESENHO_CELULAR): number {
  const k = Math.min(caixa.largura / desenho.largura, caixa.altura / desenho.altura)
  return Math.max(0, Math.min(k, MAXIMO))
}
