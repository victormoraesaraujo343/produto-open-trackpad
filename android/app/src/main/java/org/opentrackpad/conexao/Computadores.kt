package org.opentrackpad.conexao

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Um computador pareado. A chave é a impressão digital do certificado dele. */
data class Computador(
    val fp: String,
    val nome: String,
    val hosts: List<String>,
    val porta: Int,
    val id: String,
    val segredo: String,
)

/**
 * Os computadores de confiança, no armazenamento privado do app (spec: "aparelhos de
 * confiança" e "um celular, vários computadores").
 *
 * Pareando pelo cabo, o celular ainda não sabe a impressão digital: a credencial fica
 * sob a chave `cabo` até a mensagem `computador` chegar, e então passa para a impressão.
 * O cabo usa sempre o último computador conectado.
 */
class Computadores(private val armazem: Armazem) : Credenciais {

    /** Onde o texto é guardado (SharedPreferences no app, mapa nos testes). */
    interface Armazem {
        fun ler(chave: String): String?
        fun gravar(chave: String, valor: String?)
    }

    private fun todos(): MutableMap<String, JSONObject> {
        val m = LinkedHashMap<String, JSONObject>()
        val arr = armazem.ler("computadores")?.let { runCatching { JSONArray(it) }.getOrNull() } ?: JSONArray()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            m[o.optString("chave")] = o
        }
        return m
    }

    private fun salvar(m: Map<String, JSONObject>) = armazem.gravar("computadores", JSONArray(m.values.toList()).toString())

    fun lista(): List<Computador> = todos().values.filter { it.optString("chave") != CABO }.map(::paraComputador)

    fun ultimo(): Computador? = armazem.ler("ultimo")?.let { todos()[it] }?.let(::paraComputador)

    /** Chave a usar no cabo: o último computador, ou a chave provisória. */
    fun chaveDoCabo(): String = armazem.ler("ultimo")?.takeIf { todos().containsKey(it) } ?: CABO

    override fun ler(chave: String): Pair<String, String>? {
        val o = todos()[chave] ?: return null
        val id = o.optString("id").ifEmpty { return null }
        val segredo = o.optString("segredo").ifEmpty { return null }
        return id to segredo
    }

    override fun gravar(chave: String, id: String, segredo: String) {
        val m = todos()
        val o = m[chave] ?: JSONObject().put("chave", chave)
        o.put("id", id).put("segredo", segredo)
        m[chave] = o
        salvar(m)
    }

    override fun esquecer(chave: String) {
        val m = todos()
        m.remove(chave)
        salvar(m)
        if (armazem.ler("ultimo") == chave) armazem.gravar("ultimo", null)
    }

    /**
     * Chegou `{"t":"computador",...}` numa conexão aberta com a credencial de [chaveUsada]:
     * guarda o computador pela impressão digital, com os endereços do Wi-Fi.
     */
    fun conhecer(chaveUsada: String, msg: JSONObject, nome: String) {
        val fp = msg.optString("fp").lowercase()
        if (fp.length != 64) return
        val m = todos()
        val antigo = m[chaveUsada] ?: m[fp] ?: return
        val wifi = msg.optJSONObject("wifi")
        val o = JSONObject()
            .put("chave", fp)
            .put("id", antigo.optString("id"))
            .put("segredo", antigo.optString("segredo"))
            .put("nome", nome.take(60))
            .put("porta", wifi?.optInt("porta", 47801) ?: 47801)
            .put("hosts", wifi?.optJSONArray("hosts") ?: JSONArray())
        if (chaveUsada != fp) m.remove(chaveUsada)
        m[fp] = o
        salvar(m)
        armazem.gravar("ultimo", fp)
    }

    private fun paraComputador(o: JSONObject): Computador {
        val hosts = o.optJSONArray("hosts")?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList()
        return Computador(o.optString("chave"), o.optString("nome"), hosts, o.optInt("porta", 47801), o.optString("id"), o.optString("segredo"))
    }

    companion object {
        const val CABO = "cabo"

        fun doApp(context: Context): Computadores {
            val prefs = context.getSharedPreferences("computadores", Context.MODE_PRIVATE)
            return Computadores(object : Armazem {
                override fun ler(chave: String) = prefs.getString(chave, null)
                override fun gravar(chave: String, valor: String?) {
                    prefs.edit().apply { if (valor == null) remove(chave) else putString(chave, valor) }.apply()
                }
            })
        }
    }
}
