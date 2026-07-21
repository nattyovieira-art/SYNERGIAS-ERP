import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  CircleDollarSign,
  ClipboardList,
  FileChartColumnIncreasing,
  FileKey2,
  FileText,
  Home,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react'

import '../../styles/page-header.css'

type PageHeaderProps = {
  category: string
  title: string
  subtitle?: string
}

function normalizarTexto(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function obterContexto(category: string, title: string, subtitle?: string) {
  return normalizarTexto(`${category} ${title} ${subtitle || ''}`)
}

function obterIconePorContexto(
  contexto: string,
  categoria: string,
): LucideIcon {
  const categoriaNormalizada = normalizarTexto(categoria)

  if (categoriaNormalizada === 'vendas') {
    return FileChartColumnIncreasing
  }

  if (categoriaNormalizada === 'estoque') {
    return Boxes
  }

  if (contexto.includes('painel') || contexto.includes('dashboard')) {
    return Home
  }

  if (contexto.includes('certificado')) {
    return FileKey2
  }

  if (contexto.includes('fiscal')) {
    return Calculator
  }

  if (contexto.includes('produto') || contexto.includes('catalogo')) {
    return Package
  }

  if (contexto.includes('cliente') || contexto.includes('condominio')) {
    return Users
  }

  if (contexto.includes('orcamento')) {
    return ClipboardList
  }

  if (contexto.includes('pedido')) {
    return FileText
  }

  if (contexto.includes('venda')) {
    return ShoppingCart
  }

  if (
    contexto.includes('financeiro') ||
    contexto.includes('contabil') ||
    contexto.includes('conta') ||
    contexto.includes('receber') ||
    contexto.includes('conciliacao') ||
    contexto.includes('bancaria')
  ) {
    return CircleDollarSign
  }

  if (contexto.includes('compra')) {
    return ShoppingCart
  }

  if (contexto.includes('estoque')) {
    return Boxes
  }

  if (contexto.includes('fornecedor')) {
    return Building2
  }

  if (contexto.includes('relatorio')) {
    return BarChart3
  }

  if (contexto.includes('configur')) {
    return Settings
  }

  return FileText
}

function obterClasseCor(contexto: string) {
  if (contexto.includes('painel') || contexto.includes('dashboard')) {
    return 'verde'
  }

  if (contexto.includes('fiscal') || contexto.includes('certificado')) {
    return 'fiscal'
  }

  if (contexto.includes('produto') || contexto.includes('catalogo')) {
    return 'laranja'
  }

  if (contexto.includes('cliente') || contexto.includes('condominio')) {
    return 'azul'
  }

  if (
    contexto.includes('venda') ||
    contexto.includes('orcamento') ||
    contexto.includes('pedido')
  ) {
    return 'roxo'
  }

  if (
    contexto.includes('financeiro') ||
    contexto.includes('contabil') ||
    contexto.includes('conta') ||
    contexto.includes('receber') ||
    contexto.includes('conciliacao') ||
    contexto.includes('bancaria')
  ) {
    return 'verde'
  }

  if (contexto.includes('compra') || contexto.includes('fornecedor')) {
    return 'dourado'
  }

  if (contexto.includes('estoque')) {
    return 'petroleo'
  }

  if (contexto.includes('relatorio')) {
    return 'grafite'
  }

  if (contexto.includes('configur')) {
    return 'cinza'
  }

  return 'verde'
}

function PageHeader({ category, title, subtitle }: PageHeaderProps) {
  const contexto = obterContexto(category, title, subtitle)
  const Icone = obterIconePorContexto(contexto, category)
  const cor = obterClasseCor(contexto)

  return (
    <header className="page-header">
      <div className="page-header-topline">
        <div className={`page-header-icon ${cor}`}>
          <Icone size={20} />
        </div>

        <span className={`page-header-category ${cor}`}>{category}</span>
      </div>

      <h1 className="page-header-title">{title}</h1>

      {subtitle ? <p className="page-header-subtitle">{subtitle}</p> : null}
    </header>
  )
}

export default PageHeader
