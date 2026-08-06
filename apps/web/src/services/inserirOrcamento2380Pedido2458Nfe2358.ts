import { DANFE_PDF_NFE_2358_PEDIDO_2458_BASE64, XML_NFE_2358_PEDIDO_2458 } from './documentosNfe2358Pedido2458'

const MARCADOR = 'SYNERGIAS_2380_2458_NFE2358_XML_DANFE_V310'

const ITENS = [
  ['ALCOOL GEL 70 5L FLOPS', 1, 35.90, '38089419', '5102'],
  ['ALCOOL LIQUIDO 70 1L FLOPS', 3, 6.25, '38089419', '5102'],
  ['LIMPADOR CONC. CAPIM LIMAO 120ML COALA', 3, 12.99, '34029029', '5102'],
  ['BOBINA 200 SACOS 30CMX40CM PETCAO', 2, 17.90, '39232190', '5102'],
  ['MOP UMIDO 190G MOX', 3, 12.55, '96031000', '5102'],
  ['PAPEL HIGIENICO VIP 12 ROLOS 30M FOLHA DUPLA PERSONAL', 3, 19.89, '48181000', '5405'],
  ['PAPEL TOALHA INTERFOLHADO 100% CELULOSE LIMPITO', 15, 11.60, '48182000', '5405'],
  ['AGUA SANITARIA 5L QMFEL', 3, 8.90, '28289011', '5102'],
  ['DETERGENTE LIMPEZA PESADA 5L CLEAN', 3, 36.90, '34029039', '5102'],
  ['ESPONJA LA DE ACO C/8UN 45G ASSOLAN', 5, 2.30, '73231000', '5102'],
  ['SACO DE LIXO 240L PRETO RESISTENTE 0.10M / 120X144CM C/50UN', 3, 75.00, '38089419', '5102'],
  ['SACO DE LIXO 100L PRETO REFORCADO 0.08M / 75X90CM C/100UN', 3, 48.90, '39232110', '5102'],
  ['LIMPADOR PERFUMADO LIRIO E BAUNILHA C/ALCOOL 5L GMRAES', 2, 28.90, '34023990', '5102'],
  ['CABO CHAPA ACO 140CM C/ROSCA PFPRO', 2, 8.50, '73269090', '5102'],
  ['SACO DE LIXO 240L AZUL REFORCADO 0.08M / 100X144CM C/50UN', 3, 68.70, '39232190', '5102'],
  ['FIBRA VEGETAL USO GERAL SLIM NB', 5, 1.30, '68053090', '5102'],
  ['VASSOURA DE NYLON BELLA S/CABO DLCN', 1, 6.30, '96031000', '5102'],
  ['ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO BTTN', 5, 0.65, '68053090', '5102'],
  ['DETERGENTE NEUTRO/CRISTAL 5L BRILHA SUL', 1, 16.99, '38089419', '5102'],
  ['SACO DE LIXO 60L PRETO FLEX 0.02M/60X70CM C/100UN', 2, 12.40, '39232190', '5102'],
  ['LIMPA VIDROS SPRAY 400 ML JIMO', 1, 14.50, '34029090', '5102'],
  ['SABONETE LIQUIDO DOVE 5L SUAVETOK', 1, 15.90, '34013000', '5405'],
] as const

function normalizar(valor: unknown) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\b(GUIMARAES|GMRAES)\b/g, 'GMRAES')
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
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
    const atuais = new Set(atual.split(' ').filter((token) => token.length > 1))
    const comuns = [...tokens].filter((token) => atuais.has(token)).length
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
    const codigo = String(produto?.codigo || produto?.codigoInterno || '').trim()
    return {
      id: `2380-2458-xml2358-${indice + 1}`,
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

export async function inserirOrcamento2380Pedido2458Nfe2358(
  vendasEntrada: any[],
  produtosEntrada: any[],
  atualizar: (colecao: 'vendas', registro: any) => Promise<unknown>,
  recarregar: <T>(colecao: 'vendas') => Promise<{ data: T[] }>,
) {
  let vendas = Array.isArray(vendasEntrada) ? vendasEntrada : []
  const pedidoJaCompleto = vendas.find((venda) =>
    String(venda?.numeroPedido || '').replace(/\D/g, '') === '2458' &&
    String(venda?.chaveAcessoNotaFiscal || '') === '43260650432175000146550010000023581100024585' &&
    Boolean(String(venda?.xmlNotaFiscal || '').trim()) &&
    Boolean(String(venda?.danfePdf || '').trim()) &&
    venda?.marcadorImportacao === MARCADOR)
  if (pedidoJaCompleto) return vendas
  const conflitoNfe = vendas.find((venda) =>
    String(venda?.chaveAcessoNotaFiscal || '') === '43260650432175000146550010000023581100024585' &&
    String(venda?.numeroPedido || '').replace(/\D/g, '') !== '2458')
  if (conflitoNfe) throw new Error('NF-e 2358 já está ligada a outro pedido.')

  const produtos = Array.isArray(produtosEntrada) ? produtosEntrada : []
  const itens = montarItens(produtos)
  const agora = new Date().toISOString()
  const orcamentoExistente = vendas.find((venda) =>
    normalizar(venda?.tipo).includes('ORCAMENTO') &&
    String(venda?.numeroOrcamento || '').replace(/\D/g, '') === '2380')
  const pedidoExistente = vendas.find((venda) =>
    normalizar(venda?.tipo) === 'PEDIDO' &&
    String(venda?.numeroPedido || '').replace(/\D/g, '') === '2458')
  const orcamentoId = String(orcamentoExistente?.id || 'orcamento-historico-2380')
  const pedidoId = String(pedidoExistente?.id || 'pedido-historico-2458')
  const comum = {
    vendedor: String(pedidoExistente?.vendedor || orcamentoExistente?.vendedor || 'Natália Vieira'),
    clienteNome: 'CONDOMINIO RESIDENCIAL CARAVAGGIO',
    clienteDocumento: '34151066000102',
    clienteEmail: 'FINANCEIRO@SYNERGIAS.COM.BR',
    dataEmissao: '2026-06-29',
    itens,
    subtotal: 1290.48,
    descontoValor: 0,
    frete: 0,
    totalFinal: 1290.48,
    valorTotal: 1290.48,
    itensEditadosManual: true,
    importacaoHistorica: true,
    estoqueBaixado: false,
    movimentarEstoqueHistorico: false,
    movimentacaoEstoqueHistoricaAutorizada: false,
    marcadorImportacao: MARCADOR,
    atualizadoEm: agora,
  }

  const orcamento = {
    ...orcamentoExistente,
    ...comum,
    id: orcamentoId,
    tipo: 'Orçamento',
    numeroOrcamento: '2380',
    numeroPedido: undefined,
    statusOrcamento: 'Gerado',
    aprovadoEm: orcamentoExistente?.aprovadoEm || agora,
    pedidoGeradoId: pedidoId,
    pedidoGeradoEm: agora,
    statusNotaFiscal: 'Pendente',
    parcelas: [],
    criadoEm: orcamentoExistente?.criadoEm || agora,
  }
  const parcelas = [
    { numero: 1, vencimento: '2026-07-25', valor: 430.16, numeroBoleto: '001', tipoCobranca: 'BOLETO BANCO CORA', bancoCobranca: 'Cora', statusBoleto: 'Pendente' },
    { numero: 2, vencimento: '2026-08-25', valor: 430.16, numeroBoleto: '002', tipoCobranca: 'BOLETO BANCO CORA', bancoCobranca: 'Cora', statusBoleto: 'Pendente' },
    { numero: 3, vencimento: '2026-09-25', valor: 430.16, numeroBoleto: '003', tipoCobranca: 'BOLETO BANCO CORA', bancoCobranca: 'Cora', statusBoleto: 'Pendente' },
  ]
  const pedido = {
    ...pedidoExistente,
    ...comum,
    id: pedidoId,
    tipo: 'Pedido',
    numeroOrcamento: undefined,
    numeroPedido: '2458',
    orcamentoOrigemId: orcamentoId,
    orcamentoOrigemNumero: '2380',
    statusPedido: pedidoExistente?.statusPedido || pedidoExistente?.status || 'Concluído',
    logisticaStatus: pedidoExistente?.logisticaStatus || 'Entregue',
    dataEntregaRealizada: pedidoExistente?.dataEntregaRealizada || '2026-06-29',
    entregaConfirmadaSemNovaBaixa: pedidoExistente?.entregaConfirmadaSemNovaBaixa ?? true,
    estoqueBaixado: pedidoExistente?.estoqueBaixado ?? false,
    movimentarEstoqueHistorico: pedidoExistente?.movimentarEstoqueHistorico ?? false,
    movimentacaoEstoqueHistoricaAutorizada: pedidoExistente?.movimentacaoEstoqueHistoricaAutorizada ?? false,
    statusNotaFiscal: 'Autorizada',
    numeroNotaFiscal: '2358',
    serieNotaFiscal: '1',
    chaveAcessoNotaFiscal: '43260650432175000146550010000023581100024585',
    protocoloNotaFiscal: '243260300175833',
    dataEmissaoNotaFiscal: '2026-06-29T00:18:29-03:00',
    ambienteNotaFiscal: 'PRODUCAO',
    cStatNotaFiscal: '100',
    xmlNotaFiscal: XML_NFE_2358_PEDIDO_2458,
    danfePdf: DANFE_PDF_NFE_2358_PEDIDO_2458_BASE64,
    historicoNotaFiscal: [
      ...(Array.isArray(pedidoExistente?.historicoNotaFiscal)
        ? pedidoExistente.historicoNotaFiscal.filter((item: any) =>
            String(item?.chaveAcesso || '') !== '43260650432175000146550010000023581100024585')
        : []),
      {
        id: 'nfe-2358-autorizada-caravaggio',
        ambiente: 'PRODUCAO',
        status: 'Autorizada',
        numero: '2358',
        serie: '1',
        chaveAcesso: '43260650432175000146550010000023581100024585',
        protocolo: '243260300175833',
        cStat: '100',
        motivo: 'Autorizado o uso da NF-e',
        xml: XML_NFE_2358_PEDIDO_2458,
        criadoEm: '2026-06-29T00:18:29-03:00',
      },
    ],
    formaPagamento: 'BOLETO BANCO CORA',
    tipoCobranca: 'BOLETO BANCO CORA',
    bancoCobranca: 'Cora',
    statusBoleto: 'Pendente',
    parcelas,
    conciliado: false,
    criadoEm: pedidoExistente?.criadoEm || agora,
  }

  await atualizar('vendas', orcamento)
  await atualizar('vendas', pedido)
  const resposta = await recarregar<any>('vendas')
  vendas = Array.isArray(resposta.data) ? resposta.data : vendas
  const confirmado = vendas.find((venda) =>
    String(venda?.numeroPedido || '') === '2458' &&
    String(venda?.chaveAcessoNotaFiscal || '') === pedido.chaveAcessoNotaFiscal)
  if (
    !confirmado ||
    confirmado.itens?.length !== 22 ||
    confirmado.parcelas?.length !== 3 ||
    !String(confirmado.xmlNotaFiscal || '').includes('<nfeProc') ||
    !String(confirmado.danfePdf || '').trim()
  ) {
    throw new Error('O MySQL não confirmou integralmente o Pedido 2458 com XML e DANFE.')
  }
  return vendas
}
