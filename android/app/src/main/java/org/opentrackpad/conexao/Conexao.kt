package org.opentrackpad.conexao

import org.json.JSONObject
import org.opentrackpad.protocolo.Mensagem
import org.opentrackpad.protocolo.Protocolo
import org.opentrackpad.protocolo.codificar
import org.opentrackpad.protocolo.controle
import org.opentrackpad.protocolo.ler
import org.opentrackpad.toque.FilaDeQuadros
import org.opentrackpad.toque.MedidaSuperficie
import org.opentrackpad.toque.Quadro
import java.io.BufferedInputStream
import java.io.Closeable
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.util.ArrayDeque
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.thread
import kotlin.concurrent.withLock

/** Como chegar num computador. */
data class Destino(
    val host: String,
    val porta: Int = Protocolo.PORTA,
    /** `cabo` (adb reverse, sem TLS, só 127.0.0.1) ou `wifi` (TLS com impressão digital fixada). */
    val via: String = "cabo",
    /** SHA-256 do certificado do computador, em hex (Wi-Fi). */
    val impressao: String? = null,
) {
    /** Chave para guardar as credenciais deste computador. */
    val chave: String get() = impressao ?: "cabo"
}

sealed class EstadoConexao {
    data object Desconectado : EstadoConexao()
    data object Conectando : EstadoConexao()
    data class Aberta(val computador: String, val sistema: String, val nivel: Int, val via: String) : EstadoConexao()
    data class Recusado(val motivo: String) : EstadoConexao()
}

/** Quem usa a conexão (a tela). Chamado fora da thread principal. */
interface Ouvinte {
    fun estado(e: EstadoConexao)
    fun controle(m: JSONObject) {}
}

/** Guarda o que o computador entregou no primeiro pareamento. */
interface Credenciais {
    fun ler(chave: String): Pair<String, String>?
    fun gravar(chave: String, id: String, segredo: String)
    fun esquecer(chave: String)
}

/**
 * Uma conexão com um computador: uma thread lê, outra escreve.
 *
 * A escrita dá prioridade ao controle (botões, teclas) e depois manda os quadros de
 * toque, juntando movimento se o socket atrasar (ver [FilaDeQuadros]). O celular manda
 * PING a cada 3 s; o computador solta tudo se ficar 15 s sem notícia.
 */
class Conexao(
    private val destino: Destino,
    private val aparelho: JSONObject,
    private val credenciais: Credenciais,
    private val ouvinte: Ouvinte,
    /** Abre o socket; trocado por TLS no Wi-Fi e por um falso nos testes. */
    private val abrirSocket: (Destino) -> Pair<InputStream, OutputStream> = ::socketPuro,
) : Closeable {

    private val trava = ReentrantLock()
    private val temAlgo = trava.newCondition()
    private val controles = ArrayDeque<Mensagem>()
    private val quadros = FilaDeQuadros()
    private var seq = 0L
    private var saida: OutputStream? = null
    private var entrada: InputStream? = null

    @Volatile private var fechada = false
    @Volatile private var aberta = false
    @Volatile var estado: EstadoConexao = EstadoConexao.Desconectado
        private set

    /** Medida mais recente da superfície; reenviada a cada abertura. */
    @Volatile private var superficie: MedidaSuperficie? = null

    /** Código do QR, usado só se não houver credencial guardada. */
    @Volatile var codigo: String? = null

    fun iniciar() {
        thread(name = "otp-conexao", isDaemon = true) { laco() }
    }

    private fun mudar(e: EstadoConexao) {
        estado = e
        ouvinte.estado(e)
    }

    /** Conecta, e reconecta sozinho enquanto não for fechada nem recusada. */
    private fun laco() {
        var espera = 500L
        while (!fechada) {
            mudar(EstadoConexao.Conectando)
            val recusado = try {
                sessao()
            } catch (e: Exception) {
                false
            } finally {
                aberta = false
                trava.withLock { controles.clear(); quadros.limpar(); temAlgo.signalAll() }
                try { saida?.close() } catch (_: Exception) {}
                try { entrada?.close() } catch (_: Exception) {}
            }
            if (recusado || fechada) return
            mudar(EstadoConexao.Desconectado)
            Thread.sleep(espera)
            espera = (espera * 2).coerceAtMost(5_000)
        }
    }

    /** Uma sessão inteira. Devolve `true` se o computador recusou (não adianta tentar de novo). */
    private fun sessao(): Boolean {
        val (ent, sai) = abrirSocket(destino)
        entrada = BufferedInputStream(ent)
        saida = sai

        val ola = JSONObject().put("t", "ola").put("v", Protocolo.VERSAO).put("app", "0.3.0").put("aparelho", aparelho)
        val guardada = credenciais.ler(destino.chave)
        val pareamento = when {
            guardada != null -> JSONObject().put("id", guardada.first).put("segredo", guardada.second)
            codigo != null -> JSONObject().put("codigo", codigo)
            else -> {
                mudar(EstadoConexao.Recusado("sem_codigo"))
                return true
            }
        }
        ola.put("pareamento", pareamento)
        escreverAgora(Mensagem.Controle(ola))

        val resposta = ler(entrada!!) as? Mensagem.Controle ?: return false
        if (resposta.t == "recusado") {
            val motivo = resposta.json.optString("motivo")
            // Credencial velha (o computador esqueceu o aparelho): apaga para parear de novo.
            if (motivo == "desconhecido") credenciais.esquecer(destino.chave)
            mudar(EstadoConexao.Recusado(motivo))
            return true
        }
        if (resposta.t != "bemvindo") return false
        val b = resposta.json
        if (b.has("segredo")) credenciais.gravar(destino.chave, b.getString("aparelho_id"), b.getString("segredo"))
        codigo = null
        val comp = b.optJSONObject("computador") ?: JSONObject()
        mudar(EstadoConexao.Aberta(comp.optString("nome"), comp.optString("sistema"), 1, destino.via))
        aberta = true

        superficie?.let { enviarSuperficie(it) }
        val escritor = thread(name = "otp-escrita", isDaemon = true) { escrever() }
        val ping = thread(name = "otp-ping", isDaemon = true) {
            var n = 0L
            while (aberta && !fechada) {
                enviar(Mensagem.Ping(n++, System.nanoTime() / 1000))
                try { Thread.sleep(3_000) } catch (_: InterruptedException) { return@thread }
            }
        }
        try {
            while (!fechada) {
                val m = ler(entrada!!) ?: break
                receber(m)
            }
        } finally {
            aberta = false
            trava.withLock { temAlgo.signalAll() }
            ping.interrupt()
            escritor.join(500)
        }
        return false
    }

    private fun receber(m: Mensagem) {
        when (m) {
            is Mensagem.Ping -> enviar(Mensagem.Pong(m.nonce, m.tUs))
            is Mensagem.Controle -> {
                when (m.t) {
                    "nivel" -> {
                        val atual = estado
                        if (atual is EstadoConexao.Aberta) {
                            mudar(atual.copy(nivel = m.json.optInt("n", 1), via = m.json.optString("via", atual.via)))
                        }
                    }
                    "medir" -> {
                        // Manda a quantidade pedida em pedaços, para o computador medir a vazão.
                        var falta = m.json.optInt("bytes", 0).coerceIn(0, 4 * 1024 * 1024)
                        while (falta > 0) {
                            val n = falta.coerceAtMost(32 * 1024)
                            enviar(Mensagem.Carga(ByteArray(n)))
                            falta -= n
                        }
                    }
                    "tchau" -> fechar()
                }
                ouvinte.controle(m.json)
            }
            else -> {}
        }
    }

    private fun escrever() {
        while (aberta && !fechada) {
            val m: Mensagem = trava.withLock {
                while (aberta && !fechada && controles.isEmpty() && quadros.tamanho == 0) temAlgo.await()
                if (!aberta || fechada) return
                controles.pollFirst() ?: quadros.tirar()!!.let { Mensagem.Toque(++seq and 0xFFFFFFFFL, it.contatos) }
            }
            try {
                escreverAgora(m)
            } catch (_: Exception) {
                try { entrada?.close() } catch (_: Exception) {}
                return
            }
        }
    }

    private val travaEscrita = Any()

    /** Escreve já (várias threads chegam aqui: abertura, escritor, `fechar`). */
    private fun escreverAgora(m: Mensagem) {
        val bytes = codificar(m)
        synchronized(travaEscrita) {
            val s = saida ?: return
            s.write(bytes)
            s.flush()
        }
    }

    /** Mensagem de controle (ou PING/PONG/CARGA). Ignorada se não estiver aberta. */
    fun enviar(m: Mensagem) {
        if (!aberta) return
        trava.withLock {
            controles.addLast(m)
            temAlgo.signal()
        }
    }

    fun enviarControle(vararg pares: Pair<String, Any?>) = enviar(controle(*pares))

    fun quadro(q: Quadro) {
        if (!aberta) return
        trava.withLock {
            quadros.adicionar(q)
            temAlgo.signal()
        }
    }

    fun medida(m: MedidaSuperficie) {
        superficie = m
        if (aberta) enviarSuperficie(m)
    }

    private fun enviarSuperficie(m: MedidaSuperficie) {
        enviarControle("t" to "superficie", "w" to m.wPx, "h" to m.hPx, "w_um" to m.wUm, "h_um" to m.hUm, "max" to Protocolo.MAX_CONTATOS)
    }

    override fun close() = fechar()

    fun fechar() {
        if (fechada) return
        if (aberta) {
            try { escreverAgora(controle("t" to "tchau")) } catch (_: Exception) {}
        }
        fechada = true
        aberta = false
        trava.withLock { temAlgo.signalAll() }
        try { entrada?.close() } catch (_: Exception) {}
        try { saida?.close() } catch (_: Exception) {}
        mudar(EstadoConexao.Desconectado)
    }
}

/** Socket TCP sem TLS: só para 127.0.0.1 (cabo, via `adb reverse`). */
fun socketPuro(d: Destino): Pair<InputStream, OutputStream> {
    require(d.via == "cabo" && (d.host == "127.0.0.1" || d.host == "localhost")) { "sem TLS só no cabo" }
    val s = Socket()
    s.tcpNoDelay = true
    s.connect(InetSocketAddress(d.host, d.porta), 3_000)
    return s.getInputStream() to s.getOutputStream()
}
