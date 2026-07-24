import { useState } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  Boxes,
  Building2,
  CircleDollarSign,
  CreditCard,
  DatabaseBackup,
  FileChartColumnIncreasing,
  FileKey2,
  Hash,
  Landmark,
  Calculator,
  LockKeyhole,
  Plug,
  ScrollText,
  Settings2,
  SlidersHorizontal,
  Tags,
  UserRoundCog,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'

import '../../styles/configuracoes.css'

type ItemConfiguracao = {
  titulo: string
  descricao: string
  rota: string
  icone: typeof Settings2
}

type GrupoConfiguracao = {
  titulo: string
  descricao: string
  classe: string
  icone: typeof Settings2
  itens: ItemConfiguracao[]
}

const GRUPOS: GrupoConfiguracao[] = [
  {
    titulo: 'Empresa',
    descricao: 'Dados cadastrais, identidade e informações institucionais da Synergias.',
    classe: 'empresa',
    icone: Building2,
    itens: [
      {
        titulo: 'Dados da Empresa',
        descricao: 'Razão social, CNPJ, endereço e informações cadastrais.',
        rota: '/configuracoes/fiscal/configuracao',
        icone: Building2,
      },
    ],
  },
  {
    titulo: 'Vendas',
    descricao: 'Parâmetros comerciais, prazos, descontos e cadastro de vendedores.',
    classe: 'vendas',
    icone: FileChartColumnIncreasing,
    itens: [
      {
        titulo: 'Parâmetros de Vendas',
        descricao: 'Validade, prazo de entrega, desconto e regras de venda.',
        rota: '/configuracoes/vendas/parametros',
        icone: SlidersHorizontal,
      },
      {
        titulo: 'Vendedores',
        descricao: 'Cadastro central dos vendedores usados nos orçamentos.',
        rota: '/configuracoes/vendas/vendedores',
        icone: Users,
      },
    ],
  },
  {
    titulo: 'Financeiro',
    descricao: 'Formas de pagamento, contas bancárias e organização financeira.',
    classe: 'financeiro',
    icone: CircleDollarSign,
    itens: [
      {
        titulo: 'Formas de Pagamento',
        descricao: 'Boleto, PIX, transferência, dinheiro e cartão.',
        rota: '/configuracoes/financeiro/formas-pagamento',
        icone: CreditCard,
      },
      {
        titulo: 'Contas Bancárias',
        descricao: 'Centralização das contas bancárias do ERP.',
        rota: '/configuracoes/financeiro/contas-bancarias',
        icone: Landmark,
      },
      {
        titulo: 'Categorias Financeiras',
        descricao: 'Receitas e despesas para organização e DRE gerencial.',
        rota: '/configuracoes/financeiro/categorias',
        icone: Tags,
      },
    ],
  },
  {
    titulo: 'Estoque',
    descricao: 'Regras automáticas de entrada, saída e movimentação de mercadorias.',
    classe: 'estoque',
    icone: Boxes,
    itens: [
      {
        titulo: 'Parâmetros de Movimentação',
        descricao: 'Define quando pedido, compra e histórico movimentam estoque.',
        rota: '/configuracoes/estoque/movimentacao',
        icone: Boxes,
      },
    ],
  },
  {
    titulo: 'Fiscal',
    descricao: 'Parâmetros fiscais, certificado A1, regras tributárias e numeração.',
    classe: 'fiscal',
    icone: Calculator,
    itens: [
      {
        titulo: 'Configuração Fiscal',
        descricao: 'Regime tributário, ICMS, ST, antecipação e composição de custo.',
        rota: '/configuracoes/fiscal/configuracao',
        icone: Settings2,
      },
      {
        titulo: 'Certificado Digital A1',
        descricao: 'Instalação protegida e controle de validade do certificado.',
        rota: '/configuracoes/fiscal/certificado',
        icone: FileKey2,
      },
      {
        titulo: 'Regras NCM / CEST',
        descricao: 'Base de regras fiscais e memória tributária por produto.',
        rota: '/configuracoes/fiscal/regras-ncm-cest',
        icone: BadgeCheck,
      },
      {
        titulo: 'Numeração Fiscal',
        descricao: 'Séries, último número utilizado e sequência dos documentos.',
        rota: '/configuracoes/fiscal/numeracao',
        icone: Hash,
      },
      {
        titulo: 'Naturezas de Operação',
        descricao: 'Venda, compra, devolução, remessa e demais operações fiscais.',
        rota: '/configuracoes/fiscal/naturezas-operacao',
        icone: ScrollText,
      },
    ],
  },
  {
    titulo: 'Acesso',
    descricao: 'Usuários, perfis e controle do que cada pessoa pode visualizar ou alterar.',
    classe: 'acesso',
    icone: UserRoundCog,
    itens: [
      {
        titulo: 'Funcionários',
        descricao: 'Cadastro dos funcionários usados nas diárias por turno.',
        rota: '/configuracoes/funcionarios',
        icone: Users,
      },
      {
        titulo: 'Usuários e Permissões',
        descricao: 'Usuários, perfis e permissões por módulo e ação.',
        rota: '/configuracoes/acesso/usuarios-permissoes',
        icone: UserRoundCog,
      },
    ],
  },
  {
    titulo: 'Integrações',
    descricao: 'Conexões externas com bancos e ambiente fiscal da NF-e.',
    classe: 'integracoes',
    icone: Plug,
    itens: [
      {
        titulo: 'Banco Inter',
        descricao: 'Parâmetros e status das integrações bancárias.',
        rota: '/configuracoes/integracoes/bancos',
        icone: Plug,
      },
      {
        titulo: 'SEFAZ / NF-e',
        descricao: 'Ambiente, serviços fiscais e status da comunicação NF-e.',
        rota: '/configuracoes/integracoes/sefaz-nfe',
        icone: ScrollText,
      },
    ],
  },
  {
    titulo: 'Sistema',
    descricao: 'Backup, ambiente de homologação ou produção e versão do ERP.',
    classe: 'sistema',
    icone: DatabaseBackup,
    itens: [
      {
        titulo: 'Backup, Ambiente e Versão',
        descricao: 'Backup, homologação ou produção e versão atual do sistema.',
        rota: '/configuracoes/sistema',
        icone: DatabaseBackup,
      },
    ],
  },
]

function Configuracoes() {
  const navigate = useNavigate()
  const [grupoAtivo, setGrupoAtivo] = useState<GrupoConfiguracao | null>(null)

  if (grupoAtivo) {
    const GrupoIcone = grupoAtivo.icone

    return (
      <main className="configuracoes-layout">
        <Sidebar />

        <section className="configuracoes-page">
          <PageHeader
            category="Configurações"
            title={grupoAtivo.titulo}
            subtitle={grupoAtivo.descricao}
          />

          <div className={`configuracoes-detalhe configuracoes-area-${grupoAtivo.classe}`}>
            <div className="configuracoes-detalhe-toolbar">
              <button
                type="button"
                className="configuracoes-voltar"
                onClick={() => setGrupoAtivo(null)}
                title="Voltar"
                aria-label="Voltar para Central de Configurações"
              >
                <ArrowLeft size={25} />
              </button>

              <div className="configuracoes-detalhe-identidade">
                <span className="configuracoes-detalhe-icone">
                  <GrupoIcone size={28} strokeWidth={2.2} />
                </span>
                <div>
                  <strong>{grupoAtivo.titulo}</strong>
                  <span>{grupoAtivo.itens.length} {grupoAtivo.itens.length === 1 ? 'configuração' : 'configurações'}</span>
                </div>
              </div>
            </div>

            {grupoAtivo.classe === 'fiscal' ? (
              <div className="configuracoes-aviso-administrativo">
                <LockKeyhole size={20} />
                <span>
                  Área administrativa e sensível. Configuração Fiscal, Certificado Digital A1 e Regras NCM / CEST ficam concentrados somente aqui.
                </span>
              </div>
            ) : null}

            <div className="configuracoes-opcoes-grid">
              {grupoAtivo.itens.map((item) => {
                const ItemIcone = item.icone

                return (
                  <button
                    key={item.rota}
                    type="button"
                    className="configuracoes-opcao-card"
                    onClick={() => navigate(item.rota)}
                  >
                    <span className="configuracoes-opcao-icone">
                      <ItemIcone size={27} strokeWidth={2.2} />
                    </span>

                    <span className="configuracoes-opcao-texto">
                      <strong>{item.titulo}</strong>
                      <small>{item.descricao}</small>
                      <span>Abrir configuração</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="configuracoes-layout">
      <Sidebar />

      <section className="configuracoes-page">
        <PageHeader
          category="Configurações"
          title="Central de Configurações"
          subtitle="Parâmetros administrativos, fiscais, financeiros e operacionais do ERP Synergias."
        />

        <section className="configuracoes-central-grid">
          {GRUPOS.map((grupo) => {
            const GrupoIcone = grupo.icone

            return (
              <button
                key={grupo.titulo}
                type="button"
                className={`configuracoes-central-card configuracoes-area-${grupo.classe}`}
                onClick={() => setGrupoAtivo(grupo)}
              >
                <span className="configuracoes-central-card-icon">
                  <GrupoIcone size={30} strokeWidth={2.2} />
                </span>

                <span className="configuracoes-central-card-texto">
                  <strong>{grupo.titulo}</strong>
                  <small>{grupo.descricao}</small>
                  <span className="configuracoes-central-card-count">
                    {grupo.itens.length} {grupo.itens.length === 1 ? 'configuração' : 'configurações'}
                  </span>
                </span>
              </button>
            )
          })}
        </section>
      </section>
    </main>
  )
}

export default Configuracoes
