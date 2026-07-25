export type HistoricoCustoProduto = {
  id?: string
  data?: string
  dataEntrada?: string
  hora?: string
  documentoOrigem?: string
  fornecedor?: string
  custoEntrada?: number
  custoMedioAtual?: number
  variacaoUltimoCustoPercentual?: number
  compraId?: string
  numeroCompra?: string
  numeroNFe?: string
  fornecedorCodigo?: string
  fornecedorNome?: string
  quantidadeEntrada?: number
  custoAnterior?: number
  custoCompra?: number
  custoNovo?: number
  custoMedioAnterior?: number
  custoMedioNovo?: number
  variacaoPercentual?: number
  estoqueAnterior?: number
  estoqueNovo?: number
  valorEstoqueAnterior?: number
  valorEstoqueNovo?: number
  origem?: string
  criadoEm?: string
}

export type ProdutoComposicao = {
  item: string
  quantidade: number
  unidade: string
  custoUnitario: number
  custoTotal: number
}

export type Produto = {
  id?: string

  codigo: string
  codigoBarras?: string
  codigoInterno?: string
  sku?: string
  referencia?: string

  descricao: string
  nome?: string
  nomeProduto?: string
  produto?: string

  tipoItem?: string
  unidade?: string
  unidadeMedida?: string
  categoria?: string
  subcategoria?: string
  marca?: string
  modelo?: string
  tags?: string
  situacao?: string

  imagem?: string
  imagemUrl?: string

  // Custos
  custo?: number
  custoMedioAtual?: number
  ultimoCustoCompra?: number
  custoAnteriorUltimaCompra?: number
  variacaoUltimoCustoPercentual?: number
  valorEstoqueAtual?: number
  historicoCustos?: HistoricoCustoProduto[]

  // Valores alternativos mantidos por compatibilidade
  preco?: number
  precoVenda?: number
  valorVenda?: number
  precoUnitario?: number
  valorUnitario?: number
  valor?: number

  // Varejo
  margemAutomaticaVarejo?: number
  vendaVarejo?: number
  margemLucroVarejo?: number

  // Atacado
  margemAutomaticaAtacado?: number
  vendaAtacado?: number
  margemLucroAtacado?: number
  quantidadeMinimaAtacado?: number

  // Estoque
  movimentarEstoque?: boolean
  movimentarEstoqueComposicao?: boolean
  tipoEstoque?: 'Único' | 'Grade' | string
  estoqueMinimo?: number
  estoqueAtual?: number
  estoque?: number
  quantidadeEstoque?: number
  saldoEstoque?: number
  quantidade?: number
  quantidadePorEmbalagemCompra?: number

  // Fiscal
  tipoFiscal?: string
  ncm?: string
  ncmDescricao?: string
  origem?: string
  cest?: string
  classificacao?: string
  csosn?: string
  cstIcms?: string
  modalidadeBcIcms?: string
  aliquotaIcms?: number
  reducaoBcIcms?: number
  cstPis?: string
  aliquotaPis?: number
  cstCofins?: string
  aliquotaCofins?: number
  cfopDentroEstado?: string
  cfopForaEstado?: string

  // PDV
  habilitarPdv?: boolean

  // Composição
  composicao?: ProdutoComposicao[]

  // Fragmentação
  permiteFragmentacao?: boolean
  unidadeFragmentada?: string
  quantidadeFragmentada?: number

  // Loja virtual
  publicarLojaVirtual?: boolean
  descricaoLojaVirtual?: string

  // Controle interno do localStorage
  criadoEm?: string
  atualizadoEm?: string
}
