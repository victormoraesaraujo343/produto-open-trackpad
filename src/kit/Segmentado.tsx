import './kit.css'

export function Segmentado<T extends string>({ opcoes, valor, aoMudar, rotulo }: { opcoes: [T, string][]; valor: T; aoMudar: (v: T) => void; rotulo: string }) {
  return (
    <div className="k-seg" role="group" aria-label={rotulo}>
      {opcoes.map(([v, nome]) => (
        <button key={v} type="button" aria-pressed={v === valor} className={v === valor ? 'k-ligada' : ''} onClick={() => aoMudar(v)}>{nome}</button>
      ))}
    </div>
  )
}
