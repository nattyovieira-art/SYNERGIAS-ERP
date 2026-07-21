import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CloudDownload,
  FileText,
  FileUp,
  Filter,
  List,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

import Sidebar from "../../components/Sidebar/Sidebar";
import PageHeader from "../../components/PageHeader/PageHeader";
import {
  importarComprasDFeStorage,
  listarComprasStorage,
  obterUltNSUDFeStorage,
  salvarUltNSUDFeStorage,
} from "../../services/comprasStorage";
import type { Compra } from "../../types/Compra";

import "../../styles/fiscal.css";
import "../../styles/nfe-recebidas.css";

const API_BACKEND = "http://localhost:3333";

type FiltroOrigem = "TODAS" | "SEFAZ_DFE" | "XML_NFE" | "MANUAL";

type RespostaSincronizacaoDFe = {
  ok: boolean;
  codigo?: string;
  mensagem: string;
  compras?: Compra[];
  resumosSemItensIgnorados?: number;
  ultNSU?: string;
  lotesConsultados?: number;
};

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0));
}

function formatarData(valor: string) {
  if (!valor) return "-";

  const data = String(valor).slice(0, 10);
  const partes = data.split("-");

  if (partes.length !== 3) return valor;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function textoOrigem(origem?: Compra["origem"]) {
  const mapa: Record<string, string> = {
    SEFAZ_DFE: "SEFAZ / DF-e",
    XML_NFE: "XML",
    MANUAL: "Manual",
  };

  return mapa[String(origem || "")] || "Não informada";
}

function NFeRecebidas() {
  const navigate = useNavigate();

  const [compras, setCompras] = useState<Compra[]>(() =>
    listarComprasStorage(),
  );
  const [busca, setBusca] = useState("");
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [sincronizandoSefaz, setSincronizandoSefaz] = useState(false);
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [origem, setOrigem] = useState<FiltroOrigem>("TODAS");
  const [notaAbertaId, setNotaAbertaId] = useState("");

  const quantidadeFiltrosAtivos = useMemo(
    () =>
      [Boolean(dataInicial), Boolean(dataFinal), origem !== "TODAS"].filter(
        Boolean,
      ).length,
    [dataFinal, dataInicial, origem],
  );

  function executarBusca() {
    setBusca(buscaDigitada.trim());
  }

  function limparFiltros() {
    setDataInicial("");
    setDataFinal("");
    setOrigem("TODAS");
  }

  function importarXmlVisual() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xml,text/xml,application/xml";
    input.multiple = true;

    input.onchange = () => {
      const arquivos = Array.from(input.files || []);
      if (arquivos.length === 0) return;

      alert(
        `${arquivos.length} arquivo(s) XML selecionado(s).\n\n` +
          "A importação fiscal por XML continuará sendo feita pelo fluxo de Compras. " +
          "Nenhum estoque foi alterado nesta consulta documental.",
      );
    };

    input.click();
  }

  async function sincronizarSefaz() {
    if (sincronizandoSefaz) return;

    setSincronizandoSefaz(true);

    try {
      const resposta = await fetch(
        `${API_BACKEND}/api/compras/sefaz/sincronizar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ultNSU: obterUltNSUDFeStorage(),
            limiteLotes: 5,
          }),
        },
      );

      const dados = (await resposta.json()) as RespostaSincronizacaoDFe;

      if (!resposta.ok || !dados.ok) {
        if (dados.codigo === "CERTIFICADO_A1_NAO_CONFIGURADO") {
          alert(
            "O certificado digital A1 ainda não está configurado no backend.\n\n" +
              "Nenhum estoque foi alterado.",
          );
          return;
        }

        throw new Error(dados.mensagem || "Erro ao consultar a SEFAZ.");
      }

      const resultado = importarComprasDFeStorage(dados.compras || []);

      if (dados.ultNSU) salvarUltNSUDFeStorage(dados.ultNSU);

      setCompras(listarComprasStorage());

      alert(
        `Consulta SEFAZ concluída.\n\n` +
          `Notas importadas com itens: ${resultado.importadas}\n` +
          `Notas duplicadas ignoradas: ${resultado.duplicadas}\n` +
          `Resumos sem produtos ignorados: ${dados.resumosSemItensIgnorados || 0}\n` +
          `Lotes consultados: ${dados.lotesConsultados || 0}\n\n` +
          "ESTOQUE ALTERADO NA IMPORTAÇÃO: NÃO",
      );
    } catch (error) {
      alert(
        `${error instanceof Error ? error.message : "Erro ao consultar a SEFAZ."}\n\n` +
          "Nenhum estoque foi alterado.",
      );
    } finally {
      setSincronizandoSefaz(false);
    }
  }

  const notas = useMemo(
    () =>
      compras.filter(
        (compra) =>
          Boolean(compra.numeroNFe) ||
          Boolean(compra.chaveAcessoNFe) ||
          Boolean(compra.xmlNFe) ||
          compra.origem === "SEFAZ_DFE" ||
          compra.origem === "XML_NFE",
      ),
    [compras],
  );

  const notasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return notas
      .filter((compra) => {
        const emissao = String(compra.dataEmissao || "").slice(0, 10);

        const bateBusca =
          !termo ||
          String(compra.numeroNFe || "")
            .toLowerCase()
            .includes(termo) ||
          String(compra.serieNFe || "")
            .toLowerCase()
            .includes(termo) ||
          String(compra.chaveAcessoNFe || "")
            .toLowerCase()
            .includes(termo) ||
          String(compra.fornecedorNome || "")
            .toLowerCase()
            .includes(termo) ||
          String(compra.fornecedorDocumento || "")
            .toLowerCase()
            .includes(termo);

        const bateInicio = !dataInicial || emissao >= dataInicial;
        const bateFim = !dataFinal || emissao <= dataFinal;
        const bateOrigem = origem === "TODAS" || compra.origem === origem;

        return bateBusca && bateInicio && bateFim && bateOrigem;
      })
      .sort((a, b) =>
        String(b.dataEmissao || "").localeCompare(String(a.dataEmissao || "")),
      );
  }, [busca, dataFinal, dataInicial, notas, origem]);

  const resumo = useMemo(
    () => ({
      total: notas.length,
      sefaz: notas.filter((compra) => compra.origem === "SEFAZ_DFE").length,
      xml: notas.filter((compra) => compra.origem === "XML_NFE").length,
      comXml: notas.filter((compra) => Boolean(compra.xmlNFe)).length,
    }),
    [notas],
  );

  function alternarNota(compraId: string) {
    setNotaAbertaId((atual) => (atual === compraId ? "" : compraId));
  }

  return (
    <main className="fiscal-layout">
      <Sidebar />

      <section className="fiscal-page nfe-recebidas-page">
        <PageHeader
          category="Fiscal"
          title="NF-e Recebidas"
          subtitle="Consulte e confira os documentos fiscais de entrada vinculados às compras da Synergias."
        />

        <div className="fiscal-topbar nfe-recebidas-toolbar">
          <div className="nfe-recebidas-toolbar-left">
            <button
              type="button"
              className="fiscal-icon-button fiscal-icon-back"
              title="Voltar"
              aria-label="Voltar"
              onClick={() => navigate("/fiscal")}
            >
              <ArrowLeft size={25} />
            </button>

            <button
              type="button"
              className="fiscal-icon-button fiscal-icon-list"
              title="Lista de NF-e recebidas"
              aria-label="Lista de NF-e recebidas"
              onClick={() => setNotaAbertaId("")}
            >
              <List size={25} />
            </button>

            <button
              type="button"
              className="fiscal-icon-button fiscal-icon-search"
              title="Buscar"
              aria-label="Buscar"
              onClick={executarBusca}
            >
              <Search size={25} />
            </button>

            <div className="nfe-recebidas-toolbar-search">
              <Search size={18} />
              <input
                value={buscaDigitada}
                onChange={(event) => setBuscaDigitada(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") executarBusca();
                }}
                placeholder="Buscar NF-e, chave, série ou fornecedor"
              />
            </div>

            <button
              type="button"
              className={`fiscal-filter-button ${
                quantidadeFiltrosAtivos > 0 ? "ativo" : ""
              }`}
              title="Adicionar filtro"
              onClick={() => setMostrarFiltros((atual) => !atual)}
            >
              <Filter size={20} />
              {quantidadeFiltrosAtivos > 0 && (
                <span>{quantidadeFiltrosAtivos}</span>
              )}
            </button>
          </div>

          <div className="nfe-recebidas-toolbar-actions">
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
              className="fiscal-icon-button fiscal-icon-refresh"
              title="Atualizar lista"
              aria-label="Atualizar lista"
              onClick={() => setCompras(listarComprasStorage())}
            >
              <RefreshCw size={25} />
            </button>

            <button
              type="button"
              className="fiscal-sefaz-button erp-action-descriptive erp-action-nfe-search"
              onClick={sincronizarSefaz}
              disabled={sincronizandoSefaz}
              title="Buscar NF-e de entrada na SEFAZ"
            >
              <CloudDownload size={22} />
              <span>
                {sincronizandoSefaz ? "Consultando..." : "Buscar NF-e SEFAZ"}
              </span>
            </button>
            <button
              type="button"
              className="fiscal-icon-button fiscal-icon-import erp-action-descriptive erp-action-import-xml"
              title="Importar XML"
              aria-label="Importar XML"
              onClick={importarXmlVisual}
            >
              <FileUp size={22} />
              <span>Importar XML</span>
            </button>

          </div>
        </div>

        <section className="nfe-recebidas-summary-grid">
          <div className="nfe-recebidas-summary-card">
            <span>Total de NF-e</span>
            <strong>{resumo.total}</strong>
          </div>

          <div className="nfe-recebidas-summary-card">
            <span>Vindas da SEFAZ</span>
            <strong>{resumo.sefaz}</strong>
          </div>

          <div className="nfe-recebidas-summary-card">
            <span>Importadas por XML</span>
            <strong>{resumo.xml}</strong>
          </div>

          <div className="nfe-recebidas-summary-card nfe-recebidas-summary-ok">
            <span>Com XML preservado</span>
            <strong>{resumo.comXml}</strong>
          </div>
        </section>

        {mostrarFiltros && (
          <section className="nfe-recebidas-filter-card nfe-recebidas-filter-card-visible">
            <label>
              Emissão de
              <input
                type="date"
                value={dataInicial}
                onChange={(event) => setDataInicial(event.target.value)}
              />
            </label>

            <label>
              Emissão até
              <input
                type="date"
                value={dataFinal}
                onChange={(event) => setDataFinal(event.target.value)}
              />
            </label>

            <label>
              Origem
              <select
                value={origem}
                onChange={(event) =>
                  setOrigem(event.target.value as FiltroOrigem)
                }
              >
                <option value="TODAS">Todas</option>
                <option value="SEFAZ_DFE">SEFAZ / DF-e</option>
                <option value="XML_NFE">XML</option>
                <option value="MANUAL">Manual</option>
              </select>
            </label>

            <button
              type="button"
              className="nfe-recebidas-clear-filters"
              onClick={limparFiltros}
              disabled={quantidadeFiltrosAtivos === 0}
            >
              <X size={18} />
              Limpar filtros
            </button>
          </section>
        )}

        <section className="nfe-recebidas-list-card">
          <div className="nfe-recebidas-list-title">
            <div>
              <h2>Documentos Fiscais de Entrada</h2>
              <p>{notasFiltradas.length} documento(s) encontrado(s).</p>
            </div>

            <div className="nfe-recebidas-safe-note">
              <ShieldCheck size={18} />
              <span>Consulta documental sem movimentar estoque</span>
            </div>
          </div>

          {notasFiltradas.length === 0 ? (
            <div className="nfe-recebidas-empty">
              <ReceiptText size={30} />
              <strong>Nenhuma NF-e recebida encontrada.</strong>
              <span>
                As notas fiscais de entrada aparecerão aqui quando estiverem
                vinculadas às compras.
              </span>
            </div>
          ) : (
            <div className="nfe-recebidas-table-wrapper">
              <table className="nfe-recebidas-table">
                <thead>
                  <tr>
                    <th>NF-e</th>
                    <th>Fornecedor</th>
                    <th>Emissão</th>
                    <th>Origem</th>
                    <th>Itens</th>
                    <th>Valor</th>
                    <th>XML</th>
                    <th>Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {notasFiltradas.map((compra) => {
                    const aberta = notaAbertaId === compra.id;

                    return (
                      <>
                        <tr key={compra.id}>
                          <td>
                            <strong>
                              {compra.numeroNFe
                                ? `NF-e ${compra.numeroNFe}`
                                : `Compra ${compra.numeroCompra}`}
                            </strong>
                            <span>Série {compra.serieNFe || "-"}</span>
                          </td>

                          <td>
                            <strong>{compra.fornecedorNome || "-"}</strong>
                            <span>{compra.fornecedorDocumento || "-"}</span>
                          </td>

                          <td>{formatarData(compra.dataEmissao)}</td>
                          <td>{textoOrigem(compra.origem)}</td>
                          <td>{compra.itens.length}</td>
                          <td>{formatarMoeda(compra.totalFinal)}</td>
                          <td>
                            <span
                              className={`nfe-recebidas-xml-badge ${
                                compra.xmlNFe
                                  ? "nfe-recebidas-xml-ok"
                                  : "nfe-recebidas-xml-missing"
                              }`}
                            >
                              {compra.xmlNFe ? "Preservado" : "Não disponível"}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="nfe-recebidas-open-button"
                              onClick={() => alternarNota(compra.id)}
                            >
                              {aberta ? (
                                <ChevronUp size={17} />
                              ) : (
                                <ChevronDown size={17} />
                              )}
                              {aberta ? "Fechar" : "Conferir"}
                            </button>
                          </td>
                        </tr>

                        {aberta && (
                          <tr
                            key={`${compra.id}-detalhe`}
                            className="nfe-recebidas-detail-row"
                          >
                            <td colSpan={8}>
                              <DetalheNFe compra={compra} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function DetalheNFe({ compra }: { compra: Compra }) {
  return (
    <div className="nfe-recebidas-detail">
      <div className="nfe-recebidas-detail-header">
        <div>
          <h3>Conferência da NF-e</h3>
          <p>
            Documento fiscal vinculado à compra {compra.numeroCompra}. Esta tela
            é somente para consulta e conferência dos dados recebidos.
          </p>
        </div>

        <div className="nfe-recebidas-document-badge">
          <FileText size={18} />
          <span>{textoOrigem(compra.origem)}</span>
        </div>
      </div>

      <section className="nfe-recebidas-document-grid">
        <div>
          <span>Número da NF-e</span>
          <strong>{compra.numeroNFe || "-"}</strong>
        </div>
        <div>
          <span>Série</span>
          <strong>{compra.serieNFe || "-"}</strong>
        </div>
        <div>
          <span>Protocolo</span>
          <strong>{compra.protocoloNFe || "-"}</strong>
        </div>
        <div>
          <span>NSU DF-e</span>
          <strong>{compra.nsuDFe || "-"}</strong>
        </div>

        <div className="nfe-recebidas-document-full">
          <span>Chave de Acesso</span>
          <strong>{compra.chaveAcessoNFe || "-"}</strong>
        </div>

        <div>
          <span>Fornecedor</span>
          <strong>{compra.fornecedorNome || "-"}</strong>
        </div>
        <div>
          <span>Documento</span>
          <strong>{compra.fornecedorDocumento || "-"}</strong>
        </div>
        <div>
          <span>Emissão</span>
          <strong>{formatarData(compra.dataEmissao)}</strong>
        </div>
        <div>
          <span>Total da NF-e</span>
          <strong>{formatarMoeda(compra.totalFinal)}</strong>
        </div>
      </section>

      <section className="nfe-recebidas-items-card">
        <h4>Itens da NF-e</h4>

        <div className="nfe-recebidas-items-wrapper">
          <table className="nfe-recebidas-items-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>NCM</th>
                <th>CFOP</th>
                <th>Unidade Fiscal</th>
                <th>Qtd. Fiscal</th>
                <th>Custo Unit. Fiscal</th>
                <th>Total Fiscal</th>
              </tr>
            </thead>

            <tbody>
              {compra.itens.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.descricao}</strong>
                    <span>{item.produtoCodigo || "-"}</span>
                  </td>
                  <td>{item.ncm || "-"}</td>
                  <td>{item.cfop || "-"}</td>
                  <td>{item.unidadeFiscal || item.unidade || "-"}</td>
                  <td>
                    {Number(
                      item.quantidadeFiscal ?? item.quantidade ?? 0,
                    ).toLocaleString("pt-BR")}
                  </td>
                  <td>
                    {formatarMoeda(
                      Number(
                        item.custoUnitarioFiscal ?? item.custoUnitario ?? 0,
                      ),
                    )}
                  </td>
                  <td>
                    {formatarMoeda(Number(item.totalFiscal ?? item.total ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="nfe-recebidas-stock-note">
        <ShieldCheck size={19} />
        <span>
          Conferir uma NF-e nesta página não movimenta estoque, não altera custo
          médio e não confirma análise fiscal.
        </span>
      </div>
    </div>
  );
}

export default NFeRecebidas;
