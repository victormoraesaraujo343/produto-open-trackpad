package org.opentrackpad.ponte

import android.Manifest
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import org.json.JSONObject
import org.opentrackpad.conexao.Conexao
import org.opentrackpad.protocolo.Mensagem
import java.util.concurrent.atomic.AtomicInteger

/** Taxa do microfone: PCM s16le mono, a que o computador espera (`protocolo/README.md`). */
const val TAXA_AUDIO = 16_000

/** Cada mensagem AUDIO leva um bloco de 20 ms. */
const val MS_BLOCO_AUDIO = 20

/** Bytes de um bloco: amostras × 2 bytes (16 bits) × 1 canal. A 16 kHz e 20 ms, 640 bytes. */
fun tamanhoBlocoAudio(taxa: Int = TAXA_AUDIO, ms: Int = MS_BLOCO_AUDIO): Int = taxa * ms / 1000 * 2

/** Blocos esperando a conexão antes de descartar (200 ms: o atraso não cresce sem limite). */
private const val LIMITE_PENDENTES = 10

/**
 * Microfone do celular como microfone do computador: `microfone` com `ligar` grava com
 * `AudioRecord` e manda cada bloco de 20 ms em AUDIO. Mesmo modelo da [Camera]: `ligar: false`
 * ou a conexão caindo para tudo. Roda na thread principal (quem chama).
 */
class Microfone(
    private val conexao: Conexao,
    private val pedirPermissao: (String, (Boolean) -> Unit) -> Unit,
    private val aviso: (String) -> Unit,
) {
    private var rodada = 0
    private var captura: Captura? = null

    fun receber(m: JSONObject) {
        if (m.optBoolean("ligar", false)) iniciar() else parar()
    }

    private fun iniciar() {
        parar()
        val r = rodada
        pedirPermissao(Manifest.permission.RECORD_AUDIO) { concedida ->
            if (r == rodada) {
                if (concedida) abrir() else aviso("Sem permissão para o microfone")
            }
        }
    }

    private fun abrir() {
        captura = try {
            Captura(conexao)
        } catch (_: Exception) {
            aviso("Microfone indisponível")
            null
        }
    }

    fun parar() {
        rodada++
        captura?.encerrar()
        captura = null
    }

    /** A gravação em si: uma thread lê blocos e manda. */
    private class Captura(private val conexao: Conexao) {
        private val tamanho = tamanhoBlocoAudio()
        private val gravador: AudioRecord
        private val pendentes = AtomicInteger(0)
        @Volatile private var ativo = true
        private val thread: Thread

        init {
            val minimo = AudioRecord.getMinBufferSize(TAXA_AUDIO, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            gravador = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                TAXA_AUDIO,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                maxOf(minimo, tamanho * 4),
            )
            if (gravador.state != AudioRecord.STATE_INITIALIZED) {
                gravador.release()
                throw IllegalStateException("microfone indisponível")
            }
            try {
                gravador.startRecording()
            } catch (e: Exception) {
                gravador.release()
                throw e
            }
            thread = Thread(::laco, "otp-microfone").apply { isDaemon = true; start() }
        }

        private fun laco() {
            while (ativo) {
                val bloco = ByteArray(tamanho)
                if (!lerBloco(bloco)) break
                // Atrasado: o bloco velho não serve; descarta para não criar atraso.
                if (pendentes.get() >= LIMITE_PENDENTES) continue
                pendentes.incrementAndGet()
                val ok = conexao.enviar(Mensagem.Audio(System.nanoTime() / 1000, bloco)) { pendentes.decrementAndGet() }
                if (!ok) pendentes.decrementAndGet()
            }
        }

        /** Enche o bloco (a leitura pode trazer menos de uma vez). Falso se parou ou falhou. */
        private fun lerBloco(bloco: ByteArray): Boolean {
            var lido = 0
            while (lido < bloco.size) {
                val n = gravador.read(bloco, lido, bloco.size - lido)
                if (n <= 0) return false
                lido += n
            }
            return true
        }

        fun encerrar() {
            ativo = false
            // Parar a gravação acorda a leitura que está presa; a thread então sai do laço.
            try { gravador.stop() } catch (_: Exception) {}
            try { thread.join(300) } catch (_: InterruptedException) {}
            try { gravador.release() } catch (_: Exception) {}
        }
    }
}
