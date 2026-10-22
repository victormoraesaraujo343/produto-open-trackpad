/* SERVIDOR DO LABORATÓRIO — só no servidor de dev do Vite (`npm run lab`), a serviço do painel de Refinamento
   (laboratorio/refinamento/, copiado do laboratório do Bora Vê em 21/10/2026). Ligado por laboratorio/plugin-vite.mjs.
   - grava as anotações em laboratorio/<pagina>/anotacoes.json + ANOTACOES.md e cada rodada em rodadas/R<n>.md;
   - informa o commit atual (carimbo das rodadas).
   Sem antes/depois por commit (como no portfólio). Nada disso vai pro app. */
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('node:fs')
const { execFileSync } = require('node:child_process')
const path = require('node:path')

const RAIZ = path.resolve(__dirname, '..')
const LAB = __dirname
const STATUS = { revisar: 'Em revisão', pronta: 'Pronta para revisar', aprovada: 'Aprovada', ajustar: 'Precisa de ajuste', descartar: 'Descartar' }

const git = (...args) => execFileSync('git', args, { cwd: RAIZ, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
function pastaDa(pagina) {
  if (!/^[a-z0-9-]+$/.test(pagina ?? '')) throw new Error('página inválida')
  return path.join(LAB, pagina)
}
const lerCorpo = (req) => new Promise((ok, erro) => { let c = ''; req.on('data', (x) => (c += x)); req.on('end', () => ok(c)); req.on('error', erro) })
const responder = (res, dado, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(dado)) }

function secoesEmMarkdown(secoes = {}, alfinetes = [], { atual = true } = {}) {
  const linhas = []
  const todas = { ...Object.fromEntries(alfinetes.map((a) => [a.secao, { status: 'revisar', variantes: {} }])), ...secoes }
  for (const [n, s] of Object.entries(todas).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))) {
    const vars = Object.entries(s.variantes ?? {}).map(([k, v]) => `${k}: **${v}**`).join(' · ')
    const pins = alfinetes.filter((a) => a.secao === n)
    const temAlgo = s.nota?.trim() || (s.status ?? 'revisar') !== 'revisar' || vars || pins.length || s.pedido || s.resposta
    if (!temAlgo) continue
    linhas.push(`## ${n} · ${s.nome ?? ''}`, '', `Status: **${STATUS[s.status ?? 'revisar'] ?? s.status}**${vars ? `  \nVariantes vistas: ${vars}` : ''}`, '')
    if (atual && s.pedido?.nota) linhas.push(`> **Pedido da R${s.pedido.rodada}:** ${s.pedido.nota.replace(/\n/g, '\n> ')}`, '')
    if (atual && s.resposta?.texto) linhas.push(`> **Resposta da IA${s.resposta.rodada ? ` (R${s.resposta.rodada})` : ''}:** ${s.resposta.texto.replace(/\n/g, '\n> ')}`, '')
    if (s.nota?.trim()) linhas.push(s.nota.trim(), '')
    for (const a of pins) linhas.push(`- 📍 ${a.vista === 'mobile' ? '**[mobile]** ' : ''}${a.resolvido ? '~~' : ''}${a.alvo} (x ${Math.round(a.x * 100)}%, y ${Math.round(a.y * 100)}% da seção): ${a.texto?.trim() || 'sem texto'}${a.resolvido ? '~~ (resolvido)' : ''}`)
    if (pins.length) linhas.push('')
  }
  return linhas
}

function emMarkdown(d, pagina) {
  const r = d.rodada ?? { numero: 1 }
  const linhas = [`# Refinamento — ${pagina} · rodada R${r.numero}`, '', `Gerado pelo painel de Refinamento em ${d.atualizado ?? '—'}. Não editar à mão: o painel regrava este arquivo. A IA responde em \`anotacoes.json\` (\`secoes[n].resposta\` + status \`pronta\`).`, '']
  if (d.pedidoDeRevisao && !d.pedidoDeRevisao.atendido) linhas.push(`**Revisão pedida à IA** em ${d.pedidoDeRevisao.em} (pedidos da R${d.pedidoDeRevisao.rodada}).`, '')
  if (d.pedidoGeral?.texto) linhas.push(`## Geral · pedido da R${d.pedidoGeral.rodada}`, '', d.pedidoGeral.texto, '')
  if (d.geral?.trim()) linhas.push(`## Geral · R${r.numero}`, '', d.geral.trim(), '')
  linhas.push(...secoesEmMarkdown(d.secoes, d.alfinetes ?? []))
  if (d.rodadas?.length) linhas.push('## Rodadas fechadas', '', ...d.rodadas.map((x) => `- R${x.numero} · ${x.fechada_em} · commit ${x.commit?.curto ?? '—'}${x.commit?.sujo ? '+alterações' : ''} → \`rodadas/R${x.numero}.md\``), '')
  return linhas.join('\n')
}

function rodadaEmMarkdown(x, pagina) {
  const linhas = [`# Refinamento — ${pagina} · R${x.numero} (fechada)`, '', `Aberta em ${x.aberta_em ?? '—'} · fechada em ${x.fechada_em} · commit ${x.commit?.hash ?? '—'}${x.commit?.sujo ? ' (com alterações não commitadas)' : ''}`, '']
  if (x.geral?.trim()) linhas.push('## Geral', '', x.geral.trim(), '')
  linhas.push(...secoesEmMarkdown(x.secoes, x.alfinetes ?? [], { atual: false }))
  return linhas.join('\n')
}

async function anotacoes(req, res) {
  try {
    const pagina = new URL(req.url, 'http://x').searchParams.get('pagina') ?? 'app'
    const pasta = pastaDa(pagina)
    const arqJson = path.join(pasta, 'anotacoes.json')
    if (req.method === 'GET') return responder(res, existsSync(arqJson) ? JSON.parse(readFileSync(arqJson, 'utf8')) : {})
    if (req.method !== 'POST') return responder(res, { ok: false }, 405)
    const d = JSON.parse(await lerCorpo(req))
    d.atualizado = new Date().toISOString()
    mkdirSync(pasta, { recursive: true })
    writeFileSync(arqJson, JSON.stringify(d, null, 2) + '\n')
    writeFileSync(path.join(pasta, 'ANOTACOES.md'), emMarkdown(d, pagina) + '\n')
    for (const x of d.rodadas ?? []) {
      const alvo = path.join(pasta, 'rodadas', `R${x.numero}.md`)
      if (existsSync(alvo)) continue
      mkdirSync(path.dirname(alvo), { recursive: true })
      writeFileSync(alvo, rodadaEmMarkdown(x, pagina) + '\n')
    }
    responder(res, { ok: true, atualizado: d.atualizado })
  } catch (e) { responder(res, { ok: false, erro: String(e) }, 400) }
}

function middleware(req, res, next) {
  const url = req.url ?? ''
  if (url.startsWith('/__lab/anotacoes')) return void anotacoes(req, res)
  if (url.startsWith('/__lab/git')) {
    try { return responder(res, { hash: git('rev-parse', 'HEAD'), curto: git('rev-parse', '--short', 'HEAD'), sujo: git('status', '--porcelain', '--', 'src').length > 0 }) }
    catch { return responder(res, null) }
  }
  if (url.startsWith('/__lab/versoes')) return responder(res, [])
  next()
}

module.exports = { pastaDa, emMarkdown, rodadaEmMarkdown, middleware }
