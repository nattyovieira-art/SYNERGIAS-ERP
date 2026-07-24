/* SYNERGIAS_PEDIDO_2508_STATUS_BOLETO_V296
   Ajuste cirúrgico do Pedido 2508:
   - preserva o mesmo registro, ID, itens, cliente, NF-e e ordenação;
   - confirma a NF-e 2429 antes de gravar;
   - marca o Pedido como Entregue;
   - reconhece o boleto já emitido como Gerado;
   - não emite, recria, cancela ou consulta nova cobrança.
*/

const MARCADOR = 'SYNERGIAS_PEDIDO_2508_STATUS_BOLETO_V296'

function texto(...valores: unknown[]): string {
  for (const valor of valores) {
    const resultado = String(valor ?? '').trim()
    if (resultado) return resultado
  }
  return ''
}

function digitos(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '')
}

function numeroPedido(registro: any): string {
  return digitos(registro?.numeroPedido || registro?.pedidoNumero || registro?.numero)
}

function numerosNfe(registro: any): string[] {
  const diretos = [
    registro?.numeroNotaFiscal,
    registro?.numeroNFe,
    registro?.numeroNfe,
    registro?.numeroNF,
    registro?.notaFiscalNumero,
    registro?.nfeNumero,
  ]
  const historico = Array.isArray(registro?.historicoNotaFiscal)
    ? registro.historicoNotaFiscal.flatMap((item: any) => [
        item?.numero,
        item?.numeroNotaFiscal,
        item?.numeroNFe,
        item?.numeroNfe,
      ])
    : []
  return [...diretos, ...historico].map(digitos).filter(Boolean)
}

function ehPedido2508(registro: any): boolean {
  const tipo = texto(registro?.tipo).toUpperCase()
  return numeroPedido(registro) === '2508' && !tipo.includes('ORÇAMENTO') && !tipo.includes('ORCAMENTO')
}

export async function corrigirPedido2508StatusBoleto(
  vendasEntrada: any[],
  atualizar: any,
  carregar: any,
): Promise<any[]> {
  const vendas = Array.isArray(vendasEntrada) ? vendasEntrada : []
  const encontrados = vendas.filter(ehPedido2508)

  if (encontrados.length !== 1) {
    console.warn(`[V296] Ajuste bloqueado: foram encontrados ${encontrados.length} Pedidos 2508.`)
    return vendas
  }

  const pedido = encontrados[0]
  if (!numerosNfe(pedido).includes('2429')) {
    console.warn('[V296] Ajuste bloqueado: a NF-e 2429 não está vinculada ao Pedido 2508.')
    return vendas
  }

  const jaCorrigido =
    texto(pedido?.statusPedido).toUpperCase() === 'ENTREGUE'
    && texto(pedido?.statusBoleto).toUpperCase() === 'GERADO'
    && pedido?.marcadorStatus2508 === MARCADOR

  if (jaCorrigido) return vendas

  const idOriginal = texto(pedido?.id)
  if (!idOriginal) {
    console.warn('[V296] Ajuste bloqueado: o Pedido 2508 não possui ID persistido.')
    return vendas
  }

  const atualizado = {
    ...pedido,
    id: idOriginal,
    tipo: 'Pedido',
    numeroPedido: '2508',
    statusPedido: 'Entregue',
    statusBoleto: 'Gerado',
    totalBoletosGerados: Math.max(1, Number(pedido?.totalBoletosGerados || 0)),
    boletoReconhecidoNoBanco: true,
    ultimaAtualizacaoBoleto: new Date().toISOString(),
    marcadorStatus2508: MARCADOR,
    atualizadoEm: new Date().toISOString(),
  }

  await atualizar('vendas', atualizado)

  const confirmacao = await carregar('vendas')
  const vendasConfirmadas = Array.isArray(confirmacao?.data) ? confirmacao.data : []
  const confirmado = vendasConfirmadas.find((item: any) => texto(item?.id) === idOriginal)

  if (
    !confirmado
    || numeroPedido(confirmado) !== '2508'
    || !numerosNfe(confirmado).includes('2429')
    || texto(confirmado?.statusPedido).toUpperCase() !== 'ENTREGUE'
    || texto(confirmado?.statusBoleto).toUpperCase() !== 'GERADO'
  ) {
    throw new Error('O MySQL não confirmou integralmente os dois ajustes do Pedido 2508.')
  }

  console.info('[V296] Pedido 2508 preservado e confirmado como Entregue, com boleto Gerado.')
  return vendasConfirmadas
}
