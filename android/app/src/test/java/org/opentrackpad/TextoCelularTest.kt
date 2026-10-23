package org.opentrackpad

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.opentrackpad.protocolo.LIMITE_TEXTO_CELULAR
import org.opentrackpad.protocolo.cortarParaCelular

/** Corte do texto que o celular manda: bytes UTF-8 no JSON, sem partir caractere. */
class TextoCelularTest {

    private fun bytes(s: String) = s.toByteArray(Charsets.UTF_8).size

    @Test
    fun textoQueCabeNaoMuda() {
        assertEquals("oi" to false, cortarParaCelular("oi"))
        assertEquals("" to false, cortarParaCelular(""))
    }

    @Test
    fun limiteDoProtocoloEh15000Bytes() {
        assertEquals(15_000, LIMITE_TEXTO_CELULAR)
        val exato = "a".repeat(15_000)
        assertEquals(exato to false, cortarParaCelular(exato))
        assertEquals(15_000 to true, cortarParaCelular("a".repeat(15_001)).let { it.first.length to it.second })
    }

    @Test
    fun acentoNaoEhPartido() {
        // "é" tem 2 bytes: com 4 bytes de limite, cabe "a" + "é" (3) e não sobra para o emoji.
        assertEquals("aé" to true, cortarParaCelular("aé😀", 5))
        assertEquals("aé" to true, cortarParaCelular("aéé", 4))
    }

    @Test
    fun emojiNaoEhPartidoAoMeio() {
        // Emoji tem 4 bytes e 2 chars UTF-16: não pode sair o primeiro surrogate sozinho.
        assertEquals("😀" to true, cortarParaCelular("😀😀", 5))
        assertEquals("" to true, cortarParaCelular("😀", 3))
        assertEquals("aé😀" to false, cortarParaCelular("aé😀", 7))
    }

    @Test
    fun escapesDoJsonContamNoLimite() {
        // "\n" vira 2 bytes no JSON; "a\nb" são 4 bytes, não cabe em 3.
        assertEquals("a\n" to true, cortarParaCelular("a\nb", 3))
        // Aspa também vira 2 bytes.
        assertEquals("\"" to true, cortarParaCelular("\"\"", 3))
    }

    @Test
    fun textoGrandeDeAcentosFicaAbaixoDoLimite() {
        val texto = "ç".repeat(10_000) // 20 000 bytes
        val (parte, cortou) = cortarParaCelular(texto)
        assertTrue(cortou)
        assertTrue(bytes(parte) <= LIMITE_TEXTO_CELULAR)
        assertEquals(7_500, parte.length) // 7 500 × 2 bytes = 15 000 exatos
        assertTrue(parte.all { it == 'ç' })
    }

    @Test
    fun textoGrandeDeEmojiTerminaEmCaractereInteiro() {
        val texto = "😀".repeat(5_000) // 20 000 bytes
        val (parte, cortou) = cortarParaCelular(texto)
        assertTrue(cortou)
        assertTrue(bytes(parte) <= LIMITE_TEXTO_CELULAR)
        assertEquals(3_750, parte.codePointCount(0, parte.length))
        assertFalse(Character.isHighSurrogate(parte.last()))
    }
}
