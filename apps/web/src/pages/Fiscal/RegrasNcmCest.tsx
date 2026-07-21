import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Edit3,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import { listarProdutosStorage } from '../../services/produtosStorage'
import {
  confirmarRegraFiscalStorage,
  criarRegraFiscalVazia,
  excluirRegraFiscalStorage,
  inativarRegraFiscalStorage,
  listarRegrasFiscaisStorage,
  salvarRegraFiscalStorage,
  type DestinacaoRegraFiscal,
  type RegraFiscalNcmCest,
  type StatusRegraFiscal,
  type TratamentoFiscalRegra,
} from '../../services/regrasFiscaisStorage'

import '../../styles/fiscal.css'
import '../../styles/regras-ncm-cest.css'

type FiltroStatus = 'TODOS' | StatusRegraFiscal

const UFS = [
  'TODAS',
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

function formatarNcm(valor: string) {
  const numeros = String(valor || '').replace(/\D/g, '').slice(0, 8)

  if (numeros.length <= 4) return numeros
  if (numeros.length <= 6) return `${numeros.slice(0, 4)}.${numeros.slice(4)}`

  return `${numeros.slice(0, 4)}.${numeros.slice(4, 6)}.${numeros.slice(6)}`
}

function formatarCest(valor: string) {
  const numeros = String(valor || '').replace(/\D/g, '').slice(0, 7)

  if (numeros.length <= 2) return numeros
  if (numeros.length <= 5) return `${numeros.slice(0, 2)}.${numeros.slice(2)}`

  return `${numeros.slice(0, 2)}.${numeros.slice(2, 5)}.${numeros.slice(5)}`
}

function textoTratamento(valor: TratamentoFiscalRegra) {
  const mapa: Record<TratamentoFiscalRegra, string> = {
    SEM_ADICIONAL_FISCAL: 'Sem adicional fiscal',
    ICMS_ST_JA_RETIDO: 'ICMS-ST já retido',
    ICMS_ST_A_RECOLHER: 'ICMS-ST a recolher',
    ANTECIPACAO_TRIBUTARIA: 'Antecipação tributária',
    ICMS_COMPLEMENTAR: 'ICMS complementar',
    REVISAO_OBRIGATORIA: 'Revisão obrigatória',
  }

  return mapa[valor]
}

function textoStatus(valor: StatusRegraFiscal) {
  const mapa: Record<StatusRegraFiscal, string> = {
    RASCUNHO: 'RASCUNHO',
    CONFIRMADA: 'CONFIRMADA',
    INATIVA: 'INATIVA',
  }

  return mapa[valor]
}

function RegrasNcmCest() {
  const navigate = useNavigate()

  const [regras, setRegras] = useState<RegraFiscalNcmCest[]>(
    () => listarRegrasFiscaisStorage(),
  )
  const [editor, setEditor] = useState<RegraFiscalNcmCest | null>(null)
  const [busca, setBusca] = useState('')
  const [ufOrigem, setUfOrigem] = useState('TODAS')
  const [status, setStatus] = useState<FiltroStatus>('TODOS')

  const produtos = useMemo(() => listarProdutosStorage(), [])

  const produtosFiscais = useMemo(
    () =>
      produtos
        .map((produto) => {
          const item = produto as any

          return {
            codigo: String(item.codigo || item.id || ''),
            descricao: String(item.descricao || item.nome || ''),
            ncm: String(item.ncm || '').replace(/\D/g, '').slice(0, 8),
            cest: String(item.cest || '').replace(/\D/g, '').slice(0, 7),
          }
        })
        .filter((produto) => produto.ncm || produto.cest)
        .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')),
    [produtos],
  )

  const regrasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return regras
      .filter((regra) => {
        const bateBusca =
          !termo ||
          regra.ncm.includes(termo.replace(/\D/g, '')) ||
          regra.cest.includes(termo.replace(/\D/g, '')) ||
          regra.descricao.toLowerCase().includes(termo)

        const bateUf =
          ufOrigem === 'TODAS' ||
          regra.ufOrigem === 'TODAS' ||
          regra.ufOrigem === ufOrigem

        const bateStatus = status === 'TODOS' || regra.status === status

        return bateBusca && bateUf && bateStatus
      })
      .sort((a, b) => {
        if (a.status !== b.status) {
          const ordem: Record<StatusRegraFiscal, number> = {
            CONFIRMADA: 0,
            RASCUNHO: 1,
            INATIVA: 2,
          }

          return ordem[a.status] - ordem[b.status]
        }

        return a.ncm.localeCompare(b.ncm)
      })
  }, [busca, regras, status, ufOrigem])

  const resumo = useMemo(
    () => ({
      total: regras.length,
      confirmadas: regras.filter((regra) => regra.status === 'CONFIRMADA').length,
      rascunhos: regras.filter((regra) => regra.status === 'RASCUNHO').length,
      inativas: regras.filter((regra) => regra.status === 'INATIVA').length,
    }),
    [regras],
  )

  function recarregar() {
    setRegras(listarRegrasFiscaisStorage())
  }

  function novaRegra() {
    setEditor(criarRegraFiscalVazia())
  }

  function editar(regra: RegraFiscalNcmCest) {
    setEditor({ ...regra, produtosVinculados: [...regra.produtosVinculados] })
  }

  function atualizar<K extends keyof RegraFiscalNcmCest>(
    campo: K,
    valor: RegraFiscalNcmCest[K],
  ) {
    setEditor((atual) => (atual ? { ...atual, [campo]: valor } : atual))
  }

  function salvarRascunho() {
    if (!editor) return

    if (String(editor.ncm || '').replace(/\D/g, '').length !== 8) {
      alert('Informe um NCM válido com 8 dígitos.')
      return
    }

    if (!editor.descricao.trim()) {
      alert('Informe a descrição da regra fiscal.')
      return
    }

    salvarRegraFiscalStorage({
      ...editor,
      status: editor.status === 'CONFIRMADA' ? 'RASCUNHO' : editor.status,
      confirmadoEm: undefined,
    })

    recarregar()
    setEditor(null)
  }

  function confirmar(regra: RegraFiscalNcmCest) {
    const confirmou = window.confirm(
      'Confirmar esta regra fiscal? Somente regras confirmadas podem ser consultadas pela análise automática.',
    )

    if (!confirmou) return

    try {
      confirmarRegraFiscalStorage(regra.id)
      recarregar()
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar a regra fiscal.',
      )
    }
  }

  function inativar(regra: RegraFiscalNcmCest) {
    const confirmou = window.confirm(
      'Inativar esta regra? Ela deixará de ser utilizada pela análise automática.',
    )

    if (!confirmou) return

    inativarRegraFiscalStorage(regra.id)
    recarregar()
  }

  function excluir(regra: RegraFiscalNcmCest) {
    const confirmou = window.confirm(
      `Excluir a regra ${formatarNcm(regra.ncm)} - ${regra.descricao}?`,
    )

    if (!confirmou) return

    excluirRegraFiscalStorage(regra.id)
    recarregar()
  }

  function usarProduto(produtoCodigo: string) {
    if (!editor) return

    const produto = produtosFiscais.find(
      (item) => item.codigo === produtoCodigo,
    )

    if (!produto) return

    setEditor({
      ...editor,
      ncm: produto.ncm || editor.ncm,
      cest: produto.cest || editor.cest,
      descricao: editor.descricao || produto.descricao,
      produtosVinculados: editor.produtosVinculados.includes(produto.codigo)
        ? editor.produtosVinculados
        : [...editor.produtosVinculados, produto.codigo],
    })
  }

  return (
    <main className="fiscal-layout">
      <Sidebar />

      <section className="fiscal-page regras-fiscais-page">
        <PageHeader
          category="Fiscal"
          title="Regras NCM / CEST"
          subtitle="Gerencie a base de regras tributárias utilizada na análise automática das NF-e de entrada."
        />

        <div className="fiscal-topbar">
          <button
            type="button"
            className="fiscal-icon-button fiscal-icon-back"
            title="Voltar"
            aria-label="Voltar"
            onClick={() => navigate('/configuracoes')}
          >
            <ArrowLeft size={24} />
          </button>

          <button
            type="button"
            className="fiscal-icon-button fiscal-icon-add"
            title="Nova regra fiscal"
            aria-label="Nova regra fiscal"
            onClick={novaRegra}
          >
            <Plus size={25} />
          </button>
        </div>

        <section className="regras-fiscais-summary-grid">
          <div className="regras-fiscais-summary-card">
            <span>Total de regras</span>
            <strong>{resumo.total}</strong>
          </div>

          <div className="regras-fiscais-summary-card regras-fiscais-summary-ok">
            <span>Confirmadas</span>
            <strong>{resumo.confirmadas}</strong>
          </div>

          <div className="regras-fiscais-summary-card regras-fiscais-summary-draft">
            <span>Rascunhos</span>
            <strong>{resumo.rascunhos}</strong>
          </div>

          <div className="regras-fiscais-summary-card regras-fiscais-summary-off">
            <span>Inativas</span>
            <strong>{resumo.inativas}</strong>
          </div>
        </section>

        <section className="regras-fiscais-filter-card">
          <div className="regras-fiscais-search">
            <Search size={18} />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar NCM, CEST ou descrição"
            />
          </div>

          <label>
            UF de origem
            <select
              value={ufOrigem}
              onChange={(event) => setUfOrigem(event.target.value)}
            >
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status da regra
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as FiltroStatus)
              }
            >
              <option value="TODOS">Todos</option>
              <option value="CONFIRMADA">Confirmada</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="INATIVA">Inativa</option>
            </select>
          </label>
        </section>

        <section className="regras-fiscais-list-card">
          <div className="regras-fiscais-list-title">
            <div>
              <h2>Base de Regras Fiscais</h2>
              <p>{regrasFiltradas.length} regra(s) encontrada(s).</p>
            </div>

            <div className="regras-fiscais-engine-note">
              <ShieldCheck size={18} />
              <span>Somente regras confirmadas entram no motor automático</span>
            </div>
          </div>

          {regrasFiltradas.length === 0 ? (
            <div className="regras-fiscais-empty">
              <ShieldCheck size={30} />
              <strong>Nenhuma regra fiscal cadastrada.</strong>
              <span>
                Crie a primeira regra para começar a formar a memória fiscal da
                Synergias.
              </span>
            </div>
          ) : (
            <div className="regras-fiscais-table-wrapper">
              <table className="regras-fiscais-table">
                <thead>
                  <tr>
                    <th>NCM</th>
                    <th>CEST</th>
                    <th>Descrição da Regra</th>
                    <th>Origem</th>
                    <th>Destino</th>
                    <th>Aplicação</th>
                    <th>Tratamento Fiscal</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {regrasFiltradas.map((regra) => (
                    <tr key={regra.id}>
                      <td>
                        <strong>{formatarNcm(regra.ncm)}</strong>
                      </td>
                      <td>{regra.cest ? formatarCest(regra.cest) : '-'}</td>
                      <td>
                        <strong>{regra.descricao}</strong>
                        <span>
                          {regra.produtosVinculados.length} produto(s) vinculado(s)
                        </span>
                      </td>
                      <td>{regra.ufOrigem}</td>
                      <td>{regra.ufDestino}</td>
                      <td>{regra.destinacao.replaceAll('_', ' ')}</td>
                      <td>{textoTratamento(regra.tratamento)}</td>
                      <td>
                        <span
                          className={`regras-fiscais-status regras-fiscais-status-${regra.status.toLowerCase()}`}
                        >
                          {textoStatus(regra.status)}
                        </span>
                      </td>
                      <td>
                        <div className="regras-fiscais-actions">
                          <button
                            type="button"
                            title="Editar regra"
                            aria-label="Editar regra"
                            className="regras-fiscais-action-button regras-fiscais-action-edit"
                            onClick={() => editar(regra)}
                          >
                            <Edit3 size={18} />
                          </button>

                          {regra.status !== 'CONFIRMADA' && (
                            <button
                              type="button"
                              title="Confirmar regra"
                              aria-label="Confirmar regra"
                              className="regras-fiscais-action-button regras-fiscais-action-confirm"
                              onClick={() => confirmar(regra)}
                            >
                              <BadgeCheck size={18} />
                            </button>
                          )}

                          {regra.status === 'CONFIRMADA' && (
                            <button
                              type="button"
                              title="Inativar regra"
                              aria-label="Inativar regra"
                              className="regras-fiscais-action-button regras-fiscais-action-inactive"
                              onClick={() => inativar(regra)}
                            >
                              <Ban size={18} />
                            </button>
                          )}

                          <button
                            type="button"
                            title="Excluir regra"
                            aria-label="Excluir regra"
                            className="regras-fiscais-action-button regras-fiscais-action-delete"
                            onClick={() => excluir(regra)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {editor && (
          <div className="regras-fiscais-editor-overlay">
            <section className="regras-fiscais-editor">
              <div className="regras-fiscais-editor-header">
                <div>
                  <h2>
                    {regras.some((regra) => regra.id === editor.id)
                      ? 'Editar Regra Fiscal'
                      : 'Nova Regra Fiscal'}
                  </h2>
                  <p>
                    Cadastre a memória fiscal. A regra só será automática após
                    confirmação.
                  </p>
                </div>

                <button
                  type="button"
                  title="Fechar"
                  aria-label="Fechar"
                  className="regras-fiscais-close-button"
                  onClick={() => setEditor(null)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="regras-fiscais-form-grid">
                <label>
                  Produto cadastrado
                  <select
                    value=""
                    onChange={(event) => usarProduto(event.target.value)}
                  >
                    <option value="">Selecionar produto para preencher NCM/CEST</option>
                    {produtosFiscais.map((produto) => (
                      <option key={produto.codigo} value={produto.codigo}>
                        {produto.descricao}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  NCM
                  <input
                    value={formatarNcm(editor.ncm)}
                    onChange={(event) =>
                      atualizar(
                        'ncm',
                        event.target.value.replace(/\D/g, '').slice(0, 8),
                      )
                    }
                    placeholder="0000.00.00"
                  />
                </label>

                <label>
                  CEST
                  <input
                    value={formatarCest(editor.cest)}
                    onChange={(event) =>
                      atualizar(
                        'cest',
                        event.target.value.replace(/\D/g, '').slice(0, 7),
                      )
                    }
                    placeholder="00.000.00"
                  />
                </label>

                <label className="regras-fiscais-form-full">
                  Descrição da Regra
                  <input
                    value={editor.descricao}
                    onChange={(event) =>
                      atualizar('descricao', event.target.value)
                    }
                    placeholder="Ex.: Produtos de limpeza - tratamento fiscal confirmado"
                  />
                </label>

                <label>
                  UF de origem
                  <select
                    value={editor.ufOrigem}
                    onChange={(event) =>
                      atualizar('ufOrigem', event.target.value)
                    }
                  >
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  UF de destino
                  <select
                    value={editor.ufDestino}
                    onChange={(event) =>
                      atualizar('ufDestino', event.target.value)
                    }
                  >
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Destinação
                  <select
                    value={editor.destinacao}
                    onChange={(event) =>
                      atualizar(
                        'destinacao',
                        event.target.value as DestinacaoRegraFiscal,
                      )
                    }
                  >
                    <option value="REVENDA">Revenda</option>
                    <option value="USO_E_CONSUMO">Uso e Consumo</option>
                    <option value="ATIVO_IMOBILIZADO">Ativo Imobilizado</option>
                    <option value="INSUMO">Insumo</option>
                  </select>
                </label>

                <label>
                  Regime Tributário
                  <select
                    value={editor.regimeTributario}
                    onChange={(event) =>
                      atualizar('regimeTributario', event.target.value)
                    }
                  >
                    <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                    <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                    <option value="LUCRO_REAL">Lucro Real</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </label>

                <label className="regras-fiscais-form-full">
                  Tratamento Fiscal
                  <select
                    value={editor.tratamento}
                    onChange={(event) =>
                      atualizar(
                        'tratamento',
                        event.target.value as TratamentoFiscalRegra,
                      )
                    }
                  >
                    <option value="SEM_ADICIONAL_FISCAL">
                      Sem adicional fiscal
                    </option>
                    <option value="ICMS_ST_JA_RETIDO">
                      ICMS-ST já retido
                    </option>
                    <option value="ICMS_ST_A_RECOLHER">
                      ICMS-ST a recolher
                    </option>
                    <option value="ANTECIPACAO_TRIBUTARIA">
                      Antecipação tributária
                    </option>
                    <option value="ICMS_COMPLEMENTAR">
                      ICMS complementar
                    </option>
                    <option value="REVISAO_OBRIGATORIA">
                      Revisão obrigatória
                    </option>
                  </select>
                </label>

                <label className="regras-fiscais-form-full">
                  Observações da Regra
                  <textarea
                    value={editor.observacoes}
                    onChange={(event) =>
                      atualizar('observacoes', event.target.value)
                    }
                    placeholder="Registre a origem da orientação, particularidades ou pontos que precisam ser conferidos."
                  />
                </label>
              </div>

              <div className="regras-fiscais-editor-warning">
                <ShieldCheck size={18} />
                <span>
                  Salvar cria ou mantém a regra como rascunho. Para o motor
                  automático utilizar a regra, confirme-a na lista.
                </span>
              </div>

              <div className="regras-fiscais-editor-actions">
                <button
                  type="button"
                  className="fiscal-button-secundario"
                  onClick={() => setEditor(null)}
                >
                  <X size={18} />
                  Cancelar
                </button>

                <button
                  type="button"
                  className="fiscal-button-principal"
                  title="Salvar regra fiscal"
                  aria-label="Salvar regra fiscal"
                  onClick={salvarRascunho}
                >
                  <Save size={18} />
                  Salvar
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  )
}

export default RegrasNcmCest
