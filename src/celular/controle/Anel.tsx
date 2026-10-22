/* Anel graduado de 270°: trilho rebaixado, arco do valor aceso, marcas a cada passo e um botão
   central em relevo. Desenho novo desta versão (não é o disco da v1). */
export function Anel({ valor, tamanho = 200, marcas = 27, rotulo, detalhe }: { valor: number; tamanho?: number; marcas?: number; rotulo?: string; detalhe?: string }) {
  const r = 44, c = 50, ini = 135, varre = 270
  const pt = (a: number, raio = r) => { const t = (a * Math.PI) / 180; return [c + raio * Math.cos(t), c + raio * Math.sin(t)] }
  const arco = (fim: number) => { const [x0, y0] = pt(ini); const [x1, y1] = pt(ini + fim); return `M${x0} ${y0} A${r} ${r} 0 ${fim > 180 ? 1 : 0} 1 ${x1} ${y1}` }
  return (
    <div className="cel-anel" style={{ width: tamanho, height: tamanho }}>
      <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} aria-hidden="true">
        <path d={arco(varre)} className="cel-anel-trilho" />
        {valor > 0 && <path d={arco((varre * valor) / 100)} className="cel-anel-valor" />}
        {Array.from({ length: marcas + 1 }, (_, i) => {
          const a = ini + (varre * i) / marcas
          const [x0, y0] = pt(a, 38); const [x1, y1] = pt(a, i % 9 === 0 ? 33 : 35)
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className={(i / marcas) * 100 <= valor ? 'cel-anel-marca acesa' : 'cel-anel-marca'} />
        })}
      </svg>
      <div className="cel-anel-botao">
        {rotulo && <span className="cel-anel-rotulo">{rotulo}</span>}
        <span className="cel-anel-valor-texto">{Math.round(valor)}%</span>
        {detalhe && <small>{detalhe}</small>}
      </div>
    </div>
  )
}
