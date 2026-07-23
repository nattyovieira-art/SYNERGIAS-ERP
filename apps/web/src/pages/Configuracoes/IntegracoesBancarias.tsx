import { useEffect, useRef, useState } from 'react'
import ConfiguracaoFormShell from './ConfiguracaoFormShell'

type DiagnosticoInter = {
  configured?: boolean
  certificate?: boolean
  privateKey?: boolean
  integrationIdConfigured?: boolean
  clientIdConfigured?: boolean
  clientSecretConfigured?: boolean
  baseUrl?: string
  activeClientIdMasked?: string
  authenticationValidated?: boolean
  lastAuthAt?: string
  tokenExpiresAt?: string
}

type RespostaDiagnostico = {
  ok?: boolean
  inter?: DiagnosticoInter
  error?: string
}

function rotuloStatus(valor: boolean | undefined) {
  if (valor === true) return 'Configurado'
  if (valor === false) return 'Pendente'
  return 'N/D'
}

async function lerJsonSeguro(resposta: Response) {
  const texto = await resposta.text()
  try {
    return texto ? JSON.parse(texto) : {}
  } catch {
    throw new Error(texto || `Resposta inválida do servidor (HTTP ${resposta.status}).`)
  }
}

export default function IntegracoesBancarias() {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoInter | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [testando, setTestando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [testandoOutra, setTestandoOutra] = useState(false)
  const [ativandoOutra, setAtivandoOutra] = useState(false)
  const [outraValidada, setOutraValidada] = useState(false)
  const [clientIdTeste, setClientIdTeste] = useState('ecbbde3f-d6fd-490b-8c09-9ad5f0ef9250')
  const [clientSecretTeste, setClientSecretTeste] = useState('')
  const pacoteTesteRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [integrationId, setIntegrationId] = useState('')
  const [contaCorrente, setContaCorrente] = useState('287384420')
  const certificadoRef = useRef<HTMLInputElement>(null)
  const chavePrivadaRef = useRef<HTMLInputElement>(null)

  async function carregarDiagnostico(preservarMensagem = false) {
    setCarregando(true)
    if (!preservarMensagem) setMsg('')
    try {
      const resposta = await fetch('/api/inter-cobranca.php?action=diagnostico', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const payload = (await lerJsonSeguro(resposta)) as RespostaDiagnostico
      if (!resposta.ok || !payload.ok) throw new Error(payload.error || `Erro HTTP ${resposta.status}`)
      setDiagnostico(payload.inter || null)
    } catch (erro) {
      setDiagnostico(null)
      setMsg(erro instanceof Error ? erro.message : 'Não foi possível consultar o Banco Inter.')
    } finally {
      setCarregando(false)
    }
  }

  async function instalarCertificado() {
    const certificado = certificadoRef.current?.files?.[0]
    const chavePrivada = chavePrivadaRef.current?.files?.[0]
    if (!certificado) return setMsg('Selecione o certificado .crt baixado do Banco Inter.')
    if (!chavePrivada) return setMsg('Selecione a chave privada .key baixada da mesma integração do Banco Inter.')
    if (!clientId.trim() || !clientSecret.trim()) return setMsg('Informe o Client ID e o Client Secret da nova integração.')

    setSalvando(true)
    setMsg('Validando o certificado e a chave privada baixados do Banco Inter…')
    try {
      const dados = new FormData()
      dados.append('certificado', certificado)
      dados.append('chavePrivada', chavePrivada)
      dados.append('clientId', clientId.trim())
      dados.append('clientSecret', clientSecret.trim())
      dados.append('integrationId', integrationId.trim())
      dados.append('contaCorrente', contaCorrente.replace(/\D/g, ''))
      const resposta = await fetch('/api/inter-config-admin.php?action=instalar-certificado', {
        method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' }, body: dados,
      })
      const payload = await lerJsonSeguro(resposta)
      if (!resposta.ok || !payload?.ok) throw new Error(payload?.error || `Erro HTTP ${resposta.status}`)
      setClientSecret('')
      if (certificadoRef.current) certificadoRef.current.value = ''
      if (chavePrivadaRef.current) chavePrivadaRef.current.value = ''
      setMsg(payload.message || 'Configuração do Banco Inter salva com sucesso.')
      await carregarDiagnostico()
    } catch (erro) {
      setMsg(erro instanceof Error ? erro.message : 'Falha ao instalar o certificado do Banco Inter.')
    } finally {
      setSalvando(false)
    }
  }

  async function testarOutraIntegracao() {
    const pacote = pacoteTesteRef.current?.files?.[0]
    if (!pacote) return setMsg('Selecione o ZIP com o certificado e a chave da outra integração.')
    if (!clientIdTeste.trim() || !clientSecretTeste.trim()) return setMsg('Informe o Client ID e o Client Secret da outra integração.')

    setOutraValidada(false)
    setTestandoOutra(true)
    setMsg('Testando a outra integração diretamente no servidor, sem substituir a atual…')
    try {
      const dados = new FormData()
      dados.append('pacoteCertificado', pacote)
      dados.append('clientIdTeste', clientIdTeste.trim())
      dados.append('clientSecretTeste', clientSecretTeste.trim())
      const resposta = await fetch('/api/inter-config-admin.php?action=testar-integracao-temporaria', {
        method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' }, body: dados,
      })
      const payload = await lerJsonSeguro(resposta)
      if (!resposta.ok || !payload?.ok || !payload?.authenticated) {
        const http = Number(payload?.httpStatus || resposta.status || 0)
        throw new Error(`HTTP ${http || 'N/D'} — ${payload?.error || 'O Banco Inter não confirmou a autenticação.'}`)
      }
      const escopo = payload.scopeReturned || payload.scopeRequested || 'não informado'
      const validade = Number(payload.expiresIn || 0)
      setMsg(`OUTRA INTEGRAÇÃO VALIDADA — token gerado com sucesso. Escopos: ${escopo}${validade ? ` • validade: ${validade} segundos` : ''}. A integração atual não foi alterada.`)
      setOutraValidada(true)
    } catch (erro) {
      setMsg(erro instanceof Error ? erro.message : 'Falha ao testar a outra integração.')
    } finally {
      setTestandoOutra(false)
    }
  }


  async function ativarOutraIntegracao() {
    const pacote = pacoteTesteRef.current?.files?.[0]
    if (!pacote) return setMsg('Selecione novamente o ZIP validado com o certificado e a chave.')
    if (!clientIdTeste.trim() || !clientSecretTeste.trim()) return setMsg('Informe novamente o Client ID e o Client Secret validados.')

    setAtivandoOutra(true)
    setMsg('Validando novamente e ativando a integração, com backup automático da configuração atual…')
    try {
      const dados = new FormData()
      dados.append('pacoteCertificado', pacote)
      dados.append('clientIdTeste', clientIdTeste.trim())
      dados.append('clientSecretTeste', clientSecretTeste.trim())
      dados.append('integrationId', integrationId.trim())
      dados.append('contaCorrente', contaCorrente.replace(/\D/g, ''))
      const resposta = await fetch('/api/inter-config-admin.php?action=ativar-integracao-temporaria', {
        method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' }, body: dados,
      })
      const payload = await lerJsonSeguro(resposta)
      if (!resposta.ok || !payload?.ok || !payload?.activated) {
        const http = Number(payload?.httpStatus || resposta.status || 0)
        throw new Error(`HTTP ${http || 'N/D'} — ${payload?.error || 'Não foi possível ativar a integração.'}`)
      }
      await carregarDiagnostico(true)
      setMsg(payload?.message || `INTEGRAÇÃO ATIVADA COM SUCESSO — Client ID ativo: ${payload?.activeClientIdMasked || clientIdTeste.slice(0, 8) + '…'}. A configuração anterior foi preservada em backup no servidor.`)
      setOutraValidada(false)
      setClientSecretTeste('')
      if (pacoteTesteRef.current) pacoteTesteRef.current.value = ''
    } catch (erro) {
      setMsg(erro instanceof Error ? erro.message : 'Falha ao ativar a integração validada.')
    } finally {
      setAtivandoOutra(false)
    }
  }

  async function testarToken() {
    setTestando(true)
    setMsg('')
    try {
      const resposta = await fetch('/api/inter-cobranca.php?action=testar-token', {
        method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}',
      })
      const payload = await lerJsonSeguro(resposta)
      if (!resposta.ok || !payload?.ok || !payload?.inter?.tokenReceived) {
        const detalhe = payload?.details?.error_description || payload?.details?.error || payload?.error
        throw new Error(`HTTP ${resposta.status} — ${detalhe || 'Banco Inter não confirmou a autenticação.'}`)
      }
      await carregarDiagnostico(true)
      setMsg('Autenticação Banco Inter validada. A emissão de cobranças está liberada.')
    } catch (erro) {
      setMsg(erro instanceof Error ? erro.message : 'Falha ao testar autenticação Banco Inter.')
    } finally {
      setTestando(false)
    }
  }

  useEffect(() => { void carregarDiagnostico() }, [])

  const operacional = Boolean(diagnostico?.configured && diagnostico.certificate && diagnostico.privateKey && diagnostico.clientIdConfigured && diagnostico.clientSecretConfigured)
  const statusTecnico = diagnostico?.authenticationValidated
    ? 'Integração ativa — autenticação validada'
    : operacional
      ? 'Preparado para autenticação'
      : 'Configuração incompleta ou indisponível'

  return (
    <ConfiguracaoFormShell category="Configurações • Integrações" title="Banco Inter" subtitle="Configure e consulte o estado real da integração bancária do ERP." notice={msg || (carregando ? 'Consultando o backend bancário…' : 'Status lido diretamente da integração instalada no servidor.')}>
      <section className="config-section">
        <h3>Configurar Banco Inter • Cobrança V3</h3>
        <p>Selecione o certificado .crt e a chave privada .key baixados juntos da mesma integração no portal do Banco Inter. As credenciais serão gravadas fora da raiz pública e não ficam salvas no navegador.</p>
        <div className="config-grid">
          <div className="config-field"><label>Certificado Banco Inter (.crt)</label><input ref={certificadoRef} type="file" accept=".crt,.cer,.pem,application/x-x509-ca-cert" /></div>
          <div className="config-field"><label>Chave privada Banco Inter (.key)</label><input ref={chavePrivadaRef} type="file" accept=".key,.pem,application/x-pem-file" /></div>
          <div className="config-field"><label>Client ID</label><input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" /></div>
          <div className="config-field"><label>Client Secret</label><input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="new-password" /></div>
          <div className="config-field"><label>Integration ID (opcional)</label><input value={integrationId} onChange={(e) => setIntegrationId(e.target.value)} autoComplete="off" /></div>
          <div className="config-field"><label>Conta corrente Banco Inter</label><input value={contaCorrente} onChange={(e) => setContaCorrente(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></div>
        </div>
        <div className="config-inline-actions" style={{ marginTop: 14 }}>
          <button className="config-small-button config-small-button-primary" type="button" onClick={() => void instalarCertificado()} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar configuração privada'}</button>
        </div>
      </section>

      <section className="config-section">
        <h3>Diagnóstico Banco Inter</h3>
        <div className="config-grid">
          <div className="config-field"><label>Configuração do backend</label><input readOnly value={carregando ? 'Consultando…' : rotuloStatus(diagnostico?.configured)} /></div>
          <div className="config-field"><label>Certificado Inter</label><input readOnly value={rotuloStatus(diagnostico?.certificate)} /></div>
          <div className="config-field"><label>Chave privada</label><input readOnly value={rotuloStatus(diagnostico?.privateKey)} /></div>
          <div className="config-field"><label>Client ID</label><input readOnly value={rotuloStatus(diagnostico?.clientIdConfigured)} /></div>
          <div className="config-field"><label>Client Secret</label><input readOnly value={rotuloStatus(diagnostico?.clientSecretConfigured)} /></div>
          <div className="config-field"><label>Status técnico</label><input readOnly value={statusTecnico} /></div>
          <div className="config-field"><label>Client ID ativo</label><input readOnly value={diagnostico?.activeClientIdMasked || 'N/D'} /></div>
        </div>
        <div className="config-inline-actions" style={{ marginTop: 14 }}>
          <button className="config-small-button" type="button" onClick={() => void carregarDiagnostico()} disabled={carregando}>Atualizar status</button>
          <button className="config-small-button config-small-button-primary" type="button" onClick={() => void testarToken()} disabled={testando || carregando || !operacional}>{testando ? 'Testando…' : 'Testar autenticação Inter'}</button>
        </div>
      </section>


      <section className="config-section">
        <h3>Testar outra integração sem substituir a atual <small style={{ fontWeight: 600 }}>V105</small></h3>
        <p>Este teste envia temporariamente o ZIP com o certificado e a chave para o backend, solicita um token OAuth no Banco Inter e apaga os arquivos temporários ao terminar. A configuração instalada permanece intacta.</p>
        <div className="config-grid">
          <div className="config-field"><label>ZIP com certificado e chave</label><input ref={pacoteTesteRef} type="file" accept=".zip,application/zip" /></div>
          <div className="config-field"><label>Client ID da outra integração</label><input value={clientIdTeste} onChange={(e) => setClientIdTeste(e.target.value)} autoComplete="off" /></div>
          <div className="config-field"><label>Client Secret da outra integração</label><input type="password" value={clientSecretTeste} onChange={(e) => setClientSecretTeste(e.target.value)} autoComplete="new-password" /></div>
        </div>
        <div className="config-inline-actions" style={{ marginTop: 14 }}>
          <button className="config-small-button config-small-button-primary" type="button" onClick={() => void testarOutraIntegracao()} disabled={testandoOutra}>{testandoOutra ? 'Testando outra integração…' : 'Testar outra integração'}</button>
          <button
            className="config-small-button config-small-button-primary"
            type="button"
            onClick={() => void ativarOutraIntegracao()}
            disabled={!outraValidada || ativandoOutra || testandoOutra}
            title={outraValidada ? 'Ativar a integração que acabou de ser validada' : 'Teste e valide a outra integração antes de ativar'}
          >
            {ativandoOutra ? 'Ativando…' : outraValidada ? 'Ativar esta integração' : 'Ativar esta integração — valide primeiro'}
          </button>
        </div>
      </section>

    </ConfiguracaoFormShell>
  )
}
