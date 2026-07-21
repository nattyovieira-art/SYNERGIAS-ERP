import { Edit, Trash2 } from 'lucide-react'
import './DataTable.css'

type Column<T> = {
  key: keyof T
  label: string
  type?: 'text' | 'currency' | 'status'
}

type DataTableProps<T> = {
  columns: Column<T>[]
  data: T[]
  onEdit?: (row: T, index: number) => void
  onDelete?: (row: T, index: number) => void
}

function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onEdit,
  onDelete,
}: DataTableProps<T>) {
  function formatValue(value: any, type?: string) {
    if (type === 'currency') {
      const numero = Number(value || 0)

      return numero.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    }

    if (type === 'status') {
      const status = String(value || 'Ativo')

      const classeStatus =
        status.toLowerCase() === 'ativo'
          ? 'status-badge status-active'
          : 'status-badge status-inactive'

      return <span className={classeStatus}>{status}</span>
    }

    return value || ''
  }

  return (
    <div className="data-table-card">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)}>{column.label}</th>
            ))}

            <th>Ações</th>
          </tr>
        </thead>

        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 1}
                style={{
                  textAlign: 'center',
                  padding: '32px',
                  color: '#94a3b8',
                }}
              >
                Nenhum registro encontrado.
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={String(row.codigo || row.id || index)}>
                {columns.map((column) => (
                  <td key={String(column.key)}>
                    {formatValue(row[column.key], column.type)}
                  </td>
                ))}

                <td>
                  <div className="table-actions">
                    <button
                      type="button"
                      title="Editar"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()

                        if (onEdit) {
                          onEdit(row, index)
                        }
                      }}
                    >
                      <Edit size={17} />
                    </button>

                    <button
                      type="button"
                      title="Excluir"
                      className="danger"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()

                        if (onDelete) {
                          onDelete(row, index)
                        }
                      }}
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
  )
}

export default DataTable