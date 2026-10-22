/* Conexão simulada. Os números são de mentira (marcados como simulação na barra);
   o que importa é o nível que cada um libera, como no spec:
   1 [L] leve, qualquer conexão · 2 [M] médio, estável · 3 [P] pesado, cabo rápido ou Wi-Fi recente. */
export type Nivel = 0 | 1 | 2 | 3
export type PresetId = 'usb3' | 'usb2' | 'wifi6' | 'wifi4' | 'roteador' | 'congestionado' | 'nenhuma'
export type Via = 'cabo' | 'wifi' | 'roteador' | 'nenhuma'

export interface Preset { rotulo: string; mbps: number; atrasoMs: number; via: Via }

export const PRESETS: Record<PresetId, Preset> = {
  usb3: { rotulo: 'Cabo USB 3', mbps: 300, atrasoMs: 2, via: 'cabo' },
  usb2: { rotulo: 'Cabo USB 2', mbps: 35, atrasoMs: 4, via: 'cabo' },
  wifi6: { rotulo: 'Wi-Fi 6', mbps: 200, atrasoMs: 8, via: 'wifi' },
  wifi4: { rotulo: 'Wi-Fi antigo', mbps: 12, atrasoMs: 30, via: 'wifi' },
  roteador: { rotulo: 'Celular como roteador', mbps: 60, atrasoMs: 12, via: 'roteador' },
  congestionado: { rotulo: 'Wi-Fi congestionado', mbps: 2, atrasoMs: 80, via: 'wifi' },
  nenhuma: { rotulo: 'Desconectado', mbps: 0, atrasoMs: 0, via: 'nenhuma' },
}

export const ROTULO_NIVEL: Record<Nivel, string> = { 0: '—', 1: 'L', 2: 'M', 3: 'P' }

export function nivelDe(c: { mbps: number; atrasoMs: number }): Nivel {
  if (c.mbps <= 0) return 0
  if (c.mbps >= 40 && c.atrasoMs <= 15) return 3
  if (c.mbps >= 5 && c.atrasoMs <= 40) return 2
  return 1
}

export function liberado(exigido: 1 | 2 | 3, atual: Nivel): boolean {
  return atual >= exigido
}

/* Telas pesadas perdem nitidez em vez de travar quando a conexão é mais fraca. */
export function qualidadeDe(c: { mbps: number }): 'alta' | 'média' {
  return c.mbps >= 150 ? 'alta' : 'média'
}
