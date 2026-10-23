package org.opentrackpad.ponte

import android.content.pm.PackageManager
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import java.util.ArrayDeque

/**
 * Pedidos de permissão do Android, um de cada vez (o diálogo do sistema não empilha). Os
 * módulos (câmera, microfone) recebem a resposta por uma função e não conhecem a Activity.
 * Precisa ser criado enquanto a Activity é construída (registra o pedido no sistema).
 */
class Permissoes(private val atividade: ComponentActivity) {
    private class Pedido(val permissao: String, val resposta: (Boolean) -> Unit)

    private val fila = ArrayDeque<Pedido>()
    private var emCurso: Pedido? = null

    private val lancador = atividade.registerForActivityResult(ActivityResultContracts.RequestPermission()) { concedida ->
        val atual = emCurso
        emCurso = null
        atual?.resposta?.invoke(concedida)
        proximo()
    }

    /** Pede a permissão; `resposta` roda na thread principal (na hora, se já estiver concedida). */
    fun pedir(permissao: String, resposta: (Boolean) -> Unit) {
        fila.addLast(Pedido(permissao, resposta))
        if (emCurso == null) proximo()
    }

    private fun proximo() {
        if (emCurso != null) return
        while (true) {
            val pedido = fila.pollFirst() ?: return
            if (ContextCompat.checkSelfPermission(atividade, pedido.permissao) == PackageManager.PERMISSION_GRANTED) {
                pedido.resposta(true)
                continue
            }
            emCurso = pedido
            lancador.launch(pedido.permissao)
            return
        }
    }
}
