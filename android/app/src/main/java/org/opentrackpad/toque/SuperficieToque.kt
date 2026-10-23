package org.opentrackpad.toque

import android.content.Context
import android.view.MotionEvent
import android.view.View
import org.opentrackpad.protocolo.Contato
import org.opentrackpad.protocolo.Protocolo

/**
 * A superfície do trackpad: diz onde os dedos estão e mais nada.
 *
 * Não reconhece toque, rolagem nem gesto: quem faz isso é o libinput no computador,
 * que enxerga um touchpad de verdade. Interpretar gesto aqui transformaria o produto
 * num mouse remoto. Não desenha nada (o Compose desenha em volta) e nunca chama
 * `invalidate`: o caminho do toque e o do desenho não se encontram.
 * Portado da v0.2 (`TouchSurfaceView`).
 */
class SuperficieToque(context: Context) : View(context) {

    /** Recebe cada retrato. */
    var aoQuadro: ((Quadro) -> Unit)? = null

    /** Chamado quando a superfície muda de tamanho (inclusive no primeiro layout). */
    var aoMedir: ((MedidaSuperficie) -> Unit)? = null

    init {
        isFocusable = true
        isClickable = true
        isHapticFeedbackEnabled = false
        contentDescription = "Trackpad"
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w > 0 && h > 0) aoMedir?.invoke(MedidaSuperficie.medir(resources.displayMetrics, w, h))
    }

    override fun onTouchEvent(e: MotionEvent): Boolean {
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> emitir(e, soltando = -1, critico = true)
            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> emitir(e, soltando = e.actionIndex, critico = true)
            // Só a amostra mais nova, de propósito: as amostras do histórico chegariam
            // todas no mesmo instante, o libinput calcularia velocidade quase zero e a
            // aceleração do cursor desmoronaria (aprendizado da v0.2).
            MotionEvent.ACTION_MOVE -> emitir(e, soltando = -1, critico = false)
            // O sistema tomou o gesto: o que achamos que está em baixo pode nunca subir.
            MotionEvent.ACTION_CANCEL -> aoQuadro?.invoke(Quadro(emptyList(), critico = true))
            else -> return false
        }
        return true
    }

    private fun emitir(e: MotionEvent, soltando: Int, critico: Boolean) {
        val w = width
        val h = height
        if (w <= 0 || h <= 0) return
        val contatos = ArrayList<Contato>(e.pointerCount)
        for (i in 0 until e.pointerCount) {
            if (i == soltando) continue
            if (contatos.size >= Protocolo.MAX_CONTATOS) break
            contatos.add(
                Contato(
                    id = e.getPointerId(i) and 0xFF,
                    // Toque bem na borda pode vir um pouco fora da view.
                    x = e.getX(i).limitado(w - 1),
                    y = e.getY(i).limitado(h - 1),
                    major = e.getTouchMajor(i).limitado(0xFFFF),
                ),
            )
        }
        aoQuadro?.invoke(Quadro(contatos, critico))
    }
}

private fun Float.limitado(max: Int): Int = if (isNaN()) 0 else toInt().coerceIn(0, max)
