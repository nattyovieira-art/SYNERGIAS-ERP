import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pedido = readFileSync(
  new URL('../src/pages/Vendas/PedidoForm.tsx', import.meta.url),
  'utf8',
)

assert.ok(
  pedido.includes('clienteEmailNotaFiscal: emailSelecionado') &&
    pedido.includes('emailsCopiaEnvio: copiasSelecionadas'),
  'troca de cliente deve substituir Para e Cc',
)
assert.ok(
  pedido.includes("local?.emailEnvio || clienteComEmailFiscal.emailNotaFiscal || clienteSelecionado.email"),
  'e-mail do endereço selecionado deve ter prioridade',
)
assert.ok(
  pedido.includes('setEmailsCopiaTexto(copiasSelecionadas.join'),
  'campo Cc visível deve ser limpo ao trocar o cliente',
)

assert.ok(
  pedido.includes('email: emailPrincipal || clienteServidor.email') &&
    pedido.includes('vendaConfirmada = await salvarVendaStorageConfirmado(vendaAtualizada)'),
  'Para e Cc devem ser confirmados no cliente e no pedido antes de concluir',
)

console.log('OK: isolamento de e-mails entre clientes protegido.')
