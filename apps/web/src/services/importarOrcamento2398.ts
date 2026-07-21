function normalizar2398(valor: unknown): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nomeProduto2398(produto: any): string {
  return String(produto?.descricao || produto?.nome || produto?.nomeProduto || produto?.produto || '').trim()
}

function semMarca2398(valor: unknown): string {
  return normalizar2398(valor).split(' | ')[0].trim()
}

function palavras2398(valor: unknown): Set<string> {
  const ignorar = new Set(['DE','DA','DO','DAS','DOS','COM','C','E','EM','UN','UNI','UNIDADE'])
  return new Set(normalizar2398(valor).split(' ').filter((p) => p.length > 1 && !ignorar.has(p)))
}

function localizarProduto2398(descricao: string, produtos: any[]): any | undefined {
  const alvoCompleto = normalizar2398(descricao)
  const exatos = produtos.filter((p) => normalizar2398(nomeProduto2398(p)) === alvoCompleto)
  if (exatos.length === 1) return exatos[0]

  const alvoSemMarca = semMarca2398(descricao)
  const equivalentes = produtos.filter((p) => semMarca2398(nomeProduto2398(p)) === alvoSemMarca)
  if (equivalentes.length === 1) return equivalentes[0]

  const alvo = palavras2398(descricao)
  const candidatos = produtos
    .map((produto) => {
      const atual = palavras2398(nomeProduto2398(produto))
      const intersecao = [...alvo].filter((p) => atual.has(p)).length
      const uniao = new Set([...alvo, ...atual]).size || 1
      return { produto, score: intersecao / uniao, intersecao }
    })
    .filter((x) => x.intersecao >= 3 && x.score >= 0.55)
    .sort((a, b) => b.score - a.score)

  if (!candidatos.length) return undefined
  if (candidatos.length > 1 && candidatos[0].score === candidatos[1].score) return undefined
  return candidatos[0].produto
}

function nomeCliente2398(cliente: any): string {
  return String(cliente?.nomeRazaoSocial || cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.nome || cliente?.clienteNome || '').trim()
}

export function garantirOrcamento2398(vendas: any[], produtos: any[], clientes: any[]): any[] {
  const cliente = clientes.find((item) => {
    const nome = normalizar2398(nomeCliente2398(item))
    return nome.includes('CONDOMINIO BOTANIQUE RESIDENCE') || nome.includes('BOTANIQUE RESIDENCE')
  })

  const itensHistoricos = [
    ['MAX CLEAN OX 5L | MXSN', 3, 54.90],
    ['LIMPADOR CONC. CEREJA E AVELA 120ML | COALA', 4, 12.99],
    ['BOBINA 200 SACOS 30CMX40CM | PETCÃO', 4, 17.90],
    ['PANO ALVEJADO 100% ALGODÃO 40CM X 65CM', 8, 3.65],
    ['ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', 10, 0.65],
    ['PASTILHA ADESIVA SANITÁRIA C/3UN | NFRESCOR', 8, 3.99],
    ['SACO DE LIXO 100L PRETO LEVE 0.06M / 75X90CM C/100UN', 3, 35.50],
    ['SACO DE LIXO 240L PRETO REFORÇADO 0.08M EP / 120X144CM C/50UN', 1, 49.90],
    ['PAPEL TOALHA INTERF. 20CMX20CM C/800FLS F SIMPLES 100% CEL | PSA', 15, 12.75],
    ['DETERGENTE NEUTRO/CRISTAL 5L | BRILHA SUL', 2, 16.99],
    ['PAPEL HIGIENICO FOLHA DUPLA 12X30M NEUTRO | PALOMA', 8, 14.90],
    ['ALCOOL LIQUIDO 70° 1L | FLOPS', 2, 6.25],
    ['SACO DE LIXO 60L PRETO FLEX 0.02M/60X70CM C/100UN', 2, 12.40],
    ['PANO DE PRATO FLANELADO ESTAMPADO 45CMX70CM | DTEX', 4, 4.30],
  ] as const

  const itens = itensHistoricos.map(([descricaoHistorica, quantidade, valorUnitario], indice) => {
    const produto = localizarProduto2398(descricaoHistorica, produtos)
    const codigoBarras = String(produto?.codigoBarras || '').trim()
    const descricaoAtual = produto ? nomeProduto2398(produto) : descricaoHistorica
    return {
      id: `2398-item-${indice + 1}`,
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
      valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
      estoqueDisponivel: Number(produto?.estoqueAtual || produto?.estoque || produto?.quantidadeEstoque || 0),
      produtoVinculado: Boolean(produto && codigoBarras),
      vinculoProdutoOrigem: produto ? 'DESCRICAO_NORMALIZADA' : 'NAO_VINCULADO',
      descricaoHistorica,
      codigoProdutoHistorico: '',
      ncm: String(produto?.ncm || ''),
      ncmDescricao: String(produto?.ncmDescricao || ''),
      cfop: String(produto?.cfopDentroEstado || ''),
      origem: String(produto?.origem || ''),
      cest: String(produto?.cest || ''),
      csosn: String(produto?.csosn || ''),
      cstIcms: String(produto?.cstIcms || ''),
      cstPis: String(produto?.cstPis || ''),
      cstCofins: String(produto?.cstCofins || ''),
    }
  })

  const existente = vendas.find((v) => String(v?.numeroOrcamento || '').replace(/\D/g, '') === '2398')
  const endereco = 'Rua Mariz e Barros, 580\nPetrópolis - Porto Alegre / RS - CEP: 90690-390 - Brasil'
  const documentoCliente = String(cliente?.cpfCnpj || cliente?.cnpjCpf || cliente?.documento || '')
  const emailCliente = String(cliente?.email || cliente?.emailNotaFiscal || 'FINANCEIRO@SYNERGIAS.COM.BR')

  const orcamento = {
    ...(existente || {}),
    id: String(existente?.id || 'orcamento-importado-2398-botanique'),
    tipo: 'Orçamento',
    numeroOrcamento: '2398',
    vendedor: 'NATÁLIA VIEIRA',
    clienteId: String(cliente?.id || cliente?.codigo || ''),
    clienteCodigo: String(cliente?.codigo || cliente?.id || ''),
    clienteNome: nomeCliente2398(cliente) || 'CONDOMINIO BOTANIQUE RESIDENCE',
    clienteDocumento: documentoCliente,
    clienteEmail: emailCliente,
    clienteEmailNotaFiscal: String(cliente?.emailNotaFiscal || emailCliente),
    clienteTelefone: String(cliente?.telefone || cliente?.celular || ''),
    dataEmissao: '2026-07-14',
    dataEntrega: '2026-07-14',
    dataValidade: '2026-07-14',
    enderecoFaturamento: endereco,
    enderecoEntrega: endereco,
    faturamentoCep: '90690-390',
    faturamentoEndereco: 'Rua Mariz e Barros',
    faturamentoNumero: '580',
    faturamentoComplemento: '',
    faturamentoBairro: 'Petrópolis',
    faturamentoCidade: 'Porto Alegre',
    faturamentoEstado: 'RS',
    entregaCep: '90690-390',
    entregaEndereco: 'Rua Mariz e Barros',
    entregaNumero: '580',
    entregaComplemento: '',
    entregaBairro: 'Petrópolis',
    entregaCidade: 'Porto Alegre',
    entregaEstado: 'RS',
    itens,
    itensEditadosManual: true,
    tipoDesconto: 'valor',
    descontoInformado: 0,
    descontoCalculado: 0,
    descontoValor: 0,
    frete: 0,
    outrosCustos: 0,
    subtotal: 911.21,
    totalFinal: 911.21,
    formaPagamento: 'BOLETO BANCO CORA',
    parcelamento: '1x - 30 dias',
    bancoCobranca: 'Cora',
    tipoCobranca: 'BOLETO BANCO CORA',
    valorPagamento: 911.21,
    pagamentos: [{
      id: '2398-pagamento-1',
      formaPagamento: 'BOLETO BANCO CORA',
      prazo: '1x - 30 dias',
      vencimento: '2026-08-15',
      observacoes: '',
      valor: 911.21,
    }],
    parcelas: [{
      numero: 1,
      vencimento: '2026-08-15',
      observacao: '',
      valor: 911.21,
      bancoCobranca: 'Cora',
      tipoCobranca: 'BOLETO BANCO CORA',
      statusBoleto: 'Pendente',
    }],
    observacoes: '',
    statusOrcamento: 'Aberto',
    criadoEm: String(existente?.criadoEm || '2026-07-14T12:51:39.000Z'),
    atualizadoEm: '2026-07-14T15:00:00.000Z',
  }

  const sem2398 = vendas.filter((v) => String(v?.numeroOrcamento || '').replace(/\D/g, '') !== '2398')
  return [...sem2398, orcamento]
}
