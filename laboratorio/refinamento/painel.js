/* REFINAMENTO — painel de revisão de design para páginas do laboratório.
   Motor genérico (sem marca): cada página declara suas seções e variações e
   chama `criarRefinamento`. Guarda, por rodada, status + anotação por seção,
   alfinetes na tela e as respostas da IA. Grava em
   `laboratorio/<pagina>/anotacoes.json` + `ANOTACOES.md` pelo plugin do
   `laboratorio/plugin-vite.mjs`; sem ele, fica só no navegador.

   Ciclo: designer anota → "Fechar rodada e pedir revisão" congela a rodada
   (com o commit) → IA executa e responde em `secoes[n].resposta`, marcando a
   seção como "pronta" → designer revisa só o que está pronto. */
/* o visual do painel só carrega no laboratório (no site publicado o painel não existe) */
import "./painel.css";

const STATUS = [["revisar", "Revisar"], ["pronta", "Pronta"], ["aprovada", "Aprovada"], ["ajustar", "Ajustar"], ["descartar", "Descartar"]];
const NOME_STATUS = Object.fromEntries(STATUS);
const FILTROS = [["todas", "Todas"], ["ajustar", "Ajustar"], ["pronta", "Prontas"], ["aprovada", "Aprovadas"], ["alfinetes", "Com alfinetes"]];
const html = document.documentElement;
const kebab = (k) => k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const agora = () => new Date().toISOString();
const dataCurta = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const calmo = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const dentroDoVisor = window.self !== window.top;
const I = {
  pin: '<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  comparar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><path d="M12 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7z" fill="currentColor" stroke="none" opacity=".35"/>',
  mobile: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  numero: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  lado: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  mini: '<path d="M6 12h12"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.6"/><path d="M12 17.2h.01"/>',
  ia: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/>',
};
const ico = (n) => `<svg class="rf-ico" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
const guarda = { ler(k, pad) { try { return localStorage.getItem(k) ?? pad; } catch { return pad; } }, gravar(k, v) { try { localStorage.setItem(k, v); } catch {} } };

import ESCOLHAS from "./escolhas.js";

/* SITE PUBLICADO (npm run build): o painel não entra. Cada variação fica na
   opção que o designer viu por último nas rodadas (a gravada no
   anotacoes.json da página, levada ao site por ./escolhas.js); sem registro, a
   primeira. Aplicar é transportar. */

export function criarRefinamento({ pagina, secoes: SECOES, variantes: VARIANTES, irPara, alternativa }) {
  if ((process.env.NODE_ENV === "production")) {
    const salvo = ESCOLHAS[pagina] ?? {};
    const variante = (k) => { const v = VARIANTES[k]; const x = salvo[v.secao]?.[k]; return v.opcoes.some(([id]) => id === x) ? x : v.opcoes[0][0]; };
    for (const k of Object.keys(VARIANTES)) document.documentElement.setAttribute(`data-${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`, variante(k));
    return { variante, aoMudar: () => {}, montar: () => {} };
  }
  const CHAVE = `refinamento-${pagina}`;
  const API = `/__lab/anotacoes?pagina=${encodeURIComponent(pagina)}`;
  const nomeDe = (n) => SECOES.find((s) => s.n === n)?.nome ?? "";

  /* "Ir para a seção": funciona de qualquer tela. Se a seção não está visível aqui, o app navega
     até a tela dela (irPara, fornecido pela página) e o painel espera ela aparecer, rola e destaca. */
  const secaoVisivel = (n) => [...document.querySelectorAll(`[data-lab="${n}"]`)].find((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden" && el.offsetHeight > 0);
  function destacarSecao(el) {
    const r = el.getBoundingClientRect();
    const m = document.createElement("div");
    Object.assign(m.style, { position: "fixed", left: r.left - 4 + "px", top: Math.max(0, r.top - 4) + "px", width: r.width + 8 + "px", height: Math.min(r.height, innerHeight) + 8 + "px",
      border: "2px solid #FF7300", borderRadius: "10px", pointerEvents: "none", zIndex: 2147483000, transition: "opacity .6s ease .9s", opacity: "1" });
    document.body.appendChild(m);
    requestAnimationFrame(() => { m.style.opacity = "0"; });
    setTimeout(() => m.remove(), 1700);
  }
  function mostrarSecao(n) {
    const rolar = (el) => { el.scrollIntoView({ behavior: calmo() ? "auto" : "smooth", block: "start" }); setTimeout(() => destacarSecao(el), calmo() ? 30 : 420); };
    // seções antigas que só existem na opção "Atual": cai na seção equivalente da tela, se ela estiver em outra opção
    const alt = alternativa?.(n);
    const achar = () => secaoVisivel(n) || (alt && secaoVisivel(alt));
    const ja = achar();
    if (ja) return rolar(ja);
    if (!irPara) return;
    irPara(n);
    const t0 = Date.now();
    const tentar = () => { const el = achar(); if (el) rolar(el); else if (Date.now() - t0 < 5000) setTimeout(tentar, 120); };
    setTimeout(tentar, 150);
  }

  /* ------------------------------------------------------------ estado */
  let estado = { rodada: { numero: 1, aberta_em: agora() }, geral: "", secoes: {}, alfinetes: [], rodadas: [] };
  try { estado = { ...estado, ...JSON.parse(guarda.ler(CHAVE, "{}")) }; } catch {}
  const ui = { lado: guarda.ler(`${CHAVE}-lado`, "direita"), mini: guarda.ler(`${CHAVE}-mini`, "0") === "1", numerar: guarda.ler(`${CHAVE}-numerar`, "0") === "1", filtro: "todas", aba: "secoes", alfinetar: false };
  /* a seção "0" guarda as variações que valem para a página toda (Geral) */
  const secao = (n) => (estado.secoes[n] ??= { nome: n === "0" ? "Geral" : nomeDe(n), status: "revisar", nota: "", variantes: {} });
  const controles = (n) => Object.entries(VARIANTES).filter(([, v]) => v.secao === n).map(([k, v]) => `<div class="rf-campo"><span>${esc(v.rotulo)}</span><div class="rf-seg">${v.opcoes.map(([id, nome]) => `<button type="button" data-var="${k}" data-valor="${id}" aria-pressed="${variante(k) === id}">${esc(nome)}</button>`).join("")}</div></div>`).join("");
  const ouvintes = new Map();

  function variante(chave) {
    const v = VARIANTES[chave];
    const salvo = estado.secoes[v.secao]?.variantes?.[chave];
    return v.opcoes.some(([id]) => id === salvo) ? salvo : v.opcoes[0][0];
  }
  const aoMudar = (chave, fn) => ouvintes.set(chave, [...(ouvintes.get(chave) ?? []), fn]);
  function aplicar(chave, avisar = true) {
    const valor = variante(chave);
    if (html.getAttribute(`data-${kebab(chave)}`) === valor) return;
    html.setAttribute(`data-${kebab(chave)}`, valor);
    if (avisar) (ouvintes.get(chave) ?? []).forEach((fn) => fn(valor));
  }
  Object.keys(VARIANTES).forEach((k) => aplicar(k, false));

  /* ------------------------------------------------------------ gravação */
  let relogio, pendente = false, ultimoAtualizado = estado.atualizado;
  function salvar() {
    guarda.gravar(CHAVE, JSON.stringify(estado));
    clearTimeout(relogio); pendente = true; marcar("salvando…");
    relogio = setTimeout(async () => {
      try {
        const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(estado) });
        if (!r.ok) throw new Error(r.status);
        const d = await r.json(); ultimoAtualizado = estado.atualizado = d.atualizado;
        marcar(`salvo em ${pagina}/ANOTACOES.md`);
      } catch { marcar("salvo só neste navegador"); }
      pendente = false;
    }, 500);
  }
  async function carregar({ silencioso = false } = {}) {
    try {
      const r = await fetch(API, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      if (d?.secoes && d.atualizado !== ultimoAtualizado && !pendente && !digitando()) {
        const novasRespostas = Object.entries(d.secoes).filter(([n, s]) => s.resposta?.em && s.resposta.em !== estado.secoes[n]?.resposta?.em).length;
        /* o arquivo é a fonte: não misturar com restos do navegador */
        estado = { rodada: { numero: 1, aberta_em: agora() }, geral: "", secoes: {}, alfinetes: [], rodadas: [], ...d };
        ultimoAtualizado = d.atualizado;
        guarda.gravar(CHAVE, JSON.stringify(estado));
        Object.keys(VARIANTES).forEach((k) => aplicar(k));
        desenhar();
        if (silencioso && novasRespostas) avisar(`${novasRespostas} resposta${novasRespostas > 1 ? "s" : ""} nova${novasRespostas > 1 ? "s" : ""} da IA`);
      }
      if (!silencioso) marcar(`ligado a ${pagina}/ANOTACOES.md`);
    } catch { if (!silencioso) marcar("sem servidor do lab: salvando só neste navegador"); }
  }
  const digitando = () => document.activeElement?.matches?.("textarea, input");

  /* ------------------------------------------------------------ elementos */
  let painel, botao, aviso, visor, pop;
  const $ = (s, r = painel) => r.querySelector(s);
  function marcar(t) { if (aviso) aviso.textContent = t; }
  function avisar(t) {
    const el = document.createElement("div"); el.className = "rf-aviso"; el.textContent = t;
    document.body.append(el); requestAnimationFrame(() => el.classList.add("on"));
    setTimeout(() => { el.classList.remove("on"); setTimeout(() => el.remove(), 400); }, 2600);
  }

  const contar = () => {
    const vals = SECOES.map((s) => estado.secoes[s.n]?.status ?? "revisar");
    return { aprovadas: vals.filter((v) => v === "aprovada").length, prontas: vals.filter((v) => v === "pronta").length, ajustar: vals.filter((v) => v === "ajustar").length, total: SECOES.length };
  };
  const alfinetesDe = (n) => estado.alfinetes.filter((a) => a.secao === n);

  /* ------------------------------------------------------------ desenho: seções */
  function passaFiltro(s) {
    const e = estado.secoes[s.n] ?? {};
    if (ui.filtro === "todas") return true;
    if (ui.filtro === "alfinetes") return alfinetesDe(s.n).some((a) => !a.resolvido);
    return (e.status ?? "revisar") === ui.filtro;
  }
  function itemDeSecao(s) {
    const e = estado.secoes[s.n] ?? {};
    const st = e.status ?? "revisar";
    const vars = Object.entries(VARIANTES).filter(([, v]) => v.secao === s.n);
    const pins = alfinetesDe(s.n);
    const abertos = pins.filter((a) => !a.resolvido).length;
    return `<details class="rf-sec" data-sec="${s.n}"${e.aberto ? " open" : ""}>
      <summary><span class="rf-num">${s.n}</span><span class="rf-nome">${esc(s.nome)}</span>
        <span class="rf-sinais">${e.resposta?.texto ? `<span class="rf-sinal ia" title="A IA respondeu">${ico("ia")}</span>` : ""}${abertos ? `<span class="rf-sinal" title="${abertos} alfinete(s) aberto(s)">${ico("pin")}${abertos}</span>` : ""}${vars.length ? `<span class="rf-sinal" title="${vars.length} variação(ões) em teste">${vars.length} var</span>` : ""}</span>
        <span class="rf-ponto" data-status="${st}" title="${NOME_STATUS[st]}"></span></summary>
      <div class="rf-corpo">
        ${e.pedido?.nota ? `<div class="rf-bloco pedido" data-expandir><span>Você pediu na R${e.pedido.rodada}</span><p>${esc(e.pedido.nota)}</p></div>` : ""}
        ${e.resposta?.texto ? `<div class="rf-bloco resposta" data-expandir><span>IA respondeu${e.resposta.rodada ? ` · R${e.resposta.rodada}` : ""} · ${dataCurta(e.resposta.em)}</span><p>${esc(e.resposta.texto)}</p></div>` : ""}
        ${controles(s.n)}
        <div class="rf-campo"><span>Status</span><div class="rf-seg rf-status">${STATUS.map(([id, nome]) => `<button type="button" data-st="${id}" aria-pressed="${st === id}">${nome}</button>`).join("")}</div></div>
        <label class="rf-campo"><span>Anotação · R${estado.rodada.numero}</span><textarea rows="3" data-nota placeholder="O que muda, o que fica, o que sai…">${esc(e.nota ?? "")}</textarea></label>
        ${pins.length ? `<div class="rf-campo"><span>Alfinetes</span><ul class="rf-pins">${pins.map((a) => `<li class="${a.resolvido ? "feito" : ""}"><button type="button" data-ver-pin="${a.id}">${ico("pin")} ${vistaDoPin(a) === "mobile" ? "<b>mobile</b> · " : ""}${esc(a.alvo || "ponto")}</button><em>${esc(a.texto || "sem texto")}</em></li>`).join("")}</ul></div>` : ""}
        <div class="rf-linha"><button type="button" class="rf-link" data-ir="${s.n}">Ir para a seção</button><button type="button" class="rf-link" data-visor-sec="${s.n}">Antes e depois</button></div>
      </div>
    </details>`;
  }

  function itemGeral() {
    const tem = estado.geral?.trim() || estado.pedidoGeral?.texto;
    const nVars = Object.values(VARIANTES).filter((v) => v.secao === "0").length;
    return `<details class="rf-sec rf-sec-geral" data-geral-item${ui.geralAberto ? " open" : ""}>
      <summary><span class="rf-num">G</span><span class="rf-nome">Geral <small>vale para a página toda</small></span><span class="rf-sinais">${estado.secoes["0"]?.resposta?.texto ? `<span class="rf-sinal ia" title="A IA respondeu">${ico("ia")}</span>` : ""}${nVars ? `<span class="rf-sinal">${nVars} var</span>` : ""}${tem ? `<span class="rf-sinal">${estado.geral?.trim() ? "nota" : "pedido"}</span>` : ""}</span></summary>
      <div class="rf-corpo">
        ${estado.pedidoGeral?.texto ? `<div class="rf-bloco pedido" data-expandir><span>Você pediu na R${estado.pedidoGeral.rodada}</span><p>${esc(estado.pedidoGeral.texto)}</p></div>` : ""}
        ${estado.secoes["0"]?.resposta?.texto ? `<div class="rf-bloco resposta" data-expandir><span>IA respondeu · ${dataCurta(estado.secoes["0"].resposta.em)}</span><p>${esc(estado.secoes["0"].resposta.texto)}</p></div>` : ""}
        ${controles("0")}
        <label class="rf-campo"><span>Anotação · R${estado.rodada.numero}</span><textarea rows="3" data-geral placeholder="Impressões que valem para a página toda…">${esc(estado.geral ?? "")}</textarea></label>
      </div>
    </details>`;
  }

  /* ------------------------------------------------------------ desenho: rodadas */
  function listaDeRodadas() {
    if (!estado.rodadas.length) return `<p class="rf-vazio">Nenhuma rodada fechada ainda. Ao fechar a R${estado.rodada.numero}, ela fica guardada aqui com o commit do momento.</p>`;
    return [...estado.rodadas].reverse().map((r) => {
      const itens = Object.entries(r.secoes ?? {}).filter(([, s]) => s.nota?.trim() || (s.status && s.status !== "revisar"));
      return `<details class="rf-rod">
        <summary><b>R${r.numero}</b><span>${dataCurta(r.fechada_em)}</span><code>${esc(r.commit?.curto ?? "sem git")}${r.commit?.sujo ? "+" : ""}</code></summary>
        <div class="rf-corpo">
          ${r.geral?.trim() ? `<div class="rf-bloco pedido" data-expandir><span>Geral</span><p>${esc(r.geral)}</p></div>` : ""}
          ${itens.map(([n, s]) => `<div class="rf-rod-item"><span class="rf-num">${n}</span><div><b>${esc(s.nome ?? nomeDe(n))}</b> <i data-status="${s.status}">${NOME_STATUS[s.status] ?? s.status}</i>${s.nota?.trim() ? `<p>${esc(s.nota)}</p>` : ""}</div></div>`).join("")}
          ${r.commit?.hash ? `<button type="button" class="rf-link" data-visor-commit="${r.commit.hash}">Ver a página como estava na R${r.numero}</button>` : ""}
        </div>
      </details>`;
    }).join("");
  }

  function desenhar() {
    if (!painel) return;
    const { aprovadas, prontas, ajustar, total } = contar();
    const lista = $(".rf-lista"), rolagem = lista.scrollTop;
    $("[data-rodada]").textContent = `R${estado.rodada.numero}`;
    $(".rf-barra").title = `${aprovadas} de ${total} aprovadas · ${ajustar} para ajustar${prontas ? ` · ${prontas} prontas` : ""}`;
    $(".rf-barra i").style.width = `${(aprovadas / total) * 100}%`;
    $(".rf-barra i + i").style.width = `${(prontas / total) * 100}%`;
    $("[data-contagem]").innerHTML = `<b>${aprovadas}</b>/${total} aprovadas${prontas ? ` · <b class="pronta">${prontas} pronta${prontas > 1 ? "s" : ""}</b>` : ""}`;
    const sel = $("[data-filtro]");
    sel.innerHTML = FILTROS.map(([id, nome]) => `<option value="${id}"${ui.filtro === id ? " selected" : ""}>${nome}</option>`).join("");
    sel.hidden = ui.aba !== "secoes";
    const pedido = estado.pedidoDeRevisao && !estado.pedidoDeRevisao.atendido;
    $("[data-pedido]").hidden = !pedido;
    if (pedido) $("[data-pedido]").textContent = `Revisão da R${estado.pedidoDeRevisao.rodada} pedida à IA · ${dataCurta(estado.pedidoDeRevisao.em)}`;
    painel.querySelectorAll("[data-aba]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.aba === ui.aba)));
    if (ui.aba === "secoes") {
      const vis = SECOES.filter(passaFiltro);
      lista.innerHTML = (ui.filtro === "todas" ? itemGeral() : "") + (vis.length ? vis.map(itemDeSecao).join("") : `<p class="rf-vazio">Nada neste filtro.</p>`);
    } else lista.innerHTML = listaDeRodadas();
    lista.scrollTop = rolagem;
    $("[data-numerar]").setAttribute("aria-pressed", String(ui.numerar));
    $("[data-fechar-rodada] b").textContent = `R${estado.rodada.numero}`;
    botao.querySelector("b").textContent = prontas ? `${prontas} pronta${prontas > 1 ? "s" : ""}` : "";
    painel.dataset.lado = ui.lado;
    painel.classList.toggle("mini", ui.mini);
    numerar(); desenharAlfinetes();
  }

  /* ------------------------------------------------------------ numeração das seções */
  function numerar() {
    document.querySelectorAll(".rf-marca").forEach((m) => m.remove());
    html.classList.toggle("rf-numerado", ui.numerar);
    if (!ui.numerar) return;
    document.querySelectorAll("[data-lab]").forEach((el) => {
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      const m = document.createElement("button");
      m.type = "button"; m.className = "rf-marca"; m.textContent = el.dataset.lab;
      m.setAttribute("aria-label", `Refinar a seção ${el.dataset.lab}`);
      m.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); abrir(el.dataset.lab); });
      el.prepend(m);
    });
  }

  /* ------------------------------------------------------------ alfinetes */
  const secaoDoAlvo = (alvo) => {
    const estilo = (el) => el.ownerDocument.defaultView.getComputedStyle(el);
    let el = alvo.closest("[data-lab]");
    while (el && (!el.offsetHeight || estilo(el).position === "fixed")) el = el.parentElement?.closest("[data-lab]");
    return el;
  };
  /* cada alfinete lembra em que vista foi posto (a página muda de layout no
     mobile); os antigos, sem vista, são do desktop */
  const vistaDe = (win) => (win.innerWidth <= 767 ? "mobile" : "desktop");
  const vistaDoPin = (a) => a.vista ?? "desktop";
  /* dentro do visor, a página atual não desenha nada: quem desenha é o painel de fora */
  const embutido = (() => { try { return !!window.frameElement?.closest(".rf-visor"); } catch { return false; } })();
  /* dentro do visor, as variações trocadas no painel de fora chegam por mensagem */
  if (embutido) addEventListener("message", (e) => {
    const { rf, chave, valor } = e.data ?? {};
    if (e.origin !== location.origin || rf !== "variante" || !VARIANTES[chave]) return;
    secao(VARIANTES[chave].secao).variantes[chave] = valor;
    aplicar(chave);
  });
  /* a página de fora trocou de tela (#): o visor aberto vai junto */
  if (!embutido) addEventListener("hashchange", () => {
    if (!V.aberto || !visor) return;
    visor.querySelectorAll("iframe").forEach((f) => { try { if (f.contentWindow.location.href !== "about:blank") f.contentWindow.location.hash = location.hash; } catch {} });
  });
  const quadroAtual = () => { const f = visor?.querySelector('[data-quadro="depois"]'); return V.aberto && f?.dataset.pronto && f.contentDocument ? f : null; };
  function descrever(el) {
    const rotulo = el.getAttribute("aria-label") || el.getAttribute("alt") || el.textContent?.trim().replace(/\s+/g, " ");
    const tipo = { BUTTON: "botão", A: "link", IMG: "imagem", H1: "título", H2: "título", H3: "título", P: "texto", INPUT: "campo", LI: "item" }[el.tagName] ?? el.tagName.toLowerCase();
    return rotulo ? `${tipo} “${rotulo.slice(0, 48)}${rotulo.length > 48 ? "…" : ""}”` : tipo;
  }
  function alternarAlfinetar(v = !ui.alfinetar) {
    ui.alfinetar = v;
    html.classList.toggle("rf-alfinetando", v);
    quadroAtual()?.contentDocument.documentElement.classList.toggle("rf-alfinetando", v);
    painel?.querySelector("[data-alfinetar]")?.setAttribute("aria-pressed", String(v));
    /* no visor, o alfinete vai na versão atual */
    if (v && V.aberto && V.lado === "antes") virar("depois");
    if (v) avisar(V.aberto ? "Toque no ponto da versão atual, no visor, para fixar um alfinete (Esc cancela)" : "Toque no ponto da página para fixar um alfinete (Esc cancela)");
  }
  function aoClicarAlfinetando(e) {
    if (!ui.alfinetar || e.target.closest(".rf-painel, .rf-botao, .rf-pop, .rf-visor")) return;
    e.preventDefault(); e.stopPropagation();
    const sec = secaoDoAlvo(e.target);
    if (!sec) { avisar("Não dá para fixar aqui"); return; }
    const r = sec.getBoundingClientRect();
    const win = sec.ownerDocument.defaultView;
    const a = { id: Math.random().toString(36).slice(2, 8), secao: sec.dataset.lab, x: +((e.clientX - r.left) / r.width).toFixed(4), y: +((e.clientY - r.top) / r.height).toFixed(4), vista: vistaDe(win), alvo: descrever(e.target), texto: "", rodada: estado.rodada.numero, em: agora(), resolvido: false };
    estado.alfinetes.push(a);
    alternarAlfinetar(false);
    /* tela estreita: painel minimizado, para o alfinete e o balão ficarem à vista */
    if (innerWidth <= 767 && !ui.mini) minimizar(true);
    desenhar(); salvar();
    abrirPop(a.id);
  }
  function desenharAlfinetes() {
    if (embutido) return;
    desenharAlfinetesEm(document);
    const f = quadroAtual(); if (f) desenharAlfinetesEm(f.contentDocument);
  }
  function desenharAlfinetesEm(doc) {
    const win = doc.defaultView;
    doc.querySelectorAll(".rf-pin").forEach((p) => p.remove());
    if (painel.hidden) return;
    estado.alfinetes.forEach((a, k) => {
      if (a.resolvido || vistaDoPin(a) !== vistaDe(win)) return;
      const sec = doc.querySelector(`[data-lab="${a.secao}"]`); if (!sec) return;
      if (win.getComputedStyle(sec).position === "static") sec.style.position = "relative";
      const p = doc.createElement("button");
      p.type = "button"; p.className = "rf-pin"; p.dataset.pin = a.id; p.textContent = k + 1;
      p.style.left = `${a.x * 100}%`; p.style.top = `${a.y * 100}%`;
      p.title = a.texto || a.alvo;
      p.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); abrirPop(a.id); });
      sec.append(p);
    });
  }
  /* o alfinete pode estar na página ou dentro do visor (vista mobile) */
  function acharPin(id) {
    const aqui = document.querySelector(`.rf-pin[data-pin="${id}"]`);
    if (aqui) return { el: aqui, dx: 0, dy: 0 };
    const f = quadroAtual(), el = f?.contentDocument.querySelector(`.rf-pin[data-pin="${id}"]`);
    if (!el) return null;
    const r = f.getBoundingClientRect();
    return { el, dx: r.left, dy: r.top };
  }
  async function abrirPop(id) {
    fecharPop();
    const a = estado.alfinetes.find((x) => x.id === id); if (!a) return;
    /* alfinete de outra vista: abre o visor na vista dele, na versão atual */
    if (!acharPin(id) && !a.resolvido && vistaDoPin(a) !== vistaDe(window)) {
      if (!(V.aberto && V.lado === "depois" && V.largura === vistaDoPin(a))) { await abrirVisor({ lado: "depois", largura: vistaDoPin(a), n: a.secao }); desenharAlfinetes(); }
    }
    acharPin(id)?.el.scrollIntoView({ block: "center", behavior: calmo() ? "auto" : "smooth" });
    pop = document.createElement("div");
    pop.className = "rf-pop";
    pop.innerHTML = `<span>Seção ${a.secao} · ${esc(a.alvo)}</span><textarea rows="3" placeholder="O que você quer aqui?">${esc(a.texto)}</textarea>
      <div><button type="button" data-pop="ok">Pronto</button><button type="button" data-pop="resolver">${a.resolvido ? "Reabrir" : "Resolver"}</button><button type="button" data-pop="apagar">Apagar</button></div>`;
    document.body.append(pop);
    const posicionar = () => { const p = acharPin(id); if (!p) return; const r = p.el.getBoundingClientRect();
      if (innerWidth <= 767) { /* tela estreita: balão centralizado, logo abaixo (ou acima) do alfinete */
        const y = r.bottom + p.dy + 10, alto = pop.offsetHeight || 180;
        pop.style.left = `${Math.max(12, (innerWidth - pop.offsetWidth) / 2)}px`;
        pop.style.top = `${y + alto < innerHeight - 70 ? y : Math.max(12, r.top + p.dy - alto - 38)}px`;
        return;
      }
      pop.style.left = `${Math.min(innerWidth - 300, Math.max(12, r.left + p.dx + 20))}px`; pop.style.top = `${Math.min(innerHeight - 190, Math.max(12, r.top + p.dy - 10))}px`; };
    setTimeout(posicionar, calmo() ? 0 : 350); posicionar();
    const ta = pop.querySelector("textarea"); ta.focus();
    ta.addEventListener("input", () => { a.texto = ta.value; salvar(); });
    pop.addEventListener("click", (e) => {
      const acao = e.target.dataset.pop; if (!acao) return;
      if (acao === "resolver") a.resolvido = !a.resolvido;
      if (acao === "apagar") estado.alfinetes = estado.alfinetes.filter((x) => x.id !== id);
      fecharPop(); desenhar(); salvar();
    });
  }
  function fecharPop() { pop?.remove(); pop = null; }

  /* ------------------------------------------------------------ rodadas */
  async function fecharRodada() {
    let commit = null;
    try { commit = await (await fetch("/__lab/git", { cache: "no-store" })).json(); } catch {}
    const n = estado.rodada.numero;
    const copia = JSON.parse(JSON.stringify(estado.secoes));
    estado.rodadas.push({ numero: n, aberta_em: estado.rodada.aberta_em, fechada_em: agora(), commit, geral: estado.geral, secoes: copia, alfinetes: JSON.parse(JSON.stringify(estado.alfinetes)) });
    for (const s of Object.values(estado.secoes)) {
      if (s.nota?.trim()) s.pedido = { rodada: n, nota: s.nota.trim() };
      else if (s.status === "aprovada") delete s.pedido;
      s.nota = "";
      delete s.resposta;
    }
    estado.pedidoGeral = estado.geral?.trim() ? { rodada: n, texto: estado.geral.trim() } : null;
    estado.geral = "";
    estado.pedidoDeRevisao = { rodada: n, em: agora(), atendido: false };
    estado.rodada = { numero: n + 1, aberta_em: agora() };
    desenhar(); salvar();
    avisar(`R${n} fechada. Revisão pedida à IA — agora é a R${n + 1}.`);
  }

  /* ------------------------------------------------------------ visor: antes/depois + mobile */
  const V = { aberto: false, lado: "antes", largura: "desktop", commit: null, versoes: [], git: null };
  /* com a busca e o # (produto ?p=, tela da conta #produtos…), senão o visor abre outra tela */
  const urlAtual = () => location.pathname + location.search + location.hash;
  const urlVersao = (hash) => `/laboratorio/_versoes/${hash}${location.pathname}${location.search}${location.hash}`;
  function secaoEmVista(doc = document, win = window) {
    const els = [...doc.querySelectorAll("[data-lab]")].filter((el) => el.offsetHeight && win.getComputedStyle(el).position !== "fixed");
    let melhor = null;
    for (const el of els) { const r = el.getBoundingClientRect(); if (r.top <= win.innerHeight * 0.35) melhor = el; }
    return { n: melhor?.dataset.lab, titulo: melhor?.querySelector("h1, h2")?.textContent.trim(), fracao: (win.scrollY || 0) / Math.max(1, doc.documentElement.scrollHeight - win.innerHeight) };
  }
  function levarPara(frame, alvo) {
    const w = frame.contentWindow, d = frame.contentDocument;
    if (!w || !d?.body) return;
    /* versões antigas podem não ter data-lab: casa pelo título da seção */
    const el = (alvo.n && d.querySelector(`[data-lab="${alvo.n}"]`)) || (alvo.titulo && [...d.querySelectorAll("h1, h2")].find((h) => h.textContent.trim() === alvo.titulo)?.closest("section, footer, header"));
    d.documentElement.style.scrollBehavior = "auto";
    const ir = () => {
      if (el) w.scrollTo(0, el.getBoundingClientRect().top + w.scrollY - 40);
      else w.scrollTo(0, alvo.fracao * (d.documentElement.scrollHeight - w.innerHeight));
    };
    ir(); setTimeout(ir, 400); setTimeout(ir, 1200); /* imagens tardias mudam a altura */
  }
  async function prepararVersoes() {
    try {
      V.git = await (await fetch("/__lab/git", { cache: "no-store" })).json();
      V.versoes = await (await fetch(`/__lab/versoes?pagina=${encodeURIComponent(pagina)}`, { cache: "no-store" })).json();
    } catch { V.versoes = []; }
    if (!V.commit) {
      const ultima = [...estado.rodadas].reverse().find((r) => r.commit?.hash && !(r.commit.hash === V.git?.hash && !V.git?.sujo));
      /* sem rodada fechada: compara com o commit anterior ao último do laboratório */
      V.commit = ultima?.commit.hash ?? V.versoes[1]?.hash ?? V.versoes[0]?.hash ?? null;
    }
  }
  async function carregarFrame(frame, url, alvo) {
    await new Promise((ok) => { frame.onload = ok; frame.src = url; });
    const d = frame.contentDocument;
    /* versões antigas trazem o próprio painel: esconde dentro do visor */
    d?.head?.insertAdjacentHTML("beforeend", "<style>.lab-botao,.lab-painel,.lab-selo,.rf-botao,.rf-painel{display:none!important}</style>");
    /* na versão atual dá para fixar alfinetes (é assim que se anota o mobile) */
    if (d && frame.dataset.quadro === "depois") {
      d.addEventListener("click", aoClicarAlfinetando, true);
      d.defaultView.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.alfinetar) alternarAlfinetar(false); });
      d.defaultView.addEventListener("resize", () => desenharAlfinetesEm(d));
    }
    try { await d.fonts?.ready; } catch {}
    await new Promise((ok) => setTimeout(ok, 500));
    levarPara(frame, alvo);
  }
  async function abrirVisor({ lado = "antes", largura = V.largura, n, commit } = {}) {
    if (commit) V.commit = commit;
    const alvo = n ? { n, fracao: 0 } : secaoEmVista();
    V.aberto = true; V.lado = lado; V.largura = largura;
    if (!visor) montarVisor();
    visor.hidden = false; html.classList.add("rf-com-visor");
    await prepararVersoes();
    desenharVisor();
    const [fa, fd] = visor.querySelectorAll("iframe");
    fd.dataset.pronto = ""; fa.dataset.pronto = "";
    const tarefas = [carregarFrame(fd, urlAtual(), alvo).then(() => { fd.dataset.pronto = "1"; desenharAlfinetes(); })];
    if (V.commit) {
      tarefas.push((async () => {
        try {
          const r = await fetch(`/__lab/versao?hash=${V.commit}`, { method: "POST" });
          if (!r.ok) throw new Error(await r.text());
          await carregarFrame(fa, urlVersao(V.commit), alvo); fa.dataset.pronto = "1";
        } catch (e) { visor.querySelector("[data-visor-msg]").textContent = "Não consegui montar a versão anterior."; }
      })());
    }
    await Promise.all(tarefas);
  }
  function montarVisor() {
    visor = document.createElement("div");
    visor.className = "rf-visor"; visor.hidden = true;
    visor.innerHTML = `<div class="rf-visor-palco"><iframe title="Versão anterior" data-quadro="antes"></iframe><iframe title="Versão atual" data-quadro="depois"></iframe></div>
      <div class="rf-visor-barra">
        <div class="rf-seg" data-v-lado><button type="button" data-v="antes">Antes</button><button type="button" data-v="depois">Depois</button></div>
        <select data-v-commit aria-label="Versão anterior"></select>
        <div class="rf-seg" data-v-largura><button type="button" data-w="desktop">Desktop</button><button type="button" data-w="mobile">Mobile</button></div>
        <span data-visor-msg></span>
        <button type="button" class="rf-x" data-v-fechar title="Fechar  Esc" aria-label="Fechar o visor">${ico("fechar")}</button>
      </div>`;
    document.body.append(visor);
    visor.addEventListener("click", (e) => {
      if (e.target.closest("[data-v-fechar]")) return fecharVisor();
      const l = e.target.closest("[data-v]"); if (l) return virar(l.dataset.v);
      const w = e.target.closest("[data-w]"); if (w) { V.largura = w.dataset.w; desenharVisor(); const f = visor.querySelector(`[data-quadro="${V.lado}"]`); setTimeout(() => levarPara(f, secaoEmVista(f.contentDocument, f.contentWindow)), 450); }
    });
    visor.querySelector("[data-v-commit]").addEventListener("change", (e) => { const alvo = secaoDoQuadro(); V.commit = e.target.value; abrirVisor({ lado: "antes", n: alvo.n }); });
  }
  const secaoDoQuadro = () => { const f = visor.querySelector(`[data-quadro="${V.lado}"]`); try { return secaoEmVista(f.contentDocument, f.contentWindow); } catch { return { fracao: 0 }; } };
  function virar(lado = V.lado === "antes" ? "depois" : "antes") {
    if (!V.aberto) return abrirVisor({ lado });
    const alvo = secaoDoQuadro();
    V.lado = lado; desenharVisor();
    levarPara(visor.querySelector(`[data-quadro="${lado}"]`), alvo);
  }
  function desenharVisor() {
    visor.dataset.largura = V.largura; visor.dataset.lado = V.lado;
    visor.querySelectorAll("[data-v]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === V.lado)));
    visor.querySelectorAll("[data-w]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.w === V.largura)));
    const sel = visor.querySelector("[data-v-commit]");
    const rodadaDe = (h) => estado.rodadas.find((r) => r.commit?.hash === h);
    sel.innerHTML = V.versoes.map((v) => `<option value="${v.hash}"${v.hash === V.commit ? " selected" : ""}>${rodadaDe(v.hash) ? `R${rodadaDe(v.hash).numero} · ` : ""}${v.curto} · ${esc(v.data)} · ${esc(v.msg.slice(0, 42))}</option>`).join("") || `<option>sem histórico</option>`;
    visor.querySelector("[data-visor-msg]").textContent = V.commit ? "" : "Sem versão anterior para comparar.";
  }
  function fecharVisor() { if (!visor) return; V.aberto = false; visor.hidden = true; html.classList.remove("rf-com-visor"); visor.querySelectorAll("iframe").forEach((f) => (f.src = "about:blank")); }

  /* ------------------------------------------------------------ abrir, fechar, lado, mini */
  function abrir(n) {
    painel.hidden = false; botao.setAttribute("aria-expanded", "true");
    if (ui.mini) { ui.mini = false; guarda.gravar(`${CHAVE}-mini`, "0"); }
    if (n) { ui.aba = "secoes"; ui.filtro = "todas"; secao(n).aberto = true; }
    desenhar();
    if (n) { const d = $(`[data-sec="${n}"]`); d?.scrollIntoView({ block: "nearest" }); d?.querySelector("textarea")?.focus({ preventScroll: true }); }
  }
  function fechar() { painel.hidden = true; botao.setAttribute("aria-expanded", "false"); fecharPop(); alternarAlfinetar(false); desenharAlfinetes(); }
  function minimizar(v = !ui.mini) { ui.mini = v; guarda.gravar(`${CHAVE}-mini`, v ? "1" : "0"); painel.classList.toggle("mini", v); }

  /* troca de lado com "encaixe" à la macOS: moldura translúcida no destino, o
     painel atravessa encolhendo de leve e assenta com um pequeno quique */
  let trocando = false;
  function mudarLado(para) {
    const novo = para ?? (ui.lado === "direita" ? "esquerda" : "direita");
    if (trocando || novo === ui.lado || painel.hidden) { if (painel.hidden) { ui.lado = novo; guarda.gravar(`${CHAVE}-lado`, novo); painel.dataset.lado = novo; } return; }
    const antes = painel.getBoundingClientRect();
    ui.lado = novo; painel.dataset.lado = novo; guarda.gravar(`${CHAVE}-lado`, novo);
    const depois = painel.getBoundingClientRect();
    const dx = antes.left - depois.left;
    if (!dx || calmo()) return;
    trocando = true;
    const fantasma = document.createElement("div");
    fantasma.className = "rf-fantasma";
    Object.assign(fantasma.style, { left: `${depois.left}px`, top: `${depois.top}px`, width: `${depois.width}px`, height: `${depois.height}px` });
    document.body.append(fantasma);
    fantasma.animate([{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    const volta = -Math.sign(dx) * 10;
    const voo = painel.animate([
      { transform: `translateX(${dx}px)` },
      { transform: `translateX(${dx}px) scale(.985)`, offset: 0.18 },
      { transform: `translateX(${dx * 0.35}px) scale(.955)`, offset: 0.55 },
      { transform: `translateX(${volta}px) scale(1.004)`, offset: 0.84 },
      { transform: "none" },
    ], { duration: 620, easing: "cubic-bezier(.3,.6,.2,1)" });
    voo.finished.finally(() => {
      trocando = false;
      fantasma.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(1.02)" }], { duration: 220, easing: "ease-out", fill: "forwards" }).finished.finally(() => fantasma.remove());
    });
  }

  /* ------------------------------------------------------------ montagem */
  function montar() {
    if (dentroDoVisor) return;
    botao = document.createElement("button");
    botao.type = "button"; botao.className = "rf-botao"; botao.setAttribute("aria-expanded", "false");
    botao.title = "Refinamento (R)";
    botao.innerHTML = `<span>Refinamento</span><b></b>`;
    painel = document.createElement("aside");
    painel.className = "rf-painel"; painel.hidden = true; painel.setAttribute("aria-label", "Refinamento");
    painel.innerHTML = `<header>
        <div class="rf-titulo"><em data-rodada></em><strong>Refinamento</strong><span>${esc(pagina)}</span></div>
        <div class="rf-acoes">
          <button type="button" class="rf-x" data-trocar-lado title="Mudar de lado  [ ]" aria-label="Mudar o painel de lado">${ico("lado")}</button>
          <button type="button" class="rf-x" data-mini title="Minimizar  M" aria-label="Minimizar o painel">${ico("mini")}</button>
          <button type="button" class="rf-x" data-fechar-rf title="Fechar  R" aria-label="Fechar o refinamento">${ico("fechar")}</button>
        </div>
        <div class="rf-barra"><i></i><i></i></div>
      </header>
      <div class="rf-resto">
        <div class="rf-ferramentas">
          <button type="button" data-alfinetar aria-pressed="false" title="Alfinete na tela  P">${ico("pin")}Alfinete</button>
          <button type="button" data-visor-abrir title="Antes e depois  A">${ico("comparar")}Antes/depois</button>
          <button type="button" data-mobile title="Ver no mobile  V">${ico("mobile")}Mobile</button>
          <button type="button" data-numerar aria-pressed="false" title="Numerar as seções  N">${ico("numero")}Numerar</button>
        </div>
        <p class="rf-pedido" data-pedido hidden></p>
        <nav class="rf-abas">
          <button type="button" data-aba="secoes">Seções</button><button type="button" data-aba="rodadas">Rodadas</button>
          <select data-filtro aria-label="Filtrar seções"></select>
        </nav>
        <div class="rf-lista"></div>
        <footer>
          <div class="rf-fechar-rodada"><button type="button" class="rf-primario" data-fechar-rodada>Fechar <b></b> e pedir revisão</button></div>
          <div class="rf-rodape"><small data-contagem></small><small class="rf-salvo" data-aviso>carregando…</small><button type="button" class="rf-x rf-ajuda" data-ajuda aria-expanded="false" title="Atalhos" aria-label="Atalhos de teclado">${ico("ajuda")}</button></div>
          <div class="rf-atalhos" data-atalhos hidden><span><kbd>R</kbd> abre/fecha</span><span><kbd>M</kbd> minimiza</span><span><kbd>[</kbd><kbd>]</kbd> lado</span><span><kbd>P</kbd> alfinete</span><span><kbd>A</kbd> antes/depois</span><span><kbd>V</kbd> mobile</span><span><kbd>N</kbd> numera</span><span><kbd>Esc</kbd> sai</span></div>
        </footer>
      </div>`;
    document.body.append(botao, painel);
    aviso = $("[data-aviso]");
    painel.dataset.lado = ui.lado;

    botao.addEventListener("click", () => (painel.hidden ? abrir() : fechar()));
    painel.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("[data-fechar-rf]")) return fechar();
      if (t.closest("[data-trocar-lado]")) return mudarLado();
      if (t.closest("[data-mini]")) return minimizar();
      if (t.closest(".rf-titulo") && ui.mini) return minimizar(false);
      if (t.closest("[data-alfinetar]")) return alternarAlfinetar();
      if (t.closest("[data-numerar]")) { ui.numerar = !ui.numerar; guarda.gravar(`${CHAVE}-numerar`, ui.numerar ? "1" : "0"); return desenhar(); }
      if (t.closest("[data-ajuda]")) { const at = $("[data-atalhos]"); at.hidden = !at.hidden; t.closest("[data-ajuda]").setAttribute("aria-expanded", String(!at.hidden)); return; }
      const ex = t.closest("[data-expandir]"); if (ex) { ex.classList.toggle("inteiro"); return; }
      if (t.closest("[data-visor-abrir]")) return V.aberto ? fecharVisor() : abrirVisor({ lado: "antes" });
      if (t.closest("[data-mobile]")) return abrirVisor({ lado: "depois", largura: "mobile" });
      const vs = t.closest("[data-visor-sec]"); if (vs) return abrirVisor({ lado: "antes", n: vs.dataset.visorSec });
      const vc = t.closest("[data-visor-commit]"); if (vc) return abrirVisor({ lado: "antes", commit: vc.dataset.visorCommit });
      const ab = t.closest("[data-aba]"); if (ab) { ui.aba = ab.dataset.aba; return desenhar(); }
      const vp = t.closest("[data-ver-pin]"); if (vp) return abrirPop(vp.dataset.verPin);
      const fr = t.closest("[data-fechar-rodada]");
      if (fr) {
        const caixa = fr.parentElement;
        caixa.innerHTML = `<span>As anotações da R${estado.rodada.numero} viram pedido para a IA e abre a R${estado.rodada.numero + 1}.</span><button type="button" class="rf-primario" data-confirma="sim">Fechar R${estado.rodada.numero}</button><button type="button" class="rf-link" data-confirma="nao">Cancelar</button>`;
        return;
      }
      const cf = t.closest("[data-confirma]");
      if (cf) {
        cf.parentElement.innerHTML = `<button type="button" class="rf-primario" data-fechar-rodada>Fechar <b>R${estado.rodada.numero}</b> e pedir revisão</button>`;
        if (cf.dataset.confirma === "sim") fecharRodada();
        return;
      }
      const v = t.closest("[data-var]");
      if (v) {
        secao(VARIANTES[v.dataset.var].secao).variantes[v.dataset.var] = v.dataset.valor;
        v.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === v)));
        aplicar(v.dataset.var); salvar();
        /* a versão atual no visor (mobile) é outra janela: avisa a troca a ela */
        visor?.querySelector('[data-quadro="depois"]')?.contentWindow?.postMessage({ rf: "variante", chave: v.dataset.var, valor: v.dataset.valor }, location.origin);
        return;
      }
      const st = t.closest("[data-st]");
      if (st) {
        const n = st.closest("[data-sec]").dataset.sec;
        secao(n).status = st.dataset.st;
        desenhar(); salvar(); return;
      }
      const ir = t.closest("[data-ir]");
      if (ir) {
        mostrarSecao(ir.dataset.ir);
        if (innerWidth < 1024) minimizar(true);
      }
    });
    painel.addEventListener("toggle", (e) => {
      if (e.target.matches?.("[data-geral-item]")) { ui.geralAberto = e.target.open; return; }
      const d = e.target.closest?.("[data-sec]"); if (d) secao(d.dataset.sec).aberto = d.open;
    }, true);
    painel.querySelector("[data-filtro]").addEventListener("change", (e) => { ui.filtro = e.target.value; desenhar(); });
    painel.addEventListener("input", (e) => {
      if (e.target.matches("[data-nota]")) { secao(e.target.closest("[data-sec]").dataset.sec).nota = e.target.value; salvar(); }
      if (e.target.matches("[data-geral]")) { estado.geral = e.target.value; salvar(); }
    });
    document.addEventListener("click", aoClicarAlfinetando, true);
    document.addEventListener("pointerdown", (e) => { if (pop && !e.target.closest(".rf-pop, .rf-pin")) fecharPop(); });

    addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (ui.alfinetar) return alternarAlfinetar(false);
        if (pop) return fecharPop();
        if (V.aberto) return fecharVisor();
        if (!painel.hidden) return fechar();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || digitando()) return;
      const k = e.key.toLowerCase();
      if (k === "r") return painel.hidden ? abrir() : fechar();
      if (k === "m") { if (painel.hidden) abrir(); else minimizar(); return; }
      if (k === "[") return mudarLado("esquerda");
      if (k === "]") return mudarLado("direita");
      if (k === "p") { if (painel.hidden) abrir(); return alternarAlfinetar(); }
      if (k === "a") return V.aberto ? virar() : abrirVisor({ lado: "antes" });
      if (k === "v") return abrirVisor({ lado: V.aberto ? V.lado : "depois", largura: V.aberto && V.largura === "mobile" ? "desktop" : "mobile" });
      if (k === "n") { ui.numerar = !ui.numerar; guarda.gravar(`${CHAVE}-numerar`, ui.numerar ? "1" : "0"); if (!painel.hidden) desenhar(); else numerar(); }
    });

    desenhar();
    carregar();
    setInterval(() => { if (!document.hidden) carregar({ silencioso: true }); }, 8000);
  }

  return { variante, aoMudar, montar };
}
