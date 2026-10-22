# Refinamento

Painel de revisão de design para as páginas do laboratório. É genérico: nada de
marca aqui dentro. Cada página declara suas seções e variações e chama
`criarRefinamento` (aqui: `src/lab/refinamento.ts`). Candidato a peça padrão
do laboratório.

## O que o designer faz na tela

- **Seções:** status (revisar, pronta, aprovada, ajustar, descartar), anotação
  por seção, variações lado a lado, "Geral" para o que vale na página toda.
- **Alfinete (P):** clica num ponto da página e comenta ali; fica preso à seção
  e descreve o elemento clicado. Guarda a vista (`vista: "desktop" | "mobile"`)
  e só aparece nela. Para anotar o mobile há dois caminhos. No visor Mobile (V)
  o alfinete vai na versão atual. Num celular ou numa tela estreita, o painel
  sai da frente enquanto se escolhe o ponto.
- **Antes/depois (A):** visor em tela cheia que alterna a página atual com uma
  versão anterior (commit), na mesma seção. **Mobile (V):** o mesmo visor em
  390 px.
- **Rodadas:** "Fechar Rn e pedir revisão" congela a rodada com o commit do
  momento (`rodadas/Rn.md`), transforma as anotações em pedidos e abre a
  próxima rodada. A aba Rodadas guarda o histórico.
- **Filtros, progresso e atalhos:** filtro por status, barra de aprovadas e
  prontas no topo, atalhos no "?" (R, M, [ ], P, A, V, N, Esc). O painel troca
  de lado com animação de encaixe e minimiza para uma barra.

## Cuidado com nomes

A chave de uma variação vira atributo no `<html>` (`galeria` → `data-galeria`).
Não use o mesmo `data-*` como gancho de elemento na página: `querySelector`
pegaria o `<html>` primeiro.

## O que a IA faz

1. Ler `laboratorio/<pagina>/ANOTACOES.md` (e `rodadas/` se precisar de
   histórico). Pedidos da rodada fechada aparecem como "Pedido da Rn".
2. Executar. Para cada seção atendida, gravar em `anotacoes.json`:
   `secoes[n].resposta = { texto, rodada, em }` e `secoes[n].status = "pronta"`.
   Ao terminar tudo, `pedidoDeRevisao.atendido = true`. Atualizar
   `atualizado` (ISO) — o painel aberto recarrega sozinho a cada 8 s e avisa
   "respostas novas da IA".
3. Commitar a rodada executada: o visor usa os commits para o antes/depois.

**Nunca rodar testes automáticos que gravem no `anotacoes.json` real** — o
designer pode estar anotando ao vivo. Em testes, interceptar
`/__lab/anotacoes` (Playwright `page.route`) ou usar outra página.

## Arquivos

- `painel.js` / `painel.css`: o motor e o visual (escuro, fonte do sistema,
  fora de qualquer marca).
- `../servidor.cjs` (ligado no Vite por `../plugin-vite.mjs`): endpoints de dev (`/__lab/anotacoes`, `/__lab/git`,
  `/__lab/versoes`, `/__lab/versao`). Versões antigas são extraídas em
  `laboratorio/_versoes/` (ignorado no git). Nada disso vai para o build.
