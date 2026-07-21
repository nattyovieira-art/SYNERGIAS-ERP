const CHAVES_CENTRAIS = new Set(['synergias_clientes', 'synergias_produtos'])

export function parseListaSegura<T>(raw: string | null): T[] {
  if (!raw) return []
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}

export function registrarBackupLocal<T>(storageKey: string, dados: T[]): void {
  if (CHAVES_CENTRAIS.has(storageKey)) return
  if (!Array.isArray(dados) || dados.length === 0) return
  try {
    localStorage.setItem(`${storageKey}_ultima_lista_valida`, JSON.stringify(dados))
  } catch (erro) {
    console.warn(`[Synergias ERP] Cache local não gravado para ${storageKey}.`, erro)
  }
}

export function obterMelhorBackupLocal<T>(storageKey: string): T[] {
  if (CHAVES_CENTRAIS.has(storageKey)) return []
  return [
    parseListaSegura<T>(localStorage.getItem(storageKey)),
    parseListaSegura<T>(localStorage.getItem(`${storageKey}_ultima_lista_valida`)),
  ].reduce<T[]>((melhor, atual) => atual.length > melhor.length ? atual : melhor, [])
}

export function salvarListaLocalProtegida<T>(storageKey: string, dados: T[]): void {
  if (CHAVES_CENTRAIS.has(storageKey)) return
  try { localStorage.setItem(storageKey, JSON.stringify(Array.isArray(dados) ? dados : [])) }
  catch (erro) { console.warn(`[Synergias ERP] Limite do armazenamento local atingido em ${storageKey}.`, erro) }
}
