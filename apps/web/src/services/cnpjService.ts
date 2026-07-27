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

export function cnpjTemDigitosValidos(cnpjInformado: string) {
  const cnpj = somenteNumeros(cnpjInformado)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const calcular = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((total, numero, indice) =>
      total + Number(numero) * pesos[indice], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  const base = cnpj.slice(0, 12)
  const primeiro = calcular(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const segundo = calcular(`${base}${primeiro}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return cnpj === `${base}${primeiro}${segundo}`
}

function texto(valor: unknown) {
  return typeof valor === 'string' ? valor.trim() : ''
}

export async function consultarCnpj(cnpjInformado: string): Promise<DadosCnpjConsultados> {
  const cnpj = somenteNumeros(cnpjInformado)
  if (cnpj.length !== 14) throw new Error('Digite um CNPJ válido com 14 números.')
  if (!cnpjTemDigitosValidos(cnpj)) throw new Error('Os dígitos verificadores deste CNPJ não conferem.')

  const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const dados = (await resposta.json()) as BrasilApiCnpjResponse
  if (!resposta.ok) {
    if (resposta.status === 404) {
      throw new Error('A consulta automática não retornou os dados deste CNPJ. Se ele foi confirmado na Receita Federal, preencha os dados manualmente e salve normalmente.')
    }
    throw new Error('A consulta automática está indisponível. Os dados preenchidos foram preservados e podem ser salvos manualmente.')
  }

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
