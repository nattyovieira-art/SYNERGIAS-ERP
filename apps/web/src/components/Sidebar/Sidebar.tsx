import { useLocation, useNavigate } from 'react-router-dom'
import {
  Boxes,
  Calculator,
  CircleDollarSign,
  ClipboardList,
  FileChartColumnIncreasing,
  Home,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react'
import '../../styles/dashboard.css'

function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const itens = [
    { rota: '/painel', label: 'Painel', icon: Home },
    { rota: '/clientes', label: 'Clientes', icon: Users },
    { rota: '/produtos', label: 'Produtos', icon: Package },
    { rota: '/compras', label: 'Compras', icon: ShoppingCart },
    { rota: '/estoque', label: 'Estoque', icon: Boxes },
    { rota: '/vendas', label: 'Vendas', icon: FileChartColumnIncreasing },
    { rota: '/financeiro', label: 'Financeiro', icon: CircleDollarSign },
    { rota: '/fiscal', label: 'Fiscal', icon: Calculator },
    { rota: '/relatorios', label: 'Relatórios', icon: ClipboardList },
    { rota: '/configuracoes', label: 'Configurações', icon: Settings },
  ]

  return (
    <>
      <aside className="dashboard-sidebar">
      <div className="sidebar-brand">
        <img
          className="sidebar-company-logo"
          src="/logo-synergias.png"
          alt="Synergias"
        />
        <div>
          <strong>Synergias</strong>
          <span>ERP Cloud</span>
        </div>
      </div>

      <nav className="sidebar-menu">
        {itens.map(({ rota, label, icon: Icon }) => {
          const ativo =
            location.pathname === rota ||
            (rota !== '/painel' && location.pathname.startsWith(`${rota}/`))

          return (
            <button
              key={rota}
              type="button"
              className={ativo ? 'active' : ''}
              onClick={() => navigate(rota)}
            >
              <Icon size={19} strokeWidth={2} />
              {label}
            </button>
          )
        })}
      </nav>
    </aside>
    </>
  )
}

export default Sidebar
