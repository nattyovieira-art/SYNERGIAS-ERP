export function carregarConfig<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave)
    if (!bruto) return padrao
    return { ...padrao, ...JSON.parse(bruto) }
  } catch {
    return padrao
  }
}

export function carregarLista<T>(chave: string, padrao: T[] = []): T[] {
  try {
    const bruto = localStorage.getItem(chave)
    if (!bruto) return padrao
    const valor = JSON.parse(bruto)
    return Array.isArray(valor) ? valor : padrao
  } catch {
    return padrao
  }
}

export function salvarConfig<T>(chave: string, valor: T) {
  localStorage.setItem(chave, JSON.stringify(valor))
}

export function idLocal(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
