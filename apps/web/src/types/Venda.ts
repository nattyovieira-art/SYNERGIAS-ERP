export type TipoVenda = 'Orçamento' | 'Pedido'

export type StatusOrcamento =
  | 'Aberto'
  | 'Aprovado'
  | 'Reprovado'
  | 'Cancelado'
  | 'Efetivado'

export type StatusPedido =
  | 'Aberto'
  | 'Em separação'
  | 'Faturado'
  | 'Concluído'
  | 'Entregue'
  | 'Cancelado'

export type StatusNotaFiscal =
  | 'Pendente'
  | 'Pronta para emissão'
  | 'Enviando'
  | 'Emitida'
  | 'Autorizada'
  | 'Rejeitada'
  | 'Cancelada'
  | 'Descartada'
  | 'Erro na emissão'


export type AmbienteNFe = 'HOMOLOGACAO' | 'PRODUCAO'

export type HistoricoNFe = {
  id: string
  ambiente: AmbienteNFe
  status: StatusNotaFiscal
  numero?: string
  serie?: string
  chaveAcesso?: string
  protocolo?: string
  cStat?: string
  motivo?: string
  xml?: string
  criadoEm: string
}

export type StatusBoleto =
  | 'Pendente'
  | 'Gerando'
  | 'Gerado'
  | 'Enviado'
  | 'Pago'
  | 'Vencido'
  | 'Cancelado'
  | 'Erro'

export type BancoCobranca = '' | 'Cora' | 'Inter' | 'C6'

export type TipoCobranca =
  | ''
  | 'Boleto'
  | 'Pix'
  | 'Transferência'
  | 'Dinheiro'
  | 'Cartão'
  | 'Boleto + Pix'
  | 'BOLETO BANCO INTER'
  | 'BOLETO BANCO C6'
  | 'BOLETO BANCO CORA'
  | 'PIX BANCO CORA'
  | 'PIX BANCO INTER'
  | 'TRANSFERÊNCIA BANCO INTER'
  | 'TRANSFERÊNCIA BANCO CORA'
  | 'DINHEIRO'
  | 'CARTÃO CRÉDITO SUMUP'
  | 'CARTÃO DÉBITO SUMUP'

export type OrigemPedido = 'MANUAL' | 'ORCAMENTO' | 'SEFAZ_DFE' | 'XML_NFE'

export type OrigemVinculoProdutoHistorico =
  | 'MAPA_HISTORICO'
  | 'DESCRICAO_NORMALIZADA'
  | 'NAO_VINCULADO'

export type ItemVenda = {
  codigoProduto: string
  codigoBarras?: string
  descricao: string
  quantidade: number
  unidade: string
  valorUnitario: number
  descontoValor?: number
  descontoPercentual?: number
  frete?: number
  valorTotal: number
  custoUnitario?: number
  custoTotal?: number
  observacao?: string

  ncm?: string
  ncmDescricao?: string
  cfop?: string
  unidadeTributavel?: string
  origem?: string
  cest?: string
  classificacao?: string
  tipoFiscalVenda?: string
  csosn?: string
  cstIcms?: string
  modalidadeBcIcms?: string
  aliquotaIcms?: number
  reducaoBcIcms?: number
  cstPis?: string
  aliquotaPis?: number
  cstCofins?: string
  aliquotaCofins?: number

  codigoProdutoHistorico?: string
  descricaoHistorica?: string
  chaveProdutoHistorico?: string
  produtoVinculado?: boolean
  vinculoProdutoOrigem?: OrigemVinculoProdutoHistorico
}


export type BrindeVenda = {
  id: string
  produtoCodigo: string
  produtoDescricao: string
  quantidade: number
  destinatario: string
  clienteNome: string
  vendedor: string
  data: string
  motivo?: string
  observacao?: string
  estoqueBaixado?: boolean
}

export type ParcelaVenda = {
  numero: number
  vencimento: string
  observacao?: string
  valor: number

  bancoCobranca?: BancoCobranca
  tipoCobranca?: TipoCobranca

  statusBoleto?: StatusBoleto

  numeroBoleto?: string
  nossoNumero?: string
  seuNumero?: string

  linhaDigitavel?: string
  codigoBarras?: string
  linkBoleto?: string
  boletoPdfUrl?: string
  boletoPdfBase64?: string

  idCobrancaBanco?: string
  idCobrancaApi?: string
  ambienteBoleto?: 'homologacao' | 'producao'
  bancoRetornoOriginal?: unknown

  pixCopiaECola?: string
  pixQrCode?: string
  pixQrCodeUrl?: string
  pixTxId?: string

  dataGeracaoBoleto?: string
  horarioGeracaoBoleto?: string
  dataEnvioBoleto?: string
  horarioEnvioBoleto?: string
  dataPagamentoBoleto?: string
  horarioPagamentoBoleto?: string
  valorRecebido?: number
  jurosRecebimento?: number
  descontoRecebimento?: number
  contaRecebimento?: string
  observacaoRecebimento?: string
  dataCancelamentoBoleto?: string
  horarioCancelamentoBoleto?: string

  erroBoleto?: string
  motivoErroBoleto?: string
}

export type Venda = {
  id: string
  tipo: TipoVenda

  numeroOrcamento?: string
  numeroPedido?: string
  jurosBoletoTipo?: 'P' | 'V'
  jurosBoletoValor?: number
  jurosBoletoPrazo?: number
  multaBoletoTipo?: 'P' | 'V'
  multaBoletoValor?: number
  multaBoletoPrazo?: number
  descontoBoletoTipo?: 'P' | 'V'
  descontoBoletoValor?: number
  descontoBoletoPrazo?: number

  orcamentoOrigemId?: string
  orcamentoOrigemNumero?: string
  dataConversao?: string
  pedidoGeradoId?: string
  pedidoGeradoEm?: string
  aprovadoEm?: string

  dataEmissao: string
  dataValidade?: string
  dataEntrega?: string

  statusOrcamento?: StatusOrcamento
  statusPedido?: StatusPedido

  vendedor: string

  clienteCodigo?: string
  clienteNome: string
  clienteDocumento?: string
  clienteIeRg?: string
  clienteIndicadorIE?: string
  clienteEmail?: string
  clienteEmailNotaFiscal?: string
  clienteTelefone?: string
  clienteCreditoDisponivel?: number
  enderecoEntregaId?: string
  enderecoEntregaNome?: string
  enderecoEntregaCompleto?: string
  emailEnvio?: string
  enderecoEntregaSnapshot?: import('./Cliente').EnderecoEntregaCliente

  faturamentoCep?: string
  faturamentoEndereco?: string
  faturamentoNumero?: string
  faturamentoComplemento?: string
  faturamentoBairro?: string
  faturamentoCidade?: string
  faturamentoEstado?: string
  faturamentoCodigoIbge?: string

  entregaCep?: string
  entregaEndereco?: string
  entregaNumero?: string
  entregaComplemento?: string
  entregaBairro?: string
  entregaCidade?: string
  entregaEstado?: string
  entregaCodigoIbge?: string

  itens: ItemVenda[]
  brindes?: BrindeVenda[]

  subtotal: number
  descontoValor?: number
  descontoPercentual?: number
  frete?: number
  modalidadeFrete?: '0' | '1' | '2'
  outrosCustos?: number
  totalFinal: number

  formaPagamento?: string
  parcelamento?: string
  bancoCobranca?: BancoCobranca
  tipoCobranca?: TipoCobranca
  valorPagamento?: number
  parcelas: ParcelaVenda[]

  observacoes?: string
  observacaoInterna?: string
  observacoesNotaFiscal?: string
  emailsCopiaDocumentos?: string[]
  responsavelEntrega?: string
  telefoneEntrega?: string
  celularEntrega?: string
  horarioEntrega?: string
  logisticaStatus?: 'Aguardando separação' | 'Em separação' | 'Pronto para rota' | 'Em rota' | 'Entregue'
  logisticaRotaOrdem?: number
  logisticaMotorista?: string
  logisticaIniciadaEm?: string
  logisticaPrazoEm?: string
  logisticaObservacao?: string

  statusNotaFiscal?: StatusNotaFiscal
  dispensaEmissaoNfe?: boolean
  dispensaEmissaoNfeEm?: string
  dispensaEmissaoNfePor?: string
  numeroNotaFiscal?: string
  serieNotaFiscal?: string
  chaveAcessoNotaFiscal?: string
  protocoloNotaFiscal?: string
  dataEmissaoNotaFiscal?: string
  xmlNotaFiscal?: string
  xmlNotaFiscalUrl?: string
  danfePdf?: string
  danfePdfUrl?: string
  motivoRejeicaoNotaFiscal?: string
  ambienteNotaFiscal?: AmbienteNFe
  cStatNotaFiscal?: string
  historicoNotaFiscal?: HistoricoNFe[]
  cartaCorrecaoRascunho?: string
  cartaCorrecaoCriadaEm?: string
  justificativaCancelamentoNotaFiscal?: string
  protocoloCancelamentoNotaFiscal?: string
  dataCancelamentoNotaFiscal?: string
  cStatCancelamentoNotaFiscal?: string
  motivoCancelamentoNotaFiscal?: string
  xmlCancelamentoNotaFiscal?: string

  statusBoleto?: StatusBoleto
  bancoBoleto?: BancoCobranca
  ambienteBoleto?: 'homologacao' | 'producao'
  totalBoletosGerados?: number
  ultimoErroBoleto?: string
  ultimaAtualizacaoBoleto?: string

  notaBoletoEnviados?: boolean
  dataEnvioNotaBoleto?: string
  horarioEnvioNotaBoleto?: string
  emailEnvioNotaBoleto?: string
  emailsCopiaEnvio?: string[]
  canalEnvio?: string
  whatsappAgendadoPara?: string
  statusEnvioWhatsapp?: 'Não enviado' | 'Agendado' | 'Enviado' | 'Erro'
  dataEnvioWhatsapp?: string
  horarioEnvioWhatsapp?: string
  erroEnvioWhatsapp?: string
  conciliado?: boolean
  dataConciliacao?: string
  horarioConciliacao?: string

  estoqueBaixado?: boolean
  movimentarEstoqueHistorico?: boolean
  movimentacaoEstoqueHistoricaAutorizada?: boolean
  dataEntregaRealizada?: string
  horarioEntregaRealizada?: string
  entregaRegistroId?: string
  entregaConfirmadaSemNovaBaixa?: boolean
  entregaConferenciaPendente?: boolean

  origemPedido?: OrigemPedido
  importacaoHistorica?: boolean
  nsuDFe?: string
  criadoEm?: string
  atualizadoEm?: string
}
