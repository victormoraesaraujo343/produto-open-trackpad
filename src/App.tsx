import { Bancada } from './bancada/Bancada'
import { BarraSimulacao } from './bancada/BarraSimulacao'
import { DesktopFalso } from './bancada/DesktopFalso'
import { MolduraCelular } from './bancada/MolduraCelular'
import { Aviso } from './kit/Aviso'
import { SuperficieTrackpad } from './kit/SuperficieTrackpad'
import { Tecla } from './kit/Tecla'
import { Trilho } from './kit/Trilho'
import { useSim } from './sim/loja'

function TelaDoCelular() {
  const avisar = useSim((s) => s.avisar)
  return (
    <div data-lab="1" style={{ position: 'absolute', inset: 0, padding: 12, display: 'flex', gap: 12 }}>
      <Trilho lado="esquerda">
        <Tecla rotulo="copiar" icone="copiar" aoTocar={() => avisar('Copiar enviado')} />
        <Tecla rotulo="colar" icone="colar" aoTocar={() => avisar('Colar enviado')} />
      </Trilho>
      <SuperficieTrackpad />
      <Trilho lado="direita">
        <Tecla rotulo="mic" icone="microfone" led aoTocar={() => avisar('Microfone')} />
        <span />
        <span />
        <span />
        <Tecla rotulo="Modos" icone="rapido" destaque aoTocar={() => avisar('Modos')} />
      </Trilho>
      <Aviso />
    </div>
  )
}

export default function App() {
  if (location.pathname.startsWith('/celular')) {
    return <MolduraCelular telaCheia><TelaDoCelular /></MolduraCelular>
  }
  return <Bancada barra={<BarraSimulacao />} celular={<TelaDoCelular />} computador={<DesktopFalso />} />
}
