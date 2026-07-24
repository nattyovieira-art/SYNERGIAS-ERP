export type PedidoCliente = {
  data?: string
  numero?: string
  status?: string
  pagamento?: string
  valorTotal?: number
}

export type TipoLocalEntrega = 'Residencial' | 'Comercial' | 'Outro'

export type EnderecoEntregaCliente = {
  id: string
  nomeLocal: string
  tipoLocal: TipoLocalEntrega
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  codigoIbgeMunicipio?: string
  responsavel: string
  telefone: string
  celular: string
  horarioEntrega: string
  emailEnvio: string
  emailsCopiaEnvio?: string[]
  observacoes: string
  ativo: boolean
}

export type Cliente = {
  codigo: string

  // Dados gerais
  tipoPessoa?: 'Física' | 'Jurídica'
  razaoSocial: string
  nomeFantasia?: string
  tipo: string
  situacao: string
  bloqueado?: boolean
  cpf?: string
  cnpj?: string
  caracteristicas?: string

  // Contatos
  responsavel?: string
  telefone?: string
  celular?: string
  celularWhatsapp?: string
  email?: string
  emailNotaFiscal?: string
  emailsCopiaDocumentos?: string[]
  horarioEntrega?: string

  // Endereço fiscal
  cep?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade: string
  estado?: string
  codigoIbgeMunicipio?: string
  pais?: string

  // Endereço de entrega
  mesmoEnderecoFiscal?: boolean
  cepEntrega?: string
  enderecoEntrega?: string
  numeroEntrega?: string
  complementoEntrega?: string
  bairroEntrega?: string
  cidadeEntrega?: string
  estadoEntrega?: string
  codigoIbgeMunicipioEntrega?: string
  paisEntrega?: string
  enderecosEntrega?: EnderecoEntregaCliente[]

  // Dados fiscais
  inscricaoEstadual?: string
  inscricaoMunicipal?: string
  indicadorIE?: string
  consumidorFinal?: boolean
  issRetidoFonte?: boolean
  produtorRural?: boolean

  // Crédito
  valorAno: number
  totalVencidas?: number
  totalAVencer?: number
  totalPagas?: number
  limiteCredito?: number

  // Histórico
  pedidos?: PedidoCliente[]
}
