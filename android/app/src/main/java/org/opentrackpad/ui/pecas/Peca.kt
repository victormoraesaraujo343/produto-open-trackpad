package org.opentrackpad.ui.pecas

import org.json.JSONArray
import org.json.JSONObject

/**
 * Peça de tela descrita pelo computador (`protocolo/README.md`, seção "Peças de tela").
 * O celular não sabe o que é cada tela: só desenha o que chega. Tipo desconhecido não
 * entra na lista (vira null em [lerPeca]).
 */
sealed class Peca {
    abstract val id: String

    data class Tecla(
        override val id: String,
        val rotulo: String,
        val icone: String?,
        val dica: String?,
    ) : Peca()

    /** Toque prende, toque solta (forma trava). Manda `tecla` com `aperta`/`solta`. */
    data class TeclaPresa(override val id: String, val rotulo: String, val k: String) : Peca()

    data class Fader(
        override val id: String,
        val rotulo: String,
        val valor: Double,
        val icone: String?,
        val mudo: Boolean,
    ) : Peca()

    /** Giratório: o protocolo diz `passos` por volta (ex.: 36). */
    data class Giro(override val id: String, val rotulo: String, val valor: Double, val passos: Int) : Peca()

    /** Medidor só de leitura. */
    data class Segmentos(override val id: String, val rotulo: String, val valor: Double, val texto: String) : Peca()

    data class Led(override val id: String, val rotulo: String, val ligado: Boolean, val texto: String) : Peca()

    data class Texto(override val id: String, val texto: String, val tamanho: Tamanho) : Peca()

    /** Ícone de app (ou janela) em base64 PNG; a decodificação fica na hora de desenhar. */
    data class IconeApp(override val id: String, val rotulo: String, val png: String) : Peca()

    data class Grade(override val id: String, val colunas: Int, val pecas: List<Peca>) : Peca()

    data class Linha(override val id: String, val pecas: List<Peca>) : Peca()

    /** Vídeo do computador (espelho, segundo monitor). `modo`: `trackpad` ou `toque`. */
    data class Video(override val id: String, val w: Int, val h: Int, val modo: String) : Peca()
}

enum class Tamanho { P, M, G }

/** As duas laterais do aparelho: atalhos do app em foco (esquerda) e do sistema (direita). */
data class Laterais(
    val app: String,
    val iconeApp: String,
    val esquerda: List<Peca>,
    val direita: List<Peca>,
)

/** Uma tela inteira (`{"t":"tela", ...}`). */
data class TelaDescrita(val id: String, val nome: String, val nivel: Int, val pecas: List<Peca>)

/**
 * Lê uma peça. `p` desconhecido (ou peça nativa como `trackpad` e `teclado`, que não
 * são desenhadas por aqui) devolve null. Campos opcionais ausentes ganham um padrão.
 */
fun lerPeca(json: JSONObject): Peca? {
    val id = json.optString("id", "")
    return when (json.optString("p", "")) {
        "tecla" -> Peca.Tecla(id, json.optString("rotulo", ""), json.opcional("icone"), json.opcional("dica"))
        "tecla_presa" -> Peca.TeclaPresa(id, json.optString("rotulo", ""), json.optString("k", ""))
        "fader" -> Peca.Fader(
            id, json.optString("rotulo", ""), unidade(json.optDouble("valor", 0.0)),
            json.opcional("icone"), json.optBoolean("mudo", false),
        )
        "giro" -> Peca.Giro(
            id, json.optString("rotulo", ""), unidade(json.optDouble("valor", 0.0)),
            json.optInt("passos", 36),
        )
        "segmentos" -> Peca.Segmentos(
            id, json.optString("rotulo", ""), unidade(json.optDouble("valor", 0.0)),
            json.optString("texto", ""),
        )
        "led" -> Peca.Led(id, json.optString("rotulo", ""), json.optBoolean("ligado", false), json.optString("texto", ""))
        "texto" -> Peca.Texto(id, json.optString("texto", ""), tamanhoDe(json.optString("tamanho", "m")))
        "icone_app" -> Peca.IconeApp(id, json.optString("rotulo", ""), json.optString("png", ""))
        "grade" -> Peca.Grade(
            id, json.optInt("colunas", 2).coerceAtLeast(1),
            lerPecas(json.optJSONArray("pecas") ?: JSONArray()),
        )
        "linha" -> Peca.Linha(id, lerPecas(json.optJSONArray("pecas") ?: JSONArray()))
        "video" -> Peca.Video(id, json.optInt("w", 1280), json.optInt("h", 720), json.optString("modo", "trackpad"))
        else -> null
    }
}

/** Lê uma lista de peças, pulando as que não se reconhecem. */
fun lerPecas(arr: JSONArray): List<Peca> = buildList {
    for (i in 0 until arr.length()) {
        val objeto = arr.optJSONObject(i) ?: continue
        lerPeca(objeto)?.let(::add)
    }
}

/** Lê `esquerda` e `direita` com o app em foco. Listas ausentes viram vazias. */
fun lerLaterais(json: JSONObject): Laterais {
    val app = json.optJSONObject("app")
    return Laterais(
        app = app?.optString("nome", "") ?: json.optString("app", ""),
        iconeApp = app?.optString("icone", "") ?: "",
        esquerda = lerPecas(json.optJSONArray("esquerda") ?: JSONArray()),
        direita = lerPecas(json.optJSONArray("direita") ?: JSONArray()),
    )
}

/** Lê uma tela descrita pelo computador. */
fun lerTela(json: JSONObject): TelaDescrita = TelaDescrita(
    id = json.optString("id", ""),
    nome = json.optString("nome", ""),
    nivel = json.optInt("nivel", 1),
    pecas = lerPecas(json.optJSONArray("pecas") ?: JSONArray()),
)

/**
 * Aplica uma mensagem `estado` à tela descrita (`protocolo/README.md`): troca só os campos
 * que vieram, nas peças com esses ids (recursivo em grade e linha). Outra tela, ou ids que a
 * tela não tem, não mudam nada. Pura: devolve a tela nova (ou a mesma, se nada mudou).
 */
fun aplicarEstado(tela: TelaDescrita, json: JSONObject): TelaDescrita {
    if (json.optString("tela") != tela.id) return tela
    val arr = json.optJSONArray("pecas") ?: return tela
    val mudancas = HashMap<String, JSONObject>()
    for (i in 0 until arr.length()) {
        val o = arr.optJSONObject(i) ?: continue
        val id = o.optString("id", "")
        if (id.isNotEmpty()) mudancas[id] = o
    }
    if (mudancas.isEmpty()) return tela
    return tela.copy(pecas = aplicarEmPecas(tela.pecas, mudancas))
}

private fun aplicarEmPecas(pecas: List<Peca>, mudancas: Map<String, JSONObject>): List<Peca> =
    pecas.map { aplicarEmPeca(it, mudancas) }

private fun aplicarEmPeca(p: Peca, mudancas: Map<String, JSONObject>): Peca {
    if (p is Peca.Grade) return p.copy(pecas = aplicarEmPecas(p.pecas, mudancas))
    if (p is Peca.Linha) return p.copy(pecas = aplicarEmPecas(p.pecas, mudancas))
    val m = mudancas[p.id] ?: return p
    return when (p) {
        is Peca.Tecla -> p.copy(rotulo = textoDe(m, "rotulo", p.rotulo), icone = textoDe(m, "icone", p.icone ?: "").ifEmpty { p.icone })
        is Peca.TeclaPresa -> p.copy(rotulo = textoDe(m, "rotulo", p.rotulo))
        is Peca.Fader -> p.copy(
            rotulo = textoDe(m, "rotulo", p.rotulo),
            valor = valorDe(m, "valor", p.valor),
            mudo = boolDe(m, "mudo", p.mudo),
        )
        is Peca.Giro -> p.copy(rotulo = textoDe(m, "rotulo", p.rotulo), valor = valorDe(m, "valor", p.valor))
        is Peca.Segmentos -> p.copy(
            rotulo = textoDe(m, "rotulo", p.rotulo),
            valor = valorDe(m, "valor", p.valor),
            texto = textoDe(m, "texto", p.texto),
        )
        is Peca.Led -> p.copy(
            rotulo = textoDe(m, "rotulo", p.rotulo),
            ligado = boolDe(m, "ligado", p.ligado),
            texto = textoDe(m, "texto", p.texto),
        )
        is Peca.Texto -> p.copy(texto = textoDe(m, "texto", p.texto))
        is Peca.IconeApp -> p.copy(rotulo = textoDe(m, "rotulo", p.rotulo))
        is Peca.Grade, is Peca.Linha, is Peca.Video -> p
    }
}

/** Campo presente (e não `null`) substitui o atual; ausente mantém. */
private fun textoDe(m: JSONObject, nome: String, atual: String): String =
    if (m.temValor(nome)) m.optString(nome, atual) else atual

private fun valorDe(m: JSONObject, nome: String, atual: Double): Double =
    if (m.temValor(nome)) unidade(m.optDouble(nome, atual)) else atual

private fun boolDe(m: JSONObject, nome: String, atual: Boolean): Boolean =
    if (m.temValor(nome)) m.optBoolean(nome, atual) else atual

private fun JSONObject.temValor(nome: String): Boolean = has(nome) && !isNull(nome)

/** Texto opcional: ausente ou `null` vira null (não string vazia). */
private fun JSONObject.opcional(nome: String): String? = if (isNull(nome)) null else optString(nome)

/** Valores 0..1; número inválido vira 0 e fora da faixa é encaixado. */
private fun unidade(v: Double): Double = if (v.isNaN()) 0.0 else v.coerceIn(0.0, 1.0)

private fun tamanhoDe(s: String): Tamanho = when (s) {
    "p" -> Tamanho.P
    "g" -> Tamanho.G
    else -> Tamanho.M
}
