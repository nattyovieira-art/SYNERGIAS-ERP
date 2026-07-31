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
  ['entrada de compra idempotente por produto', arquivos.estoque.includes('quantidadeJaMovimentada') && arquivos.estoque.includes('quantidadeEsperada - quantidadeJaMovimentada')],
  ['entrada parcial movimenta somente a diferença', arquivos.estoque.includes('proporcaoPendente') && arquivos.estoque.includes('entrada.valorEntrada * proporcaoPendente')],
  ['entrada completa não duplica estoque', arquivos.estoque.includes('Todos os produtos desta NF-e já possuem a quantidade esperada no estoque') && arquivos.estoque.includes('ok: false')],
  ['compra recebida permite conferir diferenças', arquivos.formulario.includes('Conferir e Completar Estoque')],
  ['zero produtos não conclui recebimento', arquivos.formulario.includes('resultadoEntrada.resultados.length === 0')],
  ['quantidade convertida respeita sempre o fator', arquivos.formulario.includes('const quantidadeConvertida = quantidadeFiscal * fatorConversao')],
  ['custo da embalagem é dividido pela quantidade convertida', arquivos.formulario.includes('numero(item.custoFinalItem) / quantidadeConvertida')],
  ['correção de conversão atualiza custo sem nova entrada', arquivos.formulario.includes('atualizarCustosProdutosAposCorrecao(compraAnterior, compraAtualizada)')],
  ['confirmação bloqueia clique repetido', arquivos.formulario.includes('processandoRecebimento')],
  ['duplicidade validada antes do estoque', arquivos.formulario.indexOf('const duplicada = encontrarCompraComNotaDuplicada(compraParaConfirmar)') < arquivos.formulario.indexOf('const resultadoEntrada = confirmarEntradaCompraComCustoMedioStorage')],
  ['exclusão de compra movimentada bloqueada', arquivos.lista.includes('if (compra.movimentouEstoque && !compra.estoqueEstornado)')],
  ['exclusão individual de compra confirmada no servidor', arquivos.api.includes("['vendas', 'compras']") && arquivos.api.includes("Compra com estoque movimentado não pode ser excluída antes do estorno.")],
  ['exclusão aguarda fila e confirma releitura do MySQL', arquivos.compras.includes("await aguardarSincronizacaoCentral('compras')") && arquivos.compras.includes("await carregarColecaoCentral<Compra>('compras')")],
  ['servidor valida compras', arquivos.api.includes("if ($collection === 'compras') validarIntegridadeCompras")],
  ['servidor valida movimentos', arquivos.api.includes("if ($collection === 'movimentacoesEstoque') validarIntegridadeMovimentacoes")],
]

const falhas = verificacoes.filter(([, ok]) => !ok)
for (const [nome, ok] of verificacoes) console.log(`${ok ? 'OK' : 'FALHA'} - ${nome}`)
if (falhas.length) process.exit(1)
