function normalizar2429(valor: unknown): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nomeProduto2429(produto: any): string {
  return String(produto?.descricao || produto?.nome || produto?.nomeProduto || produto?.produto || '').trim()
}

function semMarca2429(valor: unknown): string {
  return normalizar2429(valor).split(' | ')[0].trim()
}

function palavras2429(valor: unknown): Set<string> {
  const ignorar = new Set(['DE','DA','DO','DAS','DOS','COM','C','E','EM','UN','UNI','UNIDADE'])
  return new Set(normalizar2429(valor).split(' ').filter((p) => p.length > 1 && !ignorar.has(p)))
}

function localizarProduto2429(descricao: string, produtos: any[]): any | undefined {
  const alvoCompleto = normalizar2429(descricao)
  const exatos = produtos.filter((p) => normalizar2429(nomeProduto2429(p)) === alvoCompleto)
  if (exatos.length === 1) return exatos[0]

  const alvoSemMarca = semMarca2429(descricao)
  const equivalentes = produtos.filter((p) => semMarca2429(nomeProduto2429(p)) === alvoSemMarca)
  if (equivalentes.length === 1) return equivalentes[0]

  const alvo = palavras2429(descricao)
  const candidatos = produtos
    .map((produto) => {
      const atual = palavras2429(nomeProduto2429(produto))
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

function nomeCliente2429(cliente: any): string {
  return String(cliente?.nomeRazaoSocial || cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.nome || cliente?.clienteNome || '').trim()
}

export function garantirOrcamento2429(vendas: any[], produtos: any[], clientes: any[]): any[] {
  const cliente = clientes.find((item) => {
    const nome = normalizar2429(nomeCliente2429(item))
    return nome === 'EDIFICIO PRIME' || nome.includes('EDIFICIO PRIME') || nome.includes('CONDOMINIO PRIME')
  })

  const itensHistoricos = [
    ['LIMPADOR CONC. ORQUÍDEA NEGRA 120 ML | COALA', 4, 12.99],
    ['LIMPADOR CONC. CITRONELA 120ML | COALA', 2, 12.99],
    ['SACO DE LIXO 20L PRETO FLEX 0.02M/40X50CM C/100UN', 2, 5.99],
    ['SACO DE LIXO 240L PRETO RESISTENTE 0.10M / 120X144CM C/50UN', 2, 75.00],
    ['SACO DE LIXO 100L PRETO REFORÇADO 0.08M / 75X90CM C/100UN', 3, 47.90],
    ['PAPEL TOALHA INTERFOLHADO FS 20CMX20CM C/1000FLS 100% CELULOSE | RPEL', 10, 15.50],
    ['AÇUCAR REFINADA 1K | DA BARRA', 5, 4.29],
    ['CAFÉ TRADICIONAL 500G | MELLITA', 7, 29.99],
    ['FILTRO 102/30 | BOM JESUS', 2, 3.85],
    ['ESPONJA DUPLA FACE S /PELICULA | BTTN', 8, 0.80],
    ['PANO ALVEJADO 100% ALGODÃO 40CM X 65CM', 6, 3.65],
    ['AGUA SANITÁRIA 5L | GMRÃES', 5, 11.90],
    ['FIBRA VEGETAL USO GERAL SLIM | NB', 10, 1.30],
    ['CABO CHAPA 150CM C/ROSCA | BTTN', 1, 12.85],
    ['SUPORTE LT S/CABO | SYNERGIAS', 1, 9.99],
    ['LUSTRA MOVÉIS 200ML | PEROBA', 1, 6.15],
    ['BORRIFADOR TRANSPARENTE 500ML | NB', 5, 4.60],
    ['PASTILHA ADESIVA SANITÁRIA C/3UN | NFRESCOR', 8, 3.99],
  ] as const

  const itens = itensHistoricos.map(([descricaoHistorica, quantidade, valorUnitario], indice) => {
    const produto = localizarProduto2429(descricaoHistorica, produtos)
    const codigoBarras = String(produto?.codigoBarras || '').trim()
    const descricaoAtual = produto ? nomeProduto2429(produto) : descricaoHistorica
    return {
      id: `2429-item-${indice + 1}`,
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

  const existente = vendas.find((v) => String(v?.numeroOrcamento || '').replace(/\D/g, '') === '2429')
  // O orçamento 2429 é importado apenas uma vez. Depois disso, o registro online
  // é a fonte de verdade e nunca pode ser recriado como Aberto durante o login.
  if (existente) return vendas

  const enderecoPadrao = 'Rua Nunes Machado, 76\nAzenha - Porto Alegre / RS - CEP: 90130-080 - Brasil'
  const enderecoCliente = String(cliente?.enderecoEntrega || cliente?.enderecoFiscal || '').trim() || enderecoPadrao
  const documentoCliente = String(cliente?.cpfCnpj || cliente?.cnpjCpf || cliente?.documento || '')
  const emailCliente = String(cliente?.email || cliente?.emailNotaFiscal || 'FINANCEIRO@SYNERGIAS.COM.BR')

  const orcamento = {
    ...(existente || {}),
    id: String(existente?.id || 'orcamento-importado-2429-prime'),
    tipo: 'Orçamento',
    numeroOrcamento: '2429',
    vendedor: 'NATÁLIA VIEIRA',
    clienteId: String(cliente?.id || cliente?.codigo || ''),
    clienteCodigo: String(cliente?.codigo || cliente?.id || ''),
    clienteNome: nomeCliente2429(cliente) || 'EDIFICIO PRIME',
    clienteDocumento: documentoCliente,
    clienteEmail: emailCliente,
    clienteEmailNotaFiscal: String(cliente?.emailNotaFiscal || emailCliente),
    clienteTelefone: String(cliente?.telefone || cliente?.celular || ''),
    dataEmissao: '2026-07-06',
    dataEntrega: '2026-07-08',
    dataValidade: '2026-07-11',
    enderecoFaturamento: enderecoCliente,
    enderecoEntrega: enderecoCliente,
    faturamentoCep: String(cliente?.cepFiscal || cliente?.cep || '90130-080'),
    faturamentoEndereco: String(cliente?.logradouroFiscal || cliente?.logradouro || 'Rua Nunes Machado'),
    faturamentoNumero: String(cliente?.numeroFiscal || cliente?.numero || '76'),
    faturamentoComplemento: String(cliente?.complementoFiscal || cliente?.complemento || ''),
    faturamentoBairro: String(cliente?.bairroFiscal || cliente?.bairro || 'Azenha'),
    faturamentoCidade: String(cliente?.cidadeFiscal || cliente?.cidade || 'Porto Alegre'),
    faturamentoEstado: String(cliente?.ufFiscal || cliente?.uf || 'RS'),
    entregaCep: String(cliente?.cepEntrega || cliente?.cepFiscal || cliente?.cep || '90130-080'),
    entregaEndereco: String(cliente?.logradouroEntrega || cliente?.logradouroFiscal || cliente?.logradouro || 'Rua Nunes Machado'),
    entregaNumero: String(cliente?.numeroEntrega || cliente?.numeroFiscal || cliente?.numero || '76'),
    entregaComplemento: String(cliente?.complementoEntrega || cliente?.complementoFiscal || cliente?.complemento || ''),
    entregaBairro: String(cliente?.bairroEntrega || cliente?.bairroFiscal || cliente?.bairro || 'Azenha'),
    entregaCidade: String(cliente?.cidadeEntrega || cliente?.cidadeFiscal || cliente?.cidade || 'Porto Alegre'),
    entregaEstado: String(cliente?.ufEntrega || cliente?.ufFiscal || cliente?.uf || 'RS'),
    itens,
    itensEditadosManual: true,
    tipoDesconto: 'valor',
    descontoInformado: 0,
    descontoCalculado: 0,
    descontoValor: 0,
    frete: 0,
    outrosCustos: 0,
    subtotal: 962.41,
    totalFinal: 962.41,
    formaPagamento: 'BOLETO BANCO CORA',
    parcelamento: '1x - 30 dias',
    bancoCobranca: 'Cora',
    tipoCobranca: 'BOLETO BANCO CORA',
    valorPagamento: 962.41,
    pagamentos: [{
      id: '2429-pagamento-1',
      formaPagamento: 'BOLETO BANCO CORA',
      prazo: '1x - 30 dias',
      vencimento: '2026-08-05',
      observacoes: '',
      valor: 962.41,
    }],
    parcelas: [{
      numero: 1,
      vencimento: '2026-08-05',
      observacao: '',
      valor: 962.41,
      bancoCobranca: 'Cora',
      tipoCobranca: 'BOLETO BANCO CORA',
      statusBoleto: 'Pendente',
    }],
    observacoes: '',
    statusOrcamento: 'Aberto',
    criadoEm: String(existente?.criadoEm || '2026-07-06T20:23:13.000Z'),
    atualizadoEm: new Date().toISOString(),
  }

  const sem2429 = vendas.filter((v) => String(v?.numeroOrcamento || '').replace(/\D/g, '') !== '2429')
  return [...sem2429, orcamento]
}
