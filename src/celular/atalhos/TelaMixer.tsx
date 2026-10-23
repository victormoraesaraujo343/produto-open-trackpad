import { useState } from 'react'
import { APPS } from '../../dados/apps'
import { APPS_TOCANDO, ENTRADAS, SAIDAS } from '../../dados/audio'
import { Fader } from '../../kit/Fader'
import { Icone } from '../../kit/Icone'
import { IconeApp } from '../../kit/IconeApp'
import { Led } from '../../kit/Led'
import { Poco } from '../../kit/Poco'
import { vibrar } from '../../sim/vibrar'

type Grupo = 'saida' | 'entrada' | 'app'
interface Canal { id: string; grupo: Grupo; nome: string; icone: React.ReactNode; volume: number; mudo: boolean; padrao: boolean; tocando: boolean }

const ICONE_DISPOSITIVO: Record<string, string> = { s1: 'volume', s2: 'fone', s3: 'computador', e1: 'microfone', e2: 'fone', e3: 'celular' }
const GRUPOS: { id: Grupo; nome: string }[] = [{ id: 'saida', nome: 'Saídas' }, { id: 'entrada', nome: 'Entradas' }, { id: 'app', nome: 'Apps' }]

function canaisIniciais(): Canal[] {
  return [
    ...SAIDAS.map((c) => ({ id: c.id, grupo: 'saida' as const, nome: c.nome, icone: <Icone nome={ICONE_DISPOSITIVO[c.id]} tamanho={18} />, volume: c.volume, mudo: c.mudo, padrao: c.ativo, tocando: c.ativo })),
    ...ENTRADAS.map((c) => ({ id: c.id, grupo: 'entrada' as const, nome: c.nome, icone: <Icone nome={ICONE_DISPOSITIVO[c.id]} tamanho={18} />, volume: c.volume, mudo: c.mudo, padrao: c.ativo, tocando: c.ativo })),
    ...APPS_TOCANDO.map((c) => ({ id: c.app, grupo: 'app' as const, nome: APPS[c.app].nome, icone: <IconeApp app={c.app} tamanho={22} />, volume: c.volume, mudo: c.mudo, padrao: false, tocando: true })),
  ]
}

/* Mesa de som (seção 11): saídas, entradas e cada app, com faders. Tocar no ícone de um
   dispositivo o torna o padrão (LED aceso). */
export function TelaMixer() {
  const [canais, setCanais] = useState<Canal[]>(canaisIniciais)
  const [grupo, setGrupo] = useState<Grupo>('saida')
  const volume = (id: string, v: number) => setCanais((cs) => cs.map((c) => (c.id === id ? { ...c, volume: v, mudo: false } : c)))
  const mudo = (id: string) => { vibrar(8); setCanais((cs) => cs.map((c) => (c.id === id ? { ...c, mudo: !c.mudo } : c))) }
  const padrao = (c: Canal) => {
    if (c.grupo === 'app') return
    vibrar(8)
    setCanais((cs) => cs.map((x) => (x.grupo === c.grupo ? { ...x, padrao: x.id === c.id, tocando: x.id === c.id } : x)))
  }
  const botaoMudo = (c: Canal) => (
    <button type="button" className={`cel-mudo${c.mudo ? ' k-ligada' : ''}`} aria-pressed={c.mudo} aria-label={`${c.nome}: ${c.mudo ? 'tirar do mudo' : 'pôr no mudo'}`}
      onClick={() => mudo(c.id)}>
      <Icone nome={c.mudo ? 'mudo' : c.grupo === 'entrada' ? 'microfone' : 'volume'} tamanho={15} />
    </button>
  )
  const cabeca = (c: Canal) => (
    <button type="button" className="cel-canal-cabeca" disabled={c.grupo === 'app'} onClick={() => padrao(c)}
      aria-label={c.grupo === 'app' ? c.nome : `${c.nome}${c.padrao ? ', padrão' : '. Tornar padrão'}`}>
      {c.icone}
      {c.grupo !== 'app' && <Led aceso={c.padrao} />}
    </button>
  )

  return (
    <div className="cel-mesa-som cel-mesa-horizontal" data-lab="11">
      <div className="cel-segmentos" role="tablist" aria-label="Grupos">
        {GRUPOS.map((g) => (
          <button key={g.id} type="button" role="tab" aria-selected={grupo === g.id} className={grupo === g.id ? 'cel-modo-ativo' : ''} onClick={() => setGrupo(g.id)}>{g.nome}</button>
        ))}
      </div>
      <Poco className="cel-faixas" role="tabpanel" aria-label={GRUPOS.find((g) => g.id === grupo)?.nome}>
        {canais.filter((c) => c.grupo === grupo).map((c) => (
          <div key={c.id} className="cel-faixa-h">
            {cabeca(c)}
            <span className="cel-canal-nome">{c.nome}</span>
            <Fader orientacao="horizontal" valor={c.volume} aoMudar={(v) => volume(c.id, v)} rotulo={c.nome} ativo={c.tocando} mudo={c.mudo} />
            <span className="cel-canal-valor">{c.mudo ? 'mudo' : `${c.volume}%`}</span>
            {botaoMudo(c)}
          </div>
        ))}
      </Poco>
    </div>
  )
}
