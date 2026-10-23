import { Tecla } from '../../kit/Tecla'
import type { PresetId } from '../../sim/conexao'
import { useSim } from '../../sim/loja'

/* Sem conexão: parear pela primeira vez ou voltar a conectar (seção 6). O celular lê o código
   que o computador mostra. */
export function TelaConexao() {
  return (
    <div className="cel-conexao cel-conexao-qr" data-lab="6">
      <div className="cel-visor" aria-hidden="true"><i /><i /><i /><i /><span className="cel-visor-linha" /></div>
      <div className="cel-conexao-texto">
        <h2>Aponte para o código no computador</h2>
        <Tecla rotulo="Simular leitura do código" icone="qr" className="cel-tecla-texto" aoTocar={() => concluir('wifi6')} />
      </div>
    </div>
  )
}

function concluir(p: PresetId) {
  const s = useSim.getState()
  s.conectar(p)
  s.irParaPc('area')
  s.avisar('Conectado')
}
