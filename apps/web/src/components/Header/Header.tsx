import { Bell, Search } from 'lucide-react'

function Header() {
  return (
    <header className="dashboard-header">
      <div>
        <span>Visão geral</span>

        <h1>Bem-vinda, Natália</h1>

        <p>Acompanhe os principais indicadores da operação.</p>
      </div>

      <div className="header-actions">
        <div className="search-box">
          <Search size={18} />
          <input placeholder="Pesquisar..." />
        </div>

        <button className="icon-button">
          <Bell size={20} />
        </button>

        <div className="user-avatar">N</div>
      </div>
    </header>
  )
}

export default Header