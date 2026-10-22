/* Liga os endpoints do laboratório (/__lab/*, laboratorio/servidor.cjs) no servidor de dev do Vite.
   Só em `vite` / `npm run lab`; nada disso entra no build. */
import { createRequire } from 'node:module'

const lab = createRequire(import.meta.url)('./servidor.cjs')

export default function laboratorio() {
  return {
    name: 'laboratorio',
    apply: 'serve',
    /* gravar anotações não deve recarregar a página */
    config: () => ({
      server: { watch: { ignored: ['**/laboratorio/*/anotacoes.json', '**/laboratorio/*/ANOTACOES.md', '**/laboratorio/*/rodadas/**'] } },
    }),
    configureServer(server) {
      server.middlewares.use(lab.middleware)
    },
  }
}
