import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  WalletCards,
} from 'lucide-react'

import { listarComprasStorage } from '../../services/comprasStorage'
import { listarContasReceberStorage } from '../../services/financeiroStorage'
import { listarVendasStorage } from '../../services/vendasStorage'

type RegistroGenerico = Record<string, unknown>

type ContaPagarResumo = {
  id?: string
  vencimento?: string
  valor?: number
  status?: string
}

type SecaoResumo = 'vendas' | 'financeiro' | 'estoque'

const CHAVES = {
  produtos: ['synergias_produtos', 'produtos', 'erp_produtos'],
  contasPagar: ['synergias_contas_pagar'],
} as const

function lerLista(chaves: readonly string[]): RegistroGenerico[] {
  for (const chave of chaves) {
    try {
      const bruto = localStorage.getItem(chave)
      if (!bruto) continue

      const valor = JSON.parse(bruto)

      if (Array.isArray(valor)) return valor as RegistroGenerico[]
      if (Array.isArray((valor as { data?: unknown[] })?.data)) {
        return (valor as { data: RegistroGenerico[] }).data
      }
      if (Array.isArray((valor as { items?: unknown[] })?.items)) {
        return (valor as { items: RegistroGenerico[] }).items
      }
    } catch {
      // Tenta a próxima chave.
    }
  }

  return []
}

function texto(valor: unknown) {
  return String(valor ?? '').trim()
}

function numero(valor: unknown) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0

  const bruto = texto(valor)
  if (!bruto) return 0

  const normalizado = bruto
    .replace(/[R$\s]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')

  const resultado = Number(normalizado)
  return Number.isFinite(resultado) ? resultado : 0
}

function primeiroValor(registro: RegistroGenerico, campos: string[]) {
  for (const campo of campos) {
    if (
      registro[campo] !== undefined &&
      registro[campo] !== null &&
      registro[campo] !== ''
    ) {
      return registro[campo]
    }
  }

  return undefined
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function somenteData(valor?: string) {
  if (!valor) return ''

  const bruto = valor.includes('T') ? valor.split('T')[0] : valor

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(bruto)) {
    return bruto.split('/').reverse().join('-')
  }

  return bruto
}

function obterEstoque(produto: RegistroGenerico) {
  return numero(
    primeiroValor(produto, [
      'estoqueAtual',
      'estoque',
      'quantidadeEstoque',
      'saldoEstoque',
      'quantidade',
    ]),
  )
}

function obterEstoqueMinimo(produto: RegistroGenerico) {
  return numero(
    primeiroValor(produto, [
      'estoqueMinimo',
      'minimo',
      'quantidadeMinima',
      'saldoMinimo',
    ]),
  )
}

function obterCusto(produto: RegistroGenerico) {
  return numero(
    primeiroValor(produto, [
      'custoMedioAtual',
      'custoMedio',
      'custo',
      'precoCusto',
      'valorCusto',
    ]),
  )
}

function obterPrecoVenda(produto: RegistroGenerico) {
  return numero(
    primeiroValor(produto, [
      'vendaVarejo',
      'valorVenda',
      'precoVenda',
      'precoUnitario',
      'preco',
      'valorUnitario',
      'valor',
    ]),
  )
}

function ehPedido(venda: RegistroGenerico) {
  const tipo = texto(venda.tipo)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const status = texto(
    primeiroValor(venda, ['statusPedido', 'status', 'situacao']),
  ).toLowerCase()

  return (
    tipo.includes('pedido') ||
    status === 'pedido' ||
    Boolean(venda.numeroPedido) ||
    Boolean(venda.pedidoGeradoEm)
  )
}

function pedidoCancelado(venda: RegistroGenerico) {
  return texto(
    primeiroValor(venda, ['statusPedido', 'status', 'situacao']),
  )
    .toLowerCase()
    .includes('cancel')
}

function dataVenda(venda: RegistroGenerico) {
  return somenteData(
    texto(
      primeiroValor(venda, [
        'dataEmissao',
        'emissao',
        'data',
        'criadoEm',
        'createdAt',
      ]),
    ),
  )
}

function valorVenda(venda: RegistroGenerico) {
  const direto = numero(
    primeiroValor(venda, [
      'totalFinal',
      'valorFinal',
      'valorTotal',
      'total',
      'valor',
    ]),
  )

  if (direto > 0) return direto

  const itens = primeiroValor(venda, ['itens', 'produtos', 'items'])
  if (!Array.isArray(itens)) return 0

  return itens.reduce((soma, item) => {
    if (!item || typeof item !== 'object') return soma

    const linha = item as RegistroGenerico
    const totalLinha = numero(
      primeiroValor(linha, ['valorTotal', 'total']),
    )

    if (totalLinha > 0) return soma + totalLinha

    const quantidade =
      numero(primeiroValor(linha, ['quantidade', 'qtd', 'quantity'])) || 1
    const unitario = numero(
      primeiroValor(linha, [
        'valorUnitario',
        'precoUnitario',
        'preco',
        'valor',
      ]),
    )

    return soma + quantidade * unitario
  }, 0)
}

function horarioVenda(venda: RegistroGenerico) {
  const horarioDireto = texto(
    primeiroValor(venda, [
      'hora',
      'horario',
      'horarioCriacao',
      'horarioEmissao',
    ]),
  )

  const horaDireta = horarioDireto.match(/^(\d{1,2}):/)
  if (horaDireta) {
    return Number(horaDireta[1])
  }

  const criadoEm = texto(
    primeiroValor(venda, ['criadoEm', 'createdAt', 'atualizadoEm']),
  )

  if (!criadoEm) return null

  const data = new Date(criadoEm)
  return Number.isNaN(data.getTime()) ? null : data.getHours()
}

function SummaryQuickDrawer() {
  const [aberto, setAberto] = useState(false)
  const [secao, setSecao] = useState<SecaoResumo>('vendas')
  const [produtosRemotos, setProdutosRemotos] = useState<
    RegistroGenerico[] | null
  >(null)

  const vendas = useMemo(
    () => listarVendasStorage() as unknown as RegistroGenerico[],
    [],
  )
  const compras = useMemo(
    () => listarComprasStorage() as unknown as RegistroGenerico[],
    [],
  )
  const contasReceber = useMemo(() => listarContasReceberStorage(), [])
  const contasPagar = useMemo(
    () =>
      lerLista(CHAVES.contasPagar) as unknown as ContaPagarResumo[],
    [],
  )
  const produtosLocais = useMemo(() => lerLista(CHAVES.produtos), [])

  useEffect(() => {
    let ativo = true

    async function carregarProdutos() {
      try {
        const resposta = await fetch('/api/storage.php?collection=produtos', {
          credentials: 'include',
          cache: 'no-store',
        })

        if (!resposta.ok) return null

        const payload = await resposta.json()

        return Array.isArray(payload?.data)
          ? (payload.data as RegistroGenerico[])
          : null
      } catch {
        return null
      }
    }

    carregarProdutos().then((produtos) => {
      if (!ativo || !produtos) return
      setProdutosRemotos(produtos)
    })

    return () => {
      ativo = false
    }
  }, [])

  const produtos = produtosRemotos ?? produtosLocais

  const hoje = new Date().toISOString().slice(0, 10)
  const agora = new Date()
  const inicioMes = `${agora.getFullYear()}-${String(
    agora.getMonth() + 1,
  ).padStart(2, '0')}-01`

  const pedidosValidos = vendas.filter(
    (venda) => ehPedido(venda) && !pedidoCancelado(venda),
  )
  const pedidosHoje = pedidosValidos.filter(
    (venda) => dataVenda(venda) === hoje,
  )
  const pedidosMes = pedidosValidos.filter((venda) => {
    const data = dataVenda(venda)
    return data >= inicioMes && data <= hoje
  })

  const faturamentoHoje = pedidosHoje.reduce(
    (soma, venda) => soma + valorVenda(venda),
    0,
  )
  const faturamentoMes = pedidosMes.reduce(
    (soma, venda) => soma + valorVenda(venda),
    0,
  )
  const ticketMedioHoje =
    pedidosHoje.length > 0 ? faturamentoHoje / pedidosHoje.length : 0

  const horasHoje = new Map<number, number>()

  pedidosHoje.forEach((venda) => {
    const hora = horarioVenda(venda)
    if (hora === null) return
    horasHoje.set(hora, (horasHoje.get(hora) || 0) + 1)
  })

  const maiorHorario = Array.from(horasHoje.entries()).sort(
    (a, b) => b[1] - a[1] || a[0] - b[0],
  )[0]

  const horarioMaiorMovimento = maiorHorario
    ? `${String(maiorHorario[0]).padStart(2, '0')}:00–${String(
        maiorHorario[0] + 1,
      ).padStart(2, '0')}:00`
    : 'N/D'

  const potencialMaximoVendas = produtos.reduce((soma, produto) => {
    const estoque = Math.max(obterEstoque(produto), 0)
    const preco = obterPrecoVenda(produto)
    return soma + estoque * preco
  }, 0)

  const investimentoEstoque = produtos.reduce((soma, produto) => {
    const estoque = Math.max(obterEstoque(produto), 0)
    const custo = obterCusto(produto)
    return soma + estoque * custo
  }, 0)

  const produtosCriticos = produtos.filter((produto) => {
    const atual = obterEstoque(produto)
    const minimo = obterEstoqueMinimo(produto)

    return atual <= 0 || (minimo > 0 && atual <= minimo)
  })

  const produtosComMinimo = produtos.filter(
    (produto) => obterEstoqueMinimo(produto) > 0,
  )

  const baseNivelEstoque =
    produtosComMinimo.length > 0 ? produtosComMinimo : produtos

  const produtosSaudaveis = baseNivelEstoque.filter((produto) => {
    const atual = obterEstoque(produto)
    const minimo = obterEstoqueMinimo(produto)

    return minimo > 0 ? atual > minimo : atual > 0
  }).length

  const nivelEstoque =
    baseNivelEstoque.length > 0
      ? (produtosSaudaveis / baseNivelEstoque.length) * 100
      : 0

  const fornecedores = new Set(
    compras
      .map((compra) =>
        texto(
          primeiroValor(compra, [
            'fornecedorDocumento',
            'fornecedorCodigo',
            'fornecedorNome',
            'fornecedor',
          ]),
        ),
      )
      .filter(Boolean),
  ).size

  const pedidosCompraAtrasados = compras.filter((compra) => {
    const status = texto(compra.status).toLowerCase()
    const previsao = somenteData(
      texto(
        primeiroValor(compra, [
          'previsaoEntrega',
          'dataEntrega',
          'entregaPrevista',
        ]),
      ),
    )

    const encerrada =
      status.includes('recebido') || status.includes('cancelado')

    return Boolean(previsao) && previsao < hoje && !encerrada
  }).length

  const pagarHoje = contasPagar
    .filter(
      (conta) =>
        texto(conta.status).toLowerCase() === 'em aberto' &&
        somenteData(conta.vencimento) === hoje,
    )
    .reduce((soma, conta) => soma + numero(conta.valor), 0)

  const pagarAtrasado = contasPagar
    .filter(
      (conta) =>
        texto(conta.status).toLowerCase() === 'em aberto' &&
        Boolean(conta.vencimento) &&
        somenteData(conta.vencimento) < hoje,
    )
    .reduce((soma, conta) => soma + numero(conta.valor), 0)

  const receberHoje = contasReceber
    .filter(
      (conta) =>
        conta.status !== 'Paga' &&
        conta.status !== 'Cancelada' &&
        somenteData(conta.dataVencimento) === hoje,
    )
    .reduce((soma, conta) => soma + numero(conta.saldoAberto), 0)

  const receberAtrasado = contasReceber
    .filter(
      (conta) =>
        conta.status !== 'Paga' &&
        conta.status !== 'Cancelada' &&
        Boolean(conta.dataVencimento) &&
        somenteData(conta.dataVencimento) < hoje,
    )
    .reduce((soma, conta) => soma + numero(conta.saldoAberto), 0)

  const totalPagarAberto = contasPagar
    .filter(
      (conta) => texto(conta.status).toLowerCase() === 'em aberto',
    )
    .reduce((soma, conta) => soma + numero(conta.valor), 0)

  const totalReceberAberto = contasReceber
    .filter(
      (conta) => conta.status !== 'Paga' && conta.status !== 'Cancelada',
    )
    .reduce((soma, conta) => soma + numero(conta.saldoAberto), 0)

  const saldoEstimado = totalReceberAberto - totalPagarAberto

  return (
    <section
      className={`dashboard-summary-filter ${
        aberto ? 'open' : 'closed'
      }`}
    >
      <button
        type="button"
        className="dashboard-summary-filter-toggle"
        onClick={() => setAberto((atual) => !atual)}
        title={aberto ? 'Recolher resumo rápido' : 'Abrir resumo rápido'}
      >
        <TrendingUp size={18} />
        <span>Resumo rápido</span>
        {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {aberto && (
        <div className="dashboard-summary-filter-shell">
          <div className="dashboard-summary-tabs">
            <button
              type="button"
              className={secao === 'vendas' ? 'active vendas' : 'vendas'}
              onClick={() => setSecao('vendas')}
            >
              <ShoppingCart size={18} />
              Vendas
            </button>

            <button
              type="button"
              className={
                secao === 'financeiro' ? 'active financeiro' : 'financeiro'
              }
              onClick={() => setSecao('financeiro')}
            >
              <CircleDollarSign size={18} />
              Financeiro
            </button>

            <button
              type="button"
              className={secao === 'estoque' ? 'active estoque' : 'estoque'}
              onClick={() => setSecao('estoque')}
            >
              <Boxes size={18} />
              Estoque
            </button>
          </div>

          {secao === 'vendas' && (
            <div className="dashboard-summary-section vendas">
              <article className="summary-feature-card">
                <ShoppingCart size={22} />
                <span>Potencial máximo em vendas</span>
                <strong>{moeda(potencialMaximoVendas)}</strong>
              </article>

              <div className="summary-metrics-grid">
                <article>
                  <ReceiptText size={19} />
                  <span>Faturamento hoje</span>
                  <strong>{moeda(faturamentoHoje)}</strong>
                </article>

                <article>
                  <TrendingUp size={19} />
                  <span>Faturamento mês</span>
                  <strong>{moeda(faturamentoMes)}</strong>
                </article>

                <article>
                  <WalletCards size={19} />
                  <span>Ticket médio hoje</span>
                  <strong>{moeda(ticketMedioHoje)}</strong>
                </article>

                <article>
                  <Clock3 size={19} />
                  <span>Horário com maior movimento</span>
                  <strong>{horarioMaiorMovimento}</strong>
                </article>
              </div>
            </div>
          )}

          {secao === 'financeiro' && (
            <div className="dashboard-summary-section financeiro">
              <article className="summary-feature-card">
                <CircleDollarSign size={22} />
                <span>Saldo disponível</span>
                <strong>N/D</strong>
                <small>
                  O ERP ainda não possui saldo bancário persistido para calcular
                  este valor com segurança.
                </small>
              </article>

              <div className="summary-finance-columns">
                <section>
                  <h3>A pagar</h3>
                  <article>
                    <span>Hoje</span>
                    <strong>{moeda(pagarHoje)}</strong>
                  </article>
                  <article className="danger">
                    <span>Atrasado</span>
                    <strong>{moeda(pagarAtrasado)}</strong>
                  </article>
                </section>

                <section>
                  <h3>A receber</h3>
                  <article>
                    <span>Hoje</span>
                    <strong>{moeda(receberHoje)}</strong>
                  </article>
                  <article className="success">
                    <span>Atrasado</span>
                    <strong>{moeda(receberAtrasado)}</strong>
                  </article>
                </section>
              </div>

              <article className="summary-balance-card">
                <span>Saldo estimado</span>
                <strong>{moeda(saldoEstimado)}</strong>
                <small>
                  Contas a receber em aberto menos contas a pagar em aberto.
                </small>
              </article>
            </div>
          )}

          {secao === 'estoque' && (
            <div className="dashboard-summary-section estoque">
              <article className="summary-feature-card">
                <PackageSearch size={22} />
                <span>Potencial máximo em vendas</span>
                <strong>{moeda(potencialMaximoVendas)}</strong>
              </article>

              <div className="summary-metrics-grid">
                <article>
                  <BriefcaseBusiness size={19} />
                  <span>Fornecedores</span>
                  <strong>{fornecedores.toLocaleString('pt-BR')}</strong>
                </article>

                <article>
                  <Clock3 size={19} />
                  <span>Pedidos de compra atrasados</span>
                  <strong>
                    {pedidosCompraAtrasados.toLocaleString('pt-BR')}
                  </strong>
                </article>

                <article>
                  <Boxes size={19} />
                  <span>Investimento em estoque</span>
                  <strong>{moeda(investimentoEstoque)}</strong>
                </article>

                <article className="critical">
                  <PackageSearch size={19} />
                  <span>Produtos críticos</span>
                  <strong>
                    {produtosCriticos.length.toLocaleString('pt-BR')}
                  </strong>
                </article>
              </div>

              <article className="summary-stock-level">
                <div>
                  <span>Nível do estoque</span>
                  <strong>{nivelEstoque.toFixed(1)}%</strong>
                </div>
                <div className="summary-stock-level-bar">
                  <i style={{ width: `${Math.max(0, Math.min(nivelEstoque, 100))}%` }} />
                </div>
                <small>
                  {produtosCriticos.length.toLocaleString('pt-BR')} produto(s)
                  zerado(s) ou no estoque mínimo.
                </small>
              </article>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default SummaryQuickDrawer
