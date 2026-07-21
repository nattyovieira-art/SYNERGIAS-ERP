// SYNERGIAS_ORCAMENTO_SALVAR_CONFIRMADO_PDF_DATA_ATUAL_V284
// SYNERGIAS_PIX_TRANSFERENCIA_60_DIAS_V263C
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle,
  Copy,
  Edit,
  FilePlus2,
  FileText,
  List,
  Mail,
  MessageSquare,
  Minus,
  PackagePlus,
  Plus,
  Printer,
  Save,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import logoSynergiasUrl from '../../assets/logo-synergias.png'
import PageHeader from '../../components/PageHeader/PageHeader'
import { carregarColecaoCentral, ERP_STORAGE_UPDATED_EVENT } from '../../services/erpApi'
import { salvarClientesStorageConfirmado } from '../../services/clientesStorage'
import { listarVendasStorage as listarVendasCentral, salvarVendaStorageConfirmado as salvarVendaCentralConfirmado } from '../../services/vendasStorage'

import '../../styles/clientes.css'
import '../../styles/orcamento-form.css'

type StatusOrcamento = 'Aberto' | 'Aprovado' | 'Reprovado'
const DELAY_IMPRESSAO_AUTOMATICA_MS = 700
type TipoDesconto = 'valor' | 'percentual'

type ClienteOrcamento = {
  id: string
  nome: string
  documento: string
  emailNotaFiscal: string
  inscricaoEstadual: string
  indicadorIE: string
  enderecoFaturamento: string
  enderecoEntrega: string
  enderecosEntrega: string[]
  limiteCredito: number
  totalVencidas: number
  totalAVencer: number
  totalPagas: number
}

type ProdutoBusca = {
  id: string
  codigo: string
  codigoBarras?: string
  nome: string
  descricao: string
  valorUnitario: number
  estoque: number
  unidade: string
}

type ItemOrcamento = {
  id: string
  produtoId: string
  codigo: string
  codigoBarras?: string
  descricao: string
  unidade: string
  quantidade: number
  valorUnitario: number
  desconto: number
  estoqueDisponivel: number
  observacaoItem?: string
}

type PagamentoGerado = {
  id: string
  formaPagamento: string
  prazo: string
  vencimento: string
  observacoes: string
  valor: number
}

type VendaStorage = {
  id: string
  tipo: 'Orçamento'
  numeroOrcamento: string
  numeroPedido?: string
  vendedor: string
  clienteId: string
  clienteNome: string
  clienteDocumento: string
  clienteEmailNotaFiscal: string
  clienteInscricaoEstadual: string
  clienteIndicadorIE: string
  dataEmissao: string
  dataValidade: string
  dataEntrega: string
  enderecoFaturamento: string
  enderecoEntrega: string
  itens: ItemOrcamento[]
  tipoDesconto: TipoDesconto
  descontoInformado: number
  descontoCalculado: number
  frete: number
  outrosCustos: number
  subtotal: number
  totalFinal: number
  pagamentos: PagamentoGerado[]
  observacoes: string
  statusOrcamento: StatusOrcamento
  criadoEm: string
  itensEditadosManual?: boolean
  pedidoGeradoId?: string
  pedidoGeradoEm?: string
}

const STORAGE_PRODUTOS = 'synergias_produtos'
const STORAGE_VENDEDORES = 'synergias_vendedores'
const STORAGE_FORMAS_PAGAMENTO = 'synergias_formas_pagamento'
const STORAGE_PRAZOS_PAGAMENTO = 'synergias_prazos_pagamento'

const FORMAS_PAGAMENTO_PADRAO = [
  'BOLETO',
  'PIX',
  'TRANSFERÊNCIA',
  'DINHEIRO',
  'CARTÃO',
]

const OPCOES_COBRANCA_POR_FORMA: Record<string, string[]> = {
  BOLETO: ['BOLETO BANCO INTER', 'BOLETO BANCO CORA'],
  PIX: ['PIX BANCO CORA', 'PIX BANCO INTER'],
  TRANSFERÊNCIA: [
    'TRANSFERÊNCIA BANCO INTER',
    'TRANSFERÊNCIA BANCO CORA',
  ],
  DINHEIRO: ['DINHEIRO'],
  CARTÃO: ['CARTÃO CRÉDITO SUMUP', 'CARTÃO DÉBITO SUMUP'],
}

const PRAZOS_POR_FORMA: Record<string, string[]> = {
  BOLETO: [
    'À VISTA',
    '10 DIAS',
    '1x - 30 dias',
    '2x - 30/60 dias',
    '3x - 30/60/90 dias',
    '4x - 30/60/90/120 dias',
    '5x - 30/60/90/120/150 dias',
    '6x - 30/60/90/120/150/180 dias',
    '7x - 30/60/90/120/150/180/210 dias',
    '8x - 30/60/90/120/150/180/210/240 dias',
  ],
  PIX: ['À VISTA', '10 DIAS', '30 DIAS', '2x - 30/60 dias'],
  TRANSFERÊNCIA: ['À VISTA', '10 DIAS', '30 DIAS', '2x - 30/60 dias'],
  DINHEIRO: ['À VISTA'],
  CARTÃO: ['À VISTA'],
}

const DADOS_BANCARIOS_POR_BANCO: Record<string, string> = {
  CORA: [
    'Dados para transferência - Banco Cora',
    'Instituição: 403 - Cora SCFI',
    'Agência: 0001',
    'Conta: 4969198-5',
    'Nome da Empresa: SYNERGIAS',
    'CNPJ: 50.432.175/0001-46',
  ].join('\n'),
  INTER: [
    'Dados para transferência - Banco Inter',
    'Instituição: 077 - Inter',
    'Agência: 0001',
    'Conta: 28738442-0',
    'Nome da Empresa: SYNERGIAS SL COMERCIO LTDA',
    'CNPJ: 50.432.175/0001-46',
  ].join('\n'),
}


const EMPRESA_NOME = 'SYNERGIAS SL COMERCIO LTDA ME'
const EMPRESA_FANTASIA = 'SYNERGIAS'
const EMPRESA_CNPJ = '50.432.175/0001-46'
const EMPRESA_ENDERECO = 'Avenida Frei Henrique de Coimbra, 11'
const EMPRESA_CIDADE = '91370-180 - Porto Alegre - RS'
const EMPRESA_TELEFONE = '(51) 98264-2434'
const LOGO_PUBLIC_PATH = logoSynergiasUrl

const CORES_ICONES_ERP = {
  novo: '#f0520b',
  imprimir: '#5b1f91',
  email: '#3d348b',
  duplicar: '#0f766e',
  lista: '#2454d6',
  salvar: '#16a34a',
}

function estiloBotaoIcone(cor: string): CSSProperties {
  return {
    width: 58,
    height: 58,
    minWidth: 58,
    flex: '0 0 58px',
    border: 0,
    borderRadius: 16,
    padding: 0,
    background: cor,
    color: '#ffffff',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.10)',
  }
}

function gerarId(): string {
  return crypto.randomUUID()
}

function normalizarTexto(texto: string) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function escaparHtml(texto: string) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatarDataInput(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')

  return `${ano}-${mes}-${dia}`
}

function formatarDataBR(data?: string) {
  if (!data) return '-'

  const partes = data.split('-')

  if (partes.length !== 3) return data

  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

function somarDiasUteis(dataBase: string, diasUteis: number) {
  const data = new Date(`${dataBase}T00:00:00`)
  let adicionados = 0

  while (adicionados < diasUteis) {
    data.setDate(data.getDate() + 1)

    const diaSemana = data.getDay()

    if (diaSemana !== 0 && diaSemana !== 6) {
      adicionados++
    }
  }

  return formatarDataInput(data)
}

function somarDiasCorridos(dataBase: string, dias: number) {
  const data = new Date(`${dataBase}T00:00:00`)
  data.setDate(data.getDate() + dias)

  return formatarDataInput(data)
}

function numeroParaMoeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatarMoeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function textoMoedaParaNumero(valor: string | number | undefined | null) {
  if (typeof valor === 'number') return valor

  if (!valor) return 0

  const texto = String(valor).trim()

  if (texto.includes(',') && texto.includes('.')) {
    const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
    const numero = Number(limpo)
    return Number.isNaN(numero) ? 0 : numero
  }

  if (texto.includes(',')) {
    const limpo = texto.replace(/[^\d,.-]/g, '').replace(',', '.')
    const numero = Number(limpo)
    return Number.isNaN(numero) ? 0 : numero
  }

  const limpo = texto.replace(/[^\d.-]/g, '')
  const numero = Number(limpo)

  return Number.isNaN(numero) ? 0 : numero
}

function somenteNumeros(texto: string) {
  return String(texto || '').replace(/\D/g, '')
}

function formatarCnpj(cnpj: string) {
  const numeros = somenteNumeros(cnpj)

  if (numeros.length !== 14) return cnpj

  return numeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function formatarTelefoneBrasil(telefone: string) {
  const numeros = somenteNumeros(telefone)

  if (numeros.length === 11) {
    return numeros.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  }

  if (numeros.length === 10) {
    return numeros.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  }

  return telefone
}

function formatarCep(cep: string) {
  const numeros = somenteNumeros(cep)

  if (numeros.length !== 8) return cep

  return numeros.replace(/^(\d{5})(\d{3})$/, '$1-$2')
}

function montarEnderecoDuasLinhas(linha1: string, partesLinha2: string[]) {
  const primeiraLinha = String(linha1 || '').trim()
  const segundaLinha = partesLinha2
    .map((parte) => String(parte || '').trim())
    .filter(Boolean)
    .join(' - ')

  return [primeiraLinha, segundaLinha].filter(Boolean).join('\n')
}

function compactarEnderecoEmDuasLinhas(endereco: string) {
  const linhas = String(endereco || '')
    .split(/\n+/)
    .map((linha) => linha.trim())
    .filter(Boolean)

  if (linhas.length <= 2) {
    return linhas.join('\n')
  }

  return [linhas[0], linhas.slice(1).join(' - ')].join('\n')
}

function formatarCampoMoedaAoSair(valor: string) {
  return numeroParaCampo(textoMoedaParaNumero(valor))
}

function numeroParaCampo(valor: number) {
  return numeroParaMoeda(valor)
}

function mascararMoedaDigitada(valor: string | number | undefined | null) {
  const digitos = String(valor ?? '').replace(/\D/g, '')
  if (!digitos) return '0,00'

  const centavos = Number(digitos) / 100
  return centavos.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function limparNomeArquivo(texto: string) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function nomeMesCurto(dataBase: string) {
  const data = new Date(`${dataBase}T00:00:00`)

  const meses = [
    'JAN',
    'FEV',
    'MAR',
    'ABR',
    'MAI',
    'JUN',
    'JUL',
    'AGO',
    'SET',
    'OUT',
    'NOV',
    'DEZ',
  ]

  return meses[data.getMonth()]
}

function anoCurto(dataBase: string) {
  const data = new Date(`${dataBase}T00:00:00`)
  return String(data.getFullYear()).slice(-2)
}

function gerarNomeArquivoPdf(numero: string, clienteNome: string, _dataEmissao: string) {
  const cliente = limparNomeArquivo(clienteNome || 'CLIENTE')
  const hoje = new Date()
  const dataAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const mes = nomeMesCurto(dataAtual)
  const ano = anoCurto(dataAtual)

  return `COTAÇÃO ${numero || 'SEM NUMERO'} - ${cliente} - ${mes} ${ano}`
}

function campoTexto(objeto: any, campo: string) {
  const valor = objeto?.[campo]

  if (valor === undefined || valor === null) return ''

  return String(valor).trim()
}

function montarEnderecoFiscal(cliente: any) {
  const endereco = campoTexto(cliente, 'endereco')
  const numero = campoTexto(cliente, 'numero')
  const complemento = campoTexto(cliente, 'complemento')
  const bairro = campoTexto(cliente, 'bairro')
  const cidade = campoTexto(cliente, 'cidade')
  const estado = campoTexto(cliente, 'estado')
  const cep = formatarCep(campoTexto(cliente, 'cep'))
  const pais = campoTexto(cliente, 'pais') || 'Brasil'

  const possuiCamposSeparados = numero || complemento || bairro || cidade || estado || cep

  if (!possuiCamposSeparados && endereco.includes('\n')) {
    return compactarEnderecoEmDuasLinhas(endereco)
  }

  const linha1 = [endereco, numero].filter(Boolean).join(', ')
  const cidadeEstado = [cidade, estado].filter(Boolean).join(' / ')
  const cepTexto = cep ? `CEP: ${cep}` : ''
  const linha2Partes = [complemento, bairro, cidadeEstado, cepTexto, pais]

  return montarEnderecoDuasLinhas(linha1, linha2Partes)
}

function montarEnderecoEntrega(cliente: any) {
  if (cliente?.mesmoEnderecoFiscal) {
    return montarEnderecoFiscal(cliente)
  }

  const enderecoEntrega = campoTexto(cliente, 'enderecoEntrega')
  const numeroEntrega = campoTexto(cliente, 'numeroEntrega')
  const complementoEntrega = campoTexto(cliente, 'complementoEntrega')
  const bairroEntrega = campoTexto(cliente, 'bairroEntrega')
  const cidadeEntrega = campoTexto(cliente, 'cidadeEntrega')
  const estadoEntrega = campoTexto(cliente, 'estadoEntrega')
  const cepEntrega = formatarCep(campoTexto(cliente, 'cepEntrega'))
  const paisEntrega = campoTexto(cliente, 'paisEntrega') || 'Brasil'

  const existeEnderecoEntrega =
    enderecoEntrega ||
    numeroEntrega ||
    complementoEntrega ||
    bairroEntrega ||
    cidadeEntrega ||
    estadoEntrega ||
    cepEntrega

  if (!existeEnderecoEntrega) {
    return montarEnderecoFiscal(cliente)
  }

  const possuiCamposSeparados =
    numeroEntrega ||
    complementoEntrega ||
    bairroEntrega ||
    cidadeEntrega ||
    estadoEntrega ||
    cepEntrega

  if (!possuiCamposSeparados && enderecoEntrega.includes('\n')) {
    return compactarEnderecoEmDuasLinhas(enderecoEntrega)
  }

  const linha1 = [enderecoEntrega, numeroEntrega].filter(Boolean).join(', ')
  const cidadeEstado = [cidadeEntrega, estadoEntrega].filter(Boolean).join(' / ')
  const cepTexto = cepEntrega ? `CEP: ${cepEntrega}` : ''
  const linha2Partes = [complementoEntrega, bairroEntrega, cidadeEstado, cepTexto, paisEntrega]

  return montarEnderecoDuasLinhas(linha1, linha2Partes)
}

function normalizarIndicadorIECliente(valor: unknown, inscricaoEstadual: unknown = '') {
  const texto = normalizarTexto(String(valor || ''))
  if (texto === '1' || texto.includes('CONTRIBUINTE DO ICMS') || (texto.includes('CONTRIBUINTE') && !texto.includes('ISENTO') && !texto.includes('NAO'))) return '1'
  if (texto === '2' || texto.includes('ISENTO')) return '2'
  if (texto === '9' || texto.includes('NAO CONTRIBUINTE')) return '9'
  return String(inscricaoEstadual || '').replace(/\D/g, '') ? '1' : ''
}

function mapearClientesOrcamento(clientes: any[]): ClienteOrcamento[] {
  if (!Array.isArray(clientes)) return []

  return clientes.map((cliente: any) => {
    const nome =
      cliente.razaoSocial ||
      cliente.nomeFantasia ||
      cliente.nome ||
      cliente.apelido ||
      'Cliente sem nome'

    const documento =
      cliente.cnpj || cliente.cpf || cliente.documento || cliente.cnpjCpf || ''

    const emailNotaFiscal =
      cliente.emailNotaFiscal ||
      cliente.emailNfe ||
      cliente.emailNota ||
      cliente.emailFiscal ||
      cliente.email ||
      ''

    const id = String(cliente.id || cliente.codigo || gerarId())

    return {
      id,
      nome,
      documento,
      emailNotaFiscal,
      inscricaoEstadual: String(cliente.inscricaoEstadual || cliente.ie || '').trim(),
      indicadorIE: normalizarIndicadorIECliente(cliente.indicadorIE, cliente.inscricaoEstadual || cliente.ie),
      enderecoFaturamento: montarEnderecoFiscal(cliente),
      enderecoEntrega: montarEnderecoEntrega(cliente),
      enderecosEntrega: Array.isArray(cliente.enderecosEntrega)
        ? cliente.enderecosEntrega.map((endereco: unknown) => compactarEnderecoEmDuasLinhas(String(endereco || ''))).filter(Boolean)
        : String(cliente.enderecoEntrega || montarEnderecoEntrega(cliente))
            .split(/\n\s*\n+/)
            .map((endereco: string) => compactarEnderecoEmDuasLinhas(endereco))
            .map((endereco: string) => endereco.trim())
            .filter(Boolean),
      limiteCredito: Number(cliente.limiteCredito || 0),
      totalVencidas: Number(cliente.totalVencidas || 0),
      totalAVencer: Number(cliente.totalAVencer || 0),
      totalPagas: Number(cliente.totalPagas || 0),
    }
  })
}

function carregarClientes(): ClienteOrcamento[] {
  return []
}

function obterValorProduto(produto: any) {
  const camposPossiveis = [
    produto.valorUnitario,
    produto.vendaVarejo,
    produto.valorVenda,
    produto.precoVenda,
    produto.precoUnitario,
    produto.preco,
    produto.valor,
    produto.venda,
    produto.valorFinal,
    produto.vendaAtacado,
  ]

  for (const campo of camposPossiveis) {
    const valor = textoMoedaParaNumero(campo)

    if (valor > 0) return valor
  }

  return 0
}

function carregarProdutos(): ProdutoBusca[] {
  const produtosSalvos = localStorage.getItem(STORAGE_PRODUTOS)

  if (!produtosSalvos) return []

  try {
    const produtos = JSON.parse(produtosSalvos)

    return produtos.map((produto: any) => {
      const estoque = Number(
        produto.estoqueDisponivel ??
          produto.estoqueAtual ??
          produto.quantidadeEstoque ??
          produto.quantidade ??
          produto.estoque ??
          0
      )

      const codigoBarras = extrairCodigoBarrasValido(produto)

      return {
        id: produto.id || produto.codigo || gerarId(),
        codigo: codigoBarras || produto.codigo || produto.sku || produto.referencia || '',
        codigoBarras,
        nome:
          produto.nome ||
          produto.descricao ||
          produto.nomeProduto ||
          produto.produto ||
          '',
        descricao:
          produto.descricao ||
          produto.nome ||
          produto.nomeProduto ||
          produto.produto ||
          '',
        valorUnitario: obterValorProduto(produto),
        estoque: Number.isNaN(estoque) ? 0 : estoque,
        unidade: produto.unidade || produto.unidadeMedida || 'Unidade',
      }
    })
  } catch {
    return []
  }
}

function carregarVendasStorage(): VendaStorage[] {
  return listarVendasCentral() as unknown as VendaStorage[]
}

function gerarNumeroOrcamento() {
  const vendas = carregarVendasStorage()

  const numeros = vendas
    .filter((venda) => venda.tipo === 'Orçamento')
    .map((venda) => Number(String(venda.numeroOrcamento || '').replace(/\D/g, '')))
    .filter((numero) => !Number.isNaN(numero))

  const maiorNumero = numeros.length > 0 ? Math.max(...numeros) : 0

  return String(maiorNumero + 1)
}

function extrairCodigoBarrasValido(produto: any): string {
  const candidatos = [
    produto?.codigoBarras,
    produto?.codigo_barra,
    produto?.ean,
    produto?.gtin,
    produto?.codigo,
  ]

  for (const candidato of candidatos) {
    const somenteNumeros = String(candidato ?? '').replace(/\D/g, '')

    // O ERP trabalha com códigos de barras numéricos. Códigos internos curtos
    // (ex.: 0676, 0230) nunca participam da sequência automática.
    if (somenteNumeros.length >= 8 && somenteNumeros.length <= 14) {
      return somenteNumeros
    }
  }

  return ''
}

type RespostaCodigoProdutoRapido = {
  ok: boolean
  codigo: string
  produto?: ProdutoBusca
  data?: ProdutoBusca[]
}

async function consultarProximoCodigoProdutoRapido(): Promise<string> {
  const resposta = await fetch(`/api/produto-codigo-sequencia.php?_=${Date.now()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    credentials: 'same-origin',
  })
  const texto = await resposta.text()
  let dados: RespostaCodigoProdutoRapido
  try { dados = JSON.parse(texto) as RespostaCodigoProdutoRapido }
  catch { throw new Error('A API de sequência retornou uma resposta inválida.') }
  if (!resposta.ok || !dados.ok || !dados.codigo) {
    throw new Error((dados as any)?.error || 'Não foi possível obter o próximo código.')
  }
  return String(dados.codigo).replace(/\D/g, '')
}

async function criarProdutoRapidoNoServidor(produto: Omit<ProdutoBusca, 'codigo' | 'codigoBarras'>): Promise<RespostaCodigoProdutoRapido> {
  const resposta = await fetch('/api/produto-codigo-sequencia.php', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ produto }),
  })
  const texto = await resposta.text()
  let dados: RespostaCodigoProdutoRapido
  try { dados = JSON.parse(texto) as RespostaCodigoProdutoRapido }
  catch { throw new Error('A API de cadastro retornou uma resposta inválida.') }
  if (!resposta.ok || !dados.ok || !dados.produto || !Array.isArray(dados.data)) {
    throw new Error((dados as any)?.error || 'O servidor não confirmou o novo produto.')
  }
  return dados
}

function carregarVendedores() {
  const vendedoresSalvos = localStorage.getItem(STORAGE_VENDEDORES)

  if (!vendedoresSalvos) {
    const vendedoresPadrao = ['Natália Vieira']
    localStorage.setItem(STORAGE_VENDEDORES, JSON.stringify(vendedoresPadrao))
    return vendedoresPadrao
  }

  try {
    return JSON.parse(vendedoresSalvos)
  } catch {
    return []
  }
}

function carregarFormasPagamento() {
  localStorage.setItem(STORAGE_FORMAS_PAGAMENTO, JSON.stringify(FORMAS_PAGAMENTO_PADRAO))
  return FORMAS_PAGAMENTO_PADRAO
}

function carregarPrazosPagamento() {
  const prazosPadrao = Array.from(
    new Set(Object.values(PRAZOS_POR_FORMA).flat())
  )

  localStorage.setItem(STORAGE_PRAZOS_PAGAMENTO, JSON.stringify(prazosPadrao))

  return prazosPadrao
}

function salvarVendedores(vendedores: string[]) {
  localStorage.setItem(STORAGE_VENDEDORES, JSON.stringify(vendedores))
}

function salvarProdutosStorage(produtos: ProdutoBusca[]) {
  localStorage.setItem(STORAGE_PRODUTOS, JSON.stringify(produtos))
}

async function salvarOrcamentoStorage(orcamento: VendaStorage) {
  return salvarVendaCentralConfirmado(orcamento as any)
}

function buscarOrcamentoPorId(id: string) {
  const vendas = carregarVendasStorage()

  return vendas.find((venda) => venda.id === id && venda.tipo === 'Orçamento') || null
}

function calcularDiasPrazos(prazo: string) {
  const prazoMaiusculo = String(prazo || '').toUpperCase()

  if (!prazoMaiusculo || prazoMaiusculo.includes('VISTA')) {
    return [0]
  }

  const parcelamento = prazoMaiusculo.match(/(\d+)\s*X/)

  if (parcelamento) {
    const quantidadeParcelas = Number(parcelamento[1])

    if (quantidadeParcelas > 0) {
      return Array.from(
        { length: quantidadeParcelas },
        (_, indice) => (indice + 1) * 30
      )
    }
  }

  const numeroEncontrado = prazoMaiusculo.match(/\d+/)

  if (!numeroEncontrado) {
    return [0]
  }

  return [Number(numeroEncontrado[0])]
}

function ajustarVencimentoCobranca(dataBase: string, formaPagamento: string) {
  if (!String(formaPagamento || '').toUpperCase().includes('BOLETO')) {
    return dataBase
  }

  const data = new Date(`${dataBase}T00:00:00`)
  const diaAtual = data.getDate()

  let diaAjustado = 30

  if (diaAtual <= 5) {
    diaAjustado = 5
  } else if (diaAtual <= 10) {
    diaAjustado = 10
  } else if (diaAtual <= 15) {
    diaAjustado = 15
  } else if (diaAtual <= 20) {
    diaAjustado = 20
  } else if (diaAtual <= 25) {
    diaAjustado = 25
  }

  const ultimoDiaMes = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate()
  const vencimento = new Date(data)
  vencimento.setDate(Math.min(diaAjustado, ultimoDiaMes))

  return formatarDataInput(vencimento)
}

function obterDadosBancariosPagamento(opcaoPagamento: string) {
  const texto = normalizarTexto(opcaoPagamento)

  const pagamentoPrecisaDadosBancarios =
    texto.includes('pix') || texto.includes('transferencia')

  if (!pagamentoPrecisaDadosBancarios) {
    return ''
  }

  if (texto.includes('cora')) {
    return DADOS_BANCARIOS_POR_BANCO.CORA
  }

  if (texto.includes('inter')) {
    return DADOS_BANCARIOS_POR_BANCO.INTER
  }

  return ''
}


const SYNERGIAS_CONVERSAO_UNICA_V248 = 'SYNERGIAS_CONVERSAO_UNICA_V248'
const SYNERGIAS_ENDERECOS_ENTREGA_CLIENTE_V249 = 'SYNERGIAS_ENDERECOS_ENTREGA_CLIENTE_V249'

function OrcamentoForm() {
  ;(window as any).__SYNERGIAS_PDF_PRODUTOS_TAMANHO__ = 'V214_PRODUTOS_PDF_12_5'
  ;(window as any).__SYNERGIAS_PDF_SEM_DESCONTO__ = 'V211_PDF_ORCAMENTO_SEM_COLUNA_DESCONTO'
  ;(window as any).__SYNERGIAS_PDF_PRODUTOS__ = 'V210A_PRODUTOS_PDF_13_5_SEM_NEGRITO'
  ;(window as any).__SYNERGIAS_PDF_ENDERECO__ = 'V210_ENDERECO_PDF_13_5_SEM_NEGRITO'
  ;(window as any).__SYNERGIAS_PDF_ORCAMENTO__ = 'V208_PDF_ORCAMENTO_LAYOUT_CLIENTE_ENDERECO'
  const navigate = useNavigate()
  const impressaoAutomaticaExecutada = useRef(false)
  const { id } = useParams()

  const hoje = formatarDataInput(new Date())

  const [idOrcamento, setIdOrcamento] = useState<string>(gerarId())
  const [status, setStatus] = useState<StatusOrcamento>('Aberto')
  const [numero, setNumero] = useState(gerarNumeroOrcamento())
  const [pedidoOriginarioId, setPedidoOriginarioId] = useState('')
  const [pedidoOriginarioNumero, setPedidoOriginarioNumero] = useState('')

  const [vendedores, setVendedores] = useState<string[]>(carregarVendedores())
  const [vendedor, setVendedor] = useState(vendedores[0] || '')

  const [dataEmissao, setDataEmissao] = useState(hoje)
  const [dataValidade, setDataValidade] = useState(somarDiasUteis(hoje, 5))
  const [dataEntrega, setDataEntrega] = useState(somarDiasUteis(hoje, 2))

  const [clientes, setClientes] = useState<ClienteOrcamento[]>(carregarClientes())
  const [produtos, setProdutos] = useState<ProdutoBusca[]>(carregarProdutos())
  const [formasPagamento] = useState<string[]>(carregarFormasPagamento())
  const [prazosPagamento] = useState<string[]>(carregarPrazosPagamento())

  const [clienteId, setClienteId] = useState('')
  const [clienteBusca, setClienteBusca] = useState('')
  const [mostrarCreditoCliente, setMostrarCreditoCliente] = useState(false)
  const [limiteCreditoTexto, setLimiteCreditoTexto] = useState('0,00')
  const [clienteNome, setClienteNome] = useState('')
  const [clienteDocumento, setClienteDocumento] = useState('')
  const [clienteEmailNotaFiscal, setClienteEmailNotaFiscal] = useState('')
  const [clienteInscricaoEstadual, setClienteInscricaoEstadual] = useState('')
  const [clienteIndicadorIE, setClienteIndicadorIE] = useState('')
  const [enderecoFaturamento, setEnderecoFaturamento] = useState('')
  const [, setEnderecoEntrega] = useState('')
  const [enderecosEntregaLista, setEnderecosEntregaLista] = useState<string[]>([''])
  const [enderecoEntregaSelecionadoIndice, setEnderecoEntregaSelecionadoIndice] = useState(0)
  const [enderecoEntregaEditandoIndice, setEnderecoEntregaEditandoIndice] = useState<number | null>(null)

  const [cadastroClienteAberto, setCadastroClienteAberto] = useState(false)
  const [novoClienteNome, setNovoClienteNome] = useState('')
  const [novoClienteDocumento, setNovoClienteDocumento] = useState('')
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('')
  const [novoClienteEmail, setNovoClienteEmail] = useState('')
  const [novoClienteEndereco, setNovoClienteEndereco] = useState('')
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [mensagemBuscaCnpj, setMensagemBuscaCnpj] = useState('')

  const [editandoFaturamento, setEditandoFaturamento] = useState(false)
  const [editandoEntrega, setEditandoEntrega] = useState(false)

  const [observacoes, setObservacoes] = useState('')

  const [buscaItem, setBuscaItem] = useState('')
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoBusca | null>(null)
  const [quantidadeItem, setQuantidadeItem] = useState(1)
  const [valorUnitarioItemTexto, setValorUnitarioItemTexto] = useState('0,00')
  const [estoqueItemAtual, setEstoqueItemAtual] = useState(0)
  const [clienteSugestoesAbertas, setClienteSugestoesAbertas] = useState(false)
  const [clienteSugestaoAtiva, setClienteSugestaoAtiva] = useState(-1)
  const [produtoSugestoesAbertas, setProdutoSugestoesAbertas] = useState(false)
  const [produtoSugestaoAtiva, setProdutoSugestaoAtiva] = useState(-1)

  const [itens, setItens] = useState<ItemOrcamento[]>([])
  const [itemObservacaoId, setItemObservacaoId] = useState<string | null>(null)
  const [itemObservacaoTexto, setItemObservacaoTexto] = useState('')



  const [tipoDesconto, setTipoDesconto] = useState<TipoDesconto>('valor')
  const [descontoInformadoTexto, setDescontoInformadoTexto] = useState('0,00')
  const [freteTexto, setFreteTexto] = useState('0,00')
  const [outrosCustosTexto, setOutrosCustosTexto] = useState('0,00')

  const [formaPagamentoSelecionada, setFormaPagamentoSelecionada] = useState('')
  const [opcaoCobrancaSelecionada, setOpcaoCobrancaSelecionada] = useState('')
  const [prazoSelecionado, setPrazoSelecionado] = useState('')
  const [valorPagamentoTexto, setValorPagamentoTexto] = useState('0,00')
  const [pagamentos, setPagamentos] = useState<PagamentoGerado[]>([])

  const [cadastroProdutoAberto, setCadastroProdutoAberto] = useState(false)
  const [novoProdutoCodigo, setNovoProdutoCodigo] = useState('')
  const [novoProdutoNome, setNovoProdutoNome] = useState('')
  const [novoProdutoValorTexto, setNovoProdutoValorTexto] = useState('0,00')

  const statusConvertido = ['convertido', 'efetivado'].some((termo) => String(status || '').toLowerCase().includes(termo))
  const possuiPedidoOriginario = Boolean(pedidoOriginarioNumero) || Boolean(pedidoOriginarioId)
  const statusEhConcluido = statusConvertido || possuiPedidoOriginario
  const classeStatusExibicao = statusEhConcluido
    ? 'concluido'
    : String(status || 'Aberto').toLowerCase()

  function abrirPedidoOriginario() {
    const vendas = carregarVendasStorage() as Array<{
      tipo?: string
      id?: string
      numeroPedido?: string
      orcamentoOrigemId?: string
    }>
    const pedido = vendas.find(
      (venda) =>
        venda.tipo === 'Pedido' && (
          String(venda.id || '') === String(pedidoOriginarioId || '') ||
          String(venda.numeroPedido || '') === String(pedidoOriginarioNumero || '') ||
          String(venda.orcamentoOrigemId || '') === String(idOrcamento || id || '')
        ),
    )

    if (!pedido?.id) {
      alert('Pedido originário não localizado para este orçamento.')
      return
    }

    navigate(`/vendas/pedidos/editar/${pedido.id}`)
  }

  useEffect(() => {
    let ativo = true

    async function atualizarBasesCentrais() {
      try {
        const [clientesServidor, produtosServidor] = await Promise.all([
          carregarColecaoCentral<any>('clientes'),
          carregarColecaoCentral<any>('produtos'),
        ])

        if (!ativo) return

        setClientes(mapearClientesOrcamento(clientesServidor.data))

        if (Array.isArray(produtosServidor.data)) {
          setProdutos(
            produtosServidor.data.map((produto: any) => {
              const estoque = Number(
                produto.estoqueDisponivel ??
                  produto.estoqueAtual ??
                  produto.quantidadeEstoque ??
                  produto.quantidade ??
                  produto.estoque ??
                  0,
              )

              const codigoBarras = extrairCodigoBarrasValido(produto)

              return {
                id: String(produto.id || produto.codigo || gerarId()),
                codigo: codigoBarras || produto.codigo || produto.sku || produto.referencia || '',
                codigoBarras,
                nome:
                  produto.nome ||
                  produto.descricao ||
                  produto.nomeProduto ||
                  produto.produto ||
                  '',
                descricao:
                  produto.descricao ||
                  produto.nome ||
                  produto.nomeProduto ||
                  produto.produto ||
                  '',
                valorUnitario: obterValorProduto(produto),
                estoque: Number.isNaN(estoque) ? 0 : estoque,
                unidade: produto.unidade || produto.unidadeMedida || 'Unidade',
              }
            }),
          )
        }
      } catch (erro) {
        console.error('[Synergias ERP] Falha ao carregar clientes/produtos do MySQL no orçamento.', erro)
      }
    }

    function aoAtualizarStorage(event: Event) {
      const detalhe = (event as CustomEvent<{ collection?: string }>).detail
      if (!detalhe?.collection || detalhe.collection === 'clientes' || detalhe.collection === 'produtos') {
        void atualizarBasesCentrais()
      }
    }

    void atualizarBasesCentrais()
    window.addEventListener('focus', atualizarBasesCentrais)
    window.addEventListener(ERP_STORAGE_UPDATED_EVENT, aoAtualizarStorage)

    return () => {
      ativo = false
      window.removeEventListener('focus', atualizarBasesCentrais)
      window.removeEventListener(ERP_STORAGE_UPDATED_EVENT, aoAtualizarStorage)
    }
  }, [])

  useEffect(() => {
    if (!id) return

    const orcamentoEncontrado = buscarOrcamentoPorId(id)

    if (!orcamentoEncontrado) {
      alert('Orçamento não encontrado.')
      navigate('/vendas')
      return
    }

    setIdOrcamento(orcamentoEncontrado.id)
    setStatus(orcamentoEncontrado.statusOrcamento || 'Aberto')
    setPedidoOriginarioId(String((orcamentoEncontrado as any).pedidoGeradoId || ''))
    setPedidoOriginarioNumero(String((orcamentoEncontrado as any).numeroPedido || ''))
    setNumero(String(Number(String(orcamentoEncontrado.numeroOrcamento || '').replace(/\D/g, '')) || ''))
    setVendedor(orcamentoEncontrado.vendedor || '')
    setClienteId(orcamentoEncontrado.clienteId || '')
    setClienteBusca(orcamentoEncontrado.clienteNome || '')
    setClienteNome(orcamentoEncontrado.clienteNome || '')
    setClienteDocumento(orcamentoEncontrado.clienteDocumento || '')
    setClienteEmailNotaFiscal(orcamentoEncontrado.clienteEmailNotaFiscal || '')
    setClienteInscricaoEstadual(orcamentoEncontrado.clienteInscricaoEstadual || '')
    setClienteIndicadorIE(normalizarIndicadorIECliente(orcamentoEncontrado.clienteIndicadorIE, orcamentoEncontrado.clienteInscricaoEstadual))
    setDataEmissao(orcamentoEncontrado.dataEmissao || hoje)
    setDataValidade(orcamentoEncontrado.dataValidade || somarDiasUteis(hoje, 5))
    setDataEntrega(orcamentoEncontrado.dataEntrega || somarDiasUteis(hoje, 2))
    setEnderecoFaturamento(compactarEnderecoEmDuasLinhas(orcamentoEncontrado.enderecoFaturamento || ''))
    aplicarEnderecosEntrega(orcamentoEncontrado.enderecoEntrega || '')
    setItens((orcamentoEncontrado.itens || []).map((item, indice) => ({ ...item, id: String(item.id || `item-${indice}-${gerarId()}`) })))
    setTipoDesconto(orcamentoEncontrado.tipoDesconto || 'valor')
    setDescontoInformadoTexto(numeroParaCampo(orcamentoEncontrado.descontoInformado || 0))
    setFreteTexto(numeroParaCampo(orcamentoEncontrado.frete || 0))
    setOutrosCustosTexto(numeroParaCampo(orcamentoEncontrado.outrosCustos || 0))
    setPagamentos(orcamentoEncontrado.pagamentos || [])
    setObservacoes(orcamentoEncontrado.observacoes || '')
    setValorPagamentoTexto(numeroParaCampo(orcamentoEncontrado.totalFinal || 0))
  }, [id, navigate])

  useEffect(() => {
    setDataValidade(somarDiasUteis(dataEmissao, 5))
    setDataEntrega(somarDiasUteis(dataEmissao, 2))
  }, [dataEmissao])

  const valorUnitarioItem = textoMoedaParaNumero(valorUnitarioItemTexto)
  const descontoInformado = textoMoedaParaNumero(descontoInformadoTexto)
  const frete = textoMoedaParaNumero(freteTexto)
  const outrosCustos = textoMoedaParaNumero(outrosCustosTexto)
  const valorPagamento = textoMoedaParaNumero(valorPagamentoTexto)

  const subtotal = useMemo(() => {
    return Number(
      itens
        .reduce(
          (total, item) =>
            total +
            Number(item.quantidade || 0) * Number(item.valorUnitario || 0),
          0,
        )
        .toFixed(2),
    )
  }, [itens])

  const quantidadeTotalItens = useMemo(() => {
    return itens.reduce((total, item) => total + item.quantidade, 0)
  }, [itens])

  const totalItensDesconto = useMemo(() => {
    return Number(
      itens
        .reduce((total, item) => total + Number(item.desconto || 0), 0)
        .toFixed(2),
    )
  }, [itens])

  const descontoCalculado = useMemo(() => {
    if (tipoDesconto === 'percentual') {
      return (subtotal * descontoInformado) / 100 + totalItensDesconto
    }

    return descontoInformado + totalItensDesconto
  }, [tipoDesconto, subtotal, descontoInformado, totalItensDesconto])

  const totalFinal = Number(
    (subtotal - descontoCalculado + frete + outrosCustos).toFixed(2),
  )

  const totalPagamentosGerados = useMemo(() => {
    return pagamentos.reduce((total, pagamento) => total + Number(pagamento.valor || 0), 0)
  }, [pagamentos])

  const saldoRestantePagamento = useMemo(() => {
    const saldo = totalFinal - totalPagamentosGerados
    return saldo > 0 ? Number(saldo.toFixed(2)) : 0
  }, [totalFinal, totalPagamentosGerados])

  const valorExcedentePagamento = useMemo(() => {
    const excedente = totalPagamentosGerados - totalFinal
    return excedente > 0 ? Number(excedente.toFixed(2)) : 0
  }, [totalFinal, totalPagamentosGerados])

  const enderecoEntregaFinal = useMemo(() => {
    return compactarEnderecoEmDuasLinhas(
      enderecosEntregaLista[enderecoEntregaSelecionadoIndice] || ''
    )
  }, [enderecosEntregaLista, enderecoEntregaSelecionadoIndice])

  const opcoesCobrancaDisponiveis = formaPagamentoSelecionada
    ? OPCOES_COBRANCA_POR_FORMA[formaPagamentoSelecionada] || []
    : []

  const prazosDisponiveis = formaPagamentoSelecionada
    ? PRAZOS_POR_FORMA[formaPagamentoSelecionada] || prazosPagamento
    : prazosPagamento

  const dadosBancariosSelecionados = obterDadosBancariosPagamento(
    opcaoCobrancaSelecionada || formaPagamentoSelecionada
  )

  const totalItemAtual = quantidadeItem * valorUnitarioItem

  const clientesSugeridos = useMemo(() => {
    const termo = normalizarTexto(clienteBusca)

    if (!termo) return []

    return clientes
      .filter((cliente) => {
        const nome = normalizarTexto(cliente.nome)
        const documento = normalizarTexto(cliente.documento)

        return nome.includes(termo) || documento.includes(termo)
      })
      .slice(0, 10)
  }, [clientes, clienteBusca])

  useEffect(() => {
    if (!clienteSugestoesAbertas || clientesSugeridos.length === 0) {
      setClienteSugestaoAtiva(-1)
      return
    }

    setClienteSugestaoAtiva((indiceAtual) =>
      indiceAtual >= 0 && indiceAtual < clientesSugeridos.length ? indiceAtual : 0,
    )
  }, [clienteSugestoesAbertas, clientesSugeridos])

  const produtosSugeridos = useMemo(() => {
    const termo = normalizarTexto(buscaItem)

    if (!termo) return []

    return produtos
      .filter((produto) => {
        const codigo = normalizarTexto(produto.codigo)
        const nome = normalizarTexto(produto.nome)
        const descricao = normalizarTexto(produto.descricao)
        const completo = normalizarTexto(textoProduto(produto))

        return (
          codigo.includes(termo) ||
          nome.includes(termo) ||
          descricao.includes(termo) ||
          completo.includes(termo)
        )
      })
      .slice(0, 10)
  }, [produtos, buscaItem])

  useEffect(() => {
    setValorPagamentoTexto(numeroParaCampo(saldoRestantePagamento))
  }, [saldoRestantePagamento])

  function buscarClienteCompativel(texto: string) {
    const termo = normalizarTexto(texto)

    if (!termo) return null

    const exato = clientes.find((cliente) => {
      const nome = normalizarTexto(cliente.nome)
      const documento = normalizarTexto(cliente.documento)

      return nome === termo || documento === termo
    })

    if (exato) return exato

    return (
      clientes.find((cliente) => {
        const nome = normalizarTexto(cliente.nome)
        const documento = normalizarTexto(cliente.documento)

        return nome.includes(termo) || documento.includes(termo)
      }) || null
    )
  }

  const clienteSelecionadoCredito = useMemo(
    () => clientes.find((cliente) => String(cliente.id) === String(clienteId)),
    [clientes, clienteId],
  )

  const resumoCreditoCliente = useMemo(() => {
    const limiteCredito = Number(clienteSelecionadoCredito?.limiteCredito || 0)
    const limiteUtilizado = Number(
      (Number(clienteSelecionadoCredito?.totalVencidas || 0) +
        Number(clienteSelecionadoCredito?.totalAVencer || 0)).toFixed(2),
    )

    return {
      limiteCredito,
      limiteUtilizado,
      limiteDisponivel: Number((limiteCredito - limiteUtilizado).toFixed(2)),
    }
  }, [clienteSelecionadoCredito])

  function dinheiroCredito(valor: number) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function formatarMoedaCredito(valor: number) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  function converterMoedaCredito(valor: string) {
    const somenteNumeros = String(valor || '').replace(/\D/g, '')
    return somenteNumeros ? Number(somenteNumeros) / 100 : 0
  }

  function abrirCreditoCliente() {
    if (!clienteSelecionadoCredito) {
      alert('Selecione um cliente antes de consultar o crédito.')
      return
    }

    setLimiteCreditoTexto(formatarMoedaCredito(resumoCreditoCliente.limiteCredito))
    setMostrarCreditoCliente(true)
  }

  async function salvarCreditoCliente() {
    if (!clienteSelecionadoCredito) return

    const novoLimite = converterMoedaCredito(limiteCreditoTexto)

    try {
      const resposta = await carregarColecaoCentral<any>('clientes')
      const lista = Array.isArray(resposta.data) ? resposta.data : []
      const atualizada = lista.map((cliente: any) => {
        const id = String(cliente.id || cliente.codigo || '')
        return id === String(clienteSelecionadoCredito.id)
          ? { ...cliente, limiteCredito: novoLimite }
          : cliente
      })

      await salvarClientesStorageConfirmado(atualizada)
      setClientes(mapearClientesOrcamento(atualizada))
      setMostrarCreditoCliente(false)
    } catch {
      alert('Não foi possível salvar o limite de crédito do cliente no MySQL.')
    }
  }

  function selecionarCliente(cliente: ClienteOrcamento) {
    setClienteId(cliente.id)
    setClienteBusca(cliente.nome)
    setClienteNome(cliente.nome)
    setClienteDocumento(cliente.documento)
    setClienteEmailNotaFiscal(cliente.emailNotaFiscal || '')
    setClienteInscricaoEstadual(cliente.inscricaoEstadual || '')
    setClienteIndicadorIE(normalizarIndicadorIECliente(cliente.indicadorIE, cliente.inscricaoEstadual))
    setEnderecoFaturamento(compactarEnderecoEmDuasLinhas(cliente.enderecoFaturamento))
    aplicarEnderecosEntrega(
      (cliente.enderecosEntrega && cliente.enderecosEntrega.length > 0
        ? cliente.enderecosEntrega.join('\n\n')
        : cliente.enderecoEntrega || cliente.enderecoFaturamento),
    )
    setClienteSugestoesAbertas(false)
  }

  function compactarEnderecosEntrega(texto: string) {
    return String(texto || '')
      .split(/\n\s*\n+/)
      .map((endereco) => compactarEnderecoEmDuasLinhas(endereco))
      .map((endereco) => endereco.trim())
      .filter(Boolean)
  }

  function aplicarEnderecosEntrega(texto: string) {
    const enderecos = compactarEnderecosEntrega(texto)
    const listaFinal = enderecos.length > 0 ? enderecos : ['']

    setEnderecosEntregaLista(listaFinal)
    setEnderecoEntregaSelecionadoIndice(0)
    setEnderecoEntrega(listaFinal[0] || '')
    setEnderecoEntregaEditandoIndice(null)
    setEditandoEntrega(false)
  }

  function atualizarEnderecoEntregaItem(indice: number, valor: string) {
    const listaAtualizada = enderecosEntregaLista.map((endereco, enderecoIndice) =>
      enderecoIndice === indice ? valor : endereco
    )

    setEnderecosEntregaLista(listaAtualizada)

    if (indice === enderecoEntregaSelecionadoIndice) {
      setEnderecoEntrega(valor)
    }
  }

  async function persistirEnderecosEntregaCliente(lista: string[]) {
    if (!clienteId) return
    const enderecos = lista.map((endereco) => compactarEnderecoEmDuasLinhas(endereco)).filter(Boolean)
    try {
      const resposta = await carregarColecaoCentral<any>('clientes')
      const atuais = Array.isArray(resposta.data) ? resposta.data : []
      const atualizados = atuais.map((cliente: any) => {
        const codigo = String(cliente.codigo || cliente.id || '')
        if (codigo !== String(clienteId)) return cliente
        return {
          ...cliente,
          enderecosEntrega: enderecos,
          enderecoEntrega: enderecos[0] || cliente.enderecoEntrega || '',
          atualizadoEm: new Date().toISOString(),
        }
      })
      await salvarClientesStorageConfirmado(atualizados)
      setClientes(mapearClientesOrcamento(atualizados))
    } catch {
      alert('Não foi possível salvar os endereços de entrega no cadastro do cliente.')
    }
  }

  function adicionarEnderecoEntrega() {
    const listaAtualizada = [...enderecosEntregaLista, '']

    setEnderecosEntregaLista(listaAtualizada)
    setEnderecoEntregaSelecionadoIndice(listaAtualizada.length - 1)
    setEnderecoEntrega('')
    setEnderecoEntregaEditandoIndice(listaAtualizada.length - 1)
    setEditandoEntrega(true)
  }

  function removerEnderecoEntrega(indice: number) {
    const listaAtualizada = enderecosEntregaLista.filter((_, enderecoIndice) => enderecoIndice !== indice)
    const listaFinal = listaAtualizada.length > 0 ? listaAtualizada : ['']

    const novoIndice = Math.min(enderecoEntregaSelecionadoIndice, listaFinal.length - 1)

    setEnderecosEntregaLista(listaFinal)
    setEnderecoEntregaSelecionadoIndice(novoIndice)
    setEnderecoEntrega(listaFinal[novoIndice] || '')
    setEnderecoEntregaEditandoIndice(null)
    setEditandoEntrega(false)
    void persistirEnderecosEntregaCliente(listaFinal)
  }

  function selecionarEnderecoEntrega(indice: number) {
    const indiceSeguro = Math.max(0, Math.min(indice, enderecosEntregaLista.length - 1))

    setEnderecoEntregaSelecionadoIndice(indiceSeguro)
    setEnderecoEntrega(enderecosEntregaLista[indiceSeguro] || '')
    setEnderecoEntregaEditandoIndice(null)
    setEditandoEntrega(false)
    void persistirEnderecosEntregaCliente(enderecosEntregaLista)
  }

  function selecionarEnderecoEntregaAnterior() {
    selecionarEnderecoEntrega(enderecoEntregaSelecionadoIndice - 1)
  }

  function selecionarEnderecoEntregaProximo() {
    selecionarEnderecoEntrega(enderecoEntregaSelecionadoIndice + 1)
  }

  function preencherCliente(texto: string) {
    setClienteBusca(texto)

    const textoTratado = texto.trim()
    setClienteSugestoesAbertas(Boolean(textoTratado))

    if (!textoTratado) {
      setClienteId('')
      setClienteNome('')
      setClienteDocumento('')
      setClienteEmailNotaFiscal('')
      setClienteInscricaoEstadual('')
      setClienteIndicadorIE('')
      setEnderecoFaturamento('')
      aplicarEnderecosEntrega('')
      setCadastroClienteAberto(false)
      setClienteSugestoesAbertas(false)
      return
    }

    const alterouClienteSelecionado =
      clienteId &&
      normalizarTexto(textoTratado) !== normalizarTexto(clienteNome) &&
      normalizarTexto(textoTratado) !== normalizarTexto(clienteDocumento)

    if (alterouClienteSelecionado) {
      setClienteId('')
      setClienteNome('')
      setClienteDocumento('')
      setClienteEmailNotaFiscal('')
      setClienteInscricaoEstadual('')
      setClienteIndicadorIE('')
      setEnderecoFaturamento('')
      aplicarEnderecosEntrega('')
    }
  }

  function abrirCadastroClienteRapido() {
    setNovoClienteNome(clienteBusca.trim())
    setNovoClienteDocumento(clienteDocumento.trim())
    setNovoClienteTelefone('')
    setNovoClienteEmail(clienteEmailNotaFiscal.trim())
    setNovoClienteEndereco('')
    setMensagemBuscaCnpj('')
    setCadastroClienteAberto(true)
  }

  async function buscarCnpjClienteRapido(documentoInformado = novoClienteDocumento) {
    const cnpj = somenteNumeros(documentoInformado)

    if (!cnpj) {
      setMensagemBuscaCnpj('')
      return
    }

    if (cnpj.length !== 14) {
      setMensagemBuscaCnpj('Digite um CNPJ com 14 números para buscar.')
      return
    }

    setBuscandoCnpj(true)
    setMensagemBuscaCnpj('Buscando CNPJ...')

    try {
      const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)

      if (!resposta.ok) {
        throw new Error('CNPJ não encontrado.')
      }

      const dados = await resposta.json()

      const nome =
        dados.razao_social ||
        dados.nome_fantasia ||
        dados.nome ||
        novoClienteNome ||
        clienteBusca

      const telefone =
        dados.ddd_telefone_1 ||
        dados.ddd_telefone_2 ||
        dados.telefone ||
        novoClienteTelefone

      const email = dados.email || novoClienteEmail

      const endereco = montarEnderecoDuasLinhas(
        [dados.logradouro, dados.numero].filter(Boolean).join(', '),
        [
          dados.complemento,
          dados.bairro,
          [dados.municipio, dados.uf].filter(Boolean).join(' / '),
          dados.cep ? `CEP: ${formatarCep(String(dados.cep))}` : '',
          'Brasil',
        ]
      )

      setNovoClienteNome(String(nome || '').trim())
      setNovoClienteDocumento(formatarCnpj(cnpj))
      setNovoClienteTelefone(formatarTelefoneBrasil(String(telefone || '').trim()))
      setNovoClienteEmail(String(email || '').trim())
      setNovoClienteEndereco(endereco)
      setMensagemBuscaCnpj('CNPJ encontrado e dados preenchidos.')
    } catch {
      setMensagemBuscaCnpj('CNPJ não encontrado. Preencha os dados manualmente.')
    } finally {
      setBuscandoCnpj(false)
    }
  }

  async function salvarClienteRapido() {
    const nome = novoClienteNome.trim() || clienteBusca.trim()

    if (!nome) {
      alert('Informe o nome do cliente.')
      return
    }

    const idNovoCliente = gerarId()
    const endereco = novoClienteEndereco.trim()
    const documento = novoClienteDocumento.trim()

    const clienteParaStorage = {
      id: idNovoCliente,
      codigo: idNovoCliente,
      razaoSocial: nome,
      nomeFantasia: nome,
      nome,
      cnpj: documento,
      cpf: '',
      documento,
      telefone: novoClienteTelefone.trim(),
      email: novoClienteEmail.trim(),
      emailNotaFiscal: novoClienteEmail.trim(),
      endereco,
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      pais: 'Brasil',
      mesmoEnderecoFiscal: true,
      situacao: 'Ativo',
      criadoEm: new Date().toISOString(),
      itensEditadosManual: true,
    }

    try {
      const resposta = await carregarColecaoCentral<any>('clientes')
      const clientesServidor = Array.isArray(resposta.data) ? resposta.data : []
      const atualizados = [...clientesServidor, clienteParaStorage]

      await salvarClientesStorageConfirmado(atualizados)

      const novoClienteOrcamento: ClienteOrcamento = {
        id: idNovoCliente,
        nome,
        documento,
        emailNotaFiscal: novoClienteEmail.trim(),
        enderecoFaturamento: endereco,
        enderecoEntrega: endereco,
        enderecosEntrega: endereco ? [endereco] : [],
        limiteCredito: 10000,
        totalVencidas: 0,
        totalAVencer: 0,
        totalPagas: 0,
        inscricaoEstadual: '',
        indicadorIE: '',
      }

      setClientes(mapearClientesOrcamento(atualizados))
      selecionarCliente(novoClienteOrcamento)
      setCadastroClienteAberto(false)
    } catch {
      alert('Não foi possível cadastrar o cliente no MySQL.')
    }
  }

  function confirmarClienteSelecionado() {
    const clienteEncontrado = buscarClienteCompativel(clienteBusca)

    if (clienteEncontrado) {
      selecionarCliente(clienteEncontrado)
    }
  }

  function clienteEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setClienteSugestoesAbertas(true)
      setClienteSugestaoAtiva((indiceAtual) =>
        Math.min(indiceAtual < 0 ? 0 : indiceAtual + 1, clientesSugeridos.length - 1),
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setClienteSugestoesAbertas(true)
      setClienteSugestaoAtiva((indiceAtual) => Math.max(indiceAtual - 1, 0))
      return
    }

    if (event.key === 'Escape') {
      setClienteSugestoesAbertas(false)
      setClienteSugestaoAtiva(-1)
      return
    }

    if (event.key !== 'Enter') return

    event.preventDefault()
    const clienteAtivo = clientesSugeridos[clienteSugestaoAtiva]
    if (clienteAtivo) {
      selecionarCliente(clienteAtivo)
      return
    }

    confirmarClienteSelecionado()
  }

  function adicionarVendedor() {
    const nomeNovoVendedor = window.prompt('Digite o nome do novo vendedor:')

    if (!nomeNovoVendedor || !nomeNovoVendedor.trim()) return

    const nomeTratado = nomeNovoVendedor.trim()

    if (vendedores.includes(nomeTratado)) {
      setVendedor(nomeTratado)
      return
    }

    const vendedoresAtualizados = [...vendedores, nomeTratado]

    setVendedores(vendedoresAtualizados)
    setVendedor(nomeTratado)
    salvarVendedores(vendedoresAtualizados)
  }

  function textoProduto(produto: ProdutoBusca) {
    return `${produto.codigo ? `${produto.codigo} - ` : ''}${produto.nome}`
  }

  function buscarProdutoCompativel(texto: string) {
    const termo = normalizarTexto(texto)

    if (!termo) return null

    const exato = produtos.find((produto) => {
      const codigo = normalizarTexto(produto.codigo)
      const nome = normalizarTexto(produto.nome)
      const descricao = normalizarTexto(produto.descricao)
      const completo = normalizarTexto(textoProduto(produto))

      return termo === codigo || termo === nome || termo === descricao || termo === completo
    })

    if (exato) return exato

    return (
      produtos.find((produto) => {
        const codigo = normalizarTexto(produto.codigo)
        const nome = normalizarTexto(produto.nome)
        const descricao = normalizarTexto(produto.descricao)
        const completo = normalizarTexto(textoProduto(produto))

        return (
          codigo.includes(termo) ||
          nome.includes(termo) ||
          descricao.includes(termo) ||
          completo.includes(termo)
        )
      }) || null
    )
  }

  function selecionarProduto(produto: ProdutoBusca) {
    setProdutoSelecionado(produto)
    setBuscaItem(textoProduto(produto))
    setQuantidadeItem(1)
    setValorUnitarioItemTexto(numeroParaCampo(produto.valorUnitario))
    setEstoqueItemAtual(produto.estoque)
    setProdutoSugestoesAbertas(false)
  }

  function limparProdutoSelecionado() {
    setProdutoSelecionado(null)
    setValorUnitarioItemTexto('0,00')
    setEstoqueItemAtual(0)
  }

  function preencherProduto(texto: string) {
    setBuscaItem(texto)
    setProdutoSugestoesAbertas(Boolean(texto.trim()))

    if (!texto.trim()) {
      limparProdutoSelecionado()
      setProdutoSugestoesAbertas(false)
      return
    }

    setProdutoSelecionado(null)
    setEstoqueItemAtual(0)
  }

  function confirmarProdutoSelecionado() {
    const produtoEncontrado = buscarProdutoCompativel(buscaItem)

    if (produtoEncontrado) {
      selecionarProduto(produtoEncontrado)
    }
  }

  function produtoEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setProdutoSugestoesAbertas(true)
      setProdutoSugestaoAtiva((indiceAtual) =>
        Math.min(indiceAtual < 0 ? 0 : indiceAtual + 1, produtosSugeridos.length - 1),
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setProdutoSugestoesAbertas(true)
      setProdutoSugestaoAtiva((indiceAtual) => Math.max(indiceAtual - 1, 0))
      return
    }

    if (event.key === 'Escape') {
      setProdutoSugestoesAbertas(false)
      setProdutoSugestaoAtiva(-1)
      return
    }

    if (event.key !== 'Enter') return

    event.preventDefault()
    const produtoAtivo = produtosSugeridos[produtoSugestaoAtiva]
    if (produtoAtivo) {
      selecionarProduto(produtoAtivo)
      return
    }

    confirmarProdutoSelecionado()
  }

  const clienteNaoLocalizado =
    clienteBusca.trim().length > 0 &&
    clienteId === '' &&
    !cadastroClienteAberto &&
    clientesSugeridos.length === 0 &&
    !buscarClienteCompativel(clienteBusca)

  const produtoNaoLocalizado =
    buscaItem.trim().length > 0 &&
    produtoSelecionado === null &&
    produtosSugeridos.length === 0

  function alterarQuantidade(valor: number) {
    if (valor < 1 || Number.isNaN(valor)) {
      setQuantidadeItem(1)
      return
    }

    setQuantidadeItem(valor)
  }

  function diminuirQuantidade() {
    setQuantidadeItem((quantidadeAtual) => {
      if (quantidadeAtual <= 1) return 1
      return quantidadeAtual - 1
    })
  }

  function aumentarQuantidade() {
    setQuantidadeItem((quantidadeAtual) => quantidadeAtual + 1)
  }

  // V144: o valor digitado no orçamento prevalece sobre o preço original.
  function incluirItemNoPedido() {
    const produtoEncontrado = produtoSelecionado || buscarProdutoCompativel(buscaItem)

    const descricaoItem =
      produtoEncontrado?.nome || produtoEncontrado?.descricao || buscaItem.trim()

    if (!descricaoItem) {
      alert('Digite o nome ou código do item.')
      return
    }

    const novoItem: ItemOrcamento = {
      id: gerarId(),
      produtoId: produtoEncontrado?.id || '',
      codigo: produtoEncontrado?.codigoBarras || produtoEncontrado?.codigo || '',
      codigoBarras: produtoEncontrado?.codigoBarras || produtoEncontrado?.codigo || '',
      descricao: descricaoItem,
      unidade: produtoEncontrado?.unidade || 'Unidade',
      quantidade: quantidadeItem,
      valorUnitario: valorUnitarioItem,
      desconto: 0,
      estoqueDisponivel: produtoEncontrado?.estoque || estoqueItemAtual || 0,
    }

    setItens((itensAtuais) => [...itensAtuais, novoItem])

    setBuscaItem('')
    setProdutoSelecionado(null)
    setQuantidadeItem(1)
    setValorUnitarioItemTexto('0,00')
    setEstoqueItemAtual(0)
  }

  async function abrirCadastroProdutoRapido() {
    try {
      const [respostaProdutos, codigo] = await Promise.all([
        carregarColecaoCentral<ProdutoBusca>('produtos'),
        consultarProximoCodigoProdutoRapido(),
      ])
      if (!Array.isArray(respostaProdutos.data)) {
        throw new Error('O servidor não retornou a lista de produtos.')
      }

      setProdutos(respostaProdutos.data)
      setNovoProdutoCodigo(codigo)
      setNovoProdutoNome(buscaItem.trim())
      setNovoProdutoValorTexto('0,00')
      setCadastroProdutoAberto(true)
    } catch (erro) {
      console.error('[Synergias ERP] Falha ao consultar a sequência oficial de produtos.', erro)
      alert('Não foi possível consultar a sequência oficial. O cadastro foi bloqueado para evitar código duplicado ou fora de ordem.')
    }
  }

  // V148: o servidor reserva e grava o código dentro da mesma transação.
  async function adicionarProdutoNovo() {
    const nome = novoProdutoNome.trim()
    if (!nome) {
      alert('Informe o nome do produto.')
      return
    }

    try {
      const resultado = await criarProdutoRapidoNoServidor({
        id: gerarId(),
        nome,
        descricao: nome,
        valorUnitario: textoMoedaParaNumero(novoProdutoValorTexto),
        estoque: 0,
        unidade: 'Unidade',
      })
      const produtoConfirmado = resultado.produto as ProdutoBusca
      const produtosConfirmados = resultado.data as ProdutoBusca[]
      setNovoProdutoCodigo(resultado.codigo)
      setProdutos(produtosConfirmados)
      salvarProdutosStorage(produtosConfirmados as any)
      selecionarProduto(produtoConfirmado)
      setCadastroProdutoAberto(false)
      alert(`Produto criado com sucesso. Código de barras: ${resultado.codigo}`)
    } catch (erro) {
      console.error('[Synergias ERP] Falha ao criar produto pelo orçamento.', erro)
      alert(`O produto não foi criado. ${erro instanceof Error ? erro.message : 'Falha ao gravar no servidor.'}`)
    }
  }

  function removerItem(id: string) {
    setItens((itensAtuais) => itensAtuais.filter((item) => String(item.id) !== String(id)))
  }

  function atualizarQuantidadeItemAdicionado(id: string, quantidade: number) {
    setItens((itensAtuais) =>
      itensAtuais.map((item) =>
        item.id === id
          ? {
              ...item,
              quantidade: quantidade < 1 || Number.isNaN(quantidade) ? 1 : quantidade,
            }
          : item
      )
    )
  }

  function atualizarValorUnitarioItemAdicionado(id: string, valorTexto: string) {
    const valor = textoMoedaParaNumero(valorTexto)

    setItens((itensAtuais) =>
      itensAtuais.map((item) =>
        item.id === id
          ? {
              ...item,
              valorUnitario: valor,
            }
          : item
      )
    )
  }

  function abrirObservacaoItem(item: ItemOrcamento) {
    setItemObservacaoId(item.id)
    setItemObservacaoTexto(item.observacaoItem || '')
  }

  function fecharObservacaoItem() {
    setItemObservacaoId(null)
    setItemObservacaoTexto('')
  }

  function confirmarObservacaoItem() {
    if (!itemObservacaoId) return

    setItens((itensAtuais) =>
      itensAtuais.map((item) =>
        item.id === itemObservacaoId
          ? { ...item, observacaoItem: itemObservacaoTexto.trim() }
          : item,
      ),
    )
    fecharObservacaoItem()
  }

  function montarOrcamento(statusAtual: StatusOrcamento = status): VendaStorage {
    const registroAtual = buscarOrcamentoPorId(idOrcamento)
    return {
      ...(registroAtual || {}),
      id: idOrcamento,
      tipo: 'Orçamento',
      numeroOrcamento: numero,
      vendedor,
      clienteId,
      clienteNome: clienteNome || clienteBusca,
      clienteDocumento,
      clienteEmailNotaFiscal: clienteEmailNotaFiscal.trim(),
      clienteInscricaoEstadual: clienteIndicadorIE === '9' ? '' : clienteInscricaoEstadual.trim(),
      clienteIndicadorIE,
      dataEmissao,
      dataValidade,
      dataEntrega,
      enderecoFaturamento: compactarEnderecoEmDuasLinhas(enderecoFaturamento),
      enderecoEntrega: enderecoEntregaFinal,
      itens,
      tipoDesconto,
      descontoInformado,
      descontoCalculado,
      frete,
      outrosCustos,
      subtotal,
      totalFinal,
      pagamentos,
      observacoes,
      statusOrcamento: statusAtual,
      criadoEm: new Date().toISOString(),
      itensEditadosManual: true,
    }
  }

  async function salvar(statusAtual: StatusOrcamento = status, voltar = false, silencioso = false) {
    const orcamento = montarOrcamento(statusAtual)

    try {
      await salvarOrcamentoStorage(orcamento)
      void persistirEnderecosEntregaCliente(enderecosEntregaLista)
      setStatus(statusAtual)

      if (!silencioso) {
        alert('Orçamento salvo com sucesso.')
      }

      if (voltar) {
        navigate('/vendas')
      }

      return true
    } catch (erro) {
      console.error('[Synergias ERP] O MySQL não confirmou o orçamento.', erro)
      if (!silencioso) {
        alert(
          erro instanceof Error
            ? `Não foi possível salvar o orçamento no MySQL: ${erro.message}`
            : 'Não foi possível salvar o orçamento no MySQL.',
        )
      }
      return false
    }
  }

  function gerarPedido() {
    const vendas = carregarVendasStorage() as Array<{
      tipo?: string
      id?: string
      numeroPedido?: string
      orcamentoOrigemId?: string
      orcamentoOrigemNumero?: string
      numeroOrcamento?: string
    }>
    const numeroAtual = String(numero || '').trim()
    const existente = vendas.find((registro) => {
      const tipo = String(registro.tipo || '').toLowerCase()
      if (!tipo.includes('pedido')) return false
      return (
        String(registro.orcamentoOrigemId || '') === String(idOrcamento || id || '') ||
        String(registro.orcamentoOrigemNumero || '') === numeroAtual ||
        String(registro.numeroOrcamento || '') === numeroAtual
      )
    })

    if (existente?.id) {
      navigate(`/vendas/pedidos/editar/${existente.id}`)
      return
    }

    setStatus('Aprovado')
    salvar('Aprovado', false, true)
    navigate(`/vendas/pedidos/novo?orcamentoId=${idOrcamento}`)
  }

  function alterarFormaPagamentoOrcamento(formaPagamento: string) {
    setFormaPagamentoSelecionada(formaPagamento)

    const opcoes = OPCOES_COBRANCA_POR_FORMA[formaPagamento] || []
    const prazos = PRAZOS_POR_FORMA[formaPagamento] || []

    setOpcaoCobrancaSelecionada(opcoes.length === 1 ? opcoes[0] : '')
    setPrazoSelecionado(prazos.length === 1 ? prazos[0] : '')

    setValorPagamentoTexto(numeroParaCampo(saldoRestantePagamento))
  }

  function gerarCobranca() {
    if (!formaPagamentoSelecionada) {
      alert('Selecione a forma de pagamento.')
      return
    }

    if (opcoesCobrancaDisponiveis.length > 0 && !opcaoCobrancaSelecionada) {
      alert('Selecione a cobrança/banco.')
      return
    }

    if (!prazoSelecionado) {
      alert('Selecione o prazo.')
      return
    }

    if (valorPagamento <= 0) {
      alert('Informe o valor da cobrança.')
      return
    }

    if (saldoRestantePagamento <= 0) {
      alert('Não há saldo restante para gerar nova cobrança.')
      return
    }

    if (valorPagamento > saldoRestantePagamento) {
      alert(`O valor da cobrança é maior que o saldo restante de ${formatarMoeda(saldoRestantePagamento)}.`)
      setValorPagamentoTexto(numeroParaCampo(saldoRestantePagamento))
      return
    }

    const diasPrazos = calcularDiasPrazos(prazoSelecionado)
    const descricaoPagamento = opcaoCobrancaSelecionada || formaPagamentoSelecionada
    const valorParcelaBase = Number((valorPagamento / diasPrazos.length).toFixed(2))

    const novasCobrancas: PagamentoGerado[] = diasPrazos.map((diasPrazo, indice) => {
      const ehUltimaParcela = indice === diasPrazos.length - 1
      const valorParcela = ehUltimaParcela
        ? Number((valorPagamento - valorParcelaBase * (diasPrazos.length - 1)).toFixed(2))
        : valorParcelaBase

      const vencimentoBase = somarDiasCorridos(dataEmissao, diasPrazo)

      const observacaoParcela =
        diasPrazos.length > 1 ? `Parcela ${indice + 1}/${diasPrazos.length}` : ''

      const dadosBancarios = obterDadosBancariosPagamento(descricaoPagamento)

      return {
        id: gerarId(),
        formaPagamento: descricaoPagamento,
        prazo: prazoSelecionado,
        vencimento: ajustarVencimentoCobranca(vencimentoBase, descricaoPagamento),
        observacoes: [observacaoParcela, dadosBancarios].filter(Boolean).join('\n\n'),
        valor: valorParcela,
      }
    })

    setPagamentos((pagamentosAtuais) => [...pagamentosAtuais, ...novasCobrancas])
    setValorPagamentoTexto(
      numeroParaCampo(Math.max(saldoRestantePagamento - valorPagamento, 0))
    )
  }

  function removerPagamento(id: string) {
    setPagamentos((pagamentosAtuais) =>
      pagamentosAtuais.filter((pagamento) => pagamento.id !== id)
    )
  }

  function atualizarPagamento(
    id: string,
    campo: keyof PagamentoGerado,
    valor: string | number
  ) {
    setPagamentos((pagamentosAtuais) =>
      pagamentosAtuais.map((pagamento) =>
        pagamento.id === id
          ? {
              ...pagamento,
              [campo]: valor,
            }
          : pagamento
      )
    )
  }

  function limparFormularioNovo() {
    const novoId = gerarId()
    const novoNumero = gerarNumeroOrcamento()

    setIdOrcamento(novoId)
    setStatus('Aberto')
    setNumero(novoNumero)
    setDataEmissao(hoje)
    setDataValidade(somarDiasUteis(hoje, 5))
    setDataEntrega(somarDiasUteis(hoje, 2))
    setClienteId('')
    setClienteBusca('')
    setClienteNome('')
    setClienteDocumento('')
    setClienteEmailNotaFiscal('')
    setEnderecoFaturamento('')
    aplicarEnderecosEntrega('')
    setItens([])
    setTipoDesconto('valor')
    setDescontoInformadoTexto('0,00')
    setFreteTexto('0,00')
    setOutrosCustosTexto('0,00')
    setPagamentos([])
    setObservacoes('')
    setFormaPagamentoSelecionada('')
    setOpcaoCobrancaSelecionada('')
    setPrazoSelecionado('')
    setValorPagamentoTexto('0,00')
    setBuscaItem('')
    limparProdutoSelecionado()

    navigate('/vendas/orcamentos/novo')
  }

  function novoOrcamento() {
    const confirmar = window.confirm(
      'Deseja iniciar um novo orçamento em branco? As informações não salvas serão perdidas.'
    )

    if (!confirmar) return

    limparFormularioNovo()
  }

  function duplicarOrcamento() {
    const confirmar = window.confirm('Deseja duplicar este orçamento?')

    if (!confirmar) return

    salvar(status, false, true)

    const novoId = gerarId()
    const novoNumero = gerarNumeroOrcamento()
    const novaData = hoje

    const itensDuplicados = itens.map((item) => ({
      ...item,
      id: gerarId(),
    }))

    const pagamentosDuplicados = pagamentos.map((pagamento) => ({
      ...pagamento,
      id: gerarId(),
    }))

    const duplicado: VendaStorage = {
      ...montarOrcamento('Aberto'),
      id: novoId,
      numeroOrcamento: novoNumero,
      dataEmissao: novaData,
      dataValidade: somarDiasUteis(novaData, 5),
      dataEntrega: somarDiasUteis(novaData, 2),
      itens: itensDuplicados,
      pagamentos: pagamentosDuplicados,
      statusOrcamento: 'Aberto',
      criadoEm: new Date().toISOString(),
      itensEditadosManual: true,
    }

    salvarOrcamentoStorage(duplicado)

    setIdOrcamento(novoId)
    setNumero(novoNumero)
    setDataEmissao(novaData)
    setDataValidade(somarDiasUteis(novaData, 5))
    setDataEntrega(somarDiasUteis(novaData, 2))
    setItens(itensDuplicados)
    setPagamentos(pagamentosDuplicados)
    setStatus('Aberto')

    navigate(`/vendas/orcamentos/editar/${novoId}`)

    alert(`Orçamento duplicado com sucesso. Novo número: ${novoNumero}`)
  }

  function enviarEmail() {
    salvar(status, false, true)

    const assunto = encodeURIComponent(`Orçamento Synergias nº ${numero || ''}`)

    const corpo = encodeURIComponent(
      `Olá,\n\nSegue orçamento da Synergias Distribuidora para análise.\n\nCliente: ${
        clienteNome || clienteBusca || '-'
      }\nValor total: ${formatarMoeda(
        totalFinal
      )}\n\nAnexe o PDF gerado pelo ERP antes de enviar.\n\nAtenciosamente,\nSynergias Distribuidora`
    )

    alert(
      'O e-mail será aberto com a mensagem pronta. Por segurança do navegador, o PDF não pode ser anexado automaticamente usando mailto. Gere o PDF e anexe no e-mail.'
    )

    window.location.href = `mailto:?subject=${assunto}&body=${corpo}`
  }

  function abrirLista() {
    navigate('/vendas')
  }

  function montarHtmlPdf() {
    const nomeArquivo = gerarNomeArquivoPdf(numero, clienteNome || clienteBusca, dataEmissao)

    const linhasItens = itens
      .map((item) => {
        const totalLinha = item.quantidade * item.valorUnitario - item.desconto

        return `
          <tr>
            <td class="item-descricao">${escaparHtml(item.descricao)}${item.observacaoItem ? `<div class="item-observacao">${escaparHtml(item.observacaoItem)}</div>` : ''}</td>
            <td class="right">${numeroParaMoeda(item.quantidade)}</td>
            <td class="right">${formatarMoeda(item.valorUnitario)}</td>
            <td class="right">${formatarMoeda(totalLinha)}</td>
          </tr>
        `
      })
      .join('')

    const linhasPagamento = pagamentos
      .map((pagamento, index) => {
        return `
          <tr>
            <td>${escaparHtml(pagamento.formaPagamento)} (${escaparHtml(
              pagamento.prazo
            )}) [${index + 1}/${pagamentos.length}]</td>
            <td>${formatarDataBR(pagamento.vencimento)}</td>
            <td class="right">${formatarMoeda(pagamento.valor)}</td>
            <td>${escaparHtml(pagamento.observacoes || '')}</td>
          </tr>
        `
      })
      .join('')

    const dadosBancariosSelecionadosPdf = obterDadosBancariosPagamento(
      opcaoCobrancaSelecionada || formaPagamentoSelecionada
    )

    const dadosBancariosJaEstaoNasParcelas = pagamentos.some((pagamento) =>
      String(pagamento.observacoes || '').includes('Dados para transferência')
    )

    const blocoDadosBancariosPdf =
      dadosBancariosSelecionadosPdf && !dadosBancariosJaEstaoNasParcelas
        ? `
          <div class="section-title">Dados bancários para pagamento</div>
          <div class="observacoes">${escaparHtml(dadosBancariosSelecionadosPdf)}</div>
        `
        : ''

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>${escaparHtml(nomeArquivo)}</title>

<style>
  @page {
    size: A4 portrait;
    margin: 10mm;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111827;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.35;
  }

  body {
    width: 190mm;
    min-height: 277mm;
    margin: 0 auto;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .document-content {
    display: block;
    min-height: 0;
    padding-bottom: 12mm;
  }

  .top-number {
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 4mm;
  }

  .header {
    display: grid;
    grid-template-columns: 29mm 1fr;
    gap: 5mm;
    align-items: start;
    margin-bottom: 3mm;
  }

  .logo-box {
    width: 26mm;
    height: 26mm;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-box img {
    width: 24mm;
    max-width: 24mm;
    height: auto;
    object-fit: contain;
  }

  .logo-fallback {
    width: 30mm;
    height: 30mm;
    border: 2px solid #111827;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 10px;
    text-align: center;
  }

  .company {
    text-align: right;
    font-size: 10px;
    line-height: 1.35;
    letter-spacing: 0.4px;
    color: #111827;
  }

  .company strong {
    font-size: 11px;
  }

  .section-title {
    border-bottom: 1px solid #94a3b8;
    padding: 5px 0 4px 9px;
    margin: 4mm 0 2mm;
    font-size: 10.5px;
    font-weight: 900;
    text-transform: uppercase;
    position: relative;
    letter-spacing: 0.4px;
    color: #000000;
  }

  .section-title::before {
    content: '';
    position: absolute;
    left: 0;
    top: 4px;
    width: 3px;
    height: 13px;
    background: #94a3b8;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 2mm 5mm;
    margin: 0 0 2mm 9px;
    font-size: 10px;
  }

  .info-grid strong {
    font-weight: 800;
  }

  .info-grid .cliente-linha-completa {
    grid-column: span 2;
    min-width: 0;
    white-space: nowrap;
    font-size: 10px;
  }

  .address-text {
    margin-left: 9px;
    white-space: pre-line;
    line-height: 1.4;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    min-height: 4mm;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }

  th {
    font-size: 9px;
    text-align: left;
    padding: 3px 4px;
    font-weight: 900;
    border-bottom: 1px solid #cbd5e1;
    color: #000000;
  }

  td {
    font-size: 9px;
    padding: 3px 4px;
    vertical-align: top;
    color: #111827;
  }

  .right {
    text-align: right;
    white-space: nowrap;
  }

  /* SYNERGIAS_PDF_ORCAMENTO_SEM_CODIGO_DESCRICAO_14_V205 */
  .itens-pdf-table {
    table-layout: fixed;
  }

  .itens-pdf-table th:nth-child(1),
  .itens-pdf-table td:nth-child(1) { width: 64%; }
  .itens-pdf-table th:nth-child(2),
  .itens-pdf-table td:nth-child(2),
  .itens-pdf-table th:nth-child(3),
  .itens-pdf-table td:nth-child(3),
  .itens-pdf-table th:nth-child(4),
  .itens-pdf-table td:nth-child(4) { width: 12%; }

  .itens-pdf-table td.item-descricao {
    font-size: 12.5px;
    line-height: 1.22;
    font-weight: 400;
    overflow-wrap: anywhere;
  }

  .itens-pdf-table .item-observacao {
    margin-top: 4px;
    font-size: 11px;
    line-height: 1.25;
    font-weight: 600;
    color: #475569;
  }

  .summary-box {
    margin: 3mm 0 2mm auto;
    width: max-content;
    max-width: 100%;
    border: 1px solid #94a3b8;
    border-radius: 5px;
    padding: 5px 9px;
    display: flex;
    justify-content: flex-end;
    gap: 14mm;
    font-size: 10px;
    font-weight: 800;
  }

  .totals-table {
    table-layout: fixed;
  }

  .totals-table th,
  .totals-table td {
    width: 20%;
    text-align: center;
  }

  .totals-table td,
  .totals-table th {
    font-size: 9.5px;
    padding: 4px 4px;
  }

  .total-destaque {
    display: inline-block;
    min-width: 24mm;
    border: 1px solid #94a3b8;
    border-radius: 4px;
    padding: 6px 8px;
    font-weight: 900;
    text-align: right;
  }

  .observacoes {
    min-height: 8mm;
    padding: 6px 9px;
    white-space: pre-line;
    font-size: 10px;
  }

  .fechamento-final {
    width: 100%;
    margin-top: 7mm;
    padding-top: 3mm;
    border-top: 1px solid #cbd5e1;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8mm;
    font-size: 9px;
    color: #111827;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .erp-sign {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    font-weight: 900;
    font-size: 14px;
  }

  .erp-sign .green {
    background: #7ac943;
    color: #fff;
    padding: 1px 4px;
    border-radius: 3px;
    transform: rotate(-5deg);
    display: inline-block;
  }

  .erp-sign .script {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }
  .recebimento-area {
    width: 100%;
    margin-top: 5mm;
    padding-top: 0;
    display: flex;
    justify-content: flex-end;
    page-break-inside: avoid;
  }

  .recebimento-box-horizontal {
    width: 82mm;
    font-size: 10px;
    color: #111827;
  }

  .recebimento-assinatura-horizontal {
    width: 100%;
  }

  .linha-assinatura {
    width: 100%;
    height: 8mm;
    border-bottom: 1px solid #111827;
  }

  .assinatura-label {
    text-align: center;
    font-size: 9px;
    color: #374151;
    margin-top: 1.5mm;
  }

  .recebimento-data-horizontal {
    margin-top: 9mm;
    text-align: center;
    white-space: nowrap;
    font-size: 9px;
  }
  @media print {
    html,
    body {
      width: 190mm;
      min-height: 277mm;
      margin: 0 auto;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }


  /* PDF LIMPO - SOMENTE LINHA ABAIXO DOS TÍTULOS PRINCIPAIS */
  table,
  thead,
  tbody,
  tr,
  th,
  td,
  .totals-table,
  .totals-table tr,
  .totals-table th,
  .totals-table td,
  .pagamento-tabela,
  .pagamento-tabela tr,
  .pagamento-tabela th,
  .pagamento-tabela td,
  .itens-pdf-table,
  .itens-pdf-table tr,
  .itens-pdf-table th,
  .itens-pdf-table td,
  .summary-box,
  .total-destaque,
  .address-text,
  .observacoes,
  .recebimento-area,
  .recebimento-box-horizontal,
  .recebimento-data-horizontal,
  .recebimento-assinatura-horizontal,
  .linha-assinatura {
    border: 0 !important;
    border-top: 0 !important;
    border-right: 0 !important;
    border-bottom: 0 !important;
    border-left: 0 !important;
    box-shadow: none !important;
    outline: none !important;
  }

  table {
    border-collapse: separate !important;
    border-spacing: 0 !important;
  }

  th,
  td {
    background: transparent !important;
  }

  .section-title {
    border: 0 !important;
    border-bottom: 1.5px solid #8b8b8b !important;
    padding: 5px 0 5px 0 !important;
    margin: 4mm 0 2mm !important;
    color: #000000 !important;
  }

  .section-title::before {
    display: none !important;
    content: none !important;
  }

  .pagamento-tabela th:nth-child(4),
  .pagamento-tabela td:nth-child(4) {
    padding-left: 28px !important;
    white-space: pre-line !important;
  }

  .pagamento-tabela th:nth-child(3),
  .pagamento-tabela td:nth-child(3) {
    padding-right: 18px !important;
  }

  .summary-box {
    border: 1px solid #94a3b8 !important;
  }

  .total-destaque {
    border: 1px solid #6b7280 !important;
  }

  .linha-assinatura {
    border-bottom: 1px solid #111827 !important;
  }

</style>
        </head>

        <body>
          <div class="document-content">
          <div class="top-number">Orçamento: ${escaparHtml(numero)}</div>

          <div class="header">
            <div class="logo-box">
              <img src="${LOGO_PUBLIC_PATH}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
              <div class="logo-fallback" style="display:none;">
                <span>SYNERGIAS</span>
                <small>ERP</small>
              </div>
            </div>

            <div class="company">
              <strong>${EMPRESA_NOME}</strong><br />
              ${EMPRESA_FANTASIA}<br />
              CNPJ: ${EMPRESA_CNPJ}<br />
              ${EMPRESA_ENDERECO}<br />
              ${EMPRESA_CIDADE}<br />
              ${EMPRESA_TELEFONE}
            </div>
          </div>

          <div class="section-title">Orçamento de venda</div>

          <div class="info-grid">
            <div>Orçamento: <strong>${escaparHtml(numero)}</strong></div>
            <div>Vendedor: <strong>${escaparHtml(vendedor)}</strong></div>
            <div>Status: <strong>${escaparHtml(status)}</strong></div>
            <div class="cliente-linha-completa">Cliente: <strong>${escaparHtml(clienteNome || clienteBusca)}</strong></div>
            <div>CNPJ/CPF: <strong>${escaparHtml(clienteDocumento)}</strong></div>
            <div>Emissão: <strong>${formatarDataBR(dataEmissao)}</strong></div>
            <div>Entrega: <strong>${formatarDataBR(dataEntrega)}</strong></div>
            <div>Validade: <strong>${formatarDataBR(dataValidade)}</strong></div>
          </div>

          <div class="section-title">Endereço de entrega</div>
          <div class="address-text">${escaparHtml(String(enderecoEntregaFinal || '').toLocaleUpperCase('pt-BR'))}</div>

          <div class="section-title">Itens do orçamento</div>

          <table class="itens-pdf-table" data-synergias-pdf-v205="1">
            <thead>
              <tr>
                <th>Descrição</th>
                <th class="right">Quantidade</th>
                <th class="right">Unitário</th>
                <th class="right">Total</th>
              </tr>
            </thead>

            <tbody>
              ${linhasItens || '<tr><td colspan="4">Nenhum item informado.</td></tr>'}
            </tbody>
          </table>

          <div class="summary-box">
            <span>Quantidade de Itens: ${numeroParaMoeda(quantidadeTotalItens)}</span>
            <span>Valor total dos itens: ${formatarMoeda(subtotal)}</span>
          </div>

          <div class="section-title">Valor total de orçamento</div>

          <table class="totals-table">
            <thead>
              <tr>
                <th>Total dos Itens</th>
                <th>Desconto</th>
                <th>Frete</th>
                <th>Outros</th>
                <th class="right">Valor Total</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td><strong>${formatarMoeda(subtotal)}</strong></td>
                <td><strong>${formatarMoeda(descontoCalculado)}</strong></td>
                <td><strong>${formatarMoeda(frete)}</strong></td>
                <td><strong>${formatarMoeda(outrosCustos)}</strong></td>
                <td class="right"><span class="total-destaque">${formatarMoeda(totalFinal)}</span></td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Forma / Condições de pagamento</div>

          <table class="pagamento-tabela">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Vencimento</th>
                <th class="right">Valor</th>
                <th>Observação</th>
              </tr>
            </thead>

            <tbody>
              ${
                linhasPagamento ||
                '<tr><td colspan="4">Nenhuma condição de pagamento informada.</td></tr>'
              }
            </tbody>
          </table>

          ${blocoDadosBancariosPdf}

          <div class="section-title">Observações</div>
          <div class="observacoes">${escaparHtml(observacoes)}</div>
<div class="recebimento-area">
  <div class="recebimento-box-horizontal">
    <div class="recebimento-assinatura-horizontal">
      <div class="linha-assinatura"></div>
      <div class="assinatura-label">Assinatura do recebedor</div>
      <div class="recebimento-data-horizontal">Data: ____/____/________</div>
    </div>
  </div>
</div>

<div class="fechamento-final">
  <div>
    EMITIDO POR
    <span class="erp-sign">
      Synergias <span class="green">ERP</span> <span class="script">Sign</span>
    </span>
  </div>
  <div>Impresso em: ${new Date().toLocaleString('pt-BR')}</div>
</div>
</div>
</body>
      </html>
    `
  }

function abrirImpressaoOrcamento() {
  salvar(status, false, true)

  const nomeArquivo = gerarNomeArquivoPdf(
    numero,
    clienteNome || clienteBusca,
    dataEmissao,
  )

  const html = montarHtmlPdf()
  /* SYNERGIAS_IMPRESSAO_SEM_POPUP_V200M */
  const quadroImpressao = document.createElement('iframe')
  quadroImpressao.setAttribute('aria-hidden', 'true')
  quadroImpressao.style.position = 'fixed'
  quadroImpressao.style.right = '0'
  quadroImpressao.style.bottom = '0'
  quadroImpressao.style.width = '1px'
  quadroImpressao.style.height = '1px'
  quadroImpressao.style.border = '0'
  quadroImpressao.style.opacity = '0'
  quadroImpressao.style.pointerEvents = 'none'
  document.body.appendChild(quadroImpressao)

  const janelaImpressao = quadroImpressao.contentWindow
  const documentoImpressao =
    quadroImpressao.contentDocument ?? janelaImpressao?.document

  if (!janelaImpressao || !documentoImpressao) {
    quadroImpressao.remove()
    alert('Não foi possível preparar a impressão. Tente novamente.')
    return
  }

  let impressaoIniciada = false

  const removerQuadroImpressao = () => {
    window.setTimeout(() => {
      if (quadroImpressao.isConnected) {
        quadroImpressao.remove()
      }
    }, 300)
  }

  const iniciarImpressao = () => {
    if (impressaoIniciada) return
    impressaoIniciada = true

    window.setTimeout(() => {
      janelaImpressao.focus()
      janelaImpressao.print()
    }, 350)
  }

  janelaImpressao.onafterprint = removerQuadroImpressao
  quadroImpressao.onload = iniciarImpressao

  documentoImpressao.open()
  documentoImpressao.write(html)
  documentoImpressao.close()
  documentoImpressao.title = nomeArquivo

  window.setTimeout(iniciarImpressao, 900)
  /* SYNERGIAS_IMPRESSAO_SEM_POPUP_V200M_FIM */
}

  useEffect(() => {
    if (impressaoAutomaticaExecutada.current || typeof window === 'undefined') return

    const parametros = new URLSearchParams(window.location.search)
    if (parametros.get('print') !== '1') return
    if (!id || !numero) return

    impressaoAutomaticaExecutada.current = true

    const temporizador = window.setTimeout(() => {
      abrirImpressaoOrcamento()
    }, DELAY_IMPRESSAO_AUTOMATICA_MS)

    return () => window.clearTimeout(temporizador)
  }, [id, numero, clienteNome, itens.length, pagamentos.length])

  return (
    <main className="clientes-page">
      <Sidebar />

      <section className="clientes-main">
        <div className="orcamento-header-linha">
          <PageHeader
            category="Vendas"
            title={id ? 'Editar Orçamento' : 'Novo Orçamento'}
            subtitle="Cadastro de orçamento de venda"
          />
        </div>

        <div className="orcamento-page" data-conversao-unica={`${SYNERGIAS_CONVERSAO_UNICA_V248}|${SYNERGIAS_ENDERECOS_ENTREGA_CLIENTE_V249}`}>
          <div className="orcamento-top-actions">
            <button
              type="button"
              className="btn-secundario orcamento-voltar-icon"
              onClick={() => navigate('/vendas')}
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft size={25} strokeWidth={2.4} />
            </button>


            <button
              type="button"
              className="orcamento-acao orcamento-acao-lista"
              title="Lista de orçamentos"
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClickCapture={(event) => {
                event.preventDefault()
                event.stopPropagation()
                abrirLista()
              }}
            >
              <List size={25} strokeWidth={2.4} />
            </button>

            <div className="orcamento-iconbar topo">
            <button
              type="button"
              className="orcamento-acao orcamento-acao-novo"
              title="Novo orçamento"
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClickCapture={(event) => {
                event.preventDefault()
                event.stopPropagation()
                novoOrcamento()
              }}
            >
              <FilePlus2 size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="orcamento-acao orcamento-acao-salvar"
              title="Salvar orçamento"
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClickCapture={(event) => {
                event.preventDefault()
                event.stopPropagation()
                salvar(status, false)
              }}
            >
              <Save size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="orcamento-acao orcamento-acao-imprimir"
              title="Imprimir"
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClickCapture={(event) => {
                event.preventDefault()
                event.stopPropagation()
                abrirImpressaoOrcamento()
              }}
            >
              <Printer size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="orcamento-acao orcamento-acao-email"
              title="Enviar por e-mail"
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClickCapture={(event) => {
                event.preventDefault()
                event.stopPropagation()
                enviarEmail()
              }}
            >
              <Mail size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="orcamento-acao orcamento-acao-duplicar"
              title="Duplicar orçamento"
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClickCapture={(event) => {
                event.preventDefault()
                event.stopPropagation()
                duplicarOrcamento()
              }}
            >
              <Copy size={25} strokeWidth={2.4} />
            </button>

          </div>
          </div>

          <section className="orcamento-card">
            <div className="orcamento-card-header">
              <div>
                <span className="orcamento-label">Status</span>
                <div className={`orcamento-status ${classeStatusExibicao}`}>
                  {statusEhConcluido ? (
                    <div className="orcamento-status-concluido">
                      <span className="orcamento-status-concluido-titulo">CONCLUÍDO</span>
                      <button
                        type="button"
                        className="orcamento-status-pedido-link"
                        onClick={abrirPedidoOriginario}
                        title={`Abrir pedido ${pedidoOriginarioNumero || ''}`}
                      >
                        {`Pedido ${pedidoOriginarioNumero || ''}`.trim()}
                      </button>
                    </div>
                  ) : (
                    status.toUpperCase()
                  )}
                </div>
              </div>

              <div>
                <span className="orcamento-label">Nº Orçamento</span>
                <input
                  className="orcamento-input numero"
                  value={numero}
                  onChange={(event) => setNumero(event.target.value)}
                />
              </div>
            </div>

            <div className="orcamento-grid-header">
              <div className="orcamento-field vendedor-field">
                <label>Vendedor</label>

                <div className="vendedor-inline">
                  <select
                    className="vendedor-select"
                    value={vendedor}
                    onChange={(event) => setVendedor(event.target.value)}
                  >
                    <option value="">Selecione</option>

                    {vendedores.map((nomeVendedor) => (
                      <option key={nomeVendedor} value={nomeVendedor}>
                        {nomeVendedor}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="btn-add-vendedor"
                    onClick={adicionarVendedor}
                    title="Adicionar vendedor"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="orcamento-field">
                <label>Emissão</label>
                <input
                  type="date"
                  value={dataEmissao}
                  onChange={(event) => setDataEmissao(event.target.value)}
                />
              </div>

              <div className="orcamento-field">
                <label>Validade</label>
                <input type="date" value={dataValidade} readOnly />
              </div>

              <div className="orcamento-field">
                <label>Entrega</label>
                <input type="date" value={dataEntrega} readOnly />
              </div>
            </div>
          </section>

          <section className="dados-cliente-marketup">
            <h2>Dados do cliente</h2>

            <div
              className="dados-cliente-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(520px, 1fr) minmax(420px, 0.7fr)',
                gap: 22,
                alignItems: 'end',
              }}
            >
              <div className="orcamento-field" style={{ gridColumn: '1 / -1' }}>
                <label>Cliente / Razão Social</label>
                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                  }}
                >
                  <div className="autocomplete-wrapper" style={{ flex: 1 }}>
                    <input
                      className="cliente-select"
                      value={clienteBusca}
                      onChange={(event) => preencherCliente(event.target.value)}
                      onFocus={() => setClienteSugestoesAbertas(Boolean(clienteBusca.trim()))}
                      onKeyDown={clienteEnter}
                      onBlur={() => {
                        window.setTimeout(() => setClienteSugestoesAbertas(false), 120)
                        confirmarClienteSelecionado()
                      }}
                      placeholder="Digite o nome do cliente"
                    />

                    {clienteSugestoesAbertas && clientesSugeridos.length > 0 && (
                      <div className="autocomplete-lista autocomplete-lista-clientes">
                        {clientesSugeridos.map((cliente, indice) => (
                          <button
                            key={cliente.id}
                            type="button"
                            className={`autocomplete-opcao${indice === clienteSugestaoAtiva ? ' ativo-teclado' : ''}`}
                            onMouseEnter={() => setClienteSugestaoAtiva(indice)}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selecionarCliente(cliente)}
                          >
                            <strong>{cliente.nome}</strong>
                            <span>{cliente.documento || 'Sem documento cadastrado'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {clienteSelecionadoCredito && (
                    <button
                      type="button"
                      onClick={abrirCreditoCliente}
                      title="Consultar crédito do cliente"
                      style={{
                        minWidth: 210,
                        minHeight: 58,
                        border: 0,
                        borderRadius: 14,
                        background: '#f4f7fb',
                        padding: '8px 14px',
                        textAlign: 'right',
                        cursor: 'pointer',
                      }}
                    >
                      <small style={{ display: 'block', fontWeight: 900, color: '#53657f' }}>
                        {resumoCreditoCliente.limiteDisponivel < 0
                          ? 'LIMITE EXCEDIDO'
                          : 'CRÉDITO DISPONÍVEL'}
                      </small>
                      <strong
                        style={{
                          display: 'block',
                          fontSize: 22,
                          color: resumoCreditoCliente.limiteDisponivel < 0 ? '#b91c1c' : '#00a63e',
                        }}
                      >
                        {dinheiroCredito(resumoCreditoCliente.limiteDisponivel)}
                      </strong>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={abrirCreditoCliente}
                    title="Consultar crédito do cliente"
                    aria-label="Consultar crédito do cliente"
                    style={{
                      width: 58,
                      height: 58,
                      minWidth: 58,
                      border: 0,
                      borderRadius: 14,
                      background: '#7c32ed',
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Search size={27} />
                  </button>

                  {clienteNaoLocalizado && (
                    <button
                      type="button"
                      className="btn-primario"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={abrirCadastroClienteRapido}
                      style={{ whiteSpace: 'nowrap', height: '42px' }}
                    >
                      Cadastrar novo cliente
                    </button>
                  )}
                </div>
              </div>

              <div className="orcamento-field">
                <label>CNPJ / CPF</label>
                <input
                  value={clienteDocumento}
                  onChange={(event) => setClienteDocumento(event.target.value)}
                  placeholder="CNPJ ou CPF"
                />
              </div>

            </div>

            {mostrarCreditoCliente && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.72)',
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                }}
              >
                <div style={{ width: 'min(940px, 100%)', background: '#fff' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#bfbfbf',
                      color: '#fff',
                      padding: 20,
                    }}
                  >
                    <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
                      CONFIGURAÇÃO DO CLIENTE
                    </h2>
                    <button
                      type="button"
                      onClick={() => setMostrarCreditoCliente(false)}
                      style={{ width: 68, height: 68, margin: '-20px -20px -20px 0', border: 0, background: '#9f9f9f', color: '#fff', fontSize: 38, cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, padding: '24px 60px 20px', textAlign: 'center', color: '#444' }}>
                    <label style={{ fontWeight: 900, fontSize: 18 }}>
                      Limite de Crédito
                      <input
                        value={limiteCreditoTexto}
                        onChange={(event) => setLimiteCreditoTexto(event.target.value)}
                        onBlur={() => setLimiteCreditoTexto(formatarMoedaCredito(converterMoedaCredito(limiteCreditoTexto)))}
                        style={{ width: '100%', minHeight: 42, marginTop: 4, border: '1px solid #a8a8a8', background: '#d1d1d1', padding: '8px 10px', fontSize: 18 }}
                      />
                    </label>
                    <div>
                      <strong style={{ display: 'block', fontSize: 18 }}>Limite Utilizado</strong>
                      <span style={{ fontSize: 18 }}>{dinheiroCredito(resumoCreditoCliente.limiteUtilizado)}</span>
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: 18 }}>Limite Disponível</strong>
                      <span style={{ fontSize: 18, color: resumoCreditoCliente.limiteDisponivel < 0 ? '#b91c1c' : '#444' }}>
                        {dinheiroCredito(resumoCreditoCliente.limiteDisponivel)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #e5e7eb', padding: 20 }}>
                    <button type="button" onClick={() => setMostrarCreditoCliente(false)} style={{ minHeight: 50, border: 0, background: '#444', color: '#fff', padding: '0 18px', fontWeight: 900, cursor: 'pointer' }}>
                      CANCELAR
                    </button>
                    <button type="button" onClick={salvarCreditoCliente} style={{ minHeight: 50, border: 0, background: '#78c83b', color: '#fff', padding: '0 28px', fontWeight: 900, cursor: 'pointer' }}>
                      SALVAR
                    </button>
                  </div>
                </div>
              </div>
            )}

            {cadastroClienteAberto && (
              <div
                className="cadastro-produto-rapido"
                style={{
                  position: 'relative',
                  padding: '22px 30px 20px',
                  borderLeft: '6px solid #22c55e',
                  borderRadius: 16,
                  background: '#f8fbff',
                  maxWidth: '100%',
                  overflow: 'hidden',
                }}
              >
                <div className="cadastro-produto-header" style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: 0 }}>Novo cliente rápido</h3>

                  <button
                    type="button"
                    onClick={() => setCadastroClienteAberto(false)}
                    style={{
                      width: 42,
                      height: 42,
                      border: 0,
                      borderRadius: 11,
                      background: '#fee2e2',
                      color: '#ef4444',
                      fontSize: 26,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                    title="Fechar cadastro rápido"
                  >
                    ×
                  </button>
                </div>

                <div
                  className="cadastro-cliente-rapido-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(280px, 1.3fr) minmax(220px, 0.8fr) 64px minmax(200px, 0.7fr)',
                    gap: 16,
                    alignItems: 'end',
                    width: '100%',
                    maxWidth: '100%',
                  }}
                >
                  <div className="orcamento-field">
                    <label>Nome / Razão Social</label>
                    <input
                      value={novoClienteNome}
                      onChange={(event) => setNovoClienteNome(event.target.value)}
                      placeholder="Nome completo do cliente"
                    />
                  </div>

                  <div className="orcamento-field">
                    <label>CNPJ / CPF</label>
                    <input
                      value={novoClienteDocumento}
                      onChange={(event) => {
                        setNovoClienteDocumento(event.target.value)
                        setMensagemBuscaCnpj('')
                      }}
                      onBlur={() => buscarCnpjClienteRapido()}
                      placeholder="CNPJ ou CPF"
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-secundario"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => buscarCnpjClienteRapido()}
                    disabled={buscandoCnpj}
                    style={{
                      width: 64,
                      height: 56,
                      minWidth: 64,
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Buscar CNPJ"
                    aria-label="Buscar CNPJ"
                  >
                    <Search size={24} />
                  </button>

                  <div className="orcamento-field">
                    <label>Telefone</label>
                    <input
                      value={novoClienteTelefone}
                      onChange={(event) => setNovoClienteTelefone(event.target.value)}
                      placeholder="Telefone"
                    />
                  </div>

                </div>

                {mensagemBuscaCnpj && (
                  <small
                    style={{
                      display: 'block',
                      marginTop: 10,
                      color: '#64748b',
                      fontWeight: 800,
                    }}
                  >
                    {mensagemBuscaCnpj}
                  </small>
                )}

                <div
                  className="cadastro-cliente-rapido-endereco"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(360px, 1fr) 180px',
                    gap: 16,
                    alignItems: 'end',
                    marginTop: 12,
                    width: '100%',
                    maxWidth: '100%',
                  }}
                >
                  <div className="orcamento-field">
                    <label>Endereço</label>
                    <textarea
                      rows={2}
                      value={novoClienteEndereco}
                      onChange={(event) => setNovoClienteEndereco(event.target.value)}
                      placeholder="Endereço completo em até 2 linhas"
                      style={{ minHeight: 48, height: 56, resize: 'none' }}
                    />
                  </div>


                  <button
                    type="button"
                    className="btn-primario"
                    onClick={salvarClienteRapido}
                    style={{
                      width: 180,
                      height: 56,
                      justifySelf: 'end',
                      fontWeight: 900,
                    }}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="enderecos-marketup">
            <div className="endereco-linha">
              <div className="endereco-titulo">ENDEREÇO PARA FATURAMENTO</div>

              <div className="endereco-conteudo">
                <div className="endereco-card-verde">
                  <button
                    type="button"
                    className="endereco-editar"
                    onClick={() => setEditandoFaturamento(true)}
                    title="Editar endereço de faturamento"
                  >
                    <Edit size={17} />
                  </button>

                  {editandoFaturamento ? (
                    <textarea
                      autoFocus
                      value={enderecoFaturamento}
                      onChange={(event) => setEnderecoFaturamento(event.target.value)}
                      onBlur={() => setEditandoFaturamento(false)}
                    />
                  ) : (
                    <p>
                      {enderecoFaturamento ||
                        'Selecione um cliente ou clique no lápis para informar o endereço completo'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="endereco-linha">
              <div className="endereco-titulo-com-link">
                <span>ENDEREÇO DE ENTREGA</span>
                <button type="button">VISUALIZAR MAPA E RASTREAMENTO</button>
              </div>

              <div className="endereco-conteudo endereco-conteudo-entrega">
                <div className="enderecos-entrega-botoes">
                  {enderecosEntregaLista.map((endereco, indice) => {
                    const enderecoAtivo = indice === enderecoEntregaSelecionadoIndice
                    const enderecoEmEdicao = editandoEntrega && enderecoEntregaEditandoIndice === indice

                    return (
                      <div
                        key={`endereco-entrega-card-${indice}`}
                        className={`endereco-entrega-opcao${enderecoAtivo ? ' ativo' : ''}${
                          endereco.trim() ? '' : ' vazio'
                        }`}
                      >
                        {enderecoEmEdicao ? (
                          <textarea
                            autoFocus
                            value={endereco}
                            onChange={(event) => atualizarEnderecoEntregaItem(indice, event.target.value)}
                            onBlur={() => {
                              setEnderecoEntregaEditandoIndice(null)
                              setEditandoEntrega(false)
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="endereco-entrega-opcao-botao"
                            onClick={() => selecionarEnderecoEntrega(indice)}
                            title="Usar este endereço no PDF"
                          >
                            <span className="endereco-entrega-opcao-titulo">Entrega {indice + 1}</span>
                            <span className="endereco-entrega-opcao-texto">
                              {endereco || 'Clique para selecionar e depois no lápis para preencher'}
                            </span>
                          </button>
                        )}

                        {enderecoAtivo && !enderecoEmEdicao && (
                          <button
                            type="button"
                            className="endereco-editar endereco-editar-entrega-opcao"
                            onClick={() => {
                              setEnderecoEntregaEditandoIndice(indice)
                              setEditandoEntrega(true)
                            }}
                            title="Editar endereço selecionado"
                          >
                            <Edit size={17} />
                          </button>
                        )}

                        {enderecoAtivo && enderecosEntregaLista.length > 1 && !enderecoEmEdicao && (
                          <button
                            type="button"
                            className="endereco-remover endereco-remover-entrega-opcao"
                            onClick={() => removerEnderecoEntrega(indice)}
                            title="Remover endereço selecionado"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="endereco-setas">
                  <button
                    type="button"
                    onClick={selecionarEnderecoEntregaAnterior}
                    disabled={enderecoEntregaSelecionadoIndice === 0}
                    title="Endereço anterior"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={selecionarEnderecoEntregaProximo}
                    disabled={enderecoEntregaSelecionadoIndice >= enderecosEntregaLista.length - 1}
                    title="Próximo endereço"
                  >
                    ›
                  </button>
                </div>

                <button
                  type="button"
                  className="endereco-add"
                  onClick={adicionarEnderecoEntrega}
                  title="Adicionar outro endereço de entrega"
                >
                  <Plus size={34} />
                </button>
              </div>
            </div>
          </section>

          <section className="itens-marketup">
            <div className="itens-marketup-titulo-sya">
              <h2>Itens</h2>
            </div>

            <div className="item-inclusao-barra">
              <div className="item-busca autocomplete-wrapper">
                <input
                  value={buscaItem}
                  onChange={(event) => {
                    preencherProduto(event.target.value)
                    setProdutoSugestaoAtiva(0)
                  }}
                  onFocus={() => setProdutoSugestoesAbertas(Boolean(buscaItem.trim()))}
                  onKeyDown={produtoEnter}
                  onBlur={() => {
                    window.setTimeout(() => setProdutoSugestoesAbertas(false), 120)
                    confirmarProdutoSelecionado()
                  }}
                  placeholder="DIGITE O NOME OU CÓDIGO DO PRODUTO"
                />

                {produtoSugestoesAbertas && produtosSugeridos.length > 0 && (
                  <div className="autocomplete-lista autocomplete-lista-produtos">
                    {produtosSugeridos.map((produto, indice) => (
                      <button
                        key={produto.id}
                        type="button"
                        className={`autocomplete-opcao produto-opcao${indice === produtoSugestaoAtiva ? ' ativo-teclado' : ''}`}
                        onMouseEnter={() => setProdutoSugestaoAtiva(indice)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selecionarProduto(produto)}
                      >
                        <div>
                          <strong>{produto.nome || produto.descricao}</strong>
                          <span>Código de barras: {produto.codigoBarras || 'Não informado'}</span>
                        </div>
                        <div className="produto-opcao-dados">
                          <small>Estoque disponível: {produto.estoque} {produto.unidade || 'UN'}</small>
                          <em>{numeroParaMoeda(produto.valorUnitario)}</em>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="item-quantidade">
                <span>QNTD.</span>

                <div className="quantidade-controles">
                  <button type="button" onClick={aumentarQuantidade}>
                    <Plus size={18} />
                  </button>

                  <input
                    type="number"
                    min="1"
                    value={quantidadeItem}
                    onChange={(event) => alterarQuantidade(Number(event.target.value))}
                  />

                  <button type="button" onClick={diminuirQuantidade}>
                    <Minus size={18} />
                  </button>
                </div>
              </div>

              <div className="item-valor">
                <span>UNITÁRIO (R$)</span>

                <input
                  type="text"
                  value={valorUnitarioItemTexto}
                  onChange={(event) => setValorUnitarioItemTexto(mascararMoedaDigitada(event.target.value))}
                  onBlur={() =>
                    setValorUnitarioItemTexto(formatarCampoMoedaAoSair(valorUnitarioItemTexto))
                  }
                />
              </div>

              <div className="item-total">
                <span>TOTAL (R$)</span>
                <strong>{numeroParaMoeda(totalItemAtual)}</strong>
              </div>

              <button type="button" className="item-incluir item-incluir-padrao-pedido" onClick={incluirItemNoPedido}>
                <PackagePlus size={22} />
                <strong>INCLUIR</strong>
              </button>
            </div>

            {produtoNaoLocalizado && (
              <button
                type="button"
                className="btn-adicionar-produto-rapido"
                onMouseDown={(event) => event.preventDefault()}
                onClick={abrirCadastroProdutoRapido}
              >
                <span>ADICIONAR NOVO ITEM PARA VENDA</span>
                <Plus size={24} />
              </button>
            )}

            {cadastroProdutoAberto && (
              <div className="cadastro-produto-rapido">
                <div className="cadastro-produto-header">
                  <h3>Novo produto rápido</h3>

                  <button type="button" onClick={() => setCadastroProdutoAberto(false)}>
                    ×
                  </button>
                </div>

                <div className="cadastro-produto-grid">
                  <div className="orcamento-field">
                    <label>Código automático</label>
                    <input value={novoProdutoCodigo} readOnly />
                  </div>

                  <div className="orcamento-field">
                    <label>Nome do produto</label>
                    <input
                      value={novoProdutoNome}
                      onChange={(event) => setNovoProdutoNome(event.target.value)}
                      placeholder="Nome completo do produto"
                    />
                  </div>

                  <div className="orcamento-field">
                    <label>Valor de venda</label>
                    <input
                      type="text"
                      value={novoProdutoValorTexto}
                      onChange={(event) => setNovoProdutoValorTexto(mascararMoedaDigitada(event.target.value))}
                      onBlur={() =>
                        setNovoProdutoValorTexto(formatarCampoMoedaAoSair(novoProdutoValorTexto))
                      }
                    />
                  </div>

                  <button type="button" className="btn-primario" onClick={adicionarProdutoNovo}>
                    <Plus size={18} />
                    Adicionar produto novo
                  </button>
                </div>
              </div>
            )}

            {produtoSelecionado && (
              <div className="estoque-info-interno">
                Estoque disponível: <strong>{estoqueItemAtual}</strong>
              </div>
            )}

            {itens.length > 0 && (
              <div className="itens-adicionados">
                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Item</th>
                      <th>Qtd.</th>
                      <th>Estoque interno</th>
                      <th>Unitário R$</th>
                      <th>Total R$</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {itens.map((item) => {
                      const totalLinha = item.quantidade * item.valorUnitario

                      return (
                        <tr key={item.id} style={{ fontWeight: 800 }}>
                          <td>{item.codigoBarras || item.codigo || '-'}</td>
                          <td>
                            <div className="item-descricao-com-observacao">
                              <div>
                                <strong>{item.descricao}</strong>
                                {item.observacaoItem && (
                                  <small>{item.observacaoItem}</small>
                                )}
                              </div>
                              <button
                                type="button"
                                className={`btn-observacao-item ${item.observacaoItem ? 'preenchida' : ''}`}
                                onClick={() => abrirObservacaoItem(item)}
                                title="Observação do item"
                                aria-label="Observação do item"
                              >
                                <MessageSquare size={18} />
                              </button>
                            </div>
                          </td>

                          <td>
                            <div className="qtd-tabela">
                              <input
                                type="number"
                                min="1"
                                value={item.quantidade}
                                onChange={(event) =>
                                  atualizarQuantidadeItemAdicionado(
                                    item.id,
                                    Number(event.target.value)
                                  )
                                }
                              />
                              <div className="qtd-tabela-botoes">
                              <button
                                type="button"
                                onClick={() =>
                                  atualizarQuantidadeItemAdicionado(
                                    item.id,
                                    item.quantidade - 1
                                  )
                                }
                              >
                                -
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  atualizarQuantidadeItemAdicionado(
                                    item.id,
                                    item.quantidade + 1
                                  )
                                }
                              >
                                +
                              </button>
                              </div>
                            </div>
                          </td>

                          <td>{item.estoqueDisponivel}</td>

                          <td>
                            <input
                              className="valor-editavel-tabela"
                              type="text"
                              value={numeroParaCampo(item.valorUnitario)}
                              onChange={(event) => {
                                const valorFormatado = mascararMoedaDigitada(event.target.value)
                                atualizarValorUnitarioItemAdicionado(item.id, valorFormatado)
                              }}
                              onFocus={(event) => event.currentTarget.select()}
                            />
                          </td>

                          <td>{formatarMoeda(totalLinha)}</td>

                          <td>
                            <button type="button" className="btn-remover-item btn-remover-item-icone" onClick={() => removerItem(item.id)} aria-label="Remover item" title="Remover item">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="totais-marketup">
            <div className="subtotal-marketup">
              <span>SUBTOTAL (R$)</span>
              <strong>{numeroParaMoeda(subtotal)}</strong>
            </div>

            <div className="totais-box-marketup">
              <div className="totais-linha-marketup">
                <span className="totais-label">DESCONTO</span>

                <div className="desconto-toggle">
                  <button
                    type="button"
                    className={tipoDesconto === 'valor' ? 'active' : ''}
                    onClick={() => setTipoDesconto('valor')}
                  >
                    R$
                  </button>

                  <button
                    type="button"
                    className={tipoDesconto === 'percentual' ? 'active' : ''}
                    onClick={() => setTipoDesconto('percentual')}
                  >
                    %
                  </button>
                </div>

                <input
                  type="text"
                  value={descontoInformadoTexto}
                  onChange={(event) => setDescontoInformadoTexto(mascararMoedaDigitada(event.target.value))}
                  onBlur={() =>
                    setDescontoInformadoTexto(
                      numeroParaCampo(textoMoedaParaNumero(descontoInformadoTexto))
                    )
                  }
                />

                <span className="valor-calculado">{formatarMoeda(descontoCalculado)}</span>
              </div>

              <div className="totais-linha-marketup">
                <span className="totais-label">FRETE</span>
                <div />
                <input
                  type="text"
                  value={freteTexto}
                  onChange={(event) => setFreteTexto(mascararMoedaDigitada(event.target.value))}
                  onBlur={() =>
                    setFreteTexto(numeroParaCampo(textoMoedaParaNumero(freteTexto)))
                  }
                />
                <span className="valor-calculado">{formatarMoeda(frete)}</span>
              </div>

              <div className="totais-linha-marketup">
                <span className="totais-label">OUTROS CUSTOS</span>
                <div />
                <input
                  type="text"
                  value={outrosCustosTexto}
                  onChange={(event) => setOutrosCustosTexto(mascararMoedaDigitada(event.target.value))}
                  onBlur={() =>
                    setOutrosCustosTexto(
                      numeroParaCampo(textoMoedaParaNumero(outrosCustosTexto))
                    )
                  }
                />
                <span className="valor-calculado">{formatarMoeda(outrosCustos)}</span>
              </div>
            </div>

            <div className="total-final-marketup">
              <span>TOTAL FINAL (R$)</span>
              <strong>{numeroParaMoeda(totalFinal)}</strong>
            </div>
          </section>

          <section className="pagamento-marketup">
            <h2>Pagamento</h2>

            <div className="pagamento-layout">
              <div className="pagamento-painel-esquerdo">
                <div className="pagamento-total">
                  <span>SALDO A PAGAR (R$)</span>
                  <strong>{numeroParaMoeda(saldoRestantePagamento)}</strong>
                  <small>Total: {formatarMoeda(totalFinal)}</small>
                  <small>Gerado: {formatarMoeda(totalPagamentosGerados)}</small>
                  {valorExcedentePagamento > 0 && (
                    <em>Excedente: {formatarMoeda(valorExcedentePagamento)}</em>
                  )}
                </div>

                <label>FORMA DE PAGAMENTO</label>
                <select
                  value={formaPagamentoSelecionada}
                  onChange={(event) => alterarFormaPagamentoOrcamento(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {formasPagamento.map((forma) => (
                    <option key={forma} value={forma}>
                      {forma}
                    </option>
                  ))}
                </select>

                {opcoesCobrancaDisponiveis.length > 0 && (
                  <>
                    <label>COBRANÇA / BANCO</label>
                    <select
                      value={opcaoCobrancaSelecionada}
                      onChange={(event) => setOpcaoCobrancaSelecionada(event.target.value)}
                    >
                      <option value="">Selecione</option>
                      {opcoesCobrancaDisponiveis.map((opcao) => (
                        <option key={opcao} value={opcao}>
                          {opcao}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {dadosBancariosSelecionados && (
                  <div
                    className="dados-bancarios-pagamento"
                    style={{
                      marginTop: '14px',
                      padding: '14px',
                      borderRadius: '12px',
                      background: '#ecfdf5',
                      border: '1px solid #86efac',
                      color: '#052e16',
                      fontSize: '13px',
                      fontWeight: 700,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {dadosBancariosSelecionados}
                  </div>
                )}

                <label>PRAZO</label>
                <select
                  value={prazoSelecionado}
                  onChange={(event) => setPrazoSelecionado(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {prazosDisponiveis.map((prazo) => (
                    <option key={prazo} value={prazo}>
                      {prazo}
                    </option>
                  ))}
                </select>

                <label>VALOR</label>
                <input
                  type="text"
                  value={valorPagamentoTexto}
                  onChange={(event) => setValorPagamentoTexto(mascararMoedaDigitada(event.target.value))}
                  onBlur={() =>
                    setValorPagamentoTexto(
                      numeroParaCampo(textoMoedaParaNumero(valorPagamentoTexto))
                    )
                  }
                />

                <button type="button" className="btn-gerar-cobranca" onClick={gerarCobranca}>
                  GERAR COBRANÇA
                  <Send size={22} />
                </button>
              </div>

              <div className="pagamento-painel-direito">
                {pagamentos.length === 0 ? (
                  <div className="pagamento-vazio">Nenhuma cobrança gerada.</div>
                ) : (
                  pagamentos.map((pagamento, index) => (
                    <div className="pagamento-card-gerado" key={pagamento.id}>
                      <div className="pagamento-forma-gerada">
                        {pagamento.formaPagamento}
                        <small>
                          ({index + 1}/{pagamentos.length}) — {pagamento.prazo}
                        </small>
                      </div>

                      <div className="pagamento-campos-gerados">
                        <div className="pagamento-campo-gerado">
                          <label>Vencimento</label>
                          <input
                            type="date"
                            value={pagamento.vencimento}
                            onChange={(event) =>
                              atualizarPagamento(
                                pagamento.id,
                                'vencimento',
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="pagamento-campo-gerado">
                          <label>Observações</label>
                          <textarea
                            className="pagamento-observacoes-textarea"
                            value={pagamento.observacoes}
                            onChange={(event) =>
                              atualizarPagamento(
                                pagamento.id,
                                'observacoes',
                                event.target.value
                              )
                            }
                            placeholder="Observações"
                            rows={3}
                          />
                        </div>

                        <div className="pagamento-campo-gerado">
                          <label>Valor</label>
                          <input
                            type="text"
                            value={numeroParaCampo(pagamento.valor)}
                            onChange={(event) =>
                              atualizarPagamento(
                                pagamento.id,
                                'valor',
                                textoMoedaParaNumero(mascararMoedaDigitada(event.target.value))
                              )
                            }
                          />
                        </div>

                        <button
                          type="button"
                          className="btn-remover-pagamento"
                          onClick={() => removerPagamento(pagamento.id)}
                          title="Excluir parcela"
                          aria-label="Excluir parcela"
                        >
                          <XCircle size={20} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="orcamento-card">
            <h3>Observações</h3>

            <div className="orcamento-field">
              <textarea
                className="observacoes-orcamento"
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                placeholder="Escreva aqui informações adicionais do orçamento..."
              />
            </div>
          </section>

          <section className="orcamento-card">
            <h3>PDF do orçamento</h3>

            <div className="orcamento-pdf-box">
              <FileText size={28} />

              <div>
                <strong>Gerar PDF para enviar ao cliente</strong>
                <p>
                  O PDF será aberto com o nome correto da cotação. Na janela de impressão,
                  escolha “Salvar como PDF” para baixar no computador.
                </p>
              </div>

              <button type="button" className="btn-primario" onClick={abrirImpressaoOrcamento}>
                <Printer size={18} />
                Gerar PDF
              </button>
            </div>
          </section>

          <div className="orcamento-actions-footer">
            <div className="acoes-esquerda-footer">
              <div className="orcamento-iconbar rodape">
                <button type="button" title="Novo orçamento"
              style={estiloBotaoIcone(CORES_ICONES_ERP.novo)} onClick={novoOrcamento}>
                  <Plus size={22} />
                </button>

                <button type="button" title="Imprimir / salvar PDF"
                  style={estiloBotaoIcone(CORES_ICONES_ERP.imprimir)} onClick={abrirImpressaoOrcamento}>
                  <Printer size={22} />
                </button>

                <button type="button" title="Enviar por e-mail"
              style={estiloBotaoIcone(CORES_ICONES_ERP.email)} onClick={enviarEmail}>
                  <Mail size={22} />
                </button>

                <button type="button" title="Duplicar orçamento"
              style={estiloBotaoIcone(CORES_ICONES_ERP.duplicar)} onClick={duplicarOrcamento}>
                  <Copy size={22} />
                </button>

                <button type="button" title="Lista de orçamentos"
              style={estiloBotaoIcone(CORES_ICONES_ERP.lista)} onClick={abrirLista}>
                  <List size={25} strokeWidth={2.4} />
                </button>
              </div>
            </div>

            <div className="acoes-direita-footer">

              <button type="button" className="btn-gerar-pedido" onClick={gerarPedido}>
                <CheckCircle size={18} />
                {possuiPedidoOriginario ? `Abrir pedido ${pedidoOriginarioNumero || ''}`.trim() : 'Gerar Pedido'}
              </button>

              <button
                type="button"
                className="btn-secundario"
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onClickCapture={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  salvar(status, false)
                }}
              >
                <Save size={18} />
                Salvar
              </button>

              <button
                type="button"
                className="btn-primario"
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onClickCapture={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  salvar(status, true)
                }}
              >
                <Save size={18} />
                Salvar e Voltar
              </button>
            </div>
          </div>

          {itemObservacaoId && (
            <div className="observacao-item-overlay" role="dialog" aria-modal="true">
              <div className="observacao-item-modal">
                <div className="observacao-item-modal-header">
                  <strong>Observação do item</strong>
                  <button type="button" onClick={fecharObservacaoItem} aria-label="Fechar">×</button>
                </div>
                <textarea
                  autoFocus
                  value={itemObservacaoTexto}
                  onChange={(event) => setItemObservacaoTexto(event.target.value)}
                  placeholder="Ex.: Produto já entregue, aroma diferente, substituir na entrega..."
                />
                <div className="observacao-item-modal-actions">
                  <button type="button" className="btn-cancelar-observacao" onClick={fecharObservacaoItem}>Cancelar</button>
                  <button type="button" className="btn-confirmar-observacao" onClick={confirmarObservacaoItem}>Confirmar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default OrcamentoForm