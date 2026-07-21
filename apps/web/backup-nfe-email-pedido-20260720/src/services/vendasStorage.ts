// SYNERGIAS_SALVAR_VENDAS_MYSQL_CONFIRMADO_V284
import type { ParcelaVenda, Venda } from '../types/Venda'
import { carregarColecaoCentral, definirColecaoMemoria, obterColecaoMemoria, sincronizarColecaoCentral, sincronizarColecaoCentralAgora } from './erpApi'



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
  return {
    ...parcela,
    statusBoleto: parcela.statusBoleto || 'Pendente',
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

  const ambienteFiscalDetectado = detectarAmbienteFiscal(venda)
  return {
    ...venda,
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
  const vendaAtualizada = normalizarVenda({
    ...(existente as VendaComMetadados | undefined),
    ...vendaBase,
    id: String(vendaBase.id || (existente as any)?.id || ''),
    criadoEm:
      (existente as VendaComMetadados | undefined)?.criadoEm ||
      vendaBase.criadoEm ||
      gerarDataAtual(),
    atualizadoEm: gerarDataAtual(),
  }) as unknown as Venda

  const atualizadas = existente
    ? vendasServidor.map((item) =>
        mesmoRegistroVenda(item, vendaAtualizada) ? vendaAtualizada : item,
      )
    : [...vendasServidor, vendaAtualizada]

  await sincronizarColecaoCentralAgora('vendas', atualizadas)

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

  definirColecaoMemoria('vendas', vendasConfirmadas)
  salvarBackupLocal(vendasConfirmadas)

  return vendasConfirmadas
}
