import { useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'

import '../../styles/financeiro.css'

type ContaPagar = {
  id: string
  fornecedor: string
  documento: string
  descricao: string
  categoria: string
  emissao: string
  vencimento: string
  valor: number
  status: 'Em aberto' | 'Paga' | 'Cancelada'
  dataPagamento?: string
  observacao?: string
}

const STORAGE_CONTAS_PAGAR = 'synergias_contas_pagar'

const CATEGORIAS = [
  'Compras de materiais',
  'Combustível',
  'Impostos',
  'Energia / Utilidades',
  'Aluguel',
  'Pessoal',
  'Propaganda e Marketing',
  'Despesas administrativas',
  'Despesas financeiras',
  'Outros',
]

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function listarContas(): ContaPagar[] {
  try {
    const dados = JSON.parse(localStorage.getItem(STORAGE_CONTAS_PAGAR) || '[]')
    return Array.isArray(dados) ? (dados as ContaPagar[]) : []
  } catch {
    return []
  }
}

function converterValor(valor: string) {
  const limpo = String(valor || '').replace(/[^\d,.-]/g, '')
  if (!limpo) return 0
  return Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo) || 0
}

export default function NovaContaPagar() {
  const navigate = useNavigate()
  const [fornecedor, setFornecedor] = useState('')
  const [documento, setDocumento] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('Compras de materiais')
  const [emissao, setEmissao] = useState(hoje())
  const [vencimento, setVencimento] = useState('')
  const [valor, setValor] = useState('')
  const [observacao, setObservacao] = useState('')

  function salvarConta() {
    const valorNumerico = converterValor(valor)

    if (!fornecedor.trim()) {
      alert('Informe o fornecedor ou favorecido.')
      return
    }

    if (!descricao.trim()) {
      alert('Informe a descrição da conta.')
      return
    }

    if (!categoria.trim()) {
      alert('Informe a categoria da despesa.')
      return
    }

    if (!vencimento) {
      alert('Informe a data de vencimento.')
      return
    }

    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      alert('Informe um valor válido.')
      return
    }

    const conta: ContaPagar = {
      id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fornecedor: fornecedor.trim(),
      documento: documento.trim(),
      descricao: descricao.trim(),
      categoria: categoria.trim(),
      emissao,
      vencimento,
      valor: valorNumerico,
      status: 'Em aberto',
      observacao: observacao.trim() || undefined,
    }

    localStorage.setItem(STORAGE_CONTAS_PAGAR, JSON.stringify([conta, ...listarContas()]))
    alert('Conta a pagar adicionada com sucesso.')
    navigate('/financeiro/contas-a-pagar')
  }

  return (
    <main className="financeiro-page">
      <Sidebar />

      <section className="financeiro-content">
        <PageHeader
          category="Financeiro"
          title="Nova Conta a Pagar"
          subtitle="Cadastre manualmente uma obrigação, despesa ou conta extra da Synergias."
        />

        <div className="financeiro-nova-conta-actions">
          <button type="button" className="financeiro-icon-button financeiro-icon-back" onClick={() => navigate('/financeiro/contas-a-pagar')} title="Voltar" aria-label="Voltar">
            <ArrowLeft size={25} strokeWidth={2.4} />
          </button>

          <button type="button" className="financeiro-icon-button financeiro-icon-save" onClick={salvarConta} title="Salvar" aria-label="Salvar">
            <Save size={25} strokeWidth={2.4} />
          </button>
        </div>

        <section className="financeiro-nova-conta-card">
          <div className="financeiro-nova-conta-section-title"><h2>Dados da conta</h2></div>

          <div className="financeiro-nova-conta-grid financeiro-nova-conta-grid-2">
            <label>Fornecedor / Favorecido<input value={fornecedor} onChange={(event) => setFornecedor(event.target.value)} placeholder="Ex.: CEEE, posto de combustível, fornecedor" /></label>
            <label>Documento<input value={documento} onChange={(event) => setDocumento(event.target.value)} placeholder="Nota, fatura, boleto ou referência" /></label>
          </div>

          <div className="financeiro-nova-conta-grid financeiro-nova-conta-grid-2">
            <label>Descrição<input value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Ex.: Conta de luz, abastecimento, DAS, compra de materiais" /></label>
            <label>Categoria
              <input list="categorias-conta-pagar" value={categoria} onChange={(event) => setCategoria(event.target.value)} placeholder="Selecione ou digite uma categoria" />
              <datalist id="categorias-conta-pagar">{CATEGORIAS.map((item) => <option key={item} value={item} />)}</datalist>
            </label>
          </div>

          <div className="financeiro-nova-conta-grid financeiro-nova-conta-grid-3">
            <label>Data de emissão<input type="date" value={emissao} onChange={(event) => setEmissao(event.target.value)} /></label>
            <label>Data de vencimento<input type="date" value={vencimento} onChange={(event) => setVencimento(event.target.value)} /></label>
            <label>Valor<input value={valor} onChange={(event) => setValor(event.target.value)} placeholder="0,00" inputMode="decimal" /></label>
          </div>

          <label className="financeiro-nova-conta-observacao">Observação<textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} placeholder="Informações adicionais da conta" /></label>
        </section>
      </section>
    </main>
  )
}
