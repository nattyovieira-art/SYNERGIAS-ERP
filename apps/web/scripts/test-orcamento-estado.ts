import assert from 'node:assert/strict'
import { determinarEstadoRealOrcamento, normalizarNovoOrcamentoImportado } from '../src/services/orcamentoEstado.ts'

const aberto = { id: 'i-2480', tipo: 'Orçamento', numeroOrcamento: '2480', status: 'ABERTO', statusOrcamento: 'Aberto', itens: [{}] }
const manual = { ...aberto, id: 'manual', numeroOrcamento: '3000' }
const aprovado = { ...manual, id: 'aprovado', numeroOrcamento: '3001', statusOrcamento: 'Aprovado' }
const reprovado = { ...manual, id: 'reprovado', numeroOrcamento: '3002', statusOrcamento: 'Reprovado' }
const legado = { ...aberto, numeroPedido: '9999', pedidoId: 'fantasma', pedidoGeradoId: 'fantasma', convertido: true, pedidoGerado: true }
const pedido = { id: 'pedido-real', tipo: 'Pedido', numeroPedido: '4000', orcamentoOrigemId: aberto.id, orcamentoOrigemNumero: aberto.numeroOrcamento }

assert.equal(determinarEstadoRealOrcamento(aberto, [aberto]).podeAprovar, true)
assert.equal(determinarEstadoRealOrcamento(manual, [manual]).podeEditar, true)
assert.equal(determinarEstadoRealOrcamento(aprovado, [aprovado]).podeGerarPedido, true)
assert.equal(determinarEstadoRealOrcamento(reprovado, [reprovado]).podeGerarPedido, false)
assert.equal(determinarEstadoRealOrcamento(aberto, [aberto, pedido]).convertido, true)
assert.equal(determinarEstadoRealOrcamento(aberto, [aberto, { ...pedido, orcamentoOrigemId: '', orcamentoOrigemNumero: '2480' }]).convertido, false)
assert.equal(determinarEstadoRealOrcamento(aberto, [aberto, { ...pedido, tipo: 'Orçamento/Pedido' }]).convertido, false)
assert.equal(determinarEstadoRealOrcamento(legado, [legado]).podeAprovar, true)
const importado = normalizarNovoOrcamentoImportado({ ...legado, origem: 'IMPORTACAO' } as typeof legado & { origem: string })
assert.equal(importado.numeroOrcamento, '2480')
assert.equal(importado.numeroPedido, undefined)
assert.equal(importado.pedidoGeradoId, undefined)
assert.equal(importado.statusOrcamento, 'Aberto')
assert.equal(determinarEstadoRealOrcamento(importado, [importado]).podeReprovar, true)
console.log('test-orcamento-estado: OK')
