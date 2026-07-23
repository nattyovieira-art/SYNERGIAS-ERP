import type { Compra } from '../types/Compra'
import type { ContaReceber } from '../types/Financeiro'
import type { Venda } from '../types/Venda'
import { listarContasReceberStorage, salvarContasReceberStorage } from './financeiroStorage'

const STORAGE_CONTAS_PAGAR = 'synergias_contas_pagar'

type ContaPagarLocal = Record<string, unknown> & {
  id: string
  status?: string
  conciliado?: boolean
}

function numero(valor: unknown) {
  const convertido = Number(valor || 0)
  return Number.isFinite(convertido) ? convertido : 0
}

function lerContasPagar(): ContaPagarLocal[] {
  try {
    const dados = JSON.parse(localStorage.getItem(STORAGE_CONTAS_PAGAR) || '[]')
    return Array.isArray(dados) ? dados : []
  } catch {
    return []
  }
}

/**
 * Recria os espelhos financeiros a partir das colecoes centrais. Antes disso as
 * telas liam apenas o localStorage do navegador que abriu o pedido/compra; em
 * outro computador, o financeiro aparecia vazio mesmo com operacoes no MySQL.
 */
export function sincronizarFinanceiroComOperacoes(vendas: Venda[], compras: Compra[]) {
  const contasReceber = listarContasReceberStorage()
  const receberPorId = new Map(contasReceber.map((conta) => [conta.id, conta]))

  vendas.forEach((venda) => {
    if (!String(venda.tipo || '').toLowerCase().includes('pedido')) return

    const parcelas = Array.isArray(venda.parcelas) ? venda.parcelas : []
    parcelas.forEach((parcela, indice) => {
      const parcelaNumero = Number(parcela.numero || indice + 1)
      const id = `conta_pedido_${venda.id}_${parcelaNumero}`
      const existente = receberPorId.get(id)
      const valorOriginal = numero(parcela.valor)
      const pagaNoPedido = parcela.statusBoleto === 'Pago'
      const cancelada = String(venda.statusPedido || '').toLowerCase() === 'cancelado'
      const valorRecebidoPedido = numero(parcela.valorRecebido)
      const desconto = numero(parcela.descontoRecebimento)
      const preservarBaixa = existente?.status === 'Paga' || existente?.conciliado
      const paga = preservarBaixa || pagaNoPedido
      const valorRecebido = paga
        ? numero(existente?.valorRecebido) || valorRecebidoPedido || valorOriginal
        : valorRecebidoPedido

      const projetada: ContaReceber = {
        ...existente,
        id,
        pedidoId: venda.id,
        pedidoNumero: venda.numeroPedido || venda.id,
        parcelaNumero,
        numeroNotaFiscal: venda.numeroNotaFiscal || existente?.numeroNotaFiscal || '',
        numeroBoleto: parcela.numeroBoleto || existente?.numeroBoleto || '',
        clienteCodigo: venda.clienteCodigo || '',
        clienteNome: venda.clienteNome || 'Cliente nao informado',
        clienteDocumento: venda.clienteDocumento || '',
        descricao: `Pedido ${venda.numeroPedido || venda.id} - Parcela ${parcelaNumero}`,
        dataEmissao: venda.dataEmissao || String(venda.criadoEm || '').slice(0, 10),
        dataVencimento: parcela.vencimento || venda.dataEmissao || '',
        dataRecebimento: existente?.dataRecebimento || parcela.dataPagamentoBoleto || '',
        valorOriginal,
        valorRecebido,
        saldoAberto: paga || cancelada ? 0 : Math.max(valorOriginal - valorRecebidoPedido - desconto, 0),
        formaPagamento: venda.formaPagamento || '',
        bancoCobranca: parcela.bancoCobranca || venda.bancoCobranca || '',
        tipoCobranca: String(parcela.tipoCobranca || venda.tipoCobranca || ''),
        status: cancelada ? 'Cancelada' : paga ? 'Paga' : valorRecebidoPedido > 0 || desconto > 0 ? 'Parcialmente paga' : 'Aberta',
        conciliado: existente?.conciliado || paga,
        criadoEm: existente?.criadoEm || venda.criadoEm,
        atualizadoEm: new Date().toISOString(),
      }
      receberPorId.set(id, projetada)
    })
  })
  salvarContasReceberStorage(Array.from(receberPorId.values()))

  const contasPagar = lerContasPagar()
  const pagarPorId = new Map(contasPagar.map((conta) => [conta.id, conta]))
  compras.forEach((compra) => {
    ;(compra.parcelasPagamento || []).forEach((parcela, indice) => {
      const parcelaNumero = parcela.numero || String(indice + 1)
      const id = `compra-${compra.id}-parcela-${parcelaNumero}`
      const existente = pagarPorId.get(id)
      const preservarBaixa = existente?.status === 'Paga' || existente?.conciliado
      pagarPorId.set(id, {
        ...existente,
        id,
        fornecedor: compra.fornecedorNome,
        documento: compra.chaveAcessoNFe || compra.numeroNFe || compra.numeroCompra,
        descricao: `NF-e ${compra.numeroNFe || '-'} - Pedido ${compra.numeroCompra} - Parcela ${parcelaNumero}`,
        categoria: 'Compras de materiais',
        emissao: compra.dataEmissao,
        vencimento: parcela.vencimento,
        valor: numero(parcela.valor),
        status: preservarBaixa ? existente?.status : compra.status === 'Cancelado' ? 'Cancelada' : 'Em aberto',
        conciliado: existente?.conciliado || false,
        compraId: compra.id,
        numeroCompra: compra.numeroCompra,
        numeroNFe: compra.numeroNFe,
        parcelaNumero,
      })
    })
  })
  localStorage.setItem(STORAGE_CONTAS_PAGAR, JSON.stringify(Array.from(pagarPorId.values())))
}
