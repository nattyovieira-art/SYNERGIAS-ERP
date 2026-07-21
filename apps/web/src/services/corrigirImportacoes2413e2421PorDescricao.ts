/* SYNERGIAS_CORRECAO_IMPORTACOES_2413_2421_2422_2423_2428_2444_POR_DESCRICAO_V262
   Corrige somente os orçamentos 2413, 2421, 2422, 2423, 2428 e 2444 já existentes.
   Não cria registros novos.
   Para todos eles, a lista histórica do PDF é a fonte de verdade: os itens são reconstruídos
   pela descrição, sem usar código de barras antigo, preservando o mesmo ID do orçamento.
   A rotina é idempotente e não reabre avisos de importação.
*/

function texto(...valores: unknown[]): string {
  for (const valor of valores) {
    const resultado = String(valor ?? '').trim()
    if (resultado) return resultado
  }
  return ''
}

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b(UNIDADE|UNIDADES|UND|UN)\b/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function descricaoProduto(produto: any): string {
  return texto(produto?.descricao, produto?.nome, produto?.nomeProduto, produto?.produto)
}

function tokens(valor: unknown): Set<string> {
  const ignorar = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'PARA', 'COM', 'C', 'SEM', 'S'])
  return new Set(
    normalizar(valor)
      .split(' ')
      .filter((item) => item.length >= 2 && !ignorar.has(item)),
  )
}

function numeros(valor: unknown): Set<string> {
  return new Set(normalizar(valor).split(' ').filter((item) => /^\d+(?:\d+)?$/.test(item)))
}

function pontuar(descricaoItem: string, produto: any): number {
  const a = normalizar(descricaoItem)
  const b = normalizar(descricaoProduto(produto))
  if (!a || !b) return 0
  if (a === b) return 10000

  const aSemMarca = a.split(' ').filter(Boolean).join(' ')
  const bSemMarca = b.split(' ').filter(Boolean).join(' ')
  if (aSemMarca === bSemMarca) return 9500
  if (a.includes(b) || b.includes(a)) return 8500 - Math.abs(a.length - b.length)

  const numerosA = numeros(a)
  const numerosB = numeros(b)
  const numeroIncompativel = [...numerosA].some((numero) => !numerosB.has(numero))
  if (numeroIncompativel) return 0

  const ta = tokens(a)
  const tb = tokens(b)
  const intersecao = [...ta].filter((token) => tb.has(token)).length
  const uniao = new Set([...ta, ...tb]).size
  if (!uniao) return 0

  const coberturaAlvo = intersecao / Math.max(1, ta.size)
  const jaccard = intersecao / uniao
  return Math.round(coberturaAlvo * 5000 + jaccard * 2500)
}

function localizarProdutoPorDescricao(produtos: any[], descricao: string): any | undefined {
  const alvo = normalizar(descricao)
  const exatos = produtos.filter((produto) => normalizar(descricaoProduto(produto)) === alvo)
  if (exatos.length === 1) return exatos[0]

  const classificados = produtos
    .map((produto) => ({ produto, pontos: pontuar(descricao, produto) }))
    .filter((item) => item.pontos >= 4800)
    .sort((a, b) => b.pontos - a.pontos)

  if (!classificados.length) return undefined
  if (
    classificados.length > 1 &&
    classificados[0].pontos - classificados[1].pontos < 250
  ) return undefined

  return classificados[0].produto
}

function numeroVenda(venda: any): string {
  return String(venda?.numeroOrcamento || venda?.numero || venda?.codigo || '').replace(/\D/g, '')
}

function nomeCliente(cliente: any): string {
  return texto(cliente?.nomeRazaoSocial, cliente?.razaoSocial, cliente?.nomeFantasia, cliente?.nome)
}

function numeroSeguro(valor: unknown): number {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

function totalVenda(venda: any): number {
  const totalInformado = [
    venda?.valorTotal,
    venda?.total,
    venda?.totalGeral,
    venda?.valorTotalOrcamento,
    venda?.totalFinal,
    venda?.valorFinal,
  ].map(numeroSeguro).find((valor) => valor > 0)

  if (totalInformado) return Number(totalInformado.toFixed(2))

  const itens = Array.isArray(venda?.itens) ? venda.itens : []
  return Number(itens.reduce((soma: number, item: any) => {
    const totalItem = numeroSeguro(item?.valorTotal)
    if (totalItem > 0) return soma + totalItem
    const quantidade = numeroSeguro(item?.quantidade)
    const unitario = numeroSeguro(item?.valorUnitario ?? item?.precoUnitario)
    const desconto = numeroSeguro(item?.descontoValor ?? item?.desconto)
    return soma + Math.max(0, quantidade * unitario - desconto)
  }, 0).toFixed(2))
}

function escolherRegistroCorreto(registros: any[], totalEsperado: number): any {
  return [...registros].sort((a, b) => {
    const diferencaA = Math.abs(totalVenda(a) - totalEsperado)
    const diferencaB = Math.abs(totalVenda(b) - totalEsperado)
    if (diferencaA !== diferencaB) return diferencaA - diferencaB

    const criadoA = Date.parse(texto(a?.criadoEm, a?.createdAt, a?.dataCriacao)) || Number.MAX_SAFE_INTEGER
    const criadoB = Date.parse(texto(b?.criadoEm, b?.createdAt, b?.dataCriacao)) || Number.MAX_SAFE_INTEGER
    return criadoA - criadoB
  })[0]
}

function igual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

type ItemHistorico = readonly [descricao: string, quantidade: number, valorUnitario: number]

const ITENS_HISTORICOS: Record<string, readonly ItemHistorico[]> = {
  '2413': [
    ['AROMATIZANTE MAÇA VERDE ECO 5L | BLIM', 4, 45.90],
    ['DESINFETANTE LAVANDA 5L | BRILHA SUL', 4, 12.15],
    ['DESINFETANTE FLORAL 5L | BRILHA SUL', 4, 12.15],
    ['DETERGENTE ALCALINO CLORADO 5L | PMP', 6, 18.90],
    ['SABONETE LIQUIDO GLICERINADO 5L ALGODÃO | NB', 5, 27.90],
    ['DETERGENTE LIMPEZA PESADA 5L | CLEAN', 6, 36.90],
    ['VASSOURA DE NYLON FACEIRA S/CABO | DLCN', 5, 7.50],
    ['CABO CHAPA AÇO 140CM C/ROSCA | PFPRO', 5, 8.50],
    ['FIBRA VEGETAL USO GERAL SLIM | NB', 6, 1.30],
    ['ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', 15, 0.65],
    ['ESPONJA LÃ DE AÇO C/8UN | 45G | ASSOLAN', 6, 2.30],
    ['SAPONACEO CLASSICO 300ML | UTL', 5, 4.90],
    ['LUSTRA MOVEIS 200ML | POLWAX', 6, 5.60],
    ['ALCOOL LIQUIDO 70° 1L | FLOPS', 30, 6.25],
    ['MOP ÚMIDO 190G | MOX', 5, 12.55],
    ['PANO ALVEJADO 100% ALGODÃO 40CM X 65CM', 8, 3.70],
    ['AGUA SANITÁRIA 5L | QMFEL', 6, 8.90],
    ['DETERGENTE NEUTRO/CRISTAL 5L | BRILHA SUL', 5, 16.99],
    ['SACO DE LIXO 40L PRETO FLEX 0.02M/50X60CM C/100UN', 8, 8.95],
    ['SACO DE LIXO 20L PRETO FLEX 0.02M/40X50CM C/100UN', 8, 5.99],
    ['SACO DE LIXO 60L PRETO FLEX 0.02M/60X70CM C/100UN', 8, 12.40],
    ['SACO DE LIXO 100L PRETO LEVE 0.06M / 75X90CM C/100UN', 8, 35.50],
    ['SACO DE LIXO 200L PRETO REFORÇADO 0.08M EP / 100X144CM C/50UN', 2, 52.90],
    ['PANO DE PRATO BRANCO | 44CMX67CM', 9, 3.50],
    ['LUVA "M" BORRACHA/LATEX SILVER CA 44393 | NB', 6, 3.85],
    ['FITA ADESIVA TRANSP. 48MM X 100M | ADELBRAS', 10, 10.40],
    ['SILICONE GEL LAVANDA 200G | JIMO', 4, 9.90],
  ],
  '2421': [
    ['AGUA SANITÁRIA 5L | QMFEL', 2, 8.90],
    ['ODORIZADOR SPRAY CAPIM LIMÃO 350ML | PURO AR', 5, 8.70],
    ['PANO MICROFIBRA 40CMX40CN | PFPRO', 8, 4.00],
    ['FLANELA LARANJA 30CMX40CM', 10, 1.30],
    ['PAPEL HIGIENICO 12 ROLOS 30M NEUTRO | MIMMO', 1, 15.95],
    ['GEL ADESIVO SANITARIO C/APLICADOR C/06 DISCOS | NFRESCOR', 5, 10.50],
    ['PASTILHA P/CAIXA ACOPLADA LAVANDA C/03 UN | NVFRESCOR', 5, 10.50],
    ['PANO ALVEJADO 100% ALGODÃO 40CM X 65CM', 10, 3.65],
    ['ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', 10, 0.69],
    ['SAPONACEO RADIUM CREMOSO CLASSICO 250ML | SAPOLIO', 2, 6.90],
    ['FILTRO 102/30 | BOM JESUS', 1, 3.85],
    ['CAFÉ TRADICIONAL 500G | MELLITA', 5, 29.99],
    ['SACO DE LIXO 40L PRETO FLEX 0.02M/50X60CM C/100UN', 2, 8.95],
    ['SACO DE LIXO 60L PRETO FLEX 0.02M/60X70CM C/100UN', 2, 12.40],
    ['SACO DE LIXO 100L PRETO REFORÇADO 0.08M / 75X90CM C/100UN', 3, 48.90],
    ['MOP ÚMIDO 190G | MOX', 6, 12.50],
    ['RODO 30CM S/ CABO | DLCN', 2, 4.30],
    ['BORRIFADOR TRANSPARENTE 500ML | NB', 2, 4.90],
    ['DESINFETANTE MARINE 5L | GMRÃES', 6, 17.90],
    ['DETERGENTE NEUTRO 5L | GMRÃES', 1, 21.50],
    ['MULTIOX 5L | GMRÃES', 2, 36.50],
    ['PANO DE PRATO BRANCO | 44CMX67CM', 10, 3.50],
    ['COPO TERMICO 100ML C/25UN | MEIWA', 4, 4.25],
    ['COPO DESCARTÁVEL TRANSPARENTE 180ML C/100UN PS | TOTALPLAST', 1, 5.20],
    ['GUARDANAPO DE PAPEL 21X22CM C/50UN | FLORAX', 2, 2.85],
    ['ESPONJA DE AÇO LIMPEZA PESADA (AÇO INOX) MAX | NB', 10, 2.58],
    ['ANTIMOFO FLORAL 80G | SECAR', 4, 4.89],
    ['DESINCRUSTANTE CLEANOX 5L | CLEAN', 2, 59.90],
    ['PANO MULTIUSO 50 PANOS 28CMX25M | LF CLEAN', 4, 11.50],
    ['PAPEL TOALHA INTERFOLHADO UNIQUE ULTRA 24G 23CMX20CM 1000 FLS | MILI', 10, 28.90],
    ['LIMPA ESTOFADOS SUPER DOM 300 ML | DLINE', 5, 14.90],
  ],
  '2422': [
    ['SACO DE LIXO 240L PRETO REFORÇADO 0.08M EP / 120X144CM C/50UN', 3, 54.50],
    ['SACO DE LIXO 100L PRETO LEVE 0.06M / 75X90CM C/100UN', 1, 35.50],
    ['SACO DE LIXO 60L PRETO LEVE 0.06M / 60X70CM C/100UN', 1, 19.80],
    ['SACO DE LIXO 40L PRETO FLEX 0.02M/50X60CM C/100UN', 1, 8.95],
    ['PAPEL TOALHA INTERF. 17,5CMX20CM C/1000FLS F SIMPLES 100% CEL | PSA', 10, 11.55],
    ['PAPEL HIGIENICO FOLHA DUPLA 12X30M NEUTRO | PALOMA', 6, 14.99],
    ['PANO MULTIUSO 50 PANOS 28CMX25M | LF CLEAN', 1, 11.00],
    ['SABÃO EM PÓ 800G | GIRANDO SOL', 1, 6.50],
    ['DESINFETANTE MARINE 5L | GMRÃES', 2, 17.90],
    ['DESINFETANTE CAPIM LIMÃO 5L | GMRÃES', 2, 17.90],
    ['MULTIOX 5L | GMRÃES', 1, 36.50],
    ['ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', 6, 0.69],
    ['MOP ÚMIDO 190G | MOX', 4, 12.50],
    ['PASTILHA ADESIVA C/3UN | SANYMIX', 6, 4.00],
    ['LIMPA VIDROS SPRAY 400 ML | JIMO', 2, 14.50],
    ['REFIL REPELENTE ELETRICO 45 NOITES C/3 32,9ML | RAID', 1, 33.90],
    ['ODORIZADOR SPRAY CAPIM LIMÃO 350ML | PURO AR', 3, 8.70],
    ['COPO DESCARTÁVEL TRANSPARENTE 180ML C/100UN PS | TOTALPLAST', 3, 5.20],
    ['CAFÉ TRADICIONAL 500ML | BOM JESUS', 2, 24.95],
    ['ALCOOL LIQUIDO 70° 1L | FLOPS', 5, 6.25],
    ['VASSOURA MULTIUSO C/CABO 140CM | BTTN', 2, 17.95],
    ['ESCOVA PLASTICA OVAL | DLCN', 2, 2.60],
    ['FIBRA BRANCA SLIM USO LEVE | NB', 10, 1.22],
    ['FIBRA VEGETAL USO GERAL SLIM | NB', 10, 1.30],
    ['DETERGENTE DESENGRAXANTE F200 ESP ALCALINO 5L | CLEAN', 2, 32.60],
  ],
  '2423': [
    ['SACO DE LIXO 240L PRETO REFORÇADO 0.08M EP / 120X144CM C/50UN', 4, 54.50],
    ['SACO DE LIXO 100L PRETO LEVE 0.06M / 75X90CM C/100UN', 2, 35.50],
    ['SACO DE LIXO 40L PRETO FLEX 0.02M/50X60CM C/100UN', 1, 8.95],
    ['PAPEL TOALHA INTERF. 17,5CMX20CM C/1000FLS F SIMPLES 100% CEL | PSA', 15, 11.55],
    ['PAPEL HIGIENICO FOLHA DUPLA 12X30M NEUTRO | PALOMA', 6, 14.99],
    ['PANO MULTIUSO 50 PANOS 28CMX25M | LF CLEAN', 1, 11.00],
    ['SABÃO EM PÓ 800G | GIRANDO SOL', 1, 6.50],
    ['DESINFETANTE MARINE 5L | GMRÃES', 2, 17.90],
    ['DESINFETANTE CAPIM LIMÃO 5L | GMRÃES', 2, 17.90],
    ['MULTIOX 5L | GMRÃES', 3, 36.50],
    ['ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', 15, 0.65],
    ['PASTILHA ADESIVA C/3UN | SANYMIX', 6, 4.00],
    ['ODORIZADOR SPRAY CAPIM LIMÃO 350ML | PURO AR', 4, 8.70],
    ['CAFÉ TRADICIONAL 500ML | BOM JESUS', 1, 24.95],
    ['ALCOOL LIQUIDO 70° 1L | FLOPS', 10, 6.25],
    ['VASSOURA MULTIUSO C/CABO 140CM | BTTN', 2, 17.95],
    ['ESCOVA PLASTICA OVAL | DLCN', 2, 2.60],
    ['AGUA SANITÁRIA 5L | QMFEL', 2, 8.50],
    ['FIBRA BRANCA SLIM USO LEVE | NB', 10, 1.22],
    ['REFIL INSETICIDA ELETRICO 45 NOITES C/2 UN | RAID', 1, 26.75],
    ['DETERGENTE NEUTRO 5L LOUÇASUL | BEJUVA', 2, 13.65],
    ['FIBRA VEGETAL USO GERAL SLIM | NB', 10, 1.30],
    ['SABONETE LIQUIDO DOVE 5L | SUAVETOK', 1, 16.25],
    ['SACO DE LIXO 20L PRETO FLEX 0.02M/40X50CM C/100UN', 1, 5.99],
    ['ALCOOL GEL 70° 5L | SVALE', 1, 37.90],
    ['SAPONACEO CREMOSO FLORAL/LAVANDA/LIMÃO 250ML | SANYMIX', 2, 3.90],
    ['PANO ALVEJADO 100% ALGODÃO 40CM X 65CM', 10, 3.65],
    ['SABÃO EM BARRA COCO/AZUL 180G | G SOL', 2, 2.40],
  ],
  '2428': [
    ['ESCOVA CURVA 40CM P/PISCINAS | NETUNO', 1, 45.00],
    ['GENFLOC CLARIFICANTE 1L | GENCO', 3, 19.90],
    ['CLORO GRANULADO 10KG MULTIPLA AÇÃO 3 X 1 10KG | GENCO', 2, 229.00],
    ['TABLETES MULTIPLA ACAO "3 EM 1" T|200 | GENCO', 25, 9.60],
  ],
  '2444': [
    ['PROTOCOLO DE CORRESPONDENCIA 52 FLS | SD', 15, 9.50],
  ],
}

const CONFIGURACAO: Record<string, { cnpj?: string; total: number }> = {
  '2413': { cnpj: '27.299.453/0001-17', total: 2149.47 },
  '2421': { cnpj: '54.868.938/0001-57', total: 1560.51 },
  '2422': { total: 954.18 },
  '2423': { total: 1162.33 },
  '2428': { total: 802.70 },
  '2444': { total: 142.50 },
}

function montarItemHistorico(
  numero: string,
  descricaoHistorica: string,
  quantidade: number,
  valorUnitario: number,
  indice: number,
  produtos: any[],
): any {
  const produto = localizarProdutoPorDescricao(produtos, descricaoHistorica)
  const codigoBarras = texto(produto?.codigoBarras, produto?.ean, produto?.gtin)
  const codigoProduto = texto(produto?.codigo, produto?.codigoInterno)
  const descricaoAtual = produto ? descricaoProduto(produto) : descricaoHistorica
  const valorTotal = Number((quantidade * valorUnitario).toFixed(2))

  return {
    id: `${numero}-item-${indice + 1}`,
    produtoId: texto(produto?.id),
    codigo: codigoProduto,
    codigoProduto,
    codigoBarras,
    descricao: descricaoAtual,
    descricaoHistorica,
    codigoProdutoHistorico: '',
    unidade: texto(produto?.unidade, produto?.unidadeMedida, 'Unidade'),
    quantidade,
    valorUnitario,
    precoUnitario: valorUnitario,
    desconto: 0,
    descontoValor: 0,
    valorTotal,
    estoqueDisponivel: numeroSeguro(produto?.estoqueAtual ?? produto?.estoque ?? produto?.quantidadeEstoque),
    produtoVinculado: Boolean(produto),
    vinculoProdutoOrigem: produto ? 'DESCRICAO_NORMALIZADA' : 'NAO_VINCULADO',
    ncm: texto(produto?.ncm),
    ncmDescricao: texto(produto?.ncmDescricao),
    cfop: texto(produto?.cfopDentroEstado, produto?.cfop),
    origem: texto(produto?.origem),
    cest: texto(produto?.cest),
    csosn: texto(produto?.csosn),
    cstIcms: texto(produto?.cstIcms),
    cstPis: texto(produto?.cstPis),
    cstCofins: texto(produto?.cstCofins),
  }
}

export function corrigirImportacoes2413e2421PorDescricao(
  vendasEntrada: any[],
  produtosEntrada: any[],
  clientesEntrada: any[],
): { vendas: any[]; clientes: any[] } {
  const vendasOriginais = Array.isArray(vendasEntrada) ? vendasEntrada : []
  const produtos = Array.isArray(produtosEntrada) ? produtosEntrada : []
  let clientes = Array.isArray(clientesEntrada) ? clientesEntrada : []
  let vendas = [...vendasOriginais]

  for (const numero of Object.keys(CONFIGURACAO)) {
    const configuracao = CONFIGURACAO[numero]
    const candidatos = vendas.filter((venda) => numeroVenda(venda) === numero)
    if (!candidatos.length) continue

    const registroMantido = escolherRegistroCorreto(candidatos, configuracao.total)
    vendas = vendas.filter((venda) => numeroVenda(venda) !== numero || venda === registroMantido)

    const listaHistorica = ITENS_HISTORICOS[numero] || []
    const itens = listaHistorica.length
      ? listaHistorica.map(([descricao, quantidade, valorUnitario], indice) =>
          montarItemHistorico(numero, descricao, quantidade, valorUnitario, indice, produtos))
      : (Array.isArray(registroMantido?.itens) ? registroMantido.itens : []).map((item: any) => {
          const descricaoBase = texto(item?.descricaoHistorica, item?.descricao)
          const produto = localizarProdutoPorDescricao(produtos, descricaoBase)
          if (!produto) return item

          const corrigido = {
            ...item,
            produtoId: texto(produto?.id),
            codigoBarras: texto(produto?.codigoBarras, produto?.ean, produto?.gtin),
            codigoProduto: texto(produto?.codigo, produto?.codigoInterno),
            codigo: texto(produto?.codigo, produto?.codigoInterno),
            produtoVinculado: true,
            vinculoProdutoOrigem: 'DESCRICAO_NORMALIZADA',
            ncm: texto(produto?.ncm, item?.ncm),
            cfop: texto(produto?.cfopDentroEstado, produto?.cfop, item?.cfop),
            origem: texto(produto?.origem, item?.origem),
            cest: texto(produto?.cest, item?.cest),
            csosn: texto(produto?.csosn, item?.csosn),
            cstIcms: texto(produto?.cstIcms, item?.cstIcms),
            cstPis: texto(produto?.cstPis, item?.cstPis),
            cstCofins: texto(produto?.cstCofins, item?.cstCofins),
          }
          return igual(corrigido, item) ? item : corrigido
        })

    const baseCorrigida = {
      ...registroMantido,
      itens,
      subtotal: configuracao.total,
      total: configuracao.total,
      totalGeral: configuracao.total,
      totalFinal: configuracao.total,
      valorTotal: configuracao.total,
      valorTotalOrcamento: configuracao.total,
      ...(configuracao.cnpj ? {
        clienteCnpjCpf: configuracao.cnpj,
        clienteDocumento: configuracao.cnpj,
        cnpjCpf: configuracao.cnpj,
        cnpj: configuracao.cnpj,
      } : {}),
      importacaoBloqueada: false,
      importacaoPendente: false,
      importacaoProcessada: true,
      itensEditadosManual: true,
      correcaoImportacaoDescricao: 'SYNERGIAS_CORRECAO_IMPORTACOES_2413_2421_2422_2423_2428_2444_POR_DESCRICAO_V262',
    }

    const registroCorrigido = igual(baseCorrigida, registroMantido)
      ? registroMantido
      : { ...baseCorrigida, atualizadoEm: new Date().toISOString() }

    vendas = vendas.map((venda) => venda === registroMantido ? registroCorrigido : venda)

    const alvo = normalizar(texto(registroCorrigido?.clienteNome, registroCorrigido?.nomeCliente, registroCorrigido?.razaoSocial))
    clientes = clientes.map((cliente) => {
      const nome = normalizar(nomeCliente(cliente))
      const idVenda = texto(registroCorrigido?.clienteId, registroCorrigido?.clienteCodigo)
      const idCliente = texto(cliente?.id, cliente?.codigo)
      const corresponde = (idVenda && idCliente === idVenda) || (alvo && (nome === alvo || nome.includes(alvo) || alvo.includes(nome)))
      if (!corresponde) return cliente

      const clienteCorrigido = {
        ...cliente,
        ...(configuracao.cnpj ? {
          cnpj: configuracao.cnpj,
          cpfCnpj: configuracao.cnpj,
          documento: configuracao.cnpj,
        } : {}),
        consumidorFinal: true,
      }
      return igual(clienteCorrigido, cliente)
        ? cliente
        : { ...clienteCorrigido, atualizadoEm: new Date().toISOString() }
    })
  }

  return { vendas, clientes }
}
