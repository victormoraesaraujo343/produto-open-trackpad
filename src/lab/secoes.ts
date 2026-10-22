/* Seções e variações do painel de Refinamento.
   A PRIMEIRA opção de cada variação é a proposta; as outras são alternativas reais (não só cor trocada).
   Cada seção é marcada na tela com data-lab="<n>"; a variação é lida com useVariante('<chave>').
   Protocolo do painel: laboratorio/refinamento/README.md */

export const SECOES = [
  { n: '1', nome: 'Acabamento' },
]

export const VARIANTES = {
  acabamento: { secao: '1', rotulo: 'Acabamento', opcoes: [['escuro', 'Alumínio escuro'], ['claro', 'Alumínio claro']] },
} satisfies Record<string, { secao: string; rotulo: string; opcoes: [string, string][] }>

export type ChaveVariante = keyof typeof VARIANTES
