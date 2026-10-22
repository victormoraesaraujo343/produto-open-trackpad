import { SuperficieTrackpad } from '../../kit/SuperficieTrackpad'
import { Tecla } from '../../kit/Tecla'
import { useVariante } from '../../lab/refinamento'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'

const TECLAS = ['Ctrl', 'Shift', 'Alt', 'Espaço']

/* Teclas presas (seção 9): uma mão segura a tecla, a outra usa o trackpad.
   Ex.: Ctrl preso e tocar em vários arquivos; Espaço preso para arrastar a tela no Figma. */
export function TelaPresas() {
  const forma = useVariante('presas')
  const presas = useSim((s) => s.teclasPresas)
  const alternar = useSim((s) => s.alternarPresa)
  const pôr = (t: string, sim: boolean) => { if (presas.includes(t) !== sim) { alternar(t); vibrar(sim ? 10 : 5) } }

  if (forma === 'faixa') {
    const presa = presas.includes('Shift')
    return (
      <div className="cel-tp cel-presas" data-lab="9">
        <div className={`cel-faixa-shift${presa ? ' k-ligada' : ''}`} role="button" aria-pressed={presa} aria-label="Shift: presa enquanto o dedo estiver aqui" tabIndex={0}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); pôr('Shift', true) }}
          onPointerUp={() => pôr('Shift', false)} onPointerCancel={() => pôr('Shift', false)}
          onKeyDown={(e) => { if (e.key === ' ') pôr('Shift', true) }} onKeyUp={(e) => { if (e.key === ' ') pôr('Shift', false) }}>
          <span>Shift</span><small>{presa ? 'presa' : 'segure'}</small>
        </div>
        <SuperficieTrackpad />
      </div>
    )
  }

  return (
    <div className="cel-tp cel-presas" data-lab="9">
      <div className="cel-coluna-presas">
        {TECLAS.map((t) => {
          const presa = presas.includes(t)
          const rotulo = `${t} ${presa ? 'presa' : 'solta'}`
          return forma === 'segurar' ? (
            <div key={t} className={`k-tecla cel-presa${presa ? ' k-ligada' : ''}`} role="button" tabIndex={0} aria-pressed={presa} aria-label={`${t}: presa enquanto o dedo estiver em cima`}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); pôr(t, true) }}
              onPointerUp={() => pôr(t, false)} onPointerCancel={() => pôr(t, false)}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') pôr(t, true) }} onKeyUp={() => pôr(t, false)}>
              <span className="cel-presa-nome">{t}</span><span className="k-rotulo">{presa ? 'presa' : 'segure'}</span>
            </div>
          ) : (
            <Tecla key={t} rotulo={rotulo} ligada={presa} led={presa} className="cel-presa" mostrarRotulo={false} aoTocar={() => alternar(t)}>
              <span className="cel-presa-nome">{t}</span><span className="k-rotulo">{presa ? 'presa' : 'solta'}</span>
            </Tecla>
          )
        })}
      </div>
      <SuperficieTrackpad />
    </div>
  )
}
