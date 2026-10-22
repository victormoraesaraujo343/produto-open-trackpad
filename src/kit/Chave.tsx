import './kit.css'

/* A chave da referência: trilho afundado, bloco que desliza, ponto laranja do lado ligado. */
export function Chave({ ligada, aoMudar, rotulo }: { ligada: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligada} aria-label={rotulo}
      className={`k-chave${ligada ? ' k-ligada' : ''}`} onClick={() => aoMudar(!ligada)}>
      <i className="k-bloco" /><i className="k-pino" /><i className="k-haste" />
    </button>
  )
}
