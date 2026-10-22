import { useState } from 'react'
import { useVariante } from '../../lab/refinamento'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'

const LETRAS = ['qwertyuiop', 'asdfghjklç', 'zxcvbnm']
const NUMEROS = [['7', '8', '9', '/'], ['4', '5', '6', '*'], ['1', '2', '3', '-'], ['0', ',', '.', '+']]

function Tecla({ rotulo, aria, largura = 1, onPress, ligada = false }: { rotulo: string; aria?: string; largura?: number; onPress: () => void; ligada?: boolean }) {
  return (
    <button type="button" className={`cel-tecla-tec${ligada ? ' k-ligada' : ''}`} style={{ flex: largura }} aria-label={aria ?? rotulo} aria-pressed={ligada || undefined}
      onPointerDown={(e) => { e.preventDefault(); vibrar(5); onPress() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPress() } }}>
      {rotulo}
    </button>
  )
}

/* Teclado completo e numérico (seção 14). O texto vai para o computador; uma linha mostra
   o que já foi, para não precisar tirar o olho do celular. */
export function TelaTeclado() {
  const forma = useVariante('teclado')
  const [maiuscula, setMaiuscula] = useState(false)
  const [numerico, setNumerico] = useState(false)
  const texto = useSim((s) => s.textoDigitado)
  const { digitar, apagar } = useSim.getState()
  const letra = (l: string) => { digitar(maiuscula ? l.toUpperCase() : l); setMaiuscula(false) }

  const enviado = <div className="cel-enviado" aria-live="polite"><span>{texto.slice(-40) || 'O que você digitar aparece no computador'}</span><i aria-hidden="true" /></div>
  const linhaBase = (
    <div className="cel-tec-linha">
      <Tecla rotulo={numerico ? 'ABC' : '123'} aria={numerico ? 'Letras' : 'Números'} largura={1.4} onPress={() => setNumerico(!numerico)} />
      <Tecla rotulo="espaço" largura={4} onPress={() => digitar(' ')} />
      <Tecla rotulo="⌫" aria="Apagar" largura={1.4} onPress={apagar} />
      <Tecla rotulo="↵" aria="Enter" largura={1.4} onPress={() => useSim.getState().mostrarNoPc('Enter')} />
    </div>
  )

  if (numerico) {
    return (
      <div className="cel-teclado" data-lab="14">
        {enviado}
        <div className="cel-tec-numeros">{NUMEROS.map((l, i) => <div key={i} className="cel-tec-linha">{l.map((n) => <Tecla key={n} rotulo={n} onPress={() => digitar(n)} />)}</div>)}</div>
        {linhaBase}
      </div>
    )
  }

  if (forma === 'dividido') {
    const metade = (lado: 0 | 1) => LETRAS.map((l) => { const meio = Math.ceil(l.length / 2); return lado === 0 ? l.slice(0, meio) : l.slice(meio) })
    const lados = [0, 1] as const
    return (
      <div className="cel-teclado cel-teclado-dividido" data-lab="14">
        {lados.map((lado) => (
          <div key={lado} className="cel-tec-metade">
            {metade(lado).map((l, i) => (
              <div key={i} className="cel-tec-linha">
                {lado === 0 && i === 2 && <Tecla rotulo="⇧" aria="Maiúscula" ligada={maiuscula} onPress={() => setMaiuscula(!maiuscula)} />}
                {l.split('').map((c) => <Tecla key={c} rotulo={maiuscula ? c.toUpperCase() : c} onPress={() => letra(c)} />)}
                {lado === 1 && i === 2 && <Tecla rotulo="⌫" aria="Apagar" onPress={apagar} />}
              </div>
            ))}
            <div className="cel-tec-linha">
              {lado === 0 ? <><Tecla rotulo="123" aria="Números" onPress={() => setNumerico(true)} /><Tecla rotulo="espaço" largura={3} onPress={() => digitar(' ')} /></>
                : <><Tecla rotulo="espaço" largura={3} onPress={() => digitar(' ')} /><Tecla rotulo="↵" aria="Enter" onPress={() => useSim.getState().mostrarNoPc('Enter')} /></>}
            </div>
          </div>
        ))}
        <div className="cel-tec-meio">{enviado}<button type="button" className="cel-texto-botao" onClick={() => useSim.getState().irPara('trackpad')}>Voltar ao trackpad</button></div>
      </div>
    )
  }

  return (
    <div className="cel-teclado" data-lab="14">
      {enviado}
      {LETRAS.map((l, i) => (
        <div key={i} className="cel-tec-linha">
          {i === 2 && <Tecla rotulo="⇧" aria="Maiúscula" largura={1.4} ligada={maiuscula} onPress={() => setMaiuscula(!maiuscula)} />}
          {l.split('').map((c) => <Tecla key={c} rotulo={maiuscula ? c.toUpperCase() : c} onPress={() => letra(c)} />)}
          {i === 2 && <Tecla rotulo="," largura={1} onPress={() => digitar(',')} />}
          {i === 2 && <Tecla rotulo="." largura={1} onPress={() => digitar('.')} />}
        </div>
      ))}
      {linhaBase}
    </div>
  )
}
