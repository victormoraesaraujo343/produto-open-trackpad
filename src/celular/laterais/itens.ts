import { ATALHOS, type Atalho } from '../../dados/atalhos'

/* O que pode ir numa posição de lateral: um atalho da biblioteca ou uma tecla presa. */
export const PRESAS = ['Ctrl', 'Shift', 'Alt', 'Super']

export function nomeDoItem(item: string, proprios: Record<string, Atalho>): string {
  if (item.startsWith('presa:')) return `${item.slice(6)} preso`
  return (ATALHOS[item] ?? proprios[item])?.rotulo ?? item
}

export function opcoesDeItem(perfil: string[], proprios: Record<string, Atalho>): string[] {
  const doApp = perfil
  const gerais = ['cliqueDireito', 'copiar', 'colar', 'desfazer', 'refazer', 'alttab', 'areas', 'maximizar', 'captura']
  return [...new Set([...PRESAS.map((p) => `presa:${p}`), ...doApp, ...gerais, ...Object.keys(proprios)])]
}
