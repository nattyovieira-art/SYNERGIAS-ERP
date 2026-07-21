import type { ContaReceber, LancamentoOFX } from '../types/Financeiro'

const STORAGE_CONTAS_RECEBER = 'synergias_contas_receber'
const STORAGE_LANCAMENTOS_OFX = 'synergias_lancamentos_ofx'


export type AtualizarRecebimentoManualInput = {
  contaId: string
  valorPrincipal: number
  juros?: number
  desconto?: number
  dataRecebimento: string
  dataVencimento: string
  formaPagamento?: string
  tipoCobranca?: string
  bancoCobranca?: string
  contaRecebimento?: string
  observacao?: string
}

export type FinalizarRecebimentoManualInput = {
  contaId: string
  valorPrincipal: number
  juros?: number
  desconto?: number
  dataRecebimento: string
  contaRecebimento?: string
  observacao?: string
}

function gerarDataAtual() {
  return new Date().toISOString()
}

function gerarId(prefixo: string) {
  return `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function listarContasReceberStorage(): ContaReceber[] {
  if (typeof window === 'undefined') return []

  try {
    const dados = window.localStorage.getItem(STORAGE_CONTAS_RECEBER)

    if (!dados) return []

    const contas = JSON.parse(dados)

    return Array.isArray(contas) ? (contas as ContaReceber[]) : []
  } catch {
    return []
  }
}

export function salvarContasReceberStorage(contas: ContaReceber[]) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(STORAGE_CONTAS_RECEBER, JSON.stringify(contas))
}

export function salvarContaReceberStorage(conta: ContaReceber) {
  const contas = listarContasReceberStorage()
  const indice = contas.findIndex((item) => item.id === conta.id)

  const contaAtualizada: ContaReceber = {
    ...conta,
    id: conta.id || gerarId('conta_receber'),
    criadoEm: conta.criadoEm || gerarDataAtual(),
    atualizadoEm: gerarDataAtual(),
  }

  if (indice >= 0) {
    contas[indice] = contaAtualizada
  } else {
    contas.unshift(contaAtualizada)
  }

  salvarContasReceberStorage(contas)
}

export function excluirContaReceberStorage(id: string) {
  const contas = listarContasReceberStorage()
  const contasAtualizadas = contas.filter((conta) => conta.id !== id)

  salvarContasReceberStorage(contasAtualizadas)
}

export function receberContaManualStorage(
  contaId: string,
  valorRecebido: number,
  dataRecebimento: string,
  observacao?: string,
) {
  const contas = listarContasReceberStorage()

  const contasAtualizadas = contas.map((conta) => {
    if (conta.id !== contaId) return conta

    const novoValorRecebido =
      Number(conta.valorRecebido || 0) + Number(valorRecebido || 0)

    const novoSaldo = Math.max(Number(conta.valorOriginal || 0) - novoValorRecebido, 0)

    let novoStatus: ContaReceber['status'] = conta.status

    if (novoSaldo <= 0) {
      novoStatus = 'Paga'
    } else if (novoValorRecebido > 0) {
      novoStatus = 'Parcialmente paga'
    } else {
      novoStatus = 'Aberta'
    }

    return {
      ...conta,
      valorRecebido: novoValorRecebido,
      saldoAberto: novoSaldo,
      dataRecebimento,
      observacao: observacao || conta.observacao,
      status: novoStatus,
      atualizadoEm: gerarDataAtual(),
    }
  })

  salvarContasReceberStorage(contasAtualizadas)
}


export function finalizarRecebimentoManualStorage(
  input: FinalizarRecebimentoManualInput,
) {
  const contas = listarContasReceberStorage()
  const valorPrincipal = Math.max(Number(input.valorPrincipal || 0), 0)
  const juros = Math.max(Number(input.juros || 0), 0)
  const desconto = Math.max(Number(input.desconto || 0), 0)

  const contasAtualizadas = contas.map((conta) => {
    if (conta.id !== input.contaId) return conta

    const saldoAtual = Number(conta.saldoAberto || conta.valorOriginal || 0)
    const valorBaixado = Math.min(valorPrincipal, saldoAtual)
    const novoSaldo = Math.max(saldoAtual - valorBaixado, 0)
    const valorEfetivamenteRecebido = Math.max(valorPrincipal + juros - desconto, 0)
    const novoValorRecebido =
      Number(conta.valorRecebido || 0) + valorEfetivamenteRecebido

    let novoStatus: ContaReceber['status'] = 'Aberta'
    if (novoSaldo <= 0) novoStatus = 'Paga'
    else if (novoValorRecebido > 0 || desconto > 0) novoStatus = 'Parcialmente paga'

    return {
      ...conta,
      valorRecebido: novoValorRecebido,
      saldoAberto: novoSaldo,
      dataRecebimento: input.dataRecebimento,
      jurosRecebidos: Number(conta.jurosRecebidos || 0) + juros,
      descontosConcedidos: Number(conta.descontosConcedidos || 0) + desconto,
      contaRecebimento: input.contaRecebimento || conta.contaRecebimento,
      observacao: input.observacao || conta.observacao,
      status: novoStatus,
      atualizadoEm: gerarDataAtual(),
    }
  })

  salvarContasReceberStorage(contasAtualizadas)
  return contasAtualizadas.find((conta) => conta.id === input.contaId)
}

export function atualizarRecebimentoManualStorage(
  input: AtualizarRecebimentoManualInput,
) {
  const contas = listarContasReceberStorage()
  const valorPrincipal = Math.max(Number(input.valorPrincipal || 0), 0)
  const juros = Math.max(Number(input.juros || 0), 0)
  const desconto = Math.max(Number(input.desconto || 0), 0)

  const contasAtualizadas = contas.map((conta) => {
    if (conta.id !== input.contaId) return conta

    const valorOriginal = Math.max(Number(conta.valorOriginal || 0), 0)
    const valorPrincipalAplicado = Math.min(valorPrincipal, valorOriginal)
    const novoSaldo = Math.max(valorOriginal - valorPrincipalAplicado, 0)
    const valorEfetivamenteRecebido = Math.max(valorPrincipal + juros - desconto, 0)

    let novoStatus: ContaReceber['status'] = 'Aberta'
    if (novoSaldo <= 0 && (valorPrincipal > 0 || desconto > 0)) novoStatus = 'Paga'
    else if (valorPrincipal > 0 || desconto > 0) novoStatus = 'Parcialmente paga'

    return {
      ...conta,
      dataVencimento: input.dataVencimento || conta.dataVencimento,
      dataRecebimento: input.dataRecebimento,
      valorPrincipalRecebido: valorPrincipal,
      valorRecebido: valorEfetivamenteRecebido,
      saldoAberto: novoSaldo,
      jurosRecebidos: juros,
      descontosConcedidos: desconto,
      formaPagamento: input.formaPagamento || '',
      tipoCobranca: input.tipoCobranca || '',
      bancoCobranca: input.bancoCobranca || '',
      contaRecebimento: input.contaRecebimento || '',
      observacao: input.observacao || '',
      status: novoStatus,
      conciliado: novoStatus === 'Paga',
      atualizadoEm: gerarDataAtual(),
    }
  })

  salvarContasReceberStorage(contasAtualizadas)
  return contasAtualizadas.find((conta) => conta.id === input.contaId)
}

export function listarLancamentosOFXStorage(): LancamentoOFX[] {
  if (typeof window === 'undefined') return []

  try {
    const dados = window.localStorage.getItem(STORAGE_LANCAMENTOS_OFX)

    if (!dados) return []

    const lancamentos = JSON.parse(dados)

    return Array.isArray(lancamentos) ? (lancamentos as LancamentoOFX[]) : []
  } catch {
    return []
  }
}

export function salvarLancamentosOFXStorage(lancamentos: LancamentoOFX[]) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(STORAGE_LANCAMENTOS_OFX, JSON.stringify(lancamentos))
}

export function adicionarLancamentosOFXStorage(lancamentos: LancamentoOFX[]) {
  const atuais = listarLancamentosOFXStorage()

  const novosLancamentos = lancamentos.map((lancamento) => ({
    ...lancamento,
    id: lancamento.id || gerarId('ofx'),
    criadoEm: lancamento.criadoEm || gerarDataAtual(),
    atualizadoEm: gerarDataAtual(),
  }))

  salvarLancamentosOFXStorage([...novosLancamentos, ...atuais])
}

export function marcarLancamentoComoConciliadoStorage(
  lancamentoId: string,
  contaReceberId: string,
) {
  const lancamentos = listarLancamentosOFXStorage()

  const atualizados = lancamentos.map((lancamento) => {
    if (lancamento.id !== lancamentoId) return lancamento

    return {
      ...lancamento,
      conciliado: true,
      contaReceberId,
      atualizadoEm: gerarDataAtual(),
    }
  })

  salvarLancamentosOFXStorage(atualizados)
}

export function conciliarContaReceberStorage(
  contaReceberId: string,
  valorRecebido: number,
  dataRecebimento: string,
  observacao?: string,
) {
  receberContaManualStorage(contaReceberId, valorRecebido, dataRecebimento, observacao)

  const contas = listarContasReceberStorage()

  const atualizadas = contas.map((conta) => {
    if (conta.id !== contaReceberId) return conta

    return {
      ...conta,
      conciliado: true,
      atualizadoEm: gerarDataAtual(),
    }
  })

  salvarContasReceberStorage(atualizadas)
}

export function limparFinanceiroStorage() {
  if (typeof window === 'undefined') return

  window.localStorage.removeItem(STORAGE_CONTAS_RECEBER)
  window.localStorage.removeItem(STORAGE_LANCAMENTOS_OFX)
}