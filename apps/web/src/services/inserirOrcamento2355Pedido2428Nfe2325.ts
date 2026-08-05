const MARCADOR = 'SYNERGIAS_2355_2428_NFE2325_DESCRICAO_V310'
const CHAVE_NFE = '43260650432175000146550010000023251100024282'

const ITENS = [
  ['SACO DE LIXO 100L PRETO REFORCADO 0.08M / 75X90CM C/100UN', 1, 48.90, '39232110', '5102'],
  ['SACO DE LIXO 240L PRETO RESISTENTE 0.10M / 120X144CM C/50UN', 1, 75.00, '38089419', '5102'],
  ['VASSOURA USO GERAL C/ CABO 140CM PFPRO', 1, 16.20, '96031000', '5102'],
  ['LIMPADOR CONC. ALGODAO 120ML COALA', 1, 11.90, '34029029', '5102'],
  ['REFIL DIFUSOR 16ML P/APARELHO ELETRICO BOM AR', 1, 24.65, '33074900', '5102'],
  ['MOP UMIDO 190G MOX', 4, 12.55, '96031000', '5102'],
  ['AGUA SANITARIA 5L QMFEL', 1, 9.90, '28289011', '5102'],
  ['DETERGENTE LIQUIDO 500ML LIMPOL', 3, 2.45, '34052000', '5102'],
  ['ESPONJA DUPLA FACE S /PELICULA BTTN', 5, 0.85, '34023990', '5102'],
  ['SAPONACEO CREMOSO ORIGINAL 450ML CIF', 1, 16.90, '34054000', '5102'],
  ['DESINFETANTE FESTA DAS FLORES LAVANDA 3,8L AJAX', 1, 42.90, '34025000', '5102'],
  ['PAPEL HIGIENICO VIP 12 ROLOS 30M FOLHA DUPLA PERSONAL', 1, 19.89, '48181000', '5405'],
] as const

function normalizar(valor: unknown) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}
function descricao(produto: any) {
  return String(produto?.descricao || produto?.nome || produto?.nomeProduto || '').trim()
}
function localizar(produtos: any[], descricaoXml: string) {
  const alvo = normalizar(descricaoXml)
  const exatos = produtos.filter((produto) => normalizar(descricao(produto)) === alvo)
  if (exatos.length === 1) return exatos[0]
  const tokens = new Set(alvo.split(' ').filter((token) => token.length > 1))
  const candidatos = produtos.map((produto) => {
    const atual = normalizar(descricao(produto))
    const tokensAtuais = new Set(atual.split(' ').filter((token) => token.length > 1))
    const comuns = [...tokens].filter((token) => tokensAtuais.has(token)).length
    return { produto, cobertura: comuns / Math.max(tokens.size, 1), diferenca: Math.abs(atual.length - alvo.length) }
  }).filter((item) => item.cobertura >= 0.78)
    .sort((a, b) => b.cobertura - a.cobertura || a.diferenca - b.diferenca)
  if (!candidatos.length) return undefined
  if (candidatos[1] && candidatos[0].cobertura === candidatos[1].cobertura &&
      candidatos[0].diferenca === candidatos[1].diferenca) return undefined
  return candidatos[0].produto
}
function montarItens(produtos: any[]) {
  return ITENS.map(([descricaoXml, quantidade, valorUnitario, ncm, cfop], indice) => {
    const produto = localizar(produtos, descricaoXml)
    const codigo = String(produto?.codigo || produto?.codigoInterno || '')
    return {
      id: `2355-2428-xml2325-${indice + 1}`,
      produtoId: String(produto?.id || ''),
      codigo,
      codigoProduto: codigo,
      codigoBarras: String(produto?.codigoBarras || ''),
      descricao: produto ? descricao(produto) : descricaoXml,
      descricaoHistorica: descricaoXml,
      unidade: String(produto?.unidade || produto?.unidadeMedida || 'UN'),
      quantidade,
      valorUnitario,
      precoUnitario: valorUnitario,
      descontoValor: 0,
      descontoPercentual: 0,
      valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
      produtoVinculado: Boolean(produto),
      vinculoProdutoOrigem: produto ? 'DESCRICAO_NORMALIZADA' : 'NAO_VINCULADO',
      ncm: String(produto?.ncm || ncm),
      cfop: String(produto?.cfopDentroEstado || produto?.cfop || cfop),
    }
  })
}

export async function inserirOrcamento2355Pedido2428Nfe2325(
  vendasEntrada: any[],
  produtosEntrada: any[],
  atualizar: (colecao: 'vendas', registro: any) => Promise<unknown>,
  recarregar: <T>(colecao: 'vendas') => Promise<{ data: T[] }>,
) {
  let vendas = Array.isArray(vendasEntrada) ? vendasEntrada : []
  if (vendas.some((venda) => venda?.marcadorImportacao === MARCADOR)) return vendas
  const conflito = vendas.find((venda) =>
    String(venda?.chaveAcessoNotaFiscal || '') === CHAVE_NFE &&
    String(venda?.numeroPedido || '').replace(/\D/g, '') !== '2428')
  if (conflito) throw new Error('NF-e 2325 já está vinculada a outro pedido.')

  const itens = montarItens(Array.isArray(produtosEntrada) ? produtosEntrada : [])
  const agora = new Date().toISOString()
  const orcamentoAtual = vendas.find((venda) =>
    normalizar(venda?.tipo).includes('ORCAMENTO') &&
    String(venda?.numeroOrcamento || '').replace(/\D/g, '') === '2355')
  const pedidoAtual = vendas.find((venda) =>
    normalizar(venda?.tipo) === 'PEDIDO' &&
    String(venda?.numeroPedido || '').replace(/\D/g, '') === '2428')
  const orcamentoId = String(orcamentoAtual?.id || 'orcamento-historico-2355')
  const pedidoId = String(pedidoAtual?.id || 'pedido-historico-2428')
  const comum = {
    vendedor: String(pedidoAtual?.vendedor || orcamentoAtual?.vendedor || 'Natália Vieira'),
    clienteNome: 'CONDOMINIO EDIFICIO RESIDENZA VILLA ASOLO',
    clienteDocumento: '05420792000177',
    clienteEmail: 'financeiro@synergias.com.br',
    dataEmissao: '2026-06-23',
    itens,
    subtotal: 328.04,
    descontoValor: 0,
    frete: 0,
    totalFinal: 328.04,
    valorTotal: 328.04,
    itensEditadosManual: true,
    importacaoHistorica: true,
    estoqueBaixado: false,
    movimentarEstoqueHistorico: false,
    movimentacaoEstoqueHistoricaAutorizada: false,
    marcadorImportacao: MARCADOR,
    atualizadoEm: agora,
  }
  const orcamento = {
    ...orcamentoAtual,
    ...comum,
    id: orcamentoId,
    tipo: 'Orçamento',
    numeroOrcamento: '2355',
    numeroPedido: undefined,
    statusOrcamento: 'Gerado',
    aprovadoEm: orcamentoAtual?.aprovadoEm || agora,
    pedidoGeradoId: pedidoId,
    pedidoGeradoEm: agora,
    statusNotaFiscal: 'Pendente',
    parcelas: [],
    criadoEm: orcamentoAtual?.criadoEm || agora,
  }
  const pedido = {
    ...pedidoAtual,
    ...comum,
    id: pedidoId,
    tipo: 'Pedido',
    numeroOrcamento: undefined,
    numeroPedido: '2428',
    orcamentoOrigemId: orcamentoId,
    orcamentoOrigemNumero: '2355',
    statusPedido: 'Concluído',
    logisticaStatus: 'Entregue',
    dataEntregaRealizada: '2026-06-23',
    entregaConfirmadaSemNovaBaixa: true,
    statusNotaFiscal: 'Autorizada',
    numeroNotaFiscal: '2325',
    serieNotaFiscal: '1',
    chaveAcessoNotaFiscal: CHAVE_NFE,
    protocoloNotaFiscal: '243260209719145',
    dataEmissaoNotaFiscal: '2026-06-23T17:56:33-03:00',
    ambienteNotaFiscal: 'PRODUCAO',
    cStatNotaFiscal: '100',
    formaPagamento: 'BOLETO BANCO CORA',
    tipoCobranca: 'BOLETO BANCO CORA',
    bancoCobranca: 'Cora',
    statusBoleto: 'Vencido',
    parcelas: [{
      numero: 1,
      vencimento: '2026-07-15',
      valor: 328.04,
      numeroBoleto: '001',
      tipoCobranca: 'BOLETO BANCO CORA',
      bancoCobranca: 'Cora',
      statusBoleto: 'Vencido',
    }],
    conciliado: false,
    criadoEm: pedidoAtual?.criadoEm || agora,
  }

  await atualizar('vendas', orcamento)
  await atualizar('vendas', pedido)
  const resposta = await recarregar<any>('vendas')
  vendas = Array.isArray(resposta.data) ? resposta.data : vendas
  const confirmado = vendas.find((venda) =>
    String(venda?.numeroPedido || '') === '2428' &&
    String(venda?.chaveAcessoNotaFiscal || '') === CHAVE_NFE)
  if (!confirmado || confirmado.itens?.length !== 12 || confirmado.parcelas?.length !== 1) {
    throw new Error('O MySQL não confirmou integralmente o pedido histórico 2428.')
  }
  return vendas
}
