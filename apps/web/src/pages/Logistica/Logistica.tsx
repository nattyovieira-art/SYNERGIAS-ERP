import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Clock3, ExternalLink, MapPin, Navigation, PackageCheck, RefreshCw, Route, Search, Truck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar/Sidebar'
import PageHeader from '../../components/PageHeader/PageHeader'
import { ERP_STORAGE_UPDATED_EVENT } from '../../services/erpApi'
import { entregarPedidoCentral } from '../../services/pedidoEntregaApi'
import { listarVendasStorage, salvarVendaStorageConfirmado } from '../../services/vendasStorage'
import type { Venda } from '../../types/Venda'
import '../../styles/logistica.css'
import '../../styles/logistica-fix.css'

const EMPRESA = 'Avenida Frei Henrique de Coimbra, 11, Vila Ipiranga, Porto Alegre, RS, 91370-180'
const SLA_HORAS = 48
type Registro = Venda & { criadoEm?: string; atualizadoEm?: string; status?: string }

function normalizar(v?: string) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() }
function statusPedido(v: Registro) { return String(v.statusPedido || v.status || 'Aberto') }
function finalizado(v: Registro) { const s=normalizar(statusPedido(v)); return s.includes('entregue') || s.includes('cancelado') }
function ehPedido(v: Registro) { return normalizar(v.tipo).includes('pedido') }
function ehOrcamentoAprovado(v: Registro) { const s=normalizar(String(v.statusOrcamento || v.status || '')); return normalizar(v.tipo).includes('orcamento') && s.includes('aprovado') }
function endereco(v: Registro) { return [v.entregaEndereco, v.entregaNumero, v.entregaComplemento, v.entregaBairro, v.entregaCidade, v.entregaEstado, v.entregaCep].filter(Boolean).join(', ') || v.enderecoEntregaCompleto || '' }
function inicioSla(v: Registro, todos: Registro[]) { const origem=ehPedido(v)?todos.find(o=>ehOrcamentoAprovado(o)&&(String(o.id)===String(v.orcamentoOrigemId||'')||String(o.numeroOrcamento||'')===String(v.orcamentoOrigemNumero||v.numeroOrcamento||''))):undefined; const raw=origem?.aprovadoEm || v.aprovadoEm || origem?.atualizadoEm || v.atualizadoEm || v.criadoEm || (v.dataEmissao ? `${v.dataEmissao}T08:00:00-03:00` : ''); const d=new Date(raw); return Number.isNaN(d.getTime()) ? new Date() : d }
function prazoSla(v: Registro, todos: Registro[]) { const explicit=(v as any).logisticaPrazoEm; if(explicit){const d=new Date(explicit);if(!Number.isNaN(d.getTime()))return d} return new Date(inicioSla(v,todos).getTime()+SLA_HORAS*3600000) }
function situacaoSla(v: Registro, todos: Registro[]) { const h=(prazoSla(v,todos).getTime()-Date.now())/3600000; return h<0?'atrasado':h<=12?'atencao':'prazo' }
function textoSla(v: Registro, todos: Registro[]) { const horas=Math.ceil(Math.abs((prazoSla(v,todos).getTime()-Date.now())/3600000)); return situacaoSla(v,todos)==='atrasado'?`Atrasado ${horas}h`:horas<=1?'Vence em até 1h':`Restam ${horas}h` }
function dataHora(d: Date) { return d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) }
function qtd(v: Registro) { return (v.itens || []).reduce((s,i)=>s+Number(i.quantidade||0),0) }
function urlGps(lista: Registro[]) {
 const locais=lista.map(endereco).filter(Boolean)
 if(!locais.length)return ''
 const paradas=[EMPRESA,...locais].map(local=>encodeURIComponent(local)).join('/')
 return `https://www.google.com/maps/dir/${paradas}/?travelmode=driving`
}

export default function Logistica(){
 const navigate=useNavigate(); const [registros,setRegistros]=useState<Registro[]>(()=>listarVendasStorage() as Registro[]); const [busca,setBusca]=useState(''); const [rota,setRota]=useState<string[]>([]); const [ocupado,setOcupado]=useState(''); const [mensagem,setMensagem]=useState('')
 useEffect(()=>{const atualizar=()=>setRegistros(listarVendasStorage() as Registro[]);window.addEventListener(ERP_STORAGE_UPDATED_EVENT,atualizar);return()=>window.removeEventListener(ERP_STORAGE_UPDATED_EVENT,atualizar)},[])
 const pedidos=useMemo(()=>registros.filter(v=>ehPedido(v)&&!finalizado(v)).filter(v=>!busca||normalizar(`${v.numeroPedido} ${v.clienteNome} ${endereco(v)}`).includes(normalizar(busca))).sort((a,b)=>prazoSla(a,registros).getTime()-prazoSla(b,registros).getTime()),[registros,busca])
 const aprovados=useMemo(()=>registros.filter(ehOrcamentoAprovado).filter(o=>!registros.some(p=>ehPedido(p)&&(String(p.orcamentoOrigemId||'')===String(o.id)||String(p.orcamentoOrigemNumero||'')===String(o.numeroOrcamento||'')))),[registros])
 const rotaPedidos=rota.map(id=>pedidos.find(p=>p.id===id)).filter(Boolean) as Registro[]
 function alternar(id:string){setRota(r=>r.includes(id)?r.filter(x=>x!==id):[...r,id])}
 function mover(i:number,d:number){setRota(r=>{const n=[...r],j=i+d;if(j<0||j>=n.length)return r;[n[i],n[j]]=[n[j],n[i]];return n})}
 async function atualizar(v:Registro, patch:Partial<Registro>,ok:string){setOcupado(v.id);setMensagem('');try{await salvarVendaStorageConfirmado({...v,...patch} as Venda);setRegistros(listarVendasStorage() as Registro[]);setMensagem(ok)}catch(e){setMensagem(e instanceof Error?e.message:'Não foi possível atualizar o pedido.')}finally{setOcupado('')}}
 async function iniciarRota(){if(!rotaPedidos.length)return;const semEndereco=rotaPedidos.filter(pedido=>!endereco(pedido));if(semEndereco.length){setMensagem(`Informe o endereço de entrega dos pedidos: ${semEndereco.map(pedido=>pedido.numeroPedido||pedido.id).join(', ')}.`);return}const gps=window.open('about:blank','_blank');setOcupado('rota');try{for(let i=0;i<rotaPedidos.length;i++)await salvarVendaStorageConfirmado({...rotaPedidos[i],logisticaStatus:'Em rota',logisticaRotaOrdem:i+1,logisticaIniciadaEm:new Date().toISOString()} as Venda);setRegistros(listarVendasStorage() as Registro[]);const destino=urlGps(rotaPedidos);if(gps)gps.location.href=destino;else window.location.href=destino;setMensagem(`Rota iniciada com ${rotaPedidos.length} parada(s) e registrada nos pedidos.`)}catch(e){gps?.close();setMensagem(e instanceof Error?e.message:'Falha ao iniciar a rota.')}finally{setOcupado('')}}
 async function entregar(v:Registro){if(normalizar(statusPedido(v))!=='concluido'){setMensagem('Conclua o pedido antes de confirmar a entrega.');return}if(!confirm(`Confirmar entrega do pedido ${v.numeroPedido}? Esta ação dará baixa no estoque.`))return;setOcupado(v.id);try{await entregarPedidoCentral(v.id,'Logística');setRegistros(listarVendasStorage() as Registro[]);setRota(r=>r.filter(id=>id!==v.id));setMensagem(`Pedido ${v.numeroPedido} entregue e estoque baixado.`)}catch(e){setMensagem(e instanceof Error?e.message:'Falha ao confirmar a entrega.')}finally{setOcupado('')}}
 const indicadores={pendentes:pedidos.length,atrasados:pedidos.filter(v=>situacaoSla(v,registros)==='atrasado').length,rota:pedidos.filter(v=>v.logisticaStatus==='Em rota').length,aprovados:aprovados.length}
 return <div className="dashboard-layout logistica-layout"><Sidebar/><main className="logistica-page"><PageHeader category="Logística" title="Entregas" subtitle="Pedidos, SLA de 48 horas e rota do motorista."/>
 <section className="logistica-metricas"><article><Clock3/><span>Pendentes<strong>{indicadores.pendentes}</strong></span></article><article className="danger"><Clock3/><span>Atrasadas<strong>{indicadores.atrasados}</strong></span></article><article><Truck/><span>Em rota<strong>{indicadores.rota}</strong></span></article><article className="warning"><PackageCheck/><span>Orçamentos a converter<strong>{indicadores.aprovados}</strong></span></article></section>
 <div className="logistica-toolbar"><label><Search size={18}/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar pedido, cliente ou endereço"/></label><button onClick={()=>setRegistros(listarVendasStorage() as Registro[])}><RefreshCw size={18}/>Atualizar</button></div>
 {mensagem&&<div className="logistica-aviso">{mensagem}</div>}
 <div className="logistica-grid"><section className="logistica-card"><header><div><h2>Entregas pendentes</h2><p>Prazo D+2 contado da aprovação. Selecione os pedidos na ordem desejada.</p></div></header><div className="logistica-lista">{pedidos.map(v=>{const s=situacaoSla(v,registros),selected=rota.includes(v.id);return <article key={v.id} className={`entrega-item ${selected?'selected':''}`}><label className="entrega-check"><input type="checkbox" checked={selected} onChange={()=>alternar(v.id)}/><span/></label><div className="entrega-corpo"><div className="entrega-top"><strong>Pedido {v.numeroPedido||v.id}</strong><span className={`sla ${s}`}>{textoSla(v,registros)}</span></div><h3>{v.clienteNome}</h3><p><MapPin size={15}/>{endereco(v)||'Endereço de entrega não informado'}</p><small>{qtd(v)} volumes/unidades · aprovação {dataHora(inicioSla(v,registros))} · limite {dataHora(prazoSla(v,registros))} · {v.logisticaStatus||statusPedido(v)}</small><div className="entrega-acoes"><button disabled={ocupado===v.id} onClick={()=>navigate(`/vendas/pedidos/editar/${v.id}`)}>Abrir pedido</button>{normalizar(statusPedido(v))==='concluido'?<button className="success" disabled={ocupado===v.id} onClick={()=>entregar(v)}><CheckCircle2 size={16}/>Confirmar entrega</button>:<button disabled={ocupado===v.id} onClick={()=>atualizar(v,{logisticaStatus:'Em separação',statusPedido:statusPedido(v)==='Aberto'?'Em separação':v.statusPedido},'Separação registrada.')}><PackageCheck size={16}/>Separar</button>}</div></div></article>})}{!pedidos.length&&<div className="logistica-vazio">Nenhum pedido pendente.</div>}</div></section>
 <aside className="logistica-card rota-card"><header><div><h2>Rota do motorista</h2><p>Saída: Synergias, Av. Frei Henrique de Coimbra, 11.</p></div><Route/></header>{rotaPedidos.map((v,i)=><div className="rota-parada" key={v.id}><b>{i+1}</b><span><strong>{v.clienteNome}</strong><small>{endereco(v)}</small></span><div><button onClick={()=>mover(i,-1)} disabled={i===0}><ChevronUp/></button><button onClick={()=>mover(i,1)} disabled={i===rotaPedidos.length-1}><ChevronDown/></button></div></div>)}{!rotaPedidos.length&&<div className="logistica-vazio">Selecione pedidos para montar a rota.</div>}<button className="gps-btn" disabled={!rotaPedidos.length||ocupado==='rota'} onClick={iniciarRota}><Navigation/>Iniciar rota no GPS<ExternalLink size={16}/></button><p className="gps-nota">O GPS calcula o trajeto e o trânsito. A ordem pode ser ajustada pelas setas antes da saída.</p></aside></div>
 {aprovados.length>0&&<section className="logistica-card orcamentos-logistica"><header><div><h2>Orçamentos aprovados sem pedido</h2><p>Precisam ser convertidos antes de entrar na rota e movimentar estoque.</p></div></header>{aprovados.map(o=><button key={o.id} onClick={()=>navigate(`/vendas/orcamentos/editar/${o.id}`)}><span>Orçamento {o.numeroOrcamento}</span><strong>{o.clienteNome}</strong><ExternalLink/></button>)}</section>}
 </main></div>}
