import { APPS, type AppId } from '../dados/apps'
import type { Sistema } from '../dados/computadores'
import { PRESETS, ROTULO_NIVEL, type PresetId } from '../sim/conexao'
import { nivelAtual, useSim, type Dedos, type Plataforma, type Saude } from '../sim/loja'
import './barra-simulacao.css'

/* Ferramenta da bancada, não produto: fica fora do visual metalizado. */
function Grupo<T extends string | number>({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: T; opcoes: [T, string][]; aoMudar: (v: T) => void }) {
  return (
    <div className="bs-grupo" role="group" aria-label={rotulo}>
      <span className="bs-rotulo">{rotulo}</span>
      <div className="bs-seg">
        {opcoes.map(([v, nome]) => (
          <button key={String(v)} type="button" aria-pressed={v === valor} onClick={() => aoMudar(v)}>{nome}</button>
        ))}
      </div>
    </div>
  )
}

const COPIAS = ['https://libinput.pages.freedesktop.org', 'git checkout -b recomeco', 'Reunião remarcada para quinta, 10h', 'R$ 1.249,90']

export function BarraSimulacao() {
  const s = useSim()
  const nivel = nivelAtual(s.preset)
  return (
    <header className="bs" aria-label="Simulação">
      <div className="bs-linha">
        <label className="bs-grupo">
          <span className="bs-rotulo">Conexão</span>
          <select id="bs-conexao" value={s.preset} onChange={(e) => s.conectar(e.target.value as PresetId)}>
            {(Object.keys(PRESETS) as PresetId[]).map((p) => <option key={p} value={p}>{PRESETS[p].rotulo}</option>)}
          </select>
          <span className={`bs-nivel bs-n${nivel}`} title="Nível que a conexão libera (simulação)">nível {ROTULO_NIVEL[nivel]}</span>
        </label>
        <Grupo<Plataforma> rotulo="Celular" valor={s.plataforma} opcoes={[['android', 'Android'], ['iphone', 'iPhone']]} aoMudar={s.setPlataforma} />
        <Grupo<Sistema> rotulo="Computador" valor={s.sistema} opcoes={[['linux', 'Linux'], ['windows', 'Windows'], ['macos', 'macOS']]} aoMudar={s.setSistema} />
        <label className="bs-grupo">
          <span className="bs-rotulo">Em foco</span>
          <select id="bs-foco" value={s.appEmFoco} onChange={(e) => s.focar(e.target.value as AppId)}>
            {(Object.keys(APPS) as AppId[]).map((a) => <option key={a} value={a}>{APPS[a].nome}</option>)}
          </select>
        </label>
        <Grupo<Dedos> rotulo="Dedos do mouse" valor={s.dedos} opcoes={[[1, '1'], [2, '2'], [3, '3'], [4, '4']]} aoMudar={s.setDedos} />
        <label className="bs-grupo"><span className="bs-rotulo">Celular está</span>
          <select id="bs-saude" value={s.saude} onChange={(e) => s.setSaude(e.target.value as Saude)}>
            <option value="ok">Normal</option><option value="bateria">Com bateria fraca</option><option value="quente">Quente</option>
          </select>
        </label>
        <button type="button" className="bs-botao" onClick={() => s.copiar(COPIAS[Math.floor(Math.random() * COPIAS.length)], 'computador')}>Copiar algo no computador</button>
        <span className="bs-marca">simulação</span>
      </div>
    </header>
  )
}
