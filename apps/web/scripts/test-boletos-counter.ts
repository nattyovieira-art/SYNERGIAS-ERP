import assert from 'node:assert/strict'
import type { ParcelaVenda, Venda } from '../src/types/Venda.ts'
import { boletoEstaUtilizado, contarBoletosUtilizadosPorBanco } from '../src/services/boletosCounter.ts'

const mes = '2026-07'
const parcela = (dados: Partial<ParcelaVenda>): ParcelaVenda => ({
  numero: 1, vencimento: '2026-07-30', valor: 100, dataGeracaoBoleto: '2026-07-20', ...dados,
})
const pedido = (id: string, parcelas: ParcelaVenda[]): Venda => ({
  id, tipo: 'Pedido', statusPedido: 'Aberto', itens: [], parcelas,
} as Venda)

const interAtivo = parcela({ bancoCobranca: 'Inter', statusBoleto: 'Gerado', idCobrancaApi: 'inter-1' })
const interCancelado = parcela({ bancoCobranca: 'Inter', statusBoleto: 'Cancelado', idCobrancaApi: 'inter-2', numeroBoleto: '2' })
const copiaInter = parcela({ bancoCobranca: 'Inter', statusBoleto: 'Pago', nossoNumero: 'duplicado', idCobrancaApi: 'inter-1' })
const rascunho = parcela({ bancoCobranca: 'Inter', statusBoleto: 'Pendente', numeroBoleto: 'local-1' })

const vendas = [pedido('1', [interAtivo, interCancelado]), pedido('2', [copiaInter, rascunho])]

assert.equal(contarBoletosUtilizadosPorBanco(vendas, 'Inter', mes), 1, 'deduplica e ignora cancelado/rascunho')
assert.equal(boletoEstaUtilizado(interCancelado), false, 'cancelamento repetido não reduz novamente')
assert.equal(boletoEstaUtilizado(parcela({ statusBoleto: 'Erro', idCobrancaApi: 'falha' })), false, 'falha de API/emissão não ocupa posição')
assert.equal(boletoEstaUtilizado(parcela({ statusBoleto: 'Pago', nossoNumero: 'pago-1' })), true, 'pago preserva a regra atual')
assert.equal(contarBoletosUtilizadosPorBanco(vendas, 'Inter', mes, '1'), 1, 'ignorar um pedido não afeta os demais')

console.log('Testes do contador de boletos: OK')
