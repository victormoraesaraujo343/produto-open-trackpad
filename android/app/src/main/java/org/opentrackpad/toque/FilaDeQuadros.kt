package org.opentrackpad.toque

import org.opentrackpad.protocolo.Contato
import java.util.ArrayDeque

/** Retrato dos dedos na superfície. `critico` = mudou quais dedos existem. */
data class Quadro(val contatos: List<Contato>, val critico: Boolean)

/**
 * Quadros esperando o socket, e o que descartar quando chegam mais rápido do que saem.
 *
 * A regra que importa: quadro que mudou *quais dedos existem* nunca é descartado nem
 * reordenado (o computador acharia que um dedo que saiu ainda está em baixo). Movimento
 * puro pode sair: cada quadro é um retrato completo e o mais novo vale pelo anterior.
 * Portado da v0.2 (`FrameQueue`). Não é thread-safe; quem chama segura a trava.
 */
class FilaDeQuadros(
    /** Acima disso o movimento passa a ser juntado (quem envia não está dando conta). */
    private val juntarAcima: Int = 8,
    /** Teto, para um socket travado não esgotar a memória. */
    private val maximo: Int = 128,
) {
    private val fila = ArrayDeque<Quadro>()

    val tamanho: Int get() = fila.size

    fun adicionar(q: Quadro) {
        val ultimo = fila.peekLast()
        if (!q.critico && ultimo != null && !ultimo.critico && fila.size >= juntarAcima) {
            fila.removeLast()
            fila.addLast(q)
            return
        }
        if (fila.size >= maximo) descartarMovimentoMaisAntigo()
        fila.addLast(q)
    }

    fun tirar(): Quadro? = fila.pollFirst()

    fun limpar() = fila.clear()

    private fun descartarMovimentoMaisAntigo() {
        val it = fila.iterator()
        while (it.hasNext()) {
            if (!it.next().critico) {
                it.remove()
                return
            }
        }
        fila.pollFirst()
    }
}
