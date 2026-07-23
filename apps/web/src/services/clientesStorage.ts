import type { Cliente } from '../types/Cliente'
import { migrarClienteEnderecosEntrega } from './enderecosEntrega'
import { carregarColecaoCentral, definirColecaoMemoria, obterColecaoMemoria, sincronizarColecaoCentral, sincronizarColecaoCentralAgora } from './erpApi'

export function listarClientesStorage(): Cliente[] {
  return obterColecaoMemoria<Cliente>('clientes').map(migrarClienteEnderecosEntrega)
}

export function salvarClientesStorage(clientes: Cliente[]) {
  clientes = clientes.map(migrarClienteEnderecosEntrega)
  definirColecaoMemoria('clientes', clientes)
  sincronizarColecaoCentral('clientes', clientes)
}

export async function salvarClientesStorageConfirmado(clientes: Cliente[]) {
  clientes = clientes.map(migrarClienteEnderecosEntrega)
  definirColecaoMemoria('clientes', clientes)
  await sincronizarColecaoCentralAgora('clientes', clientes)
}

export function buscarClienteStorage(codigo: string) {
  return listarClientesStorage().find((cliente) => String(cliente.codigo) === String(codigo))
}

export function salvarClienteStorage(cliente: Cliente) {
  const clientes = listarClientesStorage()
  const existe = clientes.some((item) => String(item.codigo) === String(cliente.codigo))
  const clientePersistente = { ...cliente, atualizadoEm: new Date().toISOString() } as Cliente
  const atualizados = existe
    ? clientes.map((item) => String(item.codigo) === String(cliente.codigo) ? clientePersistente : item)
    : [...clientes, clientePersistente]
  definirColecaoMemoria('clientes', atualizados)
  void sincronizarColecaoCentralAgora('clientes', atualizados).catch(() => {
    sincronizarColecaoCentral('clientes', atualizados)
  })
  return atualizados
}

export async function salvarClienteStorageConfirmado(cliente: Cliente) {
  const clientePersistente = { ...cliente, atualizadoEm: new Date().toISOString() } as Cliente

  const mesclar = (clientes: Cliente[]) => {
    const existe = clientes.some((item) => String(item.codigo) === String(cliente.codigo))
    return existe
      ? clientes.map((item) => String(item.codigo) === String(cliente.codigo) ? clientePersistente : item)
      : [...clientes, clientePersistente]
  }

  let atualizados = mesclar(listarClientesStorage())
  definirColecaoMemoria('clientes', atualizados)

  try {
    await sincronizarColecaoCentralAgora('clientes', atualizados)
  } catch (erro) {
    const central = await carregarColecaoCentral<Cliente>('clientes')
    atualizados = mesclar(central.data)
    definirColecaoMemoria('clientes', atualizados)
    try {
      await sincronizarColecaoCentralAgora('clientes', atualizados)
    } catch {
      definirColecaoMemoria('clientes', central.data)
      throw erro
    }
  }

  return atualizados
}

export function excluirClienteStorage(codigo: string) {
  const atualizados = listarClientesStorage().filter((cliente) => String(cliente.codigo) !== String(codigo))
  salvarClientesStorage(atualizados)
  return atualizados
}
