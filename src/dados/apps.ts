/* Apps reais como conteúdo de exemplo. `chamada` marca os apps de reunião (abre o modo reunião). */
export const APPS = {
  area: { nome: 'Área de trabalho', cor: '#5E6165' },
  firefox: { nome: 'Firefox', cor: '#FF7139' },
  vscode: { nome: 'Visual Studio Code', cor: '#2F80ED' },
  figma: { nome: 'Figma', cor: '#A259FF' },
  spotify: { nome: 'Spotify', cor: '#1DB954' },
  obs: { nome: 'OBS Studio', cor: '#8E8E93' },
  discord: { nome: 'Discord', cor: '#5865F2' },
  davinci: { nome: 'DaVinci Resolve Studio', cor: '#E0533A' },
  meet: { nome: 'Google Meet', cor: '#00AC47', chamada: true },
  arquivos: { nome: 'Arquivos', cor: '#C9A227' },
} as const satisfies Record<string, { nome: string; cor: string; chamada?: boolean }>

export type AppId = keyof typeof APPS

export const ehChamada = (a: AppId) => 'chamada' in APPS[a]
