# OpenTrackpad

Um celular antigo, Android ou iPhone, vira periférico do computador Linux, Windows
ou macOS, por cabo ou Wi-Fi: trackpad de verdade, painel de atalhos, tela
espelhada ou segundo monitor, e uma ponte entre os dois aparelhos.

**Fase atual: protótipo visual.** Este repositório é, por enquanto, um site
interativo que mostra o produto inteiro com dados de mentira. A v0.2 (daemon
Rust + app Android) está guardada na tag `v0.2-archive`.

## Abrir

Precisa de Node.js 22 ou mais novo.

```bash
npm install
npm run lab
```

- No computador: http://localhost:5173 (a bancada, com o celular e o computador).
- No celular, na mesma rede: o endereço "Network" que o comando mostra, com `/celular`
  no fim (por exemplo `http://192.168.0.10:5173/celular`). Use o celular deitado.
- Tecla **R** abre o painel de Refinamento (anotações, variações, alfinetes).

Guia do projeto: [AGENTS.md](AGENTS.md).
