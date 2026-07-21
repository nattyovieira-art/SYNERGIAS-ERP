import { useState } from 'react'
import ConfiguracaoFormShell from './ConfiguracaoFormShell'
import { carregarConfig, salvarConfig } from './storage'
type Config={orcamento:boolean;pedidoAberto:boolean;pedidoConcluido:boolean;compraConfirmada:boolean;nfeHistorica:boolean;permitirNegativo:boolean;avisarMinimo:boolean}
const CHAVE='synergias_config_movimentacao_estoque'
const PADRAO:Config={orcamento:false,pedidoAberto:false,pedidoConcluido:true,compraConfirmada:true,nfeHistorica:false,permitirNegativo:false,avisarMinimo:true}
export default function ParametrosMovimentacao(){const [c,setC]=useState(()=>carregarConfig(CHAVE,PADRAO));const [msg,setMsg]=useState('');const salvar=()=>{salvarConfig(CHAVE,c);setMsg('Parâmetros de movimentação salvos.')};const check=(k:keyof Config,label:string)=><label className="config-check"><input type="checkbox" checked={c[k]} onChange={e=>setC({...c,[k]:e.target.checked})}/>{label}</label>;return <ConfiguracaoFormShell category="Configurações • Estoque" title="Parâmetros de Movimentação" subtitle="Defina quando o ERP deve gerar entradas e saídas automáticas de estoque." onSave={salvar} notice={msg||'Estas regras gerais não substituem o campo Movimentar Estoque do produto; elas definem o momento do movimento automático.'}>
<section className="config-section"><h3>Eventos que movimentam estoque</h3><p>Marque somente os eventos que devem gerar movimento automático.</p><div className="config-checks">{check('orcamento','Criar ou salvar orçamento')}{check('pedidoAberto','Salvar pedido em aberto')}{check('pedidoConcluido','Concluir pedido')}{check('compraConfirmada','Confirmar compra')}{check('nfeHistorica','Importar NF-e histórica')}</div></section>
<section className="config-section"><h3>Controles</h3><div className="config-checks">{check('permitirNegativo','Permitir estoque negativo')}{check('avisarMinimo','Avisar quando atingir estoque mínimo')}</div></section>
</ConfiguracaoFormShell>}
