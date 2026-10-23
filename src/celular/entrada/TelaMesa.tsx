import { useRef, useState } from 'react'
import { create } from 'zustand'
import { DesktopFalso } from '../../bancada/DesktopFalso'
import { DESENHO_COMPUTADOR } from '../../bancada/MolduraComputador'
import { useTamanho } from '../../design/useTamanho'
import { Icone } from '../../kit/Icone'
import { Tecla } from '../../kit/Tecla'
import { liberado } from '../../sim/conexao'
import { nivelAtual, useSim, type Ponto } from '../../sim/loja'
import { vibrar } from '../../sim/vibrar'
import './mesa.css'

const caminho = (t: Ponto[]) => t.map((p, i) => `${i ? 'L' : 'M'}${(p.x * 1000).toFixed(1)} ${(p.y * 625).toFixed(1)}`).join(' ')
export const larguraDoTraco = (t: Ponto[]) => 2 + 6 * (t.reduce((s, p) => s + p.p, 0) / Math.max(1, t.length))

/* Modo da caneta. "Desenhar": encostar pinta (como a mesa digitalizadora). "Posicionar": só
   move o cursor, sem tinta (o dedo não passa o cursor "por cima" como a caneta). */
type ModoMesa = 'desenhar' | 'posicionar'
const useModoMesa = create<{ modo: ModoMesa; alternar: () => void }>()((set) => ({
  modo: 'desenhar',
  alternar: () => set((s) => ({ modo: s.modo === 'desenhar' ? 'posicionar' : 'desenhar' })),
}))
const PALAVRA: Record<ModoMesa, string> = { desenhar: 'Desenhar', posicionar: 'Posicionar' }

/* Tecla do último lugar da lateral. Apertada = posicionar; a palavra no rótulo diz o modo. */
export function ChaveModoMesa() {
  const modo = useModoMesa((s) => s.modo)
  return (
    <Tecla rotulo={`Modo: ${PALAVRA[modo]}`} icone={modo === 'desenhar' ? 'caneta' : 'trackpad'} ligada={modo === 'posicionar'}
      aoTocar={() => useModoMesa.getState().alternar()} />
  )
}

/* Mesa digitalizadora (seção 15). Sem espelho, a área é só uma prancheta fosca: nada de tinta
   no celular, o traço aparece na tela do computador. Cada ponto do celular é o mesmo ponto da
   tela (absoluto). "Ver a tela" põe a tela do computador embaixo e a tinta aparece nela; só existe
   quando a conexão aguenta. */
export function TelaMesa({ verTela, aoVerTela }: { verTela: boolean; aoVerTela?: () => void }) {
  const [atual, setAtual] = useState<Ponto[] | null>(null)
  const [mira, setMira] = useState<Ponto | null>(null)
  const ativo = useRef(false)
  const traco = useRef<Ponto[]>([])
  const area = useRef<HTMLDivElement>(null)
  const { largura } = useTamanho(area)
  const local = (e: React.PointerEvent<HTMLElement>): Ponto => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    return { x, y, p: e.pressure && e.pointerType !== 'mouse' ? e.pressure : 0.5 }
  }
  /* cada toque leva o cursor do computador ao mesmo ponto; no modo desenhar, também pinta */
  const passo = (e: React.PointerEvent<HTMLElement>, primeiro: boolean) => {
    const p = local(e)
    useSim.getState().colocarCursor(p.x, p.y)
    setMira(p)
    if (useModoMesa.getState().modo !== 'desenhar') return
    traco.current = primeiro ? [p] : [...traco.current, p]
    setAtual(traco.current)
  }
  const baixar = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    ativo.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    passo(e, true)
  }
  const mover = (e: React.PointerEvent<HTMLElement>) => { if (ativo.current) passo(e, false) }
  const soltar = () => {
    if (!ativo.current) return
    ativo.current = false
    const t = traco.current
    traco.current = []
    setAtual(null)
    setMira(null)
    if (t.length > 1) useSim.getState().desenhar(t)
  }
  return (
    <div className="cel-mesa-raiz" data-lab="15">
      <div ref={area} className={`cel-mesa-area${verTela ? ' cel-mesa-tela' : ''}`} role="application"
        aria-label="Mesa digitalizadora: cada ponto do celular é um ponto da tela"
        onPointerDown={baixar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
        {verTela && largura > 0 && (
          <div className="cel-mesa-fundo" style={{ transform: `scale(${largura / DESENHO_COMPUTADOR.largura})` }}><DesktopFalso /></div>
        )}
        {verTela && atual && (
          <svg viewBox="0 0 1000 625" preserveAspectRatio="none" aria-hidden="true">
            <path d={caminho(atual)} strokeWidth={larguraDoTraco(atual)} />
          </svg>
        )}
        {mira && <span className="cel-mesa-mira" style={{ left: `${mira.x * 100}%`, top: `${mira.y * 100}%` }} aria-hidden="true" />}
      </div>
      <div className="cel-mesa-barra">
        {aoVerTela && (
          <button type="button" className="cel-mesa-botao" aria-pressed={verTela} onClick={() => { vibrar(8); aoVerTela() }}>
            <Icone nome="tela" tamanho={20} /><span>{verTela ? 'Esconder a tela' : 'Ver a tela'}</span>
          </button>
        )}
        <button type="button" className="cel-mesa-botao" onClick={() => { vibrar(8); useSim.getState().limparDesenho() }}>
          <Icone nome="fechar" tamanho={20} /><span>Limpar desenho</span>
        </button>
      </div>
    </div>
  )
}

export function podeVerTela() {
  return liberado(3, nivelAtual(useSim.getState().preset))
}
export { caminho }
