import { lazy, Suspense, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import Login from './pages/Login/Login'
import { authApi, type AuthUser } from './services/authApi'
import { inicializarArmazenamentoCentral } from './services/erpApi'
import { corrigirOrcamentosImportadosSemPedidoReal } from './services/vendasStorage'

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'))
const Clientes = lazy(() => import('./pages/Clientes/Clientes'))
const ClienteForm = lazy(() => import('./pages/Clientes/ClienteForm'))
const Produtos = lazy(() => import('./pages/Produtos/Produtos'))
const ProdutoForm = lazy(() => import('./pages/Produtos/ProdutoForm'))
const Vendas = lazy(() => import('./pages/Vendas/Vendas'))
const OrcamentoForm = lazy(() => import('./pages/Vendas/OrcamentoForm'))
const PedidoForm = lazy(() => import('./pages/Vendas/PedidoForm'))
const Logistica = lazy(() => import('./pages/Logistica/Logistica'))
const Estoque = lazy(() => import('./pages/Estoque/Estoque'))
const Financeiro = lazy(() => import('./pages/Financeiro/Financeiro'))
const ContasReceber = lazy(() => import('./pages/Financeiro/ContasReceber'))
const NovaContaReceber = lazy(() => import('./pages/Financeiro/NovaContaReceber'))
const NovaContaPagar = lazy(() => import('./pages/Financeiro/NovaContaPagar'))
const PagarConta = lazy(() => import('./pages/Financeiro/PagarConta'))
const ConciliacaoBancaria = lazy(() => import('./pages/Financeiro/ConciliacaoBancaria'))
const ReceberConta = lazy(() => import('./pages/Financeiro/ReceberConta'))
const Compras = lazy(() => import('./pages/Compras/Compras'))
const CompraForm = lazy(() => import('./pages/Compras/CompraForm'))
const Fiscal = lazy(() => import('./pages/Fiscal/Fiscal'))
const ConfiguracaoFiscal = lazy(() => import('./pages/Fiscal/ConfiguracaoFiscal'))
const CertificadoDigital = lazy(() => import('./pages/Fiscal/CertificadoDigital'))
const AnaliseFiscalEntradas = lazy(() => import('./pages/Fiscal/AnaliseFiscalEntradas'))
const RegrasNcmCest = lazy(() => import('./pages/Fiscal/RegrasNcmCest'))
const NFeRecebidas = lazy(() => import('./pages/Fiscal/NFeRecebidas'))
const Relatorios = lazy(() => import('./pages/Relatorios/Relatorios'))
const RelatorioDetalhe = lazy(() => import('./pages/Relatorios/RelatorioDetalhe'))
const Configuracoes = lazy(() => import('./pages/Configuracoes/Configuracoes'))
const ParametrosVendas = lazy(() => import('./pages/Configuracoes/ParametrosVendas'))
const Vendedores = lazy(() => import('./pages/Configuracoes/Vendedores'))
const Funcionarios = lazy(() => import('./pages/Configuracoes/Funcionarios'))
const FormasPagamento = lazy(() => import('./pages/Configuracoes/FormasPagamento'))
const ContasBancarias = lazy(() => import('./pages/Configuracoes/ContasBancarias'))
const CategoriasFinanceiras = lazy(() => import('./pages/Configuracoes/CategoriasFinanceiras'))
const ParametrosMovimentacao = lazy(() => import('./pages/Configuracoes/ParametrosMovimentacao'))
const NumeracaoFiscal = lazy(() => import('./pages/Configuracoes/NumeracaoFiscal'))
const NaturezasOperacao = lazy(() => import('./pages/Configuracoes/NaturezasOperacao'))
const UsuariosPermissoes = lazy(() => import('./pages/Configuracoes/UsuariosPermissoes'))
const IntegracoesBancarias = lazy(() => import('./pages/Configuracoes/IntegracoesBancarias'))
const IntegracaoSefazNFe = lazy(() => import('./pages/Configuracoes/IntegracaoSefazNFe'))
const Sistema = lazy(() => import('./pages/Configuracoes/Sistema'))
const Marcas = lazy(() => import('./pages/Produtos/Marcas'))
const UnidadesMedida = lazy(() => import('./pages/Produtos/UnidadesMedida'))
const Devolucoes = lazy(() => import('./pages/Vendas/Devolucoes'))
const HistoricoComercial = lazy(() => import('./pages/Clientes/HistoricoComercial'))
const ContasPagar = lazy(() => import('./pages/Financeiro/ContasPagar'))
const FluxoCaixa = lazy(() => import('./pages/Financeiro/FluxoCaixa'))
const LocaisEstoque = lazy(() => import('./pages/Estoque/LocaisEstoque'))
const MovimentarEstoque = lazy(() => import('./pages/Estoque/MovimentarEstoque'))
const HistoricoEstoque = lazy(() => import('./pages/Estoque/HistoricoEstoque'))
const RelatorioBrindes = lazy(() => import('./pages/Relatorios/RelatorioBrindes'))

import './App.css'

function RedirecionarEdicaoPedidoLegado() {
  const { id } = useParams()
  return <Navigate to={`/vendas/pedidos/editar/${encodeURIComponent(id || '')}`} replace />
}

function App() {
  const [authLoading, setAuthLoading] = useState(true)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [storageLoading, setStorageLoading] = useState(false)

  function executarRotinasSecundarias() {
    void Promise.allSettled([
      corrigirOrcamentosImportadosSemPedidoReal(),
    ]).then((resultados) => {
      resultados.forEach((resultado) => {
        if (resultado.status === 'rejected') {
          console.warn('[Synergias ERP] Rotina secundária não concluída.', resultado.reason)
        }
      })
    })
  }

  useEffect(() => {
    let ativo = true
    authApi.status()
      .then(async (status) => {
        if (!ativo) return
        if (status.authenticated && status.user) {
          setStorageLoading(true)
          try {
            await inicializarArmazenamentoCentral()
            if (!ativo) return
            setAuthUser(status.user)
            executarRotinasSecundarias()
          } catch (erro) {
            console.error('[Synergias ERP] Falha ao carregar dados centrais.', erro)
            alert(`Não foi possível carregar os dados do servidor: ${erro instanceof Error ? erro.message : String(erro)}`)
          } finally {
            if (ativo) setStorageLoading(false)
          }
        }
      })
      .catch((erro) => console.error('[Synergias ERP] Falha ao validar sessão.', erro))
      .finally(() => { if (ativo) setAuthLoading(false) })
    return () => { ativo = false }
  }, [])

  async function aoAutenticar(user: AuthUser) {
    setStorageLoading(true)
    try {
      await inicializarArmazenamentoCentral()
      setAuthUser(user)
      executarRotinasSecundarias()
    } catch (erro) {
      alert(`Não foi possível carregar os dados do servidor: ${erro instanceof Error ? erro.message : String(erro)}`)
      throw erro
    } finally {
      setStorageLoading(false)
    }
  }

  useEffect(() => {
    const aoPressionarEnter = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      const alvo = event.target as HTMLInputElement | null
      if (!alvo || alvo.tagName !== 'INPUT') return
      const texto = `${alvo.placeholder || ''} ${alvo.title || ''}`.toLowerCase()
      if (!/(buscar|pesquisar|procure|localizar)/.test(texto)) return

      event.preventDefault()
      const escopo = alvo.closest('form, section, header, div') || document
      const botoes = Array.from(escopo.querySelectorAll('button')) as HTMLButtonElement[]
      const botaoBusca = botoes.find((botao) => /buscar|pesquisar|localizar/.test(`${botao.title || ''} ${botao.getAttribute('aria-label') || ''}`.toLowerCase()))
      botaoBusca?.click()
    }

    document.addEventListener('keydown', aoPressionarEnter)
    return () => document.removeEventListener('keydown', aoPressionarEnter)
  }, [])

  if (authLoading || storageLoading) {
    return <div className="erp-auth-loading">Carregando dados do ERP…</div>
  }

  if (!authUser) {
    return <HashRouter><Login onAuthenticated={aoAutenticar} /></HashRouter>
  }

  return (
    <HashRouter>
      <Suspense fallback={<div className="erp-auth-loading">Carregando página…</div>}>
        <Routes>
        <Route path="/" element={<Navigate to="/painel" replace />} />

        <Route path="/painel" element={<Dashboard />} />

        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/novo" element={<ClienteForm modo="novo" />} />
        <Route path="/clientes/editar/:id" element={<ClienteForm modo="editar" />} />

        <Route path="/produtos" element={<Produtos />} />
        <Route path="/produtos/novo" element={<ProdutoForm modo="novo" />} />
        <Route path="/produtos/editar/:id" element={<ProdutoForm modo="editar" />} />

        <Route path="/estoque" element={<Estoque />} />
        <Route path="/estoque/movimentar" element={<MovimentarEstoque />} />
        <Route path="/estoque/historico" element={<HistoricoEstoque />} />

        <Route path="/compras" element={<Compras />} />
        <Route path="/compras/novo" element={<CompraForm modo="novo" />} />
        <Route path="/compras/editar/:id" element={<CompraForm modo="editar" />} />

        <Route path="/vendas" element={<Vendas />} />
        <Route path="/logistica" element={<Logistica />} />

        <Route path="/vendas/orcamentos/novo" element={<OrcamentoForm />} />
        <Route path="/vendas/orcamentos/editar/:id" element={<OrcamentoForm />} />

        <Route
          path="/vendas/orcamento/novo"
          element={<Navigate to="/vendas/orcamentos/novo" replace />}
        />

        <Route path="/vendas/pedidos/novo" element={<PedidoForm />} />
        <Route path="/vendas/pedidos/editar/:id" element={<PedidoForm />} />

        <Route
          path="/vendas/pedido/novo"
          element={<Navigate to="/vendas/pedidos/novo" replace />}
        />

        <Route
          path="/vendas/pedido/editar/:id"
          element={<RedirecionarEdicaoPedidoLegado />}
        />

        <Route path="/financeiro" element={<Financeiro />} />
        <Route path="/financeiro/contas-a-receber" element={<ContasReceber />} />
        <Route path="/financeiro/contas-a-receber/receber/:id" element={<ReceberConta />} />
        <Route
          path="/financeiro/contas-a-receber/nova"
          element={<NovaContaReceber />}
        />
        <Route
          path="/financeiro/conciliacao-bancaria"
          element={<ConciliacaoBancaria />}
        />

        <Route path="/fiscal" element={<Fiscal />} />
        <Route
          path="/fiscal/configuracao"
          element={<Navigate to="/configuracoes/fiscal/configuracao" replace />}
        />
        <Route
          path="/fiscal/certificado"
          element={<Navigate to="/configuracoes/fiscal/certificado" replace />}
        />
        <Route
          path="/fiscal/analise-entradas"
          element={<AnaliseFiscalEntradas />}
        />
        <Route
          path="/fiscal/regras-ncm-cest"
          element={<Navigate to="/configuracoes/fiscal/regras-ncm-cest" replace />}
        />
        <Route
          path="/fiscal/nfe-recebidas"
          element={<NFeRecebidas />}
        />
        <Route
          path="/fiscal/revisao"
          element={<Navigate to="/fiscal/analise-entradas?status=REVISAO_NECESSARIA" replace />}
        />

        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route
          path="/configuracoes/fiscal/configuracao"
          element={<ConfiguracaoFiscal />}
        />
        <Route
          path="/configuracoes/fiscal/certificado"
          element={<CertificadoDigital />}
        />
        <Route
          path="/configuracoes/fiscal/regras-ncm-cest"
          element={<RegrasNcmCest />}
        />

        <Route path="/configuracoes/vendas/parametros" element={<ParametrosVendas />} />
        <Route path="/configuracoes/vendas/vendedores" element={<Vendedores />} />
        <Route path="/configuracoes/funcionarios" element={<Funcionarios />} />
        <Route path="/configuracoes/financeiro/formas-pagamento" element={<FormasPagamento />} />
        <Route path="/configuracoes/financeiro/contas-bancarias" element={<ContasBancarias />} />
        <Route path="/configuracoes/financeiro/categorias" element={<CategoriasFinanceiras />} />
        <Route path="/configuracoes/estoque/movimentacao" element={<ParametrosMovimentacao />} />
        <Route path="/configuracoes/fiscal/numeracao" element={<NumeracaoFiscal />} />
        <Route path="/configuracoes/fiscal/naturezas-operacao" element={<NaturezasOperacao />} />
        <Route path="/configuracoes/acesso/usuarios-permissoes" element={<UsuariosPermissoes />} />
        <Route path="/configuracoes/integracoes/bancos" element={<IntegracoesBancarias />} />
        <Route path="/configuracoes/integracoes/sefaz-nfe" element={<IntegracaoSefazNFe />} />
        <Route path="/configuracoes/sistema" element={<Sistema />} />

        <Route path="/produtos/marcas" element={<Marcas />} />
        <Route path="/produtos/unidades-medida" element={<UnidadesMedida />} />
        <Route path="/vendas/devolucoes" element={<Devolucoes />} />
        <Route path="/clientes/historico/:id" element={<HistoricoComercial />} />
        <Route path="/financeiro/contas-a-pagar" element={<ContasPagar />} />
        <Route path="/financeiro/contas-a-pagar/nova" element={<NovaContaPagar />} />
        <Route path="/financeiro/contas-a-pagar/pagar/:id" element={<PagarConta />} />
        <Route path="/financeiro/fluxo-de-caixa" element={<FluxoCaixa />} />
        <Route path="/estoque/locais" element={<LocaisEstoque />} />

        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/relatorios/brindes" element={<RelatorioBrindes />} />
        <Route
          path="/relatorios/financeiro"
          element={<RelatorioDetalhe tipo="financeiro" />}
        />
        <Route
          path="/relatorios/vendas"
          element={<RelatorioDetalhe tipo="vendas" />}
        />
        <Route
          path="/relatorios/compras"
          element={<RelatorioDetalhe tipo="compras" />}
        />
        <Route
          path="/relatorios/produtos"
          element={<RelatorioDetalhe tipo="produtos" />}
        />
        <Route
          path="/relatorios/clientes"
          element={<RelatorioDetalhe tipo="clientes" />}
        />
        <Route
          path="/relatorios/estoque"
          element={<RelatorioDetalhe tipo="estoque" />}
        />

        <Route path="*" element={<Navigate to="/painel" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}

export default App
