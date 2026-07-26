import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Columns3,
  Download,
  CircleDollarSign,
  Search,
  ShoppingBag,
  Ticket,
  Users,
  Printer,
  RefreshCw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'

import type { Cliente } from '../../types/Cliente'
import type { Compra } from '../../types/Compra'
import type { EstoqueMovimentacao } from '../../types/Estoque'
import type { ContaReceber, LancamentoOFX } from '../../types/Financeiro'
import type { Produto } from '../../types/Produto'
import type { Venda } from '../../types/Venda'
import { ERP_STORAGE_UPDATED_EVENT, obterColecaoMemoria } from '../../services/erpApi'
import { consolidarVendasRelatorios } from '../../services/relatoriosData'
import { listarComprasStorage } from '../../services/comprasStorage'
import { EVENTO_CONTAS_PAGAR_ATUALIZADAS } from '../../services/diariasFinanceiro'






import '../../styles/relatorios.css'

const RELATORIOS_VENDAS_MARKER_V239 = 'SYNERGIAS_RELATORIOS_VENDAS_ETAPA3_V239'

type TipoRelatorio = 'financeiro' | 'vendas' | 'compras' | 'produtos' | 'clientes' | 'estoque'

type RelatorioDetalheProps = {
  tipo: TipoRelatorio
}

type LinhaRelatorio = Record<string, string | number>

type ContaBancariaRelatorio = { id?: string; banco?: string; codigo?: string; agencia?: string; conta?: string; digito?: string; tipo?: string; pix?: string; principal?: boolean; ativa?: boolean }

type ColunaRelatorio = {
  chave: string
  titulo: string
  alinhar?: 'left' | 'right' | 'center'
}

type ResultadoRelatorio = {
  indicadores: Array<[string, string]>
  colunas: ColunaRelatorio[]
  linhas: LinhaRelatorio[]
  observacao?: string
}

type DefinicaoRelatorio = {
  id: string
  titulo: string
  descricao: string
}

type ConfiguracaoArea = {
  titulo: string
  subtitulo: string
  corClasse: string
  relatorios: DefinicaoRelatorio[]
}

type ContaPagarRelatorio = {
  id: string
  fornecedor: string
  documento?: string
  descricao: string
  categoria?: string
  emissao?: string
  vencimento: string
  valor: number
  status: 'Em aberto' | 'Paga' | 'Cancelada'
  dataPagamento?: string
  conciliado?: boolean
  valorPago?: number
}

const CONFIGURACOES: Record<TipoRelatorio, ConfiguracaoArea> = {
  financeiro: {
    titulo: 'Relatórios Financeiros',
    subtitulo: 'Recebimentos, inadimplência, cobranças e DRE gerencial.',
    corClasse: 'financeiro',
    relatorios: [
      { id: 'pagamentos', titulo: 'Pagamentos', descricao: 'Contas pagas e valores recebidos.' },
      { id: 'recebimentos', titulo: 'Recebimentos', descricao: 'Recebimentos por período e cliente.' },
      { id: 'dre', titulo: 'DRE Gerencial', descricao: 'Visão simplificada de receita, custo e margem.' },
      { id: 'cobrancas', titulo: 'Cobranças Emitidas', descricao: 'Boletos e cobranças geradas no ERP.' },
      { id: 'inadimplencia', titulo: 'Inadimplência', descricao: 'Clientes e títulos vencidos.' },
      { id: 'contas-bancarias', titulo: 'Contas Bancárias', descricao: 'Contas bancárias cadastradas nas configurações do ERP.' },
    ],
  },
  vendas: {
    titulo: 'Relatórios de Vendas',
    subtitulo: 'Desempenho comercial, conversão de orçamentos, vendas e margens.',
    corClasse: 'vendas',
    relatorios: [
      { id: 'periodo', titulo: 'Vendas por Período', descricao: 'Faturamento e pedidos no período.' },
      { id: 'vendedor', titulo: 'Vendas por Vendedor', descricao: 'Volume, faturamento e ticket por vendedor.' },
      { id: 'cliente', titulo: 'Vendas por Cliente', descricao: 'Faturamento e pedidos por cliente.' },
      { id: 'produto', titulo: 'Vendas por Produto', descricao: 'Quantidade e faturamento por item.' },
      { id: 'ticket', titulo: 'Ticket Médio', descricao: 'Ticket médio geral e por vendedor.' },
      { id: 'pagamento', titulo: 'Forma de Pagamento', descricao: 'Vendas agrupadas por forma de pagamento.' },
      { id: 'desconto', titulo: 'Vendas por Desconto', descricao: 'Impacto dos descontos nas vendas.' },
      { id: 'conversao', titulo: 'Conversão de Orçamentos', descricao: 'Orçamentos convertidos e taxa de conversão.' },
      { id: 'margem', titulo: 'Lucratividade por Pedido Concluído', descricao: 'Venda, custo real disponível, lucro e margem dos pedidos concluídos ou entregues.' },
      { id: 'brindes', titulo: 'Brindes Concedidos', descricao: 'Brindes entregues por pedido, produto e destinatário.' },
    ],
  },
  compras: {
    titulo: 'Relatórios de Compras',
    subtitulo: 'Compras realizadas, pedidos em aberto, fornecedores, custos e recebimentos.',
    corClasse: 'compras',
    relatorios: [
      { id: 'realizadas', titulo: 'Compras Realizadas', descricao: 'Pedidos de compra emitidos no período.' },
      { id: 'aberto', titulo: 'Compras em Aberto', descricao: 'Compras ainda não totalmente recebidas.' },
      { id: 'fornecedor', titulo: 'Compras por Fornecedor', descricao: 'Volume e valor comprado por fornecedor.' },
      { id: 'custos', titulo: 'Custos de Compra', descricao: 'Itens, custos unitários e valor comprado.' },
      { id: 'recebimentos', titulo: 'Recebimentos de Compras', descricao: 'Situação de recebimento dos pedidos.' },
    ],
  },
  produtos: {
    titulo: 'Relatórios de Produtos',
    subtitulo: 'Curva ABC, lucratividade, desempenho de vendas e evolução de custos.',
    corClasse: 'produtos',
    relatorios: [
      { id: 'abc', titulo: 'Curva ABC de Produtos', descricao: 'Classificação por participação no faturamento.' },
      { id: 'lucratividade', titulo: 'Lucratividade por Produto', descricao: 'Receita, custo e margem estimada por item.' },
      { id: 'mais-vendidos', titulo: 'Produtos Mais Vendidos', descricao: 'Ranking por quantidade vendida.' },
      { id: 'sem-venda', titulo: 'Produtos sem Venda', descricao: 'Produtos cadastrados sem venda no período.' },
      { id: 'item-cliente', titulo: 'Itens Vendidos por Cliente', descricao: 'Relação de clientes e produtos comprados.' },
      { id: 'precos', titulo: 'Histórico de Preços', descricao: 'Preço atual e preço médio praticado nas vendas.' },
      { id: 'custos', titulo: 'Evolução de Custo', descricao: 'Histórico de custo médio dos produtos.' },
    ],
  },
  estoque: {
    titulo: 'Relatórios de Estoque',
    subtitulo: 'Movimentações, riscos de ruptura, cobertura, giro e valor do estoque.',
    corClasse: 'estoque',
    relatorios: [
      { id: 'kardex', titulo: 'Kardex', descricao: 'Entradas, saídas, ajustes e saldo por movimentação.' },
      { id: 'baixo', titulo: 'Estoque Baixo', descricao: 'Produtos abaixo ou no estoque mínimo.' },
      { id: 'negativo', titulo: 'Estoque Negativo', descricao: 'Produtos com saldo abaixo de zero.' },
      { id: 'perdas', titulo: 'Perdas e Avarias', descricao: 'Ajustes relacionados a perdas, avarias e vencimentos.' },
      { id: 'abc', titulo: 'Curva ABC de Estoque', descricao: 'Classificação por valor imobilizado em estoque.' },
      { id: 'giro', titulo: 'Giro de Estoque', descricao: 'Saídas comparadas ao estoque médio disponível.' },
      { id: 'cobertura', titulo: 'Cobertura de Estoque', descricao: 'Estimativa de dias de estoque pela venda média.' },
      { id: 'valor', titulo: 'Valor do Estoque', descricao: 'Valor atual do estoque por produto e categoria.' },
    ],
  },
  clientes: {
    titulo: 'Relatórios de Clientes',
    subtitulo: 'Carteira, comportamento de compra, inatividade, ticket e ranking.',
    corClasse: 'clientes',
    relatorios: [
      { id: 'abc', titulo: 'Curva ABC de Clientes', descricao: 'Classificação por participação no faturamento.' },
      { id: 'carteira', titulo: 'Carteira de Clientes', descricao: 'Visão geral da base cadastrada.' },
      { id: 'inativos', titulo: 'Clientes Inativos', descricao: 'Clientes com situação inativa ou bloqueada.' },
      { id: 'sem-comprar', titulo: 'Clientes sem Comprar', descricao: 'Clientes há mais tempo sem realizar pedidos.' },
      { id: 'ultima-compra', titulo: 'Última Compra', descricao: 'Última venda registrada para cada cliente.' },
      { id: 'frequencia', titulo: 'Frequência de Compra', descricao: 'Pedidos e intervalo médio entre compras.' },
      { id: 'ticket', titulo: 'Ticket Médio por Cliente', descricao: 'Valor médio dos pedidos de cada cliente.' },
      { id: 'ranking', titulo: 'Ranking de Clientes', descricao: 'Clientes ordenados por faturamento.' },
    ],
  },
}

function lerStorage<T>(chave: string): T[] {
  try {
    const dados = window.localStorage.getItem(chave)
    if (!dados) return []
    const lista = JSON.parse(dados)
    return Array.isArray(lista) ? (lista as T[]) : []
  } catch {
    return []
  }
}

function numero(valor: unknown) {
  const convertido = Number(valor ?? 0)
  return Number.isFinite(convertido) ? convertido : 0
}

function dinheiro(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function percentual(valor: number) {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function inteiro(valor: number) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function decimal(valor: number) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function texto(valor: unknown) {
  return String(valor ?? '').trim()
}

function normalizar(valor: unknown) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function dataIso(valor: unknown) {
  const data = texto(valor).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : ''
}

function dataBr(valor: unknown) {
  const data = dataIso(valor)
  if (!data) return '-'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function diasEntre(inicio: string, fim: string) {
  if (!inicio || !fim) return 0
  const a = new Date(`${inicio}T12:00:00`).getTime()
  const b = new Date(`${fim}T12:00:00`).getTime()
  return Math.max(0, Math.round((b - a) / 86400000))
}

function hojeIso() {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function dentroPeriodo(data: string, inicial: string, final: string) {
  if (!data) return true
  if (inicial && data < inicial) return false
  if (final && data > final) return false
  return true
}

function dataVenda(venda: Venda) {
  return dataIso(venda.dataEmissao || venda.criadoEm)
}

function valorVenda(venda: Venda) {
  return numero(venda.totalFinal || venda.subtotal)
}

function somentePedidos(vendas: Venda[]) {
  return consolidarVendasRelatorios(vendas).pedidos
}

function agrupar<T>(lista: T[], chave: (item: T) => string) {
  const mapa = new Map<string, T[]>()
  lista.forEach((item) => {
    const grupo = chave(item) || 'Não informado'
    mapa.set(grupo, [...(mapa.get(grupo) || []), item])
  })
  return mapa
}

function agruparNormalizado<T>(lista: T[], chave: (item: T) => string, rotulo?: (item: T) => string) {
  const mapa = new Map<string, { rotulo: string; itens: T[] }>()

  lista.forEach((item) => {
    const rotuloInformado = texto(rotulo?.(item) ?? chave(item)) || 'Não informado'
    const chaveNormalizada = normalizar(chave(item)) || normalizar(rotuloInformado)
    const atual = mapa.get(chaveNormalizada)

    if (atual) {
      atual.itens.push(item)
      const rotuloAtualLimpo = atual.rotulo.replace(/\s+/g, ' ').trim()
      const rotuloNovoLimpo = rotuloInformado.replace(/\s+/g, ' ').trim()
      if (rotuloNovoLimpo.length > rotuloAtualLimpo.length) atual.rotulo = rotuloNovoLimpo
      return
    }

    mapa.set(chaveNormalizada, { rotulo: rotuloInformado, itens: [item] })
  })

  return mapa
}

function localizarProdutoDoItem(item: Venda['itens'][number], produtos: Produto[]) {
  const chavesItem = [
    item.codigoProduto,
    item.codigoBarras,
    item.codigoProdutoHistorico,
    item.chaveProdutoHistorico,
    item.descricaoHistorica,
    item.descricao,
  ]
    .map((valor) => normalizar(valor))
    .filter(Boolean)

  const produtoExato = produtos.find((produto) => {
    const chavesProduto = [
      produto.codigo,
      produto.codigoBarras,
      produto.codigoInterno,
      produto.sku,
      produto.referencia,
      produto.descricao,
      produto.nome,
      produto.nomeProduto,
      produto.produto,
    ]
      .map((valor) => normalizar(valor))
      .filter(Boolean)

    return chavesItem.some((chaveItem) => chavesProduto.includes(chaveItem))
  })

  if (produtoExato) return produtoExato

  const descricaoItem = normalizar(item.descricaoHistorica || item.descricao)
  if (!descricaoItem) return undefined

  return produtos.find((produto) => {
    const descricaoProduto = normalizar(
      produto.descricao || produto.nome || produto.nomeProduto || produto.produto,
    )
    return descricaoProduto === descricaoItem
  })
}

function custoItemVenda(item: Venda['itens'][number], produtos: Produto[]) {
  const quantidade = numero(item.quantidade)
  const custoTotalHistorico = numero(item.custoTotal)
  const custoUnitarioHistorico = numero(item.custoUnitario)

  if (custoTotalHistorico > 0) {
    return { custo: custoTotalHistorico, possuiCusto: true, origem: 'Histórico do pedido' }
  }

  if (custoUnitarioHistorico > 0) {
    return { custo: custoUnitarioHistorico * quantidade, possuiCusto: true, origem: 'Histórico do pedido' }
  }

  const produto = localizarProdutoDoItem(item, produtos)
  const custoCadastro = obterCustoProduto(produto)

  if (custoCadastro > 0) {
    return { custo: custoCadastro * quantidade, possuiCusto: true, origem: 'Cadastro atual' }
  }

  return { custo: 0, possuiCusto: false, origem: 'Sem custo cadastrado' }
}

function obterCustoProduto(produto?: Produto) {
  if (!produto) return 0

  const custoDireto = numero(
    produto.custoMedioAtual ?? produto.custo ?? produto.ultimoCustoCompra,
  )
  if (custoDireto > 0) return custoDireto

  const historico = [...(produto.historicoCustos || [])].reverse()
  for (const registro of historico) {
    const custoHistorico = numero(
      registro.custoMedioNovo ??
        registro.custoMedioAtual ??
        registro.custoNovo ??
        registro.custoCompra ??
        registro.custoEntrada,
    )
    if (custoHistorico > 0) return custoHistorico
  }

  return 0
}

function obterEstoqueProduto(produto: Produto) {
  return numero(
    produto.estoqueAtual ??
      produto.estoque ??
      produto.quantidadeEstoque ??
      produto.saldoEstoque ??
      produto.quantidade,
  )
}

function calcularCurvaABC<T>(
  itens: T[],
  obterValor: (item: T) => number,
): Array<T & { classeABC: string; participacao: number; acumulado: number }> {
  const ordenados = [...itens].sort((a, b) => obterValor(b) - obterValor(a))
  const total = ordenados.reduce((soma, item) => soma + obterValor(item), 0)
  let acumulado = 0

  return ordenados.map((item) => {
    const participacao = total > 0 ? (obterValor(item) / total) * 100 : 0
    acumulado += participacao
    const classeABC = acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C'
    return { ...item, classeABC, participacao, acumulado }
  })
}

function gerarFinanceiro(
  id: string,
  contas: ContaReceber[],
  contasPagar: ContaPagarRelatorio[],
  lancamentos: LancamentoOFX[],
  vendas: Venda[],
  produtos: Produto[],
  contasBancarias: ContaBancariaRelatorio[],
): ResultadoRelatorio {
  const hoje = hojeIso()

  if (id === 'contas-bancarias') {
    const ativas = contasBancarias.filter((conta) => conta.ativa !== false)
    const principal = contasBancarias.find((conta) => conta.principal)
    return {
      indicadores: [
        ['Contas cadastradas', inteiro(contasBancarias.length)],
        ['Contas ativas', inteiro(ativas.length)],
        ['Conta principal', principal?.banco || 'N/D'],
        ['Com chave PIX', inteiro(contasBancarias.filter((conta) => texto(conta.pix)).length)],
      ],
      colunas: [
        { chave: 'banco', titulo: 'Banco' },
        { chave: 'codigo', titulo: 'Código', alinhar: 'center' },
        { chave: 'tipo', titulo: 'Tipo' },
        { chave: 'agenciaConta', titulo: 'Agência / Conta' },
        { chave: 'pix', titulo: 'Chave PIX' },
        { chave: 'principal', titulo: 'Principal', alinhar: 'center' },
        { chave: 'status', titulo: 'Situação', alinhar: 'center' },
      ],
      linhas: contasBancarias.map((conta) => ({
        banco: conta.banco || '-',
        codigo: conta.codigo || '-',
        tipo: conta.tipo || '-',
        agenciaConta: `${conta.agencia || '-'} / ${conta.conta || '-'}${conta.digito ? `-${conta.digito}` : ''}`,
        pix: conta.pix || '-',
        principal: conta.principal ? 'Sim' : 'Não',
        status: conta.ativa === false ? 'Inativa' : 'Ativa',
      })),
      observacao: 'Dados lidos do mesmo cadastro de Contas Bancárias usado em Configurações > Financeiro.',
    }
  }
  const colunasConta: ColunaRelatorio[] = [
    { chave: 'cliente', titulo: 'Cliente' },
    { chave: 'descricao', titulo: 'Descrição' },
    { chave: 'vencimento', titulo: 'Vencimento', alinhar: 'center' },
    { chave: 'valor', titulo: 'Valor', alinhar: 'right' },
    { chave: 'recebido', titulo: 'Recebido', alinhar: 'right' },
    { chave: 'saldo', titulo: 'Saldo', alinhar: 'right' },
    { chave: 'status', titulo: 'Situação', alinhar: 'center' },
  ]

  if (id === 'pagamentos') {
    const pagas = contasPagar.filter((conta) => conta.status === 'Paga')
    const total = pagas.reduce(
      (soma, conta) => soma + numero(conta.valorPago ?? conta.valor),
      0,
    )
    return {
      indicadores: [
        ['Pagamentos', inteiro(pagas.length)],
        ['Total pago', dinheiro(total)],
        ['Fornecedores', inteiro(new Set(pagas.map((conta) => conta.fornecedor).filter(Boolean)).size)],
        ['Média paga', dinheiro(pagas.length ? total / pagas.length : 0)],
      ],
      colunas: [
        { chave: 'fornecedor', titulo: 'Fornecedor' },
        { chave: 'descricao', titulo: 'Descrição' },
        { chave: 'vencimento', titulo: 'Vencimento', alinhar: 'center' },
        { chave: 'pagamento', titulo: 'Pagamento', alinhar: 'center' },
        { chave: 'valor', titulo: 'Valor pago', alinhar: 'right' },
        { chave: 'situacao', titulo: 'Situação', alinhar: 'center' },
      ],
      linhas: pagas
        .sort((a, b) => texto(b.dataPagamento).localeCompare(texto(a.dataPagamento)))
        .map((conta) => ({
          fornecedor: conta.fornecedor,
          descricao: conta.descricao,
          vencimento: dataBr(conta.vencimento),
          pagamento: dataBr(conta.dataPagamento),
          valor: dinheiro(numero(conta.valorPago ?? conta.valor)),
          situacao: 'Pago',
        })),
    }
  }

  if (id === 'recebimentos') {
    const pagas = contas.filter((conta) => numero(conta.valorRecebido) > 0)
    const total = pagas.reduce((soma, conta) => soma + numero(conta.valorRecebido), 0)
    const clientes = new Set(pagas.map((conta) => conta.clienteNome).filter(Boolean)).size
    const ticket = pagas.length ? total / pagas.length : 0
    return {
      indicadores: [
        ['Recebimentos', inteiro(pagas.length)],
        ['Total recebido', dinheiro(total)],
        ['Clientes', inteiro(clientes)],
        ['Média recebida', dinheiro(ticket)],
      ],
      colunas: colunasConta,
      linhas: pagas
        .sort((a, b) => texto(b.dataRecebimento).localeCompare(texto(a.dataRecebimento)))
        .map((conta) => ({
          cliente: conta.clienteNome,
          descricao: conta.descricao,
          vencimento: dataBr(conta.dataVencimento),
          valor: dinheiro(numero(conta.valorOriginal)),
          recebido: dinheiro(numero(conta.valorRecebido)),
          saldo: dinheiro(numero(conta.saldoAberto)),
          status: conta.status,
        })),
    }
  }

  if (id === 'dre') {
    const pedidos = somentePedidos(vendas)
    const mapaProdutos = new Map(produtos.map((produto) => [produto.codigo, produto]))
    const receita = pedidos.reduce((soma, venda) => soma + valorVenda(venda), 0)
    const descontos = pedidos.reduce(
      (soma, venda) => soma + numero(venda.descontoValor),
      0,
    )
    const cmvEstimado = pedidos.reduce(
      (somaVenda, venda) =>
        somaVenda +
        venda.itens.reduce((somaItem, item) => {
          const produto = mapaProdutos.get(item.codigoProduto)
          return somaItem + obterCustoProduto(produto) * numero(item.quantidade)
        }, 0),
      0,
    )
    const margem = receita - cmvEstimado
    const margemPercentual = receita > 0 ? (margem / receita) * 100 : 0
    const recebido = contas.reduce((soma, conta) => soma + numero(conta.valorRecebido), 0)

    return {
      indicadores: [
        ['Receita de vendas', dinheiro(receita)],
        ['CMV estimado', dinheiro(cmvEstimado)],
        ['Margem bruta estimada', dinheiro(margem)],
        ['Margem estimada', percentual(margemPercentual)],
        ['Recebido', dinheiro(recebido)],
      ],
      colunas: [
        { chave: 'linha', titulo: 'Linha gerencial' },
        { chave: 'valor', titulo: 'Valor', alinhar: 'right' },
        { chave: 'observacao', titulo: 'Observação' },
      ],
      linhas: [
        { linha: 'Receita bruta de vendas', valor: dinheiro(receita + descontos), observacao: 'Pedidos no período' },
        { linha: '(-) Descontos concedidos', valor: dinheiro(descontos), observacao: 'Descontos informados nas vendas' },
        { linha: '(=) Receita de vendas', valor: dinheiro(receita), observacao: 'Total final dos pedidos' },
        { linha: '(-) CMV estimado', valor: dinheiro(cmvEstimado), observacao: 'Custo médio atual × quantidade vendida' },
        { linha: '(=) Margem bruta estimada', valor: dinheiro(margem), observacao: percentual(margemPercentual) },
      ],
      observacao:
        'DRE gerencial preliminar. O CMV usa o custo médio atual dos produtos; após a migração para banco de dados, o relatório poderá usar o custo histórico de cada venda.',
    }
  }

  if (id === 'cobrancas') {
    const cobrancas = contas.filter(
      (conta) => texto(conta.numeroBoleto) || texto(conta.tipoCobranca) || texto(conta.bancoCobranca),
    )
    const total = cobrancas.reduce((soma, conta) => soma + numero(conta.valorOriginal), 0)
    const abertas = cobrancas.filter((conta) => numero(conta.saldoAberto) > 0).length
    return {
      indicadores: [
        ['Cobranças', inteiro(cobrancas.length)],
        ['Valor emitido', dinheiro(total)],
        ['Em aberto', inteiro(abertas)],
        ['Bancos', inteiro(new Set(cobrancas.map((conta) => conta.bancoCobranca).filter(Boolean)).size)],
      ],
      colunas: [
        { chave: 'cliente', titulo: 'Cliente' },
        { chave: 'tipo', titulo: 'Cobrança' },
        { chave: 'numero', titulo: 'Número' },
        { chave: 'vencimento', titulo: 'Vencimento', alinhar: 'center' },
        { chave: 'valor', titulo: 'Valor', alinhar: 'right' },
        { chave: 'status', titulo: 'Situação', alinhar: 'center' },
      ],
      linhas: cobrancas.map((conta) => ({
        cliente: conta.clienteNome,
        tipo: conta.tipoCobranca || conta.formaPagamento || '-',
        numero: conta.numeroBoleto || '-',
        vencimento: dataBr(conta.dataVencimento),
        valor: dinheiro(numero(conta.valorOriginal)),
        status: conta.status,
      })),
    }
  }

  if (id === 'inadimplencia') {
    const vencidas = contas.filter(
      (conta) =>
        numero(conta.saldoAberto) > 0 &&
        (normalizar(conta.status).includes('vencid') || dataIso(conta.dataVencimento) < hoje),
    )
    const saldo = vencidas.reduce((soma, conta) => soma + numero(conta.saldoAberto), 0)
    const clientes = new Set(vencidas.map((conta) => conta.clienteNome).filter(Boolean)).size
    const maiorAtraso = vencidas.reduce(
      (maior, conta) => Math.max(maior, diasEntre(dataIso(conta.dataVencimento), hoje)),
      0,
    )
    return {
      indicadores: [
        ['Títulos vencidos', inteiro(vencidas.length)],
        ['Saldo vencido', dinheiro(saldo)],
        ['Clientes inadimplentes', inteiro(clientes)],
        ['Maior atraso', `${maiorAtraso} dias`],
      ],
      colunas: [
        { chave: 'cliente', titulo: 'Cliente' },
        { chave: 'descricao', titulo: 'Descrição' },
        { chave: 'vencimento', titulo: 'Vencimento', alinhar: 'center' },
        { chave: 'atraso', titulo: 'Dias em atraso', alinhar: 'right' },
        { chave: 'saldo', titulo: 'Saldo vencido', alinhar: 'right' },
        { chave: 'status', titulo: 'Situação', alinhar: 'center' },
      ],
      linhas: vencidas
        .sort((a, b) => dataIso(a.dataVencimento).localeCompare(dataIso(b.dataVencimento)))
        .map((conta) => ({
          cliente: conta.clienteNome,
          descricao: conta.descricao,
          vencimento: dataBr(conta.dataVencimento),
          atraso: diasEntre(dataIso(conta.dataVencimento), hoje),
          saldo: dinheiro(numero(conta.saldoAberto)),
          status: conta.status,
        })),
    }
  }

  if (id === 'conciliacao') {
    const conciliados = lancamentos.filter((item) => item.conciliado).length
    const pendentes = lancamentos.length - conciliados
    const creditos = lancamentos
      .filter((item) => item.tipo === 'Credito')
      .reduce((soma, item) => soma + numero(item.valor), 0)
    return {
      indicadores: [
        ['Lançamentos OFX', inteiro(lancamentos.length)],
        ['Conciliados', inteiro(conciliados)],
        ['Pendentes', inteiro(pendentes)],
        ['Créditos importados', dinheiro(creditos)],
      ],
      colunas: [
        { chave: 'data', titulo: 'Data', alinhar: 'center' },
        { chave: 'descricao', titulo: 'Descrição' },
        { chave: 'tipo', titulo: 'Tipo', alinhar: 'center' },
        { chave: 'banco', titulo: 'Banco' },
        { chave: 'valor', titulo: 'Valor', alinhar: 'right' },
        { chave: 'situacao', titulo: 'Conciliação', alinhar: 'center' },
      ],
      linhas: lancamentos.map((item) => ({
        data: dataBr(item.data),
        descricao: item.descricao,
        tipo: item.tipo,
        banco: item.banco || '-',
        valor: dinheiro(numero(item.valor)),
        situacao: item.conciliado ? 'Conciliado' : 'Pendente',
      })),
    }
  }

  const saldo = contas.reduce((soma, conta) => soma + numero(conta.saldoAberto), 0)
  const vencidas = contas.filter(
    (conta) => numero(conta.saldoAberto) > 0 && dataIso(conta.dataVencimento) < hoje,
  ).length
  const aVencer = contas.filter(
    (conta) => numero(conta.saldoAberto) > 0 && dataIso(conta.dataVencimento) >= hoje,
  ).length
  return {
    indicadores: [
      ['Contas', inteiro(contas.length)],
      ['Saldo em aberto', dinheiro(saldo)],
      ['Vencidas', inteiro(vencidas)],
      ['A vencer', inteiro(aVencer)],
    ],
    colunas: colunasConta,
    linhas: contas.map((conta) => ({
      cliente: conta.clienteNome,
      descricao: conta.descricao,
      vencimento: dataBr(conta.dataVencimento),
      valor: dinheiro(numero(conta.valorOriginal)),
      recebido: dinheiro(numero(conta.valorRecebido)),
      saldo: dinheiro(numero(conta.saldoAberto)),
      status: conta.status,
    })),
  }
}

function gerarVendas(id: string, vendas: Venda[], produtos: Produto[]): ResultadoRelatorio {
  const pedidos = somentePedidos(vendas)
  const faturamento = pedidos.reduce((soma, venda) => soma + valorVenda(venda), 0)

  if (id === 'vendedor' || id === 'ticket') {
    const grupos = agruparNormalizado(pedidos, (venda) => venda.vendedor || 'Sem vendedor')
    const linhas = Array.from(grupos.values())
      .map(({ rotulo: vendedor, itens: lista }) => {
        const total = lista.reduce((soma, venda) => soma + valorVenda(venda), 0)
        return {
          vendedor,
          pedidos: lista.length,
          faturamento: dinheiro(total),
          ticket: dinheiro(lista.length ? total / lista.length : 0),
          _total: total,
        }
      })
      .sort((a, b) => b._total - a._total)
      .map(({ _total, ...linha }) => linha)

    return {
      indicadores: [
        ['Vendedores', inteiro(grupos.size)],
        ['Pedidos', inteiro(pedidos.length)],
        ['Faturamento', dinheiro(faturamento)],
        ['Ticket médio geral', dinheiro(pedidos.length ? faturamento / pedidos.length : 0)],
      ],
      colunas: [
        { chave: 'vendedor', titulo: 'Vendedor' },
        { chave: 'pedidos', titulo: 'Pedidos', alinhar: 'right' },
        { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right' },
        { chave: 'ticket', titulo: 'Ticket médio', alinhar: 'right' },
      ],
      linhas,
      observacao:
        'Vendedores com o mesmo nome são agrupados sem diferenciar letras maiúsculas, minúsculas, acentos ou espaços extras.',
    }
  }

  if (id === 'cliente') {
    const grupos = agruparNormalizado(
      pedidos,
      (venda) => venda.clienteCodigo || venda.clienteDocumento || venda.clienteNome || 'Cliente não informado',
      (venda) => venda.clienteNome || 'Cliente não informado',
    )
    const linhas = Array.from(grupos.values())
      .map(({ rotulo: cliente, itens: lista }) => {
        const total = lista.reduce((soma, venda) => soma + valorVenda(venda), 0)
        return {
          cliente,
          pedidos: lista.length,
          faturamento: dinheiro(total),
          ticket: dinheiro(lista.length ? total / lista.length : 0),
          ultima: dataBr([...lista].sort((a, b) => dataVenda(b).localeCompare(dataVenda(a)))[0]?.dataEmissao),
          _total: total,
        }
      })
      .sort((a, b) => b._total - a._total)
      .map(({ _total, ...linha }) => linha)
    return {
      indicadores: [
        ['Clientes compradores', inteiro(grupos.size)],
        ['Pedidos', inteiro(pedidos.length)],
        ['Faturamento', dinheiro(faturamento)],
        ['Ticket médio', dinheiro(pedidos.length ? faturamento / pedidos.length : 0)],
      ],
      colunas: [
        { chave: 'cliente', titulo: 'Cliente' },
        { chave: 'pedidos', titulo: 'Pedidos', alinhar: 'right' },
        { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right' },
        { chave: 'ticket', titulo: 'Ticket médio', alinhar: 'right' },
        { chave: 'ultima', titulo: 'Última compra', alinhar: 'center' },
      ],
      linhas,
    }
  }

  if (id === 'produto') {
    const mapa = new Map<string, { produto: string; quantidade: number; faturamento: number; pedidos: Set<string> }>()
    pedidos.forEach((venda) => {
      venda.itens.forEach((item) => {
        const chave = normalizar(item.codigoProduto || item.codigoBarras || item.descricao)
        const atual = mapa.get(chave) || { produto: item.descricao, quantidade: 0, faturamento: 0, pedidos: new Set<string>() }
        atual.quantidade += numero(item.quantidade)
        atual.faturamento += numero(item.valorTotal)
        atual.pedidos.add(venda.id)
        mapa.set(chave, atual)
      })
    })
    const linhas = Array.from(mapa.values())
      .sort((a, b) => b.faturamento - a.faturamento)
      .map((item) => ({
        produto: item.produto,
        quantidade: decimal(item.quantidade),
        pedidos: item.pedidos.size,
        faturamento: dinheiro(item.faturamento),
        medio: dinheiro(item.quantidade ? item.faturamento / item.quantidade : 0),
      }))
    return {
      indicadores: [
        ['Itens vendidos', inteiro(mapa.size)],
        ['Quantidade total', decimal(Array.from(mapa.values()).reduce((s, i) => s + i.quantidade, 0))],
        ['Pedidos', inteiro(pedidos.length)],
        ['Faturamento', dinheiro(faturamento)],
      ],
      colunas: [
        { chave: 'produto', titulo: 'Produto' },
        { chave: 'quantidade', titulo: 'Quantidade', alinhar: 'right' },
        { chave: 'pedidos', titulo: 'Pedidos', alinhar: 'right' },
        { chave: 'medio', titulo: 'Preço médio', alinhar: 'right' },
        { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right' },
      ],
      linhas,
    }
  }

  if (id === 'pagamento') {
    const grupos = agruparNormalizado(pedidos, (venda) => {
      const forma = String(venda.formaPagamento || venda.tipoCobranca || '').trim()
      if (!normalizar(forma).includes('boleto')) return forma || 'Não informado'
      const parcelaComBanco = (venda.parcelas || []).find((parcela) => parcela.bancoCobranca)
      const banco = String(venda.bancoCobranca || venda.bancoBoleto || parcelaComBanco?.bancoCobranca || '').trim()
      if (normalizar(banco).includes('inter') || normalizar(forma).includes('inter')) return 'BOLETO BANCO INTER'
      if (normalizar(banco).includes('cora') || normalizar(forma).includes('cora')) return 'BOLETO BANCO CORA'
      return 'BOLETO SEM BANCO INFORMADO'
    })
    const linhas = Array.from(grupos.values())
      .map(({ rotulo: forma, itens: lista }) => {
        const total = lista.reduce((s, venda) => s + valorVenda(venda), 0)
        return {
          forma,
          pedidos: lista.length,
          faturamento: dinheiro(total),
          participacao: percentual(faturamento ? (total / faturamento) * 100 : 0),
          _total: total,
        }
      })
      .sort((a, b) => b._total - a._total)
      .map(({ _total, ...linha }) => linha)
    return {
      indicadores: [
        ['Formas utilizadas', inteiro(grupos.size)],
        ['Pedidos', inteiro(pedidos.length)],
        ['Faturamento', dinheiro(faturamento)],
        ['Ticket médio', dinheiro(pedidos.length ? faturamento / pedidos.length : 0)],
      ],
      colunas: [
        { chave: 'forma', titulo: 'Forma de pagamento' },
        { chave: 'pedidos', titulo: 'Pedidos', alinhar: 'right' },
        { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right' },
        { chave: 'participacao', titulo: 'Participação', alinhar: 'right' },
      ],
      linhas,
    }
  }

  if (id === 'desconto') {
    const comDesconto = pedidos.filter(
      (venda) => numero(venda.descontoValor) > 0 || numero(venda.descontoPercentual) > 0,
    )
    const totalDesconto = comDesconto.reduce((s, venda) => s + numero(venda.descontoValor), 0)
    const totalVendasDesconto = comDesconto.reduce((s, venda) => s + valorVenda(venda), 0)
    return {
      indicadores: [
        ['Pedidos com desconto', inteiro(comDesconto.length)],
        ['Desconto concedido', dinheiro(totalDesconto)],
        ['Vendas com desconto', dinheiro(totalVendasDesconto)],
        ['Média por pedido', dinheiro(comDesconto.length ? totalDesconto / comDesconto.length : 0)],
      ],
      colunas: [
        { chave: 'pedido', titulo: 'Pedido' },
        { chave: 'cliente', titulo: 'Cliente' },
        { chave: 'vendedor', titulo: 'Vendedor' },
        { chave: 'data', titulo: 'Data', alinhar: 'center' },
        { chave: 'desconto', titulo: 'Desconto', alinhar: 'right' },
        { chave: 'total', titulo: 'Total final', alinhar: 'right' },
      ],
      linhas: comDesconto.map((venda) => ({
        pedido: venda.numeroPedido || venda.id,
        cliente: venda.clienteNome,
        vendedor: venda.vendedor,
        data: dataBr(venda.dataEmissao),
        desconto: dinheiro(numero(venda.descontoValor)),
        total: dinheiro(valorVenda(venda)),
      })),
    }
  }

  if (id === 'conversao') {
    const orcamentos = vendas.filter((venda) => venda.tipo === 'Orçamento' || Boolean(venda.numeroOrcamento))
    const convertidos = orcamentos.filter(
      (venda) =>
        normalizar(venda.statusOrcamento).includes('convertido') ||
        pedidos.some(
          (pedido) =>
            pedido.orcamentoOrigemId === venda.id ||
            (venda.numeroOrcamento && pedido.orcamentoOrigemNumero === venda.numeroOrcamento),
        ),
    )
    const taxa = orcamentos.length ? (convertidos.length / orcamentos.length) * 100 : 0
    const valorOrcado = orcamentos.reduce((s, venda) => s + valorVenda(venda), 0)
    return {
      indicadores: [
        ['Orçamentos', inteiro(orcamentos.length)],
        ['Convertidos', inteiro(convertidos.length)],
        ['Taxa de conversão', percentual(taxa)],
        ['Valor orçado', dinheiro(valorOrcado)],
      ],
      colunas: [
        { chave: 'orcamento', titulo: 'Orçamento' },
        { chave: 'cliente', titulo: 'Cliente' },
        { chave: 'vendedor', titulo: 'Vendedor' },
        { chave: 'emissao', titulo: 'Emissão', alinhar: 'center' },
        { chave: 'valor', titulo: 'Valor', alinhar: 'right' },
        { chave: 'situacao', titulo: 'Conversão', alinhar: 'center' },
      ],
      linhas: orcamentos.map((venda) => ({
        orcamento: venda.numeroOrcamento || venda.id,
        cliente: venda.clienteNome,
        vendedor: venda.vendedor,
        emissao: dataBr(venda.dataEmissao),
        valor: dinheiro(valorVenda(venda)),
        situacao: convertidos.includes(venda) ? 'Convertido' : venda.statusOrcamento || 'Aberto',
      })),
    }
  }

  if (id === 'margem') {
    const concluidos = pedidos.filter((venda) => {
      const status = normalizar(venda.statusPedido)
      return status === 'concluido' || status === 'entregue'
    })

    const calculados = concluidos.map((venda) => {
      let itensSemCusto = 0
      let itensComCusto = 0
      const custo = venda.itens.reduce((soma, item) => {
        const calculo = custoItemVenda(item, produtos)
        if (calculo.possuiCusto) itensComCusto += 1
        else itensSemCusto += 1
        return soma + calculo.custo
      }, 0)

      const receita = valorVenda(venda)
      const lucro = receita - custo
      const custoCompleto = itensSemCusto === 0
      const margemPercentual = custoCompleto && receita ? (lucro / receita) * 100 : null

      return {
        venda,
        custo,
        receita,
        lucro,
        margemPercentual,
        itensSemCusto,
        itensComCusto,
        custoCompleto,
      }
    })

    const custoTotal = calculados.reduce((soma, item) => soma + item.custo, 0)
    const receitaTotal = calculados.reduce((soma, item) => soma + item.receita, 0)
    const lucroTotal = receitaTotal - custoTotal
    const pedidosSemCusto = calculados.filter((item) => !item.custoCompleto).length
    const margemTotal = pedidosSemCusto === 0 && receitaTotal
      ? (lucroTotal / receitaTotal) * 100
      : null

    return {
      indicadores: [
        ['Pedidos concluídos/entregues', inteiro(concluidos.length)],
        ['Venda total', dinheiro(receitaTotal)],
        ['Custo identificado', dinheiro(custoTotal)],
        ['Lucro bruto calculado', dinheiro(lucroTotal)],
        ['Margem', margemTotal === null ? 'Incompleta' : percentual(margemTotal)],
        ['Pedidos com custo faltante', inteiro(pedidosSemCusto)],
      ],
      colunas: [
        { chave: 'pedido', titulo: 'Pedido' },
        { chave: 'cliente', titulo: 'Cliente' },
        { chave: 'status', titulo: 'Status', alinhar: 'center' },
        { chave: 'receita', titulo: 'Venda', alinhar: 'right' },
        { chave: 'custo', titulo: 'Custo dos produtos', alinhar: 'right' },
        { chave: 'lucro', titulo: 'Lucro bruto', alinhar: 'right' },
        { chave: 'margem', titulo: 'Margem %', alinhar: 'right' },
      ],
      linhas: calculados
        .sort((a, b) => numero(b.venda.numeroPedido) - numero(a.venda.numeroPedido))
        .map((item) => ({
          pedido: item.venda.numeroPedido || item.venda.id,
          cliente: item.venda.clienteNome,
          status: item.venda.statusPedido || '-',
          receita: dinheiro(item.receita),
          custo: item.custoCompleto ? dinheiro(item.custo) : `${dinheiro(item.custo)} (parcial)`,
          lucro: item.custoCompleto ? dinheiro(item.lucro) : 'Não conclusivo',
          margem: item.margemPercentual === null ? '-' : percentual(item.margemPercentual),
        })),
      observacao:
        pedidosSemCusto > 0
          ? 'A margem não é exibida como 100% quando faltam custos. Complete o custo dos produtos indicados para obter a lucratividade integral.'
          : 'O relatório prioriza o custo gravado no item do pedido e usa o custo atual do cadastro apenas como contingência.',
    }
  }

  return {
    indicadores: [
      ['Pedidos', inteiro(pedidos.length)],
      ['Faturamento', dinheiro(faturamento)],
      ['Clientes', inteiro(new Set(pedidos.map((venda) => normalizar(venda.clienteCodigo || venda.clienteDocumento || venda.clienteNome)).filter(Boolean)).size)],
      ['Ticket médio', dinheiro(pedidos.length ? faturamento / pedidos.length : 0)],
    ],
    colunas: [
      { chave: 'pedido', titulo: 'Pedido' },
      { chave: 'data', titulo: 'Emissão', alinhar: 'center' },
      { chave: 'cliente', titulo: 'Cliente' },
      { chave: 'vendedor', titulo: 'Vendedor' },
      { chave: 'status', titulo: 'Situação', alinhar: 'center' },
      { chave: 'total', titulo: 'Total', alinhar: 'right' },
    ],
    linhas: pedidos
      .sort((a, b) => dataVenda(b).localeCompare(dataVenda(a)))
      .map((venda) => ({
        pedido: venda.numeroPedido || venda.id,
        data: dataBr(venda.dataEmissao),
        cliente: venda.clienteNome,
        vendedor: venda.vendedor,
        status: venda.statusPedido || '-',
        total: dinheiro(valorVenda(venda)),
      })),
  }
}

function mapaVendasProdutos(vendas: Venda[]) {
  const pedidos = somentePedidos(vendas)
  const mapa = new Map<
    string,
    { codigo: string; descricao: string; quantidade: number; faturamento: number; clientes: Set<string>; pedidos: Set<string>; precos: number[] }
  >()
  pedidos.forEach((venda) => {
    venda.itens.forEach((item) => {
      const chave = normalizar(item.codigoProduto || item.codigoBarras || item.descricao)
      const atual = mapa.get(chave) || {
        codigo: item.codigoProduto,
        descricao: item.descricao,
        quantidade: 0,
        faturamento: 0,
        clientes: new Set<string>(),
        pedidos: new Set<string>(),
        precos: [],
      }
      atual.quantidade += numero(item.quantidade)
      atual.faturamento += numero(item.valorTotal)
      atual.clientes.add(venda.clienteNome)
      atual.pedidos.add(venda.id)
      atual.precos.push(numero(item.valorUnitario))
      mapa.set(chave, atual)
    })
  })
  return mapa
}

function gerarCompras(id: string, compras: Compra[]): ResultadoRelatorio {
  const valorTotal = compras.reduce((soma, compra) => soma + numero(compra.totalFinal), 0)
  const abertas = compras.filter((compra) => !['recebido', 'cancelado'].includes(normalizar(compra.status)))

  if (id === 'aberto') {
    return {
      indicadores: [
        ['Compras em aberto', inteiro(abertas.length)],
        ['Valor em aberto', dinheiro(abertas.reduce((s, compra) => s + numero(compra.totalFinal), 0))],
        ['Fornecedores', inteiro(new Set(abertas.map((compra) => compra.fornecedorNome).filter(Boolean)).size)],
        ['Total de compras', inteiro(compras.length)],
      ],
      colunas: [
        { chave: 'compra', titulo: 'Compra' },
        { chave: 'emissao', titulo: 'Emissão', alinhar: 'center' },
        { chave: 'fornecedor', titulo: 'Fornecedor' },
        { chave: 'previsao', titulo: 'Previsão', alinhar: 'center' },
        { chave: 'status', titulo: 'Situação', alinhar: 'center' },
        { chave: 'total', titulo: 'Total', alinhar: 'right' },
      ],
      linhas: abertas.map((compra) => ({
        compra: compra.numeroCompra,
        emissao: dataBr(compra.dataEmissao),
        fornecedor: compra.fornecedorNome,
        previsao: dataBr(compra.previsaoEntrega),
        status: compra.status,
        total: dinheiro(numero(compra.totalFinal)),
      })),
    }
  }

  if (id === 'fornecedor') {
    const grupos = agrupar(compras, (compra) => compra.fornecedorNome || 'Fornecedor não informado')
    const linhas = Array.from(grupos.entries()).map(([fornecedor, lista]) => {
      const total = lista.reduce((s, compra) => s + numero(compra.totalFinal), 0)
      return {
        fornecedor,
        compras: lista.length,
        itens: lista.reduce((s, compra) => s + compra.itens.length, 0),
        total: dinheiro(total),
        medio: dinheiro(lista.length ? total / lista.length : 0),
        _total: total,
      }
    }).sort((a, b) => b._total - a._total).map(({ _total, ...linha }) => linha)
    return {
      indicadores: [
        ['Fornecedores', inteiro(grupos.size)],
        ['Compras', inteiro(compras.length)],
        ['Valor comprado', dinheiro(valorTotal)],
        ['Ticket médio', dinheiro(compras.length ? valorTotal / compras.length : 0)],
      ],
      colunas: [
        { chave: 'fornecedor', titulo: 'Fornecedor' },
        { chave: 'compras', titulo: 'Compras', alinhar: 'right' },
        { chave: 'itens', titulo: 'Itens', alinhar: 'right' },
        { chave: 'total', titulo: 'Valor comprado', alinhar: 'right' },
        { chave: 'medio', titulo: 'Ticket médio', alinhar: 'right' },
      ],
      linhas,
    }
  }

  if (id === 'custos') {
    const linhas = compras.flatMap((compra) => compra.itens.map((item) => ({
      compra: compra.numeroCompra,
      fornecedor: compra.fornecedorNome,
      produto: item.descricao,
      quantidade: decimal(numero(item.quantidade)),
      custo: dinheiro(numero(item.custoUnitario)),
      total: dinheiro(numero(item.total)),
      data: dataBr(compra.dataEmissao),
    })))
    return {
      indicadores: [
        ['Itens comprados', inteiro(linhas.length)],
        ['Compras', inteiro(compras.length)],
        ['Valor comprado', dinheiro(valorTotal)],
        ['Fornecedores', inteiro(new Set(compras.map((compra) => compra.fornecedorNome).filter(Boolean)).size)],
      ],
      colunas: [
        { chave: 'data', titulo: 'Data', alinhar: 'center' },
        { chave: 'compra', titulo: 'Compra' },
        { chave: 'fornecedor', titulo: 'Fornecedor' },
        { chave: 'produto', titulo: 'Produto' },
        { chave: 'quantidade', titulo: 'Quantidade', alinhar: 'right' },
        { chave: 'custo', titulo: 'Custo unitário', alinhar: 'right' },
        { chave: 'total', titulo: 'Total', alinhar: 'right' },
      ],
      linhas,
    }
  }

  if (id === 'recebimentos') {
    const recebidas = compras.filter((compra) => normalizar(compra.status).includes('recebido'))
    return {
      indicadores: [
        ['Compras', inteiro(compras.length)],
        ['Recebidas', inteiro(recebidas.length)],
        ['Em aberto', inteiro(abertas.length)],
        ['Taxa de recebimento', percentual(compras.length ? (recebidas.length / compras.length) * 100 : 0)],
      ],
      colunas: [
        { chave: 'compra', titulo: 'Compra' },
        { chave: 'fornecedor', titulo: 'Fornecedor' },
        { chave: 'emissao', titulo: 'Emissão', alinhar: 'center' },
        { chave: 'previsao', titulo: 'Previsão', alinhar: 'center' },
        { chave: 'nfe', titulo: 'NF-e' },
        { chave: 'status', titulo: 'Situação', alinhar: 'center' },
        { chave: 'total', titulo: 'Total', alinhar: 'right' },
      ],
      linhas: compras.map((compra) => ({
        compra: compra.numeroCompra,
        fornecedor: compra.fornecedorNome,
        emissao: dataBr(compra.dataEmissao),
        previsao: dataBr(compra.previsaoEntrega),
        nfe: compra.numeroNFe || '-',
        status: compra.status,
        total: dinheiro(numero(compra.totalFinal)),
      })),
    }
  }

  return {
    indicadores: [
      ['Compras', inteiro(compras.length)],
      ['Valor comprado', dinheiro(valorTotal)],
      ['Fornecedores', inteiro(new Set(compras.map((compra) => compra.fornecedorNome).filter(Boolean)).size)],
      ['Com NF-e', inteiro(compras.filter((compra) => texto(compra.numeroNFe)).length)],
    ],
    colunas: [
      { chave: 'compra', titulo: 'Compra' },
      { chave: 'emissao', titulo: 'Emissão', alinhar: 'center' },
      { chave: 'fornecedor', titulo: 'Fornecedor' },
      { chave: 'itens', titulo: 'Itens', alinhar: 'right' },
      { chave: 'status', titulo: 'Situação', alinhar: 'center' },
      { chave: 'nfe', titulo: 'NF-e' },
      { chave: 'total', titulo: 'Total', alinhar: 'right' },
    ],
    linhas: compras.map((compra) => ({
      compra: compra.numeroCompra,
      emissao: dataBr(compra.dataEmissao),
      fornecedor: compra.fornecedorNome,
      itens: compra.itens.length,
      status: compra.status,
      nfe: compra.numeroNFe || '-',
      total: dinheiro(numero(compra.totalFinal)),
    })),
  }
}

function gerarProdutos(id: string, vendas: Venda[], produtos: Produto[]): ResultadoRelatorio {
  const mapaVendas = mapaVendasProdutos(vendas)
  const mapaCadastro = new Map(produtos.map((produto) => [produto.codigo, produto]))
  const faturamento = Array.from(mapaVendas.values()).reduce((s, item) => s + item.faturamento, 0)

  if (id === 'abc') {
    const curva = calcularCurvaABC(Array.from(mapaVendas.values()), (item) => item.faturamento)
    return {
      indicadores: [
        ['Produtos vendidos', inteiro(curva.length)],
        ['Classe A', inteiro(curva.filter((item) => item.classeABC === 'A').length)],
        ['Classe B', inteiro(curva.filter((item) => item.classeABC === 'B').length)],
        ['Classe C', inteiro(curva.filter((item) => item.classeABC === 'C').length)],
        ['Faturamento', dinheiro(faturamento)],
      ],
      colunas: [
        { chave: 'classe', titulo: 'Classe', alinhar: 'center' },
        { chave: 'produto', titulo: 'Produto' },
        { chave: 'quantidade', titulo: 'Qtd. vendida', alinhar: 'right' },
        { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right' },
        { chave: 'participacao', titulo: 'Participação', alinhar: 'right' },
        { chave: 'acumulado', titulo: 'Acumulado', alinhar: 'right' },
      ],
      linhas: curva.map((item) => ({
        classe: item.classeABC,
        produto: item.descricao,
        quantidade: decimal(item.quantidade),
        faturamento: dinheiro(item.faturamento),
        participacao: percentual(item.participacao),
        acumulado: percentual(item.acumulado),
      })),
    }
  }

  if (id === 'lucratividade') {
    const calculados = Array.from(mapaVendas.values()).map((item) => {
      const produto = mapaCadastro.get(item.codigo)
      const custoUnitario = obterCustoProduto(produto)
      const custo = custoUnitario * item.quantidade
      const lucro = item.faturamento - custo
      const margem = item.faturamento ? (lucro / item.faturamento) * 100 : 0
      return { ...item, custoUnitario, custo, lucro, margem }
    })
    const lucroTotal = calculados.reduce((s, item) => s + item.lucro, 0)
    const custoTotal = calculados.reduce((s, item) => s + item.custo, 0)
    return {
      indicadores: [
        ['Produtos', inteiro(calculados.length)],
        ['Receita', dinheiro(faturamento)],
        ['Custo estimado', dinheiro(custoTotal)],
        ['Lucro bruto estimado', dinheiro(lucroTotal)],
        ['Margem estimada', percentual(faturamento ? (lucroTotal / faturamento) * 100 : 0)],
      ],
      colunas: [
        { chave: 'produto', titulo: 'Produto' },
        { chave: 'quantidade', titulo: 'Qtd.', alinhar: 'right' },
        { chave: 'custo', titulo: 'Custo médio', alinhar: 'right' },
        { chave: 'receita', titulo: 'Receita', alinhar: 'right' },
        { chave: 'lucro', titulo: 'Lucro bruto', alinhar: 'right' },
        { chave: 'margem', titulo: 'Margem %', alinhar: 'right' },
      ],
      linhas: calculados
        .sort((a, b) => b.lucro - a.lucro)
        .map((item) => ({
          produto: item.descricao,
          quantidade: decimal(item.quantidade),
          custo: dinheiro(item.custoUnitario),
          receita: dinheiro(item.faturamento),
          lucro: dinheiro(item.lucro),
          margem: percentual(item.margem),
        })),
      observacao: 'Lucratividade estimada pelo custo médio atual do produto.',
    }
  }

  if (id === 'mais-vendidos') {
    const itens = Array.from(mapaVendas.values()).sort((a, b) => b.quantidade - a.quantidade)
    return {
      indicadores: [
        ['Produtos vendidos', inteiro(itens.length)],
        ['Unidades vendidas', decimal(itens.reduce((s, item) => s + item.quantidade, 0))],
        ['Faturamento', dinheiro(faturamento)],
        ['Líder em quantidade', itens[0]?.descricao || '-'],
      ],
      colunas: [
        { chave: 'posicao', titulo: '#', alinhar: 'center' },
        { chave: 'produto', titulo: 'Produto' },
        { chave: 'quantidade', titulo: 'Quantidade', alinhar: 'right' },
        { chave: 'pedidos', titulo: 'Pedidos', alinhar: 'right' },
        { chave: 'clientes', titulo: 'Clientes', alinhar: 'right' },
        { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right' },
      ],
      linhas: itens.map((item, index) => ({
        posicao: index + 1,
        produto: item.descricao,
        quantidade: decimal(item.quantidade),
        pedidos: item.pedidos.size,
        clientes: item.clientes.size,
        faturamento: dinheiro(item.faturamento),
      })),
    }
  }

  if (id === 'sem-venda') {
    const vendidos = new Set(Array.from(mapaVendas.values()).map((item) => item.codigo))
    const semVenda = produtos.filter((produto) => !vendidos.has(produto.codigo))
    return {
      indicadores: [
        ['Produtos cadastrados', inteiro(produtos.length)],
        ['Sem venda no período', inteiro(semVenda.length)],
        ['Com venda', inteiro(produtos.length - semVenda.length)],
        ['Percentual sem venda', percentual(produtos.length ? (semVenda.length / produtos.length) * 100 : 0)],
      ],
      colunas: [
        { chave: 'codigo', titulo: 'Código' },
        { chave: 'produto', titulo: 'Produto' },
        { chave: 'categoria', titulo: 'Categoria' },
        { chave: 'marca', titulo: 'Marca' },
        { chave: 'estoque', titulo: 'Estoque', alinhar: 'right' },
        { chave: 'situacao', titulo: 'Situação', alinhar: 'center' },
      ],
      linhas: semVenda.map((produto) => ({
        codigo: produto.codigo,
        produto: produto.descricao,
        categoria: produto.categoria || '-',
        marca: produto.marca || '-',
        estoque: decimal(obterEstoqueProduto(produto)),
        situacao: produto.situacao || 'Ativo',
      })),
    }
  }

  if (id === 'item-cliente') {
    const linhas: LinhaRelatorio[] = []
    somentePedidos(vendas).forEach((venda) => {
      venda.itens.forEach((item) => {
        linhas.push({
          cliente: venda.clienteNome,
          produto: item.descricao,
          pedido: venda.numeroPedido || venda.id,
          data: dataBr(venda.dataEmissao),
          quantidade: decimal(numero(item.quantidade)),
          valor: dinheiro(numero(item.valorTotal)),
        })
      })
    })
    return {
      indicadores: [
        ['Relações cliente/item', inteiro(linhas.length)],
        ['Clientes', inteiro(new Set(linhas.map((linha) => texto(linha.cliente))).size)],
        ['Produtos', inteiro(new Set(linhas.map((linha) => texto(linha.produto))).size)],
        ['Faturamento', dinheiro(faturamento)],
      ],
      colunas: [
        { chave: 'cliente', titulo: 'Cliente' },
        { chave: 'produto', titulo: 'Produto' },
        { chave: 'pedido', titulo: 'Pedido' },
        { chave: 'data', titulo: 'Data', alinhar: 'center' },
        { chave: 'quantidade', titulo: 'Quantidade', alinhar: 'right' },
        { chave: 'valor', titulo: 'Valor', alinhar: 'right' },
      ],
      linhas,
    }
  }

  if (id === 'custos') {
    const linhas = produtos.flatMap((produto) =>
      (produto.historicoCustos || []).map((historico) => ({
        produto: produto.descricao,
        data: dataBr(historico.dataEntrada || historico.data || historico.criadoEm),
        compra: historico.numeroNFe || historico.numeroCompra || '-',
        anterior: dinheiro(numero(historico.custoMedioAnterior ?? historico.custoAnterior)),
        compraValor: dinheiro(numero(historico.custoCompra)),
        novo: dinheiro(numero(historico.custoMedioNovo ?? historico.custoNovo)),
        variacao: percentual(numero(historico.variacaoPercentual)),
      })),
    )
    return {
      indicadores: [
        ['Movimentos de custo', inteiro(linhas.length)],
        ['Produtos com histórico', inteiro(produtos.filter((produto) => (produto.historicoCustos || []).length > 0).length)],
        ['Produtos cadastrados', inteiro(produtos.length)],
      ],
      colunas: [
        { chave: 'produto', titulo: 'Produto' },
        { chave: 'data', titulo: 'Data', alinhar: 'center' },
        { chave: 'compra', titulo: 'Compra / NF-e' },
        { chave: 'anterior', titulo: 'Custo anterior', alinhar: 'right' },
        { chave: 'novo', titulo: 'Novo custo', alinhar: 'right' },
        { chave: 'variacao', titulo: 'Variação', alinhar: 'right' },
      ],
      linhas,
    }
  }

  const linhas = produtos.map((produto) => {
    const venda = mapaVendas.get(produto.codigo)
    const precoMedio = venda?.precos.length
      ? venda.precos.reduce((s, preco) => s + preco, 0) / venda.precos.length
      : 0
    return {
      codigo: produto.codigo,
      produto: produto.descricao,
      varejo: dinheiro(numero(produto.vendaVarejo ?? produto.precoVenda ?? produto.preco)),
      atacado: dinheiro(numero(produto.vendaAtacado)),
      medio: dinheiro(precoMedio),
      menor: dinheiro(venda?.precos.length ? Math.min(...venda.precos) : 0),
      maior: dinheiro(venda?.precos.length ? Math.max(...venda.precos) : 0),
    }
  })
  return {
    indicadores: [
      ['Produtos', inteiro(produtos.length)],
      ['Com vendas', inteiro(mapaVendas.size)],
      ['Faturamento', dinheiro(faturamento)],
    ],
    colunas: [
      { chave: 'codigo', titulo: 'Código' },
      { chave: 'produto', titulo: 'Produto' },
      { chave: 'varejo', titulo: 'Varejo atual', alinhar: 'right' },
      { chave: 'atacado', titulo: 'Atacado atual', alinhar: 'right' },
      { chave: 'medio', titulo: 'Preço médio vendido', alinhar: 'right' },
      { chave: 'menor', titulo: 'Menor vendido', alinhar: 'right' },
      { chave: 'maior', titulo: 'Maior vendido', alinhar: 'right' },
    ],
    linhas,
  }
}

function gerarEstoque(
  id: string,
  produtos: Produto[],
  movimentacoes: EstoqueMovimentacao[],
  vendas: Venda[],
): ResultadoRelatorio {
  const totalValor = produtos.reduce(
    (s, produto) => s + obterEstoqueProduto(produto) * obterCustoProduto(produto),
    0,
  )

  if (id === 'kardex') {
    const entradas = movimentacoes.filter((item) => item.tipo === 'entrada').reduce((s, item) => s + numero(item.quantidade), 0)
    const saidas = movimentacoes.filter((item) => item.tipo === 'saida').reduce((s, item) => s + numero(item.quantidade), 0)
    return {
      indicadores: [
        ['Movimentações', inteiro(movimentacoes.length)],
        ['Entradas', decimal(entradas)],
        ['Saídas', decimal(saidas)],
        ['Ajustes', inteiro(movimentacoes.filter((item) => item.tipo === 'ajuste').length)],
      ],
      colunas: [
        { chave: 'data', titulo: 'Data', alinhar: 'center' },
        { chave: 'produto', titulo: 'Produto' },
        { chave: 'tipo', titulo: 'Movimento', alinhar: 'center' },
        { chave: 'origem', titulo: 'Origem' },
        { chave: 'documento', titulo: 'Documento' },
        { chave: 'quantidade', titulo: 'Quantidade', alinhar: 'right' },
        { chave: 'anterior', titulo: 'Saldo\nanterior', alinhar: 'right' },
        { chave: 'atual', titulo: 'Saldo\natual', alinhar: 'right' },
      ],
      linhas: [...movimentacoes]
        .sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`))
        .map((item) => ({
          data: `${dataBr(item.data)} ${item.hora || ''}`.trim(),
          produto: item.produtoDescricao,
          tipo: item.tipo === 'entrada' ? 'Entrada' : item.tipo === 'saida' ? 'Saída' : 'Ajuste',
          origem: item.origem,
          documento: item.documentoOrigem || '-',
          quantidade: decimal(numero(item.quantidade)),
          anterior: item.estoqueAnterior == null ? '-' : decimal(numero(item.estoqueAnterior)),
          atual: item.estoqueAtual == null ? '-' : decimal(numero(item.estoqueAtual)),
        })),
    }
  }

  if (id === 'baixo' || id === 'negativo') {
    const lista = produtos.filter((produto) => {
      const saldo = obterEstoqueProduto(produto)
      return id === 'negativo' ? saldo < 0 : saldo <= numero(produto.estoqueMinimo)
    })
    return {
      indicadores: [
        [id === 'negativo' ? 'Produtos negativos' : 'Produtos com estoque baixo', inteiro(lista.length)],
        ['Produtos cadastrados', inteiro(produtos.length)],
        ['Valor do estoque', dinheiro(totalValor)],
        ['Percentual afetado', percentual(produtos.length ? (lista.length / produtos.length) * 100 : 0)],
      ],
      colunas: [
        { chave: 'codigo', titulo: 'Código' },
        { chave: 'produto', titulo: 'Produto' },
        { chave: 'categoria', titulo: 'Categoria' },
        { chave: 'estoque', titulo: 'Estoque\natual', alinhar: 'right' },
        { chave: 'minimo', titulo: 'Estoque\nmínimo', alinhar: 'right' },
        { chave: 'diferenca', titulo: 'Diferença', alinhar: 'right' },
      ],
      linhas: lista
        .sort((a, b) => obterEstoqueProduto(a) - obterEstoqueProduto(b))
        .map((produto) => ({
          codigo: produto.codigo,
          produto: produto.descricao,
          categoria: produto.categoria || '-',
          estoque: decimal(obterEstoqueProduto(produto)),
          minimo: decimal(numero(produto.estoqueMinimo)),
          diferenca: decimal(obterEstoqueProduto(produto) - numero(produto.estoqueMinimo)),
        })),
    }
  }

  if (id === 'perdas') {
    const palavras = ['perda', 'avaria', 'avariado', 'vencido', 'vencimento', 'quebra', 'danificado']
    const perdas = movimentacoes.filter((item) => {
      const base = normalizar(`${item.motivo} ${item.observacao}`)
      return palavras.some((palavra) => base.includes(palavra))
    })
    const quantidade = perdas.reduce((s, item) => s + numero(item.quantidade), 0)
    return {
      indicadores: [
        ['Ocorrências', inteiro(perdas.length)],
        ['Quantidade afetada', decimal(quantidade)],
        ['Produtos afetados', inteiro(new Set(perdas.map((item) => item.produtoCodigo)).size)],
      ],
      colunas: [
        { chave: 'data', titulo: 'Data', alinhar: 'center' },
        { chave: 'produto', titulo: 'Produto' },
        { chave: 'motivo', titulo: 'Motivo' },
        { chave: 'quantidade', titulo: 'Quantidade', alinhar: 'right' },
        { chave: 'usuario', titulo: 'Usuário' },
        { chave: 'observacao', titulo: 'Observação' },
      ],
      linhas: perdas.map((item) => ({
        data: dataBr(item.data),
        produto: item.produtoDescricao,
        motivo: item.motivo,
        quantidade: decimal(numero(item.quantidade)),
        usuario: item.usuario || '-',
        observacao: item.observacao || '-',
      })),
    }
  }

  if (id === 'abc') {
    const base = produtos.map((produto) => ({
      produto,
      valor: obterEstoqueProduto(produto) * obterCustoProduto(produto),
    }))
    const curva = calcularCurvaABC(base, (item) => item.valor)
    return {
      indicadores: [
        ['Produtos', inteiro(produtos.length)],
        ['Classe A', inteiro(curva.filter((item) => item.classeABC === 'A').length)],
        ['Classe B', inteiro(curva.filter((item) => item.classeABC === 'B').length)],
        ['Classe C', inteiro(curva.filter((item) => item.classeABC === 'C').length)],
        ['Valor do estoque', dinheiro(totalValor)],
      ],
      colunas: [
        { chave: 'classe', titulo: 'Classe', alinhar: 'center' },
        { chave: 'produto', titulo: 'Produto' },
        { chave: 'estoque', titulo: 'Estoque', alinhar: 'right' },
        { chave: 'custo', titulo: 'Custo médio', alinhar: 'right' },
        { chave: 'valor', titulo: 'Valor estoque', alinhar: 'right' },
        { chave: 'participacao', titulo: 'Participação', alinhar: 'right' },
      ],
      linhas: curva.map((item) => ({
        classe: item.classeABC,
        produto: item.produto.descricao,
        estoque: decimal(obterEstoqueProduto(item.produto)),
        custo: dinheiro(obterCustoProduto(item.produto)),
        valor: dinheiro(item.valor),
        participacao: percentual(item.participacao),
      })),
    }
  }

  if (id === 'giro' || id === 'cobertura') {
    const vendasProdutos = mapaVendasProdutos(vendas)
    const pedidos = somentePedidos(vendas)
    const datas = pedidos.map(dataVenda).filter(Boolean).sort()
    const diasPeriodo = datas.length > 1 ? Math.max(1, diasEntre(datas[0], datas[datas.length - 1])) : 30
    const linhas = produtos.map((produto) => {
      const saldo = obterEstoqueProduto(produto)
      const quantidadeVendida = numero(vendasProdutos.get(produto.codigo)?.quantidade)
      const vendaDia = quantidadeVendida / diasPeriodo
      const cobertura = vendaDia > 0 ? saldo / vendaDia : 0
      const estoqueMedioEstimado = Math.max((saldo + saldo + quantidadeVendida) / 2, 0)
      const giro = estoqueMedioEstimado > 0 ? quantidadeVendida / estoqueMedioEstimado : 0
      return { produto, saldo, quantidadeVendida, vendaDia, cobertura, giro }
    })
    return {
      indicadores: [
        ['Produtos analisados', inteiro(produtos.length)],
        ['Período de vendas', `${diasPeriodo} dias`],
        ['Sem giro', inteiro(linhas.filter((item) => item.quantidadeVendida === 0).length)],
        ['Cobertura até 30 dias', inteiro(linhas.filter((item) => item.cobertura > 0 && item.cobertura <= 30).length)],
      ],
      colunas: id === 'giro'
        ? [
            { chave: 'produto', titulo: 'Produto' },
            { chave: 'estoque', titulo: 'Estoque atual', alinhar: 'right' },
            { chave: 'saidas', titulo: 'Qtd. vendida', alinhar: 'right' },
            { chave: 'giro', titulo: 'Giro estimado', alinhar: 'right' },
            { chave: 'situacao', titulo: 'Situação', alinhar: 'center' },
          ]
        : [
            { chave: 'produto', titulo: 'Produto' },
            { chave: 'estoque', titulo: 'Estoque atual', alinhar: 'right' },
            { chave: 'vendadia', titulo: 'Venda média/dia', alinhar: 'right' },
            { chave: 'dias', titulo: 'Cobertura', alinhar: 'right' },
            { chave: 'situacao', titulo: 'Situação', alinhar: 'center' },
          ],
      linhas: linhas
        .sort((a, b) => (id === 'giro' ? b.giro - a.giro : a.cobertura - b.cobertura))
        .map((item): LinhaRelatorio =>
          id === 'giro'
            ? {
                produto: item.produto.descricao,
                estoque: decimal(item.saldo),
                saidas: decimal(item.quantidadeVendida),
                giro: decimal(item.giro),
                situacao: item.quantidadeVendida === 0 ? 'Sem giro' : item.giro < 0.5 ? 'Baixo giro' : 'Com giro',
              }
            : {
                produto: item.produto.descricao,
                estoque: decimal(item.saldo),
                vendadia: decimal(item.vendaDia),
                dias: item.vendaDia > 0 ? `${Math.max(0, Math.round(item.cobertura))} dias` : '-',
                situacao: item.vendaDia === 0 ? 'Sem venda' : item.cobertura <= 15 ? 'Atenção' : item.cobertura <= 30 ? 'Baixa cobertura' : 'Cobertura adequada',
              },
        ),
      observacao:
        'Giro e cobertura são estimativas baseadas nas vendas registradas no período e no saldo atual do produto.',
    }
  }

  const gruposCategoria = new Map<string, { produtos: number; quantidade: number; valor: number }>()
  produtos.forEach((produto) => {
    const categoria = produto.categoria || 'Sem categoria'
    const atual = gruposCategoria.get(categoria) || { produtos: 0, quantidade: 0, valor: 0 }
    atual.produtos += 1
    atual.quantidade += obterEstoqueProduto(produto)
    atual.valor += obterEstoqueProduto(produto) * obterCustoProduto(produto)
    gruposCategoria.set(categoria, atual)
  })
  return {
    indicadores: [
      ['Valor total do estoque', dinheiro(totalValor)],
      ['Produtos', inteiro(produtos.length)],
      ['Categorias', inteiro(gruposCategoria.size)],
      ['Unidades em estoque', decimal(produtos.reduce((s, produto) => s + obterEstoqueProduto(produto), 0))],
    ],
    colunas: [
      { chave: 'categoria', titulo: 'Categoria' },
      { chave: 'produtos', titulo: 'Produtos', alinhar: 'right' },
      { chave: 'quantidade', titulo: 'Quantidade', alinhar: 'right' },
      { chave: 'valor', titulo: 'Valor do estoque', alinhar: 'right' },
      { chave: 'participacao', titulo: 'Participação', alinhar: 'right' },
    ],
    linhas: Array.from(gruposCategoria.entries())
      .map(([categoria, dados]) => ({
        categoria,
        produtos: dados.produtos,
        quantidade: decimal(dados.quantidade),
        valor: dinheiro(dados.valor),
        participacao: percentual(totalValor ? (dados.valor / totalValor) * 100 : 0),
        _valor: dados.valor,
      }))
      .sort((a, b) => b._valor - a._valor)
      .map(({ _valor, ...linha }) => linha),
  }
}

function gerarClientes(id: string, clientes: Cliente[], vendas: Venda[]): ResultadoRelatorio {
  const pedidos = somentePedidos(vendas)
  const hoje = hojeIso()

  function dadosCliente(cliente: Cliente) {
    const cadastro = cliente as Cliente & Record<string, unknown>
    const identificadoresCliente = new Set(
      [
        cadastro.id,
        cadastro.codigo,
        cadastro.cpfCnpj,
        cadastro.cnpjCpf,
        cadastro.cnpj,
        cadastro.documento,
        cadastro.razaoSocial,
        cadastro.nomeRazaoSocial,
        cadastro.nomeFantasia,
        cadastro.nome,
      ]
        .map((valor) => normalizar(valor))
        .filter(Boolean),
    )
    const lista = pedidos.filter((venda) => {
      const pedido = venda as Venda & Record<string, unknown>
      return [
        pedido.clienteId,
        pedido.clienteCodigo,
        pedido.clienteDocumento,
        pedido.cpfCnpj,
        pedido.cnpjCpf,
        pedido.clienteNome,
        pedido.cliente,
      ]
        .map((valor) => normalizar(valor))
        .filter(Boolean)
        .some((valor) => identificadoresCliente.has(valor))
    })
    const ordenadas = [...lista].sort((a, b) => dataVenda(a).localeCompare(dataVenda(b)))
    const faturamento = lista.reduce((s, venda) => s + valorVenda(venda), 0)
    const ultimaData = ordenadas.length ? dataVenda(ordenadas[ordenadas.length - 1]) : ''
    const intervalos = ordenadas.slice(1).map((venda, index) => diasEntre(dataVenda(ordenadas[index]), dataVenda(venda)))
    const intervaloMedio = intervalos.length ? intervalos.reduce((s, valor) => s + valor, 0) / intervalos.length : 0
    return { lista, faturamento, ultimaData, intervaloMedio }
  }

  if (id === 'abc' || id === 'ranking') {
    const base = clientes.map((cliente) => ({ cliente, ...dadosCliente(cliente) }))
    const curva = calcularCurvaABC(base, (item) => item.faturamento)
    return {
      indicadores: [
        ['Clientes', inteiro(clientes.length)],
        ['Classe A', inteiro(curva.filter((item) => item.classeABC === 'A').length)],
        ['Classe B', inteiro(curva.filter((item) => item.classeABC === 'B').length)],
        ['Classe C', inteiro(curva.filter((item) => item.classeABC === 'C').length)],
        ['Faturamento', dinheiro(curva.reduce((s, item) => s + item.faturamento, 0))],
      ],
      colunas: [
        { chave: 'posicao', titulo: '#', alinhar: 'center' },
        ...(id === 'abc' ? [{ chave: 'classe', titulo: 'Classe', alinhar: 'center' as const }] : []),
        { chave: 'cliente', titulo: 'Cliente' },
        { chave: 'pedidos', titulo: 'Pedidos', alinhar: 'right' },
        { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right' },
        { chave: 'ticket', titulo: 'Ticket médio', alinhar: 'right' },
        { chave: 'participacao', titulo: 'Participação', alinhar: 'right' },
      ],
      linhas: curva.map((item, index) => ({
        posicao: index + 1,
        classe: item.classeABC,
        cliente: item.cliente.razaoSocial,
        pedidos: item.lista.length,
        faturamento: dinheiro(item.faturamento),
        ticket: dinheiro(item.lista.length ? item.faturamento / item.lista.length : 0),
        participacao: percentual(item.participacao),
      })),
    }
  }

  if (id === 'inativos') {
    const inativos = clientes.filter(
      (cliente) => cliente.bloqueado || normalizar(cliente.situacao).includes('inativ'),
    )
    return {
      indicadores: [
        ['Clientes inativos', inteiro(inativos.length)],
        ['Bloqueados', inteiro(inativos.filter((cliente) => cliente.bloqueado).length)],
        ['Base total', inteiro(clientes.length)],
        ['Percentual inativo', percentual(clientes.length ? (inativos.length / clientes.length) * 100 : 0)],
      ],
      colunas: [
        { chave: 'codigo', titulo: 'Código' },
        { chave: 'cliente', titulo: 'Cliente' },
        { chave: 'cidade', titulo: 'Cidade' },
        { chave: 'telefone', titulo: 'Telefone' },
        { chave: 'email', titulo: 'E-mail' },
        { chave: 'situacao', titulo: 'Situação', alinhar: 'center' },
      ],
      linhas: inativos.map((cliente) => ({
        codigo: cliente.codigo,
        cliente: cliente.razaoSocial,
        cidade: cliente.cidade || '-',
        telefone: cliente.celular || cliente.telefone || '-',
        email: cliente.email || '-',
        situacao: cliente.bloqueado ? 'Bloqueado' : cliente.situacao,
      })),
    }
  }

  if (id === 'sem-comprar' || id === 'ultima-compra') {
    const lista = clientes.map((cliente) => ({ cliente, ...dadosCliente(cliente) }))
    const semComprar = id === 'sem-comprar'
      ? lista.filter((item) => !item.ultimaData || diasEntre(item.ultimaData, hoje) >= 30)
      : lista
    return {
      indicadores: [
        ['Clientes analisados', inteiro(clientes.length)],
        ['Sem compra há 30+ dias', inteiro(lista.filter((item) => !item.ultimaData || diasEntre(item.ultimaData, hoje) >= 30).length)],
        ['Sem nenhuma compra', inteiro(lista.filter((item) => !item.ultimaData).length)],
        ['Compraram nos últimos 30 dias', inteiro(lista.filter((item) => item.ultimaData && diasEntre(item.ultimaData, hoje) < 30).length)],
      ],
      colunas: [
        { chave: 'cliente', titulo: 'Cliente' },
        { chave: 'ultima', titulo: 'Última compra', alinhar: 'center' },
        { chave: 'dias', titulo: 'Dias sem comprar', alinhar: 'right' },
        { chave: 'pedidos', titulo: 'Pedidos', alinhar: 'right' },
        { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right' },
        { chave: 'contato', titulo: 'Contato' },
      ],
      linhas: semComprar
        .sort((a, b) => (a.ultimaData || '').localeCompare(b.ultimaData || ''))
        .map((item) => ({
          cliente: item.cliente.razaoSocial,
          ultima: item.ultimaData ? dataBr(item.ultimaData) : 'Nunca comprou',
          dias: item.ultimaData ? diasEntre(item.ultimaData, hoje) : '-',
          pedidos: item.lista.length,
          faturamento: dinheiro(item.faturamento),
          contato: item.cliente.celularWhatsapp || item.cliente.celular || item.cliente.telefone || item.cliente.email || '-',
        })),
    }
  }

  if (id === 'frequencia') {
    const lista = clientes.map((cliente) => ({ cliente, ...dadosCliente(cliente) }))
    return {
      indicadores: [
        ['Clientes compradores', inteiro(lista.filter((item) => item.lista.length > 0).length)],
        ['Pedidos', inteiro(pedidos.length)],
        ['Clientes recorrentes', inteiro(lista.filter((item) => item.lista.length > 1).length)],
        ['Compra única', inteiro(lista.filter((item) => item.lista.length === 1).length)],
      ],
      colunas: [
        { chave: 'cliente', titulo: 'Cliente' },
        { chave: 'pedidos', titulo: 'Pedidos', alinhar: 'right' },
        { chave: 'intervalo', titulo: 'Intervalo médio', alinhar: 'right' },
        { chave: 'ultima', titulo: 'Última compra', alinhar: 'center' },
        { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right' },
        { chave: 'perfil', titulo: 'Frequência', alinhar: 'center' },
      ],
      linhas: lista
        .sort((a, b) => b.lista.length - a.lista.length)
        .map((item) => ({
          cliente: item.cliente.razaoSocial,
          pedidos: item.lista.length,
          intervalo: item.lista.length > 1 ? `${Math.round(item.intervaloMedio)} dias` : '-',
          ultima: item.ultimaData ? dataBr(item.ultimaData) : '-',
          faturamento: dinheiro(item.faturamento),
          perfil: item.lista.length >= 4 ? 'Recorrente' : item.lista.length >= 2 ? 'Recompra' : item.lista.length === 1 ? 'Compra única' : 'Sem compra',
        })),
    }
  }

  if (id === 'ticket') {
    const lista = clientes.map((cliente) => ({ cliente, ...dadosCliente(cliente) }))
    const compradores = lista.filter((item) => item.lista.length > 0)
    return {
      indicadores: [
        ['Clientes compradores', inteiro(compradores.length)],
        ['Pedidos', inteiro(pedidos.length)],
        ['Faturamento', dinheiro(pedidos.reduce((s, venda) => s + valorVenda(venda), 0))],
        ['Ticket médio geral', dinheiro(pedidos.length ? pedidos.reduce((s, venda) => s + valorVenda(venda), 0) / pedidos.length : 0)],
      ],
      colunas: [
        { chave: 'cliente', titulo: 'Cliente' },
        { chave: 'pedidos', titulo: 'Pedidos', alinhar: 'right' },
        { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right' },
        { chave: 'ticket', titulo: 'Ticket médio', alinhar: 'right' },
        { chave: 'ultima', titulo: 'Última compra', alinhar: 'center' },
      ],
      linhas: compradores
        .map((item) => ({
          cliente: item.cliente.razaoSocial,
          pedidos: item.lista.length,
          faturamento: dinheiro(item.faturamento),
          ticket: dinheiro(item.faturamento / item.lista.length),
          ultima: dataBr(item.ultimaData),
          _ticket: item.faturamento / item.lista.length,
        }))
        .sort((a, b) => b._ticket - a._ticket)
        .map(({ _ticket, ...linha }) => linha),
    }
  }

  const ativos = clientes.filter(
    (cliente) => !cliente.bloqueado && !normalizar(cliente.situacao).includes('inativ'),
  ).length
  return {
    indicadores: [
      ['Clientes cadastrados', inteiro(clientes.length)],
      ['Ativos', inteiro(ativos)],
      ['Inativos / bloqueados', inteiro(clientes.length - ativos)],
      ['Cidades atendidas', inteiro(new Set(clientes.map((cliente) => cliente.cidade).filter(Boolean)).size)],
    ],
    colunas: [
      { chave: 'codigo', titulo: 'Código' },
      { chave: 'cliente', titulo: 'Cliente' },
      { chave: 'tipo', titulo: 'Tipo' },
      { chave: 'cidade', titulo: 'Cidade' },
      { chave: 'telefone', titulo: 'Telefone' },
      { chave: 'email', titulo: 'E-mail' },
      { chave: 'situacao', titulo: 'Situação', alinhar: 'center' },
    ],
    linhas: clientes.map((cliente) => ({
      codigo: cliente.codigo,
      cliente: cliente.razaoSocial,
      tipo: cliente.tipo || cliente.tipoPessoa || '-',
      cidade: cliente.cidade || '-',
      telefone: cliente.celular || cliente.telefone || '-',
      email: cliente.email || '-',
      situacao: cliente.bloqueado ? 'Bloqueado' : cliente.situacao || 'Ativo',
    })),
  }
}

function RelatorioDetalhe({ tipo }: RelatorioDetalheProps) {
  const navigate = useNavigate()
  const configuracao = CONFIGURACOES[tipo]

  const [relatorioAtivo, setRelatorioAtivo] = useState(configuracao.relatorios[0].id)
  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')
  const [versaoDados, setVersaoDados] = useState(0)
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [menuMaisAberto, setMenuMaisAberto] = useState(false)
  const [menuColunasAberto, setMenuColunasAberto] = useState(false)
  const [colunasOcultas, setColunasOcultas] = useState<Set<string>>(new Set())
  const maisRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const atualizar = () => setVersaoDados((valor) => valor + 1)
    window.addEventListener(ERP_STORAGE_UPDATED_EVENT, atualizar)
    window.addEventListener(EVENTO_CONTAS_PAGAR_ATUALIZADAS, atualizar)
    window.addEventListener('storage', atualizar)
    return () => {
      window.removeEventListener(ERP_STORAGE_UPDATED_EVENT, atualizar)
      window.removeEventListener(EVENTO_CONTAS_PAGAR_ATUALIZADAS, atualizar)
      window.removeEventListener('storage', atualizar)
    }
  }, [])

  const dados = useMemo(() => {
    void versaoDados
    return {
      contas: lerStorage<ContaReceber>('synergias_contas_receber'),
      contasPagar: lerStorage<ContaPagarRelatorio>('synergias_contas_pagar'),
      lancamentos: lerStorage<LancamentoOFX>('synergias_lancamentos_ofx'),
      vendas: obterColecaoMemoria<Venda>('vendas'),
      compras: listarComprasStorage(),
      produtos: obterColecaoMemoria<Produto>('produtos'),
      clientes: obterColecaoMemoria<Cliente>('clientes'),
      movimentacoes: lerStorage<EstoqueMovimentacao>('synergias_estoque_movimentacoes'),
      contasBancarias: lerStorage<ContaBancariaRelatorio>('synergias_contas_bancarias'),
    }
  }, [versaoDados])

  const dadosFiltrados = useMemo(() => ({
    contas: dados.contas.filter((item) => dentroPeriodo(dataIso(item.dataRecebimento || item.dataEmissao || item.dataVencimento), dataInicial, dataFinal)),
    contasPagar: dados.contasPagar.filter((item) => dentroPeriodo(dataIso(item.dataPagamento || item.emissao || item.vencimento), dataInicial, dataFinal)),
    lancamentos: dados.lancamentos.filter((item) => dentroPeriodo(dataIso(item.data), dataInicial, dataFinal)),
    vendas: consolidarVendasRelatorios(dados.vendas).vendas.filter((item) => {
      if (!dentroPeriodo(dataVenda(item), dataInicial, dataFinal)) return false
      const termo = normalizar(busca)
      if (termo && !normalizar([item.numeroPedido, item.numeroOrcamento, item.clienteNome, item.vendedor, item.itens?.map((i) => i.descricao).join(' ')].join(' ')).includes(termo)) return false
      if (status && normalizar(item.statusPedido || item.statusOrcamento) !== normalizar(status)) return false
      if (formaPagamento && normalizar(item.formaPagamento || item.tipoCobranca) !== normalizar(formaPagamento)) return false
      return true
    }),
    compras: dados.compras.filter((item) => dentroPeriodo(dataIso(item.dataEmissao || item.criadoEm), dataInicial, dataFinal)),
    produtos: dados.produtos,
    clientes: dados.clientes,
    movimentacoes: dados.movimentacoes.filter((item) => dentroPeriodo(dataIso(item.data || item.criadoEm), dataInicial, dataFinal)),
    contasBancarias: dados.contasBancarias,
  }), [busca, dados, dataFinal, dataInicial, formaPagamento, status])

  const definicaoAtiva = configuracao.relatorios.find((item) => item.id === relatorioAtivo) || configuracao.relatorios[0]

  const resultado = useMemo(() => {
    if (tipo === 'financeiro') {
      return gerarFinanceiro(relatorioAtivo, dadosFiltrados.contas, dadosFiltrados.contasPagar, dadosFiltrados.lancamentos, dadosFiltrados.vendas, dadosFiltrados.produtos, dadosFiltrados.contasBancarias)
    }
    if (tipo === 'vendas') {
      return gerarVendas(relatorioAtivo, dadosFiltrados.vendas, dadosFiltrados.produtos)
    }
    if (tipo === 'compras') {
      return gerarCompras(relatorioAtivo, dadosFiltrados.compras)
    }
    if (tipo === 'produtos') {
      return gerarProdutos(relatorioAtivo, dadosFiltrados.vendas, dadosFiltrados.produtos)
    }
    if (tipo === 'estoque') {
      return gerarEstoque(relatorioAtivo, dadosFiltrados.produtos, dadosFiltrados.movimentacoes, dadosFiltrados.vendas)
    }
    return gerarClientes(relatorioAtivo, dadosFiltrados.clientes, dadosFiltrados.vendas)
  }, [dadosFiltrados, relatorioAtivo, tipo])

  useEffect(() => setColunasOcultas(new Set()), [relatorioAtivo])

  const colunasVisiveis = resultado.colunas.filter((coluna) => !colunasOcultas.has(coluna.chave))
  const relatoriosPrincipais = configuracao.relatorios.slice(0, 6)
  const relatoriosExtras = configuracao.relatorios.slice(6)

  function selecionarRelatorio(id: string) {
    if (id === 'brindes') navigate('/relatorios/brindes')
    else setRelatorioAtivo(id)
    setMenuMaisAberto(false)
  }

  function exportarCsv() {
    const escapar = (valor: unknown) => `"${String(valor ?? '').replace(/"/g, '""')}"`
    const csv = [
      colunasVisiveis.map((coluna) => escapar(coluna.titulo)).join(';'),
      ...resultado.linhas.map((linha) => colunasVisiveis.map((coluna) => escapar(linha[coluna.chave])).join(';')),
    ].join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
    link.download = `${definicaoAtiva.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <main className="relatorios-page" data-layout={RELATORIOS_VENDAS_MARKER_V239}>
      <Sidebar />

      <section className="relatorios-content">
        <PageHeader
          category="Relatórios"
          title={configuracao.titulo}
          subtitle={configuracao.subtitulo}
        />

        <section className="relatorios-toolbar">
          <div className="relatorios-toolbar-left">
            <button
              type="button"
              className="relatorios-action-btn relatorios-action-back"
              onClick={() => navigate('/relatorios')}
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft size={25} strokeWidth={2.4} />
            </button>

            <div className="relatorios-periodo">
              <CalendarDays size={19} />
              <label>
                De
                <input type="date" value={dataInicial} onChange={(event) => setDataInicial(event.target.value)} />
              </label>
              <label>
                Até
                <input type="date" value={dataFinal} onChange={(event) => setDataFinal(event.target.value)} />
              </label>
              {(dataInicial || dataFinal) && (
                <button
                  type="button"
                  className="relatorios-limpar-periodo"
                  onClick={() => {
                    setDataInicial('')
                    setDataFinal('')
                  }}
                >
                  Limpar período
                </button>
              )}
            </div>
          </div>

          <div className="relatorios-toolbar-right">
            <button
              type="button"
              className="relatorios-action-btn relatorios-action-print"
              onClick={() => window.print()}
              title="Imprimir relatório"
              aria-label="Imprimir relatório"
            >
              <Printer size={25} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className="relatorios-action-btn relatorios-action-refresh"
              onClick={() => setVersaoDados((valor) => valor + 1)}
              title="Atualizar relatório"
              aria-label="Atualizar relatório"
            >
              <RefreshCw size={25} strokeWidth={2.4} />
            </button>
          </div>
        </section>

        <nav className={`relatorios-nav relatorios-workspace-${configuracao.corClasse}`} aria-label="RelatÃ³rios disponÃ­veis">
          {relatoriosPrincipais.map((relatorio) => <button key={relatorio.id} type="button" className={relatorioAtivo === relatorio.id ? 'is-active' : ''} onClick={() => selecionarRelatorio(relatorio.id)}>{relatorio.titulo}</button>)}
          {relatoriosExtras.length > 0 && <div className="relatorios-mais" ref={maisRef}><button type="button" className={relatoriosExtras.some((item) => item.id === relatorioAtivo) ? 'is-active' : ''} onClick={() => setMenuMaisAberto((aberto) => !aberto)}>Mais relatórios <ChevronDown size={16} /></button>{menuMaisAberto && <div className="relatorios-mais-menu">{relatoriosExtras.map((relatorio) => <button key={relatorio.id} type="button" onClick={() => selecionarRelatorio(relatorio.id)}><strong>{relatorio.titulo}</strong><small>{relatorio.descricao}</small></button>)}</div>}</div>}
        </nav>

        <section className={`relatorios-workspace relatorios-workspace-${configuracao.corClasse}`}>
          <div className={`relatorios-resultado relatorios-resultado-${relatorioAtivo}`}>
            <div className="relatorios-resultado-header">
              <div>
                <span className="relatorios-resultado-eyebrow">RELATÓRIO ATUAL</span>
                <h2>{definicaoAtiva.titulo}</h2>
                <p>{definicaoAtiva.descricao}</p>
              </div>
              <span className="relatorios-total-registros">{resultado.linhas.length} registro(s)</span>
            </div>

            <section className={`relatorios-indicadores relatorios-indicadores-${configuracao.corClasse}`}>
              {resultado.indicadores.map(([rotulo, valor], index) => {
                const Icone = [ShoppingBag, CircleDollarSign, Users, Ticket][index % 4]
                return <article key={rotulo} className="relatorios-indicador-card">
                  <span className="relatorios-indicador-icon"><Icone size={22} /></span>
                  <span className="relatorios-indicador-conteudo"><span>{rotulo}</span><strong>{valor}</strong><small>{index === 3 ? 'Média no período' : 'Total no período'}</small></span>
                </article>
              })}
            </section>

            {resultado.observacao && (
              <div className="relatorios-observacao">{resultado.observacao}</div>
            )}

            <section className="relatorios-lista-card">
              <div className="relatorios-table-toolbar">
                <label className="relatorios-busca-wrap"><input className="relatorios-busca" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar pedido, cliente, vendedor..." aria-label="Pesquisar no relatório" /><Search size={18} /></label>
                {tipo === 'vendas' && <>
                  <label className="relatorios-select-wrap"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option>{Array.from(new Set(dados.vendas.map((item) => item.statusPedido || item.statusOrcamento).filter(Boolean))).map((valor) => <option key={valor} value={valor}>{valor}</option>)}</select></label>
                  <label className="relatorios-select-wrap"><span>Pagamento</span><select value={formaPagamento} onChange={(event) => setFormaPagamento(event.target.value)}><option value="">Todos</option>{Array.from(new Set(dados.vendas.map((item) => item.formaPagamento || item.tipoCobranca).filter(Boolean))).map((valor) => <option key={valor} value={valor}>{valor}</option>)}</select></label>
                </>}
                {(busca || status || formaPagamento || dataInicial || dataFinal) && <button className="relatorios-clear-btn" type="button" onClick={() => { setBusca(''); setStatus(''); setFormaPagamento(''); setDataInicial(''); setDataFinal('') }}>Limpar</button>}
                <div className="relatorios-table-actions">
                  <div className="relatorios-colunas-wrap"><button type="button" className="relatorios-outline-btn" onClick={() => setMenuColunasAberto((aberto) => !aberto)}><Columns3 size={18} />Colunas</button>{menuColunasAberto && <div className="relatorios-colunas-menu">{resultado.colunas.map((coluna, index) => <label key={coluna.chave}><input type="checkbox" checked={!colunasOcultas.has(coluna.chave)} disabled={index === 0} onChange={() => setColunasOcultas((atuais) => { const proximas = new Set(atuais); if (proximas.has(coluna.chave)) proximas.delete(coluna.chave); else proximas.add(coluna.chave); return proximas })} />{coluna.titulo}</label>)}</div>}</div>
                  <button type="button" className="relatorios-export-btn" onClick={exportarCsv}><Download size={18} />Exportar</button>
                </div>
              </div>
              {resultado.linhas.length === 0 ? (
                <div className="relatorios-vazio">
                  Nenhum registro encontrado para este relatório no período selecionado.
                </div>
              ) : (
                <div className="relatorios-tabela-scroll">
                  <table className="relatorios-tabela">
                    <thead>
                      <tr>
                        {colunasVisiveis.map((coluna) => (
                          <th key={coluna.chave} className={`align-${coluna.alinhar || 'left'} col-${coluna.chave}`}>
                            {coluna.titulo}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.linhas.map((linha, index) => (
                        <tr key={`${relatorioAtivo}-${index}`}>
                          {colunasVisiveis.map((coluna) => (
                            <td key={coluna.chave} className={`align-${coluna.alinhar || 'left'} col-${coluna.chave}`}>
                              {linha[coluna.chave] ?? '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </section>
      </section>
    </main>
  )
}

export default RelatorioDetalhe
