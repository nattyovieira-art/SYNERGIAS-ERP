<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
exigirAutenticacao();
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') responder(405, ['ok'=>false,'error'=>'Método não permitido.']);

function numeroMovimento(mixed $valor): float {
    if (is_int($valor) || is_float($valor)) return is_finite((float)$valor) ? (float)$valor : 0.0;
    $texto=trim((string)($valor??'')); if($texto==='')return 0.0;
    if(str_contains($texto,',')&&str_contains($texto,'.'))$texto=str_replace('.','',$texto);
    $numero=(float)str_replace(',','.',preg_replace('/[^0-9,.-]/','',$texto));
    return is_finite($numero)?$numero:0.0;
}
function chaveItemHistorico(array $item): string {
    foreach(['produtoId','codigoProduto','codigo','codigoBarras'] as $campo){$valor=trim((string)($item[$campo]??''));if($valor!=='')return $campo.':'.mb_strtolower($valor,'UTF-8');}
    $descricao=trim((string)($item['descricao']??$item['nome']??''));
    return $descricao===''?'':('descricao:'.mb_strtolower($descricao,'UTF-8'));
}
function dataHistorica(array $pedido): array {
    $data=trim((string)($pedido['dataEntregaRealizada']??''));
    $estimada=false;
    if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$data)){$data=trim((string)($pedido['dataEmissao']??''));$estimada=true;}
    if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$data)){$data='';$estimada=true;}
    $hora=trim((string)($pedido['horarioEntregaRealizada']??''));
    if(!preg_match('/^\d{2}:\d{2}(:\d{2})?$/',$hora))$hora=''; elseif(strlen($hora)===5)$hora.=':00';
    $ordenacao=$data!==''?$data.'T'.($hora?:'00:00:00').'-03:00':'0000-00-00T00:00:00-03:00';
    return [$data,$hora,$ordenacao,$estimada];
}

$pdo=obterPdo();
$existe=$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='erp_estoque_movimentacoes'")->fetchColumn();
$movimentos=[];
if((int)$existe>0){
    $stmt=$pdo->query('SELECT id,pedido_id,numero_pedido,produto_id,produto_codigo,produto_descricao,quantidade,tipo,origem,estoque_anterior,estoque_atual,movimento_original_id,usuario,criado_em FROM erp_estoque_movimentacoes ORDER BY criado_em DESC,id DESC');
    foreach($stmt as $r){$criado=new DateTimeImmutable((string)$r['criado_em'],new DateTimeZone('America/Sao_Paulo'));$movimentos[]=[
        'id'=>(string)$r['id'],'pedidoId'=>(string)$r['pedido_id'],'numeroPedido'=>(string)$r['numero_pedido'],'produtoId'=>(string)$r['produto_id'],'produtoCodigo'=>(string)$r['produto_codigo'],'produtoDescricao'=>(string)$r['produto_descricao'],
        'quantidade'=>(float)$r['quantidade'],'tipo'=>(string)$r['tipo'],'origem'=>(string)$r['origem'],'estoqueAnterior'=>(float)$r['estoque_anterior'],'estoqueAtual'=>(float)$r['estoque_atual'],'saldoHistoricoDisponivel'=>true,
        'movimentoOriginalId'=>$r['movimento_original_id']===null?null:(string)$r['movimento_original_id'],'usuario'=>(string)$r['usuario'],'documentoOrigem'=>(string)$r['numero_pedido'],'motivo'=>'Entrega do pedido '.(string)$r['numero_pedido'],'observacao'=>'Movimentação autoritativa do MySQL.',
        'data'=>$criado->format('Y-m-d'),'hora'=>$criado->format('H:i:s'),'criadoEm'=>$criado->format(DATE_ATOM),
    ];}
}

$pedidosComMovimento=[]; foreach($movimentos as $m)$pedidosComMovimento[(string)$m['pedidoId']]=true;
$stmtVendas=$pdo->prepare("SELECT payload FROM erp_storage WHERE collection='vendas' LIMIT 1");$stmtVendas->execute();$payload=$stmtVendas->fetchColumn();$vendas=is_string($payload)?json_decode($payload,true):[];
foreach(is_array($vendas)?$vendas:[] as $pedido){
    if(!is_array($pedido))continue;
    $pedidoId=trim((string)($pedido['id']??''));$numero=trim((string)($pedido['numeroPedido']??''));$baixado=filter_var($pedido['estoqueBaixado']??false,FILTER_VALIDATE_BOOLEAN);
    $semBaixa=filter_var($pedido['entregaConfirmadaSemBaixaEstoque']??false,FILTER_VALIDATE_BOOLEAN)||(array_key_exists('estoqueBaixadoNoErp',$pedido)&&!filter_var($pedido['estoqueBaixadoNoErp'],FILTER_VALIDATE_BOOLEAN));
    if($pedidoId===''||$numero===''||!$baixado||$semBaixa||isset($pedidosComMovimento[$pedidoId]))continue;
    [$data,$hora,$ordenacao,$dataEstimada]=dataHistorica($pedido);$grupos=[];
    foreach(($pedido['itens']??[]) as $item){if(!is_array($item))continue;$chave=chaveItemHistorico($item);$qtd=abs(numeroMovimento($item['quantidade']??0));if($chave===''||$qtd<=0)continue;
        if(!isset($grupos[$chave]))$grupos[$chave]=['item'=>$item,'quantidade'=>0.0];$grupos[$chave]['quantidade']=round($grupos[$chave]['quantidade']+$qtd,4);
    }
    foreach($grupos as $chave=>$grupo){$item=$grupo['item'];$codigo=trim((string)($item['codigoProduto']??$item['codigo']??$item['codigoBarras']??''));$descricao=trim((string)($item['descricao']??$item['nome']??'Produto'))?:'Produto';
        $observacao='Histórico recuperado da entrega anterior à centralização. O saldo não foi movimentado novamente.';if($dataEstimada)$observacao.=' Data baseada na emissão do pedido.';
        $movimentos[]=['id'=>'historico-'.sha1($pedidoId.'|'.$chave),'pedidoId'=>$pedidoId,'numeroPedido'=>$numero,'produtoId'=>(string)($item['produtoId']??''),'produtoCodigo'=>$codigo,'produtoDescricao'=>$descricao,
            'quantidade'=>-$grupo['quantidade'],'tipo'=>'saida','origem'=>'pedido','estoqueAnterior'=>null,'estoqueAtual'=>null,'saldoHistoricoDisponivel'=>false,'movimentoOriginalId'=>null,'usuario'=>'Synergias','documentoOrigem'=>$numero,
            'motivo'=>'Entrega do pedido '.$numero,'observacao'=>$observacao,'data'=>$data,'hora'=>$hora,'criadoEm'=>$ordenacao];
    }
}
usort($movimentos,static fn(array $a,array $b):int=>strcmp((string)$b['criadoEm'],(string)$a['criadoEm']));
responder(200,['ok'=>true,'data'=>$movimentos,'count'=>count($movimentos),'storage'=>'mysql+historico-recuperado']);
