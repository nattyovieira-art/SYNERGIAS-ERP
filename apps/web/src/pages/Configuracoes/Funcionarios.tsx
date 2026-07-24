import { useState } from 'react'
import ConfiguracaoFormShell from './ConfiguracaoFormShell'
import {
  listarFuncionariosDiarias,
  salvarFuncionariosDiarias,
  type FuncionarioDiaria,
} from '../../services/funcionariosDiarias'

export default function Funcionarios() {
  const [lista, setLista] = useState<FuncionarioDiaria[]>(listarFuncionariosDiarias)
  const [novoNome, setNovoNome] = useState('')
  const [editandoId, setEditandoId] = useState('')
  const [nomeEdicao, setNomeEdicao] = useState('')
  const [mensagem, setMensagem] = useState('')

  function persistir(novaLista: FuncionarioDiaria[], mensagemSucesso: string) {
    try {
      setLista(salvarFuncionariosDiarias(novaLista))
      setMensagem(mensagemSucesso)
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível salvar os funcionários.')
    }
  }

  function adicionar() {
    const nome = novoNome.trim()
    if (!nome) return
    persistir(
      [...lista, { id: `func-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, nome, ativo: true }],
      'Funcionário adicionado.',
    )
    setNovoNome('')
  }

  function iniciarEdicao(funcionario: FuncionarioDiaria) {
    setEditandoId(funcionario.id)
    setNomeEdicao(funcionario.nome)
  }

  function salvarNome() {
    persistir(
      lista.map((item) => item.id === editandoId ? { ...item, nome: nomeEdicao } : item),
      'Nome do funcionário atualizado.',
    )
    setEditandoId('')
    setNomeEdicao('')
  }

  return (
    <ConfiguracaoFormShell
      category="Configurações"
      title="Funcionários"
      subtitle="Funcionários utilizados nas perguntas de diárias dos turnos das 12h e 16h."
      notice={mensagem || `${lista.filter((item) => item.ativo).length} funcionário(s) ativo(s).`}
    >
      <section className="config-section">
        <h3>Novo funcionário</h3>
        <p>Funcionários ativos aparecerão na confirmação diária de cada turno.</p>
        <div className="config-grid-2">
          <div className="config-field">
            <label>Nome</label>
            <input value={novoNome} onChange={(evento) => setNovoNome(evento.target.value)} onKeyDown={(evento) => { if (evento.key === 'Enter') adicionar() }} />
          </div>
        </div>
        <div className="config-inline-actions" style={{ marginTop: 14 }}>
          <button type="button" className="config-small-button config-small-button-primary" onClick={adicionar}>Adicionar funcionário</button>
        </div>
      </section>

      <section className="config-section">
        <h3>Funcionários cadastrados</h3>
        <div className="config-table-wrap">
          <table className="config-table">
            <thead><tr><th>Nome</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {lista.map((funcionario) => (
                <tr key={funcionario.id}>
                  <td>
                    {editandoId === funcionario.id
                      ? <input className="config-inline-name-input" value={nomeEdicao} onChange={(evento) => setNomeEdicao(evento.target.value)} onKeyDown={(evento) => { if (evento.key === 'Enter') salvarNome() }} autoFocus />
                      : <strong>{funcionario.nome}</strong>}
                  </td>
                  <td><span className={`config-status ${funcionario.ativo ? 'config-status-ok' : 'config-status-off'}`}>{funcionario.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td>
                    <div className="config-inline-actions">
                      {editandoId === funcionario.id
                        ? <button type="button" className="config-small-button config-small-button-primary" onClick={salvarNome}>Salvar nome</button>
                        : <button type="button" className="config-small-button" onClick={() => iniciarEdicao(funcionario)}>Alterar nome</button>}
                      <button type="button" className="config-small-button" onClick={() => persistir(lista.map((item) => item.id === funcionario.id ? { ...item, ativo: !item.ativo } : item), 'Status do funcionário atualizado.')}>{funcionario.ativo ? 'Inativar' : 'Ativar'}</button>
                      <button type="button" className="config-small-button config-small-button-danger" onClick={() => { if (confirm(`Excluir o funcionário ${funcionario.nome}?`)) persistir(lista.filter((item) => item.id !== funcionario.id), 'Funcionário excluído.') }}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={3} className="config-empty">Nenhum funcionário cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </ConfiguracaoFormShell>
  )
}
