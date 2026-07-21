import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Filter,
  List,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

import Sidebar from "../../components/Sidebar/Sidebar";
import PageHeader from "../../components/PageHeader/PageHeader";
import { listarComprasStorage } from "../../services/comprasStorage";
import {
  confirmarAnaliseFiscalCompra,
  gerarAnaliseFiscalCompra,
  listarAnalisesFiscaisStorage,
  type AnaliseFiscalCompra,
  type AnaliseFiscalItem,
  type ClassificacaoFiscalItem,
  type StatusAnaliseFiscal,
} from "../../services/analiseFiscalStorage";
import type { Compra } from "../../types/Compra";

import "../../styles/fiscal.css";
import "../../styles/analise-fiscal-entradas.css";

type FiltroStatus = "TODOS" | StatusAnaliseFiscal;

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0));
}

function formatarData(valor: string) {
  if (!valor) return "-";

  const partes = valor.slice(0, 10).split("-");
  if (partes.length !== 3) return valor;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function textoStatus(status: StatusAnaliseFiscal) {
  const mapa: Record<StatusAnaliseFiscal, string> = {
    PENDENTE: "PENDENTE",
    EM_ANALISE: "EM ANÁLISE",
    REVISAO_NECESSARIA: "REVISÃO NECESSÁRIA",
    CONFIRMADA: "CONFIRMADA",
  };

  return mapa[status];
}

function textoClassificacao(classificacao: ClassificacaoFiscalItem) {
  const mapa: Record<ClassificacaoFiscalItem, string> = {
    SEM_ADICIONAL_FISCAL: "SEM ADICIONAL FISCAL",
    ICMS_ST_JA_RETIDO: "ICMS-ST JÁ RETIDO",
    ICMS_ST_A_RECOLHER_ESTIMADO: "ICMS-ST A RECOLHER ESTIMADO",
    ICMS_A_RECOLHER_ESTIMADO: "ICMS A RECOLHER ESTIMADO",
    ANTECIPACAO_A_RECOLHER_ESTIMADO: "ANTECIPAÇÃO A RECOLHER ESTIMADO",
    REVISAO_FISCAL_NECESSARIA: "REVISÃO FISCAL NECESSÁRIA",
  };

  return mapa[classificacao];
}

function classeClassificacao(classificacao: ClassificacaoFiscalItem) {
  return classificacao.toLowerCase().replaceAll("_", "-");
}

function obterAnalise(
  compra: Compra,
  analises: AnaliseFiscalCompra[],
): AnaliseFiscalCompra {
  const encontrada = analises.find((item) => item.compraId === compra.id);

  if (encontrada) return encontrada;

  return {
    compraId: compra.id,
    status: "PENDENTE",
    itens: [],
    pendencias: compra.itens.length,
    atualizadoEm: "",
  };
}

function AnaliseFiscalEntradas() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [compras] = useState<Compra[]>(() => listarComprasStorage());
  const [analises, setAnalises] = useState<AnaliseFiscalCompra[]>(() =>
    listarAnalisesFiscaisStorage(),
  );
  const [busca, setBusca] = useState("");
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(
    () => searchParams.get("status") === "REVISAO_NECESSARIA",
  );
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [status, setStatus] = useState<FiltroStatus>(() =>
    searchParams.get("status") === "REVISAO_NECESSARIA"
      ? "REVISAO_NECESSARIA"
      : "TODOS",
  );
  const [compraAbertaId, setCompraAbertaId] = useState("");
  const [itemAbertoId, setItemAbertoId] = useState("");

  const quantidadeFiltrosAtivos = useMemo(
    () =>
      [Boolean(dataInicial), Boolean(dataFinal), status !== "TODOS"].filter(
        Boolean,
      ).length,
    [dataFinal, dataInicial, status],
  );

  function executarBusca() {
    setBusca(buscaDigitada.trim());
  }

  function limparFiltros() {
    setDataInicial("");
    setDataFinal("");
    setStatus("TODOS");
  }

  function abrirRevisaoFiscal() {
    setStatus("REVISAO_NECESSARIA");
    setMostrarFiltros(true);
  }

  const comprasComNFe = useMemo(
    () =>
      compras.filter(
        (compra) =>
          Boolean(compra.numeroNFe) ||
          Boolean(compra.chaveAcessoNFe) ||
          compra.origem === "SEFAZ_DFE" ||
          compra.origem === "XML_NFE",
      ),
    [compras],
  );

  const comprasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return comprasComNFe
      .filter((compra) => {
        const analise = obterAnalise(compra, analises);

        const bateBusca =
          !termo ||
          String(compra.numeroNFe || "")
            .toLowerCase()
            .includes(termo) ||
          String(compra.numeroCompra || "")
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

        const emissao = String(compra.dataEmissao || "").slice(0, 10);
        const bateInicio = !dataInicial || emissao >= dataInicial;
        const bateFim = !dataFinal || emissao <= dataFinal;
        const bateStatus = status === "TODOS" || analise.status === status;

        return bateBusca && bateInicio && bateFim && bateStatus;
      })
      .sort((a, b) =>
        String(b.dataEmissao || "").localeCompare(String(a.dataEmissao || "")),
      );
  }, [analises, busca, comprasComNFe, dataFinal, dataInicial, status]);

  const resumo = useMemo(() => {
    const dados = comprasComNFe.map((compra) => obterAnalise(compra, analises));

    return {
      total: dados.length,
      pendentes: dados.filter((item) => item.status === "PENDENTE").length,
      revisao: dados.filter((item) => item.status === "REVISAO_NECESSARIA")
        .length,
      confirmadas: dados.filter((item) => item.status === "CONFIRMADA").length,
    };
  }, [analises, comprasComNFe]);

  function recarregarAnalises() {
    setAnalises(listarAnalisesFiscaisStorage());
  }

  function analisarCompra(compra: Compra) {
    gerarAnaliseFiscalCompra(compra);
    recarregarAnalises();
    setCompraAbertaId(compra.id);
  }

  function confirmar(compra: Compra) {
    const confirmou = window.confirm(
      "Confirmar a análise fiscal desta NF-e? Esta ação confirma a conferência fiscal, mas não movimenta estoque e não altera o custo do produto nesta versão.",
    );

    if (!confirmou) return;

    try {
      confirmarAnaliseFiscalCompra(compra);
      recarregarAnalises();
      alert("Análise fiscal confirmada com sucesso.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar a análise fiscal.",
      );
    }
  }

  function alternarCompra(compra: Compra) {
    if (compraAbertaId === compra.id) {
      setCompraAbertaId("");
      setItemAbertoId("");
      return;
    }

    let analise = obterAnalise(compra, analises);

    if (analise.status === "PENDENTE" || analise.itens.length === 0) {
      analise = gerarAnaliseFiscalCompra(compra);
      recarregarAnalises();
    }

    setCompraAbertaId(compra.id);
    setItemAbertoId(analise.itens[0]?.itemId || "");
  }

  return (
    <main className="fiscal-layout">
      <Sidebar />

      <section className="fiscal-page analise-fiscal-page">
        <PageHeader
          category="Fiscal"
          title="Análise Fiscal de Entradas"
          subtitle="Analise os dados tributários das NF-e de entrada e a composição do custo real dos produtos."
        />

        <div className="fiscal-topbar analise-fiscal-toolbar">
          <div className="analise-fiscal-toolbar-left">
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
              title="Lista de análises"
              aria-label="Lista de análises"
              onClick={() => setCompraAbertaId("")}
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

            <div className="analise-fiscal-toolbar-search">
              <Search size={18} />
              <input
                type="text"
                value={buscaDigitada}
                onChange={(event) => setBuscaDigitada(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") executarBusca();
                }}
                placeholder="Buscar NF-e, chave, compra ou fornecedor"
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

          <div className="analise-fiscal-toolbar-actions">
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
              title="Atualizar análises"
              aria-label="Atualizar análises"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={25} />
            </button>
          </div>
        </div>

        <section className="analise-fiscal-summary-grid">
          <div className="analise-fiscal-summary-card">
            <span>NF-e para análise</span>
            <strong>{resumo.total}</strong>
          </div>

          <div className="analise-fiscal-summary-card">
            <span>Pendentes</span>
            <strong>{resumo.pendentes}</strong>
          </div>

          <button
            type="button"
            className="analise-fiscal-summary-card analise-fiscal-summary-warning analise-fiscal-summary-button"
            onClick={abrirRevisaoFiscal}
            title="Filtrar somente itens em revisão fiscal"
          >
            <span>Revisão fiscal</span>
            <strong>{resumo.revisao}</strong>
          </button>

          <div className="analise-fiscal-summary-card analise-fiscal-summary-ok">
            <span>Confirmadas</span>
            <strong>{resumo.confirmadas}</strong>
          </div>
        </section>

        {mostrarFiltros && (
          <section className="analise-fiscal-filter-card analise-fiscal-filter-card-visible">
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
              Status da análise
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as FiltroStatus)
                }
              >
                <option value="TODOS">Todos</option>
                <option value="PENDENTE">Pendente</option>
                <option value="EM_ANALISE">Em análise</option>
                <option value="REVISAO_NECESSARIA">Revisão fiscal</option>
                <option value="CONFIRMADA">Confirmada</option>
              </select>
            </label>

            <button
              type="button"
              className="analise-fiscal-clear-filters"
              onClick={limparFiltros}
              disabled={quantidadeFiltrosAtivos === 0}
            >
              <X size={18} />
              Limpar filtros
            </button>
          </section>
        )}

        <section className="analise-fiscal-list-card">
          <div className="analise-fiscal-list-title">
            <div>
              <h2>NF-e de Entrada</h2>
              <p>
                {comprasFiltradas.length} documento(s) encontrado(s) no período.
              </p>
            </div>

            <div className="analise-fiscal-safe-note">
              <ShieldCheck size={18} />
              <span>Sem movimentação automática de estoque</span>
            </div>
          </div>

          {comprasFiltradas.length === 0 ? (
            <div className="analise-fiscal-empty">
              <FileSearch size={28} />
              <strong>Nenhuma NF-e de entrada encontrada.</strong>
              <span>
                Importe ou consulte as NF-e recebidas no módulo de Compras.
              </span>
            </div>
          ) : (
            <div className="analise-fiscal-table-wrapper">
              <table className="analise-fiscal-table">
                <thead>
                  <tr>
                    <th>NF-e / Compra</th>
                    <th>Fornecedor</th>
                    <th>Emissão</th>
                    <th>Itens</th>
                    <th>Valor da NF-e</th>
                    <th>Pendências</th>
                    <th>Status Fiscal</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {comprasFiltradas.map((compra) => {
                    const analise = obterAnalise(compra, analises);
                    const aberta = compraAbertaId === compra.id;

                    return (
                      <>
                        <tr key={compra.id}>
                          <td>
                            <strong>
                              {compra.numeroNFe
                                ? `NF-e ${compra.numeroNFe}`
                                : `Compra ${compra.numeroCompra}`}
                            </strong>
                            <span className="analise-fiscal-chave">
                              {compra.chaveAcessoNFe || "Sem chave informada"}
                            </span>
                          </td>

                          <td>
                            <strong>{compra.fornecedorNome || "-"}</strong>
                            <span>{compra.fornecedorDocumento || "-"}</span>
                          </td>

                          <td>{formatarData(compra.dataEmissao)}</td>
                          <td>{compra.itens.length}</td>
                          <td>{formatarMoeda(compra.totalFinal)}</td>
                          <td>{analise.pendencias}</td>

                          <td>
                            <span
                              className={`analise-fiscal-status analise-fiscal-status-${analise.status.toLowerCase()}`}
                            >
                              {textoStatus(analise.status)}
                            </span>
                          </td>

                          <td>
                            <div className="analise-fiscal-row-actions">
                              <button
                                type="button"
                                className="analise-fiscal-open-button"
                                onClick={() => alternarCompra(compra)}
                              >
                                {aberta ? (
                                  <ChevronUp size={17} />
                                ) : (
                                  <ChevronDown size={17} />
                                )}
                                {aberta ? "Fechar" : "Analisar"}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {aberta && (
                          <tr
                            key={`${compra.id}-detalhe`}
                            className="analise-fiscal-detail-row"
                          >
                            <td colSpan={8}>
                              <AnaliseCompraDetalhe
                                compra={compra}
                                analise={obterAnalise(compra, analises)}
                                itemAbertoId={itemAbertoId}
                                onItemAberto={setItemAbertoId}
                                onReanalisar={() => analisarCompra(compra)}
                                onConfirmar={() => confirmar(compra)}
                              />
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

type AnaliseCompraDetalheProps = {
  compra: Compra;
  analise: AnaliseFiscalCompra;
  itemAbertoId: string;
  onItemAberto: (itemId: string) => void;
  onReanalisar: () => void;
  onConfirmar: () => void;
};

function AnaliseCompraDetalhe({
  analise,
  itemAbertoId,
  onItemAberto,
  onReanalisar,
  onConfirmar,
}: AnaliseCompraDetalheProps) {
  return (
    <div className="analise-fiscal-detail">
      <div className="analise-fiscal-detail-header">
        <div>
          <h3>Cálculo Fiscal Automático</h3>
          <p>
            Memória preliminar baseada nos dados fiscais preservados da NF-e.
            Situações sem regra confirmada seguem para revisão.
          </p>
        </div>

        <div className="analise-fiscal-detail-actions">
          <button
            type="button"
            className="fiscal-button-secundario"
            onClick={onReanalisar}
          >
            <Calculator size={17} />
            Reanalisar
          </button>

          <button
            type="button"
            className="fiscal-button-principal"
            onClick={onConfirmar}
            disabled={analise.pendencias > 0 || analise.status === "CONFIRMADA"}
          >
            <CheckCircle2 size={17} />
            {analise.status === "CONFIRMADA"
              ? "Análise Confirmada"
              : "Confirmar Análise Fiscal"}
          </button>
        </div>
      </div>

      <div className="analise-fiscal-items">
        {analise.itens.map((item) => {
          const aberto = itemAbertoId === item.itemId;

          return (
            <article key={item.itemId} className="analise-fiscal-item-card">
              <button
                type="button"
                className="analise-fiscal-item-head"
                onClick={() => onItemAberto(aberto ? "" : item.itemId)}
              >
                <div>
                  <strong>{item.descricao}</strong>
                  <span>
                    Produto {item.produtoCodigo || "-"} · NCM{" "}
                    {item.dados.ncm || "-"} · CFOP {item.dados.cfop || "-"}
                  </span>
                </div>

                <div className="analise-fiscal-item-head-right">
                  <span
                    className={`analise-fiscal-classificacao analise-fiscal-classificacao-${classeClassificacao(item.classificacao)}`}
                  >
                    {textoClassificacao(item.classificacao)}
                  </span>
                  {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {aberto && <AnaliseItemDetalhe item={item} />}
            </article>
          );
        })}
      </div>

      <div className="analise-fiscal-confirm-note">
        {analise.pendencias > 0 ? (
          <>
            <AlertTriangle size={19} />
            <span>
              Existem {analise.pendencias} item(ns) com revisão fiscal
              necessária. A confirmação permanece bloqueada.
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 size={19} />
            <span>
              Nenhuma pendência automática identificada nesta análise.
            </span>
          </>
        )}
      </div>

      <div className="analise-fiscal-stock-note">
        <ShieldCheck size={19} />
        <span>
          Esta análise não movimenta estoque. O controle de movimentação
          continua separado no fluxo da compra.
        </span>
      </div>
    </div>
  );
}

function AnaliseItemDetalhe({ item }: { item: AnaliseFiscalItem }) {
  const { dados, memoria } = item;

  return (
    <div className="analise-fiscal-item-body">
      <section className="analise-fiscal-tax-grid">
        <div>
          <span>NCM</span>
          <strong>{dados.ncm || "-"}</strong>
        </div>
        <div>
          <span>CEST</span>
          <strong>{dados.cest || "-"}</strong>
        </div>
        <div>
          <span>CFOP</span>
          <strong>{dados.cfop || "-"}</strong>
        </div>
        <div>
          <span>Origem</span>
          <strong>{dados.origem || "-"}</strong>
        </div>
        <div>
          <span>CST</span>
          <strong>{dados.cst || "-"}</strong>
        </div>
        <div>
          <span>CSOSN</span>
          <strong>{dados.csosn || "-"}</strong>
        </div>
        <div>
          <span>Base ICMS</span>
          <strong>{formatarMoeda(dados.baseIcms)}</strong>
        </div>
        <div>
          <span>Alíquota ICMS</span>
          <strong>{dados.aliquotaIcms.toFixed(2)}%</strong>
        </div>
        <div>
          <span>ICMS destacado</span>
          <strong>{formatarMoeda(dados.valorIcms)}</strong>
        </div>
        <div>
          <span>Base ICMS-ST</span>
          <strong>{formatarMoeda(dados.baseIcmsSt)}</strong>
        </div>
        <div>
          <span>ICMS-ST destacado</span>
          <strong>{formatarMoeda(dados.valorIcmsSt)}</strong>
        </div>
        <div>
          <span>IPI</span>
          <strong>{formatarMoeda(dados.valorIpi)}</strong>
        </div>
        <div>
          <span>PIS</span>
          <strong>{formatarMoeda(dados.valorPis)}</strong>
        </div>
        <div>
          <span>COFINS</span>
          <strong>{formatarMoeda(dados.valorCofins)}</strong>
        </div>
      </section>

      <div className="analise-fiscal-item-columns">
        <section className="analise-fiscal-memory-card">
          <h4>Memória do cálculo</h4>

          <div>
            <span>Custo da mercadoria</span>
            <strong>{formatarMoeda(memoria.custoMercadoria)}</strong>
          </div>
          <div>
            <span>Frete rateado</span>
            <strong>{formatarMoeda(memoria.freteRateado)}</strong>
          </div>
          <div>
            <span>Outros custos rateados</span>
            <strong>{formatarMoeda(memoria.outrosCustosRateados)}</strong>
          </div>
          <div>
            <span>IPI não recuperável</span>
            <strong>{formatarMoeda(memoria.ipiNaoRecuperavel)}</strong>
          </div>
          <div>
            <span>ICMS estimado no custo</span>
            <strong>{formatarMoeda(memoria.icmsEstimado)}</strong>
          </div>
          <div>
            <span>ICMS-ST estimado no custo</span>
            <strong>{formatarMoeda(memoria.icmsStEstimado)}</strong>
          </div>
          <div className="analise-fiscal-memory-total">
            <span>Custo real calculado</span>
            <strong>{formatarMoeda(memoria.custoRealTotal)}</strong>
          </div>
          <div className="analise-fiscal-memory-unit">
            <span>Custo real unitário</span>
            <strong>{formatarMoeda(memoria.custoRealUnitario)}</strong>
          </div>
        </section>

        <section className="analise-fiscal-review-card">
          <h4>Conferência fiscal</h4>

          <span
            className={`analise-fiscal-classificacao analise-fiscal-classificacao-${classeClassificacao(item.classificacao)}`}
          >
            {textoClassificacao(item.classificacao)}
          </span>

          <ul>
            {item.motivos.map((motivo) => (
              <li key={motivo}>{motivo}</li>
            ))}
          </ul>

          <p>
            O sistema não presume ST, DIFAL, antecipação ou ICMS complementar
            quando a regra fiscal ainda não está confirmada.
          </p>
        </section>
      </div>
    </div>
  );
}

export default AnaliseFiscalEntradas;
