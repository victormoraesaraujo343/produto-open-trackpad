package org.opentrackpad.ponte

import android.Manifest
import android.content.Context
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.Bundle
import android.util.Size
import android.view.Surface
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.core.SurfaceRequest
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import org.json.JSONObject
import org.opentrackpad.conexao.Conexao
import org.opentrackpad.protocolo.Mensagem
import org.opentrackpad.video.inicios
import java.util.concurrent.atomic.AtomicInteger

/**
 * Câmera do celular como webcam do computador (`protocolo/README.md`, "Câmera e microfone").
 *
 * CameraX entrega os quadros numa `Surface` do `MediaCodec` (H.264, baseline, sem quadros B).
 * Uma thread lê o codificador, cola SPS/PPS nos quadros-chave e manda em CAMERA. Uma segunda
 * saída do CameraX (a prévia da peça) só existe enquanto a tela mostra a prévia.
 *
 * Celular fraco: se a conexão atrasa, quadros que não são chave saem da fila e o próximo
 * quadro-chave é pedido ao codificador.
 *
 * Tudo que mexe na câmera roda na thread principal; a saída do codificador tem a sua thread.
 */
class Camera(
    private val contexto: Context,
    private val conexao: Conexao,
    /** Pede uma permissão (a tela responde na thread principal). */
    private val pedirPermissao: (String, (Boolean) -> Unit) -> Unit,
    private val aviso: (String) -> Unit,
) {
    private val principal = ContextCompat.getMainExecutor(contexto)

    /** Muda a cada pedido de ligar/desligar: resposta atrasada de um pedido antigo é ignorada. */
    private var rodada = 0
    private var dono: DonoDaCamera? = null
    private var provedor: ProcessCameraProvider? = null
    private var previa: Preview? = null
    private var codificador: Codificador? = null

    init {
        EstadoCamera.aoMudarPrevia = { provedorDaPeca -> previa?.setSurfaceProvider(provedorDaPeca) }
    }

    /** Mensagem `camera` do computador. `ligar: false` para tudo. */
    fun receber(m: JSONObject) {
        if (!m.optBoolean("ligar", false)) {
            parar()
            return
        }
        iniciar(
            w = m.optInt("w", 1280).coerceIn(160, 1920),
            h = m.optInt("h", 720).coerceIn(120, 1080),
            kbps = m.optInt("kbps", 2000).coerceIn(200, 8000),
            frente = m.optBoolean("frente", true),
        )
    }

    private fun iniciar(w: Int, h: Int, kbps: Int, frente: Boolean) {
        parar()
        val r = rodada
        EstadoCamera.situacao = EstadoCamera.Situacao.PEDINDO_PERMISSAO
        pedirPermissao(Manifest.permission.CAMERA) { concedida ->
            if (r == rodada) {
                if (concedida) {
                    abrir(r, w, h, kbps, frente)
                } else {
                    EstadoCamera.situacao = EstadoCamera.Situacao.SEM_PERMISSAO
                    aviso("Sem permissão para a câmera")
                }
            }
        }
    }

    private fun abrir(r: Int, w: Int, h: Int, kbps: Int, frente: Boolean) {
        EstadoCamera.situacao = EstadoCamera.Situacao.LIGANDO
        val futuro = ProcessCameraProvider.getInstance(contexto)
        futuro.addListener({
            if (r != rodada) return@addListener
            try {
                val prov = futuro.get()
                provedor = prov
                val d = DonoDaCamera()
                dono = d
                d.ligar()
                val selecao = ResolutionSelector.Builder()
                    .setResolutionStrategy(
                        ResolutionStrategy(Size(w, h), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER),
                    )
                    .build()
                val envio = Preview.Builder().setResolutionSelector(selecao).build()
                envio.setSurfaceProvider(principal) { pedido -> superficie(r, pedido, kbps) }
                val mostrar = Preview.Builder().setResolutionSelector(selecao).build()
                previa = mostrar
                val pedida = if (frente) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
                val outra = if (frente) CameraSelector.DEFAULT_BACK_CAMERA else CameraSelector.DEFAULT_FRONT_CAMERA
                // Celular (ou emulador) sem a câmera pedida: usa a outra em vez de não mostrar nada.
                val seletor = when {
                    prov.hasCamera(pedida) -> pedida
                    prov.hasCamera(outra) -> outra.also { aviso(if (frente) "Sem câmera da frente: usando a de trás" else "Sem câmera de trás: usando a da frente") }
                    else -> throw IllegalStateException("sem câmera")
                }
                prov.unbindAll()
                try {
                    prov.bindToLifecycle(d, seletor, envio, mostrar)
                } catch (_: IllegalArgumentException) {
                    // O aparelho não aceita duas saídas de imagem: envia sem a prévia.
                    prov.unbindAll()
                    previa = null
                    prov.bindToLifecycle(d, seletor, envio)
                }
            } catch (_: Exception) {
                parar()
                aviso("Não foi possível abrir a câmera")
            }
        }, principal)
    }

    /** Chamado pelo CameraX quando ele quer entregar quadros: cria o codificador no tamanho dele. */
    private fun superficie(r: Int, pedido: SurfaceRequest, kbps: Int) {
        if (r != rodada) {
            pedido.willNotProvideSurface()
            return
        }
        val tamanho = pedido.resolution
        val atual = codificador
        if (atual != null && atual.largura == tamanho.width && atual.altura == tamanho.height) {
            pedido.provideSurface(atual.superficie, principal) { }
            return
        }
        atual?.encerrar()
        codificador = null
        try {
            val novo = Codificador(conexao, tamanho.width, tamanho.height, kbps)
            codificador = novo
            pedido.provideSurface(novo.superficie, principal) { }
            EstadoCamera.situacao = EstadoCamera.Situacao.ENVIANDO
        } catch (_: Exception) {
            // Este aparelho não codifica nesse tamanho.
            parar()
            aviso("Esta câmera não funciona neste celular")
        }
    }

    /** Para a câmera e solta tudo (ligar falso, conexão caiu, app fechou). Pode ser chamado sempre. */
    fun parar() {
        rodada++
        try { provedor?.unbindAll() } catch (_: Exception) {}
        dono?.desligar()
        dono = null
        codificador?.encerrar()
        codificador = null
        previa = null
        EstadoCamera.situacao = EstadoCamera.Situacao.DESLIGADA
    }
}

/**
 * Estado da câmera para a peça de prévia. A peça só lê; quem escreve é o [Camera] (na thread
 * principal). A peça entrega a superfície do `PreviewView` por [anexarPrevia] enquanto está na tela.
 */
object EstadoCamera {
    enum class Situacao { DESLIGADA, PEDINDO_PERMISSAO, LIGANDO, ENVIANDO, SEM_PERMISSAO }

    var situacao by mutableStateOf(Situacao.DESLIGADA)
        internal set

    internal var aoMudarPrevia: ((Preview.SurfaceProvider?) -> Unit)? = null

    /** A prévia da peça: `null` quando ela sai da tela. */
    fun anexarPrevia(provedor: Preview.SurfaceProvider?) {
        aoMudarPrevia?.invoke(provedor)
    }
}

/** Quadros que ficam pendentes na conexão antes de descartar quadros que não são chave. */
private const val LIMITE_QUADROS = 6
private const val FPS = 30

/** Maior pedaço de quadro: o comprimento (u16) conta tipo (1) + pts (8) + marcas (1) + dados. */
const val TAMANHO_MAX_PEDACO = 65_535 - 1 - 8 - 1

/** Bits de `marcas` (ver "Vídeo" em `protocolo/README.md`). */
const val MARCA_CHAVE = 1
const val MARCA_ULTIMO = 2
const val MARCA_PRIMEIRO = 4

/** Parte um quadro H.264 (Annex B) em mensagens CAMERA de no máximo [tamanhoMax] bytes. */
fun fatiarQuadro(ptsUs: Long, chave: Boolean, dados: ByteArray, tamanhoMax: Int = TAMANHO_MAX_PEDACO): List<Mensagem.Camera> {
    require(tamanhoMax > 0)
    val partes = maxOf(1, (dados.size + tamanhoMax - 1) / tamanhoMax)
    return (0 until partes).map { i ->
        val ini = i * tamanhoMax
        val fim = minOf(dados.size, ini + tamanhoMax)
        var marcas = 0
        if (chave) marcas = marcas or MARCA_CHAVE
        if (i == 0) marcas = marcas or MARCA_PRIMEIRO
        if (i == partes - 1) marcas = marcas or MARCA_ULTIMO
        Mensagem.Camera(ptsUs, marcas, dados.copyOfRange(ini, fim))
    }
}

/**
 * Cola SPS/PPS (`parametros`, Annex B, vindos do codificador) na frente de um quadro-chave.
 * Se o quadro já começa com SPS (o codificador mandou junto), devolve o quadro como está.
 */
fun comParametros(quadro: ByteArray, parametros: ByteArray): ByteArray {
    if (parametros.isEmpty()) return quadro
    if (tipoPrimeiraNal(quadro) == 7) return quadro
    return parametros + quadro
}

/** Tipo (5 bits) da primeira NAL do quadro, ou null se não há código de início. */
internal fun tipoPrimeiraNal(quadro: ByteArray): Int? {
    val ini = inicios(quadro).firstOrNull() ?: return null
    val cab = if (quadro.getOrNull(ini + 2)?.toInt() == 1) 3 else 4
    return quadro.getOrNull(ini + cab)?.let { it.toInt() and 0x1f }
}

/** Dono de ciclo de vida próprio: a câmera fica ligada enquanto o computador quiser (não a Activity). */
private class DonoDaCamera : LifecycleOwner {
    private val registro = LifecycleRegistry(this)
    override val lifecycle: Lifecycle get() = registro

    fun ligar() {
        registro.currentState = Lifecycle.State.RESUMED
    }

    /** Vai a DESTROYED: o CameraX solta os casos de uso ligados a ele. */
    fun desligar() {
        registro.currentState = Lifecycle.State.DESTROYED
    }
}

/**
 * Codificador H.264 com entrada por `Surface` (o CameraX desenha nela). A saída é lida numa
 * thread: monta cada quadro, cola SPS/PPS nos quadros-chave e manda pela conexão, com controle
 * de atraso (ver [aoQuadro]).
 */
private class Codificador(
    private val conexao: Conexao,
    val largura: Int,
    val altura: Int,
    kbps: Int,
) {
    private val codec: MediaCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
    val superficie: Surface

    /** Quadros enviados que a conexão ainda não escreveu. */
    private val pendentes = AtomicInteger(0)

    /** Depois de descartar um quadro, nada mais sai até o próximo quadro-chave. */
    private var aguardandoChave = false
    private var parametros = ByteArray(0)

    @Volatile private var ativo = true
    private val thread: Thread

    init {
        try {
            try {
                codec.configure(formatoPara(codec, largura, altura, kbps, completo = true), null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            } catch (_: Exception) {
                // Codificadores simples (o de software do Android 9, por exemplo) recusam taxa fixa,
                // prioridade ou perfil: tenta de novo só com o essencial.
                codec.reset()
                codec.configure(formatoPara(codec, largura, altura, kbps, completo = false), null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            }
            superficie = codec.createInputSurface()
            codec.start()
        } catch (e: Exception) {
            codec.release()
            throw e
        }
        thread = Thread(::laco, "otp-camera-saida").apply { isDaemon = true; start() }
    }

    private fun laco() {
        val info = MediaCodec.BufferInfo()
        while (ativo) {
            val i = codec.dequeueOutputBuffer(info, 20_000)
            // Sem saída ainda (ou troca de formato): espera o próximo.
            if (i < 0) continue
            try {
                val saida = codec.getOutputBuffer(i)
                if (saida != null && info.size > 0) {
                    saida.position(info.offset)
                    saida.limit(info.offset + info.size)
                    val dados = ByteArray(info.size).also { saida.get(it) }
                    if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                        parametros = dados
                    } else {
                        aoQuadro(info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME != 0, info.presentationTimeUs, dados)
                    }
                }
            } finally {
                codec.releaseOutputBuffer(i, false)
            }
        }
    }

    /**
     * Um quadro do codificador. Se a conexão está atrasada (mais de [LIMITE_QUADROS] pendentes),
     * quadros que não são chave saem da fila e o próximo quadro-chave é pedido.
     */
    private fun aoQuadro(chave: Boolean, ptsUs: Long, dados: ByteArray) {
        val atrasado = pendentes.get() > LIMITE_QUADROS
        if (!chave && (atrasado || aguardandoChave)) {
            if (!aguardandoChave) {
                aguardandoChave = true
                pedirChave()
            }
            return
        }
        aguardandoChave = false
        val quadro = if (chave) comParametros(dados, parametros) else dados
        val pedacos = fatiarQuadro(ptsUs, chave, quadro)
        pendentes.incrementAndGet()
        // Só o último pedaço conta a saída do quadro (zera a pendência quando ele for escrito).
        var ok = true
        for ((i, pedaco) in pedacos.withIndex()) {
            if (!ok) break
            val ultimo = i == pedacos.lastIndex
            ok = conexao.enviar(pedaco, if (ultimo) ({ pendentes.decrementAndGet() }) else null)
        }
        if (!ok) pendentes.decrementAndGet()
    }

    private fun pedirChave() {
        try {
            codec.setParameters(Bundle().apply { putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME, 0) })
        } catch (_: Exception) {
        }
    }

    /** Para a thread, o codificador e a superfície. Quem chama já desligou a câmera. */
    fun encerrar() {
        ativo = false
        try { thread.join(500) } catch (_: InterruptedException) {}
        try { codec.stop() } catch (_: Exception) {}
        codec.release()
        superficie.release()
    }

    private companion object {
        fun formatoPara(c: MediaCodec, largura: Int, altura: Int, kbps: Int, completo: Boolean = true): MediaFormat {
            val f = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, largura, altura)
            f.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            f.setInteger(MediaFormat.KEY_BIT_RATE, kbps * 1000)
            f.setInteger(MediaFormat.KEY_FRAME_RATE, FPS)
            f.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
            if (!completo) return f
            f.setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR)
            // Prioridade de tempo real: o aparelho fraco dá prioridade ao quadro atual.
            f.setInteger(MediaFormat.KEY_PRIORITY, 0)
            if (perfilBaseline(c)) f.setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline)
            return f
        }

        fun perfilBaseline(c: MediaCodec): Boolean = try {
            c.codecInfo.getCapabilitiesForType(MediaFormat.MIMETYPE_VIDEO_AVC).profileLevels
                .any { it.profile == MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline }
        } catch (_: Exception) {
            false
        }
    }
}
