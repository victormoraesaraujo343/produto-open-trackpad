# OpenTrackpad — guia do projeto

Spec: `docs/superpowers/specs/2026-10-21-escopo-novo-opentrackpad-design.md` ·
plano da fase atual: `docs/superpowers/plans/2026-10-21-prototipo-visual.md`.

## Fase atual: protótipo visual (fase 2 do spec)
- Site Vite + React + TypeScript. A bancada mostra o celular deitado (desenhado a 780 × 360 e
  escalado) ao lado de um computador falso; os dois leem o mesmo estado simulado (`src/sim/`).
- `/celular` mostra só o celular, para abrir num celular de verdade pela rede local.
- Identidade: **só a identidade** metalizada (`docs/referencias/opentrackpad-aluminio.html`, tokens em
  `src/design/tokens.css`): cores (alumínio escuro e claro, LED verde para "ligado", laranja de destaque),
  materiais (grão, chanfro, profundidade), tipografia Archivo, traço dos ícones. **Nenhuma tela, layout ou
  controle da v1** (trilhos de teclas, anel de atalhos, botão redondo, disco, faders, painéis): telas e controles
  nascem do zero no laboratório. A identidade grafite + limão da v0.2 também não entra.
- **Usabilidade e acessibilidade acima do estilo**: toque ≥ 48 dp no celular e ≥ 44 px no computador; contraste
  WCAG AA (4,5:1 texto, 3:1 ícone e borda; `--ink-4` nunca em texto); estado nunca só por cor; nome acessível
  e foco visível; computador usável pelo teclado; "reduzir movimento" e tamanho de fonte respeitados; vibração
  sempre com resposta visual; o essencial ao alcance do polegar e sem mudar de lugar.
- Interface em pt-BR, frases curtas, sem texto que explique a interface.
- O Victor **não é dev**: revisa telas no laboratório, nunca código. Perguntas a ele, só de produto.
- Commits sim, **push não**: o dono decide quando o histórico novo vai para o GitHub.

## Laboratório (painel de Refinamento)
- `npm run lab`, tecla **R**. Seções e variações em `src/lab/secoes.ts`; marcar a tela com
  `data-lab="n"`; ler a variação com `useVariante('chave')`. A primeira opção é a proposta.
- Anotações do Victor: `laboratorio/app/ANOTACOES.md` e `anotacoes.json` (inclui alfinetes).
  Protocolo: `laboratorio/refinamento/README.md`.
- Ao fechar rodada: ler tudo (inclusive alfinetes), trazer síntese, só executar depois do "pode fazer".
- **Nunca rodar teste que grave no `anotacoes.json` real** (interceptar `/__lab/**`).

## Notas de trabalho
- `?v=chave:opcao,chave2:opcao` no endereço (só em dev) força variações sem mexer no painel nem nas anotações do Victor. Útil para conferir telas e é o que o passeio Playwright usa.
- O passeio (`npm run e2e`) intercepta `/__lab/**`: nunca grava no `anotacoes.json` real. Ele passa por todas as seções em 3 larguras e por todas as variações.
- Parado por 20 s, o celular entra na tela de descanso (ou escurece). Qualquer toque volta.
- O painel agrupa as seções pelo uso (Base visual, Celular · …, Computador) e filtra por grupo. Ao criar seção nova, dê `grupo` e um número novo; nunca renumere (as anotações apontam para o número).
- Melhorias abertas para validar: issues #4 a #11 no GitHub (já com uma primeira versão no protótipo).
- Registro das decisões tomadas durante a construção: `docs/superpowers/registro-prototipo-visual.md`.

## Comandos
`npm test` (vitest) · `npm run typecheck` · `npm run e2e` (Playwright) · `npm run lab`
