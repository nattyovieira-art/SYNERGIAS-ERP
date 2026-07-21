const cacheIbgeMunicipio = new Map<string, string>()

function normalizar(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

export async function resolverCodigoIbgeMunicipio(cidade: unknown, uf: unknown, atual: unknown = ''): Promise<string> {
  const codigoAtual = String(atual ?? '').replace(/\D/g, '')
  if (codigoAtual.length === 7) return codigoAtual

  const cidadeTexto = String(cidade ?? '').trim()
  const ufTexto = String(uf ?? '').trim().toUpperCase().slice(0, 2)
  if (!cidadeTexto || ufTexto.length !== 2) return ''

  const chave = `${ufTexto}|${normalizar(cidadeTexto)}`
  const cache = cacheIbgeMunicipio.get(chave)
  if (cache) return cache

  try {
    const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(ufTexto)}/municipios`, { cache: 'force-cache' })
    if (!resposta.ok) return ''
    const municipios = await resposta.json() as Array<{ id?: number | string; nome?: string }>
    const municipio = municipios.find((item) => normalizar(item.nome) === normalizar(cidadeTexto))
    const codigo = String(municipio?.id ?? '').replace(/\D/g, '')
    if (codigo.length === 7) { cacheIbgeMunicipio.set(chave, codigo); return codigo }
  } catch {
    return ''
  }
  return ''
}

export const SYNERGIAS_IBGE_NACIONAL_AUTOMATICO_V263 = 'SYNERGIAS_IBGE_NACIONAL_AUTOMATICO_V263'
