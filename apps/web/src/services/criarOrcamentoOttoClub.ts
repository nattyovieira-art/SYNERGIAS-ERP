const MARCADOR = 'SYNERGIAS_ORCAMENTO_OTTO_CLUB_20260723'

const ESPECIFICACOES = [
  ['7901210407', 2], ['7901211476', 4], ['7901210028', 2],
  ['7901211048', 2], ['7901211064', 2], ['7901211283', 4],
  ['7901211301', 2], ['7901211328', 3], ['7901210529', 20],
  ['7901210163', 4], ['7901210507', 3], ['7901210980', 10],
  ['7901211102', 15], ['7901210200', 2], ['7901210006', 3],
  ['7901210558', 2], ['7901211179', 1], ['7901210921', 1],
] as const

function normalizar(valor: unknown) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

function dataLocal(data = new Date()) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function somarDias(dataIso: string, dias: number) {
  const data = new Date(`${dataIso}T12:00:00`)
  data.setDate(data.getDate() + dias)
  return dataLocal(data)
}

export async function criarOrcamentoOttoClub(
  vendas: any[],
  produtos: any[],
  clientes: any[],
  atualizar: (colecao: 'vendas', registro: any) => Promise<unknown>,
  recarregar: <T>(colecao: 'vendas') => Promise<{ data: T[] }>,
) {
  if (vendas.some((venda) => venda?.marcadorInstalacao === MARCADOR)) return vendas

  const encontradosCliente = clientes.filter((cliente) =>
    normalizar(
      cliente?.razaoSocial || cliente?.nomeRazaoSocial ||
      cliente?.nomeFantasia || cliente?.nome,
    ).includes('OTTO CLUB'),
  )
  if (encontradosCliente.length !== 1) {
    throw new Error(`Orçamento OTTO CLUB bloqueado: foram encontrados ${encontradosCliente.length} clientes.`)
  }
  const cliente = encontradosCliente[0]

  const itens = ESPECIFICACOES.map(([codigoBarras, quantidade], indice) => {
    const encontrados = produtos.filter(
      (produto) => String(produto?.codigoBarras || '').replace(/\D/g, '') === codigoBarras,
    )
    if (encontrados.length !== 1) {
      throw new Error(`Orçamento OTTO CLUB bloqueado: código ${codigoBarras} encontrou ${encontrados.length} produtos.`)
    }
    const produto = encontrados[0]
    const valorUnitario = Number(produto?.vendaVarejo || produto?.precoVenda || produto?.valorVenda || 0)
    if (!(valorUnitario > 0)) {
      throw new Error(`Orçamento OTTO CLUB bloqueado: produto ${codigoBarras} está sem preço de varejo.`)
    }
    const custoUnitario = Number(produto?.custoMedioAtual || produto?.custo || produto?.ultimoCustoCompra || 0)
    const codigoProduto = String(produto?.codigo || produto?.codigoInterno || produto?.id || '')
    return {
      id: `otto-item-${indice + 1}-${Date.now()}`,
      produtoId: String(produto?.id || ''),
      codigo: codigoProduto,
      codigoProduto,
      codigoBarras,
      descricao: String(produto?.descricao || produto?.nome || ''),
      unidade: String(produto?.unidade || produto?.unidadeMedida || 'UN'),
      quantidade,
      valorUnitario,
      descontoValor: 0,
      descontoPercentual: 0,
      valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
      custoUnitario,
      custoTotal: Number((quantidade * custoUnitario).toFixed(2)),
      produtoVinculado: true,
      vinculoProdutoOrigem: 'CODIGO_BARRAS_EXATO',
    }
  })

  const numeros = vendas
    .filter((venda) => normalizar(venda?.tipo).includes('ORCAMENTO'))
    .map((venda) => Number(String(venda?.numeroOrcamento || '').replace(/\D/g, '')))
    .filter(Number.isFinite)
  const numeroOrcamento = String((numeros.length ? Math.max(...numeros) : 0) + 1)
  const hoje = dataLocal()
  const agora = new Date().toISOString()
  const subtotal = Number(itens.reduce((soma, item) => soma + item.valorTotal, 0).toFixed(2))
  const custoTotal = Number(itens.reduce((soma, item) => soma + item.custoTotal, 0).toFixed(2))
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `orcamento-otto-${Date.now()}`
  const endereco = [cliente?.endereco, cliente?.numero].filter(Boolean).join(', ')

  const orcamento = {
    id,
    tipo: 'Orçamento',
    numeroOrcamento,
    vendedor: 'Natália Vieira',
    clienteId: String(cliente?.id || cliente?.codigo || ''),
    clienteCodigo: String(cliente?.codigo || cliente?.id || ''),
    clienteNome: String(cliente?.razaoSocial || cliente?.nomeRazaoSocial || cliente?.nomeFantasia || ''),
    clienteDocumento: String(cliente?.cnpj || cliente?.documento || ''),
    clienteEmailNotaFiscal: String(cliente?.email || ''),
    emailEnvio: String(cliente?.email || ''),
    clienteInscricaoEstadual: String(cliente?.inscricaoEstadual || cliente?.ie || ''),
    dataEmissao: hoje,
    dataEntrega: somarDias(hoje, 2),
    dataValidade: somarDias(hoje, 5),
    enderecoFaturamento: endereco,
    enderecoEntrega: String(cliente?.enderecoEntrega || endereco),
    itens,
    itensEditadosManual: true,
    descontoValor: 0,
    descontoInformado: 0,
    descontoCalculado: 0,
    frete: 0,
    outrosCustos: 0,
    subtotal,
    totalFinal: subtotal,
    valorTotal: subtotal,
    custoTotal,
    margemValor: Number((subtotal - custoTotal).toFixed(2)),
    pagamentos: [],
    parcelas: [],
    observacoes: '',
    status: 'ABERTO',
    statusOrcamento: 'Aberto',
    criadoEm: agora,
    atualizadoEm: agora,
    marcadorInstalacao: MARCADOR,
  }

  await atualizar('vendas', orcamento)
  const confirmacao = await recarregar<any>('vendas')
  const confirmadas = Array.isArray(confirmacao.data) ? confirmacao.data : []
  const gravado = confirmadas.find(
    (venda) => String(venda?.id) === id && String(venda?.numeroOrcamento) === numeroOrcamento,
  )
  if (!gravado || gravado.itens?.length !== ESPECIFICACOES.length) {
    throw new Error('O MySQL não confirmou integralmente o orçamento OTTO CLUB.')
  }
  return confirmadas
}
