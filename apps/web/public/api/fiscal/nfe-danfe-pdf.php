<?php
/* SYNERGIAS_CONSOLIDADO_V178 */
/* SYNERGIAS_DANFE_EMAIL_LAYOUT_V231D */
declare(strict_types=1);
const SYNERGIAS_DANFE_PDF_VERSION = 'V231D';

define('SYNERGIAS_AUTH_BOOTSTRAP', true);
require dirname(__DIR__) . '/bootstrap.php';
// Permite chamada interna autenticada por token assinado ou sessão normal.
$token = (string)($_GET['token'] ?? '');
$chave = preg_replace('/\D+/', '', (string)($_GET['chave'] ?? '')) ?: '';
if (!preg_match('/^\d{44}$/', $chave)) { http_response_code(400); exit('Chave inválida.'); }
$segredo = (string)(getenv('SYNERGIAS_DANFE_TOKEN') ?: '');
$tokenValido = $segredo !== '' && hash_equals(hash_hmac('sha256', $chave, $segredo), $token);

/*
 * V231D: chamada interna assinada pelo endpoint de envio de e-mail.
 * Evita depender de cookie/sessão em uma requisição HTTP feita pelo próprio servidor.
 */
$internal = (string)($_GET['internal'] ?? '');
$internalEsperado = hash_hmac('sha256', $chave, 'synergias-danfe-internal-v231d-7f2c91');
$internalValido = $internal !== '' && hash_equals($internalEsperado, $internal);

if (!$tokenValido && !$internalValido) exigirAutenticacao();

$home = rtrim((string)(getenv('HOME') ?: ''), '/\\');
if ($home === '' || !is_dir($home)) $home = dirname(rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\'));
$arquivoXml = $home . '/synergias_private/fiscal-nfe/' . $chave . '-procNFe.xml';
if (!is_file($arquivoXml)) { http_response_code(404); exit('XML autorizado não encontrado.'); }

$doc = new DOMDocument('1.0','UTF-8');
if (!@$doc->load($arquivoXml, LIBXML_NONET|LIBXML_NOBLANKS)) { http_response_code(500); exit('XML inválido.'); }
$xp = new DOMXPath($doc);
$q = static function(string $expr, ?DOMNode $ctx=null) use ($xp): string { $n=$xp->query($expr,$ctx); return $n&&$n->length?trim((string)$n->item(0)?->textContent):''; };
$money = static fn(string|float|int $v): string => number_format((float)str_replace(',','.',(string)$v),2,',','.');
$num = static fn(string|float|int $v,int $d=3): string => number_format((float)str_replace(',','.',(string)$v),$d,',','.');
$dateBr = static function(string $v): string { if($v==='')return ''; try{return (new DateTimeImmutable($v))->format('d/m/Y');}catch(Throwable){return $v;} };
$docFmt = static function(string $v): string { $d=preg_replace('/\D+/','',$v)?:''; if(strlen($d)===14)return substr($d,0,2).'.'.substr($d,2,3).'.'.substr($d,5,3).'/'.substr($d,8,4).'-'.substr($d,12,2); if(strlen($d)===11)return substr($d,0,3).'.'.substr($d,3,3).'.'.substr($d,6,3).'-'.substr($d,9,2); return $v; };
$cepFmt = static function(string $v): string { $d=preg_replace('/\D+/','',$v)?:''; return strlen($d)===8?substr($d,0,5).'-'.substr($d,5,3):$v; };

$inf=$xp->query('//*[local-name()="infNFe"]')->item(0); $emit=$xp->query('//*[local-name()="emit"]')->item(0); $dest=$xp->query('//*[local-name()="dest"]')->item(0); $ee=$xp->query('//*[local-name()="enderEmit"]')->item(0); $ed=$xp->query('//*[local-name()="enderDest"]')->item(0); $tot=$xp->query('//*[local-name()="ICMSTot"]')->item(0); $prot=$xp->query('//*[local-name()="protNFe"]')->item(0);
$nNF=$q('.//*[local-name()="nNF"]',$inf); $serie=$q('.//*[local-name()="serie"]',$inf); $dhEmi=$q('.//*[local-name()="dhEmi"]',$inf); $natOp=$q('.//*[local-name()="natOp"]',$inf); $tpNF=$q('.//*[local-name()="tpNF"]',$inf); $tpAmb=$q('.//*[local-name()="tpAmb"]',$inf);
$emitNome=$q('.//*[local-name()="xNome"]',$emit); $emitFant=$q('.//*[local-name()="xFant"]',$emit); $emitCnpj=$docFmt($q('.//*[local-name()="CNPJ"]',$emit)); $emitIE=$q('.//*[local-name()="IE"]',$emit); $emitFone='51.98264.2434';
$emitEnd=trim(implode(', ',array_filter([$q('.//*[local-name()="xLgr"]',$ee),$q('.//*[local-name()="nro"]',$ee),$q('.//*[local-name()="xCpl"]',$ee)]))); $emitCid=trim(implode(' - ',array_filter([$q('.//*[local-name()="xBairro"]',$ee),$q('.//*[local-name()="xMun"]',$ee),$q('.//*[local-name()="UF"]',$ee),$cepFmt($q('.//*[local-name()="CEP"]',$ee))])));
$destNome=$q('.//*[local-name()="xNome"]',$dest); $destDoc=$docFmt($q('.//*[local-name()="CNPJ"]',$dest)?:$q('.//*[local-name()="CPF"]',$dest)); $destEnd=trim(implode(', ',array_filter([$q('.//*[local-name()="xLgr"]',$ed),$q('.//*[local-name()="nro"]',$ed),$q('.//*[local-name()="xCpl"]',$ed)]))); $destBairro=$q('.//*[local-name()="xBairro"]',$ed); $destMun=$q('.//*[local-name()="xMun"]',$ed); $destUF=$q('.//*[local-name()="UF"]',$ed); $destCep=$cepFmt($q('.//*[local-name()="CEP"]',$ed)); $destFone=$q('.//*[local-name()="fone"]',$ed);
$protocolo=$q('.//*[local-name()="nProt"]',$prot); $dhRec=$q('.//*[local-name()="dhRecbto"]',$prot); $infCpl=$q('//*[local-name()="infAdic"]/*[local-name()="infCpl"]');

$duplicatas=[]; foreach($xp->query('//*[local-name()="dup"]')?:[] as $dup){$duplicatas[]=['n'=>$q('.//*[local-name()="nDup"]',$dup),'v'=>$dateBr($q('.//*[local-name()="dVenc"]',$dup)),'valor'=>$money($q('.//*[local-name()="vDup"]',$dup))];}
if(!$duplicatas && preg_match('/Pedido\s*:\s*(\d+)/i',$infCpl,$m)){
  try{$pdo=obterPdo();$st=$pdo->prepare('SELECT payload FROM erp_storage WHERE collection=:c LIMIT 1');$st->execute(['c'=>'vendas']);$r=$st->fetch();$vs=$r?json_decode((string)$r['payload'],true):[];foreach(is_array($vs)?$vs:[] as $v){$np=preg_replace('/\D+/','',(string)($v['numeroPedido']??$v['numero']??''));if($np!==$m[1])continue;foreach((array)($v['parcelas']??[]) as $i=>$p){$val=(float)($p['valor']??0);$ven=(string)($p['vencimento']??$p['dataVencimento']??'');if($val>0&&$ven!=='')$duplicatas[]=['n'=>str_pad((string)($p['numero']??$i+1),3,'0',STR_PAD_LEFT),'v'=>$dateBr($ven),'valor'=>$money($val)];}break;}}catch(Throwable){}
}

final class PdfLite {
  private array $pages=[]; private string $content=''; private float $x=10,$y=10; private int $font=8;
  function __construct(){ $this->addPage(); }
  function addPage():void{ if($this->content!=='')$this->pages[]=$this->content; $this->content='';$this->x=8;$this->y=8; }
  function pageNo():int{return count($this->pages)+1;} function y():float{return $this->y;} function setY(float $y):void{$this->y=$y;} function setFont(int $s):void{$this->font=$s;}
  private function enc(string $s):string{$s=iconv('UTF-8','Windows-1252//TRANSLIT',$s)?:$s;return str_replace(['\\','(',')'],['\\\\','\\(','\\)'],$s);} private function mm(float $v):float{return $v*72/25.4;}
  function text(float $x,float $y,string $s,int $size=8,string $align='L',float $w=0):void{ if($align!=='L'&&$w>0){$est=strlen(iconv('UTF-8','ASCII//TRANSLIT',$s)?:$s)*$size*.48*25.4/72;$x+=$align==='C'?($w-$est)/2:($w-$est);} $this->content.="BT /F1 {$size} Tf ".$this->mm($x).' '.(841.89-$this->mm($y))." Td (".$this->enc($s).") Tj ET\n"; }
  function line(float $x1,float $y1,float $x2,float $y2,float $lw=.2):void{$this->content.=$this->mm($lw)." w ".$this->mm($x1).' '.(841.89-$this->mm($y1)).' m '.$this->mm($x2).' '.(841.89-$this->mm($y2))." l S\n";}
  function rect(float $x,float $y,float $w,float $h,float $lw=.2):void{$this->content.=$this->mm($lw)." w ".$this->mm($x).' '.(841.89-$this->mm($y+$h)).' '.$this->mm($w).' '.$this->mm($h)." re S\n";}
  function cell(float $x,float $y,float $w,float $h,string $label,string $value='',int $vs=8,string $align='L'):void{
    $this->rect($x,$y,$w,$h);
    $labelY=$h<8?$y+1.9:$y+2.7;
    $labelSize=$h<8?4:5;
    $this->text($x+1,$labelY,strtoupper($label),$labelSize);
    if($value!==''){
      $valueY=$h<8?$y+$h-1.1:$y+6.8;
      $valueSize=$h<8?min($vs,6):$vs;
      $this->text($x+1,$valueY,$value,$valueSize,$align,$w-2);
    }
  }
  function wrap(string $s,float $w,int $size):array{$max=max(5,(int)floor($w*72/25.4/($size*.5)));$words=preg_split('/\s+/u',trim($s))?:[];$lines=[];$cur='';foreach($words as $word){$test=$cur===''?$word:$cur.' '.$word;if(strlen(iconv('UTF-8','ASCII//TRANSLIT',$test)?:$test)>$max&&$cur!==''){$lines[]=$cur;$cur=$word;}else{$cur=$test;}}if($cur!=='')$lines[]=$cur;return $lines?:[''];}
  function output(string $filename):void{if($this->content!=='')$this->pages[]=$this->content;$objs=[];$objs[1]='<< /Type /Catalog /Pages 2 0 R >>';$kids=[];$obj=4;foreach($this->pages as $p){$pageObj=$obj++;$contObj=$obj++;$kids[]="$pageObj 0 R";$objs[$pageObj]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R >> >> /Contents $contObj 0 R >>";$objs[$contObj]="<< /Length ".strlen($p)." >>\nstream\n$p\nendstream";}$objs[2]='<< /Type /Pages /Kids ['.implode(' ',$kids).'] /Count '.count($kids).' >>';$objs[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';ksort($objs);$pdf="%PDF-1.4\n";$offs=[0];foreach($objs as $i=>$o){$offs[$i]=strlen($pdf);$pdf.="$i 0 obj\n$o\nendobj\n";}$xref=strlen($pdf);$max=max(array_keys($objs));$pdf.="xref\n0 ".($max+1)."\n0000000000 65535 f \n";for($i=1;$i<=$max;$i++)$pdf.=sprintf('%010d 00000 n ', $offs[$i]??0)."\n";$pdf.="trailer << /Size ".($max+1)." /Root 1 0 R >>\nstartxref\n$xref\n%%EOF";header('Content-Type: application/pdf');header('Content-Disposition: inline; filename="'.preg_replace('/[^0-9A-Za-z._-]/','_',$filename).'"');header('Content-Length: '.strlen($pdf));echo $pdf;}
}

$pdf=new PdfLite();

$drawHeader=function(bool $compact=false) use($pdf,$emitNome,$emitEnd,$emitCid,$emitFone,$nNF,$serie,$chave,$natOp,$protocolo,$dhRec,$emitIE,$emitCnpj,$tpNF,$tpAmb){
  if($compact){
    $pdf->cell(8,8,194,10,'NF-e - Continuação','Nº '.$nNF.'   Série '.$serie,10,'C');
    $pdf->cell(8,18,62,24,'Emitente','',8);
    $emitLines=$pdf->wrap($emitNome,58,8);
    foreach(array_slice($emitLines,0,2) as $i=>$ln)$pdf->text(9.5,25.5+$i*3.7,$ln,8);
    $pdf->text(9.5,33.5,$emitEnd,7);
    $pdf->text(9.5,37.2,$emitCid,7);
    $pdf->text(9.5,40.5,'Fone: '.$emitFone,7);
    $pdf->cell(70,18,48,24,'DANFE','DOCUMENTO AUXILIAR',8,'C');
    $pdf->text(71,30,'DA NOTA FISCAL ELETRÔNICA',7,'C',46);
    $pdf->text(71,36,'Nº '.$nNF.'   SÉRIE '.$serie,9,'C',46);
    $pdf->cell(118,18,84,24,'Chave de acesso',$chave,8,'C');
    $pdf->text(120,34,'www.nfe.fazenda.gov.br/portal',6,'C',80);
    $pdf->cell(8,42,100,10,'Natureza da operação',$natOp,8);
    $pdf->cell(108,42,94,10,'Protocolo de autorização',$protocolo.' - '.$dhRec,7);
    return 54.0;
  }

  $pdf->cell(8,8,160,13,'Recebemos de '.$emitNome,'');
  $pdf->cell(168,8,34,13,'NF-e','Nº '.$nNF.'  Série '.$serie,10,'C');

  $pdf->cell(8,22,55,31,'Emitente','',8);
  $emitLines=$pdf->wrap($emitNome,51,9);
  foreach(array_slice($emitLines,0,2) as $i=>$ln)$pdf->text(9.5,29.5+$i*4.2,$ln,9);
  $pdf->text(9.5,38.5,$emitEnd,7);
  $pdf->text(9.5,44,$emitCid,7);
  $pdf->text(9.5,49,'Fone: '.$emitFone,7);

  $pdf->cell(63,22,47,31,'DANFE','DOCUMENTO AUXILIAR',8,'C');
  $pdf->text(64,34,'DA NOTA FISCAL ELETRÔNICA',7,'C',45);
  $pdf->text(64,40,'0 - ENTRADA   1 - SAÍDA   '.$tpNF,7,'C',45);
  $pdf->text(64,47,'Nº '.$nNF.'   SÉRIE '.$serie,9,'C',45);

  $pdf->cell(110,22,92,31,'Chave de acesso',$chave,8,'C');
  $pdf->text(112,40,'Consulta de autenticidade no portal nacional da NF-e',6,'C',88);
  $pdf->text(112,46,'www.nfe.fazenda.gov.br/portal',6,'C',88);

  $pdf->cell(8,54,105,11,'Natureza da operação',$natOp,9);
  $pdf->cell(113,54,89,11,'Protocolo de autorização',$protocolo.' - '.$dhRec,7);
  $pdf->cell(8,65,65,10,'Inscrição Estadual',$emitIE,8);
  $pdf->cell(73,65,64,10,'CNPJ',$emitCnpj,8);
  $pdf->cell(137,65,65,10,'Ambiente',$tpAmb==='1'?'PRODUÇÃO':'HOMOLOGAÇÃO',9);
  return 77.0;
};

$y=$drawHeader(false);
$pdf->text(8,$y,'DESTINATÁRIO / REMETENTE',8);$y+=2.5;
$pdf->cell(8,$y,120,12,'Nome / Razão Social',$destNome,10);$pdf->cell(128,$y,45,12,'CNPJ / CPF',$destDoc,9);$pdf->cell(173,$y,29,12,'Data emissão',$dateBr($dhEmi),8);$y+=12;
$pdf->cell(8,$y,88,12,'Endereço',$destEnd,9);$pdf->cell(96,$y,42,12,'Bairro',$destBairro,9);$pdf->cell(138,$y,35,12,'CEP',$destCep,9);$pdf->cell(173,$y,29,12,'Data saída',$dateBr($dhEmi),8);$y+=12;
$pdf->cell(8,$y,80,12,'Município',$destMun,9);$pdf->cell(88,$y,35,12,'Fone',$destFone,9);$pdf->cell(123,$y,15,12,'UF',$destUF,9);$pdf->cell(138,$y,35,12,'IE',$q('.//*[local-name()="IE"]',$dest),8);$pdf->cell(173,$y,29,12,'Hora','',8);$y+=15;

$pdf->text(8,$y,'FATURA',8);$y+=2.5;
if($duplicatas){
  $w=194/max(1,count($duplicatas));
  foreach($duplicatas as $i=>$d){
    $x=8+$i*$w;
    $pdf->rect($x,$y,$w,15);
    $c1=$w*0.24; $c2=$w*0.38; $c3=$w-$c1-$c2;
    $pdf->line($x+$c1,$y,$x+$c1,$y+15);
    $pdf->line($x+$c1+$c2,$y,$x+$c1+$c2,$y+15);
    $pdf->text($x+1.2,$y+3.2,'PARCELA',5);
    $pdf->text($x+$c1+1.2,$y+3.2,'VENCIMENTO',5);
    $pdf->text($x+$c1+$c2+1.2,$y+3.2,'VALOR',5);
    $pdf->text($x+1.2,$y+9.6,$d['n'],9,'C',$c1-2.4);
    $pdf->text($x+$c1+1.2,$y+9.6,$d['v'],9,'C',$c2-2.4);
    $pdf->text($x+$c1+$c2+1.2,$y+9.6,'R$ '.$d['valor'],9,'C',$c3-2.4);
  }
}else{
  $pdf->cell(8,$y,194,15,'Fatura','Pagamento conforme pedido',9);
}
$y+=18;

$pdf->text(8,$y,'CÁLCULO DO IMPOSTO',8);$y+=2.5;
$taxes=[['BC ICMS','vBC'],['VALOR ICMS','vICMS'],['BC ICMS ST','vBCST'],['VALOR ICMS ST','vST'],['FCP','vFCP'],['PIS','vPIS'],['TOTAL PRODUTOS','vProd'],['FRETE','vFrete'],['SEGURO','vSeg'],['DESCONTO','vDesc'],['IPI','vIPI'],['COFINS','vCOFINS'],['TOTAL NOTA','vNF']];
$tw=194/7;
$taxRowH=8.5;
foreach($taxes as $i=>$t){$row=intdiv($i,7);$col=$i%7;$pdf->cell(8+$col*$tw,$y+$row*$taxRowH,$tw,$taxRowH,$t[0],$money($q('.//*[local-name()="'.$t[1].'"]',$tot)),8,'R');}
$y+=19.5;

$cols=[13,76,18,12,12,10,13,16,16,8];
$heads=['CÓD. BARRAS','DESCRIÇÃO DO PRODUTO / SERVIÇO','NCM','CST','CFOP','UN','QTD','VLR UNIT','VLR TOTAL','ICMS'];
$drawItemsHeader=function(float $yy,string $title='DADOS DO PRODUTO / SERVIÇO') use($pdf,$cols,$heads){
  $pdf->text(8,$yy,$title,8);$yy+=4.2;$x=8;
  foreach($heads as $i=>$h){$pdf->cell($x,$yy,$cols[$i],9,$h,'',4,'C');$x+=$cols[$i];}
  return $yy+9;
};
$y=$drawItemsHeader($y);

foreach($xp->query('//*[local-name()="det"]')?:[] as $det){
  $prod=$xp->query('.//*[local-name()="prod"]',$det)->item(0);
  $imp=$xp->query('.//*[local-name()="imposto"]',$det)->item(0);
  $desc=$q('.//*[local-name()="xProd"]',$prod);
  $codigoBarras=$q('.//*[local-name()="cEAN"]',$prod);
  if($codigoBarras==='' || strtoupper($codigoBarras)==='SEM GTIN') $codigoBarras=$q('.//*[local-name()="cEANTrib"]',$prod);
  if($codigoBarras==='' || strtoupper($codigoBarras)==='SEM GTIN') $codigoBarras='-';
  $lines=$pdf->wrap($desc,68,6);
  $h=max(8.5,count($lines)*3.4+2.4);
  if($y+$h>274){
    $pdf->addPage();
    $y=$drawHeader(true);
    $y=$drawItemsHeader($y,'DADOS DO PRODUTO / SERVIÇO - CONTINUAÇÃO');
  }
  $vals=[
    $codigoBarras,'',$q('.//*[local-name()="NCM"]',$prod),
    $q('.//*[local-name()="CSOSN"]',$imp)?:$q('.//*[local-name()="CST"]',$imp),
    $q('.//*[local-name()="CFOP"]',$prod),strtoupper(substr($q('.//*[local-name()="uCom"]',$prod),0,3)),
    $num($q('.//*[local-name()="qCom"]',$prod),3),$money($q('.//*[local-name()="vUnCom"]',$prod)),
    $money($q('.//*[local-name()="vProd"]',$prod)),$money($q('.//*[local-name()="vICMS"]',$imp))
  ];
  $x=8;
  foreach($cols as $i=>$cw){$pdf->rect($x,$y,$cw,$h);if($i!==1)$pdf->text($x+.8,$y+5.2,$vals[$i],$i===0?4:5,$i>=6?'R':'L',$cw-1.6);$x+=$cw;}
  foreach($lines as $li=>$ln){$pdf->text(21.8,$y+4.5+$li*3.4,$ln,6);}
  $y+=$h;
}

if($y>244){$pdf->addPage();$y=$drawHeader(true);}
$y+=3;
$pdf->text(8,$y,'DADOS ADICIONAIS',8);$y+=2.5;
$pdf->cell(8,$y,130,30,'Informações complementares','',7);
foreach($pdf->wrap($infCpl,126,7) as $i=>$ln){if($i>6)break;$pdf->text(9.5,$y+7+$i*3.8,$ln,7);}
$pdf->cell(138,$y,64,30,'Reservado ao Fisco','',7);
$pdf->output('DANFE_NFe_'.$nNF.'.pdf');
