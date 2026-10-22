import type { AppId } from './apps'

/* `mod` vira Ctrl no Linux e no Windows e ⌘ no macOS. */
export interface Atalho { id: string; rotulo: string; teclas: string[]; icone: string }

export const ATALHOS: Record<string, Atalho> = {
  cliqueDireito: { id: 'cliqueDireito', rotulo: 'Clique direito', teclas: ['Clique direito'], icone: 'clique' },
  copiar: { id: 'copiar', rotulo: 'Copiar', teclas: ['mod', 'C'], icone: 'copiar' },
  colar: { id: 'colar', rotulo: 'Colar', teclas: ['mod', 'V'], icone: 'colar' },
  desfazer: { id: 'desfazer', rotulo: 'Desfazer', teclas: ['mod', 'Z'], icone: 'desfazer' },
  refazer: { id: 'refazer', rotulo: 'Refazer', teclas: ['mod', 'Shift', 'Z'], icone: 'refazer' },
  alttab: { id: 'alttab', rotulo: 'Trocar janela', teclas: ['Alt', 'Tab'], icone: 'trocar' },
  areas: { id: 'areas', rotulo: 'Áreas de trabalho', teclas: ['Super'], icone: 'areas' },
  maximizar: { id: 'maximizar', rotulo: 'Maximizar', teclas: ['Super', '↑'], icone: 'maximizar' },
  captura: { id: 'captura', rotulo: 'Captura de tela', teclas: ['Print'], icone: 'captura' },
  novaAba: { id: 'novaAba', rotulo: 'Nova aba', teclas: ['mod', 'T'], icone: 'mais' },
  fecharAba: { id: 'fecharAba', rotulo: 'Fechar aba', teclas: ['mod', 'W'], icone: 'fechar' },
  recarregar: { id: 'recarregar', rotulo: 'Recarregar', teclas: ['mod', 'R'], icone: 'recarregar' },
  terminal: { id: 'terminal', rotulo: 'Terminal', teclas: ['mod', '`'], icone: 'terminal' },
  buscarArquivo: { id: 'buscarArquivo', rotulo: 'Abrir arquivo', teclas: ['mod', 'P'], icone: 'buscar' },
  comentar: { id: 'comentar', rotulo: 'Comentar linha', teclas: ['mod', '/'], icone: 'comentar' },
  formatar: { id: 'formatar', rotulo: 'Formatar', teclas: ['Shift', 'Alt', 'F'], icone: 'formatar' },
  frame: { id: 'frame', rotulo: 'Frame', teclas: ['F'], icone: 'frame' },
  componente: { id: 'componente', rotulo: 'Componente', teclas: ['mod', 'Alt', 'K'], icone: 'componente' },
  agrupar: { id: 'agrupar', rotulo: 'Agrupar', teclas: ['mod', 'G'], icone: 'agrupar' },
  zoomAjustar: { id: 'zoomAjustar', rotulo: 'Ajustar zoom', teclas: ['Shift', '1'], icone: 'zoom' },
  play: { id: 'play', rotulo: 'Tocar / pausar', teclas: ['Espaço'], icone: 'play' },
  proxima: { id: 'proxima', rotulo: 'Próxima', teclas: ['mod', '→'], icone: 'proxima' },
  curtir: { id: 'curtir', rotulo: 'Curtir', teclas: ['Alt', 'Shift', 'B'], icone: 'curtir' },
  gravar: { id: 'gravar', rotulo: 'Gravar', teclas: ['mod', 'Shift', 'R'], icone: 'gravar' },
  cena1: { id: 'cena1', rotulo: 'Cena 1', teclas: ['F13'], icone: 'cena' },
  cena2: { id: 'cena2', rotulo: 'Cena 2', teclas: ['F14'], icone: 'cena' },
  cortar: { id: 'cortar', rotulo: 'Cortar no cursor', teclas: ['mod', 'B'], icone: 'cortar' },
  marcar: { id: 'marcar', rotulo: 'Marcador', teclas: ['M'], icone: 'marcador' },
  mudo: { id: 'mudo', rotulo: 'Microfone', teclas: ['mod', 'D'], icone: 'microfone' },
  camera: { id: 'camera', rotulo: 'Câmera', teclas: ['mod', 'E'], icone: 'camera' },
  mao: { id: 'mao', rotulo: 'Levantar a mão', teclas: ['mod', 'Alt', 'H'], icone: 'mao' },
  sair: { id: 'sair', rotulo: 'Sair da chamada', teclas: ['mod', 'Alt', 'Q'], icone: 'sair' },
  renomear: { id: 'renomear', rotulo: 'Renomear', teclas: ['F2'], icone: 'renomear' },
  novaPasta: { id: 'novaPasta', rotulo: 'Nova pasta', teclas: ['mod', 'Shift', 'N'], icone: 'pasta' },
}

/* Perfis prontos: os atalhos que aparecem quando cada app está em foco. */
export const PERFIS: Record<AppId, string[]> = {
  area: ['copiar', 'colar', 'alttab', 'areas', 'maximizar', 'captura', 'desfazer', 'refazer'],
  firefox: ['novaAba', 'fecharAba', 'recarregar', 'alttab', 'copiar', 'colar', 'captura', 'areas'],
  vscode: ['buscarArquivo', 'terminal', 'comentar', 'formatar', 'copiar', 'colar', 'desfazer', 'refazer'],
  figma: ['frame', 'componente', 'agrupar', 'zoomAjustar', 'copiar', 'colar', 'desfazer', 'refazer'],
  spotify: ['play', 'proxima', 'curtir', 'alttab', 'areas', 'captura', 'copiar', 'colar'],
  obs: ['gravar', 'cena1', 'cena2', 'mudo', 'captura', 'alttab', 'areas', 'maximizar'],
  discord: ['mudo', 'camera', 'alttab', 'copiar', 'colar', 'captura', 'areas', 'maximizar'],
  davinci: ['cortar', 'marcar', 'play', 'desfazer', 'refazer', 'copiar', 'colar', 'zoomAjustar'],
  meet: ['mudo', 'camera', 'mao', 'sair', 'alttab', 'captura', 'areas', 'maximizar'],
  arquivos: ['renomear', 'novaPasta', 'copiar', 'colar', 'desfazer', 'alttab', 'areas', 'captura'],
}

export const teclasDoSistema = (teclas: string[], sistema: 'linux' | 'windows' | 'macos') =>
  teclas.map((t) => (t === 'mod' ? (sistema === 'macos' ? '⌘' : 'Ctrl') : t === 'Super' ? (sistema === 'macos' ? '⌃' : sistema === 'windows' ? 'Win' : 'Super') : t))
