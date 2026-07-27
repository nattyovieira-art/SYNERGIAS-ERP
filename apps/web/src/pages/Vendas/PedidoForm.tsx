// SYNERGIAS_PEDIDO_SALVAR_CONFIRMADO_V284
// SYNERGIAS_PIX_TRANSFERENCIA_60_DIAS_V263C
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  Clock3,
  Download,
  Eye,
  FileChartColumnIncreasing,
  FileCheck,
  FilePenLine,
  FileText,
  Mail,
  Minus,
  Plus,
  PackageCheck,
  PackagePlus,
  Printer,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  User,
  XCircle,
} from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import logoSynergiasUrl from '../../assets/logo-synergias.png'
import type { Cliente } from '../../types/Cliente'
import { normalizarEnderecosEntrega } from '../../services/enderecosEntrega'
import type { Produto } from '../../types/Produto'
import type { BrindeVenda, ItemVenda, ParcelaVenda, Venda } from '../../types/Venda'
import type { ContaReceber } from '../../types/Financeiro'
import { resolverCodigoIbgeMunicipio } from '../../services/ibgeMunicipios'

const DELAY_IMPRESSAO_AUTOMATICA_PEDIDO_MS = 700

import {
  listarClientesStorage,
  salvarClienteStorage,
  salvarClientesStorageConfirmado,
} from '../../services/clientesStorage'
import {
  listarProdutosStorage,
  salvarProdutoStorage,
} from '../../services/produtosStorage'

import {
  buscarVendaStorage,
  listarVendasStorage as listarVendasCentral,
  salvarVendaStorage,
  salvarVendaStorageConfirmado,
} from '../../services/vendasStorage'
import {
  movimentarEstoqueStorage,
} from '../../services/estoqueStorage'
import { entregarPedidoCentral, MENSAGEM_ESTOQUE_JA_BAIXADO } from '../../services/pedidoEntregaApi'
import {
  listarContasReceberStorage,
  salvarContaReceberStorage,
} from '../../services/financeiroStorage'
import {
  cancelarCobrancaInter,
  consultarCobrancaInter,
  emitirCobrancaInter,
  obterPdfCobrancaInter,
  type CobrancaInterApi,
} from '../../services/interCobrancaApi'
import { carregarConfiguracaoFiscalServidor, obterConfiguracaoFiscalStorage } from '../../services/configuracaoFiscalStorage'
import { carregarColecaoCentral, ERP_STORAGE_UPDATED_EVENT } from '../../services/erpApi'
import { boletoEstaUtilizado, contarBoletosUtilizadosPorBanco } from '../../services/boletosCounter'
import { assinarETransmitirNFeHomologacao, gerarRascunhoXmlNFe, manterNumeracaoNFeRejeitada, registrarNumeracaoNFeAutorizada, validarPreEmissaoNFe } from '../../services/nfePreflightService'

import '../../styles/cliente-form.css'
import '../../styles/clientes.css'
import '../../styles/pedido-form.css'

type TipoDesconto = 'valor' | 'percentual'

type AjusteFiscalItem = {
  index: number
  codigoProduto: string
  codigoBarras: string
  descricao: string
  ncm: string
  cfop: string
  tipoFiscal: string
  origem: string
}

type SugestaoNcm = {
  codigo: string
  descricao: string
}

type NovoClienteRapido = {
  nome: string
  documento: string
  telefone: string
  email: string
  emailNotaFiscal: string
  cep: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

const FORMAS_PAGAMENTO_PADRAO = [
  'BOLETO',
  'PIX',
  'TRANSFERÊNCIA',
  'DINHEIRO',
  'CARTÃO',
]

const OPCOES_COBRANCA_POR_FORMA: Record<string, string[]> = {
  BOLETO: ['BOLETO BANCO INTER'],
  PIX: ['PIX BANCO INTER'],
  TRANSFERÊNCIA: ['TRANSFERÊNCIA BANCO INTER'],
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

const DADOS_PAGAMENTO: Record<string, Record<string, string>> = {
  'BOLETO BANCO INTER': {
    tipo: 'Boleto',
    banco: 'Inter',
    observacao: 'Boleto será gerado dentro do sistema futuramente.',
  },
  'PIX BANCO INTER': {
    tipo: 'PIX',
    banco: 'Inter',
    instituicao: 'INTER - 077',
    agencia: '0001',
    conta: '28738442-0',
    chavePix: '50.432.175/0001-46',
    nomeEmpresa: 'SYNERGIAS SL COMERCIO LTDA',
    cnpj: '50.432.175/0001-46',
  },
  'TRANSFERÊNCIA BANCO INTER': {
    tipo: 'Transferência',
    banco: 'Inter',
    instituicao: 'INTER - 077',
    agencia: '0001',
    conta: '28738442-0',
    nomeEmpresa: 'SYNERGIAS SL COMERCIO LTDA',
    cnpj: '50.432.175/0001-46',
  },
  DINHEIRO: {
    tipo: 'Dinheiro',
    observacao: 'Pagamento à vista.',
  },
  'CARTÃO CRÉDITO SUMUP': {
    tipo: 'Cartão de crédito',
    operadora: 'SumUp',
    observacao: 'Pagamento vinculado à SumUp.',
  },
  'CARTÃO DÉBITO SUMUP': {
    tipo: 'Cartão de débito',
    operadora: 'SumUp',
    observacao: 'Pagamento vinculado à SumUp.',
  },
}

const DIAS_VENCIMENTO_BOLETO = [5, 10, 15, 20, 25, 30]

const SYNERGIAS_ERP_LOGO = logoSynergiasUrl
const EMPRESA_ENDERECO = 'Av. Frei Henrique de Coimbra, 11'
const EMPRESA_EMAIL_FINANCEIRO = 'financeiro@synergias.com.br'
const EMPRESA_TELEFONE_WHATSAPP = '51 98264-2434'
const EMPRESA_SITE = 'www.synergias.com.br'
const API_ENVIO_NOTA_BOLETO = '/api/enviar-nota-boleto-cliente.php'

const STORAGE_VENDAS_CREDITO = 'synergias_vendas'
const LIMITE_BOLETOS_GRATUITOS_POR_BANCO = 100

type BancoBoletoGratuito = 'Inter'

function parametroUrlAtual(nome: string): string {
  if (typeof window === 'undefined') return ''
  const pagina = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(
    window.location.hash.includes('?')
      ? window.location.hash.slice(window.location.hash.indexOf('?'))
      : '',
  )
  return hash.get(nome) || pagina.get(nome) || ''
}

type ResumoBoletosGratuitos = {
  banco: BancoBoletoGratuito
  usados: number
  limite: number
  disponiveis: number
}


type ResumoCreditoCliente = {
  limiteCredito: number
  limiteUtilizado: number
  limiteDisponivel: number
}

function normalizarBuscaCredito(valor?: string | number) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function somenteNumerosCredito(valor?: string | number) {
  return String(valor || '').replace(/\D/g, '')
}

function carregarVendasCreditoStorage(): Venda[] {
  if (typeof window === 'undefined') return []

  try {
    const vendasSalvas = window.localStorage.getItem(STORAGE_VENDAS_CREDITO)

    if (!vendasSalvas) return []

    const vendas = JSON.parse(vendasSalvas)

    return Array.isArray(vendas) ? (vendas as Venda[]) : []
  } catch {
    return []
  }
}

function vendaPertenceAoCliente(vendaSalva: Venda, vendaAtual: Venda, cliente?: Cliente) {
  const codigoAtual = String(vendaAtual.clienteCodigo || cliente?.codigo || '')
  const codigoSalvo = String(vendaSalva.clienteCodigo || '')

  if (codigoAtual && codigoSalvo && codigoAtual === codigoSalvo) {
    return true
  }

  const documentoAtual = somenteNumerosCredito(
    vendaAtual.clienteDocumento || cliente?.cnpj || cliente?.cpf || '',
  )
  const documentoSalvo = somenteNumerosCredito(vendaSalva.clienteDocumento || '')

  if (documentoAtual && documentoSalvo && documentoAtual === documentoSalvo) {
    return true
  }

  const nomeAtual = normalizarBuscaCredito(
    vendaAtual.clienteNome || cliente?.razaoSocial || cliente?.nomeFantasia || '',
  )
  const nomeSalvo = normalizarBuscaCredito(vendaSalva.clienteNome || '')

  return Boolean(nomeAtual && nomeSalvo && nomeAtual === nomeSalvo)
}

function calcularResumoCreditoCliente(
  cliente: Cliente | undefined,
  vendaAtual: Venda,
  totalAtual: number,
): ResumoCreditoCliente {
  if (!vendaAtual.clienteCodigo && !vendaAtual.clienteDocumento && !vendaAtual.clienteNome) {
    return {
      limiteCredito: 0,
      limiteUtilizado: 0,
      limiteDisponivel: 0,
    }
  }

  const limiteCredito = Number(cliente?.limiteCredito || 0)
  const vendas = carregarVendasCreditoStorage()

  const limiteUtilizadoSalvo = vendas.reduce((total, vendaSalva) => {
    if (String(vendaSalva.id || '') === String(vendaAtual.id || '')) {
      return total
    }

    if (String(vendaSalva.tipo || '').toLowerCase() !== 'pedido') {
      return total
    }

    if (String(vendaSalva.statusPedido || '').toLowerCase() === 'cancelado') {
      return total
    }

    if (!vendaPertenceAoCliente(vendaSalva, vendaAtual, cliente)) {
      return total
    }

    return total + Number(vendaSalva.totalFinal || 0)
  }, 0)

  const limiteUtilizadoAtual =
    String(vendaAtual.statusPedido || '').toLowerCase() === 'cancelado'
      ? 0
      : Number(totalAtual || vendaAtual.totalFinal || 0)

  const limiteUtilizado = Number((limiteUtilizadoSalvo + limiteUtilizadoAtual).toFixed(2))

  return {
    limiteCredito,
    limiteUtilizado,
    limiteDisponivel: Number((limiteCredito - limiteUtilizado).toFixed(2)),
  }
}

function gerarMesAtualBoleto() {
  return hoje().slice(0, 7)
}

function identificarBancoBoleto(valor?: string): BancoBoletoGratuito | null {
  const texto = String(valor || '').toUpperCase()

  if (texto.includes('INTER')) return 'Inter'
  return null
}

function identificarBancoBoletoDaParcela(
  parcela: ParcelaVenda,
  vendaBase?: Venda,
): BancoBoletoGratuito | null {
  return (
    identificarBancoBoleto(String(parcela.tipoCobranca || '')) ||
    identificarBancoBoleto(String(parcela.bancoCobranca || '')) ||
    identificarBancoBoleto(String(vendaBase?.tipoCobranca || '')) ||
    identificarBancoBoleto(String(vendaBase?.bancoCobranca || ''))
  )
}

function boletoFoiGerado(parcela: ParcelaVenda) {
  return boletoEstaUtilizado(parcela)
}

function contarBoletosGeradosNoMesPorBanco(
  banco: BancoBoletoGratuito,
  mesReferencia = gerarMesAtualBoleto(),
  pedidoIgnoradoId?: string,
) {
  return contarBoletosUtilizadosPorBanco(
    carregarVendasCreditoStorage(), banco, mesReferencia, pedidoIgnoradoId,
  )
}

function montarResumoBoletosGratuitos(
  banco: BancoBoletoGratuito,
  mesReferencia = gerarMesAtualBoleto(),
): ResumoBoletosGratuitos {
  const usados = contarBoletosGeradosNoMesPorBanco(banco, mesReferencia)

  return {
    banco,
    usados,
    limite: LIMITE_BOLETOS_GRATUITOS_POR_BANCO,
    disponiveis: Math.max(LIMITE_BOLETOS_GRATUITOS_POR_BANCO - usados, 0),
  }
}

function montarTextoDadosBancarios(tipoCobranca?: string) {
  const tipo = String(tipoCobranca || '')

  if (!tipo.includes('PIX') && !tipo.includes('TRANSFERÊNCIA')) {
    return ''
  }

  const dados = DADOS_PAGAMENTO[tipo]

  if (!dados) return ''

  const linhas = [
    dados.instituicao ? `Instituição: ${dados.instituicao}` : '',
    dados.agencia ? `Agência: ${dados.agencia}` : '',
    dados.conta ? `Conta: ${dados.conta}` : '',
    dados.chavePix ? `Chave PIX: ${dados.chavePix}` : '',
    dados.nomeEmpresa ? `Nome da Empresa: ${dados.nomeEmpresa}` : '',
    dados.cnpj ? `CNPJ: ${dados.cnpj}` : '',
  ].filter(Boolean)

  return linhas.length > 0 ? `Dados bancários:
${linhas.join('\n')}` : ''
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function criarDataLocal(data: string) {
  return new Date(`${data}T00:00:00`)
}

function formatarDataInput(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')

  return `${ano}-${mes}-${dia}`
}

function ultimoDiaDoMes(ano: number, mes: number) {
  return new Date(ano, mes + 1, 0).getDate()
}

function criarDataComDiaAjustado(ano: number, mes: number, dia: number) {
  const ultimoDia = ultimoDiaDoMes(ano, mes)
  const diaSeguro = Math.min(dia, ultimoDia)

  return new Date(ano, mes, diaSeguro)
}

function somarDiasUteis(dataBase: string, dias: number) {
  const data = criarDataLocal(dataBase)
  let adicionados = 0

  while (adicionados < dias) {
    data.setDate(data.getDate() + 1)

    const diaSemana = data.getDay()

    if (diaSemana !== 0 && diaSemana !== 6) {
      adicionados += 1
    }
  }

  return formatarDataInput(data)
}

function somarDiasCorridos(dataBase: string, dias: number) {
  const data = criarDataLocal(dataBase)
  data.setDate(data.getDate() + dias)

  return data
}

function ajustarVencimentoBoleto(data: Date) {
  const ano = data.getFullYear()
  const mes = data.getMonth()
  const dia = data.getDate()

  if (DIAS_VENCIMENTO_BOLETO.includes(dia)) {
    return data
  }

  if (dia < 5) {
    return criarDataComDiaAjustado(ano, mes, 5)
  }

  if (dia === 31) {
    return criarDataComDiaAjustado(ano, mes, 30)
  }

  const diaAnterior = [...DIAS_VENCIMENTO_BOLETO]
    .reverse()
    .find((diaPermitido) => diaPermitido < dia)

  const proximoDia = DIAS_VENCIMENTO_BOLETO.find(
    (diaPermitido) => diaPermitido > dia,
  )

  if (diaAnterior && !proximoDia) {
    return criarDataComDiaAjustado(ano, mes, 30)
  }

  if (diaAnterior && proximoDia) {
    const diferencaParaAnterior = dia - diaAnterior

    if (diferencaParaAnterior <= 2) {
      return criarDataComDiaAjustado(ano, mes, diaAnterior)
    }

    return criarDataComDiaAjustado(ano, mes, proximoDia)
  }

  return data
}

function gerarNumeroInicial() {
  const vendasExistentes = listarVendasCentral() as unknown as Array<Record<string, any>>
  const maiorNumero = vendasExistentes.reduce((maior, registro) => {
    const tipo = String(registro.tipo || '').trim().toLowerCase()
    const status = String(registro.status || registro.statusPedido || '').trim().toUpperCase()
    if (!tipo.includes('pedido') && status !== 'PEDIDO') return maior

    const numero = Number(String(registro.numeroPedido || '').replace(/\D/g, ''))
    return Number.isFinite(numero) ? Math.max(maior, numero) : maior
  }, 2484)

  return String(Math.max(2485, maiorNumero + 1))
}

function normalizarFormaPagamento(forma?: string): Venda['formaPagamento'] {
  const valor = String(forma || '').trim().toUpperCase()

  if (!valor) return '' as Venda['formaPagamento']
  if (valor.includes('BOLETO')) return 'BOLETO' as Venda['formaPagamento']
  if (valor.includes('PIX')) return 'PIX' as Venda['formaPagamento']
  if (valor.includes('TRANSFER')) {
    return 'TRANSFERÊNCIA' as Venda['formaPagamento']
  }
  if (valor.includes('DEPÓSITO')) {
    return 'TRANSFERÊNCIA' as Venda['formaPagamento']
  }
  if (valor.includes('DEPOSITO')) {
    return 'TRANSFERÊNCIA' as Venda['formaPagamento']
  }
  if (valor.includes('DINHEIRO')) return 'DINHEIRO' as Venda['formaPagamento']
  if (valor.includes('CART')) return 'CARTÃO' as Venda['formaPagamento']

  return valor as Venda['formaPagamento']
}

function extrairBancoDaOpcao(opcao?: string): Venda['bancoCobranca'] {
  const texto = String(opcao || '').toUpperCase()

  if (texto.includes('INTER')) {
    return 'Inter' as Venda['bancoCobranca']
  }

  return undefined
}

function normalizarBanco(valor?: string): Venda['bancoCobranca'] {
  const texto = String(valor || '').toUpperCase()

  if (texto === 'INTER') {
    return 'Inter' as Venda['bancoCobranca']
  }

  return undefined
}

function normalizarTipoCobrancaValor(valor?: string): Venda['tipoCobranca'] {
  if (!valor) {
    return undefined
  }

  return valor as Venda['tipoCobranca']
}

function normalizarTipoCobranca(
  forma: string,
  tipoCobranca?: string,
  bancoCobranca?: string,
): Venda['tipoCobranca'] {
  const tipo = String(tipoCobranca || '').trim().toUpperCase()
  const banco = String(bancoCobranca || '').trim().toUpperCase()

  const todasOpcoes = Object.values(OPCOES_COBRANCA_POR_FORMA).flat()
  const opcaoExistente = todasOpcoes.find((opcao) => opcao === tipo)

  if (opcaoExistente) {
    return opcaoExistente as Venda['tipoCobranca']
  }

  if (forma === 'BOLETO') {
    if (banco.includes('INTER')) {
      return 'BOLETO BANCO INTER' as Venda['tipoCobranca']
    }

  }

  if (forma === 'PIX') {
    if (banco.includes('INTER')) {
      return 'PIX BANCO INTER' as Venda['tipoCobranca']
    }

  }

  if (forma === 'TRANSFERÊNCIA') {
    if (banco.includes('INTER')) {
      return 'TRANSFERÊNCIA BANCO INTER' as Venda['tipoCobranca']
    }

  }

  if (forma === 'DINHEIRO') {
    return 'DINHEIRO' as Venda['tipoCobranca']
  }

  if (forma === 'CARTÃO') {
    if (tipo.includes('DÉBITO') || tipo.includes('DEBITO')) {
      return 'CARTÃO DÉBITO SUMUP' as Venda['tipoCobranca']
    }

    if (tipo.includes('CRÉDITO') || tipo.includes('CREDITO')) {
      return 'CARTÃO CRÉDITO SUMUP' as Venda['tipoCobranca']
    }
  }

  return undefined
}


function limparParteEndereco(valor?: string | number) {
  return String(valor || '')
    .replace(/\s+/g, ' ')
    .replace(/^[-,\s]+|[-,\s]+$/g, '')
    .trim()
}

function normalizarEnderecoTexto(valor?: string) {
  return String(valor || '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

function formatarCepPedido(valor?: string | number) {
  const digitos = String(valor || '').replace(/\D/g, '').slice(0, 8)
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos
}

function limparLogradouroEntregaComposto(
  valor?: string | number,
  numeroSeparado?: string | number,
) {
  const texto = limparParteEndereco(valor)
  if (!texto) return ''

  const numero = String(numeroSeparado || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (numero) {
    const antesDoNumero = texto.match(new RegExp(`^(.+?)(?=,?\\s*${numero}(?:\\D|$))`, 'i'))
    if (antesDoNumero?.[1]) return limparParteEndereco(antesDoNumero[1])
  }

  const antesDosDadosComplementares = texto.split(/\s+-\s+(?=[^,]+(?:,|\s+-\s+).*(?:[A-Z]{2}|\d{5}-?\d{3}))/)[0]
  return limparParteEndereco(antesDosDadosComplementares)
}

function separarEnderecoOrcamentoParaPedido(enderecoOrigem?: string) {
  const texto = normalizarEnderecoTexto(enderecoOrigem)
  const linhas = texto
    .split(/\n+/)
    .map((linha) => limparParteEndereco(linha))
    .filter(Boolean)

  const textoCompleto = linhas.join(' - ')
  const cepEncontrado = textoCompleto.match(/(?:CEP\s*:?\s*)?(\d{5}-?\d{3})/i)
  const cidadeEstadoEncontrado = textoCompleto.match(/([A-Za-zÀ-ÿ\s]+)\s*\/\s*([A-Z]{2})/)

  const textoSemCep = limparParteEndereco(
    textoCompleto
      .replace(/CEP\s*:?\s*\d{5}-?\d{3}/gi, '')
      .replace(/\b\d{5}-?\d{3}\b/g, '')
      .replace(/\bBRASIL\b/gi, '')
      .replace(/\s+-\s+-\s+/g, ' - ')
      .replace(/\s+-\s*$/g, ''),
  )

  const partes = textoSemCep
    .split(/\s+-\s+/)
    .map((parte) => limparParteEndereco(parte))
    .filter(Boolean)

  let indiceCidadeEstado = -1
  let cidade = cidadeEstadoEncontrado ? limparParteEndereco(cidadeEstadoEncontrado[1]) : ''
  let estado = cidadeEstadoEncontrado ? limparParteEndereco(cidadeEstadoEncontrado[2]) : ''

  partes.forEach((parte, indice) => {
    const cidadeEstadoParte = parte.match(/([A-Za-zÀ-ÿ\s]+)\s*\/\s*([A-Z]{2})/)

    if (cidadeEstadoParte && indiceCidadeEstado === -1) {
      indiceCidadeEstado = indice
      cidade = limparParteEndereco(cidadeEstadoParte[1])
      estado = limparParteEndereco(cidadeEstadoParte[2])
    }
  })

  const primeiraParte = partes[0] || textoSemCep
  const matchEnderecoNumero = primeiraParte.match(/^(.+?)(?:,\s*|\s+)(\d+[A-Za-z]?)(.*)$/)

  let endereco = primeiraParte
  let numero = ''
  let complementoColado = ''

  if (matchEnderecoNumero) {
    endereco = limparParteEndereco(matchEnderecoNumero[1])
    numero = limparParteEndereco(matchEnderecoNumero[2])
    complementoColado = limparParteEndereco(matchEnderecoNumero[3])
  }

  const partesAntesCidade =
    indiceCidadeEstado >= 0 ? partes.slice(1, indiceCidadeEstado) : partes.slice(1)

  const bairro =
    indiceCidadeEstado > 1
      ? limparParteEndereco(partes[indiceCidadeEstado - 1])
      : ''

  const partesComplemento = partesAntesCidade.filter((parte, indice, lista) => {
    if (bairro && indice === lista.length - 1 && parte === bairro) return false
    return Boolean(parte)
  })

  const complemento = [complementoColado, ...partesComplemento]
    .map((parte) => limparParteEndereco(parte))
    .filter(Boolean)
    .join(' - ')

  return {
    cep: cepEncontrado ? limparParteEndereco(cepEncontrado[1]) : '',
    endereco: limparParteEndereco(endereco),
    numero,
    complemento,
    bairro,
    cidade,
    estado,
  }
}

function montarEnderecoClienteSeparado(
  clienteBase: Cliente | undefined,
  enderecoFallback: ReturnType<typeof separarEnderecoOrcamentoParaPedido>,
  tipo: 'faturamento' | 'entrega',
) {
  const clienteAny = (clienteBase || {}) as any

  const enderecoTextoCliente =
    tipo === 'entrega'
      ? clienteAny.enderecoEntrega || clienteAny.endereco || ''
      : clienteAny.endereco || ''

  const enderecoClienteSeparado = separarEnderecoOrcamentoParaPedido(enderecoTextoCliente)

  const possuiCamposSeparados =
    tipo === 'entrega'
      ? Boolean(
          clienteAny.numeroEntrega ||
            clienteAny.complementoEntrega ||
            clienteAny.bairroEntrega ||
            clienteAny.cidadeEntrega ||
            clienteAny.estadoEntrega ||
            clienteAny.cepEntrega,
        )
      : Boolean(
          clienteAny.numero ||
            clienteAny.complemento ||
            clienteAny.bairro ||
            clienteAny.cidade ||
            clienteAny.estado ||
            clienteAny.cep,
        )

  if (tipo === 'entrega') {
    return {
      cep: limparParteEndereco(enderecoFallback.cep || clienteAny.cepEntrega || clienteAny.cep || enderecoClienteSeparado.cep),
      endereco: limparParteEndereco(
        enderecoFallback.endereco ||
          (possuiCamposSeparados
            ? clienteAny.enderecoEntrega || clienteAny.endereco || enderecoClienteSeparado.endereco
            : enderecoClienteSeparado.endereco),
      ),
      numero: limparParteEndereco(enderecoFallback.numero || clienteAny.numeroEntrega || clienteAny.numero || enderecoClienteSeparado.numero),
      complemento: limparParteEndereco(
        enderecoFallback.complemento || clienteAny.complementoEntrega || clienteAny.complemento || enderecoClienteSeparado.complemento,
      ),
      bairro: limparParteEndereco(enderecoFallback.bairro || clienteAny.bairroEntrega || clienteAny.bairro || enderecoClienteSeparado.bairro),
      cidade: limparParteEndereco(enderecoFallback.cidade || clienteAny.cidadeEntrega || clienteAny.cidade || enderecoClienteSeparado.cidade),
      estado: limparParteEndereco(enderecoFallback.estado || clienteAny.estadoEntrega || clienteAny.estado || enderecoClienteSeparado.estado),
    }
  }

  return {
    cep: limparParteEndereco(enderecoFallback.cep || clienteAny.cep || enderecoClienteSeparado.cep),
    endereco: limparParteEndereco(
      enderecoFallback.endereco ||
        (possuiCamposSeparados
          ? clienteAny.endereco || enderecoClienteSeparado.endereco
          : enderecoClienteSeparado.endereco),
    ),
    numero: limparParteEndereco(enderecoFallback.numero || clienteAny.numero || enderecoClienteSeparado.numero),
    complemento: limparParteEndereco(enderecoFallback.complemento || clienteAny.complemento || enderecoClienteSeparado.complemento),
    bairro: limparParteEndereco(enderecoFallback.bairro || clienteAny.bairro || enderecoClienteSeparado.bairro),
    cidade: limparParteEndereco(enderecoFallback.cidade || clienteAny.cidade || enderecoClienteSeparado.cidade),
    estado: limparParteEndereco(enderecoFallback.estado || clienteAny.estado || enderecoClienteSeparado.estado),
  }
}

function montarEnderecoEntregaDoSnapshot(
  snapshot: Record<string, any> | undefined,
  fallback: ReturnType<typeof montarEnderecoClienteSeparado>,
) {
  if (!snapshot || typeof snapshot !== 'object') return fallback

  const possuiEnderecoEstruturado = Boolean(
    snapshot.logradouro ||
      snapshot.endereco ||
      snapshot.cep ||
      snapshot.numero ||
      snapshot.bairro ||
      snapshot.cidade ||
      snapshot.uf ||
      snapshot.estado,
  )

  if (!possuiEnderecoEstruturado) return fallback

  return {
    cep: limparParteEndereco(snapshot.cep),
    endereco: limparLogradouroEntregaComposto(
      snapshot.logradouro || snapshot.endereco,
      snapshot.numero,
    ),
    numero: limparParteEndereco(snapshot.numero),
    complemento: limparParteEndereco(snapshot.complemento),
    bairro: limparParteEndereco(snapshot.bairro),
    cidade: limparParteEndereco(snapshot.cidade),
    estado: limparParteEndereco(snapshot.uf || snapshot.estado).toUpperCase().slice(0, 2),
  }
}

function localizarClienteDoOrcamento(
  clientes: Cliente[],
  orcamentoOrigem?: Record<string, any>,
) {
  if (!orcamentoOrigem) return undefined

  const clienteId = String(
    orcamentoOrigem.clienteId ||
      orcamentoOrigem.clienteCodigo ||
      orcamentoOrigem.codigoCliente ||
      '',
  )
  const documentoOrigem = somenteNumerosCredito(
    orcamentoOrigem.clienteDocumento || orcamentoOrigem.documento || '',
  )
  const nomeOrigem = normalizarBuscaCredito(
    orcamentoOrigem.clienteNome || orcamentoOrigem.nomeCliente || '',
  )

  return clientes.find((clienteAtual) => {
    const clienteAny = clienteAtual as any
    const codigo = String(clienteAtual.codigo || '')
    const id = String(clienteAny.id || '')
    const documento = somenteNumerosCredito(
      clienteAtual.cnpj || clienteAtual.cpf || clienteAny.documento || '',
    )
    const nome = normalizarBuscaCredito(montarNomeClienteBase(clienteAtual))

    return Boolean(
      (clienteId && (codigo === clienteId || id === clienteId)) ||
        (documentoOrigem && documento && documento === documentoOrigem) ||
        (nomeOrigem && nome && nome === nomeOrigem),
    )
  })
}

function montarNomeClienteBase(cliente?: Cliente) {
  const clienteAny = (cliente || {}) as any
  return (
    cliente?.razaoSocial ||
    cliente?.nomeFantasia ||
    clienteAny.nome ||
    clienteAny.apelido ||
    ''
  )
}

function numeroPedidoSeguro(valor: unknown) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : 0
  }

  const texto = String(valor ?? '').trim()
  if (!texto) return 0

  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto

  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : 0
}

function recalcularItemPedido(item: ItemVenda): ItemVenda {
  const quantidade = Math.max(0, numeroPedidoSeguro(item.quantidade))
  const valorUnitario = Math.max(0, numeroPedidoSeguro(item.valorUnitario))
  const descontoValor = Math.max(0, numeroPedidoSeguro(item.descontoValor))
  const valorTotal = Math.max(0, quantidade * valorUnitario - descontoValor)

  return {
    ...item,
    quantidade,
    valorUnitario,
    descontoValor,
    valorTotal: Number(valorTotal.toFixed(2)),
  }
}
function montarItensPedidoAPartirDoOrcamento(itensOrigem?: any[]): ItemVenda[] {
  if (!Array.isArray(itensOrigem)) return []

  return itensOrigem.map((item) => {
    const quantidade = numeroPedidoSeguro(item.quantidade)
    const valorUnitario = numeroPedidoSeguro(item.valorUnitario || item.precoUnitario)
    const descontoValor = numeroPedidoSeguro(item.desconto || item.descontoValor)

    return recalcularItemPedido({
      codigoProduto: item.codigoProduto || item.codigo || item.produtoCodigo || '',
      codigoBarras: item.codigoBarras || '',
      descricao: item.descricao || item.nome || item.produto || '',
      quantidade,
      unidade: item.unidade || 'UN',
      valorUnitario,
      descontoValor,
      descontoPercentual: Number(item.descontoPercentual || 0),
      valorTotal: 0,
      observacao: item.observacao || '',
      ncm: String(item.ncm || '').replace(/\D/g, '').slice(0, 8),
      ncmDescricao: item.ncmDescricao || '',
      cfop: String(item.cfop || '').replace(/\D/g, '').slice(0, 4),
    } as ItemVenda)
  })
}

function montarParcelasPedidoAPartirDoOrcamento(
  pagamentosOrigem?: any[],
): ParcelaVenda[] {
  if (!Array.isArray(pagamentosOrigem)) return []

  return pagamentosOrigem.map((pagamento, index) => {
    const tipoCobranca = normalizarTipoCobrancaValor(
      pagamento.formaPagamento || pagamento.tipoCobranca || '',
    )
    const bancoCobranca =
      extrairBancoDaOpcao(String(tipoCobranca || pagamento.bancoCobranca || '')) ||
      normalizarBanco(String(pagamento.bancoCobranca || ''))

    return {
      numero: Number(pagamento.numero || index + 1),
      vencimento: pagamento.vencimento || hoje(),
      observacao: pagamento.observacoes || pagamento.observacao || '',
      valor: Number(pagamento.valor || 0),
      bancoCobranca,
      tipoCobranca,
      statusBoleto: pagamento.statusBoleto || 'Pendente',
    } as ParcelaVenda
  })
}

function buscarOrcamentoOrigemUrl() {
  if (typeof window === 'undefined') return undefined

  const parametrosPagina = new URLSearchParams(window.location.search)
  const parametrosHash = new URLSearchParams(
    window.location.hash.includes('?')
      ? window.location.hash.slice(window.location.hash.indexOf('?'))
      : '',
  )
  const orcamentoId =
    parametrosHash.get('orcamentoId') ||
    parametrosPagina.get('orcamentoId') ||
    ''

  if (!orcamentoId) return undefined

  return buscarVendaStorage(orcamentoId) as unknown as Record<string, any> | undefined
}

function criarPedidoAPartirDoOrcamento(
  orcamentoOrigem: Record<string, any>,
  clientes: Cliente[],
) {
  const clienteBase = localizarClienteDoOrcamento(clientes, orcamentoOrigem)
  const clienteAny = (clienteBase || {}) as any
  const enderecoFaturamento = separarEnderecoOrcamentoParaPedido(
    orcamentoOrigem.enderecoFaturamento || orcamentoOrigem.faturamentoEndereco || '',
  )
  const enderecoEntrega = separarEnderecoOrcamentoParaPedido(
    orcamentoOrigem.enderecoEntrega || orcamentoOrigem.entregaEndereco || orcamentoOrigem.enderecoFaturamento || '',
  )
  const enderecoFaturamentoBase = montarEnderecoClienteSeparado(
    clienteBase,
    enderecoFaturamento,
    'faturamento',
  )
  const enderecoEntregaBase = montarEnderecoEntregaDoSnapshot(
    orcamentoOrigem.enderecoEntregaSnapshot,
    montarEnderecoClienteSeparado(
      clienteBase,
      enderecoEntrega,
      'entrega',
    ),
  )
  const enderecoFaturamentoFinal = {
    cep: limparParteEndereco(orcamentoOrigem.faturamentoCep || enderecoFaturamentoBase.cep),
    endereco: limparLogradouroEntregaComposto(
      orcamentoOrigem.faturamentoEndereco || enderecoFaturamentoBase.endereco,
      orcamentoOrigem.faturamentoNumero || enderecoFaturamentoBase.numero,
    ),
    numero: limparParteEndereco(orcamentoOrigem.faturamentoNumero || enderecoFaturamentoBase.numero),
    complemento: limparParteEndereco(orcamentoOrigem.faturamentoComplemento || enderecoFaturamentoBase.complemento),
    bairro: limparParteEndereco(orcamentoOrigem.faturamentoBairro || enderecoFaturamentoBase.bairro),
    cidade: limparParteEndereco(orcamentoOrigem.faturamentoCidade || enderecoFaturamentoBase.cidade),
    estado: limparParteEndereco(orcamentoOrigem.faturamentoEstado || enderecoFaturamentoBase.estado),
  }
  const numeroEntregaOrigem = orcamentoOrigem.entregaNumero || enderecoEntregaBase.numero
  const enderecoEntregaFinal = {
    cep: limparParteEndereco(orcamentoOrigem.entregaCep || enderecoEntregaBase.cep),
    endereco: limparLogradouroEntregaComposto(
      orcamentoOrigem.entregaEndereco || enderecoEntregaBase.endereco,
      numeroEntregaOrigem,
    ),
    numero: limparParteEndereco(numeroEntregaOrigem),
    complemento: limparParteEndereco(orcamentoOrigem.entregaComplemento || enderecoEntregaBase.complemento),
    bairro: limparParteEndereco(orcamentoOrigem.entregaBairro || enderecoEntregaBase.bairro),
    cidade: limparParteEndereco(orcamentoOrigem.entregaCidade || enderecoEntregaBase.cidade),
    estado: limparParteEndereco(orcamentoOrigem.entregaEstado || enderecoEntregaBase.estado),
  }
  const pagamentosOrigem = Array.isArray(orcamentoOrigem.pagamentos)
    ? orcamentoOrigem.pagamentos
    : Array.isArray(orcamentoOrigem.parcelas)
      ? orcamentoOrigem.parcelas
      : []
  const primeiraCobranca = pagamentosOrigem[0] || {}
  const formaPagamentoInicial = normalizarFormaPagamento(
    orcamentoOrigem.formaPagamento || primeiraCobranca.formaPagamento || primeiraCobranca.tipoCobranca,
  )
  const tipoCobrancaInicial = normalizarTipoCobranca(
    String(formaPagamentoInicial || ''),
    orcamentoOrigem.tipoCobranca || primeiraCobranca.formaPagamento || primeiraCobranca.tipoCobranca,
    orcamentoOrigem.bancoCobranca || primeiraCobranca.bancoCobranca,
  )
  const dataInicial = orcamentoOrigem.dataEmissao || hoje()
  const tipoDescontoOrigem = String(orcamentoOrigem.tipoDesconto || '').toLowerCase()
  const descontoInformado = Number(orcamentoOrigem.descontoInformado || 0)
  const numeroOrcamentoOrigem = String(
    orcamentoOrigem.numeroOrcamento ||
    orcamentoOrigem.numero ||
    orcamentoOrigem.codigo ||
    '',
  ).trim()

  return {
    id: String(Date.now()),
    tipo: 'Pedido',
    numeroOrcamento: numeroOrcamentoOrigem,
    numeroPedido: gerarNumeroInicial(),
    orcamentoOrigemId: orcamentoOrigem.id || '',
    orcamentoOrigemNumero: numeroOrcamentoOrigem,
    dataEmissao: dataInicial,
    dataValidade: orcamentoOrigem.dataValidade || somarDiasUteis(dataInicial, 5),
    dataEntrega: orcamentoOrigem.dataEntrega || somarDiasUteis(dataInicial, 2),
    statusPedido: 'Aberto',
    vendedor: orcamentoOrigem.vendedor || 'NATÁLIA VIEIRA',

    clienteCodigo:
      orcamentoOrigem.clienteId ||
      orcamentoOrigem.clienteCodigo ||
      clienteBase?.codigo ||
      clienteAny.id ||
      '',
    clienteNome:
      orcamentoOrigem.clienteNome ||
      montarNomeClienteBase(clienteBase as Cliente) ||
      '',
    clienteDocumento:
      orcamentoOrigem.clienteDocumento ||
      clienteBase?.cnpj ||
      clienteBase?.cpf ||
      clienteAny.documento ||
      '',
    clienteIeRg: orcamentoOrigem.clienteInscricaoEstadual || clienteBase?.inscricaoEstadual || '',
    clienteIndicadorIE:
      orcamentoOrigem.clienteIndicadorIE ||
      clienteBase?.indicadorIE ||
      (somenteNumerosCredito(orcamentoOrigem.clienteInscricaoEstadual || clienteBase?.inscricaoEstadual || '') ? '1' : ''),
    clienteEmail:
      orcamentoOrigem.emailEnvio ||
      orcamentoOrigem.clienteEmailNotaFiscal ||
      orcamentoOrigem.clienteEmail ||
      clienteAny.emailNotaFiscal ||
      clienteBase?.email ||
      '',
    clienteTelefone: orcamentoOrigem.clienteTelefone || clienteBase?.telefone || clienteBase?.celular || '',
    clienteCreditoDisponivel: Number(clienteBase?.limiteCredito || 0),
    clienteEmailNotaFiscal: orcamentoOrigem.emailEnvio || orcamentoOrigem.clienteEmailNotaFiscal || orcamentoOrigem.clienteEmail || clienteBase?.email || '',
    emailEnvio: orcamentoOrigem.emailEnvio || orcamentoOrigem.clienteEmailNotaFiscal || orcamentoOrigem.clienteEmail || clienteBase?.email || '',
    enderecoEntregaId: orcamentoOrigem.enderecoEntregaId || '',
    enderecoEntregaNome: orcamentoOrigem.enderecoEntregaNome || '',
    enderecoEntregaCompleto: orcamentoOrigem.enderecoEntregaCompleto || orcamentoOrigem.enderecoEntrega || '',
    enderecoEntregaSnapshot: orcamentoOrigem.enderecoEntregaSnapshot,
    responsavelEntrega: orcamentoOrigem.responsavelEntrega || '',
    telefoneEntrega: orcamentoOrigem.telefoneEntrega || '',
    celularEntrega: orcamentoOrigem.celularEntrega || '',
    horarioEntrega: orcamentoOrigem.horarioEntrega || '',

    faturamentoCep: enderecoFaturamentoFinal.cep,
    faturamentoEndereco: enderecoFaturamentoFinal.endereco,
    faturamentoNumero: enderecoFaturamentoFinal.numero,
    faturamentoComplemento: enderecoFaturamentoFinal.complemento,
    faturamentoBairro: enderecoFaturamentoFinal.bairro,
    faturamentoCidade: enderecoFaturamentoFinal.cidade,
    faturamentoEstado: enderecoFaturamentoFinal.estado,
    faturamentoCodigoIbge: String((clienteBase as any)?.codigoIbgeMunicipio || ''),

    entregaCep: enderecoEntregaFinal.cep,
    entregaEndereco: enderecoEntregaFinal.endereco,
    entregaNumero: enderecoEntregaFinal.numero,
    entregaComplemento:
      enderecoEntregaFinal.complemento,
    entregaBairro: enderecoEntregaFinal.bairro,
    entregaCidade: enderecoEntregaFinal.cidade,
    entregaEstado: enderecoEntregaFinal.estado,
    entregaCodigoIbge: String(
      orcamentoOrigem.enderecoEntregaSnapshot?.codigoIbgeMunicipio ||
        (clienteBase as any)?.codigoIbgeMunicipioEntrega ||
        (clienteBase as any)?.codigoIbgeMunicipio ||
        '',
    ),

    itens: montarItensPedidoAPartirDoOrcamento(orcamentoOrigem.itens),
    subtotal: Number(orcamentoOrigem.subtotal || 0),
    descontoValor: tipoDescontoOrigem === 'percentual' ? 0 : descontoInformado,
    descontoPercentual: tipoDescontoOrigem === 'percentual' ? descontoInformado : 0,
    frete: Number(orcamentoOrigem.frete || 0),
    outrosCustos: Number(orcamentoOrigem.outrosCustos || 0),
    totalFinal: Number(orcamentoOrigem.totalFinal || 0),

    formaPagamento: formaPagamentoInicial,
    parcelamento: orcamentoOrigem.parcelamento || primeiraCobranca.prazo || '',
    bancoCobranca:
      normalizarBanco(String(orcamentoOrigem.bancoCobranca || '')) ||
      extrairBancoDaOpcao(String(tipoCobrancaInicial || primeiraCobranca.formaPagamento || '')),
    tipoCobranca: tipoCobrancaInicial,
    valorPagamento: calcularTotalDocumento(orcamentoOrigem),
    parcelas: montarParcelasPedidoAPartirDoOrcamento(pagamentosOrigem),

    observacoes: orcamentoOrigem.observacoes || '',
    observacaoInterna: '',

    statusNotaFiscal: 'Pendente',
    numeroNotaFiscal: '',
    chaveAcessoNotaFiscal: '',
    dataEmissaoNotaFiscal: '',
    xmlNotaFiscal: '',
    danfePdf: '',
    statusBoleto: 'Pendente',
    notaBoletoEnviados: false,
    dataEnvioNotaBoleto: '',
    canalEnvio: '',
  } as Venda
}


function calcularValorRecebidoParcela(parcela: ParcelaVenda) {
  const valorRecebido = Number(parcela.valorRecebido || 0)
  if (valorRecebido > 0) return valorRecebido

  const status = String(parcela.statusBoleto || '').toUpperCase().trim()
  return status === 'PAGO' ? Number(parcela.valor || 0) : 0
}

function calcularTotalDocumento(vendaBase?: Partial<Venda> | null) {
  if (!vendaBase) return 0

  const itens = Array.isArray(vendaBase.itens) ? vendaBase.itens : []
  const subtotalCalculado = itens.reduce(
    (total, item) => total + recalcularItemPedido(item as ItemVenda).valorTotal,
    0,
  )
  const subtotal = subtotalCalculado > 0
    ? subtotalCalculado
    : Number(vendaBase.subtotal || 0)
  const descontoPercentual = Number(vendaBase.descontoPercentual || 0)
  const desconto = descontoPercentual > 0
    ? subtotal * (descontoPercentual / 100)
    : Number(vendaBase.descontoValor || 0)

  return Number(Math.max(
    subtotal - desconto + Number(vendaBase.frete || 0) + Number(vendaBase.outrosCustos || 0),
    0,
  ).toFixed(2))
}

function calcularSaldoRealPedido(vendaBase?: Partial<Venda> | null) {
  if (!vendaBase) return 0

  const totalPedido = calcularTotalDocumento(vendaBase)
  const parcelas = Array.isArray(vendaBase.parcelas) ? vendaBase.parcelas : []
  const totalRecebido = parcelas.reduce(
    (total, parcela) => total + calcularValorRecebidoParcela(parcela),
    0,
  )

  return Number(Math.max(totalPedido - totalRecebido, 0).toFixed(2))
}

const SYNERGIAS_CONSOLIDADO_PEDIDO_V248 = 'SYNERGIAS_CONSOLIDADO_PEDIDO_V248'
const SYNERGIAS_PEDIDO_LAYOUT_FISCAL_V249 = 'SYNERGIAS_PEDIDO_LAYOUT_FISCAL_V249'
const SYNERGIAS_PEDIDO_2498_DOCUMENTO_PERSISTENTE_V249D = 'SYNERGIAS_PEDIDO_2498_DOCUMENTO_PERSISTENTE_V249D'

function PedidoForm() {
  ;(window as any).__SYNERGIAS_TOTAL_PEDIDO__ = 'V208_TOTAL_PEDIDO_RECALCULADO'
  const navigate = useNavigate()
  const impressaoAutomaticaExecutada = useRef(false)
  const envioEmailAutomaticoExecutado = useRef(false)
  const cancelamentosBoletoEmAndamento = useRef(new Set<string>())
  const { id } = useParams()
  const contaCobrancaAtrasoId = parametroUrlAtual('cobrancaAtraso')
  const contaCobrancaAtraso = contaCobrancaAtrasoId
    ? listarContasReceberStorage().find((conta) => String(conta.id) === contaCobrancaAtrasoId)
    : undefined

  const vendaEncontrada = id ? buscarVendaStorage(id) : undefined
  const recargaPedidoExecutada = useRef(false)

  useEffect(() => {
    if (!vendaEncontrada || envioEmailAutomaticoExecutado.current) return
    const parametros = new URLSearchParams(window.location.search)
    if (parametros.get('enviarEmail') !== '1') return

    envioEmailAutomaticoExecutado.current = true
    parametros.delete('enviarEmail')
    const busca = parametros.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${busca ? `?${busca}` : ''}`)
    void enviarNotaBoleto()
  }, [vendaEncontrada])

  useEffect(() => {
    if (!id || vendaEncontrada) return

    const recarregarQuandoCentralChegar = (evento: Event) => {
      const detalhe = (evento as CustomEvent<{ collection?: string }>).detail
      if (detalhe?.collection && detalhe.collection !== 'vendas') return
      if (recargaPedidoExecutada.current) return
      if (!buscarVendaStorage(id)) return
      recargaPedidoExecutada.current = true
      window.location.reload()
    }

    window.addEventListener(ERP_STORAGE_UPDATED_EVENT, recarregarQuandoCentralChegar)
    return () => window.removeEventListener(ERP_STORAGE_UPDATED_EVENT, recarregarQuandoCentralChegar)
  }, [id, vendaEncontrada])
  const clientesIniciais = listarClientesStorage()
  const orcamentoOrigemEncontrado = !id ? buscarOrcamentoOrigemUrl() : undefined
  const vendaInicial =
    vendaEncontrada ||
    (orcamentoOrigemEncontrado
      ? criarPedidoAPartirDoOrcamento(orcamentoOrigemEncontrado, clientesIniciais)
      : undefined)

  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciais)
  const produtos = listarProdutosStorage()

  const formaPagamentoInicial = normalizarFormaPagamento(
    vendaInicial?.formaPagamento,
  )

  const tipoCobrancaInicial = normalizarTipoCobranca(
    String(formaPagamentoInicial || ''),
    vendaInicial?.tipoCobranca,
    vendaInicial?.bancoCobranca,
  )

  const orcamentoOrigemCentral = (listarVendasCentral() as unknown as Array<any>)
    .find((registro) => {
      const tipo = String(registro?.tipo || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
      if (!tipo.includes('orcamento')) return false
      return (
        (
          Boolean(vendaInicial?.orcamentoOrigemId) &&
          String(registro?.id || '') === String(vendaInicial?.orcamentoOrigemId)
        ) ||
        (
          Boolean(vendaInicial?.id) &&
          String(registro?.pedidoGeradoId || registro?.pedidoId || '') ===
            String(vendaInicial?.id)
        ) ||
        (
          Boolean(vendaInicial?.numeroPedido) &&
          String(registro?.numeroPedido || registro?.pedidoGeradoNumero || '') ===
            String(vendaInicial?.numeroPedido)
        )
      )
    })

  const numeroOrcamentoOrigemCentral = String(
    orcamentoOrigemCentral?.numeroOrcamento ||
    orcamentoOrigemCentral?.numero ||
    orcamentoOrigemCentral?.codigo ||
    '',
  ).trim()

  const codigoOrcamentoOrigem =
    numeroOrcamentoOrigemCentral ||
    vendaInicial?.orcamentoOrigemNumero ||
    vendaInicial?.numeroOrcamento ||
    ''

  const [clienteBusca, setClienteBusca] = useState(
    vendaInicial?.clienteNome || '',
  )
  const [clienteSugestaoAtiva, setClienteSugestaoAtiva] = useState(-1)
  const [produtoSugestaoAtiva, setProdutoSugestaoAtiva] = useState(-1)
  const clienteSugestaoAtivaRef = useRef(-1)
  const produtoSugestaoAtivaRef = useRef(-1)
  const [produtoSelecionadoCodigo, setProdutoSelecionadoCodigo] = useState('')
  const [produtoBusca, setProdutoBusca] = useState('')
  const [brindeProdutoCodigo, setBrindeProdutoCodigo] = useState('')
  const [brindeProdutoBusca, setBrindeProdutoBusca] = useState('')
  const [mostrarSugestoesBrinde, setMostrarSugestoesBrinde] = useState(false)
  const [brindeQuantidade, setBrindeQuantidade] = useState(1)
  const [brindeDestinatario, setBrindeDestinatario] = useState('')
  const [brindeObservacao, setBrindeObservacao] = useState('')
  const [quantidadeItem, setQuantidadeItem] = useState(1)
  const [mostrarSugestoesCliente, setMostrarSugestoesCliente] = useState(false)
  const [mostrarSugestoesProduto, setMostrarSugestoesProduto] = useState(false)
  const [mostrarCadastroCliente, setMostrarCadastroCliente] = useState(false)
  const [mostrarCreditoCliente, setMostrarCreditoCliente] = useState(false)
  const [ajustesFiscais, setAjustesFiscais] = useState<AjusteFiscalItem[]>([])
  const [mostrarAjusteFiscal, setMostrarAjusteFiscal] = useState(false)
  const [mostrarEdicaoFiscal, setMostrarEdicaoFiscal] = useState(false)
  const [entregaEmProcessamento, setEntregaEmProcessamento] = useState(false)
  const entregaEmProcessamentoRef = useRef(false)
  const salvamentoEmailsEmAndamentoRef = useRef<Promise<Venda | null> | null>(null)
  const statusPedidoPersistidoRef = useRef(vendaInicial?.statusPedido || 'Aberto')
  const [buscasNcm, setBuscasNcm] = useState<Record<number, string>>({})
  const [sugestoesNcm, setSugestoesNcm] = useState<Record<number, SugestaoNcm[]>>({})
  const [buscandoNcmPorLinha, setBuscandoNcmPorLinha] = useState<Record<number, boolean>>({})
  const temporizadoresBuscaNcm = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const [limiteCreditoTexto, setLimiteCreditoTexto] = useState('0,00')
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [emailsCopiaTexto, setEmailsCopiaTexto] = useState(
    (vendaInicial?.emailsCopiaEnvio || []).join('; '),
  )
  const [modoEnvioWhatsapp, setModoEnvioWhatsapp] = useState<'agora' | 'agendar'>('agora')
  const [dataEnvioWhatsappAgendado, setDataEnvioWhatsappAgendado] = useState(hoje())
  const [horaEnvioWhatsappAgendado, setHoraEnvioWhatsappAgendado] = useState('08:30')
  const [novoCliente, setNovoCliente] = useState<NovoClienteRapido>({
    nome: '',
    documento: '',
    telefone: '',
    email: '',
    emailNotaFiscal: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
  })
  const [tipoDesconto, setTipoDesconto] = useState<TipoDesconto>(
    Number(vendaInicial?.descontoPercentual || 0) > 0
      ? 'percentual'
      : 'valor',
  )

  const dataInicial = vendaInicial?.dataEmissao || hoje()

  const [venda, setVenda] = useState<Venda>({
    id: vendaInicial?.id || String(Date.now()),
    tipo: 'Pedido',

    numeroOrcamento:
      numeroOrcamentoOrigemCentral || vendaInicial?.numeroOrcamento || '',
    numeroPedido: vendaEncontrada?.numeroPedido || gerarNumeroInicial(),

    orcamentoOrigemId: vendaInicial?.orcamentoOrigemId || '',
    orcamentoOrigemNumero: codigoOrcamentoOrigem,

    dataEmissao: dataInicial,
    dataValidade:
      vendaInicial?.dataValidade || somarDiasUteis(dataInicial, 5),
    dataEntrega:
      vendaInicial?.dataEntrega || somarDiasUteis(dataInicial, 2),

    statusPedido: vendaInicial?.statusPedido || 'Aberto',

    vendedor: vendaInicial?.vendedor || 'NATÁLIA VIEIRA',

    clienteCodigo: vendaInicial?.clienteCodigo || '',
    clienteNome: vendaInicial?.clienteNome || '',
    clienteDocumento: vendaInicial?.clienteDocumento || '',
    clienteIeRg: vendaInicial?.clienteIeRg || '',
    clienteEmail: vendaInicial?.clienteEmail || '',
    clienteTelefone: vendaInicial?.clienteTelefone || '',
    clienteCreditoDisponivel: vendaInicial?.clienteCreditoDisponivel || 0,

    faturamentoCep: vendaInicial?.faturamentoCep || '',
    faturamentoEndereco: vendaInicial?.faturamentoEndereco || '',
    faturamentoNumero: vendaInicial?.faturamentoNumero || '',
    faturamentoComplemento: vendaInicial?.faturamentoComplemento || '',
    faturamentoBairro: vendaInicial?.faturamentoBairro || '',
    faturamentoCidade: vendaInicial?.faturamentoCidade || '',
    faturamentoCodigoIbge: vendaInicial?.faturamentoCodigoIbge || '',
    faturamentoEstado: vendaInicial?.faturamentoEstado || '',

    entregaCep: formatarCepPedido(vendaInicial?.entregaCep || ''),
    entregaEndereco: limparLogradouroEntregaComposto(
      vendaInicial?.entregaEndereco || '',
      vendaInicial?.entregaNumero || '',
    ),
    entregaNumero: vendaInicial?.entregaNumero || '',
    entregaComplemento: vendaInicial?.entregaComplemento || '',
    entregaBairro: vendaInicial?.entregaBairro || '',
    entregaCidade: vendaInicial?.entregaCidade || '',
    entregaEstado: vendaInicial?.entregaEstado || '',
    entregaCodigoIbge: (vendaInicial as any)?.entregaCodigoIbge || '',

    itens: (vendaInicial?.itens || []).map(recalcularItemPedido),
    brindes: vendaInicial?.brindes || [],

    subtotal: vendaInicial?.subtotal || 0,
    descontoValor: vendaInicial?.descontoValor || 0,
    descontoPercentual: vendaInicial?.descontoPercentual || 0,
    frete: vendaInicial?.frete || 0,
    modalidadeFrete: ((vendaInicial?.modalidadeFrete as '0' | '1' | '2' | undefined) || '0'),
    outrosCustos: vendaInicial?.outrosCustos || 0,
    totalFinal: vendaInicial?.totalFinal || 0,

    formaPagamento: formaPagamentoInicial,
    parcelamento: vendaInicial?.parcelamento || '',
    bancoCobranca:
      normalizarBanco(String(vendaInicial?.bancoCobranca || '')) ||
      extrairBancoDaOpcao(String(tipoCobrancaInicial || '')),
    tipoCobranca: tipoCobrancaInicial,
    valorPagamento: calcularSaldoRealPedido(vendaInicial),
    parcelas: vendaInicial?.parcelas || [],

    observacoes: vendaInicial?.observacoes || '',
    observacaoInterna: vendaInicial?.observacaoInterna || '',

    statusNotaFiscal: vendaInicial?.statusNotaFiscal || 'Pendente',
    numeroNotaFiscal: vendaInicial?.numeroNotaFiscal || '',
    chaveAcessoNotaFiscal: vendaInicial?.chaveAcessoNotaFiscal || '',
    dataEmissaoNotaFiscal: vendaInicial?.dataEmissaoNotaFiscal || '',
    xmlNotaFiscal: vendaInicial?.xmlNotaFiscal || '',
    danfePdf: vendaInicial?.danfePdf || '',

    statusBoleto: vendaInicial?.statusBoleto || 'Pendente',

    notaBoletoEnviados: vendaInicial?.notaBoletoEnviados || false,
    dataEnvioNotaBoleto: vendaInicial?.dataEnvioNotaBoleto || '',
    canalEnvio: vendaInicial?.canalEnvio || '',
  })

  useEffect(() => {
    let ativo = true
    void resolverCodigoIbgeMunicipio(venda.faturamentoCidade, venda.faturamentoEstado, venda.faturamentoCodigoIbge).then((codigo) => {
      if (!ativo || !codigo || codigo === venda.faturamentoCodigoIbge) return
      setVenda((atual) => ({ ...atual, faturamentoCodigoIbge: codigo }))
    })
    return () => { ativo = false }
  }, [venda.faturamentoCidade, venda.faturamentoEstado, venda.faturamentoCodigoIbge])

  useEffect(() => {
    let ativo = true
    void resolverCodigoIbgeMunicipio(venda.entregaCidade, venda.entregaEstado, (venda as any).entregaCodigoIbge).then((codigo) => {
      if (!ativo || !codigo || codigo === (venda as any).entregaCodigoIbge) return
      setVenda((atual) => ({ ...atual, entregaCodigoIbge: codigo } as Venda))
    })
    return () => { ativo = false }
  }, [venda.entregaCidade, venda.entregaEstado, (venda as any).entregaCodigoIbge])

  const titulo = vendaEncontrada ? 'Editar Pedido' : 'Novo Pedido'

  const totais = useMemo(() => calcularTotais(venda), [venda, tipoDesconto])

  const sugestoesClientes = useMemo(() => {
    const busca = clienteBusca.trim().toLowerCase()

    if (!busca) return []

    return clientes
      .filter((cliente: Cliente) => {
        const nome = montarNomeCliente(cliente).toLowerCase()
        const codigo = String(cliente.codigo || '').toLowerCase()
        const documento = String(cliente.cnpj || cliente.cpf || '').toLowerCase()

        return (
          nome.includes(busca) ||
          codigo.includes(busca) ||
          documento.includes(busca)
        )
      })
      .slice(0, 10)
  }, [clienteBusca, clientes])

  const sugestoesProdutos = useMemo(() => {
    const busca = produtoBusca.trim().toLowerCase()

    if (!busca) return []

    return produtos
      .filter((produto: Produto) => {
        const texto = montarTextoProdutoBusca(produto).toLowerCase()

        return texto.includes(busca)
      })
      .slice(0, 10)
  }, [produtoBusca, produtos])

  const opcoesTipoPagamento =
    OPCOES_COBRANCA_POR_FORMA[String(venda.formaPagamento || '')] || []

  const prazosPagamento =
    PRAZOS_POR_FORMA[String(venda.formaPagamento || '')] || []

  const dadosPagamentoSelecionado = venda.tipoCobranca
    ? DADOS_PAGAMENTO[String(venda.tipoCobranca)]
    : undefined

  const mesAtualBoletos = gerarMesAtualBoleto()

  const resumoBoletosInter = useMemo(
    () => montarResumoBoletosGratuitos('Inter', mesAtualBoletos),
    [mesAtualBoletos, venda.parcelas, venda.statusBoleto],
  )

  const clienteSelecionado = useMemo(
    () => localizarClienteAtualParaDocumento(venda),
    [clientes, venda.clienteCodigo, venda.clienteDocumento, venda.clienteNome],
  )

  const resumoCreditoCliente = useMemo(
    () => calcularResumoCreditoCliente(clienteSelecionado, venda, totais.totalFinal),
    [clienteSelecionado, venda, totais.totalFinal],
  )

  useEffect(() => {
    if (!clienteSelecionado) {
      if (!clientes.length || !(venda.clienteCodigo || venda.clienteDocumento || venda.clienteNome)) return
      setEmailsCopiaTexto('')
      setVenda((atual) => ({
        ...atual,
        clienteEmail: '',
        clienteEmailNotaFiscal: '',
        emailEnvio: '',
        emailsCopiaEnvio: [],
      }))
      return
    }
    const locais = normalizarEnderecosEntrega(clienteSelecionado)
    const local = locais.find((item) => item.id === venda.enderecoEntregaId) ||
      locais.find((item) =>
        somenteNumerosCredito(item.cep || '') === somenteNumerosCredito(venda.entregaCep || '') &&
        String(item.numero || '').trim() === String(venda.entregaNumero || '').trim()) ||
      locais.find((item) => item.ativo)
    const clienteComEmailFiscal = clienteSelecionado as Cliente & { emailNotaFiscal?: string }
    const emailBruto = String(
      local?.emailEnvio || clienteComEmailFiscal.emailNotaFiscal || clienteSelecionado.email || '',
    ).trim()
    const emailsDoCampo = emailBruto
      .split(/[;,\n]+/)
      .map(extrairPrimeiroEmail)
      .filter(Boolean)
    const emailCorreto = emailsDoCampo[0] || ''
    const copiasCadastradas = Array.isArray(local?.emailsCopiaEnvio) && local.emailsCopiaEnvio.length
      ? local.emailsCopiaEnvio
      : Array.isArray(clienteSelecionado.emailsCopiaDocumentos)
        ? clienteSelecionado.emailsCopiaDocumentos
        : []
    const copiasCorretas = Array.from(new Set(
      [...emailsDoCampo.slice(1), ...copiasCadastradas.map((email) => extrairPrimeiroEmail(String(email)))]
        .filter((email) => email && email !== emailCorreto),
    ))

    setEmailsCopiaTexto(copiasCorretas.join('; '))
    setVenda((atual) => {
      const copiasAtuais = Array.isArray(atual.emailsCopiaEnvio) ? atual.emailsCopiaEnvio : []
      const clienteAny = clienteSelecionado as Cliente & {
        documento?: string
        cpfCnpj?: string
        cnpjCpf?: string
        logradouro?: string
        uf?: string
        codigoIbgeMunicipio?: string
      }
      const documentoAtual = somenteNumerosCredito(atual.clienteDocumento || '')
      const documentoCadastro = somenteNumerosCredito(
        clienteSelecionado.cnpj ||
        clienteSelecionado.cpf ||
        clienteAny.cpfCnpj ||
        clienteAny.cnpjCpf ||
        clienteAny.documento ||
        '',
      )
      const documentoCorreto = [documentoCadastro, documentoAtual]
        .find((documento) => documento.length === 11 || documento.length === 14) || documentoCadastro || documentoAtual
      const primeiroTexto = (...valores: Array<string | number | undefined | null>) =>
        valores.map((valor) => String(valor ?? '').trim()).find(Boolean) || ''
      const dadosCadastro = {
        clienteDocumento: documentoCorreto,
        clienteTelefone: primeiroTexto(atual.clienteTelefone, clienteSelecionado.telefone, clienteSelecionado.celular),
        faturamentoCep: primeiroTexto(atual.faturamentoCep, clienteSelecionado.cep),
        faturamentoEndereco: primeiroTexto(atual.faturamentoEndereco, clienteSelecionado.endereco, clienteAny.logradouro),
        faturamentoNumero: primeiroTexto(atual.faturamentoNumero, clienteSelecionado.numero),
        faturamentoComplemento: primeiroTexto(atual.faturamentoComplemento, clienteSelecionado.complemento),
        faturamentoBairro: primeiroTexto(atual.faturamentoBairro, clienteSelecionado.bairro),
        faturamentoCidade: primeiroTexto(atual.faturamentoCidade, clienteSelecionado.cidade),
        faturamentoCodigoIbge: primeiroTexto(atual.faturamentoCodigoIbge, clienteAny.codigoIbgeMunicipio),
        faturamentoEstado: primeiroTexto(atual.faturamentoEstado, clienteSelecionado.estado, clienteAny.uf).toUpperCase().slice(0, 2),
      }
      if (
        atual.clienteEmail === emailCorreto &&
        atual.clienteEmailNotaFiscal === emailCorreto &&
        JSON.stringify(copiasAtuais) === JSON.stringify(copiasCorretas) &&
        Object.entries(dadosCadastro).every(([campo, valor]) => String((atual as any)[campo] || '') === String(valor || ''))
      ) return atual
      return {
        ...atual,
        ...dadosCadastro,
        clienteEmail: emailCorreto,
        clienteEmailNotaFiscal: emailCorreto,
        emailEnvio: emailCorreto,
        emailsCopiaEnvio: copiasCorretas,
        enderecoEntregaId: local?.id || '',
        enderecoEntregaSnapshot: local,
      }
    })
  }, [clientes.length, clienteSelecionado, venda.enderecoEntregaId, venda.entregaCep, venda.entregaNumero])

  function dinheiro(valor: number) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }


  function formatarDataBrasil(data?: string) {
    if (!data) return '-'

    const valor = String(data).trim()

    const dataSimples = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
    if (dataSimples) {
      return `${dataSimples[3]}/${dataSimples[2]}/${dataSimples[1]}`
    }

    const instante = new Date(valor)
    if (Number.isNaN(instante.getTime())) return valor

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'America/Sao_Paulo',
    }).format(instante)
  }

  function formatarMoedaInput(valor: number) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  function converterMoedaInput(valor: string) {
    const somenteNumeros = valor.replace(/\D/g, '')

    if (!somenteNumeros) {
      return 0
    }

    return Number(somenteNumeros) / 100
  }

  function abrirOrcamentoOrigem() {
    const origemId = String(venda.orcamentoOrigemId || '').trim()
    const origemNumero = String(
      venda.orcamentoOrigemNumero || venda.numeroOrcamento || '',
    ).trim()

    if (origemId) {
      navigate(`/vendas/orcamentos/editar/${origemId}`)
      return
    }

    const vendasSalvas = listarVendasCentral() as unknown as Array<{
      id?: string
      tipo?: string
      numero?: string
      numeroOrcamento?: string
    }>

    const origemEncontrada = vendasSalvas.find((registro) => {
      const tipo = String(registro.tipo || '').toLowerCase()
      const numero = String(
        registro.numeroOrcamento || registro.numero || '',
      ).trim()

      return tipo.includes('orçamento') || tipo.includes('orcamento')
        ? numero === origemNumero
        : false
    })

    if (origemEncontrada?.id) {
      navigate(`/vendas/orcamentos/editar/${origemEncontrada.id}`)
      return
    }

    alert('Orçamento de origem não encontrado.')
  }
  function atualizarVenda(campo: keyof Venda, valor: any) {
    setVenda((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  function chaveStatusPedido(status?: string) {
    return String(status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  }

  function transicaoStatusPedidoPermitida(statusAtual?: string, proximoStatus?: string) {
    const atual = chaveStatusPedido(statusAtual)
    const proximo = chaveStatusPedido(proximoStatus)
    if (atual === proximo) return true
    if (atual === 'cancelado' || atual === 'entregue') return false
    if (atual === 'concluido') return proximo === 'cancelado' || proximo === 'entregue'
    return true
  }

  function alterarStatusPedido(proximoStatus: string) {
    if (!transicaoStatusPedidoPermitida(venda.statusPedido, proximoStatus)) {
      alert('Status bloqueado. Concluído só pode mudar para Cancelado ou Entregue; Cancelado e Entregue são estados finais.')
      return
    }
    atualizarVenda('statusPedido', proximoStatus)
  }

  function validarStatusPedidoAntesDeSalvar(proximoStatus?: string) {
    if (transicaoStatusPedidoPermitida(statusPedidoPersistidoRef.current, proximoStatus)) return true
    alert('Status bloqueado. Recarregue o pedido: o estado atual não permite essa alteração.')
    return false
  }

  // SYNERGIAS_WHATSAPP_EDITAVEL_SALVA_CLIENTE_V244
  function formatarTelefoneWhatsappCliente(valor: string) {
    const digitos = String(valor || '').replace(/\D/g, '').slice(0, 11)
    if (digitos.length <= 2) return digitos
    if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
    if (digitos.length <= 10) {
      return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
    }
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
  }

  async function salvarTelefoneWhatsappNoCliente(valor: string) {
    const telefone = formatarTelefoneWhatsappCliente(valor)
    const vendaAtualizada = { ...venda, clienteTelefone: telefone } as Venda
    setVenda(vendaAtualizada)
    salvarVendaStorage(vendaAtualizada)

    const clienteAtual = clientes.find(
      (cliente) => String(cliente.codigo) === String(venda.clienteCodigo),
    )
    if (!clienteAtual) return

    const clienteAtualizado = {
      ...clienteAtual,
      telefone,
      celular: telefone,
      celularWhatsapp: telefone,
    } as Cliente

    const clientesAtualizados = salvarClienteStorage(clienteAtualizado)
    setClientes(clientesAtualizados)

    try {
      await salvarClientesStorageConfirmado(clientesAtualizados)
    } catch (erro) {
      console.error('[Synergias ERP] Falha ao salvar WhatsApp no cadastro central do cliente.', erro)
      alert('O telefone foi salvo no Pedido, mas o servidor não confirmou a atualização do cadastro do cliente. Tente novamente.')
    }
  }


  function abrirConfiguracaoCreditoCliente() {
    if (!clienteSelecionado && !venda.clienteCodigo) {
      alert('Selecione um cliente antes de abrir o crédito.')
      return
    }

    setLimiteCreditoTexto(formatarMoedaInput(resumoCreditoCliente.limiteCredito))
    setMostrarCreditoCliente(true)
  }

  function salvarCreditoCliente() {
    if (!clienteSelecionado) {
      alert('Cliente não encontrado na aba Clientes.')
      return
    }

    const novoLimite = converterMoedaInput(limiteCreditoTexto)
    const clienteAtualizado = {
      ...clienteSelecionado,
      limiteCredito: novoLimite,
    } as Cliente

    salvarClienteStorage(clienteAtualizado)
    setClientes((clientesAtuais) =>
      clientesAtuais.map((cliente) =>
        String(cliente.codigo) === String(clienteAtualizado.codigo)
          ? clienteAtualizado
          : cliente,
      ),
    )

    setVenda((atual) => ({
      ...atual,
      clienteCreditoDisponivel: novoLimite - resumoCreditoCliente.limiteUtilizado,
    }))

    setMostrarCreditoCliente(false)
  }

  function montarNomeCliente(cliente: Cliente) {
    return cliente.razaoSocial || cliente.nomeFantasia || ''
  }

  function montarTextoProduto(produto: Produto) {
    return produto.descricao || ''
  }

  function montarTextoProdutoBusca(produto: Produto) {
    const codigo = produto.codigo || ''
    const barras = produto.codigoBarras || ''
    const descricao = produto.descricao || ''

    return `${codigo} ${barras} ${descricao}`
  }


  function obterEstoqueProduto(produto?: Produto) {
    if (!produto) return 0
    return Number(
      produto.estoqueAtual ?? produto.estoque ?? produto.quantidadeEstoque ??
        produto.saldoEstoque ?? produto.quantidade ?? 0,
    )
  }

  const SYNERGIAS_EMAILS_FORMA_ENVIO_CLIENTE_V241 =
    'SYNERGIAS_EMAILS_FORMA_ENVIO_CLIENTE_V241'

  function extrairPrimeiroEmail(valor: string) {
    const encontrado = String(valor || '').match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    )
    return String(encontrado?.[0] || '').trim().toLowerCase()
  }

  function emailsCopiaNormalizados() {
    const principal = extrairPrimeiroEmail(
      venda.clienteEmailNotaFiscal || venda.clienteEmail || '',
    )

    return Array.from(
      new Set(
        emailsCopiaTexto
          .split(/[;,\n]+/)
          .map(extrairPrimeiroEmail)
          .filter((email) => email && email !== principal),
      ),
    )
  }

  async function salvarEmailsFormaEnvioNoClienteInterno(
    exibirAviso = false,
  ): Promise<Venda | null> {
    void SYNERGIAS_EMAILS_FORMA_ENVIO_CLIENTE_V241

    const valorPara = String(
      venda.clienteEmailNotaFiscal || venda.clienteEmail || '',
    ).trim()
    const emailPrincipal = extrairPrimeiroEmail(valorPara)

    if (valorPara && !emailPrincipal) {
      if (exibirAviso) alert('Informe um e-mail válido no campo Para.')
      return null
    }

    const copias = emailsCopiaNormalizados()
    const vendaAtualizada: Venda = {
      ...montarPedidoAtualizado(),
      clienteEmail: emailPrincipal,
      clienteEmailNotaFiscal: emailPrincipal,
      emailsCopiaEnvio: copias,
    }

    const clienteAtual = localizarClienteAtualParaDocumento(vendaAtualizada)
    if (!clienteAtual) {
      if (exibirAviso) {
        alert('O cliente deste pedido não foi encontrado no cadastro central.')
      }
      return null
    }

    let clientesServidor: Cliente[]
    try {
      const resposta = await carregarColecaoCentral<Cliente>('clientes')
      clientesServidor = Array.isArray(resposta.data) ? resposta.data : []
    } catch (error) {
      console.error('[Synergias ERP] Falha ao recarregar clientes antes de salvar e-mails.', error)
      if (exibirAviso) alert('Não foi possível atualizar o cadastro do cliente. Tente novamente.')
      return null
    }

    const enderecoId = String(
      vendaAtualizada.enderecoEntregaId ||
      vendaAtualizada.enderecoEntregaSnapshot?.id ||
      '',
    )
    const mesmoCliente = (cliente: Cliente) => {
      const clienteLegado = cliente as Cliente & { id?: string; documento?: string }
      const atualLegado = clienteAtual as Cliente & { id?: string; documento?: string }
      const codigoCliente = String(cliente.codigo || clienteLegado.id || '')
      const codigoAtual = String(clienteAtual.codigo || atualLegado.id || '')
      if (codigoCliente && codigoAtual && codigoCliente === codigoAtual) return true
      const documentoCliente = String(clienteLegado.documento || cliente.cnpj || '').replace(/\D/g, '')
      const documentoAtual = String(atualLegado.documento || clienteAtual.cnpj || '').replace(/\D/g, '')
      return Boolean(documentoCliente && documentoAtual && documentoCliente === documentoAtual)
    }
    const aplicarEmails = (lista: Cliente[]) => {
      const clienteServidor = lista.find(mesmoCliente) || clienteAtual
      const locais = normalizarEnderecosEntrega(clienteServidor)
      const clienteAtualizado: Cliente = {
        ...clienteServidor,
        email: emailPrincipal || clienteServidor.email || '',
        emailNotaFiscal:
          emailPrincipal ||
          (clienteServidor as Cliente & { emailNotaFiscal?: string }).emailNotaFiscal ||
          '',
        enderecosEntrega: enderecoId
          ? locais.map((local) => local.id === enderecoId
            ? { ...local, emailEnvio: emailPrincipal, emailsCopiaEnvio: copias }
            : local)
          : locais.length === 1
            ? locais.map((local) => ({ ...local, emailEnvio: emailPrincipal, emailsCopiaEnvio: copias }))
            : locais,
        emailsCopiaDocumentos: copias,
      }

      return {
        clienteAtualizado,
        clientesAtualizados: lista.map((cliente) =>
          mesmoCliente(cliente)
            ? clienteAtualizado
            : cliente,
        ),
      }
    }

    let { clienteAtualizado, clientesAtualizados } = aplicarEmails(clientesServidor)
    vendaAtualizada.emailEnvio = emailPrincipal || clienteAtualizado.email || ''

    try {
      await salvarClientesStorageConfirmado(clientesAtualizados)
    } catch (error) {
      // Reaplica somente os e-mails caso outro usuário tenha alterado clientes
      // entre a leitura e a gravação, preservando a versão mais nova do servidor.
      try {
        const respostaAtual = await carregarColecaoCentral<Cliente>('clientes')
        const clientesAtuais = Array.isArray(respostaAtual.data) ? respostaAtual.data : []
        ;({ clienteAtualizado, clientesAtualizados } = aplicarEmails(clientesAtuais))
        vendaAtualizada.emailEnvio = emailPrincipal || clienteAtualizado.email || ''
        await salvarClientesStorageConfirmado(clientesAtualizados)
      } catch (erroConfirmacao) {
        console.error('[Synergias ERP] Falha ao salvar e-mails do cliente.', {
          primeiraTentativa: error,
          segundaTentativa: erroConfirmacao,
        })
        if (exibirAviso) {
          alert(
            'Não foi possível confirmar os e-mails no cadastro central do cliente.',
          )
        }
        return null
      }
    }

    let vendaConfirmada = vendaAtualizada
    try {
      vendaConfirmada = await salvarVendaStorageConfirmado(vendaAtualizada)
    } catch (erro) {
      console.error('[Synergias ERP] Falha ao confirmar e-mails no pedido.', erro)
      if (exibirAviso) {
        alert('Os e-mails foram salvos no cliente, mas o pedido não foi confirmado pelo servidor. Tente novamente.')
      }
      return null
    }
    setClientes(clientesAtualizados)
    setVenda(vendaConfirmada)
    setEmailsCopiaTexto(copias.join('; '))
    return vendaConfirmada
  }

  function salvarEmailsFormaEnvioNoCliente(
    exibirAviso = false,
  ): Promise<Venda | null> {
    const emAndamento = salvamentoEmailsEmAndamentoRef.current
    if (emAndamento) return emAndamento

    const tarefa = salvarEmailsFormaEnvioNoClienteInterno(exibirAviso)
    salvamentoEmailsEmAndamentoRef.current = tarefa
    void tarefa.finally(() => {
      if (salvamentoEmailsEmAndamentoRef.current === tarefa) {
        salvamentoEmailsEmAndamentoRef.current = null
      }
    })
    return tarefa
  }

  function statusInterParaBoleto(status?: string): ParcelaVenda['statusBoleto'] {
    const valor = String(status || '').toUpperCase()
    if (valor.includes('PAG') || valor.includes('RECEB') || valor.includes('LIQUID')) return 'Pago'
    if (valor.includes('CANCEL') || valor.includes('BAIX')) return 'Cancelado'
    if (valor.includes('VENC')) return 'Vencido'
    if (valor.includes('ERRO') || valor.includes('REJEIT')) return 'Erro'
    if (valor) return 'Gerado'
    return 'Pendente'
  }

  function abrirPdfBase64(base64: string, titulo: string) {
    const limpo = String(base64 || '').replace(/^data:application\/pdf;base64,/, '')
    if (!limpo) {
      alert('O PDF ainda não está disponível.')
      return
    }
    const binario = window.atob(limpo)
    const bytes = new Uint8Array(binario.length)
    for (let indice = 0; indice < binario.length; indice += 1) bytes[indice] = binario.charCodeAt(indice)
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    const janela = window.open(url, '_blank', 'noopener,noreferrer')
    if (!janela) alert(`O navegador bloqueou a abertura de ${titulo}. Libere pop-ups para o ERP.`)
    window.setTimeout(() => URL.revokeObjectURL(url), 120000)
  }

  function atualizarContaReceberComBoleto(parcela: ParcelaVenda, cobranca: CobrancaInterApi) {
    const conta = listarContasReceberStorage().find((item) =>
      String(item.pedidoId || '') === String(venda.id) &&
      Number(item.parcelaNumero || 0) === Number(parcela.numero || 0),
    )
    if (!conta) return
    const status = statusInterParaBoleto(cobranca.status)
    const pago = status === 'Pago'
    const valorRecebido = Number(cobranca.valorRecebido || (pago ? parcela.valor : conta.valorRecebido || 0))
    salvarContaReceberStorage({
      ...conta,
      numeroBoleto: cobranca.nossoNumero || conta.numeroBoleto,
      bancoCobranca: 'Inter',
      tipoCobranca: 'BOLETO BANCO INTER',
      valorRecebido: pago ? valorRecebido : conta.valorRecebido,
      saldoAberto: pago ? 0 : conta.saldoAberto,
      dataRecebimento: pago ? cobranca.dataPagamento || hoje() : conta.dataRecebimento,
      status: pago ? 'Paga' : conta.status,
      conciliado: conta.conciliado,
      atualizadoEm: new Date().toISOString(),
    })
  }

  function destacarSugestao(tipo: 'cliente' | 'produto', indice: number) {
    if (tipo === 'cliente') {
      clienteSugestaoAtivaRef.current = indice
      setClienteSugestaoAtiva(indice)
    } else {
      produtoSugestaoAtivaRef.current = indice
      setProdutoSugestaoAtiva(indice)
    }

    window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-sugestao-${tipo}="${indice}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    })
  }

  function bloquearTeclaAutocomplete(event: React.KeyboardEvent<HTMLInputElement>) {
    event.preventDefault()
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation?.()
  }

  function navegarSugestoesProduto(event: React.KeyboardEvent<HTMLInputElement>) {
    const tecla = event.key
    const total = sugestoesProdutos.length

    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(tecla)) return
    bloquearTeclaAutocomplete(event)

    if (tecla === 'Escape') {
      setMostrarSugestoesProduto(false)
      destacarSugestao('produto', -1)
      return
    }

    if (!total) return

    if (tecla === 'ArrowDown') {
      setMostrarSugestoesProduto(true)
      const atual = produtoSugestaoAtivaRef.current
      destacarSugestao('produto', atual < 0 ? 0 : Math.min(atual + 1, total - 1))
      return
    }

    if (tecla === 'ArrowUp') {
      setMostrarSugestoesProduto(true)
      const atual = produtoSugestaoAtivaRef.current
      destacarSugestao('produto', atual < 0 ? total - 1 : Math.max(atual - 1, 0))
      return
    }

    const indice = produtoSugestaoAtivaRef.current >= 0 ? produtoSugestaoAtivaRef.current : 0
    const produto = sugestoesProdutos[indice]
    if (produto) selecionarProduto(produto)
  }

  function navegarSugestoesCliente(event: React.KeyboardEvent<HTMLInputElement>) {
    const tecla = event.key
    const total = sugestoesClientes.length

    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(tecla)) return
    bloquearTeclaAutocomplete(event)

    if (tecla === 'Escape') {
      setMostrarSugestoesCliente(false)
      destacarSugestao('cliente', -1)
      return
    }

    if (!total) {
      if (tecla === 'Enter') buscarClienteDigitado()
      return
    }

    if (tecla === 'ArrowDown') {
      setMostrarSugestoesCliente(true)
      const atual = clienteSugestaoAtivaRef.current
      destacarSugestao('cliente', atual < 0 ? 0 : Math.min(atual + 1, total - 1))
      return
    }

    if (tecla === 'ArrowUp') {
      setMostrarSugestoesCliente(true)
      const atual = clienteSugestaoAtivaRef.current
      destacarSugestao('cliente', atual < 0 ? total - 1 : Math.max(atual - 1, 0))
      return
    }

    const indice = clienteSugestaoAtivaRef.current >= 0 ? clienteSugestaoAtivaRef.current : 0
    const cliente = sugestoesClientes[indice]
    if (cliente) selecionarCliente(String(cliente.codigo))
  }

  function buscarClienteDigitado() {
    const busca = clienteBusca.trim().toLowerCase()

    if (!busca) {
      alert('Digite ou selecione um cliente.')
      return
    }

    const cliente = clientes.find((item) => {
      const nome = montarNomeCliente(item).toLowerCase()
      const codigo = String(item.codigo || '').toLowerCase()
      const documento = String(item.cnpj || item.cpf || '').toLowerCase()

      return (
        nome.includes(busca) ||
        codigo.includes(busca) ||
        documento.includes(busca)
      )
    })

    if (!cliente) {
      alert('Cliente não encontrado.')
      return
    }

    selecionarCliente(String(cliente.codigo))
  }

  function limparNumeros(valor: string) {
    return valor.replace(/\D/g, '')
  }

  async function buscarCnpjNovoCliente() {
    const cnpj = limparNumeros(novoCliente.documento)

    if (cnpj.length !== 14) {
      alert('Informe um CNPJ válido com 14 números.')
      return
    }

    try {
      setBuscandoCnpj(true)

      const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)

      if (!resposta.ok) {
        throw new Error('CNPJ não encontrado.')
      }

      const dados = await resposta.json()

      const telefone =
        dados.ddd_telefone_1 ||
        dados.ddd_telefone_2 ||
        novoCliente.telefone ||
        ''

      const email = dados.email || novoCliente.email || ''

      setNovoCliente((atual) => ({
        ...atual,
        nome: dados.razao_social || dados.nome_fantasia || atual.nome,
        documento: cnpj,
        telefone,
        email,
        emailNotaFiscal: atual.emailNotaFiscal || email,
        cep: dados.cep || atual.cep,
        endereco: dados.logradouro || atual.endereco,
        numero: dados.numero || atual.numero,
        complemento: dados.complemento || atual.complemento,
        bairro: dados.bairro || atual.bairro,
        cidade: dados.municipio || atual.cidade,
        estado: dados.uf || atual.estado,
      }))

      alert('Dados do CNPJ preenchidos com sucesso.')
    } catch (error) {
      alert('Não foi possível buscar este CNPJ. Confira o número e tente novamente.')
    } finally {
      setBuscandoCnpj(false)
    }
  }

  function atualizarNovoCliente(campo: keyof NovoClienteRapido, valor: string) {
    setNovoCliente((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  function limparNovoClienteRapido() {
    setNovoCliente({
      nome: '',
      documento: '',
      telefone: '',
      email: '',
      emailNotaFiscal: '',
      cep: '',
      endereco: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
    })
  }

  function salvarNovoClienteRapido() {
    const nome = novoCliente.nome.trim()

    if (!nome) {
      alert('Informe o nome ou razão social do cliente.')
      return
    }

    const documento = novoCliente.documento.trim()
    const emailPrincipal = novoCliente.email.trim()
    const emailNotaFiscal = novoCliente.emailNotaFiscal.trim() || emailPrincipal
    const codigo = String(Date.now())

    const clienteSalvo = {
      codigo,
      razaoSocial: nome,
      nomeFantasia: nome,
      cnpj: documento,
      cpf: '',
      inscricaoEstadual: '',
      email: emailPrincipal,
      emailNotaFiscal,
      telefone: novoCliente.telefone.trim(),
      celular: '',
      limiteCredito: 0,
      cep: novoCliente.cep.trim(),
      endereco: novoCliente.endereco.trim(),
      numero: novoCliente.numero.trim(),
      complemento: novoCliente.complemento.trim(),
      bairro: novoCliente.bairro.trim(),
      cidade: novoCliente.cidade.trim(),
      estado: novoCliente.estado.trim(),
      cepEntrega: novoCliente.cep.trim(),
      enderecoEntrega: novoCliente.endereco.trim(),
      numeroEntrega: novoCliente.numero.trim(),
      complementoEntrega: novoCliente.complemento.trim(),
      bairroEntrega: novoCliente.bairro.trim(),
      cidadeEntrega: novoCliente.cidade.trim(),
      estadoEntrega: novoCliente.estado.trim(),
      ativo: true,
      criadoEm: new Date().toISOString(),
    } as unknown as Cliente

    salvarClienteStorage(clienteSalvo)
    setClientes((clientesAtuais) => [...clientesAtuais, clienteSalvo])

    setClienteBusca(nome)
    setEmailsCopiaTexto('')
    setVenda((atual) => ({
      ...atual,
      clienteCodigo: codigo,
      clienteNome: nome,
      clienteDocumento: documento,
      clienteIeRg: '',
      clienteEmail: emailNotaFiscal || emailPrincipal,
      clienteEmailNotaFiscal: emailNotaFiscal || emailPrincipal,
      emailEnvio: emailNotaFiscal || emailPrincipal,
      emailsCopiaEnvio: [],
      clienteTelefone: novoCliente.telefone.trim(),
      clienteCreditoDisponivel: 0,
      faturamentoCep: novoCliente.cep.trim(),
      faturamentoEndereco: novoCliente.endereco.trim(),
      faturamentoNumero: novoCliente.numero.trim(),
      faturamentoComplemento: novoCliente.complemento.trim(),
      faturamentoBairro: novoCliente.bairro.trim(),
      faturamentoCidade: novoCliente.cidade.trim(),
      faturamentoCodigoIbge: novoCliente.cidade.trim().toUpperCase() === 'PORTO ALEGRE' && novoCliente.estado.trim().toUpperCase() === 'RS' ? '4314902' : '',
      faturamentoEstado: novoCliente.estado.trim(),
      entregaCep: novoCliente.cep.trim(),
      entregaEndereco: novoCliente.endereco.trim(),
      entregaNumero: novoCliente.numero.trim(),
      entregaComplemento: novoCliente.complemento.trim(),
      entregaBairro: novoCliente.bairro.trim(),
      entregaCidade: novoCliente.cidade.trim(),
      entregaEstado: novoCliente.estado.trim(),
    }))

    limparNovoClienteRapido()
    setMostrarCadastroCliente(false)
    alert('Cliente cadastrado e selecionado no pedido.')
  }

  function selecionarCliente(codigo: string) {
    const cliente = clientes.find(
      (item) => String(item.codigo) === String(codigo),
    )

    if (!cliente) {
      atualizarVenda('clienteCodigo', '')
      return
    }

    const nome = montarNomeCliente(cliente)
    const locaisEntrega = normalizarEnderecosEntrega(cliente).filter((local) => local.ativo)
    const localEntrega = locaisEntrega[0]
    const emailSelecionado = String(localEntrega?.emailEnvio || cliente.email || '').trim()
    const copiasSelecionadas = Array.isArray(cliente.emailsCopiaDocumentos)
      ? cliente.emailsCopiaDocumentos
      : []

    setClienteBusca(nome)
    setMostrarSugestoesCliente(false)
    destacarSugestao('cliente', -1)
    setEmailsCopiaTexto(copiasSelecionadas.join('; '))

    setVenda((atual) => ({
      ...atual,

      clienteCodigo: cliente.codigo,
      clienteNome: nome,
      clienteDocumento: somenteNumerosCredito(
        cliente.cnpj ||
        cliente.cpf ||
        (cliente as Cliente & { cpfCnpj?: string; cnpjCpf?: string; documento?: string }).cpfCnpj ||
        (cliente as Cliente & { cpfCnpj?: string; cnpjCpf?: string; documento?: string }).cnpjCpf ||
        (cliente as Cliente & { cpfCnpj?: string; cnpjCpf?: string; documento?: string }).documento ||
        '',
      ),
      clienteIeRg: cliente.inscricaoEstadual || '',
      clienteIndicadorIE: cliente.indicadorIE || (somenteNumerosCredito(cliente.inscricaoEstadual || '') ? '1' : '9'),
      clienteEmail: emailSelecionado,
      clienteEmailNotaFiscal: emailSelecionado,
      emailEnvio: emailSelecionado,
      emailsCopiaEnvio: copiasSelecionadas,
      clienteTelefone: cliente.telefone || cliente.celular || '',
      clienteCreditoDisponivel: Number(cliente.limiteCredito || 0),

      faturamentoCep: cliente.cep || '',
      faturamentoEndereco: cliente.endereco || '',
      faturamentoNumero: cliente.numero || '',
      faturamentoComplemento: cliente.complemento || '',
      faturamentoBairro: cliente.bairro || '',
      faturamentoCidade: cliente.cidade || '',
      faturamentoEstado: cliente.estado || '',
      faturamentoCodigoIbge: String((cliente as any).codigoIbgeMunicipio || ''),

      enderecoEntregaId: localEntrega?.id || '',
      enderecoEntregaNome: localEntrega?.nomeLocal || '',
      enderecoEntregaSnapshot: localEntrega,
      entregaCep: localEntrega?.cep || cliente.cepEntrega || cliente.cep || '',
      entregaEndereco: localEntrega?.logradouro || cliente.enderecoEntrega || cliente.endereco || '',
      entregaNumero: localEntrega?.numero || cliente.numeroEntrega || cliente.numero || '',
      entregaComplemento:
        localEntrega?.complemento || cliente.complementoEntrega || cliente.complemento || '',
      entregaBairro: localEntrega?.bairro || cliente.bairroEntrega || cliente.bairro || '',
      entregaCidade: localEntrega?.cidade || cliente.cidadeEntrega || cliente.cidade || '',
      entregaEstado: localEntrega?.uf || cliente.estadoEntrega || cliente.estado || '',
      entregaCodigoIbge: localEntrega?.codigoIbgeMunicipio || String((cliente as any).codigoIbgeMunicipioEntrega || ''),
    }))
  }

  function selecionarProduto(produto: Produto) {
    setProdutoSelecionadoCodigo(String(produto.codigo))
    setProdutoBusca(montarTextoProduto(produto))
    setMostrarSugestoesProduto(false)
    destacarSugestao('produto', -1)
  }

  function alterarDataEmissao(data: string) {
    setVenda((atual) => ({
      ...atual,
      dataEmissao: data,
      dataValidade: somarDiasUteis(data, 5),
      dataEntrega: somarDiasUteis(data, 2),
    }))
  }

  function calcularTotais(vendaAtual: Venda) {
    const subtotal = vendaAtual.itens.reduce(
      (total, item) => total + recalcularItemPedido(item).valorTotal,
      0,
    )

    const descontoValor =
      tipoDesconto === 'valor'
        ? Number(vendaAtual.descontoValor || 0)
        : subtotal * (Number(vendaAtual.descontoPercentual || 0) / 100)

    const totalFinal =
      subtotal -
      descontoValor +
      Number(vendaAtual.frete || 0) +
      Number(vendaAtual.outrosCustos || 0)

    return {
      subtotal,
      descontoTotal: descontoValor,
      totalFinal: totalFinal < 0 ? 0 : totalFinal,
    }
  }

  function diminuirQuantidadeItemBusca() {
    setQuantidadeItem((quantidade) => Math.max(1, Number(quantidade || 1) - 1))
  }

  function aumentarQuantidadeItemBusca() {
    setQuantidadeItem((quantidade) => Number(quantidade || 0) + 1)
  }

  function incluirProduto() {
    const produto = produtos.find(
      (item) => String(item.codigo) === String(produtoSelecionadoCodigo),
    )

    if (!produto) {
      alert('Selecione um produto.')
      return
    }

    const quantidade = Number(quantidadeItem || 0)

    if (quantidade <= 0) {
      alert('Informe uma quantidade válida.')
      return
    }

    const valorUnitario = Number(produto.vendaVarejo || 0)
    const valorTotal = quantidade * valorUnitario

    const novoItem: ItemVenda = {
      codigoProduto: produto.codigo,
      codigoBarras: produto.codigoBarras || '',
      descricao: produto.descricao,
      quantidade,
      unidade: produto.unidade || 'UN',
      valorUnitario,
      descontoValor: 0,
      descontoPercentual: 0,
      valorTotal,
      observacao: '',
      ncm: String(produto.ncm || '').replace(/\D/g, '').slice(0, 8),
      ncmDescricao: produto.ncmDescricao || '',
    }

    setVenda((atual) => ({
      ...atual,
      itens: [...atual.itens, novoItem],
    }))

    setProdutoSelecionadoCodigo('')
    setProdutoBusca('')
    setQuantidadeItem(1)
  }

  function removerItem(index: number) {
    const confirmar = window.confirm('Deseja remover este item do pedido?')

    if (!confirmar) return

    setVenda((atual) => ({
      ...atual,
      itens: atual.itens.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function alterarQuantidadeItem(index: number, quantidade: number) {
    setVenda((atual) => ({
      ...atual,
      itens: atual.itens.map((item, itemIndex) => {
        if (itemIndex !== index) return item

        return recalcularItemPedido({
          ...item,
          quantidade: Math.max(1, numeroPedidoSeguro(quantidade)),
        })
      }),
    }))
  }

  function alterarValorUnitarioItem(index: number, valor: number) {
    setVenda((atual) => ({
      ...atual,
      itens: atual.itens.map((item, itemIndex) => {
        if (itemIndex !== index) return item

        return recalcularItemPedido({
          ...item,
          valorUnitario: Math.max(0, numeroPedidoSeguro(valor)),
        })
      }),
    }))
  }

  function alterarFormaPagamento(formaPagamento: string) {
    const opcoes = OPCOES_COBRANCA_POR_FORMA[formaPagamento] || []
    const prazos = PRAZOS_POR_FORMA[formaPagamento] || []
    const tipoPadrao = opcoes.length === 1 ? opcoes[0] : ''
    const prazoPadrao = prazos.length === 1 ? prazos[0] : ''
    const bancoPadrao = extrairBancoDaOpcao(tipoPadrao)

    setVenda(
      (atual) =>
        ({
          ...atual,
          formaPagamento: formaPagamento as Venda['formaPagamento'],
          tipoCobranca: normalizarTipoCobrancaValor(tipoPadrao),
          bancoCobranca: bancoPadrao,
          parcelamento: prazoPadrao,
          parcelas: [],
          // Ao trocar a forma de pagamento, sempre inicia com o saldo real do
          // pedido. Não reaproveita valor antigo salvo em orçamento/parcela.
          valorPagamento: calcularTotais(atual).totalFinal,
        }) as Venda,
    )
  }

  function alterarTipoCobranca(tipoCobranca: string) {
    const banco = extrairBancoDaOpcao(tipoCobranca)

    setVenda(
      (atual) =>
        ({
          ...atual,
          tipoCobranca: normalizarTipoCobrancaValor(tipoCobranca),
          bancoCobranca: banco,
          parcelas: [],
        }) as Venda,
    )
  }

  function calcularDiasPrazo(formaPagamento: string, prazo: string) {
    const prazoNormalizado = String(prazo || '').toUpperCase()

    if (prazoNormalizado === 'À VISTA') return [0]
    if (prazoNormalizado === '10 DIAS') return [10]
    if (prazoNormalizado === '30 DIAS') return [30]
    if (prazoNormalizado === '60 DIAS') return [60]

    // SYNERGIAS_PIX_TRANSFERENCIA_2X_30_60_V279
    // A opÃ§Ã£o 2x - 30/60 dias gera duas datas para boleto, PIX e transferÃªncia.
    if (prazoNormalizado === '2X - 30/60 DIAS') return [30, 60]

    if (formaPagamento === 'BOLETO') {
      if (prazo === '1x - 30 dias') return [30]
      if (prazo === '2x - 30/60 dias') return [30, 60]
      if (prazo === '3x - 30/60/90 dias') return [30, 60, 90]
      if (prazo === '4x - 30/60/90/120 dias') return [30, 60, 90, 120]
      if (prazo === '5x - 30/60/90/120/150 dias') {
        return [30, 60, 90, 120, 150]
      }
      if (prazo === '6x - 30/60/90/120/150/180 dias') {
        return [30, 60, 90, 120, 150, 180]
      }
      if (prazo === '7x - 30/60/90/120/150/180/210 dias') {
        return [30, 60, 90, 120, 150, 180, 210]
      }
      if (prazo === '8x - 30/60/90/120/150/180/210/240 dias') {
        return [30, 60, 90, 120, 150, 180, 210, 240]
      }
    }

    return [0]
  }

  function gerarCobranca() {
    const totalAtual = calcularTotais(venda).totalFinal
    const formaPagamento = String(venda.formaPagamento || '')
    const tipoCobranca = venda.tipoCobranca
    const bancoCobranca = extrairBancoDaOpcao(String(tipoCobranca || ''))
    const saldoReal = calcularSaldoRealPedido({ ...venda, totalFinal: totalAtual })
    const valorBase = Number(venda.valorPagamento ?? saldoReal)

    if (totalAtual <= 0) {
      alert('Inclua itens no pedido antes de gerar cobrança.')
      return
    }

    if (!formaPagamento) {
      alert('Selecione a forma de pagamento antes de gerar cobrança.')
      return
    }

    if (!tipoCobranca) {
      alert('Selecione o tipo, conta ou forma de cobrança.')
      return
    }

    if (!venda.parcelamento) {
      alert('Selecione o prazo antes de gerar cobrança.')
      return
    }

    if (saldoReal <= 0) {
      alert('Este pedido não possui saldo pendente para cobrança.')
      return
    }

    if (valorBase <= 0) {
      alert('Informe um valor válido para a cobrança.')
      return
    }

    if (valorBase > saldoReal) {
      alert(`O valor da cobrança não pode ultrapassar o saldo pendente de ${formatarMoedaInput(saldoReal)}.`)
      return
    }

    const prazo = venda.parcelamento
    const dias = calcularDiasPrazo(formaPagamento, prazo)
    const valorParcelaBase = Number((valorBase / dias.length).toFixed(2))

    let acumulado = 0

    const parcelas: ParcelaVenda[] = dias.map((dia, index) => {
      const dataCalculada = somarDiasCorridos(venda.dataEmissao || hoje(), dia)
      const vencimento =
        formaPagamento === 'BOLETO'
          ? formatarDataInput(ajustarVencimentoBoleto(dataCalculada))
          : formatarDataInput(dataCalculada)

      const valorParcela =
        index === dias.length - 1
          ? Number((valorBase - acumulado).toFixed(2))
          : valorParcelaBase

      acumulado += valorParcela

      const observacaoParcela =
        dias.length > 1 ? `${index + 1}/${dias.length} - ${prazo}` : prazo
      const dadosBancarios = montarTextoDadosBancarios(String(tipoCobranca || ''))

      return {
        numero: index + 1,
        vencimento,
        observacao: [observacaoParcela, dadosBancarios].filter(Boolean).join('\n\n'),
        valor: valorParcela,
        bancoCobranca,
        tipoCobranca,
        statusBoleto: 'Pendente',
      } as ParcelaVenda
    })

    setVenda(
      (atual) =>
        ({
          ...atual,
          bancoCobranca,
          tipoCobranca,
          valorPagamento: valorBase,
          parcelas,
        }) as Venda,
    )
  }

  function normalizarBuscaBrinde(valor: unknown) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const produtosBrindeFiltrados = (() => {
    const termo = normalizarBuscaBrinde(brindeProdutoBusca)
    const ordenados = [...produtos].sort((a: Produto, b: Produto) =>
      String(a.descricao || a.nome || '').localeCompare(
        String(b.descricao || b.nome || ''),
        'pt-BR',
        { sensitivity: 'base' },
      ),
    )

    if (!termo) return ordenados.slice(0, 40)

    return ordenados
      .filter((produto: Produto) =>
        normalizarBuscaBrinde(produto.descricao || produto.nome || '').includes(termo),
      )
      .slice(0, 40)
  })()

  function selecionarProdutoBrinde(produto: Produto) {
    const codigo = String(produto.codigo || produto.id || '')
    setBrindeProdutoCodigo(codigo)
    setBrindeProdutoBusca(String(produto.descricao || produto.nome || 'Produto'))
    setMostrarSugestoesBrinde(false)
  }

  function tratarTeclaBuscaBrinde(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Escape') {
      setMostrarSugestoesBrinde(false)
      return
    }

    if (evento.key === 'Enter' && produtosBrindeFiltrados.length > 0) {
      evento.preventDefault()
      selecionarProdutoBrinde(produtosBrindeFiltrados[0])
    }
  }

  function adicionarBrinde() {
    const produto = produtos.find((item: Produto) =>
      String(item.codigo || item.id || '') === String(brindeProdutoCodigo),
    )
    if (!produto) return alert('Selecione um produto para o brinde.')
    if (brindeQuantidade <= 0) return alert('Informe uma quantidade válida para o brinde.')
    if (!brindeDestinatario.trim()) return alert('Informe para quem o brinde será entregue.')

    const brinde: BrindeVenda = {
      id: `brinde-${Date.now()}`,
      produtoCodigo: String(produto.codigo || produto.id || ''),
      produtoDescricao: produto.descricao || 'Produto',
      quantidade: brindeQuantidade,
      destinatario: brindeDestinatario.trim(),
      clienteNome: venda.clienteNome || '',
      vendedor: venda.vendedor || '',
      data: hoje(),
      observacao: brindeObservacao,
      estoqueBaixado: false,
    }
    setVenda((atual) => ({ ...atual, brindes: [...(atual.brindes || []), brinde] }))
    setBrindeProdutoCodigo('')
    setBrindeProdutoBusca('')
    setMostrarSugestoesBrinde(false)
    setBrindeQuantidade(1)
    setBrindeDestinatario('')
    setBrindeObservacao('')
  }

  function baixarBrinde(brinde: BrindeVenda) {
    if (brinde.estoqueBaixado) return
    const resultado = movimentarEstoqueStorage({
      produtoCodigo: brinde.produtoCodigo,
      tipo: 'saida',
      quantidade: brinde.quantidade,
      motivo: 'Saída - Brinde',
      observacao: [brinde.destinatario, brinde.clienteNome, brinde.observacao].filter(Boolean).join(' | '),
      origem: 'brinde',
      documentoOrigem: venda.numeroPedido || venda.id,
      usuario: venda.vendedor || 'Synergias',
    })
    if (!resultado.ok) return alert(resultado.mensagem)
    const atualizada = {
      ...venda,
      brindes: (venda.brindes || []).map((item) => item.id === brinde.id ? { ...item, estoqueBaixado: true } : item),
    }
    setVenda(atualizada)
    salvarVendaStorage({ ...atualizada, ...calcularTotais(atualizada) })
    alert('Brinde registrado e baixado do estoque.')
  }

  function removerBrinde(idBrinde: string) {
    const brinde = (venda.brindes || []).find((item) => item.id === idBrinde)
    if (brinde?.estoqueBaixado) return alert('Este brinde já baixou estoque e não pode ser removido por aqui. Use uma movimentação de ajuste no Estoque.')
    setVenda((atual) => ({ ...atual, brindes: (atual.brindes || []).filter((item) => item.id !== idBrinde) }))
  }

  function localizarClienteAtualParaDocumento(vendaBase: Venda): Cliente | undefined {
    const codigo = String(vendaBase.clienteCodigo || '').trim()
    const documentoVenda = somenteNumerosCredito(vendaBase.clienteDocumento || '')
    const nomeVenda = normalizarBuscaCredito(String(vendaBase.clienteNome || ''))

    return clientes.find((item) => {
      const itemAny = item as Cliente & { documento?: string; cpfCnpj?: string; cnpjCpf?: string }
      const documentoItem = somenteNumerosCredito(
        item.cnpj || item.cpf || itemAny.documento || itemAny.cpfCnpj || itemAny.cnpjCpf || '',
      )
      const nomeItem = normalizarBuscaCredito(montarNomeClienteBase(item))

      return Boolean(
        (codigo && String(item.codigo || '').trim() === codigo) ||
        (documentoVenda && documentoItem && documentoVenda === documentoItem) ||
        (nomeVenda && nomeItem && nomeVenda === nomeItem),
      )
    })
  }

  async function salvarDocumentoEmailNoCadastro() {
    const documento = somenteNumerosCredito(venda.clienteDocumento || '')
    const email = String(venda.clienteEmailNotaFiscal || venda.clienteEmail || '').trim()
    if (documento && ![11, 14].includes(documento.length)) {
      alert('Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.')
      return
    }

    try {
      const resposta = await carregarColecaoCentral<Cliente>('clientes')
      const lista = Array.isArray(resposta.data) ? resposta.data : []
      const codigo = String(venda.clienteCodigo || '').trim()
      const nome = normalizarBuscaCredito(venda.clienteNome || '')
      let localizado = false
      const atualizados = lista.map((cliente) => {
        const legado = cliente as Cliente & { id?: string; documento?: string; cpfCnpj?: string; cnpjCpf?: string }
        const mesmoCliente =
          (codigo && String(cliente.codigo || legado.id || '') === codigo) ||
          (nome && normalizarBuscaCredito(montarNomeClienteBase(cliente)) === nome)
        if (!mesmoCliente) return cliente
        localizado = true
        return {
          ...cliente,
          tipoPessoa: documento.length === 14 ? 'Jurídica' : documento.length === 11 ? 'Física' : cliente.tipoPessoa,
          cnpj: documento.length === 14 ? documento : '',
          cpf: documento.length === 11 ? documento : '',
          documento,
          cpfCnpj: documento,
          cnpjCpf: documento,
          email: email || cliente.email || '',
          emailNotaFiscal: email || (cliente as any).emailNotaFiscal || cliente.email || '',
          atualizadoEm: new Date().toISOString(),
        } as Cliente
      })
      if (!localizado) return
      await salvarClientesStorageConfirmado(atualizados)
      setClientes(atualizados)
    } catch {
      alert('Não foi possível gravar o CNPJ/e-mail no cadastro do cliente.')
    }
  }

  function montarPedidoAtualizado(): Venda {
    const totalAtual = calcularTotais(venda)
    const clienteAtual = localizarClienteAtualParaDocumento(venda)
    const clienteAny = clienteAtual as (Cliente & { documento?: string; cpfCnpj?: string; cnpjCpf?: string; logradouro?: string; uf?: string }) | undefined

    const documentoVenda = somenteNumerosCredito(venda.clienteDocumento || '')
    const documentoCliente = somenteNumerosCredito(
      clienteAtual?.cnpj || clienteAtual?.cpf || clienteAny?.documento || clienteAny?.cpfCnpj || clienteAny?.cnpjCpf || '',
    )
    // O documento editado no Pedido é a fonte prioritária.
    // O cadastro do cliente entra apenas como complemento quando o Pedido estiver vazio.
    const documentoAtual =
      [documentoVenda, documentoCliente].find((valor) => valor.length === 11 || valor.length === 14) ||
      documentoCliente ||
      documentoVenda

    const primeiroTexto = (...valores: Array<string | number | undefined | null>) =>
      valores.map((valor) => String(valor ?? '').trim()).find(Boolean) || ''

    const ieVenda = primeiroTexto(venda.clienteIeRg)
    const ieCliente = primeiroTexto(clienteAtual?.inscricaoEstadual)
    const indicadorVenda = primeiroTexto(venda.clienteIndicadorIE)
    const indicadorCliente = primeiroTexto(clienteAtual?.indicadorIE)
    const indicadorIE =
      indicadorVenda ||
      indicadorCliente ||
      (somenteNumerosCredito(ieVenda || ieCliente) ? '1' : '9')

    return {
      ...venda,
      tipo: 'Pedido',

      // A edição feita dentro da NF-e/pedido é a fonte prioritária.
      // O cadastro do cliente entra somente como complemento quando o pedido estiver vazio.
      clienteDocumento: documentoAtual,
      clienteIeRg: indicadorIE === '9' ? '' : primeiroTexto(ieVenda, ieCliente),
      clienteIndicadorIE: indicadorIE,
      clienteEmail: primeiroTexto(venda.clienteEmail, clienteAtual?.email),
      clienteEmailNotaFiscal: primeiroTexto(
        venda.clienteEmailNotaFiscal,
        (clienteAtual as any)?.emailNotaFiscal,
        venda.clienteEmail,
        clienteAtual?.email,
      ),
      clienteTelefone: primeiroTexto(venda.clienteTelefone, clienteAtual?.telefone, clienteAtual?.celular),

      faturamentoCep: primeiroTexto(venda.faturamentoCep, clienteAtual?.cep),
      faturamentoEndereco: primeiroTexto(venda.faturamentoEndereco, clienteAtual?.endereco, clienteAny?.logradouro),
      faturamentoNumero: primeiroTexto(venda.faturamentoNumero, clienteAtual?.numero),
      faturamentoComplemento: primeiroTexto(venda.faturamentoComplemento, clienteAtual?.complemento),
      faturamentoBairro: primeiroTexto(venda.faturamentoBairro, clienteAtual?.bairro),
      faturamentoCidade: primeiroTexto(venda.faturamentoCidade, clienteAtual?.cidade),
      faturamentoCodigoIbge: primeiroTexto(venda.faturamentoCodigoIbge, (clienteAtual as any)?.codigoIbgeMunicipio),
      faturamentoEstado: primeiroTexto(venda.faturamentoEstado, clienteAtual?.estado, clienteAny?.uf).toUpperCase().slice(0, 2),

      entregaCep: formatarCepPedido(venda.entregaCep),
      entregaEndereco: limparLogradouroEntregaComposto(venda.entregaEndereco, venda.entregaNumero),

      subtotal: totalAtual.subtotal,
      totalFinal: totalAtual.totalFinal,
      valorPagamento: venda.valorPagamento || totalAtual.totalFinal,
      modalidadeFrete: (venda.modalidadeFrete || '0') as '0' | '1' | '2',
      statusPedido: venda.statusPedido || 'Aberto',
      orcamentoOrigemNumero:
        venda.orcamentoOrigemNumero || venda.numeroOrcamento || '',
    }
  }

  function abrirRecebimentoParcela(parcela: ParcelaVenda, index: number) {
    const pedidoAtualizado = montarPedidoAtualizado()
    salvarVendaStorage(pedidoAtualizado)
    setVenda(pedidoAtualizado)

    const numeroParcela = Number(parcela.numero || index + 1)
    const contas = listarContasReceberStorage()
    const contaExistente = contas.find(
      (item) =>
        String(item.pedidoId || '') === String(pedidoAtualizado.id) &&
        Number(item.parcelaNumero || 0) === numeroParcela,
    )

    const valorParcela = Number(parcela.valor || 0)
    const valorRecebido = Number(parcela.valorRecebido || 0)
    const desconto = Number(parcela.descontoRecebimento || 0)
    const paga = parcela.statusBoleto === 'Pago'
    const saldoAberto = paga
      ? 0
      : Math.max(valorParcela - valorRecebido - desconto, 0)

    const contaAtualizada: ContaReceber = {
      ...(contaExistente || {}),
      id:
        contaExistente?.id ||
        `conta_pedido_${pedidoAtualizado.id}_${numeroParcela}`,
      pedidoId: pedidoAtualizado.id,
      pedidoNumero: pedidoAtualizado.numeroPedido || pedidoAtualizado.id,
      parcelaNumero: numeroParcela,
      numeroNotaFiscal: pedidoAtualizado.numeroNotaFiscal || '',
      numeroBoleto: parcela.numeroBoleto || '',
      clienteCodigo: pedidoAtualizado.clienteCodigo || '',
      clienteNome: pedidoAtualizado.clienteNome || 'Cliente não informado',
      clienteDocumento: pedidoAtualizado.clienteDocumento || '',
      descricao: `Pedido ${pedidoAtualizado.numeroPedido || pedidoAtualizado.id} · Parcela ${numeroParcela}`,
      dataEmissao: pedidoAtualizado.dataEmissao || hoje(),
      dataVencimento: parcela.vencimento || hoje(),
      dataRecebimento: parcela.dataPagamentoBoleto || contaExistente?.dataRecebimento || '',
      valorOriginal: valorParcela,
      valorPrincipalRecebido:
        contaExistente?.valorPrincipalRecebido ??
        (paga
          ? valorParcela
          : Math.min(
              Math.max(
                valorRecebido - Number(parcela.jurosRecebimento || 0) + desconto,
                0,
              ),
              valorParcela,
            )),
      valorRecebido,
      saldoAberto,
      formaPagamento: pedidoAtualizado.formaPagamento || '',
      bancoCobranca: parcela.bancoCobranca || pedidoAtualizado.bancoCobranca || '',
      tipoCobranca: String(parcela.tipoCobranca || pedidoAtualizado.tipoCobranca || ''),
      status: paga
        ? 'Paga'
        : valorRecebido > 0 || desconto > 0
          ? 'Parcialmente paga'
          : 'Aberta',
      observacao:
        parcela.observacaoRecebimento ||
        parcela.observacao ||
        pedidoAtualizado.observacaoInterna ||
        '',
      jurosRecebidos: Number(parcela.jurosRecebimento || 0),
      descontosConcedidos: desconto,
      contaRecebimento: parcela.contaRecebimento || contaExistente?.contaRecebimento || '',
      conciliado: paga,
    }

    salvarContaReceberStorage(contaAtualizada)
    navigate(
      `/financeiro/contas-a-receber/receber/${encodeURIComponent(contaAtualizada.id)}`,
    )
  }

  async function salvarPedido() {
    const vendaAtualizada = montarPedidoAtualizado()
    if (!validarStatusPedidoAntesDeSalvar(vendaAtualizada.statusPedido)) return

    try {
      const vendaConfirmada = await salvarVendaStorageConfirmado(vendaAtualizada)
      setVenda(vendaConfirmada)
      statusPedidoPersistidoRef.current = vendaConfirmada.statusPedido || 'Aberto'
      alert(`Pedido ${vendaConfirmada.numeroPedido} salvo com sucesso.`)
    } catch (erro) {
      console.error('[Synergias ERP] O MySQL não confirmou o pedido.', erro)
      alert(
        erro instanceof Error
          ? `Não foi possível salvar o pedido no MySQL: ${erro.message}`
          : 'Não foi possível salvar o pedido no MySQL.',
      )
    }
  }

  async function salvarEVoltar() {
    const vendaAtualizada = montarPedidoAtualizado()
    if (!validarStatusPedidoAntesDeSalvar(vendaAtualizada.statusPedido)) return

    try {
      const vendaConfirmada = await salvarVendaStorageConfirmado(vendaAtualizada)
      setVenda(vendaConfirmada)
      statusPedidoPersistidoRef.current = vendaConfirmada.statusPedido || 'Aberto'
      alert(`Pedido ${vendaConfirmada.numeroPedido} salvo com sucesso.`)
      navigate('/vendas')
    } catch (erro) {
      console.error('[Synergias ERP] O MySQL não confirmou o pedido.', erro)
      alert(
        erro instanceof Error
          ? `Não foi possível salvar o pedido no MySQL: ${erro.message}`
          : 'Não foi possível salvar o pedido no MySQL.',
      )
    }
  }

  async function concluirPedido() {
    if (!transicaoStatusPedidoPermitida(statusPedidoPersistidoRef.current, 'Concluído')) {
      alert('Este pedido está em um estado final e não pode ser concluído novamente.')
      return
    }

    const confirmar = window.confirm('Deseja concluir este pedido?')

    if (!confirmar) return

    const totalAtual = calcularTotais(venda)

    const vendaAtualizada: Venda = {
      ...venda,
      tipo: 'Pedido',
      subtotal: totalAtual.subtotal,
      totalFinal: totalAtual.totalFinal,
      valorPagamento: venda.valorPagamento || totalAtual.totalFinal,
      statusPedido: 'Concluído',
    }

    try {
      const vendaConfirmada = await salvarVendaStorageConfirmado(vendaAtualizada)
      setVenda(vendaConfirmada)
      statusPedidoPersistidoRef.current = vendaConfirmada.statusPedido || 'Concluído'
      alert('Pedido concluído e confirmado no MySQL.')
    } catch (erro) {
      alert(erro instanceof Error ? `Não foi possível concluir o pedido: ${erro.message}` : 'O MySQL não confirmou a conclusão do pedido.')
    }
  }

  async function naoEmitirNotaFiscal() {
    if (venda.numeroNotaFiscal || venda.chaveAcessoNotaFiscal) {
      alert('Este pedido já possui nota fiscal vinculada e não pode ser marcado como sem emissão.')
      return
    }
    if (!venda.itens?.length) {
      alert('Inclua os itens do pedido antes de concluir e entregar.')
      return
    }

    const confirmar = window.confirm(
      `Confirmar que o pedido ${venda.numeroPedido || ''} não terá emissão de NF?\n\n` +
      'O pedido será concluído e entregue. Se o estoque ainda não foi baixado, a entrega fará a baixa uma única vez.',
    )
    if (!confirmar) return

    try {
      const agora = new Date()
      const base: Venda = {
        ...montarPedidoAtualizado(),
        tipo: 'Pedido',
        statusPedido: venda.estoqueBaixado ? 'Entregue' : 'Concluído',
        dispensaEmissaoNfe: true,
        dispensaEmissaoNfeEm: agora.toISOString(),
        dispensaEmissaoNfePor: 'Synergias',
        atualizadoEm: agora.toISOString(),
      }
      const confirmado = await salvarVendaStorageConfirmado(base)

      if (confirmado.estoqueBaixado || confirmado.statusPedido === 'Entregue') {
        const entregue = await salvarVendaStorageConfirmado({
          ...confirmado,
          statusPedido: 'Entregue',
          dataEntregaRealizada: confirmado.dataEntregaRealizada || hoje(),
          atualizadoEm: new Date().toISOString(),
        })
        setVenda(entregue)
        statusPedidoPersistidoRef.current = 'Entregue'
      } else {
        const resultado = await entregarPedidoCentral(String(confirmado.id || ''), 'Synergias')
        setVenda(resultado.pedido)
        statusPedidoPersistidoRef.current = resultado.pedido.statusPedido || 'Entregue'
      }
      alert('Pedido concluído e entregue sem emissão de NF.')
    } catch (erro) {
      alert(erro instanceof Error
        ? `Não foi possível concluir o pedido sem NF: ${erro.message}`
        : 'Não foi possível concluir o pedido sem NF.')
    }
  }

  async function entregarPedido() {
    if (entregaEmProcessamentoRef.current || entregaEmProcessamento) return

    const numeroPedido = String(venda.numeroPedido || venda.id || '').trim()

    if (String(venda.statusPedido || '').toLowerCase() === 'cancelado') {
      alert('Pedido cancelado. A entrega está bloqueada.')
      return
    }

    if (!numeroPedido) {
      alert('Salve o pedido antes de confirmar a entrega.')
      return
    }

    if (venda.estoqueBaixado || venda.statusPedido === 'Entregue') {
      alert(MENSAGEM_ESTOQUE_JA_BAIXADO)
      return
    }

    if (!venda.itens || venda.itens.length === 0) {
      alert('Inclua itens no pedido antes de entregar.')
      return
    }

    if (venda.statusPedido !== 'Concluído') {
      alert('O pedido precisa estar concluído antes de ser entregue.')
      return
    }

    const confirmar = window.confirm(
      `Confirmar a entrega do pedido ${numeroPedido}?\n\n` +
        'O estoque será validado e baixado uma única vez.',
    )

    if (!confirmar) return

    entregaEmProcessamentoRef.current = true
    setEntregaEmProcessamento(true)

    try {
      const resultado = await entregarPedidoCentral(String(venda.id || ''), 'Synergias')
      setVenda(resultado.pedido)
      alert('Produtos entregues')
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Não foi possível confirmar a entrega.'
      alert(mensagem === MENSAGEM_ESTOQUE_JA_BAIXADO ? MENSAGEM_ESTOQUE_JA_BAIXADO : mensagem)
    } finally {
      entregaEmProcessamentoRef.current = false
      setEntregaEmProcessamento(false)
    }
  }
  function validarDadosNotaFiscal() {
    const erros: string[] = []
    const dataAtual = hoje()

    if (!venda.clienteNome) {
      erros.push('Selecione o cliente antes de emitir a nota fiscal.')
    }

    const documentoFiscal = String(venda.clienteDocumento || '').replace(/\D/g, '')
    if (!documentoFiscal) {
      erros.push('Informe o CPF ou CNPJ do cliente.')
    } else if (![11, 14].includes(documentoFiscal.length)) {
      erros.push('CPF/CNPJ incompleto. Informe 11 dígitos para CPF ou 14 dígitos para CNPJ.')
    } else if (String(venda.clienteNome || '').toUpperCase().includes('COUNTRY') && documentoFiscal.length !== 14) {
      erros.push('Este cliente é pessoa jurídica. Informe o CNPJ completo com 14 dígitos antes de emitir a NF-e.')
    }

    const indicadorIE = String(venda.clienteIndicadorIE || '').trim()
    const inscricaoEstadual = String(venda.clienteIeRg || '').trim()

    if (!['1', '2', '9'].includes(indicadorIE)) {
      erros.push('Selecione se o cliente é contribuinte, contribuinte isento ou não contribuinte de ICMS.')
    }

    if (indicadorIE === '1' && !inscricaoEstadual) {
      erros.push('Informe a Inscrição Estadual do cliente contribuinte de ICMS.')
    }

    if (!venda.itens || venda.itens.length === 0) {
      erros.push('Inclua pelo menos um produto no pedido.')
    }

    if (totais.totalFinal <= 0) {
      erros.push('O valor final do pedido precisa ser maior que zero.')
    }

    const totalParcelas = (venda.parcelas || []).reduce((soma, parcela) => soma + Number(parcela.valor || 0), 0)
    if (totalParcelas > 0 && Math.abs(totalParcelas - totais.totalFinal) > 0.01) {
      erros.push(`O total das parcelas (${dinheiro(totalParcelas)}) não confere com o total do pedido (${dinheiro(totais.totalFinal)}).`)
    }

    if (venda.dataEntrega && venda.dataEmissao && venda.dataEntrega < venda.dataEmissao) {
      erros.push('Data de entrega/saída não pode ser menor que a data de emissão.')
    }

    if (venda.dataEntrega && venda.dataEntrega < dataAtual) {
      erros.push('Data de entrega/saída não pode ser menor que a data atual.')
    }

    return erros
  }

  function somenteDigitosFiscal(valor: unknown, limite: number) {
    return String(valor || '').replace(/\D/g, '').slice(0, limite)
  }

  function normalizarUfFiscal(valor: unknown) {
    return String(valor || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)
  }

  function obterCfopAutomatico(vendaAtual: Venda) {
    const configuracaoFiscal = obterConfiguracaoFiscalStorage()
    const ufEmitente = normalizarUfFiscal(configuracaoFiscal.uf || 'RS')
    const ufDestinatario = normalizarUfFiscal(
      vendaAtual.faturamentoEstado || vendaAtual.entregaEstado,
    )

    if (!ufDestinatario || ufDestinatario.length !== 2) return ''
    return ufDestinatario === ufEmitente ? '5102' : '6102'
  }

  function localizarProdutoDoItem(item: ItemVenda) {
    const codigoItem = String(item.codigoProduto || '').trim()
    const barrasItem = String(item.codigoBarras || '').replace(/\D/g, '')
    const descricaoItem = String(item.descricao || '').trim().toLocaleLowerCase('pt-BR')

    return produtos.find((produtoAtual) => {
      const codigoProduto = String(produtoAtual.codigo || produtoAtual.id || '').trim()
      const barrasProduto = String(produtoAtual.codigoBarras || '').replace(/\D/g, '')
      const descricaoProduto = String(produtoAtual.descricao || produtoAtual.nome || '').trim().toLocaleLowerCase('pt-BR')
      return Boolean(
        (codigoItem && codigoProduto === codigoItem) ||
        (barrasItem && barrasProduto && barrasProduto === barrasItem) ||
        (descricaoItem && descricaoProduto && descricaoProduto === descricaoItem),
      )
    })
  }

  function obterOrigemFiscal(...valores: unknown[]): string {
    for (const valor of valores) {
      const texto = String(valor ?? '').trim()
      const codigo = texto.match(/^([0-8])(?:\s*-.*)?$/)?.[1]
      if (codigo) return `${codigo} - ${codigo === '0' ? 'Nacional' : texto.replace(/^([0-8])\s*-?\s*/, '') || 'Origem fiscal'}`
    }
    return '0 - Nacional'
  }

  function enriquecerItensComDadosFiscais(vendaAtual: Venda): Venda {
    return {
      ...vendaAtual,
      itens: (vendaAtual.itens || []).map((item) => {
        const produto = localizarProdutoDoItem(item)
        const ncmItem = somenteDigitosFiscal(item.ncm, 8)
        const ncmProduto = somenteDigitosFiscal(produto?.ncm, 8)
        const cfopAutomatico = obterCfopAutomatico(vendaAtual)
        const cfopItem = somenteDigitosFiscal(item.cfop, 4)
        const classificacao = item.classificacao || produto?.classificacao || ''
        const possuiRegraEspecifica = Boolean(
          item.csosn || item.cstIcms || produto?.csosn || produto?.cstIcms ||
          item.cstPis || item.cstCofins || produto?.cstPis || produto?.cstCofins ||
          String(classificacao).toUpperCase().includes('SUBSTITUI'),
        )

        return {
          ...item,
          codigoProduto: String(item.codigoProduto || produto?.codigo || produto?.codigoInterno || ''),
          codigoBarras: String(item.codigoBarras || produto?.codigoBarras || produto?.codigo || ''),
          ncm: ncmItem.length === 8 ? ncmItem : ncmProduto,
          ncmDescricao: item.ncmDescricao || produto?.ncmDescricao || '',
          cfop: cfopAutomatico || cfopItem,
          origem: obterOrigemFiscal(produto?.origem),
          cest: item.cest || produto?.cest || '',
          classificacao,
          csosn: item.csosn || produto?.csosn || (possuiRegraEspecifica ? '' : '102'),
          cstIcms: item.cstIcms || produto?.cstIcms || '',
          modalidadeBcIcms: item.modalidadeBcIcms || produto?.modalidadeBcIcms || '3',
          aliquotaIcms: item.aliquotaIcms ?? produto?.aliquotaIcms ?? 0,
          reducaoBcIcms: item.reducaoBcIcms ?? produto?.reducaoBcIcms ?? 0,
          cstPis: item.cstPis || produto?.cstPis || (possuiRegraEspecifica ? '' : '49'),
          aliquotaPis: item.aliquotaPis ?? produto?.aliquotaPis ?? 0,
          cstCofins: item.cstCofins || produto?.cstCofins || (possuiRegraEspecifica ? '' : '49'),
          aliquotaCofins: item.aliquotaCofins ?? produto?.aliquotaCofins ?? 0,
        }
      }),
    }
  }

  function ratearFreteNosItens(vendaAtual: Venda): Venda {
    const freteTotalCentavos = Math.max(0, Math.round(Number(vendaAtual.frete || 0) * 100))
    const itens = vendaAtual.itens || []
    if (freteTotalCentavos === 0 || itens.length === 0) {
      return {
        ...vendaAtual,
        itens: itens.map((item) => ({ ...item, frete: 0 })),
      }
    }

    const valoresItens = itens.map((item) => Math.max(0, Number(recalcularItemPedido(item).valorTotal || 0)))
    const subtotalCentavos = Math.round(valoresItens.reduce((total, valor) => total + valor, 0) * 100)
    let freteRateadoCentavos = 0

    return {
      ...vendaAtual,
      itens: itens.map((item, index) => {
        const freteItemCentavos =
          index === itens.length - 1
            ? freteTotalCentavos - freteRateadoCentavos
            : subtotalCentavos > 0
              ? Math.floor((freteTotalCentavos * Math.round(valoresItens[index] * 100)) / subtotalCentavos)
              : Math.floor(freteTotalCentavos / itens.length)
        freteRateadoCentavos += freteItemCentavos
        return { ...item, frete: freteItemCentavos / 100 }
      }),
    }
  }

  function montarAjustesFiscais(vendaAtual: Venda): AjusteFiscalItem[] {
    const cfopAutomatico = obterCfopAutomatico(vendaAtual)
    return (vendaAtual.itens || []).map((item, index) => {
      const produto = localizarProdutoDoItem(item)
      return {
        index,
        codigoProduto: String(item.codigoProduto || produto?.codigo || ''),
        codigoBarras: String(item.codigoBarras || produto?.codigoBarras || ''),
        descricao: String(item.descricao || produto?.descricao || ''),
        ncm: somenteDigitosFiscal(item.ncm || produto?.ncm, 8),
        cfop: cfopAutomatico || somenteDigitosFiscal(item.cfop, 4),
        tipoFiscal: String(item.tipoFiscalVenda || 'Material de Uso e Consumo'),
        origem: obterOrigemFiscal(produto?.origem),
      }
    }).filter((item) => item.ncm.length !== 8 || item.cfop.length !== 4)
  }

  function atualizarAjusteFiscal(index: number, campo: keyof AjusteFiscalItem, valor: string) {
    setAjustesFiscais((atuais) => atuais.map((item, i) => i === index ? { ...item, [campo]: valor } : item))
  }

  function normalizarTextoBuscaNcm(valor: string) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  function converterSugestaoNcm(valor: any): SugestaoNcm | null {
    const codigo = somenteDigitosFiscal(valor?.codigo || valor?.ncm || '', 8)
    const descricao = String(valor?.descricao || valor?.nome || '').trim()
    if (codigo.length !== 8 || !descricao) return null
    return { codigo, descricao }
  }

  function selecionarSugestaoNcm(index: number, sugestao: SugestaoNcm) {
    atualizarAjusteFiscal(index, 'ncm', sugestao.codigo)
    setBuscasNcm((atuais) => ({ ...atuais, [index]: sugestao.codigo }))
    setSugestoesNcm((atuais) => ({ ...atuais, [index]: [] }))
  }

  async function pesquisarNcm(index: number, termoOriginal: string, descricaoProduto: string) {
    const termo = String(termoOriginal || '').trim()
    const digitos = termo.replace(/\D/g, '').slice(0, 8)
    const termoNormalizado = normalizarTextoBuscaNcm(termo)

    if (termo.length < 2) {
      setSugestoesNcm((atuais) => ({ ...atuais, [index]: [] }))
      return
    }

    setBuscandoNcmPorLinha((atuais) => ({ ...atuais, [index]: true }))

    try {
      const sugestoesLocais = produtos
        .filter((produto) => somenteDigitosFiscal(produto.ncm, 8).length === 8)
        .filter((produto) => {
          const codigo = somenteDigitosFiscal(produto.ncm, 8)
          const descricao = normalizarTextoBuscaNcm(produto.descricao || produto.nome || '')
          return codigo.includes(digitos || termoNormalizado) || descricao.includes(termoNormalizado)
        })
        .map((produto) => ({
          codigo: somenteDigitosFiscal(produto.ncm, 8),
          descricao: String(produto.descricao || produto.nome || '').trim(),
        }))

      let sugestoesApi: SugestaoNcm[] = []
      const url = `/api/ncm-busca.php?termo=${encodeURIComponent(termo || descricaoProduto)}`

      const resposta = await fetch(url)
      if (resposta.ok) {
        const dados = await resposta.json()
        const lista = Array.isArray(dados) ? dados : [dados]
        sugestoesApi = lista.map(converterSugestaoNcm).filter(Boolean) as SugestaoNcm[]
      }

      const unicas = [...sugestoesLocais, ...sugestoesApi]
        .filter((item, posicao, lista) => lista.findIndex((outro) => outro.codigo === item.codigo) === posicao)
        .slice(0, 12)

      setSugestoesNcm((atuais) => ({ ...atuais, [index]: unicas }))

      if (digitos.length === 8 && /^\d+$/.test(termo) && unicas.length > 0) {
        selecionarSugestaoNcm(index, unicas[0])
      }
    } catch {
      const sugestoesLocais = produtos
        .filter((produto) => somenteDigitosFiscal(produto.ncm, 8).length === 8)
        .filter((produto) => normalizarTextoBuscaNcm(produto.descricao || produto.nome || '').includes(termoNormalizado))
        .map((produto) => ({ codigo: somenteDigitosFiscal(produto.ncm, 8), descricao: String(produto.descricao || produto.nome || '') }))
        .slice(0, 12)
      setSugestoesNcm((atuais) => ({ ...atuais, [index]: sugestoesLocais }))
    } finally {
      setBuscandoNcmPorLinha((atuais) => ({ ...atuais, [index]: false }))
    }
  }

  function alterarBuscaNcm(index: number, valor: string, descricaoProduto: string) {
    setBuscasNcm((atuais) => ({ ...atuais, [index]: valor }))
    const apenasDigitos = valor.replace(/\D/g, '').slice(0, 8)
    atualizarAjusteFiscal(index, 'ncm', /^\d+$/.test(valor.trim()) ? apenasDigitos : '')

    const temporizadorAtual = temporizadoresBuscaNcm.current[index]
    if (temporizadorAtual) clearTimeout(temporizadorAtual)
    temporizadoresBuscaNcm.current[index] = setTimeout(() => {
      void pesquisarNcm(index, valor, descricaoProduto)
    }, 350)
  }

  function salvarAjustesFiscais() {
    const invalidos = ajustesFiscais.filter((item) => somenteDigitosFiscal(item.ncm, 8).length !== 8 || somenteDigitosFiscal(item.cfop, 4).length !== 4)
    if (invalidos.length) {
      alert('Informe NCM com 8 dígitos e CFOP com 4 dígitos em todos os itens.')
      return
    }

    ajustesFiscais.forEach((ajuste) => {
      const produto = localizarProdutoDoItem({
        codigoProduto: ajuste.codigoProduto,
        codigoBarras: ajuste.codigoBarras,
        descricao: ajuste.descricao,
      } as ItemVenda)
      if (produto) {
        salvarProdutoStorage({
          ...produto,
          ncm: somenteDigitosFiscal(ajuste.ncm, 8),
          origem: ajuste.origem,
        })
      }
    })

    setVenda((atual) => ({
      ...atual,
      itens: atual.itens.map((item, index) => {
        const ajuste = ajustesFiscais.find((atualAjuste) => atualAjuste.index === index)
        if (!ajuste) return item
        return {
          ...item,
          ncm: somenteDigitosFiscal(ajuste.ncm, 8),
          cfop: somenteDigitosFiscal(ajuste.cfop, 4),
          tipoFiscalVenda: ajuste.tipoFiscal,
        }
      }),
    }))
    setMostrarAjusteFiscal(false)
    setAjustesFiscais([])
    alert('Dados fiscais salvos no produto e aplicados ao pedido. Clique novamente em Validar emissão.')
  }

  // SYNERGIAS_NFE_CONFIG_FISCAL_CENTRAL_V221
  async function emitirNotaFiscal() {
    const errosNota = validarDadosNotaFiscal()

    if (errosNota.length > 0) {
      alert(`Corrija os dados da nota fiscal:\n\n${errosNota.join('\n')}`)
      return
    }

    const indicadorDescricao =
      venda.clienteIndicadorIE === '1'
        ? 'Contribuinte de ICMS'
        : venda.clienteIndicadorIE === '2'
          ? 'Contribuinte isento'
          : 'Não contribuinte'

    const confirmar = window.confirm(
      `CONFIRME OS DADOS FISCAIS DO CLIENTE ANTES DA NF-e:\n\n` +
        `Cliente: ${venda.clienteNome || '-'}\n` +
        `CPF/CNPJ: ${venda.clienteDocumento || '-'}\n` +
        `Indicador IE: ${indicadorDescricao}\n` +
        `Inscrição Estadual: ${venda.clienteIndicadorIE === '1' ? venda.clienteIeRg || 'NÃO INFORMADA' : venda.clienteIndicadorIE === '2' ? 'ISENTO' : 'NÃO SE APLICA'}\n` +
        `E-mail da NF-e: ${venda.clienteEmail || '-'}\n\n` +
        `Emitir em PRODUÇÃO com a data de hoje (${formatarDataBrasil(hoje())})?`,
    )
    if (!confirmar) return

    try {
      const pedidoAtual = ratearFreteNosItens(enriquecerItensComDadosFiscais({ ...montarPedidoAtualizado(), observacoes: venda.observacoesNotaFiscal || venda.observacoes || '' }))
      const pendenciasFiscais = montarAjustesFiscais(pedidoAtual)
      if (pendenciasFiscais.length > 0) {
        setAjustesFiscais(pendenciasFiscais)
        setMostrarAjusteFiscal(true)
        return
      }
      let configuracaoFiscalAtual = obterConfiguracaoFiscalStorage()
      try {
        configuracaoFiscalAtual = await carregarConfiguracaoFiscalServidor()
      } catch {
        // Se o servidor estiver momentaneamente indisponível, preserva a configuração local já salva.
      }

      const retorno = await validarPreEmissaoNFe({
        venda: pedidoAtual,
        fiscal: configuracaoFiscalAtual,
      })

      if (!retorno.pronto) {
        const detalhes = retorno.erros.length ? retorno.erros.join('\n') : 'Existem dados fiscais pendentes.'
        alert(`A NF-e ainda não está pronta para transmissão:\n\n${detalhes}`)
        return
      }

      const rascunho = await gerarRascunhoXmlNFe({
        venda: pedidoAtual,
        fiscal: configuracaoFiscalAtual,
      })
      if (!rascunho.pronto || !rascunho.xml || !rascunho.chaveAcesso) {
        const detalhes = rascunho.erros?.length ? rascunho.erros.join('\n') : 'O rascunho do XML não ficou completo.'
        alert(`O XML ainda não pôde ser montado:\n\n${detalhes}`)
        return
      }

      const rascunhoComAliases = rascunho as typeof rascunho & {
        nNF?: string | number
        serieNFe?: string | number
      }

      const chaveNormalizada = String(rascunho.chaveAcesso || '').replace(/\D/g, '')
      const numeroPelaChave =
        chaveNormalizada.length === 44
          ? String(Number(chaveNormalizada.slice(25, 34)))
          : ''
      const seriePelaChave =
        chaveNormalizada.length === 44
          ? String(Number(chaveNormalizada.slice(22, 25)))
          : ''

      const numeroNFe = String(
        rascunho.numero ||
          rascunhoComAliases.nNF ||
          numeroPelaChave,
      ).trim()

      const serieNFe = String(
        rascunho.serie ||
          rascunhoComAliases.serieNFe ||
          seriePelaChave ||
          '1',
      ).trim()

      if (!numeroNFe || numeroNFe === 'undefined' || numeroNFe === 'NaN') {
        alert('O XML foi montado, mas a numeração da NF-e não pôde ser confirmada. A transmissão foi bloqueada.')
        return
      }

      const confirmarTransmissao = window.confirm(
        `ATENÇÃO: ESTA EMISSÃO TEM VALIDADE FISCAL.\n\nO XML será assinado com o A1 e transmitido à SEFAZ-RS em PRODUÇÃO.\n\nNF-e nº ${numeroNFe}, série ${serieNFe}\nChave: ${rascunho.chaveAcesso}\n\nConfirma a transmissão oficial agora?`,
      )
      if (!confirmarTransmissao) return

      const homologacao = await assinarETransmitirNFeHomologacao(rascunho.xmlBase64)
      const xmlFinal = homologacao.xmlProcessadoBase64 || homologacao.xmlAssinadoBase64
      const vendaAtualizada: Venda = {
        ...pedidoAtual,
        statusNotaFiscal: homologacao.autorizada ? 'Autorizada' : 'Rejeitada',
        numeroNotaFiscal: numeroNFe,
        serieNotaFiscal: serieNFe,
        chaveAcessoNotaFiscal: homologacao.chaveAcesso || rascunho.chaveAcesso,
        dataEmissaoNotaFiscal: homologacao.recebidoEm || new Date().toISOString(),
        ambienteNotaFiscal: 'PRODUCAO',
        cStatNotaFiscal: homologacao.cStat,
        protocoloNotaFiscal: homologacao.protocolo || '',
        xmlNotaFiscal: xmlFinal,
        danfePdf: homologacao.danfeUrl || '',
        motivoRejeicaoNotaFiscal: homologacao.autorizada ? '' : `${homologacao.cStat} - ${homologacao.motivo}`,
        historicoNotaFiscal: [
          ...(pedidoAtual.historicoNotaFiscal || []),
          {
            id: `nfe-${Date.now()}`,
            ambiente: 'PRODUCAO',
            status: homologacao.autorizada ? 'Autorizada' : 'Rejeitada',
            numero: numeroNFe,
            serie: serieNFe,
            chaveAcesso: homologacao.chaveAcesso || rascunho.chaveAcesso,
            protocolo: homologacao.protocolo || '',
            cStat: homologacao.cStat,
            motivo: homologacao.motivo,
            xml: xmlFinal,
            criadoEm: homologacao.recebidoEm || new Date().toISOString(),
          },
        ],
      }
      const vendaConfirmada = await salvarVendaStorageConfirmado(vendaAtualizada)
      setVenda(vendaConfirmada)

      if (homologacao.autorizada) {
        await registrarNumeracaoNFeAutorizada({
          numero: numeroNFe,
          serie: serieNFe,
          ambiente: 'PRODUCAO',
          cStat: homologacao.cStat,
          chaveAcesso: homologacao.chaveAcesso,
          protocolo: homologacao.protocolo,
        })
        alert(
          `NF-e AUTORIZADA em PRODUÇÃO.\n\n` +
            `Número: ${numeroNFe}\n` +
            `Série: ${serieNFe}\n` +
            `Chave: ${homologacao.chaveAcesso}\n` +
            `Protocolo: ${homologacao.protocolo}\n\n` +
            `XML autorizado e protocolo vinculados ao Pedido.`,
        )
      } else {
        await manterNumeracaoNFeRejeitada(
          String(pedidoAtual.id || pedidoAtual.numeroPedido || 'pedido-sem-id'),
          numeroNFe,
          serieNFe,
        )
        alert(`NF-e rejeitada pela SEFAZ-RS em PRODUÇÃO.\n\ncStat ${homologacao.cStat}: ${homologacao.motivo}`)
      }
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível validar a pré-emissão da NF-e.')
    }
  }

  function salvarParcelasBoleto(parcelas: ParcelaVenda[], atualizacoes: Partial<Venda> = {}) {
    const statusGeral = parcelas.some((parcela) => parcela.statusBoleto === 'Erro')
      ? 'Erro'
      : parcelas.some((parcela) => parcela.statusBoleto === 'Gerando')
        ? 'Gerando'
        : parcelas.length > 0 && parcelas.every((parcela) => parcela.statusBoleto === 'Pago')
          ? 'Pago'
          : parcelas.some((parcela) => boletoFoiGerado(parcela))
            ? 'Gerado'
            : 'Pendente'

    const vendaAtualizada: Venda = {
      ...montarPedidoAtualizado(),
      ...atualizacoes,
      parcelas,
      statusBoleto: statusGeral,
      totalBoletosGerados: parcelas.filter((parcela) => boletoFoiGerado(parcela)).length,
      ultimaAtualizacaoBoleto: new Date().toISOString(),
    }

    salvarVendaStorage(vendaAtualizada)
    setVenda(vendaAtualizada)
    return vendaAtualizada
  }

  function aplicarRetornoInterNaParcela(
    parcela: ParcelaVenda,
    cobranca: CobrancaInterApi,
    pdfBase64 = '',
  ): ParcelaVenda {
    const statusBoleto = statusInterParaBoleto(cobranca.status)
    const agora = new Date()
    const paga = statusBoleto === 'Pago'

    return {
      ...parcela,
      bancoCobranca: 'Inter',
      tipoCobranca: 'BOLETO BANCO INTER',
      statusBoleto,
      numeroBoleto: cobranca.nossoNumero || parcela.numeroBoleto,
      nossoNumero: cobranca.nossoNumero || parcela.nossoNumero,
      seuNumero: cobranca.seuNumero || parcela.seuNumero,
      linhaDigitavel: cobranca.linhaDigitavel || parcela.linhaDigitavel,
      codigoBarras: cobranca.codigoBarras || parcela.codigoBarras,
      idCobrancaBanco: cobranca.codigoSolicitacao || parcela.idCobrancaBanco,
      idCobrancaApi: cobranca.codigoSolicitacao || parcela.idCobrancaApi,
      boletoPdfBase64: pdfBase64 || cobranca.pdfBase64 || parcela.boletoPdfBase64,
      pixCopiaECola: cobranca.pixCopiaECola || parcela.pixCopiaECola,
      pixTxId: cobranca.txid || parcela.pixTxId,
      ambienteBoleto: 'producao',
      bancoRetornoOriginal: cobranca.raw || cobranca,
      dataGeracaoBoleto: parcela.dataGeracaoBoleto || hoje(),
      horarioGeracaoBoleto:
        parcela.horarioGeracaoBoleto ||
        agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      dataPagamentoBoleto: paga ? cobranca.dataPagamento || hoje() : parcela.dataPagamentoBoleto,
      valorRecebido: paga ? Number(cobranca.valorRecebido || parcela.valor || 0) : parcela.valorRecebido,
      erroBoleto: '',
      motivoErroBoleto: '',
    }
  }

  async function emitirParcelaInter(parcela: ParcelaVenda): Promise<ParcelaVenda> {
    const pedidoBase = montarPedidoAtualizado()
    salvarVendaStorage(pedidoBase)
    setVenda(pedidoBase)
    const emitindo: ParcelaVenda = { ...parcela, statusBoleto: 'Gerando', erroBoleto: '', motivoErroBoleto: '' }

    try {
      const cobranca = await emitirCobrancaInter(pedidoBase, emitindo)
      let pdfBase64 = ''
      try {
        pdfBase64 = await obterPdfCobrancaInter(cobranca.codigoSolicitacao)
      } catch {
        pdfBase64 = ''
      }
      const atualizada = aplicarRetornoInterNaParcela(emitindo, cobranca, pdfBase64)
      atualizarContaReceberComBoleto(atualizada, cobranca)
      return atualizada
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Falha ao emitir cobrança no Banco Inter.'
      const codigoExistente = mensagem.match(
        /c[oó]digo de solicita[cç][aã]o:\s*([0-9a-f-]{36})/i,
      )?.[1]
      if (codigoExistente) {
        try {
          const cobrancaExistente = await consultarCobrancaInter(codigoExistente)
          const recuperada = aplicarRetornoInterNaParcela(
            {
              ...emitindo,
              idCobrancaBanco: codigoExistente,
              idCobrancaApi: codigoExistente,
            },
            { ...cobrancaExistente, codigoSolicitacao: codigoExistente },
          )
          return {
            ...recuperada,
            erroBoleto: '',
            motivoErroBoleto: '',
          }
        } catch {
          // Se a consulta do identificador informado pelo banco falhar,
          // preserva o erro original para diagnóstico.
        }
      }
      return {
        ...emitindo,
        statusBoleto: 'Erro',
        erroBoleto: mensagem,
        motivoErroBoleto: mensagem,
      }
    }
  }

  async function gerarBoleto() {
    const vendaBase = montarPedidoAtualizado()
    const totalAtual = calcularTotais(vendaBase).totalFinal

    if (totalAtual <= 0) return alert('Inclua itens no pedido antes de emitir boleto.')
    if (vendaBase.formaPagamento !== 'BOLETO') return alert('Selecione a forma de pagamento BOLETO.')
    if (!vendaBase.tipoCobranca) return alert('Selecione BOLETO BANCO INTER.')

    const bancoSelecionado = identificarBancoBoleto(String(vendaBase.tipoCobranca || ''))
    if (bancoSelecionado !== 'Inter') return alert('Selecione um banco válido para emitir boleto.')

    const parcelasBase = vendaBase.parcelas.length > 0 ? vendaBase.parcelas : []
    if (parcelasBase.length === 0) return alert('Defina as parcelas do pagamento antes de emitir os boletos.')

    const pendentes = parcelasBase.filter((parcela) => !boletoFoiGerado(parcela))
    if (pendentes.length === 0) return alert('Os boletos deste pedido já foram emitidos. Use Atualizar cobranças para consultar o banco.')

    const usadosOutros = contarBoletosGeradosNoMesPorBanco('Inter', mesAtualBoletos, venda.id)
    if (usadosOutros + pendentes.length > LIMITE_BOLETOS_GRATUITOS_POR_BANCO) {
      alert(`Limite mensal configurado para o Banco Inter excedido. Usados: ${usadosOutros}/${LIMITE_BOLETOS_GRATUITOS_POR_BANCO}.`)
      return
    }

    let parcelas = parcelasBase.map((parcela) =>
      pendentes.includes(parcela) ? { ...parcela, statusBoleto: 'Gerando' as const } : parcela,
    )
    salvarParcelasBoleto(parcelas)

    for (let indice = 0; indice < parcelas.length; indice += 1) {
      if (boletoFoiGerado(parcelas[indice])) continue
      const atualizada = await emitirParcelaInter(parcelas[indice])
      parcelas = parcelas.map((parcela, posicao) => posicao === indice ? atualizada : parcela)
      salvarParcelasBoleto(parcelas)
    }

    const erros = parcelas.filter((parcela) => parcela.statusBoleto === 'Erro')
    if (erros.length > 0) {
      alert(`Emissão concluída com ${erros.length} erro(s). O motivo real retornado pela integração está visível em cada parcela.`)
      return
    }

    alert('Cobranças emitidas e vinculadas às parcelas do pedido.')
  }

  async function atualizarCobrancas() {
    let parcelas = [...(venda.parcelas || [])]
    const codigoRegistradoOuRetornadoNoErro = (parcela: ParcelaVenda) =>
      String(
        parcela.idCobrancaApi
        || parcela.idCobrancaBanco
        || String(parcela.erroBoleto || parcela.motivoErroBoleto || '').match(
          /c[oó]digo de solicita[cç][aã]o:\s*([0-9a-f-]{36})/i,
        )?.[1]
        || '',
      )
    const consultaveis = parcelas.filter((parcela) =>
      identificarBancoBoletoDaParcela(parcela, venda) === 'Inter' &&
      Boolean(codigoRegistradoOuRetornadoNoErro(parcela)),
    )

    if (consultaveis.length === 0) return alert('Nenhuma cobrança Inter emitida para consultar neste pedido.')

    for (let indice = 0; indice < parcelas.length; indice += 1) {
      const parcela = parcelas[indice]
      const codigo = codigoRegistradoOuRetornadoNoErro(parcela)
      if (!codigo || identificarBancoBoletoDaParcela(parcela, venda) !== 'Inter') continue

      try {
        const cobranca = await consultarCobrancaInter(codigo)
        let pdfBase64 = parcela.boletoPdfBase64 || ''
        if (!pdfBase64) {
          try { pdfBase64 = await obterPdfCobrancaInter(codigo) } catch { pdfBase64 = '' }
        }
        const atualizada = aplicarRetornoInterNaParcela({
          ...parcela,
          idCobrancaBanco: codigo,
          idCobrancaApi: codigo,
        }, { ...cobranca, codigoSolicitacao: codigo }, pdfBase64)
        atualizarContaReceberComBoleto(atualizada, cobranca)
        parcelas = parcelas.map((item, posicao) => posicao === indice ? atualizada : item)
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : 'Falha ao consultar cobrança.'
        parcelas = parcelas.map((item, posicao) => posicao === indice ? {
          ...item,
          statusBoleto: 'Erro',
          erroBoleto: mensagem,
          motivoErroBoleto: mensagem,
        } : item)
      }
    }

    salvarParcelasBoleto(parcelas)
    alert('Consulta das cobranças concluída.')
  }

  async function visualizarBoleto(parcela: ParcelaVenda) {
    let pdfBase64 = parcela.boletoPdfBase64 || ''
    const codigo = String(parcela.idCobrancaApi || parcela.idCobrancaBanco || '')

    if (!pdfBase64 && codigo && identificarBancoBoletoDaParcela(parcela, venda) === 'Inter') {
      try {
        pdfBase64 = await obterPdfCobrancaInter(codigo)
        const parcelas = venda.parcelas.map((item) =>
          Number(item.numero) === Number(parcela.numero) ? { ...item, boletoPdfBase64: pdfBase64 } : item,
        )
        salvarParcelasBoleto(parcelas)
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Não foi possível obter o PDF do boleto.')
        return
      }
    }

    if (pdfBase64) abrirPdfBase64(pdfBase64, 'o boleto')
    else if (parcela.boletoPdfUrl || parcela.linkBoleto) window.open(parcela.boletoPdfUrl || parcela.linkBoleto, '_blank', 'noopener,noreferrer')
    else alert('O PDF oficial do boleto ainda não está disponível.')
  }

  async function imprimirBoleto(parcela: ParcelaVenda) {
    await visualizarBoleto(parcela)
  }

  async function cancelarBoleto(parcela: ParcelaVenda) {
    const codigo = String(parcela.idCobrancaApi || parcela.idCobrancaBanco || '')
    if (parcela.statusBoleto === 'Cancelado') return alert('Esta cobrança já está cancelada.')
    if (cancelamentosBoletoEmAndamento.current.has(codigo)) return
    if (!codigo) return alert('Esta parcela não possui uma cobrança bancária real para cancelar.')
    if (identificarBancoBoletoDaParcela(parcela, venda) !== 'Inter') return alert('Esta cobrança não pertence ao Banco Inter.')
    if (!window.confirm(`Cancelar a cobrança da parcela ${parcela.numero}?`)) return

    cancelamentosBoletoEmAndamento.current.add(codigo)
    try {
      const cobranca = await cancelarCobrancaInter(codigo)
      const parcelas = venda.parcelas.map((item) =>
        Number(item.numero) === Number(parcela.numero)
          ? {
              ...aplicarRetornoInterNaParcela(item, cobranca),
              statusBoleto: 'Cancelado' as const,
              dataCancelamentoBoleto: hoje(),
              horarioCancelamentoBoleto: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            }
          : item,
      )
      const vendaAtualizada = salvarParcelasBoleto(parcelas)
      try {
        await salvarVendaStorageConfirmado(vendaAtualizada)
      } catch (error) {
        alert(error instanceof Error
          ? `O banco confirmou o cancelamento, mas a gravação central falhou: ${error.message}`
          : 'O banco confirmou o cancelamento, mas a gravação central falhou.')
        return
      }
      alert('Cobrança cancelada.')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível cancelar a cobrança.')
    } finally {
      cancelamentosBoletoEmAndamento.current.delete(codigo)
    }
  }

  function limparNomeArquivoEmail(valor?: string | number) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80)
  }


  function montarNomesAnexosEmail(vendaBase: Venda) {
    const numeroPedido = limparNomeArquivoEmail(vendaBase.numeroPedido || vendaBase.id || 'pedido')
    const nomeCliente = limparNomeArquivoEmail(vendaBase.clienteNome || 'cliente')

    return {
      notaFiscal: `Nota_Fiscal_Pedido_${numeroPedido}_${nomeCliente}.pdf`,
      boleto: (numeroParcela: number, totalParcelas: number, vencimento: string) =>
        `Boleto_Pedido_${numeroPedido}_${nomeCliente}_Parcela_${String(numeroParcela).padStart(2, '0')}_de_${String(totalParcelas).padStart(2, '0')}_Vencimento_${limparNomeArquivoEmail(vencimento || 'nao_informado')}.pdf`,
    }
  }

  const SYNERGIAS_EMAIL_PIX_TRANSFERENCIA_COMPLETO_V264 =
    'SYNERGIAS_EMAIL_PIX_TRANSFERENCIA_COMPLETO_V264'

  function identificarPagamentoEmail(vendaBase: Venda) {
    const texto = normalizarBuscaCredito(
      `${vendaBase.formaPagamento || ''} ${vendaBase.tipoCobranca || ''}`,
    )

    return {
      ehBoleto: texto.includes('boleto'),
      ehPix: texto.includes('pix'),
      ehTransferencia:
        texto.includes('transfer') ||
        texto.includes('deposito') ||
        texto.includes('depósito'),
    }
  }

  const SYNERGIAS_EMAIL_CONTA_SELECIONADA_V264A =
    'SYNERGIAS_EMAIL_CONTA_SELECIONADA_V264A'

  function obterDadosPagamentoEmail(vendaBase: Venda) {
    void SYNERGIAS_EMAIL_CONTA_SELECIONADA_V264A

    const candidatos = [
      vendaBase.tipoCobranca,
      vendaBase.bancoCobranca,
      ...(Array.isArray(vendaBase.parcelas)
        ? vendaBase.parcelas.flatMap((parcela) => [
            parcela.tipoCobranca,
            parcela.bancoCobranca,
            parcela.contaRecebimento,
          ])
        : []),
    ]
      .map((valor) => String(valor || '').trim())
      .filter(Boolean)

    for (const candidato of candidatos) {
      if (DADOS_PAGAMENTO[candidato]) return DADOS_PAGAMENTO[candidato]

      const normalizado = normalizarBuscaCredito(candidato)
      const chaveEncontrada = Object.keys(DADOS_PAGAMENTO).find(
        (chave) => normalizarBuscaCredito(chave) === normalizado,
      )
      if (chaveEncontrada) return DADOS_PAGAMENTO[chaveEncontrada]
    }

    const pagamento = identificarPagamentoEmail(vendaBase)
    const textoCandidatos = normalizarBuscaCredito(candidatos.join(' '))
    const bancoPreferido = textoCandidatos.includes('inter') ? 'inter' : ''

    const chaveFallback = Object.keys(DADOS_PAGAMENTO).find((chave) => {
      const normalizada = normalizarBuscaCredito(chave)
      const tipoConfere = pagamento.ehPix
        ? normalizada.includes('pix')
        : pagamento.ehTransferencia
          ? normalizada.includes('transfer')
          : false
      const bancoConfere = !bancoPreferido || normalizada.includes(bancoPreferido)
      return tipoConfere && bancoConfere
    })

    if (chaveFallback) {
      return DADOS_PAGAMENTO[chaveFallback]
    }

    return undefined
  }

  function montarParcelasEmail(vendaBase: Venda) {
    const parcelas = Array.isArray(vendaBase.parcelas) ? vendaBase.parcelas : []

    return parcelas
      .filter((parcela) => Number(parcela.valor || 0) > 0)
      .map((parcela, indice) => ({
        numero: Number(parcela.numero || indice + 1),
        vencimento: parcela.vencimento || '',
        valor: Number(parcela.valor || 0),
      }))
  }

  function parcelasBoletoParaEmail(vendaBase: Venda) {
    const parcelasGeradas = (vendaBase.parcelas || []).filter((parcela) => boletoFoiGerado(parcela))
    if (!contaCobrancaAtraso) return parcelasGeradas
    return parcelasGeradas.filter(
      (parcela) => Number(parcela.numero) === Number(contaCobrancaAtraso.parcelaNumero),
    )
  }

  function montarAssuntoEmailNotaBoleto(vendaBase: Venda) {
    const pagamento = identificarPagamentoEmail(vendaBase)
    const numeroPedido = vendaBase.numeroPedido || vendaBase.id || ''
    if (contaCobrancaAtraso) {
      return `Pagamento pendente — NF-e ${vendaBase.numeroNotaFiscal || '-'} — Pedido ${numeroPedido}`
    }
    return pagamento.ehBoleto
      ? `NF-e, XML e boletos — Pedido ${numeroPedido}`
      : `NF-e, XML e dados para pagamento — Pedido ${numeroPedido}`
  }

  function montarTextoEmailNotaBoleto(vendaBase: Venda) {
    void SYNERGIAS_EMAIL_PIX_TRANSFERENCIA_COMPLETO_V264
    if (contaCobrancaAtraso) {
      return `Olá, ${vendaBase.clienteNome || 'cliente'},

Identificamos que o pagamento abaixo continua pendente em nosso sistema:

Pedido: ${vendaBase.numeroPedido || '-'}
Nota Fiscal: ${vendaBase.numeroNotaFiscal || '-'}
Vencimento: ${formatarDataBrasil(contaCobrancaAtraso.dataVencimento)}
Valor em aberto: ${dinheiro(Number(contaCobrancaAtraso.saldoAberto || 0))}

Para sua conferência, seguem anexos a Nota Fiscal e o boleto vencido.

Caso o pagamento já tenha sido realizado, pedimos a gentileza de desconsiderar esta mensagem e, se possível, enviar o comprovante para conferência.

Em caso de dúvida ou divergência, estamos à disposição.

Atenciosamente,

SYNERGIAS DISTRIBUIDORA
Telefone/WhatsApp: ${EMPRESA_TELEFONE_WHATSAPP}
E-mail: ${EMPRESA_EMAIL_FINANCEIRO}`
    }
    const pagamento = identificarPagamentoEmail(vendaBase)
    const ehPagamentoBancario = pagamento.ehPix || pagamento.ehTransferencia
    const parcelas = montarParcelasEmail(vendaBase)
    const boletos = pagamento.ehBoleto
      ? (vendaBase.parcelas || []).filter((parcela) => boletoFoiGerado(parcela))
      : []
    const dados = obterDadosPagamentoEmail(vendaBase)
    const quantidadeBoletos = boletos.length
    const anexosTexto = pagamento.ehBoleto
      ? `- Nota Fiscal (DANFE)\n- XML autorizado da NF-e\n- ${quantidadeBoletos} boleto${quantidadeBoletos === 1 ? '' : 's'} — um arquivo para cada parcela`
      : '- Nota Fiscal (DANFE)\n- XML autorizado da NF-e'

    const tituloPagamento = pagamento.ehPix
      ? 'PAGAMENTO VIA PIX'
      : pagamento.ehTransferencia
        ? 'PAGAMENTO VIA TRANSFERÊNCIA BANCÁRIA'
        : ''

    const dadosBancarios = ehPagamentoBancario
      ? [
          tituloPagamento,
          dados?.instituicao ? `Banco/Instituição: ${dados.instituicao}` : '',
          dados?.agencia ? `Agência: ${dados.agencia}` : '',
          dados?.conta ? `Conta: ${dados.conta}` : '',
          pagamento.ehPix && dados?.chavePix ? `Chave PIX: ${dados.chavePix}` : '',
          dados?.nomeEmpresa ? `Titular: ${dados.nomeEmpresa}` : '',
          dados?.cnpj ? `CNPJ: ${dados.cnpj}` : '',
        ].filter(Boolean).join('\n')
      : ''

    const parcelasTexto = parcelas.length > 0
      ? `\n\nParcelas e vencimentos:\n${parcelas
          .map((parcela) =>
            `${parcela.numero}ª parcela — ${formatarDataBrasil(parcela.vencimento)} — ${dinheiro(parcela.valor)}`,
          )
          .join('\n')}`
      : ''

    const orientacao = pagamento.ehBoleto
      ? `Os ${quantidadeBoletos} boleto${quantidadeBoletos === 1 ? '' : 's'} seguem anexos separadamente, correspondendo às parcelas informadas abaixo.`
      : 'A Nota Fiscal e o XML autorizado seguem anexos. Os dados bancários da conta escolhida no pedido estão informados no corpo deste e-mail. Não há boleto anexado para esta forma de pagamento.'

    return `Olá, ${vendaBase.clienteNome || 'cliente'},

Encaminhamos os documentos referentes à compra de materiais realizada com a SYNERGIAS SL COMÉRCIO LTDA ME.

Anexos enviados:
${anexosTexto}

Dados do pedido:
Pedido: ${vendaBase.numeroPedido || '-'}
Nota Fiscal: ${vendaBase.numeroNotaFiscal || '-'}
Data de emissão: ${formatarDataBrasil(vendaBase.dataEmissao)}
Valor total: ${dinheiro(Number(vendaBase.totalFinal || totais.totalFinal || 0))}${dadosBancarios ? `\n\n${dadosBancarios}` : ''}${parcelasTexto}

${orientacao}

Em caso de dúvidas ou divergências, estamos à disposição.

Atenciosamente,

SYNERGIAS DISTRIBUIDORA
Produtos de limpeza, soluções e assessoria para condomínios

Telefone/WhatsApp: ${EMPRESA_TELEFONE_WHATSAPP}
Site: ${EMPRESA_SITE}
E-mail: ${EMPRESA_EMAIL_FINANCEIRO}
Endereço: ${EMPRESA_ENDERECO}`
  }

  function montarHtmlEmailNotaBoleto(vendaBase: Venda) {
    if (contaCobrancaAtraso) {
      return `<div style="font-family:Arial,sans-serif;color:#111827;font-size:15px;line-height:1.6;max-width:760px;"><div style="background:#f59e0b;color:#111827;text-align:center;padding:12px;font-weight:700;font-size:18px;">PAGAMENTO PENDENTE</div><div style="padding:28px 24px;"><p>Olá, <strong>${vendaBase.clienteNome || 'cliente'}</strong>,</p><p>Identificamos que o pagamento abaixo continua pendente em nosso sistema:</p><table style="border-collapse:collapse;width:100%;max-width:560px;margin:18px 0;"><tr><td style="border:1px solid #d1d5db;padding:8px;font-weight:700;">Pedido</td><td style="border:1px solid #d1d5db;padding:8px;">${vendaBase.numeroPedido || '-'}</td></tr><tr><td style="border:1px solid #d1d5db;padding:8px;font-weight:700;">Nota Fiscal</td><td style="border:1px solid #d1d5db;padding:8px;">${vendaBase.numeroNotaFiscal || '-'}</td></tr><tr><td style="border:1px solid #d1d5db;padding:8px;font-weight:700;">Vencimento</td><td style="border:1px solid #d1d5db;padding:8px;">${formatarDataBrasil(contaCobrancaAtraso.dataVencimento)}</td></tr><tr><td style="border:1px solid #d1d5db;padding:8px;font-weight:700;">Valor em aberto</td><td style="border:1px solid #d1d5db;padding:8px;"><strong>${dinheiro(Number(contaCobrancaAtraso.saldoAberto || 0))}</strong></td></tr></table><p>Para sua conferência, seguem anexos a <strong>Nota Fiscal</strong> e o <strong>boleto vencido</strong>.</p><p>Caso o pagamento já tenha sido realizado, pedimos a gentileza de desconsiderar esta mensagem e, se possível, enviar o comprovante para conferência.</p><p>Em caso de dúvida ou divergência, estamos à disposição.</p><p>Atenciosamente,</p><table style="border-collapse:collapse;margin-top:24px;border:1px solid #222;width:625px;max-width:100%;"><tr><td style="padding:16px;width:200px;text-align:center;border-right:1px solid #222;"><img src="cid:logoSynergias" alt="Synergias Distribuidora" style="max-width:155px;height:auto;"/></td><td style="padding:16px;"><strong>SYNERGIAS DISTRIBUIDORA</strong><br/>Telefone/WhatsApp: ${EMPRESA_TELEFONE_WHATSAPP}<br/>E-mail: ${EMPRESA_EMAIL_FINANCEIRO}</td></tr></table></div></div>`
    }
    const pagamento = identificarPagamentoEmail(vendaBase)
    const ehPagamentoBancario = pagamento.ehPix || pagamento.ehTransferencia
    const dados = obterDadosPagamentoEmail(vendaBase)
    const parcelas = montarParcelasEmail(vendaBase)
    const boletos = pagamento.ehBoleto
      ? (vendaBase.parcelas || []).filter((parcela) => boletoFoiGerado(parcela))
      : []
    const quantidadeBoletos = boletos.length
    const listaAnexos = pagamento.ehBoleto
      ? `<li>Nota Fiscal (DANFE)</li><li>XML autorizado da NF-e</li><li>${quantidadeBoletos} boleto${quantidadeBoletos === 1 ? '' : 's'}, um arquivo para cada parcela</li>`
      : '<li>Nota Fiscal (DANFE)</li><li>XML autorizado da NF-e</li>'

    const tituloPagamento = pagamento.ehPix
      ? 'PAGAMENTO VIA PIX'
      : pagamento.ehTransferencia
        ? 'PAGAMENTO VIA TRANSFERÊNCIA BANCÁRIA'
        : 'DOCUMENTOS E BOLETOS'

    const linhasDados = ehPagamentoBancario
      ? [
          dados?.instituicao ? `<tr><td style="padding:6px 10px;font-weight:700;">Banco/Instituição</td><td style="padding:6px 10px;">${dados.instituicao}</td></tr>` : '',
          dados?.agencia ? `<tr><td style="padding:6px 10px;font-weight:700;">Agência</td><td style="padding:6px 10px;">${dados.agencia}</td></tr>` : '',
          dados?.conta ? `<tr><td style="padding:6px 10px;font-weight:700;">Conta</td><td style="padding:6px 10px;">${dados.conta}</td></tr>` : '',
          pagamento.ehPix && dados?.chavePix ? `<tr><td style="padding:6px 10px;font-weight:700;">Chave PIX</td><td style="padding:6px 10px;">${dados.chavePix}</td></tr>` : '',
          dados?.nomeEmpresa ? `<tr><td style="padding:6px 10px;font-weight:700;">Titular</td><td style="padding:6px 10px;">${dados.nomeEmpresa}</td></tr>` : '',
          dados?.cnpj ? `<tr><td style="padding:6px 10px;font-weight:700;">CNPJ</td><td style="padding:6px 10px;">${dados.cnpj}</td></tr>` : '',
        ].filter(Boolean).join('')
      : ''

    const tabelaParcelas = parcelas.length > 0
      ? `<p><strong>Parcelas e vencimentos:</strong></p>
         <table style="border-collapse:collapse;width:100%;max-width:560px;margin:10px 0 22px;">
           <thead><tr style="background:#f3f4f6;"><th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Parcela</th><th style="border:1px solid #d1d5db;padding:8px;text-align:left;">Vencimento</th><th style="border:1px solid #d1d5db;padding:8px;text-align:right;">Valor</th></tr></thead>
           <tbody>${parcelas.map((parcela) => `<tr><td style="border:1px solid #d1d5db;padding:8px;">${parcela.numero}ª</td><td style="border:1px solid #d1d5db;padding:8px;">${formatarDataBrasil(parcela.vencimento)}</td><td style="border:1px solid #d1d5db;padding:8px;text-align:right;">${dinheiro(parcela.valor)}</td></tr>`).join('')}</tbody>
         </table>`
      : ''

    const blocoPagamento = ehPagamentoBancario
      ? `<div style="border:2px solid #7ac72f;border-radius:8px;padding:16px 18px;margin:22px 0;"><div style="font-size:17px;font-weight:700;margin-bottom:10px;">${tituloPagamento}</div><table style="border-collapse:collapse;width:100%;max-width:560px;">${linhasDados}</table></div>`
      : ''

    const orientacao = pagamento.ehBoleto
      ? `Os <strong>${quantidadeBoletos} boleto${quantidadeBoletos === 1 ? '' : 's'}</strong> seguem anexos separadamente, correspondendo às parcelas abaixo.`
      : 'A Nota Fiscal e o XML autorizado seguem anexos. Os dados bancários da conta escolhida no pedido estão informados abaixo. <strong>Não há boleto anexado</strong> para esta forma de pagamento.'

    return `<div style="font-family:Arial,sans-serif;color:#111827;font-size:15px;line-height:1.6;max-width:760px;"><div style="background:#7ac72f;color:#000;text-align:center;padding:12px;font-weight:700;font-size:18px;">${tituloPagamento}</div><div style="padding:28px 24px;"><p>Olá, <strong>${vendaBase.clienteNome || 'cliente'}</strong>,</p><p>Encaminhamos os documentos referentes à compra de materiais realizada com a <strong>SYNERGIAS SL COMÉRCIO LTDA ME.</strong></p><p><strong>Anexos enviados:</strong></p><ul>${listaAnexos}</ul><p><strong>Dados do pedido:</strong></p><p>Pedido: <strong>${vendaBase.numeroPedido || '-'}</strong><br/>Nota Fiscal: <strong>${vendaBase.numeroNotaFiscal || '-'}</strong><br/>Data de emissão: <strong>${formatarDataBrasil(vendaBase.dataEmissao)}</strong><br/>Valor total: <strong>${dinheiro(Number(vendaBase.totalFinal || totais.totalFinal || 0))}</strong></p>${blocoPagamento}${tabelaParcelas}<p>${orientacao}</p><p>Em caso de dúvidas ou divergências, estamos à disposição.</p><p>Atenciosamente,</p><table style="border-collapse:collapse;margin-top:24px;border:1px solid #222;width:625px;max-width:100%;"><tr><td style="padding:16px;width:200px;text-align:center;border-right:1px solid #222;"><img src="cid:logoSynergias" alt="Synergias Distribuidora" style="max-width:155px;height:auto;"/></td><td style="padding:16px;"><strong>SYNERGIAS DISTRIBUIDORA</strong><br/>Produtos de limpeza, soluções e assessoria para condomínios<br/><br/>Telefone/WhatsApp: ${EMPRESA_TELEFONE_WHATSAPP}<br/>Site: ${EMPRESA_SITE}<br/>E-mail: ${EMPRESA_EMAIL_FINANCEIRO}<br/>Endereço: ${EMPRESA_ENDERECO}</td></tr></table></div></div>`
  }

  // SYNERGIAS_EMAIL_USAR_DANFE_VISUAL_DO_SISTEMA_V233
  async function gerarDanfeAtualDoSistemaParaEmail(vendaBase: Venda): Promise<string> {
    const vendaAny = vendaBase as Venda & Record<string, unknown>
    const chave = String(
      vendaBase.chaveAcessoNotaFiscal || vendaAny.chaveAcesso || vendaAny.chaveNFe || '',
    ).replace(/\D/g, '')

    if (chave.length !== 44) {
      throw new Error('A chave de acesso da NF-e autorizada não está disponível no pedido.')
    }

    const respostaDanfe = await fetch(
      `/api/fiscal/nfe-danfe.php?chave=${encodeURIComponent(chave)}&emailPdf=V233`,
      {
        credentials: 'include',
        cache: 'no-store',
      },
    )

    if (!respostaDanfe.ok) {
      const detalhe = (await respostaDanfe.text()).trim()
      throw new Error(detalhe || 'Não foi possível carregar o DANFE atual do sistema.')
    }

    let htmlDanfe = await respostaDanfe.text()
    const baseTag = `<base href="${window.location.origin}/">`
    htmlDanfe = htmlDanfe.includes('<head>')
      ? htmlDanfe.replace('<head>', `<head>${baseTag}`)
      : `${baseTag}${htmlDanfe}`

    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.left = '-10000px'
    iframe.style.top = '0'
    iframe.style.width = '820px'
    iframe.style.height = '1120px'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    document.body.appendChild(iframe)

    try {
      const documentoIframe = iframe.contentDocument
      if (!documentoIframe) {
        throw new Error('Não foi possível preparar o DANFE atual para o e-mail.')
      }

      documentoIframe.open()
      documentoIframe.write(htmlDanfe)
      documentoIframe.close()

      await new Promise<void>((resolve, reject) => {
        const limite = window.setTimeout(
          () => reject(new Error('O DANFE demorou demais para ficar pronto.')),
          15000,
        )

        const concluir = () => {
          window.clearTimeout(limite)
          resolve()
        }

        if (documentoIframe.readyState === 'complete') {
          window.setTimeout(concluir, 100)
        } else {
          iframe.addEventListener('load', concluir, { once: true })
        }
      })

      await documentoIframe.fonts?.ready
      await Promise.all(
        Array.from(documentoIframe.images).map(
          (imagem) =>
            new Promise<void>((resolve) => {
              if (imagem.complete) {
                resolve()
                return
              }
              imagem.addEventListener('load', () => resolve(), { once: true })
              imagem.addEventListener('error', () => resolve(), { once: true })
            }),
        ),
      )

      documentoIframe.querySelectorAll('.actions').forEach((elemento) => elemento.remove())
      const danfe = documentoIframe.querySelector<HTMLElement>('.danfe')
      if (!danfe) {
        throw new Error('O DANFE atual do sistema não foi encontrado na página fiscal.')
      }

      documentoIframe.body.style.background = '#ffffff'
      documentoIframe.body.style.margin = '0'
      danfe.style.margin = '0 auto'

      const canvas = await html2canvas(danfe, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        windowWidth: 820,
        width: danfe.scrollWidth,
        height: danfe.scrollHeight,
      })

      if (!canvas.width || !canvas.height) {
        throw new Error('O DANFE atual foi carregado, mas não pôde ser convertido em PDF.')
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      })
      const larguraPagina = 210
      const alturaPagina = 297
      const alturaImagem = (canvas.height * larguraPagina) / canvas.width
      const imagem = canvas.toDataURL('image/jpeg', 0.96)
      const paginas = Math.max(1, Math.ceil(alturaImagem / alturaPagina))

      for (let pagina = 0; pagina < paginas; pagina += 1) {
        if (pagina > 0) pdf.addPage('a4', 'portrait')
        pdf.addImage(
          imagem,
          'JPEG',
          0,
          -(pagina * alturaPagina),
          larguraPagina,
          alturaImagem,
          'danfe-atual-sistema',
          'FAST',
        )
      }

      const dataUri = pdf.output('datauristring')
      const separador = dataUri.indexOf(',')
      if (separador < 0) {
        throw new Error('O PDF do DANFE atual não foi gerado corretamente.')
      }

      return dataUri.slice(separador + 1)
    } finally {
      iframe.remove()
    }
  }

  function separarPdfBase64OuUrl(valor: unknown) {
    const texto = String(valor || '').trim()
    const ehUrl = /^https?:\/\//i.test(texto) || texto.startsWith('/')
    return {
      conteudoBase64: ehUrl ? '' : texto,
      url: ehUrl ? texto : '',
    }
  }



  const SYNERGIAS_EMAIL_TRES_ANEXOS_BOLETO_V242 =
    'SYNERGIAS_EMAIL_TRES_ANEXOS_BOLETO_V242'

  async function garantirPdfBoletoAntesDoEnvio(
    vendaBase: Venda,
  ): Promise<Venda> {
    void SYNERGIAS_EMAIL_TRES_ANEXOS_BOLETO_V242

    const pagamento = identificarPagamentoEmail(vendaBase)
    if (!pagamento.ehBoleto) return vendaBase

    const parcelasGeradas = parcelasBoletoParaEmail(vendaBase)
    if (parcelasGeradas.length === 0) {
      throw new Error(contaCobrancaAtraso
        ? 'O boleto vencido desta conta não foi localizado no pedido.'
        : 'A forma de pagamento é BOLETO, mas nenhum boleto foi gerado para as parcelas deste pedido.')
    }

    if (!contaCobrancaAtraso && parcelasGeradas.length !== (vendaBase.parcelas || []).length) {
      throw new Error(`Existem ${vendaBase.parcelas.length} parcelas, mas somente ${parcelasGeradas.length} boletos foram gerados. Emita todos os boletos antes de enviar o e-mail.`)
    }

    const parcelasAtualizadas = [...(vendaBase.parcelas || [])]
    for (let indice = 0; indice < parcelasAtualizadas.length; indice += 1) {
      const parcela = parcelasAtualizadas[indice]
      if (!parcelasGeradas.some((item) => Number(item.numero) === Number(parcela.numero))) continue
      if (parcela.boletoPdfBase64 || parcela.boletoPdfUrl || parcela.linkBoleto) continue

      const codigo = String(parcela.idCobrancaBanco || parcela.idCobrancaApi || '').trim()
      if (!codigo || identificarBancoBoletoDaParcela(parcela, vendaBase) !== 'Inter') {
        throw new Error(`O boleto da parcela ${parcela.numero} está gerado, mas o PDF não está disponível e a cobrança bancária não pôde ser localizada.`)
      }

      let pdfBase64 = ''
      try {
        pdfBase64 = await obterPdfCobrancaInter(codigo)
      } catch (error) {
        throw new Error(error instanceof Error ? `Não foi possível buscar o PDF do boleto da parcela ${parcela.numero}: ${error.message}` : `Não foi possível buscar o PDF do boleto da parcela ${parcela.numero}.`)
      }
      if (!pdfBase64) {
        throw new Error(`O Banco Inter não devolveu o PDF do boleto da parcela ${parcela.numero}. O e-mail não foi enviado.`)
      }
      parcelasAtualizadas[indice] = { ...parcela, boletoPdfBase64: pdfBase64 }
    }

    const atualizada: Venda = { ...vendaBase, parcelas: parcelasAtualizadas }
    salvarVendaStorage(atualizada)
    setVenda(atualizada)
    return atualizada
  }

  function montarPayloadEmailNotaBoleto(
    vendaBase: Venda,
    emailDestino: string,
    danfeAtualBase64: string,
  ) {
    const nomesAnexos = montarNomesAnexosEmail(vendaBase)
    const danfeOrigem = separarPdfBase64OuUrl(danfeAtualBase64)
    const pagamento = identificarPagamentoEmail(vendaBase)
    const parcelasBoleto = pagamento.ehBoleto
      ? parcelasBoletoParaEmail(vendaBase)
      : []
    const totalBoletos = parcelasBoleto.length
    const anexosBoleto = parcelasBoleto.map((parcela, indice) => {
      const origem = separarPdfBase64OuUrl(parcela.boletoPdfBase64 || parcela.boletoPdfUrl || parcela.linkBoleto || '')
      return {
        tipo: 'boleto',
        identificador: `parcela-${parcela.numero || indice + 1}`,
        numeroParcela: Number(parcela.numero || indice + 1),
        nomeArquivo: nomesAnexos.boleto(Number(parcela.numero || indice + 1), totalBoletos, String(parcela.vencimento || '')),
        conteudoBase64: origem.conteudoBase64,
        url: origem.url,
        gerarNoBackend: false,
      }
    })

    const anexos = [
      { tipo: 'notaFiscal', nomeArquivo: nomesAnexos.notaFiscal, conteudoBase64: danfeOrigem.conteudoBase64, url: danfeOrigem.url, gerarNoBackend: true },
      ...anexosBoleto,
    ]

    return {
      remetente: EMPRESA_EMAIL_FINANCEIRO,
      destinatario: emailDestino,
      copia: emailsCopiaNormalizados(),
      cc: emailsCopiaNormalizados(),
      emailCliente: emailDestino,
      clienteEmail: emailDestino,
      nomeCliente: vendaBase.clienteNome || '',
      clienteNome: vendaBase.clienteNome || '',
      clienteDocumento: vendaBase.clienteDocumento || '',
      clienteTelefone: vendaBase.clienteTelefone || '',
      numeroPedido: vendaBase.numeroPedido || vendaBase.id || '',
      numeroNotaFiscal: vendaBase.numeroNotaFiscal || '',
      valorTotal: Number(vendaBase.totalFinal || totais.totalFinal || 0),
      totalFinal: Number(vendaBase.totalFinal || totais.totalFinal || 0),
      dataEmissao: vendaBase.dataEmissao || '',
      dataEmissaoNotaFiscal: vendaBase.dataEmissaoNotaFiscal || '',
      assunto: montarAssuntoEmailNotaBoleto(vendaBase),
      texto: montarTextoEmailNotaBoleto(vendaBase),
      html: montarHtmlEmailNotaBoleto(vendaBase),
      logo: { cid: 'logoSynergias', caminhoPublico: SYNERGIAS_ERP_LOGO },
      anexos,
      versaoFluxoEmail: SYNERGIAS_EMAIL_MULTIPLOS_BOLETOS_PIX_TRANSFERENCIA_V310,
      modoPagamentoEmail: pagamento.ehBoleto ? 'boleto' : pagamento.ehPix ? 'pix' : 'transferencia',
      quantidadeBoletosEsperada: pagamento.ehBoleto ? totalBoletos : 0,
      boletoOpcional: !pagamento.ehBoleto,
      exigirBoletoAnexo: pagamento.ehBoleto,
      cliente: { nome: vendaBase.clienteNome || '', razaoSocial: vendaBase.clienteNome || '', email: emailDestino, documento: vendaBase.clienteDocumento || '', telefone: vendaBase.clienteTelefone || '' },
      pedido: { ...vendaBase, clienteNome: vendaBase.clienteNome || '', nomeCliente: vendaBase.clienteNome || '', clienteEmail: emailDestino, emailCliente: emailDestino, clienteDocumento: vendaBase.clienteDocumento || '', clienteTelefone: vendaBase.clienteTelefone || '', numeroNotaFiscal: vendaBase.numeroNotaFiscal || '', numeroPedido: vendaBase.numeroPedido || vendaBase.id || '', totalFinal: Number(vendaBase.totalFinal || totais.totalFinal || 0) },
    }
  }

  function montarVendaComEnvioRegistrado(vendaBase: Venda): Venda {
    const dataEnvio = hoje()
    const horarioEnvio = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    return {
      ...vendaBase,
      notaBoletoEnviados: true,
      dataEnvioNotaBoleto: dataEnvio,
      canalEnvio: 'E-mail',
      ...(contaCobrancaAtraso ? {
        ultimaCobrancaAtrasoEm: new Date().toISOString(),
        ultimaCobrancaAtrasoContaId: contaCobrancaAtraso.id,
      } : {}),
      emailsCopiaEnvio: emailsCopiaNormalizados(),
      statusBoleto:
        vendaBase.statusBoleto === 'Gerado' ? 'Enviado' : vendaBase.statusBoleto,
      parcelas: (vendaBase.parcelas || []).map((parcela: ParcelaVenda) => ({
        ...parcela,
        statusBoleto:
          parcela.statusBoleto === 'Gerado' &&
          (!contaCobrancaAtraso || Number(parcela.numero) === Number(contaCobrancaAtraso.parcelaNumero))
            ? 'Enviado'
            : parcela.statusBoleto,
        dataEnvioBoleto:
          parcela.statusBoleto === 'Gerado' &&
          (!contaCobrancaAtraso || Number(parcela.numero) === Number(contaCobrancaAtraso.parcelaNumero))
            ? dataEnvio
            : parcela.dataEnvioBoleto,
        horarioEnvioBoleto:
          parcela.statusBoleto === 'Gerado' &&
          (!contaCobrancaAtraso || Number(parcela.numero) === Number(contaCobrancaAtraso.parcelaNumero))
            ? horarioEnvio
            : parcela.horarioEnvioBoleto,
      })),
    }
  }

  const SYNERGIAS_EMAIL_BOLETO_OPCIONAL_V229 = 'SYNERGIAS_EMAIL_BOLETO_OPCIONAL_V229'
  const SYNERGIAS_EMAIL_MULTIPLOS_BOLETOS_PIX_TRANSFERENCIA_V310 =
    'SYNERGIAS_EMAIL_MULTIPLOS_BOLETOS_PIX_TRANSFERENCIA_V310'

  async function enviarNotaBoleto() {
    void SYNERGIAS_EMAIL_BOLETO_OPCIONAL_V229
    void SYNERGIAS_EMAIL_MULTIPLOS_BOLETOS_PIX_TRANSFERENCIA_V310
    const vendaBase = await salvarEmailsFormaEnvioNoCliente(true)
    if (!vendaBase) return

    const emailDestino = String(
      vendaBase.clienteEmailNotaFiscal || vendaBase.clienteEmail || '',
    ).trim()

    if (!vendaBase.clienteNome) {
      alert('Selecione um cliente antes de enviar a nota fiscal e o boleto.')
      return
    }

    if (!emailDestino) {
      alert('O cliente selecionado não possui e-mail cadastrado. Cadastre o e-mail do cliente antes de enviar.')
      return
    }

    const pagamentoEmail = identificarPagamentoEmail(vendaBase)
    if (!pagamentoEmail.ehBoleto && !pagamentoEmail.ehPix && !pagamentoEmail.ehTransferencia) {
      alert('Selecione BOLETO, PIX ou TRANSFERÊNCIA como forma de pagamento antes de enviar o e-mail.')
      return
    }
    if ((pagamentoEmail.ehPix || pagamentoEmail.ehTransferencia) && !obterDadosPagamentoEmail(vendaBase)) {
      alert('A conta bancária escolhida para PIX ou transferência não foi identificada. Selecione a conta de recebimento no pedido antes de enviar.')
      return
    }
    const quantidadeBoletos = pagamentoEmail.ehBoleto
      ? parcelasBoletoParaEmail(vendaBase).length
      : 0
    const documentosConfirmacao = pagamentoEmail.ehPix
      ? 'Nota Fiscal, XML autorizado e dados para pagamento via PIX no corpo do e-mail'
      : pagamentoEmail.ehTransferencia
        ? 'Nota Fiscal, XML autorizado e dados para transferência bancária no corpo do e-mail'
        : contaCobrancaAtraso
          ? 'Nota Fiscal e boleto vencido'
          : `Nota Fiscal, XML autorizado e ${quantidadeBoletos} boleto${quantidadeBoletos === 1 ? '' : 's'} anexado${quantidadeBoletos === 1 ? '' : 's'}`

    const confirmar = window.confirm(
      `Enviar ${documentosConfirmacao} para:\n\n${emailDestino}\n\nRemetente: ${EMPRESA_EMAIL_FINANCEIRO}`,
    )

    if (!confirmar) return

    try {
      const vendaComBoleto = pagamentoEmail.ehBoleto
        ? await garantirPdfBoletoAntesDoEnvio(vendaBase)
        : vendaBase
      const danfeAtualBase64 = await gerarDanfeAtualDoSistemaParaEmail(vendaComBoleto)
      const payload = montarPayloadEmailNotaBoleto(
        vendaComBoleto,
        emailDestino,
        danfeAtualBase64,
      )
      const resposta = await fetch(API_ENVIO_NOTA_BOLETO, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!resposta.ok) {
        let mensagemErro = 'Não foi possível enviar o e-mail pelo sistema.'

        try {
          const retorno = await resposta.json()
          mensagemErro = retorno?.message || retorno?.erro || mensagemErro
        } catch {
          mensagemErro = `${mensagemErro} Verifique a API de envio.`
        }

        throw new Error(mensagemErro)
      }

      const vendaAtualizada = montarVendaComEnvioRegistrado(vendaBase)

      salvarVendaStorage(vendaAtualizada)
      setVenda(vendaAtualizada)

      alert(pagamentoEmail.ehPix
        ? 'E-mail de PIX enviado com a Nota Fiscal, o XML, os dados bancários e os vencimentos.'
        : pagamentoEmail.ehTransferencia
          ? 'E-mail de transferência enviado com a Nota Fiscal, o XML, os dados bancários e os vencimentos.'
          : `E-mail de boleto enviado com a Nota Fiscal, o XML e ${quantidadeBoletos} boleto${quantidadeBoletos === 1 ? '' : 's'} anexado${quantidadeBoletos === 1 ? '' : 's'}.`)
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar o e-mail pelo sistema.'

      alert(`${mensagem}\n\nO envio online não foi concluído. Verifique a configuração privada de e-mail do servidor.`)
    }
  }

  // SYNERGIAS_NF_SIMPLIFICADA_POPUP_FIREFOX_V230
  function abrirNotaFiscalSimplificada() {
    if (venda.statusNotaFiscal !== 'Autorizada' && venda.statusNotaFiscal !== 'Emitida') {
      alert('A NF Simplificada só fica disponível depois que a NF-e estiver emitida ou autorizada.')
      return
    }

    const chave = somenteNumerosCredito(venda.chaveAcessoNotaFiscal || '')
    if (chave.length !== 44) {
      alert('A chave de acesso com 44 dígitos não está vinculada a esta NF-e.')
      return
    }

    const fiscal = obterConfiguracaoFiscalStorage()
    const documentoDestinatario = somenteNumerosCredito(venda.clienteDocumento || '')
    const formatarDocumento = (valor: string) => {
      if (valor.length === 14) return valor.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
      if (valor.length === 11) return valor.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
      return valor || '-'
    }
    const escaparHtml = (valor: unknown) => String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    const barras = chave.split('').map((digito, indice) => {
      const largura = 1 + ((Number(digito) + indice) % 3)
      const margem = (Number(digito) + indice) % 2
      return `<i style="display:block;width:${largura}px;height:52px;background:#000;margin-right:${margem}px"></i>`
    }).join('')

    const enderecoEmitente = [
      fiscal.logradouro,
      fiscal.numero,
      fiscal.complemento,
      fiscal.bairro,
      fiscal.municipio,
    ].filter(Boolean).join(', ')

    const dataHoraEmissao = formatarDataBrasil(venda.dataEmissaoNotaFiscal || venda.dataEmissao || hoje())
    const conteudo = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>NF Simplificada ${escaparHtml(venda.numeroNotaFiscal || '')}</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}
  .pagina{width:210mm;min-height:297mm;padding:16mm 18mm}
  .etiqueta{width:142mm;margin:0 auto;border:1.5px solid #111;font-size:10px}
  .linha{display:flex;border-bottom:1px solid #111}.linha:last-child{border-bottom:0}
  .celula{padding:5px 7px;min-height:31px;flex:1;border-right:1px solid #111}.celula:last-child{border-right:0}
  .titulo{text-align:center;font-size:13px;font-weight:700;padding:8px;border-bottom:1px solid #111}
  .rotulo{display:block;font-size:8px;font-weight:700;margin-bottom:3px}.valor{font-size:10px;font-weight:600}
  .chave{text-align:center;font-size:10px;letter-spacing:.7px;margin:2px 0 5px}.barcode{height:55px;display:flex;justify-content:center;align-items:stretch;overflow:hidden}
  .emitente{display:grid;grid-template-columns:22mm 1fr;min-height:40mm;border-bottom:1px solid #111}.logo{display:flex;align-items:center;justify-content:center;border-right:1px solid #111;padding:4px}.logo img{max-width:18mm;max-height:18mm}.dados{padding:6px 8px;line-height:1.35}
  .destinatario{text-align:center;font-size:12px;font-weight:700;padding:8px;border-bottom:1px solid #111}
  .total{font-size:13px;text-align:right;padding-top:10px}.rodape{font-size:8px;text-align:center;margin-top:6px;color:#444}
  @media print{.pagina{padding:8mm 0}.etiqueta{margin-top:0}.rodape{display:none}}
</style>
</head>
<body>
<div class="pagina">
  <section class="etiqueta">
    <div class="titulo">DANFE Simplificado - Etiqueta</div>
    <div class="celula" style="border-right:0;border-bottom:1px solid #111">
      <span class="rotulo">CHAVE DE ACESSO:</span>
      <div class="chave">${escaparHtml(chave)}</div>
      <div class="barcode">${barras}</div>
    </div>
    <div class="emitente">
      <div class="logo"><img src="${SYNERGIAS_ERP_LOGO}" alt="Synergias" /></div>
      <div class="dados">
        <strong>NOME/RAZÃO SOCIAL: ${escaparHtml(fiscal.razaoSocial || 'SYNERGIAS SL COMERCIO LTDA ME')}</strong><br/>
        CNPJ: ${escaparHtml(formatarDocumento(somenteNumerosCredito(fiscal.cnpj || '50432175000146')))}<br/>
        IE: ${escaparHtml(fiscal.inscricaoEstadual || '0963961942')} &nbsp;&nbsp; UF: ${escaparHtml(fiscal.uf || 'RS')}<br/>
        ENDEREÇO: ${escaparHtml(enderecoEmitente || 'AVENIDA FREI HENRIQUE DE COIMBRA, 11')}<br/>
        CEP: ${escaparHtml(fiscal.cep || '91370-180')} &nbsp;&nbsp; TEL: ${escaparHtml(fiscal.telefone || '(51) 98264-2434')}
      </div>
    </div>
    <div class="linha">
      <div class="celula"><span class="rotulo">NF-e</span><span class="valor">Nº ${escaparHtml(venda.numeroNotaFiscal || '-')}<br/>Série: ${escaparHtml(venda.serieNotaFiscal || '1')}</span></div>
      <div class="celula" style="max-width:40mm;text-align:center"><span class="rotulo">TIPO</span><span class="valor">1 - Saída</span></div>
      <div class="celula"><span class="rotulo">DATA E HORA DA EMISSÃO</span><span class="valor">${escaparHtml(dataHoraEmissao)}</span></div>
    </div>
    <div class="destinatario">DESTINATÁRIO</div>
    <div class="celula" style="border-right:0;border-bottom:1px solid #111"><span class="rotulo">NOME/RAZÃO SOCIAL:</span><span class="valor">${escaparHtml(venda.clienteNome || '-')}</span></div>
    <div class="linha">
      <div class="celula"><span class="rotulo">CNPJ/CPF/ID:</span><span class="valor">${escaparHtml(formatarDocumento(documentoDestinatario))}</span></div>
      <div class="celula"><span class="rotulo">INSCRIÇÃO ESTADUAL:</span><span class="valor">${escaparHtml(venda.clienteIeRg || '')}</span></div>
      <div class="celula" style="max-width:28mm"><span class="rotulo">UF:</span><span class="valor">${escaparHtml(venda.faturamentoEstado || venda.entregaEstado || '-')}</span></div>
    </div>
    <div class="celula total" style="border-right:0"><span class="rotulo" style="float:left">VALOR TOTAL DA NOTA:</span><strong>${escaparHtml(dinheiro(totais.totalFinal))}</strong></div>
  </section>
  <div class="rodape">Documento auxiliar simplificado da NF-e. Consulte a validade pela chave de acesso.</div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350))</script>
</body>
</html>`

    // Não usar `noopener` na chamada: Firefox pode abrir a janela e retornar null,
    // causando um falso aviso de bloqueio. Desvinculamos o opener depois.
    const janela = window.open('', '_blank', 'width=980,height=800')
    if (!janela) {
      alert('O navegador bloqueou a abertura da NF Simplificada. Permita pop-ups para este ERP.')
      return
    }
    try {
      janela.opener = null
    } catch {
      // A janela já foi aberta; falha ao limpar opener não impede a impressão.
    }
    janela.document.open()
    janela.document.write(conteudo)
    janela.document.close()
  }

  function abrirDocumentoFiscal(valor?: string, nome = 'documento fiscal') {
    const documento = String(valor || '').trim()
    if (!documento) {
      alert(`${nome} ainda não está disponível. A ação fiscal precisa retornar e vincular o arquivo real ao pedido.`)
      return
    }
    if (documento.startsWith('data:application/pdf;base64,') || /^[A-Za-z0-9+/=\r\n]+$/.test(documento)) {
      abrirPdfBase64(documento, nome)
      return
    }
    window.open(documento, '_blank', 'noopener,noreferrer')
  }

  function consultarNotaFiscal() {
    if (!venda.numeroNotaFiscal) {
      alert('Nota fiscal não emitida. A consulta fiscal será habilitada quando houver uma NF vinculada ao pedido.')
      return
    }
    alert(
      `NF-e nº ${venda.numeroNotaFiscal}\n` +
        `Série: ${venda.serieNotaFiscal || '1'}\n` +
        `Status: ${venda.statusNotaFiscal || 'Pendente'}\n` +
        `Ambiente: ${venda.ambienteNotaFiscal || 'HOMOLOGACAO'}\n` +
        `Chave: ${venda.chaveAcessoNotaFiscal || 'não informada'}\n` +
        `Protocolo: ${venda.protocoloNotaFiscal || 'não informado'}\n` +
        (venda.cStatNotaFiscal ? `cStat: ${venda.cStatNotaFiscal}` : ''),
    )
  }

  function editarDadosNotaFiscal() {
    setMostrarEdicaoFiscal(true)
  }

  async function salvarEdicaoFiscal() {
    const documento = somenteNumerosCredito(venda.clienteDocumento || '')
    if (![11, 14].includes(documento.length)) {
      alert('Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.')
      return
    }
    const vendaCorrigida: Venda = {
      ...venda,
      clienteDocumento: documento,
      clienteIndicadorIE: venda.clienteIndicadorIE || (somenteNumerosCredito(venda.clienteIeRg || '') ? '1' : '9'),
      clienteIeRg: venda.clienteIndicadorIE === '9' ? '' : venda.clienteIeRg,
    }
    const totalAtual = calcularTotais(vendaCorrigida)
    const atualizada: Venda = { ...vendaCorrigida, subtotal: totalAtual.subtotal, totalFinal: totalAtual.totalFinal }
    salvarVendaStorage(atualizada)
    setVenda(atualizada)

    const clienteAtual = localizarClienteAtualParaDocumento(atualizada)
    if (clienteAtual) {
      const clienteSalvo = {
        ...clienteAtual,
        tipoPessoa: documento.length === 14 ? 'Jurídica' : 'Física',
        cnpj: documento.length === 14 ? documento : '',
        cpf: documento.length === 11 ? documento : '',
        documento,
        cpfCnpj: documento,
        cnpjCpf: documento,
        inscricaoEstadual: atualizada.clienteIndicadorIE === '9' ? '' : atualizada.clienteIeRg,
        indicadorIE: atualizada.clienteIndicadorIE || (somenteNumerosCredito(atualizada.clienteIeRg || '') ? '1' : '9'),
        email: atualizada.clienteEmailNotaFiscal || atualizada.clienteEmail,
        emailNotaFiscal: atualizada.clienteEmailNotaFiscal || atualizada.clienteEmail,
        telefone: atualizada.clienteTelefone,
        cep: atualizada.faturamentoCep,
        endereco: atualizada.faturamentoEndereco,
        numero: atualizada.faturamentoNumero,
        complemento: atualizada.faturamentoComplemento,
        bairro: atualizada.faturamentoBairro,
        cidade: atualizada.faturamentoCidade,
        estado: atualizada.faturamentoEstado,
        codigoIbgeMunicipio: atualizada.faturamentoCodigoIbge,
      } as Cliente
      const clientesAtualizados = salvarClienteStorage(clienteSalvo)
      setClientes(clientesAtualizados)
      try {
        await salvarClientesStorageConfirmado(clientesAtualizados)
      } catch (erro) {
        console.error('[Synergias ERP] Falha ao confirmar dados fiscais do cliente no servidor.', erro)
        alert('Os dados foram atualizados nesta tela, mas o servidor não confirmou a gravação. Tente salvar novamente antes de emitir.')
        return
      }
    }

    setMostrarEdicaoFiscal(false)
    alert('Dados fiscais do destinatário salvos no pedido e no cadastro do cliente.')
  }

  function registrarHistoricoFiscalLocal(status: Venda['statusNotaFiscal'], motivo: string) {
    return [
      ...(venda.historicoNotaFiscal || []),
      {
        id: `nfe-local-${Date.now()}`,
        ambiente: venda.ambienteNotaFiscal || 'HOMOLOGACAO',
        status: status || 'Pendente',
        numero: venda.numeroNotaFiscal,
        serie: venda.serieNotaFiscal,
        chaveAcesso: venda.chaveAcessoNotaFiscal,
        protocolo: venda.protocoloNotaFiscal,
        cStat: venda.cStatNotaFiscal,
        motivo,
        xml: venda.xmlNotaFiscal,
        criadoEm: new Date().toISOString(),
      },
    ]
  }

  function limparTentativaFiscal(motivo: string) {
    const atualizada: Venda = {
      ...montarPedidoAtualizado(),
      statusNotaFiscal: 'Pendente',
      numeroNotaFiscal: '',
      serieNotaFiscal: '',
      chaveAcessoNotaFiscal: '',
      protocoloNotaFiscal: '',
      dataEmissaoNotaFiscal: '',
      xmlNotaFiscal: '',
      danfePdf: '',
      motivoRejeicaoNotaFiscal: '',
      cStatNotaFiscal: '',
      historicoNotaFiscal: registrarHistoricoFiscalLocal('Descartada', motivo),
    }
    salvarVendaStorage(atualizada)
    setVenda(atualizada)
  }

  function corrigirNotaFiscal() {
    if (venda.statusNotaFiscal === 'Rejeitada' || venda.statusNotaFiscal === 'Erro na emissão') {
      limparTentativaFiscal('Tentativa liberada para correção e reenvio.')
      document.getElementById('pedido-dados-cliente')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      alert('A tentativa rejeitada foi preservada no histórico. Corrija os dados do Pedido e transmita novamente em produção.')
      return
    }
    alert('Uma NF-e autorizada não pode ser editada livremente. Use Carta de Correção para campos permitidos ou cancelamento fiscal quando for necessário emitir uma nova nota.')
  }

  function prepararCartaCorrecao() {
    if (venda.statusNotaFiscal !== 'Autorizada' && venda.statusNotaFiscal !== 'Emitida') {
      alert('Carta de Correção só pode ser criada para uma NF-e autorizada pela SEFAZ.')
      return
    }
    const texto = window.prompt('Descreva a correção. Não informe valores, quantidades, impostos, destinatário ou dados que alterem a operação:')
    if (!texto?.trim()) return
    const atualizada: Venda = {
      ...montarPedidoAtualizado(),
      cartaCorrecaoRascunho: texto.trim(),
      cartaCorrecaoCriadaEm: new Date().toISOString(),
    }
    salvarVendaStorage(atualizada)
    setVenda(atualizada)
    alert('Rascunho de Carta de Correção salvo. Ele ainda não foi transmitido à SEFAZ; a transmissão ficará disponível quando o endpoint de evento fiscal estiver habilitado.')
  }

  function baixarXmlNotaFiscal() {
    const xml = String(venda.xmlNotaFiscal || '').trim()
    if (!xml) return alert('O XML real da NF-e ainda não está vinculado ao pedido.')
    let conteudoXml = xml
    if (!xml.startsWith('<') && /^[A-Za-z0-9+/=\r\n]+$/.test(xml)) {
      try { conteudoXml = decodeURIComponent(escape(atob(xml.replace(/\s+/g, '')))) } catch { conteudoXml = '' }
    }
    if (conteudoXml.startsWith('<')) {
      const url = URL.createObjectURL(new Blob([conteudoXml], { type: 'application/xml;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `NFe_${venda.numeroNotaFiscal || venda.numeroPedido || venda.id}.xml`
      link.click()
      URL.revokeObjectURL(url)
      return
    }
    window.open(xml, '_blank', 'noopener,noreferrer')
  }

  function recuperarIdentificacaoFiscalParaCancelamento() {
    const vendaFiscal = venda as Venda & Record<string, any>
    const historico = Array.isArray(venda.historicoNotaFiscal)
      ? [...venda.historicoNotaFiscal].reverse()
      : []
    const evento = historico.find((item: any) =>
      String(item?.numero || '') === String(venda.numeroNotaFiscal || '')
      && ['AUTORIZADA', 'EMITIDA'].includes(String(item?.status || '').toUpperCase())
    ) || historico.find((item: any) => item?.chaveAcesso || item?.protocolo)

    let chave = String(
      venda.chaveAcessoNotaFiscal
      || vendaFiscal.chaveAcesso
      || vendaFiscal.chaveNFe
      || vendaFiscal.chaveNfe
      || evento?.chaveAcesso
      || '',
    ).replace(/\D/g, '')
    let protocolo = String(
      venda.protocoloNotaFiscal
      || vendaFiscal.protocoloAutorizacao
      || vendaFiscal.protocoloNFe
      || vendaFiscal.protocoloNfe
      || evento?.protocolo
      || '',
    ).trim()

    let xml = String(venda.xmlNotaFiscal || evento?.xml || '').trim()
    if (xml && !xml.includes('<')) {
      try {
        xml = decodeURIComponent(escape(atob(xml.replace(/^data:[^,]+,/, '').replace(/\s+/g, ''))))
      } catch {
        xml = ''
      }
    }
    if (xml.includes('<')) {
      const chaveXml = xml.match(/<chNFe>(\d{44})<\/chNFe>/i)?.[1]
        || xml.match(/Id=["']NFe(\d{44})["']/i)?.[1]
      const protocoloXml = xml.match(/<nProt>([^<]+)<\/nProt>/i)?.[1]
      if (chave.length !== 44 && chaveXml) chave = chaveXml
      if (!protocolo && protocoloXml) protocolo = protocoloXml.trim()
    }

    return { chave, protocolo }
  }

  async function cancelarNotaFiscal() {
    if (venda.statusNotaFiscal === 'Rejeitada' || venda.statusNotaFiscal === 'Erro na emissão') {
      if (!window.confirm('Descartar esta tentativa rejeitada e liberar o Pedido para uma nova emissão? O histórico técnico será preservado.')) return
      limparTentativaFiscal('Tentativa rejeitada descartada pelo usuário.')
      alert('Tentativa descartada. O Pedido está liberado para corrigir e reenviar.')
      return
    }
    if (venda.statusNotaFiscal !== 'Autorizada' && venda.statusNotaFiscal !== 'Emitida') {
      alert('Não existe NF-e autorizada para cancelar.')
      return
    }

    const { chave, protocolo } = recuperarIdentificacaoFiscalParaCancelamento()
    if (chave.length !== 44 || !protocolo) {
      alert('Não foi possível recuperar a chave e o protocolo desta NF-e. Use “Consultar” ou importe novamente o XML autorizado antes de cancelar.')
      return
    }

    if (chave !== String(venda.chaveAcessoNotaFiscal || '').replace(/\D/g, '') || protocolo !== String(venda.protocoloNotaFiscal || '').trim()) {
      const recuperada: Venda = {
        ...venda,
        chaveAcessoNotaFiscal: chave,
        protocoloNotaFiscal: protocolo,
      }
      salvarVendaStorage(recuperada)
      setVenda(recuperada)
    }

    const justificativa = window.prompt(
      'Informe a justificativa do cancelamento (mínimo 15 e máximo 255 caracteres):',
      'NF-e emitida incorretamente. Operação não realizada.',
    )
    if (justificativa === null) return
    const motivo = justificativa.trim()
    if (motivo.length < 15 || motivo.length > 255) {
      alert('A justificativa deve ter entre 15 e 255 caracteres.')
      return
    }

    const ambiente = venda.ambienteNotaFiscal === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO'
    const confirma = window.confirm(
      `Confirma o envio do cancelamento da NF-e nº ${venda.numeroNotaFiscal || ''}, série ${venda.serieNotaFiscal || '1'}, para a SEFAZ em ${ambiente}?`,
    )
    if (!confirma) return

    try {
      const response = await fetch('/api/fiscal/nfe-cancelamento.php', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chaveAcesso: chave, protocoloAutorizacao: protocolo, justificativa: motivo, ambiente }),
      })
      const raw = await response.text()
      let data: any = {}
      try { data = raw ? JSON.parse(raw) : {} } catch { throw new Error('A SEFAZ retornou uma resposta inválida no cancelamento.') }
      if (!response.ok || data?.ok !== true || data?.cancelada !== true) {
        throw new Error(data?.mensagem || data?.motivo || `Cancelamento não autorizado. HTTP ${response.status}.`)
      }

      const agora = data.recebidoEm || new Date().toISOString()
      const atualizada = {
        ...montarPedidoAtualizado(),
        statusNotaFiscal: 'Cancelada',
        cStatNotaFiscal: String(data.cStat || '135'),
        motivoRejeicaoNotaFiscal: '',
        historicoNotaFiscal: [
          ...(venda.historicoNotaFiscal || []),
          {
            id: `nfe-cancelamento-${Date.now()}`,
            ambiente,
            status: 'Cancelada',
            numero: String(venda.numeroNotaFiscal || ''),
            serie: String(venda.serieNotaFiscal || '1'),
            chaveAcesso: chave,
            protocolo: String(data.protocolo || ''),
            cStat: String(data.cStat || ''),
            motivo: String(data.motivo || 'Cancelamento homologado'),
            xml: String(data.xmlEventoBase64 || ''),
            criadoEm: agora,
          },
        ],
      } as Venda
      salvarVendaStorage(atualizada)
      setVenda(atualizada)
      alert(`NF-e cancelada com sucesso pela SEFAZ.\nProtocolo: ${data.protocolo || 'não informado'}`)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível cancelar a NF-e.')
    }
  }

  function agendarWhatsapp() {
    const telefone = String(venda.clienteTelefone || '').trim()
    if (!telefone) return alert('O cliente não possui telefone/WhatsApp cadastrado.')
    if (modoEnvioWhatsapp === 'agendar' && (!dataEnvioWhatsappAgendado || !horaEnvioWhatsappAgendado)) {
      return alert('Informe a data e o horário do agendamento.')
    }

    if (modoEnvioWhatsapp === 'agendar') {
      const agendadoPara = `${dataEnvioWhatsappAgendado}T${horaEnvioWhatsappAgendado}`
      const atualizada: Venda = {
        ...montarPedidoAtualizado(),
        canalEnvio: 'WhatsApp',
        statusEnvioWhatsapp: 'Agendado',
        whatsappAgendadoPara: agendadoPara,
        dataEnvioWhatsapp: dataEnvioWhatsappAgendado,
        horarioEnvioWhatsapp: horaEnvioWhatsappAgendado,
      }
      salvarVendaStorage(atualizada)
      setVenda(atualizada)
      alert('Agendamento salvo. O disparo automático só será executado quando o canal oficial do WhatsApp estiver conectado ao backend do Synergias.')
      return
    }

    alert('O envio automático pelo WhatsApp Web não será simulado. Conecte o canal oficial do WhatsApp ao backend para habilitar Enviar agora.')
  }

  function abrirLista() {
    navigate('/vendas')
  }

  function enviarEmail() {
    salvarVendaStorage(montarPedidoAtualizado())

    const assunto = encodeURIComponent(
      `Pedido Synergias nº ${venda.numeroPedido || ''}`,
    )

    const tipoPagamentoEmail = String(venda.tipoCobranca || venda.formaPagamento || '').toLowerCase()
    const ehPix = tipoPagamentoEmail.includes('pix')
    const ehTransferencia = tipoPagamentoEmail.includes('transfer')
    const dadosPagamentoEmail = montarTextoDadosBancarios(venda.tipoCobranca)
    const instrucaoPagamento = ehPix
      ? `\n\nForma de pagamento: PIX.${dadosPagamentoEmail ? `\n${dadosPagamentoEmail}` : ''}`
      : ehTransferencia
        ? `\n\nForma de pagamento: transferência bancária.${dadosPagamentoEmail ? `\n${dadosPagamentoEmail}` : ''}`
        : ''
    const corpo = encodeURIComponent(
      `Olá,

Segue pedido da Synergias Distribuidora para análise.

Cliente: ${venda.clienteNome || '-'}
Valor total: ${dinheiro(totais.totalFinal)}${instrucaoPagamento}

Atenciosamente,
Synergias Distribuidora`,
    )

    window.location.href = `mailto:?subject=${assunto}&body=${corpo}`
  }
  function imprimirPedido() {
    const pedidoAtual = montarPedidoAtualizado()
    const pedidoPdf = pedidoAtual as any
    salvarVendaStorage(pedidoAtual)

    const escapar = (valor: unknown) => String(valor ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    const dataBr = (valor: unknown) => {
      const texto = String(valor ?? '').trim()
      if (!texto) return '-'
      const partes = texto.slice(0, 10).split('-')
      return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : texto
    }
    const moedaPdf = (valor: unknown) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const numeroPdf = (valor: unknown) => Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const endereco = (logradouro: unknown, numero: unknown, complemento: unknown, bairro: unknown, cidade: unknown, uf: unknown, cep: unknown) =>
      [[logradouro, numero].filter(Boolean).join(', '), complemento, [bairro, cidade, uf].filter(Boolean).join(' - '), cep ? `CEP: ${cep}` : ''].filter(Boolean).join(' - ') || '-'

    const enderecoFaturamento = endereco(
      pedidoPdf.faturamentoEndereco || pedidoPdf.enderecoFaturamento || pedidoPdf.clienteEndereco,
      pedidoPdf.faturamentoNumero || pedidoPdf.clienteNumero,
      pedidoPdf.faturamentoComplemento || pedidoPdf.clienteComplemento,
      pedidoPdf.faturamentoBairro || pedidoPdf.clienteBairro,
      pedidoPdf.faturamentoCidade || pedidoPdf.clienteCidade,
      pedidoPdf.faturamentoEstado || pedidoPdf.clienteEstado,
      pedidoPdf.faturamentoCep || pedidoPdf.clienteCep,
    )
    const enderecoEntrega = endereco(
      pedidoPdf.entregaEndereco || pedidoPdf.enderecoEntrega,
      pedidoPdf.entregaNumero,
      pedidoPdf.entregaComplemento,
      pedidoPdf.entregaBairro,
      pedidoPdf.entregaCidade,
      pedidoPdf.entregaEstado,
      pedidoPdf.entregaCep,
    )

    const linhasItens = (pedidoPdf.itens || []).map((item: any) => {
      const totalLinha = recalcularItemPedido(item as ItemVenda).valorTotal
      return `<tr><td class="codigo">${escapar(item.codigoBarras || '-')}</td><td class="descricao">${escapar(item.descricao || '-')}${item.observacaoItem ? `<div class="item-obs">${escapar(item.observacaoItem)}</div>` : ''}</td><td class="centro">${escapar(item.unidade || 'Unidade')}</td><td class="centro">${numeroPdf(item.quantidade)}</td><td class="centro">${moedaPdf(item.valorUnitario)}</td><td class="centro">${moedaPdf(item.descontoValor ?? item.desconto ?? 0)}</td><td class="centro">${moedaPdf(totalLinha)}</td></tr>`
    }).join('')

    const pagamentos = Array.isArray(pedidoPdf.parcelas) && pedidoPdf.parcelas.length ? pedidoPdf.parcelas : (Array.isArray(pedidoPdf.pagamentos) ? pedidoPdf.pagamentos : [])
    const linhasPagamento = pagamentos.map((pagamento: any, index: number) => {
      const descricao = pagamento.descricao || pagamento.formaPagamento || pedidoPdf.formaPagamento || '-'
      const prazo = pagamento.prazo || pedidoPdf.condicaoPagamento || pedidoPdf.prazoPagamento || ''
      return `<tr><td>${escapar(descricao)}${prazo ? ` (${escapar(prazo)})` : ''} [${index + 1}/${pagamentos.length}]</td><td>${dataBr(pagamento.vencimento || pagamento.dataVencimento)}</td><td class="right">${moedaPdf(pagamento.valor)}</td><td>${escapar(pagamento.observacoes || pagamento.observacao || '')}</td></tr>`
    }).join('')

    const subtotalCalculadoPdf = (pedidoPdf.itens || []).reduce(
      (total: number, item: any) => total + recalcularItemPedido(item as ItemVenda).valorTotal,
      0,
    )
    const subtotal = subtotalCalculadoPdf > 0 ? subtotalCalculadoPdf : Number(pedidoPdf.subtotal || 0)
    const desconto = Number(pedidoPdf.descontoTotal ?? pedidoPdf.desconto ?? 0)
    const frete = Number(pedidoPdf.frete || 0)
    const outros = Number(pedidoPdf.outrosCustos ?? pedidoPdf.outros ?? 0)
    const totalFinal = Number(pedidoPdf.totalFinal ?? subtotal - desconto + frete + outros)
    const quantidadeItens = (pedidoPdf.itens || []).reduce((soma: number, item: any) => soma + Number(item.quantidade || 0), 0)
    const numeroNfe = String(pedidoPdf.numeroNotaFiscal || pedidoPdf.numeroNFe || pedidoPdf.notaFiscalNumero || '').trim()
    const nomeArquivo = `Pedido_${pedidoPdf.numeroPedido || pedidoPdf.id || ''}`

    const html = `<!DOCTYPE html><!-- SYNERGIAS_PEDIDO_PDF_FINAL_V203 --><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escapar(nomeArquivo)}</title>
<style>
@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.35}.document-content{width:100%;min-height:277mm;display:flex;flex-direction:column;position:relative}.header{display:flex;align-items:flex-start;justify-content:space-between;gap:7mm;margin-bottom:3mm;min-height:29mm}/* SYNERGIAS_CABECALHO_EMPRESA_DIREITA_V235 */.logo-column{flex:0 0 31mm;width:31mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start}.top-number{width:100%;text-align:center;font-size:11.5px;font-weight:800;line-height:1.2;margin:0 0 1.2mm}/* SYNERGIAS_NUMERO_PEDIDO_MAIOR_V235A */.logo-box{width:28mm;height:26mm;display:flex;align-items:flex-start;justify-content:center}.logo-box img{display:block;width:25mm;max-width:25mm;height:auto;object-fit:contain}.company{flex:1 1 auto;min-width:0;font-size:10px;line-height:1.38;padding-top:0.5mm;margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;text-align:right}.company strong{font-size:12px;line-height:1.2}.section-title{border:0;border-bottom:1.5px solid #8b8b8b;padding:5px 0;margin:4mm 0 2mm;color:#000;font-size:11px;font-weight:900;text-transform:uppercase;page-break-after:avoid}.info-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2mm 5mm;font-size:10px}.info-grid>div:nth-child(4){grid-column:span 2}.address-text{margin-left:9px;white-space:pre-line;line-height:1.35;font-size:10px;min-height:4mm}table{width:100%;border-collapse:separate;border-spacing:0;page-break-inside:auto}tr{page-break-inside:avoid;page-break-after:auto}th{font-size:9px;text-align:left;padding:3px 4px;font-weight:900;border-bottom:1px solid #cbd5e1;color:#000}td{font-size:9px;padding:3px 4px;vertical-align:top;color:#111827}.right{text-align:right;white-space:nowrap}.centro{text-align:center;white-space:nowrap}.itens-pedido{table-layout:fixed}.itens-pedido th,.itens-pedido td{padding-top:3px;padding-bottom:3px}.itens-pedido .codigo{padding-left:0!important;padding-right:.3mm!important;font-size:9px;white-space:nowrap;overflow:visible;text-overflow:clip}.itens-pedido .descricao{text-align:left;padding-left:0!important;padding-right:.5mm!important;font-size:9px!important}.itens-pedido th:first-child{padding-left:0!important;padding-right:.5mm!important}.itens-pedido th:nth-child(2){padding-left:0!important}.itens-pedido th:nth-child(n+3){text-align:center}.itens-pedido td:nth-child(n+3){text-align:center}.item-obs{margin-top:4px;font-size:8px;font-weight:600;color:#475569}.summary-box{margin:3mm 0 2mm auto;width:max-content;max-width:100%;border:1px solid #94a3b8;border-radius:5px;padding:5px 9px;display:flex;justify-content:flex-end;gap:14mm;font-size:10px;font-weight:800}.totals-table{table-layout:fixed}.totals-table th,.totals-table td{width:20%;text-align:center;font-size:9.5px;padding:4px}.total-destaque{display:inline-block;min-width:24mm;border:1px solid #94a3b8;border-radius:4px;padding:6px 8px;font-weight:900;text-align:right}.pagamento-tabela th:nth-child(4),.pagamento-tabela td:nth-child(4){padding-left:28px;white-space:pre-line}.pagamento-tabela th:nth-child(3),.pagamento-tabela td:nth-child(3){padding-right:18px}.section-title-pedido{display:flex;justify-content:space-between;align-items:flex-end;gap:8mm}.section-title-pedido .nfe-inline{margin-left:auto;font-size:11px;font-weight:900;white-space:nowrap;text-transform:none}.fechamento-final{margin-top:auto;padding-top:3mm;border-top:1px solid #cbd5e1;display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;font-size:8px;page-break-inside:avoid}.erp-sign{font-weight:900;font-size:11px}.erp-sign .green{background:#7ac943;color:#fff;padding:1px 4px;border-radius:3px}.erp-sign .script{font-weight:700;color:#111827}@media print{html,body{width:190mm;min-height:277mm;margin:0 auto;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="document-content">
<div class="header"><div class="logo-column"><div class="top-number">Pedido: ${escapar(pedidoPdf.numeroPedido || '-')}</div><div class="logo-box"><img src="${SYNERGIAS_ERP_LOGO}" onerror="this.style.display='none'"></div></div><div class="company"><strong>SYNERGIAS SL COMERCIO LTDA ME</strong><br>SYNERGIAS<br>CNPJ: 50.432.175/0001-46<br>Avenida Frei Henrique de Coimbra, 11<br>91370-180 - Porto Alegre - RS<br>(51) 98264-2434</div></div>
<div class="section-title section-title-pedido"><span>Pedido de venda</span>${numeroNfe ? `<span class="nfe-inline">NF-e nº ${escapar(numeroNfe)}</span>` : ''}</div>
<div class="info-grid"><div>Pedido: <strong>${escapar(pedidoPdf.numeroPedido || '-')}</strong></div><div>Vendedor: <strong>${escapar(pedidoPdf.vendedor || '-')}</strong></div><div>Status: <strong>${escapar(pedidoPdf.statusPedido || pedidoPdf.status || 'Aberto')}</strong></div><div>Cliente: <strong>${escapar(pedidoPdf.clienteNome || '-')}</strong></div><div>CNPJ/CPF: <strong>${escapar(pedidoPdf.clienteDocumento || '-')}</strong></div><div>E-mail: <strong>${escapar(pedidoPdf.clienteEmailNotaFiscal || pedidoPdf.clienteEmail || '-')}</strong></div><div>Emissão: <strong>${dataBr(pedidoPdf.dataEmissao)}</strong></div><div>Entrega: <strong>${dataBr(pedidoPdf.dataEntrega)}</strong></div></div>
<div class="section-title">Endereço de faturamento / cobrança</div><div class="address-text">${escapar(enderecoFaturamento)}</div>
<div class="section-title">Endereço de entrega</div><div class="address-text">${escapar(enderecoEntrega)}</div>
<div data-pdf-ajuste="SYNERGIAS_PDF_PEDIDO_TABELA_UNIFORME_V263" class="section-title">Itens do pedido</div><table class="itens-pedido"><colgroup><col style="width:25mm"><col style="width:77mm"><col style="width:17mm"><col style="width:17mm"><col style="width:18mm"><col style="width:18mm"><col style="width:18mm"></colgroup><thead><tr><th>Código</th><th>Descrição</th><th>Unidade</th><th class="right">Quantidade</th><th class="right">Unitário</th><th class="right">Desconto</th><th class="right">Total</th></tr></thead><tbody>${linhasItens || '<tr><td colspan="7">Nenhum item informado.</td></tr>'}</tbody></table>
<div class="summary-box"><span>Quantidade de Itens: ${numeroPdf(quantidadeItens)}</span><span>Valor total dos itens: ${moedaPdf(subtotal)}</span></div>
<div class="section-title">Valor total do pedido</div><table class="totals-table"><thead><tr><th>Total dos Itens</th><th>Desconto</th><th>Frete</th><th>Outros</th><th class="right">Valor Total</th></tr></thead><tbody><tr><td><strong>${moedaPdf(subtotal)}</strong></td><td><strong>${moedaPdf(desconto)}</strong></td><td><strong>${moedaPdf(frete)}</strong></td><td><strong>${moedaPdf(outros)}</strong></td><td class="right"><span class="total-destaque">${moedaPdf(totalFinal)}</span></td></tr></tbody></table>
<div class="section-title">Forma / Condições de pagamento</div><table class="pagamento-tabela"><thead><tr><th>Descrição</th><th>Vencimento</th><th class="right">Valor</th><th>Observação</th></tr></thead><tbody>${linhasPagamento || '<tr><td colspan="4">Nenhuma condição de pagamento informada.</td></tr>'}</tbody></table>
<div class="fechamento-final"><div>EMITIDO POR <span class="erp-sign">Synergias <span class="green">ERP</span> <span class="script">Sign</span></span></div><div>Impresso em: ${new Date().toLocaleString('pt-BR')}</div></div>
</div></body></html>`

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
    const documentoImpressao = quadroImpressao.contentDocument ?? janelaImpressao?.document
    if (!janelaImpressao || !documentoImpressao) { quadroImpressao.remove(); alert('Não foi possível preparar a impressão. Tente novamente.'); return }
    let impressaoIniciada = false
    const iniciarImpressao = () => {
      if (impressaoIniciada) return
      impressaoIniciada = true
      window.setTimeout(() => { janelaImpressao.focus(); janelaImpressao.print() }, 350)
    }
    janelaImpressao.onafterprint = () => window.setTimeout(() => quadroImpressao.remove(), 300)
    quadroImpressao.onload = iniciarImpressao
    documentoImpressao.open(); documentoImpressao.write(html); documentoImpressao.close(); documentoImpressao.title = nomeArquivo
    window.setTimeout(iniciarImpressao, 900)
  }
  useEffect(() => {
    if (impressaoAutomaticaExecutada.current || typeof window === 'undefined') return

    if (parametroUrlAtual('print') !== '1') return
    if (!id || !venda.numeroPedido) return

    impressaoAutomaticaExecutada.current = true

    const temporizador = window.setTimeout(() => {
      imprimirPedido()
    }, DELAY_IMPRESSAO_AUTOMATICA_PEDIDO_MS)

    return () => window.clearTimeout(temporizador)
  }, [id, venda.numeroPedido, venda.clienteNome, venda.itens.length])

  return (
    <main className="cliente-form-page" data-synergias-pedido-total="V206">
      {/* SYNERGIAS PEDIDO PDF PADRAO ORCAMENTO V197 STYLE INICIO */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          body {
            margin: 0 !important;
          }

          .cliente-form-page {
            font-family: Arial, sans-serif !important;
          }

          /* Cabeçalho do pedido mais compacto */
          .cliente-form-page .orcamento-card,
          .cliente-form-page .pedido-card,
          .cliente-form-page [class*="pedido-cabecalho"],
          .cliente-form-page [class*="orcamento-cabecalho"] {
            margin-bottom: 5px !important;
            padding-top: 6px !important;
            padding-bottom: 6px !important;
          }

          .cliente-form-page label {
            margin-bottom: 2px !important;
          }

          .cliente-form-page input,
          .cliente-form-page select,
          .cliente-form-page textarea {
            min-height: 30px !important;
            height: 30px !important;
            padding-top: 3px !important;
            padding-bottom: 3px !important;
            font-size: 11px !important;
            line-height: 1.1 !important;
          }

          /* Lista de produtos no padrão compacto do orçamento */
          .cliente-form-page table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }

          .cliente-form-page table thead th {
            font-size: 10px !important;
            line-height: 1.05 !important;
            padding: 3px 4px !important;
            vertical-align: middle !important;
          }

          .cliente-form-page table tbody td,
          .cliente-form-page table tbody td strong,
          .cliente-form-page table tbody td small {
            font-size: 12px !important;
            line-height: 1.08 !important;
          }

          .cliente-form-page table tbody td {
            padding: 2px 4px !important;
            vertical-align: middle !important;
          }

          .cliente-form-page table tbody tr {
            min-height: 0 !important;
            height: auto !important;
            line-height: 1.08 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Resumos, pagamento e observações compactos */
          .pedido-pdf-pagamento {
            display: grid !important;
            grid-template-columns: 1.2fr 1.3fr 1fr 1fr !important;
            border: 1px solid #111827 !important;
            margin-top: 4px !important;
            margin-bottom: 4px !important;
            font-size: 11px !important;
            line-height: 1.08 !important;
            break-inside: avoid !important;
          }

          .pedido-pdf-pagamento > div {
            padding: 3px 5px !important;
            border-right: 1px solid #111827 !important;
            min-height: 28px !important;
          }

          .pedido-pdf-pagamento > div:nth-child(4) {
            border-right: 0 !important;
          }

          .pedido-pdf-pagamento-observacao {
            grid-column: 1 / -1 !important;
            border-top: 1px solid #111827 !important;
            border-right: 0 !important;
          }

          .pedido-pdf-pagamento span {
            display: block !important;
            font-size: 8px !important;
            line-height: 1 !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            margin-bottom: 1px !important;
          }

          .pedido-pdf-nfe-final-primeira-pagina {
            display: block !important;
            margin-top: 4px !important;
            padding: 3px 5px !important;
            border-top: 1px solid #111827 !important;
            border-bottom: 1px solid #111827 !important;
            font-size: 11px !important;
            line-height: 1.05 !important;
            text-align: right !important;
            font-weight: 700 !important;
          }

          /* Não altera o layout próprio da NF-e interna e boleto */
          .synergias-erp-nf-print table tbody td,
          .synergias-erp-nf-print table tbody td strong,
          .synergias-erp-nf-print table tbody td small,
          .synergias-erp-boleto-print table tbody td,
          .synergias-erp-boleto-print table tbody td strong,
          .synergias-erp-boleto-print table tbody td small {
            font-size: inherit !important;
            line-height: normal !important;
          }

          .synergias-erp-nf-print input,
          .synergias-erp-nf-print select,
          .synergias-erp-boleto-print input,
          .synergias-erp-boleto-print select {
            height: auto !important;
            min-height: 0 !important;
          }
        }

        @media screen {
          .pedido-pdf-pagamento,
          .pedido-pdf-nfe-final-primeira-pagina {
            display: none !important;
          }
        }
      `}</style>
      {/* SYNERGIAS PEDIDO PDF PADRAO ORCAMENTO V197 STYLE FIM */}
      
      {/* SYNERGIAS PEDIDO PDF V190C STYLE INICIO */}
      <style>{`
        @media print {
          .cliente-form-page table tbody td,
          .cliente-form-page table tbody td strong,
          .cliente-form-page table tbody td small {
            font-size: 12px !important;
            line-height: 1.15 !important;
          }

          .cliente-form-page table tbody td {
            padding-top: 2px !important;
            padding-bottom: 2px !important;
          }

          .cliente-form-page table tbody tr {
            line-height: 1.15 !important;
          }

          .synergias-erp-nf-print table tbody td,
          .synergias-erp-nf-print table tbody td strong,
          .synergias-erp-nf-print table tbody td small,
          .synergias-erp-boleto-print table tbody td,
          .synergias-erp-boleto-print table tbody td strong,
          .synergias-erp-boleto-print table tbody td small {
            font-size: inherit !important;
            line-height: normal !important;
          }

          .synergias-erp-nf-print table tbody td,
          .synergias-erp-boleto-print table tbody td {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }

          .pedido-pdf-pagamento {
            display: grid !important;
            grid-template-columns: 1.3fr 1.3fr 1fr 1fr !important;
            border: 1px solid #111827 !important;
            margin-top: 6px !important;
            margin-bottom: 6px !important;
            font-size: 12px !important;
            line-height: 1.15 !important;
          }

          .pedido-pdf-pagamento > div {
            padding: 5px 6px !important;
            border-right: 1px solid #111827 !important;
            min-height: 34px !important;
          }

          .pedido-pdf-pagamento > div:nth-child(4) {
            border-right: 0 !important;
          }

          .pedido-pdf-pagamento-observacao {
            grid-column: 1 / -1 !important;
            border-top: 1px solid #111827 !important;
            border-right: 0 !important;
          }

          .pedido-pdf-pagamento span {
            display: block !important;
            font-size: 9px !important;
            line-height: 1.1 !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            margin-bottom: 2px !important;
          }

          .pedido-pdf-nfe-final-primeira-pagina {
            display: block !important;
            margin-top: 6px !important;
            padding: 5px 8px !important;
            border-top: 1px solid #111827 !important;
            border-bottom: 1px solid #111827 !important;
            font-size: 12px !important;
            line-height: 1.15 !important;
            text-align: right !important;
            font-weight: 700 !important;
            break-after: page !important;
            page-break-after: always !important;
          }
        }

        @media screen {
          .pedido-pdf-pagamento,
          .pedido-pdf-nfe-final-primeira-pagina {
            display: none !important;
          }
        }
      `}</style>
      {/* SYNERGIAS PEDIDO PDF V190C STYLE FIM */}
      <Sidebar />

      <section className="cliente-form-main">
        <div className="orcamento-header-linha">
          <div className="pedido-header">
            <div className="pedido-module-row">
              <span className="pedido-page-icon">
                <FileChartColumnIncreasing size={25} strokeWidth={2.4} />
              </span>
              <span className="pedido-eyebrow">VENDAS</span>
            </div>

            <h1>{titulo}</h1>
            <p>Pedido de venda com cliente, itens, pagamento e cobrança.</p>
          </div>
        </div>

        <div className="pedido-top-actions">
          <button
            type="button"
            className="btn-secundario pedido-voltar-btn"
            onClick={abrirLista}
            title="Voltar"
            aria-label="Voltar"
          >
            <ArrowLeft size={25} strokeWidth={2.4} />
          </button>

          <div className="orcamento-iconbar topo">
            <button
              type="button"
              className="pedido-acao pedido-acao-atualizar"
              title="Atualizar pedido"
              aria-label="Atualizar pedido"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="pedido-acao pedido-acao-email"
              title="Enviar por e-mail"
              aria-label="Enviar por e-mail"
              onClick={enviarEmail}
            >
              <Mail size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="pedido-acao pedido-acao-imprimir"
              title="Imprimir pedido"
              aria-label="Imprimir pedido"
              onClick={imprimirPedido}
            >
              <Printer size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="pedido-acao pedido-acao-salvar"
              title="Salvar pedido"
              aria-label="Salvar pedido"
              onClick={salvarPedido}
            >
              <Save size={25} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div className="orcamento-page" data-consolidado={`${SYNERGIAS_CONSOLIDADO_PEDIDO_V248}|${SYNERGIAS_PEDIDO_LAYOUT_FISCAL_V249}|${SYNERGIAS_PEDIDO_2498_DOCUMENTO_PERSISTENTE_V249D}`}>
          <div className="orcamento-card">
            {/* SYNERGIAS CABECALHO PEDIDO RESPONSIVO V244 INICIO */}
            <style>{`
              .orcamento-topo-card {
                position: relative !important;
                display: grid !important;
                grid-template-columns: 255px minmax(0, 1fr) !important;
                align-items: stretch !important;
                width: 100% !important;
                max-width: 100% !important;
                min-width: 0 !important;
                min-height: 228px !important;
                padding: 0 24px 0 0 !important;
                overflow: hidden !important;
                box-sizing: border-box !important;
                background: #ffffff !important;
              }
              .orcamento-status-card {
                position: relative !important;
                inset: auto !important;
                grid-column: 1 !important;
                grid-row: 1 !important;
                align-self: stretch !important;
                justify-self: stretch !important;
                width: auto !important;
                min-width: 0 !important;
                max-width: none !important;
                height: auto !important;
                min-height: 228px !important;
                margin: 0 !important;
                padding: 20px 16px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                box-sizing: border-box !important;
                border-radius: 30px 0 0 30px !important;
                color: #ffffff !important;
                font-size: 20px !important;
                font-weight: 900 !important;
                line-height: 1 !important;
                text-align: center !important;
                text-transform: uppercase !important;
                white-space: nowrap !important;
                border: 1px solid transparent !important;
                box-shadow: 0 7px 16px rgba(15, 23, 42, .16) !important;
              }
              .orcamento-status-card[data-status="Aberto"] { background: #0284c7 !important; border-color: #0369a1 !important; }
              .orcamento-status-card[data-status="Em separação"] { background: #f59e0b !important; border-color: #d97706 !important; }
              .orcamento-status-card[data-status="Faturado"] { background: #2563eb !important; border-color: #1d4ed8 !important; }
              .orcamento-status-card[data-status="Concluído"] { background: #16a34a !important; border-color: #15803d !important; }
              .orcamento-status-card[data-status="Entregue"] { background: #7c3aed !important; border-color: #6d28d9 !important; }
              .orcamento-status-card[data-status="Cancelado"] { background: #dc2626 !important; border-color: #b91c1c !important; }
              .orcamento-dados-principais {
                grid-column: 2 !important;
                grid-row: 1 !important;
                display: grid !important;
                grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
                gap: 14px 16px !important;
                width: 100% !important;
                max-width: 100% !important;
                min-width: 0 !important;
                padding: 18px 0 18px 24px !important;
                align-items: end !important;
                box-sizing: border-box !important;
              }
              .orcamento-dados-principais > :nth-child(1) { grid-column: span 2 !important; }
              .orcamento-dados-principais > :nth-child(2) { grid-column: span 3 !important; }
              .orcamento-dados-principais > :nth-child(3) { grid-column: span 4 !important; }
              .orcamento-dados-principais > :nth-child(4) { grid-column: span 3 !important; }
              .orcamento-dados-principais > :nth-child(5),
              .orcamento-dados-principais > :nth-child(6),
              .orcamento-dados-principais > :nth-child(7) { grid-column: span 4 !important; }
              .orcamento-dados-principais > label,
              .orcamento-dados-principais > div {
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
                width: 100% !important;
                max-width: 100% !important;
                min-width: 0 !important;
                box-sizing: border-box !important;
              }
              .orcamento-dados-principais > label,
              .orcamento-dados-principais > div > span {
                font-size: 14px !important;
                font-weight: 800 !important;
                line-height: 1.15 !important;
                color: #172554 !important;
              }
              .orcamento-dados-principais .select-plus {
                display: grid !important;
                grid-template-columns: minmax(0, 1fr) 58px !important;
                gap: 10px !important;
                width: 100% !important;
                min-width: 0 !important;
              }
              .orcamento-dados-principais input,
              .orcamento-dados-principais select,
              .orcamento-dados-principais button {
                width: 100% !important;
                max-width: 100% !important;
                min-width: 0 !important;
                height: 52px !important;
                min-height: 52px !important;
                box-sizing: border-box !important;
                font-size: 14px !important;
              }
              .orcamento-dados-principais input,
              .orcamento-dados-principais select {
                padding: 0 16px !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
              }
              .orcamento-dados-principais > :nth-child(3) input {
                font-size: 14px !important;
                text-overflow: clip !important;
              }
              .orcamento-dados-principais input[type="date"] {
                padding: 0 10px !important;
                font-size: 13px !important;
                letter-spacing: 0 !important;
                line-height: 1 !important;
                white-space: nowrap !important;
              }
              .orcamento-dados-principais .select-plus > button { width: 58px !important; min-width: 58px !important; max-width: 58px !important; }
              .pedido-origem-orcamento-campo { background:#16a34a !important; border:1px solid #15803d !important; border-radius:16px !important; padding:10px 12px !important; min-height:84px !important; align-items:center !important; justify-content:center !important; box-shadow:0 7px 16px rgba(22,163,74,.18) !important; }
              .pedido-origem-orcamento-campo > span { color:#ffffff !important; font-size:18px !important; font-weight:900 !important; text-align:center !important; text-transform:uppercase !important; }
              .orcamento-dados-principais .pedido-origem-orcamento-botao:not(:disabled) { background:rgba(255,255,255,.10) !important; border:1px solid rgba(255,255,255,.48) !important; border-radius:999px !important; color:#ffffff !important; font-size:16px !important; font-weight:900 !important; min-height:38px !important; height:38px !important; padding:0 12px !important; box-shadow:none !important; }
              .pedido-origem-orcamento-botao:disabled {
                background: #cbd5e1 !important;
                border-color: #94a3b8 !important;
                color: #475569 !important;
                box-shadow: none !important;
              }
              .orcamento-dados-principais .pedido-status-select {
                height: 52px !important;
                min-height: 52px !important;
                width: 100% !important;
                border: 1.5px solid #cbd5e1 !important;
                border-radius: 16px !important;
                padding: 0 42px 0 18px !important;
                background-color: #ffffff !important;
                font-size: 17px !important;
                font-weight: 800 !important;
                box-shadow: 0 4px 12px rgba(15, 23, 42, .08) !important;
              }
              .orcamento-dados-principais .pedido-status-select[data-status="Aberto"] { color: #0284c7 !important; }
              .orcamento-dados-principais .pedido-status-select[data-status="Em separação"] { color: #b45309 !important; }
              .orcamento-dados-principais .pedido-status-select[data-status="Faturado"] { color: #2563eb !important; }
              .orcamento-dados-principais .pedido-status-select[data-status="Concluído"] { color: #15803d !important; }
              .orcamento-dados-principais .pedido-status-select[data-status="Entregue"] { color: #7c3aed !important; }
              .orcamento-dados-principais .pedido-status-select[data-status="Cancelado"] { color: #dc2626 !important; }
              .pedido-status-select option { background: #ffffff !important; font-weight: 800 !important; }
              @media (max-width: 1180px) {
                .orcamento-topo-card { grid-template-columns: 190px minmax(0, 1fr) !important; min-height: 0 !important; padding: 0 16px 0 0 !important; }
                .orcamento-status-card { min-height: 100% !important; }
                .orcamento-dados-principais { padding: 16px 0 16px 16px !important; }
                .orcamento-dados-principais { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
                .orcamento-dados-principais > :nth-child(n) { grid-column: span 3 !important; }
              }
              @media (max-width: 760px) {
                .orcamento-topo-card { display: flex !important; flex-direction: column !important; padding: 0 14px 14px !important; }
                .orcamento-status-card { width: calc(100% + 28px) !important; min-height: 84px !important; margin: 0 -14px 12px !important; border-radius: 22px 22px 0 0 !important; }
                .orcamento-dados-principais { padding: 0 !important; grid-template-columns: 1fr !important; }
                .orcamento-dados-principais > :nth-child(n) { grid-column: 1 !important; }
              }
            `}</style>
            {/* SYNERGIAS CABECALHO PEDIDO RESPONSIVO V244 FIM */}
            <div className="orcamento-topo-card">
              <div
                className="orcamento-status-card"
                data-layout="SYNERGIAS_CABECALHO_PEDIDO_RESPONSIVO_V244" data-altura="SYNERGIAS_STATUS_ESPELHADO_SOLIDO_CORES_V252|SYNERGIAS_IBGE_CLIENTE_CADASTRO_PEDIDO_V254"
                data-status={venda.statusPedido || 'Aberto'}
              >
                {venda.statusPedido || 'Aberto'}
              </div>

              <div className="orcamento-dados-principais">
                <label>
                  Nº Pedido
                  <input
                    className="orcamento-numero-input"
                    value={venda.numeroPedido || ''}
                    onChange={(e) =>
                      atualizarVenda('numeroPedido', e.target.value)
                    }
                  />
                </label>

                <div className="pedido-origem-orcamento-campo">
                  <span>APROVADO</span>
                  <button
                    type="button"
                    className="pedido-origem-orcamento-botao"
                    onClick={abrirOrcamentoOrigem}
                    disabled={
                      !String(
                        venda.orcamentoOrigemId ||
                          venda.orcamentoOrigemNumero ||
                          venda.numeroOrcamento ||
                          '',
                      ).trim()
                    }
                    title="Voltar para o orçamento que originou este pedido"
                  >
                    {`Orçamento ${venda.orcamentoOrigemNumero || venda.numeroOrcamento || ''}`}
                  </button>
                </div>

                <label>
                  Vendedor
                  <div className="select-plus">
                    <input
                      value={venda.vendedor || ''}
                      onChange={(e) =>
                        atualizarVenda('vendedor', e.target.value)
                      }
                    />

                    <button type="button">
                      <User size={18} />
                    </button>
                  </div>
                </label>

                <label>
                  Status
                  <select
                    className="pedido-status-select"
                    data-layout-fix="SYNERGIAS_STATUS_ORIGEM_LAYOUT_V243B"
                    data-status={venda.statusPedido || 'Aberto'}
                    value={venda.statusPedido || 'Aberto'}
                    disabled={['cancelado', 'entregue'].includes(chaveStatusPedido(venda.statusPedido))}
                    onChange={(e) => alterarStatusPedido(e.target.value)}
                  >
                    <option disabled={chaveStatusPedido(venda.statusPedido) === 'concluido'} style={{ color: '#0284c7', backgroundColor: '#ffffff' }}>Aberto</option>
                    <option disabled={chaveStatusPedido(venda.statusPedido) === 'concluido'} style={{ color: '#b45309', backgroundColor: '#ffffff' }}>Em separação</option>
                    <option disabled={chaveStatusPedido(venda.statusPedido) === 'concluido'} style={{ color: '#2563eb', backgroundColor: '#ffffff' }}>Faturado</option>
                    <option style={{ color: '#15803d', backgroundColor: '#ffffff' }}>Concluído</option>
                    <option style={{ color: '#7c3aed', backgroundColor: '#ffffff' }}>Entregue</option>
                    <option style={{ color: '#dc2626', backgroundColor: '#ffffff' }}>Cancelado</option>
                  </select>
                </label>

                <label>
                  Emissão
                  <div className="select-plus">
                    <input
                      type="date"
                      value={venda.dataEmissao}
                      onChange={(e) => alterarDataEmissao(e.target.value)}
                    />

                    <button type="button">
                      <CalendarDays size={18} />
                    </button>
                  </div>
                </label>

                <label>
                  Validade
                  <div className="select-plus">
                    <input
                      type="date"
                      value={venda.dataValidade || ''}
                      onChange={(e) =>
                        atualizarVenda('dataValidade', e.target.value)
                      }
                    />

                    <button type="button">
                      <CalendarDays size={18} />
                    </button>
                  </div>
                </label>

                <label>
                  Entrega
                  <div className="select-plus">
                    <input
                      type="date"
                      value={venda.dataEntrega || ''}
                      onChange={(e) =>
                        atualizarVenda('dataEntrega', e.target.value)
                      }
                    />

                    <button type="button">
                      <CalendarDays size={18} />
                    </button>
                  </div>
                </label>

              </div>
            </div>

            <div className="form-section-title">
              <h2>Cliente</h2>
            </div>

            <div className="orcamento-cliente-selecao">
              <div className="campo-busca-sugestoes">
                <input
                  value={clienteBusca}
                  onFocus={() => setMostrarSugestoesCliente(true)}
                  onBlur={() =>
                    setTimeout(() => setMostrarSugestoesCliente(false), 180)
                  }
                  onChange={(e) => {
                    setClienteBusca(e.target.value)
                    destacarSugestao('cliente', -1)
                    setMostrarSugestoesCliente(true)
                  }}
                  onKeyDownCapture={navegarSugestoesCliente}
                  placeholder="Digite o nome do cliente"
                />

                {mostrarSugestoesCliente && sugestoesClientes.length > 0 && (
                  <div className="lista-sugestoes">
                    {sugestoesClientes.map((cliente: Cliente, indice) => (
                      <button
                        type="button"
                        key={cliente.codigo}
                        data-sugestao-cliente={indice}
                        className={`pedido-sugestao-opcao${indice === clienteSugestaoAtiva ? ' ativo-teclado' : ''}`}
                        onMouseEnter={() => destacarSugestao('cliente', indice)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selecionarCliente(String(cliente.codigo))}
                      >
                        <strong>{montarNomeCliente(cliente)}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={abrirConfiguracaoCreditoCliente}
                title="Abrir crédito do cliente"
                style={{
                  border: 0,
                  background: 'transparent',
                  textAlign: 'right',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <small>
                  {resumoCreditoCliente.limiteDisponivel < 0
                    ? 'LIMITE EXCEDIDO'
                    : 'CRÉDITO DISPONÍVEL'}
                </small>
                <strong
                  style={{
                    color:
                      resumoCreditoCliente.limiteDisponivel < 0 ? '#b91c1c' : undefined,
                  }}
                >
                  {dinheiro(resumoCreditoCliente.limiteDisponivel)}
                </strong>
              </button>

              <button
                type="button"
                onClick={abrirConfiguracaoCreditoCliente}
                title="Consultar crédito do cliente"
                aria-label="Consultar crédito do cliente"
              >
                <Search size={22} />
              </button>
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
                <div
                  style={{
                    width: 'min(940px, 100%)',
                    background: '#ffffff',
                    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.35)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#bfbfbf',
                      color: '#ffffff',
                      padding: '20px',
                    }}
                  >
                    <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
                      CONFIGURAÇÃO DO CLIENTE
                    </h2>

                    <button
                      type="button"
                      onClick={() => setMostrarCreditoCliente(false)}
                      style={{
                        width: 68,
                        height: 68,
                        margin: '-20px -20px -20px 0',
                        border: 0,
                        background: '#9f9f9f',
                        color: '#ffffff',
                        fontSize: 38,
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 32,
                      padding: '24px 60px 20px',
                      textAlign: 'center',
                      color: '#444444',
                    }}
                  >
                    <label style={{ fontWeight: 900, fontSize: 18 }}>
                      Limite de Crédito
                      <input
                        value={limiteCreditoTexto}
                        onChange={(e) => setLimiteCreditoTexto(e.target.value)}
                        onBlur={() =>
                          setLimiteCreditoTexto(
                            formatarMoedaInput(converterMoedaInput(limiteCreditoTexto)),
                          )
                        }
                        style={{
                          width: '100%',
                          minHeight: 42,
                          marginTop: 4,
                          border: '1px solid #a8a8a8',
                          background: '#d1d1d1',
                          color: '#111827',
                          padding: '8px 10px',
                          fontSize: 18,
                        }}
                      />
                    </label>

                    <div>
                      <strong style={{ display: 'block', fontSize: 18 }}>
                        Limite Utilizado
                      </strong>
                      <span style={{ fontSize: 18 }}>
                        {dinheiro(resumoCreditoCliente.limiteUtilizado)}
                      </span>
                    </div>

                    <div>
                      <strong style={{ display: 'block', fontSize: 18 }}>
                        Limite Disponível
                      </strong>
                      <span
                        style={{
                          fontSize: 18,
                          color:
                            resumoCreditoCliente.limiteDisponivel < 0
                              ? '#b91c1c'
                              : '#444444',
                        }}
                      >
                        {dinheiro(resumoCreditoCliente.limiteDisponivel)}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 12,
                      borderTop: '1px solid #e5e7eb',
                      padding: '20px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setMostrarCreditoCliente(false)}
                      style={{
                        minHeight: 50,
                        border: 0,
                        background: '#444444',
                        color: '#ffffff',
                        padding: '0 18px',
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      CANCELAR
                    </button>

                    <button
                      type="button"
                      onClick={salvarCreditoCliente}
                      style={{
                        minHeight: 50,
                        border: 0,
                        background: '#78c83b',
                        color: '#ffffff',
                        padding: '0 28px',
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      SALVAR
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="cliente-cadastro-acoes">
              <button
                type="button"
                onClick={() => setMostrarCadastroCliente((atual) => !atual)}
                className="btn-cadastrar-cliente"
              >
                + Cadastrar novo cliente
              </button>
            </div>

            {mostrarCadastroCliente && (
              <div className="cliente-rapido-card">
                <h2>Novo cliente rápido</h2>

                <div className="form-grid">
                  <label className="span-2">
                    Nome / Razão Social
                    <input
                      value={novoCliente.nome}
                      onChange={(e) =>
                        atualizarNovoCliente('nome', e.target.value)
                      }
                      placeholder="Nome ou razão social do cliente"
                    />
                  </label>

                  <label>
                    CPF ou CNPJ
                    <div className="select-plus">
                      <input
                        value={novoCliente.documento}
                        onChange={(e) =>
                          atualizarNovoCliente('documento', e.target.value)
                        }
                        placeholder="CPF ou CNPJ"
                      />

                      <button
                        type="button"
                        title="Buscar CNPJ"
                        onClick={buscarCnpjNovoCliente}
                        disabled={buscandoCnpj}
                      >
                        {buscandoCnpj ? '...' : <Search size={18} />}
                      </button>
                    </div>
                  </label>

                  <label>
                    Telefone
                    <input
                      value={novoCliente.telefone}
                      onChange={(e) =>
                        atualizarNovoCliente('telefone', e.target.value)
                      }
                      placeholder="Telefone ou WhatsApp"
                    />
                  </label>

                  <label>
                    E-mail
                    <input
                      value={novoCliente.email}
                      onChange={(e) =>
                        atualizarNovoCliente('email', e.target.value)
                      }
                      placeholder="E-mail principal"
                    />
                  </label>

                  <label>
                    E-mail para nota fiscal
                    <input
                      value={novoCliente.emailNotaFiscal}
                      onChange={(e) =>
                        atualizarNovoCliente('emailNotaFiscal', e.target.value)
                      }
                      placeholder="E-mail para envio de NF"
                    />
                  </label>

                  <label>
                    CEP
                    <input
                      value={novoCliente.cep}
                      onChange={(e) =>
                        atualizarNovoCliente('cep', e.target.value)
                      }
                    />
                  </label>

                  <label className="span-2">
                    Endereço
                    <input
                      value={novoCliente.endereco}
                      onChange={(e) =>
                        atualizarNovoCliente('endereco', e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Número
                    <input
                      value={novoCliente.numero}
                      onChange={(e) =>
                        atualizarNovoCliente('numero', e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Complemento
                    <input
                      value={novoCliente.complemento}
                      onChange={(e) =>
                        atualizarNovoCliente('complemento', e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Bairro
                    <input
                      value={novoCliente.bairro}
                      onChange={(e) =>
                        atualizarNovoCliente('bairro', e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Cidade
                    <input
                      value={novoCliente.cidade}
                      onChange={(e) =>
                        atualizarNovoCliente('cidade', e.target.value)
                      }
                    />
                  </label>

                  <label>
                    UF
                    <input
                      value={novoCliente.estado}
                      onChange={(e) =>
                        atualizarNovoCliente('estado', e.target.value)
                      }
                      maxLength={2}
                    />
                  </label>
                </div>

                <div className="cliente-rapido-acoes">
                  <button
                    type="button"
                    className="save-secondary-button"
                    onClick={() => {
                      limparNovoClienteRapido()
                      setMostrarCadastroCliente(false)
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="save-button"
                    onClick={salvarNovoClienteRapido}
                  >
                    Salvar cliente
                  </button>
                </div>
              </div>
            )}

            <div className="form-grid">
              <label>
                CPF ou CNPJ
                <input
                  value={venda.clienteDocumento || ''}
                  onChange={(e) =>
                    atualizarVenda('clienteDocumento', e.target.value)
                  }
                  onBlur={() => { void salvarDocumentoEmailNoCadastro() }}
                />
              </label>

              <label>
                E-mail
                <input
                  value={venda.clienteEmail || ''}
                  onChange={(e) =>
                    atualizarVenda('clienteEmail', e.target.value)
                  }
                  onBlur={() => { void salvarDocumentoEmailNoCadastro() }}
                />
              </label>

              <label>
                Telefone
                <input
                  value={venda.clienteTelefone || ''}
                  onChange={(e) =>
                    atualizarVenda('clienteTelefone', e.target.value)
                  }
                />
              </label>
            </div>

            <div className="form-section-title">
              <h2>Endereço de cobrança</h2>
            </div>

            <div className="form-grid">
              <label>
                CEP
                <input
                  value={venda.faturamentoCep || ''}
                  onChange={(e) =>
                    atualizarVenda('faturamentoCep', e.target.value)
                  }
                />
              </label>

              <label className="span-2">
                Endereço
                <input
                  value={venda.faturamentoEndereco || ''}
                  onChange={(e) =>
                    atualizarVenda('faturamentoEndereco', e.target.value)
                  }
                />
              </label>

              <label>
                Número
                <input
                  value={venda.faturamentoNumero || ''}
                  onChange={(e) =>
                    atualizarVenda('faturamentoNumero', e.target.value)
                  }
                />
              </label>

              <label>
                Complemento
                <input
                  value={venda.faturamentoComplemento || ''}
                  onChange={(e) =>
                    atualizarVenda('faturamentoComplemento', e.target.value)
                  }
                />
              </label>

              <label>
                Bairro
                <input
                  value={venda.faturamentoBairro || ''}
                  onChange={(e) =>
                    atualizarVenda('faturamentoBairro', e.target.value)
                  }
                />
              </label>

              <label>
                Cidade
                <input
                  value={venda.faturamentoCidade || ''}
                  onChange={(e) =>
                    atualizarVenda('faturamentoCidade', e.target.value)
                  }
                />
              </label>

              <label>
                Código IBGE do Município
                <input
                  value={venda.faturamentoCodigoIbge || ''}
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="7 dígitos"
                  onChange={(e) =>
                    atualizarVenda(
                      'faturamentoCodigoIbge',
                      e.target.value.replace(/\D/g, '').slice(0, 7),
                    )
                  }
                />
              </label>

              <label>
                UF
                <input
                  value={venda.faturamentoEstado || ''}
                  onChange={(e) =>
                    atualizarVenda('faturamentoEstado', e.target.value)
                  }
                />
              </label>
            </div>

            <div className="form-section-title">
              <h2>Endereço de entrega</h2>
            </div>

            <div className="form-grid">
              <label>
                CEP
                <input
                  value={venda.entregaCep || ''}
                  onChange={(e) =>
                    atualizarVenda('entregaCep', formatarCepPedido(e.target.value))
                  }
                />
              </label>

              <label className="span-2">
                Endereço
                <input
                  value={venda.entregaEndereco || ''}
                  onChange={(e) =>
                    atualizarVenda('entregaEndereco', e.target.value)
                  }
                />
              </label>

              <label>
                Número
                <input
                  value={venda.entregaNumero || ''}
                  onChange={(e) =>
                    atualizarVenda('entregaNumero', e.target.value)
                  }
                />
              </label>

              <label>
                Complemento
                <input
                  value={venda.entregaComplemento || ''}
                  onChange={(e) =>
                    atualizarVenda('entregaComplemento', e.target.value)
                  }
                />
              </label>

              <label>
                Bairro
                <input
                  value={venda.entregaBairro || ''}
                  onChange={(e) =>
                    atualizarVenda('entregaBairro', e.target.value)
                  }
                />
              </label>

              <label>
                Cidade
                <input
                  value={venda.entregaCidade || ''}
                  onChange={(e) =>
                    atualizarVenda('entregaCidade', e.target.value)
                  }
                />
              </label>

              <label>
                UF
                <input
                  value={venda.entregaEstado || ''}
                  onChange={(e) =>
                    atualizarVenda('entregaEstado', e.target.value)
                  }
                />
              </label>
            </div>

            <div className="form-section-title">
              <h2>Itens do pedido</h2>
            </div>

            <div className="orcamento-produto-barra">
              <div>
                <label>
                  Produto
                  <div className="campo-busca-sugestoes">
                    <input
                      value={produtoBusca}
                      onFocus={() => setMostrarSugestoesProduto(true)}
                      onBlur={() =>
                        setTimeout(() => setMostrarSugestoesProduto(false), 180)
                      }
                      onChange={(e) => {
                        setProdutoBusca(e.target.value)
                        setProdutoSelecionadoCodigo('')
                        destacarSugestao('produto', -1)
                        setMostrarSugestoesProduto(true)
                      }}
                      onKeyDownCapture={navegarSugestoesProduto}
                      placeholder="Digite nome, código ou código de barras do produto"
                    />

                    {mostrarSugestoesProduto &&
                      sugestoesProdutos.length > 0 && (
                        <div className="lista-sugestoes lista-sugestoes-produto">
                          {sugestoesProdutos.map((produto: Produto, indice) => (
                            <button
                              type="button"
                              key={produto.codigo}
                              data-sugestao-produto={indice}
                              className={`pedido-sugestao-opcao${indice === produtoSugestaoAtiva ? ' ativo-teclado' : ''}`}
                              onMouseEnter={() => destacarSugestao('produto', indice)}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => selecionarProduto(produto)}
                            >
                              <strong>{produto.descricao}</strong>
                              <small>Código de barras: {produto.codigoBarras || 'Não informado'}</small>
                              <small>Estoque disponível: {obterEstoqueProduto(produto)} {produto.unidade || 'UN'}</small>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </label>
              </div>

              <div>
                <label>
                  Quantidade
                  <div className="pedido-quantidade-controles">
                    <button type="button" onClick={aumentarQuantidadeItemBusca} aria-label="Aumentar quantidade"><Plus size={18} /></button>
                    <input type="number" min={1} value={quantidadeItem} onChange={(e) => setQuantidadeItem(Math.max(1, Number(e.target.value || 1)))} />
                    <button type="button" onClick={diminuirQuantidadeItemBusca} aria-label="Diminuir quantidade"><Minus size={18} /></button>
                  </div>
                </label>
              </div>

              <div>
                <small>Unitário</small>
                <strong>
                  {dinheiro(
                    Number(
                      produtos.find(
                        (produto) =>
                          String(produto.codigo) ===
                          String(produtoSelecionadoCodigo),
                      )?.vendaVarejo || 0,
                    ),
                  )}
                </strong>
                <small>
                  Estoque {obterEstoqueProduto(produtos.find((produto) => String(produto.codigo) === String(produtoSelecionadoCodigo)))} {produtos.find((produto) => String(produto.codigo) === String(produtoSelecionadoCodigo))?.unidade || 'UN'}
                </small>
              </div>

              <button type="button" onClick={incluirProduto}>
                <PackagePlus size={22} />
                INCLUIR
              </button>
            </div>

            <div className="history-area">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Produto / Serviço</th>
                    <th>Quantidade</th>
                    <th>Unitário</th>
                    <th>Total</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {venda.itens.length > 0 ? (
                    venda.itens.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <strong>{item.descricao}</strong>
                          <small style={{ display: 'block' }}>
                            {item.codigoBarras || item.codigoProduto}
                          </small>
                        </td>

                        <td>
                          <div className="pedido-qtd-tabela">
                            <button type="button" onClick={() => alterarQuantidadeItem(index, item.quantidade - 1)}><Minus size={16} /></button>
                            <input type="number" min={1} value={item.quantidade} onChange={(e) => alterarQuantidadeItem(index, Number(e.target.value))} />
                            <button type="button" onClick={() => alterarQuantidadeItem(index, item.quantidade + 1)}><Plus size={16} /></button>
                          </div>
                          <small>{item.unidade || 'UN'}</small>
                        </td>

                        <td>
                          <input
                            type="text"
                            value={formatarMoedaInput(item.valorUnitario)}
                            onChange={(e) =>
                              alterarValorUnitarioItem(
                                index,
                                converterMoedaInput(e.target.value),
                              )
                            }
                            style={{ maxWidth: '130px' }}
                          />
                        </td>

                        <td>
                          <strong>{dinheiro(recalcularItemPedido(item).valorTotal)}</strong>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="cancel-button"
                            onClick={() => removerItem(index)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: 'center',
                          color: '#94a3b8',
                          padding: '24px',
                        }}
                      >
                        Nenhum item incluído no pedido.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

                        {/* SYNERGIAS PEDIDO PDF NF FINAL V190C INICIO */}
            <div className="pedido-pdf-nfe-final-primeira-pagina">
              NF-e nº {venda.numeroNotaFiscal || '-'}
            </div>
            {/* SYNERGIAS PEDIDO PDF NF FINAL V190C FIM */}
<div className="orcamento-total-area">
              <div>
                            {/* SYNERGIAS PEDIDO PDF PAGAMENTO V190C INICIO */}
            <div className="pedido-pdf-pagamento">
              <div>
                <span>Forma de pagamento</span>
                <strong>{venda.formaPagamento || venda.tipoCobranca || '-'}</strong>
              </div>
              <div>
                <span>Condições de pagamento</span>
                <strong>{venda.parcelamento || '-'}</strong>
              </div>
              <div>
                <span>Vencimento</span>
                <strong>
                  {formatarDataBrasil(
                    venda.parcelas?.[0]?.vencimento || venda.dataEmissao || '',
                  )}
                </strong>
              </div>
              <div>
                <span>Valor</span>
                <strong>
                  {dinheiro(
                    Number(
                      venda.parcelas?.[0]?.valor ||
                        venda.valorPagamento ||
                        totais.totalFinal ||
                        0,
                    ),
                  )}
                </strong>
              </div>
              <div className="pedido-pdf-pagamento-observacao">
                <span>Observação do pagamento</span>
                <strong>
                  {venda.parcelas?.[0]?.observacao ||
                    venda.observacoes ||
                    venda.observacaoInterna ||
                    '-'}
                </strong>
              </div>
            </div>
            {/* SYNERGIAS PEDIDO PDF PAGAMENTO V190C FIM */}
<label>
                  Observações
                  <textarea
                    value={venda.observacoes || ''}
                    onChange={(e) =>
                      atualizarVenda('observacoes', e.target.value)
                    }
                    placeholder="Condições comerciais, entrega, separação, informações ao cliente..."
                  />
                </label>
              </div>

              <div className="orcamento-total-card">
                <div className="total-linha">
                  <span>Subtotal</span>
                  <strong>{dinheiro(totais.subtotal)}</strong>
                </div>

                <div className="desconto-tipo">
                  <button
                    type="button"
                    className={tipoDesconto === 'valor' ? 'ativo' : ''}
                    onClick={() => {
                      setTipoDesconto('valor')
                      atualizarVenda('descontoPercentual', 0)
                    }}
                  >
                    R$
                  </button>

                  <button
                    type="button"
                    className={tipoDesconto === 'percentual' ? 'ativo' : ''}
                    onClick={() => {
                      setTipoDesconto('percentual')
                      atualizarVenda('descontoValor', 0)
                    }}
                  >
                    %
                  </button>
                </div>

                {tipoDesconto === 'valor' ? (
                  <label>
                    Desconto R$
                    <input
                      type="text"
                      value={formatarMoedaInput(venda.descontoValor || 0)}
                      onChange={(e) =>
                        atualizarVenda(
                          'descontoValor',
                          converterMoedaInput(e.target.value),
                        )
                      }
                    />
                  </label>
                ) : (
                  <label>
                    Desconto %
                    <input
                      type="number"
                      value={venda.descontoPercentual || 0}
                      onChange={(e) =>
                        atualizarVenda(
                          'descontoPercentual',
                          Number(e.target.value),
                        )
                      }
                    />
                  </label>
                )}

                <label>
                  Frete
                  <input
                    type="text"
                    value={formatarMoedaInput(venda.frete || 0)}
                    onChange={(e) =>
                      atualizarVenda(
                        'frete',
                        converterMoedaInput(e.target.value),
                      )
                    }
                  />
                </label>

                <label className="modalidade-frete-campo">
                  Frete por conta
                  <select
                    value={venda.modalidadeFrete || '0'}
                    onChange={(e) =>
                      setVenda((atual) => ({
                        ...atual,
                        modalidadeFrete: e.target.value as '0' | '1' | '2',
                      }))
                    }
                  >
                    <option value="0">0 - Emitente</option>
                    <option value="1">1 - Destinatário</option>
                    <option value="2">2 - Terceiros</option>
                  </select>
                </label>

                <label>
                  Outros custos
                  <input
                    type="text"
                    value={formatarMoedaInput(venda.outrosCustos || 0)}
                    onChange={(e) =>
                      atualizarVenda(
                        'outrosCustos',
                        converterMoedaInput(e.target.value),
                      )
                    }
                  />
                </label>

                <div className="total-final-box">
                  <small>Valor Final</small>
                  <strong>{dinheiro(totais.totalFinal)}</strong>
                </div>
              </div>
            </div>

            <div className="form-section-title">
              <h2>Pagamento</h2>
            </div>

            <div className="orcamento-pagamento-area">
              <div className="orcamento-pagamento-lateral">
                <div className="pagamento-total">
                  <small>Total a pagar</small>
                  <strong>{dinheiro(totais.totalFinal)}</strong>
                </div>

                <label>
                  Forma de pagamento
                  <select
                    value={venda.formaPagamento || ''}
                    onChange={(e) => alterarFormaPagamento(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {FORMAS_PAGAMENTO_PADRAO.map((forma) => (
                      <option key={forma} value={forma}>
                        {forma}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Tipo / conta / cobrança
                  <select
                    value={venda.tipoCobranca || ''}
                    onChange={(e) => alterarTipoCobranca(e.target.value)}
                    disabled={!venda.formaPagamento}
                  >
                    <option value="">Selecione</option>
                    {opcoesTipoPagamento.map((opcao) => (
                      <option key={opcao} value={opcao}>
                        {opcao}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Prazo
                  <select
                    value={venda.parcelamento || ''}
                    onChange={(e) =>
                      setVenda(
                        (atual) =>
                          ({
                            ...atual,
                            parcelamento: e.target.value,
                            parcelas: [],
                            valorPagamento: calcularTotais(atual).totalFinal,
                          }) as Venda,
                      )
                    }
                    disabled={!venda.formaPagamento}
                  >
                    <option value="">Selecione</option>
                    {prazosPagamento.map((prazo) => (
                      <option key={prazo} value={prazo}>
                        {prazo}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Valor
                  <input
                    type="text"
                    value={formatarMoedaInput(
                      venda.valorPagamento ?? calcularSaldoRealPedido({ ...venda, totalFinal: totais.totalFinal }),
                    )}
                    onChange={(e) =>
                      atualizarVenda(
                        'valorPagamento',
                        converterMoedaInput(e.target.value),
                      )
                    }
                  />
                </label>

                {dadosPagamentoSelecionado && (
                  <div className="dados-pagamento-box">
                    <strong>Dados da opção selecionada</strong>

                    {Object.entries(dadosPagamentoSelecionado).map(
                      ([chave, valor]) => (
                        <span key={chave}>
                          <b>{chave}:</b> {valor}
                        </span>
                      ),
                    )}
                  </div>
                )}

                <button type="button" onClick={gerarCobranca}>
                  GERAR COBRANÇA
                </button>
              </div>

              <div className="orcamento-pagamento-lista">
                <div className="pagamento-lista-header pagamento-lista-header-boleto">
                  <strong>Vencimento</strong>
                  <strong>Banco</strong>
                  <strong>Tipo</strong>
                  <strong>Observações</strong>
                  <strong>Valor</strong>
                  <strong>Status</strong>
                  <strong>Ação</strong>
                </div>

                {venda.parcelas.length > 0 ? (
                  venda.parcelas.map((parcela, index) => (
                    <div
                      className="pagamento-lista-linha pagamento-lista-linha-boleto"
                      key={index}
                    >
                      <input
                        type="date"
                        value={parcela.vencimento}
                        onChange={(e) =>
                          setVenda(
                            (atual) =>
                              ({
                                ...atual,
                                parcelas: atual.parcelas.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        vencimento: e.target.value,
                                      }
                                    : item,
                                ),
                              }) as Venda,
                          )
                        }
                      />

                      <input
                        value={parcela.bancoCobranca || ''}
                        onChange={(e) =>
                          setVenda(
                            (atual) =>
                              ({
                                ...atual,
                                parcelas: atual.parcelas.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        bancoCobranca: normalizarBanco(
                                          e.target.value,
                                        ),
                                      }
                                    : item,
                                ),
                              }) as Venda,
                          )
                        }
                        placeholder="Banco"
                      />

                      <input
                        value={parcela.tipoCobranca || venda.tipoCobranca || ''}
                        onChange={(e) =>
                          setVenda(
                            (atual) =>
                              ({
                                ...atual,
                                parcelas: atual.parcelas.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        tipoCobranca:
                                          normalizarTipoCobrancaValor(
                                            e.target.value,
                                          ),
                                        bancoCobranca: extrairBancoDaOpcao(
                                          e.target.value,
                                        ),
                                      }
                                    : item,
                                ),
                              }) as Venda,
                          )
                        }
                        placeholder="Tipo"
                      />

                      <input
                        value={parcela.observacao || ''}
                        onChange={(e) =>
                          setVenda(
                            (atual) =>
                              ({
                                ...atual,
                                parcelas: atual.parcelas.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        observacao: e.target.value,
                                      }
                                    : item,
                                ),
                              }) as Venda,
                          )
                        }
                        placeholder="Observações"
                      />

                      <input
                        type="text"
                        value={formatarMoedaInput(parcela.valor)}
                        onChange={(e) =>
                          setVenda(
                            (atual) =>
                              ({
                                ...atual,
                                parcelas: atual.parcelas.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        valor: converterMoedaInput(
                                          e.target.value,
                                        ),
                                      }
                                    : item,
                                ),
                              }) as Venda,
                          )
                        }
                      />

                      <button
                        type="button"
                        className={`pagamento-status-link ${
                          parcela.statusBoleto === 'Pago' ? 'pago' : ''
                        }`}
                        onClick={() => abrirRecebimentoParcela(parcela, index)}
                        title="Abrir e ajustar pagamento"
                      >
                        {parcela.statusBoleto || 'Pendente'}
                      </button>

                      <div className="pagamento-acoes-linha">
                        {parcela.statusBoleto !== 'Cancelado' && (
                          <button
                            type="button"
                            className="pagamento-receber-button"
                            title="Abrir e ajustar pagamento"
                            aria-label="Abrir e ajustar pagamento"
                            onClick={() => abrirRecebimentoParcela(parcela, index)}
                          >
                            <Banknote size={22} strokeWidth={2.4} />
                          </button>
                        )}

                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() =>
                            setVenda(
                              (atual) =>
                                ({
                                  ...atual,
                                  parcelas: atual.parcelas.filter(
                                    (_, i) => i !== index,
                                  ),
                                }) as Venda,
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="pagamento-vazio">
                    Nenhuma cobrança gerada.
                  </div>
                )}

                <label className="observacao-pagamento">
                  Observações do pagamento
                  <textarea
                    value={venda.observacaoInterna || ''}
                    onChange={(e) =>
                      atualizarVenda('observacaoInterna', e.target.value)
                    }
                    placeholder="Informações internas ou observações sobre a cobrança..."
                  />
                </label>
              </div>
            </div>

            <div className="form-section-title">
              <h2>Brindes</h2>
            </div>

            <section className="pedido-brindes-card">
              <p>Brindes são controles internos: não somam no pedido e não entram como item comercial.</p>
              <div className="pedido-brindes-grid">
                <label>Produto
                  <div className="pedido-brinde-produto-busca">
                    <input
                      type="text"
                      value={brindeProdutoBusca}
                      onFocus={() => setMostrarSugestoesBrinde(true)}
                      onChange={(e) => {
                        setBrindeProdutoBusca(e.target.value)
                        setBrindeProdutoCodigo('')
                        setMostrarSugestoesBrinde(true)
                      }}
                      onKeyDown={tratarTeclaBuscaBrinde}
                      onBlur={() => window.setTimeout(() => setMostrarSugestoesBrinde(false), 150)}
                      placeholder="Digite o nome do produto..."
                      autoComplete="off"
                      aria-label="Buscar produto para brinde pelo nome"
                    />
                    {mostrarSugestoesBrinde && (
                      <div className="pedido-brinde-produto-sugestoes" role="listbox">
                        {produtosBrindeFiltrados.map((produto: Produto) => {
                          const codigo = String(produto.codigo || produto.id || '')
                          const descricao = String(produto.descricao || produto.nome || 'Produto')
                          return (
                            <button
                              key={codigo}
                              type="button"
                              className={codigo === brindeProdutoCodigo ? 'is-selected' : ''}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selecionarProdutoBrinde(produto)}
                              role="option"
                              aria-selected={codigo === brindeProdutoCodigo}
                            >
                              {descricao}
                            </button>
                          )
                        })}
                        {produtosBrindeFiltrados.length === 0 && (
                          <div className="pedido-brinde-produto-vazio">Nenhum produto encontrado.</div>
                        )}
                      </div>
                    )}
                  </div>
                </label>
                <label>Quantidade<input type="number" min="1" value={brindeQuantidade} onChange={(e) => setBrindeQuantidade(Number(e.target.value || 1))} /></label>
                <label>Destinatário<input value={brindeDestinatario} onChange={(e) => setBrindeDestinatario(e.target.value)} placeholder="Síndica, gestor, responsável..." /></label>
                <label>Observação<input value={brindeObservacao} onChange={(e) => setBrindeObservacao(e.target.value)} /></label>
                <button type="button" className="save-secondary-button pedido-brinde-adicionar" onClick={adicionarBrinde}>Adicionar brinde</button>
              </div>

              <div className="pedido-brindes-lista">
                {(venda.brindes || []).map((brinde) => (
                  <div className="pedido-brinde-linha" key={brinde.id}>
                    <div><strong>{brinde.produtoDescricao}</strong><span>{brinde.quantidade} un. · {brinde.destinatario} · {brinde.clienteNome || 'Sem cliente'}</span>{brinde.observacao && <small>{brinde.observacao}</small>}</div>
                    <span className={brinde.estoqueBaixado ? 'brinde-status baixado' : 'brinde-status pendente'}>{brinde.estoqueBaixado ? 'Estoque baixado' : 'Pendente'}</span>
                    {!brinde.estoqueBaixado && <button type="button" className="save-secondary-button" onClick={() => baixarBrinde(brinde)}>Baixar estoque</button>}
                    {!brinde.estoqueBaixado && <button type="button" className="cancel-button" onClick={() => removerBrinde(brinde.id)}><Trash2 size={16}/></button>}
                  </div>
                ))}
                {(venda.brindes || []).length === 0 && <div className="pagamento-vazio">Nenhum brinde registrado neste pedido.</div>}
              </div>
            </section>

            <div className="form-section-title">
              <h2>Documentos e envio</h2>
            </div>

            <div className="pedido-acoes-documentos pedido-documentos-vertical">
              <section className="pedido-documento-card nota">
                <div className="pedido-documento-titulo pedido-documento-titulo-com-acoes">
                  <div><ReceiptText size={28} color="#0284c7" /><h3>NOTA FISCAL</h3></div>
                  <span className={`nf-status-badge status-${String(venda.statusNotaFiscal || 'Pendente').toLowerCase().replace(/\s+/g, '-')}`}>
                    {venda.dispensaEmissaoNfe
                      ? 'DISPENSADA'
                      : venda.numeroNotaFiscal
                        ? String(venda.statusNotaFiscal || 'Emitida').toUpperCase()
                        : 'NÃO EMITIDA'}
                  </span>
                </div>

                {venda.dispensaEmissaoNfe ? (
                  <div className="nota-resumo-principal">
                    <strong>Pedido sem emissão de nota fiscal</strong>
                    <span>Dispensa registrada. O pedido não possui pendência de emissão de NF.</span>
                  </div>
                ) : !venda.numeroNotaFiscal ? (
                  <>
                    <div className="nota-resumo-principal"><strong>Nota fiscal não emitida</strong><span>A data de emissão será definida somente após a autorização oficial da SEFAZ.</span></div>
                    <div className="nota-data-entrega-inline nota-fiscal-dados-inline">
                      <label>Data de entrega
                        <input type="date" min={hoje()} value={venda.dataEntrega || hoje()} onChange={(e) => setVenda((atual) => ({ ...atual, dataEntrega: e.target.value }))} onBlur={() => { const atualizada = montarPedidoAtualizado(); salvarVendaStorage(atualizada); setVenda(atualizada) }} />
                      </label>
                      <label>Indicador de IE
                        <select value={venda.clienteIndicadorIE || ''} onChange={(e) => setVenda((a) => ({ ...a, clienteIndicadorIE: e.target.value, clienteIeRg: e.target.value === '1' ? a.clienteIeRg : '' }))} onBlur={() => { const atualizada = montarPedidoAtualizado(); salvarVendaStorage(atualizada); setVenda(atualizada) }}>
                          <option value="">Selecione</option>
                          <option value="1">Contribuinte do ICMS</option>
                          <option value="2">Contribuinte isento</option>
                          <option value="9">Não contribuinte</option>
                        </select>
                      </label>
                      {venda.clienteIndicadorIE === '1' && <label>Inscrição Estadual
                        <input value={venda.clienteIeRg || ''} onChange={(e) => setVenda((a) => ({ ...a, clienteIeRg: e.target.value }))} onBlur={() => { const atualizada = montarPedidoAtualizado(); salvarVendaStorage(atualizada); setVenda(atualizada) }} />
                      </label>}
                      {String(venda.dataEntrega || '') < hoje() && <button type="button" onClick={() => { const atualizada = { ...montarPedidoAtualizado(), dataEntrega: hoje() }; salvarVendaStorage(atualizada); setVenda(atualizada) }}>Usar data de hoje</button>}
                    </div>
                    <label className="observacao-pagamento nota-fiscal-observacoes">
                      Observações da Nota Fiscal
                      <textarea
                        value={venda.observacoesNotaFiscal || ''}
                        onChange={(e) => atualizarVenda('observacoesNotaFiscal', e.target.value)}
                        onBlur={() => { const atualizada = montarPedidoAtualizado(); salvarVendaStorage(atualizada); setVenda(atualizada) }}
                        placeholder="Informações complementares que devem acompanhar a NF-e..."
                      />
                    </label>
                    {validarDadosNotaFiscal().length > 0 && <div className="nota-validacao erro"><strong>Revise antes de emitir</strong>{validarDadosNotaFiscal().map((erro) => <small key={erro}>- {erro}</small>)}</div>}
                    <div className="documento-acoes-inline documento-acoes-principais">
                      <button type="button" className="documento-btn destaque" onClick={emitirNotaFiscal}><FileCheck size={18}/> Validar emissão</button>
                      <button type="button" className="documento-btn" onClick={editarDadosNotaFiscal}><FilePenLine size={18}/> Editar dados</button>
                      <button type="button" className="documento-btn" onClick={naoEmitirNotaFiscal}><ReceiptText size={18}/> NÃO EMITIR NF</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="nf-resumo-grid">
                      <div><span>Nota fiscal</span><strong>NF-e nº {venda.numeroNotaFiscal}</strong></div>
                      <div><span>Emitida em</span><strong>{formatarDataBrasil(venda.dataEmissaoNotaFiscal || hoje())}</strong></div>
                      <div><span>Valor</span><strong>{dinheiro(totais.totalFinal)}</strong></div>
                      <div><span>Status fiscal</span><strong>{venda.statusNotaFiscal || 'Pendente'}</strong></div>
                    </div>
                    {venda.statusNotaFiscal === 'Rejeitada' || venda.statusNotaFiscal === 'Erro na emissão' ? (
                      <div className="documento-acoes-inline documento-acoes-principais">
                        <button type="button" className="documento-btn destaque" onClick={corrigirNotaFiscal}><FilePenLine size={18}/> Corrigir e reenviar</button>
                        <button type="button" className="documento-btn" onClick={consultarNotaFiscal}><Search size={18}/> Consultar motivo</button>
                        <button type="button" className="documento-btn perigo" onClick={cancelarNotaFiscal}><XCircle size={18}/> Descartar tentativa</button>
                        <button type="button" className="documento-btn" onClick={baixarXmlNotaFiscal}><Download size={18}/> XML da tentativa</button>
                      </div>
                    ) : venda.statusNotaFiscal === 'Autorizada' || venda.statusNotaFiscal === 'Emitida' ? (
                      <div className="documento-acoes-inline documento-acoes-principais">
                        <button type="button" className="documento-btn" onClick={prepararCartaCorrecao}><FilePenLine size={18}/> Carta de Correção</button>
                        <button type="button" className="documento-btn" onClick={baixarXmlNotaFiscal}><Download size={18}/> XML</button>
                        <button type="button" className="documento-btn" onClick={() => abrirDocumentoFiscal(venda.danfePdf, 'DANFE')}><FileText size={18}/> DANFE</button>
                        <button type="button" className="documento-btn" onClick={abrirNotaFiscalSimplificada}><ReceiptText size={18}/> NF Simplificada</button>
                        <button type="button" className="documento-btn perigo" onClick={cancelarNotaFiscal}><XCircle size={18}/> Cancelar NF-e</button>
                        <button type="button" className="documento-btn" onClick={consultarNotaFiscal}><Search size={18}/> Consultar</button>
                      </div>
                    ) : (
                      <div className="documento-acoes-inline documento-acoes-principais">
                        <button type="button" className="documento-btn" onClick={consultarNotaFiscal}><Search size={18}/> Consultar</button>
                        <button type="button" className="documento-btn" onClick={baixarXmlNotaFiscal}><Download size={18}/> XML</button>
                      </div>
                    )}
                  </>
                )}
              </section>

              <section className="pedido-documento-card boleto">
                <div className="pedido-documento-titulo pedido-documento-titulo-com-acoes">
                  <div><Banknote size={28} color="#16a34a" /><h3>BOLETOS</h3></div>
                  <div className="documento-acoes-inline">
                    <button type="button" className="documento-btn" onClick={gerarBoleto}><Banknote size={17}/> Emitir boletos</button>
                    <button type="button" className="documento-btn" onClick={atualizarCobrancas}><RefreshCw size={17}/> Atualizar cobranças</button>
                  </div>
                </div>

                <div className="boleto-contadores">
                  <div><span>Banco Inter</span><strong>{resumoBoletosInter.usados}/{resumoBoletosInter.limite}</strong><small>{resumoBoletosInter.disponiveis} disponíveis</small></div>
                </div>

                <div className="boleto-parcelas-lista">
                  {(venda.parcelas || []).map((parcela: ParcelaVenda, index: number) => {
                    const banco = identificarBancoBoletoDaParcela(parcela, venda) || identificarBancoBoleto(String(venda.tipoCobranca || ''))
                    const status = parcela.statusBoleto || (boletoFoiGerado(parcela) ? 'Emitido' : 'Não emitido')
                    const emitido = boletoFoiGerado(parcela)
                    return (
                      <article className="boleto-parcela-card" key={`boleto-${parcela.numero || index + 1}`}>
                        <div className="boleto-parcela-info">
                          <strong>Parcela {parcela.numero || index + 1}/{venda.parcelas.length || 1}</strong>
                          <span>{banco ? `Banco ${banco}` : 'Banco não definido'} · Vencimento {formatarDataBrasil(parcela.vencimento)} · {dinheiro(Number(parcela.valor || 0))}</span>
                          {parcela.erroBoleto && <small className="boleto-erro">{parcela.erroBoleto}</small>}
                        </div>
                        <span className={`boleto-status-badge status-${String(status).toLowerCase().replace(/\s+/g, '-')}`}>{String(status).toUpperCase()}</span>
                        <div className="boleto-parcela-acoes">
                          {status === 'Erro' && <button type="button" className="documento-icon-btn" title="Tentar novamente" onClick={gerarBoleto}><RefreshCw size={18}/></button>}
                          {emitido && <button type="button" className="documento-icon-btn" title="Visualizar boleto" onClick={() => visualizarBoleto(parcela)}><Eye size={18}/></button>}
                          {emitido && <button type="button" className="documento-icon-btn" title="Imprimir boleto" onClick={() => imprimirBoleto(parcela)}><Printer size={18}/></button>}
                          {emitido && status !== 'Pago' && status !== 'Cancelado' && <button type="button" className="documento-icon-btn perigo" title="Cancelar boleto" onClick={() => cancelarBoleto(parcela)}><XCircle size={18}/></button>}
                        </div>
                      </article>
                    )
                  })}
                  {(venda.parcelas || []).length === 0 && <div className="documento-vazio">Defina o pagamento e as parcelas para preparar as cobranças.</div>}
                </div>
              </section>

              <section className="pedido-documento-card envio">
                <div className="pedido-documento-titulo"><Send size={28} color="#ca8a04" /><h3>FORMA DE ENVIO</h3></div>
                <div className="envio-canais-grid">
                  <div className="envio-canal-card">
                    <div className="envio-canal-titulo"><Mail size={21}/><strong>E-mail</strong><span>Envio imediato</span></div>
                    <label>Para<input value={venda.clienteEmailNotaFiscal || venda.clienteEmail || ''} onChange={(e) => setVenda((atual) => ({ ...atual, clienteEmailNotaFiscal: e.target.value, clienteEmail: e.target.value }))} onBlur={() => { void salvarEmailsFormaEnvioNoCliente(true) }} placeholder="E-mail principal do cliente" /></label>
                    <label>Cc<input value={emailsCopiaTexto} onChange={(e) => setEmailsCopiaTexto(e.target.value)} onBlur={() => { void salvarEmailsFormaEnvioNoCliente(true) }} placeholder="E-mails adicionais separados por ponto e vírgula" /></label>
                    <small>Os e-mails desta área ficam registrados no cadastro do cliente.</small>
                    <button type="button" className="documento-btn destaque" onClick={enviarNotaBoleto}><Mail size={18}/> Enviar por e-mail</button>
                    {venda.dataEnvioNotaBoleto && <small>Último envio: {formatarDataBrasil(venda.dataEnvioNotaBoleto)}</small>}
                  </div>

                  <div className="envio-canal-card">
                    <div className="envio-canal-titulo"><Send size={21}/><strong>WhatsApp</strong><span>{venda.statusEnvioWhatsapp || 'Não enviado'}</span></div>
                    <label>
                      Telefone
                      <input
                        value={venda.clienteTelefone || ''}
                        inputMode="tel"
                        maxLength={15}
                        placeholder="Telefone do cliente"
                        onChange={(e) =>
                          atualizarVenda(
                            'clienteTelefone',
                            formatarTelefoneWhatsappCliente(e.target.value),
                          )
                        }
                        onBlur={(e) => void salvarTelefoneWhatsappNoCliente(e.target.value)}
                      />
                    </label>
                    <div className="whatsapp-modo">
                      <button type="button" className={modoEnvioWhatsapp === 'agora' ? 'ativo' : ''} onClick={() => setModoEnvioWhatsapp('agora')}>Enviar agora</button>
                      <button type="button" className={modoEnvioWhatsapp === 'agendar' ? 'ativo' : ''} onClick={() => setModoEnvioWhatsapp('agendar')}>Agendar envio</button>
                    </div>
                    {modoEnvioWhatsapp === 'agendar' && <div className="whatsapp-agendamento"><label>Data<input type="date" value={dataEnvioWhatsappAgendado} onChange={(e) => setDataEnvioWhatsappAgendado(e.target.value)} /></label><label>Horário<input type="time" value={horaEnvioWhatsappAgendado} onChange={(e) => setHoraEnvioWhatsappAgendado(e.target.value)} /></label></div>}
                    <button type="button" className="documento-btn destaque" onClick={agendarWhatsapp}><Clock3 size={18}/>{modoEnvioWhatsapp === 'agendar' ? 'Agendar envio' : 'Enviar agora'}</button>
                    {venda.whatsappAgendadoPara && <small>Agendado para {formatarDataBrasil(venda.dataEnvioWhatsapp)} às {venda.horarioEnvioWhatsapp}</small>}
                  </div>
                </div>
              </section>
            </div>

            {mostrarEdicaoFiscal && (
              <div className="ajuste-fiscal-overlay">
                <div className="ajuste-fiscal-modal edicao-fiscal-modal">
                  <div className="ajuste-fiscal-cabecalho"><div><h2>EDITAR DADOS DA NOTA FISCAL</h2><p>Corrija os dados do destinatário sem sair do bloco fiscal.</p></div><button type="button" onClick={() => setMostrarEdicaoFiscal(false)}>×</button></div>
                  <div className="edicao-fiscal-grid">
                    <label>CPF/CNPJ<input value={venda.clienteDocumento || ''} onChange={(e) => setVenda((a) => ({...a, clienteDocumento: e.target.value.replace(/\D/g,'').slice(0,14)}))}/></label>
                    <label>E-mail da NF-e<input type="email" value={venda.clienteEmailNotaFiscal || venda.clienteEmail || ''} onChange={(e) => setVenda((a) => ({...a, clienteEmailNotaFiscal: e.target.value}))} placeholder="E-mail para envio da NF-e, XML e boleto"/></label>
                    <label>Responsável pelo recebimento<input value={venda.responsavelEntrega || ''} onChange={(e) => setVenda((a) => ({...a, responsavelEntrega: e.target.value}))}/></label>
                    <label>Telefone / WhatsApp<input value={venda.clienteTelefone || ''} onChange={(e) => setVenda((a) => ({...a, clienteTelefone: formatarTelefoneWhatsappCliente(e.target.value)}))} onBlur={(e) => void salvarTelefoneWhatsappNoCliente(e.target.value)}/></label>
                    <label>Horário de entrega<input value={venda.horarioEntrega || ''} onChange={(e) => setVenda((a) => ({...a, horarioEntrega: e.target.value}))}/></label>
                    <label>CEP<input value={venda.faturamentoCep || ''} onChange={(e) => setVenda((a) => ({...a, faturamentoCep: e.target.value.replace(/\D/g,'').slice(0,8)}))}/></label>
                    <label>Logradouro<input value={venda.faturamentoEndereco || ''} onChange={(e) => setVenda((a) => ({...a, faturamentoEndereco: e.target.value}))}/></label>
                    <label>Número<input value={venda.faturamentoNumero || ''} onChange={(e) => setVenda((a) => ({...a, faturamentoNumero: e.target.value}))}/></label>
                    <label>Complemento<input value={venda.faturamentoComplemento || ''} onChange={(e) => setVenda((a) => ({...a, faturamentoComplemento: e.target.value}))}/></label>
                    <label>Bairro<input value={venda.faturamentoBairro || ''} onChange={(e) => setVenda((a) => ({...a, faturamentoBairro: e.target.value}))}/></label>
                    <label>Município<input value={venda.faturamentoCidade || ''} onChange={(e) => setVenda((a) => ({...a, faturamentoCidade: e.target.value}))}/></label>
                    <label>UF<input maxLength={2} value={venda.faturamentoEstado || ''} onChange={(e) => setVenda((a) => ({...a, faturamentoEstado: e.target.value.toUpperCase().slice(0,2)}))}/></label>
                    <label>Data de entrega<input type="date" min={hoje()} value={venda.dataEntrega || hoje()} onChange={(e) => setVenda((a) => ({...a, dataEntrega: e.target.value}))}/></label>
                  </div>
                  <div className="ajuste-fiscal-acoes"><button type="button" onClick={() => setMostrarEdicaoFiscal(false)}>FECHAR</button><button type="button" className="salvar" onClick={salvarEdicaoFiscal}>SALVAR E REVALIDAR</button></div>
                </div>
              </div>
            )}

            {mostrarAjusteFiscal && (
              <div className="ajuste-fiscal-overlay">
                <div className="ajuste-fiscal-modal">
                  <div className="ajuste-fiscal-cabecalho">
                    <div>
                      <h2>AJUSTE NO CADASTRO DE ITENS</h2>
                      <p>Verifique o NCM, CFOP, tipo e origem dos itens abaixo.</p>
                    </div>
                    <button type="button" onClick={() => setMostrarAjusteFiscal(false)}>×</button>
                  </div>
                  <div className="ajuste-fiscal-conteudo">
                    <div className="ajuste-fiscal-grid ajuste-fiscal-titulos">
                      <span>PRODUTO/SERVIÇO</span><span>NCM</span><span>CFOP</span><span>TIPO</span><span>ORIGEM</span>
                    </div>
                    {ajustesFiscais.map((item, index) => (
                      <div className="ajuste-fiscal-grid ajuste-fiscal-linha" key={`${item.codigoProduto}-${index}`}>
                        <div><strong>{item.descricao}</strong><small>{item.codigoBarras || item.codigoProduto}</small></div>
                        <div className="ncm-busca-campo">
                          <input
                            value={buscasNcm[index] ?? item.ncm}
                            maxLength={80}
                            placeholder="Digite NCM ou produto"
                            onFocus={() => {
                              if (buscasNcm[index] === undefined) {
                                setBuscasNcm((atuais) => ({ ...atuais, [index]: item.ncm || '' }))
                              }
                            }}
                            onChange={(e) => alterarBuscaNcm(index, e.target.value, item.descricao)}
                          />
                          {buscandoNcmPorLinha[index] && <small className="ncm-buscando">Buscando...</small>}
                          {item.ncm && (sugestoesNcm[index] || []).find((s) => s.codigo === item.ncm)?.descricao && (
                            <small className="ncm-descricao-selecionada">
                              {(sugestoesNcm[index] || []).find((s) => s.codigo === item.ncm)?.descricao}
                            </small>
                          )}
                          {(sugestoesNcm[index] || []).length > 0 && (
                            <div className="ncm-sugestoes">
                              {(sugestoesNcm[index] || []).map((sugestao) => (
                                <button
                                  type="button"
                                  key={`${sugestao.codigo}-${sugestao.descricao}`}
                                  onMouseDown={(evento) => evento.preventDefault()}
                                  onClick={() => selecionarSugestaoNcm(index, sugestao)}
                                >
                                  <strong>{sugestao.codigo}</strong>
                                  <span>{sugestao.descricao}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input value={item.cfop} maxLength={4} inputMode="numeric" onChange={(e) => atualizarAjusteFiscal(index, 'cfop', somenteDigitosFiscal(e.target.value, 4))} />
                        <select value={item.tipoFiscal} onChange={(e) => atualizarAjusteFiscal(index, 'tipoFiscal', e.target.value)}>
                          <option>Mercadoria para Revenda</option><option>Material de Uso e Consumo</option><option>Ativo Imobilizado</option><option>Embalagem</option><option>Matéria-Prima</option><option>Produto Acabado</option><option>Serviços</option><option>Outros</option>
                        </select>
                        <select value={item.origem} onChange={(e) => atualizarAjusteFiscal(index, 'origem', e.target.value)}>
                          <option>0 - Nacional</option><option>1 - Estrangeira - Importação direta</option><option>2 - Estrangeira - Adquirida no mercado interno</option><option>3 - Nacional, conteúdo importação superior a 40%</option><option>4 - Nacional, processos produtivos básicos</option><option>5 - Nacional, conteúdo importação inferior ou igual a 40%</option><option>6 - Estrangeira - Importação direta sem similar nacional</option><option>7 - Estrangeira - Mercado interno sem similar nacional</option><option>8 - Nacional, conteúdo importação superior a 70%</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="ajuste-fiscal-acoes">
                    <button type="button" onClick={() => setMostrarAjusteFiscal(false)}>FECHAR</button>
                    <button type="button" className="salvar" onClick={salvarAjustesFiscais}>SALVAR</button>
                  </div>
                </div>
              </div>
            )}

            <div className="form-footer">
              <button
                type="button"
                className="save-secondary-button pedido-footer-imprimir"
                onClick={imprimirPedido}
                title="Imprimir PDF do pedido"
              >
                <Printer size={18} />
                Imprimir
              </button>

              {venda.statusPedido !== 'Concluído' &&
                venda.statusPedido !== 'Entregue' &&
                venda.statusPedido !== 'Cancelado' && (
                  <button
                    type="button"
                    className="save-secondary-button"
                    onClick={concluirPedido}
                  >
                    <FileCheck size={18} />
                    Concluir Pedido
                  </button>
                )}

              {venda.statusPedido === 'Concluído' && !venda.estoqueBaixado && (
                <button
                  type="button"
                  className="save-button"
                  onClick={entregarPedido}
                  disabled={entregaEmProcessamento}
                >
                  <PackageCheck size={18} />
                  {entregaEmProcessamento ? 'ENTREGANDO...' : 'ENTREGAR'}
                </button>
              )}

              {venda.statusPedido === 'Entregue' && (
                <button type="button" className="save-secondary-button" disabled>
                  <PackageCheck size={18} />
                  ENTREGUE
                </button>
              )}

              <button
                type="button"
                className="save-secondary-button"
                onClick={salvarPedido}
              >
                <Save size={18} />
                Salvar
              </button>

              <button
                type="button"
                className="save-button"
                onClick={salvarEVoltar}
              >
                <Save size={18} />
                Salvar e Voltar
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default PedidoForm
