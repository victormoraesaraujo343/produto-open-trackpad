package org.opentrackpad

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.WindowInsets
import android.view.WindowInsetsController
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import org.json.JSONObject
import org.opentrackpad.conexao.Conexao
import org.opentrackpad.conexao.Credenciais
import org.opentrackpad.conexao.Destino
import org.opentrackpad.conexao.EstadoConexao
import org.opentrackpad.conexao.Ouvinte
import org.opentrackpad.ui.Aparelho

/**
 * Uma tela só, deitada. O que aparece nela é decidido pelo computador (spec); por
 * enquanto (onda 0) é o trackpad com as laterais e o estado da conexão.
 *
 * Para testes: `adb shell am start -n org.opentrackpad/.MainActivity --es codigo 123456`
 * pareia com o código dado (o mesmo que o QR levaria).
 */
class MainActivity : ComponentActivity() {

    private var conexao by mutableStateOf<Conexao?>(null)
    private var estado by mutableStateOf<EstadoConexao>(EstadoConexao.Desconectado)
    private var ultimoControle by mutableStateOf<JSONObject?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, false)
        telaCheia()
        conectar(intent.getStringExtra("codigo"))
        setContent {
            val c = conexao
            Aparelho(
                estado = estado,
                aoQuadro = { c?.quadro(it) },
                aoMedir = { c?.medida(it) },
                aoControle = { pares -> c?.enviarControle(*pares) },
                // Recusado não tenta de novo sozinho: recomeça com o código digitado.
                aoCodigo = { conectar(it) },
            )
        }
    }

    private fun conectar(codigo: String?) {
        conexao?.fechar()
        val aparelho = JSONObject()
            .put("nome", Build.MODEL ?: "Celular")
            .put("sistema", "android")
            .put("versao", Build.VERSION.SDK_INT)
        val c = Conexao(
            Destino("127.0.0.1"),
            aparelho,
            CredenciaisGuardadas(this),
            object : Ouvinte {
                override fun estado(e: EstadoConexao) = runOnUiThread { estado = e }
                override fun controle(m: JSONObject) = runOnUiThread { ultimoControle = m }
            },
        )
        c.codigo = codigo
        conexao = c
        c.iniciar()
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
        conexao?.fechar()
        super.onDestroy()
    }
}

/** Credenciais por computador, no armazenamento privado do app. */
class CredenciaisGuardadas(context: Context) : Credenciais {
    private val prefs = context.getSharedPreferences("computadores", Context.MODE_PRIVATE)

    override fun ler(chave: String): Pair<String, String>? {
        val id = prefs.getString("$chave.id", null) ?: return null
        val segredo = prefs.getString("$chave.segredo", null) ?: return null
        return id to segredo
    }

    override fun gravar(chave: String, id: String, segredo: String) {
        prefs.edit().putString("$chave.id", id).putString("$chave.segredo", segredo).apply()
    }

    override fun esquecer(chave: String) {
        prefs.edit().remove("$chave.id").remove("$chave.segredo").apply()
    }
}
