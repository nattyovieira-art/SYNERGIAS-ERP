import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Filter,
  List,
  Printer,
  Search,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import type { Venda } from '../../types/Venda'
import { ERP_STORAGE_UPDATED_EVENT } from '../../services/erpApi'
import { listarVendasStorage } from '../../services/vendasStorage'

import '../../styles/relatorios.css'
import '../../styles/brindes.css'

function normalizar(valor: string) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function dataBr(valor: string) {
  return valor ? valor.split('-').reverse().join('/') : '-'
}

export default function RelatorioBrindes() {
  const navigate = useNavigate()
  const [vendas, setVendas] = useState<Venda[]>(() => listarVendasStorage())
  const [buscaDigitada, setBuscaDigitada] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')

  useEffect(() => {
    const atualizar = () => setVendas(listarVendasStorage())
    const aoAtualizarStorage = (evento: Event) => {
      const detalhe = (evento as CustomEvent<{ collection?: string }>).detail
      if (!detalhe?.collection || detalhe.collection === 'vendas') atualizar()
    }

    atualizar()
    window.addEventListener(ERP_STORAGE_UPDATED_EVENT, aoAtualizarStorage)
    return () => window.removeEventListener(ERP_STORAGE_UPDATED_EVENT, aoAtualizarStorage)
  }, [])

  const brindes = useMemo(
    () =>
      vendas.flatMap((venda) =>
        (venda.brindes || []).map((brinde) => ({
          ...brinde,
          pedido: venda.numeroPedido || '-',
        })),
      ),
    [vendas],
  )

  const totalFiltrosAtivos = Number(Boolean(inicio)) + Number(Boolean(fim))

  const filtrados = useMemo(
    () =>
      brindes.filter((brinde) => {
        const texto = normalizar(
          [
            brinde.produtoDescricao,
            brinde.destinatario,
            brinde.clienteNome,
            brinde.vendedor,
            brinde.observacao,
            brinde.pedido,
          ].join(' '),
        )

        return (
          (!buscaAplicada || texto.includes(normalizar(buscaAplicada))) &&
          (!inicio || brinde.data >= inicio) &&
          (!fim || brinde.data <= fim)
        )
      }),
    [brindes, buscaAplicada, fim, inicio],
  )

  const resumo = useMemo(
    () => ({
      unidades: filtrados.reduce(
        (soma, brinde) => soma + Number(brinde.quantidade || 0),
        0,
      ),
      destinatarios: new Set(
        filtrados.map((brinde) => brinde.destinatario).filter(Boolean),
      ).size,
      clientes: new Set(
        filtrados.map((brinde) => brinde.clienteNome).filter(Boolean),
      ).size,
      registros: filtrados.length,
    }),
    [filtrados],
  )

  function executarBusca() {
    setBuscaAplicada(buscaDigitada.trim())
  }

  function limparFiltros() {
    setInicio('')
    setFim('')
  }

  return (
    <main className="relatorios-page">
      <Sidebar />

      <section className="relatorios-content brindes-relatorio-content">
        <PageHeader
          category="Relatórios"
          title="Brindes concedidos"
          subtitle="Acompanhe os brindes entregues por pedido, produto, destinatário e cliente."
        />

        <section className="brindes-actionbar">
          <button
            type="button"
            className="brindes-action-btn brindes-action-back"
            onClick={() => navigate('/relatorios/vendas')}
            title="Voltar"
            aria-label="Voltar"
          >
            <ArrowLeft size={25} strokeWidth={2.3} />
          </button>

          <button
            type="button"
            className="brindes-action-btn brindes-action-list"
            title="Lista de brindes"
            aria-label="Lista de brindes"
          >
            <List size={25} strokeWidth={2.3} />
          </button>

          <button
            type="button"
            className="brindes-action-btn brindes-action-search"
            onClick={executarBusca}
            title="Buscar"
            aria-label="Buscar"
          >
            <Search size={25} strokeWidth={2.3} />
          </button>

          <div className="brindes-searchbox">
            <input
              value={buscaDigitada}
              onChange={(event) => setBuscaDigitada(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') executarBusca()
              }}
              placeholder="Buscar destinatário, cliente, produto, pedido ou vendedor"
            />
          </div>

          <button
            type="button"
            className={`brindes-filter-btn ${filtrosAbertos ? 'is-open' : ''}`}
            onClick={() => setFiltrosAbertos((aberto) => !aberto)}
          >
            <Filter size={22} strokeWidth={2.3} />
            
            {totalFiltrosAtivos > 0 && (
              <strong>{totalFiltrosAtivos}</strong>
            )}
          </button>

          {totalFiltrosAtivos > 0 && (
            <button
              type="button"
              className="brindes-clear-btn"
              onClick={limparFiltros}
              title="Limpar filtros"
            >
              <X size={20} strokeWidth={2.4} />
              <span>Limpar filtros</span>
            </button>
          )}

          <button
            type="button"
            className="brindes-action-btn brindes-action-print"
            onClick={() => window.print()}
            title="Imprimir relatório"
            aria-label="Imprimir relatório"
          >
            <Printer size={25} strokeWidth={2.3} />
          </button>
        </section>

        {filtrosAbertos && (
          <section className="brindes-filter-panel">
            <label>
              Data inicial
              <input
                type="date"
                value={inicio}
                onChange={(event) => setInicio(event.target.value)}
              />
            </label>
            <label>
              Data final
              <input
                type="date"
                value={fim}
                onChange={(event) => setFim(event.target.value)}
              />
            </label>
          </section>
        )}

        <section className="brindes-resumo">
          <article>
            <span>Unidades concedidas</span>
            <strong>{resumo.unidades}</strong>
          </article>
          <article>
            <span>Destinatários</span>
            <strong>{resumo.destinatarios}</strong>
          </article>
          <article>
            <span>Clientes</span>
            <strong>{resumo.clientes}</strong>
          </article>
          <article>
            <span>Registros</span>
            <strong>{resumo.registros}</strong>
          </article>
        </section>

        <section className="brindes-table-card">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Pedido</th>
                <th>Produto</th>
                <th>Qtd.</th>
                <th>Destinatário</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Estoque</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((brinde) => (
                <tr key={brinde.id}>
                  <td>{dataBr(brinde.data)}</td>
                  <td>{brinde.pedido}</td>
                  <td>
                    <strong>{brinde.produtoDescricao}</strong>
                    {brinde.observacao && <small>{brinde.observacao}</small>}
                  </td>
                  <td>{brinde.quantidade}</td>
                  <td>{brinde.destinatario}</td>
                  <td>{brinde.clienteNome || '-'}</td>
                  <td>{brinde.vendedor || '-'}</td>
                  <td>
                    <span
                      className={`brindes-estoque-status ${
                        brinde.estoqueBaixado ? 'is-baixado' : 'is-pendente'
                      }`}
                    >
                      {brinde.estoqueBaixado ? 'Baixado' : 'Pendente'}
                    </span>
                  </td>
                </tr>
              ))}
              {!filtrados.length && (
                <tr>
                  <td colSpan={8} className="brindes-empty">
                    Nenhum brinde encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  )
}
