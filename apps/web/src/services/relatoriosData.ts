import type { Venda } from '../types/Venda'

export type DiagnosticoConsolidacao = {
  chave: string
  numero: string
  registros: number
  ids: string[]
  idCanonico: string
  valorOriginal: number
  valorConsolidado: number
}

function texto(valor: unknown) {
  return String(valor ?? '').replace(/\s+/g, ' ').trim()
}

function normalizarNumero(valor: unknown) {
  const limpo = texto(valor)
  if (!limpo) return ''
  const numerico = limpo.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  return numerico || limpo.toUpperCase()
}

function ehPedido(venda: Venda) {
  return texto(venda.tipo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'pedido'
}

function pontuacao(venda: Venda) {
  const campos = Object.values(venda).filter((valor) => valor !== undefined && valor !== null && texto(valor) !== '').length
  const itens = Array.isArray(venda.itens) ? venda.itens.length : 0
  const fiscal = venda.chaveAcessoNotaFiscal || venda.protocoloNotaFiscal || venda.xmlNotaFiscal ? 200 : 0
  const persistido = texto(venda.id) && !/^(temp|local|snapshot|visual|histor)/i.test(texto(venda.id)) ? 100 : 0
  return campos + itens * 10 + fiscal + persistido
}

function dataAtualizacao(venda: Venda) {
  return texto(venda.atualizadoEm || venda.criadoEm || venda.dataEmissao)
}

function escolherCanonico(lista: Venda[]) {
  return [...lista].sort((a, b) => {
    const diferenca = pontuacao(b) - pontuacao(a)
    return diferenca || dataAtualizacao(b).localeCompare(dataAtualizacao(a))
  })[0]
}

export function chavePedidoRelatorio(venda: Venda) {
  if (!ehPedido(venda)) return ''
  const numero = normalizarNumero(venda.numeroPedido)
  if (numero) return `pedido:${numero}`
  const id = texto(venda.id)
  return id ? `id:${id}` : ''
}

export function consolidarPedidosRelatorios(vendas: Venda[]) {
  const grupos = new Map<string, Venda[]>()
  for (const venda of Array.isArray(vendas) ? vendas : []) {
    const chave = chavePedidoRelatorio(venda)
    if (!chave) continue
    grupos.set(chave, [...(grupos.get(chave) || []), venda])
  }

  const diagnosticos: DiagnosticoConsolidacao[] = []
  const pedidos = Array.from(grupos.entries()).map(([chave, lista]) => {
    const canonico = escolherCanonico(lista)
    if (lista.length > 1) {
      diagnosticos.push({
        chave,
        numero: normalizarNumero(canonico.numeroPedido),
        registros: lista.length,
        ids: lista.map((item) => texto(item.id) || '(sem id)'),
        idCanonico: texto(canonico.id) || '(sem id)',
        valorOriginal: lista.reduce((total, item) => total + Number(item.totalFinal || item.subtotal || 0), 0),
        valorConsolidado: Number(canonico.totalFinal || canonico.subtotal || 0),
      })
    }
    return canonico
  })

  return { pedidos, diagnosticos }
}

export function consolidarVendasRelatorios(vendas: Venda[]) {
  const { pedidos, diagnosticos } = consolidarPedidosRelatorios(vendas)
  const orcamentos = vendas.filter((venda) => !ehPedido(venda))
  return { vendas: [...orcamentos, ...pedidos], pedidos, diagnosticos }
}
