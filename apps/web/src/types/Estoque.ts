import type { Produto } from './Produto'

export type TipoMovimentacaoEstoque = 'entrada' | 'saida' | 'ajuste'

export type OrigemMovimentacaoEstoque =
  | 'manual'
  | 'compra'
  | 'pedido'
  | 'inventario'
  | 'correcao'
  | string

export type EstoqueMovimentacao = {
  id: string
  pedidoId?: string
  numeroPedido?: string
  data: string
  hora: string
  produtoId?: string
  produtoCodigo: string
  produtoDescricao: string
  tipo: TipoMovimentacaoEstoque
  origem: OrigemMovimentacaoEstoque
  quantidade: number
  estoqueAnterior: number
  estoqueAtual: number
  motivo: string
  observacao?: string
  usuario?: string
  documentoOrigem?: string
  movimentoOriginalId?: string | null
  criadoEm: string
}

export type EstoqueProdutoResumo = Produto & {
  estoqueDisponivel: number
  estoqueMinimoConfigurado: number
  estoqueBaixo: boolean
}

export type NovaMovimentacaoEstoque = {
  produtoCodigo: string
  tipo: TipoMovimentacaoEstoque
  quantidade: number
  motivo: string
  observacao?: string
  origem?: OrigemMovimentacaoEstoque
  documentoOrigem?: string
  usuario?: string
}
