/* SYNERGIAS_ORCAMENTO_2439_PONTAL_DESCRICAO_V293
   Insere ou substitui somente o orçamento 2439 do cliente PONTAL.
   Localiza cliente e produtos nos cadastros atuais pela descrição.
   Não cria cliente, não cria produto e não inclui forma de pagamento.
*/

import { atualizarRegistroColecaoCentral, carregarColecaoCentral } from './erpApi'

const MARCADOR = 'SYNERGIAS_ORCAMENTO_2439_PONTAL_DESCRICAO_V293'

type RegraProduto = {
  descricao: string
  aliases?: string[]
  quantidade: number
  valorUnitario: number
}

const REGRAS: RegraProduto[] = [
  { descricao: 'AGUA SANITÁRIA 5L | QMFEL', quantidade: 2, valorUnitario: 8.00 },
  { descricao: 'MULTIOX 5L | GMRÃES', aliases: ['MULTIOX 5L | GMRAES', 'MULTIOX 5L | GUIMARÃES'], quantidade: 1, valorUnitario: 36.50 },
  { descricao: 'ALCOOL LIQUIDO 70° 1L | FLOPS', aliases: ['ÁLCOOL LÍQUIDO 70° 1L | FLOPS'], quantidade: 5, valorUnitario: 6.25 },
  { descricao: 'PAPEL HIGIENICO INTERF. F. DUPLA 9,5X20 C/8.000 FLS | PSA', aliases: ['PAPEL HIGIENICO INTERFOLHADO FOLHA DUPLA 9,5X20 C/8000 FLS | PSA'], quantidade: 3, valorUnitario: 77.90 },
  { descricao: 'PAPEL HIGIENICO ROLÃO 8CMX300M C/8 ROLOS F SIMPLES 100% CEL | PSA', quantidade: 2, valorUnitario: 50.90 },
  { descricao: 'PANO ALVEJADO 100% ALGODÃO 40CM X 65CM', quantidade: 3, valorUnitario: 3.65 },
  { descricao: 'SACO DE LIXO 20L PRETO FLEX 0.02M/40X50CM C/100UN', quantidade: 4, valorUnitario: 5.99 },
  { descricao: 'SACO DE LIXO 130L PRETO REFORÇADO 0.08M EP / 90X100CM C/100UN', quantidade: 1, valorUnitario: 51.70 },
  { descricao: 'SACO DE LIXO 240L AZUL REFORÇADO 0.08M / 100X144CM C/50UN', quantidade: 1, valorUnitario: 68.70 },
  { descricao: 'ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', quantidade: 10, valorUnitario: 0.65 },
  { descricao: 'BRILHA INOX SPRAY 250ML | DLINE', quantidade: 2, valorUnitario: 16.50 },
  { descricao: 'ODORIZADOR SPRAY PETALAS DE ROSA 350ML | PURO AR', aliases: ['ODORIZADOR SPRAY PÉTALAS DE ROSA 350ML | PURO AR'], quantidade: 4, valorUnitario: 8.70 },
  { descricao: 'VASSOURA DE NYLON BELLA S/CABO | DLCN', quantidade: 3, valorUnitario: 6.30 },
  { descricao: 'MOP UMIDO ALGODÃO 190G | NB', quantidade: 3, valorUnitario: 8.35 },
  { descricao: 'DETERGENTE ALCALINO CLORADO 5L | PMP', quantidade: 1, valorUnitario: 19.90 },
  { descricao: 'DETERGENTE NEUTRO/CRISTAL 5L | BRILHA SUL', quantidade: 1, valorUnitario: 16.99 },
  { descricao: 'DESINFETANTE JASMIM 5L | BRILHA SUL', quantidade: 2, valorUnitario: 12.15 },
  { descricao: 'SACO DE LIXO 60L BRANCO SUPER LEVE 0.04M / 60X70CM C/100UN', quantidade: 6, valorUnitario: 19.95 },
  { descricao: 'PAPEL TOALHA INTERF. 20CMX20CM C/800FLS F SIMPLES 100% CEL | PSA', aliases: ['PAPEL TOALHA INTERFOLHADO 20CMX20CM C/800 FLS F SIMPLES 100% CEL | PSA'], quantidade: 15, valorUnitario: 12.75 },
]

function normalizar(valor: unknown): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\bINTERFOLHADO\b/g, 'INTERF')
    .replace(/\bFOLHA\b/g, 'F')
    .replace(/\s+/g, ' ')
    .trim()
}

function texto(...valores: unknown[]): string {
  for (const valor of valores) {
    const resultado = String(valor ?? '').trim()
    if (resultado) return resultado
  }
  return ''
}

function numeroSeguro(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  const bruto = String(valor ?? '').trim()
  if (!bruto) return 0
  let n = bruto.replace(/R\$/gi, '').replace(/\s+/g, '')
  if (n.includes(',') && n.includes('.')) n = n.replace(/\./g, '').replace(',', '.')
  else if (n.includes(',')) n = n.replace(',', '.')
  const convertido = Number(n.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(convertido) ? convertido : 0
}

function descricaoProduto(produto: any): string {
  return texto(produto?.descricao, produto?.nome, produto?.nomeProduto, produto?.produto)
}

function nomeCliente(cliente: any): string {
  return texto(cliente?.nomeRazaoSocial, cliente?.razaoSocial, cliente?.nomeFantasia, cliente?.nome, cliente?.clienteNome)
}

function documentoCliente(cliente: any): string {
  return texto(cliente?.cnpjCpf, cliente?.cnpj, cliente?.cpf, cliente?.documento).replace(/\D/g, '')
}

function localizarProduto(produtos: any[], regra: RegraProduto): any[] {
  const aceitos = [regra.descricao, ...(regra.aliases || [])].map(normalizar)
  const exatos = produtos.filter((produto) => aceitos.includes(normalizar(descricaoProduto(produto))))
  if (exatos.length > 0) return exatos

  const principal = normalizar(regra.descricao)
  return produtos.filter((produto) => {
    const atual = normalizar(descricaoProduto(produto))
    return atual.includes(principal) || principal.includes(atual)
  })
}

export async function aplicarOrcamento2439PontalUmaVez(
  vendasEntrada: any[],
  produtosEntrada: any[],
  clientesEntrada: any[],
): Promise<any[]> {
  const vendas = Array.isArray(vendasEntrada) ? vendasEntrada : []
  const produtos = Array.isArray(produtosEntrada) ? produtosEntrada : []
  const clientes = Array.isArray(clientesEntrada) ? clientesEntrada : []

  const jaAplicado = vendas.find((venda) =>
    String(venda?.numeroOrcamento || venda?.numero || '').replace(/\D/g, '') === '2439'
    && venda?.marcadorInstalacao === MARCADOR
  )
  if (jaAplicado) return vendas

  const clientesPontal = clientes.filter((cliente) => normalizar(nomeCliente(cliente)) === 'PONTAL')
  if (clientesPontal.length !== 1) {
    throw new Error(`Orçamento 2439 bloqueado: a descrição PONTAL retornou ${clientesPontal.length} clientes. Nenhum registro foi alterado.`)
  }
  const cliente = clientesPontal[0]

  const localizados = REGRAS.map((regra) => ({ regra, encontrados: localizarProduto(produtos, regra) }))
  const falhas = localizados.filter(({ encontrados }) => encontrados.length !== 1)
  if (falhas.length > 0) {
    throw new Error([
      'Orçamento 2439 bloqueado: produtos não localizados de forma única pela descrição:',
      ...falhas.map(({ regra, encontrados }) => `- ${regra.descricao}: ${encontrados.length} encontrado(s)`),
      'Nenhum cliente, produto ou orçamento foi criado ou alterado.',
    ].join('\n'))
  }

  const itens = localizados.map(({ regra, encontrados }, indice) => {
    const produto = encontrados[0]
    const quantidade = regra.quantidade
    const valorUnitario = regra.valorUnitario
    const custoUnitario = numeroSeguro(produto?.custoMedioAtual ?? produto?.custo ?? produto?.ultimoCustoCompra)
    const codigoProduto = texto(produto?.codigo, produto?.codigoInterno, produto?.id)
    return {
      id: `2439-item-${indice + 1}`,
      produtoId: texto(produto?.id),
      codigo: codigoProduto,
      codigoProduto,
      codigoBarras: texto(produto?.codigoBarras, produto?.ean, produto?.gtin),
      descricao: descricaoProduto(produto),
      unidade: texto(produto?.unidade, produto?.unidadeMedida, 'Unidade'),
      quantidade,
      valorUnitario,
      desconto: 0,
      descontoValor: 0,
      descontoPercentual: 0,
      valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
      custoUnitario,
      custoTotal: Number((quantidade * custoUnitario).toFixed(2)),
      estoqueDisponivel: numeroSeguro(produto?.estoqueAtual ?? produto?.estoque ?? produto?.quantidadeEstoque),
      produtoVinculado: true,
      vinculoProdutoOrigem: 'DESCRICAO_ATUAL_ERP_V293',
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

  const quantidadeTotalItens = itens.reduce((soma, item) => soma + Number(item.quantidade || 0), 0)
  const subtotal = Number(itens.reduce((soma, item) => soma + Number(item.valorTotal || 0), 0).toFixed(2))
  if (itens.length !== 19 || quantidadeTotalItens !== 69 || subtotal !== 1064.95) {
    throw new Error(`Orçamento 2439 bloqueado pela validação: itens ${itens.length}/19, quantidade ${quantidadeTotalItens}/69, total ${subtotal.toFixed(2)}/1064,95.`)
  }

  const existentes = vendas.filter((venda) => {
    const numero = String(venda?.numeroOrcamento || venda?.numero || venda?.codigo || '').replace(/\D/g, '')
    const tipo = normalizar(venda?.tipo || venda?.tipoVenda || '')
    return numero === '2439' && !venda?.numeroPedido && !tipo.includes('PEDIDO')
  })
  if (existentes.length > 1) {
    throw new Error(`Orçamento 2439 bloqueado: existem ${existentes.length} orçamentos com esse número. Nenhum foi alterado.`)
  }

  const atual = existentes[0]
  const agora = new Date().toISOString()
  const enderecoFiscal = [texto(cliente?.endereco, cliente?.logradouro), texto(cliente?.numero)].filter(Boolean).join(', ')
  const enderecoEntrega = texto(cliente?.enderecoEntrega, cliente?.logradouroEntrega, enderecoFiscal)
  const id = texto(atual?.id) || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `orcamento-2439-${Date.now()}`)

  const orcamento = {
    ...(atual || {}),
    id,
    tipo: 'Orçamento',
    numero: '2439',
    numeroOrcamento: '2439',
    vendedor: 'NATÁLIA VIEIRA',
    clienteId: texto(cliente?.id, cliente?.clienteId, cliente?.codigo),
    clienteCodigo: texto(cliente?.codigo, cliente?.id),
    clienteNome: nomeCliente(cliente),
    clienteDocumento: documentoCliente(cliente),
    clienteEmailNotaFiscal: texto(cliente?.emailNotaFiscal, cliente?.email),
    clienteInscricaoEstadual: texto(cliente?.inscricaoEstadual, cliente?.ie),
    cliente: { ...(typeof atual?.cliente === 'object' && atual?.cliente ? atual.cliente : {}), ...cliente },
    dataEmissao: '2026-07-07',
    dataEntrega: '2026-07-09',
    dataValidade: '2026-07-12',
    enderecoFaturamento: enderecoFiscal,
    enderecoEntrega,
    itens,
    itensEditadosManual: true,
    tipoDesconto: 'valor',
    descontoInformado: 0,
    descontoCalculado: 0,
    desconto: 0,
    descontoValor: 0,
    frete: 0,
    outrosCustos: 0,
    subtotal,
    valorProdutos: subtotal,
    totalFinal: subtotal,
    total: subtotal,
    valorTotal: subtotal,
    quantidadeTotalItens,
    pagamentos: [],
    parcelas: [],
    formaPagamento: '',
    condicaoPagamento: '',
    condicoesPagamento: '',
    bancoCobranca: '',
    observacoesPagamento: '',
    status: texto(atual?.status, 'ABERTO'),
    statusOrcamento: texto(atual?.statusOrcamento, 'Aberto'),
    criadoEm: texto(atual?.criadoEm, agora),
    atualizadoEm: agora,
    marcadorInstalacao: MARCADOR,
    origemAtualizacao: MARCADOR,
  }

  await atualizarRegistroColecaoCentral('vendas', orcamento)
  const confirmacao = await carregarColecaoCentral<any>('vendas')
  const atualizadas = Array.isArray(confirmacao.data) ? confirmacao.data : []
  const gravado = atualizadas.find((venda) => String(venda?.id || '') === id)
  if (!gravado
    || String(gravado?.numeroOrcamento || '').replace(/\D/g, '') !== '2439'
    || !Array.isArray(gravado?.itens)
    || gravado.itens.length !== 19
    || Number(gravado?.totalFinal) !== 1064.95
    || (Array.isArray(gravado?.parcelas) && gravado.parcelas.length !== 0)
  ) {
    throw new Error('O MySQL não confirmou integralmente o orçamento 2439 do PONTAL.')
  }

  console.info('[V293] Orçamento 2439 do PONTAL inserido/substituído e confirmado.', {
    id,
    itens: 19,
    quantidade: 69,
    total: 1064.95,
    formaPagamento: 'EM BRANCO',
  })
  return atualizadas
}
