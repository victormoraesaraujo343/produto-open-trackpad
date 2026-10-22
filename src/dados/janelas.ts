import type { AppId } from './apps'

export interface Janela { id: string; app: AppId; titulo: string }

export const JANELAS: Janela[] = [
  { id: 'j1', app: 'vscode', titulo: 'Visual Studio Code — projeto-com-um-nome-bem-comprido-para-testar — Insiders' },
  { id: 'j2', app: 'firefox', titulo: 'Documentação do libinput — Firefox' },
  { id: 'j3', app: 'figma', titulo: 'OpenTrackpad — telas do celular' },
  { id: 'j4', app: 'spotify', titulo: 'Spotify — Alceu Valença · Anunciação' },
  { id: 'j5', app: 'meet', titulo: 'Reunião semanal de produto' },
  { id: 'j6', app: 'obs', titulo: 'OBS Studio 31 — Perfil: Aulas' },
  { id: 'j7', app: 'arquivos', titulo: 'Downloads' },
  { id: 'j8', app: 'discord', titulo: 'Discord — #geral' },
]
