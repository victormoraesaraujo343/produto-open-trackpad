package org.opentrackpad.ui

import android.Manifest
import android.content.pm.PackageManager
import android.util.Size
import android.view.HapticFeedbackConstants
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.ReaderException
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import org.opentrackpad.conexao.ConviteQr
import org.opentrackpad.conexao.lerConvite
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Lê o QR do pareamento com a câmera traseira (CameraX + ZXing, sem serviços do Google).
 * Ao achar um convite válido, vibra, para a câmera e chama [aoLer] uma vez só.
 */
@Composable
fun LerQr(aoLer: (ConviteQr) -> Unit, aoCancelar: () -> Unit, modifier: Modifier = Modifier) {
    val ctx = LocalContext.current
    val avisarLeitura by rememberUpdatedState(aoLer)
    var permitida by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    var lido by remember { mutableStateOf(false) }
    var semCamera by remember { mutableStateOf(false) }
    val pedir = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { permitida = it }
    LaunchedEffect(Unit) { if (!permitida) pedir.launch(Manifest.permission.CAMERA) }

    val texto = when {
        lido -> "Código lido"
        !permitida -> "Sem acesso à câmera."
        semCamera -> "Não foi possível abrir a câmera."
        else -> "Aponte para o QR no computador"
    }

    Box(modifier.fillMaxSize().background(Tokens.panel)) {
        if (permitida) {
            Visor(
                aoAchar = { convite ->
                    lido = true
                    avisarLeitura(convite)
                },
                aoFalhar = { semCamera = true },
                modifier = Modifier.fillMaxSize(),
            )
            // Moldura quadrada no centro; fica verde quando o código é lido.
            BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                val lado = minOf(maxWidth, maxHeight) * 0.7f
                Box(
                    Modifier
                        .size(lado)
                        .border(4.dp, if (lido) Tokens.led else Tokens.ink, RoundedCornerShape(16.dp)),
                )
            }
        }

        Botao(
            rotulo = "Fechar",
            descricao = "Fechar a leitura do QR",
            aoTocar = aoCancelar,
            modifier = Modifier.align(Alignment.TopEnd).padding(12.dp),
        )

        Column(
            Modifier.align(Alignment.BottomCenter).padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(Tokens.panelBase)
                    .padding(horizontal = 16.dp, vertical = 10.dp),
            ) {
                BasicText(texto, style = TextStyle(color = Tokens.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold))
            }
            if (!permitida || semCamera) {
                Botao(
                    rotulo = "Digitar o código",
                    descricao = "Digitar o código de 6 dígitos",
                    aoTocar = aoCancelar,
                )
            }
        }
    }
}

/**
 * Prévia da câmera traseira e análise dos quadros. Tudo que mexe na câmera roda na thread
 * principal; a decodificação roda numa thread só (o leitor do ZXing não é seguro para
 * várias threads).
 */
@Composable
private fun Visor(aoAchar: (ConviteQr) -> Unit, aoFalhar: () -> Unit, modifier: Modifier) {
    val ctx = LocalContext.current
    val dono = LocalLifecycleOwner.current
    val achar by rememberUpdatedState(aoAchar)
    val falhar by rememberUpdatedState(aoFalhar)
    val visor = remember { PreviewView(ctx).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }

    DisposableEffect(dono) {
        val principal = ContextCompat.getMainExecutor(ctx)
        val execucao = Executors.newSingleThreadExecutor()
        val achou = AtomicBoolean(false)
        var provedor: ProcessCameraProvider? = null
        var saiu = false

        val futuro = ProcessCameraProvider.getInstance(ctx)
        futuro.addListener({
            if (saiu) return@addListener
            try {
                val camera = futuro.get()
                provedor = camera
                val previa = Preview.Builder().build().also { it.surfaceProvider = visor.surfaceProvider }
                val analise = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setResolutionSelector(
                        ResolutionSelector.Builder()
                            .setResolutionStrategy(
                                ResolutionStrategy(
                                    Size(1280, 720),
                                    ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                                ),
                            )
                            .build(),
                    )
                    .build()
                analise.setAnalyzer(execucao, LeitorQr { convite ->
                    if (achou.compareAndSet(false, true)) {
                        principal.execute {
                            if (!saiu) provedor?.unbindAll()
                            visor.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                            achar(convite)
                        }
                    }
                })
                camera.unbindAll()
                camera.bindToLifecycle(dono, CameraSelector.DEFAULT_BACK_CAMERA, previa, analise)
            } catch (_: Exception) {
                // Sem câmera traseira ou câmera ocupada.
                falhar()
            }
        }, principal)

        onDispose {
            saiu = true
            provedor?.unbindAll()
            execucao.shutdown()
        }
    }

    AndroidView(factory = { visor }, modifier = modifier)
}

/** Decodifica cada quadro (só QR) e entrega o primeiro convite que [lerConvite] aceita. */
private class LeitorQr(private val aoAchar: (ConviteQr) -> Unit) : ImageAnalysis.Analyzer {
    private val leitor = QRCodeReader()
    private val dicas = mapOf(DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE))

    override fun analyze(imagem: ImageProxy) {
        try {
            val largura = imagem.width
            val altura = imagem.height
            val fonte = PlanarYUVLuminanceSource(luminancia(imagem), largura, altura, 0, 0, largura, altura, false)
            val texto = leitor.decode(BinaryBitmap(HybridBinarizer(fonte)), dicas).text
            lerConvite(texto)?.let(aoAchar)
        } catch (_: ReaderException) {
            // Nenhum QR neste quadro: tenta o próximo.
        } finally {
            imagem.close()
        }
    }

    /** Copia o plano Y sem o preenchimento das linhas (o ZXing espera uma matriz compacta). */
    private fun luminancia(imagem: ImageProxy): ByteArray {
        val plano = imagem.planes[0]
        val largura = imagem.width
        val altura = imagem.height
        val linha = plano.rowStride
        val pixel = plano.pixelStride
        val origem = plano.buffer.duplicate()
        val saida = ByteArray(largura * altura)
        for (y in 0 until altura) {
            val base = y * linha
            if (pixel == 1) {
                origem.position(base)
                origem.get(saida, y * largura, largura)
            } else {
                for (x in 0 until largura) saida[y * largura + x] = origem.get(base + x * pixel)
            }
        }
        return saida
    }
}

/** Botão do próprio arquivo (o `Tecla` de `Aparelho.kt` é privado): alvo de 48 dp e nome acessível. */
@Composable
private fun Botao(rotulo: String, descricao: String, aoTocar: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Tokens.keyFace)
            .border(1.dp, Tokens.groove, RoundedCornerShape(10.dp))
            .clickable(role = Role.Button, onClick = aoTocar)
            .semantics { contentDescription = descricao }
            .padding(horizontal = 18.dp),
        contentAlignment = Alignment.Center,
    ) {
        BasicText(rotulo, style = TextStyle(color = Tokens.keyInk, fontSize = 15.sp, fontWeight = FontWeight.Medium))
    }
}
