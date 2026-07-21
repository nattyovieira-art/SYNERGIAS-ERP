/* SYNERGIAS_ORCAMENTO_2458_CNPJ_EXATO_NOME_PRODUTO_V220B
   Migração única e definitiva do orçamento 2458, vinculando produtos somente pelo nome.
   Localiza o cliente somente pelo CNPJ 18995796000125.
   Não cria cliente, produto ou orçamento. Não abre alertas.
   Após gravar o marcador no próprio orçamento, alterações manuais futuras são preservadas.
*/

const MARCADOR_2458 = 'SYNERGIAS_ORCAMENTO_2458_CNPJ_EXATO_NOME_PRODUTO_V220B'
const CNPJ_2458 = '18995796000125'

function texto2458(...valores: unknown[]): string {
  for (const valor of valores) {
    const resultado = String(valor ?? '').trim()
    if (resultado) return resultado
  }
  return ''
}

function somenteDigitos2458(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '')
}

function nomeCliente2458(cliente: any): string {
  return texto2458(
    cliente?.nomeRazaoSocial,
    cliente?.razaoSocial,
    cliente?.nomeFantasia,
    cliente?.nome,
    cliente?.clienteNome,
  )
}

function nomeProduto2458(produto: any): string {
  return texto2458(produto?.descricao, produto?.nome, produto?.nomeProduto, produto?.produto)
}

function numero2458(valor: unknown): number {
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

type Regra2458 = {
  codigoBarras: string
  descricao: string
  quantidade: number
  valorUnitario: number
}

const ITENS_2458: Regra2458[] = [
  { codigoBarras: '7901211473', descricao: 'BALDE PLAST 20L COLOR C/ ALÇA METAL | LB', quantidade: 4, valorUnitario: 19.95 },
  { codigoBarras: '7901210107', descricao: 'BALDE 14L C/ESPREMEDOR | BTTN', quantidade: 4, valorUnitario: 34.90 },
  { codigoBarras: '7901210155', descricao: 'BORRIFADOR TRANSPARENTE 500ML | NB', quantidade: 3, valorUnitario: 4.90 },
  { codigoBarras: '7901210163', descricao: 'BRILHA INOX SPRAY 250ML | DLINE', quantidade: 4, valorUnitario: 16.90 },
  { codigoBarras: '7901210926', descricao: 'MOP ÚMIDO 190G | MOX', quantidade: 8, valorUnitario: 12.55 },
  { codigoBarras: '7901210170', descricao: 'CABO CHAPA AÇO 140CM C/ROSCA | PFPRO', quantidade: 4, valorUnitario: 8.50 },
  { codigoBarras: '7901210350', descricao: 'DESINCRUSTANTE CLEANOX 5L | CLEAN', quantidade: 4, valorUnitario: 59.90 },
  { codigoBarras: '7901210028', descricao: 'AGUA SANITÁRIA 5L | QMFEL', quantidade: 6, valorUnitario: 9.50 },
  { codigoBarras: '7901210737', descricao: 'LIMPADOR CONC. ORQUÍDEA DO CARIBE 120ML | SCAR', quantidade: 8, valorUnitario: 12.50 },
  { codigoBarras: '7901210521', descricao: 'ESPONJA DUPLA FACE S/PELÍCULA | BTTN', quantidade: 6, valorUnitario: 0.85 },
  { codigoBarras: '7901210691', descricao: 'LAVA ROUPAS MIL FLORES 5L | GMRÃES', quantidade: 4, valorUnitario: 29.90 },
  { codigoBarras: '7901210763', descricao: 'LIMPADOR PERFUMADO BAMBOO 5L | GMRÃES', quantidade: 4, valorUnitario: 28.90 },
  { codigoBarras: '7901212180', descricao: 'LUSTRA MÓVEIS UTIL 200ML', quantidade: 3, valorUnitario: 5.30 },
  { codigoBarras: '7901210850', descricao: 'LUVA "M" LARANJA REFORÇADA SLIM | VOLK', quantidade: 8, valorUnitario: 8.99 },
  { codigoBarras: '7901210973', descricao: 'PÁ DE LIXO REBATÍVEL C/CABO 60CM | DLCN', quantidade: 4, valorUnitario: 12.98 },
  { codigoBarras: '7901210989', descricao: 'PANO DE PRATO BRANCO | 44CMX67CM', quantidade: 8, valorUnitario: 3.50 },
  { codigoBarras: '7901210998', descricao: 'PANO MICROFIBRA UNIVERSAL 40CMX40CM | PFPRO', quantidade: 8, valorUnitario: 6.90 },
  { codigoBarras: '7901211033', descricao: 'PAPEL HIGIÊNICO BRANCO FOLHA SIMPLES 10CMX300M | RPEL', quantidade: 3, valorUnitario: 48.90 },
  { codigoBarras: '7901211073', descricao: 'PAPEL TOALHA INTERFOLHADO FS 20CMX20CM C/1000 FOLHAS 100% CELULOSE | RPEL', quantidade: 5, valorUnitario: 15.50 },
  { codigoBarras: '7901211307', descricao: 'SACO DE LIXO 20L PRETO FLEX 0.02M/40X50CM C/100UN', quantidade: 2, valorUnitario: 6.00 },
  { codigoBarras: '7901211314', descricao: 'SACO DE LIXO 240L PRETO RESISTENTE 0.10M / 120X144CM C/50UN', quantidade: 4, valorUnitario: 77.74 },
  { codigoBarras: '7901212181', descricao: 'SACO DE LIXO 240L AZUL 0.10 / 100X144CM C/50UN', quantidade: 2, valorUnitario: 84.50 },
  { codigoBarras: '7901211354', descricao: 'SAPONÁCEO CREMOSO FLORAL/LAVANDA/LIMÃO 250ML | SANYMIX', quantidade: 6, valorUnitario: 3.90 },
  { codigoBarras: '7901210141', descricao: 'BOBINA PLÁSTICA 30CMX40CM 300 SACOS | PET', quantidade: 12, valorUnitario: 19.90 },
  { codigoBarras: '7901211381', descricao: 'SUPORTE LT S/CABO | SYNERGIAS', quantidade: 5, valorUnitario: 10.90 },
  { codigoBarras: '7901211448', descricao: 'VASSOURA MULTIUSO C/CABO 140CM | BTTN', quantidade: 5, valorUnitario: 18.06 },
  { codigoBarras: '7901210859', descricao: 'LUVA "M" SILVERIX AZUL | MEDIX', quantidade: 8, valorUnitario: 4.65 },
]

function normalizarNomeProduto2458(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[“”"']/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function localizarProduto2458(produtos: any[], descricaoEsperada: string): any | undefined {
  const nomeCompletoEsperado = normalizarNomeProduto2458(descricaoEsperada)
  const nomeBaseEsperado = normalizarNomeProduto2458(descricaoEsperada.split('|')[0])

  const candidatosExatos = produtos.filter((produto) =>
    normalizarNomeProduto2458(nomeProduto2458(produto)) === nomeCompletoEsperado,
  )

  if (candidatosExatos.length === 1) {
    return candidatosExatos[0]
  }

  if (candidatosExatos.length > 1) {
    console.error('[V220B] Mais de um produto possui exatamente o mesmo nome.', {
      descricaoEsperada,
      quantidade: candidatosExatos.length,
    })
    return undefined
  }

  const candidatosPorNomeBase = produtos.filter((produto) => {
    const nomeCadastro = normalizarNomeProduto2458(nomeProduto2458(produto))
    const nomeBaseCadastro = normalizarNomeProduto2458(nomeProduto2458(produto).split('|')[0])
    return nomeCadastro === nomeBaseEsperado || nomeBaseCadastro === nomeBaseEsperado
  })

  if (candidatosPorNomeBase.length === 1) {
    return candidatosPorNomeBase[0]
  }

  if (candidatosPorNomeBase.length > 1) {
    console.error('[V220B] O nome-base do produto é ambíguo.', {
      descricaoEsperada,
      quantidade: candidatosPorNomeBase.length,
    })
  } else {
    console.error('[V220B] Produto não localizado pelo nome.', { descricaoEsperada })
  }

  return undefined
}

export function migrarOrcamento2458RossiCaribeUmaVez(
  vendas: any[],
  produtos: any[],
  clientes: any[],
): any[] {
  const listaVendas = Array.isArray(vendas) ? vendas : []
  const listaProdutos = Array.isArray(produtos) ? produtos : []
  const listaClientes = Array.isArray(clientes) ? clientes : []

  const indice2458 = listaVendas.findIndex((venda) =>
    somenteDigitos2458(venda?.numeroOrcamento || venda?.numero || venda?.codigo) === '2458',
  )

  if (indice2458 < 0) {
    console.error('[V220B] O orçamento 2458 existente não foi localizado. Nenhum registro foi criado.')
    return listaVendas
  }

  const atual = listaVendas[indice2458]
  if (String(atual?.marcadorInstalacao || '') === MARCADOR_2458) {
    return listaVendas
  }

  const cliente = listaClientes.find((item) =>
    somenteDigitos2458(
      item?.cnpj ||
      item?.cpfCnpj ||
      item?.cnpjCpf ||
      item?.documento ||
      item?.documentoPrincipal,
    ) === CNPJ_2458,
  )

  if (!cliente) {
    console.error(`[V220B] Cliente com CNPJ ${CNPJ_2458} não localizado. Nenhuma busca por nome foi usada.`)
    return listaVendas
  }

  const itens = ITENS_2458.map((regra, indice) => {
    const produto = localizarProduto2458(listaProdutos, regra.descricao)
    const custoUnitario = numero2458(
      produto?.custo ||
      produto?.custoMedioAtual ||
      produto?.ultimoCustoCompra ||
      0,
    )
    const produtoId = texto2458(produto?.id)
    const codigoProduto = texto2458(
      produto?.codigo,
      produto?.codigoInterno,
      produto?.codigoProduto,
      regra.codigoBarras,
    )

    return {
      id: `2458-item-${indice + 1}`,
      produtoId,
      codigo: codigoProduto,
      codigoProduto,
      codigoBarras: regra.codigoBarras,
      descricao: regra.descricao,
      descricaoCadastro: produto ? nomeProduto2458(produto) : regra.descricao,
      unidade: texto2458(produto?.unidade, produto?.unidadeMedida, 'Unidade'),
      quantidade: regra.quantidade,
      valorUnitario: regra.valorUnitario,
      desconto: 0,
      descontoValor: 0,
      descontoPercentual: 0,
      valorTotal: Number((regra.quantidade * regra.valorUnitario).toFixed(2)),
      custoUnitario,
      custoTotal: Number((regra.quantidade * custoUnitario).toFixed(2)),
      estoqueDisponivel: numero2458(
        produto?.estoqueAtual ||
        produto?.estoque ||
        produto?.quantidadeEstoque ||
        0,
      ),
      produtoVinculado: Boolean(produto),
      vinculoProdutoOrigem: produto ? 'NOME_EXATO_ATUAL_ERP' : 'NOME_DO_PDF_PRESERVADO',
      ncm: texto2458(produto?.ncm),
      cfop: texto2458(produto?.cfopDentroEstado, produto?.cfop),
      origem: texto2458(produto?.origem),
      cest: texto2458(produto?.cest),
      csosn: texto2458(produto?.csosn),
      cstIcms: texto2458(produto?.cstIcms),
      cstPis: texto2458(produto?.cstPis),
      cstCofins: texto2458(produto?.cstCofins),
    }
  })

  const quantidadeTotal = itens.reduce((soma, item) => soma + Number(item.quantidade || 0), 0)
  const total = Number(itens.reduce((soma, item) => soma + Number(item.valorTotal || 0), 0).toFixed(2))

  if (itens.length !== 27 || quantidadeTotal !== 142 || total !== 2456.30) {
    console.error('[V220B] Validação interna do orçamento 2458 falhou.', {
      produtos: itens.length,
      quantidadeTotal,
      total,
    })
    return listaVendas
  }

  const pagamento = {
    id: '2458-pagamento-1',
    formaPagamento: 'BOLETO BANCO INTER',
    descricao: 'BOLETO BANCO INTER (1x - 30 dias) [1/1]',
    prazo: '30 dias',
    vencimento: '2026-08-15',
    observacoes: '',
    valor: 2456.30,
  }

  const corrigido = {
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
    clienteId: texto2458(cliente?.id, cliente?.clienteId, cliente?.codigo, cliente?.codigoCliente),
    clienteNome: nomeCliente2458(cliente),
    clienteDocumento: '18.995.796/0001-25',
    cnpjCpf: '18.995.796/0001-25',
    documentoCliente: '18.995.796/0001-25',
    enderecoEntrega: texto2458(
      cliente?.enderecoEntregaFormatado,
      cliente?.enderecoEntrega,
      'RUA IRMÃO NORBERTO FRANCISCO RAUCH, 755 - JARDIM CARVALHO - PORTO ALEGRE / RS - CEP: 91450-147 - BRASIL',
    ),
    itens,
    itensEditadosManual: true,
    quantidadeItens: 142,
    quantidadeTotal: 142,
    numeroProdutos: 27,
    tipoDesconto: 'valor',
    descontoInformado: 0,
    descontoCalculado: 0,
    descontoValor: 0,
    frete: 0,
    outrosCustos: 0,
    subtotal: 2456.30,
    totalItens: 2456.30,
    totalFinal: 2456.30,
    valorTotal: 2456.30,
    pagamentos: [pagamento],
    parcelas: [pagamento],
    formaPagamento: 'BOLETO BANCO INTER',
    condicaoPagamento: '1x - 30 dias',
    vencimentoPagamento: '2026-08-15',
    observacoes: '',
    atualizadoEm: new Date().toISOString(),
    marcadorInstalacao: MARCADOR_2458,
  }

  const resultado = [...listaVendas]
  resultado[indice2458] = corrigido

  console.info('[V220B] Orçamento 2458 corrigido pelo CNPJ exato e produtos vinculados pelo nome.', {
    cnpj: CNPJ_2458,
    produtos: 27,
    quantidadeTotal: 142,
    total: 2456.30,
  })

  return resultado
}
