//! Extensão "Informações": as telas `painel` (Informações) e `recursos` (Recursos) com medidas
//! reais do Linux (CPU, memória, temperatura, rede, bateria). As leituras são funções puras
//! que recebem o texto dos arquivos de `/proc` e `/sys`, para testar com amostras. Só lê o
//! sistema quando uma destas telas está aberta.

use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::Instant;

use serde_json::{json, Value};

use crate::protocolo::{controle, Mensagem};
use crate::sessao::{Evento, Extensao};

const DIAS: [&str; 7] = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES: [&str; 12] = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/// Faixa da barra de temperatura: abaixo de 30 °C a barra está vazia, acima de 100 °C cheia.
const TEMP_MIN: f64 = 30.0;
const TEMP_MAX: f64 = 100.0;
/// Sensores de CPU, em ordem de preferência.
const SENSORES_CPU: [&str; 4] = ["k10temp", "coretemp", "zenpower", "cpu_thermal"];
/// Telas desta extensão: id, nome e ícone.
const TELAS_INFO: [(&str, &str, &str); 2] = [("painel", "Informações", "info"), ("recursos", "Recursos", "mixer")];

/// Relógio do computador: "HH:MM" e a data curta ("qui, 23 out").
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Relogio {
    pub hora: String,
    pub data: String,
}

/// Bateria: porcentagem (0..100) e o `status` do kernel (`Charging`, `Discharging`, ...).
#[derive(Debug, Clone, PartialEq)]
pub struct Bateria {
    pub porcento: f64,
    pub status: String,
}

/// Uma leitura do computador. Taxas e uso da CPU precisam de duas leituras: na primeira,
/// `cpu` e `rede` são `None`.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Amostra {
    pub relogio: Option<Relogio>,
    /// Uso da CPU em %, desde a leitura anterior.
    pub cpu: Option<f64>,
    /// Memória usada em %.
    pub memoria: Option<f64>,
    /// Temperatura da CPU em °C.
    pub temperatura: Option<f64>,
    /// Descida e subida em KB/s (KB = 1024 bytes), somando as interfaces exceto `lo`.
    pub rede: Option<(f64, f64)>,
    pub bateria: Option<Bateria>,
}

/// Textos brutos da leitura anterior, para calcular taxas e uso da CPU.
#[derive(Debug)]
pub struct Bruto {
    stat: String,
    rede: String,
    instante: Instant,
}

/// Uma peça de estado: o que o celular mostra e o que muda entre leituras.
#[derive(Debug, Clone, PartialEq)]
struct Campo {
    id: &'static str,
    valor: Option<f64>,
    texto: String,
    ligado: Option<bool>,
}

impl Campo {
    fn json(&self) -> Value {
        let mut v = json!({"id": self.id, "texto": self.texto});
        if let Some(f) = self.valor {
            v["valor"] = json!(f);
        }
        if let Some(l) = self.ligado {
            v["ligado"] = json!(l);
        }
        v
    }
}

/// Extensão das telas de informações. `amostrador` lê o sistema (o real ou um falso nos testes).
pub struct Informacoes {
    amostrador: Box<dyn FnMut() -> Amostra + Send>,
    aberta: Option<String>,
    ultimo: Vec<Campo>,
}

impl Informacoes {
    /// Com um amostrador qualquer (testes).
    pub fn nova(amostrador: Box<dyn FnMut() -> Amostra + Send>) -> Self {
        Self { amostrador, aberta: None, ultimo: Vec::new() }
    }

    /// Com a leitura real do Linux. Guarda a leitura anterior para as taxas.
    pub fn do_sistema() -> Self {
        let mut anterior: Option<Bruto> = None;
        Self::nova(Box::new(move || {
            let (amostra, bruto) = amostrar(anterior.as_ref());
            anterior = Some(bruto);
            amostra
        }))
    }

    /// Id da tela de informações aberta, se for uma destas duas.
    fn tela_info(&self) -> Option<&'static str> {
        match self.aberta.as_deref() {
            Some("painel") => Some("painel"),
            Some("recursos") => Some("recursos"),
            _ => None,
        }
    }
}

impl Extensao for Informacoes {
    fn controle(&mut self, t: &str, msg: &Value, respostas: &mut Vec<Mensagem>) -> bool {
        if t != "abrir" {
            return false;
        }
        let Some(tela) = msg["tela"].as_str() else { return false };
        // Guarda qualquer tela, para que um `tique` nunca leia o sistema com outra tela na frente.
        self.aberta = Some(tela.to_owned());
        let Some((_, nome, _)) = TELAS_INFO.iter().find(|(id, _, _)| *id == tela) else { return false };
        let amostra = (self.amostrador)();
        let campos = campos(&amostra, tela);
        respostas.push(controle(json!({
            "t":"tela","id":tela,"nome":nome,"nivel":2,
            "pecas": pecas_da_tela(tela, &campos),
        })));
        self.ultimo = campos;
        true
    }

    fn telas(&self) -> Vec<Value> {
        TELAS_INFO
            .iter()
            .map(|(id, nome, icone)| json!({"id":id,"nome":nome,"icone":icone,"grupo":"Tela","nivel":2}))
            .collect()
    }

    fn evento(&mut self, e: &Evento, respostas: &mut Vec<Mensagem>) {
        if e.tipo != "tique" {
            return;
        }
        let Some(tela) = self.tela_info() else { return };
        let amostra = (self.amostrador)();
        let atual = campos(&amostra, tela);
        let pecas = mudancas(&self.ultimo, &atual);
        if !pecas.is_empty() {
            respostas.push(controle(json!({"t":"estado","tela":tela,"pecas":pecas})));
        }
        self.ultimo = atual;
    }
}

/// Peças que mudaram: as que não são iguais, na leitura anterior, em valor, texto e ligado.
fn mudancas(anterior: &[Campo], atual: &[Campo]) -> Vec<Value> {
    atual.iter().filter(|c| anterior.iter().find(|a| a.id == c.id) != Some(*c)).map(Campo::json).collect()
}

/// Estado de cada peça para a tela: o relógio só no painel. Valores 0..1 arredondados a 2 casas,
/// para que uma oscilação que não muda o número mostrado não mande mensagem.
fn campos(a: &Amostra, tela: &str) -> Vec<Campo> {
    let mut v = Vec::new();
    if tela == "painel" {
        if let Some(r) = &a.relogio {
            v.push(Campo { id: "relogio", valor: None, texto: r.hora.clone(), ligado: None });
            v.push(Campo { id: "data", valor: None, texto: r.data.clone(), ligado: None });
        }
    }
    v.push(medida("cpu", a.cpu.map(|p| (p / 100.0, pct(p)))));
    v.push(medida("mem", a.memoria.map(|p| (p / 100.0, pct(p)))));
    v.push(medida(
        "temp",
        a.temperatura.map(|t| ((t - TEMP_MIN) / (TEMP_MAX - TEMP_MIN), format!("{} °C", pt(t, 0)))),
    ));
    if let Some(b) = &a.bateria {
        let sufixo = match b.status.as_str() {
            "Charging" => " · carregando",
            "Discharging" => " · na bateria",
            "Full" => " · cheia",
            "Not charging" => " · na tomada",
            _ => "",
        };
        v.push(medida("bateria", Some((b.porcento / 100.0, format!("{}{sufixo}", pct(b.porcento))))));
    }
    let (texto, ligado) = match a.rede {
        Some((d, u)) => (format!("↓ {} ↑ {}", taxa(d), taxa(u)), d + u > 0.0),
        None => ("—".to_owned(), false),
    };
    v.push(Campo { id: "rede", valor: None, texto, ligado: Some(ligado) });
    v
}

/// Medida 0..1 com texto. Sem leitura (primeira amostra ou sensor ausente): zero e "—".
fn medida(id: &'static str, leitura: Option<(f64, String)>) -> Campo {
    let (fracao, texto) = match leitura {
        Some((f, t)) => (f, t),
        None => (0.0, "—".to_owned()),
    };
    Campo { id, valor: Some(((fracao.clamp(0.0, 1.0)) * 100.0).round() / 100.0), texto, ligado: None }
}

fn seg(c: &Campo, rotulo: &str) -> Value {
    json!({"p":"segmentos","id":c.id,"rotulo":rotulo,"valor":c.valor.unwrap_or(0.0),"texto":c.texto})
}

fn led(c: &Campo, rotulo: &str) -> Value {
    json!({"p":"led","id":c.id,"rotulo":rotulo,"ligado":c.ligado.unwrap_or(false),"texto":c.texto})
}

/// Peças da tela inteira, como vão no `tela`.
fn pecas_da_tela(tela: &str, c: &[Campo]) -> Vec<Value> {
    let ache = |id: &str| c.iter().find(|x| x.id == id);
    let segs = |lista: &[(&str, &str)]| -> Vec<Value> {
        lista.iter().filter_map(|(id, rotulo)| ache(id).map(|x| seg(x, rotulo))).collect()
    };
    if tela == "recursos" {
        let mut pecas = segs(&[("cpu", "Processador"), ("mem", "Memória"), ("temp", "Temperatura"), ("bateria", "Bateria")]);
        pecas.extend(ache("rede").map(|x| led(x, "Rede")));
        return vec![json!({"p":"grade","id":"grade","colunas":2,"pecas":pecas})];
    }
    let mut topo = Vec::new();
    if let Some(r) = ache("relogio") {
        topo.push(json!({"p":"texto","id":"relogio","texto":r.texto,"tamanho":"g"}));
    }
    if let Some(d) = ache("data") {
        topo.push(json!({"p":"texto","id":"data","texto":d.texto,"tamanho":"m"}));
    }
    let mut linha = segs(&[("cpu", "CPU"), ("mem", "Mem."), ("temp", "Temp."), ("bateria", "Bateria")]);
    linha.extend(ache("rede").map(|x| led(x, "Rede")));
    topo.push(json!({"p":"linha","id":"linha","pecas":linha}));
    topo
}

/// Número em pt-BR: vírgula decimal.
pub fn pt(v: f64, casas: usize) -> String {
    format!("{:.*}", casas, v).replace('.', ",")
}

/// Porcentagem inteira: "41%".
pub fn pct(p: f64) -> String {
    format!("{}%", pt(p, 0))
}

/// Taxa em KB/s (base 1024): "40 KB/s", "3,6 KB/s", "1,2 MB/s".
pub fn taxa(kbs: f64) -> String {
    if kbs >= 1024.0 {
        format!("{} MB/s", pt(kbs / 1024.0, 1))
    } else if kbs < 10.0 {
        format!("{} KB/s", pt(kbs, 1))
    } else {
        format!("{} KB/s", pt(kbs, 0))
    }
}

/// Uso da CPU entre duas leituras de `/proc/stat` (linha `cpu`), em %.
pub fn cpu_percent(antes: &str, depois: &str) -> Option<f64> {
    let (total_a, ocioso_a) = tempos_cpu(antes)?;
    let (total_d, ocioso_d) = tempos_cpu(depois)?;
    let dt = total_d.checked_sub(total_a)?;
    let di = ocioso_d.checked_sub(ocioso_a)?;
    if dt == 0 {
        return None;
    }
    Some((1.0 - di as f64 / dt as f64).clamp(0.0, 1.0) * 100.0)
}

/// (total, ocioso) da linha `cpu` de `/proc/stat`. Ocioso soma `idle` e `iowait`; o total não
/// conta `guest` (já está em `user`).
fn tempos_cpu(texto: &str) -> Option<(u64, u64)> {
    let linha = texto.lines().find(|l| l.starts_with("cpu "))?;
    let v: Vec<u64> = linha.split_whitespace().skip(1).filter_map(|x| x.parse().ok()).collect();
    if v.len() < 4 {
        return None;
    }
    let total: u64 = v.iter().take(8).sum();
    let ocioso = v[3] + v.get(4).copied().unwrap_or(0);
    Some((total, ocioso))
}

/// Memória usada em %: (MemTotal - MemAvailable) / MemTotal, de `/proc/meminfo`.
pub fn memoria_percent(texto: &str) -> Option<f64> {
    let campo = |nome: &str| {
        texto.lines().find_map(|l| {
            let resto = l.strip_prefix(nome)?.strip_prefix(':')?;
            resto.split_whitespace().next()?.parse::<u64>().ok()
        })
    };
    let total = campo("MemTotal")? as f64;
    let disponivel = campo("MemAvailable")? as f64;
    if total <= 0.0 {
        return None;
    }
    Some(((total - disponivel) / total * 100.0).clamp(0.0, 100.0))
}

/// Soma de bytes recebidos e enviados em `/proc/net/dev`, exceto `lo`.
pub fn somar_rede(texto: &str) -> Option<(u64, u64)> {
    let mut rx = 0u64;
    let mut tx = 0u64;
    let mut achou = false;
    for linha in texto.lines() {
        let Some((nome, resto)) = linha.split_once(':') else { continue };
        if nome.trim() == "lo" {
            continue;
        }
        // Campos: bytes, pacotes, … (8 de recepção), bytes de envio na posição 8.
        let c: Vec<u64> = resto.split_whitespace().filter_map(|x| x.parse().ok()).collect();
        if c.len() < 9 {
            continue;
        }
        rx += c[0];
        tx += c[8];
        achou = true;
    }
    achou.then_some((rx, tx))
}

/// Taxas de descida e subida (KB/s) entre duas leituras de `/proc/net/dev`, `dt` segundos apart.
pub fn taxas_de_rede(antes: &str, depois: &str, dt: f64) -> Option<(f64, f64)> {
    if dt <= 0.0 {
        return None;
    }
    let (rx_a, tx_a) = somar_rede(antes)?;
    let (rx_d, tx_d) = somar_rede(depois)?;
    let kb = 1024.0;
    Some((rx_d.saturating_sub(rx_a) as f64 / dt / kb, tx_d.saturating_sub(tx_a) as f64 / dt / kb))
}

/// Temperatura em °C de um texto em miligraus (`temp1_input`, `temp`).
pub fn temperatura_de_miligraus(texto: &str) -> Option<f64> {
    texto.trim().parse::<i64>().ok().map(|m| m as f64 / 1000.0)
}

/// Entre `(pasta, nome)` dos hwmon, a pasta do sensor de CPU de maior prioridade.
pub fn escolher_hwmon(sensores: &[(String, String)]) -> Option<String> {
    SENSORES_CPU
        .iter()
        .find_map(|alvo| sensores.iter().find(|(_, nome)| nome == *alvo).map(|(pasta, _)| pasta.clone()))
}

/// Entre `(pasta, tipo)` das zonas térmicas, a `x86_pkg_temp` ou, sem ela, a primeira.
pub fn escolher_zona(zonas: &[(String, String)]) -> Option<String> {
    zonas.iter().find(|(_, tipo)| tipo == "x86_pkg_temp").or(zonas.first()).map(|(pasta, _)| pasta.clone())
}

/// Bateria a partir do texto de `capacity` e `status`. `None` se a capacidade não é número.
pub fn bateria_de(capacidade: &str, status: &str) -> Option<Bateria> {
    let porcento = capacidade.trim().parse::<f64>().ok()?;
    Some(Bateria { porcento: porcento.clamp(0.0, 100.0), status: status.trim().to_owned() })
}

/// Relógio a partir da saída de `date +%H:%M|%w|%d|%m` (dia da semana: 0 = domingo).
pub fn relogio_de(texto: &str) -> Option<Relogio> {
    let partes: Vec<&str> = texto.trim().split('|').collect();
    let [hora, dia_semana, dia, mes] = partes.as_slice() else { return None };
    let dia_semana: usize = dia_semana.parse().ok()?;
    let dia: u32 = dia.parse().ok()?;
    let mes: usize = mes.parse().ok()?;
    let nome_dia = DIAS.get(dia_semana)?;
    let nome_mes = MESES.get(mes.checked_sub(1)?)?;
    Some(Relogio { hora: (*hora).to_owned(), data: format!("{nome_dia}, {dia} {nome_mes}") })
}

/// Lê um arquivo; se não der, texto vazio (o sensor fica sem leitura).
fn ler(caminho: impl AsRef<Path>) -> String {
    fs::read_to_string(caminho).unwrap_or_default()
}

/// Pares `(pasta, conteúdo de <arquivo>)` das subpastas de `base` cujo nome começa com `prefixo`.
fn listar(base: &str, prefixo: &str, arquivo: &str) -> Vec<(String, String)> {
    let mut v: Vec<(String, String)> = fs::read_dir(base)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().starts_with(prefixo))
        .map(|e| {
            let pasta = e.path();
            let conteudo = ler(pasta.join(arquivo)).trim().to_owned();
            (pasta.to_string_lossy().into_owned(), conteudo)
        })
        .collect();
    v.sort();
    v
}

fn temperatura_do_sistema() -> Option<f64> {
    let hwmon = listar("/sys/class/hwmon", "hwmon", "name");
    if let Some(pasta) = escolher_hwmon(&hwmon) {
        if let Some(t) = temperatura_de_miligraus(&ler(Path::new(&pasta).join("temp1_input"))) {
            return Some(t);
        }
    }
    let zonas = listar("/sys/class/thermal", "thermal_zone", "type");
    let pasta = escolher_zona(&zonas)?;
    temperatura_de_miligraus(&ler(Path::new(&pasta).join("temp")))
}

fn bateria_do_sistema() -> Option<Bateria> {
    listar("/sys/class/power_supply", "BAT", "capacity").iter().find_map(|(pasta, capacidade)| {
        let status = ler(Path::new(pasta).join("status"));
        bateria_de(capacidade, &status)
    })
}

fn relogio_do_sistema() -> Option<Relogio> {
    let saida = Command::new("date").arg("+%H:%M|%w|%d|%m").output().ok()?;
    if !saida.status.success() {
        return None;
    }
    relogio_de(&String::from_utf8_lossy(&saida.stdout))
}

/// Uma leitura do computador. `anterior` é a leitura de antes (para CPU e rede).
/// Devolve também os textos brutos desta leitura, para a próxima.
pub fn amostrar(anterior: Option<&Bruto>) -> (Amostra, Bruto) {
    let agora = Instant::now();
    let bruto = Bruto { stat: ler("/proc/stat"), rede: ler("/proc/net/dev"), instante: agora };
    let (cpu, rede) = match anterior {
        Some(a) => {
            let dt = agora.duration_since(a.instante).as_secs_f64();
            (cpu_percent(&a.stat, &bruto.stat), taxas_de_rede(&a.rede, &bruto.rede, dt))
        }
        None => (None, None),
    };
    let amostra = Amostra {
        relogio: relogio_do_sistema(),
        cpu,
        memoria: memoria_percent(&ler("/proc/meminfo")),
        temperatura: temperatura_do_sistema(),
        rede,
        bateria: bateria_do_sistema(),
    };
    (amostra, bruto)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn de(m: &Mensagem) -> &Value {
        match m {
            Mensagem::Controle(v) => v,
            outra => panic!("esperava CONTROLE, veio {outra:?}"),
        }
    }

    fn ids(v: &Value) -> Vec<String> {
        v.as_array().unwrap().iter().map(|p| p["id"].as_str().unwrap().to_owned()).collect()
    }

    fn amostra(cpu: f64, rede: (f64, f64)) -> Amostra {
        Amostra {
            relogio: Some(Relogio { hora: "09:05".into(), data: "sex, 3 out".into() }),
            cpu: Some(cpu),
            memoria: Some(62.0),
            temperatura: Some(41.0),
            rede: Some(rede),
            bateria: None,
        }
    }

    /// Amostrador que devolve as amostras em ordem; mais uma leitura que as previstas é erro.
    fn sequencia(v: Vec<Amostra>) -> Box<dyn FnMut() -> Amostra + Send> {
        let mut fila = std::collections::VecDeque::from(v);
        Box::new(move || fila.pop_front().expect("amostra a mais do que o previsto"))
    }

    /// Amostrador que falha se for chamado: prova que a extensão não leu o sistema.
    fn nao_deve_ler() -> Box<dyn FnMut() -> Amostra + Send> {
        Box::new(|| -> Amostra { panic!("o sistema não devia ser lido") })
    }

    fn tique() -> Evento {
        Evento::novo("tique", Value::Null)
    }

    const STAT_A: &str = "cpu  100 0 100 800 0 0 0 0 0 0\ncpu0 50 0 50 400 0 0 0 0 0 0\n";
    const STAT_B: &str = "cpu  150 0 150 900 0 0 0 0 0 0\ncpu0 75 0 75 450 0 0 0 0 0 0\n";

    #[test]
    fn cpu_com_duas_leituras_de_proc_stat() {
        // Entre as duas: total +200, ocioso +100 (metade ocupada).
        let p = cpu_percent(STAT_A, STAT_B).unwrap();
        assert!((p - 50.0).abs() < 1e-9, "{p}");
        // Sem tempo passado, não há conta.
        assert_eq!(cpu_percent(STAT_A, STAT_A), None);
        assert_eq!(cpu_percent("", STAT_B), None);
    }

    #[test]
    fn memoria_usa_total_menos_disponivel() {
        let texto = "MemTotal:       16000000 kB\nMemFree:         500000 kB\nMemAvailable:   12000000 kB\n";
        assert!((memoria_percent(texto).unwrap() - 25.0).abs() < 1e-9);
        assert_eq!(memoria_percent("MemFree: 1 kB\n"), None);
    }

    const REDE_A: &str = "Inter-|   Receive\n face |bytes packets\n    lo: 1000 10 0 0 0 0 0 0 1000 10 0 0 0 0 0 0\n  eth0: 5000000 100 0 0 0 0 0 0 1000000 50 0 0 0 0 0 0\n";
    const REDE_B: &str = "Inter-|   Receive\n face |bytes packets\n    lo: 9999999 10 0 0 0 0 0 0 9999999 10 0 0 0 0 0 0\n  eth0: 7457600 100 0 0 0 0 0 0 1081920 50 0 0 0 0 0 0\n";

    #[test]
    fn rede_soma_interfaces_sem_lo_e_da_taxa_em_kbs() {
        assert_eq!(somar_rede(REDE_A), Some((5000000, 1000000)));
        // eth0 recebeu 2 457 600 bytes e enviou 81 920 em 2 s: 1200 e 40 KB/s.
        let (d, u) = taxas_de_rede(REDE_A, REDE_B, 2.0).unwrap();
        assert!((d - 1200.0).abs() < 1e-9, "{d}");
        assert!((u - 40.0).abs() < 1e-9, "{u}");
        assert_eq!(taxas_de_rede(REDE_A, REDE_B, 0.0), None);
    }

    #[test]
    fn temperatura_de_texto_em_miligraus() {
        assert_eq!(temperatura_de_miligraus("41500\n"), Some(41.5));
        assert_eq!(temperatura_de_miligraus(" 62000 "), Some(62.0));
        assert_eq!(temperatura_de_miligraus("quente"), None);
    }

    #[test]
    fn sensor_de_cpu_por_prioridade_e_zona_x86() {
        let hw = vec![
            ("/sys/class/hwmon/hwmon0".to_owned(), "nvme".to_owned()),
            ("/sys/class/hwmon/hwmon1".to_owned(), "cpu_thermal".to_owned()),
            ("/sys/class/hwmon/hwmon2".to_owned(), "k10temp".to_owned()),
        ];
        assert_eq!(escolher_hwmon(&hw).as_deref(), Some("/sys/class/hwmon/hwmon2"));
        assert_eq!(escolher_hwmon(&hw[..1]), None);

        let zonas = vec![
            ("/sys/class/thermal/thermal_zone0".to_owned(), "acpitz".to_owned()),
            ("/sys/class/thermal/thermal_zone1".to_owned(), "x86_pkg_temp".to_owned()),
        ];
        assert_eq!(escolher_zona(&zonas).as_deref(), Some("/sys/class/thermal/thermal_zone1"));
        assert_eq!(escolher_zona(&zonas[..1]).as_deref(), Some("/sys/class/thermal/thermal_zone0"));
    }

    #[test]
    fn formatacao_pt_br() {
        assert_eq!(pt(1.2, 1), "1,2");
        assert_eq!(pct(41.4), "41%");
        assert_eq!(taxa(1228.8), "1,2 MB/s");
        assert_eq!(taxa(40.0), "40 KB/s");
        assert_eq!(taxa(3.56), "3,6 KB/s");
        assert_eq!(relogio_de("09:05|5|3|10"), Some(Relogio { hora: "09:05".into(), data: "sex, 3 out".into() }));
        assert_eq!(relogio_de("09:05|9|3|10"), None);
        assert_eq!(relogio_de("09:05|5|3"), None);
    }

    #[test]
    fn bateria_de_capacidade_e_status() {
        let b = bateria_de("78\n", "Charging\n").unwrap();
        assert_eq!(b.porcento, 78.0);
        assert_eq!(b.status, "Charging");
        assert_eq!(bateria_de("nada", "Full"), None);
    }

    #[test]
    fn abrir_painel_devolve_tela_com_as_pecas() {
        let mut ext = Informacoes::nova(sequencia(vec![amostra(40.0, (1228.8, 40.0))]));
        let mut r = Vec::new();
        assert!(ext.controle("abrir", &json!({"t":"abrir","tela":"painel"}), &mut r));
        let tela = de(&r[0]);
        assert_eq!(tela["t"], "tela");
        assert_eq!(tela["id"], "painel");
        assert_eq!(tela["nivel"], 2);
        assert_eq!(ids(&tela["pecas"]), vec!["relogio", "data", "linha"]);
        assert_eq!(tela["pecas"][0]["texto"], "09:05");
        assert_eq!(tela["pecas"][0]["tamanho"], "g");
        let linha = &tela["pecas"][2]["pecas"];
        // Sem bateria: a linha tem CPU, memória, temperatura e a rede.
        assert_eq!(ids(linha), vec!["cpu", "mem", "temp", "rede"]);
        assert_eq!(linha[0]["p"], "segmentos");
        assert_eq!(linha[0]["texto"], "40%");
        assert_eq!(linha[2]["texto"], "41 °C");
        assert_eq!(linha[3]["p"], "led");
        assert_eq!(linha[3]["texto"], "↓ 1,2 MB/s ↑ 40 KB/s");
    }

    #[test]
    fn abrir_recursos_monta_grade_de_duas_colunas() {
        let mut a = amostra(40.0, (1.0, 1.0));
        a.bateria = Some(Bateria { porcento: 80.0, status: "Discharging".into() });
        let mut ext = Informacoes::nova(sequencia(vec![a]));
        let mut r = Vec::new();
        assert!(ext.controle("abrir", &json!({"t":"abrir","tela":"recursos"}), &mut r));
        let tela = de(&r[0]);
        assert_eq!(tela["nome"], "Recursos");
        let grade = &tela["pecas"][0];
        assert_eq!(grade["p"], "grade");
        assert_eq!(grade["colunas"], 2);
        assert_eq!(ids(&grade["pecas"]), vec!["cpu", "mem", "temp", "bateria", "rede"]);
        assert_eq!(grade["pecas"][3]["texto"], "80% · na bateria");
    }

    #[test]
    fn abrir_outra_tela_nao_responde_nem_le_o_sistema() {
        let mut ext = Informacoes::nova(nao_deve_ler());
        let mut r = Vec::new();
        assert!(!ext.controle("abrir", &json!({"t":"abrir","tela":"trackpad"}), &mut r));
        assert!(!ext.controle("abrir", &json!({"t":"abrir","tela":"giro"}), &mut r));
        assert!(!ext.controle("outro", &json!({"t":"outro"}), &mut r));
        assert!(r.is_empty());
        // Com outra tela aberta, o tique não lê nada.
        ext.evento(&tique(), &mut r);
        assert!(r.is_empty());
    }

    #[test]
    fn tique_com_tela_fechada_nao_manda_nada() {
        let mut ext = Informacoes::nova(nao_deve_ler());
        let mut r = Vec::new();
        ext.evento(&tique(), &mut r);
        assert!(r.is_empty());
        // Um evento que não é tique também não lê nada.
        ext.evento(&Evento::novo("foco", Value::Null), &mut r);
        assert!(r.is_empty());
    }

    #[test]
    fn tique_manda_so_o_que_mudou() {
        let mut ext = Informacoes::nova(sequencia(vec![
            amostra(40.0, (1.0, 1.0)),
            // Tique 1: só a CPU mudou.
            amostra(55.0, (1.0, 1.0)),
            // Tique 2: nada mudou (o pequeno ruído da rede não aparece na tela).
            amostra(55.0, (1.02, 1.0)),
            // Tique 3: passou o minuto; só o relógio muda.
            Amostra { relogio: Some(Relogio { hora: "09:06".into(), data: "sex, 3 out".into() }), ..amostra(55.0, (1.02, 1.0)) },
        ]));
        let mut r = Vec::new();
        assert!(ext.controle("abrir", &json!({"t":"abrir","tela":"painel"}), &mut r));

        let mut r1 = Vec::new();
        ext.evento(&tique(), &mut r1);
        assert_eq!(r1.len(), 1);
        let estado = de(&r1[0]);
        assert_eq!(estado["t"], "estado");
        assert_eq!(estado["tela"], "painel");
        assert_eq!(ids(&estado["pecas"]), vec!["cpu"]);
        assert_eq!(estado["pecas"][0]["texto"], "55%");
        assert!((estado["pecas"][0]["valor"].as_f64().unwrap() - 0.55).abs() < 1e-9);

        let mut r2 = Vec::new();
        ext.evento(&tique(), &mut r2);
        assert!(r2.is_empty(), "{r2:?}");

        let mut r3 = Vec::new();
        ext.evento(&tique(), &mut r3);
        assert_eq!(r3.len(), 1);
        assert_eq!(ids(&de(&r3[0])["pecas"]), vec!["relogio"]);
        assert_eq!(de(&r3[0])["pecas"][0]["texto"], "09:06");
    }

    #[test]
    fn primeira_leitura_sem_taxa_mostra_traco() {
        let a = Amostra { relogio: None, cpu: None, memoria: None, temperatura: None, rede: None, bateria: None };
        let c = campos(&a, "painel");
        assert_eq!(c.iter().map(|x| x.id).collect::<Vec<_>>(), vec!["cpu", "mem", "temp", "rede"]);
        assert_eq!(c[0].texto, "—");
        assert_eq!(c[3].ligado, Some(false));
    }

    #[test]
    fn telas_da_extensao() {
        let ext = Informacoes::nova(nao_deve_ler());
        let telas = ext.telas();
        assert_eq!(telas[0], json!({"id":"painel","nome":"Informações","icone":"info","grupo":"Tela","nivel":2}));
        assert_eq!(telas[1], json!({"id":"recursos","nome":"Recursos","icone":"mixer","grupo":"Tela","nivel":2}));
    }

    #[test]
    #[ignore]
    fn amostra_real() {
        let (primeira, bruto) = amostrar(None);
        println!("amostrar(None) = {primeira:?}");
        std::thread::sleep(std::time::Duration::from_secs(1));
        let (segunda, _) = amostrar(Some(&bruto));
        println!("segunda leitura, 1 s depois = {segunda:?}");
    }
}
