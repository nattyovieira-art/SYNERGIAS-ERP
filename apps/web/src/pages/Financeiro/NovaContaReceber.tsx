import { useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'

import '../../styles/financeiro.css'

type StatusContaReceber =
  | 'Aberta'
  | 'Parcialmente paga'
  | 'Paga'
  | 'Vencida'
  | 'Cancelada'

type ContaReceber = {
  id: string
  pedidoId?: string
  pedidoNumero?: string
  numeroNotaFiscal?: string
  numeroBoleto?: string
  clienteCodigo?: string
  clienteNome: string
  clienteDocumento?: string
  descricao: string
  dataEmissao: string
  dataVencimento: string
  dataRecebimento?: string
  valorOriginal: number
  valorRecebido: number
  saldoAberto: number
  formaPagamento?: string
  bancoCobranca?: string
  tipoCobranca?: string
  status: StatusContaReceber
  observacao?: string
  conciliado?: boolean
  criadoEm?: string
  atualizadoEm?: string
}

const STORAGE_CONTAS_RECEBER = 'synergias_contas_receber'

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function gerarId() {
  return `conta-receber-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

function listarContasReceberStorage(): ContaReceber[] {
  if (typeof window === 'undefined') return []

  try {
    const dados = window.localStorage.getItem(STORAGE_CONTAS_RECEBER)

    if (!dados) return []

    const contas = JSON.parse(dados)

    return Array.isArray(contas) ? (contas as ContaReceber[]) : []
  } catch {
    return []
  }
}

function salvarContaReceberStorage(conta: ContaReceber) {
  const contas = listarContasReceberStorage()

  window.localStorage.setItem(
    STORAGE_CONTAS_RECEBER,
    JSON.stringify([...contas, conta]),
  )
}

function NovaContaReceber() {
  const navigate = useNavigate()

  const [clienteNome, setClienteNome] = useState('')
  const [clienteDocumento, setClienteDocumento] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataEmissao, setDataEmissao] = useState(hoje())
  const [dataVencimento, setDataVencimento] = useState('')
  const [valorOriginal, setValorOriginal] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [bancoCobranca, setBancoCobranca] = useState('')
  const [tipoCobranca, setTipoCobranca] = useState('')
  const [pedidoNumero, setPedidoNumero] = useState('')
  const [numeroNotaFiscal, setNumeroNotaFiscal] = useState('')
  const [numeroBoleto, setNumeroBoleto] = useState('')
  const [observacao, setObservacao] = useState('')

  function salvarConta() {
    const valor = Number(String(valorOriginal).replace(',', '.'))

    if (!clienteNome.trim()) {
      alert('Informe o cliente.')
      return
    }

    if (!descricao.trim()) {
      alert('Informe a descrição da conta.')
      return
    }

    if (!dataVencimento) {
      alert('Informe a data de vencimento.')
      return
    }

    if (!Number.isFinite(valor) || valor <= 0) {
      alert('Informe um valor original válido.')
      return
    }

    const agora = new Date().toISOString()

    const conta: ContaReceber = {
      id: gerarId(),
      pedidoNumero: pedidoNumero.trim() || undefined,
      numeroNotaFiscal: numeroNotaFiscal.trim() || undefined,
      numeroBoleto: numeroBoleto.trim() || undefined,
      clienteNome: clienteNome.trim(),
      clienteDocumento: clienteDocumento.trim() || undefined,
      descricao: descricao.trim(),
      dataEmissao,
      dataVencimento,
      valorOriginal: valor,
      valorRecebido: 0,
      saldoAberto: valor,
      formaPagamento: formaPagamento || undefined,
      bancoCobranca: bancoCobranca || undefined,
      tipoCobranca: tipoCobranca || undefined,
      status: dataVencimento < hoje() ? 'Vencida' : 'Aberta',
      observacao: observacao.trim() || undefined,
      conciliado: false,
      criadoEm: agora,
      atualizadoEm: agora,
    }

    salvarContaReceberStorage(conta)

    alert('Conta a receber adicionada com sucesso.')
    navigate('/financeiro/contas-a-receber')
  }

  return (
    <main className="financeiro-page">
      <Sidebar />

      <section className="financeiro-content">
        <PageHeader
          category="Financeiro"
          title="Nova Conta a Receber"
          subtitle="Cadastre manualmente um novo recebível no financeiro."
        />

        <div className="financeiro-nova-conta-actions">
          <button
            type="button"
            className="financeiro-icon-button financeiro-icon-back"
            onClick={() => navigate('/financeiro/contas-a-receber')}
            title="Voltar"
            aria-label="Voltar"
          >
            <ArrowLeft size={25} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            className="financeiro-icon-button financeiro-icon-save"
            onClick={salvarConta}
            title="Salvar conta"
            aria-label="Salvar conta"
          >
            <Save size={25} strokeWidth={2.4} />
          </button>
        </div>

        <section className="financeiro-nova-conta-card">
          <div className="financeiro-nova-conta-section-title">
            <h2>Dados da Conta</h2>
          </div>

          <div className="financeiro-nova-conta-grid financeiro-nova-conta-grid-2">
            <label>
              Cliente
              <input
                type="text"
                value={clienteNome}
                onChange={(event) => setClienteNome(event.target.value)}
                placeholder="Nome ou razão social"
              />
            </label>

            <label>
              CNPJ / CPF
              <input
                type="text"
                value={clienteDocumento}
                onChange={(event) => setClienteDocumento(event.target.value)}
                placeholder="Documento do cliente"
              />
            </label>
          </div>

          <div className="financeiro-nova-conta-grid">
            <label>
              Descrição
              <input
                type="text"
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                placeholder="Ex.: Venda, boleto, serviço ou recebimento manual"
              />
            </label>
          </div>

          <div className="financeiro-nova-conta-grid financeiro-nova-conta-grid-3">
            <label>
              Data de emissão
              <input
                type="date"
                value={dataEmissao}
                onChange={(event) => setDataEmissao(event.target.value)}
              />
            </label>

            <label>
              Data de vencimento
              <input
                type="date"
                value={dataVencimento}
                onChange={(event) => setDataVencimento(event.target.value)}
              />
            </label>

            <label>
              Valor original
              <input
                type="number"
                min="0"
                step="0.01"
                value={valorOriginal}
                onChange={(event) => setValorOriginal(event.target.value)}
                placeholder="0,00"
              />
            </label>
          </div>
        </section>

        <section className="financeiro-nova-conta-card">
          <div className="financeiro-nova-conta-section-title">
            <h2>Cobrança e Origem</h2>
          </div>

          <div className="financeiro-nova-conta-grid financeiro-nova-conta-grid-3">
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
              Banco de cobrança
              <select
                value={bancoCobranca}
                onChange={(event) => setBancoCobranca(event.target.value)}
              >
                <option value="">Selecione</option>
                <option value="Inter">Banco Inter</option>
                <option value="SumUp">SumUp</option>
                <option value="Outro">Outro</option>
              </select>
            </label>

            <label>
              Tipo de cobrança
              <input
                type="text"
                value={tipoCobranca}
                onChange={(event) => setTipoCobranca(event.target.value)}
                placeholder="Ex.: Boleto, PIX, cartão"
              />
            </label>
          </div>

          <div className="financeiro-nova-conta-grid financeiro-nova-conta-grid-3">
            <label>
              Número do pedido
              <input
                type="text"
                value={pedidoNumero}
                onChange={(event) => setPedidoNumero(event.target.value)}
              />
            </label>

            <label>
              Número da NF-e
              <input
                type="text"
                value={numeroNotaFiscal}
                onChange={(event) => setNumeroNotaFiscal(event.target.value)}
              />
            </label>

            <label>
              Número do boleto
              <input
                type="text"
                value={numeroBoleto}
                onChange={(event) => setNumeroBoleto(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="financeiro-nova-conta-card">
          <div className="financeiro-nova-conta-section-title">
            <h2>Observações</h2>
          </div>

          <label className="financeiro-nova-conta-observacao">
            Observações da conta
            <textarea
              value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              placeholder="Informações adicionais sobre esta conta a receber"
            />
          </label>
        </section>
      </section>
    </main>
  )
}

export default NovaContaReceber
