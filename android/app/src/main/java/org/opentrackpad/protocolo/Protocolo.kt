package org.opentrackpad.protocolo

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.EOFException
import java.io.IOException
import java.io.InputStream

/**
 * Enquadramento do protocolo OTP/1 (ver `protocolo/README.md` na raiz do repositório).
 * Sem rede aqui: tudo testável contra `protocolo/vetores/`.
 */
object Protocolo {
    const val VERSAO = 1
    const val PORTA = 47800
    const val MAX_CONTATOS = 10

    /** O computador pode mandar até 64 KiB (telas com ícones). */
    const val MAX_CONTROLE_COMPUTADOR = 65_534

    const val T_CONTROLE = 0x01
    const val T_TOQUE = 0x10
    const val T_PING = 0x20
    const val T_PONG = 0x21
    const val T_CARGA = 0x22
    const val T_VIDEO = 0x30
    const val T_AUDIO = 0x31
}

data class Contato(val id: Int, val x: Int, val y: Int, val major: Int)

sealed class Mensagem {
    data class Controle(val json: JSONObject) : Mensagem() {
        val t: String get() = json.optString("t")

        // JSONObject não tem equals por conteúdo.
        override fun equals(other: Any?) = other is Controle && mesmoConteudo(other.json, json)
        override fun hashCode() = t.hashCode()
    }

    data class Toque(val seq: Long, val contatos: List<Contato>) : Mensagem()
    data class Ping(val nonce: Long, val tUs: Long) : Mensagem()
    data class Pong(val nonce: Long, val tUs: Long) : Mensagem()
    class Carga(val dados: ByteArray) : Mensagem()
    class Video(val ptsUs: Long, val dados: ByteArray) : Mensagem()
    class Audio(val ptsUs: Long, val dados: ByteArray) : Mensagem()
}

class ErroDeProtocolo(motivo: String) : IOException(motivo)

/** Mensagem inteira, com o comprimento na frente. */
fun codificar(m: Mensagem): ByteArray {
    val carga = ByteArrayOutputStream()
    val tipo: Int
    when (m) {
        is Mensagem.Controle -> {
            tipo = Protocolo.T_CONTROLE
            carga.write(m.json.toString().toByteArray(Charsets.UTF_8))
        }
        is Mensagem.Toque -> {
            tipo = Protocolo.T_TOQUE
            carga.u32(m.seq)
            carga.write(m.contatos.size)
            for (c in m.contatos) {
                carga.write(c.id)
                carga.u16(c.x)
                carga.u16(c.y)
                carga.u16(c.major)
            }
        }
        is Mensagem.Ping -> { tipo = Protocolo.T_PING; carga.u32(m.nonce); carga.u64(m.tUs) }
        is Mensagem.Pong -> { tipo = Protocolo.T_PONG; carga.u32(m.nonce); carga.u64(m.tUs) }
        is Mensagem.Carga -> { tipo = Protocolo.T_CARGA; carga.write(m.dados) }
        is Mensagem.Video -> { tipo = Protocolo.T_VIDEO; carga.u64(m.ptsUs); carga.write(m.dados) }
        is Mensagem.Audio -> { tipo = Protocolo.T_AUDIO; carga.u64(m.ptsUs); carga.write(m.dados) }
    }
    val len = carga.size() + 1
    require(len <= 0xFFFF) { "mensagem grande demais" }
    val out = ByteArrayOutputStream(len + 2)
    out.u16(len)
    out.write(tipo)
    carga.writeTo(out)
    return out.toByteArray()
}

/** Lê uma mensagem. `null` = o outro lado fechou entre mensagens. */
fun ler(entrada: InputStream, limiteControle: Int = Protocolo.MAX_CONTROLE_COMPUTADOR): Mensagem? {
    val d = if (entrada is DataInputStream) entrada else DataInputStream(entrada)
    val hi = d.read()
    if (hi < 0) return null
    val lo = d.read()
    if (lo < 0) throw EOFException()
    val len = (hi shl 8) or lo
    if (len == 0) throw ErroDeProtocolo("comprimento")
    val corpo = ByteArray(len)
    d.readFully(corpo)
    val tipo = corpo[0].toInt() and 0xFF
    if (tipo == Protocolo.T_CONTROLE && len - 1 > limiteControle) throw ErroDeProtocolo("tamanho")
    return decodificar(tipo, corpo, 1)
}

fun decodificar(tipo: Int, b: ByteArray, inicio: Int): Mensagem {
    val n = b.size - inicio
    return when (tipo) {
        Protocolo.T_CONTROLE -> {
            val texto = try {
                Charsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(b, inicio, n)).toString()
            } catch (e: java.nio.charset.CharacterCodingException) {
                throw ErroDeProtocolo("json")
            }
            val json = try { JSONObject(texto) } catch (e: Exception) { throw ErroDeProtocolo("json") }
            if (json.opt("t") !is String) throw ErroDeProtocolo("json")
            Mensagem.Controle(json)
        }
        Protocolo.T_TOQUE -> {
            if (n < 5) throw ErroDeProtocolo("tamanho")
            val seq = b.u32(inicio)
            val qtd = b[inicio + 4].toInt() and 0xFF
            if (qtd > Protocolo.MAX_CONTATOS) throw ErroDeProtocolo("contatos")
            if (n != 5 + 7 * qtd) throw ErroDeProtocolo("tamanho")
            val contatos = ArrayList<Contato>(qtd)
            for (i in 0 until qtd) {
                val p = inicio + 5 + 7 * i
                val c = Contato(b[p].toInt() and 0xFF, b.u16(p + 1), b.u16(p + 3), b.u16(p + 5))
                if (contatos.any { it.id == c.id }) throw ErroDeProtocolo("contatos")
                contatos.add(c)
            }
            Mensagem.Toque(seq, contatos)
        }
        Protocolo.T_PING, Protocolo.T_PONG -> {
            if (n != 12) throw ErroDeProtocolo("tamanho")
            val nonce = b.u32(inicio)
            val t = b.u64(inicio + 4)
            if (tipo == Protocolo.T_PING) Mensagem.Ping(nonce, t) else Mensagem.Pong(nonce, t)
        }
        Protocolo.T_CARGA -> Mensagem.Carga(b.copyOfRange(inicio, b.size))
        Protocolo.T_VIDEO, Protocolo.T_AUDIO -> {
            if (n < 8) throw ErroDeProtocolo("tamanho")
            val pts = b.u64(inicio)
            val dados = b.copyOfRange(inicio + 8, b.size)
            if (tipo == Protocolo.T_VIDEO) Mensagem.Video(pts, dados) else Mensagem.Audio(pts, dados)
        }
        else -> throw ErroDeProtocolo("tipo")
    }
}

/** Igualdade por conteúdo (o `JSONObject` do Android não tem `similar`). */
fun mesmoConteudo(a: Any?, b: Any?): Boolean = when {
    a is JSONObject && b is JSONObject ->
        a.length() == b.length() && a.keys().asSequence().all { b.has(it) && mesmoConteudo(a.opt(it), b.opt(it)) }
    a is org.json.JSONArray && b is org.json.JSONArray ->
        a.length() == b.length() && (0 until a.length()).all { mesmoConteudo(a.opt(it), b.opt(it)) }
    a is Number && b is Number -> a.toDouble() == b.toDouble()
    else -> a == b
}

fun controle(vararg pares: Pair<String, Any?>): Mensagem.Controle {
    val j = JSONObject()
    for ((k, v) in pares) j.put(k, v)
    return Mensagem.Controle(j)
}

private fun ByteArrayOutputStream.u16(v: Int) { write((v shr 8) and 0xFF); write(v and 0xFF) }
private fun ByteArrayOutputStream.u32(v: Long) { for (s in 24 downTo 0 step 8) write(((v shr s) and 0xFF).toInt()) }
private fun ByteArrayOutputStream.u64(v: Long) { for (s in 56 downTo 0 step 8) write(((v shr s) and 0xFF).toInt()) }
private fun ByteArray.u16(p: Int) = ((this[p].toInt() and 0xFF) shl 8) or (this[p + 1].toInt() and 0xFF)
private fun ByteArray.u32(p: Int): Long {
    var v = 0L
    for (i in 0 until 4) v = (v shl 8) or (this[p + i].toLong() and 0xFF)
    return v
}
private fun ByteArray.u64(p: Int): Long {
    var v = 0L
    for (i in 0 until 8) v = (v shl 8) or (this[p + i].toLong() and 0xFF)
    return v
}

/** Regra de nível (igual a `nivelDe` em `src/sim/conexao.ts`). */
fun nivelDe(mbps: Double, rttMs: Double): Int = when {
    mbps <= 0 -> 0
    mbps >= 40 && rttMs <= 15 -> 3
    mbps >= 5 && rttMs <= 40 -> 2
    else -> 1
}
