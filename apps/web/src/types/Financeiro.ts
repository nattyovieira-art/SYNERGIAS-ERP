export type StatusContaReceber =
  | 'Aberta'
  | 'Parcialmente paga'
  | 'Paga'
  | 'Vencida'
  | 'Cancelada'

export type ContaReceber = {
  id: string
  pedidoId?: string
  pedidoNumero?: string
  parcelaNumero?: number
  numeroNotaFiscal?: string
  numeroBoleto?: string
  clienteCodigo?: string
  clienteNome: string
  clienteDocumento?: string
  descricao: string
  dataEmissao: string
  dataVencimento: string
  dataRecebimento?: string
  valorOriginal: number
  valorRecebido: number
  valorPrincipalRecebido?: number
  saldoAberto: number
  formaPagamento?: string
  bancoCobranca?: string
  tipoCobranca?: string
  status: StatusContaReceber
  observacao?: string
  jurosRecebidos?: number
  descontosConcedidos?: number
  contaRecebimento?: string
  conciliado?: boolean
  criadoEm?: string
  atualizadoEm?: string
}

export type TipoLancamentoOFX = 'Credito' | 'Debito'

export type LancamentoOFX = {
  id: string
  data: string
  descricao: string
  valor: number
  tipo: TipoLancamentoOFX
  banco?: string
  documento?: string
  conciliado?: boolean
  contaReceberId?: string
  criadoEm?: string
  atualizadoEm?: string
}

export type SugestaoConciliacao = {
  id: string
  lancamento: LancamentoOFX
  conta: ContaReceber
  pontuacao: number
  motivos: string[]
}