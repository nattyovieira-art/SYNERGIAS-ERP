export type DiariaAgendaFinanceira = {
  id: string
  data: string
  funcionario: string
  valorDiaria: number
  descricao?: string
}

type ContaPagarDiaria = {
  id: string
  fornecedor: string
  documento: string
  descricao: string
  categoria: string
  emissao: string
  vencimento: string
  valor: number
  status: 'Em aberto' | 'Paga' | 'Cancelada'
  observacao?: string
  origem?: 'Agenda - Diária'
  origemAgendaId?: string
}

const STORAGE_CONTAS_PAGAR = 'synergias_contas_pagar'
export const EVENTO_CONTAS_PAGAR_ATUALIZADAS = 'synergias:contas-pagar-atualizadas'

function listarContas(): ContaPagarDiaria[] {
  try {
    const dados = JSON.parse(localStorage.getItem(STORAGE_CONTAS_PAGAR) || '[]')
    return Array.isArray(dados) ? dados : []
  } catch {
    return []
  }
}

function gravarContas(contas: ContaPagarDiaria[]) {
  localStorage.setItem(STORAGE_CONTAS_PAGAR, JSON.stringify(contas))
  window.dispatchEvent(new CustomEvent(EVENTO_CONTAS_PAGAR_ATUALIZADAS))
}

export function sincronizarDespesaDiaria(diaria: DiariaAgendaFinanceira) {
  const contas = listarContas()
  const indice = contas.findIndex((conta) => conta.origemAgendaId === diaria.id)
  const existente = indice >= 0 ? contas[indice] : undefined
  if (existente?.status === 'Paga') {
    throw new Error('Esta diária já foi paga e não pode ser alterada pela Agenda.')
  }

  const conta: ContaPagarDiaria = {
    ...existente,
    id: existente?.id || `cp-diaria-${diaria.id}`,
    fornecedor: diaria.funcionario.trim(),
    documento: `DIARIA-${diaria.id}`,
    descricao: `Diária de ${diaria.funcionario.trim()}`,
    categoria: 'Pessoal',
    emissao: diaria.data,
    vencimento: diaria.data,
    valor: 50,
    status: existente?.status === 'Cancelada' ? 'Em aberto' : existente?.status || 'Em aberto',
    observacao: diaria.descricao?.trim() || undefined,
    origem: 'Agenda - Diária',
    origemAgendaId: diaria.id,
  }

  if (indice >= 0) contas[indice] = conta
  else contas.unshift(conta)
  gravarContas(contas)
}

export function excluirDespesaDiaria(agendaId: string) {
  const contas = listarContas()
  const conta = contas.find((item) => item.origemAgendaId === agendaId)
  if (conta?.status === 'Paga') {
    throw new Error('Esta diária já foi paga e não pode ser excluída pela Agenda.')
  }
  gravarContas(contas.filter((item) => item.origemAgendaId !== agendaId))
}
