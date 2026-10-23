# Protocolo OpenTrackpad (OTP, versão 1)

Contrato entre o app do celular (`android/`) e o serviço do computador (`desktop/otpd`).
Os dois lados testam contra os mesmos vetores em `protocolo/vetores/`. Quem muda este arquivo
muda os vetores e os dois lados no mesmo commit.

Princípios do spec que moldam o protocolo:

- **O computador decide a tela do celular.** O celular é um renderizador genérico: recebe telas
  descritas por peças (`tela`) e devolve toques e ações. Função nova chega sem atualizar o app.
- **Nada roda sem permissão.** O celular só pede ações que o computador descreveu antes (por id).
  Não existe mensagem "rode este comando".
- **Tudo local.** Sem servidor de terceiros. A descoberta é mDNS na rede local; o cabo é `adb reverse`.
- **Celular velho e fraco.** Toque vai em quadros binários curtos; o resto é JSON pequeno.

## Transporte

- TCP, com `TCP_NODELAY` dos dois lados. Porta padrão **47800**.
- **Cabo (USB):** `adb reverse tcp:47800 tcp:47800`; o celular conecta em `127.0.0.1:47800`. O
  serviço aceita conexão sem TLS **só** em `127.0.0.1` (o tráfego não sai da máquina).
- **Wi-Fi:** o serviço anuncia `_opentrackpad._tcp` por mDNS (TXT: `v=1`, `nome=<computador>`,
  `fp=<16 primeiros hex da impressão digital>`). A conexão é **TLS 1.3** com o certificado
  autoassinado do computador; o celular **fixa a impressão digital** (SHA-256 do certificado DER)
  recebida no QR. Certificado diferente: o celular recusa e mostra "computador desconhecido".
- Um celular pode estar ligado a vários computadores (uma conexão por computador).

## Enquadramento

Toda mensagem, nos dois sentidos:

```
comprimento: u16 big-endian   (bytes que vêm depois: tipo + carga; 1..=65535)
tipo:        u8
carga:       comprimento - 1 bytes
```

| tipo | nome      | sentido | carga |
|------|-----------|---------|-------|
| 0x01 | CONTROLE  | ambos   | objeto JSON UTF-8 com o campo `t` |
| 0x10 | TOQUE     | cel→pc  | quadro de contatos (binário, abaixo) |
| 0x20 | PING      | ambos   | `nonce: u32` + `t_us: u64` (relógio de quem enviou) |
| 0x21 | PONG      | ambos   | a carga do PING, devolvida igual |
| 0x22 | CARGA     | ambos   | bytes quaisquer, para medir vazão (até 65534 por mensagem) |
| 0x30 | VIDEO     | pc→cel  | `pts_us: u64` + unidades NAL H.264 (Annex B) — onda 3 |
| 0x31 | AUDIO     | cel→pc  | `pts_us: u64` + PCM s16le 16 kHz mono — onda 3 |

Tipo desconhecido: quem recebe **fecha a conexão** (erro de versão). JSON com `t` desconhecido:
**ignora** (é assim que mensagens novas entram sem trocar de versão).

Limites: CONTROLE do celular até 16 KiB; o computador pode mandar até 64 KiB (telas com ícones).
Mensagem maior que o limite, JSON inválido ou campo obrigatório faltando: fecha a conexão.

### TOQUE (0x10)

```
seq:   u32 BE   (cresce a cada quadro; o computador descarta quadro com seq menor ou igual ao último)
n:     u8       (0..=10 contatos; 0 = nenhum dedo)
n × {
  id:    u8     (id do ponteiro no celular; reaproveitado quando o dedo sai)
  x:     u16 BE (pixels da superfície, 0..w-1)
  y:     u16 BE (pixels da superfície, 0..h-1)
  major: u16 BE (largura do contato em pixels; 0 se o aparelho não informa)
}
```

Cada quadro é o **retrato completo** dos dedos na superfície: dedo que não aparece foi levantado.
O celular manda só o quadro mais novo de cada movimento (se a fila atrasar, os intermediários são
descartados), mas **nunca** descarta o quadro em que um dedo sai ou entra. A superfície é o centro
do trackpad (formato 16:10), não a tela inteira; o tamanho dela vem na mensagem `superficie`.

Sem pressão: o touchpad virtual não declara pressão (aprendizado da v0.2).

## Mensagens CONTROLE

Campos em pt-BR, sem acento nos nomes. Toda mensagem tem `t`.

### Abertura

1. Celular → `ola`
   ```json
   {"t":"ola","v":1,"app":"0.3.0","aparelho":{"nome":"Moto G7","sistema":"android","versao":28},
    "pareamento":{"codigo":"428913"}}
   ```
   `pareamento` é `{"codigo": "..."}` na primeira vez (código de uso único do QR, 6 dígitos) ou
   `{"id":"<aparelho_id>","segredo":"<base64>"}` nas seguintes.
2. Computador → `bemvindo` ou `recusado` (e fecha).
   ```json
   {"t":"bemvindo","v":1,"computador":{"nome":"KiwiPC","sistema":"linux","ambiente":"kde"},
    "aparelho_id":"a1b2c3","segredo":"<base64, só na primeira vez>"}
   {"t":"recusado","motivo":"codigo"}   // motivos: versao, codigo, desconhecido, ocupado
   ```
   O `segredo` (32 bytes aleatórios) é guardado pelo celular e só trafega dentro do TLS ou no
   cabo local. O código do QR vale uma vez e por 5 minutos.
3. Celular → `superficie` (logo depois, e sempre que a área do trackpad mudar de tamanho)
   ```json
   {"t":"superficie","w":1180,"h":738,"w_um":96000,"h_um":60000,"max":10}
   ```
   `w`/`h` em pixels, `w_um`/`h_um` no tamanho físico real (µm). O computador cria ou recria o
   touchpad virtual com esse tamanho físico.

Nenhuma outra mensagem é aceita antes de `bemvindo`. Antes da abertura, um quadro TOQUE fecha a conexão.

### Celular → computador

| `t` | campos | o que faz |
|-----|--------|-----------|
| `botao` | `b`: `esquerdo`\|`direito`\|`meio`; `acao`: `aperta`\|`solta`\|`clica` | botões do touchpad (clique firme, laterais) |
| `tecla` | `k`: nome de tecla (abaixo); `acao`: `aperta`\|`solta`\|`toca` | tecla avulsa e teclas presas |
| `combo` | `k`: lista de nomes, ex. `["ctrl","c"]` | aperta em ordem e solta ao contrário |
| `texto` | `s`: texto UTF-8 (até 1000 caracteres) | digita o texto (teclado do celular, ditado) |
| `rolar` | `dx`, `dy`: inteiros em "passos" | rolagem discreta (giratório, botões de volume) |
| `acao` | `id`; `valor` opcional (número 0..1 ou inteiro) | dispara uma ação que o computador descreveu |
| `abrir` | `tela`: id | pede ao computador a tela `id` (o computador responde com `tela`) |
| `estado_app` | `primeiro_plano`: bool; `bateria`: 0..100; `carregando`: bool | o computador pausa o que não é visto |
| `tchau` | — | encerramento limpo |

Nomes de tecla: letras `a`..`z`, dígitos `0`..`9`, `f1`..`f12`, `ctrl`, `shift`, `alt`, `super`,
`altgr`, `enter`, `esc`, `tab`, `espaco`, `apagar`, `delete`, `cima`, `baixo`, `esquerda`, `direita`,
`inicio`, `fim`, `pgcima`, `pgbaixo`, `menos`, `igual`, `virgula`, `ponto`, `barra`, `ponto_virgula`,
`aspas`, `colchete_abre`, `colchete_fecha`, `contrabarra`, `crase`, `volume_mais`, `volume_menos`,
`mudo`, `tocar_pausar`, `proxima`, `anterior`, `print`. O computador recusa (ignora e registra)
nome fora da lista. `combo` tem no máximo 5 teclas.

### Computador → celular

| `t` | campos | o que faz |
|-----|--------|-----------|
| `nivel` | `n`: 1\|2\|3; `rtt_ms`; `mbps`; `via`: `cabo`\|`wifi`\|`roteador` | nível da conexão; o celular só mostra o que ele libera |
| `tela` | `id`, `nome`, `nivel`, `pecas`: lista (abaixo) | descreve uma tela |
| `telas` | `lista`: `[{id, nome, nivel, icone, area}]` | o menu de modos (o que existe neste computador) |
| `laterais` | `esquerda`, `direita`: listas de peças `tecla`/`tecla_presa` | as laterais fixas; mudam com o app em foco |
| `estado` | `id` da peça + campos que mudaram (`valor`, `ligado`, `texto`, `rotulo`) | atualiza uma peça já desenhada |
| `vibrar` | `ms` (10..80) | pedido de vibração (o celular sempre mostra resposta visual junto) |
| `aviso` | `texto` curto | aviso de relance (ex.: "Câmera saiu: conexão fraca") |
| `tchau` | `motivo` opcional | o computador vai fechar |

### Peças de tela

Conjunto pequeno, igual ao kit do protótipo (`src/kit/`). Toda peça tem `p` (tipo) e `id` (único
na tela). Ação = `acao` com o `id` da peça.

| `p` | campos | no protótipo |
|-----|--------|--------------|
| `trackpad` | — (peça nativa: toque local, sem esperar o computador) | `SuperficieTrackpad` |
| `teclado` | `layout`: `gboard-pt` | `TelaTeclado` |
| `tecla` | `rotulo`, `icone`, `dica`? | `Tecla`, `TeclaAtalho` |
| `tecla_presa` | `rotulo`, `k`: nome de tecla | `TeclaPresa` (manda `tecla` aperta/solta) |
| `fader` | `rotulo`, `valor` 0..1, `icone`? , `mudo`? | `Fader` |
| `giro` | `rotulo`, `valor` 0..1, `passos` | giratório (manda `acao` com `valor`) |
| `segmentos` | `rotulo`, `valor` 0..1, `texto` | `Segmentos` (medidor só de leitura) |
| `led` | `rotulo`, `ligado`, `texto` | `Led` (estado sempre com texto, nunca só cor) |
| `texto` | `texto`, `tamanho`: `p`\|`m`\|`g` | rótulos e relógio |
| `icone_app` | `rotulo`, `png` (base64, 96×96) | lista de janelas por ícone |
| `grade` | `colunas`, `pecas` | organiza peças em grade |
| `linha` | `pecas` | organiza peças em linha |

Ícones (`icone`) são nomes do conjunto de ícones do protótipo (`src/kit/Icone.tsx`).

## Nível da conexão

O computador mede, logo após a abertura e a cada 10 s:

- **atraso:** PING/PONG, 5 amostras, usa a mediana do RTT;
- **vazão:** pede `{"t":"medir","bytes":262144}` e o celular manda essa quantidade em CARGA; o
  computador mede o tempo (só na abertura e quando o atraso muda muito).

Regra (igual a `nivelDe` em `src/sim/conexao.ts`): `mbps >= 40` e `rtt <= 15 ms` → **3 (P)**;
`mbps >= 5` e `rtt <= 40 ms` → **2 (M)**; senão **1 (L)**. Quando o nível cai, o computador para o
que é pesado e o celular volta ao trackpad com aviso (spec: "sem susto").

## Encerramento e queda

- Queda do TCP, `tchau` ou 15 s sem nada (o celular manda PING a cada 3 s): o computador **solta
  todos os dedos, botões e teclas presas** na hora.
- O celular reconecta sozinho (cabo ou Wi-Fi, o que estiver de pé), com o `segredo`.

## Versões

`v` na abertura. O computador aceita a versão dele e a anterior (quando houver). Esta é a 1.
