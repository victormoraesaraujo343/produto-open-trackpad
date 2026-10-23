package org.opentrackpad.ui.pecas

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import org.opentrackpad.ui.Tokens

/**
 * Lateral do aparelho com peças descritas pelo computador. De cima para baixo: cabeça (ex.:
 * indicador de conexão), `extraTopo` (tecla de modos), as peças dividindo a altura por igual
 * (cada uma com pelo menos 48 dp) e `extraBase` (tecla do modo atual). Quem chama dá a
 * largura e a altura (`modifier`).
 */
@Composable
fun LateralDescrita(
    pecas: List<Peca>,
    eventos: EventosPeca,
    cabeca: @Composable () -> Unit = {},
    extraTopo: @Composable () -> Unit = {},
    extraBase: @Composable () -> Unit = {},
    modifier: Modifier,
) {
    Column(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(Tokens.wellFace)
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        cabeca()
        extraTopo()
        Column(Modifier.fillMaxWidth().weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            pecas.forEach { peca ->
                Box(Modifier.fillMaxWidth().weight(1f).heightIn(min = 48.dp)) {
                    DesenharPeca(peca, eventos, Modifier.fillMaxSize())
                }
            }
        }
        extraBase()
    }
}
