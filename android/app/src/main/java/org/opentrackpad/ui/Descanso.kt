package org.opentrackpad.ui

import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.delay
import org.opentrackpad.conexao.EstadoConexao

/** Parado este tempo (sem toque em lugar nenhum) com a conexão aberta, entra no descanso (AGENTS.md). */
const val PARADO_MS = 20_000L

/**
 * Entra (ou fica) em descanso? Pura: só com a conexão aberta e parado há [PARADO_MS].
 * Sem conexão, nunca entra. Quem já está em descanso continua até um toque (que zera o estado).
 */
fun descansoAgora(descansando: Boolean, conectado: Boolean, ultimoToqueMs: Long, agoraMs: Long): Boolean =
    conectado && (descansando || agoraMs - ultimoToqueMs >= PARADO_MS)

/**
 * Observa toques sem consumir (fase Initial): conta qualquer dedo na tela, inclusive o que
 * vai para o trackpad. Não muda o que chega ao computador.
 */
fun Modifier.observarToque(aoTocar: () -> Unit): Modifier = pointerInput(Unit) {
    awaitPointerEventScope {
        while (true) {
            val ev = awaitPointerEvent(PointerEventPass.Initial)
            if (ev.changes.any { it.pressed || it.previousPressed }) aoTocar()
        }
    }
}

/**
 * Vigia a parada: a cada segundo decide se o celular entra no descanso. Cair a conexão
 * tira do descanso (`descansoAgora` devolve false sem conexão).
 */
@Composable
fun VigiaDescanso(e: EstadoTela) {
    LaunchedEffect(Unit) {
        while (true) {
            val conectado = e.conexao is EstadoConexao.Aberta
            e.descansando = descansoAgora(e.descansando, conectado, e.ultimoToque, SystemClock.uptimeMillis())
            delay(1_000)
        }
    }
}

/** Deslocamento (dp) do bloco do relógio: um passo por minuto, para a tela não marcar. */
private val DERIVA = listOf(0 to 0, 6 to -4, -5 to 5, 4 to 3, -6 to -3, 3 to 6, -4 to -5, 5 to 2)

/**
 * Tela de descanso: fundo `panelBase` cobrindo tudo, relógio grande e data embaixo. Qualquer
 * toque volta, e o gesto que acorda fica aqui: não chega ao trackpad nem ao computador.
 */
@Composable
fun TelaDeDescanso(e: EstadoTela) {
    val contexto = LocalContext.current
    val semMovimento = remember { reduzirMovimento(contexto) }
    val minuto by produceState(minutoAtual()) {
        while (true) {
            delay(1_000)
            value = minutoAtual()
        }
    }
    val hora = remember(minuto) { formatar("HH:mm", minuto) }
    val data = remember(minuto) { formatar("EEE, d MMM", minuto) }
    val passo = if (semMovimento) 0 to 0 else DERIVA[(minuto % DERIVA.size).toInt()]
    val dx by animateDpAsState(passo.first.dp, tween(durationMillis = 3_000, easing = LinearEasing), label = "deriva-x")
    val dy by animateDpAsState(passo.second.dp, tween(durationMillis = 3_000, easing = LinearEasing), label = "deriva-y")

    Box(
        Modifier
            .fillMaxSize()
            .background(Tokens.panelBase)
            .semantics {
                role = Role.Button
                contentDescription = "Celular parado, $hora. Toque para voltar"
                onClick { e.tocou(); true }
            }
            .pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown().consume()
                    e.tocou()
                    // Consome o resto do gesto até soltar: nada disso vai para o computador.
                    do {
                        val ev = awaitPointerEvent()
                        ev.changes.forEach { it.consume() }
                    } while (ev.changes.any { it.pressed })
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Column(Modifier.offset(dx, dy), horizontalAlignment = Alignment.CenterHorizontally) {
            BasicText(hora, style = TextStyle(color = Tokens.ink3, fontSize = 96.sp, fontWeight = FontWeight.Light))
            BasicText(data, style = TextStyle(color = Tokens.ink3, fontSize = 16.sp))
        }
    }
}

/** "Reduzir movimento" do sistema: escala de animação zero. */
fun reduzirMovimento(contexto: Context): Boolean =
    Settings.Global.getFloat(contexto.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

private fun minutoAtual(): Long = System.currentTimeMillis() / 60_000L

private fun formatar(padrao: String, minuto: Long): String =
    SimpleDateFormat(padrao, Locale.forLanguageTag("pt-BR")).format(Date(minuto * 60_000L))
