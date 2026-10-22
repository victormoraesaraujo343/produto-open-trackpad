import type { HTMLAttributes } from 'react'
import './kit.css'

/* Módulo: peça elevada sobre o painel (folhas, menus). */
export function Modulo({ className = '', ...resto }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`k-modulo ${className}`} {...resto} />
}
