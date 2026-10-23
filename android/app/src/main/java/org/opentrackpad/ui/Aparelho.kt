package org.opentrackpad.ui

import android.os.SystemClock
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
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import org.opentrackpad.conexao.ConviteQr
import org.opentrackpad.conexao.EstadoConexao
import org.opentrackpad.toque.MedidaSuperficie
import org.opentrackpad.toque.Quadro
import org.opentrackpad.toque.SuperficieToque
import org.opentrackpad.ui.pecas.EventosPeca
import org.opentrackpad.ui.pecas.Laterais
import org.opentrackpad.ui.pecas.LateralDescrita
import org.opentrackpad.ui.pecas.Peca
import org.opentrackpad.ui.pecas.TelaDescrita
import org.opentrackpad.ui.pecas.DesenharPecas

/** O que a tela mostra. Mudado pela atividade (que conversa com o computador). */
class EstadoTela {
    var conexao by mutableStateOf<EstadoConexao>(EstadoConexao.Desconectado)
    var laterais by mutableStateOf<Laterais?>(null)
    var modos by mutableStateOf(listOf(ModoApp("trackpad", "Trackpad", "trackpad", "Controlar", 1), ModoApp("teclado", "Teclado", "teclado", "Controlar", 1)))
    var modo by mutableStateOf("trackpad")
    var telaDescrita by mutableStateOf<TelaDescrita?>(null)
    var menuAberto by mutableStateOf(false)
    var travado by mutableStateOf(false)
    var lendoQr by mutableStateOf(false)
    var aviso by mutableStateOf<String?>(null)
    /** Tela de descanso (parado com a conexão aberta; ver `Descanso.kt`). */
    var descansando by mutableStateOf(false)

    /** Último toque em qualquer lugar (uptime, ms). Não é estado: muda a cada quadro do trackpad. */
    var ultimoToque: Long = SystemClock.uptimeMillis()
        private set

    val nivel: Int get() = (conexao as? EstadoConexao.Aberta)?.nivel ?: 0

    /** Decodificador do vídeo do computador (espelho); a tela liga a superfície nele. */
    val video = org.opentrackpad.video.Decodificador()

    /** Qualquer toque (inclusive quadros do trackpad): zera a parada e acorda o descanso. */
    fun tocou() {
        ultimoToque = SystemClock.uptimeMillis()
        if (descansando) descansando = false
    }
}

/** O que a tela pede (a atividade transforma em mensagens). */
interface AcoesTela : EventosPeca {
    fun quadro(q: Quadro)
    fun medida(m: MedidaSuperficie)
    fun botao(b: String)
    fun texto(s: String)
    fun escolherModo(m: ModoApp)
    fun travar(sim: Boolean)
    fun codigo(c: String)
    fun convite(c: ConviteQr)
    fun caneta(c: org.opentrackpad.protocolo.Mensagem.Caneta)
}

/**
 * O aparelho deitado: duas laterais fixas em volta de um centro com o formato do
 * trackpad do MacBook (16:10), como no protótipo aprovado (seção 2). O centro troca
 * conforme o modo; as laterais ficam no mesmo lugar. As peças das laterais vêm do
 * computador (o app em foco decide os atalhos).
 */
@Composable
fun Aparelho(e: EstadoTela, a: AcoesTela) {
    VigiaDescanso(e)
    BoxWithConstraints(Modifier.fillMaxSize().background(Tokens.panel).observarToque(e::tocou)) {
        // O protótipo foi desenhado a 780 × 360 (≈ 2,2 : 1): centro na altura toda e
        // laterais de ~90 dp. Em celular mais quadrado (16:9), o centro 16:10 na altura
        // toda deixaria laterais finas demais para o polegar; então as laterais têm um
        // mínimo e o centro encolhe mantendo o formato.
        val folga = 10.dp
        val alturaUtil = maxHeight - folga * 2
        val larguraCentro = minOf(alturaUtil * 1.6f, maxWidth - folga * 4 - LATERAL_MINIMA * 2)
        val atual = e.modos.firstOrNull { it.id == e.modo }
        Row(
            Modifier.fillMaxSize().padding(folga),
            horizontalArrangement = Arrangement.spacedBy(folga),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LateralDescrita(
                pecas = e.laterais?.esquerda ?: PADRAO_ESQUERDA,
                eventos = a,
                cabeca = { CabecaApp(e.laterais) },
                modifier = Modifier.weight(1f).fillMaxHeight(),
            )
            val centro = Modifier.width(larguraCentro).aspectRatio(1.6f)
            when {
                e.modo == "mesa" -> Mesa(centro, a::caneta)
                e.modo == "teclado" -> Box(centro.clip(RoundedCornerShape(12.dp)).background(Tokens.wellFace).padding(8.dp)) {
                    Teclado(aoTexto = a::texto, aoTecla = { k -> a.tecla(k, "toca") }, modifier = Modifier.fillMaxSize())
                }
                e.modo != "trackpad" && e.telaDescrita?.id == e.modo && e.telaDescrita?.pecas?.firstOrNull() is Peca.Video ->
                    VideoCentro(centro, e.telaDescrita!!.pecas.first() as Peca.Video, e, a)
                e.modo != "trackpad" && e.telaDescrita?.id == e.modo -> Box(
                    centro.clip(RoundedCornerShape(12.dp)).background(Tokens.wellFace).padding(10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    DesenharPecas(e.telaDescrita!!.pecas, a, Modifier.fillMaxWidth())
                }
                else -> Trackpad(centro, a)
            }
            LateralDescrita(
                pecas = e.laterais?.direita ?: PADRAO_DIREITA,
                eventos = a,
                cabeca = { IndicadorConexao(e.conexao) },
                extraTopo = {
                    TeclaModos(atual, e.travado, aoAbrir = { e.menuAberto = true }, aoDestravar = { a.travar(false) })
                },
                modifier = Modifier.weight(1f).fillMaxHeight(),
            )
        }
        e.aviso?.let { Aviso(it) }
        if (e.menuAberto && !e.travado) {
            MenuModos(
                modos = e.modos,
                atual = e.modo,
                nivel = e.nivel,
                aoEscolher = { m -> e.menuAberto = false; a.escolherModo(m) },
                aoTravar = { e.menuAberto = false; a.travar(true) },
                aoFechar = { e.menuAberto = false },
            )
        }
        val conexao = e.conexao
        if (e.lendoQr) {
            LerQr(aoLer = { c -> e.lendoQr = false; a.convite(c) }, aoCancelar = { e.lendoQr = false }, modifier = Modifier.fillMaxSize())
        } else if (conexao is EstadoConexao.Recusado) {
            Parear(conexao.motivo, aoCodigo = a::codigo, aoQr = { e.lendoQr = true })
        }
        // Por último: cobre tudo. O toque que acorda fica aqui e não chega ao trackpad.
        if (e.descansando) TelaDeDescanso(e)
    }
}

/** Antes do computador mandar as laterais (ou sem conexão): o básico do trackpad. */
private val PADRAO_ESQUERDA: List<Peca> = listOf(
    Peca.Tecla(id = "cliqueDireito", rotulo = "Clique direito", icone = "clique", dica = null),
)
private val PADRAO_DIREITA: List<Peca> = listOf(
    Peca.TeclaPresa(id = "presa-ctrl", rotulo = "Ctrl", k = "ctrl"),
)

/** Largura mínima de cada lateral: teclas de 48 dp com folga para o polegar. */
private val LATERAL_MINIMA = 88.dp

@Composable
private fun CabecaApp(l: Laterais?) {
    Row(
        Modifier.fillMaxWidth().height(32.dp).semantics { contentDescription = "App em foco: ${l?.app ?: "nenhum"}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icone(l?.iconeApp ?: "computador", 16.dp, Tokens.ink2)
        BasicText(l?.app ?: "OpenTrackpad", maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, style = TextStyle(color = Tokens.ink2, fontSize = 12.sp))
    }
}

@Composable
private fun Trackpad(modifier: Modifier, a: AcoesTela) {
    Box(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Tokens.padFace)
            .border(1.dp, Tokens.hairline, RoundedCornerShape(12.dp))
            .drawBehind {
                // Grade de pontos fixa; o rastro (seção 35) é opcional e entra com os ajustes.
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
            factory = { ctx -> SuperficieToque(ctx).apply { aoQuadro = a::quadro; aoMedir = a::medida } },
            modifier = Modifier.fillMaxSize(),
        )
    }
}

/**
 * Tela espelhada (seção 5, aprovada "lateral"): o vídeo no centro, no formato dele, e o
 * trackpad por cima (modo `trackpad`: a imagem fica de fundo e o toque segue relativo, com o
 * cursor desenhado na própria imagem pelo computador).
 */
@Composable
private fun VideoCentro(modifier: Modifier, v: Peca.Video, e: EstadoTela, a: AcoesTela) {
    Box(modifier.clip(RoundedCornerShape(12.dp)).background(androidx.compose.ui.graphics.Color.Black), contentAlignment = Alignment.Center) {
        Box(Modifier.fillMaxSize().aspectRatio(v.w.toFloat() / v.h.coerceAtLeast(1), matchHeightConstraintsFirst = false)) {
            AndroidView(
                factory = { ctx ->
                    android.view.SurfaceView(ctx).apply {
                        holder.addCallback(object : android.view.SurfaceHolder.Callback {
                            override fun surfaceCreated(h: android.view.SurfaceHolder) = e.video.usar(h.surface, v.w, v.h)
                            override fun surfaceChanged(h: android.view.SurfaceHolder, f: Int, w: Int, hh: Int) {}
                            override fun surfaceDestroyed(h: android.view.SurfaceHolder) = e.video.usar(null, v.w, v.h)
                        })
                    }
                },
                modifier = Modifier.fillMaxSize().semantics { contentDescription = "Tela do computador" },
            )
        }
        if (v.modo == "trackpad") {
            AndroidView(
                factory = { ctx -> SuperficieToque(ctx).apply { aoQuadro = a::quadro; aoMedir = a::medida } },
                modifier = Modifier.fillMaxSize(),
            )
        }
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
        Modifier.fillMaxWidth().height(32.dp).semantics { contentDescription = "Conexão: $texto"; liveRegion = LiveRegionMode.Polite },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Box(Modifier.size(12.dp).clip(CircleShape).background(Tokens.ledPoco), contentAlignment = Alignment.Center) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(if (ligado) Tokens.led else Tokens.ledOff))
        }
        Spacer(Modifier.width(8.dp))
        BasicText(texto, maxLines = 1, style = TextStyle(color = Tokens.ink2, fontSize = 12.sp))
    }
}

/** Aviso de relance, no alto do centro; some sozinho (a atividade limpa). */
@Composable
private fun Aviso(texto: String) {
    Box(Modifier.fillMaxSize().padding(top = 18.dp), contentAlignment = Alignment.TopCenter) {
        Row(
            Modifier
                .clip(RoundedCornerShape(20.dp))
                .background(Tokens.modFace)
                .border(1.dp, Tokens.hairline, RoundedCornerShape(20.dp))
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .semantics { liveRegion = LiveRegionMode.Polite },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(Tokens.ambar))
            BasicText(texto, style = TextStyle(color = Tokens.ink, fontSize = 13.sp))
        }
    }
}

/** Sem pareamento: ler o QR do computador ou digitar o código. */
@Composable
private fun Parear(motivo: String, aoCodigo: (String) -> Unit, aoQr: () -> Unit) {
    var codigo by remember { mutableStateOf("") }
    Box(Modifier.fillMaxSize().background(Tokens.scrim), contentAlignment = Alignment.Center) {
        Column(
            Modifier.width(340.dp).clip(RoundedCornerShape(16.dp)).background(Tokens.modFace).padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            BasicText(
                when (motivo) {
                    "codigo" -> "Código não confere"
                    "versao" -> "Atualize o app"
                    else -> "Parear com o computador"
                },
                style = TextStyle(color = Tokens.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
            )
            BotaoGrande("qr", "Ler o QR", "Ler o QR do computador", aoQr)
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
            BotaoGrande("tick", "Parear", "Parear com o código") { if (codigo.length == 6) aoCodigo(codigo) }
        }
    }
}

@Composable
private fun BotaoGrande(icone: String, rotulo: String, descricao: String, aoTocar: () -> Unit) {
    var apertada by remember { mutableStateOf(false) }
    Row(
        Modifier
            .fillMaxWidth()
            .height(56.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (apertada) Tokens.keyFaceOn else Tokens.keyFace)
            .border(1.dp, Tokens.groove, RoundedCornerShape(10.dp))
            .semantics { contentDescription = descricao }
            .pressionavel(aoMudar = { apertada = it }, aoTocar = aoTocar),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icone(icone, 18.dp, Tokens.keyInk)
        Spacer(Modifier.width(8.dp))
        BasicText(rotulo, style = TextStyle(color = Tokens.keyInk, fontSize = 14.sp, fontWeight = FontWeight.Medium))
    }
}
