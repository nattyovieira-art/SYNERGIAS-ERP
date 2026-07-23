import { readFileSync } from 'node:fs'

const arquivos = {
  compras: readFileSync(new URL('../src/services/comprasStorage.ts', import.meta.url), 'utf8'),
  estoque: readFileSync(new URL('../src/services/estoqueStorage.ts', import.meta.url), 'utf8'),
  formulario: readFileSync(new URL('../src/pages/Compras/CompraForm.tsx', import.meta.url), 'utf8'),
  lista: readFileSync(new URL('../src/pages/Compras/Compras.tsx', import.meta.url), 'utf8'),
  api: readFileSync(new URL('../public/api/storage.php', import.meta.url), 'utf8'),
}

const verificacoes = [
  ['compras centralizadas', arquivos.compras.includes("sincronizarColecaoCentral('compras'")],
  ['movimentos centralizados', arquivos.estoque.includes("sincronizarColecaoCentral('movimentacoesEstoque'")],
  ['chave NF-e exige 44 dígitos', arquivos.compras.includes('chave.length === 44')],
  ['entrada de compra idempotente', arquivos.estoque.includes('movimentosExistentes.length > 0')],
  ['confirmação bloqueia clique repetido', arquivos.formulario.includes('processandoRecebimento')],
  ['duplicidade validada antes do estoque', arquivos.formulario.indexOf('const duplicada = encontrarCompraComNotaDuplicada(compraParaConfirmar)') < arquivos.formulario.indexOf('const resultadoEntrada = confirmarEntradaCompraComCustoMedioStorage')],
  ['exclusão de compra movimentada bloqueada', arquivos.lista.includes('if (compra.movimentouEstoque)')],
  ['servidor valida compras', arquivos.api.includes("if ($collection === 'compras') validarIntegridadeCompras")],
  ['servidor valida movimentos', arquivos.api.includes("if ($collection === 'movimentacoesEstoque') validarIntegridadeMovimentacoes")],
]

const falhas = verificacoes.filter(([, ok]) => !ok)
for (const [nome, ok] of verificacoes) console.log(`${ok ? 'OK' : 'FALHA'} - ${nome}`)
if (falhas.length) process.exit(1)

