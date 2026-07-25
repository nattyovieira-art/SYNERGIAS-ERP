import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  FilePlus2,
  Filter,
  Pencil,
  MailWarning,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import type { ContaReceber } from '../../types/Financeiro'
import {
  excluirContaReceberStorage,
  listarContasReceberStorage,
} from '../../services/financeiroStorage'
import {
  listarVendasStorage,
  salvarVendaStorage,
} from '../../services/vendasStorage'

import '../../styles/financeiro.css'

type StatusFiltro =
  | ''
  | 'Aberta'
  | 'Parcialmente paga'
  | 'Paga'
  | 'Vencida'
  | 'Cancelada'

type ConciliadoFiltro = '' | 'conciliado' | 'pendente'


function normalizarTexto(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function ContasReceber() {
  const navigate = useNavigate()

  const [contas, setContas] = useState<ContaReceber[]>(listarContasReceberStorage())
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('')
  const [bancoFiltro, setBancoFiltro] = useState('')
  const [conciliadoFiltro, setConciliadoFiltro] = useState<ConciliadoFiltro>('')
  const [vencimentoInicio, setVencimentoInicio] = useState('')
  const [vencimentoFim, setVencimentoFim] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const bancosDisponiveis = useMemo(() => {
    const bancos = contas
      .map((conta) => conta.bancoCobranca || '')
      .filter((banco) => banco.trim() !== '')

    return Array.from(new Set(bancos)).sort((a, b) => a.localeCompare(b))
  }, [contas])

  const contasFiltradas = useMemo(() => {
    const termo = normalizarTexto(busca.trim())

    return contas
      .filter((conta: ContaReceber) => {
        const texto = [
          conta.clienteNome,
          conta.clienteDocumento || '',
          conta.pedidoNumero || '',
          conta.numeroBoleto || '',
          conta.numeroNotaFiscal || '',
          conta.descricao || '',
          conta.formaPagamento || '',
          conta.tipoCobranca || '',
          conta.bancoCobranca || '',
          conta.status || '',
        ]
          .join(' ')
          .toLowerCase()

        const bateBusca = !termo || normalizarTexto(texto).includes(termo)
        const bateStatus = !statusFiltro || conta.status === statusFiltro
        const bateBanco = !bancoFiltro || conta.bancoCobranca === bancoFiltro

        const bateConciliado =
          !conciliadoFiltro ||
          (conciliadoFiltro === 'conciliado' && conta.conciliado) ||
          (conciliadoFiltro === 'pendente' && !conta.conciliado)

        const bateVencimentoInicio =
          !vencimentoInicio ||
          !conta.dataVencimento ||
          conta.dataVencimento >= vencimentoInicio

        const bateVencimentoFim =
          !vencimentoFim || !conta.dataVencimento || conta.dataVencimento <= vencimentoFim

        return (
          bateBusca &&
          bateStatus &&
          bateBanco &&
          bateConciliado &&
          bateVencimentoInicio &&
          bateVencimentoFim
        )
      })
      .sort((a, b) => {
        return (a.dataVencimento || '').localeCompare(b.dataVencimento || '')
      })
  }, [
    bancoFiltro,
    busca,
    conciliadoFiltro,
    contas,
    statusFiltro,
    vencimentoFim,
    vencimentoInicio,
  ])

  const resumo = useMemo(() => {
    return {
      totalAberto: contasFiltradas.reduce(
        (total: number, conta: ContaReceber) =>
          conta.status !== 'Paga' && conta.status !== 'Cancelada'
            ? total + Number(conta.saldoAberto || 0)
            : total,
        0,
      ),
      totalRecebido: contasFiltradas.reduce(
        (total: number, conta: ContaReceber) => total + Number(conta.valorRecebido || 0),
        0,
      ),
      totalContas: contasFiltradas.length,
      totalPendentesConciliacao: contasFiltradas.filter((conta) => !conta.conciliado)
        .length,
    }
  }, [contasFiltradas])

  function dinheiro(valor: number) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function formatarData(data?: string) {
    if (!data) return '-'

    const partes = data.split('-')

    if (partes.length !== 3) return data

    return `${partes[2]}/${partes[1]}/${partes[0]}`
  }

  function excluirConta(conta: ContaReceber) {
    const confirmar = window.confirm(
      'Deseja excluir esta conta a receber? Se ela estiver vinculada a um pedido, o pagamento da parcela será desfeito.',
    )

    if (!confirmar) return

    if (conta.pedidoId || conta.pedidoNumero) {
      const venda = listarVendasStorage().find(
        (item) =>
          String(item.id) === String(conta.pedidoId || '') ||
          String(item.numeroPedido || '') === String(conta.pedidoNumero || ''),
      )

      if (venda) {
        const parcelasAtualizadas = venda.parcelas.map((parcela) => {
          const mesmaParcela = conta.parcelaNumero
            ? Number(parcela.numero) === Number(conta.parcelaNumero)
            : parcela.vencimento === conta.dataVencimento &&
              Math.abs(Number(parcela.valor || 0) - Number(conta.valorOriginal || 0)) < 0.01

          if (!mesmaParcela) return parcela

          return {
            ...parcela,
            statusBoleto: 'Pendente' as const,
            dataPagamentoBoleto: '',
            horarioPagamentoBoleto: '',
            valorRecebido: 0,
            jurosRecebimento: 0,
            descontoRecebimento: 0,
            contaRecebimento: '',
            observacaoRecebimento: '',
          }
        })

        const todasPagas =
          parcelasAtualizadas.length > 0 &&
          parcelasAtualizadas.every((parcela) => parcela.statusBoleto === 'Pago')
        const algumaPaga = parcelasAtualizadas.some(
          (parcela) => parcela.statusBoleto === 'Pago',
        )

        salvarVendaStorage({
          ...venda,
          parcelas: parcelasAtualizadas,
          statusBoleto: todasPagas ? 'Pago' : algumaPaga ? 'Gerado' : 'Pendente',
        })
      }
    }

    excluirContaReceberStorage(conta.id)
    setContas(listarContasReceberStorage())
  }

  function atualizarDadosTela() {
    window.location.reload()
  }

  function limparFiltros() {
    setBusca('')
    setStatusFiltro('')
    setBancoFiltro('')
    setConciliadoFiltro('')
    setVencimentoInicio('')
    setVencimentoFim('')
  }

  function formaPrincipal(conta: ContaReceber) {
    const forma = String(conta.formaPagamento || conta.tipoCobranca || '').trim()
    return normalizarTexto(forma).includes('boleto') ? 'BOLETO' : forma || '-'
  }

  function detalheForma(conta: ContaReceber) {
    return String(conta.tipoCobranca || conta.formaPagamento || '-').trim()
  }

  function podeEnviarCobranca(conta: ContaReceber) {
    const hoje = new Date().toISOString().slice(0, 10)
    return Boolean(
      conta.pedidoId &&
      conta.dataVencimento &&
      conta.dataVencimento < hoje &&
      conta.status !== 'Paga' &&
      conta.status !== 'Cancelada' &&
      Number(conta.saldoAberto || 0) > 0,
    )
  }

  function abrirCobranca(conta: ContaReceber) {
    if (!conta.pedidoId) {
      alert('Esta conta não possui um pedido vinculado.')
      return
    }
    navigate(
      `/vendas/pedidos/editar/${encodeURIComponent(conta.pedidoId)}?cobrancaAtraso=${encodeURIComponent(conta.id)}`,
    )
  }

  return (
    <main className="financeiro-page">
      <Sidebar />

      <section className="financeiro-content">
        <PageHeader
          category="Financeiro"
          title="Contas a Receber"
          subtitle="Controle interno de recebíveis gerados pelos pedidos e boletos"
        />

        <div className="financeiro-toolbar financeiro-toolbar-padrao">
          <div className="financeiro-toolbar-left-actions">
            <button
              type="button"
              className="financeiro-icon-button financeiro-icon-back"
              onClick={() => navigate('/financeiro')}
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft size={25} strokeWidth={2.4} />
            </button>

            <label className="financeiro-busca financeiro-busca-toolbar">
              <Search size={18} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por cliente, pedido, boleto, nota fiscal, banco ou documento"
              />
            </label>

            <button
              type="button"
              className={`financeiro-icon-button financeiro-icon-filter ${
                mostrarFiltros ? 'ativo' : ''
              }`}
              onClick={() => setMostrarFiltros((atual) => !atual)}
              title="Filtros"
              aria-label="Filtros"
            >
              <Filter size={25} strokeWidth={2.4} />
            </button>
          </div>

          <div className="financeiro-toolbar-right-actions">
            <button
              type="button"
              className="financeiro-icon-button financeiro-icon-refresh"
              onClick={atualizarDadosTela}
              title="Atualizar"
              aria-label="Atualizar"
            >
              <RefreshCw size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="erp-botao-icone erp-botao-novo"
              onClick={() => navigate('/financeiro/contas-a-receber/nova')}
              title="Adicionar conta"
              aria-label="Adicionar conta"
            >
              <FilePlus2 size={24} />
            </button>
          </div>
        </div>

        {mostrarFiltros && (
        <div className="financeiro-filtros-avancados">
          <label className="financeiro-filtro-campo financeiro-filtro-busca-longo">
            <span>Buscar</span>

            <div className="financeiro-busca">
              <Search size={18} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por cliente, pedido, boleto, nota fiscal, banco ou documento"
              />
            </div>
          </label>

          <label className="financeiro-filtro-campo">
            <span>Status</span>

            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value as StatusFiltro)}
            >
              <option value="">Todos os status</option>
              <option value="Aberta">Pendente</option>
              <option value="Parcialmente paga">Parcialmente paga</option>
              <option value="Paga">Paga</option>
              <option value="Vencida">Vencida</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </label>

          <label className="financeiro-filtro-campo">
            <span>Banco</span>

            <select value={bancoFiltro} onChange={(e) => setBancoFiltro(e.target.value)}>
              <option value="">Todos os bancos</option>
              {bancosDisponiveis.map((banco) => (
                <option key={banco} value={banco}>
                  {banco}
                </option>
              ))}
            </select>
          </label>

          <label className="financeiro-filtro-campo">
            <span>Conciliação</span>

            <select
              value={conciliadoFiltro}
              onChange={(e) => setConciliadoFiltro(e.target.value as ConciliadoFiltro)}
            >
              <option value="">Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="conciliado">Conciliados</option>
            </select>
          </label>

          <label className="financeiro-filtro-campo">
            <span>Vencimento inicial</span>

            <div className="financeiro-campo-com-icone">
              <CalendarDays size={17} />
              <input
                type="date"
                value={vencimentoInicio}
                onChange={(e) => setVencimentoInicio(e.target.value)}
              />
            </div>
          </label>

          <label className="financeiro-filtro-campo">
            <span>Vencimento final</span>

            <div className="financeiro-campo-com-icone">
              <CalendarDays size={17} />
              <input
                type="date"
                value={vencimentoFim}
                onChange={(e) => setVencimentoFim(e.target.value)}
              />
            </div>
          </label>

          <div className="financeiro-filtro-acoes">
            <button type="button" className="financeiro-voltar" onClick={limparFiltros}>
              <X size={17} />
              Limpar filtros
            </button>

            <span>
              <Filter size={16} />
              {contasFiltradas.length} resultado(s)
            </span>
          </div>
        </div>
        )}

        <div className="financeiro-resumo-grid">
          <div className="financeiro-card-resumo">
            <span>Saldo em aberto</span>
            <strong>{dinheiro(resumo.totalAberto)}</strong>
          </div>

          <div className="financeiro-card-resumo">
            <span>Recebido</span>
            <strong>{dinheiro(resumo.totalRecebido)}</strong>
          </div>

          <div className="financeiro-card-resumo">
            <span>Pendentes de conciliação</span>
            <strong>{resumo.totalPendentesConciliacao}</strong>
          </div>
        </div>

        <div className="financeiro-tabela-card">
          <table className="financeiro-tabela">
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Cliente</th>
                <th>Pedido / Boleto</th>
                <th>Forma</th>
                <th>Valor</th>
                <th>Saldo</th>
                <th>Conciliação</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {contasFiltradas.length > 0 ? (
                contasFiltradas.map((conta: ContaReceber) => (
                  <tr key={conta.id}>
                    <td>{formatarData(conta.dataVencimento)}</td>

                    <td>
                      <strong>{conta.clienteNome}</strong>
                      <small>{conta.clienteDocumento || '-'}</small>
                    </td>

                    <td>
                      <strong>{conta.pedidoNumero || '-'}</strong>
                      <small>{conta.numeroBoleto || conta.descricao}</small>
                    </td>

                    <td>
                      <strong>{formaPrincipal(conta)}</strong>
                      <small>{detalheForma(conta)}</small>
                    </td>

                    <td>{dinheiro(conta.valorOriginal)}</td>
                    <td>{dinheiro(conta.saldoAberto)}</td>

                    <td>
                      <span
                        className={
                          conta.conciliado
                            ? 'financeiro-status paga'
                            : 'financeiro-status parcialmente-paga'
                        }
                      >
                        {conta.conciliado ? 'Conciliado' : 'Pendente'}
                      </span>
                    </td>

                    <td>
                      <div className="financeiro-acoes">
                        {podeEnviarCobranca(conta) && (
                          <button
                            type="button"
                            className="financeiro-editar-button"
                            title="Preparar e-mail de pagamento em atraso"
                            aria-label="Preparar e-mail de pagamento em atraso"
                            onClick={() => abrirCobranca(conta)}
                          >
                            <MailWarning size={17} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="financeiro-editar-button"
                          title="Abrir e ajustar recebimento"
                          aria-label="Abrir e ajustar recebimento"
                          onClick={() =>
                            navigate(`/financeiro/contas-a-receber/receber/${encodeURIComponent(conta.id)}`)
                          }
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          type="button"
                          title="Excluir"
                          aria-label="Excluir"
                          onClick={() => excluirConta(conta)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="financeiro-vazio">
                    Nenhuma conta a receber encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </section>
    </main>
  )
}

export default ContasReceber
