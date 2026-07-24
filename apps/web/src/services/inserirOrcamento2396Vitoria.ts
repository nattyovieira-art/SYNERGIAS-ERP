const MARCADOR = 'SYNERGIAS_ORCAMENTO_2396_VITORIA_PRODUTOS_V311'

const ESPECIFICACOES = [
  ['7901210481', 4, 75.00, 'SACO DE LIXO 240L PRETO RESISTENTE 0.10M / 120X144CM C/50UN'],
  ['7901211330', 3, 28.90, 'LIMPADOR PERFUMADO ROMANCE/ORQUIDEA NEGRA 5L | GMRÃES'],
  ['7901210223', 3, 9.90, 'AGUA SANITÁRIA 5L | QMFEL'],
] as const

function normalizar(valor: unknown) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function inserirOrcamento2396Vitoria(
  vendasEntrada: any[],
  produtosEntrada: any[],
  clientesEntrada: any[],
  atualizar: (colecao: 'vendas', registro: any) => Promise<unknown>,
  recarregar: <T>(colecao: 'vendas') => Promise<{ data: T[] }>,
) {
  let vendas = Array.isArray(vendasEntrada) ? vendasEntrada : []
  const existente = vendas.find((venda) =>
    normalizar(venda?.tipo).includes('ORCAMENTO') &&
    String(venda?.numeroOrcamento || venda?.numero || '').replace(/\D/g, '') === '2396')
  if (existente?.marcadorImportacao === MARCADOR) return vendas

  const clientes = (Array.isArray(clientesEntrada) ? clientesEntrada : []).filter((cliente) =>
    normalizar(
      cliente?.razaoSocial || cliente?.nomeRazaoSocial ||
      cliente?.nomeFantasia || cliente?.nome,
    ).includes('CONDOMINIO DO RESIDENCIAL VITORIA'))
  if (!existente && clientes.length !== 1) {
    throw new Error(`Orçamento 2396 bloqueado: cliente Residencial Vitória retornou ${clientes.length} cadastros.`)
  }
  const cliente = clientes[0]
  const produtos = Array.isArray(produtosEntrada) ? produtosEntrada : []
  const itens = ESPECIFICACOES.map(([codigoBarras, quantidade, valorUnitario, descricaoDocumento], indice) => {
    const encontrados = produtos.filter((produto) =>
      String(produto?.codigoBarras || produto?.ean || '').replace(/\D/g, '') === codigoBarras)
    if (encontrados.length !== 1) {
      throw new Error(`Orçamento 2396 bloqueado: produto ${codigoBarras} retornou ${encontrados.length} cadastros.`)
    }
    const produto = encontrados[0]
    const codigo = String(produto?.codigo || produto?.codigoInterno || produto?.id || '')
    return {
      id: `2396-item-${indice + 1}`,
      produtoId: String(produto?.id || ''),
      codigo,
      codigoProduto: codigo,
      codigoBarras,
      descricao: String(produto?.descricao || produto?.nome || descricaoDocumento),
      descricaoHistorica: descricaoDocumento,
      unidade: String(produto?.unidade || produto?.unidadeMedida || 'Unidade'),
      quantidade,
      valorUnitario,
      precoUnitario: valorUnitario,
      descontoValor: 0,
      descontoPercentual: 0,
      valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
      custoUnitario: Number(produto?.custoMedioAtual || produto?.custo || 0),
      produtoVinculado: true,
      vinculoProdutoOrigem: 'CODIGO_BARRAS_EXATO',
    }
  })
  const subtotal = Number(itens.reduce((soma, item) => soma + item.valorTotal, 0).toFixed(2))
  if (subtotal !== 416.40) throw new Error(`Orçamento 2396 bloqueado: total calculado ${subtotal}.`)
  const agora = new Date().toISOString()
  const endereco = 'Rua Professor Freitas Cabral, 260 - Jardim Botânico - Porto Alegre/RS - CEP 90690-130'
  const orcamento = {
    ...existente,
    id: String(existente?.id || 'orcamento-historico-2396'),
    tipo: 'Orçamento',
    numeroOrcamento: '2396',
    vendedor: 'NATÁLIA VIEIRA',
    clienteId: String(existente?.clienteId || cliente?.id || cliente?.codigo || ''),
    clienteCodigo: String(existente?.clienteCodigo || cliente?.codigo || cliente?.id || ''),
    clienteNome: 'CONDOMÍNIO DO RESIDENCIAL VITÓRIA',
    clienteDocumento: String(existente?.clienteDocumento || cliente?.cnpj || '46127761'),
    clienteEmailNotaFiscal: 'FINANCEIRO@SYNERGIAS.COM.BR',
    emailEnvio: 'FINANCEIRO@SYNERGIAS.COM.BR',
    dataEmissao: '2026-07-01',
    dataEntrega: '2026-07-03',
    dataValidade: '2026-07-06',
    enderecoFaturamento: endereco,
    enderecoEntrega: endereco,
    itens,
    itensEditadosManual: true,
    subtotal,
    descontoValor: 0,
    frete: 0,
    outrosCustos: 0,
    totalFinal: subtotal,
    valorTotal: subtotal,
    status: 'ABERTO',
    statusOrcamento: 'Aberto',
    estoqueBaixado: false,
    marcadorImportacao: MARCADOR,
    criadoEm: existente?.criadoEm || agora,
    atualizadoEm: agora,
  }
  await atualizar('vendas', orcamento)
  const resposta = await recarregar<any>('vendas')
  vendas = Array.isArray(resposta.data) ? resposta.data : vendas
  const confirmado = vendas.find((venda) =>
    String(venda?.numeroOrcamento || '') === '2396' &&
    venda?.marcadorImportacao === MARCADOR)
  if (!confirmado || confirmado.itens?.length !== 3 || Number(confirmado.totalFinal) !== 416.40) {
    throw new Error('O MySQL não confirmou integralmente o orçamento 2396.')
  }
  return vendas
}
