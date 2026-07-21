import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, LoaderCircle, Server, ShieldCheck, TriangleAlert } from 'lucide-react'
import ConfiguracaoFormShell from './ConfiguracaoFormShell'
import { carregarConfig, salvarConfig } from './storage'
import { obterConfiguracaoFiscalStorage } from '../../services/configuracaoFiscalStorage'
import { buscarStatusCertificadoA1 } from '../../services/certificadoDigitalService'
import {
  consultarStatusSefazRs,
  type ResultadoStatusSefaz,
} from '../../services/sefazStatusService'

type Config = {
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO'
  uf: string
  cnpj: string
  certificadoVinculado: boolean
  consulta: boolean
  distribuicao: boolean
  emissao: boolean
  eventos: boolean
  ultimaComunicacao: string
  ultimoRetorno: string
}

const CHAVE = 'synergias_integracao_sefaz_nfe'
const PADRAO: Config = {
  ambiente: 'HOMOLOGACAO',
  uf: 'RS',
  cnpj: '',
  certificadoVinculado: false,
  consulta: true,
  distribuicao: false,
  emissao: false,
  eventos: false,
  ultimaComunicacao: '',
  ultimoRetorno: 'Comunicação ainda não testada.',
}

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, '')
}

function formatarData(valor: string) {
  if (!valor) return '—'
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString('pt-BR')
}

export default function IntegracaoSefazNFe() {
  const fiscal = useMemo(() => obterConfiguracaoFiscalStorage(), [])
  const [c, setC] = useState<Config>(() => ({
    ...carregarConfig(CHAVE, PADRAO),
    ambiente: 'HOMOLOGACAO',
    uf: 'RS',
    cnpj: somenteNumeros(fiscal.cnpj),
    emissao: false,
    eventos: false,
  }))
  const [msg, setMsg] = useState('')
  const [testando, setTestando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoStatusSefaz | null>(null)
  const [certificadoAtivo, setCertificadoAtivo] = useState(false)

  useEffect(() => {
    void buscarStatusCertificadoA1()
      .then((certificado) => {
        const ativo = certificado.configurado && certificado.status !== 'VENCIDO'
        setCertificadoAtivo(ativo)
        setC((atual) => ({ ...atual, certificadoVinculado: ativo }))
      })
      .catch(() => setCertificadoAtivo(false))
  }, [])

  function salvar() {
    const proxima = {
      ...c,
      ambiente: 'HOMOLOGACAO' as const,
      uf: 'RS',
      cnpj: somenteNumeros(fiscal.cnpj),
      certificadoVinculado: certificadoAtivo,
      emissao: false,
      eventos: false,
    }
    salvarConfig(CHAVE, proxima)
    setC(proxima)
    setMsg('Parâmetros de homologação salvos. Emissão e eventos continuam bloqueados nesta etapa.')
  }

  async function testarComunicacao() {
    const cnpj = somenteNumeros(fiscal.cnpj)
    if (cnpj.length !== 14) {
      setMsg('Preencha e salve o CNPJ na Configuração Fiscal antes do teste.')
      return
    }
    if (!certificadoAtivo) {
      setMsg('Instale um Certificado A1 ativo antes do teste com a SEFAZ-RS.')
      return
    }

    try {
      setTestando(true)
      setMsg('Conectando com a SEFAZ-RS em homologação...')
      const retorno = await consultarStatusSefazRs({
        ambiente: 'HOMOLOGACAO',
        uf: 'RS',
        cnpj,
      })
      setResultado(retorno)
      const proxima = {
        ...c,
        ambiente: 'HOMOLOGACAO' as const,
        uf: 'RS',
        cnpj,
        certificadoVinculado: true,
        ultimaComunicacao: retorno.consultadoEm,
        ultimoRetorno: `${retorno.cStat} — ${retorno.xMotivo}`,
        emissao: false,
        eventos: false,
      }
      setC(proxima)
      salvarConfig(CHAVE, proxima)
      setMsg(
        retorno.operacional
          ? 'Comunicação segura concluída. O serviço de homologação está operacional.'
          : `A SEFAZ-RS respondeu, mas o serviço não está operacional: ${retorno.cStat} — ${retorno.xMotivo}`,
      )
    } catch (erro) {
      setResultado(null)
      const mensagem = erro instanceof Error ? erro.message : 'Falha no teste com a SEFAZ-RS.'
      setMsg(mensagem)
      setC((atual) => ({
        ...atual,
        ultimaComunicacao: new Date().toISOString(),
        ultimoRetorno: mensagem,
      }))
    } finally {
      setTestando(false)
    }
  }

  return (
    <ConfiguracaoFormShell
      category="Configurações • Integrações"
      title="SEFAZ / NF-e"
      subtitle="Teste a comunicação segura com a SEFAZ-RS antes de liberar a emissão fiscal."
      onSave={salvar}
      notice={msg || 'Somente a consulta de status em homologação está liberada nesta etapa. Nenhuma NF-e será emitida.'}
    >
      <section className="config-section">
        <h3>Ambiente de teste</h3>
        <div className="config-grid">
          <div className="config-field">
            <label>Ambiente fiscal</label>
            <input value="Homologação" readOnly />
          </div>
          <div className="config-field">
            <label>UF autorizadora</label>
            <input value="RS" readOnly />
          </div>
          <div className="config-field">
            <label>CNPJ da empresa</label>
            <input value={somenteNumeros(fiscal.cnpj)} readOnly placeholder="Preencha na Configuração Fiscal" />
          </div>
        </div>
      </section>

      <section className="config-section">
        <h3>Proteções desta etapa</h3>
        <div className="config-checks">
          <label className="config-check"><input type="checkbox" checked readOnly />Consulta de status do serviço</label>
          <label className="config-check"><input type="checkbox" checked={false} readOnly />Emissão de NF-e bloqueada</label>
          <label className="config-check"><input type="checkbox" checked={false} readOnly />Cancelamento e eventos bloqueados</label>
          <label className="config-check"><input type="checkbox" checked={false} readOnly />Produção bloqueada</label>
        </div>
      </section>

      <section className="config-section">
        <h3>Status técnico</h3>
        <div className="config-grid">
          <div className="config-field">
            <label>Certificado A1</label>
            <div className="config-status-value">
              {certificadoAtivo ? <ShieldCheck size={18} /> : <TriangleAlert size={18} />}
              <span>{certificadoAtivo ? 'Ativo e vinculado' : 'Não confirmado'}</span>
            </div>
          </div>
          <div className="config-field">
            <label>Última comunicação</label>
            <input value={formatarData(c.ultimaComunicacao)} readOnly />
          </div>
          <div className="config-field config-field-full">
            <label>Último retorno</label>
            <textarea value={c.ultimoRetorno} readOnly />
          </div>
        </div>

        <div className="config-inline-actions" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="config-small-button"
            onClick={() => void testarComunicacao()}
            disabled={testando || !certificadoAtivo}
          >
            {testando ? <LoaderCircle size={18} className="spin" /> : <Server size={18} />}
            {testando ? 'Testando comunicação...' : 'Testar comunicação com a SEFAZ-RS'}
          </button>
        </div>
      </section>

      {resultado && (
        <section className="config-section">
          <h3>Retorno oficial da SEFAZ-RS</h3>
          <div className="config-grid">
            <div className="config-field">
              <label>Situação</label>
              <div className="config-status-value">
                {resultado.operacional ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
                <span>{resultado.operacional ? 'Serviço em operação' : 'Serviço indisponível'}</span>
              </div>
            </div>
            <div className="config-field"><label>Código</label><input value={resultado.cStat} readOnly /></div>
            <div className="config-field config-field-full"><label>Motivo</label><input value={resultado.xMotivo} readOnly /></div>
            <div className="config-field"><label>Recebido em</label><input value={formatarData(resultado.dhRecbto)} readOnly /></div>
            <div className="config-field"><label>Versão da SEFAZ</label><input value={resultado.versaoAplicacao || '—'} readOnly /></div>
            <div className="config-field"><label>Duração</label><input value={`${resultado.duracaoMs} ms`} readOnly /></div>
            <div className="config-field config-field-full"><label>Serviço consultado</label><input value={resultado.endpoint} readOnly /></div>
          </div>
        </section>
      )}
    </ConfiguracaoFormShell>
  )
}
