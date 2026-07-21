export type RegimeTributario =
  | 'SIMPLES_NACIONAL'
  | 'LUCRO_PRESUMIDO'
  | 'LUCRO_REAL'
  | 'OUTRO'

export type DestinacaoFiscalPadrao =
  | 'REVENDA'
  | 'USO_E_CONSUMO'
  | 'ATIVO_IMOBILIZADO'
  | 'INSUMO'

export type ConfiguracaoFiscalEmpresa = {
  id: string

  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  inscricaoEstadual: string
  inscricaoMunicipal: string
  uf: string
  municipio: string
  codigoIbgeMunicipio: string

  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  telefone: string
  email: string
  situacaoCadastral: string
  cnaePrincipalDescricao: string

  regimeTributario: RegimeTributario
  regimeTributarioConfirmado: boolean
  contribuinteIcms: boolean
  aproveitaCreditoIcms: boolean
  revendaMercadorias: boolean
  possuiRegimeEspecial: boolean
  descricaoRegimeEspecial: string

  destinacaoFiscalPadrao: DestinacaoFiscalPadrao

  calcularIcmsEntrada: boolean
  calcularStEntrada: boolean
  calcularAntecipacaoEntrada: boolean
  somarTributosAoCusto: boolean
  ratearFreteNosItens: boolean
  ratearOutrosCustosNosItens: boolean

  exigirConfirmacaoFiscal: boolean
  bloquearCustoSemAnaliseFiscal: boolean

  observacoes: string

  criadoEm: string
  atualizadoEm: string
}
