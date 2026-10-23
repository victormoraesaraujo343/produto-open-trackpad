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

- TCP, com `TCP_NODELAY` dos dois lados.
- **Cabo (USB), porta 47800:** `adb reverse tcp:47800 tcp:47800`; o celular conecta em
  `127.0.0.1:47800`. O serviço ouve **só** em `127.0.0.1`, sem TLS (o tráfego não sai da máquina).
- **Wi-Fi, porta 47801:** o serviço anuncia `_opentrackpad._tcp` por mDNS (TXT: `v=1`,
  `nome=<computador>`, `fp=<16 primeiros hex da impressão digital>`). A conexão é **TLS 1.3** (1.2 no Android 9, que não tem 1.3) com
  o certificado autoassinado do computador; o celular **fixa a impressão digital** (SHA-256 do
  certificado DER, em hex minúsculo) recebida no QR. Certificado diferente: o celular recusa e
  mostra "computador desconhecido".
- **Tela de parear no computador, porta 47802:** HTTP só em `127.0.0.1` (abre no navegador do
  próprio computador). Mostra o QR, o código e os aparelhos de confiança.

### QR do pareamento

Texto do QR (uma URI, campos em ordem livre, valores com escape de URL):

```
otp1:?h=192.168.0.10,10.0.0.5&p=47801&fp=<64 hex>&c=428913&n=KiwiPC
```

`h`: endereços IPv4 do computador na rede local (o celular tenta cada um e também procura por
mDNS a mesma `fp`); `p`: porta TLS; `fp`: impressão digital; `c`: código de uso único; `n`: nome.
Sem `h` e `p` (só `c`), o QR serve para o cabo.
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
| 0x11 | CANETA    | cel→pc  | mesa digitalizadora (binário, abaixo) |
| 0x20 | PING      | ambos   | `nonce: u32` + `t_us: u64` (relógio de quem enviou) |
| 0x21 | PONG      | ambos   | a carga do PING, devolvida igual |
| 0x22 | CARGA     | ambos   | bytes quaisquer, para medir vazão (até 65534 por mensagem) |
| 0x30 | VIDEO     | pc→cel  | `pts_us: u64` + `marcas: u8` + pedaço de uma unidade de acesso H.264 (Annex B) — ver "Vídeo" |
| 0x31 | AUDIO     | cel→pc  | `pts_us: u64` + PCM s16le 16 kHz mono (microfone do celular) |
| 0x32 | CAMERA    | cel→pc  | igual a VIDEO (`pts_us`, `marcas`, pedaço de quadro H.264): a câmera do celular |

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

### CANETA (0x11)

```
seq:     u32 BE  (descarta seq menor ou igual ao último, como no TOQUE)
x:       u16 BE  (0..65535 na largura da área da mesa; a mesa vale a tela inteira do computador)
y:       u16 BE  (0..65535 na altura)
pressao: u16 BE  (0..1023; dedo sem pressão real: 512)
marcas:  u8      (bit 0: encostada, pinta; bit 1: perto, move o cursor sem pintar)
```

Marcas 0 = a caneta saiu de perto. No modo "Posicionar" do celular o toque vai com marcas 2 (move
sem pintar); no "Desenhar", com 3 (encostada). O computador cria uma caneta virtual (mesa
digitalizadora absoluta): apps de desenho recebem a pressão.

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
| `abrir` | `tela`: id | o celular mudou de modo. Mandado para **todo** modo, inclusive `trackpad` e `teclado` (nativos), para o computador saber o que está na tela e só atualizar o que é visto; para os outros, o computador responde com `tela` |
| `area_transferencia` | `s`: texto (até 15 000 bytes em UTF-8, para caber no limite de 16 KiB do celular; o celular corta e avisa) | o que foi copiado no celular vai para a área de transferência do computador |
| `estado_app` | `primeiro_plano`: bool; `bateria`: 0..100; `carregando`: bool | o computador pausa o que não é visto |
| `tchau` | — | encerramento limpo |

Nomes de tecla: letras `a`..`z`, dígitos `0`..`9`, `f1`..`f14`, `ctrl`, `shift`, `alt`, `super`,
`altgr`, `enter`, `esc`, `tab`, `espaco`, `apagar`, `delete`, `cima`, `baixo`, `esquerda`, `direita`,
`inicio`, `fim`, `pgcima`, `pgbaixo`, `menos`, `igual`, `virgula`, `ponto`, `barra`, `ponto_virgula`,
`aspas`, `colchete_abre`, `colchete_fecha`, `contrabarra`, `crase`, `volume_mais`, `volume_menos`,
`mudo`, `tocar_pausar`, `proxima`, `anterior`, `print`. O computador recusa (ignora e registra)
nome fora da lista. `combo` tem no máximo 5 teclas.

### Computador → celular

| `t` | campos | o que faz |
|-----|--------|-----------|
| `computador` | `fp`: impressão digital; `wifi`: `{"hosts":[...],"porta":47801}` | logo depois do `bemvindo`: o celular guarda, e um celular pareado pelo cabo passa a achar o mesmo computador no Wi-Fi sem parear de novo |
| `nivel` | `n`: 1\|2\|3; `rtt_ms`; `mbps`; `via`: `cabo`\|`wifi`\|`roteador` | nível da conexão; o celular só mostra o que ele libera |
| `tela` | `id`, `nome`, `nivel`, `pecas`: lista (abaixo) | descreve uma tela |
| `telas` | `lista`: `[{id, nome, nivel, icone, area}]` | o menu de modos (o que existe neste computador) |
| `laterais` | `esquerda`, `direita`: listas de peças `tecla`/`tecla_presa` | as laterais fixas; mudam com o app em foco |
| `estado` | `tela` (id da tela) + `pecas`: lista de `{id, campos que mudaram}` (`valor`, `ligado`, `texto`, `rotulo`, `mudo`, `icone`) | atualiza peças já desenhadas da tela aberta, sem redesenhar a tela |
| `area_transferencia` | `s`: texto (até 60 000 bytes, limite de 64 KiB do computador) | o que foi copiado no computador; o celular põe na área de transferência dele |
| `camera` | `ligar`: bool; `w`, `h`, `kbps`; `frente`: bool | liga/desliga a câmera do celular como webcam do computador (o celular manda CAMERA) |
| `microfone` | `ligar`: bool | liga/desliga o microfone do celular como microfone do computador (o celular manda AUDIO, blocos de 20 ms) |
| `vibrar` | `ms` (10..80) | pedido de vibração (o celular sempre mostra resposta visual junto) |
| `aviso` | `texto` curto | aviso de relance (ex.: "Câmera saiu: conexão fraca") |
| `tchau` | `motivo` opcional | o computador vai fechar |

### Laterais e menu de modos

```json
{"t":"laterais","app":{"nome":"VS Code","icone":"codigo"},
 "esquerda":[ peças ], "direita":[ peças ]}
{"t":"telas","lista":[{"id":"trackpad","nome":"Trackpad","icone":"trackpad","grupo":"Controlar","nivel":1}, ...]}
```

`esquerda` são os atalhos do app em foco (até 5 peças); `direita` é o sistema (até 3 peças; o
celular põe a tecla de modos em cima e a tecla do modo atual embaixo, como no protótipo). O menu de
modos mostra só o que está em `telas` e cabe no nível atual. `trackpad` e `teclado` são telas
nativas do celular; as outras o celular pede com `abrir` e o computador responde com `tela`.

### Peças de tela

Conjunto pequeno, igual ao kit do protótipo (`src/kit/`). Toda peça tem `p` (tipo) e `id` (único
na tela). Tocar numa peça manda `{"t":"acao","id":"<id>"}` (com `valor` quando a peça tem valor).

| `p` | campos | no protótipo |
|-----|--------|--------------|
| `trackpad` | — (peça nativa: toque local, sem esperar o computador) | `SuperficieTrackpad` |
| `teclado` | `layout`: `gboard-pt` | `TelaTeclado` |
| `tecla` | `rotulo`, `icone`, `dica`? | `Tecla`, `TeclaAtalho` |
| `tecla_presa` | `rotulo`, `k`: nome de tecla | `TeclaPresa`: toque prende, toque solta (seção 9 = trava). Manda `tecla` com `aperta`/`solta`, não `acao`; LED e texto "preso"/"solto" |
| `fader` | `rotulo`, `valor` 0..1, `icone`? , `mudo`? | `Fader` |
| `giro` | `rotulo`, `valor` 0..1, `passos` | giratório: o controle de volume do mixer (seção 10); manda `acao` com `valor` |
| `segmentos` | `rotulo`, `valor` 0..1, `texto` | `Segmentos` (medidor só de leitura) |
| `led` | `rotulo`, `ligado`, `texto` | `Led` (estado sempre com texto, nunca só cor) |
| `texto` | `texto`, `tamanho`: `p`\|`m`\|`g` | rótulos e relógio |
| `icone_app` | `rotulo`, `png` (base64, 96×96) | lista de janelas por ícone |
| `previa_camera` | — (peça nativa: a prévia da câmera que está sendo enviada) | tela Câmera |
| `video` | `w`, `h` (tamanho do vídeo), `modo`: `trackpad` (a imagem fica de fundo e o toque segue relativo, pelo touchpad) ou `toque` (tocar num ponto clica ali) | espelho, segundo monitor |
| `grade` | `colunas`, `pecas` | organiza peças em grade |
| `linha` | `pecas` | organiza peças em linha |

Ícones (`icone`) são nomes do conjunto de ícones do protótipo (`src/kit/Icone.tsx`).

## Vídeo (espelhar, segundo monitor)

O computador codifica em H.264 (perfil baseline ou main, sem quadros B) e manda cada **unidade
de acesso** (um quadro, com SPS/PPS antes do quadro-chave) em uma ou mais mensagens VIDEO:

```
pts_us: u64 BE   (tempo do quadro, em µs desde o início do fluxo)
marcas: u8       (bit 0: quadro-chave; bit 1: último pedaço deste quadro; bit 2: primeiro pedaço)
dados:  até 65 526 bytes (Annex B, com os códigos de início)
```

O celular junta os pedaços de um mesmo `pts_us` até o último e entrega o quadro inteiro ao
decodificador. Pedaço fora de ordem ou faltando: descarta o quadro e espera o próximo
quadro-chave. Ao abrir `espelho`, o computador responde com a `tela` (peça `video` com `w`, `h`
e `modo`: `trackpad` ou `toque`) e começa pelo quadro-chave; se o celular ficar para trás, o
computador descarta quadros que não são chave em vez de acumular (a fila máxima é curta).

## Câmera e microfone do celular

A tela `camera` (nível 3) e a tela `microfone` (nível 2) são descritas pelo computador, com uma
tecla de ligar e um LED de estado. O computador manda `camera`/`microfone` com `ligar` e o celular
pede a permissão do Android na hora. A câmera vai em CAMERA (H.264 do codificador do aparelho,
quadro-chave a cada 2 s, sem quadros B); o microfone em AUDIO (PCM 16 kHz mono, 20 ms por
mensagem). No computador, os dois aparecem no PipeWire como "OpenTrackpad (câmera)" e
"OpenTrackpad (microfone)". Conexão piorou abaixo do nível: o computador desliga e avisa.

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
