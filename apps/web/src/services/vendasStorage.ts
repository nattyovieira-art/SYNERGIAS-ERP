// SYNERGIAS_SALVAR_VENDAS_MYSQL_CONFIRMADO_V284
import type { ParcelaVenda, Venda } from '../types/Venda'
import { atualizarRegistroColecaoCentral, carregarColecaoCentral, definirColecaoMemoria, excluirRegistroColecaoCentral, obterColecaoMemoria, sincronizarColecaoCentral, sincronizarColecaoCentralAgora } from './erpApi'
import { determinarEstadoRealOrcamento, normalizarNovoOrcamentoImportado } from './orcamentoEstado'



const STORAGE_VENDAS_BACKUP = 'synergias_vendas'

function salvarBackupLocal(vendas: Venda[]) {
  try {
    localStorage.setItem(STORAGE_VENDAS_BACKUP, JSON.stringify(vendas))
  } catch (erro) {
    console.warn('[Synergias ERP] Não foi possível gravar o backup local de vendas.', erro)
  }
}

type VendaComMetadados = Venda & {
  criadoEm?: string
  atualizadoEm?: string
  statusOrcamento?: string
}

function gerarDataAtual() {
  return new Date().toISOString()
}

function normalizarParcela(parcela: ParcelaVenda): ParcelaVenda {
  const possuiBoletoGerado = Boolean(
    parcela.idCobrancaBanco ||
    parcela.idCobrancaApi ||
    parcela.numeroBoleto ||
    parcela.nossoNumero ||
    parcela.seuNumero ||
    parcela.linhaDigitavel ||
    parcela.codigoBarras ||
    parcela.linkBoleto ||
    parcela.boletoPdfUrl ||
    parcela.boletoPdfBase64 ||
    parcela.dataGeracaoBoleto
  )
  return {
    ...parcela,
    statusBoleto: parcela.statusBoleto || (possuiBoletoGerado ? 'Gerado' : 'Pendente'),
    numeroBoleto: parcela.numeroBoleto || '',
    nossoNumero: parcela.nossoNumero || '',
    seuNumero: parcela.seuNumero || '',
    linhaDigitavel: parcela.linhaDigitavel || '',
    codigoBarras: parcela.codigoBarras || '',
    linkBoleto: parcela.linkBoleto || '',
    boletoPdfUrl: parcela.boletoPdfUrl || '',
    boletoPdfBase64: parcela.boletoPdfBase64 || '',
    idCobrancaBanco: parcela.idCobrancaBanco || '',
    idCobrancaApi: parcela.idCobrancaApi || '',
    ambienteBoleto: parcela.ambienteBoleto || 'homologacao',
    pixCopiaECola: parcela.pixCopiaECola || '',
    pixQrCode: parcela.pixQrCode || '',
    pixQrCodeUrl: parcela.pixQrCodeUrl || '',
    pixTxId: parcela.pixTxId || '',
    dataGeracaoBoleto: parcela.dataGeracaoBoleto || '',
    horarioGeracaoBoleto: parcela.horarioGeracaoBoleto || '',
    dataEnvioBoleto: parcela.dataEnvioBoleto || '',
    horarioEnvioBoleto: parcela.horarioEnvioBoleto || '',
    dataPagamentoBoleto: parcela.dataPagamentoBoleto || '',
    horarioPagamentoBoleto: parcela.horarioPagamentoBoleto || '',
    dataCancelamentoBoleto: parcela.dataCancelamentoBoleto || '',
    horarioCancelamentoBoleto: parcela.horarioCancelamentoBoleto || '',
    erroBoleto: parcela.erroBoleto || '',
    motivoErroBoleto: parcela.motivoErroBoleto || '',
  }
}

function detectarAmbienteFiscal(venda: VendaComMetadados): 'PRODUCAO' | 'HOMOLOGACAO' | '' {
  const candidatos = [String((venda as any).xmlNotaFiscal || '')]
  for (const valor of candidatos) {
    if (!valor) continue
    let xml = valor
    try {
      if (!valor.includes('<')) xml = atob(valor.replace(/^data:[^,]+,/, ''))
    } catch {}
    if (/<tpAmb>1<\/tpAmb>/.test(xml)) return 'PRODUCAO'
    if (/<tpAmb>2<\/tpAmb>/.test(xml)) return 'HOMOLOGACAO'
  }
  const historico = Array.isArray((venda as any).historicoNotaFiscal) ? (venda as any).historicoNotaFiscal : []
  const atual = [...historico].reverse().find((item: any) => String(item?.chaveAcesso || '') === String((venda as any).chaveAcessoNotaFiscal || ''))
  const ambiente = String(atual?.ambiente || '').toUpperCase()
  return ambiente === 'PRODUCAO' || ambiente === 'HOMOLOGACAO' ? ambiente : ''
}

function normalizarVenda(venda: VendaComMetadados): VendaComMetadados {
  const parcelas = Array.isArray(venda.parcelas)
    ? venda.parcelas.map((parcela) => normalizarParcela(parcela))
    : []
  const pedidoHistoricoEntregue = String((venda as any).tipo || '').toLowerCase() === 'pedido'
    && Boolean((venda as any).importacaoHistorica)
    && Boolean(
      (venda as any).entregue
      || (venda as any).dataEntregaRealizada
      || (venda as any).entregaConfirmadaSemNovaBaixa
      || (venda as any).entregaConfirmadaSemBaixaEstoque
    )

  const ambienteFiscalDetectado = detectarAmbienteFiscal(venda)
  return {
    ...venda,
    ...(pedidoHistoricoEntregue
      ? { status: 'CONCLUÍDO', statusPedido: 'Entregue', logisticaStatus: 'Entregue' }
      : {}),
    parcelas,
    ...((ambienteFiscalDetectado && (venda.statusNotaFiscal === 'Autorizada' || venda.statusNotaFiscal === 'Emitida'))
      ? { ambienteNotaFiscal: ambienteFiscalDetectado }
      : {}),
    statusNotaFiscal: venda.statusNotaFiscal || 'Pendente',
    statusBoleto: venda.statusBoleto || 'Pendente',
    ambienteBoleto: venda.ambienteBoleto || 'homologacao',
    totalBoletosGerados: venda.totalBoletosGerados || 0,
    ultimoErroBoleto: venda.ultimoErroBoleto || '',
    ultimaAtualizacaoBoleto: venda.ultimaAtualizacaoBoleto || '',
    criadoEm: venda.criadoEm || gerarDataAtual(),
    atualizadoEm: venda.atualizadoEm || gerarDataAtual(),
  }
}

export function listarVendasStorage(): Venda[] {
  const vendas = obterColecaoMemoria<Venda>('vendas')
  return Array.isArray(vendas)
    ? vendas.map((venda) =>
        normalizarVenda(venda as VendaComMetadados),
      ) as unknown as Venda[]
    : []
}

export function salvarVendasStorage(vendas: Venda[]) {
  const vendasNormalizadas = vendas.map((venda) =>
    normalizarVenda(venda as VendaComMetadados),
  ) as unknown as Venda[]

  salvarBackupLocal(vendasNormalizadas)
  sincronizarColecaoCentral('vendas', vendasNormalizadas)
}

export function buscarVendaStorage(id: string) {
  return listarVendasStorage().find((venda) => String(venda.id) === String(id))
}

export function salvarVendaStorage(venda: Venda) {
  const vendas = listarVendasStorage()

  const existe = vendas.some((item) => String(item.id) === String(venda.id))

  const vendaBase = venda as VendaComMetadados

  const vendaAtualizada = normalizarVenda({
    ...vendaBase,
    criadoEm: vendaBase.criadoEm || gerarDataAtual(),
    atualizadoEm: gerarDataAtual(),
  }) as unknown as Venda

  const atualizadas = existe
    ? vendas.map((item) =>
        String(item.id) === String(venda.id) ? vendaAtualizada : item,
      )
    : [...vendas, vendaAtualizada]

  salvarVendasStorage(atualizadas)

  return atualizadas
}

export function excluirVendaStorage(id: string) {
  const atualizadas = listarVendasStorage().filter(
    (venda) => String(venda.id) !== String(id),
  )

  salvarVendasStorage(atualizadas)

  return atualizadas
}

export async function excluirVendaStorageConfirmado(id: string): Promise<Venda[]> {
  await excluirRegistroColecaoCentral('vendas', id)
  const confirmacao = await carregarColecaoCentral<Venda>('vendas')
  const vendasConfirmadas = Array.isArray(confirmacao.data) ? confirmacao.data : []
  if (vendasConfirmadas.some((venda) => String(venda.id) === String(id))) {
    throw new Error('O pedido continuou presente no MySQL após a exclusão.')
  }
  definirColecaoMemoria('vendas', vendasConfirmadas)
  salvarBackupLocal(vendasConfirmadas)
  return vendasConfirmadas
}

export function listarOrcamentosStorage() {
  return listarVendasStorage().filter((venda) => venda.tipo === 'Orçamento')
}

export function listarPedidosStorage() {
  return listarVendasStorage().filter((venda) => venda.tipo === 'Pedido')
}

export function gerarPedidoAPartirDoOrcamento(orcamento: Venda) {
  const dataAtual = gerarDataAtual()
  const vendas = listarVendasStorage()

  const pedido = normalizarVenda({
    ...orcamento,
    id: String(Date.now()),
    tipo: 'Pedido',

    numeroPedido: '',
    orcamentoOrigemId: orcamento.id,
    orcamentoOrigemNumero: orcamento.numeroOrcamento,

    statusPedido: 'Aberto',
    statusOrcamento: undefined,

    statusNotaFiscal: 'Pendente',
    statusBoleto: 'Pendente',
    bancoBoleto: orcamento.bancoCobranca || '',
    ambienteBoleto: 'homologacao',
    totalBoletosGerados: 0,
    ultimoErroBoleto: '',
    ultimaAtualizacaoBoleto: dataAtual,

    notaBoletoEnviados: false,

    criadoEm: dataAtual,
    atualizadoEm: dataAtual,
  } as VendaComMetadados) as unknown as Venda

  const orcamentoAtualizado = {
    ...(orcamento as VendaComMetadados),
    statusOrcamento: 'Efetivado',
    atualizadoEm: dataAtual,
  } as unknown as Venda

  const atualizadas = vendas.map((item) =>
    String(item.id) === String(orcamento.id) ? orcamentoAtualizado : item,
  )

  atualizadas.push(pedido)

  salvarVendasStorage(atualizadas)

  return pedido
}

export function aprovarOrcamentoStorage(id: string) {
  const vendas = listarVendasStorage()

  const atualizadas = vendas.map((venda) => {
    if (String(venda.id) !== String(id)) {
      return venda
    }

    return {
      ...(venda as VendaComMetadados),
      statusOrcamento: 'Aprovado',
      atualizadoEm: gerarDataAtual(),
    } as unknown as Venda
  })

  salvarVendasStorage(atualizadas)

  return atualizadas
}

export function reprovarOrcamentoStorage(id: string) {
  const vendas = listarVendasStorage()

  const atualizadas = vendas.map((venda) => {
    if (String(venda.id) !== String(id)) {
      return venda
    }

    return {
      ...(venda as VendaComMetadados),
      statusOrcamento: 'Reprovado',
      atualizadoEm: gerarDataAtual(),
    } as unknown as Venda
  })

  salvarVendasStorage(atualizadas)

  return atualizadas
}

export function cancelarVendaStorage(id: string) {
  const vendas = listarVendasStorage()

  const atualizadas = vendas.map((venda) => {
    if (String(venda.id) !== String(id)) {
      return venda
    }

    if (venda.tipo === 'Orçamento') {
      return {
        ...(venda as VendaComMetadados),
        statusOrcamento: 'Cancelado',
        atualizadoEm: gerarDataAtual(),
      } as unknown as Venda
    }

    return {
      ...(venda as VendaComMetadados),
      statusPedido: 'Cancelado',
      atualizadoEm: gerarDataAtual(),
    } as unknown as Venda
  })

  salvarVendasStorage(atualizadas)

  return atualizadas
}

export function atualizarParcelaBoletoStorage(
  vendaId: string,
  numeroParcela: number,
  dadosParcela: Partial<ParcelaVenda>,
) {
  const vendas = listarVendasStorage()

  const atualizadas = vendas.map((venda) => {
    if (String(venda.id) !== String(vendaId)) {
      return venda
    }

    const parcelasAtualizadas = venda.parcelas.map((parcela) => {
      if (Number(parcela.numero) !== Number(numeroParcela)) {
        return parcela
      }

      return normalizarParcela({
        ...parcela,
        ...dadosParcela,
      })
    })

    const boletosGerados = parcelasAtualizadas.filter((parcela) =>
      ['Gerado', 'Enviado', 'Pago', 'Vencido'].includes(
        String(parcela.statusBoleto || ''),
      ),
    ).length

    return normalizarVenda({
      ...(venda as VendaComMetadados),
      parcelas: parcelasAtualizadas,
      statusBoleto:
        boletosGerados > 0
          ? 'Gerado'
          : dadosParcela.statusBoleto || venda.statusBoleto || 'Pendente',
      totalBoletosGerados: boletosGerados,
      ultimoErroBoleto: dadosParcela.erroBoleto || venda.ultimoErroBoleto || '',
      ultimaAtualizacaoBoleto: gerarDataAtual(),
      atualizadoEm: gerarDataAtual(),
    }) as unknown as Venda
  })

  salvarVendasStorage(atualizadas)

  return atualizadas.find((venda) => String(venda.id) === String(vendaId))
}

export function marcarBoletoErroStorage(
  vendaId: string,
  numeroParcela: number,
  mensagemErro: string,
) {
  return atualizarParcelaBoletoStorage(vendaId, numeroParcela, {
    statusBoleto: 'Erro',
    erroBoleto: mensagemErro,
    motivoErroBoleto: mensagemErro,
  })
}

export function marcarBoletoPagoStorage(
  vendaId: string,
  numeroParcela: number,
  dataPagamento = new Date(),
) {
  const data = dataPagamento.toISOString().slice(0, 10)
  const horario = dataPagamento.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return atualizarParcelaBoletoStorage(vendaId, numeroParcela, {
    statusBoleto: 'Pago',
    dataPagamentoBoleto: data,
    horarioPagamentoBoleto: horario,
  })
}


export async function salvarVendasStorageConfirmado(vendas: Venda[]) {
  const vendasNormalizadas = vendas.map((venda) =>
    normalizarVenda(venda as VendaComMetadados),
  ) as unknown as Venda[]

  salvarBackupLocal(vendasNormalizadas)
  await sincronizarColecaoCentralAgora('vendas', vendasNormalizadas)
}

export async function corrigirOrcamentosImportadosSemPedidoReal(): Promise<string[]> {
  const vendas = listarVendasStorage()
  const corrigidos: string[] = []
  const atualizadas = vendas.map((venda) => {
    const registro = venda as any
    const tipo = String(registro.tipo || '').toLocaleLowerCase('pt-BR')
    const status = String(registro.statusOrcamento || registro.status || '').toLocaleLowerCase('pt-BR')
    const temLegadoBloqueador = Boolean(registro.numeroPedido || registro.pedidoId || registro.pedidoGeradoId || registro.pedidoGeradoEm || registro.convertido || registro.pedidoGerado)
    const estado = determinarEstadoRealOrcamento(registro, vendas)
    if (!tipo.includes('orçamento') || !status.includes('abert') || !temLegadoBloqueador || estado.convertido) return venda

    const copia = { ...registro, tipo: 'Orçamento', status: 'ABERTO', statusOrcamento: 'Aberto', aprovado: false, reprovado: false, convertido: false, pedidoGerado: false }
    for (const campo of ['numeroPedido', 'pedidoId', 'pedidoGeradoId', 'pedidoGeradoEm', 'dataConversao']) delete copia[campo]
    corrigidos.push(String(registro.numeroOrcamento || registro.id))
    return copia as Venda
  })

  if (corrigidos.length > 0) await salvarVendasStorageConfirmado(atualizadas)
  return corrigidos
}

function numeroLogicoVenda(venda: Venda): string {
  const registro = venda as any
  const tipo = String(registro?.tipo || '').toLocaleLowerCase('pt-BR')
  const numero = tipo.includes('pedido')
    ? registro?.numeroPedido
    : registro?.numeroOrcamento

  return String(numero || '').replace(/\D/g, '')
}

function mesmoRegistroVenda(item: Venda, venda: Venda): boolean {
  if (String((item as any)?.id || '') === String((venda as any)?.id || '')) {
    return true
  }

  const tipoItem = String((item as any)?.tipo || '').toLocaleLowerCase('pt-BR')
  const tipoVenda = String((venda as any)?.tipo || '').toLocaleLowerCase('pt-BR')
  const numeroItem = numeroLogicoVenda(item)
  const numeroVenda = numeroLogicoVenda(venda)

  return Boolean(
    numeroItem &&
    numeroVenda &&
    numeroItem === numeroVenda &&
    tipoItem === tipoVenda,
  )
}

export async function salvarVendaStorageConfirmado(venda: Venda) {
  const respostaServidor = await carregarColecaoCentral<Venda>('vendas')
  const vendasServidor = Array.isArray(respostaServidor.data)
    ? respostaServidor.data
    : []

  const vendaBase = venda as VendaComMetadados
  const existente = vendasServidor.find((item) => mesmoRegistroVenda(item, venda))
  const marcadorImportacao = Boolean((venda as any).importado || (venda as any).importacaoHistorica || String((venda as any).origem || '').toLowerCase().includes('import'))
  const vendaEntrada = !existente && marcadorImportacao && String((venda as any).tipo || '').toLocaleLowerCase('pt-BR').includes('orçamento')
    ? normalizarNovoOrcamentoImportado(venda as any)
    : venda
  const vendaAtualizada = normalizarVenda({
    ...(existente as VendaComMetadados | undefined),
    ...(vendaEntrada as VendaComMetadados),
    id: String(vendaBase.id || (existente as any)?.id || ''),
    criadoEm:
      (existente as VendaComMetadados | undefined)?.criadoEm ||
      vendaBase.criadoEm ||
      gerarDataAtual(),
    atualizadoEm: gerarDataAtual(),
  }) as unknown as Venda

  const atualizacao = await atualizarRegistroColecaoCentral('vendas', vendaAtualizada)
  if (String((atualizacao.record as any)?.id || '') !== String((vendaAtualizada as any).id || '')) {
    throw new Error('O MySQL confirmou um ID diferente do orçamento enviado.')
  }

  const confirmacao = await carregarColecaoCentral<Venda>('vendas')
  const vendasConfirmadas = Array.isArray(confirmacao.data)
    ? confirmacao.data
    : []
  const gravada = vendasConfirmadas.find((item) =>
    mesmoRegistroVenda(item, vendaAtualizada),
  )

  if (!gravada) {
    throw new Error('O servidor não devolveu o orçamento/pedido após a gravação.')
  }

  if (JSON.stringify(gravada) !== JSON.stringify(vendaAtualizada)) {
    throw new Error('A releitura do MySQL divergiu dos dados enviados. Recarregue o orçamento antes de tentar novamente.')
  }

  if (String((gravada as any).id || '') !== String((vendaAtualizada as any).id || '')) {
    throw new Error('O servidor devolveu um ID diferente após a gravação do pedido.')
  }
  if (String((gravada as any).numeroPedido || '') !== String((vendaAtualizada as any).numeroPedido || '')) {
    throw new Error('O servidor devolveu um número de pedido diferente após a gravação.')
  }

  definirColecaoMemoria('vendas', vendasConfirmadas)
  salvarBackupLocal(vendasConfirmadas)

  return gravada
}
