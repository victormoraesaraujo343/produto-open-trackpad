import { useRef, useState } from 'react'
import { DesktopFalso } from '../../bancada/DesktopFalso'
import { DESENHO_COMPUTADOR } from '../../bancada/MolduraComputador'
import { useTamanho } from '../../design/useTamanho'
import { Icone } from '../../kit/Icone'
import { liberado } from '../../sim/conexao'
import { nivelAtual, useSim, type Ponto } from '../../sim/loja'

const caminho = (t: Ponto[]) => t.map((p, i) => `${i ? 'L' : 'M'}${(p.x * 1000).toFixed(1)} ${(p.y * 625).toFixed(1)}`).join(' ')
export const larguraDoTraco = (t: Ponto[]) => 2 + 6 * (t.reduce((s, p) => s + p.p, 0) / Math.max(1, t.length))

/* Mesa digitalizadora (seção 15). Com o dedo ou caneta; a pressão engrossa o traço onde o
   celular informa. "Ver a tela" põe a tela do computador embaixo (combinação: desenhar vendo
   a tela), e só existe quando a conexão aguenta. */
export function TelaMesa({ verTela }: { verTela: boolean }) {
  const tracos = useSim((s) => s.tracos)
  const [atual, setAtual] = useState<Ponto[] | null>(null)
  const area = useRef<HTMLDivElement>(null)
  const { largura } = useTamanho(area)
  const local = (e: React.PointerEvent<HTMLElement>): Ponto => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, p: e.pressure && e.pointerType !== 'mouse' ? e.pressure : 0.5 }
  }
  return (
    <div ref={area} className={`cel-mesa${verTela ? ' cel-mesa-tela' : ''}`} data-lab="15" role="img" aria-label="Área de desenho: desenhe com o dedo ou a caneta"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setAtual([local(e)]) }}
      onPointerMove={(e) => { if (atual) setAtual([...atual, local(e)]) }}
      onPointerUp={() => { if (atual && atual.length > 1) useSim.getState().desenhar(atual); setAtual(null) }}>
      {verTela && largura > 0 && (
        <div className="cel-mesa-fundo" style={{ transform: `scale(${largura / DESENHO_COMPUTADOR.largura})` }}><DesktopFalso /></div>
      )}
      <svg viewBox="0 0 1000 625" preserveAspectRatio="none" aria-hidden="true">
        {[...tracos, ...(atual ? [atual] : [])].map((t, i) => <path key={i} d={caminho(t)} strokeWidth={larguraDoTraco(t)} />)}
      </svg>
      {tracos.length === 0 && !atual && <span className="cel-dica-icone" aria-hidden="true"><Icone nome="caneta" tamanho={28} /></span>}
    </div>
  )
}

export function podeVerTela() {
  return liberado(3, nivelAtual(useSim.getState().preset))
}
export { caminho }
