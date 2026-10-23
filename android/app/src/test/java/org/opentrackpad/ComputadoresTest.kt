package org.opentrackpad

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.opentrackpad.conexao.Computadores

class ComputadoresTest {
    private fun novo(): Computadores {
        val mapa = HashMap<String, String>()
        return Computadores(object : Computadores.Armazem {
            override fun ler(chave: String) = mapa[chave]
            override fun gravar(chave: String, valor: String?) { if (valor == null) mapa.remove(chave) else mapa[chave] = valor }
        })
    }

    private val fp = "ab".repeat(32)

    @Test
    fun pareadoPeloCaboPassaParaAImpressao() {
        val c = novo()
        assertEquals(Computadores.CABO, c.chaveDoCabo())
        c.gravar(Computadores.CABO, "id1", "seg1")
        c.conhecer(Computadores.CABO, JSONObject().put("fp", fp).put("wifi", JSONObject().put("hosts", JSONArray(listOf("192.168.0.10"))).put("porta", 47801)), "KiwiPC")
        assertNull(c.ler(Computadores.CABO))
        assertEquals("id1" to "seg1", c.ler(fp))
        assertEquals(fp, c.chaveDoCabo())
        val pc = c.ultimo()!!
        assertEquals(listOf("192.168.0.10"), pc.hosts)
        assertEquals("KiwiPC", pc.nome)
        assertEquals(1, c.lista().size)
    }

    @Test
    fun esquecerApagaETiraDoUltimo() {
        val c = novo()
        c.gravar(fp, "id", "s")
        c.conhecer(fp, JSONObject().put("fp", fp), "PC")
        c.esquecer(fp)
        assertNull(c.ler(fp))
        assertEquals(Computadores.CABO, c.chaveDoCabo())
    }

    @Test
    fun impressaoInvalidaNaoMudaNada() {
        val c = novo()
        c.gravar(Computadores.CABO, "id", "s")
        c.conhecer(Computadores.CABO, JSONObject().put("fp", "curta"), "PC")
        assertEquals("id" to "s", c.ler(Computadores.CABO))
    }
}
