import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CloudDownload,
  Eye,
  FileUp,
  Filter,
  List,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { IconShoppingCartPlus } from '@tabler/icons-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import type { Compra, StatusCompra } from '../../types/Compra'
import {
  excluirCompraEspecificaStorageConfirmado,
  importarComprasDFeStorage,
  listarComprasStorage,
  obterUltNSUDFeStorage,
  salvarCompraStorageConfirmado,
  salvarUltNSUDFeStorage,
} from '../../services/comprasStorage'
import { listarProdutosStorage } from '../../services/produtosStorage'
import { estornarEntradaCompraStorage } from '../../services/estoqueStorage'
import { parseNFeCompraXml } from '../../services/nfeCompraXml'
import { extrairTextoDocumentoCompra } from '../../services/documentoCompra'

import '../../styles/compras.css'

const API_BACKEND = ''

const STATUS_COMPRAS: Array<'Todos' | StatusCompra> = [
  'Todos',
  'Rascunho',
  'Pedido Emitido',
  'Aguardando Entrega',
  'Recebido Parcial',
  'Recebido',
  'Faturado',
  'Concluído',
  'Cancelado',
]

type RespostaSincronizacaoDFe = {
  ok: boolean
  codigo?: string
  mensagem: string
  compras?: Compra[]
  totalComprasComItens?: number
  resumosSemItensIgnorados?: number
  ultNSU?: string
  maxNSU?: string
  lotesConsultados?: number
  movimentouEstoque?: boolean
}

async function lerRespostaJson<T>(resposta: Response): Promise<T> {
  const texto = await resposta.text()

  try {
    return JSON.parse(texto) as T
  } catch {
    throw new Error(
      resposta.ok
        ? 'O servidor retornou uma resposta inválida.'
        : `A consulta não está disponível no servidor (HTTP ${resposta.status}).`,
    )
  }
}

function dinheiro(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatarData(data: string) {
  if (!data) return '-'

  const [ano, mes, dia] = data.split('-')

  if (!ano || !mes || !dia) return data

  return `${dia}/${mes}/${ano}`
}

function Compras() {
  const navigate = useNavigate()

  const [compras, setCompras] = useState<Compra[]>(listarComprasStorage())
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<'Todos' | StatusCompra>('Todos')
  const [origem, setOrigem] = useState<'Todas' | 'MANUAL' | 'SEFAZ_DFE' | 'XML_NFE'>('Todas')
  const [estoque, setEstoque] = useState<'Todos' | 'Movimentado' | 'Aguardando' | 'Sem estoque'>('Todos')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [sincronizandoSefaz, setSincronizandoSefaz] = useState(false)
  const [chaveBuscaNFe, setChaveBuscaNFe] = useState('')

  const quantidadeFiltrosAtivos = useMemo(
    () =>
      [
        status !== 'Todos',
        origem !== 'Todas',
        estoque !== 'Todos',
      ].filter(Boolean).length,
    [estoque, origem, status],
  )

  const comprasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return compras.filter((compra) => {
      const atendeStatus = status === 'Todos' || compra.status === status

      const atendeOrigem =
        origem === 'Todas' || String(compra.origem || 'MANUAL') === origem

      const situacaoEstoque = compra.estoqueEstornado
        ? 'Sem estoque'
        : compra.movimentouEstoque
        ? 'Movimentado'
        : compra.status === 'Recebido'
          ? 'Sem estoque'
        : compra.movimentarEstoque
          ? 'Aguardando'
          : 'Sem estoque'

      const atendeEstoque =
        estoque === 'Todos' || situacaoEstoque === estoque

      const atendeBusca =
        !termo ||
        compra.numeroCompra.toLowerCase().includes(termo) ||
        compra.fornecedorNome.toLowerCase().includes(termo) ||
        compra.fornecedorDocumento.toLowerCase().includes(termo) ||
        String(compra.numeroNFe || '').toLowerCase().includes(termo) ||
        String(compra.chaveAcessoNFe || '').toLowerCase().includes(termo)

      return atendeStatus && atendeOrigem && atendeEstoque && atendeBusca
    })
  }, [busca, compras, estoque, origem, status])

  function limparFiltros() {
    setStatus('Todos')
    setOrigem('Todas')
    setEstoque('Todos')
  }

  async function excluirCompra(compra: Compra) {
    if (compra.movimentouEstoque && !compra.estoqueEstornado) {
      const confirmarEstorno = window.confirm(
        `Cancelar a compra nº ${compra.numeroCompra} e estornar do estoque as entradas da NF-e ${compra.numeroNFe || '-'}? A NF-e do fornecedor não será cancelada na SEFAZ.`,
      )
      if (!confirmarEstorno) return
      try {
        const estornos = await estornarEntradaCompraStorage({
          compraId: compra.id,
          numeroCompra: compra.numeroCompra,
          numeroNFe: compra.numeroNFe,
          chaveAcessoNFe: compra.chaveAcessoNFe,
          itensFallback: compra.itens,
          motivo: `Compra duplicada no ERP - NF-e ${compra.numeroNFe || '-'}`,
        })
        const compraEstornada: Compra = {
          ...compra,
          status: 'Cancelado',
          movimentarEstoque: false,
          movimentouEstoque: true,
          estoqueEstornado: true,
          estoqueEstornadoEm: new Date().toISOString(),
          idsMovimentacoesEstorno: estornos.map((item) => item.id),
          motivoCancelamento: 'Compra já registrada no sistema anterior',
          atualizadoEm: new Date().toISOString(),
        }
        await salvarCompraStorageConfirmado(compraEstornada)
        await excluirCompraEspecificaStorageConfirmado(compraEstornada)
        setCompras(listarComprasStorage())
        alert('Compra excluída e estoque estornado com sucesso.')
      } catch (erro) {
        alert(erro instanceof Error ? erro.message : 'Não foi possível estornar a compra.')
      }
      return
    }
    const confirmar = window.confirm(
      `Deseja excluir a compra nº ${compra.numeroCompra}?`,
    )

    if (!confirmar) return

    try {
      await excluirCompraEspecificaStorageConfirmado(compra)
      setCompras(listarComprasStorage())
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível excluir a compra.')
    }
  }

  function abrirCompra(id: string) {
    navigate(`/compras/editar/${id}`)
  }

  function importarXmlVisual() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xml,text/xml,application/xml,.pdf,application/pdf,image/*'

    input.onchange = async () => {
      const arquivo = input.files?.[0]

      if (!arquivo) return

      try {
        const ehXml = arquivo.type.includes('xml') || arquivo.name.toLowerCase().endsWith('.xml')
        if (!ehXml) {
          const textoDocumento = await extrairTextoDocumentoCompra(arquivo)
          if (!textoDocumento) {
            alert('Não foi possível ler esse documento. Tente uma imagem mais nítida ou outro PDF.')
            return
          }
          navigate('/compras/novo', {
            state: {
              documentoCompraTexto: textoDocumento,
              documentoCompraNome: arquivo.name,
            },
          })
          return
        }
        const xml = await arquivo.text()
        const numeroCompra = String(
          Math.max(
            0,
            ...listarComprasStorage().map((item) =>
              Number(String(item.numeroCompra || '').replace(/\D/g, '')) || 0,
            ),
          ) + 1,
        ).padStart(6, '0')
        const previa = parseNFeCompraXml(xml, listarProdutosStorage(), numeroCompra)
        const duplicada = listarComprasStorage().find(
          (item) => item.chaveAcessoNFe === previa.chaveAcessoNFe,
        )
        if (duplicada) {
          alert(`Esta NF-e já foi importada na compra ${duplicada.numeroCompra}.`)
          return
        }
        navigate('/compras/novo', { state: { xmlCompra: xml } })
        return
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Não foi possível ler o XML.')
        return
      }

      alert(
        `Arquivo XML selecionado: ${arquivo!.name}\n\n` +
          'A importação automática do XML será conectada ao fluxo fiscal. ' +
          'Nenhum pedido ou estoque foi alterado.',
      )
    }

    input.click()
  }

  function atualizarLista() {
    window.location.reload()
  }

  async function buscarNFePorChave() {
    const chave = chaveBuscaNFe.replace(/\D/g, '')

    if (chave.length !== 44) {
      alert('Digite os 44 números da chave de acesso da NF-e.')
      return
    }

    const compraExistente = listarComprasStorage().find(
      (item) =>
        String(item.chaveAcessoNFe || '').replace(/\D/g, '') === chave,
    )

    if (compraExistente) {
      abrirCompra(compraExistente.id)
      return
    }

    if (sincronizandoSefaz) return
    setSincronizandoSefaz(true)

    try {
      const resposta = await fetch(`${API_BACKEND}/api/fiscal/nfe-consulta.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          chaveAcesso: chave,
          ambiente: 'PRODUCAO',
        }),
      })

      const dados = await lerRespostaJson<{
        ok: boolean
        mensagem?: string
        motivo?: string
        autorizada?: boolean
        cancelada?: boolean
      }>(resposta)

      if (!resposta.ok || !dados.ok) {
        throw new Error(dados.mensagem || dados.motivo || 'Não foi possível consultar a NF-e.')
      }

      const situacao = dados.cancelada
        ? 'cancelada'
        : dados.autorizada
          ? 'autorizada'
          : dados.motivo || 'localizada'

      alert(
        `NF-e ${situacao} na SEFAZ.\n\n` +
          'A consulta pela chave não fornece os produtos da nota. Importe o XML para criar a compra completa.\n\n' +
          'Nenhuma compra vazia foi criada.',
      )
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : 'Erro ao consultar a NF-e.'
      alert(`${mensagem}\n\nNenhuma compra foi criada.`)
    } finally {
      setSincronizandoSefaz(false)
    }
  }

  async function sincronizarSefaz() {
    if (sincronizandoSefaz) return

    setSincronizandoSefaz(true)

    try {
      const resposta = await fetch(
        `${API_BACKEND}/api/compras/sefaz/sincronizar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ultNSU: obterUltNSUDFeStorage(),
            limiteLotes: 5,
          }),
        },
      )

      const dados = await lerRespostaJson<RespostaSincronizacaoDFe>(resposta)

      if (!resposta.ok || !dados.ok) {
        if (dados.codigo === 'CERTIFICADO_A1_NAO_CONFIGURADO') {
          alert(
            'A integração com a SEFAZ já está preparada.\n\n' +
              'Falta configurar o certificado digital A1.\n\n' +
              'A página para inserir o certificado será criada na próxima etapa.\n\n' +
              'Nenhum estoque foi alterado.',
          )
          return
        }

        throw new Error(dados.mensagem || 'Erro ao consultar a SEFAZ.')
      }

      const resultado = importarComprasDFeStorage(dados.compras || [])

      if (dados.ultNSU) {
        salvarUltNSUDFeStorage(dados.ultNSU)
      }

      setCompras(listarComprasStorage())

      alert(
        `Consulta SEFAZ concluída.\n\n` +
          `Notas importadas com itens: ${resultado.importadas}\n` +
          `Notas duplicadas ignoradas: ${resultado.duplicadas}\n` +
          `Resumos sem produtos ignorados: ${dados.resumosSemItensIgnorados || 0}\n` +
          `Lotes consultados: ${dados.lotesConsultados || 0}\n\n` +
          `ESTOQUE ALTERADO NA IMPORTAÇÃO: NÃO\n` +
          `A decisão será feita manualmente em cada compra.`,
      )
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : 'Erro ao consultar a SEFAZ.'

      alert(`${mensagem}\n\nNenhum estoque foi alterado.`)
    } finally {
      setSincronizandoSefaz(false)
    }
  }

  return (
    <main className="compras-page">
      <Sidebar />

      <section className="compras-content">
        <div className="compras-pageheader">
          <PageHeader
            category="Compras"
            title="Pedidos de Compra"
            subtitle="Gerencie pedidos, fornecedores, recebimentos e custos de compra."
          />
        </div>

        <section className="compras-toolbar">
          <div className="compras-toolbar-left">
            <button
              type="button"
              className="compras-action-btn compras-action-list"
              title="Lista de compras"
              aria-label="Lista de compras"
              onClick={() => navigate('/compras')}
            >
              <List size={24} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="compras-action-btn compras-action-search"
              title="Buscar compras"
              aria-label="Buscar compras"
              onClick={() => {
                const campo = document.querySelector<HTMLInputElement>(
                  '.compras-busca input',
                )
                campo?.focus()
              }}
            >
              <Search size={24} strokeWidth={2.4} />
            </button>

            <div className="compras-busca">
              <Search size={18} />

              <input
                type="text"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por pedido, NF-e, fornecedor ou documento"
              />
            </div>

            <button
              type="button"
              className={`compras-filter-btn ${
                quantidadeFiltrosAtivos > 0 ? 'ativo' : ''
              }`}
              title="Adicionar filtro"
              onClick={() => setMostrarFiltros((atual) => !atual)}
            >
              <Filter size={20} />
              {quantidadeFiltrosAtivos > 0 && (
                <span>{quantidadeFiltrosAtivos}</span>
              )}
            </button>
          </div>

          <div className="compras-toolbar-actions">
            <button
              type="button"
              className="compras-action-btn compras-action-refresh"
              title="Atualizar lista"
              aria-label="Atualizar lista"
              onClick={atualizarLista}
            >
              <RefreshCw size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="compras-sefaz-button compras-sefaz-button-padrao erp-action-descriptive erp-action-nfe-search"
              onClick={sincronizarSefaz}
              disabled={sincronizandoSefaz}
              title="Buscar NF-e de entrada na SEFAZ"
            >
              <CloudDownload
                size={22}
                strokeWidth={2.4}
                className={sincronizandoSefaz ? 'compras-spin' : undefined}
              />
              <span>
                {sincronizandoSefaz ? 'Consultando...' : 'Buscar NF-e SEFAZ'}
              </span>
            </button>

            <button
              type="button"
              className="compras-action-btn compras-action-import erp-action-descriptive erp-action-import-xml"
              title="Buscar XML, PDF ou imagem e preparar a compra"
              aria-label="Buscar XML, PDF ou imagem e preparar a compra"
              onClick={importarXmlVisual}
            >
              <FileUp size={22} strokeWidth={2.4} />
              <span>Buscar NF-e por XML</span>
            </button>

            <button
              type="button"
              className="compras-action-btn compras-action-new"
              onClick={() => navigate('/compras/novo')}
              title="Novo pedido de compra"
              aria-label="Novo pedido de compra"
            >
              <IconShoppingCartPlus
                size={29}
                stroke={2.4}
                className="compras-new-cart-ready"
                aria-hidden="true"
              />
            </button>
          </div>
        </section>

        <section className="compras-chave-busca">
          <label htmlFor="compras-chave-nfe">Chave de acesso da NF-e</label>
          <div>
            <input
              id="compras-chave-nfe"
              type="text"
              inputMode="numeric"
              maxLength={44}
              value={chaveBuscaNFe}
              onChange={(event) =>
                setChaveBuscaNFe(
                  event.target.value.replace(/\D/g, '').slice(0, 44),
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') buscarNFePorChave()
              }}
              placeholder="Digite os 44 números da chave"
            />
            <button type="button" onClick={buscarNFePorChave}>
              <Search size={20} />
              Buscar pela chave
            </button>
          </div>
        </section>

        {mostrarFiltros && (
          <section className="compras-filter-panel">
            <div className="compras-filter-grid">
              <label>
                Status
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as 'Todos' | StatusCompra)
                  }
                >
                  {STATUS_COMPRAS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Origem
                <select
                  value={origem}
                  onChange={(event) =>
                    setOrigem(
                      event.target.value as
                        | 'Todas'
                        | 'MANUAL'
                        | 'SEFAZ_DFE'
                        | 'XML_NFE',
                    )
                  }
                >
                  <option value="Todas">Todas</option>
                  <option value="MANUAL">Manual</option>
                  <option value="SEFAZ_DFE">SEFAZ / DF-e</option>
                  <option value="XML_NFE">XML NF-e</option>
                </select>
              </label>

              <label>
                Estoque
                <select
                  value={estoque}
                  onChange={(event) =>
                    setEstoque(
                      event.target.value as
                        | 'Todos'
                        | 'Movimentado'
                        | 'Aguardando'
                        | 'Sem estoque',
                    )
                  }
                >
                  <option value="Todos">Todos</option>
                  <option value="Movimentado">Movimentado</option>
                  <option value="Aguardando">Aguardando recebimento</option>
                  <option value="Sem estoque">Sem estoque</option>
                </select>
              </label>
            </div>

            <div className="compras-filter-footer">
              <span>{comprasFiltradas.length} compra(s) encontrada(s)</span>

              <button
                type="button"
                className="compras-clear-filters-btn"
                onClick={limparFiltros}
                disabled={quantidadeFiltrosAtivos === 0}
              >
                Limpar filtros
              </button>
            </div>
          </section>
        )}

        <div className="compras-importacao-aviso">
          Toda NF-e importada entra com <strong>MOVIMENTAR ESTOQUE: NÃO</strong>.
          Abra a compra e escolha manualmente se ela deve ou não movimentar o estoque.
        </div>

        <section className="compras-card">
          <div className="compras-card-title">
            <div>
              <h2>Lista de Compras</h2>
              <span>{comprasFiltradas.length} registro(s)</span>
            </div>
          </div>

          <div className="compras-table-wrapper">
            <table className="compras-table">
              <thead>
                <tr>
                  <th>Pedido / NF-e</th>
                  <th>Fornecedor</th>
                  <th>Emissão</th>
                  <th>Previsão</th>
                  <th>Valor Total</th>
                  <th>Status</th>
                  <th className="compras-acoes-coluna">Ações</th>
                </tr>
              </thead>

              <tbody>
                {comprasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="compras-vazio">
                        Nenhum pedido de compra encontrado.
                      </div>
                    </td>
                  </tr>
                ) : (
                  comprasFiltradas.map((compra) => (
                    <tr key={compra.id}>
                      <td>
                        <strong>#{compra.numeroCompra}</strong>

                        {compra.numeroNFe && (
                          <span className="compras-nfe-info">
                            NF-e {compra.numeroNFe}
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="compras-fornecedor-cell">
                          <strong>{compra.fornecedorNome || '-'}</strong>
                          <span>{compra.fornecedorDocumento || '-'}</span>
                        </div>
                      </td>

                      <td>{formatarData(compra.dataEmissao)}</td>
                      <td>{formatarData(compra.previsaoEntrega)}</td>

                      <td>
                        <strong>{dinheiro(compra.totalFinal)}</strong>
                      </td>

                      <td>
                        <div className="compras-status-group">
                          <span className="compras-status">{compra.status}</span>

                          {compra.estoqueEstornado ? (
                            <span className="compras-historico-badge">
                              Estoque estornado
                            </span>
                          ) : compra.movimentouEstoque ? (
                            <span className="compras-historico-badge">
                              Estoque lançado
                            </span>
                          ) : compra.status === 'Recebido' ? (
                            <span className="compras-historico-badge">
                              Recebido sem movimentar estoque
                            </span>
                          ) : compra.movimentarEstoque ? (
                            <span className="compras-historico-badge">
                              Aguardando recebimento
                            </span>
                          ) : (
                            <span className="compras-historico-badge">
                              Sem estoque
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="compras-acoes">
                          <button
                            type="button"
                            className="compras-acao visualizar"
                            onClick={() => abrirCompra(compra.id)}
                            title="Visualizar"
                          >
                            <Eye size={17} />
                          </button>

                          <button
                            type="button"
                            className="compras-acao editar"
                            onClick={() => abrirCompra(compra.id)}
                            title="Editar"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            type="button"
                            className="compras-acao excluir"
                            onClick={() => excluirCompra(compra)}
                            title="Excluir"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}

export default Compras
