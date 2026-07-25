import type { Compra, ItemCompra } from '../types/Compra'
import { buscarRegraFiscalConfirmada } from './regrasFiscaisStorage'

export type StatusAnaliseFiscal =
  | 'PENDENTE'
  | 'EM_ANALISE'
  | 'REVISAO_NECESSARIA'
  | 'CONFIRMADA'

export type ClassificacaoFiscalItem =
  | 'SEM_ADICIONAL_FISCAL'
  | 'ICMS_ST_JA_RETIDO'
  | 'ICMS_ST_A_RECOLHER_ESTIMADO'
  | 'ICMS_A_RECOLHER_ESTIMADO'
  | 'ANTECIPACAO_A_RECOLHER_ESTIMADO'
  | 'REVISAO_FISCAL_NECESSARIA'

export type DadosTributariosXmlItem = {
  ncm: string
  cest: string
  cfop: string
  origem: string
  cst: string
  csosn: string
  baseIcms: number
  aliquotaIcms: number
  valorIcms: number
  baseIcmsSt: number
  aliquotaIcmsSt: number
  valorIcmsSt: number
  valorIpi: number
  valorPis: number
  valorCofins: number
  frete: number
  desconto: number
  outros: number
}

export type MemoriaCalculoFiscalItem = {
  custoMercadoria: number
  freteRateado: number
  outrosCustosRateados: number
  ipiNaoRecuperavel: number
  icmsEstimado: number
  icmsStEstimado: number
  totalTributosNaoRecuperaveis: number
  custoRealTotal: number
  quantidadeConvertida: number
  custoRealUnitario: number
}

export type AnaliseFiscalItem = {
  itemId: string
  produtoCodigo: string
  descricao: string
  dados: DadosTributariosXmlItem
  classificacao: ClassificacaoFiscalItem
  motivos: string[]
  memoria: MemoriaCalculoFiscalItem
}

export type AnaliseFiscalCompra = {
  compraId: string
  status: StatusAnaliseFiscal
  itens: AnaliseFiscalItem[]
  pendencias: number
  atualizadoEm: string
  confirmadoEm?: string
}

const CHAVE_ANALISES = 'synergias_erp_analises_fiscais_entradas'

function numero(valor: unknown): number {
  const resultado = Number(valor || 0)
  return Number.isFinite(resultado) ? resultado : 0
}

function textoNo(elemento: Element | null, seletor: string): string {
  return elemento?.querySelector(seletor)?.textContent?.trim() || ''
}

function numeroNo(elemento: Element | null, seletor: string): number {
  const texto = textoNo(elemento, seletor).replace(',', '.')
  return numero(texto)
}

function parseXml(xml: string): Document | null {
  if (!xml.trim()) return null

  try {
    const documento = new DOMParser().parseFromString(xml, 'application/xml')

    if (documento.querySelector('parsererror')) {
      return null
    }

    return documento
  } catch {
    return null
  }
}

function obterDetPorIndice(xml: string, indice: number): Element | null {
  const documento = parseXml(xml)
  if (!documento) return null

  const itens = Array.from(documento.querySelectorAll('det'))
  return itens[indice] || null
}

function extrairDadosXml(
  compra: Compra,
  item: ItemCompra,
  indice: number,
): DadosTributariosXmlItem {
  const det = obterDetPorIndice(compra.xmlNFe || '', indice)

  return {
    ncm: textoNo(det, 'prod > NCM') || item.ncm || '',
    cest: textoNo(det, 'prod > CEST'),
    cfop: textoNo(det, 'prod > CFOP') || item.cfop || '',
    origem: textoNo(det, 'imposto > ICMS orig'),
    cst: textoNo(det, 'imposto > ICMS CST'),
    csosn: textoNo(det, 'imposto > ICMS CSOSN'),
    baseIcms: numeroNo(det, 'imposto > ICMS vBC'),
    aliquotaIcms: numeroNo(det, 'imposto > ICMS pICMS'),
    valorIcms: numeroNo(det, 'imposto > ICMS vICMS'),
    baseIcmsSt: numeroNo(det, 'imposto > ICMS vBCST'),
    aliquotaIcmsSt: numeroNo(det, 'imposto > ICMS pICMSST'),
    valorIcmsSt: numeroNo(det, 'imposto > ICMS vICMSST'),
    valorIpi: numeroNo(det, 'imposto > IPI vIPI'),
    valorPis: numeroNo(det, 'imposto > PIS vPIS'),
    valorCofins: numeroNo(det, 'imposto > COFINS vCOFINS'),
    frete: numeroNo(det, 'prod > vFrete') || numero(item.frete),
    desconto: numeroNo(det, 'prod > vDesc') || numero(item.desconto),
    outros: numeroNo(det, 'prod > vOutro'),
  }
}

function calcularRateio(valorTotal: number, itemTotal: number, subtotal: number): number {
  if (valorTotal <= 0 || itemTotal <= 0 || subtotal <= 0) return 0
  return valorTotal * (itemTotal / subtotal)
}

function classificarItem(
  dados: DadosTributariosXmlItem,
): {
  classificacao: ClassificacaoFiscalItem
  motivos: string[]
} {
  const motivos: string[] = []

  if (!dados.ncm) motivos.push('NCM não informado.')
  if (!dados.cfop) motivos.push('CFOP não informado.')
  if (!dados.cst && !dados.csosn) motivos.push('CST/CSOSN não identificado.')

  if (motivos.length > 0) {
    return {
      classificacao: 'REVISAO_FISCAL_NECESSARIA',
      motivos,
    }
  }

  const regra = buscarRegraFiscalConfirmada({
    ncm: dados.ncm,
    cest: dados.cest,
    ufDestino: 'RS',
    destinacao: 'REVENDA',
  })

  if (regra) {
    if (regra.tratamento === 'SEM_ADICIONAL_FISCAL') {
      return {
        classificacao: 'SEM_ADICIONAL_FISCAL',
        motivos: [
          `Regra fiscal confirmada aplicada: ${regra.descricao}.`,
        ],
      }
    }

    if (regra.tratamento === 'ICMS_ST_JA_RETIDO') {
      return {
        classificacao: 'ICMS_ST_JA_RETIDO',
        motivos: [
          `Regra fiscal confirmada aplicada: ${regra.descricao}.`,
        ],
      }
    }

    return {
      classificacao: 'REVISAO_FISCAL_NECESSARIA',
      motivos: [
        `Regra fiscal confirmada identificada: ${regra.descricao}.`,
        `Tratamento previsto: ${regra.tratamento.replaceAll('_', ' ')}.`,
        'O tratamento foi reconhecido, mas o cálculo monetário automático ainda exige a futura fórmula tributária da regra.',
      ],
    }
  }

  if (dados.valorIcmsSt > 0 || dados.cst === '60' || dados.csosn === '500') {
    return {
      classificacao: 'ICMS_ST_JA_RETIDO',
      motivos: [
        'O XML indica ICMS-ST destacado ou situação tributária compatível com ST já retida.',
      ],
    }
  }

  return {
    classificacao: 'REVISAO_FISCAL_NECESSARIA',
    motivos: [
      'Os dados fiscais básicos foram identificados, mas ainda não existe regra NCM/CEST confirmada para concluir o tratamento automaticamente.',
    ],
  }
}

function criarAnaliseItem(
  compra: Compra,
  item: ItemCompra,
  indice: number,
): AnaliseFiscalItem {
  const dados = extrairDadosXml(compra, item, indice)
  const totalFiscal = numero(item.totalFiscal ?? item.total)
  const subtotal = numero(compra.subtotal) || compra.itens.reduce(
    (soma, atual) => soma + numero(atual.totalFiscal ?? atual.total),
    0,
  )

  const freteRateado = dados.frete || calcularRateio(
    numero(compra.frete),
    totalFiscal,
    subtotal,
  )

  const outrosCustosRateados = dados.outros || calcularRateio(
    numero(compra.outrosCustos),
    totalFiscal,
    subtotal,
  )

  const quantidadeConvertida = numero(
    item.quantidadeConvertida ?? item.quantidadeFiscal ?? item.quantidade,
  )

  const custoMercadoria = Math.max(
    0,
    totalFiscal - numero(dados.desconto),
  )

  // V1 conservadora:
  // ICMS, ST e antecipação só podem entrar automaticamente no custo quando houver
  // regra fiscal confirmada. Nesta primeira tela, valores do XML ficam visíveis e
  // a ausência de regra NCM/CEST direciona o item para revisão.
  const ipiNaoRecuperavel = dados.valorIpi
  // Regra confirmada pelo usuário: o ICMS destacado na NF-e de compra
  // compõe o custo do produto.
  const icmsEstimado = dados.valorIcms
  const icmsStEstimado = dados.valorIcmsSt
  const totalTributosNaoRecuperaveis =
    ipiNaoRecuperavel + icmsEstimado + icmsStEstimado

  const custoRealTotal =
    custoMercadoria +
    freteRateado +
    outrosCustosRateados +
    totalTributosNaoRecuperaveis

  const classificacao = classificarItem(dados)

  return {
    itemId: item.id,
    produtoCodigo: item.produtoCodigo,
    descricao: item.descricao,
    dados,
    classificacao: classificacao.classificacao,
    motivos: classificacao.motivos,
    memoria: {
      custoMercadoria,
      freteRateado,
      outrosCustosRateados,
      ipiNaoRecuperavel,
      icmsEstimado,
      icmsStEstimado,
      totalTributosNaoRecuperaveis,
      custoRealTotal,
      quantidadeConvertida,
      custoRealUnitario:
        quantidadeConvertida > 0 ? custoRealTotal / quantidadeConvertida : 0,
    },
  }
}

export function listarAnalisesFiscaisStorage(): AnaliseFiscalCompra[] {
  try {
    const dados = localStorage.getItem(CHAVE_ANALISES)
    if (!dados) return []

    const analises = JSON.parse(dados) as AnaliseFiscalCompra[]
    return Array.isArray(analises) ? analises : []
  } catch {
    return []
  }
}

export function buscarAnaliseFiscalStorage(
  compraId: string,
): AnaliseFiscalCompra | undefined {
  return listarAnalisesFiscaisStorage().find(
    (analise) => analise.compraId === compraId,
  )
}

function salvarAnaliseFiscalStorage(analise: AnaliseFiscalCompra): void {
  const analises = listarAnalisesFiscaisStorage()
  const indice = analises.findIndex(
    (item) => item.compraId === analise.compraId,
  )

  if (indice >= 0) {
    analises[indice] = analise
  } else {
    analises.unshift(analise)
  }

  localStorage.setItem(CHAVE_ANALISES, JSON.stringify(analises))
}

export function gerarAnaliseFiscalCompra(
  compra: Compra,
): AnaliseFiscalCompra {
  const anterior = buscarAnaliseFiscalStorage(compra.id)

  const itens = compra.itens.map((item, indice) =>
    criarAnaliseItem(compra, item, indice),
  )

  const pendencias = itens.filter(
    (item) => item.classificacao === 'REVISAO_FISCAL_NECESSARIA',
  ).length

  const analise: AnaliseFiscalCompra = {
    compraId: compra.id,
    status:
      anterior?.status === 'CONFIRMADA'
        ? 'CONFIRMADA'
        : pendencias > 0
          ? 'REVISAO_NECESSARIA'
          : 'EM_ANALISE',
    itens,
    pendencias,
    atualizadoEm: new Date().toISOString(),
    confirmadoEm: anterior?.confirmadoEm,
  }

  salvarAnaliseFiscalStorage(analise)

  return analise
}

export function confirmarAnaliseFiscalCompra(
  compra: Compra,
): AnaliseFiscalCompra {
  const analise = gerarAnaliseFiscalCompra(compra)

  if (analise.pendencias > 0) {
    throw new Error(
      'Ainda existem itens com revisão fiscal necessária. A análise não pode ser confirmada.',
    )
  }

  const confirmada: AnaliseFiscalCompra = {
    ...analise,
    status: 'CONFIRMADA',
    atualizadoEm: new Date().toISOString(),
    confirmadoEm: new Date().toISOString(),
  }

  salvarAnaliseFiscalStorage(confirmada)

  return confirmada
}
