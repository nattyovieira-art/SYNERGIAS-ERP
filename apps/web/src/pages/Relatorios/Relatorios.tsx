import {
  Boxes,
  CircleDollarSign,
  FileChartColumnIncreasing,
  Package,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'

import '../../styles/relatorios.css'

const RELATORIOS = [
  {
    titulo: 'Financeiro',
    descricao: 'Recebimentos, inadimplência, cobranças e DRE gerencial.',
    quantidade: 6,
    rota: '/relatorios/financeiro',
    classe: 'financeiro',
    Icone: CircleDollarSign,
  },
  {
    titulo: 'Vendas',
    descricao: 'Período, vendedor, cliente, produtos, conversão e margem das vendas.',
    quantidade: 10,
    rota: '/relatorios/vendas',
    classe: 'vendas',
    Icone: FileChartColumnIncreasing,
  },
  {
    titulo: 'Compras',
    descricao: 'Compras realizadas, pedidos em aberto, fornecedores, custos e recebimentos.',
    quantidade: 5,
    rota: '/relatorios/compras',
    classe: 'compras',
    Icone: ShoppingCart,
  },
  {
    titulo: 'Produtos',
    descricao: 'Curva ABC, lucratividade, giro comercial e evolução de custos e preços.',
    quantidade: 7,
    rota: '/relatorios/produtos',
    classe: 'produtos',
    Icone: Package,
  },
  {
    titulo: 'Estoque',
    descricao: 'Kardex, estoque baixo, cobertura, giro, perdas e valor imobilizado.',
    quantidade: 8,
    rota: '/relatorios/estoque',
    classe: 'estoque',
    Icone: Boxes,
  },
  {
    titulo: 'Clientes',
    descricao: 'Curva ABC, carteira, inatividade, frequência, ticket e ranking de clientes.',
    quantidade: 8,
    rota: '/relatorios/clientes',
    classe: 'clientes',
    Icone: Users,
  },
]

function Relatorios() {
  const navigate = useNavigate()

  return (
    <main className="relatorios-page">
      <Sidebar />

      <section className="relatorios-content">
        <PageHeader
          category="Relatórios"
          title="Central de Relatórios"
          subtitle="Indicadores comerciais, financeiros, de produtos, estoque e clientes do ERP Synergias."
        />
        <section className="relatorios-grid">
          {RELATORIOS.map(
            ({ titulo, descricao, quantidade, rota, classe, Icone }) => (
              <button
                key={rota}
                type="button"
                className={`relatorios-card relatorios-card-${classe}`}
                onClick={() => navigate(rota)}
              >
                <span className="relatorios-card-icon">
                  <Icone size={30} strokeWidth={2.2} />
                </span>

                <span className="relatorios-card-texto">
                  <strong>{titulo}</strong>
                  <small>{descricao}</small>
                  <span className="relatorios-card-count">
                    {quantidade} relatórios
                  </span>
                </span>
              </button>
            ),
          )}
        </section>
      </section>
    </main>
  )
}

export default Relatorios
