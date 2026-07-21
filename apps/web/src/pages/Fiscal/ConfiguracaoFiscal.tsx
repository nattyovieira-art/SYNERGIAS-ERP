import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Calculator,
  LoaderCircle,
  Save,
  Search,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import type {
  ConfiguracaoFiscalEmpresa,
  DestinacaoFiscalPadrao,
  RegimeTributario,
} from '../../types/ConfiguracaoFiscal'
import {
  obterConfiguracaoFiscalStorage,
  configuracaoFiscalEssencialValida,
  carregarConfiguracaoFiscalServidor,
  salvarConfiguracaoFiscalServidor,
} from '../../services/configuracaoFiscalStorage'
import { consultarCnpj } from '../../services/cnpjService'

import '../../styles/fiscal.css'
import '../../styles/fiscal-cnpj.css'

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, '')
}

function formatarCnpj(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 14)

  return numeros
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function ConfiguracaoFiscal() {
  const navigate = useNavigate()

  const [configuracao, setConfiguracao] =
    useState<ConfiguracaoFiscalEmpresa>(obterConfiguracaoFiscalStorage())
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [mensagemCnpj, setMensagemCnpj] = useState('')

  useEffect(() => {
    let ativo = true
    void carregarConfiguracaoFiscalServidor()
      .then((carregada) => {
        if (ativo && configuracaoFiscalEssencialValida(carregada)) {
          setConfiguracao(carregada)
        }
      })
      .catch(() => {
        // Mantém na tela a última configuração local válida.
      })

    return () => {
      ativo = false
    }
  }, [])

  function atualizar<K extends keyof ConfiguracaoFiscalEmpresa>(
    campo: K,
    valor: ConfiguracaoFiscalEmpresa[K],
  ) {
    setConfiguracao((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  async function buscarCnpj() {
    const cnpj = somenteNumeros(configuracao.cnpj)

    if (cnpj.length !== 14) {
      setMensagemCnpj('Digite um CNPJ válido com 14 números.')
      return
    }

    try {
      setBuscandoCnpj(true)
      setMensagemCnpj('Buscando dados do CNPJ...')
      const dados = await consultarCnpj(cnpj)
      setConfiguracao((atual) => ({
        ...atual,
        cnpj: dados.cnpj,
        razaoSocial: dados.razaoSocial || atual.razaoSocial,
        nomeFantasia: dados.nomeFantasia || atual.nomeFantasia,
        uf: dados.uf || atual.uf,
        municipio: dados.municipio || atual.municipio,
        codigoIbgeMunicipio: dados.codigoIbgeMunicipio || atual.codigoIbgeMunicipio,
        cep: dados.cep || atual.cep,
        logradouro: dados.logradouro || atual.logradouro,
        numero: dados.numero || atual.numero,
        complemento: dados.complemento || atual.complemento,
        bairro: dados.bairro || atual.bairro,
        telefone: dados.telefone || atual.telefone,
        email: dados.email || atual.email,
        situacaoCadastral: dados.situacaoCadastral || atual.situacaoCadastral,
        cnaePrincipalDescricao: dados.cnaePrincipalDescricao || atual.cnaePrincipalDescricao,
      }))
      setMensagemCnpj('Dados do CNPJ preenchidos com sucesso.')
    } catch (erro) {
      setMensagemCnpj(erro instanceof Error ? erro.message : 'Não foi possível buscar o CNPJ.')
    } finally {
      setBuscandoCnpj(false)
    }
  }


  async function salvar() {
    if (!configuracao.razaoSocial.trim()) {
      alert('Informe a razão social.')
      return
    }

    if (somenteNumeros(configuracao.cnpj).length !== 14) {
      alert('Informe um CNPJ válido com 14 dígitos.')
      return
    }

    if (!configuracao.inscricaoEstadual.trim()) {
      alert('Informe a Inscrição Estadual.')
      return
    }

    const candidata = {
      ...configuracao,
      cnpj: somenteNumeros(configuracao.cnpj),
    }

    if (!configuracaoFiscalEssencialValida(candidata)) {
      alert('Preencha todos os dados essenciais da empresa antes de salvar. Nenhuma configuração válida será substituída por dados incompletos.')
      return
    }

    try {
      const salva = await salvarConfiguracaoFiscalServidor(candidata)
      setConfiguracao(salva)
      alert('Configuração fiscal salva e confirmada no servidor com sucesso.')
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível salvar a configuração fiscal. O cadastro anterior foi preservado.')
    }
  }

  return (
    <main className="fiscal-layout">
      <Sidebar />

      <section className="fiscal-page">
        <PageHeader
          category="Fiscal"
          title="Configuração Fiscal"
          subtitle="Defina os dados que serão usados pelo motor fiscal de compras e composição do custo real dos produtos."
        />

        <div className="fiscal-topbar">
          <button
            type="button"
            className="fiscal-icon-button fiscal-icon-back"
            title="Voltar"
            aria-label="Voltar"
            onClick={() => navigate('/configuracoes')}
          >
            <ArrowLeft size={24} />
          </button>

          <button
            type="button"
            className="fiscal-icon-button fiscal-icon-save"
            title="Salvar configuração fiscal"
            aria-label="Salvar configuração fiscal"
            onClick={salvar}
            data-version="SYNERGIAS_FISCAL_DESBLOQUEADO_V228"
          >
            <Save size={24} />
          </button>
        </div>

        <div className="fiscal-save-protection" data-version="SYNERGIAS_FISCAL_DESBLOQUEADO_V228">
          Os dados podem ser editados normalmente. O servidor preserva a última configuração fiscal válida e bloqueia somente gravações incompletas.
        </div>

        <section className="fiscal-form-card">
          <div className="fiscal-section-title">
            <Building2 size={20} />
            <div>
              <h2>Dados Fiscais da Empresa</h2>
              <p>Identificação fiscal da empresa.</p>
            </div>
          </div>

          <div className="fiscal-grid fiscal-grid-2">
            <label>
              Razão Social
              <input
                value={configuracao.razaoSocial}
                onChange={(event) =>
                  atualizar('razaoSocial', event.target.value)
                }
              />
            </label>

            <label>
              Nome Fantasia
              <input
                value={configuracao.nomeFantasia}
                onChange={(event) =>
                  atualizar('nomeFantasia', event.target.value)
                }
              />
            </label>

            <label>
              CNPJ
              <div className="fiscal-cnpj-field">
                <input
                  value={formatarCnpj(configuracao.cnpj)}
                  onChange={(event) => {
                    atualizar('cnpj', somenteNumeros(event.target.value))
                    setMensagemCnpj('')
                  }}
                  onBlur={() => {
                    if (somenteNumeros(configuracao.cnpj).length === 14 && !buscandoCnpj) {
                      void buscarCnpj()
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void buscarCnpj()
                    }
                  }}
                  placeholder="00.000.000/0000-00"
                />
                <button
                  type="button"
                  className="fiscal-cnpj-search-button"
                  title="Buscar CNPJ"
                  aria-label="Buscar CNPJ"
                  disabled={buscandoCnpj}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void buscarCnpj()}
                >
                  {buscandoCnpj ? (
                    <LoaderCircle className="fiscal-cnpj-spinner" size={19} />
                  ) : (
                    <Search size={19} />
                  )}
                </button>
              </div>
              {mensagemCnpj && (
                <span className="fiscal-cnpj-status">{mensagemCnpj}</span>
              )}
            </label>

            <label>
              Inscrição Estadual
              <input
                value={configuracao.inscricaoEstadual}
                onChange={(event) =>
                  atualizar('inscricaoEstadual', event.target.value)
                }
              />
            </label>

            <label>
              Inscrição Municipal
              <input
                value={configuracao.inscricaoMunicipal}
                onChange={(event) =>
                  atualizar('inscricaoMunicipal', event.target.value)
                }
              />
            </label>

            <label>
              UF
              <select
                value={configuracao.uf}
                onChange={(event) => atualizar('uf', event.target.value)}
              >
                <option value="RS">RS</option>
                <option value="SC">SC</option>
                <option value="PR">PR</option>
                <option value="SP">SP</option>
                <option value="RJ">RJ</option>
                <option value="MG">MG</option>
                <option value="ES">ES</option>
                <option value="BA">BA</option>
                <option value="GO">GO</option>
                <option value="DF">DF</option>
                <option value="MS">MS</option>
                <option value="MT">MT</option>
                <option value="PE">PE</option>
                <option value="CE">CE</option>
                <option value="PA">PA</option>
                <option value="AM">AM</option>
                <option value="AC">AC</option>
                <option value="AL">AL</option>
                <option value="AP">AP</option>
                <option value="MA">MA</option>
                <option value="PB">PB</option>
                <option value="PI">PI</option>
                <option value="RN">RN</option>
                <option value="RO">RO</option>
                <option value="RR">RR</option>
                <option value="SE">SE</option>
                <option value="TO">TO</option>
              </select>
            </label>

            <label>
              Município
              <input
                value={configuracao.municipio}
                onChange={(event) =>
                  atualizar('municipio', event.target.value)
                }
              />
            </label>

            <label>
              Código IBGE do Município
              <input
                value={configuracao.codigoIbgeMunicipio}
                onChange={(event) =>
                  atualizar('codigoIbgeMunicipio', somenteNumeros(event.target.value))
                }
              />
            </label>

            <label>
              CEP
              <input value={configuracao.cep} onChange={(event) => atualizar('cep', somenteNumeros(event.target.value))} />
            </label>

            <label>
              Logradouro
              <input value={configuracao.logradouro} onChange={(event) => atualizar('logradouro', event.target.value)} />
            </label>

            <label>
              Número
              <input value={configuracao.numero} onChange={(event) => atualizar('numero', event.target.value)} />
            </label>

            <label>
              Complemento
              <input value={configuracao.complemento} onChange={(event) => atualizar('complemento', event.target.value)} />
            </label>

            <label>
              Bairro
              <input value={configuracao.bairro} onChange={(event) => atualizar('bairro', event.target.value)} />
            </label>

            <label>
              Telefone
              <input value={configuracao.telefone} onChange={(event) => atualizar('telefone', event.target.value)} />
            </label>

            <label>
              E-mail
              <input type="email" value={configuracao.email} onChange={(event) => atualizar('email', event.target.value)} />
            </label>

            <label>
              Situação Cadastral
              <input value={configuracao.situacaoCadastral} onChange={(event) => atualizar('situacaoCadastral', event.target.value)} />
            </label>

            <label className="fiscal-grid-full">
              CNAE Principal
              <input value={configuracao.cnaePrincipalDescricao} onChange={(event) => atualizar('cnaePrincipalDescricao', event.target.value)} />
            </label>
          </div>
        </section>

        <section className="fiscal-form-card">
          <div className="fiscal-section-title">
            <ShieldCheck size={20} />
            <div>
              <h2>Regime e ICMS</h2>
              <p>Enquadramento fiscal usado nas análises de entrada.</p>
            </div>
          </div>

          <div className="fiscal-grid fiscal-grid-2">
            <label>
              Regime Tributário
              <select
                value={configuracao.regimeTributario}
                onChange={(event) =>
                  atualizar(
                    'regimeTributario',
                    event.target.value as RegimeTributario,
                  )
                }
              >
                <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                <option value="LUCRO_REAL">Lucro Real</option>
                <option value="OUTRO">Outro</option>
              </select>
            </label>

            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.regimeTributarioConfirmado}
                onChange={(event) => atualizar('regimeTributarioConfirmado', event.target.checked)}
              />
              <div>
                <strong>Regime confirmado pela contabilidade</strong>
                <span>Obrigatório para liberar a validação tributária da NF-e.</span>
              </div>
            </label>

            <label>
              Destinação Fiscal Padrão dos Produtos
              <select
                value={configuracao.destinacaoFiscalPadrao}
                onChange={(event) =>
                  atualizar(
                    'destinacaoFiscalPadrao',
                    event.target.value as DestinacaoFiscalPadrao,
                  )
                }
              >
                <option value="REVENDA">Revenda</option>
                <option value="USO_E_CONSUMO">Uso e Consumo</option>
                <option value="ATIVO_IMOBILIZADO">Ativo Imobilizado</option>
                <option value="INSUMO">Insumo</option>
              </select>
            </label>
          </div>

          <div className="fiscal-toggle-grid">
            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.contribuinteIcms}
                onChange={(event) =>
                  atualizar('contribuinteIcms', event.target.checked)
                }
              />
              <div>
                <strong>Contribuinte de ICMS</strong>
                <span>A empresa é contribuinte do ICMS.</span>
              </div>
            </label>

            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.aproveitaCreditoIcms}
                onChange={(event) =>
                  atualizar('aproveitaCreditoIcms', event.target.checked)
                }
              />
              <div>
                <strong>Aproveita crédito de ICMS</strong>
                <span>Usar o crédito recuperável na composição do custo.</span>
              </div>
            </label>

            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.revendaMercadorias}
                onChange={(event) =>
                  atualizar('revendaMercadorias', event.target.checked)
                }
              />
              <div>
                <strong>Revenda de mercadorias</strong>
                <span>Operação principal com produtos destinados à revenda.</span>
              </div>
            </label>

            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.possuiRegimeEspecial}
                onChange={(event) =>
                  atualizar('possuiRegimeEspecial', event.target.checked)
                }
              />
              <div>
                <strong>Possui regime especial</strong>
                <span>Habilita o campo para informar tratamento especial.</span>
              </div>
            </label>
          </div>

          {configuracao.possuiRegimeEspecial && (
            <label className="fiscal-label-full">
              Descrição do Regime Especial
              <textarea
                value={configuracao.descricaoRegimeEspecial}
                onChange={(event) =>
                  atualizar('descricaoRegimeEspecial', event.target.value)
                }
              />
            </label>
          )}
        </section>

        <section className="fiscal-form-card">
          <div className="fiscal-section-title">
            <WalletCards size={20} />
            <div>
              <h2>Composição do Custo Fiscal</h2>
              <p>
                Define quais cálculos o motor fiscal deverá considerar na entrada
                da NF-e.
              </p>
            </div>
          </div>

          <div className="fiscal-toggle-grid">
            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.calcularIcmsEntrada}
                onChange={(event) =>
                  atualizar('calcularIcmsEntrada', event.target.checked)
                }
              />
              <div>
                <strong>Analisar ICMS de entrada</strong>
                <span>Analisa alíquota, base e possível complemento.</span>
              </div>
            </label>

            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.calcularStEntrada}
                onChange={(event) =>
                  atualizar('calcularStEntrada', event.target.checked)
                }
              />
              <div>
                <strong>Analisar ICMS-ST</strong>
                <span>Verifica ST destacada e possível ST a recolher.</span>
              </div>
            </label>

            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.calcularAntecipacaoEntrada}
                onChange={(event) =>
                  atualizar('calcularAntecipacaoEntrada', event.target.checked)
                }
              />
              <div>
                <strong>Analisar antecipação</strong>
                <span>Verifica possível antecipação tributária na entrada.</span>
              </div>
            </label>

            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.somarTributosAoCusto}
                onChange={(event) =>
                  atualizar('somarTributosAoCusto', event.target.checked)
                }
              />
              <div>
                <strong>Somar tributos não recuperáveis ao custo</strong>
                <span>Compõe o custo real Synergias.</span>
              </div>
            </label>

            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.ratearFreteNosItens}
                onChange={(event) =>
                  atualizar('ratearFreteNosItens', event.target.checked)
                }
              />
              <div>
                <strong>Ratear frete nos itens</strong>
                <span>Distribui o frete na composição do custo dos produtos.</span>
              </div>
            </label>

            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.ratearOutrosCustosNosItens}
                onChange={(event) =>
                  atualizar('ratearOutrosCustosNosItens', event.target.checked)
                }
              />
              <div>
                <strong>Ratear outros custos</strong>
                <span>Distribui outros encargos entre os itens.</span>
              </div>
            </label>
          </div>
        </section>

        <section className="fiscal-form-card">
          <div className="fiscal-section-title">
            <Calculator size={20} />
            <div>
              <h2>Segurança da Análise Fiscal</h2>
              <p>Regras para impedir uso de custo fiscal sem conferência.</p>
            </div>
          </div>

          <div className="fiscal-toggle-grid">
            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.exigirConfirmacaoFiscal}
                onChange={(event) =>
                  atualizar('exigirConfirmacaoFiscal', event.target.checked)
                }
              />
              <div>
                <strong>Exigir confirmação fiscal</strong>
                <span>
                  O cálculo automático precisa ser confirmado antes de atualizar
                  o custo do produto.
                </span>
              </div>
            </label>

            <label className="fiscal-toggle-card">
              <input
                type="checkbox"
                checked={configuracao.bloquearCustoSemAnaliseFiscal}
                onChange={(event) =>
                  atualizar('bloquearCustoSemAnaliseFiscal', event.target.checked)
                }
              />
              <div>
                <strong>Bloquear custo sem análise fiscal</strong>
                <span>
                  Impede confirmar a compra quando houver item fiscal pendente.
                </span>
              </div>
            </label>
          </div>

          <label className="fiscal-label-full">
            Observações Fiscais
            <textarea
              value={configuracao.observacoes}
              onChange={(event) =>
                atualizar('observacoes', event.target.value)
              }
              placeholder="Informações adicionais para o motor fiscal"
            />
          </label>
        </section>

        <div className="fiscal-footer-actions">
          <button
            type="button"
            className="fiscal-button-principal"
            title="Salvar configuração fiscal"
            aria-label="Salvar configuração fiscal"
            onClick={salvar}
          >
            <Save size={18} />
            Salvar configuração
          </button>
        </div>
      </section>
    </main>
  )
}

export default ConfiguracaoFiscal
