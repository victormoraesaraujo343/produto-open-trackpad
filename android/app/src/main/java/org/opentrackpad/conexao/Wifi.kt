package org.opentrackpad.conexao

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.security.MessageDigest
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.util.concurrent.ConcurrentHashMap
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.X509TrustManager

/**
 * Confia em exatamente um certificado: o que tem a impressão digital lida no QR.
 * Nenhuma autoridade, nenhum nome de host: só a impressão (o computador gera o próprio
 * certificado e o celular o fixa no pareamento).
 */
class TrustFixado(private val impressao: String) : X509TrustManager {
    override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
        val folha = chain?.firstOrNull() ?: throw CertificateException("sem certificado")
        if (!impressaoDe(folha.encoded).equals(impressao, ignoreCase = true)) {
            throw CertificateException("computador desconhecido")
        }
    }

    override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) =
        throw CertificateException("o celular não aceita conexões")

    override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
}

fun impressaoDe(der: ByteArray): String =
    MessageDigest.getInstance("SHA-256").digest(der).joinToString("") { "%02x".format(it) }

/** Abre TLS com o certificado fixado. Tenta cada endereço conhecido do computador. */
fun socketTls(hosts: List<String>, porta: Int, impressao: String): Pair<InputStream, OutputStream> {
    val ctx = SSLContext.getInstance("TLS")
    ctx.init(null, arrayOf(TrustFixado(impressao)), null)
    var ultimo: Exception? = null
    for (host in hosts.distinct()) {
        try {
            val cru = Socket()
            cru.tcpNoDelay = true
            cru.connect(InetSocketAddress(host, porta), 2_500)
            val tls = ctx.socketFactory.createSocket(cru, host, porta, true) as SSLSocket
            // TLS 1.3 onde existe (Android 10+); 1.2 no Android 9.
            tls.enabledProtocols = tls.supportedProtocols.filter { it == "TLSv1.3" || it == "TLSv1.2" }.toTypedArray()
            tls.soTimeout = 0
            tls.startHandshake()
            return tls.inputStream to tls.outputStream
        } catch (e: Exception) {
            ultimo = e
        }
    }
    throw ultimo ?: java.io.IOException("nenhum endereço")
}

/**
 * Procura computadores na rede local por mDNS (`_opentrackpad._tcp`). Guarda o endereço
 * mais recente de cada um pelos 16 primeiros hex da impressão digital (campo `fp` do TXT),
 * para reconectar mesmo quando o IP do computador muda.
 */
class Descoberta(context: Context) {
    private val nsd = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val enderecos = ConcurrentHashMap<String, String>()
    private var ouvinte: NsdManager.DiscoveryListener? = null

    fun enderecoDe(impressao: String): String? = enderecos[impressao.take(16).lowercase()]

    fun iniciar() {
        if (ouvinte != null) return
        val l = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {}
            override fun onDiscoveryStopped(serviceType: String) {}
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
            override fun onServiceLost(info: NsdServiceInfo) {}
            override fun onServiceFound(info: NsdServiceInfo) {
                // O NsdManager antigo só resolve um por vez; falha aqui só perde esta rodada.
                @Suppress("DEPRECATION")
                nsd.resolveService(info, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(i: NsdServiceInfo, errorCode: Int) {}
                    override fun onServiceResolved(i: NsdServiceInfo) {
                        val fp = i.attributes["fp"]?.let { String(it, Charsets.UTF_8) }?.lowercase() ?: return
                        @Suppress("DEPRECATION")
                        val host = i.host?.hostAddress ?: return
                        enderecos[fp] = host
                    }
                })
            }
        }
        ouvinte = l
        try {
            nsd.discoverServices("_opentrackpad._tcp", NsdManager.PROTOCOL_DNS_SD, l)
        } catch (_: Exception) {
            ouvinte = null
        }
    }

    fun parar() {
        ouvinte?.let { try { nsd.stopServiceDiscovery(it) } catch (_: Exception) {} }
        ouvinte = null
    }
}
