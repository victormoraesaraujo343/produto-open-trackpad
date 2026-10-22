import { useRef, type ReactNode } from 'react'
import { DESENHO_CELULAR, escalaDaMoldura } from '../design/escala'
import { useTamanho } from '../design/useTamanho'
import './moldura-celular.css'

const BORDA = 16
const APARELHO = { largura: DESENHO_CELULAR.largura + BORDA * 2, altura: DESENHO_CELULAR.altura + BORDA * 2 }

/* O aparelho deitado, desenhado a 780 × 360 e escalado inteiro para caber na área que recebe.
   `telaCheia` (rota /celular): sem corpo de aparelho, a tela ocupa a janela. */
export function MolduraCelular({ children, telaCheia = false, botoesLaterais }: { children: ReactNode; telaCheia?: boolean; botoesLaterais?: (qual: 'mais' | 'menos') => void }) {
  const area = useRef<HTMLDivElement>(null)
  const caixa = useTamanho(area)
  const desenho = telaCheia ? DESENHO_CELULAR : APARELHO
  const k = escalaDaMoldura(caixa, desenho)
  return (
    <div ref={area} className={`mc-area${telaCheia ? ' mc-cheia' : ''}`}>
      <div className="mc-encaixe" style={{ width: desenho.largura * k, height: desenho.altura * k }}>
        <div className="mc-aparelho" style={{ width: desenho.largura, height: desenho.altura, transform: `scale(${k})` }}>
          {!telaCheia && <span className="mc-camera" aria-hidden="true" />}
          {!telaCheia && botoesLaterais && (
            <div className="mc-laterais" data-lab="12">
              <button type="button" aria-label="Botão de volume do celular: aumentar" onClick={() => botoesLaterais('mais')} />
              <button type="button" aria-label="Botão de volume do celular: diminuir" onClick={() => botoesLaterais('menos')} />
            </div>
          )}
          <div className="mc-tela" data-tela-celular style={{ width: DESENHO_CELULAR.largura, height: DESENHO_CELULAR.altura }}>
            {children}
          </div>
        </div>
      </div>
      {telaCheia && <div className="mc-vire">Vire o celular</div>}
    </div>
  )
}
