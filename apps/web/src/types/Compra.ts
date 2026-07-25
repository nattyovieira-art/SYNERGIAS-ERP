export type StatusCompra =
  | 'Rascunho'
  | 'Pedido Emitido'
  | 'Aguardando Entrega'
  | 'Recebido Parcial'
  | 'Recebido'
  | 'Faturado'
  | 'Concluído'
  | 'Cancelado'
  | 'Devolvido Parcial'
  | 'Devolvido'

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
  outrosCustosRateados?: number
  descontoRateado?: number
  impostos?: number

  unidadeFiscal?: string
  quantidadeFiscal?: number
  custoUnitarioFiscal?: number
  totalFiscal?: number

  unidadeControle?: string
  fatorConversao?: number
  quantidadeConvertida?: number
  custoUnitarioConvertido?: number

  codigoFornecedor?: string
  eanComercial?: string
  eanTributavel?: string
  unidadeTributavel?: string
  quantidadeTributavel?: number
  valorUnitarioTributavel?: number
  icms?: number
  icmsSt?: number
  ipi?: number
  difal?: number
  custoFinalItem?: number
  incluidoNoSistema?: boolean
  motivoDescarte?: string
  correspondencia?: 'EAN_TRIBUTAVEL' | 'EAN_COMERCIAL' | 'DESCRICAO' | 'NAO_VINCULADO'
  novoProdutoNome?: string
  novoProdutoPendente?: boolean
  quantidadeDevolvida?: number
  devolucoes?: Array<{
    id: string
    quantidade: number
    motivo: string
    data: string
    idMovimentacaoEstoque?: string
  }>
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
  valorFiscalNFe?: number
  valorProdutosNFe?: number
  descontoFinanceiroNFe?: number
  valorLiquidoCobrancaNFe?: number
  decisaoDescontoFinanceiro?: 'FISCAL_INTEGRAL' | 'LIQUIDO_COM_DESCONTO'
  itensOriginaisNFe?: ItemCompra[]
  parcelasPagamento?: Array<{
    numero: string
    vencimento: string
    valor: number
  }>
}
