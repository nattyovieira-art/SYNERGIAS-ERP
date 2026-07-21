import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CloudDownload,
  Filter,
  RefreshCw,
  List,
  PencilLine,
  PackagePlus,
  Printer,
  Search,
  Trash2,
  Upload,
  Tags,
  Ruler,
} from 'lucide-react'
import * as XLSX from 'xlsx'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import type { Produto } from '../../types/Produto'
import { movimentarEstoqueStorage } from '../../services/estoqueStorage'

import {
  corrigirPrecosMinimosProdutosStorage,
  repararProdutoCanetaAzul67Storage,
  listarProdutosStorage,
  salvarProdutosStorage,
} from '../../services/produtosStorage'

import { ERP_STORAGE_UPDATED_EVENT, hidratarColecaoCentral, sincronizarColecaoCentralAgora } from '../../services/erpApi'

import '../../styles/clientes.css'
import '../../styles/produtos.css'

type FiltroEstoque =
  | 'TODOS'
  | 'COM_ESTOQUE'
  | 'SEM_ESTOQUE'
  | 'ESTOQUE_BAIXO'
  | 'ABAIXO_MINIMO'

type FiltroStatus = 'TODOS' | 'Ativo' | 'Inativo'

type FiltrosProdutos = {
  status: FiltroStatus
  estoque: FiltroEstoque
  categoria: string
  subcategoria: string
  marca: string
  tipoItem: string
  unidade: string
  semNcm: boolean
  semPrecoVenda: boolean
  semCategoria: boolean
  semSubcategoria: boolean
  semMarca: boolean
  movimentarEstoque: 'TODOS' | 'SIM' | 'NAO'
}

const filtrosIniciais: FiltrosProdutos = {
  status: 'TODOS',
  estoque: 'TODOS',
  categoria: '',
  subcategoria: '',
  marca: '',
  tipoItem: '',
  unidade: '',
  semNcm: false,
  semPrecoVenda: false,
  semCategoria: false,
  semSubcategoria: false,
  semMarca: false,
  movimentarEstoque: 'TODOS',
}

function Produtos() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pesquisa, setPesquisa] = useState('')
  const [mostrarBusca, setMostrarBusca] = useState(true)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [atualizandoProdutos, setAtualizandoProdutos] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosProdutos>(filtrosIniciais)

  const [produtos, setProdutos] = useState<Produto[]>(() =>
    listarProdutosStorage(),
  )

  useEffect(() => {
    hidratarColecaoCentral('produtos', 'synergias_produtos')
      .then(async () => {
        await repararProdutoCanetaAzul67Storage()
        corrigirPrecosMinimosProdutosStorage()
        setProdutos(listarProdutosStorage())
      })
      .catch((erro) => {
        console.error(erro)
        alert(`Falha ao carregar Produtos do servidor: ${erro instanceof Error ? erro.message : String(erro)}`)
      })

    const recarregar = (event?: Event) => {
      const detalhe = (event as CustomEvent | undefined)?.detail
      if (detalhe?.collection && detalhe.collection !== 'produtos') return
      setProdutos(listarProdutosStorage())
    }
    window.addEventListener(ERP_STORAGE_UPDATED_EVENT, recarregar)
    window.addEventListener('focus', recarregar)
    return () => {
      window.removeEventListener(ERP_STORAGE_UPDATED_EVENT, recarregar)
      window.removeEventListener('focus', recarregar)
    }
  }, [])

  const categorias = useMemo(() => {
    return criarListaUnica(produtos.map((produto) => produto.categoria))
  }, [produtos])

  const subcategorias = useMemo(() => {
    return criarListaUnica(produtos.map((produto) => produto.subcategoria))
  }, [produtos])

  const marcas = useMemo(() => {
    return criarListaUnica(produtos.map((produto) => produto.marca))
  }, [produtos])

  const tiposItem = useMemo(() => {
    return criarListaUnica(produtos.map((produto) => produto.tipoItem))
  }, [produtos])

  const unidades = useMemo(() => {
    return criarListaUnica(produtos.map((produto) => produto.unidade))
  }, [produtos])

  const quantidadeFiltrosAtivos = useMemo(() => {
    let total = 0

    if (filtros.status !== 'TODOS') total += 1
    if (filtros.estoque !== 'TODOS') total += 1
    if (filtros.categoria) total += 1
    if (filtros.subcategoria) total += 1
    if (filtros.marca) total += 1
    if (filtros.tipoItem) total += 1
    if (filtros.unidade) total += 1
    if (filtros.semNcm) total += 1
    if (filtros.semPrecoVenda) total += 1
    if (filtros.semCategoria) total += 1
    if (filtros.semSubcategoria) total += 1
    if (filtros.semMarca) total += 1
    if (filtros.movimentarEstoque !== 'TODOS') total += 1

    return total
  }, [filtros])

  const produtosFiltrados = useMemo(() => {
    const termo = normalizarTexto(pesquisa)

    return produtos.filter((produto) => {
      const textoProduto = normalizarTexto(
        Object.values(produto)
          .map((valor) => String(valor || ''))
          .join(' '),
      )

      const passaPesquisa = !termo || textoProduto.includes(termo)

      const passaStatus =
        filtros.status === 'TODOS' || produto.situacao === filtros.status

      const estoqueAtual = Number(produto.estoqueAtual || 0)
      const estoqueMinimo = Number(produto.estoqueMinimo || 0)

      const passaEstoque =
        filtros.estoque === 'TODOS' ||
        (filtros.estoque === 'COM_ESTOQUE' && estoqueAtual > 0) ||
        (filtros.estoque === 'SEM_ESTOQUE' && estoqueAtual <= 0) ||
        (filtros.estoque === 'ESTOQUE_BAIXO' &&
          estoqueMinimo > 0 &&
          estoqueAtual > 0 &&
          estoqueAtual <= estoqueMinimo) ||
        (filtros.estoque === 'ABAIXO_MINIMO' &&
          estoqueMinimo > 0 &&
          estoqueAtual < estoqueMinimo)

      const passaCategoria =
        !filtros.categoria || produto.categoria === filtros.categoria

      const passaSubcategoria =
        !filtros.subcategoria || produto.subcategoria === filtros.subcategoria

      const passaMarca = !filtros.marca || produto.marca === filtros.marca

      const passaTipoItem =
        !filtros.tipoItem || produto.tipoItem === filtros.tipoItem

      const passaUnidade = !filtros.unidade || produto.unidade === filtros.unidade

      const passaSemNcm = !filtros.semNcm || !produto.ncm

      const passaSemPrecoVenda =
        !filtros.semPrecoVenda || Number(produto.vendaVarejo || 0) <= 0

      const passaSemCategoria = !filtros.semCategoria || !String(produto.categoria || '').trim()
      const passaSemSubcategoria = !filtros.semSubcategoria || !String(produto.subcategoria || '').trim()
      const passaSemMarca = !filtros.semMarca || !String(produto.marca || '').trim()

      const passaMovimentarEstoque =
        filtros.movimentarEstoque === 'TODOS' ||
        (filtros.movimentarEstoque === 'SIM' &&
          Boolean(produto.movimentarEstoque)) ||
        (filtros.movimentarEstoque === 'NAO' &&
          !Boolean(produto.movimentarEstoque))

      return (
        passaPesquisa &&
        passaStatus &&
        passaEstoque &&
        passaCategoria &&
        passaSubcategoria &&
        passaMarca &&
        passaTipoItem &&
        passaUnidade &&
        passaSemNcm &&
        passaSemPrecoVenda &&
        passaSemCategoria &&
        passaSemSubcategoria &&
        passaSemMarca &&
        passaMovimentarEstoque
      )
    })
  }, [produtos, pesquisa, filtros])

  const produtosOrdenados = useMemo(() => {
    return [...produtosFiltrados].sort((a: Produto, b: Produto) => {
      const descricaoA = String(a.descricao || a.nome || '').trim()
      const descricaoB = String(b.descricao || b.nome || '').trim()

      return descricaoA.localeCompare(descricaoB, 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
      })
    })
  }, [produtosFiltrados])

  function criarListaUnica(valores: Array<string | undefined>) {
    return Array.from(
      new Set(
        valores
          .map((valor) => String(valor || '').trim())
          .filter((valor) => valor.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  function importarExcel() {
    fileInputRef.current?.click()
  }

  function normalizarTexto(texto: string) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[_.\-\/\\]/g, ' ')
      .trim()
      .toLowerCase()
  }

  function pegarValor(linha: any, nomes: string[], padrao: any = '') {
    const chavesLinha = Object.keys(linha || {})

    for (const nome of nomes) {
      if (
        linha[nome] !== undefined &&
        linha[nome] !== null &&
        linha[nome] !== ''
      ) {
        return linha[nome]
      }
    }

    const nomesNormalizados = nomes.map((nome) => normalizarTexto(nome))

    for (const chave of chavesLinha) {
      const chaveNormalizada = normalizarTexto(chave)

      if (nomesNormalizados.includes(chaveNormalizada)) {
        const valor = linha[chave]

        if (valor !== undefined && valor !== null && valor !== '') {
          return valor
        }
      }
    }

    return padrao
  }

  function limparMoeda(valor: any) {
    if (valor === undefined || valor === null || valor === '') return 0

    if (typeof valor === 'number') return valor

    const textoOriginal = String(valor).trim()

    if (!textoOriginal) return 0

    let texto = textoOriginal
      .replace('R$', '')
      .replace(/\s/g, '')
      .replace(/[^\d,.-]/g, '')

    if (texto.includes(',') && texto.includes('.')) {
      texto = texto.replace(/\./g, '').replace(',', '.')
    } else if (texto.includes(',')) {
      texto = texto.replace(',', '.')
    }

    return Number(texto) || 0
  }

  function limparNumero(valor: any) {
    if (valor === undefined || valor === null || valor === '') return 0

    if (typeof valor === 'number') return valor

    const textoOriginal = String(valor).trim()

    if (!textoOriginal) return 0

    let texto = textoOriginal.replace(/[^\d,.-]/g, '')

    if (texto.includes(',') && texto.includes('.')) {
      texto = texto.replace(/\./g, '').replace(',', '.')
    } else if (texto.includes(',')) {
      texto = texto.replace(',', '.')
    }

    return Number(texto) || 0
  }

  function limparBooleano(valor: any) {
    const texto = normalizarTexto(String(valor || ''))

    return (
      texto === 'sim' ||
      texto === 'true' ||
      texto === '1' ||
      texto === 'ativo' ||
      texto === 'ativa' ||
      texto === 's' ||
      texto === 'yes'
    )
  }

  function normalizarTipoEstoque(valor: any): Produto['tipoEstoque'] {
    const texto = normalizarTexto(String(valor || ''))

    if (texto.includes('grade')) {
      return 'Grade'
    }

    return 'Único'
  }

  function calcularVendaPelaMargem(custo: number, margem: number) {
    return custo + custo * (margem / 100)
  }

  function calcularMargemLucro(custo: number, venda: number) {
    if (!venda || venda <= 0) return 0

    return ((venda - custo) / venda) * 100
  }

  const CAMPOS_IMPORTACAO_INTELIGENTE: Array<keyof Produto> = [
    'codigoBarras',
    'codigoInterno',
    'descricao',
    'tipoItem',
    'unidade',
    'categoria',
    'subcategoria',
    'marca',
    'modelo',
    'tags',
    'situacao',
    'margemAutomaticaVarejo',
    'vendaVarejo',
    'margemAutomaticaAtacado',
    'vendaAtacado',
    'quantidadeMinimaAtacado',
    'movimentarEstoque',
    'tipoEstoque',
    'estoqueMinimo',
    'tipoFiscal',
    'ncm',
    'origem',
    'cest',
    'classificacao',
    'habilitarPdv',
    'permiteFragmentacao',
    'publicarLojaVirtual',
    'imagemUrl',
  ]

  function criarSnapshotProduto(produto: Produto) {
    const snapshot: Record<string, unknown> = {
      id: produto.id || '',
      codigo: produto.codigo || '',
      estoqueAtual: Number(produto.estoqueAtual || 0),
    }

    CAMPOS_IMPORTACAO_INTELIGENTE.forEach((campo) => {
      snapshot[campo] = produto[campo] ?? ''
    })

    return snapshot
  }

  function lerSnapshotProduto(linha: any): Record<string, any> | null {
    const conteudo = pegarValor(
      linha,
      ['__SYNERGIAS_BASE', '__synergias_base'],
      '',
    )

    if (!conteudo) return null

    try {
      const base = JSON.parse(String(conteudo))
      return base && typeof base === 'object' ? base : null
    } catch {
      return null
    }
  }

  function valorComparavel(valor: unknown) {
    if (typeof valor === 'number') return Number(valor.toFixed(8))
    if (typeof valor === 'boolean') return valor
    return String(valor ?? '').trim()
  }

  function valoresIguais(valorA: unknown, valorB: unknown) {
    return valorComparavel(valorA) === valorComparavel(valorB)
  }


  const ROTULOS_CAMPOS_PRODUTO: Partial<Record<keyof Produto, string>> = {
    codigoBarras: 'Código de Barras',
    codigoInterno: 'Código Interno',
    descricao: 'Descrição',
    tipoItem: 'Tipo de Item',
    unidade: 'Unidade',
    categoria: 'Categoria',
    subcategoria: 'Subcategoria',
    marca: 'Marca',
    modelo: 'Modelo',
    tags: 'Tags',
    situacao: 'Situação',
    margemAutomaticaVarejo: 'Margem Varejo %',
    vendaVarejo: 'Venda Varejo',
    margemAutomaticaAtacado: 'Margem Atacado %',
    vendaAtacado: 'Venda Atacado',
    quantidadeMinimaAtacado: 'Qtd. Mínima Atacado',
    movimentarEstoque: 'Movimentar Estoque',
    tipoEstoque: 'Tipo de Estoque',
    estoqueMinimo: 'Estoque Mínimo',
    tipoFiscal: 'Tipo Fiscal',
    ncm: 'NCM',
    origem: 'Origem',
    cest: 'CEST',
    classificacao: 'Classificação',
    habilitarPdv: 'PDV',
    permiteFragmentacao: 'Permite Fragmentação',
    publicarLojaVirtual: 'Loja Virtual',
    imagemUrl: 'URL da Imagem',
  }

  function rotuloCampoProduto(campo: keyof Produto) {
    return ROTULOS_CAMPOS_PRODUTO[campo] || String(campo)
  }

  function descreverProdutoResumo(produto: Produto, linha: number) {
    const codigo = String(produto.codigoBarras || produto.codigo || '').trim()
    const descricao = String(produto.descricao || produto.nome || '').trim()
    const partes = [`Linha ${linha}`]

    if (codigo) partes.push(codigo)
    if (descricao) partes.push(descricao.slice(0, 60))

    return partes.join(' - ')
  }

  function localizarProdutoImportacao(
    lista: Produto[],
    produtoImportado: Produto,
    idTecnico: string,
  ) {
    const codigoBarras = String(produtoImportado.codigoBarras || '').trim()
    const codigo = String(produtoImportado.codigo || '').trim()

    return lista.findIndex((produtoAtual) => {
      return (
        (!!idTecnico && String(produtoAtual.id || '') === idTecnico) ||
        (!!codigoBarras &&
          String(produtoAtual.codigoBarras || '').trim() === codigoBarras) ||
        (!!codigo && String(produtoAtual.codigo || '').trim() === codigo)
      )
    })
  }

  function importarProdutosComComparacao(linhas: any[]) {
    let produtosAtualizados = [...listarProdutosStorage()]
    const ajustesEstoque: Array<{ codigo: string; estoque: number }> = []
    const detalhesAlterados: string[] = []
    const detalhesNovos: string[] = []
    const detalhesEstoque: string[] = []
    const erros: string[] = []
    let alterados = 0
    let semAlteracao = 0
    let novos = 0
    let legado = 0
    let linhasIgnoradas = 0
    let codigosBarrasDuplicados = 0

    linhas.forEach((linha, index) => {
      const numeroLinha = index + 2
      const produtoImportado = montarProdutoDaLinha(linha, index)

      if (!produtoImportado.descricao && !produtoImportado.codigoBarras) {
        linhasIgnoradas += 1
        return
      }

      const idTecnico = String(
        pegarValor(linha, ['__SYNERGIAS_ID', '__synergias_id'], ''),
      ).trim()
      const base = lerSnapshotProduto(linha)
      const indiceAtual = localizarProdutoImportacao(
        produtosAtualizados,
        produtoImportado,
        idTecnico,
      )

      if (indiceAtual < 0) {
        const codigoBarrasNovo = String(produtoImportado.codigoBarras || '').trim()
        const descricaoLinha = descreverProdutoResumo(produtoImportado, numeroLinha)
        const duplicado = produtosAtualizados.some(
          (produtoAtual) =>
            codigoBarrasNovo &&
            String(produtoAtual.codigoBarras || '').trim() === codigoBarrasNovo,
        )

        if (duplicado) {
          codigosBarrasDuplicados += 1
          erros.push(`${descricaoLinha}: código de barras duplicado. Produto não importado.`)
          return
        }

        if (base) {
          erros.push(
            `${descricaoLinha}: produto exportado anteriormente não foi encontrado no cadastro atual. ` +
              'Linha não aplicada para evitar alteração no produto errado.',
          )
          return
        }

        produtosAtualizados.push(produtoImportado)
        novos += 1
        detalhesNovos.push(`${descricaoLinha}: produto novo incluído.`)
        return
      }

      const produtoAtual = produtosAtualizados[indiceAtual]
      const descricaoLinha = descreverProdutoResumo(produtoAtual, numeroLinha)

      if (!base) {
        const estoquePreservado = Number(produtoAtual.estoqueAtual || 0)
        const possuiControleCusto =
          Number(produtoAtual.custoMedioAtual || 0) > 0 ||
          Number(produtoAtual.ultimoCustoCompra || 0) > 0 ||
          Boolean(produtoAtual.historicoCustos?.length)

        produtosAtualizados[indiceAtual] = {
          ...produtoAtual,
          ...produtoImportado,
          id: produtoAtual.id,
          codigo: produtoAtual.codigo,
          estoqueAtual: estoquePreservado,
          custo: possuiControleCusto
            ? produtoAtual.custoMedioAtual ?? produtoAtual.custo ?? 0
            : produtoImportado.custo ?? produtoAtual.custo ?? 0,
          custoMedioAtual: possuiControleCusto
            ? produtoAtual.custoMedioAtual ?? produtoAtual.custo ?? 0
            : produtoImportado.custo ?? produtoAtual.custo ?? 0,
          ultimoCustoCompra: produtoAtual.ultimoCustoCompra,
          custoAnteriorUltimaCompra: produtoAtual.custoAnteriorUltimaCompra,
          variacaoUltimoCustoPercentual: produtoAtual.variacaoUltimoCustoPercentual,
          valorEstoqueAtual: produtoAtual.valorEstoqueAtual,
          historicoCustos: produtoAtual.historicoCustos,
          criadoEm: produtoAtual.criadoEm,
          atualizadoEm: new Date().toISOString(),
        }
        legado += 1
        detalhesAlterados.push(
          `${descricaoLinha}: planilha sem controle técnico; cadastro atualizado com estoque protegido.`,
        )
        return
      }

      let produtoComparado: Produto = { ...produtoAtual }
      let mudou = false
      const camposAlterados: string[] = []

      CAMPOS_IMPORTACAO_INTELIGENTE.forEach((campo) => {
        const valorPlanilha = produtoImportado[campo]
        const valorExportado = base[campo]

        if (!valoresIguais(valorPlanilha, valorExportado)) {
          if (campo === 'codigoBarras') {
            const novoCodigoBarras = String(valorPlanilha || '').replace(/\D/g, '')
            const duplicado = produtosAtualizados.some((item, indice) => {
              return (
                indice !== indiceAtual &&
                !!novoCodigoBarras &&
                String(item.codigoBarras || '').replace(/\D/g, '') === novoCodigoBarras
              )
            })

            if (duplicado) {
              codigosBarrasDuplicados += 1
              erros.push(
                `${descricaoLinha}: novo Código de Barras ${novoCodigoBarras} já existe. Campo ignorado.`,
              )
              return
            }

            ;(produtoComparado as any)[campo] = novoCodigoBarras
          } else {
            ;(produtoComparado as any)[campo] = valorPlanilha
          }
          camposAlterados.push(rotuloCampoProduto(campo))
          mudou = true
        }
      })

      const estoquePlanilha = Number(produtoImportado.estoqueAtual || 0)
      const estoqueExportado = Number(base.estoqueAtual || 0)

      if (!valoresIguais(estoquePlanilha, estoqueExportado)) {
        ajustesEstoque.push({
          codigo: String(produtoAtual.codigo || produtoAtual.codigoBarras || ''),
          estoque: estoquePlanilha,
        })
        const estoqueAtual = Number(produtoAtual.estoqueAtual || 0)
        const diferenca = estoquePlanilha - estoqueAtual
        const sinal = diferenca > 0 ? '+' : ''
        camposAlterados.push('Estoque Atual')
        detalhesEstoque.push(
          `${descricaoLinha}: estoque ${estoqueAtual} → ${estoquePlanilha} (${sinal}${diferenca}).`,
        )
        mudou = true
      }

      if (mudou) {
        produtoComparado = {
          ...produtoComparado,
          id: produtoAtual.id,
          codigo: produtoAtual.codigo,
          criadoEm: produtoAtual.criadoEm,
          atualizadoEm: new Date().toISOString(),
        }
        produtosAtualizados[indiceAtual] = produtoComparado
        alterados += 1
        detalhesAlterados.push(
          `${descricaoLinha}: ${Array.from(new Set(camposAlterados)).join(', ')}.`,
        )
      } else {
        semAlteracao += 1
      }
    })

    salvarProdutosStorage(produtosAtualizados)

    ajustesEstoque.forEach((ajuste) => {
      movimentarEstoqueStorage({
        produtoCodigo: ajuste.codigo,
        tipo: 'ajuste',
        quantidade: ajuste.estoque,
        motivo: 'AJUSTE DE INVENTÁRIO VIA PLANILHA',
        observacao:
          'Alteração de estoque detectada na reimportação inteligente da planilha de produtos.',
        origem: 'inventario',
        usuario: 'Synergias',
      })
    })

    const produtosFinais = listarProdutosStorage()
    setProdutos(produtosFinais)

    return {
      total: linhas.length,
      processados: linhas.length - linhasIgnoradas,
      alterados,
      semAlteracao,
      novos,
      legado,
      ajustesEstoque: ajustesEstoque.length,
      codigosBarrasDuplicados,
      erros: erros.length,
      linhasIgnoradas,
      totalSalvo: produtosFinais.length,
      detalhesAlterados,
      detalhesNovos,
      detalhesEstoque,
      detalhesErros: erros,
    }
  }

  function gerarCodigoProduto(linha: any, index: number) {
    const codigoPlanilha = pegarValor(
      linha,
      [
        'Código',
        'Codigo',
        'codigo',
        'Código Sistema',
        'Codigo Sistema',
        'Cód.',
        'Cod.',
        'Cod',
        'ID',
        'id',
        'SKU',
        'sku',
      ],
      '',
    )

    if (
      codigoPlanilha !== undefined &&
      codigoPlanilha !== null &&
      codigoPlanilha !== ''
    ) {
      return String(codigoPlanilha).trim().padStart(4, '0')
    }

    const codigoBarras = pegarValor(
      linha,
      [
        'Código de Barras',
        'Codigo de Barras',
        'codigoBarras',
        'Código Barras',
        'Codigo Barras',
        'Cod Barras',
        'EAN',
        'ean',
        'GTIN',
        'gtin',
      ],
      '',
    )

    if (codigoBarras) {
      return String(codigoBarras).trim()
    }

    return String(Date.now() + index)
  }

  function montarProdutoDaLinha(linha: any, index: number): Produto {
    const custo = limparMoeda(
      pegarValor(
        linha,
        [
          'Custo',
          'custo',
          'Preço de Custo',
          'Preco de Custo',
          'Preço Custo',
          'Preco Custo',
          'Valor Custo',
          'Valor de Custo',
          'Custo Unitário',
          'Custo Unitario',
          'Custo Produto',
          'Preço Compra',
          'Preco Compra',
          'Preço de Compra',
          'Preco de Compra',
          'Valor Compra',
          'Valor de Compra',
          'Último Custo',
          'Ultimo Custo',
        ],
        0,
      ),
    )

    const margemAutomaticaVarejo = Number(
      pegarValor(
        linha,
        [
          'Margem Automática Varejo %',
          'Margem Automatica Varejo %',
          'margemAutomaticaVarejo',
          'Margem Varejo',
          'Margem Varejo %',
          'Markup Varejo',
          'Markup Varejo %',
        ],
        30,
      ),
    )

    const margemAutomaticaAtacado = Number(
      pegarValor(
        linha,
        [
          'Margem Automática Atacado %',
          'Margem Automatica Atacado %',
          'margemAutomaticaAtacado',
          'Margem Atacado',
          'Margem Atacado %',
          'Markup Atacado',
          'Markup Atacado %',
        ],
        28,
      ),
    )

    const vendaVarejoPlanilha = limparMoeda(
      pegarValor(
        linha,
        [
          'Venda Varejo',
          'vendaVarejo',
          'Preço Venda Varejo',
          'Preco Venda Varejo',
          'Preço de Venda Varejo',
          'Preco de Venda Varejo',
          'Valor Venda Varejo',
          'Preço de Venda',
          'Preco de Venda',
          'Preço Venda',
          'Preco Venda',
          'Venda',
          'Preço',
          'Preco',
          'Valor de Venda',
          'Valor Venda',
          'Preço Unitário',
          'Preco Unitario',
        ],
        0,
      ),
    )

    const vendaAtacadoPlanilha = limparMoeda(
      pegarValor(
        linha,
        [
          'Venda Atacado',
          'vendaAtacado',
          'Preço Venda Atacado',
          'Preco Venda Atacado',
          'Preço de Venda Atacado',
          'Preco de Venda Atacado',
          'Valor Venda Atacado',
          'Preço Atacado',
          'Preco Atacado',
          'Valor Atacado',
        ],
        0,
      ),
    )

    const vendaVarejo =
      vendaVarejoPlanilha > 0
        ? vendaVarejoPlanilha
        : calcularVendaPelaMargem(custo, margemAutomaticaVarejo)

    const vendaAtacado =
      vendaAtacadoPlanilha > 0
        ? vendaAtacadoPlanilha
        : calcularVendaPelaMargem(custo, margemAutomaticaAtacado)

    const produto: Produto = {
      codigo: gerarCodigoProduto(linha, index),

      codigoBarras:
        String(
          pegarValor(
            linha,
            [
              'Código de Barras',
              'Codigo de Barras',
              'codigoBarras',
              'Código Barras',
              'Codigo Barras',
              'Cod Barras',
              'EAN',
              'ean',
              'GTIN',
              'gtin',
              'Cód. Barras',
              'Cod. Barras',
            ],
            '',
          ),
        ) || '',

      codigoInterno:
        String(
          pegarValor(
            linha,
            [
              'Código Interno',
              'Codigo Interno',
              'codigoInterno',
              'Cod Interno',
              'Cód Interno',
              'Referência',
              'Referencia',
              'SKU',
              'sku',
            ],
            '',
          ),
        ) || '',

      descricao:
        String(
          pegarValor(
            linha,
            [
              'Descrição',
              'Descricao',
              'descricao',
              'Produto',
              'Nome',
              'Nome do Produto',
              'Descrição do Produto',
              'Descricao do Produto',
              'Item',
              'Mercadoria',
            ],
            '',
          ),
        ) || '',

      tipoItem:
        String(
          pegarValor(
            linha,
            [
              'Tipo de Item',
              'tipoItem',
              'Tipo Item',
              'Tipo do Item',
              'Tipo Produto',
              'Tipo',
            ],
            'Produto',
          ),
        ) || 'Produto',

      unidade:
        String(
          pegarValor(
            linha,
            [
              'Unidade',
              'unidade',
              'UN',
              'Un',
              'Unid',
              'Unidade Medida',
              'Unidade de Medida',
              'Medida',
            ],
            'Unidade',
          ),
        ) || 'Unidade',

      categoria:
        String(
          pegarValor(
            linha,
            [
              'Categoria',
              'categoria',
              'Grupo',
              'grupo',
              'Departamento',
              'departamento',
              'Família',
              'Familia',
              'Linha',
              'Classe',
              'Categoria Produto',
              'Categoria do Produto',
            ],
            '',
          ),
        ) || '',

      subcategoria:
        String(
          pegarValor(
            linha,
            [
              'Subcategoria',
              'Sub Categoria',
              'subcategoria',
              'Subcategoria Produto',
              'Subcategoria do Produto',
              'Sub Grupo',
              'Subgrupo',
              'subgrupo',
              'Subgrupo Produto',
              'Subgrupo do Produto',
              'Sub Família',
              'Sub Familia',
              'Subfamilia',
              'Linha Secundária',
              'Linha Secundaria',
              'Segmento',
              'Subclasse',
            ],
            '',
          ),
        ) || '',

      marca:
        String(
          pegarValor(
            linha,
            [
              'Marca',
              'marca',
              'Fabricante',
              'fabricante',
              'Fornecedor',
              'fornecedor',
              'Laboratório',
              'Laboratorio',
            ],
            '',
          ),
        ) || '',

      modelo:
        String(
          pegarValor(
            linha,
            [
              'Modelo',
              'modelo',
              'Modelo Produto',
              'Referência Modelo',
              'Referencia Modelo',
            ],
            '',
          ),
        ) || '',

      tags:
        String(
          pegarValor(
            linha,
            [
              'Tags',
              'tags',
              'Palavras-chave',
              'Palavras Chave',
              'Marcadores',
            ],
            '',
          ),
        ) || '',

      situacao: limparBooleano(
        pegarValor(
          linha,
          [
            'Ativo',
            'Ativa',
            'Situação',
            'Situacao',
            'situacao',
            'Status',
            'status',
          ],
          'Ativo',
        ),
      )
        ? 'Ativo'
        : 'Inativo',

      custo,

      margemAutomaticaVarejo,
      vendaVarejo,
      margemLucroVarejo: calcularMargemLucro(custo, vendaVarejo),

      margemAutomaticaAtacado,
      vendaAtacado,
      margemLucroAtacado: calcularMargemLucro(custo, vendaAtacado),

      quantidadeMinimaAtacado: limparNumero(
        pegarValor(
          linha,
          [
            'Quantidade Mínima Atacado',
            'Quantidade Minima Atacado',
            'quantidadeMinimaAtacado',
            'Qtd Mínima Atacado',
            'Qtd Minima Atacado',
            'Qtd Atacado',
            'Mínimo Atacado',
            'Minimo Atacado',
          ],
          0,
        ),
      ),

      movimentarEstoque: limparBooleano(
        pegarValor(
          linha,
          [
            'Movimentar Estoque',
            'movimentarEstoque',
            'Controlar Estoque',
            'Controle Estoque',
            'Estoque Controlado',
          ],
          'Sim',
        ),
      ),

      tipoEstoque: normalizarTipoEstoque(
        pegarValor(
          linha,
          ['Tipo de Estoque', 'tipoEstoque', 'Tipo Estoque', 'Estoque Tipo'],
          'Único',
        ),
      ),

      estoqueMinimo: limparNumero(
        pegarValor(
          linha,
          [
            'Estoque Mínimo',
            'Estoque Minimo',
            'estoqueMinimo',
            'Mínimo',
            'Minimo',
            'Qtd Mínima',
            'Qtd Minima',
            'Quantidade Mínima',
            'Quantidade Minima',
          ],
          0,
        ),
      ),

      estoqueAtual: limparNumero(
        pegarValor(
          linha,
          [
            'Estoque Atual',
            'estoqueAtual',
            'Estoque',
            'Saldo Estoque',
            'Saldo',
            'Quantidade',
            'Qtd',
            'Qtde',
            'Qtd Estoque',
            'Quantidade Estoque',
            'Disponível',
            'Disponivel',
          ],
          0,
        ),
      ),

      tipoFiscal:
        String(
          pegarValor(
            linha,
            [
              'Tipo Fiscal',
              'tipoFiscal',
              'Tipo Fiscal Produto',
              'Finalidade Fiscal',
            ],
            'Mercadoria para Revenda',
          ),
        ) || 'Mercadoria para Revenda',

      ncm:
        String(
          pegarValor(
            linha,
            ['NCM', 'ncm', 'Código NCM', 'Codigo NCM', 'NCM Produto'],
            '',
          ),
        ) || '',

      origem:
        String(
          pegarValor(
            linha,
            [
              'Origem',
              'origem',
              'Origem Produto',
              'Origem da Mercadoria',
              'Origem Mercadoria',
            ],
            '0 - Nacional',
          ),
        ) || '0 - Nacional',

      cest:
        String(
          pegarValor(linha, ['CEST', 'cest', 'Código CEST', 'Codigo CEST'], ''),
        ) || '',

      classificacao:
        String(
          pegarValor(
            linha,
            [
              'Classificação',
              'Classificacao',
              'classificacao',
              'Classificação Fiscal',
              'Classificacao Fiscal',
              'Classe Fiscal',
            ],
            'Comum',
          ),
        ) || 'Comum',

      habilitarPdv: limparBooleano(
        pegarValor(
          linha,
          [
            'PDV',
            'habilitarPdv',
            'Habilitar PDV',
            'Vender no PDV',
            'Ponto de Venda',
          ],
          'Não',
        ),
      ),

      permiteFragmentacao: limparBooleano(
        pegarValor(
          linha,
          [
            'Permite Fragmentação',
            'Permite Fragmentacao',
            'permiteFragmentacao',
            'Fracionado',
            'Permite Fracionar',
            'Fragmentação',
            'Fragmentacao',
          ],
          'Não',
        ),
      ),

      publicarLojaVirtual: limparBooleano(
        pegarValor(
          linha,
          [
            'Loja Virtual',
            'publicarLojaVirtual',
            'Publicar Loja Virtual',
            'Publicar no Site',
            'Exibir no Portal',
            'Portal Cliente',
            'E-commerce',
            'Ecommerce',
          ],
          'Não',
        ),
      ),

      imagem:
        String(
          pegarValor(linha, ['Imagem', 'imagem', 'Foto', 'foto', 'Imagem Produto'], ''),
        ) || '',

      imagemUrl:
        String(
          pegarValor(
            linha,
            [
              'URL da Imagem',
              'Url da Imagem',
              'imagemUrl',
              'Imagem URL',
              'Link Imagem',
              'URL Imagem',
              'Foto URL',
              'Link Foto',
            ],
            '',
          ),
        ) || '',

      composicao: [],
    }

    return produto
  }

  function atualizarProdutos(produtosAtualizados: Produto[]) {
    salvarProdutosStorage(produtosAtualizados)
    setProdutos(produtosAtualizados)
  }

  function lerArquivoExcel(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]

    if (!arquivo) return

    const leitor = new FileReader()

    leitor.onload = async (e) => {
      try {
        const dados = e.target?.result
        const workbook = XLSX.read(dados, { type: 'array' })
        const planilha = workbook.Sheets[workbook.SheetNames[0]]

        const linhas: any[] = XLSX.utils.sheet_to_json(planilha, {
          defval: '',
        })

        const resultado = importarProdutosComComparacao(linhas)
        const produtosConfirmar = listarProdutosStorage()
        await sincronizarColecaoCentralAgora('produtos', produtosConfirmar)
        setProdutos(produtosConfirmar)

        const detalhesAjustes = [
          ...resultado.detalhesAlterados.slice(0, 12),
          ...resultado.detalhesNovos.slice(0, 5),
        ]
        const detalhesErros = resultado.detalhesErros.slice(0, 8)
        const itensOcultos =
          resultado.detalhesAlterados.length +
          resultado.detalhesNovos.length -
          detalhesAjustes.length
        const errosOcultos = resultado.detalhesErros.length - detalhesErros.length

        alert(
          `Importação concluída.\n\n` +
            `Linhas lidas: ${resultado.total}\n` +
            `Linhas processadas: ${resultado.processados}\n` +
            `Produtos alterados: ${resultado.alterados}\n` +
            `Sem alteração: ${resultado.semAlteracao}\n` +
            `Produtos novos: ${resultado.novos}\n` +
            `Ajustes de estoque registrados: ${resultado.ajustesEstoque}\n` +
            `Erros/avisos: ${resultado.erros}\n` +
            (resultado.linhasIgnoradas > 0
              ? `Linhas vazias ignoradas: ${resultado.linhasIgnoradas}\n`
              : '') +
            (resultado.codigosBarrasDuplicados > 0
              ? `Códigos de barras duplicados ignorados: ${resultado.codigosBarrasDuplicados}\n`
              : '') +
            (resultado.legado > 0
              ? `Planilha antiga com estoque protegido: ${resultado.legado}\n`
              : '') +
            `Total salvo: ${resultado.totalSalvo}.\n` +
            (detalhesAjustes.length > 0
              ? `\nO que foi ajustado:\n- ${detalhesAjustes.join('\n- ')}${
                  itensOcultos > 0
                    ? `\n... e mais ${itensOcultos} ajuste(s).`
                    : ''
                }`
              : '') +
            (detalhesErros.length > 0
              ? `\n\nErros/avisos:\n- ${detalhesErros.join('\n- ')}${
                  errosOcultos > 0
                    ? `\n... e mais ${errosOcultos} erro(s)/aviso(s).`
                    : ''
                }`
              : ''),
        )

        event.target.value = ''
      } catch (error) {
        console.error(error)
        alert(`A importação de produtos não foi confirmada no servidor e não será considerada concluída. ${error instanceof Error ? error.message : String(error)}`)
        event.target.value = ''
      }
    }

    leitor.readAsArrayBuffer(arquivo)
  }

  function exportarExcel() {
    const produtosParaExportar = produtosFiltrados.map((produto) => ({
      Código: produto.codigo,
      'Código de Barras': produto.codigoBarras || '',
      'Código Interno': produto.codigoInterno || '',
      Descrição: produto.descricao || '',
      'Tipo de Item': produto.tipoItem || 'Produto',
      Unidade: produto.unidade || 'Unidade',
      Categoria: produto.categoria || '',
      Subcategoria: produto.subcategoria || '',
      Marca: produto.marca || '',
      Modelo: produto.modelo || '',
      Tags: produto.tags || '',
      Situação: produto.situacao || 'Ativo',

      'Custo Médio Atual':
        produto.custoMedioAtual ?? produto.custo ?? 0,
      'Último Custo de Compra': produto.ultimoCustoCompra || 0,
      'Custo Anterior da Última Compra':
        produto.custoAnteriorUltimaCompra || 0,
      'Variação do Último Custo %':
        produto.variacaoUltimoCustoPercentual || 0,
      'Valor do Estoque Atual':
        produto.valorEstoqueAtual ||
        Number(produto.estoqueAtual || 0) *
          Number(produto.custoMedioAtual ?? produto.custo ?? 0),
      Custo: produto.custoMedioAtual ?? produto.custo ?? 0,

      'Margem Automática Varejo %': produto.margemAutomaticaVarejo ?? 30,
      'Venda Varejo': produto.vendaVarejo || 0,
      'Margem Real Varejo %': produto.margemLucroVarejo || 0,

      'Margem Automática Atacado %': produto.margemAutomaticaAtacado ?? 28,
      'Venda Atacado': produto.vendaAtacado || 0,
      'Margem Real Atacado %': produto.margemLucroAtacado || 0,

      'Quantidade Mínima Atacado': produto.quantidadeMinimaAtacado || 0,

      'Movimentar Estoque': produto.movimentarEstoque ? 'Sim' : 'Não',
      'Tipo de Estoque': produto.tipoEstoque || 'Único',
      'Estoque Mínimo': produto.estoqueMinimo || 0,
      'Estoque Atual': produto.estoqueAtual || 0,

      'Tipo Fiscal': produto.tipoFiscal || '',
      NCM: produto.ncm || '',
      Origem: produto.origem || '',
      CEST: produto.cest || '',
      Classificação: produto.classificacao || '',

      PDV: produto.habilitarPdv ? 'Sim' : 'Não',
      'Permite Fragmentação': produto.permiteFragmentacao ? 'Sim' : 'Não',
      'Loja Virtual': produto.publicarLojaVirtual ? 'Sim' : 'Não',

      'URL da Imagem': produto.imagemUrl || '',

      __SYNERGIAS_ID: produto.id || '',
      __SYNERGIAS_BASE: JSON.stringify(criarSnapshotProduto(produto)),
    }))

    const worksheet = XLSX.utils.json_to_sheet(produtosParaExportar)

    const totalColunas = Object.keys(produtosParaExportar[0] || {}).length
    worksheet['!cols'] = Array.from({ length: totalColunas }, (_, indice) => ({
      hidden: indice >= totalColunas - 2,
    }))
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos')
    XLSX.writeFile(workbook, 'produtos.xlsx')
  }
  async function atualizarListaProdutos() {
    if (atualizandoProdutos) return

    setAtualizandoProdutos(true)

    try {
      await hidratarColecaoCentral('produtos', 'synergias_produtos')
      setProdutos(listarProdutosStorage())
    } catch (erro) {
      console.error('Falha ao atualizar produtos:', erro)
      alert('Não foi possível atualizar os produtos agora.')
    } finally {
      setAtualizandoProdutos(false)
    }
  }

  function limparLista() {
    const confirmar = window.confirm(
      'Tem certeza que deseja excluir todos os produtos da lista?',
    )

    if (!confirmar) return

    const confirmarNovamente = window.confirm(
      'Atenção: essa ação vai apagar todos os produtos salvos. Deseja continuar?',
    )

    if (!confirmarNovamente) return

    atualizarProdutos([])
    alert('Todos os produtos foram excluídos com sucesso.')
  }

  function limparFiltros() {
    setFiltros(filtrosIniciais)
  }

  function editarProduto(produto: Produto) {
    navigate(`/produtos/editar/${produto.codigo}`)
  }

  function excluirProduto(produto: Produto) {
    const nomeProduto = produto.descricao || 'este produto'

    const confirmar = window.confirm(`Deseja excluir ${nomeProduto}?`)

    if (!confirmar) return

    const atualizados = produtos.filter(
      (item) => String(item.codigo) !== String(produto.codigo),
    )

    atualizarProdutos(atualizados)

    alert('Produto excluído com sucesso!')
  }

  return (
    <main className="clientes-page produtos-page">
      <Sidebar />

      <section className="clientes-main produtos-main">
        <PageHeader
          category="Catálogo"
          title="Produtos"
          subtitle="Gerencie produtos, preços, estoque e dados fiscais."
        />

        <div className="clientes-toolbar produtos-toolbar">
          <div className="produtos-toolbar-left">
            <button
              type="button"
              title="Lista de produtos"
              className="produtos-action-btn produtos-action-list"
              onClick={() => navigate('/produtos')}
            >
              <List size={24} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              title="Buscar produtos"
              className="produtos-action-btn produtos-action-search"
              onClick={() => setMostrarBusca((atual) => !atual)}
            >
              <Search size={24} strokeWidth={2.4} />
            </button>

            {mostrarBusca && (
              <div className="search-clientes produtos-search">
                <Search size={18} />

                <input
                  type="text"
                  placeholder="Pesquisar produtos..."
                  value={pesquisa}
                  onChange={(e) => setPesquisa(e.target.value)}
                />
              </div>
            )}

            <button
              type="button"
              title="Adicionar filtro"
              className={`produtos-filter-btn ${
                quantidadeFiltrosAtivos > 0 ? 'ativo' : ''
              }`}
              onClick={() => setMostrarFiltros((atual) => !atual)}
            >
              <Filter size={20} />
              {quantidadeFiltrosAtivos > 0 && (
                <span>{quantidadeFiltrosAtivos}</span>
              )}
            </button>


            <button
              type="button"
              title={atualizandoProdutos ? 'Atualizando produtos' : 'Atualizar produtos'}
              aria-label={atualizandoProdutos ? 'Atualizando produtos' : 'Atualizar produtos'}
              className={`produtos-action-btn produtos-action-refresh ${
                atualizandoProdutos ? 'atualizando' : ''
              }`}
              onClick={atualizarListaProdutos}
              disabled={atualizandoProdutos}
            >
              <RefreshCw size={24} strokeWidth={2.4} />
            </button>
          </div>

          <div className="clientes-actions produtos-actions">
            <button
              type="button"
              title="Imprimir produtos"
              className="produtos-action-btn produtos-action-print"
              onClick={() => window.print()}
            >
              <Printer size={24} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              title="Exportar produtos"
              className="produtos-action-btn produtos-action-export"
              onClick={exportarExcel}
            >
              <CloudDownload size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              title="Importar produtos"
              className="produtos-action-btn produtos-action-import"
              onClick={importarExcel}
            >
              <Upload size={24} strokeWidth={2.4} />
            </button>

            <button type="button" title="Marcas" className="produtos-action-btn produtos-action-import" onClick={() => navigate('/produtos/marcas')}><Tags size={24} strokeWidth={2.4} /></button>

            <button type="button" title="Unidades de medida" className="produtos-action-btn produtos-action-export" onClick={() => navigate('/produtos/unidades-medida')}><Ruler size={24} strokeWidth={2.4} /></button>

            <button
              type="button"
              title="Excluir todos os produtos"
              className="produtos-delete-all-btn"
              onClick={limparLista}
            >
              <Trash2 size={20} strokeWidth={2.4} />
              Excluir tudo
            </button>

            <button
              type="button"
              className="primary-action produtos-add-btn"
              title="Adicionar novo produto"
              aria-label="Adicionar novo produto"
              onClick={() => navigate('/produtos/novo')}
            >
              <PackagePlus size={26} strokeWidth={2.4} />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={lerArquivoExcel}
          />
        </div>

        {mostrarFiltros && (
          <section className="produtos-filtros-card">
            <div className="produtos-filtros-header">
              <div>
                <h2>Filtros de produtos</h2>
                <p>Refine a lista por status, estoque, categoria, fiscal e preço.</p>
              </div>

              <button type="button" onClick={limparFiltros}>
                Limpar filtros
              </button>
            </div>

            <div className="produtos-filtros-grid">
              <label>
                Status
                <select
                  value={filtros.status}
                  onChange={(event) =>
                    setFiltros((atual) => ({
                      ...atual,
                      status: event.target.value as FiltroStatus,
                    }))
                  }
                >
                  <option value="TODOS">Todos</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </label>

              <label>
                Estoque
                <select
                  value={filtros.estoque}
                  onChange={(event) =>
                    setFiltros((atual) => ({
                      ...atual,
                      estoque: event.target.value as FiltroEstoque,
                    }))
                  }
                >
                  <option value="TODOS">Todos</option>
                  <option value="COM_ESTOQUE">Com estoque</option>
                  <option value="SEM_ESTOQUE">Sem estoque</option>
                  <option value="ESTOQUE_BAIXO">Estoque baixo</option>
                  <option value="ABAIXO_MINIMO">Abaixo do mínimo</option>
                </select>
              </label>

              <label>
                Categoria
                <select
                  value={filtros.categoria}
                  onChange={(event) =>
                    setFiltros((atual) => ({
                      ...atual,
                      categoria: event.target.value,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  {categorias.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Subcategoria
                <select
                  value={filtros.subcategoria}
                  onChange={(event) =>
                    setFiltros((atual) => ({
                      ...atual,
                      subcategoria: event.target.value,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  {subcategorias.map((subcategoria) => (
                    <option key={subcategoria} value={subcategoria}>
                      {subcategoria}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Marca
                <select
                  value={filtros.marca}
                  onChange={(event) =>
                    setFiltros((atual) => ({
                      ...atual,
                      marca: event.target.value,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  {marcas.map((marca) => (
                    <option key={marca} value={marca}>
                      {marca}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Tipo de item
                <select
                  value={filtros.tipoItem}
                  onChange={(event) =>
                    setFiltros((atual) => ({
                      ...atual,
                      tipoItem: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos</option>
                  {tiposItem.map((tipoItem) => (
                    <option key={tipoItem} value={tipoItem}>
                      {tipoItem}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Unidade
                <select
                  value={filtros.unidade}
                  onChange={(event) =>
                    setFiltros((atual) => ({
                      ...atual,
                      unidade: event.target.value,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  {unidades.map((unidade) => (
                    <option key={unidade} value={unidade}>
                      {unidade}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Movimenta estoque
                <select
                  value={filtros.movimentarEstoque}
                  onChange={(event) =>
                    setFiltros((atual) => ({
                      ...atual,
                      movimentarEstoque: event.target.value as 'TODOS' | 'SIM' | 'NAO',
                    }))
                  }
                >
                  <option value="TODOS">Todos</option>
                  <option value="SIM">Sim</option>
                  <option value="NAO">Não</option>
                </select>
              </label>
            </div>

            <div className="produtos-filtros-checks">
              <label>
                <input
                  type="checkbox"
                  checked={filtros.semNcm}
                  onChange={(event) =>
                    setFiltros((atual) => ({
                      ...atual,
                      semNcm: event.target.checked,
                    }))
                  }
                />
                Sem NCM
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={filtros.semPrecoVenda}
                  onChange={(event) =>
                    setFiltros((atual) => ({
                      ...atual,
                      semPrecoVenda: event.target.checked,
                    }))
                  }
                />
                Sem preço de venda
              </label>
              <label><input type="checkbox" checked={filtros.semCategoria} onChange={(event) => setFiltros((atual) => ({ ...atual, semCategoria: event.target.checked }))} />Sem categoria</label>
              <label><input type="checkbox" checked={filtros.semSubcategoria} onChange={(event) => setFiltros((atual) => ({ ...atual, semSubcategoria: event.target.checked }))} />Sem subcategoria</label>
              <label><input type="checkbox" checked={filtros.semMarca} onChange={(event) => setFiltros((atual) => ({ ...atual, semMarca: event.target.checked }))} />Sem marca</label>
            </div>
          </section>
        )}

        <section className="produtos-listagem-card">
          <div className="produtos-table-scroll">
            <table className="produtos-listagem-table">
              <thead>
                <tr>
                  <th className="produtos-col-descricao">Descrição</th>
                  <th className="produtos-col-categoria">Categoria</th>
                  <th className="produtos-col-subcategoria">Subcategoria</th>
                  <th className="produtos-col-marca">Marca</th>
                  <th className="produtos-col-estoque">Estoque</th>
                  <th className="produtos-col-valor">Venda Varejo</th>
                  <th className="produtos-col-status">Situação</th>
                  <th className="produtos-col-acoes">Ações</th>
                </tr>
              </thead>

              <tbody>
                {produtosOrdenados.length > 0 ? (
                  produtosOrdenados.map((produto) => (
                    <tr key={produto.id || produto.codigo || produto.codigoBarras}>
                      <td className="produtos-col-descricao">
                        <span
                          className="produto-descricao-linha"
                          title={produto.descricao || 'Produto sem descrição'}
                        >
                          {produto.descricao || 'Produto sem descrição'}
                        </span>
                      </td>

                      <td className="produtos-col-categoria"><span className="produto-texto-truncado" title={produto.categoria || 'Sem categoria'}>{produto.categoria || 'Sem categoria'}</span></td>
                      <td className="produtos-col-subcategoria"><span className="produto-texto-truncado" title={produto.subcategoria || 'Sem subcategoria'}>{produto.subcategoria || 'Sem subcategoria'}</span></td>
                      <td className="produtos-col-marca"><span className="produto-texto-truncado" title={produto.marca || 'Sem marca'}>{produto.marca || 'Sem marca'}</span></td>

                      <td className="produtos-col-estoque">
                        {Number(produto.estoqueAtual || produto.estoque || 0)}
                      </td>

                      <td className="produtos-col-valor">
                        {Number(produto.vendaVarejo || 0).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>

                      <td className="produtos-col-status">
                        <span
                          className={`produto-status-pill ${
                            produto.situacao === 'Inativo' ? 'inativo' : 'ativo'
                          }`}
                        >
                          {produto.situacao || 'Ativo'}
                        </span>
                      </td>

                      <td className="produtos-col-acoes">
                        <div className="produtos-linha-acoes">
                          <button
                            type="button"
                            className="produtos-row-btn editar"
                            title="Editar produto"
                            onClick={() => editarProduto(produto)}
                          >
                            <PencilLine size={19} strokeWidth={2.3} />
                          </button>

                          <button
                            type="button"
                            className="produtos-row-btn excluir"
                            title="Excluir produto"
                            onClick={() => excluirProduto(produto)}
                          >
                            <Trash2 size={19} strokeWidth={2.3} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="produtos-listagem-vazia">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}

export default Produtos
