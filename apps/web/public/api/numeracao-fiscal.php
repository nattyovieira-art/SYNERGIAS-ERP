<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
exigirAutenticacao();
$pdo = obterPdo();

$pdo->exec("CREATE TABLE IF NOT EXISTS configuracoes_erp (
 chave VARCHAR(120) PRIMARY KEY,
 valor LONGTEXT NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$pdo->exec("CREATE TABLE IF NOT EXISTS nfe_reservas (
 ambiente VARCHAR(20) NOT NULL,
 serie VARCHAR(3) NOT NULL,
 numero INT UNSIGNED NOT NULL,
 referencia VARCHAR(120) NOT NULL,
 criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expira_em TIMESTAMP NOT NULL,
 PRIMARY KEY (ambiente,serie),
 UNIQUE KEY uq_nfe_reserva_numero (ambiente,serie,numero)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

function numeracaoPadrao(): array { return [
 ['id'=>'nfe-homologacao-1','documento'=>'NF-e','ambiente'=>'HOMOLOGACAO','serie'=>'1','ultimo'=>2384,'ativa'=>false],
 ['id'=>'nfe-producao-1','documento'=>'NF-e','ambiente'=>'PRODUCAO','serie'=>'1','ultimo'=>2429,'ativa'=>true],
]; }
function normalizarNumeracao(array $lista): array {
 $saida=[];
 foreach($lista as $item){
  if(!is_array($item)||($item['documento']??'')!=='NF-e')continue;
  $amb=strtoupper(trim((string)($item['ambiente']??'HOMOLOGACAO')));
  if(!in_array($amb,['HOMOLOGACAO','PRODUCAO'],true))continue;
  $serie=preg_replace('/\D+/','',(string)($item['serie']??'1'))?:'1';
  $ultimo=max($amb==='PRODUCAO'?2429:2384,(int)($item['ultimo']??0));
  $saida[]=['id'=>(string)($item['id']??('nfe-'.strtolower($amb).'-'.$serie)),'documento'=>'NF-e','ambiente'=>$amb,'serie'=>substr($serie,0,3),'ultimo'=>$ultimo,'ativa'=>(bool)($item['ativa']??true)];
 }
 foreach(numeracaoPadrao() as $p){
  $ok=false; foreach($saida as $i){if($i['ambiente']===$p['ambiente']&&$i['serie']===$p['serie']){$ok=true;break;}}
  if(!$ok)$saida[]=$p;
 }
 return $saida;
}
function lerNumeracao(PDO $pdo,bool $forUpdate=false): array {
 $sql='SELECT valor FROM configuracoes_erp WHERE chave=? LIMIT 1'.($forUpdate?' FOR UPDATE':'');
 $s=$pdo->prepare($sql);$s->execute(['numeracao_fiscal']);$v=$s->fetchColumn();
 return $v?normalizarNumeracao((array)json_decode((string)$v,true)):numeracaoPadrao();
}
function salvarNumeracao(PDO $pdo,array $lista): array {
 $n=normalizarNumeracao($lista);
 $json=json_encode($n,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
 $s=$pdo->prepare('INSERT INTO configuracoes_erp (chave,valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor=VALUES(valor),updated_at=CURRENT_TIMESTAMP');
 $s->execute(['numeracao_fiscal',$json]); return $n;
}
function referenciaFiscal(array $body): string {
 $r=trim((string)($body['referencia']??''));
 return $r!==''?substr($r,0,120):'sem-referencia';
}

$method=strtoupper((string)($_SERVER['REQUEST_METHOD']??'GET'));
if($method==='GET'){
 $res=$pdo->query("SELECT ambiente,serie,numero,referencia,expira_em FROM nfe_reservas WHERE expira_em>NOW()")->fetchAll();
 responder(200,['ok'=>true,'numeracao'=>lerNumeracao($pdo),'reservas'=>$res]);
}
if($method!=='POST')responder(405,['ok'=>false,'error'=>'Método não permitido.']);

$body=json_decode((string)file_get_contents('php://input'),true);
if(!is_array($body))responder(422,['ok'=>false,'error'=>'Dados inválidos.']);
$acao=(string)($body['acao']??'salvar');

if($acao==='reservar'){
 $amb=strtoupper((string)($body['ambiente']??'PRODUCAO'));
 $serie=preg_replace('/\D+/','',(string)($body['serie']??'1'))?:'1';
 $ref=referenciaFiscal($body);
 if(!in_array($amb,['HOMOLOGACAO','PRODUCAO'],true))responder(422,['ok'=>false,'error'=>'Ambiente fiscal inválido.']);
 try{
  $pdo->beginTransaction();
  $pdo->prepare("DELETE FROM nfe_reservas WHERE expira_em<=NOW()")->execute();
  $lista=lerNumeracao($pdo,true);
  $ultimo=0;
  foreach($lista as $item)if($item['documento']==='NF-e'&&$item['ambiente']===$amb&&(string)$item['serie']===$serie){$ultimo=(int)$item['ultimo'];break;}
  $numero=max($amb==='PRODUCAO'?2430:2385,$ultimo+1);

  $st=$pdo->prepare("SELECT numero,referencia FROM nfe_reservas WHERE ambiente=? AND serie=? FOR UPDATE");
  $st->execute([$amb,$serie]); $r=$st->fetch(PDO::FETCH_ASSOC);
  if($r){
   if((string)$r['referencia']!==$ref){
    $pdo->rollBack();
    responder(409,['ok'=>false,'error'=>'Existe outra emissão de NF-e em andamento. Conclua ou aguarde 15 minutos antes de iniciar outra.','numero'=>(int)$r['numero'],'referencia'=>$r['referencia']]);
   }
   $numero=(int)$r['numero'];
  }else{
   $ins=$pdo->prepare("INSERT INTO nfe_reservas(ambiente,serie,numero,referencia,expira_em) VALUES(?,?,?,?,DATE_ADD(NOW(),INTERVAL 15 MINUTE))");
   $ins->execute([$amb,$serie,$numero,$ref]);
  }
  $pdo->commit();
  responder(200,['ok'=>true,'numero'=>$numero,'serie'=>$serie,'ambiente'=>$amb,'reservada'=>true,'referencia'=>$ref,'numeracao'=>$lista]);
 }catch(Throwable $e){
  if($pdo->inTransaction())$pdo->rollBack();
  error_log('[NUMERACAO NFE RESERVA] '.$e->getMessage());
  responder(500,['ok'=>false,'error'=>'Não foi possível reservar a numeração da NF-e.']);
 }
}

$lista=lerNumeracao($pdo);
if($acao==='confirmar_autorizada'){
 $amb=strtoupper((string)($body['ambiente']??'PRODUCAO'));
 $numero=max(0,(int)($body['numero']??0));
 $serie=preg_replace('/\D+/','',(string)($body['serie']??'1'))?:'1';
 try{
  $pdo->beginTransaction();
  $lista=lerNumeracao($pdo,true);
  foreach($lista as &$item){
   if($item['documento']==='NF-e'&&$item['ambiente']===$amb&&(string)$item['serie']===$serie){
    $item['ultimo']=max((int)$item['ultimo'],$numero);$item['ativa']=true;
   }
  } unset($item);
  $lista=salvarNumeracao($pdo,$lista);
  $pdo->prepare("DELETE FROM nfe_reservas WHERE ambiente=? AND serie=? AND numero=?")->execute([$amb,$serie,$numero]);
  $pdo->commit();
  responder(200,['ok'=>true,'numeracao'=>$lista]);
 }catch(Throwable $e){
  if($pdo->inTransaction())$pdo->rollBack();
  responder(500,['ok'=>false,'error'=>'Não foi possível confirmar a numeração autorizada.']);
 }
}
if($acao==='liberar_reserva'){
 $amb=strtoupper((string)($body['ambiente']??'PRODUCAO'));
 $serie=preg_replace('/\D+/','',(string)($body['serie']??'1'))?:'1';
 $ref=referenciaFiscal($body);
 $pdo->prepare("DELETE FROM nfe_reservas WHERE ambiente=? AND serie=? AND referencia=?")->execute([$amb,$serie,$ref]);
 responder(200,['ok'=>true]);
}

$recebida=$body['numeracao']??null;
if(!is_array($recebida))responder(422,['ok'=>false,'error'=>'Numeração fiscal inválida.']);
responder(200,['ok'=>true,'numeracao'=>salvarNumeracao($pdo,$recebida)]);
