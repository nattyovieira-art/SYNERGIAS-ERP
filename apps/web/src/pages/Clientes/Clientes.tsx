import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  List,
  Filter,
  Upload,
  CloudDownload,
  FileType2,
  Printer,
  UserPlus,
  Trash2,
} from 'lucide-react'
import * as XLSX from 'xlsx'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import DataTable from '../../components/DataTable/DataTable'
import type { Cliente } from '../../types/Cliente'

import {
  listarClientesStorage,
  salvarClientesStorage,
  salvarClientesStorageConfirmado,
} from '../../services/clientesStorage'

import { ERP_STORAGE_UPDATED_EVENT, hidratarColecaoCentral } from '../../services/erpApi'

import '../../styles/clientes.css'

function Clientes() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pesquisa, setPesquisa] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const [filtroPessoa, setFiltroPessoa] = useState('TODAS')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  const [filtroCidade, setFiltroCidade] = useState('TODAS')
  const [filtroSituacao, setFiltroSituacao] = useState('TODAS')
  const [filtroBloqueado, setFiltroBloqueado] = useState('TODOS')

  const [clientes, setClientes] = useState<Cliente[]>(() =>
    listarClientesStorage(),
  )

  useEffect(() => {
    hidratarColecaoCentral('clientes', 'synergias_clientes').catch((erro) => {
      console.error(erro)
      alert(`Falha ao carregar Clientes do servidor: ${erro instanceof Error ? erro.message : String(erro)}`)
    })

    const recarregar = (event?: Event) => {
      const detalhe = (event as CustomEvent | undefined)?.detail
      if (detalhe?.collection && detalhe.collection !== 'clientes') return
      setClientes(listarClientesStorage())
    }
    window.addEventListener(ERP_STORAGE_UPDATED_EVENT, recarregar)
    window.addEventListener('focus', recarregar)
    return () => {
      window.removeEventListener(ERP_STORAGE_UPDATED_EVENT, recarregar)
      window.removeEventListener('focus', recarregar)
    }
  }, [])

  const columns: {
    key: keyof Cliente
    label: string
    type?: 'text' | 'currency' | 'status'
  }[] = [
    { key: 'razaoSocial', label: 'Cliente' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'email', label: 'E-mail' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'situacao', label: 'Situação', type: 'status' },
    { key: 'valorAno', label: 'Valor no ano', type: 'currency' },
  ]

  const cidadesDisponiveis = useMemo(
    () =>
      Array.from(
        new Set(
          clientes
            .map((cliente) => String(cliente.cidade || '').trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [clientes],
  )

  const quantidadeFiltrosAtivos = useMemo(
    () =>
      [
        filtroPessoa !== 'TODAS',
        filtroTipo !== 'TODOS',
        filtroCidade !== 'TODAS',
        filtroSituacao !== 'TODAS',
        filtroBloqueado !== 'TODOS',
      ].filter(Boolean).length,
    [
      filtroBloqueado,
      filtroCidade,
      filtroPessoa,
      filtroSituacao,
      filtroTipo,
    ],
  )

  const clientesFiltrados = useMemo(() => {
    const termo = pesquisa.toLowerCase().trim()

    return clientes.filter((cliente) => {
      const batePesquisa =
        !termo ||
        Object.values(cliente).some((valor) =>
          String(valor || '').toLowerCase().includes(termo),
        )

      const batePessoa =
        filtroPessoa === 'TODAS' ||
        String(cliente.tipoPessoa || '') === filtroPessoa

      const bateTipo =
        filtroTipo === 'TODOS' ||
        String(cliente.tipo || '') === filtroTipo

      const bateCidade =
        filtroCidade === 'TODAS' ||
        String(cliente.cidade || '').trim() === filtroCidade

      const bateSituacao =
        filtroSituacao === 'TODAS' ||
        String(cliente.situacao || '') === filtroSituacao

      const clienteBloqueado = Boolean(cliente.bloqueado)
      const bateBloqueado =
        filtroBloqueado === 'TODOS' ||
        (filtroBloqueado === 'SIM' && clienteBloqueado) ||
        (filtroBloqueado === 'NAO' && !clienteBloqueado)

      return (
        batePesquisa &&
        batePessoa &&
        bateTipo &&
        bateCidade &&
        bateSituacao &&
        bateBloqueado
      )
    })
  }, [
    clientes,
    pesquisa,
    filtroPessoa,
    filtroTipo,
    filtroCidade,
    filtroSituacao,
    filtroBloqueado,
  ])

  function limparFiltros() {
    setFiltroPessoa('TODAS')
    setFiltroTipo('TODOS')
    setFiltroCidade('TODAS')
    setFiltroSituacao('TODAS')
    setFiltroBloqueado('TODOS')
  }

  function atualizarClientes(clientesAtualizados: Cliente[]) {
    salvarClientesStorage(clientesAtualizados)
    setClientes(clientesAtualizados)
  }

  function importarExcel() {
    fileInputRef.current?.click()
  }

  function limparLista() {
    const confirmar = window.confirm(
      'Tem certeza que deseja limpar toda a lista de clientes?',
    )

    if (!confirmar) return

    const confirmarNovamente = window.confirm(
      'Atenção: isso vai apagar todos os clientes da lista atual. Deseja continuar?',
    )

    if (!confirmarNovamente) return

    atualizarClientes([])
    alert('Lista limpa com sucesso.')
  }

  function pegarValor(linha: any, nomes: string[], padrao: any = '') {
    for (const nome of nomes) {
      if (linha[nome] !== undefined && linha[nome] !== null) {
        return linha[nome]
      }
    }

    return padrao
  }

  function limparMoeda(valor: any) {
    if (valor === undefined || valor === null || valor === '') return 0

    if (typeof valor === 'number') return valor

    const texto = String(valor)
      .replace('R$', '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim()

    return Number(texto) || 0
  }

  function limparBooleano(valor: any) {
    const texto = String(valor || '').toLowerCase().trim()

    return (
      texto === 'sim' ||
      texto === 'true' ||
      texto === '1' ||
      texto === 'ativo'
    )
  }

  function gerarCodigoCliente(index: number, linha: any) {
    const codigoPlanilha = pegarValor(linha, [
      'Código Sistema',
      'codigo',
      'Código',
      'Codigo',
    ])

    if (codigoPlanilha !== undefined && codigoPlanilha !== null && codigoPlanilha !== '') {
      return String(codigoPlanilha).trim().padStart(4, '0')
    }

    return String(Date.now() + index)
  }

  function montarClienteDaLinha(linha: any, index: number): Cliente {
    const codigo = gerarCodigoCliente(index, linha)

    const tipoPessoaValor = String(
      pegarValor(linha, ['Pessoa', 'tipoPessoa'], 'Jurídica'),
    )

    const cliente: Cliente = {
      codigo,

      tipoPessoa:
        tipoPessoaValor === 'Física' || tipoPessoaValor === 'Fisica'
          ? 'Física'
          : 'Jurídica',

      razaoSocial:
        pegarValor(linha, [
          'Nome/Razão Social',
          'Razão Social',
          'razaoSocial',
          'Cliente',
        ]) || '',

      nomeFantasia:
        pegarValor(linha, [
          'Apelido/Nome fantasia',
          'Nome Fantasia',
          'nomeFantasia',
        ]) || '',

      tipo:
        pegarValor(
          linha,
          ['Tipo (Lista de Preços)', 'Tipo', 'tipo'],
          'Padrão',
        ) || 'Padrão',

      situacao:
        pegarValor(linha, ['Situação', 'situacao'], 'Ativo') || 'Ativo',

      bloqueado: limparBooleano(
        pegarValor(linha, ['Bloqueado', 'bloqueado'], 'Não'),
      ),

      cpf: pegarValor(linha, ['CPF', 'cpf']) || '',
      cnpj: pegarValor(linha, ['CNPJ', 'cnpj']) || '',

      responsavel:
        pegarValor(linha, ['Responsável', 'responsavel']) || '',

      telefone: pegarValor(linha, ['Telefone', 'telefone']) || '',

      celular:
        pegarValor(linha, [
          'Celular',
          'celular',
          'Celular / WhatsApp',
        ]) || '',

      celularWhatsapp:
        pegarValor(linha, ['Celular / WhatsApp', 'celularWhatsapp']) || '',

      email: pegarValor(linha, ['Email', 'E-mail', 'email']) || '',

      horarioEntrega:
        pegarValor(linha, ['Horário de Entrega', 'horarioEntrega']) || '',

      cep: pegarValor(linha, ['CEP', 'cep']) || '',
      endereco: pegarValor(linha, ['Endereço', 'endereco']) || '',
      numero: String(pegarValor(linha, ['Número', 'numero']) || ''),
      complemento: pegarValor(linha, ['Complemento', 'complemento']) || '',
      bairro: pegarValor(linha, ['Bairro', 'bairro']) || '',
      cidade: pegarValor(linha, ['Cidade', 'cidade']) || '',
      estado: pegarValor(linha, ['Estado', 'estado', 'UF']) || '',
      pais: pegarValor(linha, ['País', 'pais'], 'Brasil') || 'Brasil',

      mesmoEnderecoFiscal: limparBooleano(
        pegarValor(
          linha,
          ['Mesmo Endereço Fiscal?', 'mesmoEnderecoFiscal'],
          'Não',
        ),
      ),

      cepEntrega: pegarValor(linha, ['CEP Entrega', 'cepEntrega']) || '',

      enderecoEntrega:
        pegarValor(linha, ['Endereço Entrega', 'enderecoEntrega']) || '',

      numeroEntrega: String(
        pegarValor(linha, ['Número Entrega', 'numeroEntrega']) || '',
      ),

      complementoEntrega:
        pegarValor(linha, [
          'Complemento Entrega',
          'complementoEntrega',
        ]) || '',

      bairroEntrega:
        pegarValor(linha, ['Bairro Entrega', 'bairroEntrega']) || '',

      cidadeEntrega:
        pegarValor(linha, ['Cidade Entrega', 'cidadeEntrega']) || '',

      estadoEntrega:
        pegarValor(linha, ['Estado Entrega', 'estadoEntrega']) || '',

      paisEntrega:
        pegarValor(linha, ['País Entrega', 'paisEntrega'], 'Brasil') ||
        'Brasil',

      inscricaoEstadual:
        pegarValor(linha, [
          'IE',
          'Inscrição Estadual',
          'inscricaoEstadual',
        ]) || '',

      inscricaoMunicipal:
        pegarValor(linha, [
          'IM',
          'Inscrição Municipal',
          'inscricaoMunicipal',
        ]) || '',

      indicadorIE:
        pegarValor(linha, [
          'Indicador IE Destinatário',
          'Indicador IE',
          'indicadorIE',
        ]) || '',

      consumidorFinal: limparBooleano(
        pegarValor(linha, ['Consumidor Final?', 'consumidorFinal'], 'Não'),
      ),

      issRetidoFonte: limparBooleano(
        pegarValor(linha, ['ISS Retido na Fonte?', 'issRetidoFonte'], 'Não'),
      ),

      produtorRural: limparBooleano(
        pegarValor(linha, ['Produtor Rural?', 'produtorRural'], 'Não'),
      ),

      totalVencidas: limparMoeda(
        pegarValor(linha, ['Total Vencidas', 'totalVencidas'], 0),
      ),

      totalAVencer: limparMoeda(
        pegarValor(linha, ['Total a Vencer', 'totalAVencer'], 0),
      ),

      totalPagas: limparMoeda(
        pegarValor(linha, ['Total Pagas', 'totalPagas'], 0),
      ),

      limiteCredito: limparMoeda(
        pegarValor(linha, ['Limite de Crédito', 'limiteCredito'], 10000),
      ),

      valorAno: limparMoeda(
        pegarValor(linha, ['Valor no ano', 'valorAno'], 0),
      ),

      caracteristicas:
        pegarValor(linha, [
          'Características',
          'Observações',
          'caracteristicas',
        ]) || '',

      pedidos: [],
    }

    if (cliente.mesmoEnderecoFiscal) {
      cliente.cepEntrega = cliente.cep
      cliente.enderecoEntrega = cliente.endereco
      cliente.numeroEntrega = cliente.numero
      cliente.complementoEntrega = cliente.complemento
      cliente.bairroEntrega = cliente.bairro
      cliente.cidadeEntrega = cliente.cidade
      cliente.estadoEntrega = cliente.estado
      cliente.paisEntrega = cliente.pais
    }

    return cliente
  }

  function mesclarClientes(
    clientesAtuais: Cliente[],
    clientesImportados: Cliente[],
  ) {
    const mapa = new Map<string, Cliente>()

    clientesAtuais.forEach((cliente) => {
      mapa.set(String(cliente.codigo), cliente)
    })

    clientesImportados.forEach((clienteImportado) => {
      const codigo = String(clienteImportado.codigo)

      if (mapa.has(codigo)) {
        const clienteAtual = mapa.get(codigo)

        mapa.set(codigo, {
          ...clienteAtual,
          ...clienteImportado,
          codigo,
        } as Cliente)
      } else {
        mapa.set(codigo, clienteImportado)
      }
    })

    return Array.from(mapa.values())
  }

  function lerArquivoExcel(event: React.ChangeEvent<HTMLInputElement>) {
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

        const clientesConvertidos: Cliente[] = linhas.map((linha, index) =>
          montarClienteDaLinha(linha, index),
        )

        const clientesAtuais = listarClientesStorage()
        const clientesMesclados = mesclarClientes(
          clientesAtuais,
          clientesConvertidos,
        )

        await salvarClientesStorageConfirmado(clientesMesclados)
        setClientes(clientesMesclados)

        alert(
          `${clientesConvertidos.length} clientes importados. Total salvo: ${clientesMesclados.length}.`,
        )

        event.target.value = ''
      } catch (error) {
        console.error(error)
        alert(`A importação não foi confirmada no servidor e não será considerada concluída. ${error instanceof Error ? error.message : String(error)}`)
        event.target.value = ''
      }
    }

    leitor.readAsArrayBuffer(arquivo)
  }

  function exportarExcel() {
    const clientesParaExportar = clientesFiltrados.map((cliente) => ({
      'Código Sistema': cliente.codigo,
      Pessoa: cliente.tipoPessoa || 'Jurídica',
      'Nome/Razão Social': cliente.razaoSocial || '',
      'Apelido/Nome fantasia': cliente.nomeFantasia || '',
      'Tipo (Lista de Preços)': cliente.tipo || 'Padrão',
      Situação: cliente.situacao || 'Ativo',
      Bloqueado: cliente.bloqueado ? 'Sim' : 'Não',
      CNPJ: cliente.cnpj || '',
      CPF: cliente.cpf || '',

      Responsável: cliente.responsavel || '',
      Telefone: cliente.telefone || '',
      'Celular / WhatsApp': cliente.celularWhatsapp || cliente.celular || '',
      Email: cliente.email || '',
      'Horário de Entrega': cliente.horarioEntrega || '',

      CEP: cliente.cep || '',
      Endereço: cliente.endereco || '',
      Número: cliente.numero || '',
      Complemento: cliente.complemento || '',
      Bairro: cliente.bairro || '',
      Cidade: cliente.cidade || '',
      Estado: cliente.estado || '',
      País: cliente.pais || 'Brasil',

      'Mesmo Endereço Fiscal?': cliente.mesmoEnderecoFiscal ? 'Sim' : 'Não',
      'CEP Entrega': cliente.cepEntrega || '',
      'Endereço Entrega': cliente.enderecoEntrega || '',
      'Número Entrega': cliente.numeroEntrega || '',
      'Complemento Entrega': cliente.complementoEntrega || '',
      'Bairro Entrega': cliente.bairroEntrega || '',
      'Cidade Entrega': cliente.cidadeEntrega || '',
      'Estado Entrega': cliente.estadoEntrega || '',
      'País Entrega': cliente.paisEntrega || 'Brasil',

      IE: cliente.inscricaoEstadual || '',
      IM: cliente.inscricaoMunicipal || '',
      'Indicador IE Destinatário': cliente.indicadorIE || '',
      'Consumidor Final?': cliente.consumidorFinal ? 'Sim' : 'Não',
      'ISS Retido na Fonte?': cliente.issRetidoFonte ? 'Sim' : 'Não',
      'Produtor Rural?': cliente.produtorRural ? 'Sim' : 'Não',

      'Total Vencidas': cliente.totalVencidas || 0,
      'Total a Vencer': cliente.totalAVencer || 0,
      'Total Pagas': cliente.totalPagas || 0,
      'Limite de Crédito': cliente.limiteCredito ?? 10000,
      'Valor no ano': cliente.valorAno || 0,

      Características: cliente.caracteristicas || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(clientesParaExportar)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes')
    XLSX.writeFile(workbook, 'clientes.xlsx')
  }

  function editarCliente(cliente: Cliente) {
    navigate(`/clientes/editar/${cliente.codigo}`)
  }

  function excluirCliente(cliente: Cliente) {
    const nomeCliente =
      cliente.razaoSocial ||
      cliente.nomeFantasia ||
      cliente.cnpj ||
      'este cliente'

    const confirmar = window.confirm(`Deseja excluir ${nomeCliente}?`)

    if (!confirmar) return

    const atualizados = clientes.filter(
      (item) => String(item.codigo) !== String(cliente.codigo),
    )

    atualizarClientes(atualizados)

    alert('Cliente excluído com sucesso!')
  }

  return (
    <main className="clientes-page">
      <Sidebar />

      <section className="clientes-main">
        <PageHeader
          category="Clientes"
          title="Clientes"
          subtitle="Gerencie clientes, condomínios e empresas atendidas."
        />

        <div className="clientes-toolbar">
          <div className="clientes-toolbar-left">
            <button
              type="button"
              title="Lista de clientes"
              className="clientes-action-btn clientes-action-list"
              onClick={() => navigate('/clientes')}
            >
              <List size={24} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              title="Buscar clientes"
              aria-label="Buscar clientes"
              className="clientes-action-btn clientes-action-search"
              onClick={() => {
                const campo = document.querySelector<HTMLInputElement>(
                  '.search-clientes input',
                )
                campo?.focus()
              }}
            >
              <Search size={24} strokeWidth={2.4} />
            </button>

            <div className="search-clientes">
              <Search size={18} />

              <input
                type="text"
                placeholder="Pesquisar clientes..."
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
              />
            </div>

            <button
              type="button"
              title="Adicionar filtro"
              className={`clientes-filter-btn ${
                quantidadeFiltrosAtivos > 0 ? 'ativo' : ''
              }`}
              onClick={() => setMostrarFiltros((atual) => !atual)}
            >
              <Filter size={20} />
              {quantidadeFiltrosAtivos > 0 && (
                <span>{quantidadeFiltrosAtivos}</span>
              )}
            </button>
          </div>

          <div className="clientes-actions">
            <button
              type="button"
              title="Importar clientes"
              className="clientes-action-btn clientes-action-import"
              onClick={importarExcel}
            >
              <Upload size={24} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              title="Imprimir clientes"
              className="clientes-action-btn clientes-action-print"
              onClick={() => window.print()}
            >
              <Printer size={24} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              title="Exportar PDF"
              className="clientes-action-btn clientes-action-pdf"
              onClick={() => window.print()}
            >
              <FileType2 size={24} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              title="Exportar clientes"
              className="clientes-action-btn clientes-action-export"
              onClick={exportarExcel}
            >
              <CloudDownload size={25} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              title="Excluir todos os clientes"
              aria-label="Excluir todos os clientes"
              className="clientes-delete-all-btn"
              onClick={limparLista}
            >
              <Trash2 size={24} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              className="primary-action clientes-add-btn"
              title="Adicionar novo cliente"
              aria-label="Adicionar novo cliente"
              onClick={() => navigate('/clientes/novo')}
            >
              <UserPlus size={26} strokeWidth={2.4} />
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
          <section className="clientes-filter-panel">
            <div className="clientes-filter-grid">
              <label>
                Pessoa
                <select
                  value={filtroPessoa}
                  onChange={(e) => setFiltroPessoa(e.target.value)}
                >
                  <option value="TODAS">Todas</option>
                  <option value="Jurídica">Jurídica</option>
                  <option value="Física">Física</option>
                </select>
              </label>

              <label>
                Tipo / Lista de Preços
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                >
                  <option value="TODOS">Todos</option>
                  <option value="Padrão">Padrão</option>
                  <option value="Condomínios">Condomínios</option>
                  <option value="Revenda">Revenda</option>
                  <option value="Especial">Especial</option>
                  <option value="Atacado">Atacado</option>
                </select>
              </label>

              <label>
                Cidade
                <select
                  value={filtroCidade}
                  onChange={(e) => setFiltroCidade(e.target.value)}
                >
                  <option value="TODAS">Todas</option>
                  {cidadesDisponiveis.map((cidade) => (
                    <option key={cidade} value={cidade}>
                      {cidade}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Situação
                <select
                  value={filtroSituacao}
                  onChange={(e) => setFiltroSituacao(e.target.value)}
                >
                  <option value="TODAS">Todas</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </label>

              <label>
                Bloqueado
                <select
                  value={filtroBloqueado}
                  onChange={(e) => setFiltroBloqueado(e.target.value)}
                >
                  <option value="TODOS">Todos</option>
                  <option value="SIM">Sim</option>
                  <option value="NAO">Não</option>
                </select>
              </label>
            </div>

            <div className="clientes-filter-footer">
              <span>
                {clientesFiltrados.length} cliente(s) encontrado(s)
              </span>

              <button
                type="button"
                className="clientes-clear-filters-btn"
                onClick={limparFiltros}
                disabled={quantidadeFiltrosAtivos === 0}
              >
                Limpar filtros
              </button>
            </div>
          </section>
        )}

        <DataTable
          columns={columns}
          data={clientesFiltrados}
          onEdit={editarCliente}
          onDelete={excluirCliente}
        />
      </section>
    </main>
  )
}

export default Clientes
