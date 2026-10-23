package org.opentrackpad.ponte

import org.junit.Assert.assertEquals
import org.junit.Test

class MicrofoneTest {

    @Test
    fun blocoDe20msA16kHzTem640Bytes() {
        assertEquals(640, tamanhoBlocoAudio())
        assertEquals(640, tamanhoBlocoAudio(16_000, 20))
    }

    @Test
    fun blocoDe10msA16kHzTem320Bytes() {
        assertEquals(320, tamanhoBlocoAudio(16_000, 10))
    }
}
