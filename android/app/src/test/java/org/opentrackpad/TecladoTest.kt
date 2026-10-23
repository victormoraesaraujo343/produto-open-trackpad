package org.opentrackpad

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.opentrackpad.ui.Funcao
import org.opentrackpad.ui.Modo
import org.opentrackpad.ui.Saida
import org.opentrackpad.ui.TeclaDef
import org.opentrackpad.ui.acrescentar
import org.opentrackpad.ui.apagarUltimo
import org.opentrackpad.ui.decidir
import org.opentrackpad.ui.linhasDo
import org.opentrackpad.ui.rotuloVisivel
import org.opentrackpad.ui.shiftApos

/** Lógica do teclado do celular (sem Compose): layout, acentos, shift, apagar e histórico. */
class TecladoTest {

    private fun tecla(linhas: List<List<TeclaDef>>, rotulo: String): TeclaDef =
        linhas.flatten().first { it.rotulo == rotulo }

    private fun letras(linha: List<TeclaDef>): String =
        linha.filter { it.funcao == Funcao.NENHUMA }.joinToString("") { it.rotulo }

    @Test
    fun linhaDoMeioTemNoveLetrasERecuo() {
        val linhas = linhasDo(Modo.LETRAS)
        val meio = linhas[1]
        assertEquals("asdfghjkl", letras(meio))
        // Recuo de meia tecla de cada lado: as duas pontas são vazias de 0,5.
        assertEquals(Funcao.VAZIA, meio.first().funcao)
        assertEquals(0.5f, meio.first().peso, 0f)
        assertEquals(Funcao.VAZIA, meio.last().funcao)
        assertEquals(0.5f, meio.last().peso, 0f)
    }

    @Test
    fun linhasDeLetrasTemMesmaLarguraTotal() {
        val linhas = linhasDo(Modo.LETRAS)
        assertEquals(4, linhas.size)
        linhas.take(3).forEach { linha -> assertEquals(10f, linha.sumOf { it.peso.toDouble() }.toFloat(), 0.001f) }
        assertEquals("qwertyuiop", letras(linhas[0]))
        assertEquals("zxcvbnm", letras(linhas[2]))
    }

    @Test
    fun cSeguradoEhCedilha() {
        val c = tecla(linhasDo(Modo.LETRAS), "c")
        assertEquals(Saida.Texto("ç"), decidir(c, maiuscula = false, segurou = true))
        assertEquals(Saida.Texto("c"), decidir(c, maiuscula = false, segurou = false))
    }

    @Test
    fun vogaisSeguradasDaoAcento() {
        val linhas = linhasDo(Modo.LETRAS)
        val esperado = mapOf("a" to "á", "e" to "é", "o" to "ó", "u" to "ú", "i" to "í")
        esperado.forEach { (letra, acento) ->
            assertEquals(Saida.Texto(acento), decidir(tecla(linhas, letra), maiuscula = false, segurou = true))
        }
    }

    @Test
    fun teclaSemAcentoNaoTemSegurar() {
        val b = tecla(linhasDo(Modo.LETRAS), "b")
        assertEquals(null, b.segurar)
        assertEquals(Saida.Texto("b"), decidir(b, maiuscula = false, segurou = true))
    }

    @Test
    fun shiftDeixaMaiusculaUmaVezSo() {
        val linhas = linhasDo(Modo.LETRAS)
        val shift = linhas[2].first()
        assertEquals(Funcao.SHIFT, shift.funcao)

        // Ligar o shift não manda nada.
        assertEquals(Saida.Nada, decidir(shift, maiuscula = false, segurou = false))
        var maiuscula = shiftApos(false, shift)
        assertTrue(maiuscula)

        // A primeira letra sai em maiúscula...
        val a = tecla(linhas, "a")
        assertEquals(Saida.Texto("A"), decidir(a, maiuscula = maiuscula, segurou = false))
        maiuscula = shiftApos(maiuscula, a)
        // ...e a segunda, não.
        assertFalse(maiuscula)
        assertEquals(Saida.Texto("s"), decidir(tecla(linhas, "s"), maiuscula = maiuscula, segurou = false))
    }

    @Test
    fun shiftComAcentoSaiMaiusculoAcentuado() {
        val c = tecla(linhasDo(Modo.LETRAS), "c")
        assertEquals(Saida.Texto("Ç"), decidir(c, maiuscula = true, segurou = true))
        assertEquals(Saida.Texto("Á"), decidir(tecla(linhasDo(Modo.LETRAS), "a"), maiuscula = true, segurou = true))
    }

    @Test
    fun shiftDesligaComSimboloOuNumero() {
        val linhas = linhasDo(Modo.LETRAS)
        val shift = linhas[2].first()
        assertFalse(shiftApos(true, shift))
        assertFalse(shiftApos(true, tecla(linhas, ".")))
        // Apagar e enter não gastam o shift.
        val apagar = linhas[2].last()
        assertTrue(shiftApos(true, apagar))
    }

    @Test
    fun rotuloDaLetraAcompanhaOShift() {
        val a = tecla(linhasDo(Modo.LETRAS), "a")
        assertEquals("a", rotuloVisivel(a, maiuscula = false))
        assertEquals("A", rotuloVisivel(a, maiuscula = true))
    }

    @Test
    fun apagarEEnterMandamTeclaNomeada() {
        val linhas = linhasDo(Modo.LETRAS)
        assertEquals(Saida.Tecla("apagar"), decidir(linhas[2].last(), maiuscula = false, segurou = false))
        assertEquals(Saida.Tecla("enter"), decidir(linhas[3].last(), maiuscula = false, segurou = false))
    }

    @Test
    fun historicoAcumulaEApagaOUltimo() {
        var h = ""
        h = acrescentar(h, "oi")
        h = acrescentar(h, " ")
        assertEquals("oi ", h)
        h = apagarUltimo(h)
        assertEquals("oi", h)
        h = apagarUltimo(h)
        h = apagarUltimo(h)
        assertEquals("", h)
    }

    @Test
    fun historicoMantemOsUltimosQuarentaCaracteres() {
        val texto = (1..100).joinToString("") { (it % 10).toString() }
        val h = acrescentar("", texto)
        assertEquals(40, h.length)
        assertEquals(texto.takeLast(40), h)
        // Continua mantendo o limite ao acrescentar mais.
        assertEquals(h.drop(1) + "x", acrescentar(h, "x"))
        assertEquals(40, acrescentar(h, "xyz").length)
    }

    @Test
    fun historicoNaoDeixaParPartidoNoComeco() {
        // O corte cairia no meio de um emoji (par de surrogates): ele tem de sair inteiro.
        val h = acrescentar("😀", "b".repeat(39))
        assertEquals("b".repeat(39), h)
    }

    @Test
    fun numericoTemDigitosSimbolosETrocaDeModo() {
        val linhas = linhasDo(Modo.NUMEROS)
        val topo = linhas[0].map { it.rotulo }
        assertEquals(listOf("7", "8", "9", "/"), topo)
        assertEquals(listOf("4", "5", "6", "*"), linhas[1].map { it.rotulo })
        assertEquals(listOf("1", "2", "3", "-"), linhas[2].map { it.rotulo })
        assertEquals(listOf("0", ",", ".", "+"), linhas[3].map { it.rotulo })
        assertEquals(Saida.Texto("7"), decidir(linhas[0][0], maiuscula = false, segurou = false))
        assertEquals(Saida.Texto("/"), decidir(linhas[0][3], maiuscula = false, segurou = false))

        val rodape = linhas.last()
        assertEquals("ABC", rodape.first().rotulo)
        assertEquals(Funcao.TROCAR_MODO, rodape.first().funcao)
        assertEquals(Funcao.APAGAR, rodape[2].funcao)
        assertEquals(Funcao.ENTER, rodape.last().funcao)
        assertEquals(Saida.Texto(" "), decidir(rodape[1], maiuscula = false, segurou = false))
    }

    @Test
    fun trocarModoNaoMandaTexto() {
        val tecla123 = linhasDo(Modo.LETRAS).last().first()
        assertEquals("123", tecla123.rotulo)
        assertEquals(Saida.Nada, decidir(tecla123, maiuscula = false, segurou = false))
    }
}
