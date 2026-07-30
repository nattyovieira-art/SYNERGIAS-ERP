import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowLeft,
  CheckCircle2,
  Search,
  RefreshCw,
  List,
  Filter,
  FileUp,
  PackageCheck,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import type { Compra, ItemCompra, StatusCompra } from '../../types/Compra'
import {
  buscarCompraStorage,
  gerarNumeroCompraStorage,
  listarComprasStorage,
  salvarCompraStorage,
  salvarCompraStorageConfirmado,
  encontrarCompraComNotaDuplicada,
} from '../../services/comprasStorage'
import { aguardarSincronizacaoCentral } from '../../services/erpApi'
import {
  listarProdutosStorage,
  listarProdutosAtivosStorage,
  gerarProximoCodigoBarrasProdutoStorage,
  gerarProximoCodigoInternoProdutoStorage,
  salvarProdutoStorage,
} from '../../services/produtosStorage'
import { inferirFatorEmbalagemNFe, parseNFeCompraXml } from '../../services/nfeCompraXml'
import { criarItensCompraDocumento, extrairTextoDocumentoCompra } from '../../services/documentoCompra'
import {
  confirmarEntradaCompraComCustoMedioStorage,
  movimentarEstoqueStorage,
} from '../../services/estoqueStorage'

import '../../styles/compras.css'

type CompraFormProps = {
  modo: 'novo' | 'editar'
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function adicionarDias(data: string, dias: number) {
  const base = data ? new Date(`${data}T12:00:00`) : new Date()
  base.setDate(base.getDate() + dias)

  return base.toISOString().slice(0, 10)
}

function criarId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function dinheiro(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function numero(valor: unknown) {
  const convertido = Number(valor || 0)
  return Number.isFinite(convertido) ? convertido : 0
}

function sincronizarContasPagarCompra(compra: Compra) {
  const chave = 'synergias_contas_pagar'
  let atuais: Array<Record<string, unknown>> = []
  try {
    const dados = JSON.parse(localStorage.getItem(chave) || '[]')
    if (Array.isArray(dados)) atuais = dados
  } catch {
    atuais = []
  }
  const parcelas = compra.parcelasPagamento || []
  parcelas.forEach((parcela, indice) => {
    const id = `compra-${compra.id}-parcela-${parcela.numero || indice + 1}`
    const conta = {
      id,
      fornecedor: compra.fornecedorNome,
      documento: compra.chaveAcessoNFe || compra.numeroNFe || compra.numeroCompra,
      descricao: `NF-e ${compra.numeroNFe || '-'} · Pedido ${compra.numeroCompra} · Parcela ${parcela.numero}`,
      categoria: 'Compras de materiais',
      emissao: compra.dataEmissao,
      vencimento: parcela.vencimento,
      valor: parcela.valor,
      status: 'Em aberto',
      observacao: `Fornecedor ${compra.fornecedorDocumento}. Chave NF-e ${compra.chaveAcessoNFe || '-'}.`,
      conciliado: false,
      compraId: compra.id,
      numeroCompra: compra.numeroCompra,
      numeroNFe: compra.numeroNFe,
      chaveAcessoNFe: compra.chaveAcessoNFe,
      parcelaNumero: parcela.numero,
    }
    const posicao = atuais.findIndex((item) => item.id === id)
    if (posicao >= 0) {
      const existente = atuais[posicao]
      atuais[posicao] = existente.status === 'Paga' || existente.conciliado
        ? { ...conta, ...existente }
        : { ...existente, ...conta }
    } else {
      atuais.unshift(conta)
    }
  })
  localStorage.setItem(chave, JSON.stringify(atuais))
}

function normalizarItem(item: ItemCompra): ItemCompra {
  const unidadeFiscal = item.unidadeFiscal || item.unidade || 'UN'
  const quantidadeFiscal = numero(item.quantidadeFiscal ?? item.quantidade)
  const custoUnitarioFiscal = numero(
    item.custoUnitarioFiscal ?? item.custoUnitario,
  )
  const totalFiscal = numero(item.totalFiscal ?? item.total)
  const fatorInformado = Math.max(1, numero(item.fatorConversao || 1))
  const fatorDescricao = inferirFatorEmbalagemNFe(item.descricao, unidadeFiscal)
  const fatorConversao = Math.max(fatorInformado, fatorDescricao)
  const quantidadeConvertida = fatorDescricao > fatorInformado
    ? quantidadeFiscal * fatorConversao
    : numero(item.quantidadeConvertida) || quantidadeFiscal * fatorConversao
  const custoUnitarioConvertido =
    numero(item.custoFinalItem) > 0 && quantidadeConvertida > 0
      ? numero(item.custoFinalItem) / quantidadeConvertida
      : numero(item.custoUnitarioConvertido) ||
        (fatorConversao > 0 ? custoUnitarioFiscal / fatorConversao : 0)

  return {
    ...item,
    unidade: item.unidade || unidadeFiscal,
    quantidade: numero(item.quantidade || quantidadeFiscal),
    custoUnitario: numero(item.custoUnitario || custoUnitarioFiscal),
    total: numero(item.total || totalFiscal),
    unidadeFiscal,
    quantidadeFiscal,
    custoUnitarioFiscal,
    totalFiscal,
    unidadeControle: item.unidadeControle || unidadeFiscal,
    fatorConversao,
    quantidadeConvertida,
    custoUnitarioConvertido,
  }
}

function aplicarTotaisDoXml(compra: Compra): Compra {
  if (!compra.xmlNFe) return compra
  try {
    const documento = new DOMParser().parseFromString(compra.xmlNFe, 'application/xml')
    const total = documento.querySelector('ICMSTot')
    if (!total) return compra
    const valor = (campo: string) => numero(total.querySelector(campo)?.textContent)
    const desconto = valor('vDesc')
    if (desconto <= 0) return compra

    const baseProdutos = compra.itens.reduce(
      (soma, item) => soma + numero(item.totalFiscal ?? item.total),
      0,
    )
    let descontoAcumulado = 0
    const itens = compra.itens.map((item, indice) => {
      const descontoItem = indice === compra.itens.length - 1
        ? desconto - descontoAcumulado
        : Number((desconto * numero(item.totalFiscal ?? item.total) / baseProdutos).toFixed(2))
      descontoAcumulado += descontoItem
      const descontoAnterior = numero(item.descontoRateado)
      const custoBase = numero(item.custoFinalItem) + descontoAnterior
      const custoFinalItem = Math.max(0, custoBase - descontoItem)
      const quantidade = numero(item.quantidadeConvertida || item.quantidade)
      return {
        ...item,
        descontoRateado: descontoItem,
        custoFinalItem,
        custoUnitarioConvertido: quantidade > 0 ? custoFinalItem / quantidade : 0,
      }
    })

    return {
      ...compra,
      itens,
      desconto,
      frete: valor('vFrete'),
      outrosCustos: valor('vOutro'),
      totalFinal: valor('vNF'),
      descontoFinanceiroNFe: desconto,
      valorLiquidoCobrancaNFe: valor('vNF'),
      decisaoDescontoFinanceiro: 'LIQUIDO_COM_DESCONTO',
    }
  } catch {
    return compra
  }
}

function CompraForm({ modo }: CompraFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()

  const compraEncontrada =
    modo === 'editar' && id ? buscarCompraStorage(id) : undefined

  const [buscaFormulario, setBuscaFormulario] = useState('')
  const produtosDisponiveis = useMemo(() => listarProdutosAtivosStorage(), [])
  const [buscasProduto, setBuscasProduto] = useState<Record<string, string>>({})
  const [produtoBuscaAberta, setProdutoBuscaAberta] = useState<string | null>(null)
  const [processandoRecebimento, setProcessandoRecebimento] = useState(false)
  const dadosFiscaisSincronizados = useRef(false)
  const [indiceSugestaoProduto, setIndiceSugestaoProduto] = useState<Record<string, number>>({})
  const [mostrarFiltrosFormulario, setMostrarFiltrosFormulario] = useState(false)
  const [filtroFormulario, setFiltroFormulario] = useState<'todos' | 'fornecedor' | 'produtos' | 'pagamento'>('todos')

  const [compra, setCompra] = useState<Compra>(() => {
    if (compraEncontrada) {
      const compraCorrigida = aplicarTotaisDoXml(compraEncontrada)
      return {
        ...compraCorrigida,
        movimentarEstoque: compraCorrigida.movimentarEstoque ?? false,
        movimentouEstoque: compraCorrigida.movimentouEstoque ?? false,
        itens: compraCorrigida.itens.map(normalizarItem),
      }
    }

    const dataEmissao = hoje()
    const estadoImportacao = location.state as {
      xmlCompra?: string
      documentoCompraTexto?: string
      documentoCompraNome?: string
      chaveAcessoNFe?: string
    } | null
    const xmlRecebido = estadoImportacao?.xmlCompra
    if (modo === 'novo' && xmlRecebido) {
      return parseNFeCompraXml(
        xmlRecebido,
        listarProdutosAtivosStorage(),
        gerarNumeroCompraStorage(),
      )
    }

    const itensDocumento = modo === 'novo' && estadoImportacao?.documentoCompraTexto
      ? criarItensCompraDocumento(estadoImportacao.documentoCompraTexto, listarProdutosAtivosStorage())
      : []
    const subtotalDocumento = itensDocumento.reduce((soma, item) => soma + numero(item.total), 0)

    return {
      id: criarId(),
      numeroCompra: gerarNumeroCompraStorage(),
      dataEmissao,
      previsaoEntrega: adicionarDias(dataEmissao, 7),
      fornecedorCodigo: '',
      fornecedorNome: '',
      fornecedorDocumento: '',
      fornecedorEmail: '',
      fornecedorTelefone: '',
      itens: itensDocumento,
      desconto: 0,
      frete: 0,
      outrosCustos: 0,
      subtotal: subtotalDocumento,
      totalFinal: subtotalDocumento,
      formaPagamento: '',
      condicaoPagamento: '',
      observacoes: estadoImportacao?.documentoCompraTexto
        ? `IMPORTADO PARA CONFERÊNCIA DE ${estadoImportacao.documentoCompraNome || 'DOCUMENTO SEM NF-E'}.\n\n${estadoImportacao.documentoCompraTexto}`
        : '',
      status: 'Rascunho',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      origem: 'MANUAL',
      chaveAcessoNFe: estadoImportacao?.chaveAcessoNFe || undefined,
      importacaoHistorica: false,
      movimentarEstoque: false,
      movimentouEstoque: false,
    }
  })

  useEffect(() => {
    if (!compraEncontrada || dadosFiscaisSincronizados.current) return
    dadosFiscaisSincronizados.current = true
    const compraNormalizada = {
      ...compraEncontrada,
      itens: compraEncontrada.itens.map(normalizarItem),
      atualizadoEm: new Date().toISOString(),
    }
    const conversaoMudou = compraNormalizada.itens.some((itemNovo, indice) => {
      const itemAntigo = compraEncontrada.itens[indice]
      return (
        numero(itemNovo.fatorConversao) !== numero(itemAntigo?.fatorConversao) ||
        numero(itemNovo.quantidadeConvertida) !== numero(itemAntigo?.quantidadeConvertida) ||
        Math.abs(
          numero(itemNovo.custoUnitarioConvertido) -
          numero(itemAntigo?.custoUnitarioConvertido),
        ) > 0.000001
      )
    })

    sincronizarDadosFiscaisProdutos(compraNormalizada)
    if (conversaoMudou) {
      void (async () => {
        await salvarCompraStorageConfirmado(compraNormalizada)
        atualizarCustosProdutosAposCorrecao(compraEncontrada, compraNormalizada)
        await aguardarSincronizacaoCentral('produtos')
        setCompra(compraNormalizada)
      })()
      return
    }
    void aguardarSincronizacaoCentral('produtos')
  }, [compraEncontrada?.id])

  const subtotal = useMemo(
    () =>
      compra.itens.reduce(
        (soma, item) =>
          soma +
          (item.incluidoNoSistema === false
            ? 0
            : numero(item.custoFinalItem ?? item.totalFiscal ?? item.total)),
        0,
      ),
    [compra.itens],
  )

  const totalFinal = useMemo(
    () =>
      Math.max(
        0,
        subtotal -
          numero(compra.desconto) +
          numero(compra.frete) +
          numero(compra.outrosCustos),
      ),
    [compra.desconto, compra.frete, compra.outrosCustos, subtotal],
  )

  function atualizarCompra<K extends keyof Compra>(campo: K, valor: Compra[K]) {
    setCompra((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  function importarXmlVisual() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xml,text/xml,application/xml,.pdf,application/pdf,image/*'

    input.onchange = async () => {
      const arquivo = input.files?.[0]

      if (!arquivo) return

      try {
        const ehXml = arquivo.type.includes('xml') || arquivo.name.toLowerCase().endsWith('.xml')
        if (!ehXml) {
          const textoDocumento = await extrairTextoDocumentoCompra(arquivo)
          const itens = criarItensCompraDocumento(textoDocumento, listarProdutosAtivosStorage())
          const subtotalDocumento = itens.reduce((soma, item) => soma + numero(item.total), 0)
          setCompra((atual) => ({
            ...atual,
            itens,
            subtotal: subtotalDocumento,
            totalFinal: subtotalDocumento,
            origem: 'MANUAL',
            numeroNFe: undefined,
            chaveAcessoNFe: undefined,
            observacoes: `IMPORTADO PARA CONFERÊNCIA DE ${arquivo.name}.\n\n${textoDocumento}`,
            atualizadoEm: new Date().toISOString(),
          }))
          alert(`${itens.length} item(ns) identificado(s). Confira fornecedor, quantidades e valores antes de salvar.`)
          return
        }
        const xml = await arquivo.text()
        const importada = parseNFeCompraXml(xml, listarProdutosAtivosStorage(), compra.numeroCompra)
        const duplicada = listarComprasStorage().find(
          (item) => item.chaveAcessoNFe === importada.chaveAcessoNFe && item.id !== compra.id,
        )
        if (duplicada) {
          alert(`Esta NF-e já foi importada na compra ${duplicada.numeroCompra}.`)
          return
        }
        setCompra(importada)
        alert(
          `NF-e ${importada.numeroNFe} preparada para conferência.\n\n` +
          importada.itens.map((item) =>
            `${item.quantidadeFiscal} ${item.unidadeFiscal} × ${item.fatorConversao} = ${item.quantidadeConvertida} ${item.unidadeControle}`,
          ).join('\n') +
          '\n\nNenhuma compra, produto, custo ou quantidade em estoque foi alterada.',
        )
        return
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Não foi possível ler o XML.')
        return
      }

      alert(
        `Arquivo XML selecionado: ${arquivo!.name}\n\n` +
          'A importação automática do XML será conectada ao fluxo fiscal. ' +
          'Nenhum pedido ou estoque foi alterado.',
      )
    }

    input.click()
  }

  function atualizarFormulario() {
    window.location.reload()
  }

  function focarBuscaFormulario() {
    document
      .querySelector<HTMLInputElement>('.compras-form-search input')
      ?.focus()
  }

  function abrirFiltrosFormulario() {
    setMostrarFiltrosFormulario((atual) => !atual)
  }

  function aplicarFiltroFormulario() {
    const seletores: Record<string, string> = {
      fornecedor: '[data-compra-secao=\"fornecedor\"]',
      produtos: '[data-compra-secao=\"produtos\"]',
      pagamento: '[data-compra-secao=\"pagamento\"]',
    }
    const seletor = seletores[filtroFormulario]
    if (seletor) document.querySelector(seletor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function adicionarItem() {
    const novoItem: ItemCompra = {
      id: criarId(),
      produtoCodigo: '',
      descricao: '',
      unidade: 'UN',
      quantidade: 1,
      custoUnitario: 0,
      total: 0,
      unidadeFiscal: 'UN',
      quantidadeFiscal: 1,
      custoUnitarioFiscal: 0,
      totalFiscal: 0,
      unidadeControle: 'UN',
      fatorConversao: 1,
      quantidadeConvertida: 1,
      custoUnitarioConvertido: 0,
    }

    setCompra((atual) => ({
      ...atual,
      itens: [...atual.itens, novoItem],
    }))
  }

  function atualizarItem<K extends keyof ItemCompra>(
    itemId: string,
    campo: K,
    valor: ItemCompra[K],
  ) {
    setCompra((atual) => ({
      ...atual,
      itens: atual.itens.map((itemOriginal) => {
        if (itemOriginal.id !== itemId) return itemOriginal

        const item = normalizarItem(itemOriginal)

        const atualizado = {
          ...item,
          [campo]: valor,
        } as ItemCompra

        const quantidadeFiscal = numero(atualizado.quantidadeFiscal)
        const custoUnitarioFiscal = numero(atualizado.custoUnitarioFiscal)
        const fatorConversao = Math.max(1, numero(atualizado.fatorConversao || 1))
        const quantidadeConvertida = quantidadeFiscal * fatorConversao
        const totalFiscal = quantidadeFiscal * custoUnitarioFiscal
        const custosAdicionais = Math.max(
          0,
          numero(item.custoFinalItem) - numero(item.totalFiscal),
        )
        const custoFinalItem = totalFiscal + custosAdicionais
        const custoUnitarioConvertido =
          custoFinalItem > 0 && quantidadeConvertida > 0
            ? custoFinalItem / quantidadeConvertida
            : fatorConversao > 0
              ? custoUnitarioFiscal / fatorConversao
              : 0

        return {
          ...atualizado,
          unidade: atualizado.unidadeFiscal || atualizado.unidade || 'UN',
          quantidade: quantidadeFiscal,
          custoUnitario: custoUnitarioFiscal,
          total: totalFiscal,
          totalFiscal,
          custoFinalItem,
          fatorConversao,
          quantidadeConvertida,
          custoUnitarioConvertido,
        }
      }),
    }))
  }

  function atualizarQuantidadeConvertida(itemId: string, valor: number) {
    setCompra((atual) => ({
      ...atual,
      itens: atual.itens.map((itemOriginal) => {
        if (itemOriginal.id !== itemId) return itemOriginal

        const item = normalizarItem(itemOriginal)
        const quantidadeFiscal = numero(item.quantidadeFiscal)
        const quantidadeConvertida = Math.max(0, numero(valor))
        const fatorConversao =
          quantidadeFiscal > 0 && quantidadeConvertida > 0
            ? quantidadeConvertida / quantidadeFiscal
            : 1
        const custoFinalItem =
          numero(item.custoFinalItem) > 0
            ? numero(item.custoFinalItem)
            : numero(item.totalFiscal ?? item.total)

        return {
          ...item,
          fatorConversao,
          quantidadeConvertida,
          custoUnitarioConvertido:
            quantidadeConvertida > 0
              ? custoFinalItem / quantidadeConvertida
              : 0,
        }
      }),
    }))
  }

  function removerItem(itemId: string) {
    setCompra((atual) => ({
      ...atual,
      itens: atual.itens.filter((item) => item.id !== itemId),
    }))
  }

  function definirInclusaoItem(itemId: string, incluir: boolean) {
    setCompra((atual) => ({
      ...atual,
      itens: atual.itens.map((item) => item.id === itemId
        ? {
            ...item,
            incluidoNoSistema: incluir,
            motivoDescarte: incluir ? '' : 'Descartado manualmente',
          }
        : item),
    }))
  }

  function vincularProduto(itemId: string, codigo: string) {
    const produto = produtosDisponiveis.find((item) => item.codigo === codigo)
    if (produto) {
      setBuscasProduto((atual) => ({
        ...atual,
        [itemId]: `${produto.codigo} - ${produto.descricao}`,
      }))
      setProdutoBuscaAberta(null)
    }
    setCompra((atual) => ({
      ...atual,
      itens: atual.itens.map((item) => item.id === itemId
        ? {
            ...item,
            produtoCodigo: codigo,
            fatorConversao: Math.max(1, numero(produto?.quantidadePorEmbalagemCompra || item.fatorConversao || 1)),
            quantidadeConvertida:
              numero(item.quantidadeFiscal ?? item.quantidade) *
              Math.max(1, numero(produto?.quantidadePorEmbalagemCompra || item.fatorConversao || 1)),
            custoUnitarioConvertido:
              numero(item.quantidadeFiscal ?? item.quantidade) *
                Math.max(1, numero(produto?.quantidadePorEmbalagemCompra || item.fatorConversao || 1)) > 0
                ? numero(item.custoFinalItem ?? item.totalFiscal ?? item.total) /
                  (numero(item.quantidadeFiscal ?? item.quantidade) *
                    Math.max(1, numero(produto?.quantidadePorEmbalagemCompra || item.fatorConversao || 1)))
                : 0,
            novoProdutoPendente: false,
            novoProdutoNome: '',
            correspondencia: produto ? 'DESCRICAO' : 'NAO_VINCULADO',
          }
        : item),
    }))
  }

  function normalizarBuscaProduto(valor: string) {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  }

  function produtosSugeridos(busca: string) {
    const termo = normalizarBuscaProduto(busca)
    if (!termo) return []
    const palavras = termo.split(/\s+/).filter((palavra) => palavra.length > 1)
    return produtosDisponiveis
      .map((produto) => {
        const texto = normalizarBuscaProduto(`${produto.codigo} ${produto.codigoBarras || ''} ${produto.descricao} ${produto.nome || ''}`)
        const correspondencias = palavras.filter((palavra) => texto.includes(palavra)).length
        const cobertura = palavras.length ? correspondencias / palavras.length : 0
        const exato = texto.includes(termo)
        return { produto, pontos: exato ? 1000 : cobertura * 100 + correspondencias }
      })
      .filter(({ pontos }) => pontos >= 45)
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, 10)
      .map(({ produto }) => produto)
  }

  function prepararNovoProduto(itemId: string) {
    const nome = window.prompt('Qual será o nome deste novo produto no sistema?')?.trim() || ''
    if (!nome) return
    const item = compra.itens.find((atual) => atual.id === itemId)
    const nomeNormalizado = normalizarBuscaProduto(nome)
    const produtoExistente = produtosDisponiveis.find((produto) =>
      normalizarBuscaProduto(produto.descricao || produto.nome || '') === nomeNormalizado,
    )
    const produtoPreparado = compra.itens.find((atual) =>
      atual.id !== itemId
      && atual.novoProdutoPendente
      && normalizarBuscaProduto(atual.novoProdutoNome || atual.descricao) === nomeNormalizado,
    )
    if (produtoExistente) {
      vincularProduto(itemId, produtoExistente.codigo)
      return
    }
    const ean = String(item?.eanTributavel || item?.eanComercial || '').trim()
    const codigo = produtoPreparado?.produtoCodigo || (ean && !/^SEM\s*GTIN$/i.test(ean)
      ? ean
      : `NOVO-${Date.now()}-${itemId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`)
    setCompra((atual) => ({
      ...atual,
      itens: atual.itens.map((atualItem) => atualItem.id === itemId
        ? {
            ...atualItem,
            produtoCodigo: codigo,
            novoProdutoNome: nome,
            novoProdutoPendente: true,
            correspondencia: 'NAO_VINCULADO',
          }
        : atualItem),
    }))
    if (produtoPreparado) {
      setBuscasProduto((atual) => ({
        ...atual,
        [itemId]: `${produtoPreparado.produtoCodigo} - ${nome}`,
      }))
    }
  }

  function definirDecisaoDesconto(
    decisao: NonNullable<Compra['decisaoDescontoFinanceiro']>,
  ) {
    const originais = compra.itensOriginaisNFe || compra.itens
    const baseProdutos = originais.reduce(
      (soma, item) => soma + numero(item.totalFiscal),
      0,
    )
    setCompra((atual) => ({
      ...atual,
      decisaoDescontoFinanceiro: decisao,
      itens: atual.itens.map((item) => {
        const original = originais.find((base) => base.id === item.id) || item
        const custoIntegral = numero(original.totalFiscal) + numero(original.icmsSt) + numero(original.ipi) + numero(original.difal)
        const descontoRateado = decisao === 'LIQUIDO_COM_DESCONTO' && baseProdutos > 0
          ? numero(atual.descontoFinanceiroNFe) * (numero(original.totalFiscal) / baseProdutos)
          : 0
        const custoFinalItem = Math.max(0, custoIntegral - descontoRateado)
        return {
          ...item,
          custoFinalItem,
          custoUnitarioConvertido: numero(item.quantidadeConvertida) > 0
            ? custoFinalItem / numero(item.quantidadeConvertida)
            : 0,
        }
      }),
    }))
  }

  function compraAtualizadaParaSalvar(): Compra {
    const itensNormalizados = compra.itens.map(normalizarItem)
    const itensIncluidos = itensNormalizados.filter((item) => item.incluidoNoSistema !== false)
    const baseRateio = itensIncluidos.reduce(
      (soma, item) => soma + Math.max(0, numero(item.totalFiscal ?? item.total)),
      0,
    )
    const quantidadeTotalRateio = itensIncluidos.reduce(
      (soma, item) =>
        soma + Math.max(0, numero(item.quantidadeConvertida || item.quantidade)),
      0,
    )
    const ultimoItemId = itensIncluidos.at(-1)?.id
    let freteRateado = 0
    let outrosRateados = 0
    let descontoRateado = 0

    const ratear = (valor: number, item: ItemCompra, acumulado: number) => {
      const total = Math.max(0, Math.round(numero(valor) * 100))
      if (!total || !itensIncluidos.length) return 0
      if (item.id === ultimoItemId) return (total - acumulado) / 100
      const baseItem = Math.max(0, numero(item.totalFiscal ?? item.total))
      const centavos = baseRateio > 0
        ? Math.floor((total * Math.round(baseItem * 100)) / Math.round(baseRateio * 100))
        : Math.floor(total / itensIncluidos.length)
      return centavos / 100
    }

    const ratearFretePorQuantidade = (
      valor: number,
      item: ItemCompra,
      acumulado: number,
    ) => {
      const total = Math.max(0, Math.round(numero(valor) * 100))
      if (!total || !itensIncluidos.length) return 0
      if (item.id === ultimoItemId) return (total - acumulado) / 100
      const quantidadeItem = Math.max(
        0,
        numero(item.quantidadeConvertida || item.quantidade),
      )
      const centavos = quantidadeTotalRateio > 0
        ? Math.floor((total * quantidadeItem) / quantidadeTotalRateio)
        : Math.floor(total / itensIncluidos.length)
      return centavos / 100
    }

    const itensComRateio = itensNormalizados.map((item) => {
      if (item.incluidoNoSistema === false) return item
      const freteItem = ratearFretePorQuantidade(
        compra.frete,
        item,
        Math.round(freteRateado * 100),
      )
      const outrosItem = ratear(compra.outrosCustos, item, Math.round(outrosRateados * 100))
      const descontoItem = ratear(compra.desconto, item, Math.round(descontoRateado * 100))
      freteRateado += freteItem
      outrosRateados += outrosItem
      descontoRateado += descontoItem

      const custoSemRateioAnterior = Math.max(
        0,
        numero(item.custoFinalItem)
          - numero(item.frete)
          - numero(item.outrosCustosRateados)
          + numero(item.descontoRateado),
      )
      const custoFinalItem = Math.max(
        0,
        custoSemRateioAnterior + freteItem + outrosItem - descontoItem,
      )
      const quantidade = numero(item.quantidadeConvertida || item.quantidade)
      return {
        ...item,
        frete: freteItem,
        outrosCustosRateados: outrosItem,
        descontoRateado: descontoItem,
        custoFinalItem,
        custoUnitarioConvertido: quantidade > 0 ? custoFinalItem / quantidade : 0,
      }
    })

    return {
      ...compra,
      status: compra.parcelasPagamento?.length ? 'Faturado' : compra.status,
      subtotal,
      totalFinal,
      atualizadoEm: new Date().toISOString(),
      itens: itensComRateio,
    }
  }

  function cadastrarProdutosPendentes(compraBase: Compra) {
    const codigosPorDescricao = new Map(
      listarProdutosAtivosStorage().map((produto) => [
        normalizarBuscaProduto(produto.descricao || produto.nome || ''),
        produto.codigo,
      ]),
    )
    compraBase.itens.forEach((item) => {
      if (item.incluidoNoSistema === false || !item.novoProdutoPendente) return
      const descricaoProduto = item.novoProdutoNome || item.descricao
      const descricaoNormalizada = normalizarBuscaProduto(descricaoProduto)
      const codigoJaCriado = codigosPorDescricao.get(descricaoNormalizada)
      if (codigoJaCriado) {
        item.produtoCodigo = codigoJaCriado
        item.novoProdutoPendente = false
        item.novoProdutoNome = ''
        item.correspondencia = 'DESCRICAO'
        return
      }
      const codigoInformado = String(item.produtoCodigo || '').trim()
      const semGtin =
        !codigoInformado
        || /^SEM\s*GTIN$/i.test(codigoInformado)
        || /^NOVO-/i.test(codigoInformado)
      const codigoInterno = gerarProximoCodigoInternoProdutoStorage()
      const codigoBarrasGerado = gerarProximoCodigoBarrasProdutoStorage()
      const codigoProduto = semGtin ? codigoInterno : codigoInformado
      item.produtoCodigo = codigoProduto
      const eanInformado = String(item.eanTributavel || item.eanComercial || '').trim()
      salvarProdutoStorage({
        codigo: codigoProduto,
        codigoInterno,
        codigoBarras:
          !eanInformado || /^SEM\s*GTIN$/i.test(eanInformado)
            ? codigoBarrasGerado
            : eanInformado,
        descricao: descricaoProduto,
        nome: descricaoProduto,
        unidade: item.unidadeControle || 'UN',
        ncm: item.ncm,
        tipoItem: 'Produto',
        tipoFiscal: 'Mercadoria para Revenda',
        movimentarEstoque: true,
      })
      codigosPorDescricao.set(descricaoNormalizada, codigoProduto)
      item.novoProdutoPendente = false
      item.novoProdutoNome = ''
      item.correspondencia = 'DESCRICAO'
    })
  }

  function sincronizarDadosFiscaisProdutos(compraBase: Compra) {
    const produtos = listarProdutosStorage()
    compraBase.itens.forEach((item) => {
      if (item.incluidoNoSistema === false || !item.produtoCodigo || !item.ncm) return
      const produto = produtos.find((atual) => String(atual.codigo) === String(item.produtoCodigo))
      if (!produto || String(produto.ncm || '').replace(/\D/g, '') === String(item.ncm).replace(/\D/g, '')) return
      salvarProdutoStorage({
        ...produto,
        ncm: String(item.ncm).replace(/\D/g, '').slice(0, 8),
        atualizadoEm: new Date().toISOString(),
      })
    })
  }

  function atualizarCustosProdutosAposCorrecao(
    compraAnterior: Compra | undefined,
    compraCorrigida: Compra,
  ) {
    if (!compraAnterior?.movimentouEstoque || !compraCorrigida.movimentouEstoque) return

    const produtos = listarProdutosStorage()
    const agora = new Date().toISOString()

    compraCorrigida.itens.forEach((itemNovo) => {
      if (itemNovo.incluidoNoSistema === false || !itemNovo.produtoCodigo) return
      const itemAntigo = compraAnterior.itens.find((item) =>
        item.id === itemNovo.id || item.produtoCodigo === itemNovo.produtoCodigo)
      if (!itemAntigo) return

      const quantidade = numero(itemNovo.quantidadeConvertida || itemNovo.quantidade)
      const quantidadeAntiga = numero(itemAntigo.quantidadeConvertida || itemAntigo.quantidade)
      if (quantidade <= 0 || quantidadeAntiga <= 0) return
      const custoAntigo = numero(itemAntigo.custoFinalItem) > 0
        ? numero(itemAntigo.custoFinalItem) / quantidadeAntiga
        : numero(itemAntigo.custoUnitarioConvertido)
      const custoNovo = numero(itemNovo.custoFinalItem) > 0
        ? numero(itemNovo.custoFinalItem) / quantidade
        : numero(itemNovo.custoUnitarioConvertido)
      if (Math.abs(custoNovo - custoAntigo) < 0.000001) return

      const produto = produtos.find((item) => String(item.codigo) === String(itemNovo.produtoCodigo))
      if (!produto) return
      const estoqueAtual = numero(
        produto.estoqueAtual ?? produto.estoque ?? produto.quantidadeEstoque ?? produto.saldoEstoque,
      )
      const custoMedioAtual = numero(produto.custoMedioAtual ?? produto.custo)
      const custoMedioCorrigido = estoqueAtual > 0
        ? Math.max(0, custoMedioAtual + ((custoNovo - custoAntigo) * quantidade) / estoqueAtual)
        : Math.max(0, custoNovo)

      salvarProdutoStorage({
        ...produto,
        custoAnteriorUltimaCompra: custoAntigo,
        ultimoCustoCompra: custoNovo,
        custoMedioAtual: custoMedioCorrigido,
        custo: custoMedioCorrigido,
        valorEstoqueAtual: estoqueAtual * custoMedioCorrigido,
        historicoCustos: [{
          id: `correcao-compra-${compraCorrigida.id}-${itemNovo.id}-${Date.now()}`,
          data: hoje(),
          criadoEm: agora,
          origem: 'correcao_compra',
          documentoOrigem: compraCorrigida.numeroNFe || compraCorrigida.numeroCompra,
          numeroCompra: compraCorrigida.numeroCompra,
          numeroNFe: compraCorrigida.numeroNFe,
          fornecedorNome: compraCorrigida.fornecedorNome,
          quantidadeEntrada: 0,
          custoAnterior: custoMedioAtual,
          custoCompra: custoNovo,
          custoNovo: custoMedioCorrigido,
          custoMedioAnterior: custoMedioAtual,
          custoMedioNovo: custoMedioCorrigido,
        }, ...(produto.historicoCustos || [])].slice(0, 100),
        atualizadoEm: agora,
      })
    })
  }

  async function salvarCompra(voltar = false) {
    if (!compra.fornecedorNome.trim()) {
      alert('Informe o fornecedor.')
      return
    }

    if (compra.itens.filter((item) => item.incluidoNoSistema !== false).length === 0) {
      alert('Adicione pelo menos um item ao pedido de compra.')
      return
    }

    const semVinculo = compra.itens.find(
      (item) => item.incluidoNoSistema !== false && !item.produtoCodigo.trim(),
    )
    if (semVinculo) {
      alert(`O item "${semVinculo.descricao}" ainda não está vinculado a um produto. Se precisar criar um novo, informe primeiro o nome desejado.`)
      return
    }

    if (numero(compra.descontoFinanceiroNFe) > 0 && !compra.decisaoDescontoFinanceiro) {
      alert('Escolha se o custo usará o valor fiscal integral ou o valor líquido após o desconto financeiro.')
      return
    }

    const compraAnterior = buscarCompraStorage(compra.id)
    const compraAtualizada = compraAtualizadaParaSalvar()
    const notaDuplicada = encontrarCompraComNotaDuplicada(compraAtualizada)
    if (notaDuplicada) {
      alert(`Esta nota fiscal já está cadastrada na compra ${notaDuplicada.numeroCompra}.`)
      return
    }

    cadastrarProdutosPendentes(compraAtualizada)

    sincronizarDadosFiscaisProdutos(compraAtualizada)

    try {
      await aguardarSincronizacaoCentral('produtos')
      await salvarCompraStorageConfirmado(compraAtualizada)
      atualizarCustosProdutosAposCorrecao(compraAnterior, compraAtualizada)
      await aguardarSincronizacaoCentral('produtos')
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível salvar a compra.')
      return
    }
    sincronizarContasPagarCompra(compraAtualizada)
    setCompra(compraAtualizada)

    if (voltar) {
      navigate('/compras')
      return
    }

    alert('Pedido de compra salvo com sucesso.')
  }

  function definirMovimentacaoEstoque(valor: boolean) {
    if (compra.movimentouEstoque) return

    setCompra((atual) => ({
      ...atual,
      movimentarEstoque: valor,
      importacaoHistorica: !valor,
      atualizadoEm: new Date().toISOString(),
    }))
  }

  function devolverItemCompra(item: ItemCompra) {
    if (!compra.movimentouEstoque) return alert('Confirme primeiro o recebimento da compra para devolver itens.')
    const recebida = numero(item.quantidadeConvertida || item.quantidade)
    const jaDevolvida = numero(item.quantidadeDevolvida)
    const disponivel = Math.max(0, recebida - jaDevolvida)
    if (disponivel <= 0) return alert('Este item já foi devolvido integralmente.')

    const informada = window.prompt(`Quantidade a devolver (máximo ${disponivel}):`, String(disponivel))
    if (informada === null) return
    const quantidade = numero(informada)
    if (quantidade <= 0 || quantidade > disponivel) return alert(`Informe uma quantidade entre 0 e ${disponivel}.`)
    const motivo = window.prompt('Motivo da devolução:')?.trim() || ''
    if (!motivo) return alert('Informe o motivo da devolução.')
    if (!window.confirm(`Confirmar devolução de ${quantidade} unidade(s) de ${item.descricao}?`)) return

    const resultado = movimentarEstoqueStorage({
      produtoCodigo: item.produtoCodigo,
      tipo: 'saida',
      quantidade,
      origem: 'devolucao_compra',
      motivo: `Devolução da NF ${compra.numeroNFe || compra.numeroCompra}: ${motivo}`,
      documentoOrigem: compra.numeroNFe || compra.numeroCompra,
      usuario: 'Synergias',
    })
    if (!resultado.ok) return alert(resultado.mensagem)

    const agora = new Date().toISOString()
    const itens = compra.itens.map((atual) => atual.id === item.id ? {
      ...atual,
      quantidadeDevolvida: numero(atual.quantidadeDevolvida) + quantidade,
      devolucoes: [...(atual.devolucoes || []), {
        id: criarId(), quantidade, motivo, data: agora,
        idMovimentacaoEstoque: resultado.movimentacao?.id,
      }],
    } : atual)
    const todosDevolvidos = itens.filter((atual) => atual.incluidoNoSistema !== false)
      .every((atual) => numero(atual.quantidadeDevolvida) >= numero(atual.quantidadeConvertida || atual.quantidade))
    const atualizada: Compra = { ...compra, itens, status: todosDevolvidos ? 'Devolvido' : 'Devolvido Parcial', atualizadoEm: agora }
    salvarCompraStorage(atualizada)
    setCompra(atualizada)
    alert('Devolução registrada e estoque atualizado.')
  }

  async function confirmarRecebimentoEstoque() {
    if (processandoRecebimento) return
    setProcessandoRecebimento(true)
    try {
    if (!compra.movimentarEstoque) {
      if (!compra.fornecedorNome.trim() || compra.itens.length === 0) {
        alert('Informe o fornecedor e adicione pelo menos um item antes de confirmar o recebimento.')
        return
      }

      const confirmar = window.confirm(
        `Confirmar o recebimento da compra ${
          compra.numeroNFe ? `NF-e ${compra.numeroNFe}` : `#${compra.numeroCompra}`
        } sem movimentar o estoque?\n\nNenhum saldo ou custo de produto será alterado.`,
      )

      if (!confirmar) return

      const compraRecebida: Compra = {
        ...compraAtualizadaParaSalvar(),
        status: 'Recebido',
        movimentarEstoque: false,
        movimentouEstoque: false,
      }

      const duplicada = encontrarCompraComNotaDuplicada(compraRecebida)
      if (duplicada) {
        alert(`Esta nota fiscal já está cadastrada na compra ${duplicada.numeroCompra}.`)
        return
      }
      cadastrarProdutosPendentes(compraRecebida)
      sincronizarDadosFiscaisProdutos(compraRecebida)
      await aguardarSincronizacaoCentral('produtos')
      await salvarCompraStorageConfirmado(compraRecebida)
      sincronizarContasPagarCompra(compraRecebida)
      setCompra(compraRecebida)
      alert('Recebimento confirmado sem movimentar o estoque.')
      return
    }

    if (compra.movimentouEstoque) {
      alert('O estoque desta compra já foi movimentado.')
      return
    }

    if (compra.itens.length === 0) {
      alert('A compra não possui itens.')
      return
    }

    const itensNormalizados = compra.itens.map(normalizarItem)
    const compraParaConfirmar: Compra = { ...compra, itens: itensNormalizados }
    const duplicada = encontrarCompraComNotaDuplicada(compraParaConfirmar)
    if (duplicada) {
      alert(`Esta nota fiscal já está cadastrada na compra ${duplicada.numeroCompra}.`)
      return
    }

    const itemInvalido = itensNormalizados.find(
      (item) =>
        !item.produtoCodigo.trim() ||
        numero(item.quantidadeConvertida) <= 0 ||
        !item.unidadeControle?.trim(),
    )

    if (itemInvalido) {
      alert(
        'Revise os itens antes de confirmar.\n\n' +
          'Todos os produtos precisam ter código do produto Synergias, unidade de controle e quantidade convertida válida.',
      )
      return
    }

    const confirmar = window.confirm(
      `Confirmar recebimento da compra ${
        compra.numeroNFe ? `NF-e ${compra.numeroNFe}` : `#${compra.numeroCompra}`
      } e dar entrada no estoque?\n\n` +
        'Esta operação movimenta o estoque uma única vez.',
    )

    if (!confirmar) return

    cadastrarProdutosPendentes(compraParaConfirmar)
    sincronizarDadosFiscaisProdutos(compraParaConfirmar)
    await aguardarSincronizacaoCentral('produtos')

    const resultadoEntrada = confirmarEntradaCompraComCustoMedioStorage({
      itens: itensNormalizados.filter((item) => item.incluidoNoSistema !== false).map((item) => ({
        produtoCodigo: item.produtoCodigo,
        descricao: item.descricao,
        quantidade: numero(item.quantidadeConvertida),
        custoUnitario: numero(item.custoUnitarioConvertido),
        valorBase:
          numero(item.quantidadeConvertida) *
          numero(item.custoUnitarioConvertido),
        unidadeFiscal: item.unidadeFiscal,
        unidadeControle: item.unidadeControle,
        fatorConversao: numero(item.fatorConversao || 1),
      })),
      desconto: numero(compra.desconto),
      frete: numero(compra.frete),
      outrosCustos: numero(compra.outrosCustos),
      fornecedor: compra.fornecedorNome,
      numeroCompra: compra.numeroCompra,
      numeroNFe: compra.numeroNFe,
      chaveAcessoNFe: compra.chaveAcessoNFe,
      usuario: 'Synergias',
    })

    if (!resultadoEntrada.ok) {
      alert(
        `Não foi possível confirmar a entrada no estoque.\n\n` +
          `${resultadoEntrada.mensagem}\n\n` +
          'O recebimento NÃO foi marcado como concluído.',
      )
      return
    }

    const movimentacoesCriadas = resultadoEntrada.idsMovimentacoes

    const itensComCustoFinal = itensNormalizados.map((item) => {
      const resultado = resultadoEntrada.resultados.find((atual) => atual.produtoCodigo === item.produtoCodigo)
      return resultado
        ? {
            ...item,
            custoFinalItem: resultado.valorEntrada,
            custoUnitarioConvertido: resultado.custoEntrada,
          }
        : item
    })

    const compraRecebida: Compra = {
      ...compra,
      itens: itensComCustoFinal,
      subtotal,
      totalFinal,
      status: 'Recebido',
      movimentarEstoque: true,
      importacaoHistorica: false,
      movimentouEstoque: true,
      estoqueMovimentadoEm: new Date().toISOString(),
      idMovimentacaoEstoque: movimentacoesCriadas.join(','),
      atualizadoEm: new Date().toISOString(),
    }

    await aguardarSincronizacaoCentral('produtos')
    await aguardarSincronizacaoCentral('movimentacoesEstoque')
    await salvarCompraStorageConfirmado(compraRecebida)
    setCompra(compraRecebida)

    const resumoCustos = resultadoEntrada.resultados
      .slice(0, 8)
      .map(
        (item) =>
          `${item.produtoDescricao}: ` +
          `${dinheiro(item.custoMedioAnterior)} → ${dinheiro(item.custoMedioAtual)} ` +
          `(última entrada ${dinheiro(item.custoEntrada)})`,
      )
      .join('\n')

    alert(
      `Recebimento confirmado.\n\n` +
        `Produtos movimentados: ${resultadoEntrada.resultados.length}\n` +
        `Estoque atualizado: SIM\n` +
        `Custo médio recalculado: SIM\n\n` +
        `${resumoCustos}${
          resultadoEntrada.resultados.length > 8
            ? '\n... e outros produtos.'
            : ''
        }\n\n` +
        `Esta compra não poderá movimentar o estoque novamente.`,
    )
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível concluir o recebimento com segurança.')
    } finally {
      setProcessandoRecebimento(false)
    }
  }

  const compraImportada = compra.origem === 'SEFAZ_DFE' || compra.origem === 'XML_NFE'

  return (
    <main className="compras-page">
      <Sidebar />

      <section className="compras-content">
        <div className="compras-pageheader">
          <PageHeader
            category="Compras"
            title={
              modo === 'novo'
                ? 'Novo Pedido de Compra'
                : `Pedido de Compra #${compra.numeroCompra}`
            }
            subtitle="Registre fornecedor, produtos, custos, pagamento e recebimento."
          />
        </div>

        <div className="compras-form-actions-bar">
          <div className="compras-form-actions-left">
            <button
              type="button"
              className="compras-voltar-button"
              onClick={() => navigate('/compras')}
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="compras-action-btn compras-action-list"
              title="Lista de compras"
              aria-label="Lista de compras"
              onClick={() => navigate('/compras')}
            >
              <List size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="compras-action-btn compras-action-search"
              title="Buscar"
              aria-label="Buscar"
              onClick={focarBuscaFormulario}
            >
              <Search size={25} strokeWidth={2.4} />
            </button>

            <div className="compras-busca compras-form-search">
              <Search size={18} />
              <input
                type="text"
                value={buscaFormulario}
                onChange={(event) => setBuscaFormulario(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    const termo = buscaFormulario.trim().toLowerCase()
                    const alvo = Array.from(document.querySelectorAll('input, textarea, select')).find((campo) =>
                      (campo as HTMLInputElement).value?.toLowerCase().includes(termo),
                    ) as HTMLElement | undefined
                    alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    alvo?.focus()
                  }
                }}
                placeholder="Buscar no pedido de compra"
              />
            </div>

            <button
              type="button"
              className="compras-filter-btn compras-form-filter-btn"
              title="Adicionar filtro"
              onClick={abrirFiltrosFormulario}
            >
              <Filter size={20} strokeWidth={2.4} />
              {filtroFormulario !== 'todos' && <span className="compras-filter-count">1</span>}
            </button>
          </div>

          <div className="compras-form-actions-right">
            <button
              type="button"
              className="compras-action-btn compras-action-import erp-action-descriptive erp-action-import-xml"
              title="Importar XML, PDF ou imagem"
              aria-label="Importar XML, PDF ou imagem"
              onClick={importarXmlVisual}
            >
              <FileUp size={22} strokeWidth={2.4} />
              <span>Importar NF-e</span>
            </button>

            <button
              type="button"
              className="compras-action-btn compras-action-refresh"
              title="Atualizar"
              aria-label="Atualizar"
              onClick={atualizarFormulario}
            >
              <RefreshCw size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="compras-action-btn compras-action-save"
              onClick={() => salvarCompra(false)}
              title="Salvar pedido de compra"
              aria-label="Salvar pedido de compra"
            >
              <Save size={25} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {mostrarFiltrosFormulario && (
          <section className="compras-form-filtros-card">
            <label>
              Ir para seção
              <select value={filtroFormulario} onChange={(e) => setFiltroFormulario(e.target.value as typeof filtroFormulario)}>
                <option value="todos">Todas as seções</option>
                <option value="fornecedor">Fornecedor</option>
                <option value="produtos">Produtos</option>
                <option value="pagamento">Pagamento</option>
              </select>
            </label>
            <button type="button" onClick={aplicarFiltroFormulario}>Aplicar filtro</button>
            <button type="button" onClick={() => setFiltroFormulario('todos')}>Limpar filtros</button>
          </section>
        )}

        <section className="compras-form-card">
          <div className="compras-section-title">
            <h2 data-compra-secao="fornecedor">Dados do Pedido</h2>
          </div>

          <div className="compras-grid compras-grid-4">
            <label>
              Número do pedido
              <input value={compra.numeroCompra} disabled />
            </label>

            <label>
              Data de emissão
              <input
                type="date"
                value={compra.dataEmissao}
                onChange={(event) =>
                  atualizarCompra('dataEmissao', event.target.value)
                }
              />
            </label>

            <label>
              Previsão de entrega
              <input
                type="date"
                value={compra.previsaoEntrega}
                onChange={(event) =>
                  atualizarCompra('previsaoEntrega', event.target.value)
                }
              />
            </label>

            <label>
              Status
              <select
                value={compra.status}
                onChange={(event) =>
                  atualizarCompra(
                    'status',
                    event.target.value as StatusCompra,
                  )
                }
              >
                <option>Rascunho</option>
                <option>Pedido Emitido</option>
                <option>Aguardando Entrega</option>
                <option>Recebido Parcial</option>
                <option>Recebido</option>
                <option>Faturado</option>
                <option>Concluído</option>
                <option>Cancelado</option>
              </select>
            </label>
          </div>

          {compraImportada && (
            <div className="compras-dados-fiscais">
              <strong>NF-e importada</strong>
              <span>Número: {compra.numeroNFe || '-'}</span>
              <span>Série: {compra.serieNFe || '-'}</span>
              <label className="compras-chave-acesso">
                Chave:
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={44}
                  placeholder="Digite os 44 números se não for localizada"
                  value={compra.chaveAcessoNFe || ''}
                  onChange={(event) =>
                    atualizarCompra(
                      'chaveAcessoNFe',
                      event.target.value.replace(/\D/g, '').slice(0, 44),
                    )
                  }
                />
              </label>
              <span>Protocolo: {compra.protocoloNFe || '-'}</span>
            </div>
          )}

          {compra.origem === 'XML_NFE' && (
            <div className="compras-xml-resumo">
              <strong>Conferência fiscal antes de salvar</strong>
              <span>Produtos: {dinheiro(numero(compra.valorProdutosNFe))}</span>
              <span>Valor fiscal: {dinheiro(numero(compra.valorFiscalNFe))}</span>
              <span>Desconto financeiro: {dinheiro(numero(compra.descontoFinanceiroNFe))}</span>
              <span>Valor líquido cobrado: {dinheiro(numero(compra.valorLiquidoCobrancaNFe))}</span>
              {numero(compra.descontoFinanceiroNFe) > 0 && (
                <div className="compras-desconto-decisao">
                  <p>Qual valor deve compor o custo do estoque?</p>
                  <button type="button" className={compra.decisaoDescontoFinanceiro === 'FISCAL_INTEGRAL' ? 'ativo' : ''} onClick={() => definirDecisaoDesconto('FISCAL_INTEGRAL')}>
                    Valor fiscal integral
                  </button>
                  <button type="button" className={compra.decisaoDescontoFinanceiro === 'LIQUIDO_COM_DESCONTO' ? 'ativo' : ''} onClick={() => definirDecisaoDesconto('LIQUIDO_COM_DESCONTO')}>
                    Valor líquido com desconto
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="compras-form-card">
          <div className="compras-section-title">
            <h2>Controle de Estoque da Compra</h2>
          </div>

          <div className="compras-estoque-controle">
            <p>Esta compra deve movimentar o estoque?</p>

            <div className="compras-estoque-opcoes">
              <button
                type="button"
                className={
                  !compra.movimentarEstoque
                    ? 'compras-estoque-opcao ativa nao'
                    : 'compras-estoque-opcao nao'
                }
                onClick={() => definirMovimentacaoEstoque(false)}
                disabled={compra.movimentouEstoque}
              >
                NÃO MOVIMENTAR
              </button>

              <button
                type="button"
                className={
                  compra.movimentarEstoque
                    ? 'compras-estoque-opcao ativa sim'
                    : 'compras-estoque-opcao sim'
                }
                onClick={() => definirMovimentacaoEstoque(true)}
                disabled={compra.movimentouEstoque}
              >
                MOVIMENTAR ESTOQUE
              </button>
            </div>

            {!compra.movimentarEstoque && !compra.movimentouEstoque && (
              <div className="compras-estoque-status historico">
                <ArrowDownToLine size={18} />
                <div>
                  <strong>Sem movimentação de estoque</strong>
                  <span>
                    Use esta opção para NF-e antiga, histórico ou compra que não
                    deve alterar o saldo atual.
                  </span>
                </div>
              </div>
            )}

            {compra.movimentarEstoque && !compra.movimentouEstoque && (
              <div className="compras-estoque-status aguardando">
                <PackageCheck size={18} />
                <div>
                  <strong>Entrada de estoque autorizada</strong>
                  <span>
                    Revise a conversão dos itens e confirme o recebimento somente
                    quando a mercadoria chegar.
                  </span>
                </div>
              </div>
            )}

            {compra.movimentouEstoque && (
              <div className="compras-estoque-status concluido">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Recebimento confirmado e estoque movimentado</strong>
                  <span>
                    Esta compra já alterou o estoque e está bloqueada contra nova
                    entrada.
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="compras-form-card">
          <div className="compras-section-title">
            <h2>Fornecedor</h2>
          </div>

          <div className="compras-grid compras-grid-2">
            <label>
              Nome / Razão Social
              <input
                value={compra.fornecedorNome}
                onChange={(event) =>
                  atualizarCompra('fornecedorNome', event.target.value)
                }
                placeholder="Digite o nome do fornecedor"
              />
            </label>

            <label>
              CNPJ / CPF
              <input
                value={compra.fornecedorDocumento}
                onChange={(event) =>
                  atualizarCompra('fornecedorDocumento', event.target.value)
                }
              />
            </label>

            <label>
              E-mail
              <input
                type="email"
                value={compra.fornecedorEmail}
                onChange={(event) =>
                  atualizarCompra('fornecedorEmail', event.target.value)
                }
              />
            </label>

            <label>
              Telefone
              <input
                value={compra.fornecedorTelefone}
                onChange={(event) =>
                  atualizarCompra('fornecedorTelefone', event.target.value)
                }
              />
            </label>
          </div>
        </section>

        <section className="compras-form-card">
          <div className="compras-section-title compras-section-title-acoes">
            <div>
              <h2>Itens da Compra</h2>
              <p className="compras-section-subtitle">
                Dados fiscais ficam preservados. A conversão comercial pode ser
                ajustada antes da entrada no estoque.
              </p>
            </div>

            <button
              type="button"
              className="compras-add-item-button"
              onClick={adicionarItem}
              disabled={compra.movimentouEstoque}
            >
              <Plus size={18} />
              Adicionar Item
            </button>
          </div>

          <div className="compras-itens-conversao-lista">
            {compra.itens.length === 0 ? (
              <div className="compras-vazio">Nenhum item adicionado.</div>
            ) : (
              compra.itens.map((itemOriginal, index) => {
                const item = normalizarItem(itemOriginal)

                return (
                  <article className={`compras-item-conversao ${item.incluidoNoSistema === false ? 'descartado' : ''}`} key={item.id}>
                    <div className="compras-item-conversao-topo">
                      <strong>
                        Item {index + 1} — {item.descricao || 'Produto sem descrição'}
                      </strong>

                      {compra.movimentouEstoque && item.incluidoNoSistema !== false && (
                        <button type="button" className="compras-acao devolucao" onClick={() => devolverItemCompra(item)} disabled={numero(item.quantidadeDevolvida) >= numero(item.quantidadeConvertida || item.quantidade)}>
                          DEVOLVER ITEM
                        </button>
                      )}

                      {compra.origem === 'XML_NFE' ? (
                        <div className="compras-item-decisoes">
                          <button type="button" className={item.incluidoNoSistema !== false ? 'incluir ativo' : 'incluir'} onClick={() => definirInclusaoItem(item.id, true)}>
                            {item.incluidoNoSistema !== false ? 'INCLUÍDO NA COMPRA' : 'INCLUIR NA COMPRA'}
                          </button>
                          <button type="button" className={item.incluidoNoSistema === false ? 'descartar ativo' : 'descartar'} onClick={() => definirInclusaoItem(item.id, false)}>
                            {item.incluidoNoSistema === false ? 'ITEM DESCARTADO' : 'DESCARTAR ITEM'}
                          </button>
                        </div>
                      ) : (
                        <button type="button" className="compras-acao excluir" onClick={() => removerItem(item.id)} title="Excluir item" disabled={compra.movimentouEstoque}>
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>

                    {item.incluidoNoSistema === false && (
                      <div className="compras-item-descartado-aviso">Não inserido no sistema — {item.motivoDescarte}</div>
                    )}

                    {numero(item.quantidadeDevolvida) > 0 && (
                      <div className="compras-item-descartado-aviso">Devolvido: {numero(item.quantidadeDevolvida)} de {numero(item.quantidadeConvertida || item.quantidade)}</div>
                    )}

                    <div className="compras-item-identificacao">
                      <label>
                        Código do produto Synergias
                        <input
                          value={item.produtoCodigo}
                          onChange={(event) =>
                            atualizarItem(
                              item.id,
                              'produtoCodigo',
                              event.target.value,
                            )
                          }
                          disabled={compra.movimentouEstoque}
                          placeholder="Código usado no cadastro de Produtos"
                        />
                      </label>

                      <label>
                        Produto / descrição
                        <input
                          value={item.descricao}
                          onChange={(event) =>
                            atualizarItem(
                              item.id,
                              'descricao',
                              event.target.value,
                            )
                          }
                          disabled={compra.movimentouEstoque}
                        />
                      </label>
                    </div>

                    {compra.origem === 'XML_NFE' && item.incluidoNoSistema !== false && (
                      <div className="compras-vinculo-produto">
                        <label className="compras-produto-autocomplete">
                          Buscar produto já cadastrado
                          <input
                            value={buscasProduto[item.id] ?? (item.produtoCodigo && !item.novoProdutoPendente ? item.produtoCodigo : '')}
                            onChange={(event) => {
                              setBuscasProduto((atual) => ({ ...atual, [item.id]: event.target.value }))
                              setIndiceSugestaoProduto((atual) => ({ ...atual, [item.id]: 0 }))
                              setProdutoBuscaAberta(item.id)
                            }}
                            onFocus={() => {
                              setProdutoBuscaAberta(item.id)
                              setIndiceSugestaoProduto((atual) => ({ ...atual, [item.id]: atual[item.id] || 0 }))
                            }}
                            onKeyDown={(event) => {
                              const sugestoes = produtosSugeridos(buscasProduto[item.id] || item.descricao)
                              if (event.key === 'Escape') {
                                setProdutoBuscaAberta(null)
                                return
                              }
                              if (!sugestoes.length) return
                              const indiceAtual = indiceSugestaoProduto[item.id] || 0
                              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                event.preventDefault()
                                const direcao = event.key === 'ArrowDown' ? 1 : -1
                                const proximo = (indiceAtual + direcao + sugestoes.length) % sugestoes.length
                                setIndiceSugestaoProduto((atual) => ({ ...atual, [item.id]: proximo }))
                              }
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                const selecionado = sugestoes[Math.min(indiceAtual, sugestoes.length - 1)]
                                if (selecionado) vincularProduto(item.id, selecionado.codigo)
                              }
                            }}
                            onBlur={() => window.setTimeout(() => setProdutoBuscaAberta(null), 150)}
                            disabled={compra.movimentouEstoque}
                            placeholder="Digite o código, código de barras ou nome"
                          />
                          {produtoBuscaAberta === item.id && produtosSugeridos(buscasProduto[item.id] || item.descricao).length > 0 && (
                            <div className="compras-produto-sugestoes">
                              {produtosSugeridos(buscasProduto[item.id] || item.descricao).map((produto, indice) => (
                                <button key={produto.codigo} type="button" className={indice === (indiceSugestaoProduto[item.id] || 0) ? 'selecionado' : ''} onMouseEnter={() => setIndiceSugestaoProduto((atual) => ({ ...atual, [item.id]: indice }))} onMouseDown={(event) => event.preventDefault()} onClick={() => vincularProduto(item.id, produto.codigo)}>
                                  <strong>{produto.descricao}</strong>
                                  <span>Código: {produto.codigo} · EAN: {produto.codigoBarras || 'não informado'} · Estoque: {numero(produto.estoqueAtual)}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </label>
                        <span>ou</span>
                        <button type="button" onClick={() => prepararNovoProduto(item.id)} disabled={compra.movimentouEstoque}>
                          Criar novo produto
                        </button>
                        {item.novoProdutoPendente && (
                          <strong>Novo produto preparado: {item.novoProdutoNome}</strong>
                        )}
                      </div>
                    )}

                    <div className="compras-conversao-duas-colunas">
                      <div className="compras-bloco-fiscal">
                        <h3>Dados originais da NF-e</h3>

                        <div className="compras-grid compras-grid-4">
                          <label>
                            Unidade NF-e
                            <input value={item.unidadeFiscal || '-'} disabled />
                          </label>

                          <label>
                            Quantidade NF-e
                            <input
                              value={numero(item.quantidadeFiscal)}
                              disabled
                            />
                          </label>

                          <label>
                            Custo unitário NF-e
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={numero(item.custoUnitarioFiscal)}
                              onChange={(event) =>
                                atualizarItem(
                                  item.id,
                                  'custoUnitarioFiscal',
                                  Number(event.target.value),
                                )
                              }
                            />
                          </label>

                          <label>
                            Valor fiscal
                            <input
                              value={dinheiro(numero(item.totalFiscal))}
                              disabled
                            />
                          </label>
                        </div>
                      </div>

                      <div className="compras-bloco-conversao">
                        <h3>Conversão Synergias</h3>

                        <div className="compras-grid compras-grid-4">
                          <label>
                            Unidade de controle
                            <input
                              value={item.unidadeControle || ''}
                              onChange={(event) =>
                                atualizarItem(
                                  item.id,
                                  'unidadeControle',
                                  event.target.value.toUpperCase(),
                                )
                              }
                              disabled={compra.movimentouEstoque}
                              placeholder="UN"
                            />
                          </label>

                          <label>
                            Fator de conversão
                            <input
                              type="number"
                              min="1"
                              step="0.0001"
                              value={numero(item.fatorConversao || 1)}
                              onChange={(event) =>
                                atualizarItem(
                                  item.id,
                                  'fatorConversao',
                                  Number(event.target.value),
                                )
                              }
                              disabled={compra.movimentouEstoque}
                            />
                          </label>

                          <label>
                            Quant. convertida
                            <input
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              value={numero(item.quantidadeConvertida)}
                              onChange={(event) =>
                                atualizarQuantidadeConvertida(
                                  item.id,
                                  Number(event.target.value),
                                )
                              }
                              disabled={compra.movimentouEstoque}
                            />
                          </label>

                          <label>
                            Custo por unidade
                            <input
                              value={dinheiro(
                                numero(item.custoUnitarioConvertido),
                              )}
                              disabled
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {(item.ncm || item.cfop || item.gtin) && (
                      <div className="compras-item-fiscal-extra">
                        <span>NCM: {item.ncm || '-'}</span>
                        <span>CFOP: {item.cfop || '-'}</span>
                        <span>Cód. fornecedor: {item.codigoFornecedor || '-'}</span>
                        <span>EAN comercial: {item.eanComercial || '-'}</span>
                        <span>EAN tributável: {item.eanTributavel || '-'}</span>
                        <span>ST: {dinheiro(numero(item.icmsSt))}</span>
                        <span>IPI: {dinheiro(numero(item.ipi))}</span>
                        <span>Custo final: {dinheiro(numero(item.custoFinalItem))}</span>
                        <span>Situação: {item.correspondencia === 'NAO_VINCULADO' ? 'Produto não vinculado' : `Vinculado por ${item.correspondencia}`}</span>
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </div>
        </section>

        <section className="compras-form-card">
          <div className="compras-section-title">
            <h2>Totais</h2>
          </div>

          <div className="compras-totais-layout">
            <div className="compras-grid compras-grid-3">
              <label>
                Desconto
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={compra.desconto}
                  onChange={(event) =>
                    atualizarCompra('desconto', Number(event.target.value))
                  }
                />
              </label>

              <label>
                Frete
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={compra.frete}
                  onChange={(event) =>
                    atualizarCompra('frete', Number(event.target.value))
                  }
                />
              </label>

              <label>
                Outros custos
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={compra.outrosCustos}
                  onChange={(event) =>
                    atualizarCompra(
                      'outrosCustos',
                      Number(event.target.value),
                    )
                  }
                />
              </label>
            </div>

            <div className="compras-resumo-total">
              <span>Subtotal</span>
              <strong>{dinheiro(subtotal)}</strong>

              <span>Valor final</span>
              <strong className="compras-total-final">
                {dinheiro(totalFinal)}
              </strong>
            </div>
          </div>
        </section>

        <section className="compras-form-card">
          <div className="compras-section-title">
            <h2 data-compra-secao="pagamento">Pagamento</h2>
          </div>

          <div className="compras-grid compras-grid-2">
            <label>
              Forma de pagamento
              <select
                value={compra.formaPagamento}
                onChange={(event) =>
                  atualizarCompra('formaPagamento', event.target.value)
                }
              >
                <option value="">Selecione</option>
                <option>BOLETO</option>
                <option>DUPLICATA MERCANTIL</option>
                <option>PIX</option>
                <option>TRANSFERÊNCIA</option>
                <option>DINHEIRO</option>
                <option>CARTÃO</option>
              </select>
            </label>

            <label>
              Condição de pagamento
              <input
                value={compra.condicaoPagamento}
                onChange={(event) =>
                  atualizarCompra('condicaoPagamento', event.target.value)
                }
                placeholder="Ex.: 30 dias, 30/60 dias"
              />
            </label>
          </div>

          <label className="compras-observacoes-label">
            Observações
            <textarea
              value={compra.observacoes}
              onChange={(event) =>
                atualizarCompra('observacoes', event.target.value)
              }
              placeholder="Informações adicionais sobre o pedido de compra"
            />
          </label>
        </section>

        <div className="compras-form-footer">
          <button
            type="button"
            className="compras-salvar-secundario"
            onClick={() => salvarCompra(false)}
          >
            <Save size={19} />
            Salvar
          </button>
          <button
            type="button"
            className="compras-salvar-button"
            onClick={() => salvarCompra(true)}
          >
            <Save size={19} />
            Salvar e voltar
          </button>
        </div>

        {!compra.movimentouEstoque && (
          <section className="compras-confirmar-recebimento-card">
            <div>
              <PackageCheck size={26} />
              <div>
                <strong>Mercadoria chegou e foi conferida?</strong>
                <span>
                  {compra.movimentarEstoque
                    ? 'Confirme somente depois de revisar os códigos dos produtos e a conversão CX → UN de cada item.'
                    : 'Confirme o recebimento da compra sem alterar saldos ou custos do estoque.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="compras-confirmar-recebimento-button"
              onClick={confirmarRecebimentoEstoque}
              disabled={processandoRecebimento}
            >
              <PackageCheck size={19} />
              {processandoRecebimento
                ? 'Processando com segurança...'
                : compra.movimentarEstoque
                ? compra.status === 'Recebido'
                  ? 'Dar Entrada no Estoque'
                  : 'Confirmar Recebimento e Dar Entrada no Estoque'
                : 'Confirmar Recebimento sem Movimentar Estoque'}
            </button>
          </section>
        )}

      </section>
    </main>
  )
}

export default CompraForm
