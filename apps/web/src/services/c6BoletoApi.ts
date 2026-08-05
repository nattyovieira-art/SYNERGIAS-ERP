import type { ParcelaVenda, Venda } from '../types/Venda'

export type CobrancaC6Api = {
  c6Id: string
  externalReferenceId?: string
  nossoNumero?: string
  linhaDigitavel?: string
  codigoBarras?: string
  status?: string
  valor?: number
  vencimento?: string
  pagamentos?: unknown[]
  raw?: unknown
}

async function post<T>(action: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/c6-boleto.php?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let payload: any
  try { payload = text ? JSON.parse(text) : {} } catch { payload = null }
  if (!response.ok || !payload?.ok) {
    const details = payload?.details
    const detailText = typeof details === 'string'
      ? details
      : details
        ? JSON.stringify(details)
        : ''
    throw new Error([payload?.error || `C6 recusou a operação (HTTP ${response.status}).`, detailText].filter(Boolean).join(' '))
  }
  return payload as T
}

export async function emitirBoletoC6(
  pedido: Venda,
  parcela: ParcelaVenda,
  opcoes?: { recuperarPdf?: boolean },
) {
  const resposta = await post<{ cobranca?: CobrancaC6Api }>('emitir', { pedido, parcela, opcoes })
  if (!resposta.cobranca?.c6Id) throw new Error('O C6 não retornou o identificador do boleto.')
  return resposta.cobranca
}

export async function consultarBoletoC6(c6Id: string) {
  const resposta = await post<{ cobranca?: CobrancaC6Api }>('consultar', { c6Id })
  return resposta.cobranca || { c6Id }
}

export async function obterPdfBoletoC6(c6Id: string) {
  const resposta = await post<{ pdf?: { pdfBase64?: string } }>('pdf', { c6Id })
  return String(resposta.pdf?.pdfBase64 || '')
}

export async function cancelarBoletoC6(c6Id: string) {
  const resposta = await post<{ cobranca?: CobrancaC6Api }>('cancelar', { c6Id })
  return resposta.cobranca || { c6Id }
}

export async function alterarBoletoC6(
  c6Id: string,
  alteracao: {
    amount?: number
    due_date?: string
    payer?: {
      name?: string
      tax_id?: string
      email?: string
      address?: {
        street?: string
        number?: number
        complement?: string
        city?: string
        state?: string
        zip_code?: string
      }
    }
    discount?: unknown
    interest?: unknown
    fine?: unknown
  },
) {
  const resposta = await post<{ cobranca?: CobrancaC6Api }>('alterar', { c6Id, alteracao })
  return resposta.cobranca || { c6Id }
}
