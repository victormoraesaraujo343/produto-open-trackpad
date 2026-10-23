package org.opentrackpad.ui

/**
 * Lógica do teclado do celular, sem Compose (testável na JVM).
 *
 * O layout segue o protótipo (`src/celular/entrada/TelaTeclado.tsx`), que copia o Gboard em
 * português: a linha a–l é recuada meia tecla de cada lado; `c`, `a`, `e`, `o`, `u` e `i`
 * dão acentos ao segurar.
 */

/** Modo do teclado: letras (padrão) ou numérico com símbolos. */
enum class Modo { LETRAS, NUMEROS }

/** O que a tecla faz além de (ou em vez de) mandar texto. */
enum class Funcao {
    /** Manda `texto` (ou o acento, se segurada). */
    NENHUMA,
    /** Espaço vazio que só ocupa largura (recuo da linha a–l). */
    VAZIA,
    SHIFT,
    APAGAR,
    ENTER,
    /** Troca entre letras e números. */
    TROCAR_MODO,
}

/**
 * Uma tecla do layout. `rotulo` é o que aparece; `texto` é o que sai do teclado (minúscula
 * para letras); `peso` é a largura relativa na linha; `nome` é o nome acessível; `segurar`
 * é o caractere que sai se a tecla for segurada (null: a tecla não tem segurar).
 */
data class TeclaDef(
    val rotulo: String,
    val texto: String = "",
    val funcao: Funcao = Funcao.NENHUMA,
    val peso: Float = 1f,
    val nome: String = rotulo,
    val segurar: String? = null,
)

/** O que uma tecla manda para fora: texto digitado, uma tecla nomeada ou nada (estado local). */
sealed interface Saida {
    data class Texto(val s: String) : Saida
    /** `nome` é "apagar" ou "enter". */
    data class Tecla(val nome: String) : Saida
    object Nada : Saida
}

/** Tempo de segurar até o acento sair (ms). */
const val SEGURAR_MS = 380L

/** Quantos caracteres a linha do texto enviado mostra. */
const val HISTORICO_MAX = 40

/** Acentos das teclas com segurar. */
val ACENTOS: Map<Char, String> = mapOf(
    'c' to "ç",
    'a' to "á",
    'e' to "é",
    'o' to "ó",
    'u' to "ú",
    'i' to "í",
)

private fun letra(c: Char): TeclaDef = TeclaDef(
    rotulo = c.toString(),
    texto = c.toString(),
    nome = c.toString(),
    segurar = ACENTOS[c],
)

private fun simbolo(s: String, nome: String = s, peso: Float = 1f): TeclaDef =
    TeclaDef(rotulo = s, texto = s, peso = peso, nome = nome)

private fun vazia(peso: Float): TeclaDef = TeclaDef(rotulo = "", funcao = Funcao.VAZIA, peso = peso)

private val SHIFT = TeclaDef(rotulo = "⇧", funcao = Funcao.SHIFT, peso = 1.5f, nome = "Maiúscula")
private fun apagar(peso: Float) = TeclaDef(rotulo = "⌫", funcao = Funcao.APAGAR, peso = peso, nome = "Apagar")
private fun enter(peso: Float) = TeclaDef(rotulo = "↵", funcao = Funcao.ENTER, peso = peso, nome = "Enter")
private fun espaco(peso: Float) = TeclaDef(rotulo = "espaço", texto = " ", peso = peso, nome = "Espaço")
private fun trocarModo(rotulo: String, nome: String, peso: Float) =
    TeclaDef(rotulo = rotulo, funcao = Funcao.TROCAR_MODO, peso = peso, nome = nome)

/**
 * Linhas do teclado, de cima para baixo. As três primeiras linhas de letras e a de números
 * têm 10 unidades de largura cada (ou 4 colunas no numérico), para alinhar as teclas.
 */
fun linhasDo(modo: Modo): List<List<TeclaDef>> = when (modo) {
    Modo.LETRAS -> listOf(
        "qwertyuiop".map(::letra),
        listOf(vazia(0.5f)) + "asdfghjkl".map(::letra) + vazia(0.5f),
        listOf(SHIFT) + "zxcvbnm".map(::letra) + apagar(1.5f),
        listOf(
            trocarModo("123", "Números", 1.5f),
            simbolo(",", "Vírgula"),
            espaco(5f),
            simbolo(".", "Ponto"),
            enter(1.5f),
        ),
    )
    Modo.NUMEROS -> listOf(
        listOf(simbolo("7"), simbolo("8"), simbolo("9"), simbolo("/", "Dividir")),
        listOf(simbolo("4"), simbolo("5"), simbolo("6"), simbolo("*", "Vezes")),
        listOf(simbolo("1"), simbolo("2"), simbolo("3"), simbolo("-", "Menos")),
        listOf(simbolo("0"), simbolo(",", "Vírgula"), simbolo(".", "Ponto"), simbolo("+", "Mais")),
        listOf(
            trocarModo("ABC", "Letras", 1.5f),
            espaco(4f),
            apagar(1.5f),
            enter(1.5f),
        ),
    )
}

private fun ehLetra(def: TeclaDef): Boolean =
    def.funcao == Funcao.NENHUMA && def.texto.length == 1 && def.texto[0].isLetter()

/** Rótulo mostrado: letras aparecem em maiúscula enquanto o shift estiver ligado. */
fun rotuloVisivel(def: TeclaDef, maiuscula: Boolean): String =
    if (maiuscula && ehLetra(def)) def.rotulo.uppercase() else def.rotulo

/**
 * Decide o que a tecla manda. `segurou` vale quando o acento foi disparado (tecla com
 * `segurar` segurada). O shift deixa a letra em maiúscula; quem controla o shift é [shiftApos].
 */
fun decidir(def: TeclaDef, maiuscula: Boolean, segurou: Boolean): Saida = when (def.funcao) {
    Funcao.APAGAR -> Saida.Tecla("apagar")
    Funcao.ENTER -> Saida.Tecla("enter")
    Funcao.NENHUMA -> {
        val acento = def.segurar
        val base = if (segurou && acento != null) acento else def.texto
        val saida = if (maiuscula && base.length == 1 && base[0].isLetter()) base.uppercase() else base
        Saida.Texto(saida)
    }
    Funcao.VAZIA, Funcao.SHIFT, Funcao.TROCAR_MODO -> Saida.Nada
}

/**
 * Estado do shift depois de uma tecla: o shift liga e desliga com a própria tecla, e
 * qualquer caractere gasta o shift (uma letra só, como no Gboard).
 */
fun shiftApos(atual: Boolean, def: TeclaDef): Boolean = when (def.funcao) {
    Funcao.SHIFT -> !atual
    Funcao.NENHUMA -> false
    Funcao.VAZIA, Funcao.APAGAR, Funcao.ENTER, Funcao.TROCAR_MODO -> atual
}

/** Acrescenta um trecho enviado ao histórico e mantém só os últimos [HISTORICO_MAX] caracteres. */
fun acrescentar(historico: String, trecho: String): String {
    val junto = historico + trecho
    if (junto.length <= HISTORICO_MAX) return junto
    var corte = junto.length - HISTORICO_MAX
    // Não deixa um par de surrogates partido no começo.
    if (Character.isLowSurrogate(junto[corte])) corte++
    return junto.substring(corte)
}

/** Apagar no histórico: tira o último caractere (ou o par de surrogates, se houver). */
fun apagarUltimo(historico: String): String {
    if (historico.isEmpty()) return historico
    val pares = historico.length >= 2 &&
        Character.isLowSurrogate(historico[historico.length - 1]) &&
        Character.isHighSurrogate(historico[historico.length - 2])
    return historico.dropLast(if (pares) 2 else 1)
}
