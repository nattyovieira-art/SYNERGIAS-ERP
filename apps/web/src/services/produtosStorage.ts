import type { Produto } from '../types/Produto'
import type { ItemVenda } from '../types/Venda'
import { definirColecaoMemoria, obterColecaoMemoria, sincronizarColecaoCentral, sincronizarColecaoCentralAgora } from './erpApi'


export type ResultadoVerificacaoEstoque = {
  ok: boolean
  mensagens: string[]
}

function gerarIdProduto() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `produto-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function textoSeguro(valor: unknown) {
  if (valor === undefined || valor === null) return ''
  return String(valor).trim()
}

function numeroSeguro(valor: unknown) {
  if (typeof valor === 'number') {
    return Number.isNaN(valor) ? 0 : valor
  }

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


function calcularPrecoMinimo(custo: number) {
  if (!Number.isFinite(custo) || custo <= 0) return 0
  return Math.ceil(custo * 1.3 * 100) / 100
}

function calcularMargemLucro(custo: number, venda: number) {
  if (!venda || venda <= 0) return 0
  return ((venda - custo) / venda) * 100
}

function somenteNumeros(valor: unknown) {
  return textoSeguro(valor).replace(/\D/g, '')
}

function gerarCodigoProdutoAutomatico(produtosExistentes: Produto[]) {
  const numeros = produtosExistentes
    .map((produto) => Number(somenteNumeros((produto as any).codigo)))
    .filter((numero) => !Number.isNaN(numero) && numero > 0)

  const maiorNumero = numeros.length > 0 ? Math.max(...numeros) : 1782785200000

  return String(maiorNumero + 1)
}

function obterCodigoProduto(produto: any, produtosExistentes: Produto[] = []) {
  const codigo =
    textoSeguro(produto?.codigo) ||
    textoSeguro(produto?.id) ||
    textoSeguro(produto?.codigoInterno) ||
    textoSeguro(produto?.codigoBarras) ||
    textoSeguro(produto?.sku) ||
    textoSeguro(produto?.referencia)

  if (codigo) return codigo

  return gerarCodigoProdutoAutomatico(produtosExistentes)
}

function obterDescricaoProdutoBase(produto: any) {
  return (
    textoSeguro(produto?.descricao) ||
    textoSeguro(produto?.nome) ||
    textoSeguro(produto?.nomeProduto) ||
    textoSeguro(produto?.produto) ||
    'Produto sem descrição'
  )
}

function normalizarProduto(produto: any, produtosExistentes: Produto[] = []): Produto {
  const codigo = obterCodigoProduto(produto, produtosExistentes)
  const id = textoSeguro(produto?.id) || codigo || gerarIdProduto()
  const descricao = obterDescricaoProdutoBase(produto)
  const quantidadePorEmbalagemCompra =
    numeroSeguro(produto?.quantidadePorEmbalagemCompra) ||
    (textoSeguro(produto?.codigoBarras).replace(/\D/g, '') === '7901210137' ? 8 : 1)

  const custoInformado = numeroSeguro(produto?.custo)
  const custoMedioAtual =
    numeroSeguro(produto?.custoMedioAtual) || custoInformado
  const custo = custoMedioAtual > 0 ? custoMedioAtual : custoInformado
  const ultimoCustoCompra =
    numeroSeguro(produto?.ultimoCustoCompra) || custoInformado
  const custoAnteriorUltimaCompra = numeroSeguro(
    produto?.custoAnteriorUltimaCompra,
  )
  const variacaoUltimoCustoPercentual = numeroSeguro(
    produto?.variacaoUltimoCustoPercentual,
  )
  const vendaVarejoInformada =
    numeroSeguro(produto?.vendaVarejo) ||
    numeroSeguro(produto?.valorVenda) ||
    numeroSeguro(produto?.precoVenda) ||
    numeroSeguro(produto?.precoUnitario) ||
    numeroSeguro(produto?.preco) ||
    numeroSeguro(produto?.valorUnitario) ||
    numeroSeguro(produto?.valor)

  const precoMinimo = calcularPrecoMinimo(custoMedioAtual || custo)
  const vendaVarejo = Math.max(vendaVarejoInformada, precoMinimo)
  const margemAutomaticaVarejo = Math.max(
    30,
    numeroSeguro(produto?.margemAutomaticaVarejo) || 30,
  )

  const vendaAtacado = Math.max(numeroSeguro(produto?.vendaAtacado), precoMinimo)

  const estoqueAtual =
    produto?.estoqueAtual !== undefined
      ? numeroSeguro(produto?.estoqueAtual)
      : produto?.estoque !== undefined
        ? numeroSeguro(produto?.estoque)
        : produto?.quantidadeEstoque !== undefined
          ? numeroSeguro(produto?.quantidadeEstoque)
          : produto?.saldoEstoque !== undefined
            ? numeroSeguro(produto?.saldoEstoque)
            : numeroSeguro(produto?.quantidade)

  const valorEstoqueAtual =
    produto?.valorEstoqueAtual !== undefined
      ? numeroSeguro(produto?.valorEstoqueAtual)
      : estoqueAtual * custoMedioAtual

  const historicoCustos = Array.isArray(produto?.historicoCustos)
    ? produto.historicoCustos.slice(0, 100)
    : []

  const agora = new Date().toISOString()

  return {
    ...produto,
    id,
    codigo,
    codigoBarras: textoSeguro(produto?.codigoBarras),
    codigoInterno: textoSeguro(produto?.codigoInterno),
    descricao,
    nome: textoSeguro(produto?.nome) || descricao,
    tipoItem: textoSeguro(produto?.tipoItem) || 'Produto',
    unidade: textoSeguro(produto?.unidade) || textoSeguro(produto?.unidadeMedida) || 'Unidade',
    categoria: textoSeguro(produto?.categoria),
    subcategoria: textoSeguro(produto?.subcategoria),
    marca: textoSeguro(produto?.marca),
    modelo: textoSeguro(produto?.modelo),
    tags: textoSeguro(produto?.tags),
    situacao: textoSeguro(produto?.situacao) || 'Ativo',
    imagem: textoSeguro(produto?.imagem),
    imagemUrl: textoSeguro(produto?.imagemUrl),
    quantidadePorEmbalagemCompra,

    custo,
    custoMedioAtual,
    ultimoCustoCompra,
    custoAnteriorUltimaCompra,
    variacaoUltimoCustoPercentual,
    valorEstoqueAtual,
    historicoCustos,
    margemAutomaticaVarejo,
    vendaVarejo,
    margemLucroVarejo: calcularMargemLucro(custoMedioAtual || custo, vendaVarejo),

    margemAutomaticaAtacado: Math.max(
      30,
      numeroSeguro(produto?.margemAutomaticaAtacado) || 30,
    ),
    vendaAtacado,
    margemLucroAtacado: calcularMargemLucro(custoMedioAtual || custo, vendaAtacado),

    quantidadeMinimaAtacado: numeroSeguro(produto?.quantidadeMinimaAtacado),

    movimentarEstoque:
      produto?.movimentarEstoque === undefined ? true : Boolean(produto?.movimentarEstoque),
    movimentarEstoqueComposicao: Boolean(produto?.movimentarEstoqueComposicao),
    tipoEstoque: textoSeguro(produto?.tipoEstoque) || 'Único',
    estoqueMinimo: numeroSeguro(produto?.estoqueMinimo),
    estoqueAtual,

    tipoFiscal: textoSeguro(produto?.tipoFiscal) || 'Mercadoria para Revenda',
    ncm: textoSeguro(produto?.ncm),
    origem: textoSeguro(produto?.origem) || '0 - Nacional',
    cest: textoSeguro(produto?.cest),
    classificacao: textoSeguro(produto?.classificacao) || 'Comum',

    habilitarPdv: Boolean(produto?.habilitarPdv),
    composicao: Array.isArray(produto?.composicao) ? produto.composicao : [],

    permiteFragmentacao: Boolean(produto?.permiteFragmentacao),
    unidadeFragmentada: textoSeguro(produto?.unidadeFragmentada),
    quantidadeFragmentada: numeroSeguro(produto?.quantidadeFragmentada),

    publicarLojaVirtual: Boolean(produto?.publicarLojaVirtual),
    descricaoLojaVirtual: textoSeguro(produto?.descricaoLojaVirtual),

    criadoEm: textoSeguro(produto?.criadoEm) || agora,
    atualizadoEm: agora,
  } as Produto
}

function salvarComSeguranca(produtos: Produto[]) {
  const normalizados: Produto[] = []
  produtos.forEach((produto) => {
    const produtoNormalizado = normalizarProduto(produto, normalizados)
    const indiceExistente = normalizados.findIndex((item) =>
      String((item as any).codigo) === String((produtoNormalizado as any).codigo) ||
      String((item as any).id) === String((produtoNormalizado as any).id),
    )
    if (indiceExistente >= 0) normalizados[indiceExistente] = { ...normalizados[indiceExistente], ...produtoNormalizado } as Produto
    else normalizados.push(produtoNormalizado)
  })
  definirColecaoMemoria('produtos', normalizados)
  sincronizarColecaoCentral('produtos', normalizados)
  return normalizados
}

export function listarProdutosStorage(): Produto[] {
  const produtos = obterColecaoMemoria<Produto>('produtos')
  const codigo67 = '7901211467'
  const codigo68 = '7901211468'
  const existe67 = produtos.some((item) => String((item as any).codigoBarras || (item as any).codigo || '') === codigo67)
  const produto68 = produtos.find((item) => String((item as any).codigoBarras || (item as any).codigo || '') === codigo68)

  if (!existe67 && produto68) {
    const agora = new Date().toISOString()
    const restaurado = {
      ...produto68,
      id: gerarIdProduto(),
      codigo: codigo67,
      codigoBarras: codigo67,
      codigoInterno: '',
      descricao: String((produto68 as any).descricao || '').replace(/PRETO/gi, 'AZUL'),
      nome: String((produto68 as any).nome || (produto68 as any).descricao || '').replace(/PRETO/gi, 'AZUL'),
      estoqueAtual: 0,
      valorEstoqueAtual: 0,
      historicoCustos: [],
      criadoEm: agora,
      atualizadoEm: agora,
    } as Produto
    const atualizados = [...produtos, restaurado]
    definirColecaoMemoria('produtos', atualizados)
    sincronizarColecaoCentral('produtos', atualizados)
    return atualizados
  }

  return produtos
}

export function salvarProdutosStorage(produtos: Produto[]) {
  return salvarComSeguranca(produtos)
}

export async function salvarProdutosStorageConfirmado(produtos: Produto[]) {
  const normalizados: Produto[] = []
  produtos.forEach((produto) => normalizados.push(normalizarProduto(produto, normalizados)))
  definirColecaoMemoria('produtos', normalizados)
  await sincronizarColecaoCentralAgora('produtos', normalizados)
  return normalizados
}

export function corrigirPrecosMinimosProdutosStorage() {
  const produtos = listarProdutosStorage()
  let corrigidos = 0

  const atualizados = produtos.map((produto) => {
    const custo = numeroSeguro(produto.custoMedioAtual) || numeroSeguro(produto.custo)
    const minimo = calcularPrecoMinimo(custo)
    const vendaAtual = numeroSeguro(produto.vendaVarejo)

    if (minimo <= 0 || vendaAtual >= minimo) {
      if (numeroSeguro(produto.margemAutomaticaVarejo) >= 30) return produto
    } else {
      corrigidos += 1
    }

    const vendaVarejo = Math.max(vendaAtual, minimo)

    return {
      ...produto,
      margemAutomaticaVarejo: Math.max(
        30,
        numeroSeguro(produto.margemAutomaticaVarejo) || 30,
      ),
      vendaVarejo,
      margemLucroVarejo: calcularMargemLucro(custo, vendaVarejo),
      atualizadoEm: new Date().toISOString(),
    } as Produto
  })

  if (corrigidos > 0 || atualizados.some((item, indice) => item !== produtos[indice])) {
    salvarComSeguranca(atualizados)
  }

  return corrigidos
}

export function buscarProdutoStorage(codigoOuId: string) {
  const chave = String(codigoOuId || '').trim()

  return (
    listarProdutosStorage().find((produto) => {
      const produtoAny = produto as any

      return (
        String(produtoAny.codigo || '') === chave ||
        String(produtoAny.id || '') === chave ||
        String(produtoAny.codigoInterno || '') === chave ||
        String(produtoAny.codigoBarras || '') === chave
      )
    }) || undefined
  )
}

export function salvarProdutoStorage(produto: Produto) {
  const produtos = listarProdutosStorage()
  let produtoNormalizado = normalizarProduto(produto, produtos)

  const conflitoDeIdentidade = produtos.find((item) => {
    const itemAny = item as any
    const novoAny = produtoNormalizado as any
    return String(itemAny.id || '') === String(novoAny.id || '') &&
      String(itemAny.codigo || itemAny.codigoBarras || '') !== String(novoAny.codigo || novoAny.codigoBarras || '')
  })

  if (conflitoDeIdentidade) {
    produtoNormalizado = {
      ...produtoNormalizado,
      id: gerarIdProduto(),
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    } as Produto
  }

  const existe = produtos.some((item) => {
    const itemAny = item as any
    const produtoAny = produtoNormalizado as any

    return (
      String(itemAny.codigo || '') === String(produtoAny.codigo || '') ||
      String(itemAny.id || '') === String(produtoAny.id || '')
    )
  })

  const atualizados = existe
    ? produtos.map((item) => {
        const itemAny = item as any
        const produtoAny = produtoNormalizado as any

        const mesmoProduto =
          String(itemAny.codigo || '') === String(produtoAny.codigo || '') ||
          String(itemAny.id || '') === String(produtoAny.id || '')

        if (!mesmoProduto) return item

        return {
          ...item,
          ...produtoNormalizado,
          criadoEm: itemAny.criadoEm || produtoAny.criadoEm,
          atualizadoEm: new Date().toISOString(),
        } as Produto
      })
    : [...produtos, produtoNormalizado]

  return salvarProdutosStorage(atualizados)
}

export async function repararProdutoCanetaAzul67Storage() {
  const codigoAzul = '7901211467'
  const codigoPreto = '7901211468'
  const produtos = listarProdutosStorage()
  const existeAzul = produtos.some((item) =>
    [item.id, item.codigo, item.codigoBarras].some((valor) => String(valor || '').replace(/\D/g, '') === codigoAzul),
  )
  if (existeAzul) return { reparado: false, motivo: 'produto_67_ja_existe' }

  const preto = produtos.find((item) =>
    [item.id, item.codigo, item.codigoBarras].some((valor) => String(valor || '').replace(/\D/g, '') === codigoPreto),
  )
  if (!preto) return { reparado: false, motivo: 'produto_68_nao_encontrado' }

  const agora = new Date().toISOString()
  const azul = {
    ...preto,
    id: codigoAzul,
    codigo: codigoAzul,
    codigoBarras: codigoAzul,
    codigoInterno: '',
    descricao: 'CANETA ESFEROGRÁFICA SIX 1.0MM AZUL AVULSA | BAZZE',
    nome: 'CANETA ESFEROGRÁFICA SIX 1.0MM AZUL AVULSA | BAZZE',
    criadoEm: agora,
    atualizadoEm: agora,
  } as Produto

  const atualizados = [...produtos, azul]
  definirColecaoMemoria('produtos', atualizados)
  await sincronizarColecaoCentralAgora('produtos', atualizados)
  return { reparado: true, produto: azul }
}

export function importarProdutosStorage(produtosImportados: Produto[]) {
  const produtosAtuais = listarProdutosStorage()
  const atualizados = [...produtosAtuais]

  produtosImportados.forEach((produtoImportado) => {
    const produtoNormalizado = normalizarProduto(produtoImportado, atualizados)
    const produtoAny = produtoNormalizado as any

    const indiceExistente = atualizados.findIndex((item) => {
      const itemAny = item as any

      return (
        String(itemAny.codigo || '') === String(produtoAny.codigo || '') ||
        String(itemAny.id || '') === String(produtoAny.id || '') ||
        (!!itemAny.codigoBarras &&
          !!produtoAny.codigoBarras &&
          String(itemAny.codigoBarras) === String(produtoAny.codigoBarras))
      )
    })

    if (indiceExistente >= 0) {
      atualizados[indiceExistente] = {
        ...atualizados[indiceExistente],
        ...produtoNormalizado,
        criadoEm:
          (atualizados[indiceExistente] as any).criadoEm ||
          (produtoNormalizado as any).criadoEm,
        atualizadoEm: new Date().toISOString(),
      } as Produto
    } else {
      atualizados.push(produtoNormalizado)
    }
  })

  return salvarProdutosStorage(atualizados)
}

export function substituirProdutosStorage(produtosNovos: Produto[]) {
  return salvarProdutosStorage(produtosNovos)
}

export function excluirProdutoStorage(codigoOuId: string) {
  const chave = String(codigoOuId || '').trim()

  const atualizados = listarProdutosStorage().filter((produto) => {
    const produtoAny = produto as any

    return (
      String(produtoAny.codigo || '') !== chave &&
      String(produtoAny.id || '') !== chave &&
      String(produtoAny.codigoInterno || '') !== chave &&
      String(produtoAny.codigoBarras || '') !== chave
    )
  })

  return salvarProdutosStorage(atualizados)
}

export function limparProdutosStorage() {
  definirColecaoMemoria('produtos', [])
  return []
}

function obterDescricaoProduto(produto: Produto, item?: ItemVenda) {
  return (
    item?.descricao ||
    (produto as any).descricao ||
    (produto as any).nome ||
    'Produto sem descrição'
  )
}

function obterEstoqueProduto(produto: Produto) {
  const produtoAny = produto as any

  if (produtoAny.estoqueAtual !== undefined) {
    return Number(produtoAny.estoqueAtual || 0)
  }

  if (produtoAny.estoque !== undefined) {
    return Number(produtoAny.estoque || 0)
  }

  if (produtoAny.quantidadeEstoque !== undefined) {
    return Number(produtoAny.quantidadeEstoque || 0)
  }

  if (produtoAny.saldoEstoque !== undefined) {
    return Number(produtoAny.saldoEstoque || 0)
  }

  if (produtoAny.quantidade !== undefined) {
    return Number(produtoAny.quantidade || 0)
  }

  return 0
}

function atualizarEstoqueProduto(produto: Produto, novoEstoque: number): Produto {
  const produtoAny = produto as any

  if (produtoAny.estoqueAtual !== undefined) {
    return {
      ...produto,
      estoqueAtual: novoEstoque,
    } as Produto
  }

  if (produtoAny.estoque !== undefined) {
    return {
      ...produto,
      estoque: novoEstoque,
    } as Produto
  }

  if (produtoAny.quantidadeEstoque !== undefined) {
    return {
      ...produto,
      quantidadeEstoque: novoEstoque,
    } as Produto
  }

  if (produtoAny.saldoEstoque !== undefined) {
    return {
      ...produto,
      saldoEstoque: novoEstoque,
    } as Produto
  }

  if (produtoAny.quantidade !== undefined) {
    return {
      ...produto,
      quantidade: novoEstoque,
    } as Produto
  }

  return {
    ...produto,
    estoqueAtual: novoEstoque,
  } as Produto
}

export function verificarEstoqueDisponivel(
  itens: ItemVenda[],
): ResultadoVerificacaoEstoque {
  const produtos = listarProdutosStorage()
  const mensagens: string[] = []

  itens.forEach((item) => {
    const produto = produtos.find((produtoAtual) => {
      const produtoAny = produtoAtual as any

      return (
        String(produtoAny.codigo || '') === String(item.codigoProduto || '') ||
        String(produtoAny.id || '') === String(item.codigoProduto || '') ||
        String(produtoAny.codigoBarras || '') === String(item.codigoProduto || '')
      )
    })

    if (!produto) {
      mensagens.push(
        `Produto não encontrado no estoque: ${item.descricao || item.codigoProduto}`,
      )
      return
    }

    const estoqueAtual = obterEstoqueProduto(produto)
    const quantidadePedido = Number(item.quantidade || 0)

    if (quantidadePedido <= 0) {
      mensagens.push(
        `Quantidade inválida para o produto: ${obterDescricaoProduto(produto, item)}`,
      )
      return
    }

    if (estoqueAtual < quantidadePedido) {
      mensagens.push(
        `Estoque insuficiente para ${obterDescricaoProduto(
          produto,
          item,
        )}. Estoque atual: ${estoqueAtual}. Pedido: ${quantidadePedido}.`,
      )
    }
  })

  return {
    ok: mensagens.length === 0,
    mensagens,
  }
}

export function baixarEstoquePedido(itens: ItemVenda[]) {
  const verificacao = verificarEstoqueDisponivel(itens)

  if (!verificacao.ok) {
    return {
      ok: false,
      mensagens: verificacao.mensagens,
      produtos: listarProdutosStorage(),
    }
  }

  const produtos = listarProdutosStorage()

  const produtosAtualizados = produtos.map((produto) => {
    const itemPedido = itens.find((item) => {
      const produtoAny = produto as any

      return (
        String(item.codigoProduto || '') === String(produtoAny.codigo || '') ||
        String(item.codigoProduto || '') === String(produtoAny.id || '') ||
        String(item.codigoProduto || '') === String(produtoAny.codigoBarras || '')
      )
    })

    if (!itemPedido) {
      return produto
    }

    const estoqueAtual = obterEstoqueProduto(produto)
    const quantidadePedido = Number(itemPedido.quantidade || 0)
    const novoEstoque = estoqueAtual - quantidadePedido

    return atualizarEstoqueProduto(produto, novoEstoque)
  })

  salvarProdutosStorage(produtosAtualizados)

  return {
    ok: true,
    mensagens: ['Estoque baixado com sucesso.'],
    produtos: produtosAtualizados,
  }
}
