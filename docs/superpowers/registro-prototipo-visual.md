# Registro da construção do protótipo visual (decisões e correções)
Spec: docs/superpowers/specs/2026-10-21-escopo-novo-opentrackpad-design.md
Setup: Ruling: no separate worktree — plan Task 1 itself creates orphan branch `recomeco` in this fresh clone (not main) — cost if wrong: none, main untouched.
Pre-flight:
- T1→T2: T2 modifies vite.config.ts/App.tsx created in T1 — consistent.
- T3→T4: T4 consumes useSim cursor/dedos/moverCursor/tocar + vibrar — all in T3 Produces. OK.
- T3→T5: T5 test uses nivelDe, PRESETS, useSim.preset, irPara('espelho') — in T3. OK.
- T2→T5: T5 irParaSecao replaces T2 placeholder irPara — OK.
- T1 step1 vs workspace: `git clean -fdq -e docs/superpowers` would delete .superpowers/ (this ledger). Ruling: add `-e .superpowers` — cost if wrong: none.
Task 1: Ruling: commit identity = victormoraesaraujo343 <victormoraesaraujo343@gmail.com> (repo-local, same as v0.2 history; machine had none) — cost if wrong: author rewrite before push
Task 1: complete (commits b087c83..99221c7, tests: npm test →    Duration  691ms (environment 85%, setup 10%, transform 3%, worker 1%, import 1%, tests 1%))
Task 2: complete (commits 99221c7..6ef96d9, tests: npm test →    Duration  789ms (environment 84%, setup 10%, transform 2%, tests 1%, worker 1%, import 1%))
Task 3: Ruling: added reiniciar() and avisar(texto) actions to useSim (test reset; shared toast) beyond plan Produces — cost if wrong: none
Task 3: complete (commits 6ef96d9..c2c6928, tests: npm test →    Duration  1.22s (environment 84%, setup 11%, worker 2%, import 1%, transform 1%, tests 1%))
Task 4: complete (commits c2c6928..a1dde96, tests: npm test →    Duration  1.56s (environment 81%, setup 9%, tests 5%, import 2%, transform 1%, worker 1%))
Task 4 (post): Ruling: per Victor, removed Trilho, Disco, Fader, Chave, Segmentado, round `destaque` key, watermark and dot grid — they were v1 screen design, not identity; kit keeps only materials (Tecla face, Led, Poco, Modulo, Camada, Aviso, SuperficieTrackpad) — cost if wrong: re-add controls in R1, designed new.
Task 4 (post): Ruling: text tokens raised to WCAG AA (ink-3, key-lbl, pad-ink both finishes; ink-4 non-text only); targets 48px; labels 12px — per Victor's usability/accessibility rule — cost if wrong: slight visual drift from reference.
Task 5: Ruling: R1 options derived from v1 layouts (rails, quick ring, disco) replaced in plan by new directions — spec now forbids v1 screens.
Task 5: Ruling: added screens 'presas', 'giro', 'mixer' and store fields teclasPresas/volume/osdVolume/travado/ultimoAtalho/ligados + criarGiro — needed by sections 9–13 — cost if wrong: none (additive).
Task 5: Ruling: R1 variation count is 3 per section (plan said ≥3) except atalhos with 4.
Task 5: Ruling: Step 5 (real phone check) deferred to Task 6 handoff — needs Victor's phone — cost if wrong: touch issues found later.
Task 5: Ruling: window.__otp exposed only in DEV for browser checks/Playwright.
Task 5: complete (commits a1dde96..6469172, tests: npm test →    Duration  3.76s (environment 87%, setup 7%, tests 2%, import 2%, worker 1%, transform 1%))
Task 5 (rework, per Victor): Ruling: layout = 16:10 center (MacBook trackpad) + fixed side rails in every mode; no top band (height is scarce in landscape) — modes, connection, lock live in the rails; section 9 variations become held-key behaviours in the rails; 'presas' screen removed — cost if wrong: re-split layouts.
Task 6: Ruling (Victor, 2026-10-21): R1 review deferred — he will annotate everything once, after all front-end (R2) is built; R2 proceeds with current proposals as direction — cost if wrong: R2 screens may need restyling after his notes.
Tasks 7-11: Ruling: task-start can't find them (single combined heading); BASE for R2 = 7d2e8a4, tracked manually per area
Task 7: complete (commits 7d2e8a4..6349250, tests: npm test → 32 passed)
Task 8: complete (commits 6349250..83f818e, tests: npm test → 37 passed). Ruling (Victor): windows by app icon (PC sends icons) + mixing desk with faders for outputs/inputs/apps, vertical vs horizontal variations; giratório kept as 3rd option
Task 9: complete (commits 83f818e..da7b1a7, tests: npm test → 41 passed)
Task 10: complete (commits da7b1a7..92f16fe, tests: npm test → 45 passed). Ruling: lab variant 'mao' removed — hand side is now a real phone setting (ajustes.mao)
Ruling (Victor): keyboard follows Gboard layout (a–l row indented half key; ç/accents by long-press)
Ruling (Victor): in keyboard mode rails compact (variants: icons-that-grow / collapsed-edge / normal); first touch only opens the rail
Task 11: complete (commits 92f16fe..6688e77, tests: npm test → 48 passed). Rulings (Victor): modes menu redesigned as group columns + 3 alternative layouts in lab (abas/icones/gaveta); compact rail keys uniform. Ruling: dev-only ?v=chave:opcao forces variations without touching Victor's anotacoes.json — cost if wrong: none (dev only).
Note: Victor's in-progress laboratorio/app/anotacoes.json got included in R2 commits via git add -A — harmless (protocol commits annotations), but mention.
Task 12: complete (commits 6688e77..2d7a854, tests: npm test → 48 passed; npm run e2e → 139 passed; build ok). Ruling: Playwright uses the already-installed chromium-1243 headless shell when present instead of downloading 1248 — cost if wrong: config tweak on another machine
Final review: opus reviewer — 0 critical, 7 important, 8 minor. Ready: with fixes.
Final: fixed recorder swallowing keys — e2e 'o gravador de atalho não engole…' + capture only on focused area; Esc cancels
Final: fixed arrow keys leaking to phone volume buttons — e2e 'setas na central…'
Final: fixed two-finger long-press too eager — only on trackpad surface, cumulative movement, only 'doisdedos' variant
Final: fixed stale camera/mic/orientation on downgrade/disconnect — revisao.test.tsx RED→GREEN
Final: Ruling: lock no longer blocks in-app navigation (spec: "não sai do app") — revisao.test 'travado continua navegando' RED→GREEN; old test removed (contradicted spec)
Final: fixed real two-finger tap right-click — revisao.test RED→GREEN
Final: fixed keyboard use of overlays (focus in, Esc, inert below, tray arrows) — e2e 'menu de modos aberto…'
Final: minors also fixed (misto label, mac ⌘/⌃, mirror pointercancel, keyboard AT click, route cleanup, import dedupe). Suite 51/51 unit, 143/143 e2e.
Final: minor (deferred): e2e doesn't assert long-name ellipsis explicitly
Issues #5/#8 implemented in prototype (lab sections 33, 34). Ruling: Modos (right pos 1) and last key (mode-specific) stay fixed so nothing moves.
Issues #6/#7 implemented. Ruling: rest-screen look is now a product setting (relógio/infos/foto/nada) instead of a lab variant; default relógio.
Issue #4 implemented (lab 35). Ruling: trail is opt-in (opcoes.rastro default off; lab route 35 turns it on); disabled under prefers-reduced-motion.
Issues #9/#10 implemented; all issues #4–#10 commented with lab sections; left OPEN for Victor's validation.
