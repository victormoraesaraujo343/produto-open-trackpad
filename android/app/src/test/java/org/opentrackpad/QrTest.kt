package org.opentrackpad

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.opentrackpad.conexao.Destino
import org.opentrackpad.conexao.destinos
import org.opentrackpad.conexao.lerConvite

class QrTest {

    private val fp = "ab".repeat(32) // 64 caracteres hex

    @Test
    fun convite_completo() {
        val c = lerConvite("otp1:?h=192.168.0.10,10.0.0.5&p=47801&fp=${"AB".repeat(32)}&c=428913&n=KiwiPC")
        assertEquals(listOf("192.168.0.10", "10.0.0.5"), c?.hosts)
        assertEquals(47801, c?.porta)
        assertEquals(fp, c?.impressao) // guardado em minúsculo
        assertEquals("428913", c?.codigo)
        assertEquals("KiwiPC", c?.nome)
    }

    @Test
    fun so_codigo_e_cabo() {
        val c = lerConvite("otp1:?c=428913")
        assertEquals(emptyList<String>(), c?.hosts)
        assertNull(c?.porta)
        assertNull(c?.impressao)
        assertNull(c?.nome)
        assertEquals("428913", c?.codigo)
        assertTrue(c!!.destinos().isEmpty())
    }

    @Test
    fun sem_prefixo_e_null() {
        assertNull(lerConvite("c=428913"))
        assertNull(lerConvite("otp2:?c=428913"))
        assertNull(lerConvite("otp1?c=428913"))
        assertNull(lerConvite("https://exemplo.com/?c=428913"))
        assertNull(lerConvite(""))
    }

    @Test
    fun codigo_fora_do_formato_e_null() {
        assertNull(lerConvite("otp1:?p=47801&fp=$fp")) // sem c
        assertNull(lerConvite("otp1:?c=42891")) // 5 dígitos
        assertNull(lerConvite("otp1:?c=4289130")) // 7 dígitos
        assertNull(lerConvite("otp1:?c=42891a"))
    }

    @Test
    fun fp_curto_e_null() {
        assertNull(lerConvite("otp1:?h=192.168.0.10&p=47801&fp=abcd&c=428913"))
        assertNull(lerConvite("otp1:?h=192.168.0.10&p=47801&fp=${"g".repeat(64)}&c=428913"))
    }

    @Test
    fun host_invalido_e_descartado() {
        val c = lerConvite(
            "otp1:?h=192.168.0.10,999.1.1.1,abc,01.2.3.4,10.0.0.5,,fe80::1,1.2.3&p=47801&fp=$fp&c=428913",
        )
        assertEquals(listOf("192.168.0.10", "10.0.0.5"), c?.hosts)
    }

    @Test
    fun so_hosts_invalidos_viram_lista_vazia() {
        val c = lerConvite("otp1:?h=foo,bar&c=428913")
        assertEquals(emptyList<String>(), c?.hosts)
    }

    @Test
    fun nome_com_escape_e_acento() {
        assertEquals("Mesa do César", lerConvite("otp1:?c=428913&n=Mesa%20do%20C%C3%A9sar")?.nome)
    }

    @Test
    fun nome_cortado_em_60_caracteres() {
        val c = lerConvite("otp1:?c=428913&n=${"á".repeat(70)}")
        assertEquals("á".repeat(60), c?.nome)
    }

    @Test
    fun porta_fora_da_faixa_e_null() {
        assertNull(lerConvite("otp1:?h=192.168.0.10&p=0&fp=$fp&c=428913"))
        assertNull(lerConvite("otp1:?h=192.168.0.10&p=65536&fp=$fp&c=428913"))
        assertNull(lerConvite("otp1:?h=192.168.0.10&p=abc&fp=$fp&c=428913"))
        assertEquals(65535, lerConvite("otp1:?h=192.168.0.10&p=65535&fp=$fp&c=428913")?.porta)
    }

    @Test
    fun escape_invalido_e_null() {
        assertNull(lerConvite("otp1:?c=428913&n=%ZZ"))
    }

    @Test
    fun destinos_um_por_host_via_wifi() {
        val c = lerConvite("otp1:?h=192.168.0.10,10.0.0.5&p=47801&fp=$fp&c=428913&n=KiwiPC")!!
        assertEquals(
            listOf(
                Destino(host = "192.168.0.10", porta = 47801, via = "wifi", impressao = fp),
                Destino(host = "10.0.0.5", porta = 47801, via = "wifi", impressao = fp),
            ),
            c.destinos(),
        )
    }

    @Test
    fun destinos_vazio_sem_porta_ou_sem_impressao() {
        assertTrue(lerConvite("otp1:?h=192.168.0.10&fp=$fp&c=428913")!!.destinos().isEmpty())
        assertTrue(lerConvite("otp1:?h=192.168.0.10&p=47801&c=428913")!!.destinos().isEmpty())
    }
}
