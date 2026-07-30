export type RegistroVendaEstado = {
  id?: string; tipo?: string; numeroOrcamento?: string; numeroPedido?: string; numero?: string; codigo?: string
  status?: string; statusOrcamento?: string; aprovado?: boolean; reprovado?: boolean; convertido?: boolean
  pedidoGerado?: boolean; aprovadoEm?: string; reprovadoEm?: string; pedidoId?: string; pedidoGeradoId?: string
  pedidoGeradoEm?: string; orcamentoOrigemId?: string; orcamentoOrigemNumero?: string; itens?: unknown[]
}

export type EstadoRealOrcamento = {
  situacao: 'aberto' | 'aprovado' | 'reprovado' | 'convertido'
  aberto: boolean; aprovado: boolean; reprovado: boolean; convertido: boolean
  pedidoReal?: RegistroVendaEstado; pedidosReais: RegistroVendaEstado[]; vinculoUnico: boolean
  podeEditar: boolean; podeImprimir: boolean; podeAprovar: boolean; podeReprovar: boolean
  podeGerarPedido: boolean; podeExcluir: boolean
}

function normalizar(valor: unknown) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function numeroLogico(valor: unknown) {
  return String(valor || '').replace(/\D/g, '').replace(/^0+/, '')
}

export function ehPedidoReal(registro: RegistroVendaEstado) {
  return normalizar(registro.tipo) === 'pedido' && Boolean(numeroLogico(registro.numeroPedido))
}

export function localizarPedidosReaisDoOrcamento(orcamento: RegistroVendaEstado, vendas: RegistroVendaEstado[]) {
  const idOrcamento = String(orcamento.id || '').trim()
  const numeroOrcamento = numeroLogico(orcamento.numeroOrcamento || orcamento.numero || orcamento.codigo)
  return vendas.filter((registro) => {
    if (!ehPedidoReal(registro)) return false
    if (idOrcamento && String(registro.id || '').trim() === idOrcamento) return false
    const origemId = String(registro.orcamentoOrigemId || '').trim()
    const origemNumero = numeroLogico(registro.orcamentoOrigemNumero)
    // Campos copiados no Orçamento por importações antigas não provam conversão.
    // Com ID interno disponível, somente o vínculo ID -> ID é inequívoco.
    const pedidoGeradoId = String(orcamento.pedidoGeradoId || orcamento.pedidoId || '').trim()
    const numeroPedidoGerado = numeroLogico(orcamento.numeroPedido)
    const numeroOrcamentoLegado = numeroLogico(registro.numeroOrcamento)
    return Boolean(
      (idOrcamento && origemId === idOrcamento) ||
      (pedidoGeradoId && String(registro.id || '').trim() === pedidoGeradoId) ||
      (numeroPedidoGerado && numeroLogico(registro.numeroPedido) === numeroPedidoGerado) ||
      (numeroOrcamento && origemNumero === numeroOrcamento) ||
      (numeroOrcamento && numeroOrcamentoLegado === numeroOrcamento)
    )
  })
}

export function determinarEstadoRealOrcamento(orcamento: RegistroVendaEstado, vendas: RegistroVendaEstado[]): EstadoRealOrcamento {
  const pedidosReais = localizarPedidosReaisDoOrcamento(orcamento, vendas)
  const convertido = pedidosReais.length > 0
  const status = normalizar(orcamento.statusOrcamento || orcamento.status || 'aberto')
  const reprovado = !convertido && (orcamento.reprovado === true || Boolean(orcamento.reprovadoEm) || status.includes('reprov'))
  const aprovado = !convertido && !reprovado && (orcamento.aprovado === true || Boolean(orcamento.aprovadoEm) || status.includes('aprov'))
  const aberto = !convertido && !aprovado && !reprovado && !status.includes('cancel')
  const possuiDadosValidos = Boolean(orcamento.id || orcamento.numeroOrcamento || orcamento.itens?.length)
  return {
    situacao: convertido ? 'convertido' : reprovado ? 'reprovado' : aprovado ? 'aprovado' : 'aberto',
    aberto, aprovado, reprovado, convertido,
    pedidoReal: pedidosReais.length === 1 ? pedidosReais[0] : undefined,
    pedidosReais, vinculoUnico: pedidosReais.length === 1,
    podeEditar: aberto, podeImprimir: possuiDadosValidos,
    podeAprovar: aberto, podeReprovar: aberto, podeGerarPedido: aprovado, podeExcluir: !convertido,
  }
}

export function normalizarNovoOrcamentoImportado<T extends RegistroVendaEstado>(registro: T): T {
  const normalizado = { ...registro } as T & Record<string, unknown>
  Object.assign(normalizado, { tipo: 'Orçamento', status: 'ABERTO', statusOrcamento: 'Aberto', aprovado: false, reprovado: false, convertido: false, pedidoGerado: false })
  for (const campo of ['numeroPedido', 'pedidoId', 'pedidoGeradoId', 'pedidoGeradoEm', 'aprovadoEm', 'reprovadoEm']) delete normalizado[campo]
  return normalizado as T
}
