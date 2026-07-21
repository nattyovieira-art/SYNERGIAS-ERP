import { useMemo, useState } from 'react'
import { ArrowLeft, FilePlus2, Filter, List, Printer, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import '../../styles/financeiro.css'
import '../../styles/novos-modulos.css'

type Conta = {
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

const KEY = 'synergias_contas_pagar'

function ler(): Conta[] {
  try {
    const dados = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(dados) ? (dados as Conta[]) : []
  } catch {
    return []
  }
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function dataBrasil(valor?: string) {
  if (!valor) return '-'
  const [ano, mes, dia] = valor.split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor
}

export default function ContasPagar() {
  const navigate = useNavigate()
  const [lista, setLista] = useState<Conta[]>(ler)
  const [busca, setBusca] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [status, setStatus] = useState('')

  const filtradas = useMemo(
    () =>
      lista.filter(
        (conta) =>
          (!status || conta.status === status) &&
          (!busca ||
            [conta.fornecedor, conta.documento, conta.descricao, conta.categoria, conta.valor]
              .join(' ')
              .toLowerCase()
              .includes(busca.toLowerCase())),
      ),
    [busca, lista, status],
  )

  const resumo = useMemo(
    () => ({
      aberto: lista.filter((item) => item.status === 'Em aberto').reduce((soma, item) => soma + item.valor, 0),
      pago: lista.filter((item) => item.status === 'Paga').reduce((soma, item) => soma + item.valor, 0),
      vencidas: lista.filter((item) => item.status === 'Em aberto' && item.vencimento < new Date().toISOString().slice(0, 10)).length,
      total: lista.length,
    }),
    [lista],
  )

  function persistir(novaLista: Conta[]) {
    localStorage.setItem(KEY, JSON.stringify(novaLista))
    setLista(novaLista)
  }

  function marcarPaga(conta: Conta) {
    persistir(
      lista.map((item) =>
        item.id === conta.id
          ? { ...item, status: 'Paga', dataPagamento: new Date().toISOString().slice(0, 10) }
          : item,
      ),
    )
  }

  function excluir(conta: Conta) {
    if (!window.confirm(`Deseja excluir a conta "${conta.descricao}"?`)) return
    persistir(lista.filter((item) => item.id !== conta.id))
  }

  function atualizar() {
    setLista(ler())
  }

  return (
    <main className="financeiro-page">
      <Sidebar />
      <section className="financeiro-content">
        <PageHeader category="Financeiro" title="Contas a Pagar" subtitle="Controle obrigações com fornecedores e despesas da Synergias." />

        <div className="financeiro-toolbar financeiro-toolbar-padrao">
          <div className="financeiro-toolbar-left-actions">
            <button className="financeiro-icon-button financeiro-icon-back" onClick={() => navigate('/financeiro')} title="Voltar"><ArrowLeft size={25} /></button>
            <button className="financeiro-icon-button financeiro-icon-list" title="Lista"><List size={25} /></button>
            <button className="financeiro-icon-button financeiro-icon-search" title="Buscar" onClick={() => document.querySelector<HTMLInputElement>('.contas-pagar-busca input')?.focus()}><Search size={25} /></button>
            <div className="financeiro-busca contas-pagar-busca"><Search size={18} /><input value={busca} onChange={(event) => setBusca(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') setBusca(event.currentTarget.value) }} placeholder="Buscar fornecedor, documento, descrição ou categoria" /></div>
            <button className={`financeiro-filter-button ${status ? 'ativo' : ''}`} onClick={() => setMostrarFiltros((atual) => !atual)} title="Filtros"><Filter size={20} />{status && <span>1</span>}</button>
          </div>

          <div className="financeiro-toolbar-right-actions">
            <button className="financeiro-icon-button financeiro-icon-print" onClick={() => window.print()} title="Imprimir"><Printer size={25} /></button>
            <button className="financeiro-icon-button financeiro-icon-refresh" onClick={atualizar} title="Atualizar"><RefreshCw size={25} /></button>
            <button className="financeiro-icon-button financeiro-icon-new" onClick={() => navigate('/financeiro/contas-a-pagar/nova')} title="Nova conta"><FilePlus2 size={25} strokeWidth={2.4} /></button>
          </div>
        </div>

        {mostrarFiltros && <div className="financeiro-filtros-panel"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option>Em aberto</option><option>Paga</option><option>Cancelada</option></select></label><button onClick={() => setStatus('')}>Limpar filtros</button></div>}

        <section className="novo-resumo">
          <div className="novo-resumo-card"><span>Em aberto</span><strong>{moeda(resumo.aberto)}</strong></div>
          <div className="novo-resumo-card"><span>Pago</span><strong>{moeda(resumo.pago)}</strong></div>
          <div className="novo-resumo-card"><span>Vencidas</span><strong>{resumo.vencidas}</strong></div>
          <div className="novo-resumo-card"><span>Total de contas</span><strong>{resumo.total}</strong></div>
        </section>

        <section className="novo-card">
          <div className="novo-table-wrap">
            <table className="novo-table">
              <thead><tr><th>Fornecedor</th><th>Documento</th><th>Descrição</th><th>Categoria</th><th>Emissão</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {filtradas.map((conta) => <tr key={conta.id}><td><strong>{conta.fornecedor}</strong></td><td>{conta.documento || '-'}</td><td>{conta.descricao}</td><td>{conta.categoria || 'Despesas gerais'}</td><td>{dataBrasil(conta.emissao)}</td><td>{dataBrasil(conta.vencimento)}</td><td><strong>{moeda(conta.valor)}</strong></td><td><span className={`novo-status ${conta.status === 'Paga' ? 'success' : conta.status === 'Cancelada' ? 'danger' : 'warning'}`}>{conta.status}</span></td><td><div className="financeiro-conciliacao-acoes">{conta.status === 'Em aberto' && <button type="button" onClick={() => marcarPaga(conta)}>Marcar paga</button>}<button type="button" onClick={() => excluir(conta)} title="Excluir"><Trash2 size={17} /></button></div></td></tr>)}
                {!filtradas.length && <tr><td colSpan={9} className="novo-empty">Nenhuma conta a pagar encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}
