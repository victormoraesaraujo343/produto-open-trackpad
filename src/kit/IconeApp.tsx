import { APPS, type AppId } from '../dados/apps'
import { Icone } from './Icone'
import './kit.css'

/* Ícone do app de cada janela. No produto, o computador reconhece o ícone real do app e o
   manda ao celular; aqui é um desenho simplificado na cor do app. Decorativo: quem usa dá o
   nome acessível. */
const GLIFO: Record<AppId, string> = {
  area: 'areas', firefox: 'globo', vscode: 'codigo', figma: 'componente', spotify: 'ondas',
  obs: 'gravar', discord: 'bolha', davinci: 'filme', meet: 'camera', arquivos: 'pasta',
}

export function IconeApp({ app, tamanho = 40 }: { app: AppId; tamanho?: number }) {
  return (
    <span className="k-icone-app" aria-hidden="true"
      style={{ width: tamanho, height: tamanho, borderRadius: tamanho * 0.24, ['--cor' as string]: APPS[app].cor }}>
      <Icone nome={GLIFO[app]} tamanho={Math.round(tamanho * 0.56)} />
    </span>
  )
}
