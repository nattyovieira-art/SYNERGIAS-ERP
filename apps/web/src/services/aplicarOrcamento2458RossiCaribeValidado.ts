/* SYNERGIAS_ORCAMENTO_2458_ROSSI_CARIBE_SOBREPOSICAO_V207
   Sobrepõe SOMENTE o orçamento 2458 já existente.
   Localiza o cliente Condomínio Rossi Caribe já existente.
   Localiza todos os produtos atuais por código de barras.
   Usa quantidades e valores unitários fixos do PDF aprovado.
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
  console.error(`[V207] ${completo}`)
}

export function aplicarOrcamento2458RossiCaribeValidado(
  vendas: any[],
  produtos: any[],
  clientes: any[],
): any[] {
  const listaVendas = Array.isArray(vendas) ? vendas : []
  const listaProdutos = Array.isArray(produtos) ? produtos : []
  const listaClientes = Array.isArray(clientes) ? clientes : []

  const registros2458 = listaVendas
    .map((venda, indice) => ({ venda, indice }))
    .filter(({ venda }) => {
      const numero = String(
        venda?.numeroOrcamento ||
        venda?.numero ||
        venda?.codigo ||
        '',
      ).replace(/\D/g, '')
      return numero === '2458'
    })

  if (registros2458.length !== 1) {
    falhar(
      'A sobreposição do orçamento 2458 foi bloqueada.',
      [`Foram encontrados ${registros2458.length} registros com o número 2458. Nenhum orçamento novo foi criado.`],
    )
    return listaVendas
  }

  const clientesRossi = listaClientes.filter((cliente) => {
    const nome = normalizar(nomeCliente(cliente))
    const documento = String(
      cliente?.cnpj ||
      cliente?.cpf ||
      cliente?.documento ||
      '',
    ).replace(/\D/g, '')

    return documento === '18995796000125' ||
      nome === 'CONDOMINIO ROSSI CARIBE' ||
      nome.includes('CONDOMINIO ROSSI CARIBE') ||
      nome.includes('ROSSI CARIBE')
  })

  const clientesUnicos = clientesRossi.filter((cliente, indice, lista) => {
    const chave = texto(cliente?.id, cliente?.codigo, cliente?.clienteId, nomeCliente(cliente))
    return lista.findIndex((item) =>
      texto(item?.id, item?.codigo, item?.clienteId, nomeCliente(item)) === chave
    ) === indice
  })

  if (clientesUnicos.length !== 1) {
    falhar(
      'O cliente Condomínio Rossi Caribe não foi localizado de forma única.',
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
    { codigoBarras: '7901211473', descricao: "BALDE PLAST 20L COLOR C/ ALÇA METAL | LB", quantidade: 4, valorUnitario: 0.00 },
    { codigoBarras: '7901210107', descricao: "BALDE 14L C/ESPREMEDOR | BTTN", quantidade: 4, valorUnitario: 34.90 },
    { codigoBarras: '7901210155', descricao: "BORRIFADOR TRANSPARENTE 500ML | NB", quantidade: 3, valorUnitario: 4.90 },
    { codigoBarras: '7901210163', descricao: "BRILHA INOX SPRAY 250ML | DLINE", quantidade: 4, valorUnitario: 16.90 },
    { codigoBarras: '7901210926', descricao: "MOP ÚMIDO 190G | MOX", quantidade: 8, valorUnitario: 12.55 },
    { codigoBarras: '7901210170', descricao: "CABO CHAPA AÇO 140CM C/ROSCA | PFPRO", quantidade: 4, valorUnitario: 8.50 },
    { codigoBarras: '7901210350', descricao: "DESINCRUSTANTE CLEANOX 5L | CLEAN", quantidade: 4, valorUnitario: 59.90 },
    { codigoBarras: '7901210028', descricao: "AGUA SANITÁRIA 5L | QMFEL", quantidade: 6, valorUnitario: 9.50 },
    { codigoBarras: '7901210737', descricao: "LIMPADOR CONC. ORQUÍDEA DO CARIBE 120ML | SCAR", quantidade: 8, valorUnitario: 12.50 },
    { codigoBarras: '7901210521', descricao: "ESPONJA DUPLA FACE S /PELICULA | BTTN", quantidade: 6, valorUnitario: 0.85 },
    { codigoBarras: '7901210691', descricao: "LAVA ROUPAS MIL FLORES 5L | GMRÃES", quantidade: 4, valorUnitario: 29.90 },
    { codigoBarras: '7901210763', descricao: "LIMPADOR PERFUMADO BAMBOO 5L | GMRÃES", quantidade: 4, valorUnitario: 28.90 },
    { codigoBarras: '7901212180', descricao: "LUSTRA MÓVEIS UTIL 200ML", quantidade: 3, valorUnitario: 5.30 },
    { codigoBarras: '7901210850', descricao: "LUVA \"M\" LARANJA REFORÇADA SLIM | VOLK", quantidade: 8, valorUnitario: 8.99 },
    { codigoBarras: '7901210973', descricao: "PÁ DE LIXO REBATÍVEL C/CABO 60CM | DLCN", quantidade: 4, valorUnitario: 12.98 },
    { codigoBarras: '7901210989', descricao: "PANO DE PRATO BRANCO | 44CMX67CM", quantidade: 8, valorUnitario: 3.50 },
    { codigoBarras: '7901210998', descricao: "PANO MICROFIBRA UNIVERSAL 40CMX40CM | PFPRO", quantidade: 8, valorUnitario: 6.50 },
    { codigoBarras: '7901211033', descricao: "PAPEL HIGIENICO BRANCO FOLHA SIMPLES 10CMX300M | RPEL", quantidade: 3, valorUnitario: 37.90 },
    { codigoBarras: '7901211073', descricao: "PAPEL TOALHA INTERFOLHADO FS 20CM X 20CM C/1000 FOLHAS 100% CELULOSE | RPEL", quantidade: 5, valorUnitario: 15.50 },
    { codigoBarras: '7901211307', descricao: "SACO DE LIXO 20L PRETO FLEX 0.02M/40X50CM C/100UN", quantidade: 2, valorUnitario: 6.00 },
    { codigoBarras: '7901211314', descricao: "SACO DE LIXO 240L PRETO RESISTENTE 0.10M / 120X144CM C/50UN", quantidade: 4, valorUnitario: 77.74 },
    { codigoBarras: '7901212181', descricao: "SACO DE LIXO 240 LITROS - 0.10 AZUL 100X144CM C/50UN", quantidade: 2, valorUnitario: 84.50 },
    { codigoBarras: '7901211354', descricao: "SAPONACEO CREMOSO FLORAL/LAVANDA/LIMÃO 250ML | SANYMIX", quantidade: 6, valorUnitario: 3.91 },
    { codigoBarras: '7901210141', descricao: "BOBINA PLASTICA 30CMX40CM 300 SACOS | PET", quantidade: 12, valorUnitario: 19.90 },
    { codigoBarras: '7901211381', descricao: "SUPORTE LT S/CABO | SYNERGIAS", quantidade: 5, valorUnitario: 10.90 },
    { codigoBarras: '7901211448', descricao: "VASSOURA MULTIUSO C/CABO 140CM | BTTN", quantidade: 5, valorUnitario: 18.06 },
    { codigoBarras: '7901210859', descricao: "LUVA \"M\" SILVERIX AZUL | MEDIX", quantidade: 8, valorUnitario: 4.65 }
  ]

  const localizados = regras.map((regra) => ({
    regra,
    produto: localizarProdutoPorCodigo(listaProdutos, regra.codigoBarras),
  }))

  const ausentes = localizados.filter((item) => !item.produto)
  if (ausentes.length > 0) {
    falhar(
      'O orçamento 2458 não foi alterado porque alguns produtos não foram localizados de forma única.',
      [
        ...ausentes.map((item) => `- ${item.regra.codigoBarras} — ${item.regra.descricao}`),
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
      id: `2458-item-${indice + 1}`,
      produtoId: texto(produto?.id),
      codigo: codigoProduto,
      codigoProduto,
      codigoBarras: regra.codigoBarras,
      descricao: regra.descricao,
      descricaoCadastro: nomeProduto(produto),
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
    itens.reduce((soma, item) => soma + Number(item.valorTotal || 0), 0).toFixed(2),
  )

  if (itens.length !== 27 || subtotal !== 2340.36) {
    falhar(
      'A validação dos valores do orçamento 2458 falhou.',
      [
        `Itens encontrados: ${itens.length}; esperado: 27.`,
        `Total calculado: ${subtotal.toFixed(2)}; esperado: 2340.36.`,
      ],
    )
    return listaVendas
  }

  const { venda: atual, indice } = registros2458[0]

  const pagamento = {
    id: '2458-pagamento-1',
    formaPagamento: 'BOLETO BANCO INTER',
    descricao: 'BOLETO BANCO INTER (1x - 30 dias) [1/1]',
    prazo: '30 dias',
    vencimento: '2026-08-15',
    observacoes: '',
    valor: 2340.36,
  }

  const atualizado = {
    ...atual,
    tipo: 'Orçamento',
    numero: '2458',
    numeroOrcamento: '2458',
    vendedor: 'NATÁLIA VIEIRA',
    vendedorNome: 'NATÁLIA VIEIRA',
    status: 'Aberto',
    statusOrcamento: 'Aberto',
    dataEmissao: '2026-07-16',
    emissao: '2026-07-16',
    dataEntrega: '2026-07-20',
    entrega: '2026-07-20',
    dataValidade: '2026-07-23',
    validade: '2026-07-23',
    clienteId: texto(
      cliente?.id,
      cliente?.clienteId,
      cliente?.codigo,
      cliente?.codigoCliente,
    ),
    clienteNome: nomeCliente(cliente),
    clienteDocumento: '18.995.796/0001-25',
    clienteEmailNotaFiscal: texto(
      cliente?.emailNotaFiscal,
      cliente?.emailNfe,
      cliente?.email,
      'FINANCEIRO@SYNERGIAS.COM.BR',
    ),
    enderecoFaturamento: texto(
      cliente?.enderecoFiscalFormatado,
      cliente?.enderecoFaturamento,
      atual?.enderecoFaturamento,
    ),
    enderecoEntrega: texto(
      cliente?.enderecoEntregaFormatado,
      cliente?.enderecoEntrega,
      'Rua Irmão Norberto Francisco Rauch, 755 - Jardim Carvalho - Porto Alegre / RS - CEP: 91450-147 - Brasil',
    ),
    itens,
    itensEditadosManual: true,
    tipoDesconto: 'valor',
    descontoInformado: 0,
    descontoCalculado: 0,
    descontoValor: 0,
    frete: 0,
    outrosCustos: 0,
    subtotal: 2340.36,
    totalFinal: 2340.36,
    valorTotal: 2340.36,
    pagamentos: [pagamento],
    formaPagamento: 'BOLETO BANCO INTER',
    condicaoPagamento: '1x - 30 dias',
    vencimentoPagamento: '2026-08-15',
    atualizadoEm: agora,
    marcadorInstalacao: 'SYNERGIAS_ORCAMENTO_2458_ROSSI_CARIBE_SOBREPOSICAO_V207',
  }

  const resultado = [...listaVendas]
  resultado[indice] = atualizado

  console.info('[V207] Orçamento 2458 sobreposto e preparado para gravação central.', {
    cliente: nomeCliente(cliente),
    itens: itens.length,
    quantidadeTotal: itens.reduce((soma, item) => soma + item.quantidade, 0),
    subtotal,
    totalFinal: atualizado.totalFinal,
  })

  return resultado
}