import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  FileSearch,
  FileUp,
  Filter,
  List,
  Link2,
  Printer,
  Search,
  X,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import { listarProdutosAtivosStorage } from '../../services/produtosStorage'
import {
  contarVinculosProdutosHistoricos,
  importarPedidosHistoricosNFeStorage,
  listarPendenciasProdutosHistoricos,
  obterUltNSUNFeEmitidasStorage,
  salvarUltNSUNFeEmitidasStorage,
  vincularAutomaticamenteProdutosHistoricosStorage,
  vincularProdutoHistoricoStorage,
  type PendenciaProdutoHistorico,
  type AmbienteNFeEmitidas,
  type ResultadoImportacaoPedidosHistoricos,
} from '../../services/nfeEmitidasStorage'
import type { Venda } from '../../types/Venda'
import ImportarNfHistoricaModal from '../Vendas/ImportarNfHistoricaModal'

import '../../styles/fiscal.css'
import '../../styles/fiscal-nfe-emitidas.css'

const API_BACKEND = ''

type RespostaNFeEmitidas = {
  ok: boolean
  codigo?: string
  mensagem: string
  pedidos?: Venda[]
  totalPedidosHistoricos?: number
  rejeitados?: Array<{
    indice: number
    motivo: string
  }>
  ultNSU?: string
  maxNSU?: string
  lotesConsultados?: number
  movimentouEstoque?: boolean
  cnpjConsultado?: string
  documentosRecebidos?: number
  xmlCompletos?: number
  resumosNFe?: number
  eventosRecebidos?: number
  outrosDocumentos?: number
  documentosOutroEmitente?: number
  nsuAvancou?: boolean
  ambienteConsulta?: string
  proximaConsultaEm?: string | null
  servidorAgora?: string
  chamadaSefazExecutada?: boolean
}

type ResumoUltimaImportacao = ResultadoImportacaoPedidosHistoricos & {
  origem: 'SEFAZ' | 'XML'
  rejeitados: number
}

type DocumentoDFeMysql = {
  id: string
  ambiente: string
  nsu: string
  schema: string
  tipo: 'XML_COMPLETO' | 'RESUMO_NFE' | 'RESUMO_EVENTO' | 'EVENTO_COMPLETO' | 'OUTRO'
  chave: string
  numero: string
  serie: string
  emitenteNome: string
  emitenteDocumento: string
  emissao: string
  valor: number
  protocolo: string
  cStat: string
  motivo: string
  recebidoEm: string
  xmlCompleto: boolean
}

type RespostaDocumentosMysql = {
  ok: boolean
  mensagem: string
  documentos?: DocumentoDFeMysql[]
  chamadaSefazExecutada?: boolean
}

function formatarCnpj(valor?: string) {
  const numeros = String(valor || '').replace(/\D/g, '').slice(0, 14)
  if (numeros.length !== 14) return valor || '-'
  return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

function formatarAmbiente(valor?: string) {
  return String(valor || '').toUpperCase() === 'PRODUCAO' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'
}

function Fiscal() {
  const navigate = useNavigate()
  const inputXmlRef = useRef<HTMLInputElement | null>(null)

  const [mostrarImportacaoEmitidas, setMostrarImportacaoEmitidas] =
    useState(false)
  const [sincronizandoEmitidas, setSincronizandoEmitidas] =
    useState(false)
  const [importandoXml, setImportandoXml] = useState(false)
  const [modalNfHistorica, setModalNfHistorica] = useState(false)
  const [pendencias, setPendencias] = useState<
    PendenciaProdutoHistorico[]
  >(() => listarPendenciasProdutosHistoricos())
  const [selecoes, setSelecoes] = useState<Record<string, string>>({})
  const [resumoUltimaImportacao, setResumoUltimaImportacao] =
    useState<ResumoUltimaImportacao | null>(null)
  const [mensagemImportacao, setMensagemImportacao] = useState('')
  const [diagnosticoSefaz, setDiagnosticoSefaz] = useState<RespostaNFeEmitidas | null>(null)
  const [proximaConsultaSefaz, setProximaConsultaSefaz] = useState<string | null>(null)
  const [agoraSefaz, setAgoraSefaz] = useState(() => Date.now())
  const [buscaEmitidas, setBuscaEmitidas] = useState('')
  const [buscaEmitidasDigitada, setBuscaEmitidasDigitada] = useState('')
  const [mostrarFiltrosEmitidas, setMostrarFiltrosEmitidas] = useState(false)
  const [ocorrenciasMinimas, setOcorrenciasMinimas] = useState('')
  const [ambienteNFeEmitidas, setAmbienteNFeEmitidas] =
    useState<AmbienteNFeEmitidas>('HOMOLOGACAO')
  const [documentosMysql, setDocumentosMysql] = useState<DocumentoDFeMysql[]>([])
  const [carregandoDocumentos, setCarregandoDocumentos] = useState(false)
  const [erroDocumentos, setErroDocumentos] = useState('')

  async function carregarDocumentosMysql() {
    if (carregandoDocumentos) return
    setCarregandoDocumentos(true)
    setErroDocumentos('')
    try {
      const resposta = await fetch(
        `${API_BACKEND}/api/fiscal/nfe-emitidas.php?action=listar-documentos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ambiente: ambienteNFeEmitidas }),
        },
      )
      const dados = (await resposta.json()) as RespostaDocumentosMysql
      if (!resposta.ok || !dados.ok) {
        throw new Error(dados.mensagem || 'Não foi possível carregar os documentos do MySQL.')
      }
      setDocumentosMysql(Array.isArray(dados.documentos) ? dados.documentos : [])
    } catch (error) {
      setErroDocumentos(error instanceof Error ? error.message : 'Erro ao carregar documentos do MySQL.')
    } finally {
      setCarregandoDocumentos(false)
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setAgoraSefaz(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let ativo = true

    async function carregarEstadoLocalSefaz() {
      try {
        const resposta = await fetch(
          `${API_BACKEND}/api/fiscal/nfe-emitidas.php?action=estado`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ambiente: ambienteNFeEmitidas }),
          },
        )
        const dados = (await resposta.json()) as RespostaNFeEmitidas
        if (!ativo || !resposta.ok) return
        setDiagnosticoSefaz(dados)
        setProximaConsultaSefaz(dados.proximaConsultaEm || null)
        await carregarDocumentosMysql()
      } catch {
        // Esta leitura é apenas local. Falhas não disparam consulta à SEFAZ.
      }
    }

    carregarEstadoLocalSefaz()
    return () => { ativo = false }
  }, [ambienteNFeEmitidas])

  const consultaSefazBloqueada = Boolean(
    proximaConsultaSefaz &&
      new Date(proximaConsultaSefaz).getTime() > agoraSefaz,
  )


  const pendenciasFiltradas = useMemo(() => {
    const termo = buscaEmitidas.trim().toLowerCase()
    const minimo = Number(ocorrenciasMinimas || 0)

    return pendencias.filter((pendencia) => {
      const bateBusca =
        !termo ||
        String(pendencia.codigoHistorico || '').toLowerCase().includes(termo) ||
        String(pendencia.descricaoHistorica || '').toLowerCase().includes(termo)

      const bateOcorrencias =
        !minimo || Number(pendencia.ocorrencias || 0) >= minimo

      return bateBusca && bateOcorrencias
    })
  }, [buscaEmitidas, ocorrenciasMinimas, pendencias])

  const quantidadeFiltrosEmitidas = useMemo(
    () => [Boolean(ocorrenciasMinimas)].filter(Boolean).length,
    [ocorrenciasMinimas],
  )

  function executarBuscaEmitidas() {
    setBuscaEmitidas(buscaEmitidasDigitada.trim())
  }

  function limparFiltrosEmitidas() {
    setOcorrenciasMinimas('')
  }

  const produtos = useMemo(
    () =>
      listarProdutosAtivosStorage()
        .slice()
        .sort((a, b) =>
          String(a.descricao || '').localeCompare(
            String(b.descricao || ''),
            'pt-BR',
          ),
        ),
    [pendencias],
  )

  const totalVinculosSalvos = useMemo(
    () => contarVinculosProdutosHistoricos(),
    [pendencias],
  )

  function atualizarPendencias() {
    vincularAutomaticamenteProdutosHistoricosStorage()
    setPendencias(listarPendenciasProdutosHistoricos())
  }

  function abrirImportacaoEmitidas() {
    setMostrarImportacaoEmitidas(true)
    atualizarPendencias()

    setTimeout(() => {
      document
        .getElementById('fiscal-nfe-emitidas')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
    }, 50)
  }

  function aplicarResultadoImportacao(
    dados: RespostaNFeEmitidas,
    origem: 'SEFAZ' | 'XML',
  ) {
    const resultado = importarPedidosHistoricosNFeStorage(
      dados.pedidos || [],
    )

    if (origem === 'SEFAZ' && dados.ultNSU) {
      salvarUltNSUNFeEmitidasStorage(dados.ultNSU, ambienteNFeEmitidas)
    }

    const rejeitados = dados.rejeitados?.length || 0

    setResumoUltimaImportacao({
      ...resultado,
      origem,
      rejeitados,
    })

    atualizarPendencias()
    void carregarDocumentosMysql()

    setMensagemImportacao(
      `Importação concluída. ${resultado.importados} pedido(s) histórico(s) criado(s), ` +
        `${resultado.duplicados} duplicado(s) ignorado(s) e ` +
        `${resultado.itensPendentes} item(ns) aguardando vínculo de produto.`,
    )
  }

  async function sincronizarNFeEmitidas() {
    if (sincronizandoEmitidas) return

    if (ambienteNFeEmitidas === 'PRODUCAO') {
      const confirmou = window.confirm(
        'ATENÇÃO: você consultará documentos fiscais reais no ambiente de PRODUÇÃO.\n\n' +
          'Os pedidos serão criados como históricos e não movimentarão estoque nem financeiro automaticamente.\n\n' +
          'Deseja continuar?',
      )

      if (!confirmou) return
    }

    setSincronizandoEmitidas(true)
    setMensagemImportacao(
      `Consultando NF-e emitidas em ${ambienteNFeEmitidas === 'PRODUCAO' ? 'Produção' : 'Homologação'}...`,
    )

    const controlador = new AbortController()
    const limiteEspera = window.setTimeout(() => controlador.abort(), 220000)

    try {
      const resposta = await fetch(
        `${API_BACKEND}/api/fiscal/nfe-emitidas.php?action=sincronizar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controlador.signal,
          body: JSON.stringify({
            ultNSU: obterUltNSUNFeEmitidasStorage(ambienteNFeEmitidas),
            limiteLotes: ambienteNFeEmitidas === 'PRODUCAO' ? 1 : 3,
            ambiente: ambienteNFeEmitidas,
          }),
        },
      )

      const dados =
        (await resposta.json()) as RespostaNFeEmitidas

      setDiagnosticoSefaz(dados)
      setProximaConsultaSefaz(dados.proximaConsultaEm || null)

      if (!resposta.ok || !dados.ok) {
        if (dados.codigo === 'CERTIFICADO_A1_NAO_CONFIGURADO') {
          setMensagemImportacao(
            'O certificado digital A1 ainda não está configurado no backend. ' +
              'A importação por XML continua disponível e não movimenta estoque.',
          )
          return
        }
        setMensagemImportacao(dados.mensagem || 'Erro ao consultar NF-e emitidas.')
        return
      }

      aplicarResultadoImportacao(dados, 'SEFAZ')
    } catch (error) {
      const expirouNoNavegador =
        error instanceof DOMException && error.name === 'AbortError'
      setMensagemImportacao(
        expirouNoNavegador
          ? 'A consulta excedeu o tempo máximo de espera. Não clique novamente imediatamente; verifique o retorno técnico antes de tentar outra consulta.'
          : error instanceof Error
            ? error.message
            : 'Erro ao consultar NF-e emitidas.',
      )
    } finally {
      window.clearTimeout(limiteEspera)
      setSincronizandoEmitidas(false)
    }
  }

  async function importarArquivosXml(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const arquivos = Array.from(event.target.files || [])

    event.target.value = ''

    if (arquivos.length === 0 || importandoXml) return

    setImportandoXml(true)
    setMensagemImportacao(
      `Lendo ${arquivos.length} arquivo(s) XML...`,
    )

    try {
      const xmls = await Promise.all(
        arquivos.map((arquivo) => arquivo.text()),
      )

      const resposta = await fetch(
        `${API_BACKEND}/api/fiscal/nfe-emitidas.php?action=importar-xml`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ xmls }),
        },
      )

      const dados =
        (await resposta.json()) as RespostaNFeEmitidas

      if (!resposta.ok || !dados.ok) {
        throw new Error(
          dados.mensagem ||
            'Erro ao importar XML de NF-e emitida.',
        )
      }

      aplicarResultadoImportacao(dados, 'XML')
    } catch (error) {
      setMensagemImportacao(
        error instanceof Error
          ? error.message
          : 'Erro ao importar XML de NF-e emitida.',
      )
    } finally {
      setImportandoXml(false)
    }
  }

  function atualizarSelecao(
    chaveHistorica: string,
    produtoCodigo: string,
  ) {
    setSelecoes((atual) => ({
      ...atual,
      [chaveHistorica]: produtoCodigo,
    }))
  }

  function vincularProduto(
    pendencia: PendenciaProdutoHistorico,
  ) {
    const produtoCodigo =
      selecoes[pendencia.chaveHistorica] || ''

    if (!produtoCodigo) {
      alert('Selecione o produto atual da Synergias.')
      return
    }

    try {
      vincularProdutoHistoricoStorage(
        pendencia.chaveHistorica,
        produtoCodigo,
      )

      setSelecoes((atual) => {
        const copia = { ...atual }
        delete copia[pendencia.chaveHistorica]
        return copia
      })

      atualizarPendencias()
      setMensagemImportacao(
        'Vínculo salvo. O de/para foi aplicado aos pedidos históricos já importados.',
      )
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o vínculo.',
      )
    }
  }

  return (
    <main className="fiscal-layout">
      <Sidebar />

      <section className="fiscal-page">
        <PageHeader
          category="Fiscal"
          title="Gestão Fiscal"
          subtitle="Documentos fiscais, entradas, NF-e e revisão tributária das operações da Synergias."
        />

        <section className="fiscal-cards">
          <button
            type="button"
            className="fiscal-card fiscal-card-ativo"
            onClick={abrirImportacaoEmitidas}
          >
            <div className="fiscal-card-icon">
              <CloudDownload size={24} />
            </div>

            <div>
              <strong>NF-e Emitidas / Pedidos Históricos</strong>
              <span>
                Importa notas emitidas pela Synergias e gera pedidos sem
                movimentar estoque.
              </span>
            </div>
          </button>

          <button
            type="button"
            className="fiscal-card fiscal-card-ativo"
            onClick={() => navigate('/fiscal/analise-entradas')}
          >
            <div className="fiscal-card-icon">
              <FileSearch size={24} />
            </div>

            <div>
              <strong>Análise Fiscal de Entradas</strong>
              <span>NCM, CEST, CST, CFOP, ICMS, ST e antecipação.</span>
            </div>
          </button>

          <button
            type="button"
            className="fiscal-card fiscal-card-ativo"
            onClick={() => navigate('/fiscal/nfe-recebidas')}
          >
            <div className="fiscal-card-icon">
              <ReceiptText size={24} />
            </div>

            <div>
              <strong>NF-e Recebidas</strong>
              <span>
                Consulta e conferência dos documentos fiscais de entrada.
              </span>
            </div>
          </button>


        </section>

        {mostrarImportacaoEmitidas && (
          <section
            id="fiscal-nfe-emitidas"
            className="fiscal-nfe-emitidas-card"
          >
            <div className="fiscal-nfe-emitidas-header">
              <div className="fiscal-nfe-emitidas-title">
                <div className="fiscal-nfe-emitidas-icon">
                  <ReceiptText size={23} />
                </div>

                <div>
                  <h2>NF-e Emitidas / Pedidos Históricos</h2>
                  <p>
                    Gera pedidos históricos com a NF-e vinculada. A
                    importação nunca baixa estoque.
                  </p>
                </div>
              </div>

              <input
                ref={inputXmlRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                multiple
                hidden
                onChange={importarArquivosXml}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'end',
                gap: 16,
                flexWrap: 'wrap',
                padding: '14px 16px',
                marginBottom: 12,
                border: ambienteNFeEmitidas === 'PRODUCAO'
                  ? '1px solid #dc2626'
                  : '1px solid #cbd5e1',
                borderRadius: 12,
                background:
                  ambienteNFeEmitidas === 'PRODUCAO'
                    ? '#fef2f2'
                    : '#f8fafc',
              }}
            >
              <label
                style={{
                  display: 'grid',
                  gap: 6,
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                Ambiente da consulta
                <select
                  value={ambienteNFeEmitidas}
                  onChange={(event) => {
                    setAmbienteNFeEmitidas(
                      event.target.value as AmbienteNFeEmitidas,
                    )
                    setMensagemImportacao('')
                  }}
                  disabled={sincronizandoEmitidas}
                  style={{
                    minWidth: 210,
                    height: 42,
                    borderRadius: 9,
                    border: '1px solid #94a3b8',
                    padding: '0 12px',
                    background: '#fff',
                    fontWeight: 700,
                  }}
                >
                  <option value="HOMOLOGACAO">Homologação — testes</option>
                  <option value="PRODUCAO">Produção — documentos reais</option>
                </select>
              </label>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color:
                    ambienteNFeEmitidas === 'PRODUCAO'
                      ? '#b91c1c'
                      : '#475569',
                  fontWeight: 700,
                }}
              >
                {ambienteNFeEmitidas === 'PRODUCAO' ? (
                  <AlertTriangle size={20} />
                ) : (
                  <ShieldCheck size={20} />
                )}
                <span>
                  {ambienteNFeEmitidas === 'PRODUCAO'
                    ? 'Consulta fiscal real. Apenas 1 lote por clique; sem baixa automática de estoque ou financeiro.'
                    : 'Ambiente seguro para testes. Não contém o histórico fiscal real da empresa.'}
                </span>
              </div>
            </div>

            <div className="fiscal-nfe-toolbar">
              <div className="fiscal-nfe-toolbar-left">
                <button
                  type="button"
                  className="fiscal-icon-button fiscal-icon-list"
                  title="Lista de pendências das NF-e emitidas"
                  aria-label="Atualizar documentos gravados no MySQL"
                  onClick={carregarDocumentosMysql}
                  disabled={carregandoDocumentos}
                >
                  <List size={25} />
                </button>

                <button
                  type="button"
                  className="fiscal-icon-button fiscal-icon-search"
                  title="Buscar"
                  aria-label="Buscar"
                  onClick={executarBuscaEmitidas}
                >
                  <Search size={25} />
                </button>

                <div className="fiscal-nfe-toolbar-search">
                  <Search size={18} />
                  <input
                    value={buscaEmitidasDigitada}
                    onChange={(event) =>
                      setBuscaEmitidasDigitada(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') executarBuscaEmitidas()
                    }}
                    placeholder="Buscar código antigo ou descrição da NF-e"
                  />
                </div>

                <button
                  type="button"
                  className={`fiscal-filter-button ${
                    quantidadeFiltrosEmitidas > 0 ? 'ativo' : ''
                  }`}
                  title="Adicionar filtro"
                  onClick={() =>
                    setMostrarFiltrosEmitidas((atual) => !atual)
                  }
                >
                  <Filter size={20} />
                  {quantidadeFiltrosEmitidas > 0 && (
                    <span>{quantidadeFiltrosEmitidas}</span>
                  )}
                </button>
              </div>

              <div className="fiscal-nfe-toolbar-actions">
                <button
                  type="button"
                  className="fiscal-icon-button fiscal-icon-print"
                  title="Imprimir"
                  aria-label="Imprimir"
                  onClick={() => window.print()}
                >
                  <Printer size={25} />
                </button>

                <button
                  type="button"
                  className="fiscal-nfe-button fiscal-nfe-button-sefaz erp-action-descriptive erp-action-nfe-search"
                  onClick={sincronizarNFeEmitidas}
                  disabled={sincronizandoEmitidas || consultaSefazBloqueada}
                >
                  <CloudDownload size={18} />
                  {sincronizandoEmitidas
                    ? 'Consultando...'
                    : consultaSefazBloqueada
                      ? `Bloqueado até ${new Date(proximaConsultaSefaz ?? '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Buscar NF-e Emitidas'}
                </button>

                <button
                  type="button"
                  className="fiscal-nfe-button fiscal-nfe-button-xml erp-action-descriptive erp-action-import-xml"
                  onClick={() => setModalNfHistorica(true)}
                  disabled={importandoXml}
                >
                  <FileUp size={18} />
                  {importandoXml
                    ? 'Importando...'
                    : 'Importar XML'}
                </button>
              </div>
            </div>
            <ImportarNfHistoricaModal
              aberto={modalNfHistorica}
              onClose={() => setModalNfHistorica(false)}
              onConcluido={() => {
                setMensagemImportacao('Orçamento e pedido históricos inseridos e vinculados à NF-e.')
                atualizarPendencias()
              }}
            />

            {mostrarFiltrosEmitidas && (
              <div className="fiscal-nfe-filter-panel">
                <label>
                  Ocorrências mínimas
                  <input
                    type="number"
                    min="1"
                    value={ocorrenciasMinimas}
                    onChange={(event) =>
                      setOcorrenciasMinimas(event.target.value)
                    }
                    placeholder="Ex.: 2"
                  />
                </label>

                <button
                  type="button"
                  className="fiscal-nfe-clear-filters"
                  onClick={limparFiltrosEmitidas}
                  disabled={quantidadeFiltrosEmitidas === 0}
                >
                  <X size={18} />
                  Limpar filtros
                </button>
              </div>
            )}

            <div className="fiscal-nfe-warning">
              <ShieldCheck size={19} />
              <div>
                <strong>Importação histórica sem estoque</strong>
                <span>
                  Os pedidos entram como concluídos, com NF-e autorizada e
                  estoqueBaixado igual a false. Nenhuma rotina de baixa de
                  estoque é chamada.
                </span>
              </div>
            </div>

            {diagnosticoSefaz && (
              <div className="fiscal-sefaz-diagnostico">
                <strong className="fiscal-sefaz-diagnostico-titulo">Retorno técnico da SEFAZ</strong>
                <div className="fiscal-sefaz-diagnostico-grid">
                  <div><b>Ambiente:</b><span>{formatarAmbiente(diagnosticoSefaz.ambienteConsulta || ambienteNFeEmitidas)}</span></div>
                  <div><b>CNPJ:</b><span>{formatarCnpj(diagnosticoSefaz.cnpjConsultado)}</span></div>
                  <div><b>cStat:</b><span>{diagnosticoSefaz.codigo || '-'}</span></div>
                  <div className="fiscal-sefaz-campo-largo"><b>Motivo:</b><span>{diagnosticoSefaz.mensagem || '-'}</span></div>
                  <div><b>Último NSU:</b><span>{diagnosticoSefaz.ultNSU || '-'}</span></div>
                  <div><b>Maior NSU:</b><span>{diagnosticoSefaz.maxNSU || '-'}</span></div>
                  <div><b>Documentos recebidos:</b><span>{diagnosticoSefaz.documentosRecebidos ?? 0}</span></div>
                  <div><b>XML completos:</b><span>{diagnosticoSefaz.xmlCompletos ?? 0}</span></div>
                  <div><b>Resumos de NF-e:</b><span>{diagnosticoSefaz.resumosNFe ?? 0}</span></div>
                  <div><b>Eventos:</b><span>{diagnosticoSefaz.eventosRecebidos ?? 0}</span></div>
                  <div><b>Outros documentos:</b><span>{diagnosticoSefaz.outrosDocumentos ?? 0}</span></div>
                  <div><b>NSU avançou:</b><span>{diagnosticoSefaz.nsuAvancou ? 'Sim' : 'Não'}</span></div>
                  <div><b>Chamada enviada à SEFAZ:</b><span>{diagnosticoSefaz.chamadaSefazExecutada === true ? 'Sim' : 'Não'}</span></div>
                  <div className={consultaSefazBloqueada ? 'fiscal-sefaz-bloqueio ativo' : 'fiscal-sefaz-bloqueio'}>
                    <b>Próxima consulta:</b>
                    <span>{consultaSefazBloqueada && diagnosticoSefaz.proximaConsultaEm ? new Date(diagnosticoSefaz.proximaConsultaEm).toLocaleString('pt-BR') : 'Liberada'}</span>
                  </div>
                </div>
                {consultaSefazBloqueada && (
                  <p className="fiscal-sefaz-aviso-bloqueio">
                    Consulta bloqueada localmente. Abrir ou atualizar esta tela não envia nova solicitação à SEFAZ.
                  </p>
                )}
                {(diagnosticoSefaz.xmlCompletos ?? 0) === 0 && (diagnosticoSefaz.documentosRecebidos ?? 0) > 0 && (
                  <p className="fiscal-sefaz-aviso-documentos">
                    A SEFAZ entregou documentos, mas nenhum XML completo de NF-e emitida. Resumos e eventos foram arquivados no MySQL para reconstrução do histórico.
                  </p>
                )}
              </div>
            )}

            {mensagemImportacao && (
              <div className="fiscal-nfe-message">
                <CheckCircle2 size={18} />
                <span>{mensagemImportacao}</span>
              </div>
            )}

            {resumoUltimaImportacao && (
              <div className="fiscal-nfe-summary-grid">
                <div>
                  <strong>{resumoUltimaImportacao.importados}</strong>
                  <span>Pedidos importados</span>
                </div>

                <div>
                  <strong>{resumoUltimaImportacao.duplicados}</strong>
                  <span>Duplicados ignorados</span>
                </div>

                <div>
                  <strong>
                    {
                      resumoUltimaImportacao.itensVinculadosAutomaticamente
                    }
                  </strong>
                  <span>Vínculos por descrição</span>
                </div>

                <div>
                  <strong>
                    {resumoUltimaImportacao.itensVinculadosPorMapa}
                  </strong>
                  <span>Vínculos pelo de/para</span>
                </div>

                <div>
                  <strong>{resumoUltimaImportacao.itensPendentes}</strong>
                  <span>Itens pendentes</span>
                </div>
              </div>
            )}

            <div className="fiscal-nfe-map-header">
              <div>
                <h3>Documentos gravados no MySQL</h3>
                <p>
                  Esta lista é carregada somente do banco de dados. Atualizar a tela ou clicar no ícone de lista não consulta a SEFAZ.
                </p>
                <small>{documentosMysql.length} documento(s) arquivado(s) em {formatarAmbiente(ambienteNFeEmitidas)}.</small>
              </div>

              <div className="fiscal-nfe-map-badges">
                <span>
                  <ShieldCheck size={15} />
                  Consulta local
                </span>
                <span className="fiscal-nfe-ok">
                  {documentosMysql.filter((item) => item.xmlCompleto).length} XML completo(s)
                </span>
              </div>
            </div>

            {erroDocumentos && (
              <div className="fiscal-nfe-message">
                <AlertTriangle size={18} />
                <span>{erroDocumentos}</span>
              </div>
            )}

            {carregandoDocumentos ? (
              <div className="fiscal-nfe-empty">
                <ReceiptText size={24} />
                <strong>Carregando documentos do MySQL...</strong>
              </div>
            ) : documentosMysql.length === 0 ? (
              <div className="fiscal-nfe-empty">
                <ReceiptText size={24} />
                <strong>Nenhum documento arquivado neste ambiente.</strong>
                <span>Nenhuma consulta à SEFAZ foi executada para montar esta lista.</span>
              </div>
            ) : (
              <div className="fiscal-nfe-table-wrapper">
                <table className="fiscal-nfe-table">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Tipo recebido</th>
                      <th>Emitente</th>
                      <th>Emissão</th>
                      <th>NSU</th>
                      <th>Valor</th>
                      <th>XML</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentosMysql.map((documento) => (
                      <tr key={`${documento.ambiente}-${documento.nsu}-${documento.id}`}>
                        <td>
                          <strong>{documento.numero ? `NF-e ${documento.numero}` : documento.chave ? `NF-e ${documento.chave.slice(-9)}` : 'Documento DF-e'}</strong>
                          <div>{documento.serie ? `Série ${documento.serie}` : documento.chave || '-'}</div>
                        </td>
                        <td>
                          <strong>{documento.tipo.replaceAll('_', ' ')}</strong>
                          <div>{documento.schema || '-'}</div>
                        </td>
                        <td>
                          <strong>{documento.emitenteNome || '-'}</strong>
                          <div>{formatarCnpj(documento.emitenteDocumento)}</div>
                        </td>
                        <td>{documento.emissao ? new Date(documento.emissao).toLocaleString('pt-BR') : '-'}</td>
                        <td>{documento.nsu || '-'}</td>
                        <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(documento.valor || 0))}</td>
                        <td>{documento.xmlCompleto ? 'Completo' : 'Resumo / evento'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="fiscal-nfe-map-header">
              <div>
                <h3>De/Para de Produtos Históricos</h3>
                <p>
                  Código antigo e descrição original da NF-e são preservados.
                  O produto atual é usado somente como vínculo interno.
                </p>
                <small>{pendenciasFiltradas.length} item(ns) exibido(s).</small>
              </div>

              <div className="fiscal-nfe-map-badges">
                <span>
                  <Link2 size={15} />
                  {totalVinculosSalvos} vínculo(s) salvo(s)
                </span>

                <span
                  className={
                    pendencias.length > 0
                      ? 'fiscal-nfe-pending'
                      : 'fiscal-nfe-ok'
                  }
                >
                  {pendencias.length > 0 ? (
                    <AlertTriangle size={15} />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  {pendencias.length} pendência(s)
                </span>
              </div>
            </div>

            {pendenciasFiltradas.length === 0 ? (
              <div className="fiscal-nfe-empty">
                <CheckCircle2 size={24} />
                <strong>Nenhum produto histórico aguardando vínculo.</strong>
                <span>
                  Produtos com descrição normalizada idêntica já são
                  vinculados automaticamente.
                </span>
              </div>
            ) : (
              <div className="fiscal-nfe-table-wrapper">
                <table className="fiscal-nfe-table">
                  <thead>
                    <tr>
                      <th>Código antigo</th>
                      <th>Descrição original da NF-e</th>
                      <th>Ocorrências</th>
                      <th>Produto atual Synergias</th>
                      <th>Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pendenciasFiltradas.map((pendencia) => (
                      <tr key={pendencia.chaveHistorica}>
                        <td>
                          <strong>
                            {pendencia.codigoHistorico || '-'}
                          </strong>
                        </td>

                        <td>
                          {pendencia.descricaoHistorica || '-'}
                        </td>

                        <td>{pendencia.ocorrencias}</td>

                        <td>
                          <select
                            value={
                              selecoes[
                                pendencia.chaveHistorica
                              ] || ''
                            }
                            onChange={(
                              event: React.ChangeEvent<HTMLSelectElement>,
                            ) =>
                              atualizarSelecao(
                                pendencia.chaveHistorica,
                                event.target.value,
                              )
                            }
                          >
                            <option value="">
                              Selecione o produto atual
                            </option>

                            {produtos.map((produto) => (
                              <option
                                key={String(produto.codigo)}
                                value={String(produto.codigo)}
                              >
                                {produto.descricao}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="fiscal-nfe-link-button"
                            onClick={() =>
                              vincularProduto(pendencia)
                            }
                          >
                            <Link2 size={16} />
                            Vincular
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  )
}

export default Fiscal
