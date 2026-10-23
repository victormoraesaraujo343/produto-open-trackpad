package org.opentrackpad.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Um modo do menu, como o computador descreveu (`telas`). */
data class ModoApp(val id: String, val nome: String, val icone: String, val grupo: String, val nivel: Int)

val GRUPOS = listOf("Controlar", "Atalhos", "Tela", "Ponte")

/**
 * A tecla Modos, no topo da lateral do sistema (seção 3 do laboratório): mostra o modo
 * atual e abre o menu. Travado (seção 13), vira o controle de destravar.
 */
@Composable
fun TeclaModos(atual: ModoApp?, travado: Boolean, aoAbrir: () -> Unit, aoDestravar: () -> Unit) {
    if (travado) {
        Destravar(aoDestravar)
        return
    }
    var apertada by remember { mutableStateOf(false) }
    // Ícone em cima e nome embaixo: a lateral é estreita (≈ 90 dp).
    Column(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (apertada) Tokens.keyFaceOn else Tokens.keyFace)
            .border(1.dp, Tokens.groove, RoundedCornerShape(10.dp))
            .semantics { contentDescription = "Modo atual: ${atual?.nome ?: "Trackpad"}. Abrir modos" }
            .pressionavel(aoMudar = { apertada = it }, aoTocar = aoAbrir)
            .padding(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icone(atual?.icone ?: "trackpad", 18.dp, Tokens.keyInk)
        BasicText(
            atual?.nome ?: "Trackpad",
            maxLines = 1,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            style = TextStyle(color = Tokens.keyInk, fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
        )
    }
}

/** Segurar 3 s para destravar, com o progresso na própria tecla. */
@Composable
private fun Destravar(aoDestravar: () -> Unit) {
    var progresso by remember { mutableFloatStateOf(0f) }
    val escopo = rememberCoroutineScope()
    val view = LocalView.current
    var trabalho by remember { mutableStateOf<Job?>(null) }
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Tokens.keyFace)
            .drawBehind { drawRect(Tokens.ambar.copy(alpha = 0.25f), size = Size(size.width * progresso, size.height)) }
            .border(1.dp, Tokens.groove, RoundedCornerShape(10.dp))
            .semantics { contentDescription = "Travado. Segure por 3 segundos para destravar"; role = Role.Button }
            .pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown()
                    trabalho = escopo.launch {
                        val t0 = System.currentTimeMillis()
                        while (true) {
                            progresso = ((System.currentTimeMillis() - t0) / 3000f).coerceAtMost(1f)
                            if (progresso >= 1f) {
                                view.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
                                progresso = 0f
                                aoDestravar()
                                break
                            }
                            delay(50)
                        }
                    }
                    waitForUpOrCancellation()
                    trabalho?.cancel()
                    progresso = 0f
                }
            }
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(Tokens.ambar))
        Column {
            BasicText("Travado", style = TextStyle(color = Tokens.keyInk, fontSize = 13.sp, fontWeight = FontWeight.SemiBold))
            BasicText(if (progresso > 0f) "continue…" else "segure 3 s", style = TextStyle(color = Tokens.keyLbl, fontSize = 11.sp))
        }
    }
}

/** O menu de modos (seção 3, aprovado em abas): grupos à esquerda, modos grandes à direita. */
@Composable
fun MenuModos(
    modos: List<ModoApp>,
    atual: String,
    nivel: Int,
    aoEscolher: (ModoApp) -> Unit,
    aoTravar: () -> Unit,
    aoFechar: () -> Unit,
) {
    val grupos = GRUPOS.filter { g -> modos.any { it.grupo == g } }
    val grupoAtual = modos.firstOrNull { it.id == atual }?.grupo ?: grupos.firstOrNull() ?: "Controlar"
    var aba by remember { mutableStateOf(grupoAtual) }
    LaunchedEffect(atual) { aba = grupoAtual }
    Box(
        Modifier
            .fillMaxSize()
            .background(Tokens.scrim)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = aoFechar),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            Modifier
                .fillMaxWidth(0.82f)
                .fillMaxHeight(0.84f)
                .clip(RoundedCornerShape(16.dp))
                .background(Tokens.modFace)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                .padding(12.dp)
                .semantics { contentDescription = "Modos" },
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.width(132.dp).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (g in grupos) {
                    val ativo = g == aba
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (ativo) Tokens.keyFaceOn else Tokens.wellFace)
                            .semantics { selected = ativo; role = Role.Tab }
                            .clickable { aba = g }
                            .padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        BasicText(g, style = TextStyle(color = if (ativo) Tokens.ink else Tokens.ink2, fontSize = 13.sp, fontWeight = if (ativo) FontWeight.SemiBold else FontWeight.Normal))
                        if (modos.any { it.grupo == g && it.id == atual }) Box(Modifier.size(8.dp).clip(CircleShape).background(Tokens.led))
                    }
                }
                Box(Modifier.weight(1f))
                AcaoMenu("cadeado", "Travar", "Travar no OpenTrackpad", aoTravar)
                AcaoMenu("fechar", "Fechar", "Fechar o menu", aoFechar)
            }
            val itens = modos.filter { it.grupo == aba }
            Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (linha in itens.chunked(3)) {
                    Row(Modifier.fillMaxWidth().weight(1f, fill = false).heightIn(min = 72.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (m in linha) ItemModo(m, m.id == atual, m.nivel <= nivel, Modifier.weight(1f)) { aoEscolher(m) }
                        repeat(3 - linha.size) { Box(Modifier.weight(1f)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun AcaoMenu(icone: String, rotulo: String, descricao: String, aoTocar: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Tokens.keyFace)
            .semantics { contentDescription = descricao; role = Role.Button }
            .clickable(onClick = aoTocar)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icone(icone, 18.dp, Tokens.keyInk)
        BasicText(rotulo, style = TextStyle(color = Tokens.keyInk, fontSize = 13.sp))
    }
}

/** Um modo grande. Sem conexão para ele: aparece apagado e diz por quê (estado nunca só por cor). */
@Composable
private fun ItemModo(m: ModoApp, ativo: Boolean, livre: Boolean, modifier: Modifier, aoTocar: () -> Unit) {
    Column(
        modifier
            .heightIn(min = 72.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (ativo) Tokens.keyFaceOn else Tokens.keyFace)
            .border(if (ativo) 2.dp else 1.dp, if (ativo) Tokens.laranja else Tokens.groove, RoundedCornerShape(12.dp))
            .semantics {
                contentDescription = if (livre) m.nome else "${m.nome}: precisa de conexão melhor"
                role = Role.Button
                selected = ativo
            }
            .clickable(enabled = livre, onClick = aoTocar)
            .padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // ink4 só em ícone; texto apagado usa ink3 (contraste AA).
        Icone(m.icone, 24.dp, if (livre) Tokens.keyInk else Tokens.ink4)
        BasicText(m.nome, style = TextStyle(color = if (livre) Tokens.keyInk else Tokens.ink3, fontSize = 12.sp, fontWeight = FontWeight.Medium))
        if (!livre) BasicText("conexão fraca", style = TextStyle(color = Tokens.ink3, fontSize = 10.sp))
    }
}
