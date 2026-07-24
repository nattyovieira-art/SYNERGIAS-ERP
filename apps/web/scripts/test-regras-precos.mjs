import { readFileSync } from 'node:fs'

const formulario = readFileSync(new URL('../src/pages/Produtos/ProdutoForm.tsx', import.meta.url), 'utf8')
const storage = readFileSync(new URL('../src/services/produtosStorage.ts', import.meta.url), 'utf8')

const verificacoes = [
  ['preco minimo e custo mais 30%', formulario.includes('custo * 1.3') && storage.includes('custo * 1.3')],
  ['varejo e atacado manuais respeitam o minimo', (formulario.match(/const vendaProtegida = garantirPrecoMinimo\(valor, custo\)/g) || []).length >= 2],
  ['margens nunca ficam abaixo de 30%', (formulario.match(/Math\.max\(30,/g) || []).length >= 5],
  ['storage protege varejo e atacado', storage.includes('Math.max(vendaVarejoInformada, precoMinimo)') && storage.includes('Math.max(numeroSeguro(produto?.vendaAtacado), precoMinimo)')],
]

const falhas = verificacoes.filter(([, passou]) => !passou)
for (const [regra, passou] of verificacoes) console.log(`${passou ? 'OK' : 'FALHA'} - ${regra}`)
if (falhas.length) {
  console.error('\nRegras permanentes de precos foram alteradas. Publicacao bloqueada.')
  process.exit(1)
}
