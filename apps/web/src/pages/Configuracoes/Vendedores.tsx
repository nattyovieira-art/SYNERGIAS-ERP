import { useMemo, useState } from 'react'
import ConfiguracaoFormShell from './ConfiguracaoFormShell'
import { carregarLista, idLocal, salvarConfig } from './storage'
type Vendedor={id:string;nome:string;email:string;telefone:string;ativo:boolean}
const CHAVE='synergias_vendedores'
function normalizar(v:any):Vendedor{return typeof v==='string'?{id:idLocal('vend'),nome:v,email:'',telefone:'',ativo:true}:{id:v.id||idLocal('vend'),nome:v.nome||v.name||'',email:v.email||'',telefone:v.telefone||'',ativo:v.ativo!==false}}
export default function Vendedores(){
 const [lista,setLista]=useState<Vendedor[]>(()=>carregarLista<any>(CHAVE,['Natália Vieira']).map(normalizar)); const [nome,setNome]=useState(''); const [email,setEmail]=useState(''); const [telefone,setTelefone]=useState(''); const [msg,setMsg]=useState('')
 const ativos=useMemo(()=>lista.filter(v=>v.ativo).length,[lista])
 const persistir=(nova:Vendedor[])=>{setLista(nova);salvarConfig(CHAVE,nova);setMsg('Cadastro de vendedores atualizado.')}
 const adicionar=()=>{if(!nome.trim())return;persistir([...lista,{id:idLocal('vend'),nome:nome.trim(),email:email.trim(),telefone:telefone.trim(),ativo:true}]);setNome('');setEmail('');setTelefone('')}
 return <ConfiguracaoFormShell category="Configurações • Vendas" title="Vendedores" subtitle="Cadastre os vendedores usados nos orçamentos e pedidos." notice={msg||`${ativos} vendedor(es) ativo(s).`}>
  <section className="config-section"><h3>Novo vendedor</h3><p>O cadastro fica centralizado e utiliza a chave já existente do ERP.</p><div className="config-grid"><div className="config-field"><label>Nome</label><input value={nome} onChange={e=>setNome(e.target.value)}/></div><div className="config-field"><label>E-mail</label><input value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="config-field"><label>Telefone</label><input value={telefone} onChange={e=>setTelefone(e.target.value)}/></div></div><div className="config-inline-actions" style={{marginTop:14}}><button className="config-small-button config-small-button-primary" onClick={adicionar}>Adicionar vendedor</button></div></section>
  <section className="config-section"><h3>Vendedores cadastrados</h3><div className="config-table-wrap"><table className="config-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Status</th><th>Ações</th></tr></thead><tbody>{lista.map(v=><tr key={v.id}><td>{v.nome}</td><td>{v.email||'—'}</td><td>{v.telefone||'—'}</td><td><span className={`config-status ${v.ativo?'config-status-ok':'config-status-off'}`}>{v.ativo?'Ativo':'Inativo'}</span></td><td><div className="config-inline-actions"><button className="config-small-button" onClick={()=>persistir(lista.map(x=>x.id===v.id?{...x,ativo:!x.ativo}:x))}>{v.ativo?'Inativar':'Ativar'}</button><button className="config-small-button config-small-button-danger" onClick={()=>persistir(lista.filter(x=>x.id!==v.id))}>Excluir</button></div></td></tr>)}</tbody></table></div></section>
 </ConfiguracaoFormShell>
}
