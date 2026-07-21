import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const fonte = fs.readFileSync(new URL('../src/services/enderecosEntrega.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const api = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

const clienteLegado = { codigo: '1', razaoSocial: 'A', tipo: 'Padrão', situacao: 'Ativo', cidade: 'SP', valorAno: 0, enderecoEntrega: 'Rua A', numeroEntrega: '10', email: 'principal@teste.com' }
const migrado = api.normalizarEnderecosEntrega(clienteLegado)
assert.equal(migrado.length, 1, 'migra cliente com um endereço')
assert.equal(migrado[0].nomeLocal, 'Principal')

const matriz = { ...api.enderecoEntregaVazio(), id: 'matriz', nomeLocal: 'Matriz', logradouro: 'Rua A', numero: '10', emailEnvio: 'matriz@teste.com' }
const filial = { ...api.enderecoEntregaVazio(), id: 'filial', nomeLocal: 'Filial', logradouro: 'Rua B', numero: '20', emailEnvio: 'filial@teste.com' }
assert.equal(api.normalizarEnderecosEntrega({ ...clienteLegado, enderecosEntrega: [matriz, filial] }).length, 2, 'preserva dois locais')

const residencial = { ...matriz, id: 'res', nomeLocal: 'Residencial', tipoLocal: 'Residencial', emailEnvio: 'res@teste.com' }
const comercial = { ...matriz, id: 'com', nomeLocal: 'Comercial', tipoLocal: 'Comercial', emailEnvio: 'com@teste.com' }
const repetidos = api.normalizarEnderecosEntrega({ ...clienteLegado, enderecosEntrega: [residencial, comercial] })
assert.equal(repetidos.length, 2, 'aceita o mesmo endereço físico em operações diferentes')
assert.notEqual(repetidos[0].id, repetidos[1].id)

const novo = api.enderecoEntregaVazio()
assert.ok(novo.id && novo.ativo, 'novo endereço recebe ID e nasce ativo')
assert.equal(api.emailDoEndereco(filial, clienteLegado), 'filial@teste.com', 'usa e-mail do local selecionado')
assert.equal(api.emailDoEndereco({ ...filial, emailEnvio: '' }, clienteLegado), 'principal@teste.com', 'faz fallback somente para o e-mail principal')
assert.equal(api.emailDoEndereco(matriz, clienteLegado), 'matriz@teste.com', 'não usa e-mail de outro endereço')

console.log('OK: 6 cenários de endereços de entrega validados.')
