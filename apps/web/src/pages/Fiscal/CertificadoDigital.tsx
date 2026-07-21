import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileKey2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import { obterConfiguracaoFiscalStorage } from '../../services/configuracaoFiscalStorage'
import {
  buscarStatusCertificadoA1,
  instalarCertificadoA1,
  removerCertificadoA1,
  solicitarCodigoCertificadoA1,
  type CertificadoA1Info,
} from '../../services/certificadoDigitalService'

import '../../styles/fiscal.css'

const VAZIO: CertificadoA1Info = {
  configurado: false,
  status: 'NAO_CONFIGURADO',
  cnpj: '',
  razaoSocial: '',
  emissor: '',
  validoDe: '',
  validoAte: '',
  diasRestantes: null,
  instaladoEm: '',
}

function formatarData(valor: string) {
  if (!valor) return '-'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return valor
  return data.toLocaleDateString('pt-BR')
}

function formatarDataHora(valor: string) {
  if (!valor) return '-'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return valor
  return data.toLocaleString('pt-BR')
}

function somenteNumeros(valor: string) {
  return String(valor || '').replace(/\D/g, '')
}

function formatarCnpj(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 14)
  if (numeros.length !== 14) return valor || '-'
  return numeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function CertificadoDigital() {
  const navigate = useNavigate()
  const configuracaoFiscal = useMemo(() => obterConfiguracaoFiscalStorage(), [])

  const [certificado, setCertificado] = useState<CertificadoA1Info>(VAZIO)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [senha, setSenha] = useState('')
  const [codigoSeguranca, setCodigoSeguranca] = useState('')
  const [enviandoCodigo, setEnviandoCodigo] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const cnpjConfigurado = somenteNumeros(configuracaoFiscal?.cnpj || '')

  async function carregarStatus() {
    setCarregando(true)
    setErro('')

    try {
      const status = await buscarStatusCertificadoA1()
      setCertificado(status)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível consultar o certificado.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregarStatus()
  }, [])

  function selecionarArquivo(event: ChangeEvent<HTMLInputElement>) {
    setMensagem('')
    setErro('')

    const selecionado = event.target.files?.[0] || null
    if (!selecionado) {
      setArquivo(null)
      return
    }

    const nome = selecionado.name.toLowerCase()
    if (!nome.endsWith('.pfx') && !nome.endsWith('.p12')) {
      setArquivo(null)
      event.target.value = ''
      setErro('Selecione um certificado digital A1 no formato .pfx ou .p12.')
      return
    }

    if (selecionado.size > 5 * 1024 * 1024) {
      setArquivo(null)
      event.target.value = ''
      setErro('O arquivo ultrapassa o limite de segurança de 5 MB.')
      return
    }

    setArquivo(selecionado)
  }

  async function solicitarCodigo() {
    setMensagem('')
    setErro('')
    setEnviandoCodigo(true)

    try {
      await solicitarCodigoCertificadoA1()
      setMensagem('Código de segurança enviado ao e-mail administrativo. Ele expira em 10 minutos.')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar o código de segurança.')
    } finally {
      setEnviandoCodigo(false)
    }
  }

  async function instalar() {
    setMensagem('')
    setErro('')

    if (!cnpjConfigurado || cnpjConfigurado.length !== 14) {
      setErro('Preencha e salve o CNPJ da Synergias em Configuração Fiscal antes de instalar o A1.')
      return
    }

    if (!arquivo) {
      setErro('Selecione o arquivo .pfx ou .p12.')
      return
    }

    if (!senha) {
      setErro('Informe a senha do certificado digital.')
      return
    }

    if (!/^\d{6}$/.test(codigoSeguranca.trim())) {
      setErro('Informe o código de segurança de 6 dígitos enviado ao e-mail administrativo.')
      return
    }

    setSalvando(true)

    try {
      const novoStatus = await instalarCertificadoA1({
        arquivo,
        senha,
        codigoSeguranca: codigoSeguranca.trim(),
        cnpjConfigurado,
      })

      setCertificado(novoStatus)
      setArquivo(null)
      setSenha('')
      setCodigoSeguranca('')
      setMensagem('Certificado Digital A1 validado, criptografado e instalado com segurança.')

      const input = document.getElementById('certificado-a1-arquivo') as HTMLInputElement | null
      if (input) input.value = ''
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível instalar o certificado.')
    } finally {
      setSalvando(false)
    }
  }

  async function remover() {
    setMensagem('')
    setErro('')

    if (!/^\d{6}$/.test(codigoSeguranca.trim())) {
      setErro('Solicite e informe o código de segurança de 6 dígitos para remover o certificado.')
      return
    }

    const confirmou = window.confirm(
      'Remover o Certificado Digital A1 do Synergias? As comunicações fiscais que dependem dele ficarão indisponíveis.',
    )

    if (!confirmou) return

    setSalvando(true)

    try {
      await removerCertificadoA1(codigoSeguranca.trim())
      setCertificado(VAZIO)
      setCodigoSeguranca('')
      setSenha('')
      setArquivo(null)
      setMensagem('Certificado removido com segurança.')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível remover o certificado.')
    } finally {
      setSalvando(false)
    }
  }

  const statusClass = certificado.status.toLowerCase().replaceAll('_', '-')

  return (
    <main className="fiscal-layout">
      <Sidebar />

      <section className="fiscal-page">
        <PageHeader
          category="Fiscal"
          title="Certificado Digital"
          subtitle="Gerencie o certificado A1 utilizado nas comunicações fiscais da Synergias."
        />

        <div className="fiscal-topbar">
          <button
            type="button"
            className="fiscal-icon-button fiscal-icon-back"
            title="Voltar"
            aria-label="Voltar"
            onClick={() => navigate('/configuracoes')}
          >
            <ArrowLeft size={24} />
          </button>

          <button
            type="button"
            className="fiscal-icon-button fiscal-icon-refresh"
            title="Atualizar status do certificado"
            aria-label="Atualizar status do certificado"
            onClick={() => window.location.reload()}
            disabled={carregando || salvando}
          >
            <RefreshCw
              size={24}
              className={carregando ? 'fiscal-a1-spin' : undefined}
            />
          </button>
        </div>

        {erro && (
          <div className="fiscal-a1-alert fiscal-a1-alert-error">
            <AlertTriangle size={20} />
            <span>{erro}</span>
          </div>
        )}

        {mensagem && (
          <div className="fiscal-a1-alert fiscal-a1-alert-success">
            <CheckCircle2 size={20} />
            <span>{mensagem}</span>
          </div>
        )}

        <section className="fiscal-form-card">
          <div className="fiscal-section-title">
            <ShieldCheck size={21} />
            <div>
              <h2>Status do certificado</h2>
              <p>Somente metadados do certificado são exibidos no navegador.</p>
            </div>
          </div>

          {carregando ? (
            <div className="fiscal-a1-loading">Consultando backend seguro...</div>
          ) : (
            <div className="fiscal-a1-status-grid">
              <div className="fiscal-a1-status-card fiscal-a1-status-principal">
                <span>Status</span>
                <strong className={`fiscal-a1-badge fiscal-a1-badge-${statusClass}`}>
                  {certificado.status === 'NAO_CONFIGURADO'
                    ? 'NÃO CONFIGURADO'
                    : certificado.status}
                </strong>
              </div>

              <div className="fiscal-a1-status-card">
                <span>Razão Social</span>
                <strong>{certificado.razaoSocial || '-'}</strong>
              </div>

              <div className="fiscal-a1-status-card">
                <span>CNPJ do certificado</span>
                <strong>{formatarCnpj(certificado.cnpj)}</strong>
              </div>

              <div className="fiscal-a1-status-card">
                <span>Autoridade emissora</span>
                <strong>{certificado.emissor || '-'}</strong>
              </div>

              <div className="fiscal-a1-status-card">
                <span>Válido de</span>
                <strong>{formatarData(certificado.validoDe)}</strong>
              </div>

              <div className="fiscal-a1-status-card">
                <span>Válido até</span>
                <strong>{formatarData(certificado.validoAte)}</strong>
              </div>

              <div className="fiscal-a1-status-card">
                <span>Dias restantes</span>
                <strong>
                  {certificado.diasRestantes === null ? '-' : `${certificado.diasRestantes} dias`}
                </strong>
              </div>

              <div className="fiscal-a1-status-card">
                <span>Instalado em</span>
                <strong>{formatarDataHora(certificado.instaladoEm)}</strong>
              </div>
            </div>
          )}
        </section>

        <section className="fiscal-form-card">
          <div className="fiscal-section-title">
            <LockKeyhole size={21} />
            <div>
              <h2>{certificado.configurado ? 'Substituir certificado' : 'Instalar certificado'}</h2>
              <p>
                O arquivo e a senha seguem por HTTPS quando o ERP estiver online e são processados somente pelo backend.
              </p>
            </div>
          </div>

          <div className="fiscal-a1-security-note">
            <FileKey2 size={22} />
            <div>
              <strong>CNPJ fiscal configurado</strong>
              <span>
                {cnpjConfigurado
                  ? formatarCnpj(cnpjConfigurado)
                  : 'CNPJ ainda não preenchido em Configuração Fiscal.'}
              </span>
            </div>
          </div>

          <div className="fiscal-grid fiscal-grid-2 fiscal-a1-form-grid">
            <label>
              Arquivo do certificado A1
              <input
                id="certificado-a1-arquivo"
                type="file"
                accept=".pfx,.p12,application/x-pkcs12"
                onChange={selecionarArquivo}
                disabled={salvando}
              />
              <small>{arquivo ? `${arquivo.name} • ${Math.ceil(arquivo.size / 1024)} KB` : 'Somente .pfx ou .p12 • máximo 5 MB'}</small>
            </label>

            <label>
              Senha do certificado
              <input
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Digite a senha do A1"
                disabled={salvando}
              />
              <small>A senha não volta para a tela depois da instalação.</small>
            </label>

            <label className="fiscal-a1-admin-token">
              Código de segurança por e-mail
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={codigoSeguranca}
                  onChange={(event) => setCodigoSeguranca(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  disabled={salvando}
                />
                <button
                  type="button"
                  className="fiscal-a1-button-secondary"
                  onClick={() => void solicitarCodigo()}
                  disabled={salvando || enviandoCodigo}
                >
                  {enviandoCodigo ? 'Enviando...' : 'Enviar código'}
                </button>
              </div>
              <small>O código expira em 10 minutos, só pode ser usado uma vez e não é salvo no navegador.</small>
            </label>
          </div>

          <div className="fiscal-a1-protections">
            <div><ShieldCheck size={17} /> Validação real PKCS#12</div>
            <div><LockKeyhole size={17} /> AES-256-GCM</div>
            <div><CalendarDays size={17} /> Validade conferida</div>
            <div><FileKey2 size={17} /> CNPJ comparado</div>
          </div>

          <div className="fiscal-footer-actions fiscal-a1-actions">
            {certificado.configurado && (
              <button
                type="button"
                className="fiscal-a1-button-danger"
                onClick={() => void remover()}
                disabled={salvando}
              >
                <Trash2 size={17} />
                Remover certificado
              </button>
            )}

            <button
              type="button"
              className="fiscal-button-principal"
              onClick={() => void instalar()}
              disabled={salvando}
            >
              <Upload size={17} />
              {salvando
                ? 'Validando e protegendo...'
                : certificado.configurado
                  ? 'Validar e substituir A1'
                  : 'Validar e instalar A1'}
            </button>
          </div>
        </section>

        <section className="fiscal-a1-warning-card">
          <AlertTriangle size={22} />
          <div>
            <strong>Importante para a publicação online</strong>
            <p>
              O certificado é processado somente pelo backend, criptografado com AES-256-GCM e salvo fora da área pública. A chave mestra fica em diretório privado separado. Instalação, substituição e remoção exigem sessão de Administrador e código único enviado por e-mail.
            </p>
          </div>
        </section>
      </section>
    </main>
  )
}

export default CertificadoDigital
