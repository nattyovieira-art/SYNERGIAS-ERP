import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Filter, List, RefreshCw, Search } from 'lucide-react'

import type { ContaReceber } from '../../types/Financeiro'
import { listarContasReceberStorage } from '../../services/financeiroStorage'

import '../../styles/financeiro.css'

type ContaPagar = {
  id: string
  fornecedor: string
  documento?: string
  descricao: string
  categoria?: string
  emissao?: string
  vencimento: string
  valor: number
  status: 'Em aberto' | 'Paga' | 'Cancelada'
  dataPagamento?: string
  observacao?: string
  valorPrincipalPago?: number
  jurosPagos?: number
  descontosObtidos?: number
  valorPago?: number
}

type TipoLinha = 'entrada' | 'saida'
type SituacaoLinha = 'Realizado' | 'Previsto'

type LinhaFluxo = {
  id: string
  data: string
  tipo: TipoLinha
  situacao: SituacaoLinha
  grupo: string
  categoria: string
  descricao: string
  origem: string
  conta: string
  valor: number
}

type GrupoFluxo = {
  nome: string
  total: number
  categorias: Array<{
    nome: string
    total: number
    linhas: LinhaFluxo[]
  }>
}

const KEY_CONTAS_PAGAR = 'synergias_contas_pagar'

function primeiroDiaMes() {
  const data = new Date()
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-01`
}

function ultimoDiaMes() {
  const data = new Date()
  return new Date(data.getFullYear(), data.getMonth() + 1, 0).toISOString().slice(0, 10)
}

function lerContasPagar(): ContaPagar[] {
  try {
    const dados = JSON.parse(localStorage.getItem(KEY_CONTAS_PAGAR) || '[]')
    return Array.isArray(dados) ? (dados as ContaPagar[]) : []
  } catch {
    return []
  }
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatarData(data?: string) {
  if (!data) return '-'
  const partes = data.split('-')
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : data
}

function normalizarTexto(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function valorRecebidoConta(conta: ContaReceber) {
  const valorRecebido = Number(conta.valorRecebido || 0)
  if (valorRecebido > 0) return valorRecebido

  const principal = Number(conta.valorPrincipalRecebido || 0)
  const juros = Number(conta.jurosRecebidos || 0)
  const desconto = Number(conta.descontosConcedidos || 0)
  return Math.max(principal + juros - desconto, 0)
}

function agruparLinhas(linhas: LinhaFluxo[], tipo: TipoLinha): GrupoFluxo[] {
  const doTipo = linhas.filter((linha) => linha.tipo === tipo)
  const grupos = Array.from(new Set(doTipo.map((linha) => linha.grupo)))

  return grupos
    .map((nomeGrupo) => {
      const linhasGrupo = doTipo.filter((linha) => linha.grupo === nomeGrupo)
      const categorias = Array.from(new Set(linhasGrupo.map((linha) => linha.categoria)))
        .map((nomeCategoria) => {
          const linhasCategoria = linhasGrupo.filter((linha) => linha.categoria === nomeCategoria)

          return {
            nome: nomeCategoria,
            total: linhasCategoria.reduce((total, linha) => total + linha.valor, 0),
            linhas: linhasCategoria,
          }
        })
        .sort((a, b) => a.nome.localeCompare(b.nome))

      return {
        nome: nomeGrupo,
        total: linhasGrupo.reduce((total, linha) => total + linha.valor, 0),
        categorias,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

export default function FluxoCaixaPainel() {
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes())
  const [dataFim, setDataFim] = useState(ultimoDiaMes())
  const [saldoInicial, setSaldoInicial] = useState('0,00')
  const [busca, setBusca] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(true)
  const [situacaoFiltro, setSituacaoFiltro] = useState<'Todas' | SituacaoLinha>('Todas')
  const [tipoFiltro, setTipoFiltro] = useState<'Todos' | 'Entradas' | 'Saídas'>('Todos')
  const [contaFiltro, setContaFiltro] = useState('Todas')
  const [visao, setVisao] = useState<'analitica' | 'movimentos'>('analitica')
  const [abertos, setAbertos] = useState<Record<string, boolean>>({ entradas: true, saidas: true })
  const [versaoDados, setVersaoDados] = useState(0)

  const dados = useMemo(() => {
    void versaoDados

    const contasReceber = listarContasReceberStorage()
    const contasPagar = lerContasPagar()
    const linhas: LinhaFluxo[] = []

    contasReceber.forEach((conta) => {
      if (conta.status === 'Cancelada') return

      const recebido = valorRecebidoConta(conta)
      const realizado =
        (conta.status === 'Paga' || conta.status === 'Parcialmente paga') &&
        Boolean(conta.dataRecebimento) &&
        recebido > 0

      if (realizado) {
        linhas.push({
          id: `cr-realizado-${conta.id}`,
          data: conta.dataRecebimento || conta.dataVencimento,
          tipo: 'entrada',
          situacao: 'Realizado',
          grupo: 'Receitas realizadas',
          categoria: conta.formaPagamento || conta.tipoCobranca || 'Entradas de vendas',
          descricao: `${conta.clienteNome} — ${conta.descricao || 'Venda recebida'}`,
          origem: conta.pedidoNumero ? `Pedido ${conta.pedidoNumero}` : 'Contas a Receber',
          conta: conta.contaRecebimento || conta.bancoCobranca || 'Conta não informada',
          valor: recebido,
        })
      }

      const saldoAberto = Number(conta.saldoAberto || 0)
      if (saldoAberto > 0 && conta.status !== 'Paga') {
        linhas.push({
          id: `cr-previsto-${conta.id}`,
          data: conta.dataVencimento,
          tipo: 'entrada',
          situacao: 'Previsto',
          grupo: 'Contas a Receber',
          categoria: conta.formaPagamento || conta.tipoCobranca || 'Entradas de vendas',
          descricao: `${conta.clienteNome} — ${conta.descricao || 'Conta a receber'}`,
          origem: conta.pedidoNumero ? `Pedido ${conta.pedidoNumero}` : 'Contas a Receber',
          conta: conta.bancoCobranca || conta.contaRecebimento || 'Conta não informada',
          valor: saldoAberto,
        })
      }
    })

    contasPagar.forEach((conta) => {
      if (conta.status === 'Cancelada') return

      if (conta.status === 'Paga') {
        linhas.push({
          id: `cp-realizado-${conta.id}`,
          data: conta.dataPagamento || conta.vencimento,
          tipo: 'saida',
          situacao: 'Realizado',
          grupo: 'Despesas realizadas',
          categoria: conta.categoria || 'Despesas gerais',
          descricao: `${conta.fornecedor} — ${conta.descricao || 'Conta paga'}`,
          origem: conta.documento ? `Documento ${conta.documento}` : 'Contas a Pagar',
          conta: 'Conta de pagamento não informada',
          valor: Number((conta.valorPago ?? conta.valor) || 0),
        })
        return
      }

      if (conta.status === 'Em aberto') {
        linhas.push({
          id: `cp-previsto-${conta.id}`,
          data: conta.vencimento,
          tipo: 'saida',
          situacao: 'Previsto',
          grupo: 'Contas a Pagar',
          categoria: conta.categoria || 'Despesas gerais',
          descricao: `${conta.fornecedor} — ${conta.descricao || 'Conta a pagar'}`,
          origem: conta.documento ? `Documento ${conta.documento}` : 'Contas a Pagar',
          conta: 'Conta de pagamento não informada',
          valor: Number(conta.valor || 0),
        })
      }
    })

    const termo = normalizarTexto(busca.trim())
    const filtradas = linhas
      .filter((linha) => !dataInicio || linha.data >= dataInicio)
      .filter((linha) => !dataFim || linha.data <= dataFim)
      .filter((linha) => situacaoFiltro === 'Todas' || linha.situacao === situacaoFiltro)
      .filter((linha) => tipoFiltro === 'Todos' || (tipoFiltro === 'Entradas' ? linha.tipo === 'entrada' : linha.tipo === 'saida'))
      .filter((linha) => contaFiltro === 'Todas' || linha.conta === contaFiltro)
      .filter((linha) => {
        if (!termo) return true
        return normalizarTexto([
          linha.descricao,
          linha.categoria,
          linha.grupo,
          linha.origem,
          linha.conta,
          linha.situacao,
        ].join(' ')).includes(termo)
      })
      .sort((a, b) => a.data.localeCompare(b.data))

    const saldo = Number(saldoInicial.replace(/\./g, '').replace(',', '.')) || 0
    const entradasRealizadas = filtradas.filter((x) => x.tipo === 'entrada' && x.situacao === 'Realizado').reduce((s, x) => s + x.valor, 0)
    const entradasPrevistas = filtradas.filter((x) => x.tipo === 'entrada' && x.situacao === 'Previsto').reduce((s, x) => s + x.valor, 0)
    const saidasRealizadas = filtradas.filter((x) => x.tipo === 'saida' && x.situacao === 'Realizado').reduce((s, x) => s + x.valor, 0)
    const saidasPrevistas = filtradas.filter((x) => x.tipo === 'saida' && x.situacao === 'Previsto').reduce((s, x) => s + x.valor, 0)

    let acumulado = saldo
    const movimentos = filtradas.map((linha) => {
      acumulado += linha.tipo === 'entrada' ? linha.valor : -linha.valor
      return { ...linha, acumulado }
    })

    return {
      movimentos,
      gruposEntradas: agruparLinhas(filtradas, 'entrada'),
      gruposSaidas: agruparLinhas(filtradas, 'saida'),
      saldo,
      entradasRealizadas,
      entradasPrevistas,
      saidasRealizadas,
      saidasPrevistas,
      totalEntradas: entradasRealizadas + entradasPrevistas,
      totalSaidas: saidasRealizadas + saidasPrevistas,
      saldoProjetado: saldo + entradasRealizadas + entradasPrevistas - saidasRealizadas - saidasPrevistas,
      contasDisponiveis: Array.from(new Set(linhas.map((linha) => linha.conta))).sort((a, b) => a.localeCompare(b)),
    }
  }, [busca, contaFiltro, dataFim, dataInicio, saldoInicial, situacaoFiltro, tipoFiltro, versaoDados])

  const filtrosAtivos = [
    situacaoFiltro !== 'Todas',
    tipoFiltro !== 'Todos',
    contaFiltro !== 'Todas',
  ].filter(Boolean).length

  function alternarAberto(chave: string) {
    setAbertos((atual) => ({ ...atual, [chave]: !atual[chave] }))
  }

  function limparFiltros() {
    setSituacaoFiltro('Todas')
    setTipoFiltro('Todos')
    setContaFiltro('Todas')
    setBusca('')
  }

  return (
    <section className="financeiro-fluxo-embutido">
      <div className="financeiro-fluxo-embutido-header">
        <div>
          <h2>Fluxo de Caixa</h2>
          <p>Entradas e saídas atualizadas pelas Contas a Receber e Contas a Pagar.</p>
        </div>
        <div className="financeiro-fluxo-embutido-acoes">
          <button type="button" className="financeiro-icon-button financeiro-icon-list" title="Movimentos" onClick={() => setVisao('movimentos')}>
            <List size={25} strokeWidth={2.4} />
          </button>
          <button type="button" className={`financeiro-filter-button ${filtrosAtivos ? 'ativo' : ''}`} title="Filtros" onClick={() => setMostrarFiltros((atual) => !atual)}>
            <Filter size={20} />
            {filtrosAtivos > 0 && <span>{filtrosAtivos}</span>}
          </button>
          <button type="button" className="financeiro-icon-button financeiro-icon-refresh" title="Atualizar" onClick={() => setVersaoDados((atual) => atual + 1)}>
            <RefreshCw size={25} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <div className="financeiro-busca fluxo-caixa-busca financeiro-fluxo-busca-embutida">
        <Search size={18} />
        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setBusca(event.currentTarget.value)
          }}
          placeholder="Buscar cliente, fornecedor, categoria, pedido ou documento"
        />
      </div>

      {mostrarFiltros && (
        <section className="fluxo-caixa-filtros">
          <label><span>De</span><input type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} /></label>
          <label><span>Até</span><input type="date" value={dataFim} onChange={(event) => setDataFim(event.target.value)} /></label>
          <label><span>Contas</span><select value={contaFiltro} onChange={(event) => setContaFiltro(event.target.value)}><option>Todas</option>{dados.contasDisponiveis.map((conta) => <option key={conta}>{conta}</option>)}</select></label>
          <label><span>Situação</span><select value={situacaoFiltro} onChange={(event) => setSituacaoFiltro(event.target.value as 'Todas' | SituacaoLinha)}><option>Todas</option><option>Realizado</option><option>Previsto</option></select></label>
          <label><span>Movimento</span><select value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value as 'Todos' | 'Entradas' | 'Saídas')}><option>Todos</option><option>Entradas</option><option>Saídas</option></select></label>
          <label><span>Saldo inicial</span><input value={saldoInicial} onChange={(event) => setSaldoInicial(event.target.value)} placeholder="0,00" /></label>
          <div className="fluxo-caixa-filtros-acoes"><button type="button" onClick={limparFiltros}>Limpar filtros</button></div>
        </section>
      )}

      <section className="fluxo-caixa-resumo">
        <article><span>Saldo inicial</span><strong>{moeda(dados.saldo)}</strong><small>Valor informado para o período</small></article>
        <article><span>Entradas</span><strong>{moeda(dados.totalEntradas)}</strong><small>{moeda(dados.entradasRealizadas)} realizado · {moeda(dados.entradasPrevistas)} previsto</small></article>
        <article><span>Saídas</span><strong>{moeda(dados.totalSaidas)}</strong><small>{moeda(dados.saidasRealizadas)} realizado · {moeda(dados.saidasPrevistas)} previsto</small></article>
        <article className="saldo-projetado"><span>Saldo final projetado</span><strong>{moeda(dados.saldoProjetado)}</strong><small>Saldo inicial + entradas − saídas</small></article>
      </section>

      <div className="fluxo-caixa-modos">
        <button className={visao === 'analitica' ? 'ativo' : ''} onClick={() => setVisao('analitica')}>Visão analítica</button>
        <button className={visao === 'movimentos' ? 'ativo' : ''} onClick={() => setVisao('movimentos')}>Movimentos</button>
      </div>

      {visao === 'analitica' ? (
        <section className="fluxo-caixa-analitico">
          <div className="fluxo-caixa-linha-principal saldo-inicial"><span>Saldo inicial</span><strong>{moeda(dados.saldo)}</strong></div>

          <button className="fluxo-caixa-linha-principal entrada" onClick={() => alternarAberto('entradas')}>
            <span>{abertos.entradas ? <ChevronDown size={20} /> : <ChevronRight size={20} />} Receitas / Entradas</span><strong>{moeda(dados.totalEntradas)}</strong>
          </button>
          {abertos.entradas && (
            <div className="fluxo-caixa-grupos">
              {dados.gruposEntradas.map((grupo) => {
                const chaveGrupo = `entrada-${grupo.nome}`
                return <div className="fluxo-caixa-grupo" key={chaveGrupo}>
                  <button className="fluxo-caixa-linha-grupo" onClick={() => alternarAberto(chaveGrupo)}><span>{abertos[chaveGrupo] ? <ChevronDown size={18} /> : <ChevronRight size={18} />} {grupo.nome}</span><strong>{moeda(grupo.total)}</strong></button>
                  {abertos[chaveGrupo] && grupo.categorias.map((categoria) => {
                    const chaveCategoria = `${chaveGrupo}-${categoria.nome}`
                    return <div key={chaveCategoria} className="fluxo-caixa-categoria">
                      <button className="fluxo-caixa-linha-categoria" onClick={() => alternarAberto(chaveCategoria)}><span>{abertos[chaveCategoria] ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {categoria.nome}</span><strong>{moeda(categoria.total)}</strong></button>
                      {abertos[chaveCategoria] && <div className="fluxo-caixa-itens">{categoria.linhas.map((linha) => <div className="fluxo-caixa-item" key={linha.id}><div><strong>{formatarData(linha.data)}</strong><span>{linha.descricao}</span><small>{linha.origem} · {linha.conta}</small></div><div><span className={`fluxo-situacao ${linha.situacao.toLowerCase()}`}>{linha.situacao}</span><strong>{moeda(linha.valor)}</strong></div></div>)}</div>}
                    </div>
                  })}
                </div>
              })}
              {!dados.gruposEntradas.length && <div className="fluxo-caixa-vazio">Nenhuma entrada no período selecionado.</div>}
            </div>
          )}

          <button className="fluxo-caixa-linha-principal saida" onClick={() => alternarAberto('saidas')}>
            <span>{abertos.saidas ? <ChevronDown size={20} /> : <ChevronRight size={20} />} Despesas / Saídas</span><strong>{moeda(dados.totalSaidas)}</strong>
          </button>
          {abertos.saidas && (
            <div className="fluxo-caixa-grupos">
              {dados.gruposSaidas.map((grupo) => {
                const chaveGrupo = `saida-${grupo.nome}`
                return <div className="fluxo-caixa-grupo" key={chaveGrupo}>
                  <button className="fluxo-caixa-linha-grupo" onClick={() => alternarAberto(chaveGrupo)}><span>{abertos[chaveGrupo] ? <ChevronDown size={18} /> : <ChevronRight size={18} />} {grupo.nome}</span><strong>{moeda(grupo.total)}</strong></button>
                  {abertos[chaveGrupo] && grupo.categorias.map((categoria) => {
                    const chaveCategoria = `${chaveGrupo}-${categoria.nome}`
                    return <div key={chaveCategoria} className="fluxo-caixa-categoria">
                      <button className="fluxo-caixa-linha-categoria" onClick={() => alternarAberto(chaveCategoria)}><span>{abertos[chaveCategoria] ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {categoria.nome}</span><strong>{moeda(categoria.total)}</strong></button>
                      {abertos[chaveCategoria] && <div className="fluxo-caixa-itens">{categoria.linhas.map((linha) => <div className="fluxo-caixa-item" key={linha.id}><div><strong>{formatarData(linha.data)}</strong><span>{linha.descricao}</span><small>{linha.origem} · {linha.conta}</small></div><div><span className={`fluxo-situacao ${linha.situacao.toLowerCase()}`}>{linha.situacao}</span><strong>{moeda(linha.valor)}</strong></div></div>)}</div>}
                    </div>
                  })}
                </div>
              })}
              {!dados.gruposSaidas.length && <div className="fluxo-caixa-vazio">Nenhuma saída no período selecionado.</div>}
            </div>
          )}

          <div className="fluxo-caixa-linha-principal saldo-final"><span>Saldo final projetado</span><strong>{moeda(dados.saldoProjetado)}</strong></div>
        </section>
      ) : (
        <section className="fluxo-caixa-tabela-card">
          <div className="novo-table-wrap">
            <table className="novo-table fluxo-caixa-tabela">
              <thead><tr><th>Data</th><th>Situação</th><th>Tipo</th><th>Categoria</th><th>Descrição / Origem</th><th>Conta</th><th>Valor</th><th>Saldo projetado</th></tr></thead>
              <tbody>
                {dados.movimentos.map((linha) => <tr key={linha.id}><td>{formatarData(linha.data)}</td><td><span className={`fluxo-situacao ${linha.situacao.toLowerCase()}`}>{linha.situacao}</span></td><td><span className={`fluxo-tipo ${linha.tipo}`}>{linha.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></td><td>{linha.categoria}</td><td><strong>{linha.descricao}</strong><small>{linha.origem}</small></td><td>{linha.conta}</td><td className={linha.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}>{linha.tipo === 'entrada' ? '+' : '−'} {moeda(linha.valor)}</td><td><strong>{moeda(linha.acumulado)}</strong></td></tr>)}
                {!dados.movimentos.length && <tr><td colSpan={8} className="novo-empty">Nenhum movimento encontrado no período.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  )
}
