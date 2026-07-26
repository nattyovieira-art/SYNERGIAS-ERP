/* SYNERGIAS_ORCAMENTO_2405_PEDIDO_2498_PRODUTOS_CORRETOS_V247A
   Corrige os itens do orçamento 2405 e do pedido 2498 já existentes.
   Usa a descrição do cadastro central como chave. Não cria registros ou produtos.
*/

function normalizar2405(valor: unknown): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function texto2405(...valores: unknown[]): string {
  for (const valor of valores) {
    const texto = String(valor ?? '').trim()
    if (texto) return texto
  }
  return ''
}

function numero2405(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  const texto = String(valor ?? '').trim()
  if (!texto) return 0
  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto
  const convertido = Number(normalizado.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(convertido) ? convertido : 0
}

function digitos2405(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '')
}

function descricaoProduto2405(produto: any): string {
  return texto2405(produto?.descricao, produto?.nome, produto?.nomeProduto, produto?.produto)
}

type Regra2405 = { descricao: string; quantidade: number; valorUnitario: number; observacao?: string }

const ITENS_2405: Regra2405[] = [
  { descricao: 'PANO ALVEJADO 100% ALGODÃO 40CM X 65CM', quantidade: 20, valorUnitario: 3.65 },
  { descricao: 'DESINFETANTE JASMIM 5L | BRILHA SUL', quantidade: 6, valorUnitario: 12.15 },
  { descricao: 'ALCOOL LIQUIDO 70° 1L | FLOPS', quantidade: 10, valorUnitario: 6.25 },
  { descricao: 'AGUA SANITÁRIA 5L | QMFEL', quantidade: 3, valorUnitario: 8.90 },
  { descricao: 'ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', quantidade: 10, valorUnitario: 0.69 },
  { descricao: 'MAX STAR 5L | MXSN', quantidade: 6, valorUnitario: 59.50 },
  { descricao: 'ODORIZADOR AQUAMARINE 400ML | AR AGRADÁVEL', quantidade: 8, valorUnitario: 8.99 },
  { descricao: 'LIMPA VIDRO GLASS 5L | QM', quantidade: 2, valorUnitario: 13.90 },
  { descricao: 'SAPONACEO CREMOSO FLORAL/LAVANDA/LIMÃO 250ML | SANYMIX', quantidade: 6, valorUnitario: 3.99 },
  { descricao: 'LUSTRA MOVEIS 200ML | POLWAX', quantidade: 6, valorUnitario: 5.60 },
  { descricao: 'FIBRA BRANCA SLIM USO LEVE | NB', quantidade: 8, valorUnitario: 1.22 },
  { descricao: 'FIBRA VEGETAL USO GERAL SLIM | NB', quantidade: 8, valorUnitario: 1.30 },
  { descricao: 'MOP UMIDO ALGODÃO 190G | NB', quantidade: 6, valorUnitario: 8.35 },
  { descricao: 'MOP PÓ ACRILICO AZUL 60CM | TW', quantidade: 6, valorUnitario: 33.78 },
  { descricao: 'PASTILHA ADESIVA SANITÁRIA C/3UN | NFRESCOR', quantidade: 6, valorUnitario: 3.99 },
  { descricao: 'SABÃO EM BARRA COCO/AZUL 180G | G SOL', quantidade: 8, valorUnitario: 2.40, observacao: 'COCO' },
  { descricao: 'DESINCRUSTANTE ALCALINO CLORADO F200 | 5L', quantidade: 2, valorUnitario: 39.90 },
  { descricao: 'DESENGORDURANTE DE LOUÇA DX30 5L | GMRÃES', quantidade: 2, valorUnitario: 34.50 },
  { descricao: 'SABONETE LIQUIDO GLICERINADO 5L ALGODÃO | NB', quantidade: 2, valorUnitario: 24.90 },
  { descricao: 'CERA LIQUIDA SEMI BRILHO INCOLOR 5L | BLIM', quantidade: 2, valorUnitario: 37.90 },
  { descricao: 'PANO MICROFIBRA 30CMX30CM | PFPRO', quantidade: 20, valorUnitario: 2.15 },
  { descricao: 'MULTIOX 5L | GMRÃES', quantidade: 2, valorUnitario: 36.50 },
  { descricao: 'MAX ONE CITRUS 5L | MXSN', quantidade: 2, valorUnitario: 58.25, observacao: 'SUBSTITUI MULTI BAC' },
  { descricao: 'LIMPADOR CLORO ATIVO X14 1L | VEJA', quantidade: 3, valorUnitario: 19.50 },
  { descricao: 'VASSOURA MULTIUSO C/CABO 140CM | BTTN', quantidade: 6, valorUnitario: 17.95 },
  { descricao: 'CABO CHAPA AÇO 140CM C/ROSCA | PFPRO', quantidade: 4, valorUnitario: 8.50 },
  { descricao: 'LIMPA ESTOFADOS SUPER DOM 300 ML | DLINE', quantidade: 1, valorUnitario: 14.90 },
  { descricao: 'ESCOVA PLASTICA C/ ALÇA | DLCN', quantidade: 2, valorUnitario: 6.50 },
  { descricao: 'ESPONJA LÃ DE AÇO C/8UN | 45G | ASSOLAN', quantidade: 6, valorUnitario: 2.15 },
  { descricao: 'ESPONJA ESFREGÃO DE AÇO 1UN | ANGELINA', quantidade: 3, valorUnitario: 1.45 },
  { descricao: 'PINCEL 3/4 19MM | ATLAS', quantidade: 3, valorUnitario: 4.90 },
  { descricao: 'SACO DE LIXO 20L PRETO FLEX 0.02M/40X50CM C/100UN', quantidade: 3, valorUnitario: 5.99 },
  { descricao: 'SACO DE LIXO 60L PRETO FLEX 0.02M/60X70CM C/100UN', quantidade: 2, valorUnitario: 12.40 },
  { descricao: 'SACO DE LIXO 40L PRETO FLEX 0.02M/50X60CM C/100UN', quantidade: 2, valorUnitario: 8.95 },
  { descricao: 'SACO DE LIXO 100L PRETO LEVE 0.06M / 75X90CM C/100UN', quantidade: 1, valorUnitario: 35.50 },
  { descricao: 'BORRIFADOR 580ML | SANREMO', quantidade: 6, valorUnitario: 6.90 },
  { descricao: 'ESCOVA SANITÁRIA S/SUPORTE | PLURI', quantidade: 4, valorUnitario: 3.78 },
  { descricao: 'AVENTAL PLASTICO PVC COZINHA BRANCO/PRETO | MCOL', quantidade: 1, valorUnitario: 19.90 },
  { descricao: 'PAPEL TOALHA INTERFOLHADO FOLHA DUPLA 22,5X20CM C/2000UN | IPEL', quantidade: 3, valorUnitario: 89.90 },
  { descricao: 'PAPEL HIGIENICO TOQUE SEDA FOLHA DUPLA 12X30M NEUTRO | NEVE', quantidade: 3, valorUnitario: 23.90 },
  { descricao: 'PAPEL TOALHA BOBINA C/6 ROLOS 200M 20G 100% CEL | PSA', quantidade: 4, valorUnitario: 81.90 },
  { descricao: 'PAPEL HIGIENICO ROLÃO 8CMX300M C/8 ROLOS F SIMPLES 100% CEL | PSA', quantidade: 4, valorUnitario: 50.90 },
]

const PALAVRAS_IGNORADAS_2405 = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'COM', 'C', 'UN', 'UNIDADE', 'ML', 'L', 'G'])

function tokens2405(valor: string): string[] {
  return normalizar2405(valor)
    .split(' ')
    .filter((token) => token.length > 1 && !PALAVRAS_IGNORADAS_2405.has(token))
}

function pontuarProduto2405(produto: any, descricao: string): number {
  const alvo = normalizar2405(descricao)
  const atual = normalizar2405(descricaoProduto2405(produto))
  if (!atual) return -1
  if (atual === alvo) return 10000

  const alvoTokens = tokens2405(descricao)
  const atualSet = new Set(tokens2405(descricaoProduto2405(produto)))
  const comuns = alvoTokens.filter((token) => atualSet.has(token)).length
  const cobertura = alvoTokens.length ? comuns / alvoTokens.length : 0
  const contem = atual.includes(alvo) || alvo.includes(atual)
  const inicio = atual.startsWith(alvo.slice(0, Math.min(18, alvo.length)))
  const ativo = produto?.ativo === false || normalizar2405(produto?.status) === 'INATIVO' ? 0 : 0.15
  return cobertura * 100 + (contem ? 20 : 0) + (inicio ? 8 : 0) + ativo
}

function localizarProduto2405(produtos: any[], descricao: string): any | null {
  const classificados = produtos
    .map((produto) => ({ produto, pontos: pontuarProduto2405(produto, descricao) }))
    .filter((item) => item.pontos >= 72)
    .sort((a, b) => b.pontos - a.pontos)
  return classificados[0]?.produto || null
}

function alertar2405(mensagem: string): void {
  console.error('[V247A]', mensagem)
}

function ehOrcamento2405(venda: any): boolean {
  const numeroDireto = [venda?.numeroOrcamento, venda?.numero, venda?.codigo]
    .some((valor) => digitos2405(valor) === '2405')
  const ligadoAoPedido = digitos2405(venda?.numeroPedido) === '2498'
  const tipo = normalizar2405(venda?.tipo || venda?.tipoVenda || venda?.categoria)
  return numeroDireto && (!tipo.includes('PEDIDO') || tipo.includes('ORCAMENTO') || ligadoAoPedido)
}

function ehPedido2498(venda: any): boolean {
  const numeroPedido = digitos2405(venda?.numeroPedido || venda?.numero || venda?.codigo)
  const origem = digitos2405(venda?.orcamentoOrigemNumero || venda?.numeroOrcamentoOrigem || venda?.orcamentoNumero)
  return numeroPedido === '2498' || (origem === '2405' && numeroPedido === '2498')
}

function ajustarParcelas2405(lista: any, total: number): any {
  if (!Array.isArray(lista) || lista.length === 0) return lista
  const quantidade = lista.length
  const base = Math.floor((total / quantidade) * 100) / 100
  let acumulado = 0
  return lista.map((parcela: any, indice: number) => {
    const valor = indice === quantidade - 1
      ? Number((total - acumulado).toFixed(2))
      : Number(base.toFixed(2))
    acumulado = Number((acumulado + valor).toFixed(2))
    return { ...parcela, valor }
  })
}

function montarItens2405(produtos: any[]): any[] | null {
  const resolvidos = ITENS_2405.map((regra) => ({ regra, produto: localizarProduto2405(produtos, regra.descricao) }))
  const falhas = resolvidos.filter((item) => !item.produto)
  if (falhas.length) {
    alertar2405([
      'A correção do orçamento 2405 e do pedido 2498 foi bloqueada porque estes produtos não foram encontrados no cadastro central:',
      ...falhas.map(({ regra }) => `- ${regra.descricao}`),
      'Nenhum registro foi criado ou alterado.',
    ].join('\n'))
    return null
  }

  const itens = resolvidos.map(({ regra, produto }, indice) => {
    const quantidade = regra.quantidade
    const valorUnitario = regra.valorUnitario
    const custoUnitario = numero2405(produto?.custo ?? produto?.custoMedioAtual ?? produto?.ultimoCustoCompra)
    return {
      id: `2405-2498-item-${indice + 1}`,
      produtoId: texto2405(produto?.id),
      codigo: texto2405(produto?.codigo, produto?.codigoInterno),
      codigoProduto: texto2405(produto?.codigo, produto?.codigoInterno),
      codigoBarras: texto2405(produto?.codigoBarras, produto?.ean, produto?.gtin),
      descricao: descricaoProduto2405(produto),
      descricaoHistorica: regra.descricao,
      unidade: texto2405(produto?.unidade, produto?.unidadeMedida, 'Unidade'),
      quantidade,
      valorUnitario,
      desconto: 0,
      descontoValor: 0,
      descontoPercentual: 0,
      valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
      custoUnitario,
      custoTotal: Number((quantidade * custoUnitario).toFixed(2)),
      estoqueDisponivel: numero2405(produto?.estoqueAtual ?? produto?.estoque ?? produto?.quantidadeEstoque),
      observacaoItem: regra.observacao || '',
      produtoVinculado: true,
      vinculoProdutoOrigem: 'DESCRICAO_CADASTRO_CENTRAL_V247A',
      ncm: texto2405(produto?.ncm),
      cfop: texto2405(produto?.cfopDentroEstado, produto?.cfop),
      origem: texto2405(produto?.origem),
      cest: texto2405(produto?.cest),
      csosn: texto2405(produto?.csosn),
      cstIcms: texto2405(produto?.cstIcms),
      cstPis: texto2405(produto?.cstPis),
      cstCofins: texto2405(produto?.cstCofins),
    }
  })

  const quantidadeTotal = itens.reduce((soma, item) => soma + item.quantidade, 0)
  const subtotal = Number(itens.reduce((soma, item) => soma + item.valorTotal, 0).toFixed(2))
  if (itens.length !== 42 || quantidadeTotal !== 212 || subtotal !== 2884.48) {
    alertar2405(`Validação bloqueou a correção. Produtos: ${itens.length}; quantidade: ${quantidadeTotal}; total: ${subtotal}.`)
    return null
  }
  return itens
}

function atualizarRegistro2405(atual: any, itens: any[], papel: 'ORCAMENTO_2405' | 'PEDIDO_2498'): any {
  const subtotal = 2884.48
  const ehOrcamento = papel === 'ORCAMENTO_2405'
  return {
    ...atual,
    tipo: ehOrcamento ? 'Orçamento' : 'Pedido',
    numeroOrcamento: ehOrcamento ? '2405' : atual?.numeroOrcamento,
    numeroPedido: ehOrcamento ? atual?.numeroPedido : '2498',
    itens: itens.map((item) => ({ ...item })),
    itensEditadosManual: true,
    tipoDesconto: 'valor',
    descontoInformado: 0,
    descontoCalculado: 0,
    desconto: 0,
    descontoTotal: 0,
    descontoValor: 0,
    frete: 0,
    outros: 0,
    outrosCustos: 0,
    subtotal,
    valorProdutos: subtotal,
    totalFinal: subtotal,
    total: subtotal,
    valorTotal: subtotal,
    quantidadeTotalItens: 212,
    pagamentos: ajustarParcelas2405(atual?.pagamentos, subtotal),
    parcelas: ajustarParcelas2405(atual?.parcelas, subtotal),
    atualizadoEm: new Date().toISOString(),
    origemAtualizacao: 'SYNERGIAS_ORCAMENTO_2405_PEDIDO_2498_PRODUTOS_CORRETOS_V247A',
    correcaoAplicadaEm: new Date().toISOString(),
    correcaoPapel: papel,
  }
}

function registroOcultoOuExcluido2405(venda: any): boolean {
  const estado = normalizar2405(
    texto2405(venda?.statusRegistro, venda?.situacaoRegistro, venda?.estadoRegistro, venda?.status),
  )
  return venda?.excluido === true || venda?.deletado === true || venda?.ativo === false ||
    estado.includes('EXCLUID') || estado.includes('DELETAD') || estado.includes('ARQUIVAD')
}

function pontuarRegistro2405(venda: any, papel: 'ORCAMENTO' | 'PEDIDO'): number {
  let pontos = 0
  const tipo = normalizar2405(venda?.tipo || venda?.tipoVenda || venda?.categoria || venda?.documentoTipo)
  const cliente = normalizar2405(venda?.clienteNome || venda?.nomeCliente || venda?.cliente)
  const numeroOrcamento = digitos2405(venda?.numeroOrcamento || venda?.numero || venda?.codigo)
  const numeroPedido = digitos2405(venda?.numeroPedido || venda?.numero || venda?.codigo)
  const origem = digitos2405(
    venda?.orcamentoOrigemNumero || venda?.numeroOrcamentoOrigem || venda?.orcamentoNumero || venda?.numeroOrcamento,
  )

  if (registroOcultoOuExcluido2405(venda)) pontos -= 1000
  else pontos += 100

  if (cliente.includes('NILO')) pontos += 80
  if (Array.isArray(venda?.itens) && venda.itens.length > 0) pontos += 20
  if (texto2405(venda?.id, venda?._id, venda?.uuid)) pontos += 10

  if (papel === 'ORCAMENTO') {
    if (numeroOrcamento === '2405') pontos += 300
    if (tipo.includes('ORCAMENTO')) pontos += 180
    if (!tipo.includes('PEDIDO')) pontos += 40
    if (numeroPedido === '2498') pontos -= 160
    if (digitos2405(venda?.pedidoGeradoNumero || venda?.numeroPedidoGerado) === '2498') pontos += 140
  } else {
    if (numeroPedido === '2498') pontos += 300
    if (tipo.includes('PEDIDO')) pontos += 180
    if (origem === '2405') pontos += 180
    if (tipo.includes('ORCAMENTO')) pontos -= 160
  }

  return pontos
}

function escolherRegistro2405(
  candidatos: Array<{ venda: any; indice: number }>,
  papel: 'ORCAMENTO' | 'PEDIDO',
  indiceProibido = -1,
): { venda: any; indice: number } | null {
  const classificados = candidatos
    .filter((item) => item.indice !== indiceProibido)
    .map((item) => ({ ...item, pontos: pontuarRegistro2405(item.venda, papel) }))
    .sort((a, b) => b.pontos - a.pontos || b.indice - a.indice)
  return classificados[0] || null
}

export function aplicarOrcamento2405NiloProdutosCorretos(vendas: any[], produtos: any[]): any[] {
  void 'SYNERGIAS_ORCAMENTO_2405_PEDIDO_2498_PRODUTOS_CORRETOS_V247A'
  const listaVendas = Array.isArray(vendas) ? vendas : []
  const listaProdutos = Array.isArray(produtos) ? produtos : []

  const candidatosOrcamento = listaVendas
    .map((venda, indice) => ({ venda, indice }))
    .filter(({ venda }) => ehOrcamento2405(venda))
  const candidatosPedido = listaVendas
    .map((venda, indice) => ({ venda, indice }))
    .filter(({ venda }) => ehPedido2498(venda))

  const orcamentoEscolhido = escolherRegistro2405(candidatosOrcamento, 'ORCAMENTO')
  const pedidoEscolhido = escolherRegistro2405(
    candidatosPedido,
    'PEDIDO',
    orcamentoEscolhido?.indice ?? -1,
  )

  if (!orcamentoEscolhido || !pedidoEscolhido) {
    alertar2405(`Correção bloqueada: não foi possível identificar o par válido do orçamento 2405 e pedido 2498. Nenhum registro foi criado ou alterado.`)
    return listaVendas
  }

  const itens = montarItens2405(listaProdutos)
  if (!itens) return listaVendas

  const resultado = [...listaVendas]
  resultado[orcamentoEscolhido.indice] = atualizarRegistro2405(
    orcamentoEscolhido.venda,
    itens,
    'ORCAMENTO_2405',
  )
  resultado[pedidoEscolhido.indice] = atualizarRegistro2405(
    pedidoEscolhido.venda,
    itens,
    'PEDIDO_2498',
  )

  console.info('[V247A] Orçamento 2405 e pedido 2498 corrigidos no par visível/válido.', {
    candidatosOrcamento: candidatosOrcamento.length,
    candidatosPedido: candidatosPedido.length,
    indiceOrcamento: orcamentoEscolhido.indice,
    indicePedido: pedidoEscolhido.indice,
    produtos: itens.length,
    quantidadeTotalItens: 212,
    subtotal: 2884.48,
  })
  return resultado
}
