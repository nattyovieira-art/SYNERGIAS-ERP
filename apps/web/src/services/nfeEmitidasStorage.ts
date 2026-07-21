import type { Produto } from '../types/Produto'
import type { ItemVenda, Venda } from '../types/Venda'

import { listarProdutosStorage } from './produtosStorage'
import {
  listarVendasStorage,
  salvarVendasStorage,
} from './vendasStorage'

const CHAVE_ULT_NSU_NFE_EMITIDAS =
  'synergias_erp_nfe_emitidas_ult_nsu'

const CHAVE_MAPA_PRODUTOS_HISTORICOS =
  'synergias_erp_produtos_historicos_mapa'

export type MapaProdutoHistorico = {
  chaveHistorica: string
  codigoHistorico: string
  descricaoHistorica: string
  produtoCodigoAtual: string
  produtoDescricaoAtual: string
  criadoEm: string
  atualizadoEm: string
}

export type PendenciaProdutoHistorico = {
  chaveHistorica: string
  codigoHistorico: string
  descricaoHistorica: string
  ocorrencias: number
}

export type ResultadoImportacaoPedidosHistoricos = {
  importados: number
  duplicados: number
  itensVinculadosAutomaticamente: number
  itensVinculadosPorMapa: number
  itensPendentes: number
}

function texto(valor: unknown) {
  return String(valor ?? '').trim()
}

function somenteNumeros(valor: unknown) {
  return texto(valor).replace(/\D/g, '')
}

export function normalizarDescricaoProdutoHistorico(valor: unknown) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\bLITROS?\b/g, ' L ')
    .replace(/\bLTS?\b/g, ' L ')
    .replace(/(\d)\s*LT\b/g, '$1 L')
    .replace(/(\d)\s*L\b/g, '$1 L')
    .replace(/\bUNIDADES?\b/g, ' UN ')
    .replace(/\bUND\b/g, ' UN ')
    .replace(/\bUNID\b/g, ' UN ')
    .replace(/\bCAIXAS?\b/g, ' CX ')
    .replace(/\bPACOTES?\b/g, ' PCT ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function criarChaveHistorica(item: ItemVenda) {
  const codigoHistorico = texto(
    item.codigoProdutoHistorico || item.codigoProduto,
  )
  const descricaoHistorica = texto(
    item.descricaoHistorica || item.descricao,
  )

  return (
    texto(item.chaveProdutoHistorico) ||
    `${codigoHistorico}::${descricaoHistorica}`
  )
}

function listarMapaProdutosHistoricos(): MapaProdutoHistorico[] {
  try {
    const dados = localStorage.getItem(CHAVE_MAPA_PRODUTOS_HISTORICOS)

    if (!dados) return []

    const mapa = JSON.parse(dados) as MapaProdutoHistorico[]

    return Array.isArray(mapa) ? mapa : []
  } catch {
    return []
  }
}

function salvarMapaProdutosHistoricos(mapa: MapaProdutoHistorico[]) {
  localStorage.setItem(
    CHAVE_MAPA_PRODUTOS_HISTORICOS,
    JSON.stringify(mapa),
  )
}

function localizarProdutoPorCodigo(
  produtos: Produto[],
  codigo: string,
) {
  return produtos.find(
    (produto) => String(produto.codigo) === String(codigo),
  )
}

function localizarProdutoPorDescricaoExata(
  produtos: Produto[],
  descricao: string,
) {
  const descricaoNormalizada =
    normalizarDescricaoProdutoHistorico(descricao)

  if (!descricaoNormalizada) return undefined

  const encontrados = produtos.filter(
    (produto) =>
      normalizarDescricaoProdutoHistorico(produto.descricao) ===
      descricaoNormalizada,
  )

  return encontrados.length === 1 ? encontrados[0] : undefined
}

function distanciaLevenshtein(a: string, b: string) {
  const linhas = a.length + 1
  const colunas = b.length + 1
  const matriz = Array.from({ length: linhas }, () =>
    Array<number>(colunas).fill(0),
  )

  for (let i = 0; i < linhas; i += 1) matriz[i][0] = i
  for (let j = 0; j < colunas; j += 1) matriz[0][j] = j

  for (let i = 1; i < linhas; i += 1) {
    for (let j = 1; j < colunas; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      matriz[i][j] = Math.min(
        matriz[i - 1][j] + 1,
        matriz[i][j - 1] + 1,
        matriz[i - 1][j - 1] + custo,
      )
    }
  }

  return matriz[a.length][b.length]
}

function calcularSimilaridadeDescricao(a: string, b: string) {
  if (!a || !b) return 0
  if (a === b) return 1

  const maior = Math.max(a.length, b.length)
  const scoreTexto =
    maior === 0 ? 1 : 1 - distanciaLevenshtein(a, b) / maior

  const tokensA = new Set(a.split(' ').filter(Boolean))
  const tokensB = new Set(b.split(' ').filter(Boolean))
  const intersecao = [...tokensA].filter((token) =>
    tokensB.has(token),
  ).length
  const uniao = new Set([...tokensA, ...tokensB]).size
  const scoreTokens = uniao > 0 ? intersecao / uniao : 0

  return scoreTexto * 0.65 + scoreTokens * 0.35
}

function localizarProdutoPorDescricaoSemelhante(
  produtos: Produto[],
  descricao: string,
) {
  const historica = normalizarDescricaoProdutoHistorico(descricao)
  if (!historica) return undefined

  const classificados = produtos
    .map((produto) => ({
      produto,
      score: calcularSimilaridadeDescricao(
        historica,
        normalizarDescricaoProdutoHistorico(produto.descricao),
      ),
    }))
    .sort((a, b) => b.score - a.score)

  const melhor = classificados[0]
  const segundo = classificados[1]

  if (!melhor || melhor.score < 0.84) return undefined
  if (segundo && melhor.score - segundo.score < 0.06) return undefined

  return melhor.produto
}

function aplicarVinculoNoItem(
  item: ItemVenda,
  produto: Produto,
  origem: 'MAPA_HISTORICO' | 'DESCRICAO_NORMALIZADA',
): ItemVenda {
  return {
    ...item,
    codigoProdutoHistorico:
      item.codigoProdutoHistorico || item.codigoProduto || '',
    descricaoHistorica:
      item.descricaoHistorica || item.descricao || '',
    chaveProdutoHistorico: criarChaveHistorica(item),
    codigoProduto: String(produto.codigo || ''),
    codigoBarras: produto.codigoBarras || item.codigoBarras || '',
    descricao: produto.descricao || item.descricao,
    produtoVinculado: true,
    vinculoProdutoOrigem: origem,
  }
}

function prepararItemHistorico(
  item: ItemVenda,
  produtos: Produto[],
  mapa: MapaProdutoHistorico[],
): {
  item: ItemVenda
  automatico: boolean
  porMapa: boolean
} {
  const chaveHistorica = criarChaveHistorica(item)

  const itemBase: ItemVenda = {
    ...item,
    codigoProdutoHistorico:
      item.codigoProdutoHistorico || item.codigoProduto || '',
    descricaoHistorica:
      item.descricaoHistorica || item.descricao || '',
    chaveProdutoHistorico: chaveHistorica,
  }

  const vinculoSalvo = mapa.find(
    (vinculo) => vinculo.chaveHistorica === chaveHistorica,
  )

  if (vinculoSalvo) {
    const produto = localizarProdutoPorCodigo(
      produtos,
      vinculoSalvo.produtoCodigoAtual,
    )

    if (produto) {
      return {
        item: aplicarVinculoNoItem(
          itemBase,
          produto,
          'MAPA_HISTORICO',
        ),
        automatico: false,
        porMapa: true,
      }
    }
  }

  const descricaoParaVinculo =
    itemBase.descricaoHistorica || itemBase.descricao
  const produtoPorDescricao =
    localizarProdutoPorDescricaoExata(
      produtos,
      descricaoParaVinculo,
    ) ||
    localizarProdutoPorDescricaoSemelhante(
      produtos,
      descricaoParaVinculo,
    )

  if (produtoPorDescricao) {
    return {
      item: aplicarVinculoNoItem(
        itemBase,
        produtoPorDescricao,
        'DESCRICAO_NORMALIZADA',
      ),
      automatico: true,
      porMapa: false,
    }
  }

  return {
    item: {
      ...itemBase,
      codigoProduto:
        itemBase.codigoProdutoHistorico || itemBase.codigoProduto,
      descricao:
        itemBase.descricaoHistorica || itemBase.descricao,
      produtoVinculado: false,
      vinculoProdutoOrigem: 'NAO_VINCULADO',
    },
    automatico: false,
    porMapa: false,
  }
}

function prepararPedidoHistorico(
  pedido: Venda,
  produtos: Produto[],
  mapa: MapaProdutoHistorico[],
) {
  let automaticos = 0
  let porMapa = 0
  let pendentes = 0

  const itens = pedido.itens.map((item) => {
    const resultado = prepararItemHistorico(item, produtos, mapa)

    if (resultado.automatico) automaticos += 1
    if (resultado.porMapa) porMapa += 1
    if (!resultado.item.produtoVinculado) pendentes += 1

    return resultado.item
  })

  return {
    pedido: {
      ...pedido,
      tipo: 'Pedido',
      statusPedido: 'Concluído',
      statusNotaFiscal: 'Autorizada',
      estoqueBaixado: false,
      movimentarEstoqueHistorico: false,
      movimentacaoEstoqueHistoricaAutorizada: false,
      importacaoHistorica: true,
      itens,
      atualizadoEm: new Date().toISOString(),
    } as Venda,
    automaticos,
    porMapa,
    pendentes,
  }
}

export function importarPedidosHistoricosNFeStorage(
  pedidosImportados: Venda[],
): ResultadoImportacaoPedidosHistoricos {
  const vendasAtuais = listarVendasStorage()
  const produtos = listarProdutosStorage()
  const mapa = listarMapaProdutosHistoricos()

  const chavesNFeExistentes = new Set(
    vendasAtuais
      .map((venda) => texto(venda.chaveAcessoNotaFiscal))
      .filter(Boolean),
  )

  const numerosNFeExistentes = new Set(
    vendasAtuais
      .filter((venda) => venda.tipo === 'Pedido')
      .map(
        (venda) =>
          `${texto(venda.serieNotaFiscal)}::${texto(
            venda.numeroNotaFiscal,
          )}`,
      )
      .filter((valor) => valor !== '::'),
  )

  let importados = 0
  let duplicados = 0
  let itensVinculadosAutomaticamente = 0
  let itensVinculadosPorMapa = 0
  let itensPendentes = 0

  const novosPedidos: Venda[] = []

  for (const pedidoRecebido of pedidosImportados) {
    const chaveAcesso = texto(
      pedidoRecebido.chaveAcessoNotaFiscal,
    )
    const chaveNumero = `${texto(
      pedidoRecebido.serieNotaFiscal,
    )}::${texto(pedidoRecebido.numeroNotaFiscal)}`

    const duplicado =
      Boolean(
        chaveAcesso && chavesNFeExistentes.has(chaveAcesso),
      ) ||
      Boolean(
        chaveNumero !== '::' &&
          numerosNFeExistentes.has(chaveNumero),
      )

    if (duplicado) {
      duplicados += 1
      continue
    }

    const preparado = prepararPedidoHistorico(
      pedidoRecebido,
      produtos,
      mapa,
    )

    novosPedidos.push(preparado.pedido)
    itensVinculadosAutomaticamente += preparado.automaticos
    itensVinculadosPorMapa += preparado.porMapa
    itensPendentes += preparado.pendentes
    importados += 1

    if (chaveAcesso) {
      chavesNFeExistentes.add(chaveAcesso)
    }

    if (chaveNumero !== '::') {
      numerosNFeExistentes.add(chaveNumero)
    }
  }

  if (novosPedidos.length > 0) {
    salvarVendasStorage([...vendasAtuais, ...novosPedidos])
  }

  return {
    importados,
    duplicados,
    itensVinculadosAutomaticamente,
    itensVinculadosPorMapa,
    itensPendentes,
  }
}

export type AmbienteNFeEmitidas = 'HOMOLOGACAO' | 'PRODUCAO'

function chaveUltNsuPorAmbiente(ambiente: AmbienteNFeEmitidas) {
  return `${CHAVE_ULT_NSU_NFE_EMITIDAS}_${ambiente.toLowerCase()}`
}

export function obterUltNSUNFeEmitidasStorage(
  ambiente: AmbienteNFeEmitidas = 'HOMOLOGACAO',
) {
  return (
    localStorage.getItem(chaveUltNsuPorAmbiente(ambiente)) ||
    '000000000000000'
  )
}

export function salvarUltNSUNFeEmitidasStorage(
  ultNSU: string,
  ambiente: AmbienteNFeEmitidas = 'HOMOLOGACAO',
) {
  localStorage.setItem(
    chaveUltNsuPorAmbiente(ambiente),
    somenteNumeros(ultNSU || '0')
      .padStart(15, '0')
      .slice(-15),
  )
}

export function listarPendenciasProdutosHistoricos(): PendenciaProdutoHistorico[] {
  const mapa = new Map<string, PendenciaProdutoHistorico>()

  listarVendasStorage()
    .filter(
      (venda) =>
        venda.tipo === 'Pedido' && venda.importacaoHistorica,
    )
    .forEach((venda) => {
      venda.itens.forEach((item) => {
        if (item.produtoVinculado) return

        const chaveHistorica = criarChaveHistorica(item)
        const existente = mapa.get(chaveHistorica)

        if (existente) {
          existente.ocorrencias += 1
          return
        }

        mapa.set(chaveHistorica, {
          chaveHistorica,
          codigoHistorico: texto(
            item.codigoProdutoHistorico ||
              item.codigoProduto,
          ),
          descricaoHistorica: texto(
            item.descricaoHistorica || item.descricao,
          ),
          ocorrencias: 1,
        })
      })
    })

  return Array.from(mapa.values()).sort((a, b) =>
    a.descricaoHistorica.localeCompare(
      b.descricaoHistorica,
      'pt-BR',
    ),
  )
}

export function vincularProdutoHistoricoStorage(
  chaveHistorica: string,
  produtoCodigoAtual: string,
) {
  const produtos = listarProdutosStorage()
  const produto = localizarProdutoPorCodigo(
    produtos,
    produtoCodigoAtual,
  )

  if (!produto) {
    throw new Error('Produto atual não encontrado.')
  }

  const vendas = listarVendasStorage()
  let codigoHistorico = ''
  let descricaoHistorica = ''

  const vendasAtualizadas = vendas.map((venda) => {
    if (
      venda.tipo !== 'Pedido' ||
      !venda.importacaoHistorica
    ) {
      return venda
    }

    return {
      ...venda,
      itens: venda.itens.map((item) => {
        if (criarChaveHistorica(item) !== chaveHistorica) {
          return item
        }

        codigoHistorico =
          codigoHistorico ||
          texto(
            item.codigoProdutoHistorico ||
              item.codigoProduto,
          )

        descricaoHistorica =
          descricaoHistorica ||
          texto(
            item.descricaoHistorica || item.descricao,
          )

        return aplicarVinculoNoItem(
          item,
          produto,
          'MAPA_HISTORICO',
        )
      }),
      atualizadoEm: new Date().toISOString(),
    } as Venda
  })

  salvarVendasStorage(vendasAtualizadas)

  const mapa = listarMapaProdutosHistoricos()
  const agora = new Date().toISOString()
  const indice = mapa.findIndex(
    (item) => item.chaveHistorica === chaveHistorica,
  )

  const vinculo: MapaProdutoHistorico = {
    chaveHistorica,
    codigoHistorico,
    descricaoHistorica,
    produtoCodigoAtual: String(produto.codigo || ''),
    produtoDescricaoAtual: produto.descricao || '',
    criadoEm:
      indice >= 0 ? mapa[indice].criadoEm : agora,
    atualizadoEm: agora,
  }

  if (indice >= 0) {
    mapa[indice] = vinculo
  } else {
    mapa.push(vinculo)
  }

  salvarMapaProdutosHistoricos(mapa)

  return vinculo
}

export function contarVinculosProdutosHistoricos() {
  return listarMapaProdutosHistoricos().length
}
