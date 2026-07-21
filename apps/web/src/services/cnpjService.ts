export type DadosCnpjConsultados = {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  situacaoCadastral: string
  cnaePrincipalDescricao: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  codigoIbgeMunicipio: string
  telefone: string
  email: string
}

type BrasilApiCnpjResponse = {
  cnpj?: string
  razao_social?: string
  nome_fantasia?: string
  descricao_situacao_cadastral?: string
  cnae_fiscal_descricao?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  codigo_municipio_ibge?: number | string
  ddd_telefone_1?: string
  ddd_telefone_2?: string
  email?: string
  message?: string
}

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, '')
}

function texto(valor: unknown) {
  return typeof valor === 'string' ? valor.trim() : ''
}

export async function consultarCnpj(cnpjInformado: string): Promise<DadosCnpjConsultados> {
  const cnpj = somenteNumeros(cnpjInformado)
  if (cnpj.length !== 14) throw new Error('Digite um CNPJ válido com 14 números.')

  const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const dados = (await resposta.json()) as BrasilApiCnpjResponse
  if (!resposta.ok) throw new Error(texto(dados.message) || 'Não foi possível buscar o CNPJ.')

  return {
    cnpj: somenteNumeros(texto(dados.cnpj) || cnpj),
    razaoSocial: texto(dados.razao_social),
    nomeFantasia: texto(dados.nome_fantasia),
    situacaoCadastral: texto(dados.descricao_situacao_cadastral),
    cnaePrincipalDescricao: texto(dados.cnae_fiscal_descricao),
    cep: somenteNumeros(texto(dados.cep)),
    logradouro: texto(dados.logradouro),
    numero: texto(dados.numero),
    complemento: texto(dados.complemento),
    bairro: texto(dados.bairro),
    municipio: texto(dados.municipio),
    uf: texto(dados.uf).toUpperCase(),
    codigoIbgeMunicipio: String(dados.codigo_municipio_ibge ?? '').trim(),
    telefone: texto(dados.ddd_telefone_1) || texto(dados.ddd_telefone_2),
    email: texto(dados.email).toLowerCase(),
  }
}
