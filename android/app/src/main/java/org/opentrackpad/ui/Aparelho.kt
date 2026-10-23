package org.opentrackpad.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import org.opentrackpad.conexao.EstadoConexao
import org.opentrackpad.toque.MedidaSuperficie
import org.opentrackpad.toque.Quadro
import org.opentrackpad.toque.SuperficieToque

/**
 * O aparelho deitado: duas laterais fixas em volta de um centro com o formato do
 * trackpad do MacBook (16:10), como no protótipo aprovado (seção 2). O centro troca
 * conforme o modo; as laterais ficam no mesmo lugar.
 */
@Composable
fun Aparelho(
    estado: EstadoConexao,
    aoQuadro: (Quadro) -> Unit,
    aoMedir: (MedidaSuperficie) -> Unit,
    aoControle: (Array<Pair<String, Any?>>) -> Unit,
    aoCodigo: (String) -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Tokens.panel)) {
        // O protótipo foi desenhado a 780 × 360 (≈ 2,2 : 1): centro na altura toda e
        // laterais de ~90 dp. Em celular mais quadrado (16:9), o centro 16:10 na altura
        // toda deixaria laterais finas demais para o polegar; então as laterais têm um
        // mínimo e o centro encolhe mantendo o formato.
        val folga = 10.dp
        val alturaUtil = maxHeight - folga * 2
        val larguraCentro = minOf(alturaUtil * 1.6f, maxWidth - folga * 4 - LATERAL_MINIMA * 2)
        Row(
            Modifier.fillMaxSize().padding(folga),
            horizontalArrangement = Arrangement.spacedBy(folga),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Lateral(Modifier.weight(1f)) {
                Tecla("Clique", "Clique esquerdo") { aoControle(arrayOf("t" to "botao", "b" to "esquerdo", "acao" to "clica")) }
                Tecla("Direito", "Clique direito") { aoControle(arrayOf("t" to "botao", "b" to "direito", "acao" to "clica")) }
            }
            Trackpad(Modifier.width(larguraCentro).aspectRatio(1.6f), aoQuadro, aoMedir)
            Lateral(Modifier.weight(1f)) {
                IndicadorConexao(estado)
                Tecla("Esc", "Esc") { aoControle(arrayOf("t" to "tecla", "k" to "esc")) }
            }
        }
        if (estado is EstadoConexao.Recusado) Parear(estado.motivo, aoCodigo)
    }
}

/** Largura mínima de cada lateral: teclas de 48 dp com folga para o polegar. */
private val LATERAL_MINIMA = 88.dp

@Composable
private fun Lateral(modifier: Modifier, conteudo: @Composable () -> Unit) {
    Column(
        modifier.fillMaxHeight().clip(RoundedCornerShape(14.dp)).background(Tokens.wellFace).padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) { conteudo() }
}

@Composable
private fun Trackpad(modifier: Modifier, aoQuadro: (Quadro) -> Unit, aoMedir: (MedidaSuperficie) -> Unit) {
    Box(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Tokens.padFace)
            .border(1.dp, Tokens.hairline, RoundedCornerShape(12.dp))
            .drawBehind {
                // Grade de pontos fixa (seção 35: o rastro é opcional e fica para a onda 2).
                val passo = 18.dp.toPx()
                var y = passo / 2
                while (y < size.height) {
                    var x = passo / 2
                    while (x < size.width) {
                        drawCircle(Tokens.padDots, 1.dp.toPx(), Offset(x, y))
                        x += passo
                    }
                    y += passo
                }
            },
    ) {
        AndroidView(
            factory = { ctx -> SuperficieToque(ctx).apply { this.aoQuadro = aoQuadro; this.aoMedir = aoMedir } },
            modifier = Modifier.fillMaxSize(),
        )
    }
}

@Composable
private fun Tecla(rotulo: String, descricao: String, aoTocar: () -> Unit) {
    var apertada by remember { mutableStateOf(false) }
    Box(
        Modifier
            .fillMaxWidth()
            .height(56.dp) // alvo de toque ≥ 48 dp
            .clip(RoundedCornerShape(10.dp))
            .background(if (apertada) Tokens.keyFaceOn else Tokens.keyFace)
            .border(1.dp, Tokens.groove, RoundedCornerShape(10.dp))
            .semantics { contentDescription = descricao }
            .pressionavel(aoMudar = { apertada = it }, aoTocar = aoTocar),
        contentAlignment = Alignment.Center,
    ) {
        BasicText(rotulo, style = TextStyle(color = if (apertada) Tokens.keyInkOn else Tokens.keyInk, fontSize = 13.sp, fontWeight = FontWeight.Medium))
    }
}

/** LED com texto: estado nunca só por cor. */
@Composable
private fun IndicadorConexao(estado: EstadoConexao) {
    val (ligado, texto) = when (estado) {
        is EstadoConexao.Aberta -> true to "${if (estado.via == "cabo") "Cabo" else "Wi-Fi"} · ${"LMP"[(estado.nivel - 1).coerceIn(0, 2)]}"
        EstadoConexao.Conectando -> false to "Procurando"
        EstadoConexao.Desconectado -> false to "Sem conexão"
        is EstadoConexao.Recusado -> false to "Parear"
    }
    Row(
        Modifier.fillMaxWidth().height(48.dp).semantics { contentDescription = "Conexão: $texto" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Box(Modifier.size(12.dp).clip(CircleShape).background(Tokens.ledPoco), contentAlignment = Alignment.Center) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(if (ligado) Tokens.led else Tokens.ledOff))
        }
        Spacer(Modifier.width(8.dp))
        BasicText(texto, style = TextStyle(color = Tokens.ink2, fontSize = 12.sp))
    }
}

/** Sem pareamento: pede o código que o computador mostra (o QR vem na onda 1). */
@Composable
private fun Parear(motivo: String, aoCodigo: (String) -> Unit) {
    var codigo by remember { mutableStateOf("") }
    Box(Modifier.fillMaxSize().background(Tokens.scrim), contentAlignment = Alignment.Center) {
        Column(
            Modifier.width(320.dp).clip(RoundedCornerShape(16.dp)).background(Tokens.modFace).padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            BasicText(
                when (motivo) {
                    "codigo" -> "Código não confere"
                    "versao" -> "Atualize o app"
                    else -> "Código do computador"
                },
                style = TextStyle(color = Tokens.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
            )
            BasicTextField(
                value = codigo,
                onValueChange = { novo -> codigo = novo.filter(Char::isDigit).take(6) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                textStyle = TextStyle(color = Tokens.ink, fontSize = 28.sp, textAlign = TextAlign.Center, letterSpacing = 6.sp),
                cursorBrush = SolidColor(Tokens.laranja),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Tokens.wellFace)
                    .padding(top = 8.dp)
                    .semantics { contentDescription = "Código de 6 dígitos" },
            )
            Tecla("Parear", "Parear com o código") { if (codigo.length == 6) aoCodigo(codigo) }
        }
    }
}
