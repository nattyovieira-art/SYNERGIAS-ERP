import type { ReactNode } from 'react'
import { ArrowLeft, Printer, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import '../../styles/configuracoes-form.css'

type Props = {
  category: string
  title: string
  subtitle: string
  children: ReactNode
  onSave?: () => void
  saveLabel?: string
  notice?: ReactNode
}

export default function ConfiguracaoFormShell({
  category,
  title,
  subtitle,
  children,
  onSave,
  saveLabel = 'Salvar',
  notice,
}: Props) {
  const navigate = useNavigate()

  return (
    <main className="config-form-layout">
      <Sidebar />
      <section className="config-form-page">
        <PageHeader category={category} title={title} subtitle={subtitle} />

        <div className="config-form-actions">
          <button
            type="button"
            className="config-icon-button config-icon-button-back"
            title="Voltar"
            onClick={() => navigate('/configuracoes')}
          >
            <ArrowLeft size={25} />
          </button>

          <button
            type="button"
            className="config-icon-button config-icon-button-print"
            title="Imprimir"
            aria-label="Imprimir"
            onClick={() => window.print()}
          >
            <Printer size={25} />
          </button>

          {onSave ? (
            <button
              type="button"
              className="config-icon-button config-icon-button-save"
              title={saveLabel}
              onClick={onSave}
            >
              <Save size={25} />
            </button>
          ) : null}
        </div>

        {notice ? <div className="config-form-notice">{notice}</div> : null}
        <div className="config-form-card">{children}</div>
      </section>
    </main>
  )
}
