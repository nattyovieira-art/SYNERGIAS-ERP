import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  ReceiptText,
  RotateCcw,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import type { ContaReceber } from '../../types/Financeiro'
import type { ParcelaVenda, Venda } from '../../types/Venda'
import {
  atualizarRecebimentoManualStorage,
  listarContasReceberStorage,
} from '../../services/financeiroStorage'
import {
  listarVendasStorage,
  salvarVendaStorage,
} from '../../services/vendasStorage'

import '../../styles/financeiro.css'
import '../../styles/receber-conta.css'

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function dinheiro(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatarData(data?: string) {
  if (!data) return '-'
  const [ano, mes, dia] = data.split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
}

function moedaInput(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function converterMoeda(valor: string) {
  const limpo = String(valor || '').replace(/[^\d,.-]/g, '')
  if (!limpo) return 0
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo
  return Number(normalizado) || 0
}

function localizarParcela(venda: Venda, conta: ContaReceber) {
  const parcelas = Array.isArray(venda.parcelas) ? venda.parcelas : []

  if (conta.parcelaNumero) {
    const indice = parcelas.findIndex(
      (parcela) => Number(parcela.numero) === Number(conta.parcelaNumero),
    )
    if (indice >= 0) return indice
  }

  return parcelas.findIndex(
    (parcela) =>
      parcela.vencimento === conta.dataVencimento &&
      Math.abs(Number(parcela.valor || 0) - Number(conta.valorOriginal || 0)) < 0.01,
  )
}

function localizarPedido(conta: ContaReceber) {
  return listarVendasStorage().find(
    (item) =>
      String(item.id) === String(conta.pedidoId || '') ||
      String(item.numeroPedido || '') === String(conta.pedidoNumero || ''),
  )
}

function atualizarPedidoPelaConta(conta: ContaReceber) {
  if (!conta.pedidoId && !conta.pedidoNumero) return

  const venda = localizarPedido(conta)
  if (!venda) return

  const indiceParcela = localizarParcela(venda, conta)
  if (indiceParcela < 0) return

  const agora = new Date()
  const parcelasAtualizadas = venda.parcelas.map((parcela: ParcelaVenda, index) => {
    if (index !== indiceParcela) return parcela

    const paga = conta.status === 'Paga'

    return {
      ...parcela,
      vencimento: conta.dataVencimento,
      tipoCobranca: conta.tipoCobranca as ParcelaVenda['tipoCobranca'],
      bancoCobranca: conta.bancoCobranca as ParcelaVenda['bancoCobranca'],
      statusBoleto: paga ? 'Pago' : 'Pendente',
      dataPagamentoBoleto: paga ? conta.dataRecebimento || hoje() : '',
      horarioPagamentoBoleto: paga
        ? agora.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '',
      valorRecebido: Number(conta.valorRecebido || 0),
      jurosRecebimento: Number(conta.jurosRecebidos || 0),
      descontoRecebimento: Number(conta.descontosConcedidos || 0),
      contaRecebimento: conta.contaRecebimento || '',
      observacaoRecebimento: conta.observacao || '',
    } as ParcelaVenda
  })

  const todasPagas =
    parcelasAtualizadas.length > 0 &&
    parcelasAtualizadas.every((parcela) => parcela.statusBoleto === 'Pago')
  const algumaPaga = parcelasAtualizadas.some((parcela) => parcela.statusBoleto === 'Pago')

  salvarVendaStorage({
    ...venda,
    formaPagamento: (conta.formaPagamento || venda.formaPagamento) as Venda['formaPagamento'],
    tipoCobranca: (conta.tipoCobranca || venda.tipoCobranca) as Venda['tipoCobranca'],
    bancoCobranca: (conta.bancoCobranca || venda.bancoCobranca) as Venda['bancoCobranca'],
    parcelas: parcelasAtualizadas,
    statusBoleto: todasPagas ? 'Pago' : algumaPaga ? 'Gerado' : 'Pendente',
  })
}

function ReceberConta() {
  const navigate = useNavigate()
  const { id } = useParams()

  const conta = useMemo(
    () => listarContasReceberStorage().find((item) => String(item.id) === String(id)),
    [id],
  )

  const principalInicial = conta
    ? Number(
        conta.valorPrincipalRecebido ??
          Math.max(
            Number(conta.valorOriginal || 0) - Number(conta.saldoAberto || 0),
            0,
          ),
      )
    : 0

  const [dataRecebimento, setDataRecebimento] = useState(
    conta?.dataRecebimento || hoje(),
  )
  const [dataVencimento, setDataVencimento] = useState(conta?.dataVencimento || hoje())
  const [valorPrincipal, setValorPrincipal] = useState(() => moedaInput(principalInicial))
  const [juros, setJuros] = useState(() => moedaInput(Number(conta?.jurosRecebidos || 0)))
  const [desconto, setDesconto] = useState(() =>
    moedaInput(Number(conta?.descontosConcedidos || 0)),
  )
  const [formaPagamento, setFormaPagamento] = useState(conta?.formaPagamento || '')
  const [tipoCobranca, setTipoCobranca] = useState(conta?.tipoCobranca || '')
  const [bancoCobranca, setBancoCobranca] = useState(conta?.bancoCobranca || '')
  const [contaRecebimento, setContaRecebimento] = useState(
    conta?.contaRecebimento || 'CAIXA / DINHEIRO',
  )
  const [observacao, setObservacao] = useState(conta?.observacao || '')

  const valores = useMemo(() => {
    const principal = converterMoeda(valorPrincipal)
    const valorJuros = converterMoeda(juros)
    const valorDesconto = converterMoeda(desconto)
    const totalRecebido = Math.max(principal + valorJuros - valorDesconto, 0)
    const saldoDepois = Math.max(
      Number(conta?.valorOriginal || 0) - principal,
      0,
    )

    return {
      principal,
      juros: valorJuros,
      desconto: valorDesconto,
      totalRecebido,
      saldoDepois,
    }
  }, [conta?.valorOriginal, desconto, juros, valorPrincipal])

  function voltar() {
    if (conta?.pedidoId) {
      navigate(`/vendas/pedidos/editar/${conta.pedidoId}`)
      return
    }
    navigate('/financeiro/contas-a-receber')
  }

  function salvarAjuste() {
    if (!conta) return

    if (!dataRecebimento) {
      alert('Informe a data do pagamento.')
      return
    }

    if (!dataVencimento) {
      alert('Informe a data de vencimento.')
      return
    }

    if (valores.principal > Number(conta.valorOriginal || 0) + 0.01) {
      alert('O valor principal não pode ultrapassar o valor original da conta.')
      return
    }

    const atualizada = atualizarRecebimentoManualStorage({
      contaId: conta.id,
      valorPrincipal: valores.principal,
      juros: valores.juros,
      desconto: valores.desconto,
      dataRecebimento,
      dataVencimento,
      formaPagamento,
      tipoCobranca,
      bancoCobranca,
      contaRecebimento,
      observacao,
    })

    if (!atualizada) {
      alert('Não foi possível atualizar a conta a receber.')
      return
    }

    atualizarPedidoPelaConta(atualizada)

    alert(
      atualizada.status === 'Paga'
        ? 'Pagamento atualizado e sincronizado com o pedido.'
        : 'Ajuste salvo. Pedido e financeiro foram sincronizados.',
    )

    voltar()
  }

  function desfazerPagamento() {
    if (!conta) return

    const confirmar = window.confirm(
      'Deseja desfazer o pagamento desta parcela? O pedido e o financeiro voltarão para pendente.',
    )
    if (!confirmar) return

    const atualizada = atualizarRecebimentoManualStorage({
      contaId: conta.id,
      valorPrincipal: 0,
      juros: 0,
      desconto: 0,
      dataRecebimento: '',
      dataVencimento,
      formaPagamento,
      tipoCobranca,
      bancoCobranca,
      contaRecebimento: '',
      observacao,
    })

    if (atualizada) atualizarPedidoPelaConta(atualizada)

    alert('Pagamento desfeito. Pedido e financeiro voltaram para pendente.')
    voltar()
  }

  if (!conta) {
    return (
      <main className="financeiro-page">
        <Sidebar />
        <section className="financeiro-content">
          <PageHeader
            category="Financeiro"
            title="Ajustar Recebimento"
            subtitle="Edição de pagamento e sincronização com o pedido"
          />
          <section className="receber-conta-nao-encontrada">
            <ReceiptText size={34} />
            <h2>Conta a receber não encontrada</h2>
            <button type="button" onClick={() => navigate('/financeiro/contas-a-receber')}>
              Voltar para Contas a Receber
            </button>
          </section>
        </section>
      </main>
    )
  }

  return (
    <main className="financeiro-page receber-conta-page">
      <Sidebar />

      <section className="financeiro-content">
        <PageHeader
          category="Financeiro"
          title="Ajustar Recebimento"
          subtitle="Altere o pagamento e mantenha Pedido e Contas a Receber sincronizados"
        />

        <div className="receber-conta-toolbar">
          <div className="receber-conta-toolbar-esquerda">
            <button type="button" className="receber-conta-voltar" onClick={voltar} title="Voltar">
              <ArrowLeft size={25} strokeWidth={2.4} />
            </button>
          </div>

          <div className="receber-conta-toolbar-direita">
            <button
              type="button"
              className="receber-conta-desfazer-topo"
              onClick={desfazerPagamento}
              title="Desfazer pagamento"
              aria-label="Desfazer pagamento"
            >
              <RotateCcw size={25} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <section className="receber-conta-card">
          <header className="receber-conta-cabecalho">
            <div className="receber-conta-cliente">
              <span>CONTA A RECEBER</span>
              <h2>{conta.clienteNome}</h2>
              <p>{conta.clienteDocumento || 'Documento não informado'}</p>
            </div>

            <div className="receber-conta-documento">
              <span>Pedido</span>
              <strong>{conta.pedidoNumero || '-'}</strong>
              <small>Vencimento {formatarData(dataVencimento)}</small>
            </div>

            <div className="receber-conta-saldo">
              <span>SALDO EM ABERTO</span>
              <strong>{dinheiro(valores.saldoDepois)}</strong>
            </div>
          </header>

          <div className="receber-conta-descricao">
            <CircleDollarSign size={22} />
            <div>
              <strong>{conta.descricao || 'Recebimento de pedido'}</strong>
              <span>
                {formaPagamento || '-'} · {tipoCobranca || '-'} · {bancoCobranca || 'Sem banco'}
              </span>
            </div>
          </div>

          <section className="receber-conta-dados-pagamento">
            <label>
              Vencimento
              <input
                type="date"
                value={dataVencimento}
                onChange={(event) => setDataVencimento(event.target.value)}
              />
            </label>

            <label>
              Forma de pagamento
              <select
                value={formaPagamento}
                onChange={(event) => setFormaPagamento(event.target.value)}
              >
                <option value="">Selecione</option>
                <option value="BOLETO">BOLETO</option>
                <option value="PIX">PIX</option>
                <option value="TRANSFERÊNCIA">TRANSFERÊNCIA</option>
                <option value="DINHEIRO">DINHEIRO</option>
                <option value="CARTÃO">CARTÃO</option>
              </select>
            </label>

            <label>
              Tipo / cobrança
              <input
                value={tipoCobranca}
                onChange={(event) => setTipoCobranca(event.target.value)}
                placeholder="Ex.: BOLETO BANCO INTER"
              />
            </label>

            <label>
              Banco de cobrança
              <input
                value={bancoCobranca}
                onChange={(event) => setBancoCobranca(event.target.value)}
                placeholder="Ex.: Inter"
              />
            </label>
          </section>

          <section className="receber-conta-lancamento">
            <div className="receber-conta-linha-titulos">
              <span>Data do pagamento</span>
              <span>Valor principal</span>
              <span>Juros</span>
              <span>Desconto</span>
              <span>Valor recebido</span>
              <span>Saldo</span>
            </div>

            <div className="receber-conta-linha-valores">
              <input
                type="date"
                value={dataRecebimento}
                onChange={(event) => setDataRecebimento(event.target.value)}
              />
              <input
                value={valorPrincipal}
                onChange={(event) => setValorPrincipal(event.target.value)}
              />
              <input value={juros} onChange={(event) => setJuros(event.target.value)} />
              <input value={desconto} onChange={(event) => setDesconto(event.target.value)} />
              <strong>{dinheiro(valores.totalRecebido)}</strong>
              <strong>{dinheiro(valores.saldoDepois)}</strong>
            </div>
          </section>

          <section className="receber-conta-complemento">
            <label>
              Conta bancária / caixa
              <select
                value={contaRecebimento}
                onChange={(event) => setContaRecebimento(event.target.value)}
              >
                <option>CAIXA / DINHEIRO</option>
                <option>BANCO INTER</option>
                <option>BANCO CORA</option>
                <option>SUMUP</option>
                <option>OUTRA CONTA</option>
              </select>
            </label>

            <label>
              Observação do recebimento
              <textarea
                value={observacao}
                onChange={(event) => setObservacao(event.target.value)}
                placeholder="Informações internas sobre este recebimento..."
              />
            </label>
          </section>

          <footer className="receber-conta-rodape receber-conta-rodape-edicao">
            <div>
              <span>VALOR RECEBIDO</span>
              <strong>{dinheiro(valores.totalRecebido)}</strong>
            </div>

            <button type="button" className="receber-conta-cancelar" onClick={voltar}>
              CANCELAR
            </button>

            <button type="button" className="receber-conta-confirmar" onClick={salvarAjuste}>
              <CheckCircle2 size={22} />
              SALVAR
            </button>
          </footer>
        </section>
      </section>
    </main>
  )
}

export default ReceberConta
