import fs from 'node:fs'

const arquivo = new URL('../src/pages/Vendas/PedidoForm.tsx', import.meta.url)
const codigo = fs.readFileSync(arquivo, 'utf8')
const regras = [
  'orcamentoOrigem.entregaCep || enderecoEntregaBase.cep',
  'orcamentoOrigem.entregaEndereco || enderecoEntregaBase.endereco',
  'orcamentoOrigem.entregaNumero || enderecoEntregaBase.numero',
  'orcamentoOrigem.entregaBairro || enderecoEntregaBase.bairro',
  'orcamentoOrigem.entregaCidade || enderecoEntregaBase.cidade',
  'orcamentoOrigem.entregaEstado || enderecoEntregaBase.estado',
  'orcamentoOrigem.clienteTelefone || clienteBase?.telefone',
  '(?:\\\\D|$)',
]

for (const regra of regras) {
  if (!codigo.includes(regra)) {
    throw new Error(`Regra de conversão orçamento/pedido ausente: ${regra}`)
  }
}

console.log('Conversão orçamento/pedido preserva cliente e endereço estruturado.')
