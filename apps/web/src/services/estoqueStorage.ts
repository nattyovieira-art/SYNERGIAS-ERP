import type { Produto } from '../types/Produto'
import {
  definirColecaoMemoria,
  obterColecaoMemoria,
  sincronizarColecaoCentral,
  sincronizarColecaoCentralAgora,
} from './erpApi'
import {
  listarProdutosStorage,
  salvarProdutosStorage,
} from './produtosStorage'
import type {
  EstoqueMovimentacao,
  EstoqueProdutoResumo,
  NovaMovimentacaoEstoque,
} from '../types/Estoque'

const STORAGE_MOVIMENTACOES_ESTOQUE = 'synergias_estoque_movimentacoes'

export type ItemEntradaCompraCustoMedio = {
  produtoCodigo: string
  descricao?: string
  quantidade: number
  custoUnitario: number
  valorBase?: number
  unidadeFiscal?: string
  unidadeControle?: string
  fatorConversao?: number
}

export type EntradaCompraCustoMedio = {
  itens: ItemEntradaCompraCustoMedio[]
  desconto?: number
  frete?: number
  outrosCustos?: number
  fornecedor?: string
  numeroCompra?: string
  numeroNFe?: string
  chaveAcessoNFe?: string
  usuario?: string
}

export type ResultadoCustoMedioProduto = {
  produtoCodigo: string
  produtoDescricao: string
  estoqueAnterior: number
  quantidadeEntrada: number
  estoqueAtual: number
  custoMedioAnterior: number
  ultimoCustoAnterior: number
  custoEntrada: number
  custoMedioAtual: number
  variacaoUltimoCustoPercentual: number
  valorEstoqueAnterior: number
  valorEntrada: number
  valorEstoqueAtual: number
  idMovimentacao: string
}

function gerarIdMovimentacao() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `mov-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function gerarIdHistoricoCusto() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `custo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10)
}

function horaAtualBrasil() {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function numeroSeguro(valor: unknown) {
  if (typeof valor === 'number') return Number.isNaN(valor) ? 0 : valor
  if (valor === undefined || valor === null || valor === '') return 0

  const texto = String(valor).trim()

  if (texto.includes(',') && texto.includes('.')) {
    const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
    const numero = Number(limpo)
    return Number.isNaN(numero) ? 0 : numero
  }

  if (texto.includes(',')) {
    const limpo = texto.replace(/[^\d,.-]/g, '').replace(',', '.')
    const numero = Number(limpo)
    return Number.isNaN(numero) ? 0 : numero
  }

  const limpo = texto.replace(/[^\d.-]/g, '')
  const numero = Number(limpo)

  return Number.isNaN(numero) ? 0 : numero
}

function arredondarQuantidade(valor: number) {
  return Number(numeroSeguro(valor).toFixed(4))
}

function arredondarCusto(valor: number) {
  return Number(numeroSeguro(valor).toFixed(6))
}

function arredondarValor(valor: number) {
  return Number(numeroSeguro(valor).toFixed(2))
}

export function obterEstoqueProduto(produto: Produto) {
  const produtoAny = produto as any

  if (produtoAny.estoqueAtual !== undefined) return numeroSeguro(produtoAny.estoqueAtual)
  if (produtoAny.estoque !== undefined) return numeroSeguro(produtoAny.estoque)
  if (produtoAny.quantidadeEstoque !== undefined) return numeroSeguro(produtoAny.quantidadeEstoque)
  if (produtoAny.saldoEstoque !== undefined) return numeroSeguro(produtoAny.saldoEstoque)
  if (produtoAny.quantidade !== undefined) return numeroSeguro(produtoAny.quantidade)

  return 0
}

export function obterEstoqueMinimoProduto(produto: Produto) {
  return numeroSeguro((produto as any).estoqueMinimo)
}

export function obterCustoMedioProduto(produto: Produto) {
  const produtoAny = produto as any

  if (produtoAny.custoMedioAtual !== undefined) {
    return numeroSeguro(produtoAny.custoMedioAtual)
  }

  return numeroSeguro(produtoAny.custo)
}

export function obterUltimoCustoCompraProduto(produto: Produto) {
  const produtoAny = produto as any

  if (produtoAny.ultimoCustoCompra !== undefined) {
    return numeroSeguro(produtoAny.ultimoCustoCompra)
  }

  return numeroSeguro(produtoAny.custo)
}

function aplicarEstoqueProduto(produto: Produto, novoEstoque: number): Produto {
  const estoqueTratado = arredondarQuantidade(novoEstoque)

  return {
    ...produto,
    estoqueAtual: estoqueTratado,
    estoque: estoqueTratado,
    quantidadeEstoque: estoqueTratado,
    saldoEstoque: estoqueTratado,
    atualizadoEm: new Date().toISOString(),
  } as Produto
}

function mesmoProduto(produtoA: Produto, produtoB: Produto) {
  const a = produtoA as any
  const b = produtoB as any

  return (
    String(a.codigo || '') === String(b.codigo || '') ||
    String(a.id || '') === String(b.id || '') ||
    (!!a.codigoBarras &&
      !!b.codigoBarras &&
      String(a.codigoBarras) === String(b.codigoBarras))
  )
}

function normalizarChaveProduto(valor: unknown) {
  return String(valor || '').trim().toLocaleLowerCase('pt-BR')
}

function localizarProduto(
  produtos: Produto[],
  referencias: { codigoProduto?: string; codigoBarras?: string; descricao?: string },
) {
  const codigo = normalizarChaveProduto(referencias.codigoProduto)
  const codigoBarras = normalizarChaveProduto(referencias.codigoBarras)
  const descricao = normalizarChaveProduto(referencias.descricao)

  const porCodigo = produtos.find((produto) => {
    const item = produto as any
    const chaves = [item.codigo, item.id, item.codigoInterno, item.codigoProduto]
      .map(normalizarChaveProduto)
      .filter(Boolean)
    return Boolean(codigo) && chaves.includes(codigo)
  })
  if (porCodigo) return porCodigo

  const porCodigoBarras = produtos.find((produto) => {
    const item = produto as any
    const barras = [item.codigoBarras, item.ean, item.gtin]
      .map(normalizarChaveProduto)
      .filter(Boolean)
    return Boolean(codigoBarras || codigo) &&
      barras.includes(codigoBarras || codigo)
  })
  if (porCodigoBarras) return porCodigoBarras

  if (!descricao) return undefined
  return produtos.find((produto) => {
    const item = produto as any
    const nomes = [item.descricao, item.nome, item.produto]
      .map(normalizarChaveProduto)
      .filter(Boolean)
    return nomes.includes(descricao)
  })
}

export function listarMovimentacoesEstoque(): EstoqueMovimentacao[] {
  const centrais = obterColecaoMemoria<EstoqueMovimentacao>('movimentacoesEstoque')
  if (centrais.length > 0) return centrais
  try {
    const dados = localStorage.getItem(STORAGE_MOVIMENTACOES_ESTOQUE)

    if (!dados) return []

    const movimentacoes = JSON.parse(dados)

    return Array.isArray(movimentacoes) ? movimentacoes : []
  } catch {
    localStorage.setItem(STORAGE_MOVIMENTACOES_ESTOQUE, JSON.stringify([]))
    return []
  }
}

export function salvarMovimentacoesEstoque(movimentacoes: EstoqueMovimentacao[]) {
  definirColecaoMemoria('movimentacoesEstoque', movimentacoes)
  localStorage.setItem(STORAGE_MOVIMENTACOES_ESTOQUE, JSON.stringify(movimentacoes))
  sincronizarColecaoCentral('movimentacoesEstoque', movimentacoes)
  return movimentacoes
}

export async function estornarEntradaCompraStorage(dados: {
  compraId?: string
  numeroCompra?: string
  numeroNFe?: string
  chaveAcessoNFe?: string
  itensFallback?: Array<{
    id?: string
    produtoCodigo?: string
    descricao?: string
    quantidade?: number
    quantidadeConvertida?: number
    incluidoNoSistema?: boolean
  }>
  motivo?: string
  usuario?: string
}) {
  const normalizarDocumento = (valor: unknown) => {
    const texto = String(valor || '').trim()
    const digitos = texto.replace(/\D/g, '')
    return digitos || texto
  }
  const referencias = [
    normalizarDocumento(dados.chaveAcessoNFe),
    normalizarDocumento(dados.numeroNFe),
    normalizarDocumento(dados.numeroCompra),
  ].filter(Boolean)
  const movimentacoes = listarMovimentacoesEstoque()
  let entradas = movimentacoes.filter(
    (movimento) =>
      movimento.origem === 'compra' &&
      referencias.includes(normalizarDocumento(movimento.documentoOrigem)),
  )

  if (entradas.length === 0) {
    const itensFallback = (dados.itensFallback || []).filter(
      (item) =>
        item.incluidoNoSistema !== false &&
        String(item.produtoCodigo || '').trim() &&
        Math.abs(numeroSeguro(item.quantidadeConvertida || item.quantidade)) > 0,
    )
    if (itensFallback.length === 0) {
      throw new Error('Nenhuma entrada de estoque vinculada a esta compra foi encontrada.')
    }
    entradas = itensFallback.map((item, indice) => ({
      id: `legado-compra-${dados.compraId || dados.numeroNFe || dados.numeroCompra}-${item.id || indice}`,
      data: hojeIso(),
      hora: horaAtualBrasil(),
      produtoCodigo: String(item.produtoCodigo || '').trim(),
      produtoDescricao: String(item.descricao || '').trim(),
      tipo: 'entrada',
      origem: 'compra',
      quantidade: Math.abs(numeroSeguro(item.quantidadeConvertida || item.quantidade)),
      estoqueAnterior: null,
      estoqueAtual: null,
      motivo: 'Entrada antiga reconstruída pelos itens persistidos da compra.',
      documentoOrigem:
        normalizarDocumento(dados.chaveAcessoNFe) ||
        normalizarDocumento(dados.numeroNFe) ||
        normalizarDocumento(dados.numeroCompra),
      criadoEm: new Date().toISOString(),
    }))
  }

  const idsJaEstornados = new Set(
    movimentacoes
      .filter((movimento) => movimento.origem === 'estorno_compra')
      .map((movimento) => String(movimento.movimentoOriginalId || ''))
      .filter(Boolean),
  )
    const entradasPendentes = entradas.filter(
      (movimento) => !idsJaEstornados.has(movimento.id),
    )
    if (entradasPendentes.length === 0) {
      return movimentacoes.filter(
        (movimento) =>
          movimento.origem === 'estorno_compra' &&
          idsJaEstornados.has(String(movimento.movimentoOriginalId || '')),
      )
    }

  let produtos = listarProdutosStorage()
  const agora = new Date().toISOString()
  const estornos: EstoqueMovimentacao[] = []

  for (const entrada of entradasPendentes) {
    const produto = localizarProduto(produtos, {
      codigoProduto: entrada.produtoCodigo,
      descricao: entrada.produtoDescricao,
    })
    if (!produto) {
      throw new Error(`Produto não encontrado para estorno: ${entrada.produtoDescricao}.`)
    }
    const estoqueAnterior = obterEstoqueProduto(produto)
    const quantidade = Math.abs(numeroSeguro(entrada.quantidade))
    const estoqueAtual = estoqueAnterior - quantidade
    const produtoAtualizado = aplicarEstoqueProduto(produto, estoqueAtual)
    produtos = produtos.map((item) =>
      mesmoProduto(item, produto) ? produtoAtualizado : item,
    )
    estornos.push({
      id: gerarIdMovimentacao(),
      data: hojeIso(),
      hora: horaAtualBrasil(),
      produtoId: String((produto as any).id || ''),
      produtoCodigo: String((produto as any).codigo || entrada.produtoCodigo || ''),
      produtoDescricao: String(
        (produto as any).descricao || entrada.produtoDescricao || 'Produto sem descrição',
      ),
      tipo: 'saida',
      origem: 'estorno_compra',
      quantidade: arredondarQuantidade(quantidade),
      estoqueAnterior: arredondarQuantidade(estoqueAnterior),
      estoqueAtual: arredondarQuantidade(estoqueAtual),
      motivo: dados.motivo || `Estorno da compra ${dados.numeroCompra || '-'}`,
      observacao: `Estorno auditado da entrada ${entrada.id}, NF-e ${dados.numeroNFe || '-'}.`,
      usuario: dados.usuario || 'Synergias',
      documentoOrigem:
        normalizarDocumento(dados.chaveAcessoNFe) ||
        normalizarDocumento(dados.numeroNFe) ||
        normalizarDocumento(dados.numeroCompra),
      movimentoOriginalId: entrada.id,
      criadoEm: agora,
    })
  }

  salvarProdutosStorage(produtos)
  const movimentacoesAtualizadas = [...estornos, ...movimentacoes].slice(0, 500)
  salvarMovimentacoesEstoque(movimentacoesAtualizadas)
  await Promise.all([
    sincronizarColecaoCentralAgora('produtos', produtos),
    sincronizarColecaoCentralAgora('movimentacoesEstoque', movimentacoesAtualizadas),
  ])
  return estornos
}

export function listarProdutosComResumoEstoque(): EstoqueProdutoResumo[] {
  return listarProdutosStorage().map((produto) => {
    const estoqueDisponivel = obterEstoqueProduto(produto)
    const estoqueMinimoConfigurado = obterEstoqueMinimoProduto(produto)

    return {
      ...produto,
      estoqueDisponivel,
      estoqueMinimoConfigurado,
      estoqueBaixo:
        estoqueMinimoConfigurado > 0 && estoqueDisponivel <= estoqueMinimoConfigurado,
    }
  })
}

export function confirmarEntradaCompraComCustoMedioStorage(
  dados: EntradaCompraCustoMedio,
): {
  ok: boolean
  mensagem: string
  resultados: ResultadoCustoMedioProduto[]
  idsMovimentacoes: string[]
  produtos: Produto[]
  movimentacoes: EstoqueMovimentacao[]
} {
  const produtosAtuais = listarProdutosStorage()
  const normalizarDocumento = (valor: unknown) => {
    const texto = String(valor || '').trim()
    const digitos = texto.replace(/\D/g, '')
    return digitos || texto
  }
  const documentosOrigem = new Set(
    [dados.chaveAcessoNFe, dados.numeroNFe, dados.numeroCompra]
      .map(normalizarDocumento)
      .filter(Boolean),
  )
  const documentoOrigem = Array.from(documentosOrigem)[0] || ''
  const movimentacoesAtuais = listarMovimentacoesEstoque()
  const idsEntradasEstornadas = new Set(
    movimentacoesAtuais
      .filter((movimento) => movimento.origem === 'estorno_compra' && movimento.movimentoOriginalId)
      .map((movimento) => String(movimento.movimentoOriginalId)),
  )
  const movimentosExistentes = movimentacoesAtuais.filter(
    (movimento) =>
      movimento.origem === 'compra' &&
      !idsEntradasEstornadas.has(String(movimento.id)) &&
      documentosOrigem.has(normalizarDocumento(movimento.documentoOrigem)),
  )
  const itensValidos = dados.itens
    .map((item) => ({
      ...item,
      produtoCodigo: String(item.produtoCodigo || '').trim(),
      quantidade: Math.abs(numeroSeguro(item.quantidade)),
      custoUnitario: Math.max(0, numeroSeguro(item.custoUnitario)),
      valorBase: Math.max(
        0,
        numeroSeguro(item.valorBase) ||
          Math.abs(numeroSeguro(item.quantidade)) * Math.max(0, numeroSeguro(item.custoUnitario)),
      ),
    }))
    .filter((item) => item.produtoCodigo && item.quantidade > 0)

  if (itensValidos.length === 0) {
    return {
      ok: false,
      mensagem: 'A compra não possui itens válidos para entrada no estoque.',
      resultados: [],
      idsMovimentacoes: [],
      produtos: produtosAtuais,
      movimentacoes: listarMovimentacoesEstoque(),
    }
  }

  for (const item of itensValidos) {
    if (!localizarProduto(produtosAtuais, { codigoProduto: item.produtoCodigo, descricao: item.descricao })) {
      return {
        ok: false,
        mensagem: `Produto não encontrado no estoque: ${item.descricao || item.produtoCodigo}.`,
        resultados: [],
        idsMovimentacoes: [],
        produtos: produtosAtuais,
        movimentacoes: listarMovimentacoesEstoque(),
      }
    }
  }

  const valorBaseTotal = itensValidos.reduce(
    (soma, item) => soma + numeroSeguro(item.valorBase),
    0,
  )
  const ajusteLiquidoCompra =
    numeroSeguro(dados.frete) +
    numeroSeguro(dados.outrosCustos) -
    numeroSeguro(dados.desconto)

  type EntradaAgrupada = {
    produto: Produto
    quantidadeEntrada: number
    valorEntrada: number
    descricoes: string[]
    unidadesFiscais: string[]
    unidadesControle: string[]
    fatoresConversao: number[]
  }

  const entradasPorProduto = new Map<string, EntradaAgrupada>()

  for (const item of itensValidos) {
    const produto = localizarProduto(produtosAtuais, { codigoProduto: item.produtoCodigo, descricao: item.descricao }) as Produto
    const produtoAny = produto as any
    const chaveProduto = String(produtoAny.id || produtoAny.codigo || item.produtoCodigo)
    const proporcao =
      valorBaseTotal > 0 ? numeroSeguro(item.valorBase) / valorBaseTotal : 1 / itensValidos.length
    const valorEntradaItem = Math.max(
      0,
      numeroSeguro(item.valorBase) + ajusteLiquidoCompra * proporcao,
    )

    const entradaAtual = entradasPorProduto.get(chaveProduto)

    if (entradaAtual) {
      entradaAtual.quantidadeEntrada += item.quantidade
      entradaAtual.valorEntrada += valorEntradaItem
      if (item.descricao) entradaAtual.descricoes.push(item.descricao)
      if (item.unidadeFiscal) entradaAtual.unidadesFiscais.push(item.unidadeFiscal)
      if (item.unidadeControle) entradaAtual.unidadesControle.push(item.unidadeControle)
      if (item.fatorConversao) entradaAtual.fatoresConversao.push(numeroSeguro(item.fatorConversao))
    } else {
      entradasPorProduto.set(chaveProduto, {
        produto,
        quantidadeEntrada: item.quantidade,
        valorEntrada: valorEntradaItem,
        descricoes: item.descricao ? [item.descricao] : [],
        unidadesFiscais: item.unidadeFiscal ? [item.unidadeFiscal] : [],
        unidadesControle: item.unidadeControle ? [item.unidadeControle] : [],
        fatoresConversao: item.fatorConversao ? [numeroSeguro(item.fatorConversao)] : [],
      })
    }
  }

  const agora = new Date().toISOString()
  const resultados: ResultadoCustoMedioProduto[] = []
  const novasMovimentacoes: EstoqueMovimentacao[] = []
  let produtosAtualizados = [...produtosAtuais]

  for (const entrada of entradasPorProduto.values()) {
    const produto = entrada.produto
    const produtoAny = produto as any
    const quantidadeEsperada = arredondarQuantidade(entrada.quantidadeEntrada)
    const quantidadeJaMovimentada = arredondarQuantidade(
      movimentosExistentes
        .filter((movimento) => {
          const mesmoId =
            produtoAny.id &&
            movimento.produtoId &&
            String(movimento.produtoId) === String(produtoAny.id)
          const mesmoCodigo =
            movimento.produtoCodigo &&
            String(movimento.produtoCodigo) === String(produtoAny.codigo || '')
          return Boolean(mesmoId || mesmoCodigo)
        })
        .reduce((total, movimento) => total + Math.abs(numeroSeguro(movimento.quantidade)), 0),
    )
    const quantidadeEntrada = arredondarQuantidade(
      Math.max(0, quantidadeEsperada - quantidadeJaMovimentada),
    )

    if (quantidadeEntrada <= 0) continue

    const proporcaoPendente =
      quantidadeEsperada > 0 ? quantidadeEntrada / quantidadeEsperada : 0
    const estoqueAnterior = obterEstoqueProduto(produto)
    const estoqueAtual = estoqueAnterior + quantidadeEntrada
    const custoMedioAnterior = obterCustoMedioProduto(produto)
    const ultimoCustoAnterior = obterUltimoCustoCompraProduto(produto)
    const valorEstoqueAnterior =
      estoqueAnterior > 0 ? estoqueAnterior * custoMedioAnterior : 0
    const valorEntrada = entrada.valorEntrada * proporcaoPendente
    const custoEntrada = quantidadeEntrada > 0 ? valorEntrada / quantidadeEntrada : 0
    const custoMedioAtual =
      estoqueAnterior > 0 && estoqueAtual > 0
        ? (valorEstoqueAnterior + valorEntrada) / estoqueAtual
        : custoEntrada
    const variacaoUltimoCustoPercentual =
      ultimoCustoAnterior > 0
        ? ((custoEntrada - ultimoCustoAnterior) / ultimoCustoAnterior) * 100
        : 0
    const valorEstoqueAtual = estoqueAtual * custoMedioAtual
    const idMovimentacao = gerarIdMovimentacao()

    const historicoAtual = Array.isArray(produtoAny.historicoCustos)
      ? produtoAny.historicoCustos
      : []

    const historicoCusto = {
      id: gerarIdHistoricoCusto(),
      data: hojeIso(),
      hora: horaAtualBrasil(),
      criadoEm: agora,
      origem: 'compra',
      documentoOrigem,
      numeroCompra: dados.numeroCompra || '',
      numeroNFe: dados.numeroNFe || '',
      fornecedor: dados.fornecedor || '',
      estoqueAnterior: arredondarQuantidade(estoqueAnterior),
      quantidadeEntrada: arredondarQuantidade(quantidadeEntrada),
      estoqueAtual: arredondarQuantidade(estoqueAtual),
      custoMedioAnterior: arredondarCusto(custoMedioAnterior),
      ultimoCustoAnterior: arredondarCusto(ultimoCustoAnterior),
      custoEntrada: arredondarCusto(custoEntrada),
      custoMedioAtual: arredondarCusto(custoMedioAtual),
      variacaoUltimoCustoPercentual: Number(variacaoUltimoCustoPercentual.toFixed(4)),
      valorEstoqueAnterior: arredondarValor(valorEstoqueAnterior),
      valorEntrada: arredondarValor(valorEntrada),
      valorEstoqueAtual: arredondarValor(valorEstoqueAtual),
    }

    const produtoAtualizado = {
      ...aplicarEstoqueProduto(produto, estoqueAtual),
      custoAnteriorUltimaCompra: arredondarCusto(ultimoCustoAnterior),
      ultimoCustoCompra: arredondarCusto(custoEntrada),
      custoMedioAtual: arredondarCusto(custoMedioAtual),
      custo: arredondarCusto(custoMedioAtual),
      variacaoUltimoCustoPercentual: Number(variacaoUltimoCustoPercentual.toFixed(4)),
      valorEstoqueAtual: arredondarValor(valorEstoqueAtual),
      historicoCustos: [historicoCusto, ...historicoAtual].slice(0, 100),
      atualizadoEm: agora,
    } as Produto

    produtosAtualizados = produtosAtualizados.map((item) =>
      mesmoProduto(item, produto) ? produtoAtualizado : item,
    )

    const movimentacao = {
      id: idMovimentacao,
      data: hojeIso(),
      hora: horaAtualBrasil(),
      produtoId: String(produtoAny.id || ''),
      produtoCodigo: String(produtoAny.codigo || ''),
      produtoDescricao: String(
        produtoAny.descricao || entrada.descricoes[0] || 'Produto sem descrição',
      ),
      tipo: 'entrada',
      origem: 'compra',
      quantidade: arredondarQuantidade(quantidadeEntrada),
      estoqueAnterior: arredondarQuantidade(estoqueAnterior),
      estoqueAtual: arredondarQuantidade(estoqueAtual),
      motivo: `Entrada por compra ${
        dados.numeroNFe ? `NF-e ${dados.numeroNFe}` : `#${dados.numeroCompra || '-'}`
      } com recálculo de custo médio`,
      observacao:
        `Fornecedor: ${dados.fornecedor || '-'}. ` +
        `Custo médio anterior: ${arredondarCusto(custoMedioAnterior)}. ` +
        `Custo da entrada: ${arredondarCusto(custoEntrada)}. ` +
        `Novo custo médio: ${arredondarCusto(custoMedioAtual)}.`,
      usuario: dados.usuario || 'Synergias',
      documentoOrigem,
      criadoEm: agora,
      custoMedioAnterior: arredondarCusto(custoMedioAnterior),
      custoEntrada: arredondarCusto(custoEntrada),
      custoMedioAtual: arredondarCusto(custoMedioAtual),
      valorEntrada: arredondarValor(valorEntrada),
      valorEstoqueAtual: arredondarValor(valorEstoqueAtual),
    } as EstoqueMovimentacao

    novasMovimentacoes.push(movimentacao)
    resultados.push({
      produtoCodigo: String(produtoAny.codigo || ''),
      produtoDescricao: String(
        produtoAny.descricao || entrada.descricoes[0] || 'Produto sem descrição',
      ),
      estoqueAnterior: arredondarQuantidade(estoqueAnterior),
      quantidadeEntrada: arredondarQuantidade(quantidadeEntrada),
      estoqueAtual: arredondarQuantidade(estoqueAtual),
      custoMedioAnterior: arredondarCusto(custoMedioAnterior),
      ultimoCustoAnterior: arredondarCusto(ultimoCustoAnterior),
      custoEntrada: arredondarCusto(custoEntrada),
      custoMedioAtual: arredondarCusto(custoMedioAtual),
      variacaoUltimoCustoPercentual: Number(variacaoUltimoCustoPercentual.toFixed(4)),
      valorEstoqueAnterior: arredondarValor(valorEstoqueAnterior),
      valorEntrada: arredondarValor(valorEntrada),
      valorEstoqueAtual: arredondarValor(valorEstoqueAtual),
      idMovimentacao,
    })
  }

  if (novasMovimentacoes.length === 0) {
    return {
      ok: false,
      mensagem:
        'Todos os produtos desta NF-e já possuem a quantidade esperada no estoque. Nenhuma movimentação duplicada foi criada.',
      resultados: [],
      idsMovimentacoes: movimentosExistentes.map((movimento) => movimento.id),
      produtos: produtosAtuais,
      movimentacoes: movimentacoesAtuais,
    }
  }

  salvarProdutosStorage(produtosAtualizados)

  const movimentacoesAtualizadas = [
    ...novasMovimentacoes,
    ...listarMovimentacoesEstoque(),
  ].slice(0, 500)

  salvarMovimentacoesEstoque(movimentacoesAtualizadas)

  return {
    ok: true,
    mensagem: 'Estoque e custo médio atualizados com sucesso.',
    resultados,
    idsMovimentacoes: novasMovimentacoes.map((item) => item.id),
    produtos: produtosAtualizados,
    movimentacoes: movimentacoesAtualizadas,
  }
}

export function movimentarEstoqueStorage(dados: NovaMovimentacaoEstoque) {
  const produtos = listarProdutosStorage()
  const produto = localizarProduto(produtos, { codigoProduto: dados.produtoCodigo })

  if (!produto) {
    return {
      ok: false,
      mensagem: 'Produto não encontrado.',
      produtos,
      movimentacoes: listarMovimentacoesEstoque(),
    }
  }

  const quantidadeInformada = Math.abs(numeroSeguro(dados.quantidade))

  if (quantidadeInformada <= 0 && dados.tipo !== 'ajuste') {
    return {
      ok: false,
      mensagem: 'Informe uma quantidade válida.',
      produtos,
      movimentacoes: listarMovimentacoesEstoque(),
    }
  }

  const estoqueAnterior = obterEstoqueProduto(produto)
  let estoqueAtual = estoqueAnterior
  let quantidadeMovimentada = quantidadeInformada

  if (dados.tipo === 'entrada') {
    estoqueAtual = estoqueAnterior + quantidadeInformada
  }

  if (dados.tipo === 'saida') {
    if (estoqueAnterior < quantidadeInformada) {
      return {
        ok: false,
        mensagem: `Estoque insuficiente. Atual: ${estoqueAnterior}. Saída: ${quantidadeInformada}.`,
        produtos,
        movimentacoes: listarMovimentacoesEstoque(),
      }
    }

    estoqueAtual = estoqueAnterior - quantidadeInformada
    quantidadeMovimentada = quantidadeInformada * -1
  }

  if (dados.tipo === 'ajuste') {
    estoqueAtual = numeroSeguro(dados.quantidade)
    quantidadeMovimentada = estoqueAtual - estoqueAnterior
  }

  const produtosAtualizados = produtos.map((item) => {
    return mesmoProduto(item, produto) ? aplicarEstoqueProduto(item, estoqueAtual) : item
  })

  salvarProdutosStorage(produtosAtualizados)

  const agora = new Date().toISOString()
  const movimentacao: EstoqueMovimentacao = {
    id: gerarIdMovimentacao(),
    data: hojeIso(),
    hora: horaAtualBrasil(),
    produtoId: String((produto as any).id || ''),
    produtoCodigo: String((produto as any).codigo || dados.produtoCodigo),
    produtoDescricao:
      String((produto as any).descricao || (produto as any).nome || 'Produto sem descrição'),
    tipo: dados.tipo,
    origem: dados.origem || 'manual',
    quantidade: arredondarQuantidade(quantidadeMovimentada),
    estoqueAnterior: arredondarQuantidade(estoqueAnterior),
    estoqueAtual: arredondarQuantidade(estoqueAtual),
    motivo: dados.motivo.trim() || 'Movimentação manual',
    observacao: dados.observacao?.trim() || '',
    usuario: dados.usuario || 'Synergias',
    documentoOrigem: dados.documentoOrigem || '',
    criadoEm: agora,
  }

  const movimentacoesAtualizadas = [
    movimentacao,
    ...listarMovimentacoesEstoque(),
  ].slice(0, 500)

  salvarMovimentacoesEstoque(movimentacoesAtualizadas)

  return {
    ok: true,
    mensagem: 'Estoque movimentado com sucesso.',
    produto: aplicarEstoqueProduto(produto, estoqueAtual),
    movimentacao,
    produtos: produtosAtualizados,
    movimentacoes: movimentacoesAtualizadas,
  }
}

export function limparHistoricoEstoque() {
  localStorage.setItem(STORAGE_MOVIMENTACOES_ESTOQUE, JSON.stringify([]))
  return []
}

const STORAGE_ENTREGAS_PEDIDOS = 'synergias_entregas_pedidos'

type RegistroEntregaPedido = {
  id: string
  documentoOrigem: string
  status: 'processando' | 'concluida' | 'confirmada_sem_nova_baixa'
  data: string
  hora: string
  criadoEm: string
  itens: Array<{ produtoCodigo: string; quantidade: number }>
}

function listarRegistrosEntregaPedido(): RegistroEntregaPedido[] {
  try {
    const bruto = localStorage.getItem(STORAGE_ENTREGAS_PEDIDOS)
    const dados = bruto ? JSON.parse(bruto) : []
    return Array.isArray(dados) ? dados : []
  } catch {
    return []
  }
}

function salvarRegistrosEntregaPedido(registros: RegistroEntregaPedido[]) {
  localStorage.setItem(STORAGE_ENTREGAS_PEDIDOS, JSON.stringify(registros.slice(0, 1000)))
}

export function obterRegistroEntregaPedido(documentoOrigem: string) {
  const chave = String(documentoOrigem || '').trim()
  if (!chave) return undefined
  return listarRegistrosEntregaPedido().find((item) => item.documentoOrigem === chave)
}

export function marcarPedidoComoEntregueSemNovaBaixaStorage(
  documentoOrigem: string,
  itens: Array<{ codigoProduto?: string; quantidade?: number }>,
) {
  const chave = String(documentoOrigem || '').trim()
  if (!chave) return { ok: false, mensagem: 'Pedido sem número para registrar a entrega.' }

  const existente = obterRegistroEntregaPedido(chave)
  if (existente) {
    return { ok: true, jaProcessado: true, registro: existente, mensagem: 'A entrega deste pedido já está registrada.' }
  }

  const agora = new Date()
  const registro: RegistroEntregaPedido = {
    id: `entrega-${chave}-${Date.now()}`,
    documentoOrigem: chave,
    status: 'confirmada_sem_nova_baixa',
    data: agora.toISOString().slice(0, 10),
    hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    criadoEm: agora.toISOString(),
    itens: itens.map((item) => ({
      produtoCodigo: String(item.codigoProduto || ''),
      quantidade: Math.abs(numeroSeguro(item.quantidade)),
    })),
  }

  salvarRegistrosEntregaPedido([registro, ...listarRegistrosEntregaPedido()])
  return { ok: true, jaProcessado: false, registro, mensagem: 'Entrega confirmada sem gerar nova baixa de estoque.' }
}

// SYNERGIAS V174 - BAIXA IDPOTENTE COM ESTOQUE NEGATIVO
export function baixarEstoquePedidoIdempotenteStorage(dados: {
  documentoOrigem: string
  itens: Array<{ codigoProduto?: string; codigoBarras?: string; descricao?: string; quantidade?: number }>
  usuario?: string
}) {
  const chave = String(dados.documentoOrigem || '').trim()
  if (!chave) return { ok: false, mensagem: 'Pedido sem número para controlar a baixa.', mensagens: ['Pedido sem número para controlar a baixa.'] }

  const existente = obterRegistroEntregaPedido(chave)
  if (existente) {
    return {
      ok: true,
      jaProcessado: true,
      registro: existente,
      mensagem: 'A entrega já havia sido processada. Nenhuma nova baixa foi realizada.',
      mensagens: ['A entrega já havia sido processada. Nenhuma nova baixa foi realizada.'],
    }
  }

  const agrupados = new Map<string, { codigoProduto: string; codigoBarras: string; descricao: string; quantidade: number }>()
  for (const item of dados.itens || []) {
    const codigo = String(item.codigoProduto || '').trim()
    const codigoBarras = String(item.codigoBarras || '').trim()
    const descricao = String(item.descricao || '').trim()
    const quantidade = Math.abs(numeroSeguro(item.quantidade))
    const chaveItem = codigo || codigoBarras || normalizarChaveProduto(descricao)
    if (!chaveItem || quantidade <= 0) continue
    const atual = agrupados.get(chaveItem)
    agrupados.set(chaveItem, {
      codigoProduto: codigo || atual?.codigoProduto || '',
      codigoBarras: codigoBarras || atual?.codigoBarras || '',
      descricao: descricao || atual?.descricao || 'Produto',
      quantidade: arredondarQuantidade((atual?.quantidade || 0) + quantidade),
    })
  }

  const itens = [...agrupados.values()]
  if (itens.length === 0) return { ok: false, mensagem: 'Pedido sem itens válidos para baixar.', mensagens: ['Pedido sem itens válidos para baixar.'] }

  const produtos = listarProdutosStorage()
  const erros: string[] = []
  const resolvidos = itens.map((item) => {
    const produto = localizarProduto(produtos, item)
    if (!produto) {
      erros.push(`Produto não encontrado: ${item.descricao}.`)
      return null
    }
    const estoqueAnterior = obterEstoqueProduto(produto)
    // V174: a entrega pode gerar estoque negativo. A movimentação continua
    // registrada com estoque anterior e estoque atual para auditoria.
    return { item, produto, estoqueAnterior }
  }).filter(Boolean) as Array<{ item: { codigoProduto: string; codigoBarras: string; descricao: string; quantidade: number }; produto: Produto; estoqueAnterior: number }>

  if (erros.length > 0) return { ok: false, mensagem: erros.join('\n'), mensagens: erros }

  const agora = new Date()
  const registroProcessando: RegistroEntregaPedido = {
    id: `entrega-${chave}-${Date.now()}`,
    documentoOrigem: chave,
    status: 'processando',
    data: agora.toISOString().slice(0, 10),
    hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    criadoEm: agora.toISOString(),
    itens: itens.map((item) => ({ produtoCodigo: item.codigoProduto, quantidade: item.quantidade })),
  }

  // Grava primeiro a trava idempotente. Mesmo com duplo clique, a próxima tentativa não baixa novamente.
  salvarRegistrosEntregaPedido([registroProcessando, ...listarRegistrosEntregaPedido()])

  const produtosAtualizados = produtos.map((produtoAtual) => {
    const resolvido = resolvidos.find(({ produto }) => mesmoProduto(produtoAtual, produto))
    if (!resolvido) return produtoAtual
    return aplicarEstoqueProduto(produtoAtual, resolvido.estoqueAnterior - resolvido.item.quantidade)
  })
  salvarProdutosStorage(produtosAtualizados)

  const novasMovimentacoes: EstoqueMovimentacao[] = resolvidos.map(({ item, produto, estoqueAnterior }) => ({
    id: gerarIdMovimentacao(),
    data: registroProcessando.data,
    hora: registroProcessando.hora,
    produtoId: String((produto as any).id || ''),
    produtoCodigo: String((produto as any).codigo || (produto as any).codigoBarras || item.codigoProduto || item.codigoBarras),
    produtoDescricao: String((produto as any).descricao || (produto as any).nome || item.descricao),
    tipo: 'saida',
    origem: 'pedido',
    quantidade: arredondarQuantidade(item.quantidade * -1),
    estoqueAnterior: arredondarQuantidade(estoqueAnterior),
    estoqueAtual: arredondarQuantidade(estoqueAnterior - item.quantidade),
    motivo: `Entrega do pedido ${chave}`,
    observacao: 'Baixa idempotente gerada pela confirmação de entrega.',
    usuario: dados.usuario || 'Synergias',
    documentoOrigem: chave,
    criadoEm: agora.toISOString(),
  }))
  salvarMovimentacoesEstoque([...novasMovimentacoes, ...listarMovimentacoesEstoque()].slice(0, 500))

  const concluido = { ...registroProcessando, status: 'concluida' as const }
  salvarRegistrosEntregaPedido([concluido, ...listarRegistrosEntregaPedido().filter((item) => item.id !== concluido.id)])

  return {
    ok: true,
    jaProcessado: false,
    registro: concluido,
    mensagem: 'Produtos entregues',
    mensagens: ['Produtos entregues'],
  }
}
