package org.opentrackpad

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.opentrackpad.ui.PARADO_MS
import org.opentrackpad.ui.descansoAgora

/** Quando o celular entra na tela de descanso (AGENTS.md: parado 20 s). */
class DescansoTest {

    @Test
    fun semConexaoNuncaDescansa() {
        assertFalse(descansoAgora(descansando = false, conectado = false, ultimoToqueMs = 0, agoraMs = 100_000))
        // Caiu a conexão no meio do descanso: sai.
        assertFalse(descansoAgora(descansando = true, conectado = false, ultimoToqueMs = 0, agoraMs = 50_000))
    }

    @Test
    fun entraAposVinteSegundosParado() {
        assertTrue(PARADO_MS == 20_000L)
        assertFalse(descansoAgora(descansando = false, conectado = true, ultimoToqueMs = 0, agoraMs = 19_999))
        assertTrue(descansoAgora(descansando = false, conectado = true, ultimoToqueMs = 0, agoraMs = 20_000))
    }

    @Test
    fun quemJaEstaEmDescansoFicaAteOToque() {
        assertTrue(descansoAgora(descansando = true, conectado = true, ultimoToqueMs = 19_000, agoraMs = 19_500))
    }
}
