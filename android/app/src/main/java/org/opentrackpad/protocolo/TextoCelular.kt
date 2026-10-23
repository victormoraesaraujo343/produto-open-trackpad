package org.opentrackpad.protocolo

import org.json.JSONObject

/** Bytes UTF-8 do texto que o celular manda em `area_transferencia` (`protocolo/README.md`). */
const val LIMITE_TEXTO_CELULAR = 15_000

/**
 * Corta `texto` para caber em [limite] bytes UTF-8 e no último caractere inteiro (sem partir
 * par de surrogates nem sequência UTF-8). Conta o texto como sai no JSON: `\n` vira 2 bytes,
 * aspas também, então a mensagem nunca passa do limite de 16 KiB. Devolve o começo do texto e
 * se cortou. Pura, testável.
 */
fun cortarParaCelular(texto: String, limite: Int = LIMITE_TEXTO_CELULAR): Pair<String, Boolean> {
    if (bytesNoJson(texto) <= limite) return texto to false
    // Busca binária sobre o número de code points: cada candidato é um prefixo inteiro.
    var cabe = 0
    var nao = texto.codePointCount(0, texto.length)
    while (nao - cabe > 1) {
        val meio = (cabe + nao) / 2
        if (bytesNoJson(texto.substring(0, texto.offsetByCodePoints(0, meio))) <= limite) cabe = meio else nao = meio
    }
    return texto.substring(0, texto.offsetByCodePoints(0, cabe)) to true
}

/** Bytes do texto dentro da string JSON (sem as aspas que envolvem). */
private fun bytesNoJson(s: String): Int = JSONObject.quote(s).toByteArray(Charsets.UTF_8).size - 2
