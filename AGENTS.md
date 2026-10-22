# OpenTrackpad — guia do projeto

Spec: `docs/superpowers/specs/2026-10-21-escopo-novo-opentrackpad-design.md` ·
plano da fase atual: `docs/superpowers/plans/2026-10-21-prototipo-visual.md`.

## Fase atual: protótipo visual (fase 2 do spec)
- Site Vite + React + TypeScript. A bancada mostra o celular deitado (desenhado a 780 × 360 e
  escalado) ao lado de um computador falso; os dois leem o mesmo estado simulado (`src/sim/`).
- `/celular` mostra só o celular, para abrir num celular de verdade pela rede local.
- Identidade: **a metalizada** (`docs/referencias/opentrackpad-aluminio.html`, tokens em
  `src/design/tokens.css`). Alumínio escuro e claro com grão, chanfros, teclas físicas, LED verde
  para "ligado", laranja só para o destaque, fonte Archivo. A identidade grafite + limão da v0.2 não entra.
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

## Comandos
`npm test` (vitest) · `npm run typecheck` · `npm run e2e` (Playwright) · `npm run lab`
