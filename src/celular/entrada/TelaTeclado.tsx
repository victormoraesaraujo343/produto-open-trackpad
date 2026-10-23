import { useRef, useState } from 'react'
import { Icone } from '../../kit/Icone'
import { useSim } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'

/* Layout do Gboard: a linha do meio (a–l) é mais curta, recuada meia tecla de cada lado;
   o ç vem segurando o c, como no Gboard em português. */
const LETRAS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const SEGURAR: Record<string, string> = { c: 'ç', a: 'á', e: 'é', o: 'ó', u: 'ú', i: 'í' }
const SEGURAR_MS = 380
const NUMEROS = [['7', '8', '9', '/'], ['4', '5', '6', '*'], ['1', '2', '3', '-'], ['0', ',', '.', '+']]

function Tecla({ rotulo, aria, largura = 1, onPress, ligada = false, segurar }: { rotulo: string; aria?: string; largura?: number; onPress: () => void; ligada?: boolean; segurar?: { rotulo: string; acao: () => void } }) {
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const segurou = useRef(false)
  return (
    <button type="button" className={`cel-tecla-tec${ligada ? ' k-ligada' : ''}`} style={{ flex: largura }} aria-label={aria ?? rotulo} aria-pressed={ligada || undefined}
      onPointerDown={(e) => {
        e.preventDefault(); vibrar(5)
        if (!segurar) { onPress(); return }
        segurou.current = false
        relogio.current = setTimeout(() => { segurou.current = true; vibrar(8); segurar.acao() }, SEGURAR_MS)
      }}
      onPointerUp={() => { if (!segurar) return; clearTimeout(relogio.current); if (!segurou.current) onPress() }}
      onPointerLeave={() => clearTimeout(relogio.current)}
      onClick={(e) => { if (e.detail === 0) onPress() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPress() } }}>
      {rotulo}
      {segurar && <sup className="cel-tec-alt" aria-hidden="true">{segurar.rotulo}</sup>}
    </button>
  )
}

/* Teclado completo e numérico (seção 14). O texto vai para o computador; uma linha mostra
   o que já foi, para não precisar tirar o olho do celular. */
export function TelaTeclado() {
  const [maiuscula, setMaiuscula] = useState(false)
  const [numerico, setNumerico] = useState(false)
  const texto = useSim((s) => s.textoDigitado)
  const copiado = useSim((s) => s.transferencia.find((c) => c.origem !== 'celular'))
  const { digitar, apagar } = useSim.getState()
  const letra = (l: string) => { digitar(maiuscula ? l.toUpperCase() : l); setMaiuscula(false) }

  const enviado = <div className="cel-enviado" aria-live="polite"><span>{texto.slice(-40) || <Icone nome="computador" tamanho={15} />}</span><i aria-hidden="true" />{copiado && <button type="button" className="cel-colar" onPointerDown={(e) => { e.preventDefault(); digitar(copiado.texto) }} aria-label={`Colar do computador: ${copiado.texto}`}>Colar <span>{copiado.texto}</span></button>}</div>
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

  const teclaLetra = (c: string) => (
    <Tecla key={c} rotulo={maiuscula ? c.toUpperCase() : c} onPress={() => letra(c)}
      segurar={SEGURAR[c] ? { rotulo: SEGURAR[c], acao: () => letra(SEGURAR[c]) } : undefined} />
  )
  return (
    <div className="cel-teclado" data-lab="14">
      {enviado}
      <div className="cel-tec-linha">{LETRAS[0].split('').map(teclaLetra)}</div>
      <div className="cel-tec-linha"><span className="cel-tec-recuo" />{LETRAS[1].split('').map(teclaLetra)}<span className="cel-tec-recuo" /></div>
      <div className="cel-tec-linha">
        <Tecla rotulo="⇧" aria="Maiúscula" largura={1.5} ligada={maiuscula} onPress={() => setMaiuscula(!maiuscula)} />
        {LETRAS[2].split('').map(teclaLetra)}
        <Tecla rotulo="⌫" aria="Apagar" largura={1.5} onPress={apagar} />
      </div>
      <div className="cel-tec-linha">
        <Tecla rotulo="?123" aria="Números" largura={1.5} onPress={() => setNumerico(true)} />
        <Tecla rotulo="," onPress={() => digitar(',')} />
        <Tecla rotulo="espaço" largura={5} onPress={() => digitar(' ')} />
        <Tecla rotulo="." onPress={() => digitar('.')} />
        <Tecla rotulo="↵" aria="Enter" largura={1.5} onPress={() => useSim.getState().mostrarNoPc('Enter')} />
      </div>
    </div>
  )
}
