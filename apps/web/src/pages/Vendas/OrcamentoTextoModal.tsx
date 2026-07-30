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
      const achadoInicio = linha.match(/^(\d+(?:[.,]\d+)?)\s*(?:unid(?:ades?)?|undi|und|pcte?s?|pct|fardos?|cx|caixas?)?\s*(?:de\s+)?(.+)$/i)
      const achadoFim = linha.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:fardos?|unid(?:ades?)?|undi|und|pcte?s?|pct|cx|caixas?)?$/i)
      const quantidade = achadoInicio
        ? Number(achadoInicio[1].replace(',', '.'))
        : achadoFim
          ? Number(achadoFim[2].replace(',', '.'))
          : 1
      return {
        id: `texto-${indice}-${Date.now()}`,
        quantidade,
        texto: (achadoInicio?.[2] || achadoFim?.[1] || linha).trim(),
        produtoCodigo: '',
      }
    }).filter((linha) => linha.quantidade > 0)
}

function sugestoes(texto: string, produtos: any[]) {
  const textoNormalizado = normalizar(texto)
  const textoBusca = sinonimos[textoNormalizado] || textoNormalizado
  const termos = textoBusca.split(' ').filter((termo) => termo.length > 2 && !ignorar.has(termo))
  return produtos.map((produto) => {
    const alvo = normalizar(`${produto.descricao || ''} ${produto.nome || ''} ${produto.marca || ''}`)
    const palavrasAlvo = new Set(alvo.split(' ').filter(Boolean))
    const acertos = termos.filter((termo) => palavrasAlvo.has(termo)).length
    return { produto, pontos: termos.length ? acertos / termos.length : 0 }
  }).filter((item) => item.pontos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, 12)
}

function associacaoAutomaticaSegura(texto: string, candidatos: Array<{ produto: any; pontos: number }>) {
  const termos = normalizar(sinonimos[normalizar(texto)] || texto)
    .split(' ')
    .filter((termo) => termo.length > 2 && !ignorar.has(termo))
  if (termos.length < 2) return undefined
  const primeiro = candidatos[0]
  const segundo = candidatos[1]
  if (!primeiro || primeiro.pontos < 0.9) return undefined
  if (primeiro.pontos - (segundo?.pontos || 0) < 0.25) return undefined
  return primeiro.produto
}

async function prepararImagemOcr(arquivo: File) {
  const bitmap = await createImageBitmap(arquivo)
  const escala = Math.max(1, Math.min(5, 2800 / Math.max(bitmap.width, 1)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  const contexto = canvas.getContext('2d', { willReadFrequently: true })
  if (!contexto) return arquivo

  contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height)
  for (let indice = 0; indice < imagem.data.length; indice += 4) {
    const cinza = (imagem.data[indice] * 0.299)
      + (imagem.data[indice + 1] * 0.587)
      + (imagem.data[indice + 2] * 0.114)
    const contraste = Math.max(0, Math.min(255, ((cinza - 128) * 1.45) + 128))
    imagem.data[indice] = contraste
    imagem.data[indice + 1] = contraste
    imagem.data[indice + 2] = contraste
  }
  contexto.putImageData(imagem, 0, 0)
  return canvas
}

function localizarLinhasTabela(imagem: ImageData) {
  const { width, height, data } = imagem
  const linhasEscuras: number[] = []
  for (let y = 0; y < height; y += 1) {
    let escuros = 0
    for (let x = 0; x < width; x += 1) {
      const indice = ((y * width) + x) * 4
      // Planilhas fotografadas ou enviadas pelo WhatsApp deixam as grades
      // cinza. Considerá-las na segmentação evita juntar a primeira linha ao
      // cabeçalho e preserva rigorosamente a ordem visual da tabela.
      if (data[indice] < 210 && data[indice + 1] < 210 && data[indice + 2] < 210) escuros += 1
    }
    if (escuros / width > 0.65) linhasEscuras.push(y)
  }
  const limites: number[] = []
  let grupoInicio = -1
  let grupoFim = -1
  linhasEscuras.forEach((y) => {
    if (grupoInicio < 0) {
      grupoInicio = y
      grupoFim = y
      return
    }
    if (y <= grupoFim + 1) {
      grupoFim = y
      return
    }
    limites.push(Math.round((grupoInicio + grupoFim) / 2))
    grupoInicio = y
    grupoFim = y
  })
  if (grupoInicio >= 0) limites.push(Math.round((grupoInicio + grupoFim) / 2))
  return limites
}

function localizarDivisorTabela(imagem: ImageData) {
  const { width, height, data } = imagem
  let melhorX = Math.round(width * 0.82)
  let melhor = 0
  for (let x = Math.round(width * 0.55); x < Math.round(width * 0.95); x += 1) {
    let escuros = 0
    for (let y = 0; y < height; y += 1) {
      const indice = ((y * width) + x) * 4
      if (data[indice] < 210 && data[indice + 1] < 210 && data[indice + 2] < 210) escuros += 1
    }
    if (escuros > melhor) {
      melhor = escuros
      melhorX = x
    }
  }
  return melhorX
}

async function extrairTabelaDaImagem(arquivo: File, worker: any, atualizarProgresso: (valor: number) => void) {
  const bitmap = await createImageBitmap(arquivo)
  const origem = document.createElement('canvas')
  origem.width = bitmap.width
  origem.height = bitmap.height
  const contexto = origem.getContext('2d', { willReadFrequently: true })
  if (!contexto) {
    bitmap.close()
    return ''
  }
  contexto.drawImage(bitmap, 0, 0)
  bitmap.close()
  const imagem = contexto.getImageData(0, 0, origem.width, origem.height)
  const limites = localizarLinhasTabela(imagem)
  if (limites.length < 4) return ''
  const divisor = localizarDivisorTabela(imagem)
  const itens: string[] = []
  const intervalos = limites.slice(0, -1)
    .map((inicio, indice) => ({ inicio: inicio + 1, fim: limites[indice + 1] - 1 }))
    .filter(({ inicio, fim }) => fim - inicio >= 5)

  for (let indice = 0; indice < intervalos.length; indice += 1) {
    // A primeira faixa da planilha é sempre o cabeçalho ITEM / PEDIR.
    if (indice === 0) continue
    const { inicio, fim } = intervalos[indice]
    const altura = fim - inicio
    const escala = Math.max(3, Math.min(6, 64 / altura))
    const celulaDescricao = document.createElement('canvas')
    celulaDescricao.width = Math.max(800, Math.round((divisor - 4) * escala))
    celulaDescricao.height = Math.round(altura * escala)
    const descricaoContexto = celulaDescricao.getContext('2d')
    if (!descricaoContexto) continue
    descricaoContexto.fillStyle = '#fff'
    descricaoContexto.fillRect(0, 0, celulaDescricao.width, celulaDescricao.height)
    descricaoContexto.drawImage(
      origem, 2, inicio, Math.max(1, divisor - 4), altura,
      0, 0, celulaDescricao.width, celulaDescricao.height,
    )
    await worker.setParameters({
      tessedit_pageseg_mode: '7' as any,
      tessedit_char_whitelist: '',
      preserve_interword_spaces: '1',
    })
    const resultadoDescricao = await worker.recognize(celulaDescricao)
    let lida = String(resultadoDescricao.data.text || '').replace(/\s+/g, ' ').trim()

    const celulaQuantidade = document.createElement('canvas')
    celulaQuantidade.width = Math.max(160, Math.round((origem.width - divisor - 4) * escala))
    celulaQuantidade.height = celulaDescricao.height
    const quantidadeContexto = celulaQuantidade.getContext('2d')
    if (!quantidadeContexto) continue
    quantidadeContexto.fillStyle = '#fff'
    quantidadeContexto.fillRect(0, 0, celulaQuantidade.width, celulaQuantidade.height)
    quantidadeContexto.drawImage(
      origem,
      divisor + 2,
      inicio,
      Math.max(1, origem.width - divisor - 4),
      altura,
      0,
      0,
      celulaQuantidade.width,
      celulaQuantidade.height,
    )
    await worker.setParameters({
      tessedit_pageseg_mode: '7' as any,
      // Ler FARDO como texto impede o "O" de virar um zero adicional
      // (1 FARDO => 10 e 3 FARDO => 30).
      tessedit_char_whitelist: '0123456789FARDO ',
      preserve_interword_spaces: '1',
    })
    const resultadoQuantidade = await worker.recognize(celulaQuantidade)
    let quantidadeLida = String(resultadoQuantidade.data.text || '').match(/\d+/)?.[0] || ''

    // Em células como "1 FARDO" ou com algarismo pouco nítido, a lista
    // restrita somente a números pode retornar vazio. Releia apenas a célula
    // que falhou, sem alterar a ordem das linhas.
    if (!quantidadeLida) {
      await worker.setParameters({
        tessedit_pageseg_mode: '7' as any,
        tessedit_char_whitelist: '0123456789FARDO ',
        preserve_interword_spaces: '1',
      })
      const segundaQuantidade = await worker.recognize(celulaQuantidade)
      quantidadeLida = String(segundaQuantidade.data.text || '').match(/\d+/)?.[0] || ''
    }

    // Não descarte um produto válido apenas porque a primeira leitura da
    // descrição falhou. A segunda passagem ocorre somente nessa linha.
    if (!lida && quantidadeLida && Number(quantidadeLida) > 0) {
      await worker.setParameters({
        tessedit_pageseg_mode: '6' as any,
        tessedit_char_whitelist: '',
        preserve_interword_spaces: '1',
      })
      const segundaDescricao = await worker.recognize(celulaDescricao)
      lida = String(segundaDescricao.data.text || '').replace(/\s+/g, ' ').trim()
    }
    atualizarProgresso(Math.round(((indice + 1) / intervalos.length) * 100))
    if (!lida || /^(ITEM|PEDIR)\b/i.test(lida)) continue
    const descricao = lida.replace(/\s*\|\|\s*$/, '').trim()
    if (!descricao) continue
    const quantidade = Number(quantidadeLida)
    if (!Number.isFinite(quantidade) || quantidade <= 0) continue
    itens.push(`${quantidade} ${descricao}`)
  }
  return itens.join('\n')
}

function extrairSomenteItensDoPdf(texto: string) {
  const inicioTabela = texto.search(/\bITENS\s+DO\s+OR[CÇ]AMENTO\b/i)
  const textoTabela = inicioTabela >= 0 ? texto.slice(inicioTabela) : texto
  const fimTabela = textoTabela.search(
    /\b(?:QUANTIDADE\s+DE\s+ITENS|VALOR\s+TOTAL\s+DOS\s+ITENS|TOTAL\s+DOS\s+ITENS)\b/i,
  )
  const linear = (fimTabela >= 0 ? textoTabela.slice(0, fimTabela) : textoTabela)
    .replace(/\s+/g, ' ')
    .trim()
  const itens: string[] = []
  /*
   * Cada linha válida começa pelo código interno/EAN e termina pelos três
   * valores monetários. Assim, códigos não viram quantidade e descrições
   * quebradas em várias linhas permanecem em um único produto.
   */
  const padrao = /\b(\d{8,14})\s+(.+?)\s+(?:UNIDADE|UN|PC|PCT|CX|FD)\s+(\d+(?:[.,]\d+)?)\s+R\$\s*[\d.,]+\s+R\$\s*[\d.,]+\s+R\$\s*[\d.,]+(?=\s+\d{8,14}\b|$)/gi
  let resultado: RegExpExecArray | null

  while ((resultado = padrao.exec(linear)) !== null) {
    const descricaoCompleta = resultado[2].replace(/\s+/g, ' ').trim()
    const quantidade = resultado[3]
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
        || associacaoAutomaticaSegura(linha.texto, candidatos)
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
      await worker.setParameters({
        tessedit_pageseg_mode: '6' as any,
        preserve_interword_spaces: '1',
      })
      const tabelaExtraida = await extrairTabelaDaImagem(arquivo, worker, setProgressoOcr)
      const imagemPreparada = tabelaExtraida ? null : await prepararImagemOcr(arquivo)
      const resultado = imagemPreparada ? await worker.recognize(imagemPreparada) : null
      await worker.terminate()
      const extraido = tabelaExtraida || String(resultado?.data.text || '').trim()
      if (!extraido) return alert('Não foi possível ler texto nessa imagem.')
      // Um novo anexo representa um novo pedido. Não misturar o OCR atual
      // com produtos que tenham ficado no campo de uma leitura anterior.
      setTexto(extraido)
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
      setTexto(itensExtraidos)
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
