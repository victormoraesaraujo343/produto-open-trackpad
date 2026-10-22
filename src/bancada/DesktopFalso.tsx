import { IconeApp } from '../kit/IconeApp'
import { APPS } from '../dados/apps'
import { JANELAS } from '../dados/janelas'
import { useSim } from '../sim/loja'
import { caminho, larguraDoTraco } from '../celular/entrada/TelaMesa'
import { DESENHO_COMPUTADOR } from './MolduraComputador'
import './desktop-falso.css'

/* O computador de mentira: a área de trabalho do sistema escolhido, algumas janelas e o
   cursor que o trackpad do celular move. O espelho do celular mostra este mesmo componente. */
const POSICOES = [
  { left: 70, top: 64, width: 560, height: 360 },
  { left: 330, top: 150, width: 520, height: 330 },
  { left: 170, top: 230, width: 460, height: 280 },
]

function Relogio() {
  return <span className="df-relogio">13:52</span>
}

export function DesktopFalso() {
  const sistema = useSim((s) => s.sistema)
  const cursor = useSim((s) => s.cursor)
  const foco = useSim((s) => s.appEmFoco)
  const texto = useSim((s) => s.textoDigitado)
  const tracos = useSim((s) => s.tracos)
  const focoJanela = JANELAS.find((j) => j.app === foco)
  const janelas = [...JANELAS.slice(0, 3).filter((j) => j.id !== focoJanela?.id), ...(focoJanela ? [focoJanela] : [JANELAS[0]])].slice(-3)
  const doca = ['firefox', 'vscode', 'figma', 'spotify', 'meet', 'obs', 'arquivos'] as const
  return (
    <div className={`df df-${sistema}`} style={{ width: DESENHO_COMPUTADOR.largura, height: DESENHO_COMPUTADOR.altura }}>
      {sistema === 'macos' && (
        <div className="df-menu"><b>{APPS[foco].nome}</b><span>Arquivo</span><span>Editar</span><span>Janela</span><span className="df-dir"><Relogio /></span></div>
      )}
      {janelas.map((j, i) => (
        <div key={j.id} className={`df-janela${j === janelas[janelas.length - 1] ? ' df-ativa' : ''}`} style={POSICOES[i]}>
          <div className="df-titulo">
            <span className="df-botoes" aria-hidden="true"><i /><i /><i /></span>
            <span className="df-nome">{j.titulo}</span>
          </div>
          <div className="df-corpo" style={{ ['--cor' as string]: APPS[j.app].cor }}>
            <div className="df-linhas"><i /><i /><i /><i /><i /></div>
          </div>
        </div>
      ))}
      {tracos.length > 0 && (
        <div className="df-janela df-ativa df-desenho">
          <div className="df-titulo"><span className="df-botoes" aria-hidden="true"><i /><i /><i /></span><span className="df-nome">Desenho — Figma</span></div>
          <svg viewBox="0 0 1000 625" preserveAspectRatio="none" aria-hidden="true">{tracos.map((t, i) => <path key={i} d={caminho(t)} strokeWidth={larguraDoTraco(t)} />)}</svg>
        </div>
      )}
      {texto && (
        <div className="df-janela df-ativa df-notas">
          <div className="df-titulo"><span className="df-botoes" aria-hidden="true"><i /><i /><i /></span><span className="df-nome">Notas</span></div>
          <p>{texto}<i className="df-caret" /></p>
        </div>
      )}
      {sistema !== 'macos' ? (
        <div className="df-barra">
          <span className="df-inicio" aria-hidden="true" />
          <span className="df-icones">{doca.map((a) => <span key={a} className={`df-app${a === foco ? ' df-foco' : ''}`} title={APPS[a].nome}><IconeApp app={a} tamanho={24} /></span>)}</span>
          <span className="df-bandeja"><button type="button" className="df-otp" aria-label="Abrir o OpenTrackpad" onClick={() => useSim.getState().irParaPc('central')} /><Relogio /></span>
        </div>
      ) : (
        <div className="df-doca">{doca.map((a) => <span key={a} className={`df-app${a === foco ? ' df-foco' : ''}`} title={APPS[a].nome}><IconeApp app={a} tamanho={34} /></span>)}</div>
      )}
      <svg className="df-cursor" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }} width="18" height="24" viewBox="0 0 18 24" aria-hidden="true">
        <path d="M1 1v19l5-5 3.5 7.5 3-1.4L9 13.8h7z" fill="#fff" stroke="#000" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
