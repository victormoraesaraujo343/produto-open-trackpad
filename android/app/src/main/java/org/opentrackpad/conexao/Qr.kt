package org.opentrackpad.conexao

import java.net.URLDecoder

/**
 * Convite lido do QR do pareamento (`protocolo/README.md`, "QR do pareamento").
 * Sem `hosts` e sem `porta` (só `c`), o convite serve para o cabo.
 */
data class ConviteQr(
    val hosts: List<String>,
    val porta: Int?,
    /** SHA-256 do certificado do computador, em hex minúsculo. */
    val impressao: String?,
    val codigo: String,
    val nome: String?,
)

private const val PREFIXO = "otp1:?"
private const val NOME_MAX = 60
private val CODIGO = Regex("[0-9]{6}")
private val HEX_64 = Regex("[0-9a-fA-F]{64}")
private val PORTA = Regex("[0-9]{1,5}")
private val OCTETO = Regex("0|[1-9][0-9]{0,2}")

/**
 * Lê o texto de um QR. Devolve `null` se não for um convite nosso: prefixo errado, código
 * ausente ou fora do formato, `fp` ou `p` mal formados, ou escape de URL inválido.
 * Endereços que não são IPv4 válido são descartados (a lista pode ficar vazia).
 */
fun lerConvite(texto: String): ConviteQr? {
    if (!texto.startsWith(PREFIXO)) return null

    val campos = LinkedHashMap<String, String>()
    for (par in texto.substring(PREFIXO.length).split('&')) {
        val i = par.indexOf('=')
        if (i <= 0) continue
        val chave = par.substring(0, i)
        if (campos.containsKey(chave)) continue // vale o primeiro
        campos[chave] = try {
            URLDecoder.decode(par.substring(i + 1), "UTF-8")
        } catch (_: IllegalArgumentException) {
            return null
        }
    }

    val codigo = campos["c"]?.takeIf { CODIGO.matches(it) } ?: return null
    val impressao = campos["fp"]?.let { valor ->
        if (!HEX_64.matches(valor)) return null
        valor.lowercase()
    }
    val porta = campos["p"]?.let { valor ->
        if (!PORTA.matches(valor)) return null
        valor.toInt().takeIf { it in 1..65535 } ?: return null
    }
    val hosts = campos["h"]?.split(',')?.filter(::ipv4)?.distinct().orEmpty()
    val nome = campos["n"]?.takeIf { it.isNotBlank() }?.let { cortar(it, NOME_MAX) }

    return ConviteQr(hosts = hosts, porta = porta, impressao = impressao, codigo = codigo, nome = nome)
}

/**
 * Um destino Wi-Fi por endereço. Vazio quando o convite não tem `p` e `fp` (caso do cabo).
 */
fun ConviteQr.destinos(): List<Destino> {
    val p = porta ?: return emptyList()
    val fp = impressao ?: return emptyList()
    return hosts.map { Destino(host = it, porta = p, via = "wifi", impressao = fp) }
}

/** IPv4 com quatro octetos de 0 a 255, sem zeros à esquerda (que o `inet_aton` leria como octal). */
private fun ipv4(s: String): Boolean {
    val partes = s.split('.')
    return partes.size == 4 && partes.all { OCTETO.matches(it) && it.toInt() <= 255 }
}

/** Corta em `max` caracteres Unicode (não corta um par substituto ao meio). */
private fun cortar(s: String, max: Int): String {
    if (s.codePointCount(0, s.length) <= max) return s
    return s.substring(0, s.offsetByCodePoints(0, max))
}
