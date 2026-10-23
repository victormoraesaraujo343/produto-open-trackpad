package org.opentrackpad.video

import android.media.MediaCodec
import android.media.MediaFormat
import android.view.Surface
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer

/**
 * Junta os pedaços de cada quadro (mensagens VIDEO) e decodifica H.264 direto numa
 * `Surface` com o `MediaCodec` do aparelho (o trabalho pesado é do hardware; o app só
 * entrega os bytes). Ver "Vídeo" em `protocolo/README.md`.
 *
 * Sem superfície ou depois de perder um pedaço, espera o próximo quadro-chave.
 */
class Decodificador {
    companion object {
        const val CHAVE = 1
        const val ULTIMO = 2
        const val PRIMEIRO = 4
    }

    private val montagem = ByteArrayOutputStream()
    private var ptsAtual = -1L
    private var chaveAtual = false
    private var esperandoChave = true

    private var superficie: Surface? = null
    private var codec: MediaCodec? = null
    private var tamanho = 0 to 0

    @Volatile var quadrosMostrados = 0L
        private set

    /** Liga ou desliga a superfície (a `SurfaceView` da tela de espelho). */
    @Synchronized
    fun usar(s: Surface?, w: Int, h: Int) {
        parar()
        superficie = s
        tamanho = w to h
        esperandoChave = true
    }

    /** Um pedaço de quadro. Chamado na thread de leitura da conexão. */
    @Synchronized
    fun receber(ptsUs: Long, marcas: Int, dados: ByteArray) {
        if (marcas and PRIMEIRO != 0) {
            montagem.reset()
            ptsAtual = ptsUs
            chaveAtual = marcas and CHAVE != 0
        } else if (ptsUs != ptsAtual) {
            // Pedaço de outro quadro sem o começo: perdeu algo.
            montagem.reset()
            ptsAtual = -1
            esperandoChave = true
            return
        }
        montagem.write(dados)
        if (marcas and ULTIMO == 0) return
        val quadro = montagem.toByteArray()
        montagem.reset()
        ptsAtual = -1
        entregar(quadro, ptsUs, chaveAtual)
    }

    private fun entregar(quadro: ByteArray, ptsUs: Long, chave: Boolean) {
        val s = superficie ?: return
        if (esperandoChave && !chave) return
        try {
            val c = codec ?: (if (chave) iniciar(s, quadro) else null) ?: return
            esperandoChave = false
            val i = c.dequeueInputBuffer(10_000)
            if (i < 0) {
                // Decodificador cheio: descarta e recomeça no próximo quadro-chave.
                esperandoChave = true
                return
            }
            val buf = c.getInputBuffer(i) ?: return
            buf.clear()
            buf.put(quadro)
            c.queueInputBuffer(i, 0, quadro.size, ptsUs, if (chave) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
            soltarSaidas(c)
        } catch (e: Exception) {
            // Codec em estado ruim (superfície sumiu, formato mudou): recomeça.
            parar()
            esperandoChave = true
        }
    }

    private fun soltarSaidas(c: MediaCodec) {
        val info = MediaCodec.BufferInfo()
        while (true) {
            val o = c.dequeueOutputBuffer(info, 0)
            if (o < 0) return
            // `true`: manda para a superfície agora (o computador já cuida do ritmo).
            c.releaseOutputBuffer(o, true)
            quadrosMostrados++
        }
    }

    /** Cria o codec com SPS/PPS tirados do primeiro quadro-chave. */
    private fun iniciar(s: Surface, chave: ByteArray): MediaCodec? {
        val (w, h) = tamanho
        val formato = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, w.coerceAtLeast(16), h.coerceAtLeast(16))
        for ((tipo, nome) in listOf(7 to "csd-0", 8 to "csd-1")) {
            nal(chave, tipo)?.let { formato.setByteBuffer(nome, ByteBuffer.wrap(it)) }
        }
        val c = MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        c.configure(formato, s, null, 0)
        c.start()
        codec = c
        return c
    }

    @Synchronized
    fun parar() {
        try { codec?.stop() } catch (_: Exception) {}
        try { codec?.release() } catch (_: Exception) {}
        codec = null
    }
}

/** A primeira NAL do tipo dado (com o código de início), ou null. */
fun nal(fluxo: ByteArray, tipo: Int): ByteArray? {
    val inicios = inicios(fluxo)
    for ((k, ini) in inicios.withIndex()) {
        val cab = if (fluxo.getOrNull(ini + 2)?.toInt() == 1) 3 else 4
        val t = (fluxo.getOrNull(ini + cab)?.toInt() ?: continue) and 0x1f
        if (t == tipo) return fluxo.copyOfRange(ini, inicios.getOrElse(k + 1) { fluxo.size })
    }
    return null
}

fun inicios(b: ByteArray): List<Int> {
    val v = ArrayList<Int>()
    var i = 0
    while (i + 3 <= b.size) {
        if (b[i].toInt() == 0 && b[i + 1].toInt() == 0 && b[i + 2].toInt() == 1) {
            v.add(if (i > 0 && b[i - 1].toInt() == 0) i - 1 else i)
            i += 3
        } else {
            i++
        }
    }
    return v
}
