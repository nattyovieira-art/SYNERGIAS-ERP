<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
exigirAutenticacao();
$termo = trim((string)($_GET['termo'] ?? ''));
if (mb_strlen($termo) < 2) responder(200, []);
$digitos = preg_replace('/\D+/', '', $termo) ?: '';
$url = strlen($digitos) === 8 && preg_match('/^\d{8}$/', $termo)
    ? 'https://brasilapi.com.br/api/ncm/v1/' . rawurlencode($digitos)
    : 'https://brasilapi.com.br/api/ncm/v1?search=' . rawurlencode($termo);
$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_HTTPHEADER=>['Accept: application/json'],CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2]);
$body = curl_exec($ch); $status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE); $erro=curl_error($ch); curl_close($ch);
if ($body === false || $status < 200 || $status >= 300) responder(502,['ok'=>false,'error'=>'Não foi possível consultar a tabela NCM.','details'=>$erro ?: ('HTTP '.$status)]);
$json=json_decode((string)$body,true); if(!is_array($json)) responder(502,['ok'=>false,'error'=>'Resposta inválida da tabela NCM.']);
$lista=array_is_list($json)?$json:[$json]; $saida=[];
foreach($lista as $item){ if(!is_array($item)) continue; $codigo=preg_replace('/\D+/','',(string)($item['codigo']??$item['ncm']??''))?:''; $descricao=trim((string)($item['descricao']??$item['nome']??'')); if(strlen($codigo)===8 && $descricao!=='') $saida[]=['codigo'=>$codigo,'descricao'=>$descricao]; }
responder(200,array_slice($saida,0,20));
