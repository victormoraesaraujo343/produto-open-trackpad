/* Giro relativo em passos inteiros: pegar em qualquer ponto nunca faz pular.
   `mover` recebe o ângulo atual (graus) e devolve quantos passos andou desde `comecar`. */
export function criarGiro(passosPorVolta: number) {
  const grausPorPasso = 360 / passosPorVolta
  let ultimo = 0
  let acumulado = 0
  return {
    comecar(angulo: number) { ultimo = angulo; acumulado = 0 },
    mover(angulo: number): number {
      let d = angulo - ultimo
      if (d > 180) d -= 360
      if (d < -180) d += 360
      ultimo = angulo
      acumulado += d
      return Math.trunc(acumulado / grausPorPasso)
    },
  }
}

export const anguloDe = (cx: number, cy: number, x: number, y: number) => (Math.atan2(y - cy, x - cx) * 180) / Math.PI
