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

export type ResultadoConsultaNFe = {
  ok: boolean
  cStat: string
  motivo: string
  protocolo: string
  dataRecebimento: string
  autorizada: boolean
  cancelada: boolean
  chaveAcesso: string
}

const API = '/api/fiscal/nfe-preflight-v56.php'

type OpcoesRequisicaoFiscal = {
  etapa: string
  repeticoesSeguras?: number
  timeoutMs?: number
  transmissaoPodeTerOcorrido?: boolean
}

function aguardar(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function requisicaoFiscal(
  url: string,
  init: RequestInit,
  opcoes: OpcoesRequisicaoFiscal,
): Promise<Response> {
  const repeticoes = Math.max(0, opcoes.repeticoesSeguras || 0)
  let ultimoErro: unknown

  for (let tentativa = 0; tentativa <= repeticoes; tentativa += 1) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), opcoes.timeoutMs || 45000)
    try {
      return await fetch(url, {
        ...init,
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(init.headers || {}),
        },
      })
    } catch (erro) {
      ultimoErro = erro
      if (tentativa < repeticoes) {
        await aguardar(700 * (tentativa + 1))
        continue
      }
    } finally {
      window.clearTimeout(timeout)
    }
  }

  const expirou = ultimoErro instanceof DOMException && ultimoErro.name === 'AbortError'
  if (opcoes.transmissaoPodeTerOcorrido) {
    throw new Error(
      `${opcoes.etapa}: a conexão com o servidor foi interrompida` +
        `${expirou ? ' por tempo excedido' : ''}. ` +
        `Não tente emitir novamente: consulte a situação da chave da NF-e para evitar duplicidade.`,
    )
  }
  throw new Error(
    `${opcoes.etapa}: não foi possível comunicar com o servidor do ERP` +
      `${expirou ? ' dentro do tempo esperado' : ''}. ` +
      `Nenhuma NF-e foi transmitida nesta etapa. Atualize a página e tente novamente.`,
  )
}

export async function consultarNFeNaSefaz(chaveAcesso: string): Promise<ResultadoConsultaNFe> {
  const chave = String(chaveAcesso || '').replace(/\D/g, '')
  if (chave.length !== 44) throw new Error('A chave de acesso da NF-e precisa ter 44 dígitos.')
  const response = await requisicaoFiscal('/api/fiscal/nfe-consulta.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chaveAcesso: chave, ambiente: 'PRODUCAO' }),
  }, {
    etapa: 'Consulta da NF-e na SEFAZ',
    repeticoesSeguras: 1,
    timeoutMs: 30000,
  })
  const raw = await response.text()
  let data: any = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { throw new Error('A consulta da NF-e retornou uma resposta inválida.') }
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.error || data?.motivo || `Não foi possível consultar a NF-e (HTTP ${response.status}).`)
  }
  return {
    ok: true,
    cStat: String(data.cStat || ''),
    motivo: String(data.motivo || ''),
    protocolo: String(data.protocolo || ''),
    dataRecebimento: String(data.dataRecebimento || ''),
    autorizada: data.autorizada === true,
    cancelada: data.cancelada === true,
    chaveAcesso: chave,
  }
}

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

function prepararVendaParaApiFiscal(venda: Venda): Venda {
  const {
    xmlNotaFiscal: _xmlNotaFiscal,
    danfePdf: _danfePdf,
    historicoNotaFiscal: _historicoNotaFiscal,
    xmlCancelamentoNotaFiscal: _xmlCancelamentoNotaFiscal,
    ...dados
  } = prepararVendaComCodigoIbge(venda)

  return {
    ...dados,
    parcelas: (dados.parcelas || []).map((parcela) => {
      const {
        boletoPdfBase64: _boletoPdfBase64,
        bancoRetornoOriginal: _bancoRetornoOriginal,
        pixQrCode: _pixQrCode,
        ...parcelaFiscal
      } = parcela
      return parcelaFiscal
    }),
  } as Venda
}

export async function validarPreEmissaoNFe(params: {
  venda: Venda
  fiscal: ConfiguracaoFiscalEmpresa
}): Promise<ResultadoPreEmissaoNFe> {
  const response = await requisicaoFiscal(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ambiente: 'PRODUCAO', ...params, venda: prepararVendaParaApiFiscal(params.venda), fiscal: { ...params.fiscal, regimeTributario: params.fiscal.regimeTributario || 'SIMPLES_NACIONAL', regimeTributarioConfirmado: true } }),
  }, {
    etapa: 'Validação fiscal',
    repeticoesSeguras: 0,
    timeoutMs: 20000,
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
  const response = await requisicaoFiscal('/api/numeracao-fiscal.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'reservar', documento: 'NF-e', ambiente: 'PRODUCAO', serie: '1', referencia }),
  }, {
    etapa: 'Reserva do número da NF-e',
    repeticoesSeguras: 0,
    timeoutMs: 20000,
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
  const response = await requisicaoFiscal('/api/numeracao-fiscal.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'confirmar_autorizada', numero: numeroNormalizado, serie: serieNormalizada, ambiente, cStat, chaveAcesso, protocolo }),
    }, {
      etapa: 'Confirmação do número autorizado',
      repeticoesSeguras: 1,
      timeoutMs: 30000,
    })
  const data = await response.json()
  if (!response.ok || data?.ok !== true || !Array.isArray(data.numeracao)) {
    throw new Error(data?.error || 'A NF-e foi autorizada, mas o contador fiscal não pôde ser confirmado no servidor. Não inicie outra emissão até sincronizar a numeração.')
  }
  localStorage.setItem('synergias_numeracao_fiscal', JSON.stringify(data.numeracao))
}

export async function manterNumeracaoNFeRejeitada(referencia: string, numero: string | number, serie: string | number = '1') {
  const response = await requisicaoFiscal('/api/numeracao-fiscal.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      acao: 'manter_reserva_rejeitada',
      ambiente: 'PRODUCAO',
      serie: String(serie || '1'),
      referencia,
      numero: Number(numero),
    }),
  }, {
    etapa: 'Registro da rejeição fiscal',
    repeticoesSeguras: 1,
    timeoutMs: 30000,
  })
  const data = await response.json()
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.error || 'A rejeição não pôde preservar a reserva da numeração fiscal.')
  }
}

export async function gerarRascunhoXmlNFe(params: {
  venda: Venda
  fiscal: ConfiguracaoFiscalEmpresa
}): Promise<ResultadoRascunhoXmlNFe> {
  const numeracao = await obterProximaNumeracaoNFe(String(params.venda?.id || params.venda?.numeroPedido || 'pedido-sem-id'))
  const response = await requisicaoFiscal('/api/fiscal/nfe-xml-preview-v63.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ambiente: 'PRODUCAO', ...params, venda: prepararVendaParaApiFiscal(params.venda), fiscal: { ...params.fiscal, regimeTributario: params.fiscal.regimeTributario || 'SIMPLES_NACIONAL', regimeTributarioConfirmado: true }, numeracao }),
  }, {
    etapa: 'Montagem do XML',
    repeticoesSeguras: 0,
    timeoutMs: 25000,
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
  const response = await requisicaoFiscal('/api/fiscal/nfe-homologacao-v75.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ambiente: 'PRODUCAO', xmlBase64 }),
  }, {
    etapa: 'Transmissão para a SEFAZ',
    repeticoesSeguras: 0,
    timeoutMs: 120000,
    transmissaoPodeTerOcorrido: true,
  })
  const raw = await response.text()
  let data: any = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { throw new Error('A transmissão da NF-e retornou uma resposta inválida.') }
  // A rejeição 204 indica que esta mesma chave já chegou à SEFAZ. Consultar a
  // chave evita uma nova emissão e recupera a autorização existente.
  let chaveDoXml = ''
  try {
    const bytes = Uint8Array.from(atob(xmlBase64), (caractere) => caractere.charCodeAt(0))
    const xml = new TextDecoder('utf-8').decode(bytes)
    chaveDoXml = String(
      xml.match(/<infNFe[^>]+\bId=["']NFe(\d{44})["']/i)?.[1] || '',
    )
  } catch {
    chaveDoXml = ''
  }
  const chaveDoMotivo = String(data?.motivo || '')
    .match(/\b(\d{44})\b/)?.[1] || ''
  // Na rejeição 204 a chave já autorizada pode ser diferente da nova tentativa
  // (por exemplo, quando o cNF foi regenerado). A SEFAZ informa a chave original
  // no motivo; ela deve ter prioridade para recuperar e vincular a NF existente.
  const chaveDuplicada = String(chaveDoMotivo || data?.chaveAcesso || chaveDoXml)
    .replace(/\D/g, '')
  if (
    String(data?.cStat || '') === '204' &&
    chaveDuplicada.length === 44
  ) {
    const consulta = await requisicaoFiscal('/api/fiscal/nfe-consulta.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ambiente: 'PRODUCAO',
        chaveAcesso: chaveDuplicada,
      }),
    }, {
      etapa: 'Consulta da NF-e já existente',
      repeticoesSeguras: 0,
      timeoutMs: 30000,
      transmissaoPodeTerOcorrido: true,
    })
    const consultaData = await consulta.json()
    if (consulta.ok && consultaData?.ok === true && consultaData?.autorizada === true) {
      return {
        ...data,
        ok: true,
        autorizada: true,
        chaveAcesso: chaveDuplicada,
        cStat: String(consultaData.cStat || '100'),
        motivo: String(consultaData.motivo || 'NF-e autorizada anteriormente.'),
        protocolo: String(consultaData.protocolo || ''),
        recebidoEm: String(
          consultaData.dataRecebimento ||
          data.recebidoEm ||
          new Date().toISOString()
        ),
      } as ResultadoHomologacaoNFe
    }
  }
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
