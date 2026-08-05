import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRightLeft,
  Banknote,
  CircleDollarSign,
  Download,
  FilePlus2,
  ReceiptText,
  List,
  Mail,
  Printer,
  TrendingUp,
  Upload,
  WalletCards,
} from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import FluxoCaixaPainel from './FluxoCaixaPainel'
import { ERP_STORAGE_UPDATED_EVENT } from '../../services/erpApi'
import { listarPedidosStorage } from '../../services/vendasStorage'

import '../../styles/financeiro.css'

type StatusContaReceber =
  | 'Aberta'
  | 'Parcialmente paga'
  | 'Paga'
  | 'Vencida'
  | 'Cancelada'

type ContaReceber = {
  id: string
  pedidoId?: string
  pedidoNumero?: string
  numeroNotaFiscal?: string
  numeroBoleto?: string
  clienteCodigo?: string
  clienteNome: string
  clienteDocumento?: string
  descricao: string
  dataEmissao: string
  dataVencimento: string
  dataRecebimento?: string
  valorOriginal: number
  valorRecebido: number
  saldoAberto: number
  formaPagamento?: string
  bancoCobranca?: string
  tipoCobranca?: string
  status: StatusContaReceber
  observacao?: string
  conciliado?: boolean
  criadoEm?: string
  atualizadoEm?: string
}

const STORAGE_CONTAS_RECEBER = 'synergias_contas_receber'

function listarContasReceberStorage(): ContaReceber[] {
  if (typeof window === 'undefined') return []

  try {
    const dados = window.localStorage.getItem(STORAGE_CONTAS_RECEBER)

    if (!dados) return []

    const contas = JSON.parse(dados)

    return Array.isArray(contas) ? (contas as ContaReceber[]) : []
  } catch {
    return []
  }
}


function formatarDinheiro(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatarData(data?: string) {
  if (!data) return '-'

  const [ano, mes, dia] = data.split('-')

  if (!ano || !mes || !dia) return data

  return `${dia}/${mes}/${ano}`
}

function obterMesAno(data?: string) {
  const valor = String(data || '').trim()
  const formatoIso = valor.match(/^(\d{4})-(\d{2})/)

  if (formatoIso) return `${formatoIso[1]}-${formatoIso[2]}`

  const formatoBrasileiro = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})/)

  if (formatoBrasileiro) return `${formatoBrasileiro[3]}-${formatoBrasileiro[2]}`

  return ''
}



function Financeiro() {
  const navigate = useNavigate()

  const [contas, setContas] = useState<ContaReceber[]>(listarContasReceberStorage)
  const [pedidos, setPedidos] = useState(listarPedidosStorage)

  useEffect(() => {
    const atualizar = () => {
      setContas(listarContasReceberStorage())
      setPedidos(listarPedidosStorage())
    }
    window.addEventListener(ERP_STORAGE_UPDATED_EVENT, atualizar)
    window.addEventListener('storage', atualizar)
    return () => {
      window.removeEventListener(ERP_STORAGE_UPDATED_EVENT, atualizar)
      window.removeEventListener('storage', atualizar)
    }
  }, [])

  const vendasMes = useMemo(() => {
    const hoje = new Date()
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    const pedidosDoMes = pedidos.filter((pedido) => {
      return pedido.statusPedido !== 'Cancelado' && obterMesAno(pedido.dataEmissao) === mesAtual
    })

    return {
      quantidade: pedidosDoMes.length,
      valor: pedidosDoMes.reduce((total, pedido) => total + Number(pedido.totalFinal || 0), 0),
    }
  }, [pedidos])


  const resumo = useMemo(() => {
    const dataAtual = new Date().toISOString().slice(0, 10)

    const totalAberto = contas.reduce((total: number, conta: ContaReceber) => {
      if (conta.status === 'Paga' || conta.status === 'Cancelada') {
        return total
      }

      return total + Number(conta.saldoAberto || 0)
    }, 0)

    const totalRecebido = contas.reduce((total: number, conta: ContaReceber) => {
      return total + Number(conta.valorRecebido || 0)
    }, 0)

    const contasAbertas = contas.filter((conta: ContaReceber) => {
      return conta.status !== 'Paga' && conta.status !== 'Cancelada'
    }).length

    const contasPagas = contas.filter((conta: ContaReceber) => {
      return conta.status === 'Paga'
    }).length

    const contasVencidas = contas.filter((conta: ContaReceber) => {
      if (conta.status === 'Paga' || conta.status === 'Cancelada') {
        return false
      }

      if (!conta.dataVencimento) {
        return false
      }

      return conta.dataVencimento < dataAtual
    }).length

    return {
      totalAberto,
      totalRecebido,
      contasAbertas,
      contasPagas,
      contasVencidas,
      totalContas: contas.length,
    }
  }, [contas])

  const contasFiltradas = useMemo(
    () => [...contas].sort((a, b) => (a.dataVencimento || '').localeCompare(b.dataVencimento || '')),
    [contas],
  )

  function exportarCSV() {
    const cabecalho = [
      'Cliente',
      'Documento',
      'Descrição',
      'Pedido',
      'Nota Fiscal',
      'Boleto',
      'Emissão',
      'Vencimento',
      'Recebimento',
      'Valor Original',
      'Valor Recebido',
      'Saldo Aberto',
      'Forma de Pagamento',
      'Banco',
      'Status',
    ]

    const linhas = contasFiltradas.map((conta) => {
      return [
        conta.clienteNome,
        conta.clienteDocumento || '',
        conta.descricao,
        conta.pedidoNumero || '',
        conta.numeroNotaFiscal || '',
        conta.numeroBoleto || '',
        formatarData(conta.dataEmissao),
        formatarData(conta.dataVencimento),
        formatarData(conta.dataRecebimento),
        formatarDinheiro(conta.valorOriginal),
        formatarDinheiro(conta.valorRecebido),
        formatarDinheiro(conta.saldoAberto),
        conta.formaPagamento || '',
        conta.bancoCobranca || '',
        conta.status,
      ]
    })

    const conteudo = [cabecalho, ...linhas]
      .map((linha) =>
        linha.map((campo) => `"${String(campo).replace(/"/g, '""')}"`).join(';'),
      )
      .join('\n')

    const blob = new Blob([`\uFEFF${conteudo}`], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'contas-a-receber-synergias.csv'
    link.click()

    URL.revokeObjectURL(url)
  }

  function imprimirRelatorio() {
    window.print()
  }

  function enviarPorEmail() {
    const assunto = encodeURIComponent('Relatório Financeiro - Synergias')
    const corpo = encodeURIComponent(
      `Resumo Financeiro Synergias\n\nTotal em aberto: ${formatarDinheiro(
        resumo.totalAberto,
      )}\nTotal recebido: ${formatarDinheiro(
        resumo.totalRecebido,
      )}\nContas em aberto: ${resumo.contasAbertas}\nContas pagas: ${
        resumo.contasPagas
      }\nContas vencidas: ${resumo.contasVencidas}`,
    )

    window.location.href = `mailto:?subject=${assunto}&body=${corpo}`
  }

  return (
    <main className="financeiro-page">
      <Sidebar />

      <section className="financeiro-content">
        <PageHeader
          category="Financeiro"
          title="Financeiro Contábil"
          subtitle="Contas a receber, recebimentos, OFX e conciliação bancária"
        />

        <div className="financeiro-toolbar financeiro-toolbar-principal">
          <div className="financeiro-toolbar-left">
            <div className="financeiro-toolbar-title">
              <span className="erp-icone-padrao erp-icone-lista">
                <List size={21} />
              </span>

              <div>
                <strong>Gestão Financeira</strong>
                <small>Resumo geral das contas e conciliações</small>
              </div>
            </div>
          </div>

          <div className="financeiro-toolbar-actions">
            <button
              type="button"
              className="erp-botao-icone erp-botao-importar"
              onClick={() => navigate('/financeiro/conciliacao-bancaria')}
              title="Importar OFX"
            >
              <Upload size={20} />
            </button>

            <button
              type="button"
              className="erp-botao-icone erp-botao-exportar"
              onClick={exportarCSV}
              title="Exportar"
            >
              <Download size={20} />
            </button>

            <button
              type="button"
              className="erp-botao-icone erp-botao-email"
              onClick={enviarPorEmail}
              title="Enviar por e-mail"
            >
              <Mail size={20} />
            </button>

            <button
              type="button"
              className="erp-botao-icone erp-botao-imprimir"
              onClick={imprimirRelatorio}
              title="Imprimir"
            >
              <Printer size={20} />
            </button>

            <button
              type="button"
              className="erp-botao-icone erp-botao-novo"
              onClick={() => navigate('/financeiro/contas-a-receber/nova')}
              title="Adicionar conta"
            >
              <FilePlus2 size={22} />
            </button>
          </div>
        </div>

        <div className="financeiro-dashboard">
          <div className="financeiro-card resumo">
            <div className="financeiro-card-icon azul">
              <TrendingUp size={28} />
            </div>

            <div>
              <span>Vendas do mês</span>
              <strong>{formatarDinheiro(vendasMes.valor)}</strong>
              <small>{vendasMes.quantidade} pedido(s) no mês atual</small>
            </div>
          </div>

          <div className="financeiro-card resumo">
            <div className="financeiro-card-icon verde">
              <CircleDollarSign size={28} />
            </div>

            <div>
              <span>Total em aberto</span>
              <strong>{formatarDinheiro(resumo.totalAberto)}</strong>
              <small>{resumo.contasAbertas} conta(s) em aberto</small>
            </div>
          </div>

          <div className="financeiro-card resumo">
            <div className="financeiro-card-icon azul">
              <WalletCards size={28} />
            </div>

            <div>
              <span>Total recebido</span>
              <strong>{formatarDinheiro(resumo.totalRecebido)}</strong>
              <small>{resumo.contasPagas} conta(s) pagas</small>
            </div>
          </div>

          <div className="financeiro-card resumo">
            <div className="financeiro-card-icon amarelo">
              <Banknote size={28} />
            </div>

            <div>
              <span>Total de contas</span>
              <strong>{resumo.totalContas}</strong>
              <small>{resumo.contasVencidas} conta(s) vencidas</small>
            </div>
          </div>
        </div>

        <div className="financeiro-modulos">
          <button
            type="button"
            className="financeiro-modulo-card"
            onClick={() => navigate('/financeiro/contas-a-receber')}
          >
            <div className="financeiro-modulo-icon verde">
              <CircleDollarSign size={34} />
            </div>

            <div>
              <h3>Contas a Receber</h3>
              <p>
                Controle contas geradas pelos pedidos, boletos, PIX, transferências e
                recebimentos manuais.
              </p>
            </div>
          </button>

          <button
            type="button"
            className="financeiro-modulo-card"
            onClick={() => navigate('/financeiro/conciliacao-bancaria')}
          >
            <div className="financeiro-modulo-icon azul">
              <ArrowRightLeft size={34} />
            </div>

            <div>
              <h3>Conciliação Bancária</h3>
              <p>
                Importe arquivo .OFX, vincule lançamentos bancários e baixe contas a
                receber automaticamente ou manualmente.
              </p>
            </div>
          </button>

          <button type="button" className="financeiro-modulo-card" onClick={() => navigate('/financeiro/contas-a-pagar')}>
            <div className="financeiro-modulo-icon amarelo"><ReceiptText size={34} /></div>
            <div><h3>Contas a Pagar</h3><p>Controle fornecedores, despesas, vencimentos e baixas de pagamentos.</p></div>
          </button>
        </div>

        <FluxoCaixaPainel />

      </section>
    </main>
  )
}

export default Financeiro
