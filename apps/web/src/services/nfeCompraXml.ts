import type { Compra, ItemCompra } from '../types/Compra'
import type { Produto } from '../types/Produto'

const num = (value: string | null | undefined) => {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const text = (root: ParentNode, name: string) =>
  root.querySelector(name)?.textContent?.trim() || ''

const digits = (value: unknown) => String(value || '').replace(/\D/g, '')

const normalize = (value: unknown) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]+/gi, ' ').trim().toUpperCase()

export function inferirFatorEmbalagemNFe(descricao: unknown, unidade: unknown) {
  const unidadeFiscal = String(unidade || '').trim()
  const texto = normalize(descricao)

  if (/^(FD|FARDO)$/i.test(unidadeFiscal)) {
    const composicao = texto.match(
      /\b0*(\d+)\s*X\s*0*(\d+)\s*C\s*0*(\d+)\s*ROLOS?\b/,
    )
    if (composicao) {
      const volumes = Number(composicao[1])
      const unidadesPorVolume = Number(composicao[2])
      const total = Number(composicao[3])
      if (
        volumes > 1 &&
        unidadesPorVolume > 0 &&
        volumes * unidadesPorVolume === total
      ) {
        return volumes
      }
    }
    return 1
  }

  if (!/^(CX|CAIXA)$/i.test(unidadeFiscal)) return 1
  const fatores = [...texto.matchAll(/\bC\s*0*(\d+)\s*(?:BOB(?:INA)?S?|REFIS?|REFIL|ROLOS?)\b/g)]
    .map((achado) => Number(achado[1]))
    .filter((valor) => Number.isFinite(valor) && valor > 1)
  return fatores.at(-1) || 1
}

function matchProduct(products: Produto[], eanTrib: string, eanCom: string, description: string) {
  const barcode = (product: Produto) => digits(product.codigoBarras || product.codigo || product.id)
  let candidates = products.filter((product) => eanTrib && barcode(product) === digits(eanTrib))
  if (candidates.length === 1) return { product: candidates[0], type: 'EAN_TRIBUTAVEL' as const }
  candidates = products.filter((product) => eanCom && barcode(product) === digits(eanCom))
  if (candidates.length === 1) return { product: candidates[0], type: 'EAN_COMERCIAL' as const }
  const target = normalize(description)
  candidates = products.filter((product) => normalize(product.descricao || product.nome) === target)
  if (candidates.length === 1) return { product: candidates[0], type: 'DESCRICAO' as const }
  return { product: undefined, type: 'NAO_VINCULADO' as const }
}

export function parseNFeCompraXml(xml: string, products: Produto[], numeroCompra: string): Compra {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('XML inválido ou corrompido.')
  const inf = document.querySelector('infNFe')
  if (!inf) throw new Error('O arquivo não contém uma NF-e válida.')
  const key = (inf.getAttribute('Id') || '').replace(/^NFe/, '') || text(document, 'chNFe')
  if (key.length !== 44) throw new Error('Chave de acesso da NF-e inválida.')
  const emit = inf.querySelector('emit')!
  const total = inf.querySelector('ICMSTot')!
  const billing = inf.querySelector('cobr fat')
  const installments = Array.from(inf.querySelectorAll('cobr dup'))
  const paymentCode = text(inf, 'pag detPag tPag')
  const protocol = document.querySelector('protNFe infProt')

  const items = Array.from(inf.querySelectorAll(':scope > det')).map((detail, index): ItemCompra => {
    const productXml = detail.querySelector('prod')!
    const description = text(productXml, 'xProd')
    const qCom = num(text(productXml, 'qCom'))
    const qTrib = num(text(productXml, 'qTrib'))
    const unitCom = text(productXml, 'uCom') || 'UN'
    const unitTrib = text(productXml, 'uTrib') || unitCom
    const eanCom = text(productXml, 'cEAN')
    const eanTrib = text(productXml, 'cEANTrib')
    const matched = matchProduct(products, eanTrib, eanCom, description)
    const factorXml = qCom > 0 && qTrib > 0 ? qTrib / qCom : 1
    const factorProduct = Math.max(1, Number(matched.product?.quantidadePorEmbalagemCompra || 1))
    const factorDescription = inferirFatorEmbalagemNFe(description, unitCom)
    const factor = Math.max(factorXml, factorProduct, factorDescription)
    const convertedQty = qCom * factor
    const st = num(text(detail, 'vICMSST'))
    const ipi = num(text(detail, 'vIPI'))
    const productValue = num(text(productXml, 'vProd'))
    const finalValue = productValue + st + ipi
    const convertedUnit = factor > 1 ? 'PACOTE' : unitTrib

    return {
      id: `xml-${key}-${index + 1}`,
      produtoCodigo: matched.product?.codigo || '',
      descricao: description,
      unidade: unitCom,
      quantidade: qCom,
      custoUnitario: num(text(productXml, 'vUnCom')),
      total: productValue,
      codigoFornecedor: text(productXml, 'cProd'),
      gtin: eanTrib || eanCom,
      eanComercial: eanCom,
      eanTributavel: eanTrib,
      ncm: text(productXml, 'NCM'),
      cfop: text(productXml, 'CFOP'),
      icms: num(text(detail, 'vICMS')),
      icmsSt: st,
      ipi,
      difal: 0,
      unidadeFiscal: unitCom,
      quantidadeFiscal: qCom,
      custoUnitarioFiscal: num(text(productXml, 'vUnCom')),
      totalFiscal: productValue,
      unidadeTributavel: unitTrib,
      quantidadeTributavel: qTrib,
      valorUnitarioTributavel: num(text(productXml, 'vUnTrib')),
      unidadeControle: convertedUnit,
      fatorConversao: factor,
      quantidadeConvertida: convertedQty,
      custoFinalItem: finalValue,
      custoUnitarioConvertido: convertedQty ? finalValue / convertedQty : 0,
      impostos: st + ipi,
      incluidoNoSistema: true,
      correspondencia: matched.type,
    }
  })

  const issuedAt = text(inf, 'ide dhEmi')
  const now = new Date().toISOString()
  const fiscalValue = num(text(total, 'vNF'))
  const fiscalDiscount = num(text(total, 'vDesc'))
  const financialDiscount = fiscalDiscount || (billing ? num(text(billing, 'vDesc')) : 0)
  const liquidValue = billing ? num(text(billing, 'vLiq')) : fiscalValue
  const productBase = items.reduce((sum, item) => sum + num(String(item.totalFiscal)), 0)
  let allocatedDiscount = 0
  const itemsWithDiscount = items.map((item, index) => {
    const itemDiscount = financialDiscount > 0
      ? index === items.length - 1
        ? financialDiscount - allocatedDiscount
        : Number((financialDiscount * num(String(item.totalFiscal)) / productBase).toFixed(2))
      : 0
    allocatedDiscount += itemDiscount
    const finalValue = Math.max(0, num(String(item.custoFinalItem)) - itemDiscount)
    return {
      ...item,
      descontoRateado: itemDiscount,
      custoFinalItem: finalValue,
      custoUnitarioConvertido: num(String(item.quantidadeConvertida)) > 0
        ? finalValue / num(String(item.quantidadeConvertida))
        : 0,
    }
  })
  const paymentInstallments = installments.map((installment, index) => ({
    numero: text(installment, 'nDup') || String(index + 1).padStart(3, '0'),
    vencimento: text(installment, 'dVenc'),
    valor: num(text(installment, 'vDup')),
  }))
  return {
    id: `xml-${key}`,
    numeroCompra,
    dataEmissao: issuedAt.slice(0, 10),
    previsaoEntrega: issuedAt.slice(0, 10),
    fornecedorCodigo: digits(text(emit, 'CNPJ')),
    fornecedorNome: text(emit, 'xNome'),
    fornecedorDocumento: digits(text(emit, 'CNPJ')),
    fornecedorEmail: '',
    fornecedorTelefone: text(emit, 'enderEmit fone'),
    fornecedorEndereco: [text(emit, 'enderEmit xLgr'), text(emit, 'enderEmit nro'), text(emit, 'enderEmit xMun'), text(emit, 'enderEmit UF')].filter(Boolean).join(', '),
    itens: itemsWithDiscount,
    itensOriginaisNFe: items.map((item) => ({ ...item })),
    desconto: financialDiscount,
    frete: num(text(total, 'vFrete')),
    outrosCustos: num(text(total, 'vOutro')),
    subtotal: items.reduce((sum, item) => sum + (item.custoFinalItem || 0), 0),
    totalFinal: fiscalValue,
    formaPagamento: paymentCode === '14' ? 'DUPLICATA MERCANTIL' : paymentCode === '15' ? 'BOLETO' : paymentCode === '17' ? 'PIX' : '',
    condicaoPagamento: installments.map((installment) => {
      const dueDate = text(installment, 'dVenc')
      const formattedDate = dueDate ? dueDate.split('-').reverse().join('/') : 'sem vencimento'
      const value = num(text(installment, 'vDup')).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      return `${text(installment, 'nDup') || 'Parcela'} — ${formattedDate} — ${value}`
    }).join('; '),
    observacoes: 'NF-e importada por XML. Conferir conversões, vínculos e decisão sobre desconto antes de salvar.',
    status: 'Rascunho',
    criadoEm: now,
    atualizadoEm: now,
    origem: 'XML_NFE',
    movimentarEstoque: false,
    movimentouEstoque: false,
    importacaoHistorica: false,
    numeroNFe: text(inf, 'ide nNF'),
    serieNFe: text(inf, 'ide serie'),
    chaveAcessoNFe: key,
    protocoloNFe: protocol ? text(protocol, 'nProt') : '',
    xmlNFe: xml,
    valorProdutosNFe: num(text(total, 'vProd')),
    valorFiscalNFe: fiscalValue,
    descontoFinanceiroNFe: financialDiscount,
    valorLiquidoCobrancaNFe: liquidValue,
    decisaoDescontoFinanceiro: financialDiscount > 0
      ? 'LIQUIDO_COM_DESCONTO'
      : undefined,
    parcelasPagamento: paymentInstallments,
  }
}
