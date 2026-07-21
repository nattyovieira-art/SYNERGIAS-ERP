import type { Cliente, EnderecoEntregaCliente, TipoLocalEntrega } from '../types/Cliente'

const texto = (valor: unknown) => String(valor ?? '').trim()

export function gerarEnderecoEntregaId() {
  return `ent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function enderecoEntregaVazio(): EnderecoEntregaCliente {
  return { id: gerarEnderecoEntregaId(), nomeLocal: '', tipoLocal: 'Outro', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', codigoIbgeMunicipio: '', responsavel: '', telefone: '', celular: '', horarioEntrega: '', emailEnvio: '', observacoes: '', ativo: true }
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
  return {
    ...enderecoEntregaVazio(), id: texto(c.enderecoEntregaId) || `ent-legado-${texto(cliente.codigo)}`,
    nomeLocal: 'Principal', tipoLocal: 'Outro', cep, logradouro,
    numero: texto(c.numeroEntrega || (c.mesmoEnderecoFiscal ? c.numero : '')),
    complemento: texto(c.complementoEntrega || (c.mesmoEnderecoFiscal ? c.complemento : '')),
    bairro: texto(c.bairroEntrega || (c.mesmoEnderecoFiscal ? c.bairro : '')),
    cidade: texto(c.cidadeEntrega || (c.mesmoEnderecoFiscal ? c.cidade : '')),
    uf: texto(c.estadoEntrega || (c.mesmoEnderecoFiscal ? c.estado : '')),
    codigoIbgeMunicipio: texto(c.codigoIbgeMunicipioEntrega || (c.mesmoEnderecoFiscal ? c.codigoIbgeMunicipio : '')),
    responsavel: texto(c.responsavel), telefone: texto(c.telefone), celular: texto(c.celularWhatsapp || c.celular),
    horarioEntrega: texto(c.horarioEntrega), emailEnvio: texto(c.emailNotaFiscal), observacoes: '', ativo: true,
  }
}

export function normalizarEnderecosEntrega(cliente: Cliente): EnderecoEntregaCliente[] {
  const originais = Array.isArray((cliente as any).enderecosEntrega) ? (cliente as any).enderecosEntrega : []
  const objetos = originais.filter((item: unknown) => item && typeof item === 'object').map((item: any, indice: number) => ({
    ...enderecoEntregaVazio(), ...item, id: texto(item.id) || `ent-${texto(cliente.codigo)}-${indice + 1}`,
    nomeLocal: texto(item.nomeLocal) || `Local ${indice + 1}`,
    tipoLocal: (['Residencial', 'Comercial', 'Outro'].includes(item.tipoLocal) ? item.tipoLocal : 'Outro') as TipoLocalEntrega,
    logradouro: texto(item.logradouro || item.endereco), uf: texto(item.uf || item.estado), ativo: item.ativo !== false,
  }))
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
