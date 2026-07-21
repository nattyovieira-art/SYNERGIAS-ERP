import type { ConfiguracaoFiscalEmpresa } from '../types/ConfiguracaoFiscal'
import type { Venda } from '../types/Venda'

export type ResultadoPreEmissaoNFe = {
  ok: boolean
  pronto: boolean
  ambiente: 'PRODUCAO'
  versao: string
  erros: string[]
  avisos: string[]
  resumo: {
    emitenteCnpj: string
    destinatarioDocumento: string
    itens: number
    valorTotal: number
  }
  validadoEm: string
}

const API = '/api/fiscal/nfe-preflight-v56.php'

const CODIGOS_IBGE_MUNICIPIOS: Record<string, string> = {
  'MARCADOR|SYNERGIAS_IBGE_CLIENTE_CADASTRO_PEDIDO_V254': '',
  'RS|PORTO ALEGRE': '4314902',
}

function normalizarMunicipio(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function prepararVendaComCodigoIbge(venda: Venda): Venda {
  const codigoAtual = String(venda.faturamentoCodigoIbge ?? '').replace(/\D/g, '')
  if (codigoAtual.length === 7) return venda

  const uf = String(venda.faturamentoEstado ?? '').trim().toUpperCase()
  const cidade = normalizarMunicipio(venda.faturamentoCidade)
  const codigo = CODIGOS_IBGE_MUNICIPIOS[`${uf}|${cidade}`]
  if (!codigo) return venda

  return { ...venda, faturamentoCodigoIbge: codigo }
}

export async function validarPreEmissaoNFe(params: {
  venda: Venda
  fiscal: ConfiguracaoFiscalEmpresa
}): Promise<ResultadoPreEmissaoNFe> {
  const response = await fetch(API, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ambiente: 'PRODUCAO', ...params, venda: prepararVendaComCodigoIbge(params.venda), fiscal: { ...params.fiscal, regimeTributario: params.fiscal.regimeTributario || 'SIMPLES_NACIONAL', regimeTributarioConfirmado: true } }),
  })
  const contentType = response.headers.get('content-type') || ''
  const raw = await response.text()
  let data: any = {}

  if (raw.trim() !== '') {
    try {
      data = JSON.parse(raw)
    } catch {
      const detalhe = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
      throw new Error(
        `A validação fiscal retornou uma resposta inválida (HTTP ${response.status}).` +
          (detalhe ? `\nDetalhe do servidor: ${detalhe}` : '') +
          (contentType ? `\nTipo recebido: ${contentType}` : ''),
      )
    }
  }

  if (!response.ok) {
    const erros = Array.isArray(data?.erros) ? data.erros.join('\n') : ''
    const mensagem = data?.mensagem || data?.error || `Falha HTTP ${response.status} na validação da NF-e.`
    throw new Error([mensagem, erros].filter(Boolean).join('\n'))
  }

  if (!data || data.ok !== true || typeof data.pronto !== 'boolean') {
    throw new Error(`A API de pré-emissão retornou dados incompletos (HTTP ${response.status}).`)
  }

  return data as ResultadoPreEmissaoNFe
}


export type ResultadoRascunhoXmlNFe = {
  ok: boolean
  pronto: boolean
  ambiente: 'PRODUCAO'
  versao: string
  chaveAcesso: string
  numero: string
  serie: string
  xml: string
  xmlBase64: string
  erros: string[]
  avisos: string[]
  geradoEm: string
}


async function obterProximaNumeracaoNFe(referencia: string): Promise<{ numero: number; serie: string }> {
  const response = await fetch('/api/numeracao-fiscal.php', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'reservar', documento: 'NF-e', ambiente: 'PRODUCAO', serie: '1', referencia }),
  })
  const raw = await response.text()
  let data: any = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { throw new Error('A reserva da numeração fiscal retornou uma resposta inválida.') }
  if (!response.ok || data?.ok !== true || !Number.isInteger(Number(data?.numero))) {
    throw new Error(data?.error || data?.mensagem || `Não foi possível reservar o próximo número da NF-e (HTTP ${response.status}). Nenhuma nota foi transmitida.`)
  }
  if (Array.isArray(data.numeracao)) localStorage.setItem('synergias_numeracao_fiscal', JSON.stringify(data.numeracao))
  return { numero: Number(data.numero), serie: String(data.serie || '1') }
}

export async function registrarNumeracaoNFeAutorizada(params: {
  numero: string | number
  serie: string | number
  ambiente?: 'HOMOLOGACAO' | 'PRODUCAO'
  cStat: string
  chaveAcesso: string
  protocolo: string
}) {
  const { numero, serie, ambiente = 'PRODUCAO', cStat, chaveAcesso, protocolo } = params
  const numeroNormalizado = Math.max(0, Number(numero) || 0)
  const serieNormalizada = String(serie || '1').replace(/\D/g, '').slice(0, 3) || '1'
  try {
    const response = await fetch('/api/numeracao-fiscal.php', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'confirmar_autorizada', numero: numeroNormalizado, serie: serieNormalizada, ambiente, cStat, chaveAcesso, protocolo }),
    })
    const data = await response.json()
    if (response.ok && data?.ok === true && Array.isArray(data.numeracao)) {
      localStorage.setItem('synergias_numeracao_fiscal', JSON.stringify(data.numeracao))
    }
  } catch {
    // A autorização da SEFAZ não é desfeita por uma falha local de sincronização.
  }
}

export async function liberarNumeracaoNFeRejeitada(referencia: string, serie: string | number = '1') {
  const response = await fetch('/api/numeracao-fiscal.php', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      acao: 'liberar_reserva',
      ambiente: 'PRODUCAO',
      serie: String(serie || '1'),
      referencia,
    }),
  })
  const data = await response.json()
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.error || 'A rejeição não pôde liberar a reserva da numeração fiscal.')
  }
}

export async function gerarRascunhoXmlNFe(params: {
  venda: Venda
  fiscal: ConfiguracaoFiscalEmpresa
}): Promise<ResultadoRascunhoXmlNFe> {
  const numeracao = await obterProximaNumeracaoNFe(String(params.venda?.id || params.venda?.numeroPedido || 'pedido-sem-id'))
  const response = await fetch('/api/fiscal/nfe-xml-preview-v63.php', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ambiente: 'PRODUCAO', ...params, venda: prepararVendaComCodigoIbge(params.venda), fiscal: { ...params.fiscal, regimeTributario: params.fiscal.regimeTributario || 'SIMPLES_NACIONAL', regimeTributarioConfirmado: true }, numeracao }),
  })
  const raw = await response.text()
  let data: any = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { throw new Error('A montagem do XML retornou uma resposta inválida.') }
  if (!response.ok || data?.ok !== true) {
    const detalhesLista = Array.isArray(data?.erros) ? data.erros.join('\n') : ''
    const detalhesTecnicos = [
      data?.detalhe ? `Detalhe: ${data.detalhe}` : '',
      data?.tipo ? `Tipo: ${data.tipo}` : '',
      data?.arquivo ? `Arquivo: ${data.arquivo}` : '',
      data?.linha ? `Linha: ${data.linha}` : '',
      data?.codigoErro ? `Código: ${data.codigoErro}` : '',
      data?.phpVersion ? `PHP: ${data.phpVersion}` : '',
      data?.extensoes
        ? `Extensões: DOM=${data.extensoes.dom ? 'sim' : 'não'}, OpenSSL=${data.extensoes.openssl ? 'sim' : 'não'}, LibXML=${data.extensoes.libxml ? 'sim' : 'não'}, mbstring=${data.extensoes.mbstring ? 'sim' : 'não'}`
        : '',
    ].filter(Boolean).join('\n')
    throw new Error([
      data?.mensagem || `Falha HTTP ${response.status} ao montar o XML.`,
      data?.detalhes || '',
      detalhesLista,
      detalhesTecnicos,
    ].filter(Boolean).join('\n'))
  }
  return data as ResultadoRascunhoXmlNFe
}

export type ResultadoHomologacaoNFe = {
  ok: boolean
  versao: string
  ambiente: 'PRODUCAO'
  assinado: boolean
  autorizada: boolean
  cStat: string
  motivo: string
  protocolo: string
  recebidoEm: string
  chaveAcesso: string
  xmlAssinadoBase64: string
  xmlProcessadoBase64: string
  danfeUrl: string
}

export async function assinarETransmitirNFeHomologacao(xmlBase64: string): Promise<ResultadoHomologacaoNFe> {
  const response = await fetch('/api/fiscal/nfe-homologacao-v75.php', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ambiente: 'PRODUCAO', xmlBase64 }),
  })
  const raw = await response.text()
  let data: any = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { throw new Error('A transmissão da NF-e retornou uma resposta inválida.') }
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.mensagem || `Falha HTTP ${response.status} na transmissão da NF-e.`)
  }
  return data as ResultadoHomologacaoNFe
}

export type ResultadoCancelamentoNFe = {
  ok: boolean
  versao: string
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO'
  cancelada: boolean
  cStat: string
  motivo: string
  protocoloEvento: string
  recebidoEm: string
  xmlEventoBase64: string
  xmlEventoProcessadoBase64: string
}

export async function cancelarNFeSefaz(params: {
  chaveAcesso: string
  protocoloAutorizacao: string
  justificativa: string
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO'
}): Promise<ResultadoCancelamentoNFe> {
  const response = await fetch('/api/fiscal/nfe-cancelamento.php', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const raw = await response.text()
  let data: any = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { throw new Error('O cancelamento da NF-e retornou uma resposta inválida.') }
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.mensagem || `Falha HTTP ${response.status} no cancelamento da NF-e.`)
  }
  return data as ResultadoCancelamentoNFe
}
