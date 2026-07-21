import { useEffect, useState } from 'react'
import ConfiguracaoFormShell from './ConfiguracaoFormShell'

type Ambiente = 'HOMOLOGACAO' | 'PRODUCAO'
type Seq = { id: string; documento: string; ambiente: Ambiente; serie: string; ultimo: number; ativa: boolean }

const CHAVE = 'synergias_numeracao_fiscal'
const PADRAO: Seq[] = [
  { id: 'nfe-homologacao-1', documento: 'NF-e', ambiente: 'HOMOLOGACAO', serie: '1', ultimo: 2384, ativa: false },
  { id: 'nfe-producao-1', documento: 'NF-e', ambiente: 'PRODUCAO', serie: '1', ultimo: 2385, ativa: true },
]

function normalizar(lista: Seq[]) {
  const recebida = Array.isArray(lista) ? lista : []
  const convertida = recebida.map((item) => ({ ...item, ambiente: item.ambiente || 'HOMOLOGACAO', ultimo: Math.max(2383, Number(item.ultimo || 0)) })) as Seq[]
  for (const padrao of PADRAO) {
    if (!convertida.some((item) => item.documento === 'NF-e' && item.ambiente === padrao.ambiente)) convertida.push(padrao)
  }
  return convertida
}

export default function NumeracaoFiscal() {
  const [lista, setLista] = useState<Seq[]>(PADRAO)
  const [msg, setMsg] = useState('Carregando numeração salva no servidor…')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/numeracao-fiscal.php', { credentials: 'same-origin', cache: 'no-store' })
        const data = await response.json()
        if (!response.ok || data?.ok !== true) throw new Error(data?.error || 'Falha ao carregar.')
        const normalizada = normalizar(data.numeracao)
        setLista(normalizada)
        localStorage.setItem(CHAVE, JSON.stringify(normalizada))
        setMsg('Numeração carregada do servidor. Use Salvar após qualquer alteração.')
      } catch (error) {
        const local = localStorage.getItem(CHAVE)
        setLista(normalizar(local ? JSON.parse(local) : PADRAO))
        setMsg(error instanceof Error ? error.message : 'Não foi possível carregar a numeração do servidor.')
      }
    })()
  }, [])

  const atualizar = (id: string, campo: keyof Seq, valor: string | number | boolean) => {
    setLista((atual) => normalizar(atual.map((item) => item.id === id ? { ...item, [campo]: valor } : item)))
    setMsg('Alteração pendente. Clique no botão Salvar.')
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      const normalizada = normalizar(lista)
      const response = await fetch('/api/numeracao-fiscal.php', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'salvar', numeracao: normalizada }),
      })
      const data = await response.json()
      if (!response.ok || data?.ok !== true) throw new Error(data?.error || 'Não foi possível salvar.')
      const salva = normalizar(data.numeracao)
      setLista(salva)
      localStorage.setItem(CHAVE, JSON.stringify(salva))
      setMsg('Numeração fiscal salva no servidor com sucesso.')
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Não foi possível salvar a numeração fiscal.')
    } finally { setSalvando(false) }
  }

  return (
    <ConfiguracaoFormShell
      category="Configurações • Fiscal"
      title="Numeração Fiscal"
      subtitle="Controle separado de NF-e em produção e homologação."
      notice={msg}
      onSave={() => void salvar()}
      saveLabel={salvando ? 'Salvando…' : 'Salvar numeração fiscal'}
    >
      {(['PRODUCAO', 'HOMOLOGACAO'] as Ambiente[]).map((ambiente) => {
        const item = lista.find((seq) => seq.documento === 'NF-e' && seq.ambiente === ambiente) || PADRAO.find((seq) => seq.ambiente === ambiente)!
        const bloqueado = !item.ativa
        return (
          <section className="config-section" key={ambiente} style={{ borderLeft: ambiente === 'HOMOLOGACAO' ? '5px solid #d97706' : '5px solid #166534' }}>
            <h3>{ambiente === 'HOMOLOGACAO' ? 'NF-e — Homologação (teste)' : 'NF-e — Produção (oficial)'}</h3>
            <p style={{ marginTop: 0, color: '#64748b' }}>{ambiente === 'HOMOLOGACAO' ? 'Ambiente de testes. Mantenha inativo durante a operação oficial.' : 'Ambiente oficial ativo. As próximas NF-e serão emitidas na SEFAZ de produção.'}</p>
            <div className="config-grid">
              <div className="config-field"><label>Modelo</label><input value="55 — NF-e" readOnly /></div>
              <div className="config-field"><label>Série</label><input value={item.serie} onChange={(e) => atualizar(item.id, 'serie', e.target.value.replace(/\D/g, '').slice(0, 3) || '1')} /></div>
              <div className="config-field"><label>Último número autorizado</label><input type="number" min="2383" value={item.ultimo} onChange={(e) => atualizar(item.id, 'ultimo', Math.max(2383, Number(e.target.value) || 2383))} /></div>
              <div className="config-field"><label>Próximo número</label><input value={item.ultimo + 1} readOnly /></div>
              <div className="config-field"><label>Status</label><input value={bloqueado ? 'Inativo' : 'Ativo'} readOnly /></div>
            </div>
            <div className="config-inline-actions" style={{ marginTop: 14 }}><button className="config-small-button" type="button" onClick={() => atualizar(item.id, 'ativa', !item.ativa)}>{item.ativa ? `Inativar ${ambiente === 'PRODUCAO' ? 'produção' : 'homologação'}` : `Ativar ${ambiente === 'PRODUCAO' ? 'produção' : 'homologação'}`}</button></div>
          </section>
        )
      })}
      <section className="config-section"><h3>Regras de segurança</h3><div style={{ display: 'grid', gap: 8, color: '#334155' }}><span>• NF-e rejeitada pode ser corrigida e reenviada com o mesmo número.</span><span>• NF-e autorizada confirma a numeração no servidor.</span><span>• A próxima nota usa sempre o último número autorizado + 1.</span></div></section>
    </ConfiguracaoFormShell>
  )
}
