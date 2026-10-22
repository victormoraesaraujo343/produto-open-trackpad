import type { HTMLAttributes } from 'react'
import './kit.css'

/* Poço: área afundada no painel. */
export function Poco({ className = '', ...resto }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`k-poco ${className}`} {...resto} />
}
