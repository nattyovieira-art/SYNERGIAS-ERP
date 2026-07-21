import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Edit3,
  FileChartColumnIncreasing,
  LogOut,
  Clock3,
  FileClock,
  PackagePlus,
  PackageX,
  Plus,
  ShoppingCart,
  Trash2,
  UserPlus,
  UserRoundX,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '../../components/Sidebar/Sidebar'
import ChartCard from '../../components/ChartCard/ChartCard'
import SummaryQuickDrawer from '../../components/SummaryQuickDrawer/SummaryQuickDrawer'
import { authApi } from '../../services/authApi'
import '../../styles/dashboard.css'

type Periodo = '6m' | '12m' | 'ano'

type RegistroGenerico = Record<string, unknown>

type AgendaItem = {
  id: string
  descricao: string
  data: string
  hora?: string
  concluido: boolean
  createdAt: string
}

type ProdutoCritico = {
  id: string
  nome: string
  atual: number
  minimo: number
  faltante: number
  nivel: 'Crítico' | 'Atenção' | 'Baixo'
}

const AGENDA_KEY = 'synergias_painel_agenda'

const CHAVES = {
  vendas: ['synergias_pedidos', 'pedidos', 'synergias_vendas', 'vendas', 'erp_pedidos'],
  compras: ['synergias_compras', 'compras', 'synergias_pedidos_compra', 'pedidos_compra', 'erp_compras'],
  produtos: ['synergias_produtos', 'produtos', 'erp_produtos'],
  clientes: ['synergias_clientes', 'clientes', 'erp_clientes'],
  estoque: ['synergias_movimentacoes_estoque', 'movimentacoes_estoque', 'synergias_estoque_movimentacoes', 'estoque_movimentacoes'],
  contasReceber: ['synergias_contas_receber'],
} as const

function lerLista(chaves: readonly string[]): RegistroGenerico[] {
  for (const chave of chaves) {
    try {
      const bruto = localStorage.getItem(chave)
      if (!bruto) continue
      const valor = JSON.parse(bruto)
      if (Array.isArray(valor)) return valor as RegistroGenerico[]
      if (Array.isArray((valor as any)?.data)) return (valor as any).data as RegistroGenerico[]
      if (Array.isArray((valor as any)?.items)) return (valor as any).items as RegistroGenerico[]
    } catch {
      // ignora
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
    if (registro[campo] !== undefined && registro[campo] !== null && registro[campo] !== '') {
      return registro[campo]
    }
  }
  return undefined
}

function dataRegistro(registro: RegistroGenerico) {
  const valor = primeiroValor(registro, [
    'data', 'dataPedido', 'dataVenda', 'dataEmissao', 'emissao', 'createdAt', 'created_at',
    'dataCriacao', 'dataCompra', 'entrada', 'dataMovimentacao',
  ])

  const bruto = texto(valor)
  if (!bruto) return null

  const data = bruto.length === 10 && bruto.includes('/')
    ? new Date(bruto.split('/').reverse().join('-') + 'T12:00:00')
    : new Date(bruto)

  return Number.isNaN(data.getTime()) ? null : data
}

function valorRegistro(registro: RegistroGenerico) {
  const direto = primeiroValor(registro, [
    'valorTotal', 'total', 'valor', 'totalPedido', 'valorPedido', 'totalLiquido', 'valorLiquido', 'precoTotal',
  ])

  const valorDireto = numero(direto)
  if (valorDireto > 0) return valorDireto

  const itens = primeiroValor(registro, ['itens', 'produtos', 'items'])
  if (!Array.isArray(itens)) return 0

  return itens.reduce((soma, item) => {
    if (!item || typeof item !== 'object') return soma
    const linha = item as RegistroGenerico
    const quantidade = numero(primeiroValor(linha, ['quantidade', 'qtd', 'quantity'])) || 1
    const unitario = numero(primeiroValor(linha, ['precoUnitario', 'valorUnitario', 'preco', 'valor', 'unitario']))
    return soma + quantidade * unitario
  }, 0)
}

function statusCancelado(registro: RegistroGenerico) {
  const status = texto(primeiroValor(registro, ['status', 'situacao'])).toLowerCase()
  return status.includes('cancel')
}

function mesChave(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

function periodoMeses(periodo: Periodo) {
  const hoje = new Date()
  const quantidade = periodo === '6m' ? 6 : periodo === '12m' ? 12 : hoje.getMonth() + 1
  const meses: Array<{ chave: string; label: string }> = []

  for (let indice = quantidade - 1; indice >= 0; indice--) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - indice, 1)
    meses.push({
      chave: mesChave(data),
      label: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    })
  }

  return meses
}

function totalPorMes(registros: RegistroGenerico[], meses: ReturnType<typeof periodoMeses>) {
  return meses.map(({ chave }) =>
    registros
      .filter((registro) => !statusCancelado(registro))
      .filter((registro) => {
        const data = dataRegistro(registro)
        return data ? mesChave(data) === chave : false
      })
      .reduce((soma, registro) => soma + valorRegistro(registro), 0),
  )
}

function lerAgenda(): AgendaItem[] {
  try {
    const valor = JSON.parse(localStorage.getItem(AGENDA_KEY) || '[]')
    return Array.isArray(valor) ? (valor as AgendaItem[]) : []
  } catch {
    return []
  }
}

function dataHoje() {
  const agora = new Date()
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function chaveCliente(registro: RegistroGenerico) {
  const documento = texto(primeiroValor(registro, ['clienteDocumento', 'documento', 'cpfCnpj', 'cnpj', 'cpf']))
    .replace(/\D/g, '')
  if (documento) return `doc:${documento}`

  const codigo = texto(primeiroValor(registro, ['clienteCodigo', 'codigoCliente', 'codigo', 'id']))
  if (codigo) return `cod:${codigo.toLowerCase()}`

  const nome = texto(primeiroValor(registro, ['clienteNome', 'nome', 'razaoSocial', 'fantasia']))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')

  return nome ? `nome:${nome}` : ''
}

function Dashboard() {
  const navigate = useNavigate()
  const [periodo, setPeriodo] = useState<Periodo>('6m')
  const [graficosAbertos, setGraficosAbertos] = useState(true)
  const [agendaAberta, setAgendaAberta] = useState(true)
  const [agenda, setAgenda] = useState<AgendaItem[]>(lerAgenda)
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(dataHoje())
  const [hora, setHora] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [produtosRemotos, setProdutosRemotos] = useState<RegistroGenerico[] | null>(null)
  const [clientesRemotos, setClientesRemotos] = useState<RegistroGenerico[] | null>(null)
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false)
  const notificacoesRef = useRef<HTMLDivElement | null>(null)
  const rollerRef = useRef<HTMLDivElement | null>(null)

  const vendas = useMemo(() => lerLista(CHAVES.vendas), [])
  const compras = useMemo(() => lerLista(CHAVES.compras), [])
  const produtosLocais = useMemo(() => lerLista(CHAVES.produtos), [])
  const clientesLocais = useMemo(() => lerLista(CHAVES.clientes), [])
  const movimentacoes = useMemo(() => lerLista(CHAVES.estoque), [])
  const contasReceber = useMemo(() => lerLista(CHAVES.contasReceber), [])

  useEffect(() => {
    let ativo = true

    async function carregarColecao(collection: 'produtos' | 'clientes') {
      try {
        const resposta = await fetch(`/api/storage.php?collection=${collection}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!resposta.ok) return null
        const payload = await resposta.json()
        return Array.isArray(payload?.data) ? (payload.data as RegistroGenerico[]) : null
      } catch {
        return null
      }
    }

    Promise.all([carregarColecao('produtos'), carregarColecao('clientes')]).then(([produtos, clientes]) => {
      if (!ativo) return
      if (produtos) setProdutosRemotos(produtos)
      if (clientes) setClientesRemotos(clientes)
    })

    return () => { ativo = false }
  }, [])

  useEffect(() => {
    localStorage.setItem(AGENDA_KEY, JSON.stringify(agenda))
  }, [agenda])

  useEffect(() => {
    function fecharAoClicarFora(evento: MouseEvent) {
      if (notificacoesRef.current && !notificacoesRef.current.contains(evento.target as Node)) {
        setNotificacoesAbertas(false)
      }
    }

    document.addEventListener('mousedown', fecharAoClicarFora)
    return () => document.removeEventListener('mousedown', fecharAoClicarFora)
  }, [])

  const produtos = produtosRemotos ?? produtosLocais
  const clientes = clientesRemotos ?? clientesLocais
  const meses = useMemo(() => periodoMeses(periodo), [periodo])
  const vendasMes = useMemo(() => totalPorMes(vendas, meses), [meses, vendas])
  const comprasMes = useMemo(() => totalPorMes(compras, meses), [compras, meses])

  const produtosCriticos = useMemo<ProdutoCritico[]>(() => {
    return produtos
      .map((produto, indice) => {
        const atual = numero(primeiroValor(produto, ['estoqueAtual', 'estoque', 'quantidadeEstoque', 'saldoEstoque', 'saldo', 'quantidade']))
        const minimo = numero(primeiroValor(produto, ['estoqueMinimo', 'minimo', 'quantidadeMinima', 'saldoMinimo']))
        const minimoReferencia = minimo > 0 ? minimo : 1
        const faltante = Math.max(minimoReferencia - atual, 0)
        const percentual = minimo > 0 ? atual / minimo : atual > 0 ? 1 : 0
        const nivel: ProdutoCritico['nivel'] =
          atual <= 0 || percentual <= 0.25 ? 'Crítico' : percentual <= 0.6 ? 'Atenção' : 'Baixo'

        return {
          id: texto(primeiroValor(produto, ['id', 'codigo', 'codigoBarras'])) || `produto-${indice}`,
          nome: texto(primeiroValor(produto, ['nome', 'descricao', 'produto'])) || 'Produto sem nome',
          atual,
          minimo,
          faltante,
          nivel,
        }
      })
      .filter((produto) => produto.atual <= 0 || (produto.minimo > 0 && produto.atual <= produto.minimo))
      .sort((a, b) => b.faltante - a.faltante || a.atual - b.atual)
      .slice(0, 12)
  }, [produtos])

  const estoqueMes = useMemo(() => {
    const valorAtual = produtos.reduce((soma, produto) => {
      const quantidade = numero(primeiroValor(produto, ['estoqueAtual', 'estoque', 'quantidadeEstoque', 'saldoEstoque', 'saldo', 'quantidade']))
      const custo = numero(primeiroValor(produto, ['custoMedio', 'precoCusto', 'custo', 'valorCusto']))
      return soma + quantidade * custo
    }, 0)

    if (!movimentacoes.length) {
      return meses.map(() => valorAtual)
    }

    const variacoes = new Map<string, number>()
    movimentacoes.forEach((movimento) => {
      const dataMov = dataRegistro(movimento)
      if (!dataMov) return

      const tipo = texto(primeiroValor(movimento, ['tipo', 'movimento', 'operacao'])).toLowerCase()
      const quantidade = numero(primeiroValor(movimento, ['quantidade', 'qtd', 'quantity']))
      const custo = numero(primeiroValor(movimento, ['custo', 'custoMedio', 'valorUnitario', 'valor']))
      const valor = quantidade * custo
      const sinal = tipo.includes('sa') || tipo.includes('baixa') ? -1 : 1
      const chave = mesChave(dataMov)
      variacoes.set(chave, (variacoes.get(chave) || 0) + valor * sinal)
    })

    const totais = Array(meses.length).fill(0)
    totais[totais.length - 1] = valorAtual
    for (let indice = totais.length - 2; indice >= 0; indice--) {
      const proximaChave = meses[indice + 1].chave
      totais[indice] = Math.max(totais[indice + 1] - (variacoes.get(proximaChave) || 0), 0)
    }

    return totais
  }, [meses, movimentacoes, produtos])

  const entradasMes = useMemo(
    () => meses.map(({ chave }) =>
      movimentacoes
        .filter((movimento) => {
          const dataMov = dataRegistro(movimento)
          const tipo = texto(primeiroValor(movimento, ['tipo', 'movimento', 'operacao'])).toLowerCase()
          return dataMov && mesChave(dataMov) === chave && !tipo.includes('sa') && !tipo.includes('baixa')
        })
        .reduce((soma, movimento) => soma + numero(primeiroValor(movimento, ['quantidade', 'qtd', 'quantity'])), 0),
    ),
    [meses, movimentacoes],
  )

  const saidasMes = useMemo(
    () => meses.map(({ chave }) =>
      movimentacoes
        .filter((movimento) => {
          const dataMov = dataRegistro(movimento)
          const tipo = texto(primeiroValor(movimento, ['tipo', 'movimento', 'operacao'])).toLowerCase()
          return dataMov && mesChave(dataMov) === chave && (tipo.includes('sa') || tipo.includes('baixa'))
        })
        .reduce((soma, movimento) => soma + numero(primeiroValor(movimento, ['quantidade', 'qtd', 'quantity'])), 0),
    ),
    [meses, movimentacoes],
  )

  const hoje = dataHoje()
  const agendaAtiva = agenda.filter((item) => !item.concluido)
  const agendaHoje = agendaAtiva.filter((item) => item.data === hoje)
  const agendaProximos = agendaAtiva.filter((item) => item.data > hoje)
  const agendaAtrasados = agendaAtiva.filter((item) => item.data < hoje)

  const produtosEmFalta = produtos.filter((produto) => {
    const atual = numero(primeiroValor(produto, [
      'estoqueAtual', 'estoque', 'quantidadeEstoque', 'saldoEstoque', 'saldo', 'quantidade',
    ]))
    return atual <= 0
  })

  const comprasDoMesPorCliente = new Set(
    vendas
      .filter((registro) => texto(registro.tipo).toLowerCase() === 'pedido')
      .filter((registro) => !statusCancelado(registro))
      .filter((registro) => {
        const registroData = dataRegistro(registro)
        return registroData && mesChave(registroData) === mesChave(new Date())
      })
      .map((registro) => chaveCliente(registro))
      .filter(Boolean),
  )

  const clientesSemCompraMes = clientes.filter((cliente) => {
    const status = texto(primeiroValor(cliente, ['status', 'situacao', 'ativo'])).toLowerCase()
    if (['false', '0', 'inativo', 'cancelado'].includes(status)) return false

    const chave = chaveCliente(cliente)
    return Boolean(chave) && !comprasDoMesPorCliente.has(chave)
  })

  const pedidosPagamentoAtrasado = contasReceber.filter((conta) => {
    const status = texto(primeiroValor(conta, ['status'])).toLowerCase()
    if (status === 'paga' || status === 'cancelada') return false

    const saldo = numero(primeiroValor(conta, ['saldoAberto', 'saldo', 'valorAberto']))
    const vencimento = texto(primeiroValor(conta, ['dataVencimento', 'vencimento']))
    const vencidoPorData = Boolean(vencimento) && vencimento < hoje

    return saldo > 0 && (status === 'vencida' || vencidoPorData)
  })

  const orcamentosPendentes = vendas.filter((registro) => {
    if (texto(registro.tipo).toLowerCase() !== 'orçamento') return false

    const status = texto(primeiroValor(registro, ['statusOrcamento'])).toLowerCase()
    return status === '' || status === 'aberto' || status === 'pendente'
  })

  function limparFormularioAgenda() {
    setDescricao('')
    setData(dataHoje())
    setHora('')
    setEditandoId(null)
  }

  function salvarAgenda() {
    const descricaoLimpa = descricao.trim()
    if (!descricaoLimpa || !data) return

    if (editandoId) {
      setAgenda((atual) =>
        atual.map((item) =>
          item.id === editandoId ? { ...item, descricao: descricaoLimpa, data, hora: hora || undefined } : item,
        ),
      )
    } else {
      setAgenda((atual) => [
        ...atual,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          descricao: descricaoLimpa,
          data,
          hora: hora || undefined,
          concluido: false,
          createdAt: new Date().toISOString(),
        },
      ])
    }

    limparFormularioAgenda()
  }

  function editarAgenda(item: AgendaItem) {
    setEditandoId(item.id)
    setDescricao(item.descricao)
    setData(item.data)
    setHora(item.hora || '')
  }

  async function sair() {
    try {
      await authApi.logout()
    } finally {
      window.location.assign('/')
    }
  }

  function rolarGraficos(direcao: 'esquerda' | 'direita') {
    const alvo = rollerRef.current
    if (!alvo) return
    alvo.scrollBy({ left: direcao === 'direita' ? 460 : -460, behavior: 'smooth' })
  }

  function AgendaGrupo({ titulo, itens, classe }: { titulo: string; itens: AgendaItem[]; classe: string }) {
    return (
      <section className={`agenda-group ${classe}`}>
        <div className="agenda-group-title">
          <span>{titulo}</span>
          <strong>{itens.length}</strong>
        </div>

        <div className="agenda-list">
          {itens
            .slice()
            .sort((a, b) => `${a.data}${a.hora || ''}`.localeCompare(`${b.data}${b.hora || ''}`))
            .map((item) => (
              <article className="agenda-item" key={item.id}>
                <button
                  type="button"
                  className="agenda-check"
                  title="Concluir"
                  onClick={() => setAgenda((atual) => atual.map((registro) => (registro.id === item.id ? { ...registro, concluido: true } : registro)))}
                >
                  <Check size={17} />
                </button>

                <div className="agenda-item-text">
                  <strong>{item.descricao}</strong>
                  <span>
                    {new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')}
                    {item.hora ? ` · ${item.hora}` : ''}
                  </span>
                </div>

                <div className="agenda-item-actions">
                  <button type="button" title="Editar" onClick={() => editarAgenda(item)}>
                    <Edit3 size={16} />
                  </button>
                  <button type="button" title="Excluir" className="danger" onClick={() => setAgenda((atual) => atual.filter((registro) => registro.id !== item.id))}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}

          {!itens.length && <div className="agenda-empty">Nenhuma tarefa.</div>}
        </div>
      </section>
    )
  }

  return (
    <main className="dashboard-page">
      <Sidebar />

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-eyebrow">PAINEL</span>
            <h1>Visão geral</h1>
            <p>Acompanhe vendas, compras, estoque e tarefas operacionais.</p>
          </div>

          <div className="dashboard-topbar-actions">
            <div className="dashboard-notifications" ref={notificacoesRef}>
              <button
                type="button"
                className={`dashboard-bell ${produtosCriticos.length ? 'has-alert' : ''}`}
                title={produtosCriticos.length ? `${produtosCriticos.length} produto(s) com alerta de estoque` : 'Nenhum alerta crítico de estoque'}
                aria-expanded={notificacoesAbertas}
                aria-controls="painel-notificacoes"
                onClick={() => setNotificacoesAbertas((abertas) => !abertas)}
              >
                <Bell size={21} />
                {produtosCriticos.length > 0 && <span>{produtosCriticos.length}</span>}
              </button>

              {notificacoesAbertas && (
                <section className="dashboard-notifications-panel" id="painel-notificacoes" aria-label="Notificações">
                  <div className="notifications-header">
                    <div>
                      <strong>Notificações</strong>
                      <small>{produtosCriticos.length ? `${produtosCriticos.length} alerta(s) de estoque` : 'Nenhuma pendência'}</small>
                    </div>
                    <button type="button" title="Fechar" aria-label="Fechar notificações" onClick={() => setNotificacoesAbertas(false)}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="notifications-list">
                    {produtosCriticos.map((produto) => (
                      <button
                        type="button"
                        className="notification-item"
                        key={produto.id}
                        onClick={() => {
                          setNotificacoesAbertas(false)
                          document.getElementById('produtos-criticos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }}
                      >
                        <span className={`notification-dot nivel-${produto.nivel.toLowerCase().replace('ç', 'c').replace('ã', 'a')}`} />
                        <span>
                          <strong>{produto.nome}</strong>
                          <small>Estoque atual: {produto.atual.toLocaleString('pt-BR')} · Mínimo: {produto.minimo.toLocaleString('pt-BR')}</small>
                        </span>
                      </button>
                    ))}

                    {!produtosCriticos.length && (
                      <div className="notifications-empty">
                        <Bell size={24} />
                        <strong>Tudo certo por aqui</strong>
                        <small>Não há produtos abaixo do estoque mínimo.</small>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="notifications-footer"
                    onClick={() => {
                      setNotificacoesAbertas(false)
                      navigate('/produtos')
                    }}
                  >
                    Ver todos os produtos
                  </button>
                </section>
              )}
            </div>

            <span className="dashboard-brand-name">SYNERGIAS</span>

            <button type="button" className="dashboard-logout" title="Sair do Synergias ERP" aria-label="Sair do Synergias ERP" onClick={sair}>
              <LogOut size={21} />
            </button>
          </div>
        </header>

        <section className="dashboard-alert-strip" aria-label="Alertas operacionais">
          <article className="dashboard-alert-card alert-produtos">
            <div className="dashboard-alert-icon">
              <PackageX size={24} />
            </div>
            <div>
              <span>Produtos em falta</span>
              <strong>{produtosEmFalta.length.toLocaleString('pt-BR')}</strong>
              <small>{produtosEmFalta.length ? 'Itens com estoque zerado ou negativo' : 'Nenhum produto em falta'}</small>
            </div>
          </article>

          <article className="dashboard-alert-card alert-clientes">
            <div className="dashboard-alert-icon">
              <UserRoundX size={24} />
            </div>
            <div>
              <span>Clientes sem compra no mês</span>
              <strong>{clientesSemCompraMes.length.toLocaleString('pt-BR')}</strong>
              <small>Clientes ativos sem pedido no mês atual</small>
            </div>
          </article>

          <article className="dashboard-alert-card alert-atrasos">
            <div className="dashboard-alert-icon">
              <Clock3 size={24} />
            </div>
            <div>
              <span>Pagamentos em atraso</span>
              <strong>{pedidosPagamentoAtrasado.length.toLocaleString('pt-BR')}</strong>
              <small>Contas a receber vencidas com saldo aberto</small>
            </div>
          </article>

          <article className="dashboard-alert-card alert-orcamentos">
            <div className="dashboard-alert-icon">
              <FileClock size={24} />
            </div>
            <div>
              <span>Orçamentos pendentes</span>
              <strong>{orcamentosPendentes.length.toLocaleString('pt-BR')}</strong>
              <small>Aguardando aprovação ou decisão do cliente</small>
            </div>
          </article>
        </section>

        <SummaryQuickDrawer />

        <section className="dashboard-overview-grid">
          <div className="overview-main-column full-width">
            <section className="panel dashboard-charts-panel">
              <div className="panel-header dashboard-charts-header">
                <div>
                  <h2>Desempenho mensal</h2>
                  <span>Gráficos em roller com comparação por período</span>
                </div>

                <div className="charts-header-actions">
                  <div className="period-switcher" aria-label="Período dos gráficos">
                    <button type="button" className={periodo === '6m' ? 'active' : ''} onClick={() => setPeriodo('6m')}>6 meses</button>
                    <button type="button" className={periodo === '12m' ? 'active' : ''} onClick={() => setPeriodo('12m')}>12 meses</button>
                    <button type="button" className={periodo === 'ano' ? 'active' : ''} onClick={() => setPeriodo('ano')}>Ano atual</button>
                  </div>

                  <button type="button" className="section-toggle" onClick={() => setGraficosAbertos((atual) => !atual)}>
                    {graficosAbertos ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {graficosAbertos && (
                <>
                  <div className="charts-toolbar">
                    <div className="charts-toolbar-copy">
                      <strong>Roller horizontal</strong>
                      <span>Use as setas para navegar entre os gráficos</span>
                    </div>

                    <div className="roller-nav-buttons">
                      <button type="button" className="roller-nav" onClick={() => rolarGraficos('esquerda')} title="Rolar gráficos para a esquerda">
                        <ChevronLeft size={18} />
                      </button>
                      <button type="button" className="roller-nav" onClick={() => rolarGraficos('direita')} title="Rolar gráficos para a direita">
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="chart-roller" ref={rollerRef}>
                    <ChartCard titulo="Vendas" subtitulo="Comparação mensal do valor de vendas" labels={meses.map((mes) => mes.label)} series={[{ nome: 'Vendas', valores: vendasMes }]} formato="moeda" compacto />
                    <ChartCard titulo="Compras" subtitulo="Comparação mensal do valor de compras" labels={meses.map((mes) => mes.label)} series={[{ nome: 'Compras', valores: comprasMes }]} formato="moeda" compacto />
                    <ChartCard titulo="Valor de estoque" subtitulo="Evolução mensal estimada pelo saldo e movimentações" labels={meses.map((mes) => mes.label)} series={[{ nome: 'Estoque', valores: estoqueMes }]} formato="moeda" compacto />
                    <ChartCard titulo="Movimentação de estoque" subtitulo="Entradas e saídas por mês" labels={meses.map((mes) => mes.label)} series={[{ nome: 'Entradas', valores: entradasMes }, { nome: 'Saídas', valores: saidasMes }]} formato="numero" compacto />
                  </div>
                </>
              )}
            </section>
          </div>
        </section>

        <section className="panel dashboard-shortcuts">
          <div className="panel-header">
            <div>
              <h2>Atalhos rápidos</h2>
              <span>Acesse as rotinas mais usadas</span>
            </div>
          </div>

          <div className="shortcut-grid">
            <button type="button" className="shortcut vendas" onClick={() => navigate('/vendas/orcamentos/novo')}>
              <FileChartColumnIncreasing size={32} />
              <span>Novo orçamento</span>
            </button>
            <button type="button" className="shortcut produtos" onClick={() => navigate('/produtos/novo')}>
              <PackagePlus size={32} />
              <span>Cadastrar produto</span>
            </button>
            <button type="button" className="shortcut clientes" onClick={() => navigate('/clientes/novo')}>
              <UserPlus size={32} />
              <span>Adicionar cliente</span>
            </button>
            <button type="button" className="shortcut compras" onClick={() => navigate('/compras')}>
              <ShoppingCart size={32} />
              <span>Nova compra</span>
            </button>
          </div>
        </section>

        <section className="dashboard-lower-grid">
          <article className="panel critical-products-panel" id="produtos-criticos">
            <div className="panel-header">
              <div>
                <h2>Produtos críticos</h2>
                <span>Produtos no mínimo ou abaixo do estoque mínimo</span>
              </div>
              <CircleAlert size={20} />
            </div>

            <div className="critical-table-wrap">
              <table className="critical-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Estoque atual</th>
                    <th>Estoque mínimo</th>
                    <th>Qtd. faltante</th>
                    <th>Nível</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosCriticos.map((produto) => (
                    <tr key={produto.id}>
                      <td><strong>{produto.nome}</strong></td>
                      <td>{produto.atual.toLocaleString('pt-BR')}</td>
                      <td>{produto.minimo.toLocaleString('pt-BR')}</td>
                      <td>{produto.faltante.toLocaleString('pt-BR')}</td>
                      <td>
                        <span className={`critical-level nivel-${produto.nivel.toLowerCase().replace('ç', 'c').replace('ã', 'a')}`}>
                          {produto.nivel === 'Crítico' ? '🔴' : produto.nivel === 'Atenção' ? '🟠' : '🟡'} {produto.nivel}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {!produtosCriticos.length && (
                    <tr>
                      <td colSpan={5} className="critical-empty">Nenhum produto abaixo do estoque mínimo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className={`panel dashboard-agenda ${agendaAberta ? 'open' : 'collapsed'}`}>
            <div className="panel-header dashboard-agenda-header">
              <div>
                <h2>Agenda</h2>
                <span>Rotina operacional</span>
              </div>

              <div className="agenda-header-actions">
                <CalendarDays size={20} />
                <button
                  type="button"
                  className="agenda-toggle"
                  onClick={() => setAgendaAberta((atual) => !atual)}
                  title={agendaAberta ? 'Recolher agenda' : 'Abrir agenda'}
                >
                  {agendaAberta ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>
            </div>

            {!agendaAberta && (
              <div className="agenda-collapsed-preview">
                <input
                  value={descricao}
                  onChange={(event) => setDescricao(event.target.value)}
                  placeholder="O que você precisa fazer?"
                  onFocus={() => setAgendaAberta(true)}
                  aria-label="Compromisso da agenda"
                />
                <input
                  type="date"
                  value={data}
                  onChange={(event) => setData(event.target.value)}
                  aria-label="Data do compromisso"
                />
              </div>
            )}

            {agendaAberta && (
              <div className="agenda-content">
                <div className="agenda-form">
                  <input
                    value={descricao}
                    onChange={(event) => setDescricao(event.target.value)}
                    placeholder="O que você precisa fazer?"
                    onKeyDown={(event) => { if (event.key === 'Enter') salvarAgenda() }}
                  />

                  <div className="agenda-form-row">
                    <input type="date" value={data} onChange={(event) => setData(event.target.value)} />
                    <input type="time" value={hora} onChange={(event) => setHora(event.target.value)} />
                    <button type="button" className="agenda-save" onClick={salvarAgenda} title={editandoId ? 'Salvar edição' : 'Adicionar tarefa'}>
                      {editandoId ? <Check size={19} /> : <Plus size={19} />}
                    </button>
                    {editandoId && (
                      <button type="button" className="agenda-cancel" onClick={limparFormularioAgenda} title="Cancelar edição">
                        <X size={19} />
                      </button>
                    )}
                  </div>
                </div>

                <AgendaGrupo titulo="Hoje" itens={agendaHoje} classe="hoje" />
                <AgendaGrupo titulo="Próximos" itens={agendaProximos} classe="proximos" />
                <AgendaGrupo titulo="Atrasados" itens={agendaAtrasados} classe="atrasados" />
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  )
}

export default Dashboard
