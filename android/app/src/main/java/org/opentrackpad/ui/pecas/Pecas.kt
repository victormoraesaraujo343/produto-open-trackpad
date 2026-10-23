package org.opentrackpad.ui.pecas

import android.graphics.BitmapFactory
import android.os.SystemClock
import android.util.Base64
import android.view.HapticFeedbackConstants
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.floor
import kotlin.math.roundToInt
import androidx.camera.view.PreviewView
import org.opentrackpad.ponte.EstadoCamera
import org.opentrackpad.ui.Icone
import org.opentrackpad.ui.Tokens
import org.opentrackpad.ui.pressionavel

/** Para onde vai o que o usuário fez numa peça. O estado visível é da própria peça. */
interface EventosPeca {
    /** Dispara a ação `id`; `valor` (0..1) só quando a peça tem valor. */
    fun acao(id: String, valor: Double? = null)

    /** Tecla presa: `acao` é `aperta` ou `solta`. */
    fun tecla(k: String, acao: String)
}

/** Alvo de toque mínimo (regra de acessibilidade do projeto). */
private val ALVO = 48.dp
private val RAIO_PECA = RoundedCornerShape(10.dp)

/** Desenha uma peça. A chave por `id` faz o estado local (apertada, arrastada) acompanhar a peça certa. */
@Composable
fun DesenharPeca(peca: Peca, eventos: EventosPeca, modifier: Modifier = Modifier) {
    key(peca.id) {
        when (peca) {
            is Peca.Tecla -> PecaTecla(peca, eventos, modifier)
            is Peca.TeclaPresa -> PecaTeclaPresa(peca, eventos, modifier)
            is Peca.Fader -> PecaDeslizante(
                id = peca.id, rotulo = peca.rotulo, icone = peca.icone, valorRemoto = peca.valor,
                mudo = peca.mudo, passoHaptico = 0.10, eventos = eventos, modifier = modifier,
            )
            is Peca.Giro -> PecaDeslizante(
                id = peca.id, rotulo = peca.rotulo, icone = null, valorRemoto = peca.valor,
                mudo = false, passoHaptico = 0.02, eventos = eventos, modifier = modifier,
            )
            is Peca.Segmentos -> PecaSegmentos(peca, modifier)
            is Peca.Led -> PecaLed(peca, modifier)
            is Peca.Texto -> PecaTexto(peca, modifier)
            is Peca.IconeApp -> PecaIconeApp(peca, eventos, modifier)
            is Peca.Grade -> PecaGrade(peca, eventos, modifier)
            is Peca.Linha -> PecaLinha(peca, eventos, modifier)
            is Peca.PreviaCamera -> PecaPreviaCamera(modifier)
            // O vídeo ocupa o centro inteiro e é desenhado pelo Aparelho (com o trackpad por cima).
            is Peca.Video -> {}
        }
    }
}

/** Peças em coluna, cada uma do tamanho que pede (sem peso). */
@Composable
fun DesenharPecas(pecas: List<Peca>, eventos: EventosPeca, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        pecas.forEach { DesenharPeca(it, eventos) }
    }
}

/** Tecla física: ícone e rótulo pequeno; responde ao apertar e vibra com o estado apertado. */
@Composable
private fun PecaTecla(peca: Peca.Tecla, eventos: EventosPeca, modifier: Modifier) {
    var apertada by remember(peca.id) { mutableStateOf(false) }
    val acaoAtual by rememberUpdatedState(eventos)
    val cor = if (apertada) Tokens.keyInkOn else Tokens.keyInk
    val descricao = peca.dica?.let { "${peca.rotulo}. $it" } ?: peca.rotulo
    Column(
        modifier
            .fillMaxWidth()
            .heightIn(min = ALVO)
            .clip(RAIO_PECA)
            .background(if (apertada) Tokens.keyFaceOn else Tokens.keyFace)
            .border(1.dp, Tokens.groove, RAIO_PECA)
            .semantics { contentDescription = descricao }
            .pressionavel(aoMudar = { apertada = it }, aoTocar = { acaoAtual.acao(peca.id) }),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        peca.icone?.let { Icone(it, 20.dp, cor) }
        BasicText(peca.rotulo, style = TextStyle(fontFamily = Tokens.fonte, color = cor, fontSize = 12.sp, fontWeight = FontWeight.Medium))
    }
}

/**
 * Tecla que prende um modificador: cada toque alterna entre preso e solto. O LED e o
 * texto dizem o estado (nunca só a cor).
 */
@Composable
private fun PecaTeclaPresa(peca: Peca.TeclaPresa, eventos: EventosPeca, modifier: Modifier) {
    var presa by remember(peca.id) { mutableStateOf(false) }
    val acaoAtual by rememberUpdatedState(eventos)
    val estado = if (presa) "preso" else "solto"
    Box(
        modifier
            .fillMaxWidth()
            .heightIn(min = ALVO)
            .clip(RAIO_PECA)
            .background(if (presa) Tokens.keyFaceOn else Tokens.keyFace)
            .border(1.dp, Tokens.groove, RAIO_PECA)
            .semantics { contentDescription = "${peca.rotulo} $estado" }
            .pressionavel(aoMudar = {}, aoTocar = {
                val nova = !presa
                presa = nova
                acaoAtual.tecla(peca.k, if (nova) "aperta" else "solta")
            }),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            BasicText(
                peca.rotulo,
                style = TextStyle(fontFamily = Tokens.fonte, color = if (presa) Tokens.keyInkOn else Tokens.keyInk, fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
            )
            BasicText(estado, style = TextStyle(fontFamily = Tokens.fonte, color = Tokens.keyLbl, fontSize = 11.sp))
        }
        Box(
            Modifier
                .align(Alignment.TopEnd)
                .padding(6.dp)
                .size(9.dp)
                .clip(CircleShape)
                .background(if (presa) Tokens.led else Tokens.ledOff),
        )
    }
}

/**
 * Barra horizontal arrastável (fader e giro). Ao arrastar manda `acao` no máximo a cada
 * 50 ms e vibra a cada `passoHaptico` (10% no fader, 2% no giro). O valor também vai em
 * texto e no papel de controle de deslizar do leitor de tela.
 */
@Composable
private fun PecaDeslizante(
    id: String,
    rotulo: String,
    icone: String?,
    valorRemoto: Double,
    mudo: Boolean,
    passoHaptico: Double,
    eventos: EventosPeca,
    modifier: Modifier,
) {
    val view = LocalView.current
    val acaoAtual by rememberUpdatedState(eventos)
    var valor by remember(id) { mutableDoubleStateOf(valorRemoto) }
    var largura by remember(id) { mutableIntStateOf(0) }
    // O computador manda o valor de volta: quando ele muda, a peça acompanha.
    LaunchedEffect(valorRemoto) { valor = valorRemoto }

    val texto = if (mudo) "mudo" else "${(valor * 100).roundToInt()}%"
    Column(
        modifier
            .fillMaxWidth()
            .heightIn(min = ALVO)
            .semantics {
                contentDescription = if (mudo) "$rotulo, mudo" else rotulo
                stateDescription = texto
                progressBarRangeInfo = ProgressBarRangeInfo(valor.toFloat(), 0f..1f)
                setProgress { alvo ->
                    val v = alvo.toDouble().coerceIn(0.0, 1.0)
                    valor = v
                    acaoAtual.acao(id, v)
                    true
                }
            },
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            icone?.let { Icone(it, 16.dp, Tokens.ink2) }
            if (icone != null) Spacer(Modifier.width(6.dp))
            BasicText(
                rotulo,
                modifier = Modifier.weight(1f),
                style = TextStyle(fontFamily = Tokens.fonte, color = Tokens.ink2, fontSize = 12.sp, fontWeight = FontWeight.Medium),
            )
            BasicText(
                texto,
                style = TextStyle(fontFamily = Tokens.fonte, color = if (mudo) Tokens.ink3 else Tokens.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
            )
        }
        Box(
            Modifier
                .fillMaxWidth()
                .weight(1f)
                .heightIn(min = ALVO)
                .onSizeChanged { largura = it.width }
                .pointerInput(id) {
                    awaitEachGesture {
                        val primeiro = awaitFirstDown()
                        var ultimoEnvio = 0L
                        var enviado = valor
                        var passoAnterior = floor(valor / passoHaptico)
                        fun aplicar(x: Float) {
                            val v = if (largura > 0) (x / largura).toDouble().coerceIn(0.0, 1.0) else valor
                            valor = v
                            val passo = floor(v / passoHaptico)
                            if (passo != passoAnterior) {
                                passoAnterior = passo
                                view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                            }
                            val agora = SystemClock.uptimeMillis()
                            if (agora - ultimoEnvio >= 50) {
                                ultimoEnvio = agora
                                enviado = v
                                acaoAtual.acao(id, v)
                            }
                        }
                        aplicar(primeiro.position.x)
                        drag(primeiro.id) { mudanca -> aplicar(mudanca.position.x) }
                        // O último valor sempre sai, mesmo que caia dentro dos 50 ms.
                        if (valor != enviado) acaoAtual.acao(id, valor)
                    }
                },
        ) {
            Canvas(Modifier.fillMaxSize()) {
                val altura = 10.dp.toPx()
                val meio = size.height / 2
                val raio = CornerRadius(altura / 2)
                drawRoundRect(
                    color = Tokens.groove,
                    topLeft = Offset(0f, meio - altura / 2),
                    size = Size(size.width, altura),
                    cornerRadius = raio,
                )
                val preenchido = size.width * valor.toFloat()
                if (preenchido > 0f) {
                    drawRoundRect(
                        color = if (mudo) Tokens.ink4 else Tokens.led,
                        topLeft = Offset(0f, meio - altura / 2),
                        size = Size(preenchido, altura),
                        cornerRadius = raio,
                    )
                }
                val tampaLarg = 14.dp.toPx()
                val tampaAlt = 30.dp.toPx()
                val centro = (size.width * valor.toFloat()).coerceIn(tampaLarg / 2, size.width - tampaLarg / 2)
                drawRoundRect(
                    brush = Tokens.keyFace,
                    topLeft = Offset(centro - tampaLarg / 2, meio - tampaAlt / 2),
                    size = Size(tampaLarg, tampaAlt),
                    cornerRadius = CornerRadius(4.dp.toPx()),
                )
                drawRoundRect(
                    color = Tokens.ink4,
                    topLeft = Offset(centro - tampaLarg / 2, meio - tampaAlt / 2),
                    size = Size(tampaLarg, tampaAlt),
                    cornerRadius = CornerRadius(4.dp.toPx()),
                    style = Stroke(1.dp.toPx()),
                )
            }
        }
    }
}

/** Medidor de 10 LEDs só de leitura; o texto dá o número, a fileira só o aspecto. */
@Composable
private fun PecaSegmentos(peca: Peca.Segmentos, modifier: Modifier) {
    val texto = peca.texto.ifEmpty { "${(peca.valor * 100).roundToInt()}%" }
    val acesos = (peca.valor * 10).roundToInt().coerceIn(0, 10)
    Column(
        modifier
            .fillMaxWidth()
            .semantics {
                contentDescription = "${peca.rotulo}, $texto"
                progressBarRangeInfo = ProgressBarRangeInfo(peca.valor.toFloat(), 0f..1f)
            },
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            BasicText(peca.rotulo, style = TextStyle(fontFamily = Tokens.fonte, color = Tokens.ink2, fontSize = 12.sp))
            BasicText(texto, style = TextStyle(fontFamily = Tokens.fonte, color = Tokens.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold))
        }
        Row(Modifier.fillMaxWidth().height(12.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            repeat(10) { i ->
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(2.dp))
                        .background(if (i < acesos) Tokens.led else Tokens.ledOff),
                )
            }
        }
    }
}

/** LED com texto: estado nunca só por cor. */
@Composable
private fun PecaLed(peca: Peca.Led, modifier: Modifier) {
    val texto = peca.texto.ifEmpty { if (peca.ligado) "ligado" else "desligado" }
    Row(
        modifier
            .fillMaxWidth()
            .semantics { contentDescription = "${peca.rotulo}: $texto" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.size(12.dp).clip(CircleShape).background(Tokens.ledPoco), contentAlignment = Alignment.Center) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(if (peca.ligado) Tokens.led else Tokens.ledOff))
        }
        Column {
            BasicText(peca.rotulo, style = TextStyle(fontFamily = Tokens.fonte, color = Tokens.ink2, fontSize = 12.sp))
            BasicText(texto, style = TextStyle(fontFamily = Tokens.fonte, color = Tokens.ink, fontSize = 14.sp, fontWeight = FontWeight.Medium))
        }
    }
}

@Composable
private fun PecaTexto(peca: Peca.Texto, modifier: Modifier) {
    val (tamanho, cor) = when (peca.tamanho) {
        Tamanho.P -> 12.sp to Tokens.ink2
        Tamanho.M -> 16.sp to Tokens.ink
        Tamanho.G -> 24.sp to Tokens.ink
    }
    BasicText(peca.texto, modifier, style = TextStyle(fontFamily = Tokens.fonte, color = cor, fontSize = tamanho))
}

/** Ícone de app ou janela: toque manda `acao`. Sem imagem válida, usa o ícone de janelas. */
@Composable
private fun PecaIconeApp(peca: Peca.IconeApp, eventos: EventosPeca, modifier: Modifier) {
    var apertada by remember(peca.id) { mutableStateOf(false) }
    val acaoAtual by rememberUpdatedState(eventos)
    val imagem = remember(peca.png) { decodificarPng(peca.png) }
    Column(
        modifier
            .fillMaxWidth()
            .heightIn(min = ALVO)
            .clip(RAIO_PECA)
            .background(if (apertada) Tokens.keyFaceOn else Tokens.keyFace)
            .border(1.dp, Tokens.groove, RAIO_PECA)
            .semantics { contentDescription = peca.rotulo }
            .pressionavel(aoMudar = { apertada = it }, aoTocar = { acaoAtual.acao(peca.id) }),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (imagem != null) {
            Image(imagem, contentDescription = null, modifier = Modifier.size(28.dp))
        } else {
            Icone("janelas", 24.dp, Tokens.keyInk)
        }
        BasicText(peca.rotulo, style = TextStyle(fontFamily = Tokens.fonte, color = Tokens.keyInk, fontSize = 11.sp))
    }
}

/** Grade: `colunas` por fileira, com 8 dp entre as peças; a última fileira mantém a largura. */
@Composable
private fun PecaGrade(peca: Peca.Grade, eventos: EventosPeca, modifier: Modifier) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        peca.pecas.chunked(peca.colunas).forEach { fileira ->
            Row(
                Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                fileira.forEach { p ->
                    Box(Modifier.weight(1f).fillMaxHeight()) { DesenharPeca(p, eventos, Modifier.fillMaxSize()) }
                }
                repeat(peca.colunas - fileira.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** Linha: as peças lado a lado, com a mesma altura. */
@Composable
private fun PecaLinha(peca: Peca.Linha, eventos: EventosPeca, modifier: Modifier) {
    Row(
        modifier.fillMaxWidth().height(IntrinsicSize.Min),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        peca.pecas.forEach { p ->
            Box(Modifier.weight(1f).fillMaxHeight()) { DesenharPeca(p, eventos, Modifier.fillMaxSize()) }
        }
    }
}

/**
 * Prévia da câmera do celular. Enquanto a câmera envia, mostra a imagem (a peça entrega a sua
 * superfície ao módulo da câmera e a retira ao sair da tela). Desligada: quadro escuro com o
 * ícone e o texto (estado nunca só por cor).
 */
@Composable
private fun PecaPreviaCamera(modifier: Modifier) {
    val situacao = EstadoCamera.situacao
    val enviando = situacao == EstadoCamera.Situacao.ENVIANDO
    val texto = when (situacao) {
        EstadoCamera.Situacao.PEDINDO_PERMISSAO, EstadoCamera.Situacao.LIGANDO -> "Ligando a câmera"
        EstadoCamera.Situacao.SEM_PERMISSAO -> "Sem permissão para a câmera"
        else -> "Câmera desligada"
    }
    val forma = RoundedCornerShape(12.dp)
    // Dois terços da largura: no 16:10 do centro sobra a altura das teclas de baixo (≥ 48 dp).
    Box(
        modifier
            .fillMaxWidth(0.66f)
            .aspectRatio(16f / 9f)
            .clip(forma)
            .background(Tokens.groove)
            .border(1.dp, Tokens.groove, forma)
            .semantics { contentDescription = if (enviando) "Prévia da câmera" else texto },
        contentAlignment = Alignment.Center,
    ) {
        if (enviando) {
            val contexto = LocalContext.current
            val visor = remember { PreviewView(contexto).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }
            AndroidView(factory = { visor }, modifier = Modifier.fillMaxSize())
            DisposableEffect(visor) {
                EstadoCamera.anexarPrevia(visor.surfaceProvider)
                onDispose { EstadoCamera.anexarPrevia(null) }
            }
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icone("camera", 32.dp, Tokens.ink2)
                Spacer(Modifier.height(8.dp))
                BasicText(texto, style = TextStyle(fontFamily = Tokens.fonte, color = Tokens.ink, fontSize = 14.sp, fontWeight = FontWeight.Medium))
            }
        }
    }
}

/** PNG em base64 para imagem; qualquer falha vira null (a peça usa o ícone de reserva). */
private fun decodificarPng(base64: String): ImageBitmap? = try {
    val bytes = Base64.decode(base64, Base64.DEFAULT)
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
} catch (e: Exception) {
    null
}
