import type { ConfiguracaoFiscalEmpresa } from '../types/ConfiguracaoFiscal'

const CHAVE_CONFIGURACAO_FISCAL = 'synergias_erp_configuracao_fiscal'
const CHAVE_BACKUP_CONFIGURACAO_FISCAL = 'synergias_erp_configuracao_fiscal_backup'
export const SYNERGIAS_FISCAL_CENTRAL_V228 = 'SYNERGIAS_FISCAL_CENTRAL_V228'

const CONFIGURACAO_PADRAO: ConfiguracaoFiscalEmpresa = {
  id: 'configuracao-fiscal-synergias',

  razaoSocial: 'SYNERGIAS SL COMERCIO LTDA ME',
  nomeFantasia: 'Synergias Distribuidora',
  cnpj: '',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  uf: 'RS',
  municipio: '',
  codigoIbgeMunicipio: '',

  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  telefone: '',
  email: '',
  situacaoCadastral: '',
  cnaePrincipalDescricao: '',

  regimeTributario: 'SIMPLES_NACIONAL',
  regimeTributarioConfirmado: false,
  contribuinteIcms: true,
  aproveitaCreditoIcms: false,
  revendaMercadorias: true,
  possuiRegimeEspecial: false,
  descricaoRegimeEspecial: '',

  destinacaoFiscalPadrao: 'REVENDA',

  calcularIcmsEntrada: true,
  calcularStEntrada: true,
  calcularAntecipacaoEntrada: true,
  somarTributosAoCusto: true,
  ratearFreteNosItens: true,
  ratearOutrosCustosNosItens: true,

  exigirConfirmacaoFiscal: true,
  bloquearCustoSemAnaliseFiscal: false,

  observacoes: '',

  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString(),
}


function somenteNumeros(valor: unknown) {
  return String(valor || '').replace(/\D/g, '')
}

export function configuracaoFiscalEssencialValida(
  configuracao?: Partial<ConfiguracaoFiscalEmpresa> | null,
) {
  if (!configuracao) return false

  return Boolean(
    String(configuracao.razaoSocial || '').trim() &&
      somenteNumeros(configuracao.cnpj).length === 14 &&
      String(configuracao.inscricaoEstadual || '').trim() &&
      String(configuracao.uf || '').trim() &&
      String(configuracao.municipio || '').trim() &&
      String(configuracao.codigoIbgeMunicipio || '').trim() &&
      somenteNumeros(configuracao.cep).length === 8 &&
      String(configuracao.logradouro || '').trim() &&
      String(configuracao.numero || '').trim() &&
      String(configuracao.bairro || '').trim(),
  )
}

function lerConfiguracaoLocal(chave: string) {
  try {
    const dados = localStorage.getItem(chave)
    if (!dados) return null
    return JSON.parse(dados) as Partial<ConfiguracaoFiscalEmpresa>
  } catch {
    return null
  }
}


function mesclarConfiguracaoFiscalProtegida(
  base: ConfiguracaoFiscalEmpresa,
  entrada?: Partial<ConfiguracaoFiscalEmpresa> | null,
): ConfiguracaoFiscalEmpresa {
  if (!entrada) return base

  const resultado = { ...base } as ConfiguracaoFiscalEmpresa
  for (const [chave, valor] of Object.entries(entrada)) {
    if (valor === undefined || valor === null) continue

    if (typeof valor === 'string') {
      const texto = valor.trim()
      const atual = String((resultado as Record<string, unknown>)[chave] ?? '').trim()

      if (!texto && atual) continue
    }

    ;(resultado as Record<string, unknown>)[chave] = valor
  }

  return resultado
}

export function obterConfiguracaoFiscalStorage(): ConfiguracaoFiscalEmpresa {
  const principal = lerConfiguracaoLocal(CHAVE_CONFIGURACAO_FISCAL)
  const backup = lerConfiguracaoLocal(CHAVE_BACKUP_CONFIGURACAO_FISCAL)
  const origem = configuracaoFiscalEssencialValida(principal)
    ? principal
    : configuracaoFiscalEssencialValida(backup)
      ? backup
      : principal || backup || CONFIGURACAO_PADRAO

  return mesclarConfiguracaoFiscalProtegida(
    { ...CONFIGURACAO_PADRAO },
    origem,
  )
}

export function salvarConfiguracaoFiscalStorage(
  configuracao: ConfiguracaoFiscalEmpresa,
): ConfiguracaoFiscalEmpresa {
  const configuracaoAtualizada: ConfiguracaoFiscalEmpresa = {
    ...configuracao,
    atualizadoEm: new Date().toISOString(),
  }

  const anterior = lerConfiguracaoLocal(CHAVE_CONFIGURACAO_FISCAL)
  if (configuracaoFiscalEssencialValida(anterior)) {
    localStorage.setItem(
      CHAVE_BACKUP_CONFIGURACAO_FISCAL,
      JSON.stringify(anterior),
    )
  }

  localStorage.setItem(
    CHAVE_CONFIGURACAO_FISCAL,
    JSON.stringify(configuracaoAtualizada),
  )

  if (configuracaoFiscalEssencialValida(configuracaoAtualizada)) {
    localStorage.setItem(
      CHAVE_BACKUP_CONFIGURACAO_FISCAL,
      JSON.stringify(configuracaoAtualizada),
    )
  }

  return configuracaoAtualizada
}

export async function carregarConfiguracaoFiscalServidor(): Promise<ConfiguracaoFiscalEmpresa> {
  const local = obterConfiguracaoFiscalStorage()
  const response = await fetch('/api/configuracao-fiscal.php', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!response.ok) return local

  const payload = await response.json()
  const remota = payload?.configuracao as Partial<ConfiguracaoFiscalEmpresa> | null

  if (!configuracaoFiscalEssencialValida(remota)) {
    return local
  }

  const mesclada = mesclarConfiguracaoFiscalProtegida(local, remota)
  localStorage.setItem(CHAVE_CONFIGURACAO_FISCAL, JSON.stringify(mesclada))
  localStorage.setItem(CHAVE_BACKUP_CONFIGURACAO_FISCAL, JSON.stringify(mesclada))
  return mesclada
}

export async function salvarConfiguracaoFiscalServidor(configuracao: ConfiguracaoFiscalEmpresa): Promise<ConfiguracaoFiscalEmpresa> {
  if (!configuracaoFiscalEssencialValida(configuracao)) {
    throw new Error('A configuração fiscal está incompleta e não pode substituir o cadastro válido da empresa.')
  }

  const response = await fetch('/api/configuracao-fiscal.php', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ configuracao }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || 'Não foi possível salvar a configuração fiscal no servidor.')
  }

  const confirmada = await carregarConfiguracaoFiscalServidor()
  if (!configuracaoFiscalEssencialValida(confirmada)) {
    throw new Error('O servidor não confirmou a configuração fiscal salva. O cadastro anterior foi preservado.')
  }

  return salvarConfiguracaoFiscalStorage(confirmada)
}
