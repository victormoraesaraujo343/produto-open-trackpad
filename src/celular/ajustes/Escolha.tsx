import type { ReactNode } from 'react'
import { vibrar } from '../../sim/vibrar'

export interface Opcao<T extends string> { valor: T; nome: string; desenho: ReactNode; linha?: string }

/* Escolha com desenho (seções 2, 9, 12 e 23): cada opção mostra como funciona num desenho
   pequeno, com o nome e, quando precisa, uma linha curta. A escolhida em relevo, com o filete
   laranja e o LED aceso (nunca só pela cor). */
export function Escolha<T extends string>({ rotulo, opcoes, valor, aoMudar, colunas }: { rotulo: string; opcoes: Opcao<T>[]; valor: T; aoMudar: (v: T) => void; colunas?: number }) {
  return (
    <div className="aj-escolha" role="radiogroup" aria-label={rotulo} style={{ gridTemplateColumns: `repeat(${colunas ?? opcoes.length}, minmax(0, 1fr))` }}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={o.valor === valor} className={`aj-opcao${o.valor === valor ? ' aj-opcao-sim' : ''}`}
          onClick={() => { vibrar(8); aoMudar(o.valor) }}>
          <span className="aj-desenho" aria-hidden="true">{o.desenho}</span>
          <span className="aj-nome"><i className="aj-led" aria-hidden="true" />{o.nome}</span>
          {o.linha && <small>{o.linha}</small>}
        </button>
      ))}
    </div>
  )
}

/* Desenhos: o celular deitado visto de cima, em traço. */
const Celular = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 96 48" width="96" height="48">
    <rect x="1.5" y="1.5" width="93" height="45" rx="7" className="aj-traco" />
    {children}
  </svg>
)
const tecla = (x: number, y: number, k = 'aj-tecla') => <rect key={`${x}-${y}`} x={x} y={y} width="9" height="6" rx="1.5" className={k} />
const coluna = (x: number, n = 5) => Array.from({ length: n }, (_, i) => tecla(x, 6 + i * 7.4))

export const DESENHO = {
  doisLados: <Celular>{coluna(6)}<rect x="19" y="6" width="58" height="36" rx="2" className="aj-pad" />{coluna(81)}</Celular>,
  umLado: (esquerda: boolean) => (
    <Celular>
      <rect x={esquerda ? 30 : 6} y="6" width="60" height="36" rx="2" className="aj-pad" />
      {coluna(esquerda ? 6 : 70)}{coluna(esquerda ? 17 : 81)}
    </Celular>
  ),
  /* teclas presas: o dedo (círculo) e o estado da tecla ao longo do tempo */
  presas: (passos: [string, boolean][]) => (
    <svg viewBox="0 0 96 48" width="96" height="48">
      {passos.map(([gesto, presa], i) => (
        <g key={i} transform={`translate(${6 + i * 30} 8)`}>
          <rect width="24" height="16" rx="3" className={presa ? 'aj-tecla-presa' : 'aj-tecla'} />
          {gesto === 'toque' && <circle cx="12" cy="8" r="4" className="aj-dedo" />}
          {gesto === 'segura' && <circle cx="12" cy="8" r="5.5" className="aj-dedo aj-dedo-longo" />}
          {gesto === 'dois' && <><circle cx="9" cy="8" r="3.2" className="aj-dedo" /><circle cx="15.5" cy="8" r="3.2" className="aj-dedo" /></>}
          <text x="12" y="34" className="aj-legenda">{presa ? 'presa' : 'solta'}</text>
        </g>
      ))}
    </svg>
  ),
  /* botões de volume: a borda do celular com os dois botões e o que eles fazem */
  volume: (o: 'atalhos' | 'legenda' | 'sistema') => (
    <svg viewBox="0 0 96 48" width="96" height="48">
      <rect x="10" y="10" width="80" height="34" rx="6" className="aj-traco" />
      <rect x="24" y="5" width="16" height="4" rx="1.5" className={o === 'sistema' ? 'aj-tecla' : 'aj-tecla-presa'} />
      <rect x="44" y="5" width="16" height="4" rx="1.5" className={o === 'sistema' ? 'aj-tecla' : 'aj-tecla-presa'} />
      {o === 'sistema' && <path d="M38 27h5l6-5v14l-6-5h-5z M54 24q4 5 0 10" className="aj-icone" />}
      {o !== 'sistema' && <path d="M40 25h16v10H40z M45 30h6" className="aj-icone" />}
      {o === 'legenda' && <><rect x="21" y="13" width="22" height="5" rx="1.5" className="aj-etiqueta" /><rect x="41" y="13" width="22" height="5" rx="1.5" className="aj-etiqueta" /></>}
    </svg>
  ),
  /* tela de descanso: uma miniatura de cada jeito */
  descanso: (j: string) => (
    <svg viewBox="0 0 96 48" width="96" height="48">
      <rect x="1.5" y="1.5" width="93" height="45" rx="7" className={j === 'aluminio' ? 'aj-tela aj-tela-aluminio' : 'aj-tela'} />
      {j === 'relogio' && <text x="48" y="31" className="aj-hora">12:04</text>}
      {j === 'analogico' && <><circle cx="48" cy="24" r="15" className="aj-traco" /><path d="M48 24V14 M48 24l7 4" className="aj-icone" /><circle cx="48" cy="24" r="1.6" className="aj-acento" /></>}
      {j === 'digitos' && <g className="aj-segmento" transform="translate(27 13)">{[0, 11, 25, 36].map((x) => <path key={x} d={`M${x} 0h8v22h-8z M${x} 11h8`} />)}<circle cx="21.5" cy="7" r="1.2" className="aj-acento" /><circle cx="21.5" cy="15" r="1.2" className="aj-acento" /></g>}
      {j === 'painel' && [0, 1, 2].map((i) => <rect key={i} x={10 + i * 26} y="12" width="22" height="24" rx="2" className="aj-pad" />)}
      {j === 'medidores' && [0, 1, 2].map((i) => <g key={i}><circle cx={22 + i * 26} cy="24" r="9" className="aj-traco" /><path d={`M${22 + i * 26 - 9} 24a9 9 0 0 1 ${9 + i * 4} -9`} className="aj-arco" /></g>)}
      {j === 'aluminio' && <><path d="M20 46L60 2 M34 46L74 2" className="aj-brilho" /><text x="84" y="40" className="aj-hora-mini">12:04</text></>}
      {j === 'foto' && <><path d="M8 40l22-18 14 11 12-8 32 15z" className="aj-pad" /><circle cx="70" cy="14" r="5" className="aj-traco" /></>}
    </svg>
  ),
}
