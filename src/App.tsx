import { Bancada } from './bancada/Bancada'
import { BarraSimulacao } from './bancada/BarraSimulacao'
import { MolduraCelular } from './bancada/MolduraCelular'
import { apertarBotaoLateral, Celular } from './celular/Celular'
import { Computador } from './computador/Computador'

export default function App() {
  if (location.pathname.startsWith('/celular')) {
    return <MolduraCelular telaCheia><Celular /></MolduraCelular>
  }
  return <Bancada barra={<BarraSimulacao />} celular={<Celular />} computador={<Computador />} botoesLaterais={apertarBotaoLateral} />
}
