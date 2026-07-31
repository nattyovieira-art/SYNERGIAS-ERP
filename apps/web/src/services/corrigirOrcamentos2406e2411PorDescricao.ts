const MARCADOR = 'SYNERGIAS_ORCAMENTOS_2406_2411_DESCRICAO_V312'
const MARCADOR_KARPATHOS_2397 = 'SYNERGIAS_ORCAMENTO_2397_DESCRICAO_PDF_V313'
const MARCADOR_2411 = 'SYNERGIAS_ORCAMENTO_2411_DESCRICAO_PDF_V314'

type ItemCarga = readonly [string, number, number, number?]
type Carga = {
  numero: string
  cliente: string
  documento: string
  email: string
  dataEmissao: string
  dataEntrega: string
  dataValidade: string
  cep: string
  endereco: string
  numeroEndereco: string
  bairro: string
  cidade: string
  estado: string
  total: number
  subtotal?: number
  criarSeAusente?: boolean
  itens: readonly ItemCarga[]
  pagamentos: Array<{ formaPagamento: string; prazo: string; vencimento: string; valor: number; observacoes?: string }>
}

const CARGAS: Carga[] = [
  {
    numero: '2411',
    cliente: 'SISTEMA EDUCACIONAL BOA VISTA - SOCIEDADE SIMPLES LTDA',
    documento: '11233342',
    email: 'financeiro@synergias.com.br',
    dataEmissao: '2026-07-02',
    dataEntrega: '2026-07-04',
    dataValidade: '2026-07-07',
    cep: '91340-430',
    endereco: 'Rua Quatorze de Julho',
    numeroEndereco: '687',
    bairro: 'Boa Vista',
    cidade: 'Porto Alegre',
    estado: 'RS',
    total: 1111.50,
    itens: [
      ['SACO DE LIXO 60L PRETO LEVE 0.06M / 60X70CM C/100UN', 6, 19.50],
      ['SACO DE LIXO 100L PRETO REFORÇADO 0.08M / 75X90CM C/100UN', 6, 46.90],
      ['SACO DE LIXO 40L PRETO FLEX 0.02M/50X60CM C/100UN', 2, 8.95],
      ['ADOÇANTE LIQUIDO SACARINA 100ML | ADOCYL', 6, 4.90],
      ['ESPONJA LÃ DE AÇO C/8UN | 45G | ASSOLAN', 2, 2.30],
      ['DESINCRUSTANTE CLEANOX 5L | CLEAN', 1, 59.90],
      ['VASSOURA DE NYLON FACEIRA S/CABO | DLCN', 6, 7.50],
      ['PÁ DE LIXO PLASTICA JEITOSA C/ CABO 85CM | BTTN', 6, 17.80],
      ['CERA AUTO BRILHO INCOLOR 5L | BLIM', 5, 89.90],
    ],
    pagamentos: [
      { formaPagamento: 'BOLETO BANCO CORA', prazo: '60 DIAS', vencimento: '2026-08-05', valor: 555.75, observacoes: 'Parcela 1/2\nBRINDE BRILHA INOX' },
      { formaPagamento: 'BOLETO BANCO CORA', prazo: '60 DIAS', vencimento: '2026-09-05', valor: 555.75, observacoes: 'Parcela 2/2' },
    ],
  },
  {
    numero: '2406',
    cliente: 'CONDOMÍNIO PIAZZA MAGGIORE',
    documento: '09353478',
    email: 'FINANCEIRO@SYNERGIAS.COM.BR',
    dataEmissao: '2026-07-02',
    dataEntrega: '2026-07-04',
    dataValidade: '2026-07-07',
    cep: '90520-550',
    endereco: 'Rua Atanásio Belmonte',
    numeroEndereco: '71',
    bairro: 'Boa Vista',
    cidade: 'Porto Alegre',
    estado: 'RS',
    total: 611.39,
    itens: [
      ['PAPEL HIGIÊNICO VIP 12 ROLOS 30M FOLHA DUPLA | PERSONAL', 1, 19.89],
      ['LAMPADA LED 15W/90W BRANCA 6500K | OLUX', 20, 6.00],
      ['FIBRA VEGETAL USO GERAL SLIM | NB', 4, 1.30],
      ['FIBRA BRANCA SLIM USO LEVE | NB', 3, 1.22],
      ['PILHA ALCALINA AA LR6 1.5V BLISTER C/4 | ELGIN', 1, 9.90],
      ['PILHA ALCALINA AAA "PALITO" LR03 1.5V BLISTER C/4 82155 ELGIN', 3, 9.60],
      ['SAPONACEO CREMOSO ORIGINAL 250ML | CIF', 1, 11.20],
      ['LUSTRA MOVEIS 200ML | POLWAX', 2, 5.85],
      ['CAFÉ TRADICIONAL 500G | MELLITA', 1, 29.99],
      ['AÇUCAR REFINADA 1K | DA BARRA', 1, 4.29],
      ['LIMPADOR CONC. LAVANDA 120ML| COALA', 2, 12.99],
      ['LIMPADOR CONC. ALGODÃO 120ML| COALA', 2, 12.99],
      ['SACO DE LIXO 240L PRETO RESISTENTE 0.10M / 120X144CM C/50UN', 1, 75.00],
      ['SACO DE LIXO 200L PRETO RESISTENTE 0.10M / 100X144CM C/50UN', 1, 69.40],
      ['PANO MULTIUSO 50 PANOS 28CMX25M | INOVEN', 1, 12.00],
      ['DESINFETANTE FLORAL 5L | GMRÃES', 2, 17.90],
      ['ALCOOL LIQUIDO 70° 5L | FLOPS', 1, 32.90],
      ['AGUA SANITÁRIA 5L | QMFEL', 1, 9.50],
      ['GEL ADESIVO SANITARIO APARELHO + REFIL C/06 DISCOS | PATO', 1, 15.90],
      ['MOP ÚMIDO 190G | MOX', 2, 12.55],
      ['ESPONJA DUPLA FACE S /PELICULA | BTTN', 4, 0.85],
      ['DESINFETANTE LAVANDA 5L | GMRÃES', 2, 17.90],
    ],
    pagamentos: [
      { formaPagamento: 'BOLETO BANCO INTER', prazo: '30 DIAS', vencimento: '2026-08-30', valor: 611.39 },
    ],
  },
  {
    numero: '2448',
    cliente: 'CONDOMINIO APOGEO',
    documento: '10858267',
    email: 'FINANCEIRO@SYNERGIAS.COM.BR',
    dataEmissao: '2026-07-09',
    dataEntrega: '2026-07-11',
    dataValidade: '2026-07-14',
    cep: '91040-220',
    endereco: 'Rua Juruá',
    numeroEndereco: '68',
    bairro: 'Jardim São Pedro',
    cidade: 'Porto Alegre',
    estado: 'RS',
    total: 965.83,
    itens: [
      ['ALCOOL LIQUIDO 70° 1L | FLOPS', 10, 6.25],
      ['LIMPADOR PERFUMADO LIRIO E BAUNILHA C/ALCOOL 5L | GMRÃES', 1, 28.90],
      ['LIMPADOR PERFUMADO JASMIM E ALGAS 5L | GMRÃES', 1, 28.90],
      ['DESINFETANTE MARINE 5L | GMRÃES', 1, 17.90],
      ['PANO DE CHÃO FLANELADO A 42CMX62CM', 15, 5.50],
      ['SACO DE LIXO 20L PRETO FLEX 0.02M/40X50CM C/100UN', 1, 5.99],
      ['SACO DE LIXO 100L PRETO RESISTENTE 0.10M / 75X90CM C/100UN', 1, 60.90],
      ['SACO DE LIXO 200L PRETO RESISTENTE 0.10M / 100X144CM C/50UN', 2, 69.40],
      ['SACO DE LIXO 280L PRETO SUPER RESISTENTE 0.12M / 135X144CM C/50UN', 1, 90.50],
      ['PAPEL HIGIENICO ROLÃO 8CMX300M C/8 ROLOS F SIMPLES 100% CEL | PSA', 1, 50.90],
      ['AGUA SANITÁRIA 5L | QMFEL', 2, 9.50],
      ['LUSTRA MOVÉIS 200ML | PEROBA', 2, 6.15],
      ['LUVA "M" LARANJA REFORÇADA SLIM | VOLK', 10, 8.99],
      ['DETERGENTE NEUTRO 5L | GMRÃES', 2, 21.50],
      ['ODORIZADOR SPRAY PURO AR TALCO 500ML | PURO AR', 2, 9.50],
      ['REFIL ODORIZADOR ELETRICO 250ML | PURO AR', 2, 19.90],
      ['BRILHA INOX SPRAY 250ML | DLINE', 1, 16.50],
      ['SAPONACEO CREMOSO FLORAL/LAVANDA/LIMÃO 250ML | SANYMIX', 2, 3.90],
      ['BOBINA 200 SACOS 30CMX40CM | PETCÃO', 3, 17.90],
      ['ALCOOL GEL 70° 5L | SVALE', 1, 39.90],
      ['VEJA MULTIUSO FLORAL | 500ML', 2, 5.50],
      ['FIBRA VEGETAL USO GERAL SLIM | NB', 6, 1.30],
      ['ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', 6, 0.69],
      ['SACO DE LIXO 60L PRETO REFORÇADO 0.08M / 60X70CM C/100UN', 1, 34.20],
    ],
    pagamentos: [
      { formaPagamento: 'BOLETO BANCO CORA', prazo: '30 DIAS', vencimento: '2026-08-10', valor: 965.83 },
    ],
  },
  {
    numero: '2397',
    cliente: 'CONDOMINIO KARPATHOS LIVING DESING',
    documento: '10767195',
    email: 'FINANCEIRO@SYNERGIAS.COM.BR',
    dataEmissao: '2026-07-02',
    dataEntrega: '2026-07-04',
    dataValidade: '2026-07-07',
    cep: '91360-470',
    endereco: 'Avenida Veríssimo de Amaral',
    numeroEndereco: '580',
    bairro: 'Jardim Europa',
    cidade: 'Porto Alegre',
    estado: 'RS',
    total: 1376.91,
    itens: [
      ['AGUA SANITÁRIA 5L | QMFEL', 2, 9.90],
      ['LIMPADOR PERFUMADO ROMANCE/ORQUIDEA NEGRA 5L | GMRÃES', 3, 28.90],
      ['DETERGENTE NEUTRO/CRISTAL 5L | BRILHA SUL', 1, 16.99],
      ['ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', 10, 0.65],
      ['FIBRA VEGETAL USO GERAL SLIM | NB', 10, 1.30],
      ['PAPEL TOALHA INTERFOLHADO FS 20CMX20CM C/1000FLS 100% CELULOSE | RPEL', 10, 15.50],
      ['MOP ÚMIDO 190G | MOX', 4, 12.55],
      ['SABÃO EM PÓ 800G | APYCE', 2, 4.50],
      ['SACO DE LIXO 130L PRETO REFORÇADO 0.08M EP / 90X100CM C/100UN', 6, 51.70],
      ['SACO DE LIXO 20L PRETO FLEX 0.02M/40X50CM C/100UN', 3, 5.99],
      ['SACO DE LIXO 240L PRETO REFORÇADO 0.08M / 120X144CM C/50UN', 3, 62.50],
      ['SAPONACEO CREMOSO RADIUM CLORO 250ML | SAPOLIO', 4, 6.85],
      ['ESPONJA LÃ DE AÇO C/8UN | 45G | ASSOLAN', 7, 2.30],
      ['MULTIOX 5L | GMRÃES', 3, 36.50],
      ['COPO DESCARTÁVEL TRANSPARENTE 180ML C/100UN PS | TOTALPLAST', 5, 5.20],
      ['DESENGORDURANTE DE LOUÇA DX30 5L | GMRÃES', 3, 34.50],
      ['REFIL ODORIZADOR ELETRICO 250ML | PURO AR', 3, 19.90],
      ['PAPEL HIGIENICO INTERFOLHADO FOLHA DUPLA 8.000 FLS 28G | IPEL', 1, 98.45],
      ['PANO MULTIUSO 50 PANOS 28CMX25M | INOVEN', 1, 12.00],
      ['FLANELA BRANCA 30CMX40CM | DTEX', 15, 1.30],
      ['PAPEL HIGIENICO 12 ROLOS 30M NEUTRO | MIMMO', 2, 15.95],
    ],
    pagamentos: [
      { formaPagamento: 'BOLETO BANCO CORA', prazo: '30 DIAS', vencimento: '2026-07-30', valor: 1376.91 },
    ],
  },
  {
    numero: '2360',
    cliente: 'CONDOMINIO EDIFICIO SOLAR MEDITERRANEO',
    documento: '',
    email: '',
    dataEmissao: '2026-06-18',
    dataEntrega: '2026-06-20',
    dataValidade: '2026-06-23',
    cep: '',
    endereco: '',
    numeroEndereco: '',
    bairro: '',
    cidade: '',
    estado: '',
    subtotal: 2009.67,
    total: 2005.42,
    criarSeAusente: true,
    itens: [
      ['SACO DE LIXO 130L PRETO RESISTENTE 0.10M / 90X100CM C/100UN', 3, 69.90],
      ['SACO DE LIXO 100L PRETO REFORÇADO 0.08M / 75X90CM C/100UN', 6, 48.90],
      ['MOP ÚMIDO 190G | MOX', 4, 12.55],
      ['PANO MULTIUSO 50 PANOS 28CMX25M | INOVEN', 1, 12.00],
      ['BOBINA 200 SACOS 30CMX40CM | PETCÃO', 6, 17.90],
      ['CAFÉ TRADICIONAL 500G | MELLITA', 8, 33.50],
      ['AÇUCAR REFINADA 1K | DA BARRA', 10, 4.68, 4.25],
      ['GEL ADESIVO SANITARIO C/APLICADOR C/06 DISCOS | NFRESCOR', 6, 12.90],
      ['AGUA SANITÁRIA 5L | QMFEL', 7, 9.90],
      ['DETERGENTE ALCALINO CLORADO 5L | PMP', 5, 18.50],
      ['DETERGENTE NEUTRO 5L | GMRÃES', 2, 21.50],
      ['DESINFETANTE FLORAL 5L | GMRÃES', 4, 17.90],
      ['AROMATIZANTE BAMBU 5L | BLIM', 1, 89.00],
      ['AROMATIZANTE MAÇA VERDE ECO 5L | BLIM', 1, 45.90],
      ['PAPEL TOALHA INTERFOLHADO FS 20CMX20CM C/1000FLS 100% CELULOSE | RPEL', 10, 15.50],
      ['ALCOOL LIQUIDO 70° 1L | FLOPS', 20, 6.25],
      ['RODO COMBINADO LIMPA VIDROS C/LUVA 25CM + CABO 70CM | TW', 3, 32.59],
      ['DESENTUPIDOR DE PIA SANFONADO | PLAST', 3, 9.80],
      ['SABÃO EM BARRA GLICERINADO 200G | ZAVASKI', 5, 2.78],
      ['REFIL AUTOMATIC 260ML | GLADE', 1, 33.90],
      ['ODORIZADOR SPRAY PETALAS DE ROSA 350ML | PURO AR', 1, 9.50],
      ['LUVA \'\'G\'\' LATEX VERNIZ SILVER SLIM AMARELA CA | 16312 | VOLK', 10, 6.90],
    ],
    pagamentos: [
      { formaPagamento: 'BOLETO BANCO CORA', prazo: '30 DIAS', vencimento: '2026-07-30', valor: 2005.42 },
    ],
  },
  {
    numero: '2378',
    cliente: 'CONDOMÍNIO SUPREME HIGIENOPOLIS',
    documento: '34.485.068/0001-20',
    email: 'financeiro@synergias.com.br',
    dataEmissao: '2026-06-24',
    dataEntrega: '2026-06-26',
    dataValidade: '2026-06-29',
    cep: '90520-070',
    endereco: 'Travessa Jaguarão',
    numeroEndereco: '62',
    bairro: 'São João',
    cidade: 'Porto Alegre',
    estado: 'RS',
    total: 2031.69,
    criarSeAusente: true,
    itens: [
      ['PANO DE PRATO BRANCO | 44CMX67CM', 10, 3.50],
      ['PANO DE CHÃO FLANELADO A 42CMX62CM', 10, 5.50],
      ['PANO MULTIUSO 50 PANOS 28CMX25M | LF CLEAN', 5, 11.50],
      ['DESINFETANTE LAVANDA 5L | BRILHA SUL', 1, 12.15],
      ['AGUA SANITÁRIA 5L | QMFEL', 2, 7.85],
      ['ALCOOL LIQUIDO 70° 1L | FLOPS', 5, 6.25],
      ['DESINCRUSTANTE ALCALINO CLORADO F200 | 5L', 1, 39.90],
      ['ESPONJA VERDE/AMARELO 100X71X20MM MULTIUSO | BTTN', 8, 0.55],
      ['SABONETE LIQUIDO GLICERINADO 5L ALGODÃO | NB', 1, 24.90],
      ['LIMPADOR CONC. SOFT 120ML | COALA', 2, 12.99],
      ['LIMPADOR CONC. ORQUÍDEA NEGRA 120 ML | COALA', 2, 12.99],
      ['LIMPADOR CONC. JASMIM DO EGITO 120ML | SCAR', 2, 12.99],
      ['LIMPADOR CONC. CHÁ BRANCO 120ML | COALA', 2, 12.99],
      ['LIMPADOR CONC. TALCO 120ML | COALA', 2, 12.99],
      ['ODORIZADOR AQUAMARINE 400ML | AR AGRADÁVEL', 4, 8.99],
      ['PASTILHA ADESIVA C/03 UN | PATO', 8, 8.50],
      ['SACO DE LIXO 20L PRETO FLEX 0.02M/40X50CM C/100UN', 3, 5.99],
      ['SACO DE LIXO 60L PRETO FLEX 0.02M/60X70CM C/100UN', 3, 12.40],
      ['SACO DE LIXO 100L PRETO REFORÇADO 0.08M / 75X90CM C/100UN', 3, 43.90],
      ['PAPEL TOALHA INTERFOLHADO FOLHA DUPLA 22,5X20CM C/ 2000UN | IPEL', 5, 89.90],
      ['FIBRA VEGETAL USO GERAL SLIM | NB', 6, 1.30],
      ['BORRIFADOR TRANSPARENTE 500ML | NB', 4, 4.90],
      ['LIMPA VIDROS SPRAY 400 ML | JIMO', 2, 14.50],
      ['APARELHO REPELENTE ELÉTRICO 45 NOITES + REFIL 35ML | RAID', 4, 18.50],
      ['CAFÉ TRADICIONAL 500G | MELLITA', 4, 29.99],
      ['AÇUCAR REFINADO 1K | ALTO ALEGRE', 2, 4.65],
      ['FITA ADESIVA TRANSP. 48MM X 100M | ADELBRAS', 3, 10.40],
      ['PINCEL MARCADOR ATOMICO PRETO 1.100P | PILOT', 2, 5.70],
      ['PINCEL MARCADOR ATOMICO VERMELHO | PILOT', 2, 5.70],
      ['PINCEL MARCADOR ATOMICO AZUL | PILOT', 1, 5.70],
      ['SACO DE LIXO 240L PRETO SUPER RESISTENTE 0.12M / 120X144CM C/50UN', 6, 89.90],
      ['PAPEL A4 75G C/500 FLS | CHAMEX', 1, 26.90],
    ],
    pagamentos: [
      { formaPagamento: 'BOLETO BANCO CORA', prazo: '30 DIAS', vencimento: '2026-07-25', valor: 2031.69 },
    ],
  },
]

function normalizar(valor: unknown) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\b(GUIMARAES|GMRAES)\b/g, 'GMRAES')
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}
function descricao(produto: any) {
  return String(produto?.descricao || produto?.nome || produto?.nomeProduto || '').trim()
}
function montarItens(carga: Carga, produtos: any[]) {
  return carga.itens.map(([descricaoPdf, quantidade, valorUnitario, descontoItem = 0], indice) => {
    const encontrados = produtos.filter((produto) => normalizar(descricao(produto)) === normalizar(descricaoPdf))
    if (encontrados.length !== 1) {
      throw new Error(`Orçamento ${carga.numero} bloqueado: "${descricaoPdf}" retornou ${encontrados.length} produtos pela descrição.`)
    }
    const produto = encontrados[0]
    const codigo = String(produto?.codigo || produto?.codigoInterno || produto?.id || '')
    const custoUnitario = Number(produto?.custoMedioAtual || produto?.custo || 0)
    return {
      id: `${carga.numero}-descricao-${indice + 1}`,
      produtoId: String(produto?.id || ''),
      codigo,
      codigoProduto: codigo,
      codigoBarras: String(produto?.codigoBarras || ''),
      descricao: descricao(produto),
      descricaoHistorica: descricaoPdf,
      unidade: String(produto?.unidade || produto?.unidadeMedida || 'Unidade'),
      quantidade,
      valorUnitario,
      precoUnitario: valorUnitario,
      desconto: descontoItem,
      descontoValor: descontoItem,
      descontoPercentual: 0,
      valorTotal: Number((quantidade * valorUnitario - descontoItem).toFixed(2)),
      custoUnitario,
      custoTotal: Number((quantidade * custoUnitario).toFixed(2)),
      produtoVinculado: true,
      vinculoProdutoOrigem: 'DESCRICAO_EXATA',
    }
  })
}

export async function corrigirOrcamentos2406e2411PorDescricao(
  vendasEntrada: any[],
  produtosEntrada: any[],
  clientesEntrada: any[],
  atualizar: (colecao: 'vendas', registro: any) => Promise<unknown>,
  recarregar: <T>(colecao: 'vendas') => Promise<{ data: T[] }>,
) {
  let vendas = Array.isArray(vendasEntrada) ? vendasEntrada : []
  const produtos = Array.isArray(produtosEntrada) ? produtosEntrada : []
  const clientes = Array.isArray(clientesEntrada) ? clientesEntrada : []
  for (const carga of CARGAS) {
    const marcadorCarga = carga.numero === '2397'
      ? MARCADOR_KARPATHOS_2397
      : carga.numero === '2411'
        ? MARCADOR_2411
        : `${MARCADOR}_${carga.numero}`
    const candidatos = vendas.filter((venda) =>
      normalizar(venda?.tipo).includes('ORCAMENTO') &&
      String(venda?.numeroOrcamento || venda?.numero || '').replace(/\D/g, '') === carga.numero)
    if (candidatos.length > 1 || (candidatos.length === 0 && !carga.criarSeAusente)) {
      console.warn(`[V312] Orçamento ${carga.numero} não alterado: encontrados ${candidatos.length} registros.`)
      continue
    }
    const atual = candidatos[0] || {}
    const clientesCarga = clientes.filter((cliente) =>
      normalizar(cliente?.razaoSocial || cliente?.nomeRazaoSocial || cliente?.nomeFantasia || cliente?.nome) === normalizar(carga.cliente))
    const clienteCadastro = clientesCarga.length === 1 ? clientesCarga[0] : undefined
    if (!candidatos.length && !clienteCadastro) {
      throw new Error(`Orçamento ${carga.numero} bloqueado: cliente não localizado de forma única.`)
    }
    if (atual?.marcadorCorrecao === marcadorCarga) continue
    const itens = montarItens(carga, produtos)
    const total = Number(itens.reduce((soma, item) => soma + item.valorTotal, 0).toFixed(2))
    if (total !== carga.total) throw new Error(`Orçamento ${carga.numero}: total ${total} diverge de ${carga.total}.`)
    const agora = new Date().toISOString()
    const cep = carga.cep || clienteCadastro?.cepEntrega || clienteCadastro?.cep || ''
    const endereco = carga.endereco || clienteCadastro?.enderecoEntrega || clienteCadastro?.endereco || ''
    const numeroEndereco = carga.numeroEndereco || clienteCadastro?.numeroEntrega || clienteCadastro?.numero || ''
    const bairro = carga.bairro || clienteCadastro?.bairroEntrega || clienteCadastro?.bairro || ''
    const cidade = carga.cidade || clienteCadastro?.cidadeEntrega || clienteCadastro?.cidade || ''
    const estado = carga.estado || clienteCadastro?.estadoEntrega || clienteCadastro?.estado || ''
    const enderecoCompleto = [[endereco, numeroEndereco].filter(Boolean).join(', '), [bairro, cidade, estado].filter(Boolean).join(' - '), cep ? `CEP: ${cep}` : ''].filter(Boolean).join('\n')
    const registro = {
      ...atual,
      id: String(atual.id || `orcamento-historico-${carga.numero}`),
      tipo: 'Orçamento',
      numeroOrcamento: carga.numero,
      vendedor: atual.vendedor || 'NATÁLIA VIEIRA',
      clienteId: String(atual.clienteId || clienteCadastro?.id || clienteCadastro?.codigo || ''),
      clienteCodigo: String(atual.clienteCodigo || clienteCadastro?.codigo || clienteCadastro?.id || ''),
      clienteNome: carga.cliente,
      clienteDocumento: atual.clienteDocumento || carga.documento || clienteCadastro?.cnpj || clienteCadastro?.cpf || '',
      clienteEmailNotaFiscal: carga.email || clienteCadastro?.emailNotaFiscal || clienteCadastro?.email || '',
      emailEnvio: carga.email || clienteCadastro?.emailNotaFiscal || clienteCadastro?.email || '',
      dataEmissao: carga.dataEmissao,
      dataEntrega: carga.dataEntrega,
      dataValidade: carga.dataValidade,
      enderecoFaturamento: enderecoCompleto,
      enderecoEntrega: enderecoCompleto,
      faturamentoCep: cep,
      faturamentoEndereco: endereco,
      faturamentoNumero: numeroEndereco,
      faturamentoBairro: bairro,
      faturamentoCidade: cidade,
      faturamentoEstado: estado,
      entregaCep: cep,
      entregaEndereco: endereco,
      entregaNumero: numeroEndereco,
      entregaBairro: bairro,
      entregaCidade: cidade,
      entregaEstado: estado,
      itens,
      itensEditadosManual: true,
      subtotal: carga.subtotal || total,
      descontoValor: 0,
      frete: 0,
      outrosCustos: 0,
      totalFinal: total,
      valorTotal: total,
      pagamentos: carga.pagamentos.map((pagamento, indice) => ({
        id: `${carga.numero}-pagamento-${indice + 1}`,
        ...pagamento,
        observacoes: pagamento.observacoes || '',
      })),
      marcadorCorrecao: marcadorCarga,
      atualizadoEm: agora,
    }
    await atualizar('vendas', registro)
    const resposta = await recarregar<any>('vendas')
    vendas = Array.isArray(resposta.data) ? resposta.data : vendas
  }
  return vendas
}
