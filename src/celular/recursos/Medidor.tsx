import { useTelemetria, METRICAS, type Metrica } from '../../sim/telemetria'
import type { EstiloMedidor } from '../../sim/loja'
import './recursos.css'

/* Um medidor de recurso do computador em 7 estilos (issue #11). O valor sempre vai também em
   texto (e no nome acessível), nunca só pela forma ou pela cor. */
export function Medidor({ metrica, estilo, grande = false }: { metrica: Metrica; estilo: EstiloMedidor; grande?: boolean }) {
  const leitura = useTelemetria((t) => t[metrica])
  const info = METRICAS[metrica]
  const v = leitura.valor
  const texto = info.texto(v)
  const alto = metrica === 'temperatura' ? v > 75 : v > 85
  const classe = `rc-medidor rc-${estilo}${grande ? ' rc-grande' : ''}${alto ? ' rc-alto' : ''}`
  const nome = <span className="rc-nome">{grande ? info.nome : info.curto}</span>
  const valor = <span className="rc-valor">{texto}</span>
  const aria = { role: 'meter', 'aria-label': info.nome, 'aria-valuenow': Math.round(v), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuetext': texto }

  if (estilo === 'anel') {
    const r = 40, c = 2 * Math.PI * r, arco = c * 0.75
    return (
      <div className={classe} {...aria}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={r} className="rc-trilho" strokeDasharray={`${arco} ${c}`} transform="rotate(135 50 50)" />
          <circle cx="50" cy="50" r={r} className="rc-arco" strokeDasharray={`${(arco * v) / 100} ${c}`} transform="rotate(135 50 50)" />
        </svg>
        <div className="rc-centro">{valor}{nome}</div>
      </div>
    )
  }
  if (estilo === 'ponteiro') {
    const ang = -120 + (240 * v) / 100
    return (
      <div className={classe} {...aria}>
        <svg viewBox="0 0 100 70" aria-hidden="true">
          {Array.from({ length: 13 }, (_, i) => {
            const a = ((-120 + i * 20 - 90) * Math.PI) / 180
            const r1 = i % 3 === 0 ? 34 : 37
            return <line key={i} x1={50 + 40 * Math.cos(a)} y1={56 + 40 * Math.sin(a)} x2={50 + r1 * Math.cos(a)} y2={56 + r1 * Math.sin(a)} className={i >= 10 ? 'rc-marca rc-marca-alta' : 'rc-marca'} />
          })}
          <line x1="50" y1="56" x2="50" y2="22" className="rc-agulha" style={{ transform: `rotate(${ang}deg)`, transformOrigin: '50px 56px' }} />
          <circle cx="50" cy="56" r="4.5" className="rc-eixo" />
        </svg>
        <div className="rc-rodape">{nome}{valor}</div>
      </div>
    )
  }
  if (estilo === 'grafico') {
    const h = leitura.historico
    const pts = h.map((x, i) => `${(i / (h.length - 1)) * 100},${40 - (x / 100) * 38}`).join(' ')
    return (
      <div className={classe} {...aria}>
        <div className="rc-topo">{nome}{valor}</div>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={`0,40 ${pts} 100,40`} className="rc-area" />
          <polyline points={pts} className="rc-linha" />
        </svg>
      </div>
    )
  }
  if (estilo === 'colunas') {
    const h = leitura.historico.slice(-20)
    return (
      <div className={classe} {...aria}>
        <div className="rc-topo">{nome}{valor}</div>
        <div className="rc-hist" aria-hidden="true">{h.map((x, i) => <i key={i} style={{ height: `${Math.max(4, x)}%` }} className={i === h.length - 1 ? 'rc-agora' : ''} />)}</div>
      </div>
    )
  }
  if (estilo === 'segmentos') {
    const n = 16
    return (
      <div className={classe} {...aria}>
        <div className="rc-topo">{nome}{valor}</div>
        <div className="rc-leds" aria-hidden="true">
          {Array.from({ length: n }, (_, i) => <i key={i} className={i < Math.round((v / 100) * n) ? (i >= n - 3 ? 'rc-pico' : i >= n - 6 ? 'rc-meio' : 'rc-aceso') : ''} />)}
        </div>
      </div>
    )
  }
  if (estilo === 'numero') {
    return (
      <div className={classe} {...aria}>
        <span className="rc-digitos">{texto}</span>
        {nome}
      </div>
    )
  }
  return (
    <div className={classe} {...aria}>
      <div className="rc-topo">{nome}{valor}</div>
      <span className="rc-barra-trilho" aria-hidden="true"><i style={{ width: `${v}%` }} /></span>
    </div>
  )
}

export const ESTILOS: [EstiloMedidor, string][] = [
  ['barra', 'Barra'], ['anel', 'Anel'], ['ponteiro', 'Ponteiro'], ['grafico', 'Gráfico'], ['segmentos', 'LEDs'], ['numero', 'Número'], ['colunas', 'Colunas'],
]
