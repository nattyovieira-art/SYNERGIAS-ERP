import { useState } from 'react'
import { Upload, X } from 'lucide-react'
import { listarClientesStorage } from '../../services/clientesStorage'
import { listarProdutosStorage } from '../../services/produtosStorage'
import { listarVendasStorage, salvarVendaStorageConfirmado } from '../../services/vendasStorage'

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
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [dadosNf, setDadosNf] = useState<any>(null)
  const [ocupado, setOcupado] = useState(false)
  if (!aberto) return null

  async function lerArquivo(arquivo?: File) {
    if (!arquivo) return
    const documento = new DOMParser().parseFromString(await arquivo.text(), 'application/xml')
    if (documento.querySelector('parsererror')) return alert('XML inválido.')
    const chave = (documento.querySelector('infNFe')?.getAttribute('Id') || '').replace(/^NFe/, '') || txt(documento, 'chNFe')
    const cnpj = txt(documento, 'dest CNPJ') || txt(documento, 'dest CPF')
    const nome = txt(documento, 'dest xNome')
    const numeroNf = txt(documento, 'ide nNF')
    const emissao = (txt(documento, 'ide dhEmi') || txt(documento, 'ide dEmi')).slice(0, 10)
    const itens = Array.from(documento.querySelectorAll('infNFe > det')).map((det, indice) => {
      const descricao = txt(det, 'prod xProd')
      const opcoes = candidatos(descricao, produtos)
      const automatico = opcoes[0]?.pontos >= .82 && opcoes[0]?.pontos > (opcoes[1]?.pontos || 0) ? opcoes[0].produto : undefined
      return { id: `nf-${indice}-${Date.now()}`, descricao, quantidade: Number(txt(det, 'prod qCom') || 0), unitario: Number(txt(det, 'prod vUnCom') || 0), produtoCodigo: String(automatico?.codigo || '') }
    })
    setDadosNf({ chave, cnpj, nome, numeroNf, emissao })
    setLinhas(itens)
  }

  async function inserir() {
    if (!orcamento.trim() || !pedido.trim()) return alert('Informe os números do orçamento e do pedido.')
    if (!dadosNf || !linhas.length) return alert('Selecione o XML.')
    if (linhas.some((linha) => !linha.produtoCodigo)) return alert('Confirme todos os produtos.')
    const vendas: any[] = listarVendasStorage()
    if (vendas.some((v) => String(v.numeroOrcamento || '') === orcamento.trim())) return alert(`O orçamento ${orcamento} já existe.`)
    if (vendas.some((v) => String(v.numeroPedido || '') === pedido.trim())) return alert(`O pedido ${pedido} já existe.`)
    const digitos = String(dadosNf.cnpj || '').replace(/\D/g, '')
    const cliente: any = clientes.find((c) => String(c.cnpj || '').replace(/\D/g, '') === digitos)
      || clientes.find((c) => norm(c.razaoSocial || c.nomeFantasia) === norm(dadosNf.nome))
    if (!cliente) return alert(`Cliente da NF não encontrado: ${dadosNf.nome}.`)
    const itens = linhas.map((linha, indice) => {
      const produto: any = produtos.find((p) => String(p.codigo) === linha.produtoCodigo)
      return { id: `hist-${indice}-${Date.now()}`, produtoId: String(produto.id || ''), codigo: String(produto.codigo || ''), codigoProduto: String(produto.codigo || ''), codigoBarras: String(produto.codigoBarras || produto.codigo || ''), descricao: String(produto.descricao || produto.nome), unidade: String(produto.unidade || 'UN'), quantidade: linha.quantidade, valorUnitario: linha.unitario, desconto: 0, valorTotal: Number((linha.quantidade * linha.unitario).toFixed(2)), produtoVinculado: true, vinculoProdutoOrigem: 'DESCRICAO' }
    })
    const total = Number(itens.reduce((s, item) => s + item.valorTotal, 0).toFixed(2))
    const agora = new Date().toISOString()
    const clienteId = String(cliente.codigo || cliente.id || '')
    const base = { clienteId, clienteCodigo: clienteId, clienteNome: String(cliente.razaoSocial || cliente.nomeFantasia || dadosNf.nome), clienteDocumento: String(cliente.cnpj || dadosNf.cnpj), dataEmissao: dadosNf.emissao, itens, subtotal: total, totalFinal: total, valorTotal: total, frete: 0, outrosCustos: 0, descontoInformado: 0, estoqueMovimentado: true, importacaoHistorica: true, movimentarEstoque: false, criadoEm: agora, atualizadoEm: agora }
    setOcupado(true)
    try {
      const idOrcamento = `orc-historico-${orcamento}-${Date.now()}`
      await salvarVendaStorageConfirmado({ ...base, id: idOrcamento, tipo: 'Orçamento', numeroOrcamento: orcamento.trim(), status: 'GERADO', statusOrcamento: 'Gerado', pedidoGeradoId: `pedido-historico-${pedido}`, pedidoGeradoEm: agora } as any)
      await salvarVendaStorageConfirmado({ ...base, id: `pedido-historico-${pedido}`, tipo: 'Pedido', numeroPedido: pedido.trim(), status: 'CONCLUÍDO', statusPedido: 'Concluído', statusEntrega: 'Entregue', entregue: true, dataEntregaRealizada: dadosNf.emissao, orcamentoOrigemId: idOrcamento, orcamentoOrigemNumero: orcamento.trim(), numeroNFe: dadosNf.numeroNf, chaveAcessoNFe: dadosNf.chave, pagamentoConfirmado: false } as any)
      alert(`Orçamento ${orcamento} e pedido ${pedido} inseridos sem movimentar estoque.`)
      onConcluido()
      onClose()
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Falha ao inserir os registros.')
    } finally { setOcupado(false) }
  }

  return <div className="orcamento-texto-overlay"><section className="orcamento-texto-modal">
    <header><div><h2>Importar NF antiga</h2><p>Cria orçamento e pedido histórico sem movimentar estoque.</p></div><button onClick={onClose}><X /></button></header>
    <div className="nf-historica-numeros"><label>Nº orçamento<input value={orcamento} onChange={(e) => setOrcamento(e.target.value.replace(/\D/g, ''))} /></label><label>Nº pedido<input value={pedido} onChange={(e) => setPedido(e.target.value.replace(/\D/g, ''))} /></label><label className="nf-historica-arquivo"><Upload size={18}/> Selecionar XML<input type="file" accept=".xml,text/xml" onChange={(e) => void lerArquivo(e.target.files?.[0])} /></label></div>
    {dadosNf && <strong>NF {dadosNf.numeroNf} — {dadosNf.nome}</strong>}
    <div className="orcamento-texto-itens">{linhas.map((linha) => <div key={linha.id}><input value={linha.quantidade} readOnly/><span>{linha.descricao}</span><select value={linha.produtoCodigo} onChange={(e) => setLinhas((atuais) => atuais.map((item) => item.id === linha.id ? { ...item, produtoCodigo: e.target.value } : item))}><option value="">Confirmar produto...</option>{candidatos(linha.descricao, produtos).map(({ produto }) => <option key={produto.codigo} value={produto.codigo}>{produto.descricao || produto.nome}</option>)}</select></div>)}</div>
    <footer><span>{linhas.filter((x) => !x.produtoCodigo).length} pendência(s)</span><button disabled={ocupado || !linhas.length || linhas.some((x) => !x.produtoCodigo)} onClick={() => void inserir()}>Inserir orçamento e pedido</button></footer>
  </section></div>
}
