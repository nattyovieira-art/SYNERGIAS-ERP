import { useEffect, useRef, useState } from 'react'
import ConfiguracaoFormShell from './ConfiguracaoFormShell'

type Diagnostico = {
  configured?: boolean
  certificate?: boolean
  privateKey?: boolean
  certificateExpiresAt?: string
  clientIdConfigured?: boolean
  clientSecretConfigured?: boolean
  environment?: string
  billingScheme?: number
}

async function json(response: Response) {
  const text = await response.text()
  try { return text ? JSON.parse(text) : {} } catch { throw new Error(text || `Resposta inválida (HTTP ${response.status}).`) }
}

export default function IntegracaoC6() {
  const [diag, setDiag] = useState<Diagnostico | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const certRef = useRef<HTMLInputElement>(null)
  const keyRef = useRef<HTMLInputElement>(null)

  async function diagnostico(preservar = false) {
    if (!preservar) setMsg('')
    try {
      const response = await fetch('/api/c6-config-admin.php?action=diagnostico', { credentials: 'same-origin', cache: 'no-store' })
      const body = await json(response)
      if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setDiag(body.c6 || null)
    } catch (error) {
      setDiag(null)
      if (!preservar) setMsg(error instanceof Error ? error.message : 'Não foi possível consultar o C6.')
    }
  }

  async function instalar() {
    const cert = certRef.current?.files?.[0]
    const key = keyRef.current?.files?.[0]
    if (!cert || !key) return setMsg('Selecione o certificado e a chave privada fornecidos pelo C6.')
    if (!clientId.trim() || !clientSecret.trim()) return setMsg('Informe o Client ID e o Client Secret.')
    setBusy(true)
    setMsg('Validando e instalando as credenciais no servidor…')
    try {
      const data = new FormData()
      data.append('certificado', cert)
      data.append('chavePrivada', key)
      data.append('clientId', clientId.trim())
      data.append('clientSecret', clientSecret.trim())
      const response = await fetch('/api/c6-config-admin.php?action=instalar', { method: 'POST', credentials: 'same-origin', body: data })
      const body = await json(response)
      if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setClientSecret('')
      if (certRef.current) certRef.current.value = ''
      if (keyRef.current) keyRef.current.value = ''
      await diagnostico(true)
      setMsg(body.message)
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Falha ao instalar as credenciais C6.')
    } finally { setBusy(false) }
  }

  async function testar() {
    setBusy(true)
    setMsg('Testando autenticação mTLS no sandbox C6…')
    try {
      const response = await fetch('/api/c6-boleto.php?action=testar-token', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      const body = await json(response)
      if (!response.ok || !body.ok || !body.c6?.tokenReceived) throw new Error(body.error || `HTTP ${response.status}`)
      setMsg('Autenticação C6 validada. O sandbox está pronto para os testes de boleto.')
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Falha na autenticação C6.')
    } finally { setBusy(false) }
  }

  async function cadastrarWebhook() {
    setBusy(true)
    setMsg('Cadastrando webhook de boletos no sandbox C6...')
    try {
      const response = await fetch('/api/c6-boleto.php?action=cadastrar-webhook', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      const body = await json(response)
      if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setMsg(`Webhook BANK_SLIP cadastrado com sucesso. Status C6: ${body.webhook?.status || 200}.`)
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Falha ao cadastrar o webhook C6.')
    } finally { setBusy(false) }
  }

  useEffect(() => { void diagnostico() }, [])
  const pronto = Boolean(diag?.configured && diag.certificate && diag.privateKey && diag.clientIdConfigured && diag.clientSecretConfigured)

  return (
    <ConfiguracaoFormShell category="Configurações • Integrações" title="C6 Bank" subtitle="Credenciais mTLS e homologação da API de boletos." notice={msg}>
      <section className="config-section">
        <h3>Sandbox C6 • Boleto bancário</h3>
        <p>As credenciais são armazenadas fora da pasta pública do ERP. A carteira de homologação é 21.</p>
        <div className="config-grid">
          <div className="config-field"><label>Certificado C6</label><input ref={certRef} type="file" accept=".crt,.cer,.pem" /></div>
          <div className="config-field"><label>Chave privada C6</label><input ref={keyRef} type="file" accept=".key,.pem" /></div>
          <div className="config-field"><label>Client ID</label><input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" /></div>
          <div className="config-field"><label>Client Secret</label><input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="new-password" /></div>
        </div>
        <div className="config-inline-actions" style={{ marginTop: 14 }}>
          <button className="config-small-button config-small-button-primary" type="button" disabled={busy} onClick={() => void instalar()}>Instalar credenciais</button>
        </div>
      </section>
      <section className="config-section">
        <h3>Diagnóstico</h3>
        <div className="config-grid">
          <div className="config-field"><label>Ambiente</label><input readOnly value={diag?.environment || 'Não configurado'} /></div>
          <div className="config-field"><label>Carteira</label><input readOnly value={diag?.billingScheme || 21} /></div>
          <div className="config-field"><label>Certificado</label><input readOnly value={diag?.certificate ? 'Configurado' : 'Pendente'} /></div>
          <div className="config-field"><label>Validade</label><input readOnly value={diag?.certificateExpiresAt ? new Date(diag.certificateExpiresAt).toLocaleDateString('pt-BR') : 'N/D'} /></div>
          <div className="config-field"><label>Client ID</label><input readOnly value={diag?.clientIdConfigured ? 'Configurado' : 'Pendente'} /></div>
          <div className="config-field"><label>Client Secret</label><input readOnly value={diag?.clientSecretConfigured ? 'Configurado' : 'Pendente'} /></div>
        </div>
        <div className="config-inline-actions" style={{ marginTop: 14 }}>
          <button className="config-small-button" type="button" disabled={busy} onClick={() => void diagnostico()}>Atualizar status</button>
          <button className="config-small-button config-small-button-primary" type="button" disabled={busy || !pronto} onClick={() => void testar()}>Testar autenticação C6</button>
          <button className="config-small-button config-small-button-primary" type="button" disabled={busy || !pronto} onClick={() => void cadastrarWebhook()}>Cadastrar webhook</button>
        </div>
      </section>
    </ConfiguracaoFormShell>
  )
}
