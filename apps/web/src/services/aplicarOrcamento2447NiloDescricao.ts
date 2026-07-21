/* ORCAMENTO_2447_NILO_DESCRICAO_CNPJ_V250
   Sobrepõe somente o orçamento 2447 existente.
   Localiza os 26 produtos pela descrição do cadastro atual.
   Corrige o CNPJ do NILO COUNTRY no orçamento e na coleção central de clientes.
   Não cria cliente, produto ou outro orçamento.
*/

const MARCADOR = 'ORCAMENTO_2447_NILO_DESCRICAO_CNPJ_V250'
const CNPJ_NILO = '63899708000146'

function normalizar(valor: unknown): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
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
  return texto(
    cliente?.nomeRazaoSocial,
    cliente?.razaoSocial,
    cliente?.nomeFantasia,
    cliente?.nome,
    cliente?.clienteNome,
  )
}

function documentoCliente(cliente: any): string {
  return texto(cliente?.cnpjCpf, cliente?.cnpj, cliente?.cpf, cliente?.documento)
    .replace(/\D/g, '')
}

type RegraProduto = {
  descricao: string
  aliases?: string[]
  quantidade: number
  valorUnitario: number
}

const REGRAS: RegraProduto[] = [
  { descricao: 'DESINFETANTE LAVANDA 5L | BRILHA SUL', quantidade: 6, valorUnitario: 12.15 },
  { descricao: 'CERA LIQUIDA SEMI BRILHO INCOLOR 5L | BLIM', quantidade: 1, valorUnitario: 37.90 },
  { descricao: 'MAX STAR 5L | MXSN', quantidade: 6, valorUnitario: 59.50 },
  { descricao: 'AGUA SANITÁRIA 5L | QMFEL', quantidade: 3, valorUnitario: 8.50 },
  { descricao: 'SAPONACEO CLASSICO 300ML | UTL', quantidade: 6, valorUnitario: 3.80 },
  { descricao: 'ÓLEO DE PEROBA KING | 200 ML', quantidade: 5, valorUnitario: 15.90 },
  { descricao: 'SABONETE LIQUIDO REFIL BAG 800ML C/MANGUEIRA | NB', quantidade: 6, valorUnitario: 10.90 },
  { descricao: 'ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', quantidade: 10, valorUnitario: 0.69 },
  { descricao: 'PAPEL HIGIENICO ROLÃO 8CMX300M C/8 ROLOS F SIMPLES 100% CEL | PSA', quantidade: 2, valorUnitario: 50.90 },
  { descricao: 'PAPEL TOALHA BOBINA C/6 ROLOS 200M 20G 100% CEL | PSA', quantidade: 3, valorUnitario: 81.90 },
  { descricao: 'PAPEL TOALHA INTERFOLHADO FOLHA DUPLA 22,5X20CM C/ 2000UN | IPEL', quantidade: 3, valorUnitario: 89.90 },
  { descricao: 'PANO ALVEJADO 100% ALGODÃO 40CM X 65CM', quantidade: 10, valorUnitario: 3.80 },
  { descricao: 'PANO MICROFIBRA 30CMX30CM | PFPRO', quantidade: 10, valorUnitario: 2.15 },
  { descricao: 'CABO CHAPA AÇO 140CM C/ROSCA | PFPRO', quantidade: 4, valorUnitario: 8.50 },
  { descricao: 'VASSOURA DE NYLON BELLA S/CABO | DLCN', quantidade: 4, valorUnitario: 6.30 },
  { descricao: 'ESCOVA SANITÁRIA S/SUPORTE | PLURI', quantidade: 4, valorUnitario: 3.78 },
  { descricao: 'SACO DE LIXO 40L PRETO FLEX 0.02M/50X60CM C/100UN', quantidade: 5, valorUnitario: 8.95 },
  { descricao: 'LUSTRA MOVEIS 200ML | POLWAX', quantidade: 5, valorUnitario: 5.40 },
  { descricao: 'SACO DE LIXO 60L PRETO FLEX 0.02M/60X70CM C/100UN', quantidade: 5, valorUnitario: 12.40 },
  { descricao: 'SACO DE LIXO 100L PRETO LEVE 0.06M / 75X90CM C/100UN', quantidade: 4, valorUnitario: 35.50 },
  { descricao: 'MOP UMIDO ALGODÃO 190G | NB', quantidade: 10, valorUnitario: 8.35 },
  { descricao: 'MOP UMIDO 340G | NB', quantidade: 6, valorUnitario: 13.29 },
  { descricao: 'BALDE 14L C/ESPREMEDOR | BTTN', quantidade: 2, valorUnitario: 34.90 },
  {
    descricao: 'DETERGENTE NEUTRO 5L | GMRÃES',
    aliases: ['DETERGENTE NEUTRO 5L | GMRAES', 'DETERGENTE NEUTRO 5L | GUIMARÃES'],
    quantidade: 6,
    valorUnitario: 21.50,
  },
  { descricao: 'ODORIZADOR SPRAY PURO AR LAVANDA 500ML | PURO AR', quantidade: 5, valorUnitario: 9.70 },
  { descricao: 'DESINCRUSTANTE ALCALINO CLORADO F200 | 5L', quantidade: 2, valorUnitario: 39.90 },
]

function localizarOrcamento(vendas: any[]) {
  return vendas
    .map((venda, indice) => ({ venda, indice }))
    .filter(({ venda }) => {
      const numero = String(venda?.numeroOrcamento || venda?.numero || venda?.codigo || '')
        .replace(/\D/g, '')
      const tipo = normalizar(venda?.tipo || venda?.tipoVenda || venda?.origem || '')
      return numero === '2447' && !Boolean(venda?.numeroPedido) && !tipo.includes('PEDIDO')
    })
}

function localizarProduto(produtos: any[], regra: RegraProduto) {
  const nomesAceitos = [regra.descricao, ...(regra.aliases || [])].map(normalizar)
  return produtos.filter((produto) => nomesAceitos.includes(normalizar(descricaoProduto(produto))))
}

function corrigirClienteNilo(cliente: any): any {
  return {
    ...cliente,
    tipoPessoa: 'Jurídica',
    tipo: texto(cliente?.tipo, 'Jurídica'),
    cnpj: CNPJ_NILO,
    cpf: '',
    cnpjCpf: CNPJ_NILO,
    documento: CNPJ_NILO,
    clienteDocumento: CNPJ_NILO,
    atualizadoEm: new Date().toISOString(),
    origemAtualizacao: MARCADOR,
  }
}

function avisar(mensagem: string): void {
  console.warn('[IMPORTAÇÃO SILENCIOSA]', mensagem)
}

export function aplicarOrcamento2447NiloDescricao(
  vendasEntrada: any[],
  produtosEntrada: any[],
  clientesEntrada: any[],
): { vendas: any[]; clientes: any[] } {
  const vendas = Array.isArray(vendasEntrada) ? vendasEntrada : []
  const produtos = Array.isArray(produtosEntrada) ? produtosEntrada : []
  const clientes = Array.isArray(clientesEntrada) ? clientesEntrada : []
  const alvos = localizarOrcamento(vendas)

  if (alvos.length !== 1) {
    avisar(`A correção do orçamento 2447 foi bloqueada. Foram encontrados ${alvos.length} registros com esse número.`)
    return { vendas, clientes }
  }

  const candidatosCliente = clientes.filter((cliente) => {
    const nome = normalizar(nomeCliente(cliente))
    const documento = documentoCliente(cliente)
    return nome === 'NILO COUNTRY' || documento === CNPJ_NILO || documento === '63899708000'
  })

  const clientesUnicos = candidatosCliente.filter((cliente, indice, lista) => {
    const chave = texto(cliente?.id, cliente?.codigo, cliente?.clienteId, nomeCliente(cliente))
    return lista.findIndex((item) =>
      texto(item?.id, item?.codigo, item?.clienteId, nomeCliente(item)) === chave,
    ) === indice
  })

  if (clientesUnicos.length !== 1) {
    avisar(`A correção do orçamento 2447 foi bloqueada. Cadastros compatíveis de NILO COUNTRY: ${clientesUnicos.length}.`)
    return { vendas, clientes }
  }

  const clienteAlvo = clientesUnicos[0]
  const clientesCorrigidos = clientes.map((cliente) =>
    cliente === clienteAlvo ? corrigirClienteNilo(cliente) : cliente,
  )

  const atual = alvos[0].venda
  const jaCorrigido = atual?.origemAtualizacao === MARCADOR
  if (jaCorrigido && documentoCliente(atual) === CNPJ_NILO) {
    return { vendas, clientes: clientesCorrigidos }
  }

  const localizados = REGRAS.map((regra) => ({ regra, encontrados: localizarProduto(produtos, regra) }))
  const falhas = localizados.filter(({ encontrados }) => encontrados.length !== 1)
  if (falhas.length > 0) {
    avisar([
      'O orçamento 2447 não foi alterado porque alguns produtos não foram localizados de forma única pela descrição:',
      ...falhas.map(({ regra, encontrados }) =>
        `- ${regra.descricao}: ${encontrados.length === 0 ? 'não localizado' : `${encontrados.length} cadastros encontrados`}`,
      ),
      'Nenhum produto, cliente ou orçamento foi criado.',
    ].join('\n'))
    return { vendas, clientes: clientesCorrigidos }
  }

  const itens = localizados.map(({ regra, encontrados }, indice) => {
    const produto = encontrados[0]
    const quantidade = regra.quantidade
    const valorUnitario = regra.valorUnitario
    const custoUnitario = numeroSeguro(
      produto?.custo ?? produto?.custoMedioAtual ?? produto?.ultimoCustoCompra,
    )

    return {
      id: `2447-item-${indice + 1}`,
      produtoId: texto(produto?.id),
      codigo: texto(produto?.codigo, produto?.codigoInterno),
      codigoProduto: texto(produto?.codigo, produto?.codigoInterno),
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
      estoqueDisponivel: numeroSeguro(
        produto?.estoqueAtual ?? produto?.estoque ?? produto?.quantidadeEstoque,
      ),
      produtoVinculado: true,
      vinculoProdutoOrigem: 'DESCRICAO_EXATA_ATUAL_ERP_V250',
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

  const quantidadeTotalItens = itens.reduce((soma, item) => soma + item.quantidade, 0)
  const subtotal = Number(itens.reduce((soma, item) => soma + item.valorTotal, 0).toFixed(2))

  if (itens.length !== 26 || quantidadeTotalItens !== 133 || subtotal !== 2185.01) {
    avisar(`A validação do orçamento 2447 falhou. Produtos: ${itens.length}/26; quantidade: ${quantidadeTotalItens}/133; total: R$ ${subtotal.toFixed(2)}/R$ 2185,01.`)
    return { vendas, clientes: clientesCorrigidos }
  }

  const clienteCorrigido = corrigirClienteNilo(clienteAlvo)
  const agora = new Date().toISOString()
  const parcelasAtuais = Array.isArray(atual?.parcelas) ? atual.parcelas : []
  const parcelas = parcelasAtuais.length > 0
    ? parcelasAtuais.map((parcela: any, indice: number) => ({
        ...parcela,
        valor: indice === 0 ? subtotal : 0,
      }))
    : parcelasAtuais

  const atualizado = {
    ...atual,
    tipo: 'Orçamento',
    numero: '2447',
    numeroOrcamento: '2447',
    clienteId: texto(clienteCorrigido?.id, clienteCorrigido?.clienteId, clienteCorrigido?.codigo),
    clienteNome: nomeCliente(clienteCorrigido),
    clienteDocumento: CNPJ_NILO,
    cnpjCpf: CNPJ_NILO,
    cnpj: CNPJ_NILO,
    cpf: '',
    documento: CNPJ_NILO,
    cliente: {
      ...(typeof atual?.cliente === 'object' && atual?.cliente ? atual.cliente : {}),
      ...clienteCorrigido,
      cnpj: CNPJ_NILO,
      cpf: '',
      cnpjCpf: CNPJ_NILO,
      documento: CNPJ_NILO,
    },
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
    parcelas,
    atualizadoEm: agora,
    origemAtualizacao: MARCADOR,
  }

  const vendasCorrigidas = [...vendas]
  vendasCorrigidas[alvos[0].indice] = atualizado

  console.info('[V250] Orçamento 2447 e CNPJ do NILO COUNTRY corrigidos.', {
    produtos: itens.length,
    quantidadeTotalItens,
    subtotal,
    cnpj: CNPJ_NILO,
    localizacaoProdutos: 'DESCRICAO_EXATA',
  })

  return { vendas: vendasCorrigidas, clientes: clientesCorrigidos }
}
