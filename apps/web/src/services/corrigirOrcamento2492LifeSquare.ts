/* SYNERGIAS_ORCAMENTO_2492_LIFE_SQUARE_V306
   Corrige somente os itens do orçamento 2492 conforme o PDF original.
   Não altera orçamentos convertidos em pedido, faturados ou vinculados a NF-e.
*/

const MARCADOR = 'SYNERGIAS_ORCAMENTO_2492_LIFE_SQUARE_V306'

type ItemPdf = {
  codigo: string
  descricao: string
  quantidade: number
  unitario: number
  total: number
}

const ITENS_PDF: ItemPdf[] = [
  { codigo: '7901210037', descricao: 'ALCOOL LIQUIDO 70° 1L | FLOPS', quantidade: 6, unitario: 6.25, total: 37.50 },
  { codigo: '7901210028', descricao: 'AGUA SANITÁRIA 5L | QMFEL', quantidade: 5, unitario: 8.90, total: 44.50 },
  { codigo: '7901210155', descricao: 'BORRIFADOR TRANSPARENTE 500ML | NB', quantidade: 8, unitario: 4.90, total: 39.20 },
  { codigo: '7901210960', descricao: 'ODORIZADOR SPRAY PETALAS DE ROSA 350ML | PURO AR', quantidade: 3, unitario: 8.70, total: 26.10 },
  { codigo: '7901210330', descricao: 'COPO DESCARTÁVEL TRANSPARENTE 180ML C/100UN PS | TOTALPLAST', quantidade: 5, unitario: 5.20, total: 26.00 },
  { codigo: '7901211476', descricao: 'DETERGENTE CLORADO 5L | DETCLOR', quantidade: 2, unitario: 18.90, total: 37.80 },
  { codigo: '7901210529', descricao: 'ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', quantidade: 15, unitario: 0.69, total: 10.35 },
  { codigo: '7901210592', descricao: 'FLANELA BRANCA 28CMX38CM | DTEX', quantidade: 10, unitario: 1.25, total: 12.50 },
  { codigo: '7901210777', descricao: 'LIMPADOR PERFUMADO ROMANCE/ORQUIDEA NEGRA 5L | GMRÃES', quantidade: 4, unitario: 28.90, total: 115.60 },
  { codigo: '7901210930', descricao: 'MOP UMIDO ALGODÃO 190G | NB', quantidade: 10, unitario: 8.35, total: 83.50 },
  { codigo: '7901210979', descricao: 'PALHA DE AÇO N°1 C/1UN | VGA', quantidade: 10, unitario: 1.80, total: 18.00 },
  { codigo: '7901210989', descricao: 'PANO DE PRATO BRANCO | 44CMX67CM', quantidade: 10, unitario: 3.50, total: 35.00 },
  { codigo: '7901211078', descricao: 'PAPEL TOALHA INTERFOLHADO UNIQUE ULTRA 24G 23CMX20CM 1000 FLS | MILI', quantidade: 10, unitario: 28.90, total: 289.00 },
  { codigo: '7901211038', descricao: 'PAPEL HIGIENICO FOLHA DUPLA 12X30M NEUTRO | PALOMA', quantidade: 10, unitario: 14.99, total: 149.90 },
  { codigo: '7901211003', descricao: 'PANO MULTIUSO 50 PANOS 28CMX25M | LF CLEAN', quantidade: 10, unitario: 11.50, total: 115.00 },
  { codigo: '7901211245', descricao: 'SABÃO EM PÓ 800G | APYCE', quantidade: 1, unitario: 4.50, total: 4.50 },
  { codigo: '7901210980', descricao: 'PANO ALVEJADO 100% ALGODÃO 40CM X 65CM', quantidade: 30, unitario: 3.65, total: 109.50 },
  { codigo: '7901211293', descricao: 'SACO DE LIXO 130L PRETO REFORÇADO 0.08M EP / 90X100CM C/100UN', quantidade: 4, unitario: 58.63, total: 234.52 },
  { codigo: '7901211283', descricao: 'SACO DE LIXO 100L PRETO LEVE 0.06M / 75X90CM C/100UN', quantidade: 2, unitario: 36.67, total: 73.34 },
  { codigo: '7901211318', descricao: 'SACO DE LIXO 40L PRETO FLEX 0.02M/50X60CM C/100UN', quantidade: 1, unitario: 8.95, total: 8.95 },
  { codigo: '7901211354', descricao: 'SAPONACEO CREMOSO FLORAL/LAVANDA/LIMÃO 250ML | SANYMIX', quantidade: 6, unitario: 3.91, total: 23.46 },
  { codigo: '7901211437', descricao: 'VASSOURA DE NYLON BELLA S/CABO | DLCN', quantidade: 3, unitario: 6.79, total: 20.37 },
  { codigo: '7901210407', descricao: 'DETERGENTE NEUTRO 5L | GMRÃES', quantidade: 3, unitario: 21.50, total: 64.50 },
  { codigo: '7901211237', descricao: 'RODO PLASTICO PROF. 65CM S/CABO | TW', quantidade: 2, unitario: 22.75, total: 45.50 },
  { codigo: '7901211478', descricao: 'RODO PLAST 35CM CINZA | TW', quantidade: 4, unitario: 13.80, total: 55.20 },
  { codigo: '7901210170', descricao: 'CABO CHAPA AÇO 140CM C/ROSCA | PFPRO', quantidade: 9, unitario: 8.50, total: 76.50 },
]

function texto(...valores: unknown[]): string {
  for (const valor of valores) {
    const resultado = String(valor ?? '').trim()
    if (resultado) return resultado
  }
  return ''
}

function normalizar(valor: unknown): string {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function digitos(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '')
}

function numeroOrcamento(venda: any): string {
  return digitos(venda?.numeroOrcamento || venda?.numero || venda?.codigo)
}

function descricaoProduto(produto: any): string {
  return texto(produto?.descricao, produto?.nome, produto?.nomeProduto, produto?.produto)
}

function localizarProduto(produtos: any[], item: ItemPdf): any | undefined {
  const porCodigo = produtos.filter((produto) =>
    [produto?.codigo, produto?.codigoProduto, produto?.sku, produto?.referencia]
      .some((valor) => digitos(valor) === item.codigo),
  )
  if (porCodigo.length === 1) return porCodigo[0]

  const porDescricao = produtos.filter((produto) =>
    normalizar(descricaoProduto(produto)) === normalizar(item.descricao),
  )
  return porDescricao.length === 1 ? porDescricao[0] : undefined
}

function numero(valor: unknown): number {
  const resultado = Number(valor)
  return Number.isFinite(resultado) ? resultado : 0
}

function estaProtegido(venda: any): boolean {
  const estado = normalizar([
    venda?.tipo,
    venda?.status,
    venda?.statusOrcamento,
    venda?.situacao,
  ].join(' '))
  const possuiNfe = [
    venda?.numeroNfe,
    venda?.numeroNFe,
    venda?.numeroNotaFiscal,
    venda?.chaveNfe,
    venda?.chaveAcesso,
  ].some((valor) => texto(valor))
  return Boolean(
    texto(venda?.numeroPedido, venda?.pedidoNumero, venda?.pedidoId)
    || possuiNfe
    || ['PEDIDO', 'APROVADO', 'CONVERTIDO', 'FATURADO', 'CONCLUIDO'].some((termo) => estado.includes(termo)),
  )
}

export async function corrigirOrcamento2492LifeSquare(
  vendasEntrada: any[],
  produtosEntrada: any[],
  atualizar: (colecao: any, registro: any) => Promise<any>,
  carregar: (colecao: any) => Promise<any>,
): Promise<any[]> {
  const vendas = Array.isArray(vendasEntrada) ? vendasEntrada : []
  const produtos = Array.isArray(produtosEntrada) ? produtosEntrada : []
  const encontrados = vendas.filter((venda) => numeroOrcamento(venda) === '2492')

  if (encontrados.length !== 1) {
    console.warn(`[V305] Correção do orçamento 2492 bloqueada: ${encontrados.length} registro(s) encontrado(s).`)
    return vendas
  }

  const existente = encontrados[0]
  if (existente?.marcadorCorrecao2492 === MARCADOR || estaProtegido(existente)) return vendas

  const id = texto(existente?.id)
  if (!id) {
    console.warn('[V305] Correção do orçamento 2492 bloqueada: registro sem ID persistido.')
    return vendas
  }

  const itens = ITENS_PDF.map((origem, indice) => {
    const produto = localizarProduto(produtos, origem)
    if (!produto) throw new Error(`[V305] Produto ${origem.codigo} (${origem.descricao}) não localizado de forma única.`)
    const custo = numero(produto?.custoMedioAtual ?? produto?.custo ?? produto?.ultimoCustoCompra)
    return {
      id: `2492-item-${indice + 1}`,
      produtoId: texto(produto?.id),
      codigo: texto(produto?.codigo, produto?.codigoInterno, origem.codigo),
      codigoProduto: texto(produto?.codigo, produto?.codigoInterno, origem.codigo),
      codigoBarras: texto(produto?.codigoBarras, produto?.ean, produto?.gtin, origem.codigo),
      descricao: descricaoProduto(produto),
      unidade: texto(produto?.unidade, produto?.unidadeMedida, 'Unidade'),
      quantidade: origem.quantidade,
      valorUnitario: origem.unitario,
      desconto: 0,
      descontoValor: 0,
      descontoPercentual: 0,
      valorTotal: origem.total,
      custoUnitario: custo,
      custoTotal: Number((origem.quantidade * custo).toFixed(2)),
      estoqueDisponivel: numero(produto?.estoqueAtual ?? produto?.estoque ?? produto?.quantidadeEstoque),
      produtoVinculado: true,
      vinculoProdutoOrigem: MARCADOR,
      ncm: texto(produto?.ncm),
      cfop: texto(produto?.cfopDentroEstado, produto?.cfop),
      origem: texto(produto?.origem),
      cest: texto(produto?.cest),
      csosn: texto(produto?.csosn),
      cstIcms: texto(produto?.cstIcms),
      cstPis: texto(produto?.cstPis),
      cstCofins: texto(produto?.cstCofins),
    }
  })

  const quantidadeTotal = Number(itens.reduce((soma, item) => soma + item.quantidade, 0).toFixed(2))
  const valorTotal = Number(itens.reduce((soma, item) => soma + item.valorTotal, 0).toFixed(2))
  if (quantidadeTotal !== 183 || valorTotal !== 1756.29) {
    throw new Error(`[V305] Totais divergentes: ${quantidadeTotal} itens e R$ ${valorTotal}.`)
  }

  const atualizado = {
    ...existente,
    id,
    itens,
    itensEditadosManual: true,
    subtotal: valorTotal,
    valorProdutos: valorTotal,
    totalFinal: valorTotal,
    total: valorTotal,
    valorTotal,
    quantidadeTotalItens: quantidadeTotal,
    marcadorCorrecao2492: MARCADOR,
    origemAtualizacao: MARCADOR,
    atualizadoEm: new Date().toISOString(),
  }

  await atualizar('vendas', atualizado)
  const confirmacao = await carregar('vendas')
  const vendasConfirmadas = Array.isArray(confirmacao?.data) ? confirmacao.data : []
  const confirmado = vendasConfirmadas.find((venda: any) => texto(venda?.id) === id)
  if (
    !ehOrcamento2492(confirmado)
    || confirmado?.marcadorCorrecao2492 !== MARCADOR
    || !Array.isArray(confirmado?.itens)
    || confirmado.itens.length !== ITENS_PDF.length
  ) {
    throw new Error('[V305] O servidor não confirmou integralmente a correção do orçamento 2492.')
  }

  console.info('[V305] Orçamento 2492 corrigido e confirmado conforme o PDF original.')
  return vendasConfirmadas
}

function ehOrcamento2492(venda: any): boolean {
  return Boolean(venda && numeroOrcamento(venda) === '2492')
}
