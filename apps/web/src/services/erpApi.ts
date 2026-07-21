import { corrigirImportacoes2413e2421PorDescricao } from './corrigirImportacoes2413e2421PorDescricao'
import { aplicarOrcamento2447NiloDescricao } from './aplicarOrcamento2447NiloDescricao'
import { inserirMadison2371Pedido2434Nfe2334 } from './inserirMadison2371Pedido2434Nfe2334'
// SYNERGIAS_2458_NAO_MESCLAR_CACHE_LOCAL_V220B
import { migrarOrcamento2458RossiCaribeUmaVez } from './migrarOrcamento2458RossiCaribeUmaVez'
import { aplicarOrcamento2462ParisiValidado } from './aplicarOrcamento2462ParisiValidado'
import { aplicarOrcamento2405NiloProdutosCorretos } from './aplicarOrcamento2405NiloProdutosCorretos'
import { garantirOrcamento2398 } from './importarOrcamento2398'
import { garantirOrcamento2429 } from './importarOrcamento2429'
// SYNERGIAS_V292A: rotinas legadas preservadas sem execução automática.
void corrigirImportacoes2413e2421PorDescricao
void aplicarOrcamento2447NiloDescricao
void inserirMadison2371Pedido2434Nfe2334
void migrarOrcamento2458RossiCaribeUmaVez
void aplicarOrcamento2462ParisiValidado
void aplicarOrcamento2405NiloProdutosCorretos
void garantirOrcamento2398
void garantirOrcamento2429

const API_STORAGE_URL = '/api/storage.php'
export type ColecaoCentral = 'clientes' | 'produtos' | 'vendas'

type RespostaColecao<T> = {
  ok: boolean
  collection: ColecaoCentral
  exists: boolean
  data: T[]
  count?: number
  updatedAt?: string | null
  recovered?: boolean
  storage?: string
}

const memoria: Record<ColecaoCentral, unknown[]> = { clientes: [], produtos: [], vendas: [] }
const filas = new Map<ColecaoCentral, Promise<void>>()
export const ERP_STORAGE_UPDATED_EVENT = 'synergias:storage-updated'

function clonar<T>(dados: T[]): T[] {
  return JSON.parse(JSON.stringify(Array.isArray(dados) ? dados : [])) as T[]
}

const SYNERGIAS_CORRIGIR_ENDERECO_PEDIDO_2493_V241 =
  'SYNERGIAS_CORRIGIR_ENDERECO_PEDIDO_2493_V241'

function corrigirEnderecoPedido2493<T>(vendas: T[]): T[] {
  void SYNERGIAS_CORRIGIR_ENDERECO_PEDIDO_2493_V241

  return (Array.isArray(vendas) ? vendas : []).map((registro: any) => {
    const numeroPedido = String(
      registro?.numeroPedido || registro?.numero || '',
    ).replace(/\D/g, '')

    if (numeroPedido !== '2493') return registro

    return {
      ...registro,
      faturamentoCep: '91340-440',
      faturamentoEndereco: 'Alameda Raimundo Corrêa',
      faturamentoNumero: '66',
      faturamentoComplemento: '',
      faturamentoBairro: 'Boa Vista',
      faturamentoCidade: 'Porto Alegre',
      faturamentoEstado: 'RS',
      entregaCep: '91340-440',
      entregaEndereco: 'Alameda Raimundo Corrêa',
      entregaNumero: '66',
      entregaComplemento: '',
      entregaBairro: 'Boa Vista',
      entregaCidade: 'Porto Alegre',
      entregaEstado: 'RS',
    }
  }) as T[]
}

export function obterColecaoMemoria<T>(collection: ColecaoCentral): T[] {
  return memoria[collection] as T[]
}

export function definirColecaoMemoria<T>(collection: ColecaoCentral, data: T[]): T[] {
  const snapshot = clonar(data)
  memoria[collection] = snapshot
  window.dispatchEvent(new CustomEvent(ERP_STORAGE_UPDATED_EVENT, { detail: { collection } }))
  return snapshot
}

async function lerResposta<T>(response: Response): Promise<T> {
  const texto = await response.text()
  let data: any = {}
  try { data = texto ? JSON.parse(texto) : {} }
  catch { throw new Error('A API do ERP retornou uma resposta inválida.') }
  if (!response.ok || data?.ok === false) throw new Error(data?.error || texto || `Erro HTTP ${response.status}`)
  return data as T
}

export async function carregarColecaoCentral<T>(collection: ColecaoCentral): Promise<RespostaColecao<T>> {
  const response = await fetch(`${API_STORAGE_URL}?collection=${encodeURIComponent(collection)}&_=${Date.now()}`, {
    method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin',
  })
  return lerResposta<RespostaColecao<T>>(response)
}

export async function substituirColecaoCentral<T>(collection: ColecaoCentral, data: T[], allowEmpty = false): Promise<void> {
  const snapshot = clonar(data)
  const response = await fetch(`${API_STORAGE_URL}?collection=${encodeURIComponent(collection)}`, {
    method: 'PUT', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify({ data: snapshot, allowEmpty }),
  })
  const confirmacao = await lerResposta<{ ok: boolean; verified?: boolean; count?: number }>(response)
  if (confirmacao.verified !== true || Number(confirmacao.count ?? -1) !== snapshot.length) {
    throw new Error(`O servidor não confirmou integralmente a gravação de ${collection}.`)
  }
}

export function sincronizarColecaoCentral<T>(collection: ColecaoCentral, data: T[]): void {
  const snapshot = definirColecaoMemoria(collection, data)
  if (snapshot.length === 0) return
  const anterior = filas.get(collection) ?? Promise.resolve()
  const atual = anterior.catch(() => undefined).then(() => substituirColecaoCentral(collection, snapshot)).catch((erro) => {
    console.error(`[Synergias ERP] Falha ao sincronizar ${collection}.`, erro)
    window.dispatchEvent(new CustomEvent('synergias:storage-error', { detail: { collection, message: String(erro?.message || erro) } }))
  })
  filas.set(collection, atual)
}

export async function sincronizarColecaoCentralAgora<T>(collection: ColecaoCentral, data: T[], allowEmpty = false): Promise<void> {
  const snapshot = definirColecaoMemoria(collection, data)
  if (snapshot.length === 0 && !allowEmpty) throw new Error(`A gravação vazia de ${collection} foi bloqueada.`)
  const anterior = filas.get(collection) ?? Promise.resolve()
  const atual = anterior.catch(() => undefined).then(() => substituirColecaoCentral(collection, snapshot, allowEmpty))
  filas.set(collection, atual)
  await atual
}

export async function aguardarSincronizacaoCentral(collection?: ColecaoCentral): Promise<void> {
  if (collection) { await (filas.get(collection) ?? Promise.resolve()); return }
  await Promise.all(Array.from(filas.values()))
}




function mesclarVendasPorId(servidor: unknown[], local: unknown[]): unknown[] {
  const mapa = new Map<string, any>()
  ;[...servidor, ...local].forEach((item: any, indice) => {
    const chave = String(item?.id || item?.numeroOrcamento || item?.numeroPedido || `legado-${indice}`)
    const existente = mapa.get(chave)
    if (!existente) {
      mapa.set(chave, item)
      return
    }
    const dataExistente = String(existente?.atualizadoEm || existente?.criadoEm || '')
    const dataNova = String(item?.atualizadoEm || item?.criadoEm || '')
    mapa.set(chave, dataNova >= dataExistente ? item : existente)
  })
  return Array.from(mapa.values())
}



function consolidarOrcamento2483(vendas: any[]): any[] {
  const numeroAlvo = '2483'
  const candidatos = vendas.filter((venda) =>
    String(venda?.numeroOrcamento || venda?.numero || venda?.codigo || '').replace(/\D/g, '') === numeroAlvo,
  )
  if (candidatos.length === 0) return vendas

  const pontuar = (venda: any) => {
    const itens = Array.isArray(venda?.itens) ? venda.itens.length : 0
    const quantidade = Array.isArray(venda?.itens)
      ? venda.itens.reduce((soma: number, item: any) => soma + Number(item?.quantidade || 0), 0)
      : 0
    const total = Number(venda?.totalFinal || venda?.valorFinal || venda?.total || venda?.valorTotal || 0)
    const cliente = String(venda?.clienteNome || venda?.clienteRazaoSocial || venda?.razaoSocial || venda?.nomeCliente || '')
    return (itens * 1000) + (quantidade * 10) + (total > 0 ? 100 : 0) + (cliente ? 50 : 0)
  }

  const escolhido = [...candidatos].sort((a, b) => {
    const diferenca = pontuar(b) - pontuar(a)
    if (diferenca !== 0) return diferenca
    return String(b?.atualizadoEm || b?.criadoEm || '').localeCompare(String(a?.atualizadoEm || a?.criadoEm || ''))
  })[0]

  const idEscolhido = String(escolhido?.id || `orcamento-${numeroAlvo}`)
  const normalizado = {
    ...escolhido,
    id: idEscolhido,
    tipo: 'Orçamento',
    numeroOrcamento: numeroAlvo,
    numeroPedido: String(escolhido?.numeroPedido || ''),
    clienteNome: String(escolhido?.clienteNome || escolhido?.clienteRazaoSocial || escolhido?.razaoSocial || escolhido?.nomeCliente || 'CONDOMINIO RESIDENCIAL BRAVO'),
    statusOrcamento: escolhido?.statusOrcamento || escolhido?.status || 'Aberto',
    atualizadoEm: new Date().toISOString(),
  }

  const semDuplicatas = vendas.filter((venda) =>
    String(venda?.numeroOrcamento || venda?.numero || venda?.codigo || '').replace(/\D/g, '') !== numeroAlvo,
  )
  semDuplicatas.push(normalizado)
  return semDuplicatas
}
void 'SYNERGIAS_ORCAMENTO_2483_VISIVEL_SEM_DUPLICAR_V285'

function garantirOrcamento2425(vendas: unknown[], produtos: unknown[], clientes: unknown[]): unknown[] {
  const existe = vendas.some((venda: any) =>
    String(venda?.numeroOrcamento || '').replace(/\D/g, '') === '2425',
  )
  if (existe) return vendas

  const normalizar = (valor: unknown) =>
    String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const nomeProduto = (produto: any) =>
    String(produto?.descricao || produto?.nome || produto?.nomeProduto || produto?.produto || '').trim()

  const encontrarProduto = (descricao: string) => {
    const alvo = normalizar(descricao)
    const exatos = (Array.isArray(produtos) ? produtos : []).filter(
      (produto: any) => normalizar(nomeProduto(produto)) === alvo,
    )
    if (exatos.length === 1) return exatos[0] as any

    const alvoSemMarca = alvo.split(' | ')[0].trim()
    const equivalentes = (Array.isArray(produtos) ? produtos : []).filter(
      (produto: any) => normalizar(nomeProduto(produto)).split(' | ')[0].trim() === alvoSemMarca,
    )
    return equivalentes.length === 1 ? (equivalentes[0] as any) : undefined
  }

  const cliente = (Array.isArray(clientes) ? clientes : []).find((item: any) => {
    const nome = item?.nomeRazaoSocial || item?.razaoSocial || item?.nomeFantasia || item?.nome || item?.clienteNome || ''
    const chave = normalizar(nome)
    return chave.includes('CONDOMINIO RESIDENCIAL VERTICE') || chave.includes('RESIDENCIAL VERTICE')
  }) as any

  const itensOriginais = [
    ['LAPIS DE COR ECOLAPIS 20 CORES + 4 LAPIS BICOLOR 4B | FABER-CASTEL', 1, 38.30],
    ['CANETA HIDROGRAFICA COLORS 24 CORES | FABER-CASTELL', 1, 32.40],
    ['LAPIS GRAFITE JUMBON°2 HB C/ 3UN | FABER CASTELL', 1, 11.99],
    ['LAPIS PRETO HB Nº 2 EVOLUTION HEXAGONAL BLISTER C/4 UNI | BIC', 1, 4.65],
    ['GIZÃO DE CERA 12 CORES | FABER CASTELL', 1, 10.58],
    ['BORRACHA RECORD 20MM | MERCUR', 1, 1.85],
    ['REGUA 20CM CRISTAL | MAXCRIL', 1, 1.99],
    ['TESOURA ESCOLAR PLUS 13cm CORES SORTIDAS | LEO E LEO', 2, 5.35],
    ['COLA EM BASTAO BRANCA 36g | BRW', 2, 3.99],
    ['BLOCO CRIATIVO COLORIDO A4 8 CORES 75G 50 FLS | BRW', 3, 23.50],
    ['BLOCO DE ANOTACOES ADESIVO 38X51MM C/4 UNI 50 FLS MULTICOR NEON | PIMACO', 1, 6.99],
    ['APONTADOR C/DEPOSITO CORES SORTIDAS PASTEL TREND | LEO E LEO', 1, 1.60],
    ['PAPEL A4 75G C/500 FLS | CHAMEX', 1, 26.90],
  ] as const

  const itens = itensOriginais.map(([descricaoHistorica, quantidade, valorUnitario], indice) => {
    const produto = encontrarProduto(descricaoHistorica)
    const descricaoAtual = produto ? nomeProduto(produto) : descricaoHistorica
    const codigoProduto = String(produto?.codigo || produto?.codigoInterno || produto?.id || '')
    const codigoBarras = String(produto?.codigoBarras || '')
    const produtoId = String(produto?.id || '')
    const unidade = String(produto?.unidade || produto?.unidadeMedida || 'Unidade')

    return {
      id: `2425-item-${indice + 1}`,
      produtoId,
      codigo: codigoProduto,
      codigoProduto,
      codigoBarras,
      descricao: descricaoAtual,
      unidade,
      quantidade,
      valorUnitario,
      desconto: 0,
      descontoValor: 0,
      valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
      estoqueDisponivel: Number(produto?.estoqueAtual || produto?.estoque || produto?.quantidadeEstoque || 0),
      produtoVinculado: Boolean(produto),
      vinculoProdutoOrigem: produto ? 'DESCRICAO_NORMALIZADA' : 'NAO_VINCULADO',
      descricaoHistorica,
      codigoProdutoHistorico: '',
      ncm: produto?.ncm || '',
      cfop: produto?.cfopDentroEstado || '',
      origem: produto?.origem || '',
      cest: produto?.cest || '',
      csosn: produto?.csosn || '',
      cstIcms: produto?.cstIcms || '',
      cstPis: produto?.cstPis || '',
      cstCofins: produto?.cstCofins || '',
    }
  })

  const endereco = 'Avenida Ijuí, 259, E 273\nPetrópolis - Porto Alegre / RS - CEP: 90460-200 - Brasil'
  const agora = new Date().toISOString()
  const restaurado = {
    id: 'orcamento-importado-2425-vertice',
    tipo: 'Orçamento',
    numeroOrcamento: '2425',
    vendedor: 'NATÁLIA VIEIRA',
    clienteId: String(cliente?.id || cliente?.codigo || ''),
    clienteCodigo: String(cliente?.codigo || cliente?.id || ''),
    clienteNome: String(cliente?.nomeRazaoSocial || cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.nome || 'CONDOMINIO RESIDENCIAL VERTICE'),
    clienteDocumento: String(cliente?.cpfCnpj || cliente?.cnpjCpf || cliente?.documento || '46.569.617/0001-00'),
    clienteEmail: String(cliente?.email || ''),
    clienteEmailNotaFiscal: String(cliente?.emailNotaFiscal || cliente?.email || ''),
    clienteTelefone: String(cliente?.telefone || cliente?.celular || ''),
    dataEmissao: '2026-07-06',
    dataValidade: '2026-07-11',
    dataEntrega: '2026-07-08',
    enderecoFaturamento: endereco,
    enderecoEntrega: endereco,
    faturamentoCep: '90460-200',
    faturamentoEndereco: 'Avenida Ijuí',
    faturamentoNumero: '259',
    faturamentoComplemento: 'E 273',
    faturamentoBairro: 'Petrópolis',
    faturamentoCidade: 'Porto Alegre',
    faturamentoEstado: 'RS',
    entregaCep: '90460-200',
    entregaEndereco: 'Avenida Ijuí',
    entregaNumero: '259',
    entregaComplemento: 'E 273',
    entregaBairro: 'Petrópolis',
    entregaCidade: 'Porto Alegre',
    entregaEstado: 'RS',
    itens,
    tipoDesconto: 'valor',
    descontoInformado: 0,
    descontoCalculado: 0,
    descontoValor: 0,
    frete: 0,
    outrosCustos: 0,
    subtotal: 226.43,
    totalFinal: 226.43,
    formaPagamento: 'BOLETO BANCO CORA',
    parcelamento: '1x - 30 dias',
    bancoCobranca: 'Cora',
    tipoCobranca: 'BOLETO BANCO CORA',
    valorPagamento: 226.43,
    pagamentos: [
      {
        id: '2425-pagamento-1',
        formaPagamento: 'BOLETO BANCO CORA',
        prazo: '1x - 30 dias',
        vencimento: '2026-08-05',
        observacoes: '',
        valor: 226.43,
      },
    ],
    parcelas: [
      {
        numero: 1,
        vencimento: '2026-08-05',
        valor: 226.43,
        bancoCobranca: 'Cora',
        tipoCobranca: 'BOLETO BANCO CORA',
        statusBoleto: 'Pendente',
      },
    ],
    observacoes: '',
    statusOrcamento: 'Aberto',
    criadoEm: '2026-07-06T12:00:00.000Z',
    atualizadoEm: agora,
  }

  return [...vendas, restaurado]
}

function garantirOrcamento2454(vendas: unknown[]): unknown[] {
  const existe = vendas.some((venda: any) => String(venda?.numeroOrcamento || '').replace(/\D/g, '') === '2454')
  if (existe) return vendas

  const restaurado = {
    id: 'orcamento-restaurado-2454-san-vicente',
    tipo: 'Orçamento',
    numeroOrcamento: '2454',
    vendedor: 'Natália Vieira',
    clienteId: '',
    clienteNome: 'CONDOMÍNIO SAN VICENTE',
    clienteDocumento: '04.877.670/0001-41',
    clienteEmailNotaFiscal: 'FINANCEIRO@SYNERGIAS.COM.BR',
    dataEmissao: '2026-07-13',
    dataValidade: '2026-07-20',
    dataEntrega: '2026-07-15',
    enderecoFaturamento: 'Rua Doutor Barbosa Gonçalves, 777\nChácara das Pedras - Porto Alegre / RS - CEP: 91330-320 - Brasil',
    enderecoEntrega: 'Rua Doutor Barbosa Gonçalves, 777\nChácara das Pedras - Porto Alegre / RS - CEP: 91330-320 - Brasil',
    itens: [
      { id: '2454-0174', produtoId: '', codigo: '0174', codigoBarras: '0174', descricao: 'CABO EXTENSOR 03 METROS | BTTN', unidade: 'Unidade', quantidade: 1, valorUnitario: 35, desconto: 0, estoqueDisponivel: 0 },
      { id: '2454-0274', produtoId: '', codigo: '0274', codigoBarras: '0274', descricao: 'CHÁ FRUTAS VERMELHAS 13G | BARÃO', unidade: 'Unidade', quantidade: 3, valorUnitario: 5.99, desconto: 0, estoqueDisponivel: 0 },
      { id: '2454-0280', produtoId: '', codigo: '0280', codigoBarras: '0280', descricao: 'CHÁ MAÇA C/ CANELA 13G | BARÃO', unidade: 'Unidade', quantidade: 3, valorUnitario: 5.2, desconto: 0, estoqueDisponivel: 0 },
      { id: '2454-0330', produtoId: '', codigo: '0330', codigoBarras: '0330', descricao: 'COPO DESCARTÁVEL TRANSPARENTE 180ML C/100UN PS | TOTALPLAST', unidade: 'Unidade', quantidade: 25, valorUnitario: 5.19, desconto: 0, estoqueDisponivel: 0 },
    ],
    tipoDesconto: 'valor',
    descontoInformado: 0,
    descontoCalculado: 0,
    frete: 0,
    outrosCustos: 0,
    subtotal: 198.32,
    totalFinal: 198.32,
    pagamentos: [
      { id: '2454-pagamento-1', formaPagamento: 'BOLETO BANCO INTER', prazo: '1x - 30 dias', vencimento: '2026-08-15', observacoes: '', valor: 198.32 },
    ],
    observacoes: 'MÍNIMO DE R$ 120,00 REAIS',
    statusOrcamento: 'Aberto',
    criadoEm: '2026-07-13T15:08:28.000Z',
    atualizadoEm: new Date().toISOString(),
  }

  return [...vendas, restaurado]
}



const ORCAMENTOS_IMPORTADOS_POR_NOME = new Set([
  '2161','2395','2398','2402','2404','2405','2406','2407','2408','2409','2410','2411','2413','2414','2415','2416','2417','2418','2420','2421','2422','2423','2424','2425','2428','2429','2430','2431','2432','2434','2435','2436','2437','2438','2440','2441','2442','2443','2444','2445','2447','2448','2449','2450','2451','2452','2453',
])

function normalizarNomeProduto(valor: unknown): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nomeProdutoCatalogo(produto: any): string {
  return String(produto?.descricao || produto?.nome || produto?.nomeProduto || produto?.produto || '').trim()
}

function chaveNomeSemMarca(valor: unknown): string {
  const nome = normalizarNomeProduto(valor)
  return nome.split(' | ')[0].trim()
}

function localizarProdutoSomentePorNome(descricao: unknown, produtos: any[]): any | undefined {
  const nomeCompleto = normalizarNomeProduto(descricao)
  if (!nomeCompleto) return undefined

  const exatos = produtos.filter((produto) => normalizarNomeProduto(nomeProdutoCatalogo(produto)) === nomeCompleto)
  if (exatos.length === 1) return exatos[0]

  const semMarca = chaveNomeSemMarca(descricao)
  const equivalentes = produtos.filter((produto) => chaveNomeSemMarca(nomeProdutoCatalogo(produto)) === semMarca)
  if (equivalentes.length === 1) return equivalentes[0]

  return undefined
}

function sobreporProdutosDosOrcamentosPorNome(vendas: any[], produtos: any[]): { vendas: any[]; alterados: number } {
  let alterados = 0
  const atualizadas = vendas.map((venda) => {
    const numero = String(venda?.numeroOrcamento || '').replace(/\D/g, '')
    if (venda?.tipo !== 'Orçamento' || !ORCAMENTOS_IMPORTADOS_POR_NOME.has(numero) || !Array.isArray(venda?.itens) || venda?.itensEditadosManual === true) return venda

    let vendaAlterada = false
    const itens = venda.itens.map((item: any) => {
      const descricao = item?.descricao || item?.nome || item?.produtoNome || ''
      const produto = localizarProdutoSomentePorNome(descricao, produtos)
      if (!produto) return item

      const codigoBarras = String(produto?.codigoBarras || produto?.codigo || '')
      const codigoProduto = String(produto?.codigo || produto?.codigoBarras || produto?.id || '')
      const produtoId = String(produto?.id || '')
      const unidade = String(produto?.unidade || produto?.unidadeMedida || item?.unidade || 'Unidade')
      const descricaoAtual = nomeProdutoCatalogo(produto) || String(descricao)

      const corrigido = {
        ...item,
        produtoId,
        codigo: codigoProduto,
        codigoProduto,
        codigoBarras,
        descricao: descricaoAtual,
        unidade,
        produtoVinculado: true,
        vinculoProdutoOrigem: 'DESCRICAO_NORMALIZADA',
        descricaoHistorica: item?.descricaoHistorica || String(descricao),
        codigoProdutoHistorico: item?.codigoProdutoHistorico || String(item?.codigoProduto || item?.codigo || item?.codigoBarras || ''),
      }

      if (JSON.stringify(corrigido) !== JSON.stringify(item)) { vendaAlterada = true; alterados += 1 }
      return corrigido
    })

    return vendaAlterada ? { ...venda, itens, atualizadoEm: new Date().toISOString() } : venda
  })

  return { vendas: atualizadas, alterados }
}

function limparCachePesadoDoNavegador(): void {
  const chaves = [
    'synergias_clientes', 'synergias_produtos',
    'synergias_clientes_historico_seguro', 'synergias_produtos_historico_seguro',
    'synergias_clientes_backup_pre_hidratacao', 'synergias_produtos_backup_pre_hidratacao',
    'synergias_clientes_ultima_lista_valida', 'synergias_produtos_ultima_lista_valida',
  ]
  chaves.forEach((chave) => { try { localStorage.removeItem(chave) } catch {} })
}

export async function hidratarColecaoCentral<T>(
  collection: ColecaoCentral,
  legacyStorageKey?: string,
): Promise<void> {
  const resposta = await carregarColecaoCentral<T>(collection)
  definirColecaoMemoria(collection, Array.isArray(resposta.data) ? resposta.data : [])

  if (legacyStorageKey) {
    try { localStorage.removeItem(legacyStorageKey) } catch {}
  }
}



// SYNERGIAS_V292A: referências intencionais para manter compatibilidade sem execução automática.
void corrigirEnderecoPedido2493
void mesclarVendasPorId
void consolidarOrcamento2483
void garantirOrcamento2425
void garantirOrcamento2454
void sobreporProdutosDosOrcamentosPorNome

export async function inicializarArmazenamentoCentral(): Promise<void> {
  const timeout = new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error('Tempo limite ao carregar dados do servidor.')), 30000))
  const carregar = Promise.all([
    carregarColecaoCentral<unknown>('clientes'),
    carregarColecaoCentral<unknown>('produtos'),
    carregarColecaoCentral<unknown>('vendas'),
  ])
  const [clientes, produtos, vendas] = await Promise.race([carregar, timeout])
  definirColecaoMemoria('clientes', Array.isArray(clientes.data) ? clientes.data : [])
  definirColecaoMemoria('produtos', Array.isArray(produtos.data) ? produtos.data : [])

  const vendasServidor = Array.isArray(vendas.data) ? vendas.data : []
  let vendasLocais: unknown[] = []
  try {
    const bruto = localStorage.getItem('synergias_vendas')
    const lidas = bruto ? JSON.parse(bruto) : []
    vendasLocais = Array.isArray(lidas)
      ? lidas.filter((venda: any) =>
          String(venda?.numeroOrcamento || venda?.numero || venda?.codigo || '').replace(/\D/g, '') !== '2458')
      : []
  } catch {}
  void vendasLocais

  // SYNERGIAS_V292A: a coleção central do MySQL é a única fonte de vendas.
  // Nenhuma importação, reconstrução, mesclagem com cache local ou correção pontual
  // pode regravar a coleção completa durante a abertura do ERP.
  const vendasEstaveis = vendasServidor as any[]
  definirColecaoMemoria('clientes', Array.isArray(clientes.data) ? clientes.data : [])
  definirColecaoMemoria('vendas', vendasEstaveis)

  try { localStorage.removeItem('synergias_vendas') } catch {}
  try { localStorage.removeItem('synergias_clientes') } catch {}

  limparCachePesadoDoNavegador()
}
