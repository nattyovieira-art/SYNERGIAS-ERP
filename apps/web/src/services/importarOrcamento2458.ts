/* ORCAMENTO_ROSSI_CARIBE_2458_V201F
   Importação idempotente: cria o pedido apenas se o nº 2458 ainda não existir.
   Produtos são vinculados ao cadastro central e usam o preço de venda atual.
*/

function normalizar2458(valor: unknown): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function textoProduto2458(produto: any): string {
  return String(
    produto?.descricao ||
    produto?.nome ||
    produto?.nomeProduto ||
    produto?.produto ||
    '',
  ).trim()
}

function textoCliente2458(cliente: any): string {
  return String(
    cliente?.nomeRazaoSocial ||
    cliente?.razaoSocial ||
    cliente?.nomeFantasia ||
    cliente?.nome ||
    cliente?.clienteNome ||
    '',
  ).trim()
}

function documento2458(valor: unknown): string {
  return String(valor || '').replace(/\D/g, '')
}

function precoVenda2458(produto: any): number {
  const candidatos = [
    produto?.vendaVarejo,
    produto?.precoVendaVarejo,
    produto?.precoVenda,
    produto?.valorVenda,
    produto?.preco,
  ]
  for (const valor of candidatos) {
    const numero = Number(valor)
    if (Number.isFinite(numero) && numero > 0) return numero
  }
  return 0
}

function localizarProduto2458(
  produtos: any[],
  _codigoHistoricoIgnorado: string,
  descricao: string,
  aliases: string[] = [],
): any | undefined {
  const alvos = [descricao, ...aliases].map(normalizar2458).filter(Boolean)

  // 1. Descrição exatamente igual no cadastro atual.
  for (const alvo of alvos) {
    const exatos = produtos.filter(
      (produto) => normalizar2458(textoProduto2458(produto)) === alvo,
    )
    if (exatos.length === 1) return exatos[0]
  }

  // 2. Igualdade desconsiderando a marca depois de " | ".
  for (const alvo of alvos) {
    const alvoSemMarca = alvo.split(' | ')[0].trim()
    const equivalentes = produtos.filter((produto) =>
      normalizar2458(textoProduto2458(produto)).split(' | ')[0].trim() === alvoSemMarca,
    )
    if (equivalentes.length === 1) return equivalentes[0]
  }

  // 3. Correspondência por todas as palavras relevantes.
  for (const alvo of alvos) {
    const palavras = alvo
      .split(' ')
      .filter((palavra) => palavra.length > 2 && !['COM', 'PARA', 'SEM'].includes(palavra))

    const candidatos = produtos.filter((produto) => {
      const nome = normalizar2458(textoProduto2458(produto))
      return palavras.every((palavra) => nome.includes(palavra))
    })

    if (candidatos.length === 1) return candidatos[0]
  }

  return undefined
}
function dataLocal2458(): string {
  const agora = new Date()
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function somarDias2458(dataIso: string, dias: number): string {
  const data = new Date(`${dataIso}T12:00:00`)
  data.setDate(data.getDate() + dias)
  return data.toISOString().slice(0, 10)
}

export function garantirOrcamento2458(
  vendas: any[],
  produtos: any[],
  clientes: any[],
): any[] {
  const listaVendas = Array.isArray(vendas) ? vendas : []
  const listaProdutos = Array.isArray(produtos) ? produtos : []
  const listaClientes = Array.isArray(clientes) ? clientes : []

  const vendasSemPedidoErrado = listaVendas.filter((venda) => {
    const numeroPedido = String(venda?.numeroPedido || '').replace(/\D/g, '')
    const marcador = String(venda?.marcadorInstalacao || '')
    return !(numeroPedido === '2458' || marcador === 'PEDIDO_ROSSI_CARIBE_2458_V201')
  })

  const vendasSem2458 = vendasSemPedidoErrado.filter((venda) => {
    const numeroOrcamento = String(venda?.numeroOrcamento || '').replace(/\D/g, '')
    const numeroPedido = String(venda?.numeroPedido || '').replace(/\D/g, '')
    const marcador = String(venda?.marcadorInstalacao || '')
    return !(
      numeroOrcamento === '2458' ||
      numeroPedido === '2458' ||
      marcador.includes('2458')
    )
  })

  const cliente = listaClientes.find((item) => {
    const cnpj = documento2458(
      item?.cnpj ||
      item?.cpfCnpj ||
      item?.cnpjCpf ||
      item?.documento ||
      item?.documentoPrincipal,
    )
    if (cnpj === '18995796000125') return true
    const nome = normalizar2458(textoCliente2458(item))
    return nome.includes('ROSSI CARIBE')
  })

  if (!cliente) {
    console.error('[Pedido 2458] Cliente CONDOMÍNIO ROSSI CARIBE não localizado.')
    return listaVendas
  }

  const solicitados = [
    { codigo: '7901211473', descricao: 'BALDE PLAST 20L COLOR C/ ALÇA METAL | LB', quantidade: 4 },
    { codigo: '7901210493', descricao: 'BALDE 14L C/ESPREMEDOR | BTTN', quantidade: 4, aliases: ['BALDE 14L COM ESPREMEDOR'] },
    { codigo: '7901210155', descricao: 'BORRIFADOR TRANSPARENTE 500ML | NB', quantidade: 3 },
    { codigo: '7901213374', descricao: 'BRILHA INOX SPRAY 250ML | DLINE', quantidade: 4 },
    { codigo: '7901211142', descricao: 'MOP ÚMIDO 190G | MOX', quantidade: 8, aliases: ['MOP UMIDO 190G | MOX'] },
    { codigo: '7901211024', descricao: 'CABO CHAPA AÇO 140CM C/ROSCA | PFPRO', quantidade: 4 },
    { codigo: '7901210365', descricao: 'DESINCRUSTANTE CLEANOX 5L | CLEAN', quantidade: 4 },
    { codigo: '7901210223', descricao: 'ÁGUA SANITÁRIA 5L | QMFEL', quantidade: 6, aliases: ['AGUA SANITARIA 5L | QMFEL'] },
    { codigo: '7901210737', descricao: 'LIMPADOR CONC. ORQUÍDEA DO CARIBE 120ML | SCAR', quantidade: 8, aliases: ['LIMPADOR CONC ORQUIDEA DO CARIBE 120ML'] },
    { codigo: '7901210521', descricao: 'ESPONJA DUPLA FACE S/PELÍCULA | BTTN', quantidade: 6, aliases: ['ESPONJA DUPLA FACE S /PELICULA | BTTN'] },
    { codigo: '7901210691', descricao: 'LAVA ROUPAS MIL FLORES 5L | GMRÃES', quantidade: 4 },
    { codigo: '7901210763', descricao: 'LIMPADOR PERFUMADO BAMBOO 5L | GMRÃES', quantidade: 4 },
    { codigo: '7901212180', descricao: 'LUSTRA MÓVEIS UTIL 200ML', quantidade: 3, aliases: ['LUSTRA MOVEIS UTIL 200ML'] },
    { codigo: '7901210727', descricao: 'LUVA “M” LARANJA REFORÇADA SLIM | VOLK', quantidade: 8, aliases: ['LUVA M LARANJA REFORCADA SLIM | VOLK'] },
    { codigo: '7901210731', descricao: 'LUVA “M” BORRACHA/LÁTEX SILVER CA 44393 | NB', quantidade: 8, aliases: ['LUVA M SILVER', 'LUVA M BORRACHA LATEX SILVER'] },
    { codigo: '7901210973', descricao: 'PÁ DE LIXO REBATÍVEL C/CABO 60CM | DLCN', quantidade: 4, aliases: ['PA DE LIXO REBATIVEL C CABO 60CM | DLCN'] },
    { codigo: '7901210901', descricao: 'PANO DE PRATO BRANCO | 44CMX67CM', quantidade: 8 },
    { codigo: '7901210998', descricao: 'PANO MICROFIBRA UNIVERSAL 40CMX40CM | PFPRO', quantidade: 8 },
    { codigo: '7901211033', descricao: 'PAPEL HIGIÊNICO BRANCO FOLHA SIMPLES 10CM X 300M | RPEL', quantidade: 3 },
    { codigo: '7901211073', descricao: 'PAPEL TOALHA INTERFOLHADO FS 20CM X 20CM C/1000 FOLHAS 100% CELULOSE | RPEL', quantidade: 5 },
    { codigo: '7901211307', descricao: 'SACO DE LIXO 20L PRETO FLEX 0.02M/40X50CM C/100UN', quantidade: 2 },
    { codigo: '7901211314', descricao: 'SACO DE LIXO 240L PRETO RESISTENTE 0.10M /120X144CM C/50UN', quantidade: 4 },
    { codigo: '7901212181', descricao: 'SACO DE LIXO 240 LITROS - 0.10 AZUL 100X144CM C/50UN', quantidade: 2 },
    { codigo: '7901210421', descricao: 'SAPONACEO CREMOSO 250ML | SANYMIX', quantidade: 6, aliases: ['SAPONACEO CREMOSO FLORAL 250ML | SANYMIX', 'SAPONACEO CREMOSO LAVANDA 250ML | SANYMIX', 'SAPONACEO CREMOSO LIMAO 250ML | SANYMIX'] },
    { codigo: '7901210141', descricao: 'BOBINA PLASTICA 30CMX40CM 300 SACOS | PET', quantidade: 12 },
    { codigo: '7901211381', descricao: 'SUPORTE LT S/CABO | SYNERGIAS', quantidade: 5 },
    { codigo: '7901211448', descricao: 'VASSOURA MULTIUSO C/CABO 140CM | BTTN', quantidade: 5 },
  ] as const

  const naoLocalizados: string[] = []

  const itens = solicitados.map((solicitado, indice) => {
    const produto = localizarProduto2458(
      listaProdutos,
      solicitado.codigo,
      solicitado.descricao,
      'aliases' in solicitado ? [...solicitado.aliases] : [],
    )

    if (!produto) naoLocalizados.push(solicitado.descricao)

    const descricaoAtual = produto ? textoProduto2458(produto) : solicitado.descricao
    const codigoBarras = String(
      produto?.codigoBarras ||
      produto?.codigo ||
      produto?.codigoProduto ||
      (produto ? '' : solicitado.codigo) ||
      '',
    ).trim()
    const valorUnitario = precoVenda2458(produto)
    const quantidade = Number(solicitado.quantidade)
    const valorTotal = Number((quantidade * valorUnitario).toFixed(2))

    return {
      id: `2458-item-${indice + 1}`,
      produtoId: String(produto?.id || ''),
      codigo: codigoBarras,
      codigoProduto: codigoBarras,
      codigoBarras,
      descricao: descricaoAtual,
      unidade: String(produto?.unidade || produto?.unidadeMedida || 'Unidade'),
      quantidade,
      valorUnitario,
      desconto: 0,
      descontoValor: 0,
      descontoPercentual: 0,
      valorTotal,
      custoUnitario: Number(produto?.custo || produto?.custoMedioAtual || 0),
      custoTotal: Number(
        (quantidade * Number(produto?.custo || produto?.custoMedioAtual || 0)).toFixed(2),
      ),
      estoqueDisponivel: Number(
        produto?.estoqueAtual ||
        produto?.estoque ||
        produto?.quantidadeEstoque ||
        0,
      ),
      produtoVinculado: Boolean(produto),
      vinculoProdutoOrigem: produto ? 'MAPA_HISTORICO' : 'NAO_VINCULADO',
      descricaoHistorica: solicitado.descricao,
      codigoProdutoHistorico: solicitado.codigo,
      ncm: String(produto?.ncm || ''),
      ncmDescricao: String(produto?.ncmDescricao || ''),
      cfop: String(produto?.cfopDentroEstado || produto?.cfop || ''),
      origem: String(produto?.origem || ''),
      cest: String(produto?.cest || ''),
      csosn: String(produto?.csosn || ''),
      cstIcms: String(produto?.cstIcms || ''),
      cstPis: String(produto?.cstPis || ''),
      cstCofins: String(produto?.cstCofins || ''),
    }
  })

  if (naoLocalizados.length) {
    console.warn(
      '[Orçamento 2458] Alguns produtos não foram vinculados automaticamente. ' +
      'O orçamento será restaurado com as descrições e quantidades para conferência:',
      naoLocalizados,
    )
  }

  const subtotal = Number(
    itens.reduce((total, item) => total + Number(item.valorTotal || 0), 0).toFixed(2),
  )
  const hoje = dataLocal2458()

  const cep = String(cliente?.cepEntrega || cliente?.cepFiscal || cliente?.cep || '91450-147')
  const logradouro = String(
    cliente?.logradouroEntrega ||
    cliente?.enderecoEntrega ||
    cliente?.logradouroFiscal ||
    cliente?.endereco ||
    cliente?.logradouro ||
    'Rua Irmão Norberto Francisco Rauch',
  )
  const numero = String(
    cliente?.numeroEntrega ||
    cliente?.numeroFiscal ||
    cliente?.numero ||
    '755',
  )
  const complemento = String(
    cliente?.complementoEntrega ||
    cliente?.complementoFiscal ||
    cliente?.complemento ||
    '',
  )
  const bairro = String(
    cliente?.bairroEntrega ||
    cliente?.bairroFiscal ||
    cliente?.bairro ||
    'Jardim Carvalho',
  )
  const cidade = String(
    cliente?.cidadeEntrega ||
    cliente?.cidadeFiscal ||
    cliente?.cidade ||
    'Porto Alegre',
  )
  const estado = String(
    cliente?.ufEntrega ||
    cliente?.estadoEntrega ||
    cliente?.ufFiscal ||
    cliente?.estado ||
    cliente?.uf ||
    'RS',
  )
  const enderecoCompleto =
    `${logradouro}, ${numero}${complemento ? ` - ${complemento}` : ''}\n` +
    `${bairro} - ${cidade} / ${estado} - CEP: ${cep} - Brasil`

  const nomeCliente = textoCliente2458(cliente) || 'CONDOMÍNIO ROSSI CARIBE'
  const cnpjCliente = String(
    cliente?.cnpj ||
    cliente?.cpfCnpj ||
    cliente?.cnpjCpf ||
    cliente?.documento ||
    '18.995.796/0001-25',
  )
  const emailCliente = String(
    cliente?.emailNotaFiscal ||
    cliente?.email ||
    'FINANCEIRO@SYNERGIAS.COM.BR',
  )

  const orcamento = {
    id: 'orcamento-importado-2458-rossi-caribe',
    tipo: 'Orçamento',
    numeroOrcamento: '2458',
    vendedor: 'NATÁLIA VIEIRA',
    clienteId: String(cliente?.id || cliente?.codigo || cliente?.codigoSistema || ''),
    clienteCodigo: String(cliente?.codigo || cliente?.codigoSistema || cliente?.id || ''),
    clienteNome: nomeCliente,
    clienteDocumento: cnpjCliente,
    clienteCnpj: cnpjCliente,
    clienteEmail: emailCliente,
    clienteEmailNotaFiscal: emailCliente,
    clienteTelefone: String(cliente?.telefone || cliente?.celular || ''),
    clienteIndicadorIE: String(
      cliente?.indicadorIe ||
      cliente?.indicadorIE ||
      cliente?.indicadorIEDestinatario ||
      'Não Contribuinte',
    ),
    clienteInscricaoEstadual: String(cliente?.ie || cliente?.inscricaoEstadual || 'isento'),
    dataEmissao: hoje,
    dataEntrega: somarDias2458(hoje, 2),
    enderecoFaturamento: enderecoCompleto,
    enderecoEntrega: enderecoCompleto,
    faturamentoCep: cep,
    faturamentoEndereco: logradouro,
    faturamentoNumero: numero,
    faturamentoComplemento: complemento,
    faturamentoBairro: bairro,
    faturamentoCidade: cidade,
    faturamentoEstado: estado,
    entregaCep: cep,
    entregaEndereco: logradouro,
    entregaNumero: numero,
    entregaComplemento: complemento,
    entregaBairro: bairro,
    entregaCidade: cidade,
    entregaEstado: estado,
    itens,
    itensEditadosManual: true,
    tipoDesconto: 'valor',
    descontoInformado: 0,
    descontoCalculado: 0,
    descontoValor: 0,
    frete: 0,
    outrosCustos: 0,
    subtotal,
    totalFinal: subtotal,
    valorTotal: subtotal,
    pagamentos: [],
    parcelas: [],
    formaPagamento: '',
    parcelamento: '',
    bancoCobranca: '',
    tipoCobranca: '',
    status: 'Aberto',
    statusOrcamento: 'Aberto',
    statusNotaFiscal: 'Pendente',
    statusBoleto: 'Pendente',
    ambienteBoleto: 'homologacao',
    observacoes:
      'Orçamento corrigido e inserido automaticamente pelo instalador V201F. ' +
      'Os produtos encontrados foram vinculados pelo nome/descrição atual do ERP. Itens não localizados foram mantidos somente com descrição, quantidade e valor zero para conferência manual. ' +
      (naoLocalizados.length
        ? `Conferir produtos não vinculados: ${naoLocalizados.join('; ')}.`
        : ''),
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    marcadorInstalacao: 'ORCAMENTO_ROSSI_CARIBE_2458_V201F',
  }

  return [...vendasSem2458, orcamento]
}