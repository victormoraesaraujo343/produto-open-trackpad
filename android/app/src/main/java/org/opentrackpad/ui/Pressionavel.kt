package org.opentrackpad.ui

import android.view.HapticFeedbackConstants
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.composed
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics

/**
 * Tecla física: responde ao apertar (não ao soltar), vibra e mostra o estado apertado.
 * Vibração sempre com resposta visual (regra de acessibilidade do projeto).
 */
fun Modifier.pressionavel(aoMudar: (Boolean) -> Unit, aoTocar: () -> Unit): Modifier = composed {
    val view = LocalView.current
    this
        .semantics {
            role = Role.Button
            onClick { aoTocar(); true }
        }
        .pointerInput(Unit) {
            awaitEachGesture {
                awaitFirstDown()
                aoMudar(true)
                view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                aoTocar()
                waitForUpOrCancellation()
                aoMudar(false)
            }
        }
}
