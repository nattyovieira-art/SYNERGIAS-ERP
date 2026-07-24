import { readFileSync } from 'node:fs'

const vendas = readFileSync(
  new URL('../src/pages/Vendas/Vendas.tsx', import.meta.url),
  'utf8',
)
const storage = readFileSync(
  new URL('../src/services/vendasStorage.ts', import.meta.url),
  'utf8',
)

const verificacoes = [
  [
    'PIX e transferencia dispensam boleto',
    vendas.includes("forma.includes('pix')") &&
      vendas.includes("forma.includes('transfer')") &&
      vendas.includes('pagamentoDispensaBoleto(venda) || pedidoTemBoletoEmitido(venda)'),
  ],
  [
    'pedido concluido tambem e reconhecido como entregue',
    vendas.includes("['entregue', 'concluido'].includes(status)"),
  ],
  [
    'NF, boleto dispensado ou emitido e entrega definem conclusao',
    vendas.includes('const etapasConcluidas = [nfeEmitida, boletoEmitido, entregue]') &&
      vendas.includes('if (etapasConcluidas === 3)'),
  ],
  [
    'todos os identificadores conhecidos preservam o vinculo do boleto',
    [
      'idCobrancaBanco',
      'idCobrancaApi',
      'numeroBoleto',
      'nossoNumero',
      'seuNumero',
      'linhaDigitavel',
      'codigoBarras',
      'linkBoleto',
      'boletoPdfUrl',
      'boletoPdfBase64',
      'dataGeracaoBoleto',
    ].every((campo) => vendas.includes(`parcela?.${campo}`) && storage.includes(`parcela.${campo}`)),
  ],
  [
    'parcela com identificador de boleto nao volta para pendente',
    storage.includes("parcela.statusBoleto || (possuiBoletoGerado ? 'Gerado' : 'Pendente')"),
  ],
]

const falhas = verificacoes.filter(([, passou]) => !passou)
for (const [regra, passou] of verificacoes) {
  console.log(`${passou ? 'OK' : 'FALHA'} - ${regra}`)
}

if (falhas.length > 0) {
  console.error('\nRegras permanentes de pedidos foram alteradas. Publicacao bloqueada.')
  process.exit(1)
}

