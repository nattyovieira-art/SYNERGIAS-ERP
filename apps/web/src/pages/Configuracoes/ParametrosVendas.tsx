import { useState } from 'react'
import ConfiguracaoFormShell from './ConfiguracaoFormShell'
import { carregarConfig, salvarConfig } from './storage'

type Config = { validadeOrcamento:number; prazoEntrega:number; limiteDesconto:number; permitirAlterarPreco:boolean; permitirVendaSemEstoque:boolean; exibirSomenteAtivos:boolean }
const CHAVE='synergias_config_vendas'
const PADRAO:Config={validadeOrcamento:5,prazoEntrega:2,limiteDesconto:10,permitirAlterarPreco:true,permitirVendaSemEstoque:false,exibirSomenteAtivos:true}
export default function ParametrosVendas(){
 const [c,setC]=useState<Config>(()=>carregarConfig(CHAVE,PADRAO)); const [msg,setMsg]=useState('')
 const salvar=()=>{salvarConfig(CHAVE,c);setMsg('Parâmetros de vendas salvos com sucesso.')}
 return <ConfiguracaoFormShell category="Configurações • Vendas" title="Parâmetros de Vendas" subtitle="Defina as regras gerais usadas em orçamentos e pedidos." onSave={salvar} notice={msg||'Os valores padrão passam a ficar centralizados aqui. A ligação automática com Orçamento e Pedido será feita sobre estas mesmas chaves.'}>
  <section className="config-section"><h3>Prazos e desconto</h3><p>Parâmetros comerciais padrão da Synergias.</p><div className="config-grid">
   <div className="config-field"><label>Validade padrão do orçamento (dias úteis)</label><input type="number" min="1" value={c.validadeOrcamento} onChange={e=>setC({...c,validadeOrcamento:Number(e.target.value)})}/></div>
   <div className="config-field"><label>Prazo padrão de entrega (dias úteis)</label><input type="number" min="0" value={c.prazoEntrega} onChange={e=>setC({...c,prazoEntrega:Number(e.target.value)})}/></div>
   <div className="config-field"><label>Limite de desconto sem autorização (%)</label><input type="number" min="0" max="100" value={c.limiteDesconto} onChange={e=>setC({...c,limiteDesconto:Number(e.target.value)})}/></div>
  </div></section>
  <section className="config-section"><h3>Regras de venda</h3><p>Controles gerais para o fluxo comercial.</p><div className="config-checks">
   <label className="config-check"><input type="checkbox" checked={c.permitirAlterarPreco} onChange={e=>setC({...c,permitirAlterarPreco:e.target.checked})}/>Permitir alteração de preço no pedido</label>
   <label className="config-check"><input type="checkbox" checked={c.permitirVendaSemEstoque} onChange={e=>setC({...c,permitirVendaSemEstoque:e.target.checked})}/>Permitir concluir venda sem estoque</label>
   <label className="config-check"><input type="checkbox" checked={c.exibirSomenteAtivos} onChange={e=>setC({...c,exibirSomenteAtivos:e.target.checked})}/>Exibir somente produtos ativos nas buscas</label>
  </div></section>
 </ConfiguracaoFormShell>
}
