import type { ReactNode } from 'react'
import { MolduraCelular } from './MolduraCelular'
import { MolduraComputador } from './MolduraComputador'
import './bancada.css'

/* A bancada: o celular ao lado do computador falso, lendo o mesmo estado.
   Abaixo de 900 px de largura fica só o celular. */
export function Bancada({ celular, computador, barra, botoesLaterais }: { celular: ReactNode; computador: ReactNode; barra?: ReactNode; botoesLaterais?: (qual: 'mais' | 'menos') => void }) {
  return (
    <div className="bancada">
      {barra}
      <main className="bancada-mesa">
        <section className="bancada-celular" aria-label="Celular"><MolduraCelular botoesLaterais={botoesLaterais}>{celular}</MolduraCelular></section>
        <section className="bancada-computador" aria-label="Computador"><MolduraComputador>{computador}</MolduraComputador></section>
      </main>
    </div>
  )
}
