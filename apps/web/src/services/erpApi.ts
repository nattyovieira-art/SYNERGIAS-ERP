import { corrigirOrcamento2492LifeSquare } from './corrigirOrcamento2492LifeSquare'
import { corrigirOrcamento2151Pedido2453PorDescricao } from './corrigirOrcamento2151Pedido2453PorDescricao'
import { criarOrcamentoOttoClub } from './criarOrcamentoOttoClub'
import { criarOrcamentosJoy } from './criarOrcamentosJoy'
import { inserirOrcamento2380Pedido2458Nfe2358 } from './inserirOrcamento2380Pedido2458Nfe2358'
import { inserirOrcamento2355Pedido2428Nfe2325 } from './inserirOrcamento2355Pedido2428Nfe2325'
import { inserirOrcamento2396Vitoria } from './inserirOrcamento2396Vitoria'
import { corrigirOrcamentos2406e2411PorDescricao } from './corrigirOrcamentos2406e2411PorDescricao'
import { corrigirPedido2508StatusBoleto } from './corrigirPedido2508StatusBoleto'
import { aplicarTodosOrcamentosDescricao } from './aplicarTodosOrcamentosDescricao'
import { aplicarOrcamentosGrandParkUmaVez } from './aplicarOrcamentosGrandPark'
import { aplicarOrcamento2439PontalUmaVez } from './aplicarOrcamento2439Pontal'
import { corrigirImportacoes2413e2421PorDescricao } from './corrigirImportacoes2413e2421PorDescricao'
import { aplicarOrcamento2447NiloDescricao } from './aplicarOrcamento2447NiloDescricao'
import { inserirMadison2371Pedido2434Nfe2334 } from './inserirMadison2371Pedido2434Nfe2334'
// SYNERGIAS_2458_NAO_MESCLAR_CACHE_LOCAL_V220B
import { migrarOrcamento2458RossiCaribeUmaVez } from './migrarOrcamento2458RossiCaribeUmaVez'
import { aplicarOrcamento2462ParisiValidado } from './aplicarOrcamento2462ParisiValidado'
import { aplicarOrcamento2405NiloProdutosCorretos } from './aplicarOrcamento2405NiloProdutosCorretos'
import { sincronizarFinanceiroComOperacoes } from './sincronizarFinanceiro'
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
export type ColecaoCentral = 'clientes' | 'produtos' | 'vendas' | 'compras' | 'movimentacoesEstoque'

type RespostaColecao<T> = {
  ok: boolean
  collection: ColecaoCentral
  exists: boolean
  data: T[]
  count?: number
  hash?: string
  updatedAt?: string | null
  recovered?: boolean
  storage?: string
}

const memoria: Record<ColecaoCentral, unknown[]> = {
  clientes: [],
  produtos: [],
  vendas: [],
  compras: [],
  movimentacoesEstoque: [],
}
const filas = new Map<ColecaoCentral, Promise<void>>()
const filasRegistros = new Map<ColecaoCentral, Promise<unknown>>()
const leiturasEmAndamento = new Map<ColecaoCentral, Promise<RespostaColecao<unknown>>>()
const versoesCentrais = new Map<ColecaoCentral, { hash: string; updatedAt: string }>()
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
  const existente = leiturasEmAndamento.get(collection)
  if (existente) return existente as Promise<RespostaColecao<T>>

  const leitura = (async () => {
    const response = await fetch(`${API_STORAGE_URL}?collection=${encodeURIComponent(collection)}&_=${Date.now()}`, {
      method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin',
    })
    const resposta = await lerResposta<RespostaColecao<unknown>>(response)
    versoesCentrais.set(collection, {
      hash: String(resposta.hash || ''),
      updatedAt: String(resposta.updatedAt || ''),
    })
    return resposta
  })()
  leiturasEmAndamento.set(collection, leitura)
  try {
    return await leitura as RespostaColecao<T>
  } finally {
    if (leiturasEmAndamento.get(collection) === leitura) leiturasEmAndamento.delete(collection)
  }
}

export async function substituirColecaoCentral<T>(collection: ColecaoCentral, data: T[], allowEmpty = false): Promise<void> {
  const snapshot = clonar(data)
  const versaoEsperada = versoesCentrais.get(collection)
  const response = await fetch(`${API_STORAGE_URL}?collection=${encodeURIComponent(collection)}`, {
    method: 'PUT', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify({
      data: snapshot,
      allowEmpty,
      expectedHash: versaoEsperada?.hash || '',
      expectedUpdatedAt: versaoEsperada?.updatedAt || '',
    }),
  })
  const confirmacao = await lerResposta<{ ok: boolean; verified?: boolean; count?: number; hash?: string; updatedAt?: string }>(response)
  if (confirmacao.verified !== true || Number(confirmacao.count ?? -1) !== snapshot.length) {
    throw new Error(`O servidor não confirmou integralmente a gravação de ${collection}.`)
  }
  versoesCentrais.set(collection, {
    hash: String(confirmacao.hash || ''),
    updatedAt: String(confirmacao.updatedAt || ''),
  })
}

export async function atualizarRegistroColecaoCentral<T extends { id?: unknown }>(
  collection: ColecaoCentral,
  record: T,
  expectedRecord?: T,
): Promise<{ record: T; count: number }> {
  const anterior = filasRegistros.get(collection) ?? Promise.resolve()
  const atual = anterior.catch(() => undefined).then(async () => {
    const versaoEsperada = versoesCentrais.get(collection)
    const response = await fetch(`${API_STORAGE_URL}?collection=${encodeURIComponent(collection)}`, {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        record,
        expectedRecord: expectedRecord || null,
        expectedHash: versaoEsperada?.hash || '',
        expectedUpdatedAt: versaoEsperada?.updatedAt || '',
      }),
    })
    const confirmacao = await lerResposta<{
      ok: boolean
      verified?: boolean
      record?: T
      count?: number
      hash?: string
      updatedAt?: string
    }>(response)
    if (confirmacao.verified !== true || !confirmacao.record) {
      throw new Error(`O servidor não confirmou a atualização unitária de ${collection}.`)
    }
    versoesCentrais.set(collection, {
      hash: String(confirmacao.hash || ''),
      updatedAt: String(confirmacao.updatedAt || ''),
    })
    return { record: confirmacao.record, count: Number(confirmacao.count || 0) }
  })
  filasRegistros.set(collection, atual)
  try {
    return await atual
  } finally {
    if (filasRegistros.get(collection) === atual) filasRegistros.delete(collection)
  }
}

export async function excluirRegistroColecaoCentral(
  collection: ColecaoCentral,
  id: string,
): Promise<{ count: number }> {
  const versaoEsperada = versoesCentrais.get(collection)
  const response = await fetch(`${API_STORAGE_URL}?collection=${encodeURIComponent(collection)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      id,
      expectedHash: versaoEsperada?.hash || '',
      expectedUpdatedAt: versaoEsperada?.updatedAt || '',
    }),
  })
  const confirmacao = await lerResposta<{
    ok: boolean
    verified?: boolean
    count?: number
    hash?: string
    updatedAt?: string
  }>(response)
  if (confirmacao.verified !== true) {
    throw new Error(`O servidor não confirmou a exclusão em ${collection}.`)
  }
  versoesCentrais.set(collection, {
    hash: String(confirmacao.hash || ''),
    updatedAt: String(confirmacao.updatedAt || ''),
  })
  return { count: Number(confirmacao.count || 0) }
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

const MARCADOR_ORCAMENTO_SUPREME = 'SYNERGIAS_ORCAMENTO_SUPREME_20260721'

function normalizarBuscaSupreme(valor: unknown): string {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function somarDiasUteisSupreme(dataIso: string, dias: number): string {
  const data = new Date(`${dataIso}T12:00:00`)
  let adicionados = 0
  while (adicionados < dias) {
    data.setDate(data.getDate() + 1)
    const dia = data.getDay()
    if (dia !== 0 && dia !== 6) adicionados += 1
  }
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

async function criarOrcamentoSupremeUmaVez(vendas: any[], produtos: any[], clientes: any[]): Promise<any[]> {
  if (vendas.some((venda) => venda?.marcadorInstalacao === MARCADOR_ORCAMENTO_SUPREME)) return vendas

  const clientesEncontrados = clientes.filter((cliente) => {
    const codigo = String(cliente?.codigo || cliente?.id || cliente?.codigoSistema || '').replace(/\D/g, '')
    const nome = normalizarBuscaSupreme(cliente?.nomeRazaoSocial || cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.nome)
    return codigo === '0233' && nome.includes('SUPREME ALTOS DO CENTRAL PARQUE')
  })
  if (clientesEncontrados.length !== 1) throw new Error(`Orçamento Supreme bloqueado: cliente 0233 retornou ${clientesEncontrados.length} correspondências.`)
  const cliente = clientesEncontrados[0]

  const especificacoes = [
    ['7901211040', 12], ['7901211063', 20], ['7901211283', 10], ['7901211328', 2],
    ['7901210926', 10], ['7901211317', 1], ['7901210368', 2], ['7901210028', 2],
    ['7901211252', 2], ['7901210349', 1], ['7901210037', 2], ['7901210414', 4],
    ['7901210529', 20], ['7901210989', 20], ['7901210552', 10], ['7901210945', 2],
    ['7901210546', 10], ['7901210137', 12], ['7901210980', 20], ['7901210993', 10],
    ['7901210265', 2], ['7901211351', 6], ['7901210730', 10], ['7901210756', 4],
    ['7901210616', 2], ['7901210973', 2], ['7901210960', 5],
  ] as const

  const itens = especificacoes.map(([codigoBarras, quantidade], indice) => {
    const encontrados = produtos.filter((produto) => String(produto?.codigoBarras || '').replace(/\D/g, '') === codigoBarras)
    if (encontrados.length !== 1) throw new Error(`Orçamento Supreme bloqueado: código de barras ${codigoBarras} retornou ${encontrados.length} produtos.`)
    const produto = encontrados[0]
    if (!normalizarBuscaSupreme(produto?.situacao || produto?.status).includes('ATIVO')) throw new Error(`Orçamento Supreme bloqueado: produto ${codigoBarras} não está ativo.`)
    const valorUnitario = Number(produto?.vendaVarejo || produto?.precoVenda || produto?.valorVenda || 0)
    if (!(valorUnitario > 0)) throw new Error(`Orçamento Supreme bloqueado: produto ${codigoBarras} está sem preço de venda.`)
    const custoUnitario = Number(produto?.custoMedioAtual || produto?.custo || produto?.ultimoCustoCompra || 0)
    const codigoProduto = String(produto?.codigo || produto?.codigoInterno || produto?.id || '')
    return {
      id: `supreme-item-${indice + 1}-${Date.now()}`,
      produtoId: String(produto?.id || ''), codigo: codigoProduto, codigoProduto, codigoBarras,
      descricao: String(produto?.descricao || produto?.nome || ''), unidade: String(produto?.unidade || produto?.unidadeMedida || 'Unidade'),
      quantidade, valorUnitario, desconto: 0, descontoValor: 0, descontoPercentual: 0,
      valorTotal: Number((quantidade * valorUnitario).toFixed(2)), custoUnitario,
      custoTotal: Number((quantidade * custoUnitario).toFixed(2)),
      estoqueDisponivel: Number(produto?.estoqueAtual || produto?.estoque || produto?.quantidadeEstoque || 0),
      produtoVinculado: true, vinculoProdutoOrigem: 'CODIGO_BARRAS_EXATO',
    }
  })

  const ids = vendas.map((venda) => String(venda?.id || '')).filter(Boolean)
  if (new Set(ids).size !== ids.length) throw new Error('Orçamento Supreme bloqueado: existem IDs duplicados na coleção vendas.')
  const numeros = vendas.filter((venda) => normalizarBuscaSupreme(venda?.tipo).includes('ORCAMENTO')).map((venda) => Number(String(venda?.numeroOrcamento || '').replace(/\D/g, ''))).filter(Number.isFinite)
  const numeroOrcamento = String((numeros.length ? Math.max(...numeros) : 0) + 1)
  if (vendas.some((venda) => String(venda?.numeroOrcamento || '').replace(/\D/g, '') === numeroOrcamento)) throw new Error(`Orçamento Supreme bloqueado: número ${numeroOrcamento} já existe.`)

  const hoje = new Date()
  const dataEmissao = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const subtotal = Number(itens.reduce((soma, item) => soma + item.valorTotal, 0).toFixed(2))
  const custoTotal = Number(itens.reduce((soma, item) => soma + item.custoTotal, 0).toFixed(2))
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `orcamento-supreme-${Date.now()}`
  const endereco = [cliente?.endereco, cliente?.numero].filter(Boolean).join(', ')
  const agora = new Date().toISOString()
  const orcamento = {
    id, tipo: 'Orçamento', numeroOrcamento, vendedor: 'Natália Vieira',
    clienteId: String(cliente?.id || cliente?.codigo || ''), clienteCodigo: String(cliente?.codigo || cliente?.id || ''),
    clienteNome: String(cliente?.nomeRazaoSocial || cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.nome || ''),
    clienteDocumento: String(cliente?.cnpj || cliente?.documento || ''), clienteEmailNotaFiscal: String(cliente?.emailNotaFiscal || cliente?.email || ''),
    clienteInscricaoEstadual: String(cliente?.inscricaoEstadual || cliente?.ie || ''),
    dataEmissao, dataEntrega: somarDiasUteisSupreme(dataEmissao, 2), dataValidade: somarDiasUteisSupreme(dataEmissao, 5),
    enderecoFaturamento: endereco, enderecoEntrega: String(cliente?.enderecoEntrega || endereco),
    itens, itensEditadosManual: true, tipoDesconto: 'valor', descontoInformado: 0, descontoCalculado: 0,
    descontoValor: 0, frete: 0, outrosCustos: 0, subtotal, totalFinal: subtotal, valorTotal: subtotal,
    custoTotal, margemValor: Number((subtotal - custoTotal).toFixed(2)), pagamentos: [], parcelas: [], observacoes: '',
    status: 'ABERTO', statusOrcamento: 'Aberto', criadoEm: agora, atualizadoEm: agora, marcadorInstalacao: MARCADOR_ORCAMENTO_SUPREME,
  }

  await atualizarRegistroColecaoCentral('vendas', orcamento)
  const confirmacao = await carregarColecaoCentral<any>('vendas')
  const atualizadas = Array.isArray(confirmacao.data) ? confirmacao.data : []
  const gravado = atualizadas.find((venda) => String(venda?.id) === id && String(venda?.numeroOrcamento) === numeroOrcamento)
  if (!gravado || !Array.isArray(gravado.itens) || gravado.itens.length !== 27 || Number(gravado.totalFinal) !== subtotal) throw new Error('O MySQL não confirmou integralmente o orçamento Supreme.')
  console.info('[Synergias ERP] Orçamento Supreme criado e validado.', { id, numeroOrcamento, subtotal })
  return atualizadas
}

async function criarOrcamentoSistemaUmaVez(vendas: any[], produtos: any[], clientes: any[]): Promise<any[]> {
  const marcador = 'SYNERGIAS_ORCAMENTO_SISTEMA_20260721'
  if (vendas.some((venda) => venda?.marcadorInstalacao === marcador)) return vendas
  const encontradosCliente = clientes.filter((cliente) => {
    const codigo = String(cliente?.codigo || cliente?.id || cliente?.codigoSistema || '').replace(/\D/g, '')
    const nome = normalizarBuscaSupreme(cliente?.nomeRazaoSocial || cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.nome)
    return codigo === '0231' && nome.includes('SISTEMA EDUCACIONAL BOA VISTA')
  })
  if (encontradosCliente.length !== 1) throw new Error(`Orçamento Sistema bloqueado: cliente 0231 retornou ${encontradosCliente.length} correspondências.`)
  const cliente = encontradosCliente[0]
  const especificacoes = [
    ['7901210028', 6], ['7901210038', 3], ['7901210405', 20], ['7901210381', 2], ['7901210339', 2],
    ['7901210524', 4], ['7901211354', 8], ['7901210529', 40], ['7901211200', 4], ['7901210006', 10],
  ] as const
  const itens = especificacoes.map(([codigoBarras, quantidade], indice) => {
    const encontrados = produtos.filter((produto) => String(produto?.codigoBarras || '').replace(/\D/g, '') === codigoBarras)
    if (encontrados.length !== 1) throw new Error(`Orçamento Sistema bloqueado: código ${codigoBarras} retornou ${encontrados.length} produtos.`)
    const produto = encontrados[0]
    if (!normalizarBuscaSupreme(produto?.situacao || produto?.status).includes('ATIVO')) throw new Error(`Orçamento Sistema bloqueado: produto ${codigoBarras} não está ativo.`)
    const valorUnitario = Number(produto?.vendaVarejo || produto?.precoVenda || produto?.valorVenda || 0)
    if (!(valorUnitario > 0)) throw new Error(`Orçamento Sistema bloqueado: produto ${codigoBarras} está sem preço.`)
    const custoUnitario = Number(produto?.custoMedioAtual || produto?.custo || produto?.ultimoCustoCompra || 0)
    const codigoProduto = String(produto?.codigo || produto?.codigoInterno || produto?.id || '')
    return {
      id: `sistema-item-${indice + 1}-${Date.now()}`, produtoId: String(produto?.id || ''), codigo: codigoProduto,
      codigoProduto, codigoBarras, descricao: String(produto?.descricao || produto?.nome || ''),
      unidade: String(produto?.unidade || produto?.unidadeMedida || 'Unidade'), quantidade, valorUnitario,
      desconto: 0, descontoValor: 0, descontoPercentual: 0, valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
      custoUnitario, custoTotal: Number((quantidade * custoUnitario).toFixed(2)),
      estoqueDisponivel: Number(produto?.estoqueAtual || produto?.estoque || produto?.quantidadeEstoque || 0),
      produtoVinculado: true, vinculoProdutoOrigem: 'CODIGO_BARRAS_EXATO',
    }
  })
  const ids = vendas.map((venda) => String(venda?.id || '')).filter(Boolean)
  if (new Set(ids).size !== ids.length) throw new Error('Orçamento Sistema bloqueado: existem IDs duplicados em vendas.')
  const numeros = vendas.filter((venda) => normalizarBuscaSupreme(venda?.tipo).includes('ORCAMENTO')).map((venda) => Number(String(venda?.numeroOrcamento || '').replace(/\D/g, ''))).filter(Number.isFinite)
  const numeroOrcamento = String((numeros.length ? Math.max(...numeros) : 0) + 1)
  const hoje = new Date()
  const dataEmissao = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const subtotal = Number(itens.reduce((soma, item) => soma + item.valorTotal, 0).toFixed(2))
  const custoTotal = Number(itens.reduce((soma, item) => soma + item.custoTotal, 0).toFixed(2))
  if (subtotal !== 665.98) throw new Error(`Orçamento Sistema bloqueado: total atual ${subtotal} diverge de 665,98.`)
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `orcamento-sistema-${Date.now()}`
  const endereco = [cliente?.endereco, cliente?.numero].filter(Boolean).join(', ')
  const agora = new Date().toISOString()
  const orcamento = {
    id, tipo: 'Orçamento', numeroOrcamento, vendedor: 'Natália Vieira',
    clienteId: String(cliente?.id || cliente?.codigo || ''), clienteCodigo: String(cliente?.codigo || cliente?.id || ''),
    clienteNome: String(cliente?.nomeRazaoSocial || cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.nome || ''),
    clienteDocumento: String(cliente?.cnpj || cliente?.documento || ''), clienteEmailNotaFiscal: String(cliente?.emailNotaFiscal || cliente?.email || ''),
    clienteInscricaoEstadual: String(cliente?.inscricaoEstadual || cliente?.ie || ''), dataEmissao,
    dataEntrega: somarDiasUteisSupreme(dataEmissao, 2), dataValidade: somarDiasUteisSupreme(dataEmissao, 5),
    enderecoFaturamento: endereco, enderecoEntrega: String(cliente?.enderecoEntrega || endereco), itens, itensEditadosManual: true,
    tipoDesconto: 'valor', descontoInformado: 0, descontoCalculado: 0, descontoValor: 0, frete: 0, outrosCustos: 0,
    subtotal, totalFinal: subtotal, valorTotal: subtotal, custoTotal, margemValor: Number((subtotal - custoTotal).toFixed(2)),
    pagamentos: [], parcelas: [], observacoes: '', status: 'ABERTO', statusOrcamento: 'Aberto',
    criadoEm: agora, atualizadoEm: agora, marcadorInstalacao: marcador,
  }
  await atualizarRegistroColecaoCentral('vendas', orcamento)
  const confirmacao = await carregarColecaoCentral<any>('vendas')
  const atualizadas = Array.isArray(confirmacao.data) ? confirmacao.data : []
  const gravado = atualizadas.find((venda) => String(venda?.id) === id && String(venda?.numeroOrcamento) === numeroOrcamento)
  if (!gravado || !Array.isArray(gravado.itens) || gravado.itens.length !== 10 || Number(gravado.totalFinal) !== subtotal) throw new Error('O MySQL não confirmou integralmente o orçamento Sistema.')
  console.info('[Synergias ERP] Orçamento Sistema criado e validado.', { id, numeroOrcamento, subtotal })
  return atualizadas
}

async function criarOrcamentoMoinhosUmaVez(vendas: any[], produtos: any[], clientes: any[]): Promise<any[]> {
  const marcador = 'SYNERGIAS_ORCAMENTO_MOINHOS_20260721'
  if (vendas.some((venda) => venda?.marcadorInstalacao === marcador)) return vendas
  const clientesEncontrados = clientes.filter((cliente) => {
    const codigo = String(cliente?.codigo || cliente?.id || cliente?.codigoSistema || '').replace(/\D/g, '')
    const nome = normalizarBuscaSupreme(cliente?.nomeRazaoSocial || cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.nome)
    return codigo === '0064' && nome.includes('CONDOMINIO EDIFICIO MOINHOS DE VENTO')
  })
  if (clientesEncontrados.length !== 1) throw new Error(`Orçamento Moinhos bloqueado: cliente 0064 retornou ${clientesEncontrados.length} correspondências.`)
  const cliente = clientesEncontrados[0]
  const especificacoes = [
    ['7901210028', 3], ['7901210369', 2], ['7901210376', 2], ['7901210953', 3], ['7901210738', 2],
    ['7901210037', 12], ['7901210529', 2], ['7901210850', 2], ['7901211354', 2], ['7901210931', 1],
  ] as const
  const itens = especificacoes.map(([codigoBarras, quantidade], indice) => {
    const encontrados = produtos.filter((produto) => String(produto?.codigoBarras || '').replace(/\D/g, '') === codigoBarras)
    if (encontrados.length !== 1) throw new Error(`Orçamento Moinhos bloqueado: código ${codigoBarras} retornou ${encontrados.length} produtos.`)
    const produto = encontrados[0]
    if (!normalizarBuscaSupreme(produto?.situacao || produto?.status).includes('ATIVO')) throw new Error(`Orçamento Moinhos bloqueado: produto ${codigoBarras} não está ativo.`)
    const valorUnitarioCadastro = Number(produto?.vendaVarejo || produto?.precoVenda || produto?.valorVenda || 0)
    const valorUnitario = codigoBarras === '7901210850' ? 8.39 : valorUnitarioCadastro
    if (!(valorUnitario > 0)) throw new Error(`Orçamento Moinhos bloqueado: produto ${codigoBarras} está sem preço.`)
    const custoUnitario = Number(produto?.custoMedioAtual || produto?.custo || produto?.ultimoCustoCompra || 0)
    const codigoProduto = String(produto?.codigo || produto?.codigoInterno || produto?.id || '')
    return {
      id: `moinhos-item-${indice + 1}-${Date.now()}`, produtoId: String(produto?.id || ''), codigo: codigoProduto,
      codigoProduto, codigoBarras, descricao: String(produto?.descricao || produto?.nome || ''),
      unidade: String(produto?.unidade || produto?.unidadeMedida || 'Unidade'), quantidade, valorUnitario,
      desconto: 0, descontoValor: 0, descontoPercentual: 0, valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
      custoUnitario, custoTotal: Number((quantidade * custoUnitario).toFixed(2)),
      estoqueDisponivel: Number(produto?.estoqueAtual || produto?.estoque || produto?.quantidadeEstoque || 0),
      produtoVinculado: true, vinculoProdutoOrigem: 'CODIGO_BARRAS_EXATO',
    }
  })
  const numeros = vendas.filter((venda) => normalizarBuscaSupreme(venda?.tipo).includes('ORCAMENTO'))
    .map((venda) => Number(String(venda?.numeroOrcamento || '').replace(/\D/g, ''))).filter(Number.isFinite)
  const numeroOrcamento = String((numeros.length ? Math.max(...numeros) : 0) + 1)
  if (vendas.some((venda) => String(venda?.numeroOrcamento || '').replace(/\D/g, '') === numeroOrcamento)) throw new Error(`Orçamento Moinhos bloqueado: número ${numeroOrcamento} já existe.`)
  const hoje = new Date()
  const dataEmissao = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const subtotal = Number(itens.reduce((soma, item) => soma + item.valorTotal, 0).toFixed(2))
  if (subtotal !== 276.31) throw new Error(`Orçamento Moinhos bloqueado: total atual ${subtotal} diverge de 276,31.`)
  const custoTotal = Number(itens.reduce((soma, item) => soma + item.custoTotal, 0).toFixed(2))
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `orcamento-moinhos-${Date.now()}`
  const endereco = [cliente?.endereco, cliente?.numero].filter(Boolean).join(', ')
  const agora = new Date().toISOString()
  const orcamento = {
    id, tipo: 'Orçamento', numeroOrcamento, vendedor: 'Natália Vieira',
    clienteId: String(cliente?.id || cliente?.codigo || ''), clienteCodigo: String(cliente?.codigo || cliente?.id || ''),
    clienteNome: String(cliente?.nomeRazaoSocial || cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.nome || ''),
    clienteDocumento: String(cliente?.cnpj || cliente?.documento || ''), clienteEmailNotaFiscal: String(cliente?.emailNotaFiscal || cliente?.email || ''),
    clienteInscricaoEstadual: String(cliente?.inscricaoEstadual || cliente?.ie || ''), dataEmissao,
    dataEntrega: somarDiasUteisSupreme(dataEmissao, 2), dataValidade: somarDiasUteisSupreme(dataEmissao, 5),
    enderecoFaturamento: endereco, enderecoEntrega: String(cliente?.enderecoEntrega || endereco), itens, itensEditadosManual: true,
    tipoDesconto: 'valor', descontoInformado: 0, descontoCalculado: 0, descontoValor: 0, frete: 0, outrosCustos: 0,
    subtotal, totalFinal: subtotal, valorTotal: subtotal, custoTotal, margemValor: Number((subtotal - custoTotal).toFixed(2)),
    pagamentos: [], parcelas: [], observacoes: '', status: 'ABERTO', statusOrcamento: 'Aberto',
    criadoEm: agora, atualizadoEm: agora, marcadorInstalacao: marcador,
  }
  await atualizarRegistroColecaoCentral('vendas', orcamento)
  const confirmacao = await carregarColecaoCentral<any>('vendas')
  const atualizadas = Array.isArray(confirmacao.data) ? confirmacao.data : []
  const gravado = atualizadas.find((venda) => String(venda?.id) === id && String(venda?.numeroOrcamento) === numeroOrcamento)
  if (!gravado || !Array.isArray(gravado.itens) || gravado.itens.length !== 10 || Number(gravado.totalFinal) !== subtotal) throw new Error('O MySQL não confirmou integralmente o orçamento Moinhos.')
  console.info('[Synergias ERP] Orçamento Moinhos criado e validado.', { id, numeroOrcamento, subtotal })
  return atualizadas
}

async function corrigirClientesOrcamentos2422e2423UmaVez(vendas: any[], clientes: any[]): Promise<any[]> {
  const marcador = 'SYNERGIAS_CLIENTE_HOM_LINDOIA_ORCAMENTOS_2422_2423_20260721'
  const clienteEncontrados = clientes.filter((cliente) => {
    const codigo = String(cliente?.codigo || cliente?.id || cliente?.codigoSistema || '').replace(/\D/g, '')
    const nome = normalizarBuscaSupreme(cliente?.nomeRazaoSocial || cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.nome)
    return codigo === '0090' && nome === 'CONDOMINIO HOM LINDOIA'
  })
  if (clienteEncontrados.length !== 1) throw new Error(`Correção 2422/2423 bloqueada: cliente HOM LINDOIA retornou ${clienteEncontrados.length} correspondências.`)
  const cliente = clienteEncontrados[0]
  let atuais = vendas

  // Restaura o orçamento 2413 da Rossi Florida, identificado pelo valor histórico exato.
  const jaExiste2413 = atuais.some((venda) => {
    const numeroAtual = String(venda?.numeroOrcamento || '').replace(/\D/g, '').replace(/^0+/, '')
    return numeroAtual === '2413' && !normalizarBuscaSupreme(venda?.tipo).includes('PEDIDO')
  })
  const candidato2413Em2423 = atuais.filter((venda) => {
    const numeroAtual = String(venda?.numeroOrcamento || '').replace(/\D/g, '').replace(/^0+/, '')
    const totalAtual = Number(venda?.totalFinal ?? venda?.valorTotal ?? 0)
    return numeroAtual === '2423'
      && !normalizarBuscaSupreme(venda?.tipo).includes('PEDIDO')
      && Math.abs(totalAtual - 2149.47) < 0.01
  })
  if (!jaExiste2413 && candidato2413Em2423.length === 1) {
    const restaurado2413 = {
      ...candidato2413Em2423[0],
      tipo: 'Orçamento',
      numeroOrcamento: '2413',
      correcaoNumeroOrcamento: 'SYNERGIAS_RESTAURA_ROSSI_FLORIDA_2413_20260721',
      atualizadoEm: new Date().toISOString(),
    }
    await atualizarRegistroColecaoCentral('vendas', restaurado2413)
    const confirmacao2413 = await carregarColecaoCentral<any>('vendas')
    atuais = Array.isArray(confirmacao2413.data) ? confirmacao2413.data : []
    const confirmado2413 = atuais.find((venda) => String(venda?.id || '') === String(restaurado2413.id || ''))
    if (!confirmado2413 || String(confirmado2413.numeroOrcamento) !== '2413' || Math.abs(Number(confirmado2413.totalFinal ?? confirmado2413.valorTotal ?? 0) - 2149.47) >= 0.01) {
      throw new Error('O MySQL não confirmou a restauração do orçamento 2413 da Rossi Florida.')
    }
  }

  for (const numero of ['2422', '2423']) {
    const candidatos = atuais.filter((venda) => {
      const numeroAtual = String(venda?.numeroOrcamento || '').replace(/\D/g, '').replace(/^0+/, '')
      return numeroAtual === numero && !normalizarBuscaSupreme(venda?.tipo).includes('PEDIDO')
    })
    const totalEsperado = numero === '2422' ? 539.99 : 730.15
    const candidatosPeloTotal = candidatos.filter((venda) => Math.abs(Number(venda?.totalFinal ?? venda?.valorTotal ?? 0) - totalEsperado) < 0.01)
    const candidatosHom = candidatos.filter((venda) => normalizarBuscaSupreme(venda?.clienteNome || venda?.cliente) === 'CONDOMINIO HOM LINDOIA')
    const selecionados = numero === '2423'
      ? candidatos
      : candidatosPeloTotal.length === 1
        ? candidatosPeloTotal
        : candidatosHom.length === 1
          ? candidatosHom
          : candidatos
    if (selecionados.length === 0 || (numero !== '2423' && selecionados.length !== 1)) {
      console.warn(`[Synergias ERP] Correção ${numero} ignorada: foram encontrados ${candidatos.length} orçamentos e nenhum candidato único.`)
      continue
    }
    const enderecoFaturamento = [
      [cliente?.endereco, cliente?.numero].filter(Boolean).join(', '),
      [cliente?.bairro, [cliente?.cidade, cliente?.estado].filter(Boolean).join(' / '), cliente?.cep ? `CEP: ${cliente.cep}` : ''].filter(Boolean).join(' - '),
    ].filter(Boolean).join('\n')
    for (const atual of selecionados) {
      const jaCorreto = normalizarBuscaSupreme(atual?.clienteNome || atual?.cliente) === 'CONDOMINIO HOM LINDOIA'
        && Math.abs(Number(atual?.totalFinal ?? atual?.valorTotal ?? 0) - totalEsperado) < 0.01
      if (jaCorreto) continue
      const corrigido = {
        ...atual,
        tipo: 'Orçamento',
        totalFinal: totalEsperado,
        valorTotal: totalEsperado,
        clienteId: String(cliente?.id || cliente?.codigo || ''),
        clienteCodigo: String(cliente?.codigo || cliente?.id || ''),
        clienteNome: String(cliente?.nomeRazaoSocial || cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.nome || ''),
        clienteDocumento: String(cliente?.cnpj || cliente?.documento || ''),
        clienteEmail: String(cliente?.email || ''),
        clienteEmailNotaFiscal: String(cliente?.emailNotaFiscal || cliente?.email || ''),
        clienteInscricaoEstadual: String(cliente?.inscricaoEstadual || cliente?.ie || ''),
        enderecoFaturamento,
        enderecoEntrega: String(cliente?.enderecoEntrega || enderecoFaturamento),
        correcaoCliente: marcador,
        atualizadoEm: new Date().toISOString(),
      }
      await atualizarRegistroColecaoCentral('vendas', corrigido)
      const confirmacao = await carregarColecaoCentral<any>('vendas')
      atuais = Array.isArray(confirmacao.data) ? confirmacao.data : []
      const confirmado = atuais.find((venda) => String(venda?.id || '') === String(corrigido.id || ''))
      if (!confirmado || normalizarBuscaSupreme(confirmado.clienteNome) !== 'CONDOMINIO HOM LINDOIA' || Number(confirmado.totalFinal) !== totalEsperado) {
        throw new Error(`O MySQL não confirmou o cliente do orçamento ${numero}.`)
      }
    }
  }
  return atuais
}

async function restaurarVinculoDoPedido2505UmaVez(vendas: any[]): Promise<any[]> {
  const numeroLimpo = (valor: unknown) => String(valor || '').replace(/\D/g, '').replace(/^0+/, '')
  const vinculos = [
    { orcamento: '2423', pedido: '2505', nfe: '2426' },
  ]
  let atuais = vendas
  for (const vinculo of vinculos) {
    const orcamentos = atuais.filter((venda) =>
      numeroLimpo(venda?.numeroOrcamento) === vinculo.orcamento
      && normalizarBuscaSupreme(venda?.tipo).includes('ORCAMENTO')
      && (vinculo.orcamento !== '2423' || (
        normalizarBuscaSupreme(venda?.clienteNome || venda?.cliente) === 'CONDOMINIO HOM LINDOIA'
        && Math.abs(Number(venda?.totalFinal ?? venda?.valorTotal ?? 0) - 730.15) < 0.01
      )))
    if (orcamentos.length !== 1) {
      throw new Error(`Vínculo ${vinculo.orcamento}/${vinculo.pedido} bloqueado: encontrados ${orcamentos.length} orçamentos.`)
    }
    const pedidos = atuais.filter((venda) => {
      const numeroNfe = numeroLimpo(
        venda?.numeroNotaFiscal || venda?.numeroNfe || venda?.numeroNFe || venda?.numeroNF
        || venda?.notaFiscalNumero || venda?.nfeNumero || venda?.notaFiscal?.numero || venda?.nfe?.numero,
      )
      const numeroPedido = numeroLimpo(venda?.numeroPedido)
      return numeroNfe === vinculo.nfe || numeroPedido === vinculo.pedido
    })
    if (pedidos.length === 0) {
      throw new Error(`Vínculo ${vinculo.orcamento}/${vinculo.pedido} bloqueado: pedido da NF-e ${vinculo.nfe} não encontrado.`)
    }
    const orcamento = orcamentos[0]
    const pedido = [...pedidos].sort((a, b) => {
      const pontos = (registro: any) =>
        (numeroLimpo(registro?.numeroNotaFiscal || registro?.numeroNfe || registro?.numeroNFe || registro?.numeroNF || registro?.notaFiscalNumero || registro?.nfeNumero) === vinculo.nfe ? 100 : 0)
        + (String(registro?.chaveAcessoNotaFiscal || '').replace(/\D/g, '').length === 44 ? 40 : 0)
        + (Array.isArray(registro?.itens) ? registro.itens.length : 0)
        + (registro?.registroDuplicadoTecnico ? 0 : 10)
      return pontos(b) - pontos(a)
    })[0]
    const pedidoJaVinculado = String(pedido?.orcamentoOrigemId || '') === String(orcamento?.id || '')
      && numeroLimpo(pedido?.orcamentoOrigemNumero) === vinculo.orcamento
    const orcamentoJaGerado = orcamento?.pedidoGerado === true
      && String(orcamento?.pedidoGeradoId || '') === String(pedido?.id || '')
      && normalizarBuscaSupreme(orcamento?.statusOrcamento) === 'GERADO'
    if (pedidoJaVinculado && orcamentoJaGerado) continue

    const agora = new Date().toISOString()
    const pedidoCorrigido = {
      ...pedido, tipo: 'Pedido', numeroPedido: vinculo.pedido,
      ocultoListagem: false, registroDuplicadoTecnico: false,
      orcamentoOrigemId: String(orcamento.id || ''), orcamentoOrigemNumero: vinculo.orcamento,
      correcaoVinculoOrcamento: `SYNERGIAS_VINCULO_${vinculo.orcamento}_PEDIDO_${vinculo.pedido}_NFE_${vinculo.nfe}_20260721`,
      atualizadoEm: agora,
    }
    await atualizarRegistroColecaoCentral('vendas', pedidoCorrigido)
    const orcamentoCorrigido = {
      ...orcamento, tipo: 'Orçamento', status: 'APROVADO', statusOrcamento: 'GERADO',
      aprovado: true, reprovado: false, convertido: true, pedidoGerado: true,
      pedidoId: String(pedido.id || ''), pedidoGeradoId: String(pedido.id || ''),
      pedidoGeradoEm: String(pedido?.criadoEm || pedido?.dataEmissao || agora), atualizadoEm: agora,
    }
    await atualizarRegistroColecaoCentral('vendas', orcamentoCorrigido)
    const confirmacao = await carregarColecaoCentral<any>('vendas')
    atuais = Array.isArray(confirmacao.data) ? confirmacao.data : []
    const pedidoConfirmado = atuais.find((venda) => String(venda?.id || '') === String(pedido.id || ''))
    const orcamentoConfirmado = atuais.find((venda) => String(venda?.id || '') === String(orcamento.id || ''))
    if (!pedidoConfirmado || String(pedidoConfirmado.orcamentoOrigemId || '') !== String(orcamento.id || '')
      || !orcamentoConfirmado || orcamentoConfirmado.pedidoGerado !== true || String(orcamentoConfirmado.pedidoGeradoId || '') !== String(pedido.id || '')) {
      throw new Error(`O MySQL não confirmou o vínculo do orçamento ${vinculo.orcamento} com o pedido ${vinculo.pedido}.`)
    }
  }
  return atuais
}


export async function restaurarHistoricoFiscalVisivel(vendas: any[]): Promise<any[]> {
  const somenteNumero = (valor: unknown) => String(valor || '').replace(/\D/g, '').replace(/^0+/, '')
  const notasCanceladasConfirmadas = new Set(['2497'])
  const ajustesConfirmados: Record<string, { ativa: string; canceladas?: string[] }> = {
    '2502': { ativa: '2419' },
    '2503': { ativa: '2421', canceladas: ['2497'] },
  }
  let alterou = false
  const agora = new Date().toISOString()
  const corrigidas = (Array.isArray(vendas) ? vendas : []).map((registro: any) => {
    if (!String(registro?.tipo || '').toUpperCase().includes('PED')) return registro
    const pedido = somenteNumero(registro?.numeroPedido)
    const historicoOriginal = Array.isArray(registro?.historicoNotaFiscal) ? registro.historicoNotaFiscal : []
    const historico = [...historicoOriginal]
    const confirmado = ajustesConfirmados[pedido]
    const numeroAtual = somenteNumero(registro?.numeroNotaFiscal)
    if (notasCanceladasConfirmadas.has(numeroAtual) && !historico.some((item: any) =>
      somenteNumero(item?.numero) === numeroAtual
      && String(item?.status || '').toUpperCase() === 'CANCELADA')) {
      historico.push({
        id: `nfe-${numeroAtual}-cancelada-confirmada`,
        ambiente: 'PRODUCAO',
        status: 'Cancelada',
        numero: numeroAtual,
        serie: String(registro?.serieNotaFiscal || '1'),
        chaveAcesso: registro?.chaveAcessoNotaFiscal || '',
        protocolo: registro?.protocoloCancelamentoNotaFiscal || '',
        motivo: 'Cancelamento confirmado pelo usuário.',
        criadoEm: registro?.dataCancelamentoNotaFiscal || agora,
      })
    }

    if (confirmado) {
      if (!historico.some((item: any) => somenteNumero(item?.numero) === confirmado.ativa)) {
        historico.push({
          id: `nfe-${confirmado.ativa}-restaurada-pedido-${pedido}`,
          ambiente: 'PRODUCAO',
          status: 'Autorizada',
          numero: confirmado.ativa,
          serie: '1',
          motivo: 'Vínculo fiscal confirmado pelo usuário e restaurado no histórico.',
          criadoEm: agora,
        })
      }
      for (const numeroCancelado of confirmado.canceladas || []) {
        if (!historico.some((item: any) =>
          somenteNumero(item?.numero) === numeroCancelado
          && String(item?.status || '').toUpperCase() === 'CANCELADA')) {
          historico.push({
            id: `nfe-${numeroCancelado}-cancelada-pedido-${pedido}`,
            ambiente: 'PRODUCAO',
            status: 'Cancelada',
            numero: numeroCancelado,
            serie: '1',
            motivo: 'Cancelamento confirmado pelo usuário e preservado no histórico.',
            criadoEm: agora,
          })
        }
      }
    }

    const autorizadas = historico.filter((item: any) =>
      ['AUTORIZADA', 'EMITIDA'].includes(String(item?.status || '').toUpperCase()))
    const canceladas = new Set(historico
      .filter((item: any) => String(item?.status || '').toUpperCase() === 'CANCELADA')
      .map((item: any) => somenteNumero(item?.numero)))
    const ativa = confirmado
      ? [...autorizadas].reverse().find((item: any) => somenteNumero(item?.numero) === confirmado.ativa)
      : [...autorizadas].reverse().find((item: any) => !canceladas.has(somenteNumero(item?.numero)))
    const atualConfirmadaCancelada = notasCanceladasConfirmadas.has(numeroAtual)
    const atualOcultaNotaValida = ativa && (
      !somenteNumero(registro?.numeroNotaFiscal)
      || String(registro?.statusNotaFiscal || '').toUpperCase() === 'CANCELADA'
    )
    const precisaAjuste = Boolean(
      confirmado
      || atualConfirmadaCancelada
      || atualOcultaNotaValida
      || historico.length !== historicoOriginal.length
    )
    if (!precisaAjuste) return registro
    const numeroAtivo = String(ativa?.numero || confirmado?.ativa || registro?.numeroNotaFiscal || '')
    const jaCorreto = somenteNumero(registro?.numeroNotaFiscal) === somenteNumero(numeroAtivo)
      && ['AUTORIZADA', 'EMITIDA'].includes(String(registro?.statusNotaFiscal || '').toUpperCase())
      && registro?.ocultoListagem !== true
      && historico.length === historicoOriginal.length
    if (jaCorreto) return registro
    alterou = true
    return {
      ...registro,
      ocultoListagem: false,
      statusNotaFiscal: numeroAtivo && !notasCanceladasConfirmadas.has(somenteNumero(numeroAtivo))
        ? 'Autorizada'
        : 'Cancelada',
      numeroNotaFiscal: numeroAtivo || registro?.numeroNotaFiscal,
      serieNotaFiscal: ativa?.serie || registro?.serieNotaFiscal || '1',
      chaveAcessoNotaFiscal: ativa?.chaveAcesso || registro?.chaveAcessoNotaFiscal || '',
      protocoloNotaFiscal: ativa?.protocolo || registro?.protocoloNotaFiscal || '',
      xmlNotaFiscal: ativa?.xml || registro?.xmlNotaFiscal || '',
      ambienteNotaFiscal: ativa?.ambiente || registro?.ambienteNotaFiscal || 'PRODUCAO',
      historicoNotaFiscal: historico,
      correcaoHistoricoFiscal: 'SYNERGIAS_HISTORICO_FISCAL_VISIVEL_V340',
      atualizadoEm: agora,
    }
  })
  if (!alterou) return vendas
  for (const corrigida of corrigidas) {
    const original = vendas.find((item: any) => String(item?.id || '') === String(corrigida?.id || ''))
    if (original !== corrigida) await atualizarRegistroColecaoCentral('vendas', corrigida)
  }
  const confirmacao = await carregarColecaoCentral<any>('vendas')
  return Array.isArray(confirmacao.data) ? confirmacao.data : corrigidas
}

export async function restaurarVinculoOrcamento2413Pedido2502(vendas: any[]): Promise<any[]> {
  const numero = (valor: unknown) => String(valor || '').replace(/\D/g, '').replace(/^0+/, '')
  const orcamento = vendas.find((registro: any) =>
    !String(registro?.tipo || '').toUpperCase().includes('PED')
    && numero(registro?.numeroOrcamento) === '2413')
  const pedido = vendas.find((registro: any) =>
    String(registro?.tipo || '').toUpperCase().includes('PED')
    && numero(registro?.numeroPedido) === '2502')
  if (!orcamento?.id || !pedido?.id) return vendas
  const vinculoCorreto = String(pedido.orcamentoOrigemId || '') === String(orcamento.id)
    && numero(pedido.orcamentoOrigemNumero) === '2413'
    && String(orcamento.pedidoGeradoId || '') === String(pedido.id)
  if (vinculoCorreto) return vendas

  const agora = new Date().toISOString()
  await atualizarRegistroColecaoCentral('vendas', {
    ...pedido,
    orcamentoOrigemId: orcamento.id,
    orcamentoOrigemNumero: '2413',
    atualizadoEm: agora,
  })
  await atualizarRegistroColecaoCentral('vendas', {
    ...orcamento,
    numeroPedido: '2502',
    pedidoGerado: true,
    convertido: true,
    pedidoGeradoId: pedido.id,
    pedidoId: pedido.id,
    pedidoGeradoEm: orcamento.pedidoGeradoEm || pedido.criadoEm || agora,
    atualizadoEm: agora,
  })
  const confirmacao = await carregarColecaoCentral<any>('vendas')
  return Array.isArray(confirmacao.data) ? confirmacao.data : vendas
}

export async function inicializarArmazenamentoCentral(): Promise<void> {
  const timeout = new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error('Tempo limite ao carregar dados do servidor.')), 30000))
  const carregar = Promise.all([
    carregarColecaoCentral<unknown>('clientes'),
    carregarColecaoCentral<unknown>('produtos'),
    carregarColecaoCentral<unknown>('vendas'),
    carregarColecaoCentral<unknown>('compras'),
    carregarColecaoCentral<unknown>('movimentacoesEstoque'),
  ])
  const [clientes, produtos, vendas, compras, movimentacoesEstoque] = await Promise.race([carregar, timeout])
definirColecaoMemoria('clientes', Array.isArray(clientes.data) ? clientes.data : [])
  definirColecaoMemoria('produtos', Array.isArray(produtos.data) ? produtos.data : [])
  let comprasIniciais = Array.isArray(compras.data) ? compras.data : []
  let movimentosIniciais = Array.isArray(movimentacoesEstoque.data) ? movimentacoesEstoque.data : []
  if (comprasIniciais.length === 0) {
    try {
      const locais = JSON.parse(localStorage.getItem('synergias_erp_compras') || '[]')
      if (Array.isArray(locais) && locais.length > 0) {
        comprasIniciais = locais
        definirColecaoMemoria('compras', locais)
        await sincronizarColecaoCentralAgora('compras', locais)
      }
    } catch (erro) {
      console.warn('[Synergias ERP] Migração inicial de compras locais não concluída.', erro)
    }
  }
  if (movimentosIniciais.length === 0) {
    try {
      const locais = JSON.parse(localStorage.getItem('synergias_estoque_movimentacoes') || '[]')
      if (Array.isArray(locais) && locais.length > 0) {
        movimentosIniciais = locais
        definirColecaoMemoria('movimentacoesEstoque', locais)
        await sincronizarColecaoCentralAgora('movimentacoesEstoque', locais)
      }
    } catch (erro) {
      console.warn('[Synergias ERP] Migração inicial de movimentações locais não concluída.', erro)
    }
  }
  definirColecaoMemoria('compras', comprasIniciais)
  definirColecaoMemoria('movimentacoesEstoque', movimentosIniciais)

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
  let vendasEstaveis = vendasServidor as any[]

  // SYNERGIAS_2458_XML_DANFE_V310: correção dirigida e idempotente.
  // Vincula os documentos reais da NF-e 2358 ao Pedido 2458 sem recriar o pedido.
  try {
    vendasEstaveis = await inserirOrcamento2380Pedido2458Nfe2358(
      vendasEstaveis,
      Array.isArray(produtos.data) ? produtos.data : [],
      atualizarRegistroColecaoCentral,
      carregarColecaoCentral,
    )
  } catch (erro) {
    console.warn('[Synergias ERP] XML e DANFE da NF-e 2358 não foram vinculados ao Pedido 2458.', erro)
  }



// A abertura apenas carrega os dados atuais. Migrações históricas já aplicadas
  // não devem bloquear todos os novos acessos ao ERP.
definirColecaoMemoria('clientes', Array.isArray(clientes.data) ? clientes.data : [])
  definirColecaoMemoria('vendas', vendasEstaveis)
  // A reconstrução financeira é pesada e não deve bloquear a abertura do ERP.
  const sincronizarFinanceiro = () => sincronizarFinanceiroComOperacoes(vendasEstaveis, comprasIniciais as any[])
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(sincronizarFinanceiro, { timeout: 5000 })
  } else {
    setTimeout(sincronizarFinanceiro, 1000)
  }
  // Correções históricas ficam disponíveis para manutenção dirigida, mas não
  // podem consultar e regravar vendas em toda abertura do ERP.
  try { localStorage.removeItem('synergias_vendas') } catch {}
  try { localStorage.removeItem('synergias_clientes') } catch {}
  limparCachePesadoDoNavegador()
  return

  try {
    const comOrcamento2429 = garantirOrcamento2429(
      vendasEstaveis,
      Array.isArray(produtos.data) ? produtos.data : [],
      Array.isArray(clientes.data) ? clientes.data : [],
    )
    const restaurado = comOrcamento2429.find((venda: any) =>
      String(venda?.numeroOrcamento || '').replace(/\D/g, '') === '2429'
      && String(venda?.tipo || '').toUpperCase().includes('OR'))
    const jaExistia = vendasEstaveis.some((venda: any) =>
      String(venda?.id || '') === String(restaurado?.id || ''))
    if (restaurado && !jaExistia) {
      await atualizarRegistroColecaoCentral('vendas', restaurado)
      const pedido2508 = vendasEstaveis.find((venda: any) =>
        String(venda?.numeroPedido || '').replace(/\D/g, '') === '2508')
      if (pedido2508?.id) {
        await atualizarRegistroColecaoCentral('vendas', {
          ...pedido2508,
          orcamentoOrigemId: restaurado.id,
          orcamentoOrigemNumero: '2429',
          numeroOrcamento: '2429',
          atualizadoEm: new Date().toISOString(),
        })
      }
      const confirmacao2429 = await carregarColecaoCentral<any>('vendas')
      vendasEstaveis = Array.isArray(confirmacao2429.data)
        ? confirmacao2429.data
        : vendasEstaveis
    }
  } catch (erro) {
    console.warn('[Synergias ERP] Restauração do orçamento 2429 não aplicada.', erro)
  }
  try {
  vendasEstaveis = await corrigirPedido2508StatusBoleto(vendasEstaveis, atualizarRegistroColecaoCentral, carregarColecaoCentral)
  } catch (erro) {
    console.warn('[Synergias ERP] Ajuste V296 do Pedido 2508 não aplicado.', erro)
  }
  try {
  vendasEstaveis = await aplicarTodosOrcamentosDescricao(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], Array.isArray(clientes.data) ? clientes.data : [], atualizarRegistroColecaoCentral, carregarColecaoCentral)
  } catch (erro) {
    console.warn('[Synergias ERP] V295 não aplicada.', erro)
  }
  try {
  vendasEstaveis = await corrigirOrcamento2492LifeSquare(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], atualizarRegistroColecaoCentral, carregarColecaoCentral)
  } catch (erro) {
    console.warn('[Synergias ERP] Ajuste V305 do Orçamento 2492 não aplicado.', erro)
  }
  try {
  vendasEstaveis = await corrigirOrcamento2151Pedido2453PorDescricao(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], atualizarRegistroColecaoCentral, carregarColecaoCentral)
  } catch (erro) {
    console.warn('[Synergias ERP] Ajuste V308 do orçamento 2151 / pedido 2453 não aplicado.', erro)
  }
  try {
  vendasEstaveis = await criarOrcamentoOttoClub(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], Array.isArray(clientes.data) ? clientes.data : [], atualizarRegistroColecaoCentral, carregarColecaoCentral)
  vendasEstaveis = await criarOrcamentosJoy(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], Array.isArray(clientes.data) ? clientes.data : [], atualizarRegistroColecaoCentral, carregarColecaoCentral)
  } catch (erro) {
    console.warn('[Synergias ERP] Orçamento OTTO CLUB não criado.', erro)
  }
  try {
  vendasEstaveis = await inserirOrcamento2380Pedido2458Nfe2358(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], atualizarRegistroColecaoCentral, carregarColecaoCentral)
  } catch (erro) {
    console.warn('[Synergias ERP] Histórico 2380/2458/NF-e 2358 não inserido.', erro)
  }
  try {
  vendasEstaveis = await inserirOrcamento2355Pedido2428Nfe2325(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], atualizarRegistroColecaoCentral, carregarColecaoCentral)
  } catch (erro) {
    console.warn('[Synergias ERP] Histórico 2355/2428/NF-e 2325 não inserido.', erro)
  }
  try {
  vendasEstaveis = await inserirOrcamento2396Vitoria(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], Array.isArray(clientes.data) ? clientes.data : [], atualizarRegistroColecaoCentral, carregarColecaoCentral)
  } catch (erro) {
    console.warn('[Synergias ERP] Orçamento histórico 2396 não inserido.', erro)
  }
  try {
  vendasEstaveis = await corrigirOrcamentos2406e2411PorDescricao(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], Array.isArray(clientes.data) ? clientes.data : [], atualizarRegistroColecaoCentral, carregarColecaoCentral)
  } catch (erro) {
    console.warn('[Synergias ERP] Orçamentos 2360/2397/2406/2411/2448 não corrigidos.', erro)
  }
  try {
  vendasEstaveis = await aplicarOrcamentosGrandParkUmaVez(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], Array.isArray(clientes.data) ? clientes.data : [])
  } catch (erro) {
    console.warn('[Synergias ERP] Carga 2485/2486 não aplicada.', erro)
    throw erro
  }
  try {
  vendasEstaveis = await aplicarOrcamento2439PontalUmaVez(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], Array.isArray(clientes.data) ? clientes.data : [])
  } catch (erro) {
    console.warn('[Synergias ERP] Orçamento 2439 PONTAL não aplicado.', erro)
    throw erro
  }
  vendasEstaveis = await criarOrcamentoSupremeUmaVez(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], Array.isArray(clientes.data) ? clientes.data : [])
  vendasEstaveis = await criarOrcamentoSistemaUmaVez(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], Array.isArray(clientes.data) ? clientes.data : [])
  vendasEstaveis = await criarOrcamentoMoinhosUmaVez(vendasEstaveis, Array.isArray(produtos.data) ? produtos.data : [], Array.isArray(clientes.data) ? clientes.data : [])
  try {
    vendasEstaveis = await corrigirClientesOrcamentos2422e2423UmaVez(vendasEstaveis, Array.isArray(clientes.data) ? clientes.data : [])
  } catch (erro) {
    // Uma correção pontual nunca deve impedir o carregamento de toda a coleção.
    console.warn('[Synergias ERP] Correção 2422/2423 ignorada durante a inicialização.', erro)
  }
  try {
    vendasEstaveis = await restaurarVinculoDoPedido2505UmaVez(vendasEstaveis)
  } catch (erro) {
    console.warn('[Synergias ERP] Restauração do vínculo 2423/2505 ignorada durante a inicialização.', erro)
  }
definirColecaoMemoria('clientes', Array.isArray(clientes.data) ? clientes.data : [])
  definirColecaoMemoria('vendas', vendasEstaveis)

  sincronizarFinanceiroComOperacoes(vendasEstaveis, comprasIniciais as any[])

  try { localStorage.removeItem('synergias_vendas') } catch {}
  try { localStorage.removeItem('synergias_clientes') } catch {}

  limparCachePesadoDoNavegador()
}



