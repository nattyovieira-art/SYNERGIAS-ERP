/* NF-e 2353: orçamento 2151 / pedido 2453.
   Os códigos legados do XML não são usados para localizar produtos.
   O vínculo é feito exclusivamente pela descrição normalizada. */

const MARCADOR = 'SYNERGIAS_ORCAMENTO_2151_PEDIDO_2453_XML_DESCRICAO_V308'

const ITENS_XML = [
  ['DESINFETANTE LAVANDA 5L | GMRÃES', 2, 17.90, '38089419', '5102'],
  ['ALCOOL LIQUIDO 70° 5L | FLOPS', 1, 32.90, '38089429', '5102'],
  ['DETERGENTE NEUTRO 5L | GMRÃES', 1, 21.50, '34025000', '5102'],
  ['PANO DE CHÃO FLANELADO A 42CMX62CM', 2, 5.50, '63079090', '5102'],
  ['VASSOURA USO GERAL C/ CABO 140CM | PFPRO', 1, 16.20, '96031000', '5102'],
  ['PEDRA SANITARIA 22G | DONNA', 2, 1.45, '38089919', '5102'],
  ['SABÃO EM PÓ 800G | GIRANDO SOL', 1, 6.90, '34025000', '5102'],
  ['SAPONACEO RADIUM CREMOSO CLASSICO 250ML | SAPOLIO', 1, 6.90, '34054000', '5102'],
  ['SACO DE LIXO 240L AZUL RESISTENTE 0.10M / 100X144CM C/50UN', 1, 85.00, '39232190', '5102'],
  ['FIBRA VEGETAL USO GERAL | BTTN', 10, 1.80, '68053090', '5102'],
  ['SABÃO EM BARRA COCO/AZUL 180G | G SOL', 1, 2.40, '34011900', '5405'],
] as const

function normalizar(valor: unknown) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b(GUIMARAES|GMRAES)\b/g, 'GMRAES')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function descricaoProduto(produto: any) {
  return String(produto?.descricao || produto?.nome || produto?.nomeProduto || '').trim()
}

function localizarProduto(produtos: any[], descricao: string) {
  const alvo = normalizar(descricao)
  const exatos = produtos.filter((produto) => normalizar(descricaoProduto(produto)) === alvo)
  if (exatos.length === 1) return exatos[0]

  const tokensAlvo = new Set(alvo.split(' ').filter((token) => token.length > 1))
  const classificados = produtos
    .map((produto) => {
      const descricao = normalizar(descricaoProduto(produto))
      const tokensProduto = new Set(descricao.split(' ').filter((token) => token.length > 1))
      const comuns = [...tokensAlvo].filter((token) => tokensProduto.has(token)).length
      const cobertura = comuns / Math.max(1, tokensAlvo.size)
      return { produto, cobertura, diferenca: Math.abs(descricao.length - alvo.length) }
    })
    .filter((item) => item.cobertura >= 0.8)
    .sort((a, b) => b.cobertura - a.cobertura || a.diferenca - b.diferenca)

  if (!classificados.length) return undefined
  if (classificados[1] && classificados[0].cobertura === classificados[1].cobertura &&
      classificados[0].diferenca === classificados[1].diferenca) return undefined
  return classificados[0].produto
}

function montarItens(produtos: any[], prefixo: string) {
  return ITENS_XML.map(([descricaoXml, quantidade, valorUnitario, ncm, cfop], indice) => {
    const produto = localizarProduto(produtos, descricaoXml)
    const codigo = String(produto?.codigo || produto?.codigoInterno || '').trim()
    const codigoBarras = String(produto?.codigoBarras || produto?.ean || produto?.gtin || '').trim()
    return {
      id: `${prefixo}-xml2353-${indice + 1}`,
      produtoId: String(produto?.id || ''),
      codigo,
      codigoProduto: codigo,
      codigoBarras,
      descricao: produto ? descricaoProduto(produto) : descricaoXml,
      descricaoHistorica: descricaoXml,
      unidade: String(produto?.unidade || produto?.unidadeMedida || 'Unidade'),
      quantidade,
      valorUnitario,
      precoUnitario: valorUnitario,
      desconto: 0,
      descontoValor: 0,
      valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
      produtoVinculado: Boolean(produto),
      vinculoProdutoOrigem: produto ? 'DESCRICAO_NORMALIZADA' : 'NAO_VINCULADO',
      estoqueDisponivel: Number(produto?.estoqueAtual || 0),
      ncm: String(produto?.ncm || ncm),
      cfop: String(produto?.cfopDentroEstado || produto?.cfop || cfop),
      origem: String(produto?.origem || '0 - Nacional'),
      cest: String(produto?.cest || ''),
      csosn: String(produto?.csosn || '102'),
      cstPis: String(produto?.cstPis || '49'),
      cstCofins: String(produto?.cstCofins || '49'),
    }
  })
}

function ehOrcamento2151(venda: any) {
  return normalizar(venda?.tipo).includes('ORCAMENTO') &&
    String(venda?.numeroOrcamento || venda?.numero || '').replace(/\D/g, '') === '2151'
}

function ehPedido2453(venda: any) {
  return normalizar(venda?.tipo) === 'PEDIDO' &&
    String(venda?.numeroPedido || venda?.numero || '').replace(/\D/g, '') === '2453'
}

export async function corrigirOrcamento2151Pedido2453PorDescricao(
  vendasEntrada: any[],
  produtosEntrada: any[],
  atualizarRegistro: (colecao: 'vendas', registro: any) => Promise<unknown>,
  recarregar: <T>(colecao: 'vendas') => Promise<{ data: T[] }>,
) {
  let vendas = Array.isArray(vendasEntrada) ? vendasEntrada : []
  const produtos = Array.isArray(produtosEntrada) ? produtosEntrada : []
  const orcamento = vendas.find(ehOrcamento2151)
  const pedido = vendas.find(ehPedido2453)
  if (!orcamento && !pedido) return vendas

  const agora = new Date().toISOString()
  const comum = {
    clienteNome: 'CONDOMINIO VILLA CONSTANZA',
    clienteDocumento: '06257983000122',
    itens: montarItens(produtos, '2151-2453'),
    subtotal: 239.50,
    total: 239.50,
    totalGeral: 239.50,
    totalFinal: 239.50,
    valorTotal: 239.50,
    itensEditadosManual: true,
    correcaoImportacaoDescricao: MARCADOR,
    atualizadoEm: agora,
  }

  if (pedido && pedido.correcaoImportacaoDescricao !== MARCADOR) {
    await atualizarRegistro('vendas', {
      ...pedido,
      ...comum,
      numeroOrcamento: '2151',
      orcamentoOrigemNumero: '2151',
      numeroNotaFiscal: '2353',
      numeroNfe: '2353',
      chaveAcessoNotaFiscal: '43260650432175000146550010000023531100024538',
      protocoloNotaFiscal: '243260300173192',
      dataEmissaoNotaFiscal: '2026-06-29',
      statusNotaFiscal: 'Autorizada',
    })
  }

  if (orcamento && orcamento.correcaoImportacaoDescricao !== MARCADOR) {
    await atualizarRegistro('vendas', {
      ...orcamento,
      ...comum,
      pedidoGerado: Boolean(pedido) || orcamento.pedidoGerado,
      convertido: Boolean(pedido) || orcamento.convertido,
      pedidoId: pedido?.id || orcamento.pedidoId || '',
      pedidoGeradoId: pedido?.id || orcamento.pedidoGeradoId || '',
    })
  }

  const resposta = await recarregar<any>('vendas')
  vendas = Array.isArray(resposta.data) ? resposta.data : vendas
  return vendas
}
