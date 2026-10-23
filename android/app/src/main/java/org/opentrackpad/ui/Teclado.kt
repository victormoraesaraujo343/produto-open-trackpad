package org.opentrackpad.ui

import android.view.HapticFeedbackConstants
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Teclado do celular (layout do Gboard, igual ao protótipo). Letras, números e símbolos
 * saem por [aoTexto] (o computador digita o texto); apagar e enter saem por [aoTecla] com
 * "apagar" e "enter". Uma linha no topo mostra os últimos caracteres enviados (só local).
 *
 * As teclas respondem ao apertar, com vibração e estado apertado. As teclas com acento
 * (c, a, e, o, u, i) mandam a letra ao soltar, ou o acento se ficarem apertadas por
 * [SEGURAR_MS].
 *
 * O teclado ocupa o espaço que o [modifier] der: precisa de altura definida (ex.: fillMaxSize).
 */
@Composable
fun Teclado(aoTexto: (String) -> Unit, aoTecla: (String) -> Unit, modifier: Modifier = Modifier) {
    var modo by remember { mutableStateOf(Modo.LETRAS) }
    var maiuscula by remember { mutableStateOf(false) }
    var historico by remember { mutableStateOf("") }

    val acionar: (TeclaDef, Boolean) -> Unit = { def, segurou ->
        when (val saida = decidir(def, maiuscula, segurou)) {
            is Saida.Texto -> {
                aoTexto(saida.s)
                historico = acrescentar(historico, saida.s)
            }
            is Saida.Tecla -> {
                if (saida.nome == "apagar") historico = apagarUltimo(historico)
                aoTecla(saida.nome)
            }
            Saida.Nada -> Unit
        }
        if (def.funcao == Funcao.TROCAR_MODO) modo = if (modo == Modo.LETRAS) Modo.NUMEROS else Modo.LETRAS
        maiuscula = shiftApos(maiuscula, def)
    }

    val linhas = remember(modo) { linhasDo(modo) }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        TextoEnviado(historico, Modifier.weight(0.7f).fillMaxWidth())
        linhas.forEach { linha ->
            Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                linha.forEach { def -> TeclaView(def, maiuscula, acionar) }
            }
        }
    }
}

/** Última linha do que foi enviado; rola para mostrar sempre o fim. */
@Composable
private fun TextoEnviado(historico: String, modifier: Modifier) {
    val rolagem = rememberScrollState()
    LaunchedEffect(historico) { rolagem.scrollTo(rolagem.maxValue) }
    Box(
        modifier
            .horizontalScroll(rolagem)
            .semantics {
                liveRegion = LiveRegionMode.Polite
                contentDescription = if (historico.isEmpty()) "Nada enviado ainda" else "Enviado: $historico"
            },
        contentAlignment = Alignment.CenterStart,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BasicText(
                text = historico,
                style = TextStyle(color = Tokens.ink2, fontSize = 15.sp),
                maxLines = 1,
                softWrap = false,
            )
            // Cursor: a linha "digita" para o computador.
            Box(Modifier.padding(start = 2.dp).width(2.dp).height(15.dp).background(Tokens.laranja))
        }
    }
}

/**
 * Uma tecla. Ocupa a largura `peso` da linha. Teclas com segurar disparam no soltar (letra)
 * ou no acento (segurada 380 ms); as outras disparam ao apertar.
 */
@Composable
private fun RowScope.TeclaView(def: TeclaDef, maiuscula: Boolean, aoAcionar: (TeclaDef, Boolean) -> Unit) {
    if (def.funcao == Funcao.VAZIA) {
        Spacer(Modifier.weight(def.peso))
        return
    }
    var apertada by remember { mutableStateOf(false) }
    val acionar by rememberUpdatedState(aoAcionar)
    val view = LocalView.current
    val ligada = def.funcao == Funcao.SHIFT && maiuscula
    val acento = def.segurar

    Box(
        Modifier
            .weight(def.peso)
            .fillMaxHeight()
            .clip(RoundedCornerShape(8.dp))
            .background(if (apertada) Tokens.keyFaceOn else Tokens.keyFace)
            .border(1.dp, Tokens.groove, RoundedCornerShape(8.dp))
            .semantics(mergeDescendants = true) {
                role = Role.Button
                contentDescription = def.nome
                if (ligada) stateDescription = "ligada"
                // Acessibilidade (TalkBack): toque duplo digita; toque longo põe o acento.
                onClick { acionar(def, false); true }
                if (acento != null) onLongClick(label = "Acento $acento") { acionar(def, true); true }
            }
            .pointerInput(def) {
                awaitEachGesture {
                    awaitFirstDown()
                    apertada = true
                    view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                    try {
                        if (acento == null) {
                            acionar(def, false)
                            waitForUpOrCancellation()
                        } else {
                            var fim: PointerInputChange? = null
                            val soltouAntes = withTimeoutOrNull(SEGURAR_MS) {
                                fim = waitForUpOrCancellation()
                                true
                            } != null
                            if (soltouAntes) {
                                // Soltou a tempo: a letra normal (se não saiu do dedo).
                                if (fim != null) acionar(def, false)
                            } else {
                                // Segurou: o acento sai agora; soltar não digita mais nada.
                                view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                                acionar(def, true)
                                waitForUpOrCancellation()
                            }
                        }
                    } finally {
                        apertada = false
                    }
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        BasicText(
            text = rotuloVisivel(def, maiuscula),
            style = TextStyle(
                color = if (apertada) Tokens.keyInkOn else Tokens.keyInk,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
            ),
        )
        if (acento != null) {
            BasicText(
                text = acento,
                modifier = Modifier.align(Alignment.TopEnd).padding(top = 3.dp, end = 5.dp),
                style = TextStyle(color = Tokens.ink3, fontSize = 10.sp),
            )
        }
        // Shift ligado: barra laranja embaixo além da cor (estado nunca só por cor).
        if (ligada) {
            Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 4.dp).width(18.dp).height(2.dp).background(Tokens.laranja))
        }
    }
}
