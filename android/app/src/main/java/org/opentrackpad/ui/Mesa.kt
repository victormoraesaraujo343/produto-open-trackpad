package org.opentrackpad.ui

import android.content.Context
import android.view.MotionEvent
import android.view.View
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import org.opentrackpad.protocolo.Mensagem

/**
 * Mesa digitalizadora (seção 15 do laboratório): prancheta fosca, absoluta (cada ponto do
 * celular é o mesmo ponto da tela do computador). Sem tinta no celular: o traço aparece no
 * computador. "Desenhar" pinta ao encostar; "Posicionar" só leva o cursor.
 */
@Composable
fun Mesa(modifier: Modifier, aoCaneta: (Mensagem.Caneta) -> Unit) {
    var desenhar by remember { mutableStateOf(true) }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(
            Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(12.dp))
                .background(Tokens.padFace)
                .border(1.dp, Tokens.hairline, RoundedCornerShape(12.dp))
                .semantics { contentDescription = "Mesa digitalizadora" },
        ) {
            AndroidView(
                factory = { ctx -> SuperficieCaneta(ctx).apply { this.aoCaneta = aoCaneta } },
                update = { it.desenhar = desenhar },
                modifier = Modifier.fillMaxSize(),
            )
        }
        var apertada by remember { mutableStateOf(false) }
        val rotulo = if (desenhar) "Modo: Desenhar" else "Modo: Posicionar"
        Box(
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(if (apertada || !desenhar) Tokens.keyFaceOn else Tokens.keyFace)
                .border(1.dp, Tokens.groove, RoundedCornerShape(10.dp))
                .semantics { contentDescription = "Trocar o modo da caneta"; stateDescription = rotulo }
                .pressionavel(aoMudar = { apertada = it }, aoTocar = { desenhar = !desenhar })
                .padding(horizontal = 12.dp),
            contentAlignment = Alignment.Center,
        ) {
            BasicText(rotulo, style = TextStyle(color = Tokens.keyInk, fontSize = 13.sp, fontWeight = FontWeight.Medium))
        }
    }
}

/** Lê a posição e a pressão (caneta ativa quando o aparelho tem; dedo vale 512). */
class SuperficieCaneta(context: Context) : View(context) {
    var aoCaneta: ((Mensagem.Caneta) -> Unit)? = null
    var desenhar = true
    private var seq = 0L

    init {
        isClickable = true
        contentDescription = "Mesa digitalizadora"
    }

    override fun onTouchEvent(e: MotionEvent): Boolean = enviar(e, e.actionMasked)

    // Caneta que passa por cima sem encostar (onde o aparelho informa): só move o cursor.
    override fun onHoverEvent(e: MotionEvent): Boolean = enviar(e, e.actionMasked)

    private fun enviar(e: MotionEvent, acao: Int): Boolean {
        val w = width.coerceAtLeast(1)
        val h = height.coerceAtLeast(1)
        val x = ((e.x / w).coerceIn(0f, 1f) * 65535).toInt()
        val y = ((e.y / h).coerceIn(0f, 1f) * 65535).toInt()
        val caneta = e.getToolType(0) == MotionEvent.TOOL_TYPE_STYLUS
        val pressao = if (caneta) (e.pressure.coerceIn(0f, 1f) * 1023).toInt() else 512
        val marcas = when (acao) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> if (desenhar) 3 else 2
            MotionEvent.ACTION_HOVER_ENTER, MotionEvent.ACTION_HOVER_MOVE -> 2
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL, MotionEvent.ACTION_HOVER_EXIT -> 0
            else -> return false
        }
        seq = (seq + 1) and 0xFFFFFFFFL
        aoCaneta?.invoke(Mensagem.Caneta(seq, x, y, pressao, marcas))
        return true
    }
}
