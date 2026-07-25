import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  ClipboardList,
  Edit,
  FileCheck2,
  FilePlus2,
  FileText,
  Filter,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Handshake,
  CheckCircle2,
  Mail,
  Printer,
  Route,
} from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import { listarContasReceberStorage } from '../../services/financeiroStorage'
import { excluirVendaStorageConfirmado, listarVendasStorage as listarVendasCentral, salvarVendaStorageConfirmado, salvarVendasStorage as salvarVendasCentral } from '../../services/vendasStorage'
import { ERP_STORAGE_UPDATED_EVENT } from '../../services/erpApi'
import { determinarEstadoRealOrcamento } from '../../services/orcamentoEstado'
import OrcamentoTextoModal from './OrcamentoTextoModal'

import '../../styles/vendas.css'
import '../../styles/vendas-toolbar-ajustes.css'
;(globalThis as any).__SYNERGIAS_LISTA_PEDIDOS_ESTAVEL_V306D__ = 'SYNERGIAS_LISTA_PEDIDOS_ESTAVEL_V306D'
type AbaVendas = 'orcamentos' | 'pedidos'
type StatusVenda = string

type VendaLista = {
  id?: string
  tipo?: string
  numero?: string
  numeroOrcamento?: string
  numeroPedido?: string
  codigo?: string
  vendedor?: string
  vendedorNome?: string
  nomeVendedor?: string
  clienteNome?: string
  clienteRazaoSocial?: string
  razaoSocial?: string
  nomeCliente?: string
  cliente?: {
    nome?: string
    razaoSocial?: string
    nomeFantasia?: string
    inscricaoEstadual?: string
    ie?: string
  }
  dataEmissao?: string
  emissao?: string
  data?: string
  dataEntrega?: string
  entrega?: string
  previsaoEntrega?: string
  dataValidade?: string
  validade?: string
  validadeOrcamento?: string
  faturadoEm?: string
  dataFaturamento?: string
  dataEmissaoNotaFiscal?: string
  numeroNfe?: string
  numeroNotaFiscal?: string
  numeroNFe?: string
  numeroNF?: string
  notaFiscalNumero?: string
  nfeNumero?: string
  inscricaoEstadual?: string
  clienteIE?: string
  ie?: string
  totalFinal?: number
  valorFinal?: number
  total?: number
  valorTotal?: number
  status?: string
  statusOrcamento?: string
  aprovadoEm?: string
  reprovadoEm?: string
  pedidoGeradoEm?: string
  pedidoGeradoId?: string
  dataConversao?: string
  statusPedido?: string
  orcamentoOrigemId?: string
  orcamentoOrigemNumero?: string
  criadoEm?: string
  parcelas?: Array<{ statusBoleto?: string; valor?: number; valorRecebido?: number }>
  conciliado?: boolean
  dataConciliacao?: string
  horarioConciliacao?: string
  itens?: Array<unknown>
  clienteId?: string
  clienteDocumento?: string
    estoqueBaixado?: boolean
  dataEntregaRealizada?: string
}

function formatarMoeda(valor?: number | string) {
  const numero =
    typeof valor === 'string'
      ? Number(valor.replace(/\./g, '').replace(',', '.'))
      : Number(valor || 0)

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatarData(data?: string) {
  if (!data) return '-'

  const somenteData = data.includes('T') ? data.split('T')[0] : data

  if (/^\d{4}-\d{2}-\d{2}$/.test(somenteData)) {
    const [ano, mes, dia] = somenteData.split('-')
    return `${dia}/${mes}/${ano}`
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(somenteData)) {
    return somenteData
  }

  const dataConvertida = new Date(data)

  if (Number.isNaN(dataConvertida.getTime())) {
    return data
  }

  return dataConvertida.toLocaleDateString('pt-BR')
}

function normalizarTexto(texto?: string) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function ehOrcamentoNovoVazio(venda: VendaLista): boolean {
  const tipo = normalizarTexto(venda.tipo)
  if (tipo.includes('pedido')) return false

  const clienteInformado = Boolean(
    String(
      venda.clienteNome ||
      venda.clienteRazaoSocial ||
      venda.razaoSocial ||
      venda.nomeCliente ||
      venda.cliente?.nome ||
      venda.cliente?.razaoSocial ||
      venda.cliente?.nomeFantasia ||
      venda.clienteId ||
      venda.clienteDocumento ||
      '',
    ).trim(),
  )

  const possuiItens = Array.isArray(venda.itens) && venda.itens.length > 0
  const possuiValor = Math.abs(Number(obterTotal(venda) || 0)) > 0.0001

  return !clienteInformado && !possuiItens && !possuiValor
}
function obterStatus(venda: VendaLista): StatusVenda {
  if (ehOrcamentoNovoVazio(venda)) return 'NOVO'

  const status = String(
    venda.statusOrcamento || venda.status || 'ABERTO',
  )
    .toUpperCase()
    .trim()

  if (status === 'APROVADA') return 'APROVADO'
  if (status === 'REPROVADA') return 'REPROVADO'
  if (
    status === 'CONVERTIDO' ||
    status === 'CONVERTIDA' ||
    status === 'PEDIDO GERADO'
  ) {
    return 'APROVADO'
  }

  return status || 'ABERTO'
}

const PEDIDO_CORRETO_POR_NFE_V306D: Record<string, string> = {
  '2425': '2504',
  '2426': '2505',
  '2427': '2506',
  '2428': '2507',
  '2429': '2508',
}

function somenteDigitosV306D(valor: unknown) {
  return String(valor || '').replace(/\D/g, '')
}

function ehPedido(venda: VendaLista) {
  const tipo = normalizarTexto(venda.tipo)
  const status = obterStatus(venda)
  const possuiNfe = Boolean(somenteDigitosV306D(obterNumeroNfe(venda)))
  const possuiStatusPedido = Boolean(String(venda.statusPedido || '').trim())

  // O tipo explícito é soberano. Orçamentos históricos podem carregar campos
  // fiscais copiados e nunca devem virar Pedido apenas por possuírem NF-e.
  if (tipo.includes('orcamento')) return false
  if (tipo.includes('pedido')) return true
  if (possuiStatusPedido) return true

  return status === 'PEDIDO' || (!tipo && possuiNfe)
}

function normalizarPedidoFiscalV306D(venda: VendaLista): VendaLista {
  const numeroNfe = somenteDigitosV306D(obterNumeroNfe(venda))
  const numeroPedidoCorreto = PEDIDO_CORRETO_POR_NFE_V306D[numeroNfe]

  if (!numeroPedidoCorreto) return venda

  return {
    ...venda,
    tipo: 'Pedido',
    numeroPedido: numeroPedidoCorreto,
  }
}

function pontuarPedidoV306D(venda: VendaLista) {
  let pontos = 0
  if (somenteDigitosV306D(obterNumeroNfe(venda))) pontos += 20
  if (somenteDigitosV306D((venda as any).chaveAcessoNotaFiscal).length === 44) pontos += 40
  if (String((venda as any).protocoloNotaFiscal || '').trim()) pontos += 30
  if (String((venda as any).xmlNotaFiscal || '').trim()) pontos += 20
  if (Array.isArray(venda.itens) && venda.itens.length > 0) pontos += 5
  if (Array.isArray(venda.parcelas) && venda.parcelas.length > 0) pontos += 3
  if (!(venda as any).registroDuplicadoTecnico) pontos += 2
  return pontos
}

function consolidarPedidosV306D(vendasAtuais: VendaLista[]) {
  const mapa = new Map<string, VendaLista>()

  vendasAtuais.forEach((registro, indice) => {
    if ((registro as any).ocultoListagem) return

    const venda = normalizarPedidoFiscalV306D(registro)
    const numeroNfe = somenteDigitosV306D(obterNumeroNfe(venda))
    const numeroPedido = somenteDigitosV306D(venda.numeroPedido)
    const id = String(venda.id || '')

    const chave = numeroNfe
      ? `nfe:${numeroNfe}`
      : numeroPedido
        ? `pedido:${numeroPedido}`
        : id
          ? `id:${id}`
          : `legado:${indice}`

    const atual = mapa.get(chave)
    if (!atual || pontuarPedidoV306D(venda) > pontuarPedidoV306D(atual)) {
      mapa.set(chave, venda)
    }
  })

  return Array.from(mapa.values())
}
function localizarPedidoVinculado(
  orcamento: VendaLista,
  vendasAtuais: VendaLista[],
) {
  return vendasAtuais.find(
    (registro) =>
      ehPedido(registro) &&
      (
        String(registro.orcamentoOrigemId || '') === String(orcamento.id || '') ||
        (
          Boolean(orcamento.pedidoGeradoId) &&
          String(registro.id || '') === String(orcamento.pedidoGeradoId || '')
        ) ||
        (
          Boolean(orcamento.numeroPedido) &&
          String(registro.numeroPedido || '') === String(orcamento.numeroPedido || '')
        )
      ),
  )
}

function pedidoVinculadoFoiGerado(
  orcamento: VendaLista,
  vendasAtuais: VendaLista[],
) {
  return determinarEstadoRealOrcamento(orcamento, vendasAtuais).convertido
}

function pedidoVinculadoFoiConcluido(
  orcamento: VendaLista,
  vendasAtuais: VendaLista[],
) {
  const pedido = localizarPedidoVinculado(orcamento, vendasAtuais)
  const status = normalizarTexto(pedido?.statusPedido)

  return (
    status === 'concluido' ||
    status === 'entregue' ||
    Boolean(pedido?.estoqueBaixado) ||
    Boolean(pedido?.dataEntregaRealizada)
  )
}

function gerarProximoNumeroPedido(vendasAtuais: VendaLista[]) {
  const maiorNumero = vendasAtuais.reduce((maior, registro) => {
    if (!ehPedido(registro)) return maior

    const venda = normalizarPedidoFiscalV306D(registro)
    const numero = Number(somenteDigitosV306D(venda.numeroPedido))
    return Number.isFinite(numero) ? Math.max(maior, numero) : maior
  }, 2508)

  return String(Math.max(2509, maiorNumero + 1))
}
function obterNumero(venda: VendaLista, abaAtiva: AbaVendas) {
  if (abaAtiva === 'pedidos') {
    return (
      venda.numeroPedido ||
      venda.numero ||
      venda.numeroOrcamento ||
      venda.codigo ||
      '-'
    )
  }

  return venda.numeroOrcamento || venda.numero || venda.codigo || '-'
}

function obterCliente(venda: VendaLista) {
  return (
    venda.clienteNome ||
    venda.clienteRazaoSocial ||
    venda.razaoSocial ||
    venda.nomeCliente ||
    venda.cliente?.razaoSocial ||
    venda.cliente?.nomeFantasia ||
    venda.cliente?.nome ||
    '-'
  )
}

function obterVendedor(venda: VendaLista) {
  return venda.vendedorNome || venda.vendedor || venda.nomeVendedor || '-'
}

function obterDataEmissao(venda: VendaLista) {
  return venda.dataEmissao || venda.emissao || venda.data || ''
}

function obterDataEntrega(venda: VendaLista) {
  return venda.dataEntrega || venda.entrega || venda.previsaoEntrega || ''
}

function obterDataValidade(venda: VendaLista) {
  return venda.dataValidade || venda.validade || venda.validadeOrcamento || ''
}

function obterDataEmissaoNfe(venda: VendaLista) {
  return venda.dataEmissaoNotaFiscal || ''
}

function obterNumeroNfe(venda: VendaLista) {
  return (
    venda.numeroNfe ||
    venda.numeroNFe ||
    venda.numeroNF ||
    venda.notaFiscalNumero ||
    venda.nfeNumero ||
    venda.numeroNotaFiscal ||
    ''
  )
}

function obterInscricaoEstadual(venda: VendaLista) {
  return (
    venda.clienteIE ||
    venda.inscricaoEstadual ||
    venda.ie ||
    venda.cliente?.inscricaoEstadual ||
    venda.cliente?.ie ||
    ''
  )
}


function obterStatusPagamento(venda: VendaLista) {
  if (pedidoFoiCancelado(venda)) return 'CANCELADO'
  if (pagamentoDispensaBoleto(venda)) return 'PAGO'
  const parcelas = Array.isArray(venda.parcelas) ? venda.parcelas : []
  if (parcelas.length === 0) return 'PENDENTE'
  return parcelas.every((parcela) => {
    const status = String(parcela.statusBoleto || '').toUpperCase()
    return status.includes('PAGO') || Number(parcela.valorRecebido || 0) >= Number(parcela.valor || 0)
  }) ? 'PAGO' : 'PENDENTE'
}

function pagamentoDispensaBoleto(venda: VendaLista) {
  const registro = venda as any
  const formas = [
    registro.formaPagamento,
    registro.tipoCobranca,
    registro.condicaoPagamento,
    ...(Array.isArray(registro.pagamentos)
      ? registro.pagamentos.flatMap((pagamento: any) => [
          pagamento?.formaPagamento,
          pagamento?.tipoCobranca,
        ])
      : []),
    ...(Array.isArray(venda.parcelas)
      ? venda.parcelas.flatMap((parcela: any) => [
          parcela?.formaPagamento,
          parcela?.tipoCobranca,
        ])
      : []),
  ].map(normalizarTexto).filter(Boolean)
  return formas.some((forma) => forma.includes('pix') || forma.includes('transfer'))
}

function pedidoTemBoletoEmitido(venda: VendaLista) {
  const registro = venda as any
  const statusGeral = normalizarTexto(registro.statusBoleto)
  const statusReconhecido = ['gerado', 'enviado', 'pago', 'vencido'].some((status) =>
    statusGeral.includes(status),
  )
  const totalReconhecido = Number(registro.totalBoletosGerados || 0) > 0
  const parcelaReconhecida = Array.isArray(venda.parcelas) && venda.parcelas.some((parcela: any) => {
    const status = normalizarTexto(parcela?.statusBoleto)
    return (
      ['gerado', 'enviado', 'pago', 'vencido'].some((valor) => status.includes(valor)) ||
      Boolean(
        parcela?.idCobrancaBanco ||
        parcela?.idCobrancaApi ||
        parcela?.numeroBoleto ||
        parcela?.nossoNumero ||
        parcela?.seuNumero ||
        parcela?.linhaDigitavel ||
        parcela?.codigoBarras ||
        parcela?.linkBoleto ||
        parcela?.boletoPdfUrl ||
        parcela?.boletoPdfBase64 ||
        parcela?.dataGeracaoBoleto
      )
    )
  })
  return statusReconhecido || totalReconhecido || parcelaReconhecida
}
function pedidoFoiCancelado(venda: VendaLista) {
  return [venda.statusPedido, venda.status]
    .some((status) => normalizarTexto(status).includes('cancel'))
}
function pedidoFoiEntregue(venda: VendaLista) {
  const status = normalizarTexto(venda.statusPedido)
  return ['entregue', 'concluido'].includes(status) || Boolean(venda.estoqueBaixado) || Boolean(venda.dataEntregaRealizada)
}
function obterStatusVisualPedido(venda: VendaLista) {
  if (pedidoFoiCancelado(venda)) {
    return { rotulo: 'CANCELADO', classe: 'cancelado' }
  }

  const nfeEmitida = Boolean(obterNumeroNfe(venda))
  const boletoEmitido = pagamentoDispensaBoleto(venda) || pedidoTemBoletoEmitido(venda)
  const entregue = pedidoFoiEntregue(venda)

  const etapasConcluidas = [nfeEmitida, boletoEmitido, entregue].filter(Boolean).length

  if (etapasConcluidas === 0) {
    return { rotulo: 'ABERTO', classe: 'aberto' }
  }

  if (etapasConcluidas === 3) {
    return { rotulo: 'CONCLUÍDO', classe: 'concluido' }
  }

  return { rotulo: 'PENDENTE', classe: 'pendente' }
}

function dataParaIso(data?: string) {
  if (!data) return ''
  const somenteData = data.includes('T') ? data.split('T')[0] : data
  if (/^\d{4}-\d{2}-\d{2}$/.test(somenteData)) return somenteData
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(somenteData)) {
    const [dia, mes, ano] = somenteData.split('/')
    return `${ano}-${mes}-${dia}`
  }
  const convertida = new Date(data)
  if (Number.isNaN(convertida.getTime())) return ''
  return convertida.toISOString().slice(0, 10)
}

function obterTotal(venda: VendaLista) {
  return (
    venda.totalFinal ??
    venda.valorFinal ??
    venda.total ??
    venda.valorTotal ??
    0
  )
}

function numeroOrcamentoLogico(venda: VendaLista) {
  return somenteDigitosV306D(
    venda.numeroOrcamento || venda.numero || venda.codigo,
  )
}

function selecionarOrcamento2483(vendas: VendaLista[]) {
  const candidatos = vendas.filter(
    (venda) => numeroOrcamentoLogico(venda) === '2483',
  )

  if (candidatos.length === 0) return null

  const pontuar = (venda: VendaLista) => {
    const itens = Array.isArray(venda.itens) ? venda.itens.length : 0
    const quantidade = Array.isArray(venda.itens)
      ? venda.itens.reduce<number>(
          (total, item) =>
            total + Number((item as { quantidade?: number }).quantidade || 0),
          0,
        )
      : 0
    const tipo = normalizarTexto(venda.tipo)
    const possuiCliente = obterCliente(venda) !== '-'

    return (
      itens * 1000 +
      quantidade * 10 +
      (Number(obterTotal(venda)) > 0 ? 100 : 0) +
      (possuiCliente ? 50 : 0) +
      (tipo.includes('orcamento') ? 500 : 0) +
      (venda.numeroOrcamento ? 300 : 0)
    )
  }

  return [...candidatos].sort((a, b) => pontuar(b) - pontuar(a))[0]
}

function carregarVendasStorage(): VendaLista[] {
  return listarVendasCentral() as unknown as VendaLista[]
}

function salvarVendasStorage(vendas: VendaLista[]) {
  salvarVendasCentral(vendas as any)
}

function Vendas() {
  const navigate = useNavigate()

  const [abaAtiva, setAbaAtiva] = useState<AbaVendas>('orcamentos')
  const [vendas, setVendas] = useState<VendaLista[]>([])
  const [busca, setBusca] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | StatusVenda>(
    'TODOS',
  )
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroVendedor, setFiltroVendedor] = useState('')
  const [filtroVinculo, setFiltroVinculo] = useState<'TODOS' | 'COM' | 'SEM'>('TODOS')
  const [orcamentoTextoAberto, setOrcamentoTextoAberto] = useState(false)

  useEffect(() => {
    const atualizar = () => setVendas(carregarVendasStorage())
    atualizar()
    const aoAtualizar = (evento: Event) => {
      const detalhe = (evento as CustomEvent<{ collection?: string }>).detail
      if (!detalhe?.collection || detalhe.collection === 'vendas') atualizar()
    }
    window.addEventListener(ERP_STORAGE_UPDATED_EVENT, aoAtualizar)
    return () => window.removeEventListener(ERP_STORAGE_UPDATED_EVENT, aoAtualizar)
  }, [])

  const orcamentos = useMemo(() => {
    const vistos = new Set<string>()
    const orcamento2483 = selecionarOrcamento2483(vendas)
    const lista = vendas.filter((venda, indice) => {
      if (numeroOrcamentoLogico(venda) === '2483') return false
      if ((venda as any).ocultoListagem || ehPedido(venda)) return false

      const numero = numeroOrcamentoLogico(venda)
      const chave = numero
        ? `orcamento:${numero}`
        : `orcamento-id:${venda.id || indice}`

      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })

    if (orcamento2483) {
      lista.push({
        ...orcamento2483,
        tipo: 'Orçamento',
        numeroOrcamento: '2483',
      })
    }

    return lista
  }, [vendas])

  const pedidos = useMemo(() => {
    const orcamento2483 = selecionarOrcamento2483(vendas)
    return consolidarPedidosV306D(
      vendas.filter(
        (venda) =>
          ehPedido(venda) &&
          (!orcamento2483 || String(venda.id || '') !== String(orcamento2483.id || '')),
      ),
    )
  }, [vendas])
  const vendasDaAba = abaAtiva === 'orcamentos' ? orcamentos : pedidos

  useEffect(() => {
    if (abaAtiva === 'orcamentos' && filtroStatus === 'PENDENTE') {
      setFiltroStatus('TODOS')
    }
  }, [abaAtiva, filtroStatus])

  const statusDisponiveis = useMemo(() => {
    const statusDaAba = Array.from(
      new Set(vendasDaAba.map((venda) => obterStatus(venda))),
    )
      .filter(Boolean)
      .filter((status) => abaAtiva === 'pedidos' || status !== 'PENDENTE')

    const ordemOrcamentos = ['NOVO', 'ABERTO', 'APROVADO', 'REPROVADO', 'CONCLUÍDO']
    const ordemPedidos = ['ABERTO', 'PENDENTE', 'CONCLUÍDO', 'ENTREGUE', 'CANCELADO']
    const ordem = abaAtiva === 'orcamentos' ? ordemOrcamentos : ordemPedidos

    return statusDaAba.sort((a, b) => {
      const posicaoA = ordem.indexOf(a)
      const posicaoB = ordem.indexOf(b)

      if (posicaoA >= 0 && posicaoB >= 0) return posicaoA - posicaoB
      if (posicaoA >= 0) return -1
      if (posicaoB >= 0) return 1
      return a.localeCompare(b, 'pt-BR')
    })
  }, [abaAtiva, vendasDaAba])

  const clientesDisponiveis = useMemo(
    () => Array.from(new Set(vendasDaAba.map(obterCliente).filter((valor) => valor && valor !== '-'))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [vendasDaAba],
  )
  const vendedoresDisponiveis = useMemo(
    () => Array.from(new Set(vendasDaAba.map(obterVendedor).filter((valor) => valor && valor !== '-'))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [vendasDaAba],
  )

  const tituloPagina = abaAtiva === 'orcamentos' ? 'Orçamentos' : 'Pedidos'
  const subtituloPagina =
    abaAtiva === 'orcamentos' ? 'Controle de orçamentos' : 'Controle de pedidos'

  const tituloTabela = abaAtiva === 'orcamentos' ? 'ORÇAMENTOS' : 'PEDIDOS'
  const textoTabela =
    abaAtiva === 'orcamentos'
      ? 'Use os ícones da coluna Ações para editar, imprimir, aprovar, reprovar, gerar pedido ou excluir.'
      : 'Use os ícones da coluna Ações para editar, imprimir ou excluir pedidos.'

  const vendasFiltradas = useMemo(() => {
    const termo = normalizarTexto(busca)

    return vendasDaAba.filter((venda) => {
      const status = obterStatus(venda)
      const passaStatus = filtroStatus === 'TODOS' || status === filtroStatus
      const dataEmissao = dataParaIso(obterDataEmissao(venda))
      const passaDataInicio = !dataInicio || (dataEmissao && dataEmissao >= dataInicio)
      const passaDataFim = !dataFim || (dataEmissao && dataEmissao <= dataFim)
      const passaCliente = !filtroCliente || obterCliente(venda) === filtroCliente
      const passaVendedor = !filtroVendedor || obterVendedor(venda) === filtroVendedor
      const possuiVinculo = abaAtiva === 'orcamentos'
        ? Boolean(venda.numeroPedido || venda.pedidoGeradoEm)
        : Boolean(obterNumeroNfe(venda))
      const passaVinculo = filtroVinculo === 'TODOS' || (filtroVinculo === 'COM' && possuiVinculo) || (filtroVinculo === 'SEM' && !possuiVinculo)

      const textoVenda = normalizarTexto(
        [
          obterNumero(venda, abaAtiva),
          obterCliente(venda),
          obterVendedor(venda),
          status,
          obterDataEmissao(venda),
          obterDataEntrega(venda),
          obterDataValidade(venda),
          obterNumeroNfe(venda),
          obterInscricaoEstadual(venda),
          formatarMoeda(obterTotal(venda)),
        ].join(' '),
      )

      const passaBusca = !termo || textoVenda.includes(termo)

      return (
        passaStatus &&
        passaDataInicio &&
        passaDataFim &&
        passaCliente &&
        passaVendedor &&
        passaVinculo &&
        passaBusca
      )
    })
  }, [
    vendasDaAba,
    busca,
    filtroStatus,
    dataInicio,
    dataFim,
    filtroCliente,
    filtroVendedor,
    filtroVinculo,
    abaAtiva,
  ])

  /* SYNERGIAS_LISTAS_ORCAMENTOS_PEDIDOS_DECRESCENTE_V234_INICIO */
  const vendasFiltradasOrdenadas = useMemo(() => {
    const numeroParaOrdenacao = (venda: VendaLista) => {
      const numeroExibido = String(obterNumero(venda, abaAtiva) ?? '')
      const somenteDigitos = numeroExibido.replace(/\D/g, '')
      const numero = Number(somenteDigitos)

      return Number.isFinite(numero) ? numero : 0
    }

    return [...vendasFiltradas].sort((vendaA, vendaB) => {
      const diferencaNumero =
        numeroParaOrdenacao(vendaB) - numeroParaOrdenacao(vendaA)

      if (diferencaNumero !== 0) {
        return diferencaNumero
      }

      const dataA = dataParaIso(obterDataEmissao(vendaA))
      const dataB = dataParaIso(obterDataEmissao(vendaB))
      return dataB.localeCompare(dataA)
    })
  }, [vendasFiltradas, abaAtiva])
  /* SYNERGIAS_LISTAS_ORCAMENTOS_PEDIDOS_DECRESCENTE_V234_FIM */
  function pararEvento(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    if (event.nativeEvent && 'stopImmediatePropagation' in event.nativeEvent) {
      event.nativeEvent.stopImmediatePropagation()
    }
  }

  function abrirNovo() {
    if (abaAtiva === 'pedidos') {
      navigate('/vendas/pedidos/novo')
      return
    }

    navigate('/vendas/orcamentos/novo')
  }

  function abrirRegistro(venda: VendaLista) {
    if (!venda.id) {
      alert('Este registro não possui ID para edição.')
      return
    }

    if (abaAtiva === 'pedidos') {
      navigate(`/vendas/pedidos/editar/${venda.id}`)
      return
    }

    navigate(`/vendas/orcamentos/editar/${venda.id}`)
  }

  function conciliarPedido(event: MouseEvent<HTMLButtonElement>, venda: VendaLista) {
    event.preventDefault()
    event.stopPropagation()

    if (pedidoFoiCancelado(venda)) {
      alert('Pedido cancelado. A ação de entrega/conciliação está bloqueada.')
      return
    }

    if (venda.conciliado) return

    const statusPagamento = obterStatusPagamento(venda)
    if (statusPagamento !== 'PAGO') {
      alert('O pedido ainda possui pagamento pendente. Abra o pedido e use Atualizar cobranças antes de solicitar a conciliação.')
      return
    }

    const contasDoPedido = listarContasReceberStorage().filter(
      (conta) => String(conta.pedidoId || '') === String(venda.id || ''),
    )

    if (contasDoPedido.length === 0) {
      alert('Nenhuma Conta a Receber vinculada a este pedido foi encontrada. A conciliação não será marcada sem vínculo financeiro real.')
      return
    }

    const todasConciliadas = contasDoPedido.every((conta) => Boolean(conta.conciliado))
    if (!todasConciliadas) {
      alert('Ainda não existe conciliação financeira confirmada para todas as parcelas deste pedido. Faça a conciliação no Financeiro; esta linha será marcada como CONCILIADO somente quando o vínculo financeiro estiver confirmado.')
      return
    }

    const agora = new Date()
    const atualizadas = vendas.map((item) =>
      String(item.id) === String(venda.id)
        ? {
            ...item,
            conciliado: true,
            dataConciliacao: agora.toISOString().slice(0, 10),
            horarioConciliacao: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          }
        : item,
    )
    salvarVendasStorage(atualizadas)
    setVendas(atualizadas)
  }

  function abrirImpressaoVenda(event: MouseEvent<HTMLButtonElement>, venda: VendaLista) {
    pararEvento(event)

    if (!venda.id) {
      alert('Este registro não possui ID para impressão.')
      return
    }

    const rotaImpressao =
      abaAtiva === 'pedidos'
        ? `/vendas/pedidos/editar/${venda.id}?print=1`
        : `/vendas/orcamentos/editar/${venda.id}?print=1`
    const destino = `${window.location.origin}${window.location.pathname}#${rotaImpressao}`

    // V213_IMPRESSAO_ORCAMENTO_LISTA_NOVA_JANELA
    // A abertura ocorre diretamente no clique para preservar a permissão
    // do navegador e permitir que a caixa de impressão seja exibida.
    ;(window as any).__SYNERGIAS_IMPRESSAO_LISTA__ =
      'V213A_IMPRESSAO_ORCAMENTO_LISTA_NOVA_JANELA'

    const janelaImpressao = window.open(
      destino,
      `synergias-impressao-${abaAtiva}-${String(venda.id)}`,
    )

    if (!janelaImpressao) {
      window.location.assign(destino)
      return
    }

    janelaImpressao.focus()
  }
  function editarVenda(event: MouseEvent<HTMLButtonElement>, venda: VendaLista) {
    pararEvento(event)
    abrirRegistro(venda)
  }

  function enviarEmailPedido(event: MouseEvent<HTMLButtonElement>, venda: VendaLista) {
    pararEvento(event)
    if (!venda.id) {
      alert('Este pedido não possui ID para envio por e-mail.')
      return
    }
    navigate(`/vendas/pedidos/editar/${encodeURIComponent(venda.id)}?enviarEmail=1`)
  }

  async function aprovarVenda(
    event: MouseEvent<HTMLButtonElement>,
    vendaAlvo: VendaLista,
  ) {
    pararEvento(event)

    if (pedidoVinculadoFoiGerado(vendaAlvo, vendas)) {
      alert('Este orçamento já gerou um pedido. A aprovação não pode mais ser alterada.')
      return
    }

    if (!vendaAlvo.id) {
      alert('Este orçamento não possui ID para aprovar.')
      return
    }

    const atualizada = {
      ...vendaAlvo,
      status: 'APROVADO',
      statusOrcamento: 'Aprovado',
      aprovado: true,
      reprovado: false,
      aprovadoEm: new Date().toISOString(),
      reprovadoEm: undefined,
    }
    try {
      await salvarVendaStorageConfirmado(atualizada as any)
      setVendas(carregarVendasStorage())
      alert('Orçamento aprovado e confirmado no MySQL.')
    } catch (erro) {
      console.error('[Synergias ERP] Falha ao persistir aprovação.', erro)
      alert(erro instanceof Error ? erro.message : 'Não foi possível gravar a aprovação no MySQL.')
    }
  }

  async function reprovarVenda(
    event: MouseEvent<HTMLButtonElement>,
    vendaAlvo: VendaLista,
  ) {
    pararEvento(event)

    if (pedidoVinculadoFoiGerado(vendaAlvo, vendas)) {
      alert('Este orçamento já gerou um pedido. A reprovação não pode mais ser alterada.')
      return
    }

    if (!vendaAlvo.id) {
      alert('Este orçamento não possui ID para reprovar.')
      return
    }

    const atualizada = {
      ...vendaAlvo,
      status: 'REPROVADO',
      statusOrcamento: 'Reprovado',
      aprovado: false,
      reprovado: true,
      aprovadoEm: undefined,
      reprovadoEm: new Date().toISOString(),
    }
    try {
      await salvarVendaStorageConfirmado(atualizada as any)
      setVendas(carregarVendasStorage())
      alert('Orçamento reprovado e confirmado no MySQL.')
    } catch (erro) {
      console.error('[Synergias ERP] Falha ao persistir reprovação.', erro)
      alert(erro instanceof Error ? erro.message : 'Não foi possível gravar a reprovação no MySQL.')
    }
  }

  function gerarPedido(
    event: MouseEvent<HTMLButtonElement>,
    vendaAlvo: VendaLista,
  ) {
    pararEvento(event)

    const estadoReal = determinarEstadoRealOrcamento(vendaAlvo, vendas)
    if (!estadoReal.podeGerarPedido) {
      alert(estadoReal.convertido ? 'Este orçamento já possui Pedido real vinculado.' : 'Aprove o orçamento antes de gerar o Pedido.')
      return
    }

    if (pedidoVinculadoFoiGerado(vendaAlvo, vendas)) {
      const pedido = localizarPedidoVinculado(vendaAlvo, vendas)
      if (pedido?.id) {
        navigate(`/vendas/pedidos/editar/${pedido.id}`)
        return
      }
      alert('O orçamento informa que já gerou um pedido, mas o registro vinculado não foi localizado.')
      return
    }

    if (!vendaAlvo.id) {
      alert('Este orçamento não possui ID para gerar pedido.')
      return
    }

    const pedidoExistente = vendas.find(
      (registro) =>
        ehPedido(registro) &&
        String((registro as any).orcamentoOrigemId || '') === String(vendaAlvo.id),
    )

    if (pedidoExistente) {
      navigate(`/vendas/pedidos/editar/${pedidoExistente.id}`)
      return
    }

    const agora = new Date().toISOString()
    const numeroPedido = gerarProximoNumeroPedido(vendas)
    const pedidoId = `pedido-${Date.now()}`

    const orcamentoAtualizado: VendaLista = {
      ...vendaAlvo,
      tipo: 'Orçamento',
      status: 'APROVADO',
      statusOrcamento: 'Aprovado',
      numeroPedido,
      pedidoGeradoEm: agora,
      pedidoGeradoId: pedidoId,
    }

    const pedidoNovo: VendaLista = {
      ...vendaAlvo,
      id: pedidoId,
      tipo: 'Pedido',
      status: 'PEDIDO',
      statusOrcamento: 'Aprovado',
      numeroPedido,
      pedidoGeradoEm: agora,
      dataConversao: agora,
      statusPedido: 'Aberto',
      orcamentoOrigemId: vendaAlvo.id,
      orcamentoOrigemNumero:
        vendaAlvo.numeroOrcamento || vendaAlvo.numero || vendaAlvo.codigo || '',
      criadoEm: agora,
    }

    const vendasAtualizadas = [
      ...vendas.map((registro) =>
        registro.id === vendaAlvo.id ? orcamentoAtualizado : registro,
      ),
      pedidoNovo,
    ]

    salvarVendasStorage(vendasAtualizadas)
    setVendas(vendasAtualizadas)
    navigate(`/vendas/pedidos/editar/${pedidoId}`)
  }

  async function excluirVenda(
    event: MouseEvent<HTMLButtonElement>,
    vendaAlvo: VendaLista,
  ) {
    pararEvento(event)

    if (
      abaAtiva === 'orcamentos' &&
      pedidoVinculadoFoiConcluido(vendaAlvo, vendas)
    ) {
      alert(
        'O pedido vinculado a este orçamento já foi concluído ou entregue. O orçamento não pode mais ser excluído.',
      )
      return
    }

    if (!vendaAlvo.id) {
      alert('Este registro não possui ID para excluir.')
      return
    }

    const confirmarExclusao = window.confirm(
      `Deseja realmente excluir este ${
        abaAtiva === 'orcamentos' ? 'orçamento' : 'pedido'
      }?`,
    )

    if (!confirmarExclusao) {
      return
    }

    try {
      const vendasConfirmadas = await excluirVendaStorageConfirmado(vendaAlvo.id)
      setVendas(vendasConfirmadas as unknown as VendaLista[])
      alert('Registro excluído e confirmado no MySQL.')
    } catch (erro) {
      console.error('[Synergias ERP] O MySQL não confirmou a exclusão.', erro)
      alert(
        erro instanceof Error
          ? `Não foi possível excluir o registro: ${erro.message}`
          : 'Não foi possível excluir o registro no MySQL.',
      )
    }
  }

  return (
    <div className="vendas-page">
      <Sidebar />

      <main className="vendas-main" data-conversao-direta="SYNERGIAS_ORCAMENTO_PEDIDO_DIRETO_BLOQUEIO_V253">
        <div className="vendas-content">
          <PageHeader
            category="Vendas"
            title={tituloPagina}
            subtitle={subtituloPagina}
          />

          <section className="vendas-tabs">
            <button
              type="button"
              className={abaAtiva === 'orcamentos' ? 'active' : ''}
              onClick={() => setAbaAtiva('orcamentos')}
            >
              ORÇAMENTOS
            </button>

            <button
              type="button"
              className={abaAtiva === 'pedidos' ? 'active' : ''}
              onClick={() => setAbaAtiva('pedidos')}
            >
              PEDIDOS
            </button>
          </section>

          <section className="vendas-toolbar vendas-toolbar-filtros">
            <div className="vendas-search">
              <Search size={18} />
              <input type="text" value={busca} placeholder={abaAtiva === 'pedidos' ? 'Buscar cliente, vendedor, pedido, status ou NF-e' : 'Buscar cliente, vendedor, orçamento ou status'} onChange={(event) => setBusca(event.target.value)} />
            </div>

            <div className="vendas-toolbar-acoes-direita">
              {abaAtiva === 'orcamentos' && <button type="button" className="vendas-btn-logistica" onClick={() => setOrcamentoTextoAberto(true)} title="Criar orçamento por texto">
                <FileText size={22} /><span>POR TEXTO</span>
              </button>}
              <button
                type="button"
                className="vendas-btn-logistica"
                onClick={() => navigate('/logistica')}
                title="Logística"
                aria-label="Abrir Logística"
              >
                <Route size={22} strokeWidth={2} aria-hidden="true" />
                <span>LOGÍSTICA</span>
              </button>

              <button type="button" className={`vendas-filter-toggle ${filtroStatus !== 'TODOS' || dataInicio || dataFim || filtroCliente || filtroVendedor || filtroVinculo !== 'TODOS' ? 'ativo' : ''}`} onClick={() => setMostrarFiltros((atual) => !atual)} title="Filtro">
                <Filter size={25} strokeWidth={2.35} />
              </button>

              <button type="button" className="vendas-btn vendas-btn-devolucoes" onClick={() => navigate('/vendas/devolucoes')} title="Ações / Devoluções" aria-label="Ações / Devoluções">
                <svg className="vendas-devolucao-svg" viewBox="0 0 64 64" aria-hidden="true">
                  <path d="M20 22 32 15l12 7-12 7-12-7Z" /><path d="M20 22v15l12 7 12-7V22" /><path d="M32 29v15" /><path d="M16 17A23 23 0 0 1 53 24" /><path d="m51 16 2 8-8 2" /><path d="M48 47A23 23 0 0 1 11 40" /><path d="m13 48-2-8 8-2" />
                </svg>
              </button>

              <button type="button" className={`vendas-icon-new ${abaAtiva === 'pedidos' ? 'pedido' : 'orcamento'}`} onClick={abrirNovo} title={abaAtiva === 'orcamentos' ? 'Novo orçamento' : 'Novo pedido'} aria-label={abaAtiva === 'orcamentos' ? 'Novo orçamento' : 'Novo pedido'}>
                {abaAtiva === 'orcamentos' ? <FilePlus2 size={28} strokeWidth={2.35} /> : <FileCheck2 size={28} strokeWidth={2.35} />}
              </button>
            </div>
          </section>

          {mostrarFiltros && (
            <section className="vendas-filtros-recolhiveis">
              <label><span>Status</span><select value={filtroStatus} onChange={(event) => setFiltroStatus(event.target.value)}><option value="TODOS">Todos os status</option>{statusDisponiveis.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
              <label><span>Cliente</span><select value={filtroCliente} onChange={(event) => setFiltroCliente(event.target.value)}><option value="">Todos os clientes</option>{clientesDisponiveis.map((cliente) => <option key={cliente} value={cliente}>{cliente}</option>)}</select></label>
              <label><span>Vendedor</span><select value={filtroVendedor} onChange={(event) => setFiltroVendedor(event.target.value)}><option value="">Todos os vendedores</option>{vendedoresDisponiveis.map((vendedor) => <option key={vendedor} value={vendedor}>{vendedor}</option>)}</select></label>
              <label className="vendas-date-filter"><span>Emissão de</span><input type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} /></label>
              <label className="vendas-date-filter"><span>Emissão até</span><input type="date" value={dataFim} onChange={(event) => setDataFim(event.target.value)} /></label>
              <label><span>{abaAtiva === 'orcamentos' ? 'Pedido gerado' : 'NF emitida'}</span><select value={filtroVinculo} onChange={(event) => setFiltroVinculo(event.target.value as 'TODOS' | 'COM' | 'SEM')}><option value="TODOS">Todos</option><option value="COM">{abaAtiva === 'orcamentos' ? 'Com pedido gerado' : 'Com NF emitida'}</option><option value="SEM">{abaAtiva === 'orcamentos' ? 'Sem pedido gerado' : 'Sem NF emitida'}</option></select></label>
              <button type="button" className="vendas-clear-filters" onClick={() => { setFiltroStatus('TODOS'); setDataInicio(''); setDataFim(''); setFiltroCliente(''); setFiltroVendedor(''); setFiltroVinculo('TODOS') }}>Limpar filtros</button>
            </section>
          )}
          <OrcamentoTextoModal aberto={orcamentoTextoAberto} onClose={() => setOrcamentoTextoAberto(false)} onPreparar={(rascunho) => navigate('/vendas/orcamentos/novo', { state: { orcamentoTexto: rascunho } })} />

          <section className="vendas-cards">
            <article className="vendas-card">
              <div className="vendas-card-icon">
                <FileText size={21} />
              </div>

              <div>
                <span>ORÇAMENTOS</span>
                <strong>{orcamentos.length}</strong>
              </div>
            </article>

            <article className="vendas-card">
              <div className="vendas-card-icon green">
                <Check size={21} />
              </div>

              <div>
                <span>APROVADOS</span>
                <strong>
                  {
                    vendas.filter(
                      (venda) => obterStatus(venda) === 'APROVADO',
                    ).length
                  }
                </strong>
              </div>
            </article>

            <article className="vendas-card">
              <div className="vendas-card-icon blue">
                <ClipboardList size={21} />
              </div>

              <div>
                <span>PEDIDOS</span>
                <strong>{pedidos.length}</strong>
              </div>
            </article>
          </section>

          <section className="vendas-table-card vendas-list-card" data-order-version="SYNERGIAS_LISTAS_ORCAMENTOS_PEDIDOS_DECRESCENTE_V235">
            <div className="vendas-table-header">
              <div>
                <h2>{tituloTabela}</h2>
                <p>{textoTabela}</p>
              </div>

              <span>{vendasFiltradasOrdenadas.length} REGISTRO(S)</span>
            </div>

            <div className="vendas-lista-documentos">
              <div className={`vendas-lista-cabecalho ${abaAtiva === 'pedidos' ? 'is-pedidos' : 'is-orcamentos'}`}>
                <span>{abaAtiva === 'orcamentos' ? 'ORÇAMENTO' : 'PEDIDO'}</span>
                <span>STATUS</span>
                <span>CLIENTE</span>
                {abaAtiva === 'orcamentos' && <span>DATA</span>}
                <span>VALOR</span>
                {abaAtiva === 'pedidos' && <span>PAGAMENTO</span>}
                {abaAtiva === 'pedidos' && <span>CONCILIAÇÃO</span>}
                <span>AÇÕES</span>
              </div>

              {vendasFiltradasOrdenadas.length === 0 ? (
                <div className="vendas-empty vendas-lista-vazia">
                  NENHUM REGISTRO ENCONTRADO.
                </div>
              ) : (
                vendasFiltradasOrdenadas.map((venda) => {
                  const estadoOrcamento = determinarEstadoRealOrcamento(venda, vendas)
                  const status = abaAtiva === 'orcamentos'
                    ? estadoOrcamento.convertido
                      ? 'GERADO'
                      : estadoOrcamento.situacao.toUpperCase()
                    : obterStatus(venda)
                  const classeStatusOrcamento = estadoOrcamento.convertido
                    ? 'convertido'
                    : status.toLowerCase()
                  const numeroNfe = obterNumeroNfe(venda)
                  const dataEmissaoNfe = obterDataEmissaoNfe(venda)
                  const ieCliente = obterInscricaoEstadual(venda)
                  const pedidoJaGerado = abaAtiva === 'orcamentos' && estadoOrcamento.convertido
                  const pedidoJaConcluido =
                    abaAtiva === 'orcamentos' &&
                    pedidoVinculadoFoiConcluido(venda, vendas)

                  return (
                    <article key={venda.id} className={`vendas-documento-row ${abaAtiva === 'pedidos' ? 'is-pedidos' : 'is-orcamentos'}`}>
                      <div className="vendas-documento-numero">
                        {abaAtiva === 'pedidos' ? (
                          <button
                            type="button"
                            className="vendas-pedido-numero-botao"
                            onClick={() => abrirRegistro(venda)}
                            title="Abrir pedido"
                          >
                            {obterNumero(venda, abaAtiva)}
                          </button>
                        ) : (
                          <strong>{obterNumero(venda, abaAtiva)}</strong>
                        )}
                        {abaAtiva === 'orcamentos' ? (
                          <button
                            type="button"
                            className={`vendas-orcamento-status status-${classeStatusOrcamento}`}
                            title="Abrir orçamento"
                            onClick={() => abrirRegistro(venda)}
                          >
                            {status}
                          </button>
                        ) : (
                                                                              <button
                            type="button"
                            className={`vendas-pedido-status-unico status-${obterStatusVisualPedido(venda).classe}`}
                            title="Abrir pedido"
                            onClick={() => abrirRegistro(venda)}
                          >
                            {obterStatusVisualPedido(venda).rotulo}
                          </button>
                        )}
                      </div>

                      <div className="vendas-documento-status">
                        {abaAtiva === 'orcamentos' ? (
                          <>
                            <span>
                              VÁLIDO ATÉ: <strong>{formatarData(obterDataValidade(venda))}</strong>
                            </span>
                            <span>
                              ENTREGA EM: <strong>{formatarData(obterDataEntrega(venda))}</strong>
                            </span>
                          </>
                        ) : (
                          <>
                            <span>
                              PEDIDO EMITIDO: <strong>{formatarData(obterDataEmissao(venda))}</strong>
                            </span>
                            <span>
                              ENTREGA: <strong>{formatarData(obterDataEntrega(venda))}</strong>
                            </span>
                            <span className="vendas-nfe-numero">
                              {numeroNfe ? (
                                <>
                                  NF-e EMITIDA: <strong>{numeroNfe} • {formatarData(dataEmissaoNfe)}</strong>
                                </>
                              ) : (
                                <>NF-e: <strong>NÃO EMITIDA</strong></>
                              )}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="vendas-documento-cliente">
                        <strong>{obterCliente(venda)}</strong>
                        {ieCliente && <span>IE: {ieCliente}</span>}
                      </div>

                      {abaAtiva === 'orcamentos' && (
                        <div className="vendas-documento-data">
                          {formatarData(obterDataEmissao(venda))}
                        </div>
                      )}

                      <div className="vendas-documento-valor">
                        {formatarMoeda(obterTotal(venda))}
                      </div>

                      {abaAtiva === 'pedidos' && (() => {
                        const statusPagamento = obterStatusPagamento(venda)
                        return (
                          <span className={`vendas-pagamento-status ${statusPagamento === 'PAGO' ? 'pago' : statusPagamento === 'CANCELADO' ? 'cancelado' : 'pendente'}`}>
                            {statusPagamento}
                          </span>
                        )
                      })()}

                      {abaAtiva === 'pedidos' && (
                        venda.conciliado ? (
                          <span className="vendas-conciliado"><CheckCircle2 size={16}/> CONCILIADO</span>
                        ) : (
                          <button
                            type="button"
                            className={`vendas-action-btn vendas-action-reconcile ${pedidoFoiCancelado(venda) ? 'is-disabled' : ''}`}
                            title={pedidoFoiCancelado(venda) ? 'PEDIDO CANCELADO — AÇÃO BLOQUEADA' : 'CONCILIAR PEDIDO'}
                            aria-label={pedidoFoiCancelado(venda) ? 'Pedido cancelado — ação bloqueada' : 'Conciliar pedido'}
                            disabled={pedidoFoiCancelado(venda)}
                            onClick={(event) => conciliarPedido(event, venda)}
                          >
                            <Handshake size={20} />
                          </button>
                        )
                      )}

                      <div className="vendas-acoes vendas-documento-acoes">
                        <button
                          type="button"
                          className={`vendas-action-btn vendas-action-edit ${abaAtiva === 'orcamentos' && !estadoOrcamento.podeEditar ? 'is-disabled' : ''}`}
                          title="EDITAR"
                          disabled={abaAtiva === 'orcamentos' && !estadoOrcamento.podeEditar}
                          onMouseDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                          }}
                          onClickCapture={(event) => editarVenda(event, venda)}
                        >
                          <Edit size={22} />
                        </button>

                        {abaAtiva === 'pedidos' && (
                          <button
                            type="button"
                            className="vendas-action-btn vendas-action-email"
                            title="ENVIAR NF-E E BOLETO POR E-MAIL"
                            aria-label="Enviar NF-e e boleto por e-mail"
                            onMouseDown={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                            }}
                            onClickCapture={(event) => enviarEmailPedido(event, venda)}
                          >
                            <Mail size={22} />
                          </button>
                        )}

                        <button
                          type="button"
                          className="vendas-action-btn vendas-action-print"
                          title="IMPRIMIR"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                          }}
                          onClickCapture={(event) => abrirImpressaoVenda(event, venda)}
                        >
                          <Printer size={22} />
                        </button>

                        {abaAtiva === 'orcamentos' && (
                          <>
                            <button
                              type="button"
                              className={`vendas-action-btn vendas-action-approve ${!estadoOrcamento.podeAprovar ? 'is-disabled' : ''}`}
                              title={!estadoOrcamento.podeAprovar ? 'BLOQUEADO PELO ESTADO REAL DO ORÇAMENTO' : 'APROVAR'}
                              disabled={!estadoOrcamento.podeAprovar}
                              onMouseDown={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                              }}
                              onClickCapture={(event) => aprovarVenda(event, venda)}
                            >
                              <ThumbsUp size={22} />
                            </button>

                            <button
                              type="button"
                              className={`vendas-action-btn vendas-action-reprove ${!estadoOrcamento.podeReprovar ? 'is-disabled' : ''}`}
                              title={!estadoOrcamento.podeReprovar ? 'BLOQUEADO PELO ESTADO REAL DO ORÇAMENTO' : 'REPROVAR'}
                              disabled={!estadoOrcamento.podeReprovar}
                              onMouseDown={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                              }}
                              onClickCapture={(event) => reprovarVenda(event, venda)}
                            >
                              <ThumbsDown size={22} />
                            </button>

                            <button
                              type="button"
                              className={`vendas-action-btn vendas-action-order ${!estadoOrcamento.podeGerarPedido ? 'is-disabled' : ''}`}
                              title={estadoOrcamento.convertido ? 'BLOQUEADO: PEDIDO JÁ GERADO' : !estadoOrcamento.aprovado ? 'APROVE O ORÇAMENTO ANTES DE GERAR O PEDIDO' : 'GERAR PEDIDO'}
                              disabled={!estadoOrcamento.podeGerarPedido}
                              onMouseDown={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                              }}
                              onClickCapture={(event) => gerarPedido(event, venda)}
                            >
                              <ClipboardList size={22} />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          className={`vendas-action-btn vendas-action-delete ${
                            abaAtiva === 'orcamentos' && !estadoOrcamento.podeExcluir
                              ? 'is-disabled'
                              : ''
                          }`}
                          title={
                            abaAtiva === 'orcamentos' && pedidoJaGerado
                              ? 'BLOQUEADO: PEDIDO JÁ GERADO'
                              : abaAtiva === 'orcamentos' && pedidoJaConcluido
                                ? 'BLOQUEADO: PEDIDO CONCLUÍDO OU ENTREGUE'
                                : 'EXCLUIR'
                          }
                          disabled={abaAtiva === 'orcamentos' && !estadoOrcamento.podeExcluir}
                          onMouseDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                          }}
                          onClickCapture={(event) => excluirVenda(event, venda)}
                        >
                          <Trash2 size={22} />
                        </button>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </section>
        </div>
      </main>

    </div>
  )
}


export default Vendas
