package org.opentrackpad.ponte

import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.opentrackpad.protocolo.Mensagem
import org.opentrackpad.protocolo.codificar
import org.opentrackpad.ui.pecas.Peca
import org.opentrackpad.ui.pecas.lerPeca

class CameraTest {
    private fun b(vararg x: Int) = ByteArray(x.size) { x[it].toByte() }

    @Test
    fun quadroPequenoVaiEmUmPedacoComPrimeiroEUltimo() {
        val p = fatiarQuadro(1000L, false, b(1, 2, 3), 10)
        assertEquals(1, p.size)
        assertEquals(MARCA_PRIMEIRO or MARCA_ULTIMO, p[0].marcas)
        assertEquals(1000L, p[0].ptsUs)
        assertArrayEquals(b(1, 2, 3), p[0].dados)
    }

    @Test
    fun quadroGrandeFatiaComMarcasCertas() {
        val dados = ByteArray(25) { it.toByte() }
        val p = fatiarQuadro(7L, false, dados, 10)
        assertEquals(3, p.size)
        // Primeiro pedaço: marca de primeiro; do meio: nenhuma; último: marca de último.
        assertEquals(listOf(MARCA_PRIMEIRO, 0, MARCA_ULTIMO), p.map { it.marcas })
        assertArrayEquals(dados.copyOfRange(0, 10), p[0].dados)
        assertArrayEquals(dados.copyOfRange(10, 20), p[1].dados)
        assertArrayEquals(dados.copyOfRange(20, 25), p[2].dados)
        assertTrue(p.all { it.ptsUs == 7L })
    }

    @Test
    fun quadroDeChaveMarcaTodosOsPedacos() {
        val p = fatiarQuadro(0L, true, ByteArray(25), 10)
        assertEquals(3, p.size)
        assertTrue(p.all { it.marcas and MARCA_CHAVE != 0 })
        assertEquals(MARCA_CHAVE or MARCA_PRIMEIRO, p[0].marcas)
        assertEquals(MARCA_CHAVE or MARCA_ULTIMO, p[2].marcas)
    }

    @Test
    fun pedacoDoTamanhoMaximoCabeNoEnquadramento() {
        // Pedaço no máximo: o comprimento (u16) tem de caber, senão codificar() estoura.
        val p = fatiarQuadro(1L, false, ByteArray(TAMANHO_MAX_PEDACO) { 9 })
        assertEquals(1, p.size)
        val bytes = codificar(p[0])
        assertEquals(TAMANHO_MAX_PEDACO + 2 + 1 + 8 + 1, bytes.size)
        assertEquals(0xFF.toByte(), bytes[0])
        assertEquals(0xFF.toByte(), bytes[1])
    }

    @Test
    fun semParametrosDevolveOQuadro() {
        val quadro = b(0, 0, 0, 1, 0x65, 0x88)
        assertArrayEquals(quadro, comParametros(quadro, ByteArray(0)))
    }

    @Test
    fun colaSpsPpsNaFrenteDoQuadroChave() {
        val parametros = b(0, 0, 0, 1, 0x67, 1, 2, 0, 0, 0, 1, 0x68, 3)
        val quadro = b(0, 0, 0, 1, 0x65, 0x88)
        assertArrayEquals(parametros + quadro, comParametros(quadro, parametros))
    }

    @Test
    fun naoDuplicaSpsQuandoOQuadroJaTraz() {
        val parametros = b(0, 0, 0, 1, 0x67, 1, 2, 0, 0, 0, 1, 0x68, 3)
        val quadro = b(0, 0, 0, 1, 0x67, 1, 2, 0, 0, 0, 1, 0x68, 3, 0, 0, 0, 1, 0x65, 0x88)
        assertArrayEquals(quadro, comParametros(quadro, parametros))
    }

    @Test
    fun tipoDaPrimeiraNal() {
        assertEquals(7, tipoPrimeiraNal(b(0, 0, 0, 1, 0x67, 1)))
        assertEquals(5, tipoPrimeiraNal(b(0, 0, 1, 0x65, 0x88)))
        assertNull(tipoPrimeiraNal(b(1, 2, 3)))
    }

    @Test
    fun previaCameraEhPecaNativa() {
        val p = lerPeca(JSONObject("""{"p":"previa_camera","id":"previa"}"""))
        assertEquals(Peca.PreviaCamera("previa"), p)
    }

    @Test
    fun mensagemCameraTemOTipoEPtsNoEnquadramento() {
        // Mesmo formato de VIDEO: pts (8), marcas (1), dados.
        val bytes = codificar(Mensagem.Camera(5L, MARCA_CHAVE, b(9, 9)))
        assertArrayEquals(b(0, 12, 0x32, 0, 0, 0, 0, 0, 0, 0, 5, 1, 9, 9), bytes)
    }
}
