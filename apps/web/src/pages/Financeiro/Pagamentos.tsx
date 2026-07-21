import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, List, Search, WalletCards } from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'

import '../../styles/financeiro.css'
import '../../styles/pagamentos.css'

type ParcelaPagamento = {
  vencimento?: string
  tipoCobranca?: string
  bancoCobranca?: string
  observacao?: string
  valor?: number
  statusBoleto?: string
  dataRecebimento?: string
}

type VendaPagamento = {
  id?: string
  numeroPedido?: string
  numero?: string
  clienteNome?: string
  formaPagamento?: string
  tipoCobranca?: string
  bancoCobranca?: string
  parcelas?: ParcelaPagamento[]
}

type PagamentoLista = {
  id: string
  pedido: string
  cliente: string
  vencimento: string
  forma: string
  cobranca: string
  valor: number
  status: string
  dataRecebimento: string
}

const STORAGE_VENDAS = 'synergias_vendas'

function carregarPagamentos(): PagamentoLista[] {
  try {
    const vendas = JSON.parse(localStorage.getItem(STORAGE_VENDAS) || '[]') as VendaPagamento[]
    if (!Array.isArray(vendas)) return []

    return vendas.flatMap((venda, vendaIndex) => {
      const parcelas = Array.isArray(venda.parcelas) ? venda.parcelas : []
      return parcelas.map((parcela, parcelaIndex) => ({
        id: `${venda.id || vendaIndex}-${parcelaIndex}`,
        pedido: String(venda.numeroPedido || venda.numero || venda.id || '-'),
        cliente: venda.clienteNome || 'Cliente não informado',
        vencimento: parcela.vencimento || '',
        forma: venda.formaPagamento || parcela.tipoCobranca || venda.tipoCobranca || '-',
        cobranca: parcela.bancoCobranca || venda.bancoCobranca || parcela.tipoCobranca || '-',
        valor: Number(parcela.valor || 0),
        status: parcela.statusBoleto || 'Pendente',
        dataRecebimento: parcela.dataRecebimento || '',
      }))
    })
  } catch {
    return []
  }
}

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBrasil(valor: string) {
  if (!valor) return '-'
  const [ano, mes, dia] = valor.split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor
}

function Pagamentos() {
  const navigate = useNavigate()
  const pagamentos = useMemo(() => carregarPagamentos(), [])
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('TODOS')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim())
    return pagamentos.filter((pagamento) => {
      const passaBusca = !termo || normalizar([
        pagamento.pedido,
        pagamento.cliente,
        pagamento.forma,
        pagamento.cobranca,
        pagamento.status,
        String(pagamento.valor),
      ].join(' ')).includes(termo)
      const passaStatus = status === 'TODOS' || normalizar(pagamento.status).includes(normalizar(status))
      const passaInicio = !dataInicio || pagamento.vencimento >= dataInicio
      const passaFim = !dataFim || pagamento.vencimento <= dataFim
      return passaBusca && passaStatus && passaInicio && passaFim
    })
  }, [pagamentos, busca, status, dataInicio, dataFim])

  const resumo = useMemo(() => {
    const recebido = pagamentos.filter((p) => normalizar(p.status).includes('pago') || normalizar(p.status).includes('receb')).reduce((s, p) => s + p.valor, 0)
    const pendente = pagamentos.filter((p) => !normalizar(p.status).includes('pago') && !normalizar(p.status).includes('receb')).reduce((s, p) => s + p.valor, 0)
    const hoje = new Date().toISOString().slice(0, 10)
    const vencido = pagamentos.filter((p) => p.vencimento && p.vencimento < hoje && !normalizar(p.status).includes('pago') && !normalizar(p.status).includes('receb')).reduce((s, p) => s + p.valor, 0)
    return { recebido, pendente, vencido }
  }, [pagamentos])

  return (
    <main className="financeiro-page pagamentos-page">
      <Sidebar />
      <section className="financeiro-content">
        <PageHeader category="Financeiro" title="Pagamentos" subtitle="Acompanhe cobranças, vencimentos, recebimentos e vínculos dos pedidos." />

        <div className="pagamentos-toolbar">
          <button type="button" className="erp-botao-icone" title="Voltar" onClick={() => navigate('/financeiro')}><ArrowLeft size={23} /></button>
          <div className="pagamentos-busca"><Search size={19} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pedido, cliente, forma, banco ou status..." /></div>
        </div>

        <div className="pagamentos-resumo">
          <article><span>Recebido</span><strong>{moeda(resumo.recebido)}</strong></article>
          <article><span>Pendente</span><strong>{moeda(resumo.pendente)}</strong></article>
          <article><span>Vencido</span><strong>{moeda(resumo.vencido)}</strong></article>
          <article><span>Pagamentos</span><strong>{pagamentos.length}</strong></article>
        </div>

        <section className="pagamentos-card">
          <div className="pagamentos-card-header"><div><List size={22} /><div><h2>Pagamentos dos pedidos</h2><p>Lista consolidada das cobranças geradas nos pedidos.</p></div></div></div>
          <div className="pagamentos-filtros">
            <label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="TODOS">Todos</option><option value="Pendente">Pendentes</option><option value="Pago">Pagos/recebidos</option><option value="Vencido">Vencidos</option></select></label>
            <label>Vencimento de<input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></label>
            <label>Vencimento até<input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></label>
            <button type="button" onClick={() => { setStatus('TODOS'); setDataInicio(''); setDataFim(''); setBusca('') }}>Limpar filtros</button>
          </div>

          <div className="pagamentos-tabela-wrapper">
            <table className="pagamentos-tabela">
              <thead><tr><th>Pedido</th><th>Cliente / Condomínio</th><th>Vencimento</th><th>Forma</th><th>Tipo / Conta / Cobrança</th><th>Valor</th><th>Status</th><th>Recebimento</th></tr></thead>
              <tbody>
                {filtrados.map((pagamento) => <tr key={pagamento.id}><td>{pagamento.pedido}</td><td title={pagamento.cliente}>{pagamento.cliente}</td><td>{dataBrasil(pagamento.vencimento)}</td><td>{pagamento.forma}</td><td>{pagamento.cobranca}</td><td>{moeda(pagamento.valor)}</td><td><span className="pagamentos-status">{pagamento.status}</span></td><td>{dataBrasil(pagamento.dataRecebimento)}</td></tr>)}
                {!filtrados.length && <tr><td colSpan={8} className="pagamentos-vazio"><WalletCards size={26} />Nenhum pagamento encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}

export default Pagamentos
