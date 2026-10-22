/* Escolha entre poucas opções: teclas lado a lado num sulco; a escolhida em relevo com o filete
   laranja. */
export function Segmentos<T extends string>({ opcoes, valor, aoMudar, rotulo }: { opcoes: [T, string][]; valor: T; aoMudar: (v: T) => void; rotulo: string }) {
  return (
    <div className="cel-segmentos" role="radiogroup" aria-label={rotulo}>
      {opcoes.map(([v, nome]) => (
        <button key={v} type="button" role="radio" aria-checked={v === valor} className={v === valor ? 'cel-modo-ativo' : ''} onClick={() => aoMudar(v)}>{nome}</button>
      ))}
    </div>
  )
}
