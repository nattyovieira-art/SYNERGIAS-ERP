import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowLeft,
  CheckCircle2,
  Search,
  RefreshCw,
  List,
  Filter,
  FileUp,
  PackageCheck,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import type { Compra, ItemCompra, StatusCompra } from '../../types/Compra'
import {
  buscarCompraStorage,
  gerarNumeroCompraStorage,
  salvarCompraStorage,
} from '../../services/comprasStorage'
import {
  confirmarEntradaCompraComCustoMedioStorage,
} from '../../services/estoqueStorage'

import '../../styles/compras.css'

type CompraFormProps = {
  modo: 'novo' | 'editar'
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function adicionarDias(data: string, dias: number) {
  const base = data ? new Date(`${data}T12:00:00`) : new Date()
  base.setDate(base.getDate() + dias)

  return base.toISOString().slice(0, 10)
}

function criarId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function dinheiro(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function numero(valor: unknown) {
  const convertido = Number(valor || 0)
  return Number.isFinite(convertido) ? convertido : 0
}

function normalizarItem(item: ItemCompra): ItemCompra {
  const unidadeFiscal = item.unidadeFiscal || item.unidade || 'UN'
  const quantidadeFiscal = numero(item.quantidadeFiscal ?? item.quantidade)
  const custoUnitarioFiscal = numero(
    item.custoUnitarioFiscal ?? item.custoUnitario,
  )
  const totalFiscal = numero(item.totalFiscal ?? item.total)
  const fatorConversao = Math.max(1, numero(item.fatorConversao || 1))
  const quantidadeConvertida =
    numero(item.quantidadeConvertida) || quantidadeFiscal * fatorConversao
  const custoUnitarioConvertido =
    numero(item.custoUnitarioConvertido) ||
    (fatorConversao > 0 ? custoUnitarioFiscal / fatorConversao : 0)

  return {
    ...item,
    unidade: item.unidade || unidadeFiscal,
    quantidade: numero(item.quantidade || quantidadeFiscal),
    custoUnitario: numero(item.custoUnitario || custoUnitarioFiscal),
    total: numero(item.total || totalFiscal),
    unidadeFiscal,
    quantidadeFiscal,
    custoUnitarioFiscal,
    totalFiscal,
    unidadeControle: item.unidadeControle || unidadeFiscal,
    fatorConversao,
    quantidadeConvertida,
    custoUnitarioConvertido,
  }
}

function CompraForm({ modo }: CompraFormProps) {
  const navigate = useNavigate()
  const { id } = useParams()

  const compraEncontrada =
    modo === 'editar' && id ? buscarCompraStorage(id) : undefined

  const [buscaFormulario, setBuscaFormulario] = useState('')
  const [mostrarFiltrosFormulario, setMostrarFiltrosFormulario] = useState(false)
  const [filtroFormulario, setFiltroFormulario] = useState<'todos' | 'fornecedor' | 'produtos' | 'pagamento'>('todos')

  const [compra, setCompra] = useState<Compra>(() => {
    if (compraEncontrada) {
      return {
        ...compraEncontrada,
        movimentarEstoque: compraEncontrada.movimentarEstoque ?? false,
        movimentouEstoque: compraEncontrada.movimentouEstoque ?? false,
        itens: compraEncontrada.itens.map(normalizarItem),
      }
    }

    const dataEmissao = hoje()

    return {
      id: criarId(),
      numeroCompra: gerarNumeroCompraStorage(),
      dataEmissao,
      previsaoEntrega: adicionarDias(dataEmissao, 7),
      fornecedorCodigo: '',
      fornecedorNome: '',
      fornecedorDocumento: '',
      fornecedorEmail: '',
      fornecedorTelefone: '',
      itens: [],
      desconto: 0,
      frete: 0,
      outrosCustos: 0,
      subtotal: 0,
      totalFinal: 0,
      formaPagamento: '',
      condicaoPagamento: '',
      observacoes: '',
      status: 'Rascunho',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      origem: 'MANUAL',
      importacaoHistorica: false,
      movimentarEstoque: false,
      movimentouEstoque: false,
    }
  })

  const subtotal = useMemo(
    () =>
      compra.itens.reduce(
        (soma, item) => soma + numero(item.totalFiscal ?? item.total),
        0,
      ),
    [compra.itens],
  )

  const totalFinal = useMemo(
    () =>
      Math.max(
        0,
        subtotal -
          numero(compra.desconto) +
          numero(compra.frete) +
          numero(compra.outrosCustos),
      ),
    [compra.desconto, compra.frete, compra.outrosCustos, subtotal],
  )

  function atualizarCompra<K extends keyof Compra>(campo: K, valor: Compra[K]) {
    setCompra((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  function importarXmlVisual() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xml,text/xml,application/xml'

    input.onchange = () => {
      const arquivo = input.files?.[0]

      if (!arquivo) return

      alert(
        `Arquivo XML selecionado: ${arquivo.name}\n\n` +
          'A importação automática do XML será conectada ao fluxo fiscal. ' +
          'Nenhum pedido ou estoque foi alterado.',
      )
    }

    input.click()
  }

  function atualizarFormulario() {
    window.location.reload()
  }

  function focarBuscaFormulario() {
    document
      .querySelector<HTMLInputElement>('.compras-form-search input')
      ?.focus()
  }

  function abrirFiltrosFormulario() {
    setMostrarFiltrosFormulario((atual) => !atual)
  }

  function aplicarFiltroFormulario() {
    const seletores: Record<string, string> = {
      fornecedor: '[data-compra-secao=\"fornecedor\"]',
      produtos: '[data-compra-secao=\"produtos\"]',
      pagamento: '[data-compra-secao=\"pagamento\"]',
    }
    const seletor = seletores[filtroFormulario]
    if (seletor) document.querySelector(seletor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function adicionarItem() {
    const novoItem: ItemCompra = {
      id: criarId(),
      produtoCodigo: '',
      descricao: '',
      unidade: 'UN',
      quantidade: 1,
      custoUnitario: 0,
      total: 0,
      unidadeFiscal: 'UN',
      quantidadeFiscal: 1,
      custoUnitarioFiscal: 0,
      totalFiscal: 0,
      unidadeControle: 'UN',
      fatorConversao: 1,
      quantidadeConvertida: 1,
      custoUnitarioConvertido: 0,
    }

    setCompra((atual) => ({
      ...atual,
      itens: [...atual.itens, novoItem],
    }))
  }

  function atualizarItem<K extends keyof ItemCompra>(
    itemId: string,
    campo: K,
    valor: ItemCompra[K],
  ) {
    setCompra((atual) => ({
      ...atual,
      itens: atual.itens.map((itemOriginal) => {
        if (itemOriginal.id !== itemId) return itemOriginal

        const item = normalizarItem(itemOriginal)

        const atualizado = {
          ...item,
          [campo]: valor,
        } as ItemCompra

        const quantidadeFiscal = numero(atualizado.quantidadeFiscal)
        const custoUnitarioFiscal = numero(atualizado.custoUnitarioFiscal)
        const fatorConversao = Math.max(1, numero(atualizado.fatorConversao || 1))

        const quantidadeConvertida = quantidadeFiscal * fatorConversao
        const custoUnitarioConvertido =
          fatorConversao > 0 ? custoUnitarioFiscal / fatorConversao : 0
        const totalFiscal = quantidadeFiscal * custoUnitarioFiscal

        return {
          ...atualizado,
          unidade: atualizado.unidadeFiscal || atualizado.unidade || 'UN',
          quantidade: quantidadeFiscal,
          custoUnitario: custoUnitarioFiscal,
          total: totalFiscal,
          totalFiscal,
          fatorConversao,
          quantidadeConvertida,
          custoUnitarioConvertido,
        }
      }),
    }))
  }

  function removerItem(itemId: string) {
    setCompra((atual) => ({
      ...atual,
      itens: atual.itens.filter((item) => item.id !== itemId),
    }))
  }

  function compraAtualizadaParaSalvar(): Compra {
    return {
      ...compra,
      subtotal,
      totalFinal,
      atualizadoEm: new Date().toISOString(),
      itens: compra.itens.map(normalizarItem),
    }
  }

  function salvarCompra(voltar = false) {
    if (!compra.fornecedorNome.trim()) {
      alert('Informe o fornecedor.')
      return
    }

    if (compra.itens.length === 0) {
      alert('Adicione pelo menos um item ao pedido de compra.')
      return
    }

    const compraAtualizada = compraAtualizadaParaSalvar()

    salvarCompraStorage(compraAtualizada)
    setCompra(compraAtualizada)

    if (voltar) {
      navigate('/compras')
      return
    }

    alert('Pedido de compra salvo com sucesso.')
  }

  function definirMovimentacaoEstoque(valor: boolean) {
    if (compra.movimentouEstoque) return

    setCompra((atual) => ({
      ...atual,
      movimentarEstoque: valor,
      importacaoHistorica: !valor,
      atualizadoEm: new Date().toISOString(),
    }))
  }

  function confirmarRecebimentoEstoque() {
    if (!compra.movimentarEstoque) {
      alert(
        'Esta compra está marcada como NÃO MOVIMENTAR ESTOQUE.\n\n' +
          'Selecione MOVIMENTAR ESTOQUE antes de confirmar o recebimento.',
      )
      return
    }

    if (compra.movimentouEstoque) {
      alert('O estoque desta compra já foi movimentado.')
      return
    }

    if (compra.itens.length === 0) {
      alert('A compra não possui itens.')
      return
    }

    const itensNormalizados = compra.itens.map(normalizarItem)

    const itemInvalido = itensNormalizados.find(
      (item) =>
        !item.produtoCodigo.trim() ||
        numero(item.quantidadeConvertida) <= 0 ||
        !item.unidadeControle?.trim(),
    )

    if (itemInvalido) {
      alert(
        'Revise os itens antes de confirmar.\n\n' +
          'Todos os produtos precisam ter código do produto Synergias, unidade de controle e quantidade convertida válida.',
      )
      return
    }

    const confirmar = window.confirm(
      `Confirmar recebimento da compra ${
        compra.numeroNFe ? `NF-e ${compra.numeroNFe}` : `#${compra.numeroCompra}`
      } e dar entrada no estoque?\n\n` +
        'Esta operação movimenta o estoque uma única vez.',
    )

    if (!confirmar) return

    const resultadoEntrada = confirmarEntradaCompraComCustoMedioStorage({
      itens: itensNormalizados.map((item) => ({
        produtoCodigo: item.produtoCodigo,
        descricao: item.descricao,
        quantidade: numero(item.quantidadeConvertida),
        custoUnitario: numero(item.custoUnitarioConvertido),
        valorBase:
          numero(item.quantidadeConvertida) *
          numero(item.custoUnitarioConvertido),
        unidadeFiscal: item.unidadeFiscal,
        unidadeControle: item.unidadeControle,
        fatorConversao: numero(item.fatorConversao || 1),
      })),
      desconto: numero(compra.desconto),
      frete: numero(compra.frete),
      outrosCustos: numero(compra.outrosCustos),
      fornecedor: compra.fornecedorNome,
      numeroCompra: compra.numeroCompra,
      numeroNFe: compra.numeroNFe,
      chaveAcessoNFe: compra.chaveAcessoNFe,
      usuario: 'Synergias',
    })

    if (!resultadoEntrada.ok) {
      alert(
        `Não foi possível confirmar a entrada no estoque.\n\n` +
          `${resultadoEntrada.mensagem}\n\n` +
          'O recebimento NÃO foi marcado como concluído.',
      )
      return
    }

    const movimentacoesCriadas = resultadoEntrada.idsMovimentacoes

    const compraRecebida: Compra = {
      ...compra,
      itens: itensNormalizados,
      subtotal,
      totalFinal,
      status: 'Recebido',
      movimentarEstoque: true,
      importacaoHistorica: false,
      movimentouEstoque: true,
      estoqueMovimentadoEm: new Date().toISOString(),
      idMovimentacaoEstoque: movimentacoesCriadas.join(','),
      atualizadoEm: new Date().toISOString(),
    }

    salvarCompraStorage(compraRecebida)
    setCompra(compraRecebida)

    const resumoCustos = resultadoEntrada.resultados
      .slice(0, 8)
      .map(
        (item) =>
          `${item.produtoDescricao}: ` +
          `${dinheiro(item.custoMedioAnterior)} → ${dinheiro(item.custoMedioAtual)} ` +
          `(última entrada ${dinheiro(item.custoEntrada)})`,
      )
      .join('\n')

    alert(
      `Recebimento confirmado.\n\n` +
        `Produtos movimentados: ${resultadoEntrada.resultados.length}\n` +
        `Estoque atualizado: SIM\n` +
        `Custo médio recalculado: SIM\n\n` +
        `${resumoCustos}${
          resultadoEntrada.resultados.length > 8
            ? '\n... e outros produtos.'
            : ''
        }\n\n` +
        `Esta compra não poderá movimentar o estoque novamente.`,
    )
  }

  const compraImportada = compra.origem === 'SEFAZ_DFE' || compra.origem === 'XML_NFE'

  return (
    <main className="compras-page">
      <Sidebar />

      <section className="compras-content">
        <div className="compras-pageheader">
          <PageHeader
            category="Compras"
            title={
              modo === 'novo'
                ? 'Novo Pedido de Compra'
                : `Pedido de Compra #${compra.numeroCompra}`
            }
            subtitle="Registre fornecedor, produtos, custos, pagamento e recebimento."
          />
        </div>

        <div className="compras-form-actions-bar">
          <div className="compras-form-actions-left">
            <button
              type="button"
              className="compras-voltar-button"
              onClick={() => navigate('/compras')}
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="compras-action-btn compras-action-list"
              title="Lista de compras"
              aria-label="Lista de compras"
              onClick={() => navigate('/compras')}
            >
              <List size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="compras-action-btn compras-action-search"
              title="Buscar"
              aria-label="Buscar"
              onClick={focarBuscaFormulario}
            >
              <Search size={25} strokeWidth={2.4} />
            </button>

            <div className="compras-busca compras-form-search">
              <Search size={18} />
              <input
                type="text"
                value={buscaFormulario}
                onChange={(event) => setBuscaFormulario(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    const termo = buscaFormulario.trim().toLowerCase()
                    const alvo = Array.from(document.querySelectorAll('input, textarea, select')).find((campo) =>
                      (campo as HTMLInputElement).value?.toLowerCase().includes(termo),
                    ) as HTMLElement | undefined
                    alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    alvo?.focus()
                  }
                }}
                placeholder="Buscar no pedido de compra"
              />
            </div>

            <button
              type="button"
              className="compras-filter-btn compras-form-filter-btn"
              title="Adicionar filtro"
              onClick={abrirFiltrosFormulario}
            >
              <Filter size={20} strokeWidth={2.4} />
              {filtroFormulario !== 'todos' && <span className="compras-filter-count">1</span>}
            </button>
          </div>

          <div className="compras-form-actions-right">
            <button
              type="button"
              className="compras-action-btn compras-action-import erp-action-descriptive erp-action-import-xml"
              title="Importar XML"
              aria-label="Importar XML"
              onClick={importarXmlVisual}
            >
              <FileUp size={22} strokeWidth={2.4} />
              <span>Importar XML</span>
            </button>

            <button
              type="button"
              className="compras-action-btn compras-action-refresh"
              title="Atualizar"
              aria-label="Atualizar"
              onClick={atualizarFormulario}
            >
              <RefreshCw size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="compras-action-btn compras-action-save"
              onClick={() => salvarCompra(false)}
              title="Salvar pedido de compra"
              aria-label="Salvar pedido de compra"
            >
              <Save size={25} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {mostrarFiltrosFormulario && (
          <section className="compras-form-filtros-card">
            <label>
              Ir para seção
              <select value={filtroFormulario} onChange={(e) => setFiltroFormulario(e.target.value as typeof filtroFormulario)}>
                <option value="todos">Todas as seções</option>
                <option value="fornecedor">Fornecedor</option>
                <option value="produtos">Produtos</option>
                <option value="pagamento">Pagamento</option>
              </select>
            </label>
            <button type="button" onClick={aplicarFiltroFormulario}>Aplicar filtro</button>
            <button type="button" onClick={() => setFiltroFormulario('todos')}>Limpar filtros</button>
          </section>
        )}

        <section className="compras-form-card">
          <div className="compras-section-title">
            <h2 data-compra-secao="fornecedor">Dados do Pedido</h2>
          </div>

          <div className="compras-grid compras-grid-4">
            <label>
              Número do pedido
              <input value={compra.numeroCompra} disabled />
            </label>

            <label>
              Data de emissão
              <input
                type="date"
                value={compra.dataEmissao}
                onChange={(event) =>
                  atualizarCompra('dataEmissao', event.target.value)
                }
              />
            </label>

            <label>
              Previsão de entrega
              <input
                type="date"
                value={compra.previsaoEntrega}
                onChange={(event) =>
                  atualizarCompra('previsaoEntrega', event.target.value)
                }
              />
            </label>

            <label>
              Status
              <select
                value={compra.status}
                onChange={(event) =>
                  atualizarCompra(
                    'status',
                    event.target.value as StatusCompra,
                  )
                }
              >
                <option>Rascunho</option>
                <option>Pedido Emitido</option>
                <option>Aguardando Entrega</option>
                <option>Recebido Parcial</option>
                <option>Recebido</option>
                <option>Cancelado</option>
              </select>
            </label>
          </div>

          {compraImportada && (
            <div className="compras-dados-fiscais">
              <strong>NF-e importada</strong>
              <span>Número: {compra.numeroNFe || '-'}</span>
              <span>Série: {compra.serieNFe || '-'}</span>
              <span>Chave: {compra.chaveAcessoNFe || '-'}</span>
            </div>
          )}
        </section>

        <section className="compras-form-card">
          <div className="compras-section-title">
            <h2>Controle de Estoque da Compra</h2>
          </div>

          <div className="compras-estoque-controle">
            <p>Esta compra deve movimentar o estoque?</p>

            <div className="compras-estoque-opcoes">
              <button
                type="button"
                className={
                  !compra.movimentarEstoque
                    ? 'compras-estoque-opcao ativa nao'
                    : 'compras-estoque-opcao nao'
                }
                onClick={() => definirMovimentacaoEstoque(false)}
                disabled={compra.movimentouEstoque}
              >
                NÃO MOVIMENTAR
              </button>

              <button
                type="button"
                className={
                  compra.movimentarEstoque
                    ? 'compras-estoque-opcao ativa sim'
                    : 'compras-estoque-opcao sim'
                }
                onClick={() => definirMovimentacaoEstoque(true)}
                disabled={compra.movimentouEstoque}
              >
                MOVIMENTAR ESTOQUE
              </button>
            </div>

            {!compra.movimentarEstoque && !compra.movimentouEstoque && (
              <div className="compras-estoque-status historico">
                <ArrowDownToLine size={18} />
                <div>
                  <strong>Sem movimentação de estoque</strong>
                  <span>
                    Use esta opção para NF-e antiga, histórico ou compra que não
                    deve alterar o saldo atual.
                  </span>
                </div>
              </div>
            )}

            {compra.movimentarEstoque && !compra.movimentouEstoque && (
              <div className="compras-estoque-status aguardando">
                <PackageCheck size={18} />
                <div>
                  <strong>Entrada de estoque autorizada</strong>
                  <span>
                    Revise a conversão dos itens e confirme o recebimento somente
                    quando a mercadoria chegar.
                  </span>
                </div>
              </div>
            )}

            {compra.movimentouEstoque && (
              <div className="compras-estoque-status concluido">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Recebimento confirmado e estoque movimentado</strong>
                  <span>
                    Esta compra já alterou o estoque e está bloqueada contra nova
                    entrada.
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="compras-form-card">
          <div className="compras-section-title">
            <h2>Fornecedor</h2>
          </div>

          <div className="compras-grid compras-grid-2">
            <label>
              Nome / Razão Social
              <input
                value={compra.fornecedorNome}
                onChange={(event) =>
                  atualizarCompra('fornecedorNome', event.target.value)
                }
                placeholder="Digite o nome do fornecedor"
              />
            </label>

            <label>
              CNPJ / CPF
              <input
                value={compra.fornecedorDocumento}
                onChange={(event) =>
                  atualizarCompra('fornecedorDocumento', event.target.value)
                }
              />
            </label>

            <label>
              E-mail
              <input
                type="email"
                value={compra.fornecedorEmail}
                onChange={(event) =>
                  atualizarCompra('fornecedorEmail', event.target.value)
                }
              />
            </label>

            <label>
              Telefone
              <input
                value={compra.fornecedorTelefone}
                onChange={(event) =>
                  atualizarCompra('fornecedorTelefone', event.target.value)
                }
              />
            </label>
          </div>
        </section>

        <section className="compras-form-card">
          <div className="compras-section-title compras-section-title-acoes">
            <div>
              <h2>Itens da Compra</h2>
              <p className="compras-section-subtitle">
                Dados fiscais ficam preservados. A conversão comercial pode ser
                ajustada antes da entrada no estoque.
              </p>
            </div>

            <button
              type="button"
              className="compras-add-item-button"
              onClick={adicionarItem}
              disabled={compra.movimentouEstoque}
            >
              <Plus size={18} />
              Adicionar Item
            </button>
          </div>

          <div className="compras-itens-conversao-lista">
            {compra.itens.length === 0 ? (
              <div className="compras-vazio">Nenhum item adicionado.</div>
            ) : (
              compra.itens.map((itemOriginal, index) => {
                const item = normalizarItem(itemOriginal)

                return (
                  <article className="compras-item-conversao" key={item.id}>
                    <div className="compras-item-conversao-topo">
                      <strong>
                        Item {index + 1} — {item.descricao || 'Produto sem descrição'}
                      </strong>

                      <button
                        type="button"
                        className="compras-acao excluir"
                        onClick={() => removerItem(item.id)}
                        title="Excluir item"
                        disabled={compra.movimentouEstoque}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <div className="compras-item-identificacao">
                      <label>
                        Código do produto Synergias
                        <input
                          value={item.produtoCodigo}
                          onChange={(event) =>
                            atualizarItem(
                              item.id,
                              'produtoCodigo',
                              event.target.value,
                            )
                          }
                          disabled={compra.movimentouEstoque}
                          placeholder="Código usado no cadastro de Produtos"
                        />
                      </label>

                      <label>
                        Produto / descrição
                        <input
                          value={item.descricao}
                          onChange={(event) =>
                            atualizarItem(
                              item.id,
                              'descricao',
                              event.target.value,
                            )
                          }
                          disabled={compra.movimentouEstoque}
                        />
                      </label>
                    </div>

                    <div className="compras-conversao-duas-colunas">
                      <div className="compras-bloco-fiscal">
                        <h3>Dados originais da NF-e</h3>

                        <div className="compras-grid compras-grid-4">
                          <label>
                            Unidade NF-e
                            <input value={item.unidadeFiscal || '-'} disabled />
                          </label>

                          <label>
                            Quantidade NF-e
                            <input
                              value={numero(item.quantidadeFiscal)}
                              disabled
                            />
                          </label>

                          <label>
                            Custo unitário NF-e
                            <input
                              value={dinheiro(numero(item.custoUnitarioFiscal))}
                              disabled
                            />
                          </label>

                          <label>
                            Valor fiscal
                            <input
                              value={dinheiro(numero(item.totalFiscal))}
                              disabled
                            />
                          </label>
                        </div>
                      </div>

                      <div className="compras-bloco-conversao">
                        <h3>Conversão Synergias</h3>

                        <div className="compras-grid compras-grid-4">
                          <label>
                            Unidade de controle
                            <input
                              value={item.unidadeControle || ''}
                              onChange={(event) =>
                                atualizarItem(
                                  item.id,
                                  'unidadeControle',
                                  event.target.value.toUpperCase(),
                                )
                              }
                              disabled={compra.movimentouEstoque}
                              placeholder="UN"
                            />
                          </label>

                          <label>
                            Fator de conversão
                            <input
                              type="number"
                              min="1"
                              step="0.0001"
                              value={numero(item.fatorConversao || 1)}
                              onChange={(event) =>
                                atualizarItem(
                                  item.id,
                                  'fatorConversao',
                                  Number(event.target.value),
                                )
                              }
                              disabled={compra.movimentouEstoque}
                            />
                          </label>

                          <label>
                            Quantidade convertida
                            <input
                              value={numero(item.quantidadeConvertida)}
                              disabled
                            />
                          </label>

                          <label>
                            Custo por unidade
                            <input
                              value={dinheiro(
                                numero(item.custoUnitarioConvertido),
                              )}
                              disabled
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {(item.ncm || item.cfop || item.gtin) && (
                      <div className="compras-item-fiscal-extra">
                        <span>NCM: {item.ncm || '-'}</span>
                        <span>CFOP: {item.cfop || '-'}</span>
                        <span>GTIN/EAN: {item.gtin || '-'}</span>
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </div>
        </section>

        <section className="compras-form-card">
          <div className="compras-section-title">
            <h2>Totais</h2>
          </div>

          <div className="compras-totais-layout">
            <div className="compras-grid compras-grid-3">
              <label>
                Desconto
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={compra.desconto}
                  onChange={(event) =>
                    atualizarCompra('desconto', Number(event.target.value))
                  }
                  disabled={compra.movimentouEstoque}
                />
              </label>

              <label>
                Frete
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={compra.frete}
                  onChange={(event) =>
                    atualizarCompra('frete', Number(event.target.value))
                  }
                  disabled={compra.movimentouEstoque}
                />
              </label>

              <label>
                Outros custos
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={compra.outrosCustos}
                  onChange={(event) =>
                    atualizarCompra(
                      'outrosCustos',
                      Number(event.target.value),
                    )
                  }
                  disabled={compra.movimentouEstoque}
                />
              </label>
            </div>

            <div className="compras-resumo-total">
              <span>Subtotal</span>
              <strong>{dinheiro(subtotal)}</strong>

              <span>Valor final</span>
              <strong className="compras-total-final">
                {dinheiro(totalFinal)}
              </strong>
            </div>
          </div>
        </section>

        <section className="compras-form-card">
          <div className="compras-section-title">
            <h2 data-compra-secao="pagamento">Pagamento</h2>
          </div>

          <div className="compras-grid compras-grid-2">
            <label>
              Forma de pagamento
              <select
                value={compra.formaPagamento}
                onChange={(event) =>
                  atualizarCompra('formaPagamento', event.target.value)
                }
              >
                <option value="">Selecione</option>
                <option>BOLETO</option>
                <option>PIX</option>
                <option>TRANSFERÊNCIA</option>
                <option>DINHEIRO</option>
                <option>CARTÃO</option>
              </select>
            </label>

            <label>
              Condição de pagamento
              <input
                value={compra.condicaoPagamento}
                onChange={(event) =>
                  atualizarCompra('condicaoPagamento', event.target.value)
                }
                placeholder="Ex.: 30 dias, 30/60 dias"
              />
            </label>
          </div>

          <label className="compras-observacoes-label">
            Observações
            <textarea
              value={compra.observacoes}
              onChange={(event) =>
                atualizarCompra('observacoes', event.target.value)
              }
              placeholder="Informações adicionais sobre o pedido de compra"
            />
          </label>
        </section>

        {compra.movimentarEstoque && !compra.movimentouEstoque && (
          <section className="compras-confirmar-recebimento-card">
            <div>
              <PackageCheck size={26} />
              <div>
                <strong>Mercadoria chegou e foi conferida?</strong>
                <span>
                  Confirme somente depois de revisar os códigos dos produtos e a
                  conversão CX → UN de cada item.
                </span>
              </div>
            </div>

            <button
              type="button"
              className="compras-confirmar-recebimento-button"
              onClick={confirmarRecebimentoEstoque}
            >
              <PackageCheck size={19} />
              Confirmar Recebimento e Dar Entrada no Estoque
            </button>
          </section>
        )}

      </section>
    </main>
  )
}

export default CompraForm
