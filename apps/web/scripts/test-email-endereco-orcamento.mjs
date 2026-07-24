import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const formulario = readFileSync(
  new URL('../src/pages/Vendas/OrcamentoForm.tsx', import.meta.url),
  'utf8',
)

assert.ok(
  formulario.includes("atualizarEnderecoEntregaEstruturado(indice, 'emailEnvio'"),
  'o editor do endereço deve permitir informar seu próprio e-mail',
)
assert.ok(
  formulario.includes("local.emailEnvio || cliente?.emailPrincipal"),
  'o endereço selecionado deve ter prioridade sobre o e-mail principal',
)
assert.ok(
  formulario.includes('enderecoEntregaSnapshot: localSelecionado ? { ...localSelecionado, emailEnvio }'),
  'o orçamento deve preservar o e-mail no snapshot do endereço',
)

console.log('OK: e-mail individual por endereço protegido.')
