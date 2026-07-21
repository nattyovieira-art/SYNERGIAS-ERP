import type { ParcelaVenda, Venda } from '../types/Venda'

const API_INTER_COBRANCA = '/api/inter-cobranca.php'

export type CobrancaInterApi = {
  codigoSolicitacao: string
  nossoNumero?: string
  seuNumero?: string
  linhaDigitavel?: string
  codigoBarras?: string
  pixCopiaECola?: string
  txid?: string
  status?: string
  valorRecebido?: number
  dataPagamento?: string
  pdfBase64?: string
  raw?: unknown
}

type RespostaInter<T> = {
  ok: boolean
  cobranca?: T
  pdf?: { pdfBase64?: string; mimeType?: string }
  error?: string
  details?: unknown
}

async function lerResposta<T>(response: Response): Promise<T> {
  const texto = await response.text()
  let payload: any = null

  try {
    payload = texto ? JSON.parse(texto) : {}
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detalhes = Array.isArray(payload?.details)
      ? payload.details.join('\n')
      : payload?.details
        ? JSON.stringify(payload.details)
        : ''
    throw new Error(
      [payload?.error || `Erro HTTP ${response.status}`, detalhes]
        .filter(Boolean)
        .join('\n'),
    )
  }

  if (!payload) {
    throw new Error('A API do Synergias retornou uma resposta inválida.')
  }

  return payload as T
}

async function post<T>(action: string, body: unknown): Promise<T> {
  const response = await fetch(
    `${API_INTER_COBRANCA}?action=${encodeURIComponent(action)}`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    },
  )

  return lerResposta<T>(response)
}

export async function emitirCobrancaInter(
  pedido: Venda,
  parcela: ParcelaVenda,
): Promise<CobrancaInterApi> {
  const resposta = await post<RespostaInter<CobrancaInterApi>>('emitir', {
    pedido,
    parcela,
  })

  if (!resposta.cobranca?.codigoSolicitacao) {
    throw new Error('Banco Inter não retornou o identificador da cobrança.')
  }

  return resposta.cobranca
}

export async function consultarCobrancaInter(
  codigoSolicitacao: string,
): Promise<CobrancaInterApi> {
  const resposta = await post<RespostaInter<CobrancaInterApi>>('consultar', {
    codigoSolicitacao,
  })

  return resposta.cobranca || ({ codigoSolicitacao } as CobrancaInterApi)
}

export async function obterPdfCobrancaInter(
  codigoSolicitacao: string,
): Promise<string> {
  const resposta = await post<RespostaInter<CobrancaInterApi>>('pdf', {
    codigoSolicitacao,
  })

  return String(resposta.pdf?.pdfBase64 || '')
}

export async function cancelarCobrancaInter(
  codigoSolicitacao: string,
): Promise<CobrancaInterApi> {
  const resposta = await post<RespostaInter<CobrancaInterApi>>('cancelar', {
    codigoSolicitacao,
    motivo: 'ACERTOS',
  })

  return resposta.cobranca || ({ codigoSolicitacao } as CobrancaInterApi)
}
