<?php
declare(strict_types=1);
define('SYNERGIAS_AUTH_BOOTSTRAP', true);
require dirname(__DIR__) . '/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
const NFE_HOMOLOG_VERSION='V130-PRODUCAO';
const NFE_NS='http://www.portalfiscal.inf.br/nfe';
const DS_NS='http://www.w3.org/2000/09/xmldsig#';
const AUT_URL='https://nfe.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx';
function out(int $s,array $p):never{http_response_code($s);echo json_encode($p,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function txt(mixed $v):string{return trim((string)($v??''));}
function digs(mixed $v):string{return preg_replace('/\D+/','',txt($v))?:'';}
function homeDir():string{$h=rtrim((string)(getenv('HOME')?:''),'/\\');if($h!==''&&is_dir($h)&&is_writable($h))return $h;$d=rtrim((string)($_SERVER['DOCUMENT_ROOT']??''),'/\\');if($d!==''){$p=dirname($d);if(is_dir($p)&&is_writable($p))return $p;}throw new RuntimeException('Diretório privado indisponível.');}
function paths():array{$h=homeDir();return ['secret'=>$h.'/.synergias-secrets/fiscal-a1.key','data'=>$h.'/synergias_private/fiscal-a1/certificado.a1.enc.json','dir'=>$h.'/synergias_private/fiscal-nfe','ca'=>__DIR__.'/cacert.pem'];}
function materialA1():array{$p=paths();if(!is_file($p['secret'])||!is_file($p['data']))throw new RuntimeException('Certificado A1 não instalado.');$k=base64_decode(trim((string)file_get_contents($p['secret'])),true);$e=json_decode((string)file_get_contents($p['data']),true);if(!is_string($k)||strlen($k)!==32||!is_array($e))throw new RuntimeException('Armazenamento A1 inválido.');$iv=base64_decode((string)($e['iv']??''),true);$tag=base64_decode((string)($e['tag']??''),true);$data=base64_decode((string)($e['data']??''),true);$aad=base64_decode((string)($e['aad']??''),true);$plain=openssl_decrypt($data,'aes-256-gcm',$k,OPENSSL_RAW_DATA,$iv,$tag,$aad);$m=is_string($plain)?json_decode($plain,true):null;if(!is_array($m))throw new RuntimeException('Não foi possível abrir o A1.');$cert=(string)($m['certificatePem']??'');$key=(string)($m['privateKeyPem']??'');if($cert===''||$key===''||!openssl_x509_check_private_key($cert,$key))throw new RuntimeException('Certificado e chave não correspondem.');return ['cert'=>$cert,'key'=>$key,'extras'=>(array)($m['extraCertificates']??[]),'meta'=>(array)($e['metadata']??[])];}
function certB64(string $pem):string{$clean=preg_replace('/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/','',$pem)?:'';return $clean;}
function addEl(DOMDocument $d,DOMNode $p,string $n,string $v,?string $ns=null):DOMElement{$e=$ns?$d->createElementNS($ns,$n):$d->createElement($n);$e->appendChild($d->createTextNode($v));$p->appendChild($e);return $e;}
function assinar(string $xml,array $m):array{$d=new DOMDocument('1.0','UTF-8');$d->preserveWhiteSpace=false;$d->formatOutput=false;if(!@$d->loadXML($xml,LIBXML_NOBLANKS|LIBXML_NONET))throw new RuntimeException('XML da NF-e inválido.');$xp=new DOMXPath($d);$inf=$xp->query('//*[local-name()="infNFe"]')->item(0);$nfe=$xp->query('//*[local-name()="NFe"]')->item(0);if(!$inf instanceof DOMElement||!$nfe instanceof DOMElement)throw new RuntimeException('infNFe não encontrado.');$id=$inf->getAttribute('Id');if(!preg_match('/^NFe\d{44}$/',$id))throw new RuntimeException('Id da NF-e inválido.');foreach(iterator_to_array($xp->query('//*[local-name()="Signature"]')) as $old)$old->parentNode?->removeChild($old);
$digest=base64_encode(hash('sha1',$inf->C14N(false,false),true));$sig=$d->createElementNS(DS_NS,'Signature');$si=$d->createElementNS(DS_NS,'SignedInfo');$sig->appendChild($si);$cm=$d->createElementNS(DS_NS,'CanonicalizationMethod');$cm->setAttribute('Algorithm','http://www.w3.org/TR/2001/REC-xml-c14n-20010315');$si->appendChild($cm);$sm=$d->createElementNS(DS_NS,'SignatureMethod');$sm->setAttribute('Algorithm','http://www.w3.org/2000/09/xmldsig#rsa-sha1');$si->appendChild($sm);$ref=$d->createElementNS(DS_NS,'Reference');$ref->setAttribute('URI','#'.$id);$si->appendChild($ref);$trs=$d->createElementNS(DS_NS,'Transforms');$ref->appendChild($trs);$t1=$d->createElementNS(DS_NS,'Transform');$t1->setAttribute('Algorithm','http://www.w3.org/2000/09/xmldsig#enveloped-signature');$trs->appendChild($t1);$t2=$d->createElementNS(DS_NS,'Transform');$t2->setAttribute('Algorithm','http://www.w3.org/TR/2001/REC-xml-c14n-20010315');$trs->appendChild($t2);$dm=$d->createElementNS(DS_NS,'DigestMethod');$dm->setAttribute('Algorithm','http://www.w3.org/2000/09/xmldsig#sha1');$ref->appendChild($dm);addEl($d,$ref,'DigestValue',$digest,DS_NS);$nfe->appendChild($sig);$signed=$si->C14N(false,false);$signature='';if(!openssl_sign($signed,$signature,$m['key'],OPENSSL_ALGO_SHA1))throw new RuntimeException('Falha ao assinar o XML.');addEl($d,$sig,'SignatureValue',base64_encode($signature),DS_NS);$ki=$d->createElementNS(DS_NS,'KeyInfo');$sig->appendChild($ki);$xd=$d->createElementNS(DS_NS,'X509Data');$ki->appendChild($xd);addEl($d,$xd,'X509Certificate',certB64($m['cert']),DS_NS);$pub=openssl_pkey_get_public($m['cert']);$ok=$pub?openssl_verify($si->C14N(false,false),$signature,$pub,OPENSSL_ALGO_SHA1):-1;if($ok!==1)throw new RuntimeException('A assinatura gerada não passou na verificação local.');return ['xml'=>$d->saveXML(),'chave'=>substr($id,3)];}
function tempPem(string $name,string $content):string{$p=paths();if(!is_dir($p['dir'])&&!mkdir($p['dir'],0700,true)&&!is_dir($p['dir']))throw new RuntimeException('Falha ao preparar diretório fiscal.');$f=$p['dir'].'/.'.$name.'-'.bin2hex(random_bytes(8)).'.pem';file_put_contents($f,$content,LOCK_EX);@chmod($f,0600);return $f;}
function soap(string $xmlAssinado): string {
    // A SEFAZ rejeita CR/LF, tabulaÃ§Ãµes e espaÃ§os de ediÃ§Ã£o entre as tags do lote.
    $nfe = preg_replace('/^\xEF\xBB\xBF/', '', $xmlAssinado) ?? $xmlAssinado;
    $nfe = preg_replace('/<\?xml[^>]*\?>/i', '', $nfe) ?? $nfe;
    $nfe = trim($nfe);
    $nfe = preg_replace('/>\s+</u', '><', $nfe) ?? $nfe;

    $idLote = date('YmdHis');
    $env = '<enviNFe xmlns="'.NFE_NS.'" versao="4.00">'
         . '<idLote>'.$idLote.'</idLote>'
         . '<indSinc>1</indSinc>'
         . $nfe
         . '</enviNFe>';

    $env = preg_replace('/>\s+</u', '><', trim($env)) ?? trim($env);

    return '<?xml version="1.0" encoding="UTF-8"?>'
         . '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">'
         . '<soap12:Header>'
         . '<nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">'
         . '<cUF>43</cUF><versaoDados>4.00</versaoDados>'
         . '</nfeCabecMsg>'
         . '</soap12:Header>'
         . '<soap12:Body>'
         . '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">'
         . $env
         . '</nfeDadosMsg>'
         . '</soap12:Body>'
         . '</soap12:Envelope>';
}
function transmitir(string $xml,array $m):string{$cert=$m['cert'];foreach($m['extras'] as $x)if(is_string($x)&&trim($x)!=='')$cert.="\n".trim($x)."\n";$cf=tempPem('cert',$cert);$kf=tempPem('key',$m['key']);
try{$ch=curl_init(AUT_URL);$opts=[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>soap($xml),CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>90,CURLOPT_CONNECTTIMEOUT=>25,CURLOPT_SSLCERT=>$cf,CURLOPT_SSLKEY=>$kf,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_HTTPHEADER=>['Content-Type: application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"']];$p=paths();if(is_file($p['ca']))$opts[CURLOPT_CAINFO]=$p['ca'];curl_setopt_array($ch,$opts);$r=curl_exec($ch);$err=curl_error($ch);$no=curl_errno($ch);$http=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);if($no!==0||!is_string($r)||$r==='')throw new RuntimeException('Falha na transmissão SEFAZ: '.$err.' (cURL '.$no.', HTTP '.$http.').');return $r;}finally{@unlink($cf);@unlink($kf);}}
function parseRet(string $soap,string $xmlAssinado,string $chave):array{$d=new DOMDocument();if(!@$d->loadXML($soap,LIBXML_NONET))throw new RuntimeException('Resposta SOAP inválida.');$x=new DOMXPath($d);$val=function(string $n)use($x):string{$q=$x->query('//*[local-name()="'.$n.'"]');return $q&&$q->length?trim((string)$q->item($q->length-1)?->textContent):'';};$c=$val('cStat');$mot=$val('xMotivo');$prot=$val('nProt');$dh=$val('dhRecbto');$aut=in_array($c,['100','150'],true);$proc='';if($aut){$ret=$x->query('//*[local-name()="protNFe"]')->item(0);if(!$ret instanceof DOMElement)throw new RuntimeException('Protocolo não encontrado na autorização.');$n=new DOMDocument('1.0','UTF-8');$p=$n->createElementNS(NFE_NS,'nfeProc');$p->setAttribute('versao','4.00');$n->appendChild($p);$nd=new DOMDocument();$nd->loadXML($xmlAssinado);$p->appendChild($n->importNode($nd->documentElement,true));$p->appendChild($n->importNode($ret,true));$proc=$n->saveXML();$pp=paths();if(!is_dir($pp['dir']))mkdir($pp['dir'],0700,true);file_put_contents($pp['dir'].'/'.$chave.'-procNFe.xml',$proc,LOCK_EX);}
return ['autorizada'=>$aut,'cStat'=>$c,'motivo'=>$mot,'protocolo'=>$prot,'recebidoEm'=>$dh,'xmlProcessado'=>$proc];}
try{if(strtoupper(txt($_SERVER['REQUEST_METHOD']??''))!=='POST')out(405,['ok'=>false,'mensagem'=>'Método não permitido.']);$u=exigirAutenticacao();if(strcasecmp(txt($u['perfil']??''),'Administrador')!==0)out(403,['ok'=>false,'mensagem'=>'Apenas Administrador.']);if(!extension_loaded('openssl')||!extension_loaded('curl')||!class_exists('DOMDocument'))throw new RuntimeException('Extensões fiscais indisponíveis.');$b=json_decode((string)file_get_contents('php://input'),true);$xml64=txt($b['xmlBase64']??'');$xml=base64_decode($xml64,true);if(!is_string($xml)||$xml==='')throw new RuntimeException('XML Base64 ausente ou inválido.');
$xmlProducao=$xml;
$docPagamentoV75=new DOMDocument('1.0','UTF-8');
$docPagamentoV75->preserveWhiteSpace=false;
$docPagamentoV75->formatOutput=false;
if(!@$docPagamentoV75->loadXML($xml,LIBXML_NOBLANKS|LIBXML_NONET))throw new RuntimeException('XML invÃ¡lido ao preparar o pagamento.');
$xpathPagamentoV75=new DOMXPath($docPagamentoV75);
$detalhesPagamentoV75=$xpathPagamentoV75->query('//*[local-name()="detPag"]');
if($detalhesPagamentoV75!==false){
    foreach($detalhesPagamentoV75 as $detPagV75){
        if(!$detPagV75 instanceof DOMElement)continue;
        $tPagV75=$xpathPagamentoV75->query('./*[local-name()="tPag"]',$detPagV75)->item(0);
        $xPagV75=$xpathPagamentoV75->query('./*[local-name()="xPag"]',$detPagV75)->item(0);
        if(trim((string)($tPagV75?->textContent??''))!=='99'||$xPagV75 instanceof DOMElement)continue;
        $descricaoPagamentoV75=$docPagamentoV75->createElementNS('http://www.portalfiscal.inf.br/nfe','xPag','OUTROS - CONFORME PEDIDO');
        $vPagV75=$xpathPagamentoV75->query('./*[local-name()="vPag"]',$detPagV75)->item(0);
        if($vPagV75 instanceof DOMNode){$detPagV75->insertBefore($descricaoPagamentoV75,$vPagV75);}else{$detPagV75->appendChild($descricaoPagamentoV75);}
    }
}
$xmlPagamentoV75=$docPagamentoV75->saveXML($docPagamentoV75->documentElement);
if(!is_string($xmlPagamentoV75)||$xmlPagamentoV75==='')throw new RuntimeException('Falha ao preparar a descriÃ§Ã£o do pagamento.');
$xml=$xmlPagamentoV75;$m=materialA1();$ass=assinar($xml,$m);$ret=parseRet(transmitir($ass['xml'],$m),$ass['xml'],$ass['chave']);out(200,['ok'=>true,'versao'=>NFE_HOMOLOG_VERSION,'ambiente'=>'PRODUCAO','assinado'=>true,'autorizada'=>$ret['autorizada'],'cStat'=>$ret['cStat'],'motivo'=>$ret['motivo'],'protocolo'=>$ret['protocolo'],'recebidoEm'=>$ret['recebidoEm'],'chaveAcesso'=>$ass['chave'],'xmlAssinadoBase64'=>base64_encode($ass['xml']),'xmlProcessadoBase64'=>$ret['xmlProcessado']!==''?base64_encode($ret['xmlProcessado']):'','danfeUrl'=>$ret['autorizada']?'/api/fiscal/nfe-danfe.php?chave='.$ass['chave']:'']);}catch(Throwable $e){error_log('[NFE V52] '.$e->getMessage());out(500,['ok'=>false,'mensagem'=>$e->getMessage()]);}

