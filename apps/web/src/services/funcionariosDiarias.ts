export type FuncionarioDiaria = {
  id: string
  nome: string
  ativo: boolean
}

export const FUNCIONARIOS_DIARIAS_KEY = 'synergias_funcionarios_diarias'
export const FUNCIONARIOS_DIARIAS_EVENT = 'synergias:funcionarios-diarias-atualizados'

const PADRAO: FuncionarioDiaria[] = [
  { id: 'func-erasmo', nome: 'Erasmo', ativo: true },
  { id: 'func-vinicius', nome: 'Vinicius', ativo: true },
  { id: 'func-dionne', nome: 'Dionne', ativo: true },
]

export function listarFuncionariosDiarias(): FuncionarioDiaria[] {
  try {
    const salvo = JSON.parse(localStorage.getItem(FUNCIONARIOS_DIARIAS_KEY) || 'null')
    if (Array.isArray(salvo)) {
      return salvo
        .map((item) => ({
          id: String(item?.id || ''),
          nome: String(item?.nome || '').trim(),
          ativo: item?.ativo !== false,
        }))
        .filter((item) => item.id && item.nome)
    }
  } catch {
    // Retorna o cadastro inicial protegido.
  }
  localStorage.setItem(FUNCIONARIOS_DIARIAS_KEY, JSON.stringify(PADRAO))
  return PADRAO.map((item) => ({ ...item }))
}

export function salvarFuncionariosDiarias(funcionarios: FuncionarioDiaria[]) {
  const nomes = new Set<string>()
  const validos = funcionarios.map((item) => {
    const nome = item.nome.trim()
    const chaveNome = nome.toLocaleLowerCase('pt-BR')
    if (!nome) throw new Error('O nome do funcionário não pode ficar vazio.')
    if (nomes.has(chaveNome)) throw new Error(`O funcionário "${nome}" está duplicado.`)
    nomes.add(chaveNome)
    return { ...item, nome }
  })
  localStorage.setItem(FUNCIONARIOS_DIARIAS_KEY, JSON.stringify(validos))
  window.dispatchEvent(new CustomEvent(FUNCIONARIOS_DIARIAS_EVENT))
  return validos
}
