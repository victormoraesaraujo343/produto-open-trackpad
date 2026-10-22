import { useState } from 'react'
import { COMPUTADORES } from '../../dados/computadores'
import { Icone } from '../../kit/Icone'
import { Led } from '../../kit/Led'
import { Poco } from '../../kit/Poco'
import { Tecla } from '../../kit/Tecla'
import { useVariante } from '../../lab/refinamento'
import type { PresetId } from '../../sim/conexao'
import { useSim } from '../../sim/loja'

export const CODIGO = '4821'

/* Sem conexão: parear pela primeira vez ou voltar a conectar (seção 6). */
export function TelaConexao() {
  const forma = useVariante('pareamento')
  if (forma === 'lista') return <PorPerto />
  if (forma === 'passos') return <Passos />
  return <LerQr />
}

function concluir(p: PresetId) {
  const s = useSim.getState()
  s.conectar(p)
  s.irParaPc('area')
  s.avisar('Conectado')
}

function LerQr() {
  return (
    <div className="cel-conexao cel-conexao-qr" data-lab="6">
      <div className="cel-visor" aria-hidden="true"><i /><i /><i /><i /><span className="cel-visor-linha" /></div>
      <div className="cel-conexao-texto">
        <h2>Aponte para o código na tela do computador</h2>
        <p>Abra o OpenTrackpad no computador. O código aparece sozinho.</p>
        <Tecla rotulo="Simular leitura do código" icone="qr" className="cel-tecla-texto" aoTocar={() => concluir('wifi6')} />
      </div>
    </div>
  )
}

function PorPerto() {
  const [pedido, setPedido] = useState<string | null>(null)
  const pc = COMPUTADORES.find((c) => c.id === pedido)
  if (pc) {
    return (
      <div className="cel-conexao" data-lab="6">
        <div className="cel-conexao-texto">
          <h2>Confirme no computador</h2>
          <p>Em <b>{pc.nome}</b>, confira se o código é este:</p>
          <div className="cel-codigo" aria-label={`Código ${CODIGO.split('').join(' ')}`}>{CODIGO.split('').map((d, i) => <span key={i}>{d}</span>)}</div>
          <button type="button" className="cel-texto-botao" onClick={() => setPedido(null)}>Escolher outro computador</button>
        </div>
      </div>
    )
  }
  return (
    <div className="cel-conexao" data-lab="6">
      <div className="cel-conexao-texto">
        <h2>Computadores por perto</h2>
        <p>Na mesma rede Wi-Fi, com o OpenTrackpad aberto.</p>
      </div>
      <Poco className="cel-lista-pcs">
        {COMPUTADORES.map((c) => (
          <button key={c.id} type="button" className="cel-pc" onClick={() => { if (c.confiavel) concluir('wifi6'); else { setPedido(c.id); useSim.getState().irParaPc('pareamento') } }}>
            <Icone nome="computador" />
            <span className="cel-pc-nome">{c.nome}</span>
            <span className="cel-pc-estado">{c.confiavel ? <><Led aceso /> conhecido</> : 'novo'}</span>
          </button>
        ))}
      </Poco>
    </div>
  )
}

const VIAS: { id: 'cabo' | 'wifi' | 'roteador'; nome: string; icone: string; passos: string[]; preset: PresetId }[] = [
  { id: 'cabo', nome: 'Cabo', icone: 'usb', preset: 'usb3', passos: ['Ligue o celular no computador pelo cabo.', 'No celular, permita o acesso quando ele perguntar.'] },
  { id: 'wifi', nome: 'Mesmo Wi-Fi', icone: 'wifi', preset: 'wifi6', passos: ['Deixe os dois na mesma rede Wi-Fi.', 'Escolha o computador na lista que aparece.'] },
  { id: 'roteador', nome: 'Celular como roteador', icone: 'roteador', preset: 'roteador', passos: ['Ligue o roteador do celular.', 'No computador, entre na rede do celular.'] },
]

function Passos() {
  const [via, setVia] = useState<(typeof VIAS)[number] | null>(null)
  if (via) {
    return (
      <div className="cel-conexao" data-lab="6">
        <div className="cel-conexao-texto">
          <h2>{via.nome}</h2>
          <ol className="cel-passos">{via.passos.map((p) => <li key={p}>{p}</li>)}</ol>
          <div className="cel-acoes">
            <button type="button" className="cel-texto-botao" onClick={() => setVia(null)}>Voltar</button>
            <Tecla rotulo="Conectar" icone={via.icone} className="cel-tecla-texto cel-tecla-principal" aoTocar={() => concluir(via.preset)} />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="cel-conexao" data-lab="6">
      <div className="cel-conexao-texto"><h2>Como ligar no computador?</h2></div>
      <div className="cel-vias">
        {VIAS.map((v) => <Tecla key={v.id} rotulo={v.nome} icone={v.icone} className="cel-via" aoTocar={() => setVia(v)} />)}
      </div>
    </div>
  )
}
