import type { Cliente } from '../types/Cliente'

const clientes: Cliente[] = [
  {
    codigo: '0001',
    razaoSocial: 'Condomínio Alfa',
    nomeFantasia: 'Condomínio Alfa',
    tipo: 'Condomínio',
    cidade: 'Porto Alegre',
    estado: 'RS',
    telefone: '(51) 99999-0001',
    situacao: 'Ativo',
    valorAno: 18450,
  },
  {
    codigo: '0002',
    razaoSocial: 'Empresa Beta Limpeza',
    nomeFantasia: 'Empresa Beta',
    tipo: 'Empresa',
    cidade: 'Canoas',
    estado: 'RS',
    telefone: '(51) 99999-0002',
    situacao: 'Ativo',
    valorAno: 32700,
  },
]

export function listarClientes() {
  return clientes
}