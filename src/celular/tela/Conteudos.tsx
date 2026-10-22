import { APPS } from '../../dados/apps'
import { DesktopFalso } from '../../bancada/DesktopFalso'
import { DESENHO_COMPUTADOR } from '../../bancada/MolduraComputador'
import { IconeApp } from '../../kit/IconeApp'

const { largura: L, altura: A } = DESENHO_COMPUTADOR
const MENSAGENS = [
  { quem: 'Renata Lobo', texto: 'subi o arquivo novo no canal' },
  { quem: 'Caio Prado', texto: 'vi aqui, ficou ótimo' },
  { quem: 'Renata Lobo', texto: 'amanhã a gente revisa junto?' },
  { quem: 'Você', texto: 'fechado, depois do almoço' },
]

/* O segundo monitor: a área de trabalho continua no celular, com o que foi arrastado para lá. */
export function MonitorExtra() {
  return (
    <div className="ct-tela ct-extra" style={{ width: L, height: A }}>
      <div className="ct-janela" style={{ left: 60, top: 60, width: 420, height: 500 }}>
        <div className="ct-titulo"><IconeApp app="discord" tamanho={18} />Discord — #geral</div>
        <Chat />
      </div>
      <div className="ct-janela" style={{ left: 520, top: 120, width: 440, height: 220 }}>
        <div className="ct-titulo"><IconeApp app="spotify" tamanho={18} />Spotify</div>
        <div className="ct-player"><span className="ct-capa" /><div><b>Anunciação</b><span>Alceu Valença</span></div></div>
      </div>
    </div>
  )
}

/* Uma janela só, ocupando a tela inteira do celular. */
export function JanelaUnica() {
  return (
    <div className="ct-tela ct-unica" style={{ width: L, height: A }}>
      <div className="ct-janela" style={{ left: 0, top: 0, width: L, height: A, borderRadius: 0 }}>
        <div className="ct-titulo"><IconeApp app="discord" tamanho={22} />{APPS.discord.nome} — #geral</div>
        <Chat grande />
      </div>
    </div>
  )
}

/* A mesma janela, desenhada em pé para o monitor vertical. */
export function JanelaEmPe() {
  return (
    <div className="ct-tela ct-empe">
      <div className="ct-titulo"><IconeApp app="discord" tamanho={18} />{APPS.discord.nome} — #geral</div>
      <Chat />
    </div>
  )
}

function Chat({ grande = false }: { grande?: boolean }) {
  return (
    <div className={`ct-chat${grande ? ' ct-chat-grande' : ''}`}>
      {MENSAGENS.map((m, i) => <p key={i} className={m.quem === 'Você' ? 'ct-eu' : ''}><b>{m.quem}</b>{m.texto}</p>)}
      <div className="ct-campo">Escreva em #geral</div>
    </div>
  )
}

/* Recorte: um pedaço fixo da tela, ampliado (aqui, o canto de cima à esquerda, 2×). */
export function Recorte() {
  return (
    <div className="ct-tela" style={{ width: L, height: A, overflow: 'hidden' }}>
      <div style={{ transform: 'scale(2)', transformOrigin: '0 0' }}><DesktopFalso /></div>
      <span className="ct-recorte-rotulo">Recorte 2× · canto superior esquerdo</span>
    </div>
  )
}
