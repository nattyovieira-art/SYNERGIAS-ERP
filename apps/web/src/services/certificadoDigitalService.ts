export type StatusCertificadoA1 = 'ATIVO' | 'VENCENDO' | 'VENCIDO' | 'NAO_CONFIGURADO'

export type CertificadoA1Info = {
  configurado: boolean
  status: StatusCertificadoA1
  cnpj: string
  razaoSocial: string
  emissor: string
  validoDe: string
  validoAte: string
  diasRestantes: number | null
  instaladoEm: string
}

const API_BASE = '/api/fiscal/certificado-a1.php'

async function lerResposta(response: Response) {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.mensagem || data?.error || 'Não foi possível concluir a operação.')
  }

  return data
}

export async function buscarStatusCertificadoA1(): Promise<CertificadoA1Info> {
  const response = await fetch(`${API_BASE}?action=status`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const data = await lerResposta(response)
  return data.certificado as CertificadoA1Info
}

export async function solicitarCodigoCertificadoA1(): Promise<void> {
  const response = await fetch(`${API_BASE}?action=codigo`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  await lerResposta(response)
}

export async function instalarCertificadoA1(params: {
  arquivo: File
  senha: string
  codigoSeguranca: string
  cnpjConfigurado: string
}): Promise<CertificadoA1Info> {
  const formData = new FormData()
  formData.append('certificado', params.arquivo)
  formData.append('senha', params.senha)
  formData.append('codigoSeguranca', params.codigoSeguranca)
  formData.append('cnpjConfigurado', params.cnpjConfigurado)

  const response = await fetch(`${API_BASE}?action=instalar`, {
    method: 'POST',
    credentials: 'same-origin',
    body: formData,
  })

  const data = await lerResposta(response)
  return data.certificado as CertificadoA1Info
}

export async function removerCertificadoA1(codigoSeguranca: string): Promise<void> {
  const response = await fetch(`${API_BASE}?action=remover`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigoSeguranca }),
  })

  await lerResposta(response)
}
