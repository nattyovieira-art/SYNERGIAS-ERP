const AUTH_URL = '/api/auth.php'

export type AuthUser = { nome: string; perfil: string; usuario: string }
export type AuthStatus = { ok: boolean; authenticated: boolean; user?: AuthUser }

type ConfigResponse = { ok: boolean; turnstileSiteKey: string; adminEmailMasked?: string }

async function request<T>(action: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AUTH_URL}?action=${encodeURIComponent(action)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  })

  const text = await response.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} }
  catch { throw new Error('Resposta inválida da autenticação.') }
  if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`)
  return data as T
}

export const authApi = {
  status: () => request<AuthStatus>('status'),
  config: () => request<ConfigResponse>('config'),
  login: (usuario: string, senha: string, turnstileToken: string) => request<{ ok: boolean; requiresEmailCode: boolean; authenticated?: boolean; trustedDevice?: boolean; user?: AuthUser }>('login', { method: 'POST', body: JSON.stringify({ usuario, senha, turnstileToken }) }),
  emailCode: (codigo: string, confiarDispositivo: boolean) => request<{ ok: boolean; authenticated: boolean; user: AuthUser }>('email-code', { method: 'POST', body: JSON.stringify({ codigo, confiarDispositivo }) }),
  reauthenticate: (senha: string) => request<{ ok: boolean; authorizedUntil: number }>('reauthenticate', { method: 'POST', body: JSON.stringify({ senha }) }),
  emailResend: () => request<{ ok: boolean }>('email-resend', { method: 'POST', body: '{}' }),
  forgotStart: (usuario: string, turnstileToken: string) => request<{ ok: boolean }>('forgot-start', { method: 'POST', body: JSON.stringify({ usuario, turnstileToken }) }),
  forgotVerify: (codigo: string) => request<{ ok: boolean }>('forgot-verify', { method: 'POST', body: JSON.stringify({ codigo }) }),
  forgotResend: () => request<{ ok: boolean }>('forgot-resend', { method: 'POST', body: '{}' }),
  forgotReset: (senha: string, confirmar: string) => request<{ ok: boolean }>('forgot-reset', { method: 'POST', body: JSON.stringify({ senha, confirmar }) }),
  logout: () => request<{ ok: boolean }>('logout', { method: 'POST', body: '{}' }),
}
