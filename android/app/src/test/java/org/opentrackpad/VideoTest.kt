package org.opentrackpad

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.opentrackpad.video.inicios
import org.opentrackpad.video.nal

class VideoTest {
    private fun b(vararg x: Int) = ByteArray(x.size) { x[it].toByte() }

    @Test
    fun achaSpsEPps() {
        val fluxo = b(0, 0, 0, 1, 0x67, 1, 2, 0, 0, 0, 1, 0x68, 3, 0, 0, 1, 0x65, 0x88)
        assertEquals(listOf(0, 7, 13), inicios(fluxo))
        assertArrayEquals(b(0, 0, 0, 1, 0x67, 1, 2), nal(fluxo, 7))
        assertArrayEquals(b(0, 0, 0, 1, 0x68, 3), nal(fluxo, 8))
        assertArrayEquals(b(0, 0, 1, 0x65, 0x88), nal(fluxo, 5))
        assertNull(nal(fluxo, 6))
    }
}
