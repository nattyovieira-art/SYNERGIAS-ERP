const MARCADOR = 'SYNERGIAS_ORCAMENTOS_JOY_20260724'
const PRINCIPAL: Array<[string[], number]> = [
  [['AGUA','SANITARIA','5L','QMFEL'],5], [['MULTIOX','5L'],2], [['ALCOOL','LIQUIDO','5L','FLOPS'],4],
  [['ALCOOL','GEL','5L','SVALE'],1], [['DETERGENTE','NEUTRO','5L','GMRAES'],2], [['AJAX','LAVANDA','3','8L'],5],
  [['PAPEL','HIGIENICO','ROLAO','300M','PSA'],2], [['PAPEL','TOALHA','RPEL'],7], [['BRILHA','INOX'],2],
  [['SAPONACEO','UTL'],4], [['CEREJA','AVELA','COALA'],4], [['VASSOURA','MULTIUSO','S','CABO','BTTN'],3],
  [['ESPONJA','VERDE','AMARELO','BTTN'],4], [['MOP','UMIDO','190G','MOX'],5], [['MICROFIBRA','50','70','PFPRO'],2],
  [['FLANELADO','A','DTEX'],6], [['SABAO','PO','800G','GSOL'],2], [['LAVA','ROUPAS','5L','CARINHO'],1],
  [['LIMPADOR','PERFUMADO','LAVANDA','5L','GMRAES'],4], [['MAX','SURF','5L'],2], [['COPO','180ML','100UN','TOTALPLAST'],3],
  [['PEDRA','SANITARIA','PATO'],7], [['LUSTRA','MOVEIS','500ML','PEROBA'],1], [['VEJA','MULTIUSO','500ML'],4],
  [['CABO','ALUMINIO','140','PFPRO'],4], [['SACO','LIXO','40L','PRETO','0','04M','100UN'],1],
  [['SACO','LIXO','100L','PRETO','0','10M','100UN'],2], [['SACO','LIXO','240L','PRETO','0','10M','50UN'],4],
  [['ODORIZADOR','PETALAS','ROSA','350ML','PURO','AR'],2], [['LAMPADA','12W','OLUX'],30], [['CAFE','500G','BOM','JESUS'],2],
]
const PORTARIA: Array<[string[], number]> = [
  [['FITA','ADESIVA','TRANSPARENTE','45MM','40M'],5],
  [['CANETA','RETROPROJETOR','AZUL','PILOT'],2],
]
const norm = (v: unknown) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/gi,' ').trim().toUpperCase()

export async function criarOrcamentosJoy(vendas:any[], produtos:any[], clientes:any[], atualizar:any, recarregar:any) {
  if (vendas.some((v) => v?.marcadorInstalacao === MARCADOR)) return vendas
  const cs = clientes.filter((c) => norm(c.razaoSocial || c.nomeFantasia || c.nome).includes('JOY'))
  if (cs.length !== 1) { console.warn(`[JOY] Criação aguardando: ${cs.length} clientes encontrados.`); return vendas }
  const cliente = cs[0]
  const montarItens = (specs:Array<[string[],number]>, grupo:string) => specs.map(([termos,qtd],i) => {
    const encontrados = produtos.filter((p) => termos.every((t) => norm(p.descricao || p.nome).includes(norm(t))))
    if (encontrados.length !== 1) throw new Error(`[JOY] ${termos.join(' ')} encontrou ${encontrados.length} produtos.`)
    const p = encontrados[0], valor = Number(p.vendaVarejo || p.precoVenda || p.valorVenda || 0)
    if (!(valor > 0)) throw new Error(`[JOY] ${p.descricao || p.nome} está sem preço.`)
    return { id:`joy-${grupo}-${i}-${Date.now()}`,produtoId:String(p.id||''),codigo:String(p.codigo||''),codigoProduto:String(p.codigo||''),codigoBarras:String(p.codigoBarras||p.codigo||''),descricao:String(p.descricao||p.nome),unidade:String(p.unidade||'UN'),quantidade:qtd,valorUnitario:valor,desconto:0,valorTotal:Number((qtd*valor).toFixed(2)),produtoVinculado:true,vinculoProdutoOrigem:'DESCRICAO' }
  })
  let atuais = [...vendas]
  for (const [grupo,specs] of [['PRINCIPAL',PRINCIPAL],['PORTARIA',PORTARIA]] as const) {
    const itens=montarItens(specs,grupo), total=Number(itens.reduce((s,x)=>s+x.valorTotal,0).toFixed(2))
    const nums=atuais.map(v=>Number(String(v.numeroOrcamento||'').replace(/\D/g,''))).filter(Number.isFinite)
    const numero=String((nums.length?Math.max(...nums):0)+1), agora=new Date().toISOString(), hoje=agora.slice(0,10)
    const id=`orcamento-joy-${grupo.toLowerCase()}-${numero}`
    const orc={id,tipo:'Orçamento',numeroOrcamento:numero,vendedor:'Natália Vieira',clienteId:String(cliente.codigo||cliente.id||''),clienteCodigo:String(cliente.codigo||cliente.id||''),clienteNome:String(cliente.razaoSocial||cliente.nomeFantasia||''),clienteDocumento:String(cliente.cnpj||''),dataEmissao:hoje,dataEntrega:hoje,dataValidade:hoje,itens,subtotal:total,totalFinal:total,valorTotal:total,frete:0,outrosCustos:0,status:'ABERTO',statusOrcamento:'Aberto',observacoes:grupo==='PORTARIA'?'PORTARIA / ADMINISTRAÇÃO':'',criadoEm:agora,atualizadoEm:agora,marcadorInstalacao:MARCADOR,grupoJoy:grupo}
    await atualizar('vendas',orc)
    atuais=(await recarregar('vendas')).data
    if (!atuais.some((v:any)=>v.id===id&&v.itens?.length===specs.length)) throw new Error(`[JOY] Orçamento ${grupo} não foi confirmado.`)
  }
  return atuais
}
