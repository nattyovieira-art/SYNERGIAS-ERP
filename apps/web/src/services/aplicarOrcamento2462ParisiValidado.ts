/* SYNERGIAS_ORCAMENTO_2462_PARISI_SOBREPOSICAO_V205H
   Sobrepõe SOMENTE o orçamento 2462 já existente.
   Localiza o cliente Parisi já existente.
   Localiza produtos já existentes pela descrição.
   Não cria cliente, produto ou novo orçamento.
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
  return texto(produto?.descricao, produto?.nome, produto?.nomeProduto, produto?.produto)
}

function textoPesquisaProduto(produto: any): string {
  return normalizar([
    nomeProduto(produto),
    produto?.marca,
    produto?.fabricante,
    produto?.categoria,
    produto?.subcategoria,
    produto?.modelo,
    produto?.tags,
  ].filter(Boolean).join(' '))
}

function precoVenda(produto: any): number {
  for (const valor of [
    produto?.vendaVarejo,
    produto?.precoVendaVarejo,
    produto?.precoVenda,
    produto?.valorVenda,
    produto?.preco,
  ]) {
    const numero = Number(valor)
    if (Number.isFinite(numero) && numero > 0) return numero
  }
  return 0
}

type Regra = {
  quantidade: number
  solicitada: string
  obrigatorios: string[]
  alternativas?: string[][]
  proibidos?: string[]
  preferidos?: string[]
}

function pontuarProduto(produto: any, regra: Regra): number {
  const descricao = textoPesquisaProduto(produto)
  if (!descricao) return -1

  const obrigatorios = regra.obrigatorios.map(normalizar)
  const alternativas = (regra.alternativas || []).map((grupo) => grupo.map(normalizar))
  const proibidos = (regra.proibidos || []).map(normalizar)
  const preferidos = (regra.preferidos || []).map(normalizar)

  if (proibidos.some((termo) => descricao.includes(termo))) return -1
  if (!obrigatorios.every((termo) => descricao.includes(termo))) return -1
  if (!alternativas.every((grupo) => grupo.some((termo) => descricao.includes(termo)))) return -1

  let pontos = obrigatorios.length * 100 + alternativas.length * 40
  preferidos.forEach((termo) => {
    if (descricao.includes(termo)) pontos += 15
  })

  const situacao = normalizar(produto?.situacao || produto?.status)
  if (situacao.includes('ATIVO')) pontos += 10

  const solicitada = normalizar(regra.solicitada)
  if (descricao === solicitada) pontos += 1000
  if (descricao.includes(solicitada) || solicitada.includes(descricao)) pontos += 150

  return pontos
}

function localizarProduto(produtos: any[], regra: Regra): any | undefined {
  const classificados = produtos
    .map((produto) => ({ produto, pontos: pontuarProduto(produto, regra) }))
    .filter((item) => item.pontos >= 0)
    .sort((a, b) => b.pontos - a.pontos)

  if (classificados.length === 0) return undefined
  if (classificados.length === 1) return classificados[0].produto

  const primeiro = classificados[0]
  const segundo = classificados[1]
  return primeiro.pontos > segundo.pontos ? primeiro.produto : undefined
}

function falhar(mensagem: string, detalhes: string[]): void {
  const completo = [mensagem, ...detalhes].join('\n')
  console.error(`[V205H] ${completo}`)
}

export function aplicarOrcamento2462ParisiValidado(
  vendas: any[],
  produtos: any[],
  clientes: any[],
): any[] {
  const listaVendas = Array.isArray(vendas) ? vendas : []
  const listaProdutos = Array.isArray(produtos) ? produtos : []
  const listaClientes = Array.isArray(clientes) ? clientes : []

  const indices2462 = listaVendas
    .map((venda, indice) => ({ venda, indice }))
    .filter(({ venda }) => {
      const numero = String(
        venda?.numeroOrcamento ||
        venda?.numero ||
        venda?.codigo ||
        '',
      ).replace(/\D/g, '')
      return numero === '2462'
    })

  if (indices2462.length !== 1) {
    falhar(
      'A sobreposição do orçamento 2462 foi bloqueada.',
      [`Foram encontrados ${indices2462.length} registros com o número 2462. Nenhum orçamento novo foi criado.`],
    )
    return listaVendas
  }

  const clientesParisi = listaClientes.filter((cliente) => {
    const nome = normalizar(nomeCliente(cliente))
    return nome === 'PARISI' ||
      nome.includes('CONDOMINIO PARISI') ||
      nome.includes('COND PARISI') ||
      nome.endsWith(' PARISI')
  })

  if (clientesParisi.length !== 1) {
    falhar(
      'O cliente Parisi não foi localizado de forma única.',
      clientesParisi.length === 0
        ? ['Nenhum cliente foi criado.']
        : [
            `Foram encontrados ${clientesParisi.length} cadastros compatíveis:`,
            ...clientesParisi.map((cliente) => `- ${nomeCliente(cliente)}`),
          ],
    )
    return listaVendas
  }

  const regras: Regra[] = [
    {
      quantidade: 1,
      solicitada: 'LIMPA VIDROS SPRAY 400 ML | JIMO',
      obrigatorios: ['LIMPA', 'VIDRO', 'JIMO'],
      alternativas: [['400', '400ML']],
    },
    {
      quantidade: 1,
      solicitada: 'VEJA X14 COM CLORO',
      obrigatorios: ['X14'],
      alternativas: [['VEJA'], ['CLORO']],
      proibidos: ['SEM CLORO'],
      preferidos: ['1L', '1000', '500'],
    },
    {
      quantidade: 1,
      solicitada: 'DESENGORDURANTE DE LOUÇA X30 1L | GUIMARÃES',
      obrigatorios: ['DESENGORDURANTE', 'X30'],
      alternativas: [['GUIMARAES', 'GMRAES'], ['1L', '1 L', '1000ML', '1000 ML']],
      proibidos: ['DX30 5L'],
    },
    {
      quantidade: 1,
      solicitada: 'SAPONÁCEO CREMOSO CIF 450ML',
      obrigatorios: ['CIF'],
      alternativas: [['SAPONACEO', 'SAPOLIO'], ['450', '450ML']],
    },
    {
      quantidade: 1,
      solicitada: 'LÃ DE AÇO | ASSOLAN',
      obrigatorios: ['ASSOLAN'],
      alternativas: [['LA DE ACO', 'ESPONJA DE ACO', 'ESFREGAO DE ACO']],
      proibidos: ['BOMBRIL'],
    },
    {
      quantidade: 1,
      solicitada: 'LIMPADOR PERFUMADO JASMIM E ALGAS 5L | GUIMARÃES',
      obrigatorios: ['LIMPADOR', 'PERFUMADO', 'JASMIM'],
      alternativas: [['GUIMARAES', 'GMRAES'], ['5L', '5 L']],
      preferidos: ['ALGAS'],
    },
    {
      quantidade: 2,
      solicitada: 'ÁGUA SANITÁRIA 5L | QMFEL',
      obrigatorios: ['AGUA', 'SANITARIA', 'QMFEL'],
      alternativas: [['5L', '5 L']],
    },
    {
      quantidade: 2,
      solicitada: 'LIMPADOR CONC. TALCO 120ML | COALA',
      obrigatorios: ['LIMPADOR', 'COALA', 'TALCO'],
      alternativas: [['120', '120ML']],
      proibidos: ['DESINFETANTE'],
    },
    {
      quantidade: 1,
      solicitada: 'LIMPA PORCELANATO 5L | GUIMARÃES',
      obrigatorios: ['LIMPA', 'PORCELANATO'],
      alternativas: [['GUIMARAES', 'GMRAES'], ['5L', '5 L']],
    },
    {
      quantidade: 2,
      solicitada: 'ODORIZADOR SPRAY LAVANDA 500ML',
      obrigatorios: ['LAVANDA'],
      alternativas: [
        ['ODORIZADOR', 'AROMATIZANTE', 'BOM AR'],
        ['SPRAY', 'AEROSSOL'],
        ['500', '500ML'],
      ],
    },
    {
      quantidade: 1,
      solicitada: 'GEL ADESIVO COM APLICADOR REFIL | SANIMAX',
      obrigatorios: ['REFIL'],
      alternativas: [
        ['SANIMAX', 'SANYMIX'],
        ['GEL', 'ADESIVO'],
        ['APLICADOR'],
        ['MARINE', 'CITRUS', 'LAVANDA'],
      ],
    },
    {
      quantidade: 1,
      solicitada: 'SABÃO EM PÓ | GIRANDO SOL',
      obrigatorios: ['GIRANDO', 'SOL'],
      alternativas: [['SABAO EM PO', 'LAVA ROUPAS EM PO']],
    },
    {
      quantidade: 1,
      solicitada: 'SACO DE LIXO 240L PRETO REFORÇADO 0.08M / 120X144CM C/50UN',
      obrigatorios: ['SACO', 'LIXO', 'PRETO', 'REFORCADO'],
      alternativas: [['240L', '240'], ['0 08M'], ['120X144'], ['50UN', '50 UN']],
      proibidos: ['RESISTENTE', '0 10M', 'AZUL'],
    },
    {
      quantidade: 1,
      solicitada: 'VASSOURA MULTIUSO C/CABO 140CM | BTTN',
      obrigatorios: ['VASSOURA', 'MULTIUSO', 'CABO', '140CM', 'BTTN'],
    },
    {
      quantidade: 1,
      solicitada: 'REFIL MOP ÚMIDO 190G | MOX',
      obrigatorios: ['MOP', 'UMIDO', 'MOX'],
      alternativas: [['190G', '190']],
    },
  ]

  const localizados = regras.map((regra) => ({
    regra,
    produto: localizarProduto(listaProdutos, regra),
  }))

  const ausentes = localizados.filter((item) => !item.produto)
  if (ausentes.length > 0) {
    falhar(
      'O orçamento 2462 não foi alterado porque alguns produtos não foram localizados de forma única.',
      [
        ...ausentes.map((item) => `- ${item.regra.solicitada}`),
        'Nenhum produto foi criado.',
      ],
    )
    return listaVendas
  }

  const cliente = clientesParisi[0]
  const agora = new Date().toISOString()

  const itens = localizados.map(({ regra, produto }, indice) => {
    const quantidade = Number(regra.quantidade)
    const valorUnitario = precoVenda(produto)
    const custoUnitario = Number(
      produto?.custo ||
      produto?.custoMedioAtual ||
      produto?.ultimoCustoCompra ||
      0,
    )
    const codigoBarras = texto(produto?.codigoBarras, produto?.ean, produto?.gtin)
    const codigoProduto = texto(produto?.codigo, produto?.codigoInterno, codigoBarras, produto?.id)

    return {
      id: `2462-item-${indice + 1}`,
      produtoId: texto(produto?.id),
      codigo: codigoProduto,
      codigoProduto,
      codigoBarras,
      descricao: nomeProduto(produto),
      descricaoSolicitada: regra.solicitada,
      unidade: texto(produto?.unidade, produto?.unidadeMedida, 'Unidade'),
      quantidade,
      valorUnitario,
      desconto: 0,
      descontoValor: 0,
      descontoPercentual: 0,
      valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
      custoUnitario,
      custoTotal: Number((quantidade * custoUnitario).toFixed(2)),
      estoqueDisponivel: Number(
        produto?.estoqueAtual ||
        produto?.estoque ||
        produto?.quantidadeEstoque ||
        0,
      ),
      produtoVinculado: true,
      vinculoProdutoOrigem: 'DESCRICAO_ATUAL_ERP',
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

  const { venda: atual, indice } = indices2462[0]
  const frete = Number(atual?.frete || 0)
  const outrosCustos = Number(atual?.outrosCustos || 0)
  const totalFinal = Number((subtotal + frete + outrosCustos).toFixed(2))

  const atualizado = {
    ...atual,
    tipo: 'Orçamento',
    numeroOrcamento: '2462',
    clienteId: texto(
      cliente?.id,
      cliente?.clienteId,
      cliente?.codigo,
      cliente?.codigoCliente,
    ),
    clienteNome: nomeCliente(cliente),
    clienteDocumento: texto(cliente?.cnpj, cliente?.cpf, cliente?.documento),
    clienteEmailNotaFiscal: texto(
      cliente?.emailNotaFiscal,
      cliente?.emailNfe,
      cliente?.email,
    ),
    clienteInscricaoEstadual: texto(cliente?.inscricaoEstadual, cliente?.ie),
    enderecoFaturamento: texto(
      cliente?.enderecoFiscalFormatado,
      cliente?.enderecoFaturamento,
      atual?.enderecoFaturamento,
    ),
    enderecoEntrega: texto(
      cliente?.enderecoEntregaFormatado,
      cliente?.enderecoEntrega,
      atual?.enderecoEntrega,
      atual?.enderecoFaturamento,
    ),
    itens,
    itensEditadosManual: true,
    tipoDesconto: 'valor',
    descontoInformado: 0,
    descontoCalculado: 0,
    descontoValor: 0,
    subtotal,
    totalFinal,
    valorTotal: totalFinal,
    statusOrcamento: texto(atual?.statusOrcamento, atual?.status, 'Aberto'),
    atualizadoEm: agora,
    marcadorInstalacao: 'SYNERGIAS_ORCAMENTO_2462_PARISI_SOBREPOSICAO_V205H',
  }

  const resultado = [...listaVendas]
  resultado[indice] = atualizado

  console.info('[V205H] Orçamento 2462 sobreposto e preparado para gravação central.', {
    cliente: nomeCliente(cliente),
    itens: itens.length,
    subtotal,
    totalFinal,
  })

  return resultado
}