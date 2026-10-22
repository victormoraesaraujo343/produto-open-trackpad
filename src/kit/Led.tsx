import './kit.css'

/* LED embutido: verde aceso = ligado/funcionando; apagado = desligado. */
export function Led({ aceso, canto = false, cor }: { aceso: boolean; canto?: boolean; cor?: 'verde' | 'ambar' | 'laranja' }) {
  return <span className={`k-led${canto ? ' k-led-canto' : ''}${aceso ? ' k-aceso' : ''}${cor ? ` k-led-${cor}` : ''}`} aria-hidden="true"><i /></span>
}
