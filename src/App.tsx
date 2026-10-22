import { Bancada } from './bancada/Bancada'
import { BarraSimulacao } from './bancada/BarraSimulacao'
import { DesktopFalso } from './bancada/DesktopFalso'
import { MolduraCelular } from './bancada/MolduraCelular'
import { Aviso } from './kit/Aviso'
import { SuperficieTrackpad } from './kit/SuperficieTrackpad'

/* Provisório até a R1: só a superfície, sem nenhum layout de tela. */
function TelaDoCelular() {
  return (
    <div data-lab="1" style={{ position: 'absolute', inset: 0, padding: 12, display: 'flex' }}>
      <SuperficieTrackpad />
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
