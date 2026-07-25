import { useState } from 'react'
import { Upload, X } from 'lucide-react'
import { listarClientesStorage } from '../../services/clientesStorage'
import { listarProdutosStorage } from '../../services/produtosStorage'
import { listarVendasStorage, salvarVendaStorageConfirmado } from '../../services/vendasStorage'
import { listarComprasStorage } from '../../services/comprasStorage'
import { sincronizarFinanceiroComOperacoes } from '../../services/sincronizarFinanceiro'

type Props = { aberto: boolean; onClose: () => void; onConcluido: () => void }
type Linha = { id: string; descricao: string; quantidade: number; unitario: number; produtoCodigo: string }
const norm = (v: unknown) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase()
const txt = (raiz: ParentNode, nome: string) => raiz.querySelector(nome)?.textContent?.trim() || ''

function candidatos(descricao: string, produtos: any[]) {
  const termos = norm(descricao).split(' ').filter((t) => t.length > 1)
  return produtos.map((produto) => {
    const alvo = norm(`${produto.descricao || ''} ${produto.nome || ''}`)
    const acertos = termos.filter((termo) => alvo.includes(termo)).length
    return { produto, pontos: termos.length ? acertos / termos.length : 0 }
  }).filter((x) => x.pontos > .25).sort((a, b) => b.pontos - a.pontos).slice(0, 12)
}

export default function ImportarNfHistoricaModal({ aberto, onClose, onConcluido }: Props) {
  const produtos = listarProdutosStorage()
  const clientes = listarClientesStorage()
  const [orcamento, setOrcamento] = useState('')
  const [pedido, setPedido] = useState('')
  const [dataOrcamento, setDataOrcamento] = useState('')
  const [dataPedido, setDataPedido] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('Depósito')
  const [dataVencimento, setDataVencimento] = useState('')
  const [valorPagamento, setValorPagamento] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [dadosNf, setDadosNf] = useState<any>(null)
  const [jaEntregue, setJaEntregue] = useState(true)
  const naoMovimentarEstoque = true
  const [ocupado, setOcupado] = useState(false)
  if (!aberto) return null

  async function lerArquivo(arquivo?: File) {
    if (!arquivo) return
    const xmlOriginal = await arquivo.text()
    const documento = new DOMParser().parseFromString(xmlOriginal, 'application/xml')
    if (documento.querySelector('parsererror')) return alert('XML inválido.')
    const chave = (documento.querySelector('infNFe')?.getAttribute('Id') || '').replace(/^NFe/, '') || txt(documento, 'chNFe')
    const cnpj = txt(documento, 'dest CNPJ') || txt(documento, 'dest CPF')
    const nome = txt(documento, 'dest xNome')
    const numeroNf = txt(documento, 'ide nNF')
    const emissao = (txt(documento, 'ide dhEmi') || txt(documento, 'ide dEmi')).slice(0, 10)
    const valorNf = Number(txt(documento, 'ICMSTot vNF') || 0)
    const itens = Array.from(documento.querySelectorAll('infNFe > det')).map((det, indice) => {
      const descricao = txt(det, 'prod xProd')
      const opcoes = candidatos(descricao, produtos)
      const automatico = opcoes[0]?.pontos >= .82 && opcoes[0]?.pontos > (opcoes[1]?.pontos || 0) ? opcoes[0].produto : undefined
      return { id: `nf-${indice}-${Date.now()}`, descricao, quantidade: Number(txt(det, 'prod qCom') || 0), unitario: Number(txt(det, 'prod vUnCom') || 0), produtoCodigo: String(automatico?.codigo || '') }
    })
    setDadosNf({ chave, cnpj, nome, numeroNf, emissao, valorNf, xmlOriginal })
    setDataOrcamento((atual) => atual || emissao)
    setDataPedido((atual) => atual || emissao)
    setDataVencimento((atual) => atual || emissao)
    setValorPagamento((atual) => atual || valorNf.toFixed(2))
    setLinhas(itens)
  }

  async function inserir() {
    if (!orcamento.trim() || !pedido.trim()) return alert('Informe os números do orçamento e do pedido.')
    if (!dadosNf || !linhas.length) return alert('Selecione o XML.')
    if (linhas.some((linha) => !linha.produtoCodigo)) return alert('Confirme todos os produtos.')
    if (!dataVencimento || Number(valorPagamento) <= 0) return alert('Informe o vencimento e o valor do pagamento.')
    const vendas: any[] = listarVendasStorage()
    const orcamentoExistente = vendas.find((v) => String(v.numeroOrcamento || '') === orcamento.trim())
    const pedidoExistente = vendas.find((v) => String(v.numeroPedido || '') === pedido.trim())
    const digitos = String(dadosNf.cnpj || '').replace(/\D/g, '')
    const cliente: any = clientes.find((c) => String(c.cnpj || '').replace(/\D/g, '') === digitos)
      || clientes.find((c) => norm(c.razaoSocial || c.nomeFantasia) === norm(dadosNf.nome))
    if (!cliente) return alert(`Cliente da NF não encontrado: ${dadosNf.nome}.`)
    const itens = linhas.map((linha, indice) => {
      const produto: any = produtos.find((p) => String(p.codigo) === linha.produtoCodigo)
      return { id: `hist-${indice}-${Date.now()}`, produtoId: String(produto.id || ''), codigo: String(produto.codigo || ''), codigoProduto: String(produto.codigo || ''), codigoBarras: String(produto.codigoBarras || produto.codigo || ''), descricao: String(produto.descricao || produto.nome), unidade: String(produto.unidade || 'UN'), quantidade: linha.quantidade, valorUnitario: linha.unitario, desconto: 0, valorTotal: Number((linha.quantidade * linha.unitario).toFixed(2)), produtoVinculado: true, vinculoProdutoOrigem: 'DESCRICAO' }
    })
    const total = Number(dadosNf.valorNf || itens.reduce((s, item) => s + item.valorTotal, 0))
    const agora = new Date().toISOString()
    const clienteId = String(cliente.codigo || cliente.id || '')
    const base = { clienteId, clienteCodigo: clienteId, clienteNome: String(cliente.razaoSocial || cliente.nomeFantasia || dadosNf.nome), clienteDocumento: String(cliente.cnpj || dadosNf.cnpj), dataEmissao: dadosNf.emissao, itens, subtotal: total, totalFinal: total, valorTotal: total, frete: 0, outrosCustos: 0, descontoInformado: 0, estoqueMovimentado: true, importacaoHistorica: true, movimentarEstoque: false, criadoEm: agora, atualizadoEm: agora }
    setOcupado(true)
    try {
      const idOrcamento = String(orcamentoExistente?.id || `orc-historico-${orcamento}-${Date.now()}`)
      const idPedido = String(pedidoExistente?.id || `pedido-historico-${pedido}`)
      await salvarVendaStorageConfirmado({ ...base, ...orcamentoExistente, id: idOrcamento, tipo: 'Orçamento', numeroOrcamento: orcamento.trim(), dataEmissao: dataOrcamento || dadosNf.emissao, status: 'GERADO', statusOrcamento: 'Gerado', pedidoGeradoId: idPedido, pedidoGeradoEm: orcamentoExistente?.pedidoGeradoEm || agora, atualizadoEm: agora } as any)
      await salvarVendaStorageConfirmado({
        ...base,
        ...pedidoExistente,
        id: idPedido,
        tipo: 'Pedido',
        numeroPedido: pedido.trim(),
        dataEmissao: dataPedido || dadosNf.emissao,
        status: jaEntregue ? 'CONCLUÍDO' : (pedidoExistente?.status || 'ABERTO'),
        statusPedido: jaEntregue ? 'Entregue' : (pedidoExistente?.statusPedido || 'Aberto'),
        logisticaStatus: jaEntregue ? 'Entregue' : pedidoExistente?.logisticaStatus,
        entregue: jaEntregue,
        dataEntregaRealizada: jaEntregue ? dadosNf.emissao : pedidoExistente?.dataEntregaRealizada,
        entregaConfirmadaSemNovaBaixa: jaEntregue && naoMovimentarEstoque,
        estoqueBaixado: naoMovimentarEstoque,
        movimentarEstoque: false,
        movimentarEstoqueHistorico: false,
        movimentacaoEstoqueHistoricaAutorizada: false,
        formaPagamento,
        tipoCobranca: formaPagamento,
        valorPagamento: Number(valorPagamento),
        parcelas: [{
          numero: 1,
          vencimento: dataVencimento,
          valor: Number(valorPagamento),
          tipoCobranca: formaPagamento,
        }],
        boletoDispensado: true,
        envioDocumentosDispensado: true,
        importacaoHistoricaSemEnvio: true,
        orcamentoOrigemId: idOrcamento,
        orcamentoOrigemNumero: orcamento.trim(),
        numeroNFe: dadosNf.numeroNf,
        numeroNotaFiscal: dadosNf.numeroNf,
        chaveAcessoNFe: dadosNf.chave,
        chaveAcessoNotaFiscal: dadosNf.chave,
        dataEmissaoNotaFiscal: dadosNf.emissao,
        statusNotaFiscal: 'Autorizada',
        xmlNotaFiscal: dadosNf.xmlOriginal,
        importacaoHistorica: true,
        atualizadoEm: agora,
      } as any)
      sincronizarFinanceiroComOperacoes(listarVendasStorage(), listarComprasStorage())
      alert(`NF ${dadosNf.numeroNf} vinculada ao pedido ${pedido} e ao orçamento ${orcamento}, sem movimentar estoque.`)
      onConcluido()
      onClose()
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Falha ao inserir os registros.')
    } finally { setOcupado(false) }
  }

  return <div className="orcamento-texto-overlay"><section className="orcamento-texto-modal">
    <header><div><h2>Importar NF antiga</h2><p>Cria orçamento e pedido histórico sem movimentar estoque.</p></div><button onClick={onClose}><X /></button></header>
    <div className="nf-historica-numeros"><label>Nº orçamento<input value={orcamento} onChange={(e) => setOrcamento(e.target.value.replace(/\D/g, ''))} /></label><label>Nº pedido<input value={pedido} onChange={(e) => setPedido(e.target.value.replace(/\D/g, ''))} /></label><label className="nf-historica-arquivo"><Upload size={18}/> Selecionar XML<input type="file" accept=".xml,text/xml" onChange={(e) => void lerArquivo(e.target.files?.[0])} /></label></div>
    <div className="nf-historica-numeros"><label>Emissão do orçamento<input type="date" value={dataOrcamento} onChange={(e) => setDataOrcamento(e.target.value)} /></label><label>Emissão do pedido<input type="date" value={dataPedido} onChange={(e) => setDataPedido(e.target.value)} /></label><label>Emissão da NF<input type="date" value={dadosNf?.emissao || ''} readOnly /></label></div>
    <div className="nf-historica-numeros"><label>Forma de pagamento<select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}><option>Depósito</option><option>Pix</option><option>Transferência</option><option>Dinheiro</option><option>Cartão</option><option>Boleto opcional</option></select></label><label>Vencimento<input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} /></label><label>Valor a conciliar<input type="number" min="0" step="0.01" value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} /></label></div>
    <div className="nf-historica-opcoes"><label><input type="checkbox" checked={jaEntregue} onChange={(e) => setJaEntregue(e.target.checked)} /> Já foi entregue</label><label><input type="checkbox" checked disabled /> Não movimentar estoque novamente</label></div>
    {dadosNf && <strong>NF {dadosNf.numeroNf} — {dadosNf.nome}</strong>}
    <div className="orcamento-texto-itens">{linhas.map((linha) => <div key={linha.id}><input value={linha.quantidade} readOnly/><span>{linha.descricao}</span><select value={linha.produtoCodigo} onChange={(e) => setLinhas((atuais) => atuais.map((item) => item.id === linha.id ? { ...item, produtoCodigo: e.target.value } : item))}><option value="">Confirmar produto...</option>{candidatos(linha.descricao, produtos).map(({ produto }) => <option key={produto.codigo} value={produto.codigo}>{produto.descricao || produto.nome}</option>)}</select></div>)}</div>
    <footer><span>{linhas.filter((x) => !x.produtoCodigo).length} pendência(s)</span><button disabled={ocupado || !linhas.length || linhas.some((x) => !x.produtoCodigo)} onClick={() => void inserir()}>Inserir orçamento e pedido</button></footer>
  </section></div>
}
