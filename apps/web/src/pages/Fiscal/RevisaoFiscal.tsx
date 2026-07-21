import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileWarning,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import {
  listarPendenciasRevisaoFiscal,
  type PendenciaRevisaoFiscal,
} from '../../services/revisaoFiscalStorage'

import '../../styles/fiscal.css'
import '../../styles/revisao-fiscal.css'

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor || 0))
}

function formatarData(valor: string) {
  if (!valor) return '-'

  const partes = String(valor).slice(0, 10).split('-')
  if (partes.length !== 3) return valor

  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

function RevisaoFiscal() {
  const navigate = useNavigate()

  const [pendencias] = useState<PendenciaRevisaoFiscal[]>(
    () => listarPendenciasRevisaoFiscal(),
  )
  const [busca, setBusca] = useState('')
  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')
  const [pendenciaAbertaId, setPendenciaAbertaId] = useState('')

  const pendenciasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return pendencias.filter((pendencia) => {
      const emissao = String(pendencia.compra.dataEmissao || '').slice(0, 10)

      const bateBusca =
        !termo ||
        String(pendencia.compra.numeroNFe || '')
          .toLowerCase()
          .includes(termo) ||
        String(pendencia.compra.chaveAcessoNFe || '')
          .toLowerCase()
          .includes(termo) ||
        String(pendencia.compra.fornecedorNome || '')
          .toLowerCase()
          .includes(termo) ||
        String(pendencia.item.produtoCodigo || '')
          .toLowerCase()
          .includes(termo) ||
        String(pendencia.item.descricao || '')
          .toLowerCase()
          .includes(termo) ||
        String(pendencia.item.dados.ncm || '')
          .toLowerCase()
          .includes(termo) ||
        String(pendencia.item.dados.cest || '')
          .toLowerCase()
          .includes(termo)

      const bateInicio = !dataInicial || emissao >= dataInicial
      const bateFim = !dataFinal || emissao <= dataFinal

      return bateBusca && bateInicio && bateFim
    })
  }, [busca, dataFinal, dataInicial, pendencias])

  const resumo = useMemo(() => {
    const notas = new Set(pendencias.map((item) => item.compra.id))
    const fornecedores = new Set(
      pendencias.map((item) => item.compra.fornecedorDocumento),
    )

    return {
      pendencias: pendencias.length,
      notas: notas.size,
      fornecedores: fornecedores.size,
      semNcm: pendencias.filter((item) => !item.item.dados.ncm).length,
    }
  }, [pendencias])

  function atualizarPendencias() {
    window.location.reload()
  }

  function alternarPendencia(id: string) {
    setPendenciaAbertaId((atual) => (atual === id ? '' : id))
  }

  return (
    <main className="fiscal-layout">
      <Sidebar />

      <section className="fiscal-page revisao-fiscal-page">
        <PageHeader
          category="Fiscal"
          title="Revisão Fiscal"
          subtitle="Confira somente os itens que o motor fiscal não conseguiu concluir automaticamente."
        />

        <div className="fiscal-topbar">
          <button
            type="button"
            className="fiscal-icon-button fiscal-icon-back"
            title="Voltar"
            aria-label="Voltar"
            onClick={() => navigate('/fiscal')}
          >
            <ArrowLeft size={24} />
          </button>

          <button
            type="button"
            className="fiscal-icon-button fiscal-icon-refresh"
            title="Atualizar pendências fiscais"
            aria-label="Atualizar pendências fiscais"
            onClick={atualizarPendencias}
          >
            <RefreshCw size={24} />
          </button>
        </div>

        <section className="revisao-fiscal-summary-grid">
          <div className="revisao-fiscal-summary-card revisao-fiscal-summary-alert">
            <span>Itens pendentes</span>
            <strong>{resumo.pendencias}</strong>
          </div>

          <div className="revisao-fiscal-summary-card">
            <span>NF-e com pendência</span>
            <strong>{resumo.notas}</strong>
          </div>

          <div className="revisao-fiscal-summary-card">
            <span>Fornecedores envolvidos</span>
            <strong>{resumo.fornecedores}</strong>
          </div>

          <div className="revisao-fiscal-summary-card revisao-fiscal-summary-warning">
            <span>Itens sem NCM</span>
            <strong>{resumo.semNcm}</strong>
          </div>
        </section>

        <section className="revisao-fiscal-filter-card">
          <div className="revisao-fiscal-search">
            <Search size={18} />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar NF-e, fornecedor, produto, NCM ou CEST"
            />
          </div>

          <label>
            Emissão de
            <input
              type="date"
              value={dataInicial}
              onChange={(event) => setDataInicial(event.target.value)}
            />
          </label>

          <label>
            Emissão até
            <input
              type="date"
              value={dataFinal}
              onChange={(event) => setDataFinal(event.target.value)}
            />
          </label>
        </section>

        <section className="revisao-fiscal-list-card">
          <div className="revisao-fiscal-list-title">
            <div>
              <h2>Fila de Revisão Fiscal</h2>
              <p>
                {pendenciasFiltradas.length} item(ns) exigindo conferência.
              </p>
            </div>

            <div className="revisao-fiscal-engine-note">
              <ShieldCheck size={18} />
              <span>Somente exceções aparecem nesta fila</span>
            </div>
          </div>

          {pendenciasFiltradas.length === 0 ? (
            <div className="revisao-fiscal-empty">
              <ShieldCheck size={30} />
              <strong>Nenhuma pendência fiscal encontrada.</strong>
              <span>
                Quando o motor fiscal não conseguir concluir um item, ele
                aparecerá automaticamente nesta fila.
              </span>
            </div>
          ) : (
            <div className="revisao-fiscal-table-wrapper">
              <table className="revisao-fiscal-table">
                <thead>
                  <tr>
                    <th>NF-e</th>
                    <th>Fornecedor</th>
                    <th>Produto</th>
                    <th>NCM</th>
                    <th>CEST</th>
                    <th>CFOP</th>
                    <th>Motivo</th>
                    <th>Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {pendenciasFiltradas.map((pendencia) => {
                    const aberta = pendenciaAbertaId === pendencia.id

                    return (
                      <>
                        <tr key={pendencia.id}>
                          <td>
                            <strong>
                              {pendencia.compra.numeroNFe
                                ? `NF-e ${pendencia.compra.numeroNFe}`
                                : `Compra ${pendencia.compra.numeroCompra}`}
                            </strong>
                            <span>
                              {formatarData(pendencia.compra.dataEmissao)}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {pendencia.compra.fornecedorNome || '-'}
                            </strong>
                            <span>
                              {pendencia.compra.fornecedorDocumento || '-'}
                            </span>
                          </td>

                          <td>
                            <strong>{pendencia.item.descricao}</strong>
                            <span>
                              Código {pendencia.item.produtoCodigo || '-'}
                            </span>
                          </td>

                          <td>{pendencia.item.dados.ncm || '-'}</td>
                          <td>{pendencia.item.dados.cest || '-'}</td>
                          <td>{pendencia.item.dados.cfop || '-'}</td>

                          <td>
                            <span className="revisao-fiscal-reason-badge">
                              <AlertTriangle size={14} />
                              {pendencia.item.motivos[0] ||
                                'Revisão fiscal necessária'}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="revisao-fiscal-open-button"
                              onClick={() => alternarPendencia(pendencia.id)}
                            >
                              {aberta ? (
                                <ChevronUp size={17} />
                              ) : (
                                <ChevronDown size={17} />
                              )}
                              {aberta ? 'Fechar' : 'Revisar'}
                            </button>
                          </td>
                        </tr>

                        {aberta && (
                          <tr
                            key={`${pendencia.id}-detalhe`}
                            className="revisao-fiscal-detail-row"
                          >
                            <td colSpan={8}>
                              <DetalhePendencia
                                pendencia={pendencia}
                                onAbrirRegras={() =>
                                  navigate('/fiscal/regras-ncm-cest')
                                }
                                onAbrirAnalise={() =>
                                  navigate('/fiscal/analise-entradas')
                                }
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

type DetalhePendenciaProps = {
  pendencia: PendenciaRevisaoFiscal
  onAbrirRegras: () => void
  onAbrirAnalise: () => void
}

function DetalhePendencia({
  pendencia,
  onAbrirRegras,
  onAbrirAnalise,
}: DetalhePendenciaProps) {
  const { item, compra } = pendencia

  return (
    <div className="revisao-fiscal-detail">
      <div className="revisao-fiscal-detail-header">
        <div>
          <h3>Detalhe da Pendência Fiscal</h3>
          <p>
            O item continua bloqueado para confirmação automática até que o
            tratamento fiscal seja reconhecido pelo motor.
          </p>
        </div>

        <div className="revisao-fiscal-detail-actions">
          <button
            type="button"
            className="fiscal-button-secundario"
            onClick={onAbrirAnalise}
          >
            <FileWarning size={17} />
            Abrir Análise Fiscal
          </button>

          <button
            type="button"
            className="fiscal-button-principal"
            onClick={onAbrirRegras}
          >
            <ShieldCheck size={17} />
            Abrir Regras NCM / CEST
          </button>
        </div>
      </div>

      <section className="revisao-fiscal-tax-grid">
        <div>
          <span>Produto</span>
          <strong>{item.descricao}</strong>
        </div>
        <div>
          <span>NCM</span>
          <strong>{item.dados.ncm || '-'}</strong>
        </div>
        <div>
          <span>CEST</span>
          <strong>{item.dados.cest || '-'}</strong>
        </div>
        <div>
          <span>CFOP</span>
          <strong>{item.dados.cfop || '-'}</strong>
        </div>
        <div>
          <span>CST</span>
          <strong>{item.dados.cst || '-'}</strong>
        </div>
        <div>
          <span>CSOSN</span>
          <strong>{item.dados.csosn || '-'}</strong>
        </div>
        <div>
          <span>ICMS destacado</span>
          <strong>{formatarMoeda(item.dados.valorIcms)}</strong>
        </div>
        <div>
          <span>ICMS-ST destacado</span>
          <strong>{formatarMoeda(item.dados.valorIcmsSt)}</strong>
        </div>
        <div>
          <span>IPI</span>
          <strong>{formatarMoeda(item.dados.valorIpi)}</strong>
        </div>
        <div>
          <span>Total fiscal calculado</span>
          <strong>{formatarMoeda(item.memoria.custoRealTotal)}</strong>
        </div>
      </section>

      <section className="revisao-fiscal-reasons-card">
        <h4>Motivos da revisão</h4>

        <ul>
          {item.motivos.map((motivo) => (
            <li key={motivo}>{motivo}</li>
          ))}
        </ul>
      </section>

      <div className="revisao-fiscal-guidance">
        <AlertTriangle size={19} />
        <span>
          Corrija o cadastro fiscal do produto ou cadastre/confirme uma regra
          NCM / CEST compatível. Depois atualize as pendências e reanalise a NF-e
          {compra.numeroNFe ? ` ${compra.numeroNFe}` : ''}.
        </span>
      </div>
    </div>
  )
}

export default RevisaoFiscal
