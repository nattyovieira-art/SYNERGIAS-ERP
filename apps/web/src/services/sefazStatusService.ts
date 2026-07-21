export type ResultadoStatusSefaz = {
  operacional: boolean
  ambiente: string
  uf: string
  cStat: string
  xMotivo: string
  dhRecbto: string
  tempoMedio: string
  versaoAplicacao: string
  httpStatus: number
  duracaoMs: number
  consultadoEm: string
  endpoint: string
  versaoEndpoint: string
}

const API_BASE = '/api/fiscal/sefaz-status.php'

async function lerResposta(response: Response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const diagnostico = data?.diagnostico?.codigoTransporte
      ? ` Código técnico: ${data.diagnostico.codigoTransporte}.`
      : ''
    throw new Error(`${data?.mensagem || 'Não foi possível consultar a SEFAZ-RS.'}${diagnostico}`)
  }
  return data
}

export async function consultarStatusSefazRs(params: {
  ambiente: 'HOMOLOGACAO'
  uf: 'RS'
  cnpj: string
}): Promise<ResultadoStatusSefaz> {
  const response = await fetch(`${API_BASE}?action=consultar`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await lerResposta(response)
  return data as ResultadoStatusSefaz
}
