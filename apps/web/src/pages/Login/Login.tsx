import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, KeyRound, LockKeyhole, MailCheck, ShieldCheck, UserRound } from 'lucide-react'
import '../../styles/login.css'
import loginLeft from '../../assets/login-left.png'
import { authApi, type AuthUser } from '../../services/authApi'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
      remove?: (widgetId: string) => void
    }
  }
}

type Props = { onAuthenticated: (user: AuthUser) => void | Promise<void> }
type Etapa = 'credenciais' | 'codigo' | 'esqueci' | 'esqueci-codigo' | 'nova-senha'

function Login({ onAuthenticated }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('credenciais')
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [confiar, setConfiar] = useState(true)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [siteKey, setSiteKey] = useState('')
  const [emailMascarado, setEmailMascarado] = useState('')
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [reenvioEm, setReenvioEm] = useState(0)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)

  const usaTurnstile = etapa === 'credenciais' || etapa === 'esqueci'

  useEffect(() => {
    if (reenvioEm <= 0) return
    const timer = window.setInterval(() => setReenvioEm((valor) => Math.max(0, valor - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [reenvioEm])

  useEffect(() => {
    authApi.config().then((data) => {
      setSiteKey(data.turnstileSiteKey)
      setEmailMascarado(data.adminEmailMasked || '')
    }).catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar a segurança do login.'))
  }, [])

  useEffect(() => {
    if (!siteKey || !usaTurnstile) return

    let cancelado = false
    const render = () => {
      if (cancelado || !window.turnstile || !turnstileRef.current || widgetId.current) return
      turnstileRef.current.innerHTML = ''
      widgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: siteKey,
        theme: 'light',
        language: 'pt-BR',
        callback: (token: string) => {
          setTurnstileToken(token)
          setErro('')
        },
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => {
          setTurnstileToken('')
          setErro('Não foi possível concluir a verificação de segurança.')
        },
      })
    }

    if (window.turnstile) {
      render()
    } else {
      const scriptId = 'cloudflare-turnstile-script'
      const existente = document.getElementById(scriptId) as HTMLScriptElement | null
      if (existente) {
        existente.addEventListener('load', render, { once: true })
      } else {
        const script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.addEventListener('load', render, { once: true })
        document.head.appendChild(script)
      }
    }

    return () => {
      cancelado = true
      if (widgetId.current) window.turnstile?.remove?.(widgetId.current)
      widgetId.current = undefined
      setTurnstileToken('')
      if (turnstileRef.current) turnstileRef.current.innerHTML = ''
    }
  }, [siteKey, usaTurnstile])

  function limparAvisos() { setErro(''); setMensagem('') }
  function trocarEtapa(proxima: Etapa) { limparAvisos(); setCodigo(''); setEtapa(proxima) }

  async function entrar(event: FormEvent) {
    event.preventDefault(); limparAvisos()
    if (!usuario.trim() || !senha) { setErro('Informe o usuário e a senha.'); return }
    if (!turnstileToken) { setErro('Conclua a verificação de segurança.'); return }
    try {
      setEnviando(true)
      const resposta = await authApi.login(usuario.trim(), senha, turnstileToken)
      if (!resposta.requiresEmailCode && resposta.authenticated && resposta.user) {
        await onAuthenticated(resposta.user)
        return
      }
      setMensagem(`Código enviado para ${emailMascarado || 'o e-mail administrativo'}.`)
      setEtapa('codigo'); setCodigo(''); setReenvioEm(60)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.')
      setTurnstileToken(''); window.turnstile?.reset(widgetId.current)
    } finally { setEnviando(false) }
  }

  async function validarCodigo(event: FormEvent) {
    event.preventDefault(); limparAvisos()
    if (!/^\d{6}$/.test(codigo)) { setErro('Digite os 6 dígitos enviados por e-mail.'); return }
    try { setEnviando(true); const data = await authApi.emailCode(codigo, confiar); await onAuthenticated(data.user) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Código inválido.') }
    finally { setEnviando(false) }
  }

  async function iniciarRecuperacao(event: FormEvent) {
    event.preventDefault(); limparAvisos()
    if (!usuario.trim()) { setErro('Informe o usuário.'); return }
    if (!turnstileToken) { setErro('Conclua a verificação de segurança.'); return }
    try {
      setEnviando(true)
      await authApi.forgotStart(usuario.trim(), turnstileToken)
      setMensagem(`Se o usuário estiver correto, o código foi enviado para ${emailMascarado || 'o e-mail administrativo'}.`)
      setEtapa('esqueci-codigo'); setCodigo(''); setReenvioEm(60)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível iniciar a recuperação.') }
    finally { setEnviando(false) }
  }

  async function reenviarCodigo() {
    limparAvisos()
    if (enviando) return
    try {
      setEnviando(true)
      if (etapa === 'codigo') await authApi.emailResend()
      else if (etapa === 'esqueci-codigo') await authApi.forgotResend()
      else return
      setCodigo('')
      setReenvioEm(60)
      setMensagem(`Novo código enviado para ${emailMascarado || 'o e-mail administrativo'}.`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível reenviar o código.')
    } finally { setEnviando(false) }
  }

  async function validarRecuperacao(event: FormEvent) {
    event.preventDefault(); limparAvisos()
    if (!/^\d{6}$/.test(codigo)) { setErro('Digite os 6 dígitos enviados por e-mail.'); return }
    try { setEnviando(true); await authApi.forgotVerify(codigo); trocarEtapa('nova-senha') }
    catch (e) { setErro(e instanceof Error ? e.message : 'Código inválido.') }
    finally { setEnviando(false) }
  }

  async function salvarNovaSenha(event: FormEvent) {
    event.preventDefault(); limparAvisos()
    if (senha.length < 12) { setErro('A nova senha precisa ter no mínimo 12 caracteres.'); return }
    if (senha !== confirmarSenha) { setErro('As senhas não conferem.'); return }
    try {
      setEnviando(true)
      await authApi.forgotReset(senha, confirmarSenha)
      setSenha(''); setConfirmarSenha(''); setMensagem('Senha alterada com sucesso. Entre novamente.'); setEtapa('credenciais')
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível alterar a senha.') }
    finally { setEnviando(false) }
  }

  const titulo = etapa === 'credenciais' ? 'Entre na sua conta' : etapa === 'codigo' ? 'Código por e-mail' : etapa === 'esqueci' ? 'Esqueci minha senha' : etapa === 'esqueci-codigo' ? 'Confirme o código' : 'Criar nova senha'
  const subtitulo = etapa === 'credenciais' ? 'Acesso administrativo ao Synergias ERP.' : etapa === 'codigo' ? 'Digite o código de 6 dígitos enviado ao e-mail administrativo.' : etapa === 'esqueci' ? 'Confirme seu usuário para receber um código por e-mail.' : etapa === 'esqueci-codigo' ? 'Digite o código enviado ao e-mail administrativo.' : 'Defina uma nova senha para o ERP.'

  return (
    <main className="login-page">
      <section className="login-shell">
        <aside className="brand-panel"><img src={loginLeft} alt="Synergias ERP" className="login-left-image" /></aside>
        <section className="login-panel"><div className="login-card">
          <div className="login-lock"><LockKeyhole size={27} /></div>
          <span className="access-label">ACESSO SEGURO AO ERP</span>
          <h2>{titulo}</h2><p>{subtitulo}</p>

          {(etapa === 'credenciais' || etapa === 'esqueci') && (
            <form onSubmit={etapa === 'credenciais' ? entrar : iniciarRecuperacao}>
              <label>Usuário</label>
              <div className="input-box"><UserRound size={19} /><input autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Seu usuário" /></div>
              {etapa === 'credenciais' && <><label>Senha</label><div className="input-box"><KeyRound size={19} /><input autoComplete="current-password" type={mostrarSenha ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Digite sua senha" /><button type="button" className="eye-button" onClick={() => setMostrarSenha((v) => !v)}>{mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></>}
              <div className="turnstile-shell"><div ref={turnstileRef} /></div>
              {erro && <div className="login-error" role="alert">{erro}</div>}{mensagem && <div className="login-success">{mensagem}</div>}
              <button type="submit" className="login-button" disabled={enviando}>{enviando ? 'Aguarde…' : etapa === 'credenciais' ? 'Continuar' : 'Enviar código'} <span>→</span></button>
              {etapa === 'credenciais' ? <button type="button" className="login-back" onClick={() => trocarEtapa('esqueci')}>Esqueci minha senha</button> : <button type="button" className="login-back" onClick={() => trocarEtapa('credenciais')}>Voltar ao login</button>}
            </form>
          )}

          {(etapa === 'codigo' || etapa === 'esqueci-codigo') && (
            <form onSubmit={etapa === 'codigo' ? validarCodigo : validarRecuperacao}>
              <div className="totp-icon">{etapa === 'codigo' ? <MailCheck size={35} /> : <ShieldCheck size={35} />}</div>
              <label>Código de 6 dígitos</label>
              <input className="totp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoFocus />
              {etapa === 'codigo' && <label className="remember trust-device"><input type="checkbox" checked={confiar} onChange={(e) => setConfiar(e.target.checked)} /> Confiar neste dispositivo por 30 dias</label>}
              {erro && <div className="login-error" role="alert">{erro}</div>}{mensagem && <div className="login-success">{mensagem}</div>}
              <button type="submit" className="login-button" disabled={enviando}>{enviando ? 'Verificando…' : etapa === 'codigo' ? 'Entrar no ERP' : 'Confirmar código'} <span>→</span></button>
              <button type="button" className="login-back" onClick={reenviarCodigo} disabled={enviando}>{reenvioEm > 0 ? `Reenviar código (${reenvioEm}s)` : 'Reenviar código'}</button>
              <button type="button" className="login-back" onClick={() => trocarEtapa(etapa === 'codigo' ? 'credenciais' : 'esqueci')}>Voltar</button>
            </form>
          )}

          {etapa === 'nova-senha' && <form onSubmit={salvarNovaSenha}>
            <label>Nova senha</label><div className="input-box"><KeyRound size={19} /><input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo de 12 caracteres" /></div>
            <label>Repita a nova senha</label><div className="input-box"><KeyRound size={19} /><input type="password" autoComplete="new-password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} placeholder="Repita a nova senha" /></div>
            {erro && <div className="login-error" role="alert">{erro}</div>}
            <button type="submit" className="login-button" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar nova senha'} <span>→</span></button>
          </form>}

          <div className="login-footer"><p>Synergias ERP Cloud</p><span>© 2026 Synergias Distribuidora</span></div>
        </div></section>
      </section>
    </main>
  )
}

export default Login
