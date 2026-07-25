import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FilePlus2,
  FileUp,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { consultarCobrancaInter } from '../../services/interCobrancaApi'
import {
  listarVendasStorage,
  salvarVendaStorageConfirmado,
} from '../../services/vendasStorage'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'

import '../../styles/clientes.css'
import '../../styles/financeiro.css'

type StatusContaReceber =
  | 'Aberta'
  | 'Parcialmente paga'
  | 'Paga'
  | 'Vencida'
  | 'Cancelada'

type ContaReceber = {
  id: string
  pedidoId?: string
  pedidoNumero?: string
  numeroBoleto?: string
  clienteNome: string
  clienteDocumento?: string
  descricao: string
  dataEmissao?: string
  dataVencimento: string
  dataRecebimento?: string
  valorOriginal: number
  valorRecebido: number
  saldoAberto: number
  formaPagamento?: string
  bancoCobranca?: string
  tipoCobranca?: string
  contaRecebimento?: string
  status: StatusContaReceber
  observacao?: string
  conciliado?: boolean
  parcelaNumero?: number
  valorPrincipalRecebido?: number
  jurosRecebidos?: number
  descontosConcedidos?: number
}


type ContaPagar = {
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
  observacao?: string
  conciliado?: boolean
  valorPrincipalPago?: number
  jurosPagos?: number
  descontosObtidos?: number
  valorPago?: number
  compraId?: string
  numeroCompra?: string
  numeroNFe?: string
  chaveAcessoNFe?: string
}

type LancamentoOfx = {
  id: string
  banco?: string
  data: string
  descricao: string
  documento?: string
  valor: number
  tipo: 'Credito' | 'Debito'
  memo?: string
  fitId?: string
  conciliado: boolean
  descartado?: boolean
  contaReceberId?: string
  contaPagarId?: string
  criadoEm: string
}

type TipoContaConciliavel = 'receber' | 'pagar'

type ContaConciliavel = {
  tipo: TipoContaConciliavel
  id: string
  nome: string
  documento: string
  descricao: string
  origem: string
  referencia: string
  vencimento: string
  valor: number
  valorAberto: number
  status: string
  contaOriginal: ContaReceber | ContaPagar
}

type SugestaoConciliacao = {
  lancamento: LancamentoOfx
  conta: ContaConciliavel
  pontuacao: number
  motivos: string[]
}

type ConciliacaoRegistro = {
  id: string
  tipoConta: TipoContaConciliavel
  contaReceberId?: string
  contaPagarId?: string
  lancamentoOfxId: string
  pedidoId?: string
  nome: string
  valor: number
  valorPrincipal: number
  juros: number
  desconto: number
  valorMovimentado: number
  dataConciliacao: string
  observacao?: string
  assinaturaLancamento?: string
  fitId?: string
  criadoEm: string
}

type FormNovoLancamento = {
  classificacao: string
  nome: string
  documento: string
  descricao: string
  emissao: string
  vencimento: string
  formaPagamento: string
  observacao: string
  valor: string
  juros: string
  desconto: string
}

type AjusteConciliacao = {
  lancamento: LancamentoOfx
  conta: ContaConciliavel
  origem: 'sugestao' | 'manual'
  principal: string
  juros: string
  desconto: string
}

const STORAGE_CONTAS_RECEBER = 'synergias_contas_receber'
const STORAGE_CONTAS_PAGAR = 'synergias_contas_pagar'
const STORAGE_LANCAMENTOS_OFX = 'synergias_lancamentos_ofx'
const STORAGE_CONCILIACOES = 'synergias_conciliacoes_bancarias'
const STORAGE_VENDAS = 'synergias_vendas'
const STORAGE_COMPRAS = 'synergias_erp_compras'

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function agoraIso() {
  return new Date().toISOString()
}

function gerarId(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function somenteNumeros(valor?: string | number) {
  return String(valor || '').replace(/\D/g, '')
}

function normalizarTexto(valor?: string | number) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function converterMoeda(valor?: string | number) {
  const texto = String(valor ?? '').replace(/[^\d,.-]/g, '')
  if (!texto) return 0
  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto
  return Number(normalizado) || 0
}

function moedaInput(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function assinaturaLancamento(lancamento: Pick<LancamentoOfx, 'fitId' | 'banco' | 'data' | 'valor' | 'tipo' | 'descricao' | 'documento'>) {
  if (lancamento.fitId) return `fitid:${normalizarTexto(lancamento.fitId)}`
  return [
    normalizarTexto(lancamento.banco || 'banco-nao-informado'),
    lancamento.data || '',
    Number(lancamento.valor || 0).toFixed(2),
    lancamento.tipo || '',
    normalizarTexto(lancamento.descricao),
    normalizarTexto(lancamento.documento || ''),
  ].join('|')
}

function rotuloTransacao(lancamento: LancamentoOfx) {
  const texto = normalizarTexto(`${lancamento.descricao} ${lancamento.memo || ''}`)
  if (texto.includes('pix')) return lancamento.tipo === 'Credito' ? 'PIX RECEBIDO' : 'PIX ENVIADO'
  if (texto.includes('boleto')) return lancamento.tipo === 'Credito' ? 'BOLETO RECEBIDO' : 'BOLETO PAGO'
  if (texto.includes('transferencia') || texto.includes('transf')) return lancamento.tipo === 'Credito' ? 'TRANSFERÊNCIA RECEBIDA' : 'TRANSFERÊNCIA ENVIADA'
  if (texto.includes('pagamento recebido')) return 'PAGAMENTO RECEBIDO'
  if (texto.includes('pagamento efetuado')) return 'PAGAMENTO EFETUADO'
  return lancamento.tipo === 'Credito' ? 'ENTRADA' : 'SAÍDA'
}

function descricaoLancamentoCompacta(lancamento: LancamentoOfx) {
  const original = String(lancamento.descricao || '').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim()
  const rotulo = rotuloTransacao(lancamento)
  const cnpj = original.match(/\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/)?.[0]
  const semRotulo = original
    .replace(/pagamento\s+recebido/gi, ' ')
    .replace(/pagamento\s+efetuado/gi, ' ')
    .replace(/pix\s+recebido/gi, ' ')
    .replace(/pix\s+enviado/gi, ' ')
    .replace(/boleto\s+(pago|recebido)/gi, ' ')
    .replace(/transf(?:er[eê]ncia)?\s+(recebida|enviada)?/gi, ' ')
    .replace(/\bcp\s*:\s*\d+[\w-]*/gi, ' ')
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/g, ' ')
    .replace(/[:;|]+/g, ' - ')

  const partes = semRotulo
    .split(/\s+-\s+/)
    .map((parte) => parte.trim())
    .filter(Boolean)

  const unicas: string[] = []
  partes.forEach((parte) => {
    const normalizada = normalizarTexto(parte)
    if (!normalizada || ['synergias'].includes(normalizada) && partes.length > 1) return
    const duplicada = unicas.some((existente) => {
      const atual = normalizarTexto(existente)
      return atual === normalizada || atual.includes(normalizada) || normalizada.includes(atual)
    })
    if (!duplicada) unicas.push(parte)
  })

  const nome = unicas.join(' - ').trim()
  return `${rotulo}${nome ? ` - ${nome}` : ''}${cnpj && !normalizarTexto(nome).includes(normalizarTexto(cnpj)) ? ` - ${cnpj}` : ''}`
}

function tokensRelevantes(valor?: string | number) {
  return normalizarTexto(valor)
    .split(' ')
    .filter((token) => token.length >= 4)
    .filter((token) => !['pagamento', 'recebido', 'enviado', 'transf', 'transferencia', 'pix', 'boleto', 'banco'].includes(token))
}

function lerStorage<T>(chave: string): T[] {
  if (typeof window === 'undefined') return []

  try {
    const dados = window.localStorage.getItem(chave)
    if (!dados) return []
    const lista = JSON.parse(dados)
    return Array.isArray(lista) ? (lista as T[]) : []
  } catch {
    return []
  }
}

function salvarStorage<T>(chave: string, lista: T[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(chave, JSON.stringify(lista))
}

function listarContasReceberStorage() {
  return lerStorage<ContaReceber>(STORAGE_CONTAS_RECEBER)
}

function listarContasPagarStorage() {
  return lerStorage<ContaPagar>(STORAGE_CONTAS_PAGAR)
}

function listarLancamentosOfxStorage() {
  return lerStorage<LancamentoOfx>(STORAGE_LANCAMENTOS_OFX)
}

function listarConciliacoesStorage() {
  return lerStorage<ConciliacaoRegistro>(STORAGE_CONCILIACOES)
}

function assinaturasProcessadasStorage() {
  const conciliacoes = listarConciliacoesStorage()
  const lancamentosAtuais = listarLancamentosOfxStorage()
  const assinaturas = new Set<string>()
  let houveMigracao = false

  const conciliacoesAtualizadas = conciliacoes.map((registro) => {
    if (registro.assinaturaLancamento) {
      assinaturas.add(registro.assinaturaLancamento)
      return registro
    }

    const lancamento = lancamentosAtuais.find(
      (item) => String(item.id) === String(registro.lancamentoOfxId),
    )
    if (!lancamento) return registro

    const assinatura = assinaturaLancamento(lancamento)
    assinaturas.add(assinatura)
    houveMigracao = true
    return {
      ...registro,
      assinaturaLancamento: assinatura,
      fitId: registro.fitId || lancamento.fitId,
    }
  })

  if (houveMigracao) salvarStorage(STORAGE_CONCILIACOES, conciliacoesAtualizadas)
  return assinaturas
}

function substituirLoteOfxStorage(lancamentos: LancamentoOfx[]) {
  const processadas = assinaturasProcessadasStorage()
  const vistasNoArquivo = new Set<string>()
  let repetidosNoArquivo = 0
  let jaProcessados = 0

  const disponiveis = lancamentos.filter((lancamento) => {
    const assinatura = assinaturaLancamento(lancamento)
    if (processadas.has(assinatura)) {
      jaProcessados += 1
      return false
    }
    if (vistasNoArquivo.has(assinatura)) {
      repetidosNoArquivo += 1
      return false
    }
    vistasNoArquivo.add(assinatura)
    return true
  })

  salvarStorage(STORAGE_LANCAMENTOS_OFX, disponiveis)
  return { disponiveis, jaProcessados, repetidosNoArquivo }
}

function salvarLancamentoOfxStorage(lancamento: LancamentoOfx) {
  const lista = listarLancamentosOfxStorage()
  const existe = lista.some((item) => String(item.id) === String(lancamento.id))
  const novaLista = existe
    ? lista.map((item) => (String(item.id) === String(lancamento.id) ? lancamento : item))
    : [...lista, lancamento]
  salvarStorage(STORAGE_LANCAMENTOS_OFX, novaLista)
}

function salvarContaReceberStorage(conta: ContaReceber) {
  const lista = listarContasReceberStorage()
  const existe = lista.some((item) => String(item.id) === String(conta.id))
  const novaLista = existe
    ? lista.map((item) => (String(item.id) === String(conta.id) ? conta : item))
    : [...lista, conta]
  salvarStorage(STORAGE_CONTAS_RECEBER, novaLista)
}

function salvarContaPagarStorage(conta: ContaPagar) {
  const lista = listarContasPagarStorage()
  const existe = lista.some((item) => String(item.id) === String(conta.id))
  const novaLista = existe
    ? lista.map((item) => (String(item.id) === String(conta.id) ? conta : item))
    : [...lista, conta]
  salvarStorage(STORAGE_CONTAS_PAGAR, novaLista)
}

function atualizarStatusCompraPorContaPagar(conta: ContaPagar) {
  if (!conta.compraId) return
  const contasCompra = listarContasPagarStorage().filter(
    (item) => String(item.compraId || '') === String(conta.compraId),
  )
  if (contasCompra.length === 0) return
  const todasPagas = contasCompra.every(
    (item) => item.status === 'Paga' || item.conciliado,
  )
  const compras = lerStorage<any>(STORAGE_COMPRAS)
  const atualizadas = compras.map((compra) =>
    String(compra.id || '') === String(conta.compraId)
      ? {
          ...compra,
          status: todasPagas ? 'Concluído' : 'Faturado',
          statusFinanceiro: todasPagas ? 'Pago' : 'Em pagamento',
          atualizadoEm: agoraIso(),
        }
      : compra,
  )
  salvarStorage(STORAGE_COMPRAS, atualizadas)
}

function extrairTagOfx(texto: string, tag: string) {
  const regexComFechamento = new RegExp(`<${tag}>(.*?)</${tag}>`, 'i')
  const regexSemFechamento = new RegExp(`<${tag}>([^<\\n\\r]+)`, 'i')
  const matchComFechamento = texto.match(regexComFechamento)
  if (matchComFechamento?.[1]) return matchComFechamento[1].trim()
  const matchSemFechamento = texto.match(regexSemFechamento)
  if (matchSemFechamento?.[1]) return matchSemFechamento[1].trim()
  return ''
}

function importarOfxTexto(conteudo: string, banco?: string): LancamentoOfx[] {
  const linhas = conteudo
    .replace(/\r/g, '')
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)

  const blocos: string[][] = []
  let blocoAtual: string[] = []

  linhas.forEach((linha) => {
    if (linha.includes('<STMTTRN>')) {
      if (blocoAtual.length > 0) blocos.push(blocoAtual)
      blocoAtual = [linha]
      return
    }
    if (blocoAtual.length > 0) blocoAtual.push(linha)
  })

  if (blocoAtual.length > 0) blocos.push(blocoAtual)

  return blocos
    .map((bloco) => {
      const texto = bloco.join('\n')
      const tipoRaw = extrairTagOfx(texto, 'TRNTYPE')
      const dataRaw = extrairTagOfx(texto, 'DTPOSTED')
      const valorRaw = extrairTagOfx(texto, 'TRNAMT')
      const fitId = extrairTagOfx(texto, 'FITID')
      const memo = extrairTagOfx(texto, 'MEMO')
      const name = extrairTagOfx(texto, 'NAME')
      const checkNum = extrairTagOfx(texto, 'CHECKNUM')
      const refNum = extrairTagOfx(texto, 'REFNUM')
      const valor = Number(String(valorRaw || '0').replace(',', '.'))
      const data =
        dataRaw && dataRaw.length >= 8
          ? `${dataRaw.slice(0, 4)}-${dataRaw.slice(4, 6)}-${dataRaw.slice(6, 8)}`
          : hoje()
      const descricao = [name, memo].filter(Boolean).join(' - ') || 'Lançamento OFX'
      const tipo: LancamentoOfx['tipo'] =
        valor >= 0 || normalizarTexto(tipoRaw).includes('credit') ? 'Credito' : 'Debito'

      return {
        id: gerarId('ofx'),
        banco,
        data,
        descricao,
        documento: checkNum || refNum || '',
        valor: Math.abs(Number(valor || 0)),
        tipo,
        memo,
        fitId,
        conciliado: false,
        criadoEm: agoraIso(),
      }
    })
    .filter((lancamento) => lancamento.valor > 0)
}

function calcularDiferencaDias(dataA?: string, dataB?: string) {
  if (!dataA || !dataB) return 999
  const primeira = new Date(`${dataA}T00:00:00`)
  const segunda = new Date(`${dataB}T00:00:00`)
  return Math.round((segunda.getTime() - primeira.getTime()) / 86400000)
}

function mapearContasConciliaveis(tipoLancamento: LancamentoOfx['tipo']): ContaConciliavel[] {
  if (tipoLancamento === 'Credito') {
    return listarContasReceberStorage()
      .filter(
        (conta) =>
          conta.status !== 'Paga' &&
          conta.status !== 'Cancelada' &&
          Number(conta.saldoAberto || 0) > 0,
      )
      .map((conta) => ({
        tipo: 'receber' as const,
        id: conta.id,
        nome: conta.clienteNome || 'Cliente não informado',
        documento: conta.clienteDocumento || '',
        descricao: conta.descricao || 'Conta a receber',
        origem: conta.pedidoNumero ? `Pedido ${conta.pedidoNumero}` : 'Conta a Receber',
        referencia: conta.numeroBoleto || '',
        vencimento: conta.dataVencimento,
        valor: Number(conta.valorOriginal || 0),
        valorAberto: Number(conta.saldoAberto || 0),
        status: conta.status,
        contaOriginal: conta,
      }))
  }

  return listarContasPagarStorage()
    .filter((conta) => conta.status === 'Em aberto' && Number(conta.valor || 0) > 0)
    .map((conta) => ({
      tipo: 'pagar' as const,
      id: conta.id,
      nome: conta.fornecedor || 'Fornecedor não informado',
      documento: conta.documento || '',
      descricao: conta.descricao || 'Conta a pagar',
      origem: conta.categoria || 'Conta a Pagar',
      referencia: conta.documento || '',
      vencimento: conta.vencimento,
      valor: Number(conta.valor || 0),
      valorAberto: Number(conta.valor || 0),
      status: conta.status,
      contaOriginal: conta,
    }))
}

function pontuarConta(lancamento: LancamentoOfx, conta: ContaConciliavel) {
  let pontuacao = 0
  const motivos: string[] = []
  const valorLancamento = Number(lancamento.valor || 0)
  const valorConta = Number(conta.valorAberto || conta.valor || 0)
  const diferencaValor = Math.abs(valorLancamento - valorConta)

  if (diferencaValor <= 0.01) {
    pontuacao += 70
    motivos.push('Valor exato')
  } else {
    const percentual = valorConta > 0 ? diferencaValor / valorConta : 1
    if (percentual <= 0.02) {
      pontuacao += 45
      motivos.push('Valor muito próximo')
    } else if (percentual <= 0.1) {
      pontuacao += 25
      motivos.push('Valor próximo')
    }
  }

  const textoLancamento = normalizarTexto(
    `${lancamento.descricao} ${lancamento.memo || ''} ${lancamento.documento || ''}`,
  )
  const documento = somenteNumeros(conta.documento)

  if (documento && textoLancamento.includes(documento)) {
    pontuacao += 35
    motivos.push('Documento localizado')
  }

  const nomeNormalizado = normalizarTexto(conta.nome)
  if (nomeNormalizado && textoLancamento.includes(nomeNormalizado)) {
    pontuacao += 40
    motivos.push('Nome completo localizado')
  } else {
    const tokensConta = tokensRelevantes(`${conta.nome} ${conta.descricao}`)
    const tokensEncontrados = tokensConta.filter((token) => textoLancamento.includes(token))
    if (tokensEncontrados.length >= 2) {
      pontuacao += 30
      motivos.push(`Nome compatível: ${tokensEncontrados.slice(0, 3).join(', ')}`)
    } else if (tokensEncontrados.length === 1) {
      pontuacao += 15
      motivos.push(`Palavra-chave: ${tokensEncontrados[0]}`)
    }
  }

  if (conta.referencia && textoLancamento.includes(normalizarTexto(conta.referencia))) {
    pontuacao += 35
    motivos.push('Referência localizada')
  }

  const diferencaDias = Math.abs(calcularDiferencaDias(conta.vencimento, lancamento.data))
  if (diferencaDias <= 7) {
    pontuacao += 20
    motivos.push('Data até 7 dias')
  } else if (diferencaDias <= 30) {
    pontuacao += 12
    motivos.push('Data até 30 dias')
  } else if (diferencaDias <= 90) {
    pontuacao += 5
    motivos.push('Data até 90 dias')
  }

  return { pontuacao, motivos }
}

function sugerirParaLancamento(lancamento: LancamentoOfx) {
  return mapearContasConciliaveis(lancamento.tipo)
    .map((conta) => {
      const resultado = pontuarConta(lancamento, conta)
      return { lancamento, conta, ...resultado } as SugestaoConciliacao
    })
    .filter((sugestao) => sugestao.pontuacao >= 30)
    .sort((a, b) => b.pontuacao - a.pontuacao)
}

function localizarParcelaPedido(venda: any, conta: ContaReceber) {
  const parcelas = Array.isArray(venda.parcelas) ? venda.parcelas : []

  if (conta.parcelaNumero) {
    const indice = parcelas.findIndex(
      (parcela: any) => Number(parcela.numero) === Number(conta.parcelaNumero),
    )
    if (indice >= 0) return indice
  }

  return parcelas.findIndex(
    (parcela: any) =>
      parcela.vencimento === conta.dataVencimento &&
      Math.abs(Number(parcela.valor || 0) - Number(conta.valorOriginal || 0)) < 0.01,
  )
}

function atualizarPedidoPorContaReceber(conta: ContaReceber) {
  if (!conta.pedidoId && !conta.pedidoNumero) return

  const vendas = lerStorage<any>(STORAGE_VENDAS)
  const indiceVenda = vendas.findIndex(
    (venda) =>
      String(venda.id || '') === String(conta.pedidoId || '') ||
      String(venda.numeroPedido || '') === String(conta.pedidoNumero || ''),
  )
  if (indiceVenda < 0) return

  const venda = vendas[indiceVenda]
  const indiceParcela = localizarParcelaPedido(venda, conta)
  const agora = new Date()
  const parcelasAtuais = Array.isArray(venda.parcelas) ? venda.parcelas : []
  const parcelasAtualizadas = parcelasAtuais.map((parcela: any, indice: number) => {
    if (indice !== indiceParcela) return parcela
    const paga = conta.status === 'Paga'

    return {
      ...parcela,
      vencimento: conta.dataVencimento,
      tipoCobranca: conta.tipoCobranca || parcela.tipoCobranca,
      bancoCobranca: conta.bancoCobranca || parcela.bancoCobranca,
      statusBoleto: paga ? 'Pago' : 'Pendente',
      dataPagamentoBoleto: paga ? conta.dataRecebimento || hoje() : '',
      horarioPagamentoBoleto: paga
        ? agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '',
      valorRecebido: Number(conta.valorRecebido || 0),
      jurosRecebimento: Number(conta.jurosRecebidos || 0),
      descontoRecebimento: Number(conta.descontosConcedidos || 0),
      contaRecebimento: conta.contaRecebimento || '',
      observacaoRecebimento: conta.observacao || '',
    }
  })

  const contasPedido = listarContasReceberStorage().filter(
    (item) =>
      (conta.pedidoId && String(item.pedidoId || '') === String(conta.pedidoId)) ||
      (conta.pedidoNumero && String(item.pedidoNumero || '') === String(conta.pedidoNumero)),
  )
  const totalOriginal = contasPedido.reduce((total, item) => total + Number(item.valorOriginal || 0), 0)
  const totalMovimentado = contasPedido.reduce((total, item) => total + Number(item.valorRecebido || 0), 0)
  const totalSaldo = contasPedido.reduce((total, item) => total + Number(item.saldoAberto || 0), 0)
  const todasContasPagas = contasPedido.length > 0 && contasPedido.every((item) => item.status === 'Paga')
  const algumaContaPaga = contasPedido.some(
    (item) => item.status === 'Paga' || item.status === 'Parcialmente paga',
  )
  const todasParcelasPagas =
    parcelasAtualizadas.length > 0 &&
    parcelasAtualizadas.every((parcela: any) => parcela.statusBoleto === 'Pago')
  const algumaParcelaPaga = parcelasAtualizadas.some((parcela: any) => parcela.statusBoleto === 'Pago')
  const statusFinanceiro = todasContasPagas ? 'Pago' : algumaContaPaga ? 'Parcialmente Pago' : 'Aberto'

  vendas[indiceVenda] = {
    ...venda,
    parcelas: parcelasAtualizadas,
    statusBoleto: todasParcelasPagas ? 'Pago' : algumaParcelaPaga ? 'Gerado' : 'Pendente',
    statusFinanceiro,
    valorPago: Number(totalMovimentado.toFixed(2)),
    saldoAberto: Number(Math.max(totalSaldo, 0).toFixed(2)),
    statusPedido:
      todasContasPagas && totalOriginal > 0
        ? 'Pago'
        : statusFinanceiro === 'Parcialmente Pago'
          ? 'Parcialmente Pago'
          : venda.statusPedido,
  }

  salvarStorage(STORAGE_VENDAS, vendas)
}

function conciliarConta(
  lancamento: LancamentoOfx,
  conta: ContaConciliavel,
  observacao: string,
  valores: { principal: number; juros: number; desconto: number },
) {
  if (lancamento.conciliado) return false

  const principal = Number(Math.max(valores.principal, 0).toFixed(2))
  const juros = Number(Math.max(valores.juros, 0).toFixed(2))
  const desconto = Number(Math.max(valores.desconto, 0).toFixed(2))
  const valorMovimentado = Number(Math.max(principal + juros - desconto, 0).toFixed(2))

  if (principal <= 0) {
    alert('Informe o valor principal que será liquidado.')
    return false
  }

  if (Math.abs(valorMovimentado - Number(lancamento.valor || 0)) > 0.01) {
    alert(
      `O total conciliado precisa ser igual ao lançamento OFX.\n\n` +
        `OFX: ${Number(lancamento.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n` +
        `Principal + juros - desconto: ${valorMovimentado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
    )
    return false
  }

  if (conta.tipo === 'receber') {
    const original = conta.contaOriginal as ContaReceber
    const principalAnterior = Number(
      original.valorPrincipalRecebido ??
        Math.max(Number(original.valorOriginal || 0) - Number(original.saldoAberto || 0), 0),
    )
    const saldoAtual = Number(original.saldoAberto || 0)
    if (principal > saldoAtual + 0.01) {
      alert('O valor principal não pode ultrapassar o saldo em aberto da conta.')
      return false
    }

    const novoPrincipal = Number((principalAnterior + principal).toFixed(2))
    const novosJuros = Number((Number(original.jurosRecebidos || 0) + juros).toFixed(2))
    const novosDescontos = Number((Number(original.descontosConcedidos || 0) + desconto).toFixed(2))
    const novoMovimentado = Number((Number(original.valorRecebido || 0) + valorMovimentado).toFixed(2))
    const novoSaldo = Number(Math.max(Number(original.valorOriginal || 0) - novoPrincipal, 0).toFixed(2))
    const atualizada: ContaReceber = {
      ...original,
      valorPrincipalRecebido: novoPrincipal,
      jurosRecebidos: novosJuros,
      descontosConcedidos: novosDescontos,
      valorRecebido: novoMovimentado,
      saldoAberto: novoSaldo,
      dataRecebimento: lancamento.data,
      contaRecebimento: lancamento.banco || original.contaRecebimento,
      conciliado: true,
      status: novoSaldo <= 0 ? 'Paga' : 'Parcialmente paga',
    }
    salvarContaReceberStorage(atualizada)
    atualizarPedidoPorContaReceber(atualizada)
  } else {
    const original = conta.contaOriginal as ContaPagar
    const principalAnterior = Number(original.valorPrincipalPago || 0)
    const saldoAtual = Math.max(Number(original.valor || 0) - principalAnterior, 0)
    if (principal > saldoAtual + 0.01) {
      alert('O valor principal não pode ultrapassar o saldo da conta a pagar.')
      return false
    }
    if (principal + 0.01 < saldoAtual) {
      alert('As Contas a Pagar atuais não trabalham com baixa parcial. Informe o saldo integral como valor principal e use Juros ou Desconto para ajustar o total do OFX.')
      return false
    }

    const contaPaga: ContaPagar = {
      ...original,
      status: 'Paga',
      dataPagamento: lancamento.data,
      conciliado: true,
      valorPrincipalPago: Number((principalAnterior + principal).toFixed(2)),
      jurosPagos: Number((Number(original.jurosPagos || 0) + juros).toFixed(2)),
      descontosObtidos: Number((Number(original.descontosObtidos || 0) + desconto).toFixed(2)),
      valorPago: Number((Number(original.valorPago || 0) + valorMovimentado).toFixed(2)),
    }
    salvarContaPagarStorage(contaPaga)
    atualizarStatusCompraPorContaPagar(contaPaga)
  }

  const registro: ConciliacaoRegistro = {
    id: gerarId('conc'),
    tipoConta: conta.tipo,
    contaReceberId: conta.tipo === 'receber' ? conta.id : undefined,
    contaPagarId: conta.tipo === 'pagar' ? conta.id : undefined,
    lancamentoOfxId: lancamento.id,
    pedidoId: conta.tipo === 'receber' ? (conta.contaOriginal as ContaReceber).pedidoId : undefined,
    nome: conta.nome,
    valor: valorMovimentado,
    valorPrincipal: principal,
    juros,
    desconto,
    valorMovimentado,
    dataConciliacao: lancamento.data,
    observacao,
    assinaturaLancamento: assinaturaLancamento(lancamento),
    fitId: lancamento.fitId,
    criadoEm: agoraIso(),
  }

  salvarStorage(STORAGE_CONCILIACOES, [...listarConciliacoesStorage(), registro])
  salvarLancamentoOfxStorage({
    ...lancamento,
    conciliado: true,
    descartado: false,
    contaReceberId: conta.tipo === 'receber' ? conta.id : undefined,
    contaPagarId: conta.tipo === 'pagar' ? conta.id : undefined,
  })
  return true
}

function desfazerConciliacao(lancamento: LancamentoOfx) {
  const conciliacoes = listarConciliacoesStorage()
  const registro = [...conciliacoes]
    .reverse()
    .find((item) => String(item.lancamentoOfxId) === String(lancamento.id))

  if (!registro) {
    salvarLancamentoOfxStorage({
      ...lancamento,
      conciliado: false,
      contaReceberId: undefined,
      contaPagarId: undefined,
    })
    return true
  }

  const principalAplicado = Number(registro.valorPrincipal ?? registro.valor ?? 0)
  const jurosAplicados = Number(registro.juros || 0)
  const descontoAplicado = Number(registro.desconto || 0)
  const movimentadoAplicado = Number(
    registro.valorMovimentado ?? principalAplicado + jurosAplicados - descontoAplicado,
  )

  if (registro.tipoConta === 'receber' && registro.contaReceberId) {
    const conta = listarContasReceberStorage().find((item) => String(item.id) === String(registro.contaReceberId))
    if (conta) {
      const principalAtual = Number(
        conta.valorPrincipalRecebido ??
          Math.max(Number(conta.valorOriginal || 0) - Number(conta.saldoAberto || 0), 0),
      )
      const novoPrincipal = Number(Math.max(principalAtual - principalAplicado, 0).toFixed(2))
      const novoRecebido = Number(Math.max(Number(conta.valorRecebido || 0) - movimentadoAplicado, 0).toFixed(2))
      const novoSaldo = Number(Math.max(Number(conta.valorOriginal || 0) - novoPrincipal, 0).toFixed(2))
      const atualizada: ContaReceber = {
        ...conta,
        valorPrincipalRecebido: novoPrincipal,
        jurosRecebidos: Number(Math.max(Number(conta.jurosRecebidos || 0) - jurosAplicados, 0).toFixed(2)),
        descontosConcedidos: Number(Math.max(Number(conta.descontosConcedidos || 0) - descontoAplicado, 0).toFixed(2)),
        valorRecebido: novoRecebido,
        saldoAberto: novoSaldo,
        status: novoPrincipal <= 0 ? (conta.dataVencimento < hoje() ? 'Vencida' : 'Aberta') : novoSaldo <= 0 ? 'Paga' : 'Parcialmente paga',
        dataRecebimento: novoPrincipal <= 0 ? undefined : conta.dataRecebimento,
        conciliado: novoPrincipal > 0,
      }
      salvarContaReceberStorage(atualizada)
      atualizarPedidoPorContaReceber(atualizada)
    }
  }

  if (registro.tipoConta === 'pagar' && registro.contaPagarId) {
    const conta = listarContasPagarStorage().find((item) => String(item.id) === String(registro.contaPagarId))
    if (conta) {
      const novoPrincipal = Number(Math.max(Number(conta.valorPrincipalPago || conta.valor || 0) - principalAplicado, 0).toFixed(2))
      salvarContaPagarStorage({
        ...conta,
        status: 'Em aberto',
        dataPagamento: undefined,
        conciliado: false,
        valorPrincipalPago: novoPrincipal,
        jurosPagos: Number(Math.max(Number(conta.jurosPagos || 0) - jurosAplicados, 0).toFixed(2)),
        descontosObtidos: Number(Math.max(Number(conta.descontosObtidos || 0) - descontoAplicado, 0).toFixed(2)),
        valorPago: Number(Math.max(Number(conta.valorPago || registro.valor || 0) - movimentadoAplicado, 0).toFixed(2)),
      })
    }
  }

  salvarStorage(
    STORAGE_CONCILIACOES,
    conciliacoes.filter((item) => String(item.id) !== String(registro.id)),
  )
  salvarLancamentoOfxStorage({
    ...lancamento,
    conciliado: false,
    contaReceberId: undefined,
    contaPagarId: undefined,
  })
  return true
}

function ConciliacaoBancaria() {
  const navigate = useNavigate()
  const inputOfxRef = useRef<HTMLInputElement>(null)
  const conciliacaoInterInicialRef = useRef(false)

  const [lancamentos, setLancamentos] = useState<LancamentoOfx[]>(listarLancamentosOfxStorage())
  const [bancoSelecionado, setBancoSelecionado] = useState('')
  const [importando, setImportando] = useState(false)
  const [sincronizandoInter, setSincronizandoInter] = useState(false)
  const [mensagemInter, setMensagemInter] = useState('')

  useEffect(() => {
    if (conciliacaoInterInicialRef.current) return
    conciliacaoInterInicialRef.current = true
    void conciliarBancoInter()
  }, [])
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'entradas' | 'saidas'>('todos')
  const [vinculoFiltro, setVinculoFiltro] = useState<'todos' | 'vinculadas' | 'nao-vinculadas'>('todos')
  const [descarteFiltro, setDescarteFiltro] = useState<'todos' | 'descartados' | 'nao-descartados'>('todos')
  const [lancamentoAberto, setLancamentoAberto] = useState<LancamentoOfx | null>(null)
  const [buscaContaManual, setBuscaContaManual] = useState('')
  const [periodoManual, setPeriodoManual] = useState<'30' | '90' | '180' | '365' | 'todos'>('90')
  const [novoLancamento, setNovoLancamento] = useState<LancamentoOfx | null>(null)
  const [vinculoVisual, setVinculoVisual] = useState<LancamentoOfx | null>(null)

  const [formNovo, setFormNovo] = useState<FormNovoLancamento>({
    classificacao: '',
    nome: '',
    documento: '',
    descricao: '',
    emissao: hoje(),
    vencimento: hoje(),
    formaPagamento: '',
    observacao: '',
    valor: '',
    juros: '0,00',
    desconto: '0,00',
  })

  const [ajusteConciliacao, setAjusteConciliacao] = useState<AjusteConciliacao | null>(null)

  const lancamentosFiltrados = useMemo(() => {
    const termo = normalizarTexto(busca)
    return lancamentos.filter((lancamento) => {
      const tipoOk =
        tipoFiltro === 'todos' ||
        (tipoFiltro === 'entradas' && lancamento.tipo === 'Credito') ||
        (tipoFiltro === 'saidas' && lancamento.tipo === 'Debito')
      const vinculoOk =
        vinculoFiltro === 'todos' ||
        (vinculoFiltro === 'vinculadas' && lancamento.conciliado) ||
        (vinculoFiltro === 'nao-vinculadas' && !lancamento.conciliado)
      const descarteOk =
        descarteFiltro === 'todos' ||
        (descarteFiltro === 'descartados' && lancamento.descartado) ||
        (descarteFiltro === 'nao-descartados' && !lancamento.descartado)
      const buscaOk =
        !termo ||
        normalizarTexto(
          `${lancamento.descricao} ${lancamento.memo || ''} ${lancamento.documento || ''} ${lancamento.valor} ${lancamento.banco || ''}`,
        ).includes(termo)
      return tipoOk && vinculoOk && descarteOk && buscaOk
    })
  }, [lancamentos, busca, tipoFiltro, vinculoFiltro, descarteFiltro])

  const sugestoesPorLancamento = useMemo(() => {
    const mapa = new Map<string, SugestaoConciliacao[]>()
    lancamentos.forEach((lancamento) => {
      if (!lancamento.conciliado && !lancamento.descartado) {
        mapa.set(lancamento.id, sugerirParaLancamento(lancamento))
      }
    })
    return mapa
  }, [lancamentos])

  const contasManuais = useMemo(() => {
    if (!lancamentoAberto) return []
    const termo = normalizarTexto(buscaContaManual)
    const dias = periodoManual === 'todos' ? 99999 : Number(periodoManual)
    return mapearContasConciliaveis(lancamentoAberto.tipo)
      .filter((conta) => {
        const diferenca = Math.abs(calcularDiferencaDias(conta.vencimento, lancamentoAberto.data))
        const periodoOk = periodoManual === 'todos' || diferenca <= dias
        const texto = normalizarTexto(
          `${conta.nome} ${conta.documento} ${conta.origem} ${conta.referencia} ${conta.descricao} ${conta.valorAberto} ${conta.valor}`,
        )
        return periodoOk && (!termo || texto.includes(termo))
      })
      .sort((a, b) => pontuarConta(lancamentoAberto, b).pontuacao - pontuarConta(lancamentoAberto, a).pontuacao)
  }, [lancamentoAberto, buscaContaManual, periodoManual])

  const contasPendentes = useMemo(() => {
    const termo = normalizarTexto(busca)
    return [
      ...mapearContasConciliaveis('Credito'),
      ...mapearContasConciliaveis('Debito'),
    ].filter((conta) => {
      const tipoOk =
        tipoFiltro === 'todos' ||
        (tipoFiltro === 'entradas' && conta.tipo === 'receber') ||
        (tipoFiltro === 'saidas' && conta.tipo === 'pagar')
      const textoConta = normalizarTexto(
        `${conta.nome} ${conta.documento} ${conta.origem} ${conta.referencia} ${conta.descricao} ${conta.valorAberto}`,
      )
      return tipoOk && (!termo || textoConta.includes(termo))
    })
  }, [lancamentos, busca, tipoFiltro])

  const resumo = useMemo(() => {
    const creditos = lancamentos.filter((item) => item.tipo === 'Credito')
    const debitos = lancamentos.filter((item) => item.tipo === 'Debito')
    const conciliados = lancamentos.filter((item) => item.conciliado)
    return {
      totalLancamentos: lancamentos.length,
      totalCreditos: creditos.reduce((total, item) => total + Number(item.valor || 0), 0),
      totalDebitos: debitos.reduce((total, item) => total + Number(item.valor || 0), 0),
      conciliados: conciliados.length,
      pendentes: contasPendentes.length,
    }
  }, [lancamentos, contasPendentes])

  function dinheiro(valor: number) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatarData(data?: string) {
    if (!data) return '-'
    const partes = data.split('-')
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : data
  }

  function atualizarDadosTela() {
    setLancamentos([...listarLancamentosOfxStorage()])
  }

  async function importarArquivoOfx(arquivo?: File) {
    if (!arquivo) return
    if (!arquivo.name.toLowerCase().endsWith('.ofx')) {
      alert('Selecione um arquivo no formato .OFX.')
      return
    }
    try {
      setImportando(true)
      const texto = await arquivo.text()
      const importados = importarOfxTexto(texto, bancoSelecionado || undefined)
      const resultado = substituirLoteOfxStorage(importados)
      atualizarDadosTela()
      alert(
        `${importados.length} lançamento(s) lido(s) no arquivo.\n` +
          `${resultado.disponiveis.length} disponível(is) para conciliação.\n` +
          `${resultado.jaProcessados} já processado(s) anteriormente.\n` +
          `${resultado.repetidosNoArquivo} duplicado(s) dentro do próprio arquivo.\n\n` +
          'O arquivo atual substituiu o lote anterior da tela de conciliação.',
      )
    } catch {
      alert('Não foi possível importar o arquivo OFX. Verifique o arquivo e tente novamente.')
    } finally {
      setImportando(false)
    }
  }

  function abrirAjusteConciliacao(
    lancamento: LancamentoOfx,
    conta: ContaConciliavel,
    origem: AjusteConciliacao['origem'],
  ) {
    const saldo = Number(conta.valorAberto || conta.valor || 0)
    const diferenca = Number((Number(lancamento.valor || 0) - saldo).toFixed(2))
    setAjusteConciliacao({
      lancamento,
      conta,
      origem,
      principal: moedaInput(saldo),
      juros: moedaInput(diferenca > 0 ? diferenca : 0),
      desconto: moedaInput(diferenca < 0 ? Math.abs(diferenca) : 0),
    })
  }

  function confirmarAjusteConciliacao() {
    if (!ajusteConciliacao) return
    const valores = {
      principal: converterMoeda(ajusteConciliacao.principal),
      juros: converterMoeda(ajusteConciliacao.juros),
      desconto: converterMoeda(ajusteConciliacao.desconto),
    }
    const observacao =
      ajusteConciliacao.origem === 'sugestao'
        ? 'Sugestão confirmada pelo Financeiro.'
        : 'Conciliação manual pelo Financeiro.'

    if (conciliarConta(ajusteConciliacao.lancamento, ajusteConciliacao.conta, observacao, valores)) {
      setAjusteConciliacao(null)
      setLancamentoAberto(null)
      setBuscaContaManual('')
      atualizarDadosTela()
    }
  }

  function aceitarSugestao(sugestao: SugestaoConciliacao) {
    abrirAjusteConciliacao(sugestao.lancamento, sugestao.conta, 'sugestao')
  }

  function conciliarManual(conta: ContaConciliavel) {
    if (!lancamentoAberto) return
    abrirAjusteConciliacao(lancamentoAberto, conta, 'manual')
  }

  function alternarDescarte(lancamento: LancamentoOfx) {
    salvarLancamentoOfxStorage({ ...lancamento, descartado: !lancamento.descartado })
    atualizarDadosTela()
  }

  function desfazer(lancamento: LancamentoOfx) {
    const confirmar = window.confirm('Desfazer esta conciliação? A conta vinculada voltará ao estado anterior e o lançamento ficará pendente novamente.')
    if (!confirmar) return
    desfazerConciliacao(lancamento)
    setVinculoVisual(null)
    atualizarDadosTela()
  }

  function abrirNovo(lancamento: LancamentoOfx) {
    setNovoLancamento(lancamento)
    setFormNovo({
      classificacao: lancamento.tipo === 'Credito' ? 'Recebimento de venda' : 'Despesas gerais',
      nome: '',
      documento: '',
      descricao: descricaoLancamentoCompacta(lancamento),
      emissao: lancamento.data,
      vencimento: lancamento.data,
      formaPagamento: lancamento.tipo === 'Credito' ? 'TRANSFERÊNCIA / PIX' : 'TRANSFERÊNCIA / PIX',
      observacao: `Criado a partir da conciliação bancária. ${lancamento.memo || ''}`.trim(),
      valor: moedaInput(Number(lancamento.valor || 0)),
      juros: '0,00',
      desconto: '0,00',
    })
  }

  function salvarNovoEVincular() {
    if (!novoLancamento) return
    const principal = converterMoeda(formNovo.valor)
    const juros = converterMoeda(formNovo.juros)
    const desconto = converterMoeda(formNovo.desconto)
    const totalMovimentado = Number(Math.max(principal + juros - desconto, 0).toFixed(2))

    if (!formNovo.nome.trim()) {
      alert(novoLancamento.tipo === 'Credito' ? 'Informe o cliente ou beneficiário.' : 'Informe o fornecedor ou beneficiário.')
      return
    }
    if (!formNovo.descricao.trim() || principal <= 0) {
      alert('Informe descrição e valor principal válidos.')
      return
    }
    if (Math.abs(totalMovimentado - Number(novoLancamento.valor || 0)) > 0.01) {
      alert(
        `Principal + juros - desconto precisa ser igual ao lançamento OFX.\n\n` +
          `OFX: ${dinheiro(novoLancamento.valor)}\n` +
          `Total informado: ${dinheiro(totalMovimentado)}`,
      )
      return
    }

    if (novoLancamento.tipo === 'Credito') {
      const conta: ContaReceber = {
        id: gerarId('cr'),
        clienteNome: formNovo.nome.trim(),
        clienteDocumento: formNovo.documento.trim() || undefined,
        descricao: formNovo.descricao.trim(),
        dataEmissao: formNovo.emissao,
        dataVencimento: formNovo.vencimento,
        valorOriginal: principal,
        valorRecebido: 0,
        valorPrincipalRecebido: 0,
        jurosRecebidos: 0,
        descontosConcedidos: 0,
        saldoAberto: principal,
        formaPagamento: formNovo.formaPagamento || undefined,
        bancoCobranca: novoLancamento.banco,
        contaRecebimento: novoLancamento.banco,
        status: formNovo.vencimento < hoje() ? 'Vencida' : 'Aberta',
        observacao: formNovo.observacao.trim() || undefined,
        conciliado: false,
      }
      salvarContaReceberStorage(conta)
      const conciliavel = mapearContasConciliaveis('Credito').find((item) => item.id === conta.id)
      if (conciliavel) {
        conciliarConta(
          novoLancamento,
          conciliavel,
          'Recebimento criado pela conciliação bancária.',
          { principal, juros, desconto },
        )
      }
    } else {
      const conta: ContaPagar = {
        id: gerarId('cp'),
        fornecedor: formNovo.nome.trim(),
        documento: formNovo.documento.trim() || undefined,
        descricao: formNovo.descricao.trim(),
        categoria: formNovo.classificacao || 'Despesas gerais',
        emissao: formNovo.emissao,
        vencimento: formNovo.vencimento,
        valor: principal,
        status: 'Em aberto',
        observacao: formNovo.observacao.trim() || undefined,
        valorPrincipalPago: 0,
        jurosPagos: 0,
        descontosObtidos: 0,
        valorPago: 0,
      }
      salvarContaPagarStorage(conta)
      const conciliavel = mapearContasConciliaveis('Debito').find((item) => item.id === conta.id)
      if (conciliavel) {
        conciliarConta(
          novoLancamento,
          conciliavel,
          'Pagamento criado pela conciliação bancária.',
          { principal, juros, desconto },
        )
      }
    }

    setNovoLancamento(null)
    atualizarDadosTela()
  }

  function obterContaVinculada(lancamento: LancamentoOfx) {
    if (lancamento.contaReceberId) {
      const conta = listarContasReceberStorage().find((item) => String(item.id) === String(lancamento.contaReceberId))
      if (conta) return { tipo: 'receber' as const, nome: conta.clienteNome, descricao: conta.descricao, referencia: conta.pedidoNumero ? `Pedido ${conta.pedidoNumero}` : conta.numeroBoleto || 'Conta a Receber', valor: conta.valorOriginal, status: conta.status }
    }
    if (lancamento.contaPagarId) {
      const conta = listarContasPagarStorage().find((item) => String(item.id) === String(lancamento.contaPagarId))
      if (conta) return { tipo: 'pagar' as const, nome: conta.fornecedor, descricao: conta.descricao, referencia: conta.categoria || 'Conta a Pagar', valor: conta.valor, status: conta.status }
    }
    const registro = [...listarConciliacoesStorage()].reverse().find((item) => String(item.lancamentoOfxId) === String(lancamento.id))
    if (registro?.contaReceberId) {
      const conta = listarContasReceberStorage().find((item) => String(item.id) === String(registro.contaReceberId))
      if (conta) return { tipo: 'receber' as const, nome: conta.clienteNome, descricao: conta.descricao, referencia: conta.pedidoNumero ? `Pedido ${conta.pedidoNumero}` : conta.numeroBoleto || 'Conta a Receber', valor: conta.valorOriginal, status: conta.status }
    }
    if (registro?.contaPagarId) {
      const conta = listarContasPagarStorage().find((item) => String(item.id) === String(registro.contaPagarId))
      if (conta) return { tipo: 'pagar' as const, nome: conta.fornecedor, descricao: conta.descricao, referencia: conta.categoria || 'Conta a Pagar', valor: conta.valor, status: conta.status }
    }
    return undefined
  }

  async function conciliarBancoInter() {
    if (sincronizandoInter) return
    setSincronizandoInter(true)
    setMensagemInter('')
    let baixas = 0

    try {
      const vendas = listarVendasStorage()
      for (const venda of vendas) {
        if (venda.tipo !== 'Pedido') continue
        let alterou = false
        const parcelas: typeof venda.parcelas = []

        for (const parcela of venda.parcelas || []) {
          const bancoCobranca = normalizarTexto(
            parcela.bancoCobranca ||
            venda.bancoCobranca ||
            venda.bancoBoleto ||
            parcela.tipoCobranca ||
            venda.tipoCobranca ||
            '',
          )
          const codigo = String(
            parcela.idCobrancaBanco ||
            parcela.idCobrancaApi ||
            '',
          ).trim()
          const codigoSolicitacaoValido =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(codigo)
          if (
            !bancoCobranca.includes('inter') ||
            !codigoSolicitacaoValido ||
            String(parcela.statusBoleto || '').toLowerCase() === 'pago'
          ) {
            parcelas.push(parcela)
            continue
          }

          const cobranca = await consultarCobrancaInter(codigo)
          const status = normalizarTexto(cobranca.status)
          const paga = ['pago', 'recebido', 'liquidado', 'concluido'].some((termo) =>
            status.includes(termo))

          if (!paga) {
            parcelas.push(parcela)
            continue
          }

          const valorRecebido = Number(cobranca.valorRecebido || parcela.valor || 0)
          const dataRecebimento = String(cobranca.dataPagamento || hoje()).slice(0, 10)
          parcelas.push({
            ...parcela,
            statusBoleto: 'Pago' as const,
            valorRecebido,
            dataPagamentoBoleto: dataRecebimento,
          })
          alterou = true
          baixas += 1

          const conta = listarContasReceberStorage().find((item) =>
            (String(item.pedidoId || '') === String(venda.id) ||
              String(item.pedidoNumero || '') === String(venda.numeroPedido || '')) &&
            (!item.parcelaNumero || Number(item.parcelaNumero) === Number(parcela.numero || 1)))
          if (conta && conta.status !== 'Paga') {
            salvarContaReceberStorage({
              ...conta,
              valorRecebido,
              valorPrincipalRecebido: Number(conta.valorOriginal || valorRecebido),
              saldoAberto: 0,
              dataRecebimento,
              contaRecebimento: 'Banco Inter',
              conciliado: true,
              status: 'Paga',
            })
          }
        }

        if (alterou) {
          const boletos = parcelas.filter((parcela) =>
            Boolean(
              parcela.idCobrancaBanco ||
              parcela.idCobrancaApi ||
              parcela.nossoNumero ||
              parcela.numeroBoleto ||
              parcela.seuNumero,
            ))
          const todosPagos = boletos.length > 0 &&
            boletos.every((parcela) => String(parcela.statusBoleto || '').toLowerCase() === 'pago')
          await salvarVendaStorageConfirmado({
            ...venda,
            parcelas,
            conciliado: todosPagos || venda.conciliado,
            dataConciliacao: todosPagos ? hoje() : venda.dataConciliacao,
            atualizadoEm: agoraIso(),
          })
        }
      }

      atualizarDadosTela()
      setMensagemInter(baixas
        ? `${baixas} pagamento(s) confirmado(s) pelo Banco Inter.`
        : 'Nenhum novo pagamento confirmado pelo Banco Inter.')
    } catch (erro) {
      setMensagemInter(erro instanceof Error ? erro.message : 'Não foi possível consultar o Banco Inter.')
    } finally {
      setSincronizandoInter(false)
    }
  }

  return (
    <main className="financeiro-page">
      <Sidebar />

      <section className="financeiro-content">
        <PageHeader
          category="Financeiro"
          title="Conciliação Bancária"
          subtitle="Importe OFX, receba sugestões, vincule contas e corrija conciliações quando necessário"
        />

        <div className="financeiro-toolbar financeiro-toolbar-padrao">
          <div className="financeiro-toolbar-left-actions">
            <button type="button" className="financeiro-icon-button financeiro-icon-back" onClick={() => navigate('/financeiro')} title="Voltar" aria-label="Voltar">
              <ArrowLeft size={25} strokeWidth={2.4} />
            </button>
            <select className="financeiro-banco-select" value={bancoSelecionado} onChange={(e) => setBancoSelecionado(e.target.value)}>
              <option value="">Banco não informado</option>
              <option value="Banco Inter">Banco Inter</option>
            </select>
          </div>
          <div className="financeiro-toolbar-right-actions">
            <button type="button" className="financeiro-icon-button financeiro-icon-refresh" onClick={atualizarDadosTela} title="Atualizar" aria-label="Atualizar">
              <RefreshCw size={25} strokeWidth={2.4} />
            </button>
          </div>
        </div>
        {mensagemInter && <div className="financeiro-aviso">{mensagemInter}</div>}

        <div className="financeiro-resumo-grid conciliacao-resumo-grid">
          <div className="financeiro-card-resumo"><span>Lançamentos importados</span><strong>{resumo.totalLancamentos}</strong></div>
          <div className="financeiro-card-resumo"><span>Créditos OFX</span><strong>{dinheiro(resumo.totalCreditos)}</strong></div>
          <div className="financeiro-card-resumo"><span>Débitos OFX</span><strong>{dinheiro(resumo.totalDebitos)}</strong></div>
          <div className="financeiro-card-resumo"><span>Pendentes de conciliação</span><strong>{resumo.pendentes}</strong></div>
        </div>

        <div className="financeiro-conciliacao-filtros">
          <div className="financeiro-busca-conciliacao"><Search size={18} /><input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} placeholder="Buscar nome, documento, pedido, boleto, valor ou descrição bancária" /></div>
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as typeof tipoFiltro)}><option value="todos">Entradas e saídas</option><option value="entradas">Entradas</option><option value="saidas">Saídas</option></select>
          <select value={vinculoFiltro} onChange={(e) => setVinculoFiltro(e.target.value as typeof vinculoFiltro)}><option value="todos">Todas as contas</option><option value="vinculadas">Contas vinculadas</option><option value="nao-vinculadas">Não vinculadas</option></select>
          <select value={descarteFiltro} onChange={(e) => setDescarteFiltro(e.target.value as typeof descarteFiltro)}><option value="todos">Todos os lançamentos</option><option value="descartados">Descartados</option><option value="nao-descartados">Não descartados</option></select>
        </div>

        <div className="financeiro-importacao-card conciliacao-importacao-card">
          <div>
            <h3>Importar arquivo OFX</h3>
            <p>Importe o extrato bancário. O ERP cruza valor, nome, documento, referência e data para sugerir a conta mais provável.</p>
          </div>
          <div className="financeiro-importacao-acoes">
            <input ref={inputOfxRef} type="file" accept=".ofx,application/x-ofx,text/ofx" disabled={importando} style={{ display: 'none' }} onChange={(e) => { const arquivo = e.target.files?.[0]; void importarArquivoOfx(arquivo); e.currentTarget.value = '' }} />
            <button type="button" className="financeiro-confirmar" disabled={importando} onClick={() => inputOfxRef.current?.click()}>
              <FileUp size={18} /> {importando ? 'Importando...' : 'Selecionar OFX'}
            </button>
          </div>
        </div>

        <section className="financeiro-tabela-card">
          <div className="financeiro-table-header">
            <div>
              <h3>Compras e vendas pendentes de conciliação</h3>
              <p>Contas em aberto aguardando identificação do pagamento no banco.</p>
            </div>
          </div>
          <div className="financeiro-tabela-wrapper">
            <table className="financeiro-tabela conciliacao-pendencias-tabela">
              <thead><tr><th>Origem</th><th>Cliente / fornecedor</th><th>Documento</th><th>Vencimento</th><th>Valor em aberto</th><th>Situação</th></tr></thead>
              <tbody>
                {contasPendentes.map((conta) => <tr key={`${conta.tipo}-${conta.id}`}>
                  <td><strong>{conta.tipo === 'receber' ? 'Venda' : 'Compra'}</strong><small>{conta.origem}</small></td>
                  <td><strong>{conta.nome}</strong><small>{conta.descricao}</small></td>
                  <td>{conta.referencia || conta.documento || '-'}</td>
                  <td>{formatarData(conta.vencimento)}</td>
                  <td><strong>{dinheiro(conta.valorAberto)}</strong></td>
                  <td>{conta.status}</td>
                </tr>)}
                {!contasPendentes.length && <tr><td colSpan={6} className="financeiro-tabela-vazia">Nenhuma compra ou venda pendente de conciliação.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="conciliacao-lancamentos-lista">
          {lancamentosFiltrados.length > 0 ? (
            lancamentosFiltrados.map((lancamento) => {
              const sugestoes = sugestoesPorLancamento.get(lancamento.id) || []
              const principal = sugestoes[0]
              const vinculo = lancamento.conciliado ? obterContaVinculada(lancamento) : undefined

              return (
                <article key={lancamento.id} className={`conciliacao-lancamento-card ${lancamento.descartado ? 'descartado' : ''} ${lancamento.conciliado ? 'conciliado' : ''}`}>
                  <div className="conciliacao-lancamento-origem">
                    <span>{lancamento.banco || 'Banco não informado'}</span>
                    <small>{formatarData(lancamento.data)}</small>
                    <strong>{descricaoLancamentoCompacta(lancamento)}</strong>
                    <em className={lancamento.tipo === 'Credito' ? 'entrada' : 'saida'}>{lancamento.tipo === 'Credito' ? '+' : '-'} {dinheiro(lancamento.valor)}</em>
                    {!lancamento.conciliado && (
                      <button
                        type="button"
                        className={`conciliacao-descartar-origem ${lancamento.descartado ? 'recuperar' : ''}`}
                        onClick={() => alternarDescarte(lancamento)}
                      >
                        {lancamento.descartado ? <Plus size={16} /> : <Trash2 size={16} />}
                        {lancamento.descartado ? 'Recuperar' : 'Descartar'}
                      </button>
                    )}
                  </div>

                  <div className="conciliacao-lancamento-sugestao">
                    {lancamento.descartado ? (
                      <div className="conciliacao-estado-vazio"><Trash2 size={26} /><div><strong>Registro descartado</strong><p>Você pode recuperar este lançamento e voltar a conciliar.</p></div></div>
                    ) : lancamento.conciliado ? (
                      <div className="conciliacao-vinculo-atual">
                        <div className="conciliacao-vinculo-dados">
                          <strong>{vinculo?.nome || 'Vínculo registrado'}</strong>
                          <p>{[vinculo?.referencia, vinculo?.descricao].filter((item) => item && !['Conta a Receber', 'Conta a Pagar'].includes(String(item))).join(' · ') || 'Conciliação bancária'}</p>
                          <button type="button" className="conciliacao-desvincular-conta" onClick={() => desfazer(lancamento)}>
                            <Link2 size={17} /> Desvincular a conta
                          </button>
                        </div>
                        <div className="conciliacao-vinculo-valor"><span>{vinculo?.status || 'Conciliado'}</span><strong>{dinheiro(vinculo?.valor || lancamento.valor)}</strong></div>
                      </div>
                    ) : principal ? (
                      <>
                        <div className="conciliacao-sugestao-conteudo">
                          <div><h3>{principal.conta.nome}</h3><p>{[principal.conta.referencia, principal.conta.descricao].filter((item) => item && !['Conta a Receber', 'Conta a Pagar'].includes(String(item))).join(' · ')}</p></div>
                          <div className="conciliacao-sugestao-valor"><strong>{dinheiro(principal.conta.valorAberto)}</strong><small>Venc. {formatarData(principal.conta.vencimento)}</small></div>
                        </div>
                        <div className="conciliacao-sugestao-botoes">
                          <button type="button" className="conciliacao-botao-meio aceitar" onClick={() => aceitarSugestao(principal)}>
                            <CheckCircle2 size={16} /> Aceitar sugestão
                          </button>
                          <button type="button" className="conciliacao-botao-meio localizar" onClick={() => setLancamentoAberto(lancamento)}>
                            <Link2 size={16} /> Ver outras opções
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="conciliacao-estado-vazio"><Search size={22} /><div><strong>Conta não localizada</strong><p>Vincule uma conta ou adicione o pagamento/recebimento.</p></div></div>
                    )}
                  </div>

                  <div className="conciliacao-lancamento-acoes">
                    {lancamento.descartado ? null : lancamento.conciliado ? (
                      <button type="button" className="conciliacao-acao ver" onClick={() => setVinculoVisual(lancamento)}><Eye size={16} /> Ver vínculo</button>
                    ) : (
                      <>
                        {!principal && (
                          <button type="button" className="conciliacao-acao localizar" onClick={() => setLancamentoAberto(lancamento)}>
                            <Link2 size={16} /> Vincular conta
                          </button>
                        )}
                        <button type="button" className={`conciliacao-acao ${lancamento.tipo === 'Credito' ? 'novo-recebimento' : 'novo-pagamento'}`} onClick={() => abrirNovo(lancamento)}>
                          <FilePlus2 size={16} /> {lancamento.tipo === 'Credito' ? 'Adicionar recebimento' : 'Adicionar pagamento'}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              )
            })
          ) : (
            <div className="financeiro-vazio">Nenhum lançamento OFX encontrado para os filtros atuais.</div>
          )}
        </section>

        {lancamentoAberto && (
          <div className="financeiro-modal-overlay">
            <div className="financeiro-modal-conciliacao conciliacao-modal-amplo">
              <div className="financeiro-modal-header conciliacao-modal-header">
                <div><h2>Conciliação de lançamento bancário</h2><p>{descricaoLancamentoCompacta(lancamentoAberto)}</p></div>
                <button type="button" onClick={() => setLancamentoAberto(null)}><X size={24} /></button>
              </div>
              <div className="conciliacao-modal-lancamento">
                <div><span>{lancamentoAberto.banco || 'Banco não informado'}</span><strong>{formatarData(lancamentoAberto.data)}</strong></div>
                <div className="conciliacao-modal-descricao"><strong>{descricaoLancamentoCompacta(lancamentoAberto)}</strong><small>{lancamentoAberto.documento || lancamentoAberto.fitId || '-'}</small></div>
                <div><span>Valor a conciliar</span><strong>{dinheiro(lancamentoAberto.valor)}</strong></div>
              </div>
              <div className="financeiro-modal-filtros conciliacao-modal-filtros">
                <label><span>Mostrar contas</span><select value={periodoManual} onChange={(e) => setPeriodoManual(e.target.value as typeof periodoManual)}><option value="30">30 dias</option><option value="90">90 dias</option><option value="180">6 meses</option><option value="365">1 ano</option><option value="todos">Todo o período</option></select></label>
                <label className="conciliacao-busca-manual"><span>Por palavra-chave</span><div><Search size={18} /><input value={buscaContaManual} onChange={(e) => setBuscaContaManual(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} placeholder="Nome, condomínio, CNPJ, pedido, boleto, documento ou valor" /></div></label>
              </div>
              <div className="financeiro-modal-lista conciliacao-contas-lista">
                {contasManuais.map((conta) => {
                  const resultado = pontuarConta(lancamentoAberto, conta)
                  return (
                    <button type="button" key={`${conta.tipo}-${conta.id}`} className="financeiro-conta-candidata conciliacao-conta-candidata" onClick={() => conciliarManual(conta)}>
                      <div className="conciliacao-conta-check"><span /></div>
                      <div><small>{formatarData(conta.vencimento)}</small><strong>{conta.origem}</strong><span>{conta.nome}</span><em>{conta.descricao}</em></div>
                      <div className="conciliacao-conta-score"><span>{resultado.pontuacao} pts</span><strong>{dinheiro(conta.valorAberto)}</strong></div>
                    </button>
                  )
                })}
                {!contasManuais.length && <div className="financeiro-vazio">Nenhuma conta encontrada. Amplie o período ou crie um novo {lancamentoAberto.tipo === 'Credito' ? 'recebimento' : 'pagamento'}.</div>}
              </div>
              <div className="conciliacao-modal-rodape">
                <button type="button" onClick={() => setLancamentoAberto(null)}>Cancelar</button>
                <button type="button" className={lancamentoAberto.tipo === 'Credito' ? 'recebimento' : 'pagamento'} onClick={() => { setLancamentoAberto(null); abrirNovo(lancamentoAberto) }}><Plus size={20} /> {lancamentoAberto.tipo === 'Credito' ? 'Adicionar novo recebimento' : 'Adicionar novo pagamento'}</button>
              </div>
            </div>
          </div>
        )}

        {ajusteConciliacao && (
          <div className="financeiro-modal-overlay">
            <div className="financeiro-modal-conciliacao conciliacao-modal-ajuste">
              <div className="financeiro-modal-header conciliacao-modal-header">
                <div>
                  <h2>Confirmar conciliação</h2>
                  <p>{descricaoLancamentoCompacta(ajusteConciliacao.lancamento)}</p>
                </div>
                <button type="button" onClick={() => setAjusteConciliacao(null)}><X size={24} /></button>
              </div>

              <div className="conciliacao-ajuste-resumo">
                <div><span>Conta</span><strong>{ajusteConciliacao.conta.nome}</strong><small>{ajusteConciliacao.conta.descricao}</small></div>
                <div><span>Lançamento OFX</span><strong>{dinheiro(ajusteConciliacao.lancamento.valor)}</strong><small>{formatarData(ajusteConciliacao.lancamento.data)}</small></div>
              </div>

              <div className="conciliacao-ajuste-valores">
                <label><span>Valor principal</span><input value={ajusteConciliacao.principal} onChange={(e) => setAjusteConciliacao({ ...ajusteConciliacao, principal: e.target.value })} /></label>
                <label><span>Juros</span><input value={ajusteConciliacao.juros} onChange={(e) => setAjusteConciliacao({ ...ajusteConciliacao, juros: e.target.value })} /></label>
                <label><span>Desconto</span><input value={ajusteConciliacao.desconto} onChange={(e) => setAjusteConciliacao({ ...ajusteConciliacao, desconto: e.target.value })} /></label>
                <div className="conciliacao-ajuste-total">
                  <span>Total conciliado</span>
                  <strong>{dinheiro(Math.max(converterMoeda(ajusteConciliacao.principal) + converterMoeda(ajusteConciliacao.juros) - converterMoeda(ajusteConciliacao.desconto), 0))}</strong>
                  <small>Precisa fechar em {dinheiro(ajusteConciliacao.lancamento.valor)}</small>
                </div>
              </div>

              <div className="conciliacao-modal-rodape">
                <button type="button" onClick={() => setAjusteConciliacao(null)}>Cancelar</button>
                <button type="button" className="recebimento" onClick={confirmarAjusteConciliacao}><CheckCircle2 size={20} /> Confirmar e dar baixa</button>
              </div>
            </div>
          </div>
        )}

        {novoLancamento && (
          <div className="financeiro-modal-overlay">
            <div className="financeiro-modal-conciliacao conciliacao-modal-novo">
              <div className="financeiro-modal-header conciliacao-modal-header">
                <div><h2>{novoLancamento.tipo === 'Credito' ? 'Novo recebimento' : 'Novo pagamento'}</h2><p>Crie a conta e vincule imediatamente ao lançamento bancário.</p></div>
                <button type="button" onClick={() => setNovoLancamento(null)}><X size={24} /></button>
              </div>
              <div className="conciliacao-modal-lancamento">
                <div><span>{novoLancamento.banco || 'Banco não informado'}</span><strong>{formatarData(novoLancamento.data)}</strong></div>
                <div className="conciliacao-modal-descricao"><strong>{descricaoLancamentoCompacta(novoLancamento)}</strong><small>{novoLancamento.documento || novoLancamento.fitId || '-'}</small></div>
                <div><span>Valor</span><strong>{dinheiro(novoLancamento.valor)}</strong></div>
              </div>
              <div className="conciliacao-novo-form">
                <label><span>Classificação</span><input value={formNovo.classificacao} onChange={(e) => setFormNovo({ ...formNovo, classificacao: e.target.value })} placeholder={novoLancamento.tipo === 'Credito' ? 'Ex.: Recebimento de venda' : 'Ex.: Combustível, Impostos'} /></label>
                <label className="span-2"><span>{novoLancamento.tipo === 'Credito' ? 'Cliente / Beneficiário' : 'Fornecedor / Beneficiário'}</span><input value={formNovo.nome} onChange={(e) => setFormNovo({ ...formNovo, nome: e.target.value })} placeholder="Digite o nome" /></label>
                <label><span>Documento</span><input value={formNovo.documento} onChange={(e) => setFormNovo({ ...formNovo, documento: e.target.value })} /></label>
                <label className="span-2"><span>Descrição</span><input value={formNovo.descricao} onChange={(e) => setFormNovo({ ...formNovo, descricao: e.target.value })} /></label>
                <label><span>Emissão</span><input type="date" value={formNovo.emissao} onChange={(e) => setFormNovo({ ...formNovo, emissao: e.target.value })} /></label>
                <label><span>Vencimento</span><input type="date" value={formNovo.vencimento} onChange={(e) => setFormNovo({ ...formNovo, vencimento: e.target.value })} /></label>
                <label><span>Forma de pagamento</span><input value={formNovo.formaPagamento} onChange={(e) => setFormNovo({ ...formNovo, formaPagamento: e.target.value })} /></label>
                <label><span>Valor principal</span><input value={formNovo.valor} onChange={(e) => setFormNovo({ ...formNovo, valor: e.target.value })} /></label>
                <label><span>Juros</span><input value={formNovo.juros} onChange={(e) => setFormNovo({ ...formNovo, juros: e.target.value })} /></label>
                <label><span>Desconto</span><input value={formNovo.desconto} onChange={(e) => setFormNovo({ ...formNovo, desconto: e.target.value })} /></label>
                <div className="conciliacao-total-calculado"><span>Total conciliado</span><strong>{dinheiro(Math.max(converterMoeda(formNovo.valor) + converterMoeda(formNovo.juros) - converterMoeda(formNovo.desconto), 0))}</strong><small>Deve ser igual ao OFX: {dinheiro(novoLancamento.valor)}</small></div>
                <label className="span-3"><span>Observações</span><textarea value={formNovo.observacao} onChange={(e) => setFormNovo({ ...formNovo, observacao: e.target.value })} /></label>
              </div>
              <div className="conciliacao-modal-rodape">
                <button type="button" onClick={() => setNovoLancamento(null)}>Cancelar</button>
                <button type="button" className={novoLancamento.tipo === 'Credito' ? 'recebimento' : 'pagamento'} onClick={salvarNovoEVincular}><CheckCircle2 size={20} /> Criar e conciliar</button>
              </div>
            </div>
          </div>
        )}

        {vinculoVisual && (
          <div className="financeiro-modal-overlay">
            <div className="financeiro-modal-conciliacao conciliacao-modal-vinculo">
              <div className="financeiro-modal-header conciliacao-modal-header"><div><h2>Conta vinculada</h2><p>Revise a conciliação e desfaça se o vínculo estiver incorreto.</p></div><button type="button" onClick={() => setVinculoVisual(null)}><X size={24} /></button></div>
              <div className="conciliacao-vinculo-detalhe">
                <div><span>Lançamento bancário</span><strong>{descricaoLancamentoCompacta(vinculoVisual)}</strong><small>{formatarData(vinculoVisual.data)} · {dinheiro(vinculoVisual.valor)}</small></div>
                {(() => { const vinculo = obterContaVinculada(vinculoVisual); const referencia = vinculo && !['Conta a Receber', 'Conta a Pagar'].includes(vinculo.referencia) ? vinculo.referencia : ''; return vinculo ? <div><span>Conta vinculada</span><strong>{vinculo.nome}</strong><small>{[referencia, vinculo.descricao, dinheiro(vinculo.valor), vinculo.status].filter(Boolean).join(' · ')}</small></div> : <div><span>Conta vinculada</span><strong>Vínculo não localizado</strong><small>O lançamento está marcado como conciliado, mas a conta de origem não foi encontrada.</small></div> })()}
              </div>
              <div className="conciliacao-modal-rodape"><button type="button" onClick={() => setVinculoVisual(null)}>Fechar</button><button type="button" className="desfazer" onClick={() => desfazer(vinculoVisual)}><Link2 size={20} /> Desvincular a conta</button></div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default ConciliacaoBancaria
