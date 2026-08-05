import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Copy, List, Plus, Printer, Save, SaveAll, Search } from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import type { Produto, ProdutoComposicao } from '../../types/Produto'

import {
  buscarProdutoStorage,
  gerarProximoCodigoBarrasProdutoStorage,
  gerarProximoCodigoInternoProdutoStorage,
  listarProdutosStorage,
  salvarProdutoStorage,
} from '../../services/produtosStorage'
import { listarComprasStorage } from '../../services/comprasStorage'
import { obterConfiguracaoFiscalStorage } from '../../services/configuracaoFiscalStorage'

import '../../styles/cliente-form.css'
import '../../styles/produtos.css'

type ProdutoFormProps = {
  modo: 'novo' | 'editar'
}

type ProdutoCadastro = Produto & {
  ncmDescricao?: string
}

type ResultadoNcmReceita = {
  codigo?: string
  descricao?: string
  ncm?: string
  nome?: string
}

function criarListaOpcoesProduto(...listas: Array<Array<string | undefined>>) {
  return Array.from(
    new Set(
      listas
        .flat()
        .map((valor) => String(valor || '').trim())
        .filter((valor) => valor.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function criarOpcoesDoCadastro(
  valoresImportados: Array<string | undefined>,
  valorAtual?: string,
) {
  return criarListaOpcoesProduto(valoresImportados, [valorAtual])
}

function gerarProximoCodigoBarrasProduto() {
  return gerarProximoCodigoBarrasProdutoStorage()
}

function gerarProximoCodigoProduto() {
  return gerarProximoCodigoInternoProdutoStorage()
}

function ProdutoForm({ modo }: ProdutoFormProps) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const codigoProdutoDuplicar = searchParams.get('duplicar')
  const duplicando = modo === 'novo' && Boolean(codigoProdutoDuplicar)

  const produtoEncontrado =
    modo === 'editar' && id
      ? buscarProdutoStorage(id)
      : duplicando && codigoProdutoDuplicar
        ? buscarProdutoStorage(codigoProdutoDuplicar)
        : undefined

  const produtosCadastrados = listarProdutosStorage()
  const configuracaoFiscal = obterConfiguracaoFiscalStorage()
  const empresaSimplesNacional = configuracaoFiscal.regimeTributario === 'SIMPLES_NACIONAL'

  const [abaAtiva, setAbaAtiva] = useState('estoque')

  const [categorias, setCategorias] = useState<string[]>(() =>
    criarOpcoesDoCadastro(
      produtosCadastrados.map((produtoAtual) => produtoAtual.categoria),
      produtoEncontrado?.categoria,
    ),
  )

  const [subcategorias, setSubcategorias] = useState<string[]>(() =>
    criarOpcoesDoCadastro(
      produtosCadastrados.map((produtoAtual) => produtoAtual.subcategoria),
      produtoEncontrado?.subcategoria,
    ),
  )

  const [marcas, setMarcas] = useState<string[]>(() =>
    criarOpcoesDoCadastro(
      produtosCadastrados.map((produtoAtual) => produtoAtual.marca),
      produtoEncontrado?.marca,
    ),
  )

  const [unidades, setUnidades] = useState<string[]>(() =>
    criarOpcoesDoCadastro(
      produtosCadastrados.map((produtoAtual) => produtoAtual.unidade),
      produtoEncontrado?.unidade || 'Unidade',
    ),
  )

  const [produto, setProduto] = useState<ProdutoCadastro>(() => {
    const proximoCodigoBarras = gerarProximoCodigoBarrasProduto()
    const proximoCodigoInterno = gerarProximoCodigoProduto()

    return {
    id: duplicando
      ? proximoCodigoBarras
      : produtoEncontrado?.id || proximoCodigoBarras,
    codigo: duplicando
      ? proximoCodigoInterno
      : produtoEncontrado?.codigo || proximoCodigoInterno,

    codigoBarras: duplicando
      ? proximoCodigoBarras
      : produtoEncontrado?.codigoBarras || proximoCodigoBarras,
    codigoInterno: duplicando
      ? proximoCodigoInterno
      : produtoEncontrado?.codigoInterno || produtoEncontrado?.codigo || proximoCodigoInterno,
    descricao: produtoEncontrado?.descricao || '',
    tipoItem: produtoEncontrado?.tipoItem || 'Produto',
    unidade: produtoEncontrado?.unidade || 'Unidade',
    categoria: produtoEncontrado?.categoria || '',
    subcategoria: produtoEncontrado?.subcategoria || '',
    marca: produtoEncontrado?.marca || '',
    modelo: produtoEncontrado?.modelo || '',
    tags: produtoEncontrado?.tags || '',
    situacao: produtoEncontrado?.situacao || 'Ativo',
    imagem: produtoEncontrado?.imagem || '',
    imagemUrl: produtoEncontrado?.imagemUrl || '',

    custo: produtoEncontrado?.custoMedioAtual ?? produtoEncontrado?.custo ?? 0,
    custoMedioAtual:
      produtoEncontrado?.custoMedioAtual ?? produtoEncontrado?.custo ?? 0,
    ultimoCustoCompra:
      produtoEncontrado?.ultimoCustoCompra ?? produtoEncontrado?.custo ?? 0,
    custoAnteriorUltimaCompra:
      produtoEncontrado?.custoAnteriorUltimaCompra ?? 0,
    variacaoUltimoCustoPercentual:
      produtoEncontrado?.variacaoUltimoCustoPercentual ?? 0,
    valorEstoqueAtual: duplicando
      ? 0
      : produtoEncontrado?.valorEstoqueAtual ??
        Number(produtoEncontrado?.estoqueAtual || 0) *
          Number(produtoEncontrado?.custoMedioAtual ?? produtoEncontrado?.custo ?? 0),
    historicoCustos: duplicando ? [] : produtoEncontrado?.historicoCustos || [],

    margemAutomaticaVarejo:
      produtoEncontrado?.margemAutomaticaVarejo ?? 30,
    vendaVarejo: produtoEncontrado?.vendaVarejo || 0,
    margemLucroVarejo: produtoEncontrado?.margemLucroVarejo || 0,

    margemAutomaticaAtacado:
      Math.max(30, produtoEncontrado?.margemAutomaticaAtacado ?? 30),
    vendaAtacado: produtoEncontrado?.vendaAtacado || 0,
    margemLucroAtacado: produtoEncontrado?.margemLucroAtacado || 0,

    quantidadeMinimaAtacado:
      produtoEncontrado?.quantidadeMinimaAtacado || 0,

    movimentarEstoque: produtoEncontrado?.movimentarEstoque ?? true,
    movimentarEstoqueComposicao:
      produtoEncontrado?.movimentarEstoqueComposicao || false,
    tipoEstoque: produtoEncontrado?.tipoEstoque || 'Único',
    estoqueMinimo: produtoEncontrado?.estoqueMinimo || 0,
    estoqueAtual: duplicando ? 0 : produtoEncontrado?.estoqueAtual || 0,

    tipoFiscal: produtoEncontrado?.tipoFiscal || 'Mercadoria para Revenda',
    ncm: produtoEncontrado?.ncm || '',
    ncmDescricao: (produtoEncontrado as ProdutoCadastro | undefined)?.ncmDescricao || '',
    origem: produtoEncontrado?.origem || '0 - Nacional',
    cest: produtoEncontrado?.cest || '',
    classificacao: produtoEncontrado?.classificacao || 'Comum',
    csosn: produtoEncontrado?.csosn || '102',
    cstIcms: produtoEncontrado?.cstIcms || '',
    modalidadeBcIcms: produtoEncontrado?.modalidadeBcIcms || '3 - Valor da operação',
    aliquotaIcms: produtoEncontrado?.aliquotaIcms ?? 0,
    reducaoBcIcms: produtoEncontrado?.reducaoBcIcms ?? 0,
    cstPis: produtoEncontrado?.cstPis || '49',
    aliquotaPis: produtoEncontrado?.aliquotaPis ?? 0,
    cstCofins: produtoEncontrado?.cstCofins || '49',
    aliquotaCofins: produtoEncontrado?.aliquotaCofins ?? 0,
    cfopDentroEstado: produtoEncontrado?.cfopDentroEstado || '5102',
    cfopForaEstado: produtoEncontrado?.cfopForaEstado || '6102',

    habilitarPdv: produtoEncontrado?.habilitarPdv || false,

    composicao: produtoEncontrado?.composicao || [],

    permiteFragmentacao: produtoEncontrado?.permiteFragmentacao || false,
    unidadeFragmentada: produtoEncontrado?.unidadeFragmentada || '',
    quantidadeFragmentada: produtoEncontrado?.quantidadeFragmentada || 0,

    publicarLojaVirtual: produtoEncontrado?.publicarLojaVirtual || false,
    descricaoLojaVirtual: produtoEncontrado?.descricaoLojaVirtual || '',
    }
  })

  const [itemComposicao, setItemComposicao] = useState<ProdutoComposicao>({
    item: '',
    quantidade: 0,
    unidade: '',
    custoUnitario: 0,
    custoTotal: 0,
  })

  const [buscandoNcm, setBuscandoNcm] = useState(false)

  const titulo = duplicando ? 'Novo Produto Duplicado' : modo === 'novo' ? 'Novo Produto' : 'Editar Produto'

  function atualizarProduto(campo: keyof ProdutoCadastro, valor: any) {
    setProduto((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  function calcularVendaPelaMargem(custo: number, margem: number) {
    return custo + custo * (margem / 100)
  }

  function calcularPrecoMinimo(custo: number) {
    if (!Number.isFinite(custo) || custo <= 0) return 0
    return Math.ceil(custo * 1.3 * 100) / 100
  }

  function garantirPrecoMinimo(valorVenda: number, custo: number) {
    return Math.max(Number(valorVenda || 0), calcularPrecoMinimo(custo))
  }

  function calcularMargemLucro(custo: number, venda: number) {
    if (!venda || venda <= 0) return 0
    return ((venda - custo) / venda) * 100
  }

  function alterarCusto(valor: number) {
    const vendaVarejo = garantirPrecoMinimo(
      Number(produto.vendaVarejo || 0),
      valor,
    )

    const vendaAtacado = garantirPrecoMinimo(
      Number(produto.vendaAtacado || 0),
      valor,
    )

    setProduto((atual) => ({
      ...atual,
      custo: valor,
      custoMedioAtual: valor,
      valorEstoqueAtual: Number(atual.estoqueAtual || 0) * valor,
      ultimoCustoCompra:
        Number(atual.ultimoCustoCompra || 0) > 0
          ? atual.ultimoCustoCompra
          : valor,
      vendaVarejo,
      vendaAtacado,
      margemLucroVarejo: calcularMargemLucro(valor, vendaVarejo),
      margemLucroAtacado: calcularMargemLucro(valor, vendaAtacado),
    }))
  }

  function alterarMargemVarejo(valor: number) {
    const margemProtegida = Math.max(30, Number(valor || 0))
    const vendaVarejo = Math.max(
      Number(produto.vendaVarejo || 0),
      calcularVendaPelaMargem(Number(produto.custo || 0), margemProtegida),
      calcularPrecoMinimo(Number(produto.custo || 0)),
    )

    setProduto((atual) => ({
      ...atual,
      margemAutomaticaVarejo: margemProtegida,
      vendaVarejo,
      margemLucroVarejo: calcularMargemLucro(
        Number(produto.custo || 0),
        vendaVarejo
      ),
    }))
  }

  function alterarMargemAtacado(valor: number) {
    const margemProtegida = Math.max(30, Number(valor || 0))
    const vendaAtacado = calcularVendaPelaMargem(
      Number(produto.custo || 0),
      margemProtegida
    )

    setProduto((atual) => ({
      ...atual,
      margemAutomaticaAtacado: margemProtegida,
      vendaAtacado,
      margemLucroAtacado: calcularMargemLucro(
        Number(produto.custo || 0),
        vendaAtacado
      ),
    }))
  }

  function alterarVendaVarejo(valor: number) {
    const custo = Number(produto.custoMedioAtual ?? produto.custo ?? 0)
    const vendaProtegida = garantirPrecoMinimo(valor, custo)

    setProduto((atual) => ({
      ...atual,
      vendaVarejo: vendaProtegida,
      margemLucroVarejo: calcularMargemLucro(custo, vendaProtegida),
    }))
  }

  function alterarVendaAtacado(valor: number) {
    const custo = Number(produto.custoMedioAtual ?? produto.custo ?? 0)
    const vendaProtegida = garantirPrecoMinimo(valor, custo)
    setProduto((atual) => ({
      ...atual,
      vendaAtacado: vendaProtegida,
      margemLucroAtacado: calcularMargemLucro(
        custo,
        vendaProtegida
      ),
    }))
  }

  function dinheiro(valor: number) {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function formatarMoedaInput(valor: number) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  function converterMoedaInput(valor: string) {
    const somenteNumeros = valor.replace(/\D/g, '')

    if (!somenteNumeros) {
      return 0
    }

    return Number(somenteNumeros) / 100
  }

  function obterCustoMedioReferencia() {
    return Number(produto.custoMedioAtual ?? produto.custo ?? 0)
  }

  function obterUltimoCustoReferencia() {
    return Number(produto.ultimoCustoCompra || 0)
  }

  function obterMediaHistoricaCompra() {
    const codigo = String(produto.codigo || '').trim()
    if (!codigo) return { media: 0, quantidade: 0, compras: 0 }

    let quantidade = 0
    let valor = 0
    const compras = new Set<string>()

    listarComprasStorage()
      .filter((compra) => compra.status !== 'Cancelado')
      .forEach((compra) => {
        compra.itens.forEach((item) => {
          if (item.incluidoNoSistema === false || String(item.produtoCodigo || '').trim() !== codigo) return
          const quantidadeItem = Number(item.quantidadeConvertida || item.quantidade || 0)
          const custoUnitario = Number(item.custoUnitarioConvertido || item.custoUnitario || 0)
          if (quantidadeItem <= 0 || custoUnitario < 0) return
          quantidade += quantidadeItem
          valor += quantidadeItem * custoUnitario
          compras.add(compra.id)
        })
      })

    return {
      media: quantidade > 0 ? valor / quantidade : 0,
      quantidade,
      compras: compras.size,
    }
  }

  function calcularMarkup(custo: number, venda: number) {
    if (!custo || custo <= 0) return 0
    return ((venda - custo) / custo) * 100
  }

  function formatarPercentual(valor: number) {
    const numero = Number(valor || 0)

    return `${numero > 0 ? '+' : ''}${numero.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`
  }

  function adicionarOpcao(
    tipo: 'categoria' | 'subcategoria' | 'marca' | 'unidade'
  ) {
    const nome = prompt(`Digite o nome da nova ${tipo}:`)

    if (!nome) return

    const nomeFormatado = nome.trim()

    if (!nomeFormatado) return

    if (tipo === 'categoria') {
      setCategorias((atual) => criarListaOpcoesProduto(atual, [nomeFormatado]))
      atualizarProduto('categoria', nomeFormatado)
    }

    if (tipo === 'subcategoria') {
      setSubcategorias((atual) => criarListaOpcoesProduto(atual, [nomeFormatado]))
      atualizarProduto('subcategoria', nomeFormatado)
    }

    if (tipo === 'marca') {
      setMarcas((atual) => criarListaOpcoesProduto(atual, [nomeFormatado]))
      atualizarProduto('marca', nomeFormatado)
    }

    if (tipo === 'unidade') {
      setUnidades((atual) => criarListaOpcoesProduto(atual, [nomeFormatado]))
      atualizarProduto('unidade', nomeFormatado)
    }
  }

  function limparCodigoNcm(valor?: string) {
    return String(valor || '').replace(/\D/g, '').slice(0, 8)
  }

  function formatarDescricaoNcm(resultado: ResultadoNcmReceita) {
    return String(
      resultado.descricao ||
        resultado.nome ||
        '',
    ).trim()
  }

  async function buscarNcmReceita() {
    const codigoNcm = limparCodigoNcm(produto.ncm)

    if (codigoNcm.length !== 8) {
      alert('Informe um NCM válido com 8 números antes de buscar.')
      return
    }

    try {
      setBuscandoNcm(true)

      const resposta = await fetch(`https://brasilapi.com.br/api/ncm/v1/${codigoNcm}`)

      if (!resposta.ok) {
        throw new Error('NCM não encontrado.')
      }

      const dados = await resposta.json()
      const resultado: ResultadoNcmReceita = Array.isArray(dados) ? dados[0] : dados
      const descricaoNcm = formatarDescricaoNcm(resultado)
      const codigoRetornado = limparCodigoNcm(resultado.codigo || resultado.ncm || codigoNcm)

      if (!descricaoNcm) {
        throw new Error('NCM sem nomenclatura retornada.')
      }

      setProduto((atual) => ({
        ...atual,
        ncm: codigoRetornado || codigoNcm,
        ncmDescricao: descricaoNcm,
      }))

      alert('NCM encontrado e nomenclatura preenchida no cadastro.')
    } catch (error) {
      alert('Não foi possível buscar este NCM. Confira o código e tente novamente.')
    } finally {
      setBuscandoNcm(false)
    }
  }

  function carregarImagemComputador(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]

    if (!arquivo) return

    const leitor = new FileReader()

    leitor.onload = () => {
      const imagemBase64 = String(leitor.result || '')
      atualizarProduto('imagem', imagemBase64)
      atualizarProduto('imagemUrl', '')
    }

    leitor.readAsDataURL(arquivo)
  }

  function usarImagemUrl() {
    if (!produto.imagemUrl) {
      alert('Cole uma URL de imagem primeiro.')
      return
    }

    atualizarProduto('imagem', produto.imagemUrl)
  }

  function adicionarComposicao() {
    if (!itemComposicao.item) {
      alert('Informe o item da composição.')
      return
    }

    const novoItem: ProdutoComposicao = {
      ...itemComposicao,
      custoTotal:
        Number(itemComposicao.quantidade || 0) *
        Number(itemComposicao.custoUnitario || 0),
    }

    atualizarProduto('composicao', [...(produto.composicao || []), novoItem])

    setItemComposicao({
      item: '',
      quantidade: 0,
      unidade: '',
      custoUnitario: 0,
      custoTotal: 0,
    })
  }

  function removerComposicao(index: number) {
    const novaLista = (produto.composicao || []).filter((_, i) => i !== index)
    atualizarProduto('composicao', novaLista)
  }

  function validarCodigoBarrasProduto() {
    const codigoBarras = String(produto.codigoBarras || '').replace(/\D/g, '')

    if (!codigoBarras) {
      alert('Informe o Código de Barras do produto.')
      return false
    }

    const duplicado = listarProdutosStorage().some((produtoAtual) => {
      const mesmoCadastro =
        String(produtoAtual.id || '') === String(produtoEncontrado?.id || '') ||
        String(produtoAtual.codigo || '') === String(produtoEncontrado?.codigo || '')

      return (
        !mesmoCadastro &&
        String(produtoAtual.codigoBarras || '').replace(/\D/g, '') === codigoBarras
      )
    })

    if (duplicado) {
      alert(`O Código de Barras ${codigoBarras} já está cadastrado em outro produto.`)
      return false
    }

    setProduto((atual) => ({ ...atual, codigoBarras }))
    return true
  }

  function salvarProduto() {
    if (!validarCodigoBarrasProduto()) return

    const custoReferencia = Number(produto.custoMedioAtual ?? produto.custo ?? 0)
    const vendaVarejo = garantirPrecoMinimo(
      Number(produto.vendaVarejo || 0),
      custoReferencia,
    )
    const vendaAtacado = garantirPrecoMinimo(
      Number(produto.vendaAtacado || 0),
      custoReferencia,
    )

    salvarProdutoStorage({
      ...produto,
      id: duplicando ? String(produto.codigoBarras || produto.codigo) : produto.id,
      margemAutomaticaVarejo: Math.max(30, Number(produto.margemAutomaticaVarejo || 0)),
      vendaVarejo,
      margemLucroVarejo: calcularMargemLucro(custoReferencia, vendaVarejo),
      margemAutomaticaAtacado: Math.max(30, Number(produto.margemAutomaticaAtacado || 0)),
      vendaAtacado,
      margemLucroAtacado: calcularMargemLucro(custoReferencia, vendaAtacado),
      codigoBarras: String(produto.codigoBarras || '').replace(/\D/g, ''),
    })
    alert('Produto salvo com sucesso!')
  }

  function salvarEFechar() {
    if (!validarCodigoBarrasProduto()) return

    const custoReferencia = Number(produto.custoMedioAtual ?? produto.custo ?? 0)
    const vendaVarejo = garantirPrecoMinimo(
      Number(produto.vendaVarejo || 0),
      custoReferencia,
    )
    const vendaAtacado = garantirPrecoMinimo(
      Number(produto.vendaAtacado || 0),
      custoReferencia,
    )

    salvarProdutoStorage({
      ...produto,
      id: duplicando ? String(produto.codigoBarras || produto.codigo) : produto.id,
      margemAutomaticaVarejo: Math.max(30, Number(produto.margemAutomaticaVarejo || 0)),
      vendaVarejo,
      margemLucroVarejo: calcularMargemLucro(custoReferencia, vendaVarejo),
      margemAutomaticaAtacado: Math.max(30, Number(produto.margemAutomaticaAtacado || 0)),
      vendaAtacado,
      margemLucroAtacado: calcularMargemLucro(custoReferencia, vendaAtacado),
      codigoBarras: String(produto.codigoBarras || '').replace(/\D/g, ''),
    })
    alert('Produto salvo com sucesso!')
    navigate('/produtos')
  }

  return (
    <main className="cliente-form-page produtos-page">
      <Sidebar />

      <section className="cliente-form-main">
        <PageHeader
          category="Catálogo"
          title={titulo}
          subtitle="Cadastro completo de produtos, preços, estoque e fiscal."
        />

        <div
          className="produtos-form-actions"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '18px',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              title="Voltar"
              aria-label="Voltar"
              onClick={() => navigate('/produtos')}
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '16px',
                border: 'none',
                background: '#64748b',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={25} strokeWidth={2.4} />
            </button>

          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>            <button
              type="button"
              title="Lista de produtos"
              aria-label="Lista de produtos"
              onClick={() => navigate('/produtos')}
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '16px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <List size={25} strokeWidth={2.4} />
            </button>
            {modo === 'editar' && produtoEncontrado ? (
              <button
                type="button"
                title="Duplicar produto"
                aria-label="Duplicar produto"
                onClick={() =>
                  navigate(
                    `/produtos/novo?duplicar=${encodeURIComponent(
                      String(produtoEncontrado.id || produtoEncontrado.codigo),
                    )}`,
                  )
                }
                style={{
                  width: '58px',
                  height: '58px',
                  borderRadius: '16px',
                  border: 'none',
                  background: '#0f766e',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Copy size={25} strokeWidth={2.4} />
              </button>
            ) : null}

            <button
              type="button"
              title="Imprimir cadastro do produto"
              aria-label="Imprimir cadastro do produto"
              onClick={() => window.print()}
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '16px',
                border: 'none',
                background: '#7e22ce',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Printer size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              title="Salvar produto"
              aria-label="Salvar produto"
              onClick={salvarProduto}
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '16px',
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Save size={25} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div className="form-card">
          <div
            className="form-grid"
            style={{
              gridTemplateColumns: '280px 1fr 1fr',
              alignItems: 'start',
            }}
          >
            <div
              style={{
                gridRow: 'span 7',
                border: '1px solid #1e3a5f',
                borderRadius: '18px',
                padding: '18px',
                background: '#071426',
              }}
            >
              <label>
                Código de Barras
                <input
                  style={{
                    fontSize: '24px',
                    textAlign: 'center',
                    fontWeight: 700,
                  }}
                  value={produto.codigoBarras || ''}
                  onChange={(e) =>
                    atualizarProduto('codigoBarras', e.target.value)
                  }
                />
              </label>

              <div
                style={{
                  height: '260px',
                  border: '1px solid #24466f',
                  borderRadius: '14px',
                  marginTop: '16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  background: '#ffffff',
                  color: '#94a3b8',
                  textAlign: 'center',
                }}
              >
                {produto.imagem ? (
                  <img
                    src={produto.imagem}
                    alt={produto.descricao || 'Produto'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <span>SEM FOTO</span>
                )}
              </div>

              <div className="produto-status-toggle">
                <button
                  type="button"
                  className={`produto-status-btn ativo ${
                    produto.situacao === 'Ativo' ? 'selecionado' : ''
                  }`}
                  onClick={() => atualizarProduto('situacao', 'Ativo')}
                  aria-pressed={produto.situacao === 'Ativo'}
                  title="Marcar produto como ativo"
                >
                  <span className="produto-status-indicador" aria-hidden="true" />
                  ATIVO
                </button>

                <button
                  type="button"
                  className={`produto-status-btn inativo ${
                    produto.situacao === 'Inativo' ? 'selecionado' : ''
                  }`}
                  onClick={() => atualizarProduto('situacao', 'Inativo')}
                  aria-pressed={produto.situacao === 'Inativo'}
                  title="Marcar produto como inativo"
                >
                  <span className="produto-status-indicador" aria-hidden="true" />
                  INATIVO
                </button>
              </div>

              <label>
                Imagem do computador
                <input
                  type="file"
                  accept="image/*"
                  onChange={carregarImagemComputador}
                />
              </label>

              <label>
                URL da imagem
                <input
                  value={produto.imagemUrl || ''}
                  placeholder="Cole o link da imagem"
                  onChange={(e) =>
                    atualizarProduto('imagemUrl', e.target.value)
                  }
                />
              </label>

              <button
                type="button"
                className="save-secondary-button"
                onClick={usarImagemUrl}
                style={{ width: '100%' }}
              >
                Usar imagem da internet
              </button>
            </div>

            <label className="span-2">
              Descrição
              <input
                value={produto.descricao}
                onChange={(e) => atualizarProduto('descricao', e.target.value)}
              />
            </label>

            <label>
              Tipo de Item
              <select
                value={produto.tipoItem || 'Produto'}
                onChange={(e) =>
                  atualizarProduto('tipoItem', e.target.value)
                }
              >
                <option>Produto</option>
                <option>Serviço</option>
                <option>Matéria-prima</option>
                <option>Composição</option>
                <option>Uso e consumo</option>
              </select>
            </label>

            <div className="form-field">
              <span>Unidade</span>
              <div className="select-plus">
                <select
                  value={produto.unidade || 'Unidade'}
                  onChange={(e) =>
                    atualizarProduto('unidade', e.target.value)
                  }
                >
                  {unidades.map((unidade) => (
                    <option key={unidade}>{unidade}</option>
                  ))}
                </select>

                <button type="button" onClick={() => adicionarOpcao('unidade')}>
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="form-field">
              <span>Categoria</span>
              <div className="select-plus">
                <select
                  value={produto.categoria || ''}
                  onChange={(e) =>
                    atualizarProduto('categoria', e.target.value)
                  }
                >
                  <option value="">Selecione</option>
                  {categorias.map((categoria) => (
                    <option key={categoria}>{categoria}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => adicionarOpcao('categoria')}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="form-field">
              <span>Subcategoria</span>
              <div className="select-plus">
                <select
                  value={produto.subcategoria || ''}
                  onChange={(e) =>
                    atualizarProduto('subcategoria', e.target.value)
                  }
                >
                  <option value="">Selecione</option>
                  {subcategorias.map((subcategoria) => (
                    <option key={subcategoria}>{subcategoria}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => adicionarOpcao('subcategoria')}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="form-field">
              <span>Marca</span>
              <div className="select-plus">
                <select
                  value={produto.marca || ''}
                  onChange={(e) => atualizarProduto('marca', e.target.value)}
                >
                  <option value="">Selecione</option>
                  {marcas.map((marca) => (
                    <option key={marca}>{marca}</option>
                  ))}
                </select>

                <button type="button" onClick={() => adicionarOpcao('marca')}>
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <label>
              Modelo
              <input
                value={produto.modelo || ''}
                onChange={(e) => atualizarProduto('modelo', e.target.value)}
              />
            </label>

            <label className="span-2">
              Tags
              <input
                placeholder="Ex: limpeza, banheiro, condomínio"
                value={produto.tags || ''}
                onChange={(e) => atualizarProduto('tags', e.target.value)}
              />
            </label>
          </div>

          <div className="form-section-title">
            <h2>Preços e custos</h2>
          </div>

          <div
            className="form-grid"
            style={{
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              marginBottom: '18px',
            }}
          >
            <div className="form-field">
              <span>Média histórica de compra</span>
              <strong>{dinheiro(obterMediaHistoricaCompra().media)}</strong>
              <small>
                {obterMediaHistoricaCompra().compras} compra(s) · {obterMediaHistoricaCompra().quantidade.toLocaleString('pt-BR')} unidade(s). Não altera o custo atual.
              </small>
            </div>

            <div className="form-field">
              <span>Custo médio atual</span>
              <strong>{dinheiro(obterCustoMedioReferencia())}</strong>
              <small>Referência principal de custo e margem.</small>
            </div>

            <div className="form-field">
              <span>Último custo de compra</span>
              <strong>{dinheiro(obterUltimoCustoReferencia())}</strong>
              <small>Mostra o custo mais recente de reposição.</small>
            </div>

            <div className="form-field">
              <span>Custo anterior da última compra</span>
              <strong>
                {dinheiro(Number(produto.custoAnteriorUltimaCompra || 0))}
              </strong>
              <small>Referência anterior para comparar a variação.</small>
            </div>

            <div className="form-field">
              <span>Variação do último custo</span>
              <strong
                style={{
                  color:
                    Number(produto.variacaoUltimoCustoPercentual || 0) > 0
                      ? '#dc2626'
                      : Number(produto.variacaoUltimoCustoPercentual || 0) < 0
                        ? '#16a34a'
                        : 'inherit',
                }}
              >
                {formatarPercentual(
                  Number(produto.variacaoUltimoCustoPercentual || 0),
                )}
              </strong>
              <small>
                Positivo indica aumento; negativo indica redução de custo.
              </small>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Custo médio / custo base
              <input
                type="text"
                value={formatarMoedaInput(obterCustoMedioReferencia())}
                onChange={(e) =>
                  alterarCusto(converterMoedaInput(e.target.value))
                }
              />
              <small>
                Compras confirmadas recalculam este valor automaticamente.
              </small>
            </label>

            <label>
              Margem automática varejo %
              <input
                type="number"
                min={30}
                value={Math.max(30, Number(produto.margemAutomaticaVarejo || 0))}
                onChange={(e) =>
                  alterarMargemVarejo(Number(e.target.value))
                }
              />
            </label>

            <label>
              Venda Varejo
              <input
                type="text"
                value={formatarMoedaInput(Number(produto.vendaVarejo || 0))}
                onChange={(e) =>
                  alterarVendaVarejo(converterMoedaInput(e.target.value))
                }
              />
            </label>

            <div className="form-field">
              <span>Margem varejo sobre custo médio</span>
              <strong>
                {calcularMargemLucro(
                  obterCustoMedioReferencia(),
                  Number(produto.vendaVarejo || 0),
                ).toFixed(2)}
                %
              </strong>
              <small>
                Markup:{' '}
                {calcularMarkup(
                  obterCustoMedioReferencia(),
                  Number(produto.vendaVarejo || 0),
                ).toFixed(2)}
                %
              </small>
            </div>

            <div className="form-field">
              <span>Margem varejo sobre último custo</span>
              <strong>
                {calcularMargemLucro(
                  obterUltimoCustoReferencia(),
                  Number(produto.vendaVarejo || 0),
                ).toFixed(2)}
                %
              </strong>
              <small>
                Markup:{' '}
                {calcularMarkup(
                  obterUltimoCustoReferencia(),
                  Number(produto.vendaVarejo || 0),
                ).toFixed(2)}
                %
              </small>
            </div>

            <label>
              Margem automática atacado %
              <input
                type="number"
                min={30}
                value={Math.max(30, Number(produto.margemAutomaticaAtacado || 0))}
                onChange={(e) =>
                  alterarMargemAtacado(Number(e.target.value))
                }
              />
            </label>

            <label>
              Venda Atacado
              <input
                type="text"
                value={formatarMoedaInput(Number(produto.vendaAtacado || 0))}
                onChange={(e) =>
                  alterarVendaAtacado(converterMoedaInput(e.target.value))
                }
              />
            </label>

            <div className="form-field">
              <span>Margem atacado sobre custo médio</span>
              <strong>
                {calcularMargemLucro(
                  obterCustoMedioReferencia(),
                  Number(produto.vendaAtacado || 0),
                ).toFixed(2)}
                %
              </strong>
              <small>
                Markup:{' '}
                {calcularMarkup(
                  obterCustoMedioReferencia(),
                  Number(produto.vendaAtacado || 0),
                ).toFixed(2)}
                %
              </small>
            </div>

            <div className="form-field">
              <span>Margem atacado sobre último custo</span>
              <strong>
                {calcularMargemLucro(
                  obterUltimoCustoReferencia(),
                  Number(produto.vendaAtacado || 0),
                ).toFixed(2)}
                %
              </strong>
              <small>
                Markup:{' '}
                {calcularMarkup(
                  obterUltimoCustoReferencia(),
                  Number(produto.vendaAtacado || 0),
                ).toFixed(2)}
                %
              </small>
            </div>

            <label>
              Qtd. mínima para atacado
              <input
                type="number"
                value={produto.quantidadeMinimaAtacado || 0}
                onChange={(e) =>
                  atualizarProduto(
                    'quantidadeMinimaAtacado',
                    Number(e.target.value),
                  )
                }
              />
            </label>

            <div className="form-field">
              <span>Valor do estoque atual</span>
              <strong>
                {dinheiro(
                  Number(produto.valorEstoqueAtual || 0) ||
                    Number(produto.estoqueAtual || 0) *
                      obterCustoMedioReferencia(),
                )}
              </strong>
              <small>Estoque atual × custo médio vigente.</small>
            </div>
          </div>

          <div className="form-section-title">
            <h2>Histórico de custos</h2>
          </div>

          <div className="history-area">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Documento</th>
                  <th>Fornecedor</th>
                  <th>Entrada</th>
                  <th>Custo entrada</th>
                  <th>Custo médio anterior</th>
                  <th>Novo custo médio</th>
                  <th>Variação</th>
                </tr>
              </thead>

              <tbody>
                {produto.historicoCustos && produto.historicoCustos.length > 0 ? (
                  produto.historicoCustos.map((historico) => (
                    <tr key={historico.id}>
                      <td>
                        {historico.data
                          ? historico.data.split('-').reverse().join('/')
                          : '-'}
                        {historico.hora ? ` ${historico.hora}` : ''}
                      </td>
                      <td>
                        {historico.numeroNFe
                          ? `NF-e ${historico.numeroNFe}`
                          : historico.numeroCompra
                            ? `Compra ${historico.numeroCompra}`
                            : historico.documentoOrigem || '-'}
                      </td>
                      <td>{historico.fornecedor || '-'}</td>
                      <td>{Number(historico.quantidadeEntrada || 0)}</td>
                      <td>{dinheiro(Number(historico.custoEntrada || 0))}</td>
                      <td>
                        {dinheiro(Number(historico.custoMedioAnterior || 0))}
                      </td>
                      <td>{dinheiro(Number(historico.custoMedioAtual || 0))}</td>
                      <td>
                        {formatarPercentual(
                          Number(historico.variacaoUltimoCustoPercentual || 0),
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ textAlign: 'center', color: '#94a3b8' }}
                    >
                      Nenhuma entrada de compra com custo médio registrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="form-section-title">
            <h2>Características</h2>
          </div>

          <div className="form-tabs">
            <button
              type="button"
              className={abaAtiva === 'estoque' ? 'active' : ''}
              onClick={() => setAbaAtiva('estoque')}
            >
              ESTOQUE
            </button>

            <button
              type="button"
              className={abaAtiva === 'fiscal' ? 'active' : ''}
              onClick={() => setAbaAtiva('fiscal')}
            >
              FISCAL
            </button>

            <button
              type="button"
              className={abaAtiva === 'pdv' ? 'active' : ''}
              onClick={() => setAbaAtiva('pdv')}
            >
              PDV
            </button>

            <button
              type="button"
              className={abaAtiva === 'composicao' ? 'active' : ''}
              onClick={() => setAbaAtiva('composicao')}
            >
              COMPOSIÇÃO
            </button>

            <button
              type="button"
              className={abaAtiva === 'fragmentacao' ? 'active' : ''}
              onClick={() => setAbaAtiva('fragmentacao')}
            >
              FRAGMENTAÇÃO
            </button>

            <button
              type="button"
              className={abaAtiva === 'loja' ? 'active' : ''}
              onClick={() => setAbaAtiva('loja')}
            >
              LOJA VIRTUAL
            </button>
          </div>

          {abaAtiva === 'estoque' && (
            <div className="form-grid">
              <div className="form-field">
                <span>Movimentar Estoque</span>
                <button
                  type="button"
                  className={`switch-button ${
                    produto.movimentarEstoque ? 'active' : ''
                  }`}
                  onClick={() =>
                    atualizarProduto(
                      'movimentarEstoque',
                      !produto.movimentarEstoque
                    )
                  }
                >
                  <span></span>
                </button>
                <small>{produto.movimentarEstoque ? 'Sim' : 'Não'}</small>
              </div>

              <div className="form-field">
                <span>Movimentar Estoque da Composição</span>
                <button
                  type="button"
                  className={`switch-button ${
                    produto.movimentarEstoqueComposicao ? 'active' : ''
                  }`}
                  onClick={() =>
                    atualizarProduto(
                      'movimentarEstoqueComposicao',
                      !produto.movimentarEstoqueComposicao
                    )
                  }
                >
                  <span></span>
                </button>
                <small>
                  {produto.movimentarEstoqueComposicao ? 'Sim' : 'Não'}
                </small>
              </div>

              <label>
                Tipo de Estoque
                <select
                  value={produto.tipoEstoque || 'Único'}
                  onChange={(e) =>
                    atualizarProduto('tipoEstoque', e.target.value)
                  }
                >
                  <option>Único</option>
                  <option>Grade</option>
                </select>
              </label>

              <label>
                Estoque Mínimo
                <input
                  type="number"
                  value={produto.estoqueMinimo || 0}
                  onChange={(e) =>
                    atualizarProduto('estoqueMinimo', Number(e.target.value))
                  }
                />
              </label>

              <label>
                Estoque Atual
                <input
                  type="number"
                  value={produto.estoqueAtual || 0}
                  onChange={(e) =>
                    atualizarProduto('estoqueAtual', Number(e.target.value))
                  }
                />
              </label>
            </div>
          )}

          {abaAtiva === 'fiscal' && (
            <div className="form-grid">
              <label>
                Tipo Fiscal
                <select
                  value={produto.tipoFiscal || ''}
                  onChange={(e) =>
                    atualizarProduto('tipoFiscal', e.target.value)
                  }
                >
                  <option>Mercadoria para Revenda</option>
                  <option>Material de Uso e Consumo</option>
                  <option>Matéria-prima</option>
                  <option>Serviço</option>
                </select>
              </label>

              <label className="span-2">
                NCM
                <div className="select-plus">
                  <input
                    value={
                      produto.ncmDescricao
                        ? `${produto.ncm || ''} - ${produto.ncmDescricao}`
                        : produto.ncm || ''
                    }
                    placeholder="Digite o NCM com 8 números"
                    title={
                      produto.ncmDescricao
                        ? `${produto.ncm || ''} - ${produto.ncmDescricao}`
                        : 'Digite o NCM com 8 números'
                    }
                    onFocus={() => {
                      if (produto.ncmDescricao) {
                        atualizarProduto('ncmDescricao', '')
                      }
                    }}
                    onChange={(e) => {
                      atualizarProduto('ncm', limparCodigoNcm(e.target.value))
                      atualizarProduto('ncmDescricao', '')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void buscarNcmReceita()
                      }
                    }}
                  />
                  <button
                    type="button"
                    title="Buscar nomenclatura do NCM"
                    onClick={buscarNcmReceita}
                    disabled={buscandoNcm}
                  >
                    <Search size={18} />
                  </button>
                </div>
                <small className="produto-ncm-descricao">
                  {buscandoNcm
                    ? 'Buscando nomenclatura do NCM...'
                    : produto.ncmDescricao
                      ? 'Nomenclatura preenchida na mesma lacuna do NCM.'
                      : 'Digite o NCM e clique na lupa para preencher a nomenclatura.'}
                </small>
              </label>

              <label>
                Origem
                <select
                  value={produto.origem || '0 - Nacional'}
                  onChange={(e) => atualizarProduto('origem', e.target.value)}
                >
                  <option>0 - Nacional</option>
                  <option>1 - Estrangeira - Importação direta</option>
                  <option>2 - Estrangeira - Mercado interno</option>
                </select>
              </label>

              <label>
                CEST
                <input
                  value={produto.cest || ''}
                  onChange={(e) => atualizarProduto('cest', e.target.value)}
                />
              </label>

              <label>
                Classificação
                <select
                  value={produto.classificacao || 'Comum'}
                  onChange={(e) =>
                    atualizarProduto('classificacao', e.target.value)
                  }
                >
                  <option>Comum</option>
                  <option>Monofásico</option>
                  <option>Substituição Tributária</option>
                  <option>Isento</option>
                </select>
              </label>

              <label>
                CSOSN (Simples Nacional)
                <select value={produto.csosn || ''} onChange={(e) => atualizarProduto('csosn', e.target.value)}>
                  <option value="">Selecione conforme orientação fiscal</option>
                  <option value="101">101 - Tributada com crédito</option>
                  <option value="102">102 - Tributada sem crédito</option>
                  <option value="103">103 - Isenção por faixa de receita</option>
                  <option value="201">201 - Com ST e crédito</option>
                  <option value="202">202 - Com ST sem crédito</option>
                  <option value="203">203 - ST e isenção por faixa</option>
                  <option value="300">300 - Imune</option>
                  <option value="400">400 - Não tributada</option>
                  <option value="500">500 - ICMS cobrado anteriormente por ST</option>
                  <option value="900">900 - Outros</option>
                </select>
              </label>

              <label>
                CST ICMS (regime normal)
                <input value={produto.cstIcms || ''} maxLength={2} placeholder={empresaSimplesNacional ? 'Não se aplica ao Simples Nacional' : 'Ex.: 00'} disabled={empresaSimplesNacional} onChange={(e) => atualizarProduto('cstIcms', e.target.value.replace(/\D/g, '').slice(0, 2))} />
              </label>

              <label>
                Modalidade BC ICMS
                <select value={produto.modalidadeBcIcms || '3 - Valor da operação'} onChange={(e) => atualizarProduto('modalidadeBcIcms', e.target.value)}>
                  <option>0 - Margem Valor Agregado</option>
                  <option>1 - Pauta</option>
                  <option>2 - Preço tabelado máximo</option>
                  <option>3 - Valor da operação</option>
                </select>
              </label>

              <label>
                Alíquota ICMS (%)
                <input type="number" min="0" step="0.01" value={produto.aliquotaIcms ?? 0} onChange={(e) => atualizarProduto('aliquotaIcms', Number(e.target.value))} />
              </label>

              <label>
                Redução BC ICMS (%)
                <input type="number" min="0" max="100" step="0.01" value={produto.reducaoBcIcms ?? 0} onChange={(e) => atualizarProduto('reducaoBcIcms', Number(e.target.value))} />
              </label>

              <label>
                CST PIS
                <input value={produto.cstPis || '49'} maxLength={2} placeholder="49" onChange={(e) => atualizarProduto('cstPis', e.target.value.replace(/\D/g, '').slice(0, 2))} />
              </label>

              <label>
                Alíquota PIS (%)
                <input type="number" min="0" step="0.0001" value={produto.aliquotaPis ?? 0} onChange={(e) => atualizarProduto('aliquotaPis', Number(e.target.value))} />
              </label>

              <label>
                CST COFINS
                <input value={produto.cstCofins || '49'} maxLength={2} placeholder="49" onChange={(e) => atualizarProduto('cstCofins', e.target.value.replace(/\D/g, '').slice(0, 2))} />
              </label>

              <label>
                Alíquota COFINS (%)
                <input type="number" min="0" step="0.0001" value={produto.aliquotaCofins ?? 0} onChange={(e) => atualizarProduto('aliquotaCofins', Number(e.target.value))} />
              </label>

              <label>
                CFOP dentro do RS
                <input value={produto.cfopDentroEstado || '5102'} maxLength={4} onChange={(e) => atualizarProduto('cfopDentroEstado', e.target.value.replace(/\D/g, '').slice(0, 4))} />
              </label>

              <label>
                CFOP fora do RS
                <input value={produto.cfopForaEstado || '6102'} maxLength={4} onChange={(e) => atualizarProduto('cfopForaEstado', e.target.value.replace(/\D/g, '').slice(0, 4))} />
              </label>

              <div className="form-field span-2">
                <small><strong>Padrão confirmado para venda comum:</strong> Simples Nacional, origem 0, CSOSN 102, PIS 49 e COFINS 49, sem destaque de impostos, CFOP 5102 dentro do RS e 6102 fora do RS. Altere somente quando houver exceção fiscal específica.</small>
              </div>
            </div>
          )}

          {abaAtiva === 'pdv' && (
            <div className="form-grid">
              <div className="form-field span-2">
                <span>Habilitar produto no PDV</span>
                <button
                  type="button"
                  className={`switch-button ${
                    produto.habilitarPdv ? 'active' : ''
                  }`}
                  onClick={() =>
                    atualizarProduto('habilitarPdv', !produto.habilitarPdv)
                  }
                >
                  <span></span>
                </button>
                <small>{produto.habilitarPdv ? 'Sim' : 'Não'}</small>
              </div>
            </div>
          )}

          {abaAtiva === 'composicao' && (
            <div className="history-area">
              <div className="form-grid">
                <label className="span-2">
                  Item
                  <input
                    value={itemComposicao.item || ''}
                    onChange={(e) =>
                      setItemComposicao({
                        ...itemComposicao,
                        item: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Quantidade
                  <input
                    type="number"
                    value={itemComposicao.quantidade || 0}
                    onChange={(e) =>
                      setItemComposicao({
                        ...itemComposicao,
                        quantidade: Number(e.target.value),
                      })
                    }
                  />
                </label>

                <label>
                  Unidade
                  <input
                    value={itemComposicao.unidade || ''}
                    onChange={(e) =>
                      setItemComposicao({
                        ...itemComposicao,
                        unidade: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Custo Unitário
                  <input
                    type="text"
                    value={formatarMoedaInput(
                      Number(itemComposicao.custoUnitario || 0)
                    )}
                    onChange={(e) =>
                      setItemComposicao({
                        ...itemComposicao,
                        custoUnitario: converterMoedaInput(e.target.value),
                      })
                    }
                  />
                </label>

                <button
                  type="button"
                  className="save-button"
                  onClick={adicionarComposicao}
                >
                  <Plus size={18} />
                  Incluir
                </button>
              </div>

              <table className="history-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantidade</th>
                    <th>Unidade</th>
                    <th>Custo Unitário</th>
                    <th>Custo Total</th>
                    <th>Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {produto.composicao && produto.composicao.length > 0 ? (
                    produto.composicao.map((item, index) => (
                      <tr key={index}>
                        <td>{item.item}</td>
                        <td>{item.quantidade}</td>
                        <td>{item.unidade}</td>
                        <td>{dinheiro(Number(item.custoUnitario || 0))}</td>
                        <td>{dinheiro(Number(item.custoTotal || 0))}</td>
                        <td>
                          <button
                            type="button"
                            className="cancel-button"
                            onClick={() => removerComposicao(index)}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        style={{ textAlign: 'center', color: '#94a3b8' }}
                      >
                        Nenhum item incluído na composição.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {abaAtiva === 'fragmentacao' && (
            <div className="form-grid">
              <div className="form-field">
                <span>Permite Fragmentação?</span>
                <button
                  type="button"
                  className={`switch-button ${
                    produto.permiteFragmentacao ? 'active' : ''
                  }`}
                  onClick={() =>
                    atualizarProduto(
                      'permiteFragmentacao',
                      !produto.permiteFragmentacao
                    )
                  }
                >
                  <span></span>
                </button>
                <small>{produto.permiteFragmentacao ? 'Sim' : 'Não'}</small>
              </div>

              <label>
                Unidade Fragmentada
                <input
                  value={produto.unidadeFragmentada || ''}
                  onChange={(e) =>
                    atualizarProduto('unidadeFragmentada', e.target.value)
                  }
                />
              </label>

              <label>
                Quantidade Fragmentada
                <input
                  type="number"
                  value={produto.quantidadeFragmentada || 0}
                  onChange={(e) =>
                    atualizarProduto(
                      'quantidadeFragmentada',
                      Number(e.target.value)
                    )
                  }
                />
              </label>

              <label>
                Unidades por embalagem de compra
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={produto.quantidadePorEmbalagemCompra || 1}
                  onChange={(e) =>
                    atualizarProduto(
                      'quantidadePorEmbalagemCompra',
                      Math.max(1, Number(e.target.value) || 1)
                    )
                  }
                />
                <small>Ex.: caixa com 8 bobinas = 8.</small>
              </label>
            </div>
          )}

          {abaAtiva === 'loja' && (
            <div className="form-grid">
              <div className="form-field">
                <span>Publicar na Loja Virtual?</span>
                <button
                  type="button"
                  className={`switch-button ${
                    produto.publicarLojaVirtual ? 'active' : ''
                  }`}
                  onClick={() =>
                    atualizarProduto(
                      'publicarLojaVirtual',
                      !produto.publicarLojaVirtual
                    )
                  }
                >
                  <span></span>
                </button>
                <small>{produto.publicarLojaVirtual ? 'Sim' : 'Não'}</small>
              </div>

              <label className="span-2">
                Descrição Loja Virtual
                <textarea
                  value={produto.descricaoLojaVirtual || ''}
                  onChange={(e) =>
                    atualizarProduto('descricaoLojaVirtual', e.target.value)
                  }
                />
              </label>
            </div>
          )}

          <div className="form-footer">
            <button
              type="button"
              className="save-secondary-button"
              onClick={salvarProduto}
            >
              <Save size={18} />
              Salvar
            </button>

            <button
              type="button"
              className="save-button"
              onClick={salvarEFechar}
            >
              <SaveAll size={18} />
              Salvar e Fechar
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

export default ProdutoForm
