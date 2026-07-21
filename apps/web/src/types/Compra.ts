export type StatusCompra =
  | 'Rascunho'
  | 'Pedido Emitido'
  | 'Aguardando Entrega'
  | 'Recebido Parcial'
  | 'Recebido'
  | 'Cancelado'

export type ItemCompra = {
  id: string
  produtoCodigo: string
  descricao: string
  unidade: string
  quantidade: number
  custoUnitario: number
  total: number

  gtin?: string
  ncm?: string
  cfop?: string
  desconto?: number
  frete?: number
  impostos?: number

  unidadeFiscal?: string
  quantidadeFiscal?: number
  custoUnitarioFiscal?: number
  totalFiscal?: number

  unidadeControle?: string
  fatorConversao?: number
  quantidadeConvertida?: number
  custoUnitarioConvertido?: number
}

export type OrigemCompra = 'MANUAL' | 'SEFAZ_DFE' | 'XML_NFE'

export type Compra = {
  id: string
  numeroCompra: string
  dataEmissao: string
  previsaoEntrega: string

  fornecedorCodigo: string
  fornecedorNome: string
  fornecedorDocumento: string
  fornecedorEmail: string
  fornecedorTelefone: string
  fornecedorEndereco?: string

  itens: ItemCompra[]

  desconto: number
  frete: number
  outrosCustos: number
  subtotal: number
  totalFinal: number

  formaPagamento: string
  condicaoPagamento: string
  observacoes: string
  status: StatusCompra

  criadoEm: string
  atualizadoEm: string

  origem?: OrigemCompra
  importacaoHistorica?: boolean

  movimentarEstoque?: boolean
  movimentouEstoque?: boolean
  estoqueMovimentadoEm?: string
  idMovimentacaoEstoque?: string

  numeroNFe?: string
  serieNFe?: string
  chaveAcessoNFe?: string
  protocoloNFe?: string
  nsuDFe?: string
  xmlNFe?: string
}
