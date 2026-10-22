import { useMemo } from 'react'
import { CELULARES } from '../dados/computadores'
import { useVariante } from '../lab/refinamento'
import { useSim } from '../sim/loja'
import { CODIGO } from '../celular/conexao/TelaConexao'
import { Janela } from './Janela'

const fechar = () => useSim.getState().irParaPc('area')
const permitir = () => { const s = useSim.getState(); s.conectar('wifi6'); s.irParaPc('area'); s.avisar('Conectado') }

/* O lado do computador no primeiro pareamento (seção 6). */
export function Pareamento() {
  const forma = useVariante('pareamento')
  if (forma === 'lista') {
    const cel = CELULARES[0]
    return (
      <Janela titulo="Parear um celular" aoFechar={fechar} largura={460} altura={300} lab="6">
        <div className="pc-pedido">
          <h2>{cel.nome} quer se conectar</h2>
          <p>Confira se o celular mostra o mesmo código.</p>
          <div className="pc-codigo">{CODIGO.split('').map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="pc-acoes">
            <button type="button" className="pc-botao" onClick={fechar}>Recusar</button>
            <button type="button" className="pc-botao pc-botao-principal" onClick={permitir}>Permitir</button>
          </div>
        </div>
      </Janela>
    )
  }
  if (forma === 'passos') {
    return (
      <Janela titulo="Parear um celular" aoFechar={fechar} largura={460} altura={300} lab="6">
        <div className="pc-pedido">
          <h2>Esperando o celular</h2>
          <p>Siga os passos que aparecem no celular. Esta janela fecha sozinha quando ele conectar.</p>
          <div className="pc-espera" aria-hidden="true"><i /><i /><i /></div>
        </div>
      </Janela>
    )
  }
  return (
    <Janela titulo="Parear um celular" aoFechar={fechar} largura={520} altura={360} lab="6">
      <div className="pc-qr-area">
        <Qr />
        <div>
          <h2>Aponte a câmera do celular</h2>
          <p>Abra o OpenTrackpad no celular. Ele lê este código e conecta sozinho, no cabo ou no Wi-Fi.</p>
        </div>
      </div>
    </Janela>
  )
}

/* Um QR desenhado (não é um código de verdade). */
function Qr() {
  const celulas = useMemo(() => {
    let x = 7
    return Array.from({ length: 21 * 21 }, (_, i) => {
      const lin = Math.floor(i / 21), col = i % 21
      const canto = (l: number, c: number) => l < 7 && c < 7 && (l === 0 || l === 6 || c === 0 || c === 6 || (l > 1 && l < 5 && c > 1 && c < 5))
      if (lin < 7 && col < 7) return canto(lin, col)
      if (lin < 7 && col > 13) return canto(lin, col - 14)
      if (lin > 13 && col < 7) return canto(lin - 14, col)
      x = (x * 1103515245 + 12345) % 2147483648
      return x % 3 === 0
    })
  }, [])
  return (
    <svg className="pc-qr" viewBox="-2 -2 25 25" width="200" height="200" role="img" aria-label="Código para o celular ler">
      <rect x="-2" y="-2" width="25" height="25" fill="#fff" />
      {celulas.map((on, i) => on && <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#111" />)}
    </svg>
  )
}
