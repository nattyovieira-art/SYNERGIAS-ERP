import { useMemo, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { listarClientesStorage } from '../../services/clientesStorage'
import { listarProdutosStorage } from '../../services/produtosStorage'

type Props = {
  aberto: boolean
  onClose: () => void
  onPreparar: (rascunho: any) => void
}

const normalizar = (valor: unknown) => String(valor || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase()

const ignorar = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'para', 'unid', 'unidade', 'unidades', 'pct', 'pcte', 'fardo'])
const sinonimos: Record<string, string> = {
  clorofila: 'agua sanitaria',
  oxy: 'ox',
}

function extrair(texto: string) {
  return texto.split(/\r?\n/).map((linha) => linha
    .replace(/^\[[^\]]+\]\s*[^:]+:\s*/, '').trim())
    .filter(Boolean)
    .map((linha, indice) => {
      const achado = linha.match(/^(\d+(?:[.,]\d+)?)\s*(?:unid(?:ades?)?|undi|und|pcte?s?|pct|fardos?|cx|caixas?)?\s*(?:de\s+)?(.+)$/i)
      return {
        id: `texto-${indice}-${Date.now()}`,
        quantidade: achado ? Number(achado[1].replace(',', '.')) : 1,
        texto: (achado?.[2] || linha).trim(),
        produtoCodigo: '',
      }
    })
}

function sugestoes(texto: string, produtos: any[]) {
  const textoNormalizado = normalizar(texto)
  const textoBusca = sinonimos[textoNormalizado] || textoNormalizado
  const termos = textoBusca.split(' ').filter((termo) => termo.length > 1 && !ignorar.has(termo))
  return produtos.map((produto) => {
    const alvo = normalizar(`${produto.descricao || ''} ${produto.nome || ''} ${produto.marca || ''}`)
    const acertos = termos.filter((termo) => alvo.includes(termo)).length
    return { produto, pontos: termos.length ? acertos / termos.length : 0 }
  }).filter((item) => item.pontos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, 12)
}

export default function OrcamentoTextoModal({ aberto, onClose, onPreparar }: Props) {
  const clientes = listarClientesStorage()
  const produtos = listarProdutosStorage()
  const [clienteCodigo, setClienteCodigo] = useState('')
  const [clienteBusca, setClienteBusca] = useState('')
  const [texto, setTexto] = useState('')
  const [linhas, setLinhas] = useState<Array<{ id: string; quantidade: number; texto: string; produtoCodigo: string; produtoBusca: string }>>([])
  const [lendoImagem, setLendoImagem] = useState(false)
  const [progressoOcr, setProgressoOcr] = useState(0)
  const cliente = clientes.find((item) => String(item.codigo) === clienteCodigo)
  const analisado = linhas.length > 0
  const pendentes = linhas.filter((linha) => !linha.produtoCodigo).length

  const nomesClientes = useMemo(() => [...clientes].sort((a, b) =>
    String(a.razaoSocial || a.nomeFantasia).localeCompare(String(b.razaoSocial || b.nomeFantasia))), [clientes])

  if (!aberto) return null

  function analisar() {
    const alias = JSON.parse(localStorage.getItem('synergias_orcamento_texto_alias') || '{}')
    setLinhas(extrair(texto).map((linha) => {
      const candidatos = sugestoes(linha.texto, produtos)
      const codigoAlias = alias[normalizar(linha.texto)]
      const automatico = produtos.find((produto) => String(produto.codigo) === String(codigoAlias))
        || (candidatos[0]?.pontos >= 0.72 && candidatos[0]?.pontos > (candidatos[1]?.pontos || 0) ? candidatos[0].produto : undefined)
      return {
        ...linha,
        produtoCodigo: String(automatico?.codigo || ''),
        produtoBusca: String(automatico?.descricao || automatico?.nome || ''),
      }
    }))
  }

  async function lerImagem(arquivo?: File) {
    if (!arquivo) return
    setLendoImagem(true)
    setProgressoOcr(0)
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('por', 1, {
        logger: (evento) => {
          if (evento.status === 'recognizing text') setProgressoOcr(Math.round((evento.progress || 0) * 100))
        },
      })
      const resultado = await worker.recognize(arquivo)
      await worker.terminate()
      const extraido = String(resultado.data.text || '').trim()
      if (!extraido) return alert('Não foi possível ler texto nessa imagem.')
      setTexto((atual) => [atual.trim(), extraido].filter(Boolean).join('\n'))
      setLinhas([])
    } catch {
      alert('Não foi possível ler a imagem. Tente uma foto mais nítida.')
    } finally {
      setLendoImagem(false)
      setProgressoOcr(0)
    }
  }

  function preparar() {
    if (!cliente) return alert('Selecione o cliente.')
    if (!linhas.length) return alert('Analise o texto primeiro.')
    if (pendentes) return alert(`Ainda existem ${pendentes} item(ns) sem produto selecionado.`)
    const alias: Record<string, string> = JSON.parse(localStorage.getItem('synergias_orcamento_texto_alias') || '{}')
    const itens = linhas.map((linha, indice) => {
      const produto: any = produtos.find((item) => String(item.codigo) === linha.produtoCodigo)
      alias[normalizar(linha.texto)] = linha.produtoCodigo
      return {
        id: `texto-item-${indice}-${Date.now()}`,
        produtoId: String(produto.id || ''),
        codigo: String(produto.codigo || ''),
        codigoBarras: String(produto.codigoBarras || produto.codigo || ''),
        descricao: String(produto.descricao || produto.nome || ''),
        unidade: String(produto.unidade || 'Unidade'),
        quantidade: linha.quantidade,
        valorUnitario: Number(produto.vendaVarejo || produto.precoVenda || produto.valorVenda || 0),
        desconto: 0,
        estoqueDisponivel: Number(produto.estoqueAtual || produto.estoque || 0),
      }
    })
    localStorage.setItem('synergias_orcamento_texto_alias', JSON.stringify(alias))
    onPreparar({ clienteCodigo, itens })
  }

  return <div className="orcamento-texto-overlay">
    <section className="orcamento-texto-modal">
      <header><div><h2>Criar orçamento por texto</h2><p>Cole o pedido; confirme somente as associações necessárias.</p></div><button onClick={onClose}><X /></button></header>
      <label>Cliente
        <input
          list="orcamento-texto-clientes"
          value={clienteBusca}
          onChange={(e) => {
            const valor = e.target.value
            setClienteBusca(valor)
            const encontrado = nomesClientes.find((item) =>
              normalizar(item.razaoSocial || item.nomeFantasia) === normalizar(valor))
            setClienteCodigo(encontrado ? String(encontrado.codigo) : '')
          }}
          placeholder="Digite para pesquisar o cliente"
        />
        <datalist id="orcamento-texto-clientes">
          {nomesClientes.map((item) => <option key={item.codigo} value={item.razaoSocial || item.nomeFantasia} />)}
        </datalist>
      </label>
      <label>Pedido escrito<textarea rows={9} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole, digite ou extraia o pedido de uma imagem..." /></label>
      <div className="orcamento-texto-fontes">
        <label className="orcamento-texto-imagem"><ImagePlus size={20}/>{lendoImagem ? `Lendo imagem... ${progressoOcr}%` : 'Anexar imagem'}<input type="file" accept="image/*" disabled={lendoImagem} onChange={(e) => void lerImagem(e.target.files?.[0])}/></label>
        <button className="orcamento-texto-analisar" onClick={analisar} disabled={lendoImagem || !texto.trim()}>Analisar texto</button>
      </div>
      {analisado && <div className="orcamento-texto-itens">{linhas.map((linha) => {
        return <div key={linha.id}><input type="number" min="0.01" step="0.01" value={linha.quantidade} onChange={(e) => setLinhas((atuais) => atuais.map((item) => item.id === linha.id ? { ...item, quantidade: Number(e.target.value) } : item))} /><span>{linha.texto}</span><input
          list={`produtos-texto-${linha.id}`}
          value={linha.produtoBusca}
          placeholder="Digite para localizar o produto"
          onChange={(e) => {
            const valor = e.target.value
            const produto = produtos.find((item) =>
              normalizar(item.descricao || item.nome) === normalizar(valor))
            setLinhas((atuais) => atuais.map((item) => item.id === linha.id
              ? { ...item, produtoBusca: valor, produtoCodigo: String(produto?.codigo || '') }
              : item))
          }}
        /><datalist id={`produtos-texto-${linha.id}`}>
          {produtos.map((produto) =>
            <option key={produto.codigo} value={produto.descricao || produto.nome} />)}
        </datalist></div>
      })}</div>}
      <footer><span>{pendentes ? `${pendentes} item(ns) precisam de confirmação` : analisado ? 'Todos os itens associados' : ''}</span><button onClick={preparar} disabled={!analisado || pendentes > 0}>Preparar orçamento aberto</button></footer>
    </section>
  </div>
}
