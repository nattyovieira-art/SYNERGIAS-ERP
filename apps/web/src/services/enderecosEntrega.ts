import type { Cliente, EnderecoEntregaCliente, TipoLocalEntrega } from '../types/Cliente'

const SYNERGIAS_EMAIL_POR_ENDERECO_V297 = 'SYNERGIAS_EMAIL_POR_ENDERECO_V297'
const texto = (valor: unknown) => String(valor ?? '').trim()


function limparCep(valor: unknown) {
  const digitos = texto(valor).replace(/\D/g, '').slice(0, 8)
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : texto(valor)
}

function separarEnderecoComposto(origem: any) {
  const base = {
    cep: texto(origem?.cep),
    logradouro: texto(origem?.logradouro || origem?.endereco),
    numero: texto(origem?.numero),
    complemento: texto(origem?.complemento),
    bairro: texto(origem?.bairro),
    cidade: texto(origem?.cidade),
    uf: texto(origem?.uf || origem?.estado).toUpperCase().slice(0, 2),
  }

  const bruto = base.logradouro
  const jaSeparado = Boolean(base.numero || base.bairro || base.cidade || base.cep)
  const pareceComposto = /\n|\bCEP\b|\d{5}-?\d{3}|\s-\s|,/.test(bruto)
  if (!bruto || (jaSeparado && !/\n|\bCEP\b/.test(bruto)) || !pareceComposto) {
    return { ...base, cep: limparCep(base.cep) }
  }

  let restante = bruto.replace(/\r/g, ' ').replace(/\s+/g, ' ').trim()
  const cepEncontrado = restante.match(/(?:CEP\s*:?\s*)?(\d{5})-?(\d{3})/i)
  const cep = limparCep(base.cep || (cepEncontrado ? `${cepEncontrado[1]}${cepEncontrado[2]}` : ''))
  if (cepEncontrado) restante = restante.replace(cepEncontrado[0], ' ').trim()

  const partes = restante.split(/\s+-\s+|\s*\n\s*/).map((parte) => parte.trim()).filter(Boolean)
  let linhaPrincipal = partes.shift() || restante
  let numero = base.numero
  let logradouro = linhaPrincipal
  const numeroEncontrado = linhaPrincipal.match(/^(.*?)[,\s]+(?:N[º°o]?\s*)?(\d+[A-Za-z0-9\/-]*)\s*$/i)
  if (numeroEncontrado) {
    logradouro = numeroEncontrado[1].replace(/[,]\s*$/, '').trim()
    numero = numero || numeroEncontrado[2]
  }

  let cidade = base.cidade
  let uf = base.uf
  let bairro = base.bairro
  let complemento = base.complemento

  const cidadeUfIndice = partes.findIndex((parte) => /\s[\/-]\s*[A-Z]{2}$|,\s*[A-Z]{2}$/i.test(parte))
  if (cidadeUfIndice >= 0) {
    const cidadeUf = partes.splice(cidadeUfIndice, 1)[0]
    const achado = cidadeUf.match(/^(.*?)(?:\s*[\/,\-]\s*)([A-Z]{2})$/i)
    if (achado) {
      cidade = cidade || achado[1].trim()
      uf = uf || achado[2].toUpperCase()
    }
  }

  if (!bairro && partes.length) bairro = partes.pop() || ''
  if (!complemento && partes.length) complemento = partes.join(' - ')

  return { cep, logradouro, numero, complemento, bairro, cidade, uf }
}

export function gerarEnderecoEntregaId() {
  return `ent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function enderecoEntregaVazio(): EnderecoEntregaCliente {
  return { id: gerarEnderecoEntregaId(), nomeLocal: '', tipoLocal: 'Outro', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', codigoIbgeMunicipio: '', responsavel: '', telefone: '', celular: '', horarioEntrega: '', emailEnvio: '', emailsCopiaEnvio: [], observacoes: '', ativo: true }
}

export function formatarEnderecoEntrega(endereco?: Partial<EnderecoEntregaCliente>) {
  if (!endereco) return ''
  const linha1 = [texto(endereco.logradouro), texto(endereco.numero)].filter(Boolean).join(', ')
  const cidadeUf = [texto(endereco.cidade), texto(endereco.uf)].filter(Boolean).join(' / ')
  const linha2 = [texto(endereco.complemento), texto(endereco.bairro), cidadeUf, texto(endereco.cep) ? `CEP: ${texto(endereco.cep)}` : ''].filter(Boolean).join(' - ')
  return [linha1, linha2].filter(Boolean).join('\n')
}

function legadoParaEndereco(cliente: Cliente): EnderecoEntregaCliente | undefined {
  const c = cliente as any
  const logradouro = texto(c.enderecoEntrega || (c.mesmoEnderecoFiscal ? c.endereco : ''))
  const cep = texto(c.cepEntrega || (c.mesmoEnderecoFiscal ? c.cep : ''))
  if (![logradouro, cep, c.numeroEntrega, c.cidadeEntrega].some((v) => texto(v))) return undefined
  const separado = separarEnderecoComposto({
    cep,
    logradouro,
    numero: texto(c.numeroEntrega || (c.mesmoEnderecoFiscal ? c.numero : '')),
    complemento: texto(c.complementoEntrega || (c.mesmoEnderecoFiscal ? c.complemento : '')),
    bairro: texto(c.bairroEntrega || (c.mesmoEnderecoFiscal ? c.bairro : '')),
    cidade: texto(c.cidadeEntrega || (c.mesmoEnderecoFiscal ? c.cidade : '')),
    uf: texto(c.estadoEntrega || (c.mesmoEnderecoFiscal ? c.estado : '')),
  })
  return {
    ...enderecoEntregaVazio(), id: texto(c.enderecoEntregaId) || `ent-legado-${texto(cliente.codigo)}`,
    nomeLocal: 'Principal', tipoLocal: 'Outro', ...separado,
    codigoIbgeMunicipio: texto(c.codigoIbgeMunicipioEntrega || (c.mesmoEnderecoFiscal ? c.codigoIbgeMunicipio : '')),
    responsavel: texto(c.responsavel), telefone: texto(c.telefone), celular: texto(c.celularWhatsapp || c.celular),
    horarioEntrega: texto(c.horarioEntrega), emailEnvio: texto(c.emailNotaFiscal), observacoes: '', ativo: true,
  }
}

export function normalizarEnderecosEntrega(cliente: Cliente): EnderecoEntregaCliente[] {
  void SYNERGIAS_EMAIL_POR_ENDERECO_V297
  const originais = Array.isArray((cliente as any).enderecosEntrega) ? (cliente as any).enderecosEntrega : []
  const objetos = originais.filter((item: unknown) => item && typeof item === 'object').map((item: any, indice: number) => {
    const enderecoSeparado = separarEnderecoComposto(item)
    return {
      ...enderecoEntregaVazio(), ...item, ...enderecoSeparado,
      id: texto(item.id) || `ent-${texto(cliente.codigo)}-${indice + 1}`,
      nomeLocal: texto(item.nomeLocal) || `Local ${indice + 1}`,
      tipoLocal: (['Residencial', 'Comercial', 'Outro'].includes(item.tipoLocal) ? item.tipoLocal : 'Outro') as TipoLocalEntrega,
      emailsCopiaEnvio: Array.isArray(item.emailsCopiaEnvio)
        ? item.emailsCopiaEnvio.map((email: unknown) => texto(email)).filter(Boolean)
        : [],
      ativo: item.ativo !== false,
    }
  })
  if (objetos.length) return objetos
  const legado = legadoParaEndereco(cliente)
  return legado ? [legado] : []
}

export function migrarClienteEnderecosEntrega(cliente: Cliente): Cliente {
  return { ...cliente, enderecosEntrega: normalizarEnderecosEntrega(cliente) }
}

export function emailDoEndereco(endereco: EnderecoEntregaCliente | undefined, cliente: Pick<Cliente, 'email'>) {
  return texto(endereco?.emailEnvio) || texto(cliente.email)
}
