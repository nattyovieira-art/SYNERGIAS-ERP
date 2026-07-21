/* ORCAMENTO_2475_MADISON_DESCRICAO_EXATA_V216
   Sobrepoe SOMENTE o orcamento 2475 existente.
   Localiza o cliente MADISON CENTER ja cadastrado.
   Localiza os produtos EXCLUSIVAMENTE pela descricao do cadastro atual.
   Nao cria cliente, produto ou novo orcamento.
*/

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

function precoVendaProduto(produto: any): number {
  return numeroSeguro(
    produto?.vendaVarejo ??
      produto?.precoVenda ??
      produto?.valorVenda ??
      produto?.preco ??
      produto?.valorUnitario ??
      produto?.valor,
  )
}

type RegraProduto = {
  descricao: string
  quantidade: number
}

const REGRAS: RegraProduto[] = [
  { descricao: 'AGUA SANITÁRIA 5L | QMFEL', quantidade: 1 },
  { descricao: 'ALCOOL LIQUIDO 70° 5L | FLOPS', quantidade: 1 },
  { descricao: 'LIMPADOR MULTIUSO OX2 1:1000 5L | UP', quantidade: 2 },
  { descricao: 'DETERGENTE NEUTRO 5L LOUÇASUL | BEJUVA', quantidade: 1 },
  { descricao: 'ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', quantidade: 16 },
  { descricao: 'FIBRA VEGETAL USO GERAL SLIM | NB', quantidade: 1 },
  { descricao: 'PANO MICROFIBRA UNIVERSAL 40CMX40CM | PFPRO', quantidade: 4 },
  { descricao: 'PANO MICROFIBRA VIDRO 40CX40CM | PFPRO', quantidade: 2 },
  { descricao: 'LIMPA VIDROS 500ML C/SPRAY | ZAVASKI', quantidade: 2 },
  { descricao: 'PANO ALVEJADO 100% ALGODÃO 40CM X 65CM', quantidade: 4 },
  { descricao: 'PAPEL HIGIENICO F. DUPLA 10CMX200M 100% CELULOSE | PSA', quantidade: 2 },
  { descricao: 'PAPEL TOALHA INTERFOLHADO FS 20CMX20CM C/1000FLS 100% CELULOSE | RPEL', quantidade: 4 },
  { descricao: 'PASTILHA ADESIVA C/03 UN | PATO', quantidade: 10 },
  { descricao: 'BORRIFADOR TRANSPARENTE 500ML | NB', quantidade: 2 },
  { descricao: 'SABÃO EM BARRA GLICERINADO 200G | ZAVASKI', quantidade: 1 },
  { descricao: 'SACO DE LIXO 150L PRETO RESISTENTE 0.10M / 90X120CM C/50UN', quantidade: 1 },
  { descricao: 'SACO DE LIXO 100L PRETO RESISTENTE 0.10M / 75X90CM C/100UN', quantidade: 1 },
  { descricao: 'SACO DE LIXO 60L PRETO LEVE 0.06M / 60X70CM C/100UN', quantidade: 1 },
  { descricao: 'SAPONACEO CREMOSO FLORAL/LAVANDA/LIMÃO 250ML | SANYMIX', quantidade: 5 },
  { descricao: 'TELA MICTÓRIO PERFUMADA | SYNERGIAS', quantidade: 2 },
  { descricao: 'AÇUCAR REFINADO 1K | ALTO ALEGRE', quantidade: 1 },
  { descricao: 'CAFÉ EXTRA FORTE 500G | MELLITA', quantidade: 1 },
  { descricao: 'FILTRO 102/30 | BOM JESUS', quantidade: 1 },
  { descricao: 'ESPONJA LÃ DE AÇO C/8UN | 45G | ASSOLAN', quantidade: 1 },
  { descricao: 'PAPEL A4 75G C/500FLS | REPORT', quantidade: 1 },
  { descricao: 'PROTOCOLO DE CORRESPONDECIA 104 FLS 154X216MM | SD', quantidade: 1 },
]

function localizarOrcamento(vendas: any[], numeroEsperado: string) {
  return vendas
    .map((venda, indice) => ({ venda, indice }))
    .filter(({ venda }) => {
      const numero = String(venda?.numeroOrcamento || venda?.numero || venda?.codigo || '')
        .replace(/\D/g, '')
      const tipo = normalizar(venda?.tipo || venda?.tipoVenda || venda?.origem || '')
      const parecePedido = Boolean(venda?.numeroPedido) || tipo.includes('PEDIDO')
      return numero === numeroEsperado && !parecePedido
    })
}

function localizarProdutoExato(produtos: any[], descricaoEsperada: string) {
  const esperado = normalizar(descricaoEsperada)
  return produtos.filter((produto) => normalizar(descricaoProduto(produto)) === esperado)
}

function falhar(titulo: string, detalhes: string[]): void {
  const mensagem = [titulo, ...detalhes].join('\n')
  console.error('[V216]', mensagem)
}

export function aplicarOrcamento2475MadisonDescricaoExata(
  vendas: any[],
  produtos: any[],
  clientes: any[],
): any[] {
  const listaVendas = Array.isArray(vendas) ? vendas : []
  const listaProdutos = Array.isArray(produtos) ? produtos : []
  const listaClientes = Array.isArray(clientes) ? clientes : []

  const alvo = localizarOrcamento(listaVendas, '2475')
  const referencia = localizarOrcamento(listaVendas, '2474')

  if (alvo.length !== 1) {
    falhar('A substituição do orçamento 2475 foi bloqueada.', [
      `Foram encontrados ${alvo.length} orçamentos com o número 2475.`,
      'Nenhum orçamento novo foi criado.',
    ])
    return listaVendas
  }

  if (alvo[0].venda?.origemAtualizacao === 'ORCAMENTO_2475_MADISON_DESCRICAO_EXATA_V216') {
    return listaVendas
  }

  const clientesMadison = listaClientes.filter((cliente) => {
    const documento = documentoCliente(cliente)
    const nome = normalizar(nomeCliente(cliente))
    return documento === '05486861000145' || nome === 'MADISON CENTER'
  })

  const clientesUnicos = clientesMadison.filter((cliente, indice, lista) => {
    const chave = texto(cliente?.id, cliente?.clienteId, cliente?.codigo, nomeCliente(cliente))
    return lista.findIndex((item) =>
      texto(item?.id, item?.clienteId, item?.codigo, nomeCliente(item)) === chave,
    ) === indice
  })

  if (clientesUnicos.length !== 1) {
    falhar('O cliente MADISON CENTER não foi localizado de forma única.', [
      `Cadastros compatíveis encontrados: ${clientesUnicos.length}.`,
      'Nenhum cliente foi criado.',
    ])
    return listaVendas
  }

  const localizados = REGRAS.map((regra) => ({
    regra,
    encontrados: localizarProdutoExato(listaProdutos, regra.descricao),
  }))

  const falhas = localizados.filter(({ encontrados }) => encontrados.length !== 1)
  if (falhas.length > 0) {
    falhar(
      'O orçamento 2475 não foi alterado porque alguns produtos não foram localizados de forma única pela descrição.',
      falhas.map(({ regra, encontrados }) =>
        `- ${regra.descricao}: ${encontrados.length === 0 ? 'não localizado' : `${encontrados.length} cadastros encontrados`}`,
      ).concat('Nenhum produto foi criado.'),
    )
    return listaVendas
  }

  const referenciaVenda = referencia.length === 1 ? referencia[0].venda : undefined
  const itensReferencia = Array.isArray(referenciaVenda?.itens) ? referenciaVenda.itens : []
  const cliente = clientesUnicos[0]

  const itens = localizados.map(({ regra, encontrados }, indice) => {
    const produto = encontrados[0]
    const descricao = descricaoProduto(produto)
    const itemReferencia = itensReferencia.find(
      (item: any) => normalizar(item?.descricao) === normalizar(descricao),
    )
    const valorUnitario = numeroSeguro(itemReferencia?.valorUnitario) || precoVendaProduto(produto)

    if (valorUnitario <= 0) {
      throw new Error(`Produto sem preço de venda: ${descricao}`)
    }

    const quantidade = regra.quantidade
    const custoUnitario = numeroSeguro(
      produto?.custo ?? produto?.custoMedioAtual ?? produto?.ultimoCustoCompra,
    )

    return {
      id: `2475-item-${indice + 1}`,
      produtoId: texto(produto?.id),
      codigo: texto(produto?.codigo, produto?.codigoInterno),
      codigoProduto: texto(produto?.codigo, produto?.codigoInterno),
      codigoBarras: texto(produto?.codigoBarras, produto?.ean, produto?.gtin),
      descricao,
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
      vinculoProdutoOrigem: 'DESCRICAO_EXATA_ATUAL_ERP_V216',
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

  const subtotal = Number(
    itens.reduce((soma, item) => soma + Number(item.valorTotal || 0), 0).toFixed(2),
  )
  const quantidadeTotalItens = itens.reduce(
    (soma, item) => soma + Number(item.quantidade || 0),
    0,
  )

  if (itens.length !== 26 || quantidadeTotalItens !== 69) {
    falhar('A validação final do orçamento 2475 falhou.', [
      `Produtos: ${itens.length}; esperado: 26.`,
      `Quantidade total: ${quantidadeTotalItens}; esperado: 69.`,
    ])
    return listaVendas
  }

  const { venda: atual, indice } = alvo[0]
  const agora = new Date().toISOString()
  const pagamentosAtuais = Array.isArray(atual?.pagamentos) ? atual.pagamentos : []
  const pagamentos = pagamentosAtuais.length > 0
    ? pagamentosAtuais.map((pagamento: any, indicePagamento: number) => ({
        ...pagamento,
        valor: indicePagamento === 0 ? subtotal : 0,
      }))
    : pagamentosAtuais

  const atualizado = {
    ...atual,
    tipo: 'Orçamento',
    numero: '2475',
    numeroOrcamento: '2475',
    clienteId: texto(cliente?.id, cliente?.clienteId, cliente?.codigo, cliente?.codigoCliente),
    clienteNome: nomeCliente(cliente),
    clienteDocumento: documentoCliente(cliente),
    cnpjCpf: documentoCliente(cliente),
    cliente: referenciaVenda?.cliente || atual?.cliente,
    enderecoEntrega: referenciaVenda?.enderecoEntrega || atual?.enderecoEntrega,
    enderecoEntregaFinal: referenciaVenda?.enderecoEntregaFinal || atual?.enderecoEntregaFinal,
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
    pagamentos,
    atualizadoEm: agora,
    origemAtualizacao: 'ORCAMENTO_2475_MADISON_DESCRICAO_EXATA_V216',
  }

  const resultado = [...listaVendas]
  resultado[indice] = atualizado

  console.info('[V216] Orçamento 2475 sobreposto com sucesso.', {
    cliente: nomeCliente(cliente),
    produtos: itens.length,
    quantidadeTotalItens,
    subtotal,
    localizacao: 'DESCRICAO_EXATA',
  })

  return resultado
}
