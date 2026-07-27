import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, Filter, List, Plus, Save, SaveAll, Search, Trash2 } from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import type { Cliente } from '../../types/Cliente'
import type { EnderecoEntregaCliente } from '../../types/Cliente'
import { enderecoEntregaVazio, formatarEnderecoEntrega, normalizarEnderecosEntrega } from '../../services/enderecosEntrega'

import {
  buscarClienteStorage,
  listarClientesStorage,
  salvarClienteStorageConfirmado,
} from '../../services/clientesStorage'

import { resolverCodigoIbgeMunicipio } from '../../services/ibgeMunicipios'
import { cnpjTemDigitosValidos, consultarCnpj } from '../../services/cnpjService'

import '../../styles/cliente-form.css'
import '../../styles/clientes.css'

type ClienteFormProps = {
  modo: 'novo' | 'editar'
}

function ClienteForm({ modo }: ClienteFormProps) {
  const navigate = useNavigate()
  const { id } = useParams()

  const clienteEncontrado =
    modo === 'editar' && id ? buscarClienteStorage(id) : undefined

  const [abaAtiva, setAbaAtiva] = useState('geral')
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [buscandoCepEntrega, setBuscandoCepEntrega] = useState(false)
  const [enderecoEntregaSelecionado, setEnderecoEntregaSelecionado] = useState(0)
  const [locaisEntregaAbertos, setLocaisEntregaAbertos] = useState(false)

  const [pesquisaClientes, setPesquisaClientes] = useState('')
  const [mostrarFiltrosClientes, setMostrarFiltrosClientes] = useState(false)
  const [filtroPessoaClientes, setFiltroPessoaClientes] = useState('TODAS')
  const [filtroTipoClientes, setFiltroTipoClientes] = useState('TODOS')
  const [filtroSituacaoClientes, setFiltroSituacaoClientes] = useState('TODAS')

  const clientesExistentes = useMemo(() => listarClientesStorage(), [])

  const [cliente, setCliente] = useState<Cliente>({
    codigo: clienteEncontrado?.codigo || String(Date.now()),

    razaoSocial: clienteEncontrado?.razaoSocial || '',
    nomeFantasia: clienteEncontrado?.nomeFantasia || '',

    tipoPessoa: (clienteEncontrado as any)?.tipoPessoa || 'Jurídica',
    tipo: clienteEncontrado?.tipo || 'Padrão',
    situacao: clienteEncontrado?.situacao || 'Ativo',
    bloqueado: clienteEncontrado?.bloqueado || false,

    cpf: clienteEncontrado?.cpf || '',
    cnpj: String(
      clienteEncontrado?.cnpj ||
      (clienteEncontrado as any)?.cpfCnpj ||
      (clienteEncontrado as any)?.cnpjCpf ||
      (clienteEncontrado as any)?.documento ||
      '',
    ).replace(/\D/g, '').slice(0, 14),

    telefone: clienteEncontrado?.telefone || '',
    celular: clienteEncontrado?.celular || '',
    celularWhatsapp: (clienteEncontrado as any)?.celularWhatsapp || '',
    email: clienteEncontrado?.email || '',
    responsavel: (clienteEncontrado as any)?.responsavel || '',
    horarioEntrega: (clienteEncontrado as any)?.horarioEntrega || '',

    cep: clienteEncontrado?.cep || '',
    endereco: clienteEncontrado?.endereco || '',
    numero: clienteEncontrado?.numero || '',
    complemento: clienteEncontrado?.complemento || '',
    bairro: clienteEncontrado?.bairro || '',
    cidade: clienteEncontrado?.cidade || '',
    estado: clienteEncontrado?.estado || '',
    codigoIbgeMunicipio: (clienteEncontrado as any)?.codigoIbgeMunicipio || '',
    pais: clienteEncontrado?.pais || 'Brasil',

    mesmoEnderecoFiscal: (clienteEncontrado as any)?.mesmoEnderecoFiscal || false,
    cepEntrega: (clienteEncontrado as any)?.cepEntrega || '',
    enderecoEntrega: (clienteEncontrado as any)?.enderecoEntrega || '',
    numeroEntrega: (clienteEncontrado as any)?.numeroEntrega || '',
    complementoEntrega: (clienteEncontrado as any)?.complementoEntrega || '',
    bairroEntrega: (clienteEncontrado as any)?.bairroEntrega || '',
    cidadeEntrega: (clienteEncontrado as any)?.cidadeEntrega || '',
    estadoEntrega: (clienteEncontrado as any)?.estadoEntrega || '',
    codigoIbgeMunicipioEntrega: (clienteEncontrado as any)?.codigoIbgeMunicipioEntrega || '',
    paisEntrega: (clienteEncontrado as any)?.paisEntrega || 'Brasil',

    inscricaoEstadual: clienteEncontrado?.inscricaoEstadual || '',
    inscricaoMunicipal: clienteEncontrado?.inscricaoMunicipal || '',
    indicadorIE: clienteEncontrado?.indicadorIE || '',
    consumidorFinal: (clienteEncontrado as any)?.consumidorFinal ?? true,
    issRetidoFonte: (clienteEncontrado as any)?.issRetidoFonte || false,
    produtorRural: (clienteEncontrado as any)?.produtorRural || false,

    totalVencidas: (clienteEncontrado as any)?.totalVencidas || 0,
    totalAVencer: (clienteEncontrado as any)?.totalAVencer || 435.45,
    totalPagas: (clienteEncontrado as any)?.totalPagas || 4417.2,
    limiteCredito: (clienteEncontrado as any)?.limiteCredito ?? 10000,

    valorAno: clienteEncontrado?.valorAno || 0,
    caracteristicas: clienteEncontrado?.caracteristicas || '',
    pedidos: (clienteEncontrado as any)?.pedidos || [],
    enderecosEntrega: clienteEncontrado ? normalizarEnderecosEntrega(clienteEncontrado) : [],
  } as Cliente)

  const c = cliente as any
  const enderecosEntrega = normalizarEnderecosEntrega(cliente)
  const enderecoAtual = enderecosEntrega[enderecoEntregaSelecionado]

  function atualizarEnderecoEntrega(campo: keyof EnderecoEntregaCliente, valor: string | boolean) {
    const lista = [...enderecosEntrega]
    if (!lista[enderecoEntregaSelecionado]) return
    lista[enderecoEntregaSelecionado] = { ...lista[enderecoEntregaSelecionado], [campo]: valor }
    setCliente((atual) => ({ ...atual, enderecosEntrega: lista }))
  }

  function adicionarEnderecoEntrega() {
    const lista = [...enderecosEntrega, enderecoEntregaVazio()]
    setCliente((atual) => ({ ...atual, enderecosEntrega: lista, mesmoEnderecoFiscal: false }))
    setEnderecoEntregaSelecionado(lista.length - 1)
    setLocaisEntregaAbertos(true)
  }

  function excluirEnderecoEntrega(indice: number) {
    const lista = enderecosEntrega.filter((_, atual) => atual !== indice)
    setCliente((atual) => ({ ...atual, enderecosEntrega: lista }))
    setEnderecoEntregaSelecionado(Math.max(0, Math.min(indice, lista.length - 1)))
  }
  const titulo = modo === 'novo' ? 'Novo Cliente' : 'Editar Cliente'

  const limiteUtilizado = Number(c.totalAVencer || 0) + Number(c.totalVencidas || 0)
  const limiteDisponivel = Number(c.limiteCredito || 0) - limiteUtilizado

  const quantidadeFiltrosClientes = useMemo(
    () =>
      [
        filtroPessoaClientes !== 'TODAS',
        filtroTipoClientes !== 'TODOS',
        filtroSituacaoClientes !== 'TODAS',
      ].filter(Boolean).length,
    [
      filtroPessoaClientes,
      filtroTipoClientes,
      filtroSituacaoClientes,
    ],
  )

  const clientesEncontradosNaBusca = useMemo(() => {
    const termo = pesquisaClientes.trim().toLowerCase()

    if (!termo && quantidadeFiltrosClientes === 0) return []

    return clientesExistentes
      .filter((item) => {
        const bateBusca =
          !termo ||
          [
            item.razaoSocial,
            item.nomeFantasia,
            item.cnpj,
            item.cpf,
            item.cidade,
            item.telefone,
            item.celular,
          ].some((valor) =>
            String(valor || '').toLowerCase().includes(termo),
          )

        const batePessoa =
          filtroPessoaClientes === 'TODAS' ||
          String(item.tipoPessoa || '') === filtroPessoaClientes

        const bateTipo =
          filtroTipoClientes === 'TODOS' ||
          String(item.tipo || '') === filtroTipoClientes

        const bateSituacao =
          filtroSituacaoClientes === 'TODAS' ||
          String(item.situacao || '') === filtroSituacaoClientes

        return bateBusca && batePessoa && bateTipo && bateSituacao
      })
      .slice(0, 8)
  }, [
    clientesExistentes,
    pesquisaClientes,
    filtroPessoaClientes,
    filtroTipoClientes,
    filtroSituacaoClientes,
    quantidadeFiltrosClientes,
  ])

  function limparFiltrosClientes() {
    setFiltroPessoaClientes('TODAS')
    setFiltroTipoClientes('TODOS')
    setFiltroSituacaoClientes('TODAS')
  }

  function dinheiro(valor: number) {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const CODIGOS_IBGE_CLIENTE: Record<string, string> = {
    'RS|PORTO ALEGRE': '4314902',
  }

  function normalizarMunicipioIbge(valor: unknown) {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
  }

  function resolverCodigoIbgeCliente(cidade: unknown, estado: unknown, atual: unknown) {
    const codigoAtual = String(atual ?? '').replace(/\D/g, '')
    if (codigoAtual.length === 7) return codigoAtual
    const chave = `${String(estado ?? '').trim().toUpperCase()}|${normalizarMunicipioIbge(cidade)}`
    return CODIGOS_IBGE_CLIENTE[chave] || ''
  }

  useEffect(() => {
    let ativo = true
    void resolverCodigoIbgeMunicipio(c.cidade, c.estado, c.codigoIbgeMunicipio).then((codigo) => {
      if (!ativo || !codigo || codigo === c.codigoIbgeMunicipio) return
      setCliente((atual) => ({ ...atual, codigoIbgeMunicipio: codigo }))
    })
    return () => { ativo = false }
  }, [c.cidade, c.estado, c.codigoIbgeMunicipio])

  useEffect(() => {
    let ativo = true
    void resolverCodigoIbgeMunicipio(c.cidadeEntrega || c.cidade, c.estadoEntrega || c.estado, c.codigoIbgeMunicipioEntrega).then((codigo) => {
      if (!ativo || !codigo || codigo === c.codigoIbgeMunicipioEntrega) return
      setCliente((atual) => ({ ...atual, codigoIbgeMunicipioEntrega: codigo }))
    })
    return () => { ativo = false }
  }, [c.cidadeEntrega, c.estadoEntrega, c.cidade, c.estado, c.codigoIbgeMunicipioEntrega])

  function atualizarCliente(campo: string, valor: any) {
    if (campo === 'cnpj') valor = String(valor || '').replace(/\D/g, '').slice(0, 14)
    if (campo === 'cpf') valor = String(valor || '').replace(/\D/g, '').slice(0, 11)
    setCliente((atual) => {
      const proximo = { ...(atual as any), [campo]: valor } as any
      if (campo === 'cidade' || campo === 'estado') {
        proximo.codigoIbgeMunicipio = resolverCodigoIbgeCliente(
          campo === 'cidade' ? valor : proximo.cidade,
          campo === 'estado' ? valor : proximo.estado,
          proximo.codigoIbgeMunicipio,
        )
      }
      if (campo === 'cidadeEntrega' || campo === 'estadoEntrega') {
        proximo.codigoIbgeMunicipioEntrega = resolverCodigoIbgeCliente(
          campo === 'cidadeEntrega' ? valor : proximo.cidadeEntrega,
          campo === 'estadoEntrega' ? valor : proximo.estadoEntrega,
          proximo.codigoIbgeMunicipioEntrega,
        )
      }
      return proximo as Cliente
    })
  }

  function copiarEnderecoFiscalParaEntrega(marcado: boolean) {
    setCliente((atual) => ({
      ...(atual as any),
      mesmoEnderecoFiscal: marcado,
      cepEntrega: marcado ? (atual as any).cep || '' : (atual as any).cepEntrega || '',
      enderecoEntrega: marcado ? (atual as any).endereco || '' : (atual as any).enderecoEntrega || '',
      numeroEntrega: marcado ? (atual as any).numero || '' : (atual as any).numeroEntrega || '',
      complementoEntrega: marcado ? (atual as any).complemento || '' : (atual as any).complementoEntrega || '',
      bairroEntrega: marcado ? (atual as any).bairro || '' : (atual as any).bairroEntrega || '',
      cidadeEntrega: marcado ? (atual as any).cidade || '' : (atual as any).cidadeEntrega || '',
      estadoEntrega: marcado ? (atual as any).estado || '' : (atual as any).estadoEntrega || '',
      codigoIbgeMunicipioEntrega: marcado ? resolverCodigoIbgeCliente((atual as any).cidade, (atual as any).estado, (atual as any).codigoIbgeMunicipio) : (atual as any).codigoIbgeMunicipioEntrega || '',
      paisEntrega: marcado ? (atual as any).pais || 'Brasil' : (atual as any).paisEntrega || 'Brasil',
    }) as Cliente)
  }

  async function buscarCnpj() {
    const cnpjLimpo = String(c.cnpj || '').replace(/\D/g, '')

    if (cnpjLimpo.length !== 14) {
      alert(`O CNPJ está incompleto: foram informados ${cnpjLimpo.length} de 14 números.`)
      return
    }

    try {
      setBuscandoCnpj(true)
      const data = await consultarCnpj(cnpjLimpo)

      setCliente((atual) => ({
        ...(atual as any),
        tipoPessoa: 'Jurídica',
        cnpj: data.cnpj || cnpjLimpo,
        cpfCnpj: data.cnpj || cnpjLimpo,
        cnpjCpf: data.cnpj || cnpjLimpo,
        documento: data.cnpj || cnpjLimpo,
        razaoSocial: data.razaoSocial || (atual as any).razaoSocial,
        nomeFantasia: data.nomeFantasia || (atual as any).nomeFantasia,
        cep: data.cep || (atual as any).cep,
        endereco: data.logradouro || (atual as any).endereco,
        numero: data.numero || (atual as any).numero,
        complemento: data.complemento || (atual as any).complemento,
        bairro: data.bairro || (atual as any).bairro,
        cidade: data.municipio || (atual as any).cidade,
        estado: data.uf || (atual as any).estado,
        codigoIbgeMunicipio: data.codigoIbgeMunicipio || resolverCodigoIbgeCliente(
          data.municipio || (atual as any).cidade,
          data.uf || (atual as any).estado,
          (atual as any).codigoIbgeMunicipio,
        ),
        telefone: data.telefone || (atual as any).telefone,
        email: data.email || (atual as any).email,
        pais: 'Brasil',
        situacao: data.situacaoCadastral.toUpperCase() === 'ATIVA'
          ? 'Ativo'
          : (data.situacaoCadastral ? 'Inativo' : (atual as any).situacao),
        caracteristicas: data.cnaePrincipalDescricao || (atual as any).caracteristicas,
      }) as Cliente)
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível buscar o CNPJ.')
    } finally {
      setBuscandoCnpj(false)
    }
  }

  function buscarCpf() {
    alert(
      'A consulta automática de CPF na Receita não é pública como a de CNPJ. Podemos deixar este botão preparado para uma API paga/autorizada depois.'
    )
  }

  async function buscarCepEntrega() {
    const cepLimpo = String(c.cepEntrega || '').replace(/\D/g, '')

    if (cepLimpo.length !== 8) {
      alert('Digite um CEP válido com 8 números.')
      return
    }

    try {
      setBuscandoCepEntrega(true)

      const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data = await resposta.json()

      if (data.erro) {
        throw new Error('CEP não encontrado')
      }

      setCliente((atual) => ({
        ...(atual as any),
        enderecoEntrega: data.logradouro || c.enderecoEntrega,
        bairroEntrega: data.bairro || c.bairroEntrega,
        cidadeEntrega: data.localidade || c.cidadeEntrega,
        estadoEntrega: data.uf || c.estadoEntrega,
        codigoIbgeMunicipioEntrega: resolverCodigoIbgeCliente(data.localidade || c.cidadeEntrega, data.uf || c.estadoEntrega, (atual as any).codigoIbgeMunicipioEntrega),
        paisEntrega: 'Brasil',
      }) as Cliente)
    } catch {
      alert('Não foi possível buscar o CEP.')
    } finally {
      setBuscandoCepEntrega(false)
    }
  }

  async function prepararClienteComCodigoIbge(clienteAtual: Cliente): Promise<Cliente> {
    const atual: any = clienteAtual
    const cnpj = String(atual.cnpj || '').replace(/\D/g, '')
    const tipoPessoa = String(atual.tipoPessoa || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
    if (tipoPessoa.includes('JURID') && cnpj.length !== 14) {
      throw new Error('O CNPJ precisa conter exatamente 14 números.')
    }
    if (tipoPessoa.includes('JURID') && !cnpjTemDigitosValidos(cnpj)) {
      throw new Error('Os dígitos verificadores do CNPJ não conferem.')
    }
    const codigoFiscal = await resolverCodigoIbgeMunicipio(atual.cidade, atual.estado, atual.codigoIbgeMunicipio)
    const codigoEntrega = await resolverCodigoIbgeMunicipio(
      atual.cidadeEntrega || atual.cidade,
      atual.estadoEntrega || atual.estado,
      atual.codigoIbgeMunicipioEntrega || codigoFiscal,
    )
    return {
      ...atual,
      cnpj,
      cpfCnpj: cnpj,
      cnpjCpf: cnpj,
      documento: cnpj,
      consumidorFinal: atual.consumidorFinal ?? true,
      codigoIbgeMunicipio: codigoFiscal,
      codigoIbgeMunicipioEntrega: codigoEntrega,
    } as Cliente
  }

  async function salvarCliente() {
    try {
      const clienteComIbge = await prepararClienteComCodigoIbge(cliente)
      setCliente(clienteComIbge)
      await salvarClienteStorageConfirmado(clienteComIbge)
      alert('Cliente salvo com sucesso!')
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível salvar o cliente no servidor.')
    }
  }

  async function salvarEFechar() {
    try {
      const clienteComIbge = await prepararClienteComCodigoIbge(cliente)
      setCliente(clienteComIbge)
      await salvarClienteStorageConfirmado(clienteComIbge)
      alert('Cliente salvo com sucesso!')
      navigate('/clientes')
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível salvar o cliente no servidor.')
    }
  }


  return (
    <main className="cliente-form-page">
      <Sidebar />

      <section className="cliente-form-main">
        <PageHeader
          category="Clientes"
          title={titulo}
          subtitle="Ficha cadastral completa do cliente."
        />

        <div className="clientes-toolbar cliente-form-toolbar">
          <div className="clientes-toolbar-left">
            <button
              type="button"
              title="Lista de clientes"
              aria-label="Lista de clientes"
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
                  '.cliente-form-toolbar .search-clientes input',
                )
                campo?.focus()
              }}
            >
              <Search size={24} strokeWidth={2.4} />
            </button>

            <div className="search-clientes cliente-form-search">
              <Search size={18} />

              <input
                type="text"
                placeholder="Pesquisar clientes..."
                value={pesquisaClientes}
                onChange={(e) => setPesquisaClientes(e.target.value)}
              />
            </div>

            <button
              type="button"
              title="Adicionar filtro"
              className={`clientes-filter-btn ${
                quantidadeFiltrosClientes > 0 ? 'ativo' : ''
              }`}
              onClick={() =>
                setMostrarFiltrosClientes((atual) => !atual)
              }
            >
              <Filter size={20} />
              {quantidadeFiltrosClientes > 0 && (
                <span>{quantidadeFiltrosClientes}</span>
              )}
            </button>
          </div>
        </div>

        {mostrarFiltrosClientes && (
          <section className="clientes-filter-panel cliente-form-filter-panel">
            <div className="clientes-filter-grid cliente-form-filter-grid">
              <label>
                Pessoa
                <select
                  value={filtroPessoaClientes}
                  onChange={(e) => setFiltroPessoaClientes(e.target.value)}
                >
                  <option value="TODAS">Todas</option>
                  <option value="Jurídica">Jurídica</option>
                  <option value="Física">Física</option>
                </select>
              </label>

              <label>
                Tipo / Lista de Preços
                <select
                  value={filtroTipoClientes}
                  onChange={(e) => setFiltroTipoClientes(e.target.value)}
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
                Situação
                <select
                  value={filtroSituacaoClientes}
                  onChange={(e) => setFiltroSituacaoClientes(e.target.value)}
                >
                  <option value="TODAS">Todas</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </label>
            </div>

            <div className="clientes-filter-footer">
              <span>
                {clientesEncontradosNaBusca.length} cliente(s) localizado(s)
              </span>

              <button
                type="button"
                className="clientes-clear-filters-btn"
                onClick={limparFiltrosClientes}
                disabled={quantidadeFiltrosClientes === 0}
              >
                Limpar filtros
              </button>
            </div>
          </section>
        )}

        {clientesEncontradosNaBusca.length > 0 && (
          <section className="cliente-form-search-results">
            <div className="cliente-form-search-results-header">
              <strong>Clientes encontrados</strong>
              <span>
                Clique em um cliente para abrir o cadastro existente.
              </span>
            </div>

            <div className="cliente-form-search-results-list">
              {clientesEncontradosNaBusca.map((item) => (
                <button
                  type="button"
                  key={String(item.codigo)}
                  onClick={() =>
                    navigate(`/clientes/editar/${item.codigo}`)
                  }
                >
                  <span>
                    <strong>
                      {item.razaoSocial ||
                        item.nomeFantasia ||
                        'Cliente sem nome'}
                    </strong>
                    <small>
                      {item.cnpj || item.cpf || 'Sem documento'}
                    </small>
                  </span>

                  <em>{item.cidade || '-'}</em>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="form-card">
          <div className="form-tabs">
            <button
              className={abaAtiva === 'geral' ? 'active' : ''}
              onClick={() => setAbaAtiva('geral')}
            >
              DADOS GERAIS
            </button>

            <button
              className={abaAtiva === 'contato' ? 'active' : ''}
              onClick={() => setAbaAtiva('contato')}
            >
              CONTATOS
            </button>

            <button
              className={abaAtiva === 'endereco' ? 'active' : ''}
              onClick={() => setAbaAtiva('endereco')}
            >
              ENDEREÇOS
            </button>

            <button
              className={abaAtiva === 'fiscal' ? 'active' : ''}
              onClick={() => setAbaAtiva('fiscal')}
            >
              DADOS FISCAIS
            </button>

            <button
              className={abaAtiva === 'credito' ? 'active' : ''}
              onClick={() => setAbaAtiva('credito')}
            >
              CRÉDITO
            </button>

            <button
              className={abaAtiva === 'historico' ? 'active' : ''}
              onClick={() => setAbaAtiva('historico')}
            >
              HISTÓRICO
            </button>
          </div>

          {abaAtiva === 'geral' && (
            <div className="form-grid">
              <label>
                Código
                <input
                  value={c.codigo || ''}
                  onChange={(e) => atualizarCliente('codigo', e.target.value)}
                />
              </label>

              <div className="form-field">
  <span>Pessoa</span>
  <button
    type="button"
    className={`switch-button ${c.tipoPessoa === 'Jurídica' ? 'active' : ''}`}
    onClick={() =>
      atualizarCliente(
        'tipoPessoa',
        c.tipoPessoa === 'Jurídica' ? 'Física' : 'Jurídica'
      )
    }
  >
    <span></span>
  </button>
  <small>{c.tipoPessoa || 'Jurídica'}</small>
</div>

              <div className="form-field">
                <span>Situação</span>
                <button
                  type="button"
                  className={`switch-button ${c.situacao === 'Ativo' ? 'active' : ''}`}
                  onClick={() =>
                    atualizarCliente(
                      'situacao',
                      c.situacao === 'Ativo' ? 'Inativo' : 'Ativo'
                    )
                  }
                >
                  <span></span>
                </button>
                <small>{c.situacao || 'Ativo'}</small>
              </div>

              <div className="form-field">
                <span>Bloqueado</span>
                <button
                  type="button"
                  className={`switch-button switch-small ${c.bloqueado ? 'active' : ''}`}
                  onClick={() => atualizarCliente('bloqueado', !c.bloqueado)}
                >
                  <span></span>
                </button>
                <small>{c.bloqueado ? 'Sim' : 'Não'}</small>
              </div>

              <label>
                Tipo / Lista de Preços
                <select
                  value={c.tipo || 'Padrão'}
                  onChange={(e) => atualizarCliente('tipo', e.target.value)}
                >
                  <option>Padrão</option>
                  <option>Condomínios</option>
                  <option>Revenda</option>
                  <option>Especial</option>
                  <option>Atacado</option>
                </select>
              </label>

              <label className="span-2">
                Razão Social / Nome
                <input
                  value={c.razaoSocial || ''}
                  onChange={(e) => atualizarCliente('razaoSocial', e.target.value)}
                />
              </label>

              <label className="span-2">
                Nome Fantasia
                <input
                  value={c.nomeFantasia || ''}
                  onChange={(e) => atualizarCliente('nomeFantasia', e.target.value)}
                />
              </label>

              <div className="form-field">
                <span>CNPJ</span>
                <div className="select-plus">
                  <input
                    value={c.cnpj || ''}
                    onChange={(e) => atualizarCliente('cnpj', e.target.value)}
                    inputMode="numeric"
                    maxLength={14}
                  />
                  <button type="button" onClick={buscarCnpj}>
                    {buscandoCnpj ? '...' : <Search size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-field">
                <span>CPF</span>
                <div className="select-plus">
                  <input
                    value={c.cpf || ''}
                    onChange={(e) => atualizarCliente('cpf', e.target.value)}
                  />
                  <button type="button" onClick={buscarCpf}>
                    <Search size={18} />
                  </button>
                </div>
              </div>

              <label className="span-2">
                Características / Observações
                <textarea
                  value={c.caracteristicas || ''}
                  onChange={(e) =>
                    atualizarCliente('caracteristicas', e.target.value)
                  }
                />
              </label>
            </div>
          )}

          {abaAtiva === 'contato' && (
            <div className="form-grid">
              <label className="span-2">
                Responsável
                <input
                  value={c.responsavel || ''}
                  onChange={(e) => atualizarCliente('responsavel', e.target.value)}
                />
              </label>

              <label>
                Telefone
                <input
                  value={c.telefone || ''}
                  onChange={(e) => atualizarCliente('telefone', e.target.value)}
                />
              </label>

              <label>
                Celular / WhatsApp
                <input
                  value={c.celularWhatsapp || c.celular || ''}
                  onChange={(e) => {
                    atualizarCliente('celularWhatsapp', e.target.value)
                    atualizarCliente('celular', e.target.value)
                  }}
                />
              </label>

              <label className="span-2">
                E-mail
                <input
                  type="email"
                  value={c.email || ''}
                  onChange={(e) => atualizarCliente('email', e.target.value)}
                />
              </label>

              <label className="span-2">
                Horário de Entrega
                <input
                  value={c.horarioEntrega || ''}
                  placeholder="Ex: Segunda a sexta, das 8h às 12h"
                  onChange={(e) => atualizarCliente('horarioEntrega', e.target.value)}
                />
              </label>
            </div>
          )}

          {abaAtiva === 'endereco' && (
            <div className="endereco-tab">
              <div className="form-grid endereco-principal-grid">
              <h3 className="span-2">Endereço Fiscal</h3>

              <label>
                CEP
                <input
                  value={c.cep || ''}
                  onChange={(e) => atualizarCliente('cep', e.target.value)}
                />
              </label>

              <label>
                Estado
                <input
                  value={c.estado || ''}
                  onChange={(e) => atualizarCliente('estado', e.target.value)}
                />
              </label>

              <label>
                Cidade
                <input
                  value={c.cidade || ''}
                  onChange={(e) => atualizarCliente('cidade', e.target.value)}
                />
              </label>

              <label>
                Código IBGE do Município
                <input
                  value={c.codigoIbgeMunicipio || ''}
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="7 dígitos"
                  onChange={(e) =>
                    atualizarCliente(
                      'codigoIbgeMunicipio',
                      e.target.value.replace(/\D/g, '').slice(0, 7),
                    )
                  }
                />
              </label>

              <label className="span-2">
                Endereço
                <input
                  value={c.endereco || ''}
                  onChange={(e) => atualizarCliente('endereco', e.target.value)}
                />
              </label>

              <label>
                Número
                <input
                  value={c.numero || ''}
                  onChange={(e) => atualizarCliente('numero', e.target.value)}
                />
              </label>

              <label>
                Complemento
                <input
                  value={c.complemento || ''}
                  onChange={(e) => atualizarCliente('complemento', e.target.value)}
                />
              </label>

              <label>
                Bairro
                <input
                  value={c.bairro || ''}
                  onChange={(e) => atualizarCliente('bairro', e.target.value)}
                />
              </label>

              <label>
                País
                <input
                  value={c.pais || 'Brasil'}
                  onChange={(e) => atualizarCliente('pais', e.target.value)}
                />
              </label>

              <div className="span-2 checkbox-line">
                <input
                  type="checkbox"
                  checked={!!c.mesmoEnderecoFiscal}
                  onChange={(e) => copiarEnderecoFiscalParaEntrega(e.target.checked)}
                />
                <span>Endereço de entrega é o mesmo endereço fiscal</span>
              </div>

              <h3 className="span-2">Endereço de Entrega</h3>

              <div className="form-field">
                <span>CEP Entrega</span>
                <div className="select-plus">
                  <input
                    value={c.cepEntrega || ''}
                    onChange={(e) => atualizarCliente('cepEntrega', e.target.value)}
                    disabled={!!c.mesmoEnderecoFiscal}
                  />
                  <button
                    type="button"
                    onClick={buscarCepEntrega}
                    disabled={!!c.mesmoEnderecoFiscal}
                  >
                    {buscandoCepEntrega ? '...' : <Search size={18} />}
                  </button>
                </div>
              </div>

              <label>
                Estado Entrega
                <input
                  value={c.estadoEntrega || ''}
                  onChange={(e) => atualizarCliente('estadoEntrega', e.target.value)}
                  disabled={!!c.mesmoEnderecoFiscal}
                />
              </label>

              <label>
                Cidade Entrega
                <input
                  value={c.cidadeEntrega || ''}
                  onChange={(e) => atualizarCliente('cidadeEntrega', e.target.value)}
                  disabled={!!c.mesmoEnderecoFiscal}
                />
              </label>

              <label>
                Código IBGE da Entrega
                <input
                  value={c.codigoIbgeMunicipioEntrega || ''}
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="7 dígitos"
                  onChange={(e) =>
                    atualizarCliente(
                      'codigoIbgeMunicipioEntrega',
                      e.target.value.replace(/\D/g, '').slice(0, 7),
                    )
                  }
                  disabled={!!c.mesmoEnderecoFiscal}
                />
              </label>

              <label className="span-2">
                Endereço Entrega
                <input
                  value={c.enderecoEntrega || ''}
                  onChange={(e) => atualizarCliente('enderecoEntrega', e.target.value)}
                  disabled={!!c.mesmoEnderecoFiscal}
                />
              </label>

              <label>
                Número Entrega
                <input
                  value={c.numeroEntrega || ''}
                  onChange={(e) => atualizarCliente('numeroEntrega', e.target.value)}
                  disabled={!!c.mesmoEnderecoFiscal}
                />
              </label>

              <label>
                Complemento Entrega
                <input
                  value={c.complementoEntrega || ''}
                  onChange={(e) =>
                    atualizarCliente('complementoEntrega', e.target.value)
                  }
                  disabled={!!c.mesmoEnderecoFiscal}
                />
              </label>

              <label>
                Bairro Entrega
                <input
                  value={c.bairroEntrega || ''}
                  onChange={(e) => atualizarCliente('bairroEntrega', e.target.value)}
                  disabled={!!c.mesmoEnderecoFiscal}
                />
              </label>

              <label>
                País Entrega
                <input
                  value={c.paisEntrega || 'Brasil'}
                  onChange={(e) => atualizarCliente('paisEntrega', e.target.value)}
                  disabled={!!c.mesmoEnderecoFiscal}
                />
              </label>
              </div>

              <section className="locais-entrega-cadastro">
                <div className="locais-entrega-cabecalho">
                  <button
                    type="button"
                    className="locais-entrega-toggle"
                    aria-expanded={locaisEntregaAbertos}
                    onClick={() => setLocaisEntregaAbertos((aberto) => !aberto)}
                  >
                    <span><h3>Locais de entrega</h3><small>{enderecosEntrega.length} {enderecosEntrega.length === 1 ? 'local cadastrado' : 'locais cadastrados'}</small></span>
                    {locaisEntregaAbertos ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  <button type="button" className="locais-entrega-adicionar" onClick={adicionarEnderecoEntrega}><Plus size={17} /> Adicionar</button>
                </div>
                {locaisEntregaAbertos && <>
                  <div className="locais-entrega-lista">
                  {enderecosEntrega.map((endereco, indice) => <button type="button" key={endereco.id} className={indice === enderecoEntregaSelecionado ? 'ativo' : ''} onClick={() => setEnderecoEntregaSelecionado(indice)}><strong>{endereco.nomeLocal || `Local ${indice + 1}`}</strong><span>{formatarEnderecoEntrega(endereco) || 'Endereço ainda não preenchido'}</span><small>{endereco.emailEnvio || 'Usará o e-mail principal'} · {endereco.responsavel || 'Sem responsável'} · {endereco.ativo ? 'Ativo' : 'Inativo'}</small></button>)}
                  {!enderecosEntrega.length && <p>Nenhum local cadastrado. Clique em Adicionar.</p>}
                  </div>
                  {enderecoAtual && <div className="form-grid local-entrega-editor">
                  <label>Nome do local<input value={enderecoAtual.nomeLocal} onChange={(e) => atualizarEnderecoEntrega('nomeLocal', e.target.value)} placeholder="Matriz, Filial, Bloco A..." /></label>
                  <label>Tipo<select value={enderecoAtual.tipoLocal} onChange={(e) => atualizarEnderecoEntrega('tipoLocal', e.target.value)}><option>Residencial</option><option>Comercial</option><option>Outro</option></select></label>
                  <label>CEP<input value={enderecoAtual.cep} onChange={(e) => atualizarEnderecoEntrega('cep', e.target.value)} /></label><label>Logradouro<input value={enderecoAtual.logradouro} onChange={(e) => atualizarEnderecoEntrega('logradouro', e.target.value)} /></label>
                  <label>Número<input value={enderecoAtual.numero} onChange={(e) => atualizarEnderecoEntrega('numero', e.target.value)} /></label><label>Complemento<input value={enderecoAtual.complemento} onChange={(e) => atualizarEnderecoEntrega('complemento', e.target.value)} /></label>
                  <label>Bairro<input value={enderecoAtual.bairro} onChange={(e) => atualizarEnderecoEntrega('bairro', e.target.value)} /></label><label>Cidade<input value={enderecoAtual.cidade} onChange={(e) => atualizarEnderecoEntrega('cidade', e.target.value)} /></label>
                  <label>UF<input value={enderecoAtual.uf} maxLength={2} onChange={(e) => atualizarEnderecoEntrega('uf', e.target.value.toUpperCase())} /></label><label>Responsável<input value={enderecoAtual.responsavel} onChange={(e) => atualizarEnderecoEntrega('responsavel', e.target.value)} /></label>
                  <label>Telefone<input value={enderecoAtual.telefone} onChange={(e) => atualizarEnderecoEntrega('telefone', e.target.value)} /></label><label>Celular / WhatsApp<input value={enderecoAtual.celular} onChange={(e) => atualizarEnderecoEntrega('celular', e.target.value)} /></label>
                  <label>Horário de entrega<input value={enderecoAtual.horarioEntrega} onChange={(e) => atualizarEnderecoEntrega('horarioEntrega', e.target.value)} /></label><label>E-mail de envio<input type="email" value={enderecoAtual.emailEnvio} onChange={(e) => atualizarEnderecoEntrega('emailEnvio', e.target.value)} /></label>
                  <label className="span-2">E-mails em cópia (Cc)<input value={(enderecoAtual.emailsCopiaEnvio || []).join('; ')} onChange={(e) => atualizarEnderecoEntrega('emailsCopiaEnvio', e.target.value.split(/[;,\n]+/).map((email) => email.trim()).filter(Boolean) as any)} placeholder="email1@empresa.com.br; email2@empresa.com.br" /></label>
                  <label className="span-2">Observações<textarea rows={3} value={enderecoAtual.observacoes} onChange={(e) => atualizarEnderecoEntrega('observacoes', e.target.value)} /></label>
                  <label className="checkbox-line"><input type="checkbox" checked={enderecoAtual.ativo} onChange={(e) => atualizarEnderecoEntrega('ativo', e.target.checked)} /> Local ativo</label><button type="button" className="danger-button" onClick={() => excluirEnderecoEntrega(enderecoEntregaSelecionado)}><Trash2 size={16} /> Excluir local</button>
                  </div>}
                </>}
              </section>
            </div>
          )}

          {abaAtiva === 'fiscal' && (
            <div className="form-grid">
              <label>
                Inscrição Estadual
                <input
                  value={c.inscricaoEstadual || ''}
                  onChange={(e) =>
                    atualizarCliente('inscricaoEstadual', e.target.value)
                  }
                />
              </label>

              <label>
                Inscrição Municipal
                <input
                  value={c.inscricaoMunicipal || ''}
                  onChange={(e) =>
                    atualizarCliente('inscricaoMunicipal', e.target.value)
                  }
                />
              </label>

              <label className="span-2">
                Indicador IE
                <select
                  value={c.indicadorIE || ''}
                  onChange={(e) => atualizarCliente('indicadorIE', e.target.value)}
                >
                  <option value="">Selecione</option>
                  <option>Contribuinte do ICMS</option>
                  <option>Contribuinte isento de inscrição</option>
                  <option>Não contribuinte</option>
                </select>
              </label>

              <div className="form-field">
                <span>Consumidor Final?</span>
                <button
                  type="button"
                  className={`switch-button ${c.consumidorFinal ? 'active' : ''}`}
                  onClick={() =>
                    atualizarCliente('consumidorFinal', !c.consumidorFinal)
                  }
                >
                  <span></span>
                </button>
                <small>{c.consumidorFinal ? 'Sim' : 'Não'}</small>
              </div>

              <div className="form-field">
                <span>ISS Retido na Fonte?</span>
                <button
                  type="button"
                  className={`switch-button ${c.issRetidoFonte ? 'active' : ''}`}
                  onClick={() =>
                    atualizarCliente('issRetidoFonte', !c.issRetidoFonte)
                  }
                >
                  <span></span>
                </button>
                <small>{c.issRetidoFonte ? 'Sim' : 'Não'}</small>
              </div>

              <div className="form-field">
                <span>Produtor Rural?</span>
                <button
                  type="button"
                  className={`switch-button ${c.produtorRural ? 'active' : ''}`}
                  onClick={() =>
                    atualizarCliente('produtorRural', !c.produtorRural)
                  }
                >
                  <span></span>
                </button>
                <small>{c.produtorRural ? 'Sim' : 'Não'}</small>
              </div>

              <label className="span-2">
                E-mail do Destinatário da NFe
                <input
                  type="email"
                  value={c.email || ''}
                  onChange={(e) => atualizarCliente('email', e.target.value)}
                />
              </label>
            </div>
          )}

          {abaAtiva === 'credito' && (
            <div className="credit-area">
              <div className="credit-summary">
                <div>
                  <span>Total Vencidas</span>
                  <strong>{dinheiro(Number(c.totalVencidas || 0))}</strong>
                </div>

                <div>
                  <span>Total a Vencer</span>
                  <strong>{dinheiro(Number(c.totalAVencer || 0))}</strong>
                </div>

                <div>
                  <span>Total Pagas</span>
                  <strong>{dinheiro(Number(c.totalPagas || 0))}</strong>
                </div>

                <div>
                  <span>Limite de Crédito</span>
                  <input
  className="credit-input"
  type="text"
  value={Number(c.limiteCredito || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })}
  onChange={(e) => {
    const somenteNumeros = e.target.value.replace(/\D/g, '')
    const valor = Number(somenteNumeros) / 100

    atualizarCliente('limiteCredito', valor)
  }}
                  />
                </div>

                <div>
                  <span>Limite Utilizado</span>
                  <strong>{dinheiro(limiteUtilizado)}</strong>
                </div>

                <div>
                  <span>Limite Disponível</span>
                  <strong>{dinheiro(limiteDisponivel)}</strong>
                </div>
              </div>

              <div className="credit-alert">
                Os totais serão atualizados automaticamente conforme os pedidos
                forem realizados pelo cliente.
              </div>
            </div>
          )}

          {abaAtiva === 'historico' && (
            <div className="history-area">
              {modo === 'editar' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <button type="button" className="save-button" onClick={() => navigate(`/clientes/historico/${c.codigo}`)}>
                    Abrir histórico comercial completo
                  </button>
                </div>
              )}
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Nº Pedido</th>
                    <th>Status</th>
                    <th>Pagamento</th>
                    <th>Valor Total</th>
                    <th>Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {c.pedidos && c.pedidos.length > 0 ? (
                    c.pedidos.map((pedido: any, index: number) => (
                      <tr key={index}>
                        <td>{pedido.data || '-'}</td>
                        <td>{pedido.numero || '-'}</td>
                        <td>{pedido.status || '-'}</td>
                        <td>{pedido.pagamento || '-'}</td>
                        <td>{dinheiro(Number(pedido.valorTotal || 0))}</td>
                        <td>
                          <button type="button" className="save-secondary-button">
                            Visualizar
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
                        Nenhum pedido encontrado para este cliente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="form-footer">
<button
              type="button"
              className="save-secondary-button"
              onClick={salvarCliente}
            >
              <Save size={18} />
              Salvar
            </button>

            <button type="button" className="save-button" onClick={salvarEFechar}>
              <SaveAll size={18} />
              Salvar e Fechar
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

export default ClienteForm
