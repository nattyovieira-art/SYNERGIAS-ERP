import { useMemo, useState } from 'react'
import { FileText, ImagePlus, X } from 'lucide-react'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
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
    .replace(/^\[[^\]]+\]\s*[^:]+:\s*/, '')
    /* Remove numeração de lista antes de interpretar a quantidade. */
    .replace(/^\s*\d+(?:\.\d+)+\s*[*•-]\s*/, '')
    .replace(/^\s*\d+\s*[.)-]\s*[*•-]\s*/, '')
    .replace(/^\s*\d+\s*[.)-]\s*(?=\d+(?:[.,]\d+)?\s)/, '')
    .replace(/^\s*[*•-]\s*/, '')
    .trim())
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

function extrairSomenteItensDoPdf(texto: string) {
  const linear = texto.replace(/\s+/g, ' ').trim()
  const itens: string[] = []
  const padrao = /\b\d{8,14}\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+R\$\s*[\d.,]+\s+R\$\s*[\d.,]+/gi
  let resultado: RegExpExecArray | null

  while ((resultado = padrao.exec(linear)) !== null) {
    const descricaoCompleta = resultado[1].replace(/\s+/g, ' ').trim()
    const quantidade = resultado[2]
    itens.push(`${quantidade} ${descricaoCompleta}`)
  }

  if (itens.length) return itens.join('\n')

  const inicio = texto.search(/\b(?:c[oó]digo|refer[eê]ncia)\s+descri[cç][aã]o\b/i)
  if (inicio < 0) return texto
  const tabela = texto.slice(inicio)
  const fim = tabela.search(/\b(?:quantidade\s+de\s+itens|valor\s+total\s+dos\s+itens|total\s+dos\s+itens)\b/i)
  return (fim >= 0 ? tabela.slice(0, fim) : tabela).trim()
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

  async function lerPdf(arquivo?: File) {
    if (!arquivo) return
    setLendoImagem(true)
    setProgressoOcr(0)
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      const pdf = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise
      const paginas: string[] = []

      for (let numeroPagina = 1; numeroPagina <= pdf.numPages; numeroPagina += 1) {
        const pagina = await pdf.getPage(numeroPagina)
        const conteudo = await pagina.getTextContent()
        let paginaTexto = ''
        for (const item of conteudo.items as Array<{ str?: string; hasEOL?: boolean }>) {
          const trecho = String(item.str || '').trim()
          if (trecho) paginaTexto += `${paginaTexto && !paginaTexto.endsWith('\n') ? ' ' : ''}${trecho}`
          if (item.hasEOL) paginaTexto += '\n'
        }
        paginas.push(paginaTexto.trim())
        setProgressoOcr(Math.round((numeroPagina / pdf.numPages) * 100))
      }

      let extraido = paginas.filter(Boolean).join('\n')
      if (extraido.replace(/\s/g, '').length < 20) {
        const { createWorker } = await import('tesseract.js')
        const worker = await createWorker('por')
        const paginasOcr: string[] = []
        const limite = Math.min(pdf.numPages, 10)
        for (let numeroPagina = 1; numeroPagina <= limite; numeroPagina += 1) {
          const pagina = await pdf.getPage(numeroPagina)
          const viewport = pagina.getViewport({ scale: 1.8 })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          const contexto = canvas.getContext('2d')
          if (!contexto) continue
          await pagina.render({ canvas, canvasContext: contexto, viewport }).promise
          const resultado = await worker.recognize(canvas)
          paginasOcr.push(String(resultado.data.text || '').trim())
          setProgressoOcr(Math.round((numeroPagina / limite) * 100))
        }
        await worker.terminate()
        extraido = paginasOcr.filter(Boolean).join('\n')
      }

      if (!extraido.trim()) return alert('Não foi possível extrair texto desse PDF.')
      const itensExtraidos = extrairSomenteItensDoPdf(extraido)
      setTexto((atual) => [atual.trim(), itensExtraidos].filter(Boolean).join('\n'))
      setLinhas([])
    } catch (erro) {
      console.error('[Synergias ERP] Falha ao ler PDF do orçamento.', erro)
      alert('Não foi possível ler o PDF. Tente outro arquivo ou cole o texto.')
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
      <label>Pedido escrito<textarea
        autoFocus
        rows={9}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onInput={() => setLinhas([])}
        placeholder="Cole com Ctrl+V, digite ou extraia o pedido de uma imagem..."
      /></label>
      <div className="orcamento-texto-fontes">
        <label className="orcamento-texto-imagem"><ImagePlus size={20}/>{lendoImagem ? `Lendo imagem... ${progressoOcr}%` : 'Anexar imagem'}<input type="file" accept="image/*" disabled={lendoImagem} onChange={(e) => void lerImagem(e.target.files?.[0])}/></label>
        <label className="orcamento-texto-imagem"><FileText size={20}/>{lendoImagem ? `Lendo arquivo... ${progressoOcr}%` : 'Anexar PDF'}<input type="file" accept="application/pdf,.pdf" disabled={lendoImagem} onChange={(e) => void lerPdf(e.target.files?.[0])}/></label>
        <button className="orcamento-texto-analisar" onClick={analisar} disabled={lendoImagem || !texto.trim()}>Analisar texto</button>
      </div>
      {analisado && <div className="orcamento-texto-itens">{linhas.map((linha) => {
        const candidatos = sugestoes(linha.produtoBusca || linha.texto, produtos)
        return <div key={linha.id}><input type="number" min="0.01" step="1" value={linha.quantidade} onChange={(e) => {
          const quantidade = e.currentTarget.valueAsNumber
          setLinhas((atuais) => atuais.map((item) => item.id === linha.id
            ? { ...item, quantidade: Number.isFinite(quantidade) ? quantidade : item.quantidade }
            : item))
        }} /><span>{linha.texto}</span><div className="orcamento-texto-produto-campo"><input
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
        </datalist>{!linha.produtoCodigo && <select
          className="orcamento-texto-sugestoes"
          value=""
          onChange={(e) => {
            const produto = produtos.find((item) => String(item.codigo) === e.target.value)
            if (!produto) return
            setLinhas((atuais) => atuais.map((item) => item.id === linha.id
              ? {
                  ...item,
                  produtoCodigo: String(produto.codigo || ''),
                  produtoBusca: String(produto.descricao || produto.nome || ''),
                }
              : item))
          }}
        >
          <option value="">{candidatos.length ? 'Ver produtos sugeridos...' : 'Nenhuma sugestão — digite para buscar'}</option>
          {candidatos.map(({ produto, pontos }) => <option key={produto.codigo} value={produto.codigo}>
            {`${produto.descricao || produto.nome} (${Math.round(pontos * 100)}%)`}
          </option>)}
        </select>}</div></div>
      })}</div>}
      <footer><span>{pendentes ? `${pendentes} item(ns) precisam de confirmação` : analisado ? 'Todos os itens associados' : ''}</span><button onClick={preparar} disabled={!analisado || pendentes > 0}>Preparar orçamento aberto</button></footer>
    </section>
  </div>
}
