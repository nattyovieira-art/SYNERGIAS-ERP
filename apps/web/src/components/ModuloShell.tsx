import type { ReactNode } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Sidebar from './Sidebar/Sidebar'
import PageHeader from './PageHeader/PageHeader'

import '../styles/novos-modulos.css'

type ModuloShellProps = {
  category: string
  title: string
  subtitle: string
  backTo: string
  children: ReactNode
  actions?: ReactNode
}

export default function ModuloShell({
  category,
  title,
  subtitle,
  backTo,
  children,
  actions,
}: ModuloShellProps) {
  const navigate = useNavigate()

  return (
    <main className="novo-modulo-layout">
      <Sidebar />

      <section className="novo-modulo-page">
        <PageHeader
          category={category}
          title={title}
          subtitle={subtitle}
        />

        <div className="novo-modulo-actions">
          <button
            type="button"
            className="novo-icon-btn novo-back"
            onClick={() => navigate(backTo)}
            title="Voltar"
            aria-label="Voltar"
          >
            <ArrowLeft size={25} />
          </button>

          <button
            type="button"
            className="novo-icon-btn novo-print"
            onClick={() => window.print()}
            title="Imprimir"
            aria-label="Imprimir"
          >
            <Printer size={25} />
          </button>

          {actions}
        </div>

        {children}
      </section>
    </main>
  )
}
