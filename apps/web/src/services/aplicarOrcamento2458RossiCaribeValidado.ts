/* SYNERGIAS_2458_DESCRICAO_ATUAL_V306
   Sobrepõe SOMENTE o orçamento 2458 já existente.
   Localiza o cliente pelo CNPJ.
   Localiza os produtos pela descrição atual do cadastro.
   Puxa código de barras, NCM, CFOP e demais dados fiscais do produto localizado.
   Não cria cliente, produto ou outro orçamento.
*/

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[“”"']/g, '')
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

function numero(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  const bruto = String(valor ?? '').trim()
  if (!bruto) return 0
  let normalizado = bruto.replace(/R\$/gi, '').replace(/\s+/g, '')
  if (normalizado.includes(',') && normalizado.includes('.')) normalizado = normalizado.replace(/\./g, '').replace(',', '.')
  else if (normalizado.includes(',')) normalizado = normalizado.replace(',', '.')
  const convertido = Number(normalizado.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(convertido) ? convertido : 0
}

function nomeCliente(cliente: any): string {
  return texto(cliente?.nomeRazaoSocial, cliente?.razaoSocial, cliente?.nomeFantasia, cliente?.nome, cliente?.clienteNome)
}

function nomeProduto(produto: any): string {
  return texto(produto?.descricao, produto?.nome, produto?.nomeProduto, produto?.produto)
}

type RegraItem = { descricao: string; quantidade: number; valorUnitario: number }

const ITENS: RegraItem[] = [
  { descricao: 'BALDE PLAST 20L COLOR C/ ALÇA METAL | LB', quantidade: 4, valorUnitario: 19.95 },
  { descricao: 'BALDE 14L C/ESPREMEDOR | BTTN', quantidade: 4, valorUnitario: 34.90 },
  { descricao: 'BORRIFADOR TRANSPARENTE 500ML | NB', quantidade: 3, valorUnitario: 4.90 },
  { descricao: 'BRILHA INOX SPRAY 250ML | DLINE', quantidade: 4, valorUnitario: 16.90 },
  { descricao: 'MOP ÚMIDO 190G | MOX', quantidade: 8, valorUnitario: 12.55 },
  { descricao: 'CABO CHAPA AÇO 140CM C/ROSCA | PFPRO', quantidade: 4, valorUnitario: 8.50 },
  { descricao: 'DESINCRUSTANTE CLEANOX 5L | CLEAN', quantidade: 4, valorUnitario: 59.90 },
  { descricao: 'AGUA SANITÁRIA 5L | QMFEL', quantidade: 6, valorUnitario: 9.50 },
  { descricao: 'LIMPADOR CONC. ORQUÍDEA DO CARIBE 120ML | SCAR', quantidade: 8, valorUnitario: 12.50 },
  { descricao: 'ESPONJA DUPLA FACE S /PELICULA | BTTN', quantidade: 6, valorUnitario: 0.85 },
  { descricao: 'LAVA ROUPAS MIL FLORES 5L | GMRÃES', quantidade: 4, valorUnitario: 29.90 },
  { descricao: 'LIMPADOR PERFUMADO BAMBOO 5L | GMRÃES', quantidade: 4, valorUnitario: 28.90 },
  { descricao: 'LUSTRA MÓVEIS UTIL 200ML', quantidade: 3, valorUnitario: 5.30 },
  { descricao: 'LUVA "M" LARANJA REFORÇADA SLIM | VOLK', quantidade: 8, valorUnitario: 8.99 },
  { descricao: 'PÁ DE LIXO REBATÍVEL C/CABO 60CM | DLCN', quantidade: 4, valorUnitario: 12.98 },
  { descricao: 'PANO DE PRATO BRANCO | 44CMX67CM', quantidade: 8, valorUnitario: 3.50 },
  { descricao: 'PANO MICROFIBRA UNIVERSAL 40CMX40CM | PFPRO', quantidade: 8, valorUnitario: 6.90 },
  { descricao: 'PAPEL HIGIENICO BRANCO FOLHA SIMPLES 10CMX300M | RPEL', quantidade: 3, valorUnitario: 48.90 },
  { descricao: 'PAPEL TOALHA INTERFOLHADO FS 20CM X 20CM C/1000 FOLHAS 100% CELULOSE | RPEL', quantidade: 5, valorUnitario: 15.50 },
  { descricao: 'SACO DE LIXO 20L PRETO FLEX 0.02M/40X50CM C/100UN', quantidade: 2, valorUnitario: 6.00 },
  { descricao: 'SACO DE LIXO 240L PRETO RESISTENTE 0.10M / 120X144CM C/50UN', quantidade: 4, valorUnitario: 77.74 },
  { descricao: 'SACO DE LIXO 240 LITROS - 0.10 AZUL 100X144CM C/50UN', quantidade: 2, valorUnitario: 84.50 },
  { descricao: 'SAPONACEO CREMOSO FLORAL/LAVANDA/LIMÃO 250ML | SANYMIX', quantidade: 6, valorUnitario: 3.90 },
  { descricao: 'BOBINA PLASTICA 30CMX40CM 300 SACOS | PET', quantidade: 12, valorUnitario: 19.90 },
  { descricao: 'SUPORTE LT S/CABO | SYNERGIAS', quantidade: 5, valorUnitario: 10.90 },
  { descricao: 'VASSOURA MULTIUSO C/CABO 140CM | BTTN', quantidade: 5, valorUnitario: 18.06 },
  { descricao: 'LUVA "M" SILVERIX AZUL | MEDIX', quantidade: 8, valorUnitario: 4.65 },
]

function localizarProduto(produtos: any[], descricaoEsperada: string): any | undefined {
  const esperadoCompleto = normalizar(descricaoEsperada)
  const esperadoBase = normalizar(descricaoEsperada.split('|')[0])
  const exatos = produtos.filter((produto) => normalizar(nomeProduto(produto)) === esperadoCompleto)
  if (exatos.length === 1) return exatos[0]
  if (exatos.length > 1) return undefined
  const porBase = produtos.filter((produto) => {
    const cadastro = nomeProduto(produto)
    return normalizar(cadastro) === esperadoBase || normalizar(cadastro.split('|')[0]) === esperadoBase
  })
  return porBase.length === 1 ? porBase[0] : undefined
}

export async function aplicarOrcamento2458RossiCaribeValidado(
  vendas: any[],
  produtos: any[],
  clientes: any[],
  atualizar: (colecao: any, registro: any) => Promise<any>,
  carregar: (colecao: any) => Promise<any>,
): Promise<any[]> {
  const listaVendas = Array.isArray(vendas) ? vendas : []
  const listaProdutos = Array.isArray(produtos) ? produtos : []
  const listaClientes = Array.isArray(clientes) ? clientes : []

  const encontrados2458 = listaVendas.map((venda, indice) => ({ venda, indice })).filter(({ venda }) =>
    String(venda?.numeroOrcamento || venda?.numero || venda?.codigo || '').replace(/\D/g, '') === '2458')
  if (encontrados2458.length !== 1) {
    console.error('[V306] O orçamento 2458 não foi localizado de forma única.', { quantidade: encontrados2458.length })
    return listaVendas
  }

  const atual = encontrados2458[0].venda
  if (String(atual?.marcadorInstalacao || '') === 'SYNERGIAS_2458_DESCRICAO_ATUAL_V306') return listaVendas

  const cliente = listaClientes.find((item) => String(item?.cnpj || item?.cpfCnpj || item?.cnpjCpf || item?.documento || '').replace(/\D/g, '') === '18995796000125')
  if (!cliente) {
    console.error('[V306] Cliente CNPJ 18.995.796/0001-25 não localizado. Nenhum cliente foi criado.')
    return listaVendas
  }

  const localizados = ITENS.map((regra) => ({ regra, produto: localizarProduto(listaProdutos, regra.descricao) }))
  const ausentes = localizados.filter((item) => !item.produto)
  if (ausentes.length) {
    console.error('[V306] O orçamento 2458 não foi alterado porque produtos não foram localizados de forma única pela descrição.', ausentes.map((item) => item.regra.descricao))
    return listaVendas
  }

  const itens = localizados.map(({ regra, produto }, indice) => {
    const codigoBarras = texto(produto?.codigoBarras, produto?.ean, produto?.gtin)
    const codigoProduto = texto(produto?.codigo, produto?.codigoInterno, produto?.codigoProduto, codigoBarras, produto?.id)
    const custoUnitario = numero(produto?.custo || produto?.custoMedioAtual || produto?.ultimoCustoCompra)
    return {
      id: `2458-item-${indice + 1}`,
      produtoId: texto(produto?.id),
      codigo: codigoProduto,
      codigoProduto,
      codigoBarras,
      descricao: nomeProduto(produto),
      descricaoSolicitada: regra.descricao,
      unidade: texto(produto?.unidade, produto?.unidadeMedida, 'Unidade'),
      quantidade: regra.quantidade,
      valorUnitario: regra.valorUnitario,
      desconto: 0,
      descontoValor: 0,
      descontoPercentual: 0,
      valorTotal: Number((regra.quantidade * regra.valorUnitario).toFixed(2)),
      custoUnitario,
      custoTotal: Number((regra.quantidade * custoUnitario).toFixed(2)),
      estoqueDisponivel: numero(produto?.estoqueAtual || produto?.estoque || produto?.quantidadeEstoque),
      produtoVinculado: true,
      vinculoProdutoOrigem: 'DESCRICAO_ATUAL_ERP',
      ncm: texto(produto?.ncm),
      cfop: texto(produto?.cfopDentroEstado, produto?.cfop, '5102'),
      origem: texto(produto?.origem),
      cest: texto(produto?.cest),
      csosn: texto(produto?.csosn),
      cstIcms: texto(produto?.cstIcms),
      cstPis: texto(produto?.cstPis),
      cstCofins: texto(produto?.cstCofins),
    }
  })

  const quantidadeTotal = itens.reduce((soma, item) => soma + Number(item.quantidade || 0), 0)
  const subtotal = Number(itens.reduce((soma, item) => soma + Number(item.valorTotal || 0), 0).toFixed(2))
  if (itens.length !== 27 || quantidadeTotal !== 142 || subtotal !== 2456.30) {
    console.error('[V306] Validação do orçamento 2458 falhou.', { itens: itens.length, quantidadeTotal, subtotal })
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

  const atualizado = {
    ...atual,
    tipo: 'Orçamento', numero: '2458', numeroOrcamento: '2458', status: 'Aberto', statusOrcamento: 'Aberto',
    vendedor: 'NATÁLIA VIEIRA', vendedorNome: 'NATÁLIA VIEIRA',
    dataEmissao: '2026-07-16', emissao: '2026-07-16', dataEntrega: '2026-07-20', entrega: '2026-07-20', dataValidade: '2026-07-23', validade: '2026-07-23',
    clienteId: texto(cliente?.id, cliente?.clienteId, cliente?.codigo, cliente?.codigoCliente),
    clienteNome: nomeCliente(cliente), clienteDocumento: '18.995.796/0001-25', cnpjCpf: '18.995.796/0001-25', documentoCliente: '18.995.796/0001-25',
    enderecoEntrega: 'RUA IRMÃO NORBERTO FRANCISCO RAUCH, 755\nJARDIM CARVALHO - PORTO ALEGRE / RS - CEP: 91450-147',
    entregaCep: '91450-147', entregaEndereco: 'RUA IRMÃO NORBERTO FRANCISCO RAUCH', entregaNumero: '755', entregaComplemento: '', entregaBairro: 'JARDIM CARVALHO', entregaCidade: 'PORTO ALEGRE', entregaEstado: 'RS',
    enderecoFaturamento: 'RUA IRMÃO NORBERTO FRANCISCO RAUCH, 755\nJARDIM CARVALHO - PORTO ALEGRE / RS - CEP: 91450-147',
    faturamentoCep: '91450-147', faturamentoEndereco: 'RUA IRMÃO NORBERTO FRANCISCO RAUCH', faturamentoNumero: '755', faturamentoComplemento: '', faturamentoBairro: 'JARDIM CARVALHO', faturamentoCidade: 'PORTO ALEGRE', faturamentoEstado: 'RS',
    itens, itensEditadosManual: true, quantidadeItens: 142, quantidadeTotal: 142, numeroProdutos: 27,
    tipoDesconto: 'valor', descontoInformado: 0, descontoCalculado: 0, descontoValor: 0, frete: 0, outrosCustos: 0,
    subtotal: 2456.30, totalItens: 2456.30, totalFinal: 2456.30, valorTotal: 2456.30,
    pagamentos: [pagamento], parcelas: [pagamento], formaPagamento: 'BOLETO BANCO INTER', condicaoPagamento: '1x - 30 dias', vencimentoPagamento: '2026-08-15', observacoes: '',
    atualizadoEm: new Date().toISOString(), marcadorInstalacao: 'SYNERGIAS_2458_DESCRICAO_ATUAL_V306', origemAtualizacao: 'SYNERGIAS_2458_DESCRICAO_ATUAL_V306',
  }

  await atualizar('vendas', atualizado)
  const confirmado = await carregar('vendas')
  const vendasConfirmadas = Array.isArray(confirmado?.data) ? confirmado.data : listaVendas
  console.info('[V306] Orçamento 2458 atualizado pela descrição dos produtos.', { itens: itens.length, quantidadeTotal, subtotal })
  return vendasConfirmadas
}
