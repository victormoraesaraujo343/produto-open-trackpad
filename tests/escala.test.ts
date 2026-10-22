import { escalaDaMoldura } from '../src/design/escala'

test('cabe inteiro numa tela larga', () => expect(escalaDaMoldura({ largura: 1560, altura: 900 })).toBeCloseTo(1.6))
test('encolhe para caber em 390 de largura', () => expect(escalaDaMoldura({ largura: 390, altura: 844 })).toBeCloseTo(0.5))
test('a altura também limita', () => expect(escalaDaMoldura({ largura: 2000, altura: 180 })).toBeCloseTo(0.5))
