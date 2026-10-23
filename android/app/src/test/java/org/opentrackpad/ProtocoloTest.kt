package org.opentrackpad

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test
import org.opentrackpad.protocolo.Mensagem
import org.opentrackpad.protocolo.codificar
import org.opentrackpad.protocolo.ler
import org.opentrackpad.protocolo.mesmoConteudo
import org.opentrackpad.protocolo.nivelDe
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException

/** Os mesmos vetores que o lado do computador usa (`protocolo/vetores/`). */
class ProtocoloTest {

    private fun vetores(nome: String): JSONObject {
        // Os testes rodam em android/app.
        val f = listOf("../../protocolo/vetores/$nome", "../protocolo/vetores/$nome").map(::File).first { it.exists() }
        return JSONObject(f.readText())
    }

    private fun hex(s: String) = ByteArray(s.length / 2) { s.substring(2 * it, 2 * it + 2).toInt(16).toByte() }

    private fun comoJson(m: Mensagem): JSONObject = when (m) {
        is Mensagem.Controle -> JSONObject().put("tipo", "controle").put("json", m.json)
        is Mensagem.Toque -> JSONObject().put("tipo", "toque").put("seq", m.seq).put(
            "contatos",
            JSONArray(m.contatos.map { JSONObject().put("id", it.id).put("x", it.x).put("y", it.y).put("major", it.major) }),
        )
        is Mensagem.Caneta -> JSONObject().put("tipo", "caneta").put("seq", m.seq).put("x", m.x).put("y", m.y).put("pressao", m.pressao).put("marcas", m.marcas)
        is Mensagem.Ping -> JSONObject().put("tipo", "ping").put("nonce", m.nonce).put("t_us", m.tUs)
        is Mensagem.Pong -> JSONObject().put("tipo", "pong").put("nonce", m.nonce).put("t_us", m.tUs)
        is Mensagem.Carga -> JSONObject().put("tipo", "carga").put("bytes", m.dados.size)
        is Mensagem.Video -> JSONObject().put("tipo", "video").put("pts_us", m.ptsUs).put("marcas", m.marcas).put("bytes", m.dados.size)
        is Mensagem.Camera -> JSONObject().put("tipo", "camera").put("pts_us", m.ptsUs).put("marcas", m.marcas).put("bytes", m.dados.size)
        is Mensagem.Audio -> JSONObject().put("tipo", "audio").put("pts_us", m.ptsUs).put("bytes", m.dados.size)
        else -> JSONObject()
    }

    @Test
    fun vetoresValidos() {
        val validos = vetores("enquadramento.json").getJSONArray("validos")
        for (i in 0 until validos.length()) {
            val caso = validos.getJSONObject(i)
            val bytes = hex(caso.getString("hex"))
            val m = ler(ByteArrayInputStream(bytes)) ?: error("sem mensagem")
            val esperado = caso.getJSONObject("esperado")
            assert(mesmoConteudo(comoJson(m), esperado)) { "${caso["nome"]}: ${comoJson(m)} != $esperado" }
            val volta = codificar(m)
            if (m is Mensagem.Controle) {
                assertEquals(m, ler(ByteArrayInputStream(volta)))
            } else {
                assertArrayEquals(caso.getString("nome"), bytes, volta)
            }
        }
    }

    @Test
    fun vetoresInvalidos() {
        val invalidos = vetores("enquadramento.json").getJSONArray("invalidos")
        for (i in 0 until invalidos.length()) {
            val caso = invalidos.getJSONObject(i)
            try {
                ler(ByteArrayInputStream(hex(caso.getString("hex"))), 16 * 1024)
                fail("deveria recusar: ${caso["nome"]}")
            } catch (_: IOException) {
            }
        }
    }

    @Test
    fun regraDeNivel() {
        val casos = vetores("nivel.json").getJSONArray("casos")
        for (i in 0 until casos.length()) {
            val c = casos.getJSONObject(i)
            assertEquals(c.toString(), c.getInt("n"), nivelDe(c.getDouble("mbps"), c.getDouble("rtt_ms")))
        }
    }

    @Test
    fun fimEntreMensagensENull() {
        assertNull(ler(ByteArrayInputStream(ByteArray(0))))
    }
}
