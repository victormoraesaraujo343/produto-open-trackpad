package org.opentrackpad.toque

import android.util.DisplayMetrics

/**
 * A superfície do trackpad em pixels e em micrômetros. O tamanho físico é o que o
 * computador não sabe sozinho, e é ele que faz o touchpad virtual se comportar igual
 * em qualquer celular. Portado da v0.2 (`SurfaceMetrics`).
 */
data class MedidaSuperficie(val wPx: Int, val hPx: Int, val wUm: Int, val hUm: Int) {
    companion object {
        private const val UM_POR_POLEGADA = 25_400.0
        private const val DPI_MIN = 80.0
        private const val DPI_MAX = 1200.0

        fun medir(m: DisplayMetrics, wPx: Int, hPx: Int): MedidaSuperficie = medir(m.xdpi, m.ydpi, m.densityDpi, wPx, hPx)

        /**
         * Um dpi só para os dois eixos: `xdpi`/`ydpi` vêm na orientação natural da tela,
         * e pixel de celular é quadrado a menos de 1%. Cada eixo é julgado antes da média
         * (um aparelho que diz 0 num eixo daria uma média plausível e errada).
         */
        fun medir(xdpi: Float, ydpi: Float, densityDpi: Int, wPx: Int, hPx: Int): MedidaSuperficie {
            val bons = listOf(xdpi.toDouble(), ydpi.toDouble()).filter { it.plausivel() }
            val dpi = when {
                bons.isNotEmpty() -> bons.average()
                densityDpi.toDouble().plausivel() -> densityDpi.toDouble()
                else -> 400.0
            }
            val umPorPx = UM_POR_POLEGADA / dpi
            return MedidaSuperficie(
                wPx, hPx,
                (wPx * umPorPx).toInt().coerceAtLeast(1),
                (hPx * umPorPx).toInt().coerceAtLeast(1),
            )
        }

        private fun Double.plausivel() = !isNaN() && this >= DPI_MIN && this <= DPI_MAX
    }
}
