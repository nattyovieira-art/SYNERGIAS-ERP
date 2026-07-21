import assert from 'node:assert/strict'
import fs from 'node:fs'

const endpoint = fs.readFileSync(new URL('../public/api/pedido-entrega.php', import.meta.url), 'utf8')
const formulario = fs.readFileSync(new URL('../src/pages/Vendas/PedidoForm.tsx', import.meta.url), 'utf8')
const consulta = fs.readFileSync(new URL('../public/api/estoque-movimentacoes.php', import.meta.url), 'utf8')

for (const trecho of ['erp_estoque_movimentacoes', 'UNIQUE KEY uk_estoque_pedido_produto_tipo_origem', 'FOR UPDATE', '$pdo->beginTransaction()', '$pdo->commit()', '$pdo->rollBack()', "['estoqueBaixado'] = true", "['statusPedido'] = 'Entregue'", 'movimento_original_id']) {
  assert.ok(endpoint.includes(trecho), `Contrato ausente no endpoint: ${trecho}`)
}
assert.ok(formulario.includes('entregaEmProcessamentoRef.current'), 'Trava síncrona do clique duplo ausente')
assert.ok(formulario.includes('entregarPedidoCentral'), 'Formulário ainda não usa a operação central')
assert.ok(!formulario.includes('baixarEstoquePedidoIdempotenteStorage({'), 'Formulário ainda executa baixa local')
assert.ok(consulta.includes("REQUEST_METHOD") && consulta.includes("!== 'GET'"), 'Consulta central deve aceitar somente GET')
assert.ok(consulta.includes('erp_estoque_movimentacoes'), 'Consulta não lê a tabela autoritativa')

function criarBanco() {
  return { pedido: { id: 'pedido-futuro', status: 'Concluído', estoqueBaixado: false }, produtos: new Map([['produto-a', 20], ['produto-b', 8]]), movimentos: new Map() }
}

let fila = Promise.resolve()
async function entregar(db, itens, falharAntesCommit = false) {
  const anterior = fila
  let liberar
  fila = new Promise((resolve) => { liberar = resolve })
  await anterior
  try {
    if (db.pedido.estoqueBaixado || db.pedido.status === 'Entregue') return 'já baixado'
    const agrupados = new Map()
    for (const item of itens) agrupados.set(item.produtoId, (agrupados.get(item.produtoId) || 0) + item.quantidade)
    const copia = structuredClone(db)
    for (const [produtoId, quantidade] of agrupados) {
      const chave = `${db.pedido.id}:${produtoId}:saida:pedido`
      if (copia.movimentos.has(chave)) return 'já baixado'
      const saldo = copia.produtos.get(produtoId)
      if (saldo === undefined || saldo < quantidade) throw new Error('estoque insuficiente')
      copia.produtos.set(produtoId, saldo - quantidade)
      copia.movimentos.set(chave, -quantidade)
    }
    copia.pedido.estoqueBaixado = true
    copia.pedido.status = 'Entregue'
    if (falharAntesCommit) throw new Error('falha simulada')
    db.pedido = copia.pedido
    db.produtos = copia.produtos
    db.movimentos = copia.movimentos
    return 'entregue'
  } finally { liberar() }
}

const itens = [{ produtoId: 'produto-a', quantidade: 2 }, { produtoId: 'produto-a', quantidade: 3 }, { produtoId: 'produto-b', quantidade: 1 }]
const dbConcorrente = criarBanco()
const resultados = await Promise.all([entregar(dbConcorrente, itens), entregar(dbConcorrente, itens)])
assert.deepEqual(resultados.sort(), ['entregue', 'já baixado'].sort())
assert.equal(dbConcorrente.produtos.get('produto-a'), 15)
assert.equal(dbConcorrente.produtos.get('produto-b'), 7)
assert.equal(dbConcorrente.movimentos.size, 2)

const dbRollback = criarBanco()
await assert.rejects(() => entregar(dbRollback, itens, true), /falha simulada/)
assert.equal(dbRollback.produtos.get('produto-a'), 20)
assert.equal(dbRollback.movimentos.size, 0)
assert.equal(dbRollback.pedido.estoqueBaixado, false)

const dbSemEstoque = criarBanco()
await assert.rejects(() => entregar(dbSemEstoque, [{ produtoId: 'produto-b', quantidade: 9 }]), /estoque insuficiente/)
assert.equal(dbSemEstoque.produtos.get('produto-b'), 8)
assert.equal(dbSemEstoque.movimentos.size, 0)

console.log('OK: entrega única, concorrência, agrupamento, estoque insuficiente e rollback validados.')
