export type StatusRegraFiscal = 'RASCUNHO' | 'CONFIRMADA' | 'INATIVA'

export type DestinacaoRegraFiscal =
  | 'REVENDA'
  | 'USO_E_CONSUMO'
  | 'ATIVO_IMOBILIZADO'
  | 'INSUMO'

export type TratamentoFiscalRegra =
  | 'SEM_ADICIONAL_FISCAL'
  | 'ICMS_ST_JA_RETIDO'
  | 'ICMS_ST_A_RECOLHER'
  | 'ANTECIPACAO_TRIBUTARIA'
  | 'ICMS_COMPLEMENTAR'
  | 'REVISAO_OBRIGATORIA'

export type RegraFiscalNcmCest = {
  id: string
  ncm: string
  cest: string
  descricao: string
  ufOrigem: string
  ufDestino: string
  destinacao: DestinacaoRegraFiscal
  regimeTributario: string
  tratamento: TratamentoFiscalRegra
  observacoes: string
  status: StatusRegraFiscal
  produtosVinculados: string[]
  criadoEm: string
  atualizadoEm: string
  confirmadoEm?: string
}

export type ConsultaRegraFiscal = {
  ncm: string
  cest?: string
  ufOrigem?: string
  ufDestino?: string
  destinacao?: DestinacaoRegraFiscal
  regimeTributario?: string
}

const CHAVE_REGRAS = 'synergias_erp_regras_fiscais_ncm_cest'

function texto(valor: unknown) {
  return String(valor ?? '').trim()
}

function somenteNumeros(valor: unknown) {
  return texto(valor).replace(/\D/g, '')
}

function normalizarNcm(valor: unknown) {
  return somenteNumeros(valor).slice(0, 8)
}

function normalizarCest(valor: unknown) {
  return somenteNumeros(valor).slice(0, 7)
}

function normalizarUf(valor: unknown) {
  const uf = texto(valor).toUpperCase()
  return uf === 'TODAS' || uf === '*' ? 'TODAS' : uf.slice(0, 2)
}

function gerarId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `regra-fiscal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizarRegra(regra: RegraFiscalNcmCest): RegraFiscalNcmCest {
  const agora = new Date().toISOString()

  return {
    ...regra,
    id: texto(regra.id) || gerarId(),
    ncm: normalizarNcm(regra.ncm),
    cest: normalizarCest(regra.cest),
    descricao: texto(regra.descricao),
    ufOrigem: normalizarUf(regra.ufOrigem) || 'TODAS',
    ufDestino: normalizarUf(regra.ufDestino) || 'RS',
    destinacao: regra.destinacao || 'REVENDA',
    regimeTributario: texto(regra.regimeTributario) || 'SIMPLES_NACIONAL',
    tratamento: regra.tratamento || 'REVISAO_OBRIGATORIA',
    observacoes: texto(regra.observacoes),
    status: regra.status || 'RASCUNHO',
    produtosVinculados: Array.isArray(regra.produtosVinculados)
      ? regra.produtosVinculados.map(texto).filter(Boolean)
      : [],
    criadoEm: texto(regra.criadoEm) || agora,
    atualizadoEm: agora,
    confirmadoEm:
      regra.status === 'CONFIRMADA'
        ? texto(regra.confirmadoEm) || agora
        : undefined,
  }
}

export function listarRegrasFiscaisStorage(): RegraFiscalNcmCest[] {
  try {
    const dados = localStorage.getItem(CHAVE_REGRAS)
    if (!dados) return []

    const regras = JSON.parse(dados) as RegraFiscalNcmCest[]
    if (!Array.isArray(regras)) return []

    return regras.map(normalizarRegra)
  } catch {
    return []
  }
}

export function buscarRegraFiscalStorage(
  id: string,
): RegraFiscalNcmCest | undefined {
  return listarRegrasFiscaisStorage().find((regra) => regra.id === id)
}

export function salvarRegraFiscalStorage(
  regra: RegraFiscalNcmCest,
): RegraFiscalNcmCest {
  const regras = listarRegrasFiscaisStorage()
  const normalizada = normalizarRegra(regra)
  const indice = regras.findIndex((item) => item.id === normalizada.id)

  if (indice >= 0) {
    normalizada.criadoEm = regras[indice].criadoEm
    regras[indice] = normalizada
  } else {
    regras.unshift(normalizada)
  }

  localStorage.setItem(CHAVE_REGRAS, JSON.stringify(regras))

  return normalizada
}

export function criarRegraFiscalVazia(): RegraFiscalNcmCest {
  const agora = new Date().toISOString()

  return {
    id: gerarId(),
    ncm: '',
    cest: '',
    descricao: '',
    ufOrigem: 'TODAS',
    ufDestino: 'RS',
    destinacao: 'REVENDA',
    regimeTributario: 'SIMPLES_NACIONAL',
    tratamento: 'REVISAO_OBRIGATORIA',
    observacoes: '',
    status: 'RASCUNHO',
    produtosVinculados: [],
    criadoEm: agora,
    atualizadoEm: agora,
  }
}

export function excluirRegraFiscalStorage(id: string): void {
  const regras = listarRegrasFiscaisStorage().filter(
    (regra) => regra.id !== id,
  )

  localStorage.setItem(CHAVE_REGRAS, JSON.stringify(regras))
}

export function confirmarRegraFiscalStorage(
  id: string,
): RegraFiscalNcmCest {
  const regra = buscarRegraFiscalStorage(id)

  if (!regra) {
    throw new Error('Regra fiscal não encontrada.')
  }

  if (normalizarNcm(regra.ncm).length !== 8) {
    throw new Error('Informe um NCM válido com 8 dígitos.')
  }

  if (!regra.descricao.trim()) {
    throw new Error('Informe a descrição da regra fiscal.')
  }

  return salvarRegraFiscalStorage({
    ...regra,
    status: 'CONFIRMADA',
    confirmadoEm: new Date().toISOString(),
  })
}

export function inativarRegraFiscalStorage(
  id: string,
): RegraFiscalNcmCest {
  const regra = buscarRegraFiscalStorage(id)

  if (!regra) {
    throw new Error('Regra fiscal não encontrada.')
  }

  return salvarRegraFiscalStorage({
    ...regra,
    status: 'INATIVA',
    confirmadoEm: undefined,
  })
}

function campoCompativel(regra: string, consulta?: string) {
  const valorRegra = texto(regra).toUpperCase()
  const valorConsulta = texto(consulta).toUpperCase()

  if (!valorConsulta) return true
  if (!valorRegra || valorRegra === 'TODAS' || valorRegra === '*') return true

  return valorRegra === valorConsulta
}

export function buscarRegraFiscalConfirmada(
  consulta: ConsultaRegraFiscal,
): RegraFiscalNcmCest | undefined {
  const ncm = normalizarNcm(consulta.ncm)
  const cest = normalizarCest(consulta.cest)

  if (ncm.length !== 8) return undefined

  return listarRegrasFiscaisStorage()
    .filter((regra) => regra.status === 'CONFIRMADA')
    .filter((regra) => regra.ncm === ncm)
    .filter((regra) => !regra.cest || !cest || regra.cest === cest)
    .filter((regra) => campoCompativel(regra.ufOrigem, consulta.ufOrigem))
    .filter((regra) => campoCompativel(regra.ufDestino, consulta.ufDestino))
    .filter(
      (regra) =>
        !consulta.destinacao || regra.destinacao === consulta.destinacao,
    )
    .filter(
      (regra) =>
        !consulta.regimeTributario ||
        regra.regimeTributario === consulta.regimeTributario,
    )
    .sort((a, b) => {
      const pontosA =
        (a.cest ? 4 : 0) +
        (a.ufOrigem !== 'TODAS' ? 2 : 0) +
        (a.ufDestino !== 'TODAS' ? 1 : 0)
      const pontosB =
        (b.cest ? 4 : 0) +
        (b.ufOrigem !== 'TODAS' ? 2 : 0) +
        (b.ufDestino !== 'TODAS' ? 1 : 0)

      return pontosB - pontosA
    })[0]
}
