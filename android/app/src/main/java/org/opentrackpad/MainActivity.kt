package org.opentrackpad

import android.content.ClipData
import android.content.ClipboardManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import org.json.JSONObject
import org.opentrackpad.protocolo.cortarParaCelular
import org.opentrackpad.conexao.Aberto
import org.opentrackpad.conexao.Computadores
import org.opentrackpad.conexao.Conexao
import org.opentrackpad.conexao.ConviteQr
import org.opentrackpad.conexao.Descoberta
import org.opentrackpad.conexao.EstadoConexao
import org.opentrackpad.conexao.Ouvinte
import org.opentrackpad.conexao.socketDoCabo
import org.opentrackpad.conexao.lerConvite
import org.opentrackpad.conexao.socketTls
import org.opentrackpad.toque.MedidaSuperficie
import org.opentrackpad.toque.Quadro
import org.opentrackpad.ui.AcoesTela
import org.opentrackpad.ui.Aparelho
import org.opentrackpad.ui.EstadoTela
import org.opentrackpad.ui.ModoApp
import org.opentrackpad.ui.pecas.aplicarEstado
import org.opentrackpad.ui.pecas.lerLaterais
import org.opentrackpad.ui.pecas.lerTela

/**
 * Uma tela só, deitada. O que aparece nela é decidido pelo computador (spec): ele manda
 * os modos, as laterais e as telas; o app desenha e devolve toques e ações.
 *
 * Conexão: tenta o cabo (`adb reverse`, 127.0.0.1) e depois o Wi-Fi do último computador
 * (endereços guardados + o que a descoberta mDNS achou), sempre com o certificado fixado.
 *
 * Para testes: `adb shell am start -n org.opentrackpad/.MainActivity --es codigo 123456`
 * pareia pelo cabo com o código dado; `--es convite 'otp1:?h=…'` faz o mesmo que ler o QR.
 */
class MainActivity : ComponentActivity() {

    private val tela = EstadoTela()
    private lateinit var computadores: Computadores
    private lateinit var descoberta: Descoberta
    private lateinit var conexao: Conexao
    private val principal = Handler(Looper.getMainLooper())

    /** Convite lido no QR e ainda não usado (Wi-Fi de um computador novo). */
    @Volatile private var convite: ConviteQr? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, false)
        telaCheia()
        computadores = Computadores.doApp(this)
        descoberta = Descoberta(this).also { it.iniciar() }

        val aparelho = JSONObject()
            .put("nome", Build.MODEL ?: "Celular")
            .put("sistema", "android")
            .put("versao", Build.VERSION.SDK_INT)
        conexao = Conexao(aparelho, computadores, ouvinte, ::abrirMelhorCaminho)
        conexao.codigo = intent.getStringExtra("codigo")
        intent.getStringExtra("convite")?.let(::lerConvite)?.let { acoes.convite(it) }
        conexao.iniciar()

        setContent { Aparelho(tela, acoes) }
    }

    /** Cabo primeiro (mais rápido e sem rede); depois o Wi-Fi do computador do QR ou do último. */
    private fun abrirMelhorCaminho(): Aberto {
        try {
            val (e, s) = socketDoCabo()
            return Aberto(e, s, computadores.chaveDoCabo(), "cabo")
        } catch (_: Exception) {
        }
        val c = convite
        if (c?.impressao != null && c.porta != null && c.hosts.isNotEmpty()) {
            val (e, s) = socketTls(c.hosts, c.porta, c.impressao)
            return Aberto(e, s, c.impressao, "wifi")
        }
        val pc = computadores.ultimo() ?: throw java.io.IOException("nenhum computador")
        val hosts = listOfNotNull(descoberta.enderecoDe(pc.fp)) + pc.hosts
        val (e, s) = socketTls(hosts, pc.porta, pc.fp)
        return Aberto(e, s, pc.fp, "wifi")
    }

    private val ouvinte = object : Ouvinte {
        override fun estado(e: EstadoConexao) {
            principal.post {
                val antes = tela.conexao
                tela.conexao = e
                // Tela acesa só enquanto conectado (o descanso também depende da conexão).
                manterTela(e is EstadoConexao.Aberta)
                if (e is EstadoConexao.Aberta) {
                    convite = null
                    // Conexão piorou: o que é pesado sai e volta o trackpad, com aviso (spec: sem susto).
                    val modo = tela.modos.firstOrNull { it.id == tela.modo }
                    if (modo != null && modo.nivel > e.nivel) {
                        tela.modo = "trackpad"
                        avisar("Conexão fraca: de volta ao trackpad")
                    }
                } else if (antes is EstadoConexao.Aberta) {
                    tela.laterais = null
                }
            }
        }

        override fun controle(m: JSONObject) {
            principal.post { receber(m) }
        }
    }

    private fun receber(m: JSONObject) {
        when (m.optString("t")) {
            "laterais" -> tela.laterais = lerLaterais(m)
            "telas" -> {
                val lista = m.optJSONArray("lista") ?: return
                tela.modos = (0 until lista.length()).mapNotNull { i ->
                    val o = lista.optJSONObject(i) ?: return@mapNotNull null
                    ModoApp(o.optString("id"), o.optString("nome"), o.optString("icone"), o.optString("grupo", "Controlar"), o.optInt("nivel", 1))
                }
            }
            "tela" -> tela.telaDescrita = lerTela(m)
            // Só troca os campos que vieram, e só se for a tela que está aberta.
            "estado" -> tela.telaDescrita?.let { tela.telaDescrita = aplicarEstado(it, m) }
            "area_transferencia" -> {
                copiarParaCelular(m.optString("s"))
                avisar("Copiado do computador")
            }
            "aviso" -> avisar(m.optString("texto"))
            "vibrar" -> window.decorView.performHapticFeedback(android.view.HapticFeedbackConstants.CONTEXT_CLICK)
            "computador" -> {
                val chave = conexao.chaveAtual ?: return
                val nome = (tela.conexao as? EstadoConexao.Aberta)?.computador ?: ""
                computadores.conhecer(chave, m, nome)
            }
        }
    }

    /** Põe o texto do computador na área de transferência do celular. */
    private fun copiarParaCelular(s: String) {
        getSystemService(ClipboardManager::class.java)?.setPrimaryClip(ClipData.newPlainText("OpenTrackpad", s))
    }

    /**
     * Ações do próprio celular (ids `celular:`). Hoje só `celular:enviar`: manda o que está
     * copiado no celular para a área de transferência do computador.
     */
    private fun acaoDoCelular(id: String) {
        if (id != "celular:enviar") return
        val clip = try {
            getSystemService(ClipboardManager::class.java)?.primaryClip
        } catch (_: SecurityException) {
            null
        }
        val texto = if (clip != null && clip.itemCount > 0) clip.getItemAt(0).coerceToText(this).toString() else ""
        if (texto.isEmpty()) {
            avisar("Nada copiado no celular")
            return
        }
        val (parte, cortou) = cortarParaCelular(texto)
        conexao.enviarControle("t" to "area_transferencia", "s" to parte)
        if (cortou) avisar("Texto grande: enviei o começo")
    }

    /** Tela acesa só enquanto conectado. */
    private fun manterTela(sim: Boolean) {
        if (sim) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun avisar(texto: String) {
        tela.aviso = texto
        principal.removeCallbacks(limparAviso)
        principal.postDelayed(limparAviso, 2_600)
    }

    private val limparAviso = Runnable { tela.aviso = null }

    private val acoes = object : AcoesTela {
        override fun quadro(q: Quadro) {
            // Quadro do trackpad também conta como atividade (a SuperficieToque não passa pelo Compose).
            tela.tocou()
            conexao.quadro(q)
        }
        override fun medida(m: MedidaSuperficie) = conexao.medida(m)
        override fun acao(id: String, valor: Double?) {
            // Ações `celular:` são do próprio celular: não vão para o computador.
            if (id.startsWith("celular:")) {
                acaoDoCelular(id)
                return
            }
            if (valor == null) conexao.enviarControle("t" to "acao", "id" to id)
            else conexao.enviarControle("t" to "acao", "id" to id, "valor" to valor)
        }
        override fun tecla(k: String, acao: String) = conexao.enviarControle("t" to "tecla", "k" to k, "acao" to acao)
        override fun botao(b: String) = conexao.enviarControle("t" to "botao", "b" to b, "acao" to "clica")
        override fun texto(s: String) = conexao.enviarControle("t" to "texto", "s" to s)
        override fun escolherModo(m: ModoApp) {
            tela.modo = m.id
            // Sempre avisa o computador (ele só atualiza o que está na tela); trackpad e
            // teclado são desenhados pelo próprio celular, o resto o computador descreve.
            conexao.enviarControle("t" to "abrir", "tela" to m.id)
        }
        override fun travar(sim: Boolean) = travarNoApp(sim)
        override fun codigo(c: String) { conexao.codigo = c }
        override fun convite(c: ConviteQr) {
            convite = c
            conexao.codigo = c.codigo
        }
    }

    /**
     * Modo travado (seção 13): o celular não sai do app. Usa a fixação de tela do Android,
     * que o próprio sistema confirma na primeira vez.
     */
    private fun travarNoApp(sim: Boolean) {
        tela.travado = sim
        try {
            if (sim) startLockTask() else stopLockTask()
        } catch (_: Exception) {
        }
        avisar(if (sim) "Travado" else "Destravado")
    }

    /** Botões de volume do celular mudam o volume do computador (com o app aberto). */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (tela.conexao is EstadoConexao.Aberta) {
            when (keyCode) {
                KeyEvent.KEYCODE_VOLUME_UP -> { acoes.tecla("volume_mais", "toca"); return true }
                KeyEvent.KEYCODE_VOLUME_DOWN -> { acoes.tecla("volume_menos", "toca"); return true }
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun telaCheia() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    android.view.View.SYSTEM_UI_FLAG_FULLSCREEN or
                    android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    // Sem estes dois a janela não ocupa o lugar da barra de navegação escondida.
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                )
        }
    }

    // No Android 9 o modo tela cheia some quando a janela perde o foco (teclado, avisos).
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) telaCheia()
    }

    override fun onDestroy() {
        conexao.fechar()
        descoberta.parar()
        super.onDestroy()
    }
}
