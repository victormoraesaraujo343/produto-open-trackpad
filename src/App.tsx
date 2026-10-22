import { Bancada } from './bancada/Bancada'
import { BarraSimulacao } from './bancada/BarraSimulacao'
import { MolduraCelular } from './bancada/MolduraCelular'

function TelaDoCelular() {
  return <div className="tela-vazia" data-lab="1">opentrackpad</div>
}

function TelaDoComputador() {
  return null
}

export default function App() {
  if (location.pathname.startsWith('/celular')) {
    return <MolduraCelular telaCheia><TelaDoCelular /></MolduraCelular>
  }
  return <Bancada barra={<BarraSimulacao />} celular={<TelaDoCelular />} computador={<TelaDoComputador />} />
}
