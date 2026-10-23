package org.opentrackpad

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.opentrackpad.ui.pecas.Peca
import org.opentrackpad.ui.pecas.Tamanho
import org.opentrackpad.ui.pecas.TelaDescrita
import org.opentrackpad.ui.pecas.aplicarEstado
import org.opentrackpad.ui.pecas.lerLaterais
import org.opentrackpad.ui.pecas.lerPeca
import org.opentrackpad.ui.pecas.lerPecas
import org.opentrackpad.ui.pecas.lerTela

/** Parse das peças descritas pelo computador (`protocolo/README.md`). Só texto, sem desenhar. */
class PecasTest {

    private fun peca(texto: String): Peca? = lerPeca(JSONObject(texto))

    @Test
    fun tecla() {
        val p = peca("""{"p":"tecla","id":"copiar","rotulo":"Copiar","icone":"copiar","dica":"Ctrl+C"}""")
        assertEquals(Peca.Tecla("copiar", "Copiar", "copiar", "Ctrl+C"), p)
    }

    @Test
    fun teclaPresa() {
        val p = peca("""{"p":"tecla_presa","id":"ctrl","rotulo":"Ctrl","k":"ctrl"}""")
        assertEquals(Peca.TeclaPresa("ctrl", "Ctrl", "ctrl"), p)
    }

    @Test
    fun fader() {
        val p = peca("""{"p":"fader","id":"vol","rotulo":"Volume","valor":0.4,"icone":"volume","mudo":true}""")
        assertEquals(Peca.Fader("vol", "Volume", 0.4, "volume", true), p)
    }

    @Test
    fun giro() {
        val p = peca("""{"p":"giro","id":"giro","rotulo":"Volume","valor":0.75,"passos":36}""")
        assertEquals(Peca.Giro("giro", "Volume", 0.75, 36), p)
    }

    @Test
    fun segmentos() {
        val p = peca("""{"p":"segmentos","id":"med","rotulo":"Mic","valor":0.3,"texto":"30%"}""")
        assertEquals(Peca.Segmentos("med", "Mic", 0.3, "30%"), p)
    }

    @Test
    fun led() {
        val p = peca("""{"p":"led","id":"cam","rotulo":"Câmera","ligado":true,"texto":"ligada"}""")
        assertEquals(Peca.Led("cam", "Câmera", true, "ligada"), p)
    }

    @Test
    fun texto() {
        assertEquals(Peca.Texto("t1", "Oi", Tamanho.G), peca("""{"p":"texto","id":"t1","texto":"Oi","tamanho":"g"}"""))
        assertEquals(Peca.Texto("t2", "Oi", Tamanho.P), peca("""{"p":"texto","id":"t2","texto":"Oi","tamanho":"p"}"""))
        assertEquals(Peca.Texto("t3", "Oi", Tamanho.M), peca("""{"p":"texto","id":"t3","texto":"Oi","tamanho":"m"}"""))
    }

    @Test
    fun iconeAppGuardaPngSemDecodificar() {
        val p = peca("""{"p":"icone_app","id":"janela1","rotulo":"VS Code","png":"iVBORw0KGgo="}""")
        assertEquals(Peca.IconeApp("janela1", "VS Code", "iVBORw0KGgo="), p)
    }

    @Test
    fun gradeComFilhos() {
        val p = peca(
            """{"p":"grade","id":"g","colunas":2,"pecas":[
                {"p":"tecla","id":"a","rotulo":"A","icone":"copiar"},
                {"p":"led","id":"b","rotulo":"B","ligado":false,"texto":"off"},
                {"p":"texto","id":"c","texto":"C","tamanho":"m"}
            ]}""",
        )
        assertTrue(p is Peca.Grade)
        p as Peca.Grade
        assertEquals(2, p.colunas)
        assertEquals(3, p.pecas.size)
        assertEquals(Peca.Tecla("a", "A", "copiar", null), p.pecas[0])
        assertEquals("c", p.pecas[2].id)
    }

    @Test
    fun linhaComFilhos() {
        val p = peca("""{"p":"linha","id":"l","pecas":[{"p":"led","id":"x","rotulo":"X","ligado":true,"texto":"on"}]}""")
        assertEquals(1, (p as Peca.Linha).pecas.size)
    }

    @Test
    fun tipoDesconhecidoViraNull() {
        assertNull(peca("""{"p":"futurista","id":"x"}"""))
        assertNull(peca("""{"id":"x"}"""))
    }

    @Test
    fun pecasNativasNaoSaoDesenhadasPorAqui() {
        // trackpad e teclado são telas do próprio celular; ficam fora do conjunto desenhado.
        assertNull(peca("""{"p":"trackpad","id":"tp"}"""))
        assertNull(peca("""{"p":"teclado","id":"tc","layout":"gboard-pt"}"""))
    }

    @Test
    fun listaIgnoraDesconhecidas() {
        val arr = JSONArray(
            """[{"p":"tecla","id":"a","rotulo":"A"},{"p":"nada","id":"z"},{"p":"led","id":"b","rotulo":"B","ligado":true,"texto":"on"}]""",
        )
        val pecas = lerPecas(arr)
        assertEquals(listOf("a", "b"), pecas.map { it.id })
    }

    @Test
    fun laterais() {
        val json = JSONObject(
            """{"t":"laterais","app":{"nome":"VS Code","icone":"codigo"},
                "esquerda":[
                  {"p":"tecla","id":"e1","rotulo":"1","icone":"copiar"},
                  {"p":"tecla","id":"e2","rotulo":"2","icone":"colar"},
                  {"p":"tecla_presa","id":"e3","rotulo":"Ctrl","k":"ctrl"},
                  {"p":"tecla","id":"e4","rotulo":"4"},
                  {"p":"tecla","id":"e5","rotulo":"5"}],
                "direita":[
                  {"p":"tecla","id":"d1","rotulo":"Clique","icone":"clique"},
                  {"p":"fader","id":"d2","rotulo":"Volume","valor":0.5},
                  {"p":"tecla","id":"d3","rotulo":"Esc"}]}""",
        )
        val l = lerLaterais(json)
        assertEquals("VS Code", l.app)
        assertEquals("codigo", l.iconeApp)
        assertEquals(5, l.esquerda.size)
        assertEquals(3, l.direita.size)
        assertTrue(l.esquerda[2] is Peca.TeclaPresa)
        assertEquals("d2", l.direita[1].id)
    }

    @Test
    fun lateraisSemCamposOpcionaisNaoQuebram() {
        val l = lerLaterais(JSONObject("""{"t":"laterais"}"""))
        assertEquals("", l.app)
        assertEquals("", l.iconeApp)
        assertTrue(l.esquerda.isEmpty())
        assertTrue(l.direita.isEmpty())
    }

    @Test
    fun telaDescrita() {
        val t = lerTela(
            JSONObject(
                """{"t":"tela","id":"trackpad","nome":"Trackpad","nivel":2,"pecas":[
                    {"p":"fader","id":"v","rotulo":"Vol","valor":0.2}]}""",
            ),
        )
        assertEquals("trackpad", t.id)
        assertEquals("Trackpad", t.nome)
        assertEquals(2, t.nivel)
        assertEquals(listOf(Peca.Fader("v", "Vol", 0.2, null, false)), t.pecas)
    }

    @Test
    fun camposOpcionaisAusentesTemPadrao() {
        assertEquals(Peca.Tecla("a", "", null, null), peca("""{"p":"tecla","id":"a"}"""))
        assertEquals(Peca.Fader("f", "", 0.0, null, false), peca("""{"p":"fader","id":"f"}"""))
        assertEquals(Peca.Giro("g", "", 0.0, 36), peca("""{"p":"giro","id":"g"}"""))
        assertEquals(Peca.Led("l", "", false, ""), peca("""{"p":"led","id":"l"}"""))
        assertEquals(Peca.Texto("t", "", Tamanho.M), peca("""{"p":"texto","id":"t"}"""))
        assertEquals(Peca.Grade("gr", 2, emptyList()), peca("""{"p":"grade","id":"gr"}"""))
        assertEquals(Peca.Linha("ln", emptyList()), peca("""{"p":"linha","id":"ln"}"""))
    }

    @Test
    fun valorForaDaFaixaEhEncaixado() {
        assertEquals(1.0, (peca("""{"p":"fader","id":"f","valor":1.7}""") as Peca.Fader).valor, 0.0)
        assertEquals(0.0, (peca("""{"p":"giro","id":"g","valor":-0.2}""") as Peca.Giro).valor, 0.0)
    }

    @Test
    fun colunasNuncaZero() {
        assertEquals(1, (peca("""{"p":"grade","id":"g","colunas":0}""") as Peca.Grade).colunas)
    }

    private val telaBase = TelaDescrita(
        id = "mixer",
        nome = "Mixer",
        nivel = 1,
        pecas = listOf(
            Peca.Fader("vol", "Volume", 0.2, "volume", false),
            Peca.Led("cam", "Câmera", false, "desligada"),
            Peca.Grade(
                "g", 2, listOf(
                    Peca.Segmentos("mic", "Mic", 0.1, "10%"),
                    Peca.Linha("l", listOf(Peca.Texto("t", "Oi", Tamanho.M))),
                ),
            ),
        ),
    )

    private fun estado(texto: String): JSONObject = JSONObject(texto)

    @Test
    fun estadoTrocaSoOsCamposQueVieram() {
        val nova = aplicarEstado(telaBase, estado("""{"t":"estado","tela":"mixer","pecas":[{"id":"vol","valor":0.7}]}"""))
        val fader = nova.pecas[0] as Peca.Fader
        assertEquals(0.7, fader.valor, 0.0)
        assertEquals("Volume", fader.rotulo)
        assertEquals("volume", fader.icone)
        assertEquals(false, fader.mudo)
    }

    @Test
    fun estadoMudaLedETextoSemTocarNoResto() {
        val nova = aplicarEstado(
            telaBase,
            estado("""{"t":"estado","tela":"mixer","pecas":[{"id":"cam","ligado":true,"texto":"ligada"}]}"""),
        )
        assertEquals(Peca.Led("cam", "Câmera", true, "ligada"), nova.pecas[1])
        assertEquals(telaBase.pecas[0], nova.pecas[0])
    }

    @Test
    fun estadoAtingeFilhosDeGradeELinha() {
        val nova = aplicarEstado(
            telaBase,
            estado("""{"t":"estado","tela":"mixer","pecas":[{"id":"mic","valor":0.6,"texto":"60%"},{"id":"t","texto":"Olá"}]}"""),
        )
        val grade = nova.pecas[2] as Peca.Grade
        assertEquals(Peca.Segmentos("mic", "Mic", 0.6, "60%"), grade.pecas[0])
        val linha = grade.pecas[1] as Peca.Linha
        assertEquals(Peca.Texto("t", "Olá", Tamanho.M), linha.pecas[0])
    }

    @Test
    fun estadoDeOutraTelaNaoMexe() {
        val nova = aplicarEstado(telaBase, estado("""{"t":"estado","tela":"trackpad","pecas":[{"id":"vol","valor":0.9}]}"""))
        assertEquals(telaBase, nova)
    }

    @Test
    fun estadoComIdDesconhecidoNaoMexe() {
        val nova = aplicarEstado(telaBase, estado("""{"t":"estado","tela":"mixer","pecas":[{"id":"nao_existe","valor":0.9}]}"""))
        assertEquals(telaBase, nova)
    }

    @Test
    fun estadoValorForaDaFaixaEhEncaixado() {
        val nova = aplicarEstado(telaBase, estado("""{"t":"estado","tela":"mixer","pecas":[{"id":"vol","valor":3}]}"""))
        assertEquals(1.0, (nova.pecas[0] as Peca.Fader).valor, 0.0)
    }

    @Test
    fun estadoMudoSoQuandoVem() {
        val nova = aplicarEstado(telaBase, estado("""{"t":"estado","tela":"mixer","pecas":[{"id":"vol","mudo":true}]}"""))
        assertEquals(Peca.Fader("vol", "Volume", 0.2, "volume", true), nova.pecas[0])
    }
}
