import { useMemo, useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import '../../styles/financeiro.css'

type Conta = {
  id: string
  fornecedor: string
  descricao: string
  valor: number
  status: 'Em aberto' | 'Paga' | 'Cancelada'
  dataPagamento?: string
  formaPagamento?: string
  valorPago?: number
  observacaoPagamento?: string
}

const KEY = 'synergias_contas_pagar'
const hoje = () => new Date().toISOString().slice(0, 10)
const ler = (): Conta[] => {
  try {
    const dados = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(dados) ? dados : []
  } catch {
    return []
  }
}

export default function PagarConta() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const conta = useMemo(() => ler().find((item) => String(item.id) === id), [id])
  const [data, setData] = useState(conta?.dataPagamento || hoje())
  const [forma, setForma] = useState(conta?.formaPagamento || '')
  const [valor, setValor] = useState(String(conta?.valorPago ?? conta?.valor ?? 0).replace('.', ','))
  const [observacao, setObservacao] = useState(conta?.observacaoPagamento || '')

  function salvar() {
    const valorPago = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!conta || !data || !forma.trim() || !Number.isFinite(valorPago) || valorPago <= 0) {
      alert('Informe a data, a forma e o valor do pagamento.')
      return
    }
    const contas = ler().map((item) => item.id === conta.id
      ? {
          ...item,
          status: 'Paga' as const,
          dataPagamento: data,
          formaPagamento: forma.trim().toUpperCase(),
          valorPago,
          observacaoPagamento: observacao.trim(),
        }
      : item)
    localStorage.setItem(KEY, JSON.stringify(contas))
    navigate('/financeiro/contas-a-pagar')
  }

  if (!conta) return <main className="financeiro-page"><Sidebar /><section className="financeiro-content"><p>Conta não encontrada.</p></section></main>

  return (
    <main className="financeiro-page">
      <Sidebar />
      <section className="financeiro-content">
        <PageHeader category="Financeiro" title="Registrar Pagamento" subtitle={`${conta.fornecedor} — ${conta.descricao}`} />
        <div className="financeiro-nova-conta-actions">
          <button type="button" className="financeiro-icon-button financeiro-icon-back" onClick={() => navigate('/financeiro/contas-a-pagar')} title="Voltar"><ArrowLeft size={25} /></button>
          <button type="button" className="financeiro-icon-button financeiro-icon-save" onClick={salvar} title="Salvar pagamento"><Save size={25} /></button>
        </div>
        <section className="financeiro-nova-conta-card">
          <div className="financeiro-nova-conta-section-title"><h2>Dados do pagamento</h2></div>
          <div className="financeiro-nova-conta-grid financeiro-nova-conta-grid-3">
            <label>Data do pagamento<input type="date" value={data} onChange={(event) => setData(event.target.value)} /></label>
            <label>Forma de pagamento<input list="formas-pagamento" value={forma} onChange={(event) => setForma(event.target.value)} placeholder="PIX, transferência, boleto..." /><datalist id="formas-pagamento"><option value="PIX" /><option value="TRANSFERÊNCIA" /><option value="BOLETO" /><option value="DINHEIRO" /><option value="CARTÃO" /></datalist></label>
            <label>Valor pago<input value={valor} onChange={(event) => setValor(event.target.value)} inputMode="decimal" /></label>
          </div>
          <label className="financeiro-nova-conta-observacao">Observação<textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} /></label>
        </section>
      </section>
    </main>
  )
}
