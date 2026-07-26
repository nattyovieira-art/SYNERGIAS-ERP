import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { ItemCompra } from '../types/Compra'

const normalizar = (valor: unknown) => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ')
  .trim()
  .toLowerCase()

const numero = (valor: unknown) => {
  const texto = String(valor || '').replace(/[R$\s]/g, '')
  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto
  return Number(normalizado) || 0
}

export async function extrairTextoDocumentoCompra(arquivo: File): Promise<string> {
  if (arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    const pdf = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise
    const paginas: string[] = []
    for (let paginaNumero = 1; paginaNumero <= pdf.numPages; paginaNumero += 1) {
      const pagina = await pdf.getPage(paginaNumero)
      const conteudo = await pagina.getTextContent()
      const linhas: string[] = []
      let linha = ''
      for (const item of conteudo.items as Array<{ str?: string; hasEOL?: boolean }>) {
        const trecho = String(item.str || '').trim()
        if (trecho) linha += `${linha ? ' ' : ''}${trecho}`
        if (item.hasEOL && linha) {
          linhas.push(linha)
          linha = ''
        }
      }
      if (linha) linhas.push(linha)
      paginas.push(linhas.join('\n'))
    }
    const texto = paginas.join('\n').trim()
    if (texto.length >= 20) return texto
  }

  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('por')
  const resultado = await worker.recognize(arquivo)
  await worker.terminate()
  return String(resultado.data.text || '').trim()
}

export function criarItensCompraDocumento(texto: string, produtos: any[]): ItemCompra[] {
  const linhas = texto.split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean)
  const usados = new Set<string>()
  const itens: ItemCompra[] = []

  linhas.forEach((linha, indice) => {
    const valores = linha.match(/\d+(?:[.,]\d{1,4})?/g) || []
    const quantidade = numero(valores[0])
    if (!(quantidade > 0)) return

    const linhaNormalizada = normalizar(linha)
    const candidatos = produtos
      .map((produto) => {
        const descricao = String(produto.descricao || produto.nome || '')
        const palavras = normalizar(descricao).split(' ').filter((palavra) => palavra.length > 2)
        const encontradas = palavras.filter((palavra) => linhaNormalizada.includes(palavra)).length
        return { produto, descricao, pontos: palavras.length ? encontradas / palavras.length : 0 }
      })
      .filter((item) => item.pontos >= 0.45)
      .sort((a, b) => b.pontos - a.pontos)

    const melhor = candidatos[0]
    if (!melhor || melhor.pontos <= (candidatos[1]?.pontos || 0)) return
    const codigo = String(melhor.produto.codigo || melhor.produto.id || '')
    if (!codigo || usados.has(codigo)) return

    const total = numero(valores[valores.length - 1])
    const unitarioInformado = valores.length >= 3 ? numero(valores[valores.length - 2]) : 0
    const custoUnitario = unitarioInformado || (total > 0 ? total / quantidade : 0)
    usados.add(codigo)
    itens.push({
      id: `documento-compra-${Date.now()}-${indice}`,
      produtoCodigo: codigo,
      descricao: melhor.descricao,
      unidade: String(melhor.produto.unidade || 'UN'),
      quantidade,
      custoUnitario,
      total: total || quantidade * custoUnitario,
      unidadeFiscal: String(melhor.produto.unidade || 'UN'),
      quantidadeFiscal: quantidade,
      custoUnitarioFiscal: custoUnitario,
      totalFiscal: total || quantidade * custoUnitario,
      unidadeControle: String(melhor.produto.unidade || 'UN'),
      fatorConversao: 1,
      quantidadeConvertida: quantidade,
      custoUnitarioConvertido: custoUnitario,
      correspondencia: 'DESCRICAO',
    })
  })

  return itens
}
