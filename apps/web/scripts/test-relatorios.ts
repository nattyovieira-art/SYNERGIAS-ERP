import assert from 'node:assert/strict'
import { consolidarPedidosRelatorios, consolidarVendasRelatorios } from '../src/services/relatoriosData.ts'
import type { Venda } from '../src/types/Venda.ts'

const base = (parcial: Partial<Venda>): Venda => ({
  id: 'base', tipo: 'Pedido', numeroPedido: '1', dataEmissao: '2026-07-01', vendedor: 'Natalia',
  clienteNome: 'Cliente', itens: [], subtotal: 0, totalFinal: 0, parcelas: [], ...parcial,
})

const fonte = [
  base({ id: 'snapshot-2504', numeroPedido: '002504', clienteNome: 'CONDOMINIO RESIDENCIAL LEGANO RESERVA', totalFinal: 100, atualizadoEm: '2026-07-01' }),
  base({ id: 'mysql-2504', numeroPedido: 2504 as unknown as string, clienteNome: 'CONDOMINIO RESIDENCIAL LEGANO RESERVA', totalFinal: 100, atualizadoEm: '2026-07-20', chaveAcessoNotaFiscal: 'chave', itens: [{ codigoProduto: 'A', descricao: 'A', quantidade: 2, unidade: 'UN', valorUnitario: 50, valorTotal: 100 }] }),
  base({ id: 'pedido-2505', numeroPedido: '2505', clienteNome: 'CONDOMINIO RESIDENCIAL LEGANO RESERVA', totalFinal: 75 }),
  base({ id: 'orcamento-com-numero', tipo: 'Orçamento', numeroPedido: '2504', numeroOrcamento: '99', totalFinal: 999 }),
]

const consolidado = consolidarPedidosRelatorios(fonte)
assert.equal(consolidado.pedidos.length, 2, 'deve manter dois pedidos reais')
assert.equal(consolidado.pedidos.filter((item) => String(item.numeroPedido).replace(/^0+/, '') === '2504').length, 1)
assert.equal(consolidado.pedidos.find((item) => String(item.numeroPedido) === '2504')?.id, 'mysql-2504')
assert.equal(consolidado.pedidos.reduce((soma, item) => soma + item.totalFinal, 0), 175)
assert.deepEqual(consolidado.diagnosticos[0].ids, ['snapshot-2504', 'mysql-2504'])
assert.equal(consolidarVendasRelatorios(fonte).vendas.filter((item) => item.tipo === 'Orçamento').length, 1)
console.log('OK: consolidação, zeros à esquerda, orçamento, canônico, faturamento e pedidos validados.')
