import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const memoria = new Map()
const eventos = []
globalThis.localStorage = {
  getItem: (chave) => memoria.get(chave) ?? null,
  setItem: (chave, valor) => memoria.set(chave, String(valor)),
}
globalThis.window = {
  dispatchEvent: (evento) => eventos.push(evento),
}

const fonte = readFileSync(new URL('../src/services/diariasFinanceiro.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const api = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

const diaria = { id: 'agenda-1', data: '2026-07-23', funcionario: 'João', valorDiaria: 150, descricao: 'Turno manhã' }
api.sincronizarDespesaDiaria(diaria)
let contas = JSON.parse(localStorage.getItem('synergias_contas_pagar'))
assert.equal(contas.length, 1, 'cria uma despesa')
assert.equal(contas[0].categoria, 'Pessoal')
assert.equal(contas[0].valor, 50, 'cada turno tem valor fixo de R$ 50,00')
assert.equal(eventos.filter((evento) => evento.type === 'synergias:contas-pagar-atualizadas').length, 1, 'avisa a tela financeira após criar diária')

api.sincronizarDespesaDiaria({ ...diaria, valorDiaria: 180 })
contas = JSON.parse(localStorage.getItem('synergias_contas_pagar'))
assert.equal(contas.length, 1, 'não duplica ao editar')
assert.equal(contas[0].valor, 50, 'não permite alterar o valor fixo do turno')

contas[0].status = 'Paga'
localStorage.setItem('synergias_contas_pagar', JSON.stringify(contas))
assert.throws(() => api.excluirDespesaDiaria(diaria.id), /já foi paga/, 'protege diária paga')

console.log('OK: diária cria, atualiza e protege a despesa vinculada.')
