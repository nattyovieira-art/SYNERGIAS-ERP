import type { EstoqueMovimentacao } from '../types/Estoque'
import type { Venda } from '../types/Venda'
import { carregarColecaoCentral, definirColecaoMemoria } from './erpApi'
import { listarMovimentacoesEstoque, salvarMovimentacoesEstoque } from './estoqueStorage'

const API_ENTREGA_PEDIDO = '/api/pedido-entrega.php'
const API_MOVIMENTOS_ESTOQUE = '/api/estoque-movimentacoes.php'
export const MENSAGEM_ESTOQUE_JA_BAIXADO = 'O estoque deste Pedido já foi baixado anteriormente.'

type MovimentoEntregaCentral = EstoqueMovimentacao & {
  pedidoId: string
  numeroPedido: string
  movimentoOriginalId?: string | null
}

type RespostaEntrega = {
  ok: true
  message: string
  pedidoId: string
  numeroPedido: string
  pedido: Venda
  movimentos: MovimentoEntregaCentral[]
}

async function respostaJson<T>(response: Response): Promise<T> {
  const texto = await response.text()
  let data: unknown
  try { data = texto ? JSON.parse(texto) : {} }
  catch { throw new Error('A operação central de entrega retornou uma resposta inválida.') }
  const registro = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  if (!response.ok || registro.ok === false) throw new Error(String(registro.error || `Erro HTTP ${response.status}`))
  return data as T
}

function atualizarCacheVisual(movimentos: MovimentoEntregaCentral[]) {
  const ids = new Set(movimentos.map((item) => item.id))
  const cache = listarMovimentacoesEstoque().filter((item) => !ids.has(item.id))
  salvarMovimentacoesEstoque([...movimentos, ...cache].slice(0, 500))
}

export async function entregarPedidoCentral(pedidoId: string, usuario = 'Synergias') {
  const response = await fetch(API_ENTREGA_PEDIDO, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ pedidoId, usuario }),
  })
  const entrega = await respostaJson<RespostaEntrega>(response)
  const [vendas, produtos] = await Promise.all([
    carregarColecaoCentral<Venda>('vendas'),
    carregarColecaoCentral('produtos'),
  ])
  definirColecaoMemoria('vendas', vendas.data || [])
  definirColecaoMemoria('produtos', produtos.data || [])
  atualizarCacheVisual(entrega.movimentos || [])
  return entrega
}

export async function carregarCacheMovimentacoesCentral() {
  const response = await fetch(API_MOVIMENTOS_ESTOQUE, {
    method: 'GET', headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store',
  })
  const resultado = await respostaJson<{ ok: true; data: MovimentoEntregaCentral[] }>(response)
  atualizarCacheVisual(resultado.data || [])
}
