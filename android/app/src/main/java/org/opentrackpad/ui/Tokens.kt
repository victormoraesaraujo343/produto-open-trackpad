package org.opentrackpad.ui

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import org.opentrackpad.R

/**
 * Tokens da identidade metalizada, transpostos de `src/design/tokens.css` (acabamento
 * escuro, o aprovado na seção 1 do laboratório). Mesmos nomes do CSS, em camelCase.
 * Contraste: ink, ink2, ink3, keyLbl e padInk servem para texto; ink4 só para ícone e borda.
 */
object Tokens {
    /** Archivo (a fonte da identidade), um arquivo variável com todos os pesos. */
    @OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
    val fonte = FontFamily(
        listOf(300, 400, 500, 600, 700).map { w ->
            Font(R.font.archivo, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
        },
    )

    val led = Color(0xFF9BE23F)
    val laranja = Color(0xFFFF4F1F)
    val ambar = Color(0xFFF5A524)

    val panel = Brush.linearGradient(listOf(Color(0xFF262729), Color(0xFF1D1E20), Color(0xFF151618)))
    val wellFace = Brush.verticalGradient(listOf(Color(0xFF1A1B1E), Color(0xFF1E1F22)))
    val padFace = Brush.verticalGradient(listOf(Color(0xFF0E0F10), Color(0xFF131416)))
    val keyFace = Brush.verticalGradient(listOf(Color(0xFF2E2F34), Color(0xFF232429)))
    val keyFaceOn = Brush.verticalGradient(listOf(Color(0xFF34353A), Color(0xFF282930)))
    val modFace = Brush.verticalGradient(listOf(Color(0xFF2F3035), Color(0xFF222328)))

    val panelBase = Color(0xFF1D1E20)
    val groove = Color(0xFF0A0B0C)
    val ink = Color(0xFFDDE0DC)
    val ink2 = Color(0xFFB6B9B5)
    val ink3 = Color(0xFF979A9E)
    val ink4 = Color(0xFF76797D)
    val keyInk = Color(0xFFC0C3BF)
    val keyInkOn = Color(0xFFE6E9E5)
    val keyLbl = Color(0xFFA3A6A2)
    val padDots = Color(0x14ACB2B8)
    val hairline = Color(0xFF34373B)
    val padInk = Color(0xFF8F9295)
    val padMark = Color(0xFF3D4043)
    val ledOff = Color(0xFF2A2C2E)
    val ledPoco = Color(0xFF0C0D0E)
    val scrim = Color(0x800A0B0C)
}
