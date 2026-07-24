/* SYNERGIAS_ORCAMENTOS_2485_2486_DESCRICAO_V294 */
import { atualizarRegistroColecaoCentral, carregarColecaoCentral } from './erpApi'

const MARCADOR = 'SYNERGIAS_ORCAMENTOS_2485_2486_DESCRICAO_V294'
const ORCAMENTOS = [{"numero":"2485","cliente":"CONDOMINIO GRAND PARK LINDOIA","emissao":"21/07/2026","entrega":"23/07/2026","validade":"28/07/2026","statusPdf":"Aberto","quantidadeTotal":142.0,"valorTotal":1989.76,"itens":[{"descricao":"DETERGENTE NEUTRO/CRISTAL 5L | BRILHA SUL","quantidade":2.0,"unitario":16.98,"total":33.96},{"descricao":"RODO COMBINADO 25CM C/LUVA S/CABO | TW","quantidade":2.0,"unitario":24.9,"total":49.8},{"descricao":"CABO ALUMÍNIO 70CM C/ROSCA ESTRIADO | SYNERGIAS","quantidade":2.0,"unitario":9.35,"total":18.7},{"descricao":"ALCOOL GEL 70° 5L | FLOPS","quantidade":2.0,"unitario":35.9,"total":71.8},{"descricao":"PANO MULTIUSO 600 PANOS C/ 240MX40CMX20CM | LF CLEAN","quantidade":1.0,"unitario":59.9,"total":59.9},{"descricao":"LIMPADOR CONC. ALGODÃO 120ML| COALA","quantidade":4.0,"unitario":12.99,"total":51.96},{"descricao":"LIMPADOR CONC. SOFT 120ML | COALA","quantidade":3.0,"unitario":12.99,"total":38.97},{"descricao":"LIMPADOR CONC. FLORAL 120ML | COALA","quantidade":3.0,"unitario":12.99,"total":38.97},{"descricao":"LIMPADOR PERFUMADO JASMIM E ALGAS 5L | GMRÃES","quantidade":5.0,"unitario":28.9,"total":144.5},{"descricao":"LIMPADOR PERFUMADO ROMANCE/ORQUIDEA NEGRA 5L | GMRÃES","quantidade":5.0,"unitario":28.9,"total":144.5},{"descricao":"AGUA SANITÁRIA 5L | QMFEL","quantidade":5.0,"unitario":8.9,"total":44.5},{"descricao":"PAPEL TOALHA INTERF. 20CMX20CM C/800FLS F SIMPLES 100% CEL | PSA","quantidade":50.0,"unitario":12.75,"total":637.5},{"descricao":"PAPEL HIGIENICO INTERF. F. DUPLA 9,5X20 C/8.000 FLS | PSA","quantidade":5.0,"unitario":80.9,"total":404.5},{"descricao":"MOP UMIDO ALGODÃO 190G | NB","quantidade":10.0,"unitario":8.35,"total":83.5},{"descricao":"ESCOVA SANITÁRIA PLUS C/ ESTOJO | PLURI","quantidade":6.0,"unitario":7.75,"total":46.5},{"descricao":"SAPONACEO CREMOSO FLORAL/LAVANDA/LIMÃO 250ML | SANYMIX","quantidade":6.0,"unitario":3.9,"total":23.4},{"descricao":"PANO ALVEJADO 100% ALGODÃO 40CM X 65CM","quantidade":10.0,"unitario":3.7,"total":37.0},{"descricao":"SABONETE LIQUIDO DOVE 5L | SUAVETOK","quantidade":1.0,"unitario":16.25,"total":16.25},{"descricao":"ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN","quantidade":15.0,"unitario":0.65,"total":9.75},{"descricao":"VASSOURA DE NYLON BELLA S/CABO | DLCN","quantidade":5.0,"unitario":6.76,"total":33.8}]},{"numero":"2486","cliente":"CONDOMINIO GRAND PARK LINDOIA","emissao":"21/07/2026","entrega":"23/07/2026","validade":"28/07/2026","statusPdf":"Aberto","quantidadeTotal":188.0,"valorTotal":2145.48,"itens":[{"descricao":"RODO COMBINADO 25CM C/LUVA S/CABO | TW","quantidade":2.0,"unitario":24.9,"total":49.8},{"descricao":"PAPEL HIGIENICO ROLÃO 8CMX300M C/8 ROLOS F SIMPLES 100% CEL | PSA","quantidade":2.0,"unitario":50.9,"total":101.8},{"descricao":"ESPONJA DUPLA FACE S /PELICULA | BTTN","quantidade":20.0,"unitario":0.8,"total":16.0},{"descricao":"PANO MULTIUSO 600 PANOS C/ 240MX40CMX20CM | LF CLEAN","quantidade":1.0,"unitario":59.9,"total":59.9},{"descricao":"PANO DE PRATO BRANCO | 44CMX67CM","quantidade":10.0,"unitario":3.5,"total":35.0},{"descricao":"CABO DE ALUMINIO 1,40CM | PERFECT","quantidade":3.0,"unitario":27.0,"total":81.0},{"descricao":"LIMPADOR CONC. SOFT 120ML | COALA","quantidade":4.0,"unitario":12.99,"total":51.96},{"descricao":"LIMPADOR CONC. ALGODÃO 120ML| COALA","quantidade":4.0,"unitario":12.99,"total":51.96},{"descricao":"LIMPADOR CONC. ERVA DOCE 120ML | COALA","quantidade":4.0,"unitario":12.5,"total":50.0},{"descricao":"LIMPADOR CONC. LAVANDA 120ML| COALA","quantidade":4.0,"unitario":12.99,"total":51.96},{"descricao":"LIMPADOR CONC. CITRONELA 120ML | COALA","quantidade":4.0,"unitario":12.5,"total":50.0},{"descricao":"LIMPADOR PERFUMADO JASMIM E ALGAS 5L | GMRÃES","quantidade":5.0,"unitario":28.9,"total":144.5},{"descricao":"LIMPADOR PERFUMADO ROMANCE/ORQUIDEA NEGRA 5L | GMRÃES","quantidade":5.0,"unitario":28.9,"total":144.5},{"descricao":"PAPEL HIGIENICO INTERF. F. DUPLA 9,5X20 C/8.000 FLS | PSA","quantidade":5.0,"unitario":80.9,"total":404.5},{"descricao":"PAPEL TOALHA INTERF. 20CMX20CM C/800FLS F SIMPLES 100% CEL | PSA","quantidade":30.0,"unitario":12.75,"total":382.5},{"descricao":"AGUA SANITÁRIA 5L | QMFEL","quantidade":10.0,"unitario":8.9,"total":89.0},{"descricao":"FIBRA BRANCA SLIM USO LEVE | NB","quantidade":10.0,"unitario":1.23,"total":12.3},{"descricao":"VEJA MULTIUSO ORIGINAL | 500ML","quantidade":4.0,"unitario":5.5,"total":22.0},{"descricao":"VEJA MULTIUSO FLORAL | 500ML","quantidade":3.0,"unitario":5.5,"total":16.5},{"descricao":"VEJA MULTIUSO LAVANDA | 500ML","quantidade":3.0,"unitario":5.5,"total":16.5},{"descricao":"MOP UMIDO ALGODÃO 190G | NB","quantidade":20.0,"unitario":8.35,"total":167.0},{"descricao":"SAPONACEO CREMOSO FLORAL/LAVANDA/LIMÃO 250ML | SANYMIX","quantidade":10.0,"unitario":3.9,"total":39.0},{"descricao":"PANO ALVEJADO 100% ALGODÃO 40CM X 65CM","quantidade":20.0,"unitario":3.7,"total":74.0},{"descricao":"VASSOURA DE NYLON BELLA S/CABO | DLCN","quantidade":5.0,"unitario":6.76,"total":33.8}]}]

function normalizar(valor: unknown): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/[^A-Z0-9]+/g, ' ')
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

function numeroDocumento(venda: any): string {
  return texto(venda?.numeroOrcamento, venda?.numero, venda?.codigo).replace(/\D/g, '')
}

function possuiIndicacaoNfe(venda: any): boolean {
  const campos = [
    venda?.nfe, venda?.numeroNfe, venda?.numeroNotaFiscal, venda?.chaveNfe,
    venda?.chaveAcesso, venda?.protocoloNfe, venda?.danfe, venda?.xmlNfe,
    venda?.notaFiscal, venda?.nf,
  ]
  return campos.some((valor) => {
    if (valor === null || valor === undefined || valor === '') return false
    if (typeof valor === 'object') return Object.keys(valor).length > 0
    return String(valor).trim() !== ''
  })
}

function vendaProtegida(venda: any): boolean {
  const status = normalizar(texto(venda?.status, venda?.statusOrcamento, venda?.situacao, venda?.etapa, venda?.tipo))
  const palavras = ['APROVADO', 'EFETIVADO', 'CONVERTIDO', 'PEDIDO', 'CONCLUIDO', 'FATURADO', 'EMITIDO', 'NFE', 'NOTA FISCAL']
  if (palavras.some((palavra) => status.includes(normalizar(palavra)))) return true
  if (texto(venda?.numeroPedido, venda?.pedidoNumero, venda?.pedidoId)) return true
  if (possuiIndicacaoNfe(venda)) return true
  if (venda?.aprovado === true || venda?.efetivado === true || venda?.faturado === true) return true
  return false
}

function localizarProdutoSomentePorDescricao(produtos: any[], descricaoEsperada: string): any[] {
  const alvo = normalizar(descricaoEsperada)
  return produtos.filter((produto) => normalizar(descricaoProduto(produto)) === alvo)
}

function localizarCliente(clientes: any[], nomeEsperado: string): any[] {
  const alvo = normalizar(nomeEsperado)
  return clientes.filter((cliente) => normalizar(nomeCliente(cliente)) === alvo)
}

async function aplicarUm(vendas: any[], produtos: any[], clientes: any[], carga: any): Promise<any[]> {
  const candidatos = vendas.filter((venda) => numeroDocumento(venda) === String(carga.numero))
  if (candidatos.length > 1) {
    console.warn(`[V294] ${carga.numero} ignorado: existem ${candidatos.length} registros com o mesmo número.`)
    return vendas
  }

  const existente = candidatos[0]
  if (existente && vendaProtegida(existente)) {
    console.info(`[V294] ${carga.numero} preservado: já está aprovado, efetivado, convertido, faturado ou ligado a NF-e.`)
    return vendas
  }

  const clientesEncontrados = localizarCliente(clientes, carga.cliente)
  if (clientesEncontrados.length !== 1) {
    throw new Error(`Orçamento ${carga.numero} bloqueado: cliente "${carga.cliente}" retornou ${clientesEncontrados.length} cadastro(s).`)
  }
  const cliente = clientesEncontrados[0]

  const itens = carga.itens.map((item: any, indice: number) => {
    const encontrados = localizarProdutoSomentePorDescricao(produtos, item.descricao)
    if (encontrados.length !== 1) {
      throw new Error(`Orçamento ${carga.numero} bloqueado: descrição "${item.descricao}" retornou ${encontrados.length} produto(s).`)
    }
    const produto = encontrados[0]
    const custoUnitario = numeroSeguro(produto?.custoMedioAtual ?? produto?.custo ?? produto?.ultimoCustoCompra)
    return {
      id: `${carga.numero}-item-${indice + 1}`,
      produtoId: texto(produto?.id),
      descricao: descricaoProduto(produto),
      unidade: texto(produto?.unidade, produto?.unidadeMedida, 'Unidade'),
      quantidade: Number(item.quantidade),
      valorUnitario: Number(item.unitario),
      desconto: 0,
      descontoValor: 0,
      descontoPercentual: 0,
      valorTotal: Number(Number(item.total).toFixed(2)),
      custoUnitario,
      custoTotal: Number((Number(item.quantidade) * custoUnitario).toFixed(2)),
      estoqueDisponivel: numeroSeguro(produto?.estoqueAtual ?? produto?.estoque ?? produto?.quantidadeEstoque),
      produtoVinculado: true,
      vinculoProdutoOrigem: 'DESCRICAO_EXATA_PLANILHA_PRODUTOS_37_V294',
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

  const quantidade = Number(itens.reduce((soma: number, item: any) => soma + Number(item.quantidade || 0), 0).toFixed(2))
  const total = Number(itens.reduce((soma: number, item: any) => soma + Number(item.valorTotal || 0), 0).toFixed(2))
  if (quantidade !== Number(carga.quantidadeTotal) || total !== Number(carga.valorTotal)) {
    throw new Error(`Orçamento ${carga.numero} bloqueado pela validação de quantidade/total.`)
  }

  const agora = new Date().toISOString()
  const id = texto(existente?.id) || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `orcamento-${carga.numero}-${Date.now()}`)
  const subtotal = Number(carga.valorTotal)
  const enderecoFiscal = [texto(cliente?.endereco, cliente?.logradouro), texto(cliente?.numero)].filter(Boolean).join(', ')
  const enderecoEntrega = texto(cliente?.enderecoEntrega, cliente?.logradouroEntrega, enderecoFiscal)

  const orcamento = {
    ...(existente || {}),
    id,
    tipo: 'Orçamento',
    numero: String(carga.numero),
    numeroOrcamento: String(carga.numero),
    vendedor: texto(existente?.vendedor, 'NATÁLIA VIEIRA'),
    clienteId: texto(cliente?.id, cliente?.clienteId, cliente?.codigo),
    clienteCodigo: texto(cliente?.codigo, cliente?.id),
    clienteNome: nomeCliente(cliente),
    clienteDocumento: documentoCliente(cliente),
    clienteEmailNotaFiscal: texto(cliente?.emailNotaFiscal, cliente?.email),
    clienteInscricaoEstadual: texto(cliente?.inscricaoEstadual, cliente?.ie),
    cliente: { ...(typeof existente?.cliente === 'object' && existente?.cliente ? existente.cliente : {}), ...cliente },
    dataEmissao: String(carga.emissao).split('/').reverse().join('-'),
    dataEntrega: String(carga.entrega).split('/').reverse().join('-'),
    dataValidade: String(carga.validade).split('/').reverse().join('-'),
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
    quantidadeTotalItens: Number(carga.quantidadeTotal),
    pagamentos: [],
    parcelas: [],
    formaPagamento: '',
    condicaoPagamento: '',
    condicoesPagamento: '',
    bancoCobranca: '',
    observacoesPagamento: '',
    status: 'ABERTO',
    statusOrcamento: 'Aberto',
    criadoEm: texto(existente?.criadoEm, agora),
    atualizadoEm: agora,
    marcadorInstalacao: MARCADOR,
    origemAtualizacao: MARCADOR,
  }

  await atualizarRegistroColecaoCentral('vendas', orcamento)
  const confirmacao = await carregarColecaoCentral<any>('vendas')
  const atualizadas = Array.isArray(confirmacao.data) ? confirmacao.data : []
  const gravado = atualizadas.find((venda) => String(venda?.id || '') === id)
  if (!gravado || numeroDocumento(gravado) !== String(carga.numero) || !Array.isArray(gravado?.itens) || gravado.itens.length !== carga.itens.length || Number(gravado?.totalFinal) !== subtotal) {
    throw new Error(`O MySQL não confirmou integralmente o orçamento ${carga.numero}.`)
  }
  return atualizadas
}

export async function aplicarOrcamentosGrandParkUmaVez(vendasEntrada: any[], produtosEntrada: any[], clientesEntrada: any[]): Promise<any[]> {
  let vendas = Array.isArray(vendasEntrada) ? vendasEntrada : []
  const produtos = Array.isArray(produtosEntrada) ? produtosEntrada : []
  const clientes = Array.isArray(clientesEntrada) ? clientesEntrada : []
  for (const carga of ORCAMENTOS) vendas = await aplicarUm(vendas, produtos, clientes, carga)
  return vendas
}
