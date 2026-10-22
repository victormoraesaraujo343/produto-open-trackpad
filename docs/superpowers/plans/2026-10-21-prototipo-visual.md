# OpenTrackpad — Protótipo visual (fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um site interativo que mostra o OpenTrackpad inteiro (as telas do celular e as do computador), com a identidade metalizada, dados de mentira, conexão simulada e o painel de Refinamento para o Victor anotar e escolher variações.

**Architecture:** Vite + React + TypeScript. A página principal é uma **bancada**: um celular deitado (desenhado a 780 × 360 e escalado) ao lado de um computador falso, os dois lendo o mesmo estado simulado (`zustand`): tipo de conexão, sistema do computador, app em foco, posição do cursor. Mexer no trackpad do celular move o cursor do computador falso; trocar a conexão libera ou esconde as funções pesadas. Uma rota `/celular` mostra só o celular em tela cheia, para abrir num celular de verdade pela rede local e sentir os protótipos "ver na prática". O painel de Refinamento é uma cópia do laboratório do Bora Vê, ligada ao servidor de dev do Vite.

**Tech Stack:** Vite (template `react-ts` atual de `npm create vite@latest`), React, TypeScript, zustand, @fontsource/archivo, vitest + @testing-library/react + jsdom (lógica e peças), Playwright (passeio pelas telas).

**Spec:** `docs/superpowers/specs/2026-10-21-escopo-novo-opentrackpad-design.md`

## Global Constraints

- Interface em **pt-BR**, frases curtas, sem texto que explique a interface (no máximo uma linha de apoio por tela). Nome do produto: **OpenTrackpad**.
- Identidade: **só a identidade** metalizada do artifact "OpenTrackpad em Alumínio" (cópia em `docs/referencias/opentrackpad-aluminio.html`, criada no Task 1): cores (alumínio escuro e claro, LED verde `#9BE23F` para "ligado", laranja `#FF4F1F` de destaque e foco), materiais (grão, chanfro em gradiente, profundidade e sombras), tipografia **Archivo** e traço dos ícones. **Nenhuma tela, layout ou controle da v1** (trilhos de teclas, anel de atalhos, botão redondo laranja, disco, faders, painéis): telas e controles nascem do zero. A identidade grafite + verde-limão da v0.2 também não entra.
- **Usabilidade e acessibilidade acima do estilo** (spec): alvo de toque ≥ 48 dp no celular e ≥ 44 px no computador; contraste WCAG AA (4,5:1 texto, 3:1 ícones e bordas de controle); estado nunca só por cor; nome acessível e foco visível em todo controle; telas do computador usáveis pelo teclado; "reduzir movimento" e tamanho de fonte respeitados; vibração sempre com resposta visual; o essencial fica ao alcance do polegar e não muda de lugar.
- Celular sempre **deitado** nas telas de uso, desenhado a **780 × 360** (um celular de 6,7" deitado) e escalado inteiro, sem refluir. Exceção: "monitor vertical", que gira o celular.
- O celular pode ser Android ou iPhone e o computador Linux, Windows ou macOS: a barra de simulação troca os dois e o cromo muda junto (barra de status e gesto do celular; bandeja, barra de título e botões da janela do computador).
- Toque mínimo 44 px (em unidades da moldura). Movimento curto (120–260 ms) e respeitando "reduzir movimento".
- Vibração: `navigator.vibrate` quando existir (Android); sempre com resposta visual também, porque iPhone e computador não vibram.
- Níveis de conexão do spec: **[L] leve** (qualquer conexão), **[M] médio** (estável), **[P] pesado** (cabo rápido ou Wi-Fi recente). Toda tela declara seu nível; tela que a conexão atual não aguenta não aparece (ou aparece apagada na navegação, nunca quebrada).
- Dados de mentira realistas: apps reais como conteúdo (Firefox, Spotify, VS Code, Figma, OBS, Discord, DaVinci Resolve), pessoas e computadores com nomes inventados. Nada de número ou fato inventado sobre o produto; os valores de conexão aparecem marcados como simulação.
- **Nunca rodar teste que grave no `laboratorio/*/anotacoes.json` real** (interceptar `/__lab/**` no Playwright).
- O Victor não é dev: ele revisa telas no laboratório, nunca código. Perguntas a ele, só de produto.
- Commits sim, **push não** (o dono decide quando o histórico novo vai para o GitHub).

## Review Focus

- **Celular de verdade em pé ou tela estreita (320–390 px)** → a bancada vira só o celular escalado; em retrato aparece "vire o celular" (menos no monitor vertical). Nada rola na horizontal. Teste de `escalaDaMoldura` no Task 1 e passeio em 320/390 no Task 12.
- **A conexão piora enquanto uma tela pesada está aberta** (espelhando e cai para Wi-Fi congestionado) → volta ao trackpad com um aviso curto; o trackpad continua respondendo. Teste `conectar rebaixa a tela` no Task 3.
- **Nomes longos** (janela "Visual Studio Code — projeto-com-nome-enorme — Insiders", computador "Estação-de-trabalho-do-escritório") → reticências, nada empurra tecla para fora. Os dados do Task 3 incluem esses nomes; o Task 12 confere que nada vaza.
- **Painel ou folha aberta por cima de teclas** → nenhum toque atravessa para a tecla de baixo (foi o defeito #2 da v0.2). Teste `Camada bloqueia toques` no Task 4.
- **"Ir para a seção" de uma tela que depende de estado** (espelho exige conexão [P]; reunião exige app de chamada em foco) → o atalho do painel monta o estado necessário antes de navegar. Teste de `irParaSecao` no Task 5.

---

## Estrutura de arquivos

```
OpenTrackPad/                     # histórico novo (branch órfã), v0.2 guardada na tag v0.2-archive
  index.html
  package.json  vite.config.ts  tsconfig*.json  vitest.config.ts  playwright.config.ts
  LICENSE  README.md  AGENTS.md  CLAUDE.md (só "@AGENTS.md")
  docs/
    referencias/opentrackpad-aluminio.html   # cópia da identidade de referência
    superpowers/specs/…  superpowers/plans/…
  laboratorio/
    refinamento/  painel.js painel.css painel.d.ts escolhas.js README.md   # cópia do Bora Vê
    servidor.cjs                              # endpoints /__lab/* (cópia adaptada)
    plugin-vite.mjs                           # liga servidor.cjs no servidor de dev do Vite
    app/                                      # anotações geradas pelo painel (anotacoes.json, ANOTACOES.md, rodadas/)
  src/
    main.tsx  App.tsx                         # rotas: "/" bancada, "/celular" só o celular
    design/
      tokens.css                              # acabamentos [data-acabamento="escuro"|"claro"], grão, chanfros, sombras
      fontes.ts                               # importa @fontsource/archivo
      escala.ts                               # escalaDaMoldura()
    kit/                                      # peças metalizadas, uma por arquivo
      Tecla.tsx Trilho.tsx Led.tsx Chave.tsx Segmentado.tsx Fader.tsx Poco.tsx Modulo.tsx
      Camada.tsx Aviso.tsx Disco.tsx SuperficieTrackpad.tsx Icone.tsx
    sim/
      conexao.ts                              # PRESETS, nivelDe(), liberado()
      telas.ts                                # catálogo de telas do celular e do PC, com nível
      loja.ts                                 # useSim (zustand): estado e ações
      vibrar.ts
    dados/
      apps.ts  atalhos.ts  janelas.ts  audio.ts  notificacoes.ts  agenda.ts  computadores.ts
    bancada/
      Bancada.tsx  MolduraCelular.tsx  MolduraComputador.tsx  BarraSimulacao.tsx
      DesktopFalso.tsx                        # o "computador" que o espelho reproduz
    celular/                                  # uma pasta por área de telas do celular
      trackpad/ atalhos/ tela/ ponte/ entrada/ conexao/ ajustes/ aparelho/ navegacao/
    computador/
      bandeja/ central/ assistente/ gravador/ pareamento/
    lab/
      secoes.ts  refinamento.ts  rotas.ts
  tests/
    lab.test.ts  conexao.test.ts  loja.test.ts  escala.test.ts  kit.test.tsx  rotas.test.ts
    e2e/passeio.spec.ts
```

---

### Task 1: Recomeço do repositório, esqueleto e bancada vazia

**Files:**
- Create: tudo de base listado acima até `src/bancada/` (sem telas ainda), `docs/referencias/opentrackpad-aluminio.html`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `tests/escala.test.ts`
- Keep from v0.2: `LICENSE`, `docs/superpowers/` (spec e este plano)

**Interfaces:**
- Produces: `escalaDaMoldura(caixa: { largura: number; altura: number }, desenho?: { largura: number; altura: number }): number` em `src/design/escala.ts` (padrão do desenho 780 × 360; devolve o fator que cabe inteiro na caixa, no máximo 1,6). `MolduraCelular({ children })`, `MolduraComputador({ children })`, `Bancada()`. Atributo `data-acabamento="escuro" | "claro"` no `<html>`.

- [ ] **Step 1: Guardar a v0.2 e abrir o histórico novo**

```bash
git tag -a v0.2-archive -m "OpenTrackpad v0.2, guardado antes do recomeço (2026-10-21)"
git checkout --orphan recomeco
git rm -rq --cached . && git clean -fdq -e docs/superpowers
git checkout v0.2-archive -- LICENSE
```
Expected: `git status` mostra só `LICENSE` e `docs/superpowers/` não rastreados/novos. `git tag` lista `v0.2-archive`. Nada é enviado ao GitHub.

- [ ] **Step 2: Esqueleto Vite**

`npm create vite@latest . -- --template react-ts` (aceitar a pasta não vazia), depois `npm install zustand @fontsource/archivo` e `npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @playwright/test`. `vitest.config.ts`: `environment: 'jsdom'`, `globals: true`, `setupFiles` importando `@testing-library/jest-dom/vitest`, `exclude` incluindo `tests/e2e/**`. Scripts no `package.json`: `"lab": "vite --host"`, `"test": "vitest run"`, `"typecheck": "tsc -b --noEmit"`, `"e2e": "playwright test"`. Remover o conteúdo de exemplo do template.

- [ ] **Step 3: Copiar a referência visual**

Copiar `/home/victor/.claude/projects/-home-victor-Documents-Projetos-Produtos-OpenTrackPad/c09056d0-2f05-4c88-a8c0-b142ed451f73/tool-results/artifact-82302f31-1788042436-503c.html` para `docs/referencias/opentrackpad-aluminio.html` (se o arquivo não existir mais, baixar de novo com a ferramenta Artifact, `action: "read"`, url `https://claude.ai/artifact/H5RKqhyPBYRie91C5CUuRt`).

- [ ] **Step 4: Escrever o teste de escala**

```ts
// tests/escala.test.ts
import { escalaDaMoldura } from '../src/design/escala'
test('cabe inteiro numa tela larga', () => expect(escalaDaMoldura({ largura: 1560, altura: 900 })).toBeCloseTo(1.6))
test('encolhe para caber em 390 de largura', () => expect(escalaDaMoldura({ largura: 390, altura: 844 })).toBeCloseTo(0.5))
test('a altura também limita', () => expect(escalaDaMoldura({ largura: 2000, altura: 180 })).toBeCloseTo(0.5))
```

- [ ] **Step 5: Rodar e ver falhar** — `npx vitest run tests/escala.test.ts` → FAIL (módulo não existe).

- [ ] **Step 6: Implementar `escalaDaMoldura`, os tokens e as molduras**

`src/design/tokens.css`: transpor da referência os dois acabamentos (`--panel`, `--well-face`, `--pad-face`, `--key-face`, `--key-face-on`, `--mod-face`, `--cham`, `--cham-sm`, `--cham-in`, `--cham-org`, `--groove`, `--ink…--ink-4`, sombras, `--gd/--gl` de grão) para `[data-acabamento="escuro"]` e `[data-acabamento="claro"]`, mais o cromo da página (`--chrome-*`) seguindo o tema do sistema. `MolduraCelular` desenha o aparelho a 780 × 360 e aplica `transform: scale(escala)`; `MolduraComputador` é uma janela de computador com área de trabalho (vazia por enquanto). `Bancada` coloca os dois lado a lado e, abaixo de 900 px de largura, só o celular.

- [ ] **Step 7: Rodar** — `npx vitest run` → PASS; `npm run typecheck` sem erros; `npm run lab` abre a bancada com as duas molduras vazias em alumínio escuro.

- [ ] **Step 8: README, AGENTS e commit**

`README.md`: o que é, `npm install && npm run lab`, como abrir no celular pela rede (o endereço "Network" que o Vite mostra, rota `/celular`), tecla **R** para o painel. `AGENTS.md`: fase atual, link para spec e plano, regras do Global Constraints acima, comandos. `CLAUDE.md` com `@AGENTS.md`.

```bash
git add -A && git commit -m "recomeço: esqueleto do protótipo, identidade metalizada e bancada"
```

---

### Task 2: Laboratório de Refinamento

**Files:**
- Create: `laboratorio/refinamento/{painel.js,painel.css,painel.d.ts,escolhas.js,README.md}` (cópia de `/home/victor/Documents/Projetos/Produtos/Bora Vê/bora-ve/laboratorio/refinamento/`), `laboratorio/servidor.cjs` (cópia de `…/bora-ve/laboratorio/servidor.cjs`), `laboratorio/plugin-vite.mjs`, `src/lab/secoes.ts`, `src/lab/refinamento.ts`, `tests/lab.test.ts`
- Modify: `vite.config.ts`, `src/App.tsx`

**Interfaces:**
- Consumes: `criarRefinamento` de `laboratorio/refinamento/painel.js` (tipos em `painel.d.ts`).
- Produces: `SECOES: { n: string; nome: string }[]` e `VARIANTES` (mesmo formato do Bora Vê: `{ secao, rotulo, opcoes: [id, rotulo][] }`, primeira opção = proposta) em `src/lab/secoes.ts`; `useVariante(chave: ChaveVariante): string` e `montarRefinamento(): void` em `src/lab/refinamento.ts`. Cada seção na tela é marcada com o atributo `data-lab="<n>"`.

- [ ] **Step 1: Copiar o laboratório** e trocar, no `README.md` e nos comentários de `servidor.cjs`, as menções a Metro/Expo por "plugin do Vite (`laboratorio/plugin-vite.mjs`)". Nada de Bora Vê fica no código.

- [ ] **Step 2: Escrever `tests/lab.test.ts`** (o mesmo do Bora Vê): `emMarkdown` lista só seções com algo anotado; `pastaDa('../x')` lança, `pastaDa('app')` não.

- [ ] **Step 3: Rodar** → PASS já com a cópia (garante que o servidor veio inteiro).

- [ ] **Step 4: `plugin-vite.mjs`**: `export default function laboratorio(): Plugin` com `apply: 'serve'`, `configureServer(server) { server.middlewares.use(lab.middleware) }` e `config: () => ({ server: { watch: { ignored: ['**/laboratorio/*/anotacoes.json', '**/laboratorio/*/ANOTACOES.md', '**/laboratorio/*/rodadas/**'] } } })`. Ligar em `vite.config.ts`.

- [ ] **Step 5: `src/lab/refinamento.ts`**: igual ao `refinamento.web.ts` do Bora Vê (ponte com `useSyncExternalStore`), com `pagina: 'app'`, `irPara: irParaSecao` (Task 5; até lá, função vazia) e `montarRefinamento()` só quando `import.meta.env.DEV`. `secoes.ts` começa com uma seção `{ n: '1', nome: 'Acabamento' }` e a variação `acabamento: { secao: '1', rotulo: 'Acabamento', opcoes: [['escuro', 'Alumínio escuro'], ['claro', 'Alumínio claro']] }`, que troca o `data-acabamento`.

- [ ] **Step 6: Conferir no navegador**: `npm run lab`, tecla R abre o painel; anotar algo na seção 1 cria `laboratorio/app/anotacoes.json` e `ANOTACOES.md`; trocar a variação troca o acabamento. Apagar o `laboratorio/app/` de teste depois.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "lab: painel de Refinamento copiado do Bora Vê, ligado ao Vite"`

---

### Task 3: Simulação (conexão, níveis, telas, cursor) e dados de mentira

**Files:**
- Create: `src/sim/{conexao.ts,telas.ts,loja.ts,vibrar.ts}`, `src/dados/*.ts`, `src/bancada/BarraSimulacao.tsx`, `tests/conexao.test.ts`, `tests/loja.test.ts`

**Interfaces:**
- Produces:
  - `type Nivel = 0 | 1 | 2 | 3` (0 = desconectado, 1 = [L], 2 = [M], 3 = [P]).
  - `PRESETS: Record<PresetId, { rotulo: string; mbps: number; atrasoMs: number; via: 'cabo' | 'wifi' | 'roteador' | 'nenhuma' }>` com `PresetId = 'usb3' | 'usb2' | 'wifi6' | 'wifi4' | 'roteador' | 'congestionado' | 'nenhuma'`. Valores (simulação): usb3 300/2, usb2 35/4, wifi6 200/8, wifi4 12/30, roteador 60/12, congestionado 2/80, nenhuma 0/0.
  - `nivelDe(c: { mbps: number; atrasoMs: number }): Nivel` — `mbps <= 0` → 0; `mbps >= 40 && atrasoMs <= 15` → 3; `mbps >= 5 && atrasoMs <= 40` → 2; senão 1.
  - `liberado(exigido: 1 | 2 | 3, atual: Nivel): boolean` — `atual >= exigido`.
  - `TELAS_CELULAR: Record<TelaCelular, { nome: string; nivel: 1 | 2 | 3; area: Area }>` e `TELAS_PC: Record<TelaPc, { nome: string }>` em `telas.ts`. Os ids vêm do inventário do Task 7–11 (começar com `'trackpad'`, `'atalhos'`, `'espelho'`, `'conexao'`, `'ajustes'`; cada task de tela acrescenta os seus). `'conexao'` é a única tela permitida no nível 0: `conectar('nenhuma')` leva a ela; ao reconectar, volta ao trackpad.
  - `useSim` em `loja.ts` com estado `{ plataforma: 'android' | 'iphone'; sistema: 'linux' | 'windows' | 'macos'; preset: PresetId; tela: TelaCelular; telaPc: TelaPc; appEmFoco: AppId; cursor: { x: number; y: number }; dedos: 1 | 2 | 3 | 4; aviso: string | null; ocioso: boolean }` e ações `conectar(p: PresetId)`, `irPara(t: TelaCelular)`, `irParaPc(t: TelaPc)`, `focar(a: AppId)`, `moverCursor(dx: number, dy: number)` (soma e prende em 0..1), `setDedos`, `setPlataforma`, `setSistema`, `tocar()` (zera ociosidade), `ficarOcioso()`.
  - `vibrar(padrao: number | number[]): void` (chama `navigator.vibrate` se existir).

- [ ] **Step 1: Testes de conexão**

```ts
// tests/conexao.test.ts
test('cada preset cai no nível esperado', () => {
  expect(nivelDe(PRESETS.usb3)).toBe(3); expect(nivelDe(PRESETS.wifi6)).toBe(3); expect(nivelDe(PRESETS.roteador)).toBe(3)
  expect(nivelDe(PRESETS.usb2)).toBe(2); expect(nivelDe(PRESETS.wifi4)).toBe(2)
  expect(nivelDe(PRESETS.congestionado)).toBe(1); expect(nivelDe(PRESETS.nenhuma)).toBe(0)
})
test('liberado compara nível exigido com o atual', () => { expect(liberado(3, 2)).toBe(false); expect(liberado(1, 1)).toBe(true); expect(liberado(1, 0)).toBe(false) })
```

- [ ] **Step 2: Testes da loja**

```ts
// tests/loja.test.ts  (resetar a loja em beforeEach)
test('conectar rebaixa a tela que a conexão não aguenta', () => {
  useSim.getState().conectar('usb3'); useSim.getState().irPara('espelho')
  useSim.getState().conectar('congestionado')
  expect(useSim.getState().tela).toBe('trackpad'); expect(useSim.getState().aviso).toMatch(/conexão/i)
})
test('irPara recusa tela acima do nível atual', () => {
  useSim.getState().conectar('wifi4'); useSim.getState().irPara('espelho'); expect(useSim.getState().tela).toBe('trackpad')
})
test('o cursor fica dentro da tela', () => { useSim.getState().moverCursor(5, -5); expect(useSim.getState().cursor).toEqual({ x: 1, y: 0 }) })
test('desconectar mostra a tela de conexão', () => { useSim.getState().conectar('nenhuma'); expect(useSim.getState().tela).toBe('conexao') })
```

- [ ] **Step 3: Rodar e ver falhar.**

- [ ] **Step 4: Implementar `conexao.ts`, `telas.ts`, `loja.ts`, `vibrar.ts`** conforme as interfaces. Aviso de rebaixamento: "A conexão piorou. Voltamos ao trackpad." (some sozinho em 3 s).

- [ ] **Step 5: Dados de mentira** em `src/dados/`: `apps.ts` (`AppId` e nome de ~10 apps reais, incluindo um de chamada, "Google Meet", e um nome longo), `atalhos.ts` (biblioteca de atalhos por app com rótulo e combinação, mais o perfil "Área de trabalho"), `janelas.ts` (janelas abertas, uma com título enorme), `audio.ts` (saídas, entradas, apps tocando), `notificacoes.ts`, `agenda.ts` (próxima reunião), `computadores.ts` (computadores achados no Wi-Fi, um com nome comprido; celulares pareados).

- [ ] **Step 6: `BarraSimulacao`** acima da bancada: conexão (presets, com o rótulo "simulação" e o nível atual em L/M/P), celular (Android/iPhone), computador (Linux/Windows/macOS), app em foco, dedos (1–4, para simular gestos com o mouse). Fica fora da moldura e fora do visual metalizado (é ferramenta, não produto).

- [ ] **Step 7: Rodar** — `npx vitest run` → PASS; `npm run typecheck` limpo.

- [ ] **Step 8: Commit** — `git commit -am "sim: conexão com níveis, estado compartilhado, dados de mentira e barra de simulação"` (incluir arquivos novos com `git add -A`).

---

### Task 4: Kit metalizado e o trackpad que move o cursor

**Files:**
- Create: `src/kit/*.tsx`, `src/bancada/DesktopFalso.tsx`, `tests/kit.test.tsx`
- Modify: `src/bancada/MolduraComputador.tsx` (mostra `DesktopFalso` com cursor)

**Interfaces:**
- Consumes: `useSim` (`cursor`, `dedos`, `moverCursor`, `tocar`), `vibrar`.
- Produces (props mínimas; o resto é escolha do implementador):
  - `Tecla({ rotulo, icone?, ligada?, led?: boolean, destaque?: boolean, aoTocar })`
  - `Trilho({ children, lado: 'esquerda' | 'direita' })` — sempre 5 posições, posição vazia continua ocupando lugar.
  - `Led({ aceso })`, `Chave({ ligada, aoMudar, rotulo })`, `Segmentado({ opcoes, valor, aoMudar })`, `Fader({ valor, aoMudar, mudo?, aoMudo? })`, `Poco({ children })`, `Modulo({ children })`, `Aviso()` (lê `aviso` da loja), `Icone({ nome })`
  - `Camada({ aberta, aoFechar, children })` — cobre a área de toque inteira e **engole** os toques que não são dela.
  - `Disco({ valor, aoMudar, passos?: number })` — giro relativo, vibra a cada passo.
  - `SuperficieTrackpad()` — textura de pontos da referência; arrastar chama `moverCursor` (com `dedos === 1`) ou mostra o gesto simulado (2 = rolar, 3–4 = deslizar); toque rápido = clique com anel e `vibrar(10)`; pressionar e segurar 400 ms = "clique firme" com `vibrar([8, 40, 6])`. Multi-toque real (celular) conta os ponteiros ativos em vez de `dedos`.
  - `DesktopFalso({ escala?: number })` — área de trabalho do sistema atual (barra/bandeja conforme `sistema`), janelas de `dados/janelas.ts`, cursor na posição `cursor`. É o mesmo componente que o espelho do celular reproduz.

- [ ] **Step 1: Testes do kit**

```tsx
// tests/kit.test.tsx
test('Camada bloqueia toques', async () => {
  const tecla = vi.fn()
  render(<div><Tecla rotulo="copiar" aoTocar={tecla} /><Camada aberta aoFechar={() => {}}><p>painel</p></Camada></div>)
  await userEvent.click(screen.getByText('copiar')).catch(() => {})
  expect(tecla).not.toHaveBeenCalled()
})
test('Trilho mantém cinco posições', () => {
  const { container } = render(<Trilho lado="direita"><Tecla rotulo="a" aoTocar={() => {}} /></Trilho>)
  expect(container.querySelectorAll('[data-posicao]')).toHaveLength(5)
})
test('Disco devolve passos inteiros', () => { /* arrastar um quarto de volta com passos=40 → aoMudar chamado com valor que avança 10 passos */ })
```
(o terceiro teste dispara `pointerdown`/`pointermove`/`pointerup` com `fireEvent` em coordenadas que fazem 90° em torno do centro e confere o valor final.)

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar as peças** reproduzindo o acabamento da referência (chanfro em `border-box`, face em `padding-box`, grão por cima, sombra de tecla, tecla afunda 1 px ao tocar). `Camada` posicionada dentro da moldura do celular, nunca por cima da página.

- [ ] **Step 4: Rodar** — `npx vitest run` → PASS.

- [ ] **Step 5: Conferir na bancada**: arrastar no trackpad move o cursor do computador falso; trocar o sistema na barra muda o cromo do computador.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "kit: peças metalizadas, trackpad que move o cursor e computador falso"`

---

### Task 5: Rodada 1 — telas-chave com variações

**Files:**
- Create: telas em `src/celular/**` e `src/computador/**` para as seções abaixo, `src/lab/rotas.ts`, `tests/rotas.test.ts`
- Modify: `src/lab/secoes.ts`, `src/sim/telas.ts`

**Interfaces:**
- Consumes: kit (Task 4), `useSim`, `useVariante`.
- Produces: `irParaSecao(n: string): void` em `src/lab/rotas.ts` — monta o estado que a seção precisa (conexão, app em foco, sistema) e chama `irPara`/`irParaPc`.

Seções da R1 (cada uma com **pelo menos 3 variações reais, diferentes na estrutura e não só na cor**; a primeira é a proposta; todas funcionando):

| n | Seção | Variações (proposta primeiro) |
|---|---|---|
| 1 | Acabamento | alumínio escuro · alumínio claro · escuro com trackpad claro · claro com trilhos escuros |
| 2 | Trackpad principal (centro 16:10, laterais fixas — decisão do dono) | esquerda com os atalhos do app em foco, direita com o sistema (clique direito, teclas presas, trocar janela, volume) · uma lateral dupla só do lado da mão, trackpad deslocado · teclas só na metade de baixo (alcance do polegar), em cima informação |
| 3 | Como trocar de modo (trackpad, atalhos, tela, mesa, teclado) | barra de modos que surge da borda · seletor fixo de modos no topo · toque longo com dois dedos abre os modos |
| 4 | Painel de atalhos | grade de teclas quadradas · teclas largas com nome · mesa de som (faixas verticais) · páginas que deslizam de lado |
| 5 | Tela espelhada e modos de toque (mesmo centro 16:10 e mesmas laterais) | alternador na lateral (toque direto / trackpad) · alternador flutuante sobre a imagem · gesto de três dedos com aviso |
| 6 | Parear pela primeira vez | QR grande no computador e câmera no celular · lista de computadores achados · passo a passo por tipo de conexão |
| 7 | Estado da conexão | LED com o tipo de conexão · medidor de sinal L/M/P · nada à vista até piorar |
| 8 | Central do computador | barra lateral · abas no topo · painel de equipamento (módulos lado a lado) |
| 9 | Ver na prática: teclas seguradas | tecla que trava ao tocar, LED aceso · segurar enquanto usa · faixa da borda que segura Shift e o resto é trackpad |
| 10 | Ver na prática: botão giratório | três desenhos novos de controle giratório (nenhum é o disco da v1): por exemplo arco no canto do polegar · faixa circular em volta do trackpad · roda que aparece onde o dedo pousa |
| 11 | Ver na prática: giratório com mixer | toca no app e gira · cada app com seu próprio controle · controle de volume que vira giratório ao segurar |
| 12 | Ver na prática: botões de volume | teclas laterais desenhadas na moldura · aviso de qual atalho cada botão dispara · desligado (para comparar) |
| 13 | Ver na prática: modo travado | trava com segurar três segundos · trava com padrão desenhado · sem trava (para comparar) |

(Os botões de volume de um celular de verdade não chegam a uma página web: na seção 12 eles são teclas desenhadas na lateral da moldura e, no computador, as setas ↑/↓ do teclado.)

- [ ] **Step 1: Teste de rotas**

```ts
// tests/rotas.test.ts
test('ir para a tela espelhada liga uma conexão que aguenta', () => {
  useSim.getState().conectar('congestionado'); irParaSecao('5')
  expect(nivelDe(PRESETS[useSim.getState().preset])).toBe(3); expect(useSim.getState().tela).toBe('espelho')
})
test('toda seção tem rota', () => { for (const s of SECOES) expect(() => irParaSecao(s.n)).not.toThrow() })
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Construir as seções 1–13** com `data-lab="<n>"` no elemento raiz de cada uma e `useVariante` em cada variação; cadastrar tudo em `secoes.ts`; implementar `rotas.ts`.

- [ ] **Step 4: Rodar** — `npx vitest run` e `npm run typecheck` limpos. No navegador, percorrer as 13 seções pelo painel ("Ir para a seção") e trocar todas as variações; nenhuma quebra.

- [ ] **Step 5: Conferir no celular de verdade**: `npm run lab`, abrir `http://<ip>:5173/celular` num Android; trackpad, disco e teclas seguradas respondem ao toque e vibram.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "R1: telas-chave com variações no laboratório"`

---

### Task 6: Síntese da R1 (parar e esperar o Victor)

- [ ] **Step 1:** Avisar o Victor que a R1 está pronta, com o endereço para abrir no computador e no celular. Esperar ele anotar e fechar a rodada no painel.
- [ ] **Step 2:** Ler `laboratorio/app/ANOTACOES.md`, `anotacoes.json` (incluindo alfinetes) e `rodadas/R1.md`.
- [ ] **Step 3:** Trazer a síntese em linguagem de produto: direção escolhida por seção, o que ele pediu, decisões dos "ver na prática" (fica ou sai, registrando no spec). **Executar só depois do "pode fazer".**
- [ ] **Step 4:** Atualizar o spec com as decisões e commitar: `git commit -am "docs: decisões da R1"`.

---

### Tasks 7–11: Rodada 2 — tudo o que o spec diz que entra, na direção escolhida

Cada task segue o mesmo ciclo: cadastrar as telas em `telas.ts` (com o nível do spec), testar o que tiver lógica (estado, regras, rebaixamento), construir as telas com `data-lab`, conferir no navegador, commitar. As seções novas entram em `secoes.ts` com a numeração seguinte; variações só onde a R1 deixou dúvida. Inventário por task (o nível do spec entre colchetes):

- **Task 7 — Controlar o computador e painel de atalhos:** trackpad com zonas opcionais e clique firme [L]; teclado completo e numérico [L]; ditado (o celular mostra que está ouvindo, o texto aparece no computador falso) [M]; mesa digitalizadora com traço que aparece no computador falso [L]; atalhos com páginas, perfis automáticos que trocam quando o app em foco muda, botões com estado (mudo, gravando), lançador [L/M]; mixer, mídia com capa e janelas abertas [M]; modo reunião, que aparece quando o app em foco é de chamada [M]. Testes: troca de perfil ao focar outro app; botão de mudo reflete o estado.
- **Task 8 — Tela:** espelhar, segundo monitor, uma janela só, recorte, monitor vertical (o celular gira), qualidade que se adapta (a imagem perde nitidez nos presets piores) [P]; painel de informações, notificações, agenda, tela de descanso [M]; combinações: espelho com toque direto e com trackpad por cima com o alternador escolhido, segundo monitor com toque, desenhar vendo a tela, parado vira painel. Testes: rebaixamento de cada tela [P]; ociosidade leva ao painel de informações e um toque volta.
- **Task 9 — Ponte e conexão:** área de transferência compartilhada e colar pelo teclado do celular, copiar entre dois computadores [L]; webcam [P] e microfone [M], com a reunião completa; pareamento por QR, descoberta no Wi-Fi, conexão direta sem roteador, celular como roteador, troca de conexão sem cair (tirar o cabo na barra de simulação mantém a sessão), aparelhos de confiança, vários computadores e vários celulares (opcionais). Testes: trocar de `usb3` para `wifi6` mantém a tela; trocar de computador mantém o perfil de cada um.
- **Task 10 — Aparelho dedicado e ajustes do celular:** abre sozinho, tela sempre pronta e escurecer parado, proteção contra marcas (deslocamento lento do que é fixo), bateria e calor, modo noturno (opcional); ajustes de lado e orientação, sensação do trackpad com o dedo, liga e desliga das funções opcionais. Testes: escurecer depois do tempo parado; qualquer toque acorda.
- **Task 11 — Computador:** ícone e menu da bandeja (com estado e tipo de conexão), central de configurações completa (aparelhos, perfis e atalhos com biblioteca, edição por app, importar e gravar atalho, telas, conexão com diagnóstico, funções opcionais, sensação), assistente de primeira vez por sistema, pedido de pareamento ("Celular de Ana quer se conectar"), janela do gravador de atalho. Cada uma com o cromo de Linux, Windows e macOS.

---

### Task 12: Verificação final e entrega da R2

**Files:**
- Create: `tests/e2e/passeio.spec.ts`, `playwright.config.ts` (servidor `npm run lab`, porta 5173)

- [ ] **Step 1: Passeio Playwright** — interceptar `/__lab/**` com `page.route` (resposta vazia); para cada seção de `SECOES`, abrir a bancada em 1440 × 900 e em 390 × 844 e 320 × 640, chamar `irParaSecao` pelo painel ou pela loja exposta em dev, e conferir: `document.documentElement.scrollWidth <= innerWidth`, nenhum erro no console, o elemento `[data-lab="<n>"]` visível.
- [ ] **Step 2: Rodar** — `npx playwright install chromium` (se faltar) e `npm run e2e` → PASS em todas as seções e larguras.
- [ ] **Step 3: Rodar tudo** — `npm test`, `npm run typecheck`, `npm run build` sem erros.
- [ ] **Step 4: Conferir no celular de verdade** os "ver na prática" que ficaram.
- [ ] **Step 5: Commit e entrega** — `git add -A && git commit -m "R2: protótipo completo verificado"`; avisar o Victor com o endereço e o que ficou para a R3, se houver. Perguntar se o histórico novo pode ir para o GitHub (substituir a `main` exige o OK dele).

## Fora deste plano

- Os apps de verdade (celular e computador), a escolha de tecnologia deles e qualquer comunicação real entre aparelhos: fase 3.
- Os itens marcados Talvez e Sai no spec.
- Distribuição (lojas, contas de desenvolvedor, driver assinado no Windows).
