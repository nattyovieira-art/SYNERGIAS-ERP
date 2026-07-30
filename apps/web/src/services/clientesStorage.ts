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

  const atualizados = mesclar(listarClientesStorage())
  definirColecaoMemoria('clientes', atualizados)

  const resposta = await fetch('/api/storage.php?collection=clientes', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ record: clientePersistente }),
  })
  const confirmacao = await resposta.json().catch(() => null) as { ok?: boolean; error?: string } | null
  if (!resposta.ok || !confirmacao?.ok) {
    const central = await carregarColecaoCentral<Cliente>('clientes')
    definirColecaoMemoria('clientes', central.data)
    throw new Error(confirmacao?.error || 'Não foi possível cadastrar o cliente no MySQL.')
  }

  return atualizados
}

export function excluirClienteStorage(codigo: string) {
  const atualizados = listarClientesStorage().filter((cliente) => String(cliente.codigo) !== String(codigo))
  salvarClientesStorage(atualizados)
  return atualizados
}
