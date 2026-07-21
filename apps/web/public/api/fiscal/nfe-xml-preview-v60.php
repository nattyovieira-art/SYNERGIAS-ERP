<?php
declare(strict_types=1);

define('SYNERGIAS_AUTH_BOOTSTRAP', true);
require dirname(__DIR__) . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Referrer-Policy: no-referrer');

const NFE_XML_PREVIEW_VERSION = 'V60';
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

function nfeV60Responder(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function nfeV60Texto(mixed $v): string { return trim((string)($v ?? '')); }
function nfeV60Digitos(mixed $v): string { return preg_replace('/\D+/', '', nfeV60Texto($v)) ?: ''; }
function nfeV60Numero(mixed $v): float {
    if (is_int($v) || is_float($v)) return (float)$v;
    $s = nfeV60Texto($v);
    if ($s === '') return 0.0;
    if (str_contains($s, ',') && str_contains($s, '.')) $s = str_replace(['.', ','], ['', '.'], $s);
    elseif (str_contains($s, ',')) $s = str_replace(',', '.', $s);
    return is_numeric($s) ? (float)$s : 0.0;
}
function nfeV60Moeda(float $v): string { return number_format(round($v + 0.00000001, 2), 2, '.', ''); }
function nfeV60Quantidade(float $v): string { return number_format($v, 4, '.', ''); }
function nfeV60Aliquota(float $v): string { return number_format($v, 4, '.', ''); }
function nfeV60NormalizarTexto(string $v, int $max): string {
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}
function nfeV60DvChave(string $base43): int {
    $peso = 2; $soma = 0;
    for ($i = strlen($base43) - 1; $i >= 0; $i--) {
        $soma += ((int)$base43[$i]) * $peso;
        $peso = $peso === 9 ? 2 : $peso + 1;
    }
    $resto = $soma % 11;
    $dv = 11 - $resto;
    return $dv >= 10 ? 0 : $dv;
}
function nfeV60Add(DOMDocument $doc, DOMElement $pai, string $nome, string|int|float $valor): DOMElement {
    $el = $doc->createElement($nome);
    $el->appendChild($doc->createTextNode((string)$valor));
    $pai->appendChild($el);
    return $el;
}
function nfeV60ValidarOrigem(): void {
    $origin = nfeV60Texto($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === '') return;
    $host = strtolower(nfeV60Texto($_SERVER['HTTP_HOST'] ?? ''));
    $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    if ($host === '' || $originHost === '' || !hash_equals($host, $originHost)) nfeV60Responder(403, ['ok'=>false,'mensagem'=>'Origem não autorizada.']);
}

try {
    if (strtoupper(nfeV60Texto($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') nfeV60Responder(405, ['ok'=>false,'mensagem'=>'Método não permitido.']);
    nfeV60ValidarOrigem();
    $usuario = exigirAutenticacao();
    if (strcasecmp(nfeV60Texto($usuario['perfil'] ?? ''), 'Administrador') !== 0) nfeV60Responder(403, ['ok'=>false,'mensagem'=>'Apenas Administrador pode montar o XML fiscal.']);
    if (!class_exists('DOMDocument')) nfeV60Responder(500, ['ok'=>false,'mensagem'=>'Extensão DOM do PHP indisponível no servidor.']);

    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) nfeV60Responder(400, ['ok'=>false,'mensagem'=>'Conteúdo inválido.']);
    $ambiente = strtoupper(nfeV60Texto($body['ambiente'] ?? 'HOMOLOGACAO'));
    $venda = is_array($body['venda'] ?? null) ? $body['venda'] : [];
    $fiscal = is_array($body['fiscal'] ?? null) ? $body['fiscal'] : [];
    $num = is_array($body['numeracao'] ?? null) ? $body['numeracao'] : [];
    $erros = []; $avisos = [];

    if ($ambiente !== 'HOMOLOGACAO') $erros[] = 'Somente homologação está liberada.';
    if ((strtoupper(nfeV60Texto($fiscal['regimeTributario'] ?? 'SIMPLES_NACIONAL')) ?: 'SIMPLES_NACIONAL') !== 'SIMPLES_NACIONAL') $erros[] = 'A V53 está preparada somente para o Simples Nacional.';

    $cnpj = nfeV60Digitos($fiscal['cnpj'] ?? '');
    $ie = nfeV60Digitos($fiscal['inscricaoEstadual'] ?? '');
    $cMunEmit = nfeV60Digitos($fiscal['codigoIbgeMunicipio'] ?? '');
    $cepEmit = nfeV60Digitos($fiscal['cep'] ?? '');
    if (strlen($cnpj) !== 14) $erros[] = 'CNPJ emitente inválido.';
    if ($ie === '') $erros[] = 'IE emitente ausente.';
    if (strlen($cMunEmit) !== 7) $erros[] = 'Código IBGE do emitente inválido.';
    if (strlen($cepEmit) !== 8) $erros[] = 'CEP emitente inválido.';

    $nNF = max(1, (int)($num['nfeV60Numero'] ?? 1));
    $serie = max(1, (int)($num['serie'] ?? 1));
    if ($nNF > 999999999) $erros[] = 'Número da NF-e fora do limite.';
    if ($serie > 999) $erros[] = 'Série da NF-e fora do limite.';

    $destDoc = nfeV60Digitos($venda['clienteDocumento'] ?? '');
    $cepDest = nfeV60Digitos($venda['faturamentoCep'] ?? '');
    $ufDest = strtoupper(nfeV60Texto($venda['faturamentoEstado'] ?? ''));
    $cidadeDest = mb_strtoupper(nfeV60Texto($venda['faturamentoCidade'] ?? ''), 'UTF-8');
    $cidadeEmit = mb_strtoupper(nfeV60Texto($fiscal['municipio'] ?? ''), 'UTF-8');
    $cMunDest = nfeV60Digitos($venda['faturamentoCodigoIbge'] ?? '');
    if ($cMunDest === '' && $ufDest === 'RS' && $cidadeDest !== '' && $cidadeDest === $cidadeEmit) $cMunDest = $cMunEmit;
    if (!in_array(strlen($destDoc), [11,14], true)) $erros[] = 'CPF/CNPJ do destinatário inválido.';
    if (strlen($cepDest) !== 8) $erros[] = 'CEP do destinatário inválido.';
    if (strlen($cMunDest) !== 7) $erros[] = 'Código IBGE do município do destinatário não está disponível. Nesta etapa, pedidos fora do município do emitente continuam bloqueados.';

    $itens = is_array($venda['itens'] ?? null) ? $venda['itens'] : [];
    if (!$itens) $erros[] = 'A NF-e precisa ter itens.';

    $totalProdutos = 0.0;
    foreach ($itens as $i => $item) {
        if (!is_array($item)) { $erros[] = 'Item '.($i+1).' inválido.'; continue; }
        $q = nfeV60Numero($item['nfeV60Quantidade'] ?? 0);
        $vUn = nfeV60Numero($item['valorUnitario'] ?? 0);
        $vProd = round($q * $vUn, 2);
        $totalProdutos += $vProd;
        $n = $i+1;
        if ($q <= 0) $erros[] = "Item {$n}: nfeV60Quantidade inválida.";
        if (strlen(nfeV60Digitos($item['ncm'] ?? '')) !== 8) $erros[] = "Item {$n}: NCM inválido.";
        if (nfeV60Digitos($item['cfop'] ?? '') !== ($ufDest === 'RS' ? '5102' : '6102')) $erros[] = "Item {$n}: CFOP incompatível com a UF do destinatário.";
        $origemItem = substr(nfeV60Digitos($item['origem'] ?? ''),0,1);
        if (!preg_match('/^[0-8]$/', $origemItem)) $origemItem = '0';
        $csosnItem = nfeV60Digitos($item['csosn'] ?? '102') ?: '102';
        $pisItem = nfeV60Digitos($item['cstPis'] ?? '49') ?: '49';
        $cofinsItem = nfeV60Digitos($item['cstCofins'] ?? '49') ?: '49';
        if ($origemItem !== '0') $erros[] = "Item {$n}: origem diferente de 0 exige regra fiscal específica cadastrada.";
        if ($csosnItem !== '102') $erros[] = "Item {$n}: CSOSN diferente de 102 exige regra fiscal específica cadastrada.";
        if ($pisItem !== '49') $erros[] = "Item {$n}: CST PIS diferente de 49 exige regra fiscal específica cadastrada.";
        if ($cofinsItem !== '49') $erros[] = "Item {$n}: CST COFINS diferente de 49 exige regra fiscal específica cadastrada.";
        if (nfeV60Numero($item['aliquotaIcms'] ?? 0) != 0.0 || nfeV60Numero($item['aliquotaPis'] ?? 0) != 0.0 || nfeV60Numero($item['aliquotaCofins'] ?? 0) != 0.0) $erros[] = "Item {$n}: impostos devem permanecer sem destaque.";
    }
    if ($erros) nfeV60Responder(200, ['ok'=>true,'pronto'=>false,'ambiente'=>'HOMOLOGACAO','versao'=>NFE_XML_PREVIEW_VERSION,'chaveAcesso'=>'','nfeV60Numero'=>(string)$nNF,'serie'=>(string)$serie,'xml'=>'','xmlBase64'=>'','erros'=>array_values(array_unique($erros)),'avisos'=>$avisos,'geradoEm'=>gmdate('c')]);

    $dhEmi = (new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d\TH:i:sP');
    $aamm = substr(str_replace('-','',substr($dhEmi,0,7)),2,4);
    $cUF = '43'; $mod = '55'; $tpEmis = '1';
    $cNF = str_pad((string)(abs(crc32(nfeV60Texto($venda['id'] ?? '') . '|' . $nNF . '|' . $serie)) % 100000000), 8, '0', STR_PAD_LEFT);
    $base43 = $cUF.$aamm.$cnpj.$mod.str_pad((string)$serie,3,'0',STR_PAD_LEFT).str_pad((string)$nNF,9,'0',STR_PAD_LEFT).$tpEmis.$cNF;
    $chave = $base43 . nfeV60DvChave($base43);

    $doc = new DOMDocument('1.0','UTF-8'); $doc->formatOutput = true;
    $nfe = $doc->createElementNS(NFE_NS,'NFe'); $doc->appendChild($nfe);
    $inf = $doc->createElement('infNFe'); $inf->setAttribute('Id','NFe'.$chave); $inf->setAttribute('versao','4.00'); $nfe->appendChild($inf);
    $ide = $doc->createElement('ide'); $inf->appendChild($ide);
    nfeV60Add($doc,$ide,'cUF',$cUF); nfeV60Add($doc,$ide,'cNF',$cNF); nfeV60Add($doc,$ide,'natOp','VENDA DE MERCADORIA'); nfeV60Add($doc,$ide,'mod','55'); nfeV60Add($doc,$ide,'serie',$serie); nfeV60Add($doc,$ide,'nNF',$nNF); nfeV60Add($doc,$ide,'dhEmi',$dhEmi); nfeV60Add($doc,$ide,'tpNF','1'); nfeV60Add($doc,$ide,'idDest',$ufDest==='RS'?'1':'2'); nfeV60Add($doc,$ide,'cMunFG',$cMunEmit); nfeV60Add($doc,$ide,'tpImp','1'); nfeV60Add($doc,$ide,'tpEmis',$tpEmis); nfeV60Add($doc,$ide,'cDV',substr($chave,-1)); nfeV60Add($doc,$ide,'tpAmb','2'); nfeV60Add($doc,$ide,'finNFe','1'); nfeV60Add($doc,$ide,'indFinal','1'); nfeV60Add($doc,$ide,'indPres','1'); nfeV60Add($doc,$ide,'procEmi','0'); nfeV60Add($doc,$ide,'verProc','SYNERGIAS-ERP-V60');

    $emit=$doc->createElement('emit'); $inf->appendChild($emit); nfeV60Add($doc,$emit,'CNPJ',$cnpj); nfeV60Add($doc,$emit,'xNome',nfeV60NormalizarTexto(nfeV60Texto($fiscal['razaoSocial'] ?? ''),60)); if(nfeV60Texto($fiscal['nomeFantasia'] ?? '')!=='') nfeV60Add($doc,$emit,'xFant',nfeV60NormalizarTexto(nfeV60Texto($fiscal['nomeFantasia']),60));
    $ender=$doc->createElement('enderEmit'); $emit->appendChild($ender); nfeV60Add($doc,$ender,'xLgr',nfeV60NormalizarTexto(nfeV60Texto($fiscal['logradouro'] ?? ''),60)); nfeV60Add($doc,$ender,'nro',nfeV60NormalizarTexto(nfeV60Texto($fiscal['nfeV60Numero'] ?? 'S/N'),60)); if(nfeV60Texto($fiscal['complemento'] ?? '')!=='') nfeV60Add($doc,$ender,'xCpl',nfeV60NormalizarTexto(nfeV60Texto($fiscal['complemento']),60)); nfeV60Add($doc,$ender,'xBairro',nfeV60NormalizarTexto(nfeV60Texto($fiscal['bairro'] ?? ''),60)); nfeV60Add($doc,$ender,'cMun',$cMunEmit); nfeV60Add($doc,$ender,'xMun',nfeV60NormalizarTexto(nfeV60Texto($fiscal['municipio'] ?? ''),60)); nfeV60Add($doc,$ender,'UF','RS'); nfeV60Add($doc,$ender,'CEP',$cepEmit); nfeV60Add($doc,$ender,'cPais','1058'); nfeV60Add($doc,$ender,'xPais','BRASIL'); if(nfeV60Digitos($fiscal['telefone'] ?? '')!=='') nfeV60Add($doc,$ender,'fone',nfeV60Digitos($fiscal['telefone'])); nfeV60Add($doc,$emit,'IE',$ie); nfeV60Add($doc,$emit,'CRT','1');

    $dest=$doc->createElement('dest'); $inf->appendChild($dest); nfeV60Add($doc,$dest,strlen($destDoc)===14?'CNPJ':'CPF',$destDoc); nfeV60Add($doc,$dest,'xNome',nfeV60NormalizarTexto(nfeV60Texto($venda['clienteNome'] ?? ''),60));
    $enderD=$doc->createElement('enderDest'); $dest->appendChild($enderD); nfeV60Add($doc,$enderD,'xLgr',nfeV60NormalizarTexto(nfeV60Texto($venda['faturamentoEndereco'] ?? ''),60)); nfeV60Add($doc,$enderD,'nro',nfeV60NormalizarTexto(nfeV60Texto($venda['faturamentoNumero'] ?? 'S/N'),60)); if(nfeV60Texto($venda['faturamentoComplemento'] ?? '')!=='') nfeV60Add($doc,$enderD,'xCpl',nfeV60NormalizarTexto(nfeV60Texto($venda['faturamentoComplemento']),60)); nfeV60Add($doc,$enderD,'xBairro',nfeV60NormalizarTexto(nfeV60Texto($venda['faturamentoBairro'] ?? ''),60)); nfeV60Add($doc,$enderD,'cMun',$cMunDest); nfeV60Add($doc,$enderD,'xMun',nfeV60NormalizarTexto(nfeV60Texto($venda['faturamentoCidade'] ?? ''),60)); nfeV60Add($doc,$enderD,'UF',$ufDest); nfeV60Add($doc,$enderD,'CEP',$cepDest); nfeV60Add($doc,$enderD,'cPais','1058'); nfeV60Add($doc,$enderD,'xPais','BRASIL'); if(nfeV60Digitos($venda['clienteTelefone'] ?? '')!=='') nfeV60Add($doc,$enderD,'fone',nfeV60Digitos($venda['clienteTelefone'])); nfeV60Add($doc,$dest,'indIEDest',nfeV60Digitos($venda['clienteIeRg'] ?? '')!==''?'1':'9'); if(nfeV60Digitos($venda['clienteIeRg'] ?? '')!=='') nfeV60Add($doc,$dest,'IE',nfeV60Digitos($venda['clienteIeRg'])); if(filter_var(nfeV60Texto($venda['clienteEmailNotaFiscal'] ?? $venda['clienteEmail'] ?? ''),FILTER_VALIDATE_EMAIL)) nfeV60Add($doc,$dest,'email',nfeV60Texto($venda['clienteEmailNotaFiscal'] ?? $venda['clienteEmail']));

    foreach($itens as $i=>$item){ $q=nfeV60Numero($item['nfeV60Quantidade']); $vUn=nfeV60Numero($item['valorUnitario']); $vProd=round($q*$vUn,2); $det=$doc->createElement('det'); $det->setAttribute('nItem',(string)($i+1)); $inf->appendChild($det); $prod=$doc->createElement('prod'); $det->appendChild($prod); nfeV60Add($doc,$prod,'cProd',nfeV60NormalizarTexto(nfeV60Texto($item['codigoProduto'] ?? ($i+1)),60)); $cEAN=nfeV60Digitos($item['codigoBarras'] ?? ''); nfeV60Add($doc,$prod,'cEAN',in_array(strlen($cEAN),[8,12,13,14],true)?$cEAN:'SEM GTIN'); nfeV60Add($doc,$prod,'xProd',nfeV60NormalizarTexto(nfeV60Texto($item['descricao']),120)); nfeV60Add($doc,$prod,'NCM',nfeV60Digitos($item['ncm'])); if(strlen(nfeV60Digitos($item['cest'] ?? ''))===7) nfeV60Add($doc,$prod,'CEST',nfeV60Digitos($item['cest'])); nfeV60Add($doc,$prod,'CFOP',nfeV60Digitos($item['cfop'])); $un=nfeV60NormalizarTexto(nfeV60Texto($item['unidade'] ?? 'UN'),6); nfeV60Add($doc,$prod,'uCom',$un); nfeV60Add($doc,$prod,'qCom',nfeV60Quantidade($q)); nfeV60Add($doc,$prod,'vUnCom',number_format($vUn,10,'.','')); nfeV60Add($doc,$prod,'vProd',nfeV60Moeda($vProd)); nfeV60Add($doc,$prod,'cEANTrib',in_array(strlen($cEAN),[8,12,13,14],true)?$cEAN:'SEM GTIN'); nfeV60Add($doc,$prod,'uTrib',nfeV60NormalizarTexto(nfeV60Texto($item['unidadeTributavel'] ?? $un),6)); nfeV60Add($doc,$prod,'qTrib',nfeV60Quantidade($q)); nfeV60Add($doc,$prod,'vUnTrib',number_format($vUn,10,'.','')); nfeV60Add($doc,$prod,'indTot','1');
      $imposto=$doc->createElement('imposto'); $det->appendChild($imposto); $icms=$doc->createElement('ICMS'); $imposto->appendChild($icms); $g=$doc->createElement('ICMSSN102'); $icms->appendChild($g); nfeV60Add($doc,$g,'orig','0'); nfeV60Add($doc,$g,'CSOSN','102'); $pis=$doc->createElement('PIS'); $imposto->appendChild($pis); $p=$doc->createElement('PISOutr'); $pis->appendChild($p); nfeV60Add($doc,$p,'CST','49'); nfeV60Add($doc,$p,'vBC','0.00'); nfeV60Add($doc,$p,'pPIS','0.0000'); nfeV60Add($doc,$p,'vPIS','0.00'); $cof=$doc->createElement('COFINS'); $imposto->appendChild($cof); $c=$doc->createElement('COFINSOutr'); $cof->appendChild($c); nfeV60Add($doc,$c,'CST','49'); nfeV60Add($doc,$c,'vBC','0.00'); nfeV60Add($doc,$c,'pCOFINS','0.0000'); nfeV60Add($doc,$c,'vCOFINS','0.00'); }

    $frete=nfeV60Numero($venda['frete'] ?? 0); $desc=nfeV60Numero($venda['descontoValor'] ?? 0); $outros=nfeV60Numero($venda['outrosCustos'] ?? 0); $vNF=round($totalProdutos+$frete+$outros-$desc,2);
    $total=$doc->createElement('total'); $inf->appendChild($total); $icmst=$doc->createElement('ICMSTot'); $total->appendChild($icmst); foreach(['vBC'=>0,'vICMS'=>0,'vICMSDeson'=>0,'vFCPUFDest'=>0,'vICMSUFDest'=>0,'vICMSUFRemet'=>0,'vFCP'=>0,'vBCST'=>0,'vST'=>0,'vFCPST'=>0,'vFCPSTRet'=>0] as $k=>$v) nfeV60Add($doc,$icmst,$k,nfeV60Moeda((float)$v)); nfeV60Add($doc,$icmst,'vProd',nfeV60Moeda($totalProdutos)); nfeV60Add($doc,$icmst,'vFrete',nfeV60Moeda($frete)); nfeV60Add($doc,$icmst,'vSeg','0.00'); nfeV60Add($doc,$icmst,'vDesc',nfeV60Moeda($desc)); nfeV60Add($doc,$icmst,'vII','0.00'); nfeV60Add($doc,$icmst,'vIPI','0.00'); nfeV60Add($doc,$icmst,'vIPIDevol','0.00'); nfeV60Add($doc,$icmst,'vPIS','0.00'); nfeV60Add($doc,$icmst,'vCOFINS','0.00'); nfeV60Add($doc,$icmst,'vOutro',nfeV60Moeda($outros)); nfeV60Add($doc,$icmst,'vNF',nfeV60Moeda($vNF));
    $transp=$doc->createElement('transp'); $inf->appendChild($transp); nfeV60Add($doc,$transp,'modFrete','9');
    $pag=$doc->createElement('pag'); $inf->appendChild($pag); $detPag=$doc->createElement('detPag'); $pag->appendChild($detPag); nfeV60Add($doc,$detPag,'indPag','1'); nfeV60Add($doc,$detPag,'tPag','99'); nfeV60Add($doc,$detPag,'vPag',nfeV60Moeda($vNF));
    $infAdic=$doc->createElement('infAdic'); $inf->appendChild($infAdic); nfeV60Add($doc,$infAdic,'infCpl',nfeV60NormalizarTexto('DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NAO GERA DIREITO A CREDITO FISCAL DE ICMS, ISS E IPI. Pedido: '.nfeV60Texto($venda['numeroPedido'] ?? ''),2000));

    $xml=$doc->saveXML();
    if (!is_string($xml) || $xml==='') throw new RuntimeException('Falha ao serializar XML.');
    $avisos[]='XML gerado sem assinatura digital.'; $avisos[]='Nenhuma numeração foi consumida e nenhuma transmissão foi realizada.';
    nfeV60Responder(200,['ok'=>true,'pronto'=>true,'ambiente'=>'HOMOLOGACAO','versao'=>NFE_XML_PREVIEW_VERSION,'chaveAcesso'=>$chave,'nfeV60Numero'=>(string)$nNF,'serie'=>(string)$serie,'xml'=>$xml,'xmlBase64'=>base64_encode($xml),'erros'=>[],'avisos'=>$avisos,'geradoEm'=>gmdate('c')]);
} catch(Throwable $e){
    $codigo = substr(hash('sha256', get_class($e).'|'.$e->getMessage().'|'.$e->getLine()), 0, 12);
    error_log('[Synergias NF-e XML V60]['.$codigo.'] '.get_class($e).': '.$e->getMessage());
    nfeV60Responder(500,[
        'ok'=>false,
        'mensagem'=>'Não foi possível montar o XML seguro da NF-e.',
        'detalhe'=>$e->getMessage(),
        'arquivo'=>basename($e->getFile()),
        'linha'=>$e->getLine(),
        'codigoErro'=>$codigo,
        'versao'=>'V60'
    ]);
}
