import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login/Login'
import { authApi, type AuthUser } from './services/authApi'
import { inicializarArmazenamentoCentral } from './services/erpApi'

import Dashboard from './pages/Dashboard/Dashboard'
import Clientes from './pages/Clientes/Clientes'
import ClienteForm from './pages/Clientes/ClienteForm'
import Produtos from './pages/Produtos/Produtos'
import ProdutoForm from './pages/Produtos/ProdutoForm'
import Vendas from './pages/Vendas/Vendas'
import OrcamentoForm from './pages/Vendas/OrcamentoForm'
import PedidoForm from './pages/Vendas/PedidoForm'

import Estoque from './pages/Estoque/Estoque'

import Financeiro from './pages/Financeiro/Financeiro'
import ContasReceber from './pages/Financeiro/ContasReceber'
import NovaContaReceber from './pages/Financeiro/NovaContaReceber'
import NovaContaPagar from './pages/Financeiro/NovaContaPagar'
import ConciliacaoBancaria from './pages/Financeiro/ConciliacaoBancaria'
import ReceberConta from './pages/Financeiro/ReceberConta'

import Compras from './pages/Compras/Compras'
import CompraForm from './pages/Compras/CompraForm'

import Fiscal from './pages/Fiscal/Fiscal'
import ConfiguracaoFiscal from './pages/Fiscal/ConfiguracaoFiscal'
import CertificadoDigital from './pages/Fiscal/CertificadoDigital'
import AnaliseFiscalEntradas from './pages/Fiscal/AnaliseFiscalEntradas'
import RegrasNcmCest from './pages/Fiscal/RegrasNcmCest'
import NFeRecebidas from './pages/Fiscal/NFeRecebidas'

import Relatorios from './pages/Relatorios/Relatorios'
import RelatorioDetalhe from './pages/Relatorios/RelatorioDetalhe'
import Configuracoes from './pages/Configuracoes/Configuracoes'
import ParametrosVendas from './pages/Configuracoes/ParametrosVendas'
import Vendedores from './pages/Configuracoes/Vendedores'
import FormasPagamento from './pages/Configuracoes/FormasPagamento'
import ContasBancarias from './pages/Configuracoes/ContasBancarias'
import CategoriasFinanceiras from './pages/Configuracoes/CategoriasFinanceiras'
import ParametrosMovimentacao from './pages/Configuracoes/ParametrosMovimentacao'
import NumeracaoFiscal from './pages/Configuracoes/NumeracaoFiscal'
import NaturezasOperacao from './pages/Configuracoes/NaturezasOperacao'
import UsuariosPermissoes from './pages/Configuracoes/UsuariosPermissoes'
import IntegracoesBancarias from './pages/Configuracoes/IntegracoesBancarias'
import IntegracaoSefazNFe from './pages/Configuracoes/IntegracaoSefazNFe'
import Sistema from './pages/Configuracoes/Sistema'
import Marcas from './pages/Produtos/Marcas'
import UnidadesMedida from './pages/Produtos/UnidadesMedida'
import Devolucoes from './pages/Vendas/Devolucoes'
import HistoricoComercial from './pages/Clientes/HistoricoComercial'
import ContasPagar from './pages/Financeiro/ContasPagar'
import FluxoCaixa from './pages/Financeiro/FluxoCaixa'
import LocaisEstoque from './pages/Estoque/LocaisEstoque'
import MovimentarEstoque from './pages/Estoque/MovimentarEstoque'
import HistoricoEstoque from './pages/Estoque/HistoricoEstoque'
import RelatorioBrindes from './pages/Relatorios/RelatorioBrindes'

import './App.css'

function App() {
  const [authLoading, setAuthLoading] = useState(true)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [storageLoading, setStorageLoading] = useState(false)

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
    return <BrowserRouter><Login onAuthenticated={aoAutenticar} /></BrowserRouter>
  }

  return (
    <BrowserRouter>
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
          element={<Navigate to="/vendas/pedidos/editar/:id" replace />}
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
    </BrowserRouter>
  )
}

export default App
