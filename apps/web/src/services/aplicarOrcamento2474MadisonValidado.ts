/* SYNERGIAS_ORCAMENTO_2474_MADISON_V208B
   Substitui SOMENTE os itens do orçamento 2474 já existente.
   Localiza o cliente Madison já cadastrado.
   Localiza os produtos atuais por código de barras.
   Não cria cliente, produto, orçamento ou orçamento.
   Mantém todas as observações vazias.
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
    const resultado = String(valor || '').trim()
    if (resultado) return resultado
  }
  return ''
}

function numeroSeguro(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0

  const bruto = String(valor ?? '').trim()
  if (!bruto) return 0

  let normalizado = bruto.replace(/R\$/gi, '').replace(/\s+/g, '')

  if (normalizado.includes(',') && normalizado.includes('.')) {
    normalizado = normalizado.replace(/\./g, '').replace(',', '.')
  } else if (normalizado.includes(',')) {
    normalizado = normalizado.replace(',', '.')
  }

  const numero = Number(normalizado.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(numero) ? numero : 0
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

function nomeProduto(produto: any): string {
  return texto(
    produto?.descricao,
    produto?.nome,
    produto?.nomeProduto,
    produto?.produto,
  )
}

type RegraItem = {
  codigoBarras: string
  descricao: string
  quantidade: number
  valorUnitario: number
}

function localizarProdutoPorCodigo(produtos: any[], codigoBarras: string): any | undefined {
  const esperado = String(codigoBarras).replace(/\D/g, '')

  const encontrados = produtos.filter((produto) => {
    const codigos = [
      produto?.codigoBarras,
      produto?.ean,
      produto?.gtin,
      produto?.codigo,
      produto?.codigoInterno,
    ].map((valor) => String(valor || '').replace(/\D/g, ''))

    return codigos.includes(esperado)
  })

  return encontrados.length === 1 ? encontrados[0] : undefined
}

function falhar(mensagem: string, detalhes: string[]): void {
  const completo = [mensagem, ...detalhes].join('\n')
  console.error(`[V208B] ${completo}`)
}

export function aplicarOrcamento2474MadisonValidado(
  vendas: any[],
  produtos: any[],
  clientes: any[],
): any[] {
  const listaVendas = Array.isArray(vendas) ? vendas : []
  const listaProdutos = Array.isArray(produtos) ? produtos : []
  const listaClientes = Array.isArray(clientes) ? clientes : []

  const registros2474 = listaVendas
    .map((venda, indice) => ({ venda, indice }))
    .filter(({ venda }) => {
      const numero = String(
        venda?.numeroOrcamento ||
        venda?.numero ||
        venda?.codigo ||
        '',
      ).replace(/\D/g, '')

      const tipo = normalizar(
        venda?.tipo ||
        venda?.tipoVenda ||
        venda?.origem ||
        '',
      )

      const parecePedido =
        Boolean(venda?.numeroPedido) ||
        tipo === 'PEDIDO' ||
        tipo.includes('PEDIDO')

      return numero === '2474' && !parecePedido
    })

  if (registros2474.length !== 1) {
    falhar(
      'A atualização do orçamento 2474 foi bloqueada.',
      [
        `Foram encontrados ${registros2474.length} registros com o número 2474.`,
        'Nenhum orçamento novo foi criado.',
      ],
    )
    return listaVendas
  }

  const clientesMadison = listaClientes.filter((cliente) => {
    const nome = normalizar(nomeCliente(cliente))
    return nome.includes('MADISON')
  })

  const clientesUnicos = clientesMadison.filter((cliente, indice, lista) => {
    const chave = texto(
      cliente?.id,
      cliente?.codigo,
      cliente?.clienteId,
      nomeCliente(cliente),
    )

    return lista.findIndex((item) =>
      texto(item?.id, item?.codigo, item?.clienteId, nomeCliente(item)) === chave
    ) === indice
  })

  if (clientesUnicos.length !== 1) {
    falhar(
      'O cliente Madison não foi localizado de forma única.',
      clientesUnicos.length === 0
        ? ['Nenhum cliente foi criado.']
        : [
            `Foram encontrados ${clientesUnicos.length} cadastros compatíveis:`,
            ...clientesUnicos.map((cliente) => `- ${nomeCliente(cliente)}`),
          ],
    )
    return listaVendas
  }

  const regras: RegraItem[] = [
    { codigoBarras: '7901210756', descricao: "LIMPADOR MULTIUSO OX2 1:1000 5L | UP", quantidade: 1, valorUnitario: 59.90 },
    { codigoBarras: '7901210529', descricao: "ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN", quantidade: 6, valorUnitario: 0.69 },
    { codigoBarras: '7901210546', descricao: "FIBRA BRANCA SLIM USO LEVE | NB", quantidade: 1, valorUnitario: 1.23 },
    { codigoBarras: '7901210704', descricao: "LIMPA VIDROS 500ML C/SPRAY | ZAVASKI", quantidade: 3, valorUnitario: 7.10 },
    { codigoBarras: '7901210980', descricao: "PANO ALVEJADO 100% ALGODÃO 40CM X 65CM", quantidade: 2, valorUnitario: 3.80 },
    { codigoBarras: '7901211034', descricao: "PAPEL HIGIENICO F. DUPLA 10CMX200M 100% CELULOSE | PSA", quantidade: 1, valorUnitario: 87.10 },
    { codigoBarras: '7901211073', descricao: "PAPEL TOALHA INTERFOLHADO FS 20CMX20CM C/1000FLS 100% CELULOSE | RPEL", quantidade: 1, valorUnitario: 15.90 },
    { codigoBarras: '7901211095', descricao: "PASTILHA ADESIVA C/03 UN | PATO", quantidade: 6, valorUnitario: 24.00 },
    { codigoBarras: '7901210155', descricao: "BORRIFADOR TRANSPARENTE 500ML | NB", quantidade: 1, valorUnitario: 4.90 },
    { codigoBarras: '7901211241', descricao: "SABÃO EM BARRA GLICERINADO 200G | ZAVASKI", quantidade: 2, valorUnitario: 2.79 },
    { codigoBarras: '7901211285', descricao: "SACO DE LIXO 100L PRETO RESISTENTE 0.10M / 75X90CM C/100UN", quantidade: 1, valorUnitario: 60.90 },
    { codigoBarras: '7901211326', descricao: "SACO DE LIXO 60L PRETO LEVE 0.06M / 60X70CM C/100UN", quantidade: 1, valorUnitario: 19.80 },
    { codigoBarras: '7901211354', descricao: "SAPONACEO CREMOSO FLORAL/LAVANDA/LIMÃO 250ML | SANYMIX", quantidade: 2, valorUnitario: 3.91 },
    { codigoBarras: '7901211180', descricao: "REFIL DIFUSOR 16ML P/APARELHO ELETRICO | BOM AR", quantidade: 1, valorUnitario: 21.10 },
    { codigoBarras: '7901210007', descricao: "AÇUCAR REFINADO 1K | ALTO ALEGRE", quantidade: 1, valorUnitario: 4.65 },
    { codigoBarras: '7901210195', descricao: "CAFÉ EXTRA FORTE 500G | MELLITA", quantidade: 1, valorUnitario: 29.99 },
    { codigoBarras: '7901211162', descricao: "PROTOCOLO DE CORRESPONDECIA 104 FLS 154X216MM | SD", quantidade: 1, valorUnitario: 11.50 }
  ]

  const localizados = regras.map((regra) => ({
    regra,
    produto: localizarProdutoPorCodigo(listaProdutos, regra.codigoBarras),
  }))

  const ausentes = localizados.filter((item) => !item.produto)

  if (ausentes.length > 0) {
    falhar(
      'O orçamento 2474 não foi alterado porque alguns produtos não foram localizados de forma única.',
      [
        ...ausentes.map(
          (item) => `- ${item.regra.codigoBarras} — ${item.regra.descricao}`,
        ),
        'Nenhum produto foi criado.',
      ],
    )
    return listaVendas
  }

  const cliente = clientesUnicos[0]
  const agora = new Date().toISOString()

  const itens = localizados.map(({ regra, produto }, indice) => {
    const quantidade = Number(regra.quantidade)
    const valorUnitario = Number(regra.valorUnitario)
    const custoUnitario = numeroSeguro(
      produto?.custo ||
      produto?.custoMedioAtual ||
      produto?.ultimoCustoCompra ||
      0,
    )

    const codigoProduto = texto(
      produto?.codigo,
      produto?.codigoInterno,
      regra.codigoBarras,
      produto?.id,
    )

    return {
      id: `2474-item-${indice + 1}`,
      produtoId: texto(produto?.id),
      codigo: codigoProduto,
      codigoProduto,
      codigoBarras: regra.codigoBarras,
      descricao: nomeProduto(produto) || regra.descricao,
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
        produto?.estoqueAtual ||
        produto?.estoque ||
        produto?.quantidadeEstoque ||
        0,
      ),
      produtoVinculado: true,
      vinculoProdutoOrigem: 'CODIGO_BARRAS_ATUAL_ERP',
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
    itens
      .reduce((soma, item) => soma + Number(item.valorTotal || 0), 0)
      .toFixed(2),
  )

  const quantidadeTotal = itens.reduce(
    (soma, item) => soma + Number(item.quantidade || 0),
    0,
  )

  if (itens.length !== 17 || quantidadeTotal !== 32 || subtotal !== 507.41) {
    falhar(
      'A validação dos itens do orçamento 2474 falhou.',
      [
        `Produtos: ${itens.length}; esperado: 17.`,
        `Quantidade total: ${quantidadeTotal}; esperado: 32.`,
        `Total calculado: ${subtotal.toFixed(2)}; esperado: 507.41.`,
      ],
    )
    return listaVendas
  }

  const { venda: atual, indice } = registros2474[0]

  const atualizado = {
    ...atual,
    tipo: 'Orçamento',
    numero: '2474',
    numeroOrcamento: '2474',
    clienteId: texto(
      cliente?.id,
      cliente?.clienteId,
      cliente?.codigo,
      cliente?.codigoCliente,
    ),
    clienteNome: nomeCliente(cliente),
    itens,
    itensEditadosManual: true,
    tipoDesconto: 'valor',
    descontoInformado: 0,
    descontoCalculado: 0,
    descontoValor: 0,
    frete: 0,
    outrosCustos: 0,
    subtotal: 507.41,
    totalFinal: 507.41,
    valorTotal: 507.41,
    observacoes: '',
    observacao: '',
    observacoesInternas: '',
    observacaoInterna: '',
    atualizadoEm: agora,
    marcadorInstalacao: 'SYNERGIAS_ORCAMENTO_2474_MADISON_V208B',
  }

  const resultado = [...listaVendas]
  resultado[indice] = atualizado

  console.info('[V208B] Orçamento 2474 atualizado e preparado para gravação central.', {
    cliente: nomeCliente(cliente),
    produtos: itens.length,
    quantidadeTotal,
    total: subtotal,
    observacoes: '',
  })

  return resultado
}