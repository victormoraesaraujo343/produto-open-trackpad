import { useState } from 'react'
import { useSim } from '../sim/loja'
import { Janela } from './Janela'

const PERMISSAO = {
  linux: { titulo: 'Permitir o trackpad virtual', texto: 'O OpenTrackpad cria um touchpad de verdade no sistema. Para isso, ele precisa de permissão para criar dispositivos de entrada. Pede a senha uma vez só.', acao: 'Permitir' },
  windows: { titulo: 'Instalar o driver do trackpad', texto: 'Para o Windows tratar o celular como um touchpad de precisão, o OpenTrackpad instala um driver. Pede confirmação do administrador.', acao: 'Instalar o driver' },
  macos: { titulo: 'Liberar em Privacidade e Segurança', texto: 'Em Ajustes do Sistema › Privacidade e Segurança, ligue o OpenTrackpad em Acessibilidade e em Monitoramento de Entrada.', acao: 'Abrir os Ajustes' },
} as const

/* Assistente de primeira vez (seção 31): uma sequência curta, diferente em cada sistema. */
export function Assistente() {
  const sistema = useSim((s) => s.sistema)
  const [passo, setPasso] = useState(0)
  const [feito, setFeito] = useState(false)
  const fechar = () => useSim.getState().irParaPc('area')
  const p = PERMISSAO[sistema]
  const PASSOS = ['Boas-vindas', 'Permissão', 'Celular', 'Pronto']
  return (
    <Janela titulo="Bem-vindo ao OpenTrackpad" aoFechar={fechar} largura={620} altura={420} lab="31">
      <div className="pc-assistente">
        <ol className="pc-passos" aria-label="Passos">
          {PASSOS.map((n, i) => <li key={n} className={i === passo ? 'pc-passo-atual' : i < passo ? 'pc-passo-feito' : ''} aria-current={i === passo ? 'step' : undefined}><span>{i + 1}</span>{n}</li>)}
        </ol>
        <div className="pc-passo">
          {passo === 0 && (<>
            <h2>Seu celular antigo vira um trackpad</h2>
            <p>E também painel de atalhos, segunda tela e câmera. Leva dois minutos.</p>
          </>)}
          {passo === 1 && (<>
            <h2>{p.titulo}</h2>
            <p>{p.texto}</p>
            <button type="button" className="pc-botao" disabled={feito} onClick={() => setFeito(true)}>{feito ? 'Feito' : p.acao}</button>
          </>)}
          {passo === 2 && (<>
            <h2>Instale o app no celular</h2>
            <p>Abra a loja de apps do celular e procure por OpenTrackpad. Depois, ligue o cabo ou aponte a câmera para o código que vai aparecer.</p>
            <button type="button" className="pc-botao" onClick={() => useSim.getState().irParaPc('pareamento')}>Mostrar o código</button>
          </>)}
          {passo === 3 && (<>
            <h2>Pronto</h2>
            <ul className="pc-dicas">
              <li>Três dedos no celular trocam de área de trabalho, como num notebook.</li>
              <li>A tecla Modos, na lateral, leva a tudo: teclado, som, tela, câmera.</li>
              <li>O ícone na bandeja mostra se o celular está conectado.</li>
            </ul>
          </>)}
        </div>
        <div className="pc-acoes pc-assistente-rodape">
          <button type="button" className="pc-botao" disabled={passo === 0} onClick={() => setPasso(passo - 1)}>Voltar</button>
          {passo < 3
            ? <button type="button" className="pc-botao pc-botao-principal" disabled={passo === 1 && !feito} onClick={() => setPasso(passo + 1)}>Continuar</button>
            : <button type="button" className="pc-botao pc-botao-principal" onClick={fechar}>Começar</button>}
        </div>
      </div>
    </Janela>
  )
}
