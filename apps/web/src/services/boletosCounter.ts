import type { ParcelaVenda, Venda } from '../types/Venda'

export type BancoContadorBoleto = 'Inter'

const STATUS_UTILIZADOS = new Set([
  'ATIVO', 'EM ABERTO', 'EMABERTO', 'ENVIADO', 'GERADO', 'PAGO', 'REGISTRADO', 'VENCIDO',
])
const STATUS_NAO_UTILIZADOS = [
  'BAIX', 'CANCEL', 'EXCLUI', 'FALHA', 'PENDENTE', 'RASCUNHO', 'REJEIT', 'ERRO', 'GERANDO',
]

function normalizar(valor: unknown) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
}

export function identificarBancoDaParcela(parcela: ParcelaVenda, venda?: Venda): BancoContadorBoleto | null {
  const texto = normalizar([
    parcela.tipoCobranca, parcela.bancoCobranca, venda?.tipoCobranca, venda?.bancoCobranca,
  ].join(' '))
  if (texto.includes('INTER')) return 'Inter'
  return null
}

export function boletoEstaUtilizado(parcela: ParcelaVenda) {
  const status = normalizar(parcela.statusBoleto)
  if (STATUS_NAO_UTILIZADOS.some((trecho) => status.includes(trecho))) return false
  if (!STATUS_UTILIZADOS.has(status)) return false
  return Boolean(parcela.idCobrancaApi || parcela.idCobrancaBanco || parcela.nossoNumero || parcela.numeroBoleto)
}

export function identificadorBancarioBoleto(parcela: ParcelaVenda) {
  return normalizar(parcela.idCobrancaApi || parcela.idCobrancaBanco || parcela.nossoNumero || parcela.numeroBoleto)
}

export function mesReferenciaBoleto(parcela: ParcelaVenda, venda?: Venda) {
  const data = parcela.dataGeracaoBoleto ||
    (venda as (Venda & { dataGeracaoBoleto?: string }) | undefined)?.dataGeracaoBoleto ||
    venda?.dataEmissao || parcela.vencimento || new Date().toISOString()
  return String(data).slice(0, 7)
}

export function contarBoletosUtilizadosPorBanco(
  vendas: Venda[], banco: BancoContadorBoleto, mesReferencia: string, pedidoIgnoradoId?: string,
) {
  const identificadores = new Set<string>()
  for (const venda of vendas) {
    if (String(venda.id || '') === String(pedidoIgnoradoId || '')) continue
    if (normalizar(venda.tipo) !== 'PEDIDO' || normalizar(venda.statusPedido) === 'CANCELADO') continue
    for (const parcela of Array.isArray(venda.parcelas) ? venda.parcelas : []) {
      if (!boletoEstaUtilizado(parcela)) continue
      if (identificarBancoDaParcela(parcela, venda) !== banco) continue
      if (mesReferenciaBoleto(parcela, venda) !== mesReferencia) continue
      identificadores.add(identificadorBancarioBoleto(parcela))
    }
  }
  return identificadores.size
}
