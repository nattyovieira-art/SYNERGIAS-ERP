<?php
declare(strict_types=1);

define('SYNERGIAS_AUTH_BOOTSTRAP', true);
require dirname(__DIR__) . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Referrer-Policy: no-referrer');

const NFE_XML_PREVIEW_VERSION = 'V51';
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

function responder(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function texto(mixed $v): string { return trim((string)($v ?? '')); }
function digitos(mixed $v): string { return preg_replace('/\D+/', '', texto($v)) ?: ''; }
function numero(mixed $v): float {
    if (is_int($v) || is_float($v)) return (float)$v;
    $s = texto($v);
    if ($s === '') return 0.0;
    if (str_contains($s, ',') && str_contains($s, '.')) $s = str_replace(['.', ','], ['', '.'], $s);
    elseif (str_contains($s, ',')) $s = str_replace(',', '.', $s);
    return is_numeric($s) ? (float)$s : 0.0;
}
function moeda(float $v): string { return number_format(round($v + 0.00000001, 2), 2, '.', ''); }
function quantidade(float $v): string { return number_format($v, 4, '.', ''); }
function aliquota(float $v): string { return number_format($v, 4, '.', ''); }
function normalizarTexto(string $v, int $max): string {
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}
function dvChave(string $base43): int {
    $peso = 2; $soma = 0;
    for ($i = strlen($base43) - 1; $i >= 0; $i--) {
        $soma += ((int)$base43[$i]) * $peso;
        $peso = $peso === 9 ? 2 : $peso + 1;
    }
    $resto = $soma % 11;
    $dv = 11 - $resto;
    return $dv >= 10 ? 0 : $dv;
}
function add(DOMDocument $doc, DOMElement $pai, string $nome, string|int|float $valor): DOMElement {
    $el = $doc->createElement($nome);
    $el->appendChild($doc->createTextNode((string)$valor));
    $pai->appendChild($el);
    return $el;
}
function validarOrigem(): void {
    $origin = texto($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === '') return;
    $host = strtolower(texto($_SERVER['HTTP_HOST'] ?? ''));
    $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    if ($host === '' || $originHost === '' || !hash_equals($host, $originHost)) responder(403, ['ok'=>false,'mensagem'=>'Origem não autorizada.']);
}

try {
    if (strtoupper(texto($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') responder(405, ['ok'=>false,'mensagem'=>'Método não permitido.']);
    validarOrigem();
    $usuario = exigirAutenticacao();
    if (strcasecmp(texto($usuario['perfil'] ?? ''), 'Administrador') !== 0) responder(403, ['ok'=>false,'mensagem'=>'Apenas Administrador pode montar o XML fiscal.']);
    if (!class_exists('DOMDocument')) responder(500, ['ok'=>false,'mensagem'=>'Extensão DOM do PHP indisponível no servidor.']);

    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) responder(400, ['ok'=>false,'mensagem'=>'Conteúdo inválido.']);
    $ambiente = strtoupper(texto($body['ambiente'] ?? 'HOMOLOGACAO'));
    $venda = is_array($body['venda'] ?? null) ? $body['venda'] : [];
    $fiscal = is_array($body['fiscal'] ?? null) ? $body['fiscal'] : [];
    $num = is_array($body['numeracao'] ?? null) ? $body['numeracao'] : [];
    $erros = []; $avisos = [];

    if ($ambiente !== 'HOMOLOGACAO') $erros[] = 'Somente homologação está liberada.';
    if ((strtoupper(texto($fiscal['regimeTributario'] ?? 'SIMPLES_NACIONAL')) ?: 'SIMPLES_NACIONAL') !== 'SIMPLES_NACIONAL') $erros[] = 'A V53 está preparada somente para o Simples Nacional.';

    $cnpj = digitos($fiscal['cnpj'] ?? '');
    $ie = digitos($fiscal['inscricaoEstadual'] ?? '');
    $cMunEmit = digitos($fiscal['codigoIbgeMunicipio'] ?? '');
    $cepEmit = digitos($fiscal['cep'] ?? '');
    if (strlen($cnpj) !== 14) $erros[] = 'CNPJ emitente inválido.';
    if ($ie === '') $erros[] = 'IE emitente ausente.';
    if (strlen($cMunEmit) !== 7) $erros[] = 'Código IBGE do emitente inválido.';
    if (strlen($cepEmit) !== 8) $erros[] = 'CEP emitente inválido.';

    $nNF = max(1, (int)($num['numero'] ?? 1));
    $serie = max(1, (int)($num['serie'] ?? 1));
    if ($nNF > 999999999) $erros[] = 'Número da NF-e fora do limite.';
    if ($serie > 999) $erros[] = 'Série da NF-e fora do limite.';

    $destDoc = digitos($venda['clienteDocumento'] ?? '');
    $cepDest = digitos($venda['faturamentoCep'] ?? '');
    $ufDest = strtoupper(texto($venda['faturamentoEstado'] ?? ''));
    $cidadeDest = mb_strtoupper(texto($venda['faturamentoCidade'] ?? ''), 'UTF-8');
    $cidadeEmit = mb_strtoupper(texto($fiscal['municipio'] ?? ''), 'UTF-8');
    $cMunDest = digitos($venda['faturamentoCodigoIbge'] ?? '');
    if ($cMunDest === '' && $ufDest === 'RS' && $cidadeDest !== '' && $cidadeDest === $cidadeEmit) $cMunDest = $cMunEmit;
    if (!in_array(strlen($destDoc), [11,14], true)) $erros[] = 'CPF/CNPJ do destinatário inválido.';
    if (strlen($cepDest) !== 8) $erros[] = 'CEP do destinatário inválido.';
    if (strlen($cMunDest) !== 7) $erros[] = 'Código IBGE do município do destinatário não está disponível. Nesta etapa, pedidos fora do município do emitente continuam bloqueados.';

    $itens = is_array($venda['itens'] ?? null) ? $venda['itens'] : [];
    if (!$itens) $erros[] = 'A NF-e precisa ter itens.';

    $totalProdutos = 0.0;
    foreach ($itens as $i => $item) {
        if (!is_array($item)) { $erros[] = 'Item '.($i+1).' inválido.'; continue; }
        $q = numero($item['quantidade'] ?? 0);
        $vUn = numero($item['valorUnitario'] ?? 0);
        $vProd = round($q * $vUn, 2);
        $totalProdutos += $vProd;
        $n = $i+1;
        if ($q <= 0) $erros[] = "Item {$n}: quantidade inválida.";
        if (strlen(digitos($item['ncm'] ?? '')) !== 8) $erros[] = "Item {$n}: NCM inválido.";
        if (digitos($item['cfop'] ?? '') !== ($ufDest === 'RS' ? '5102' : '6102')) $erros[] = "Item {$n}: CFOP incompatível com a UF do destinatário.";
        $origemItem = substr(digitos($item['origem'] ?? ''),0,1);
        if (!preg_match('/^[0-8]$/', $origemItem)) $origemItem = '0';
        $csosnItem = digitos($item['csosn'] ?? '102') ?: '102';
        $pisItem = digitos($item['cstPis'] ?? '49') ?: '49';
        $cofinsItem = digitos($item['cstCofins'] ?? '49') ?: '49';
        if ($origemItem !== '0') $erros[] = "Item {$n}: origem diferente de 0 exige regra fiscal específica cadastrada.";
        if ($csosnItem !== '102') $erros[] = "Item {$n}: CSOSN diferente de 102 exige regra fiscal específica cadastrada.";
        if ($pisItem !== '49') $erros[] = "Item {$n}: CST PIS diferente de 49 exige regra fiscal específica cadastrada.";
        if ($cofinsItem !== '49') $erros[] = "Item {$n}: CST COFINS diferente de 49 exige regra fiscal específica cadastrada.";
        if (digitos($item['cstPis'] ?? '') !== '49') $erros[] = "Item {$n}: CST PIS deve ser 49.";
        if (digitos($item['cstCofins'] ?? '') !== '49') $erros[] = "Item {$n}: CST COFINS deve ser 49.";
        if (numero($item['aliquotaIcms'] ?? 0) != 0.0 || numero($item['aliquotaPis'] ?? 0) != 0.0 || numero($item['aliquotaCofins'] ?? 0) != 0.0) $erros[] = "Item {$n}: impostos devem permanecer sem destaque.";
    }
    if ($erros) responder(200, ['ok'=>true,'pronto'=>false,'ambiente'=>'HOMOLOGACAO','versao'=>NFE_XML_PREVIEW_VERSION,'chaveAcesso'=>'','numero'=>(string)$nNF,'serie'=>(string)$serie,'xml'=>'','xmlBase64'=>'','erros'=>array_values(array_unique($erros)),'avisos'=>$avisos,'geradoEm'=>gmdate('c')]);

    $dhEmi = (new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d\TH:i:sP');
    $aamm = substr(str_replace('-','',substr($dhEmi,0,7)),2,4);
    $cUF = '43'; $mod = '55'; $tpEmis = '1';
    $cNF = str_pad((string)(abs(crc32(texto($venda['id'] ?? '') . '|' . $nNF . '|' . $serie)) % 100000000), 8, '0', STR_PAD_LEFT);
    $base43 = $cUF.$aamm.$cnpj.$mod.str_pad((string)$serie,3,'0',STR_PAD_LEFT).str_pad((string)$nNF,9,'0',STR_PAD_LEFT).$tpEmis.$cNF;
    $chave = $base43 . dvChave($base43);

    $doc = new DOMDocument('1.0','UTF-8'); $doc->formatOutput = true;
    $nfe = $doc->createElementNS(NFE_NS,'NFe'); $doc->appendChild($nfe);
    $inf = $doc->createElement('infNFe'); $inf->setAttribute('Id','NFe'.$chave); $inf->setAttribute('versao','4.00'); $nfe->appendChild($inf);
    $ide = $doc->createElement('ide'); $inf->appendChild($ide);
    add($doc,$ide,'cUF',$cUF); add($doc,$ide,'cNF',$cNF); add($doc,$ide,'natOp','VENDA DE MERCADORIA'); add($doc,$ide,'mod','55'); add($doc,$ide,'serie',$serie); add($doc,$ide,'nNF',$nNF); add($doc,$ide,'dhEmi',$dhEmi); add($doc,$ide,'tpNF','1'); add($doc,$ide,'idDest',$ufDest==='RS'?'1':'2'); add($doc,$ide,'cMunFG',$cMunEmit); add($doc,$ide,'tpImp','1'); add($doc,$ide,'tpEmis',$tpEmis); add($doc,$ide,'cDV',substr($chave,-1)); add($doc,$ide,'tpAmb','2'); add($doc,$ide,'finNFe','1'); add($doc,$ide,'indFinal','1'); add($doc,$ide,'indPres','1'); add($doc,$ide,'procEmi','0'); add($doc,$ide,'verProc','SYNERGIAS-ERP-V51');

    $emit=$doc->createElement('emit'); $inf->appendChild($emit); add($doc,$emit,'CNPJ',$cnpj); add($doc,$emit,'xNome',normalizarTexto(texto($fiscal['razaoSocial'] ?? ''),60)); if(texto($fiscal['nomeFantasia'] ?? '')!=='') add($doc,$emit,'xFant',normalizarTexto(texto($fiscal['nomeFantasia']),60));
    $ender=$doc->createElement('enderEmit'); $emit->appendChild($ender); add($doc,$ender,'xLgr',normalizarTexto(texto($fiscal['logradouro'] ?? ''),60)); add($doc,$ender,'nro',normalizarTexto(texto($fiscal['numero'] ?? 'S/N'),60)); if(texto($fiscal['complemento'] ?? '')!=='') add($doc,$ender,'xCpl',normalizarTexto(texto($fiscal['complemento']),60)); add($doc,$ender,'xBairro',normalizarTexto(texto($fiscal['bairro'] ?? ''),60)); add($doc,$ender,'cMun',$cMunEmit); add($doc,$ender,'xMun',normalizarTexto(texto($fiscal['municipio'] ?? ''),60)); add($doc,$ender,'UF','RS'); add($doc,$ender,'CEP',$cepEmit); add($doc,$ender,'cPais','1058'); add($doc,$ender,'xPais','BRASIL'); if(digitos($fiscal['telefone'] ?? '')!=='') add($doc,$ender,'fone',digitos($fiscal['telefone'])); add($doc,$emit,'IE',$ie); add($doc,$emit,'CRT','1');

    $dest=$doc->createElement('dest'); $inf->appendChild($dest); add($doc,$dest,strlen($destDoc)===14?'CNPJ':'CPF',$destDoc); add($doc,$dest,'xNome',normalizarTexto(texto($venda['clienteNome'] ?? ''),60));
    $enderD=$doc->createElement('enderDest'); $dest->appendChild($enderD); add($doc,$enderD,'xLgr',normalizarTexto(texto($venda['faturamentoEndereco'] ?? ''),60)); add($doc,$enderD,'nro',normalizarTexto(texto($venda['faturamentoNumero'] ?? 'S/N'),60)); if(texto($venda['faturamentoComplemento'] ?? '')!=='') add($doc,$enderD,'xCpl',normalizarTexto(texto($venda['faturamentoComplemento']),60)); add($doc,$enderD,'xBairro',normalizarTexto(texto($venda['faturamentoBairro'] ?? ''),60)); add($doc,$enderD,'cMun',$cMunDest); add($doc,$enderD,'xMun',normalizarTexto(texto($venda['faturamentoCidade'] ?? ''),60)); add($doc,$enderD,'UF',$ufDest); add($doc,$enderD,'CEP',$cepDest); add($doc,$enderD,'cPais','1058'); add($doc,$enderD,'xPais','BRASIL'); if(digitos($venda['clienteTelefone'] ?? '')!=='') add($doc,$enderD,'fone',digitos($venda['clienteTelefone'])); $indIEDest = texto($venda['clienteIndicadorIE'] ?? ''); if (!in_array($indIEDest, ['1','2','9'], true)) $indIEDest = digitos($venda['clienteIeRg'] ?? '') !== '' ? '1' : '9'; add($doc,$dest,'indIEDest',$indIEDest); if($indIEDest === '1' && digitos($venda['clienteIeRg'] ?? '')!=='') add($doc,$dest,'IE',digitos($venda['clienteIeRg'])); if(filter_var(texto($venda['clienteEmailNotaFiscal'] ?? $venda['clienteEmail'] ?? ''),FILTER_VALIDATE_EMAIL)) add($doc,$dest,'email',texto($venda['clienteEmailNotaFiscal'] ?? $venda['clienteEmail']));

    foreach($itens as $i=>$item){ $q=numero($item['quantidade']); $vUn=numero($item['valorUnitario']); $vProd=round($q*$vUn,2); $det=$doc->createElement('det'); $det->setAttribute('nItem',(string)($i+1)); $inf->appendChild($det); $prod=$doc->createElement('prod'); $det->appendChild($prod); add($doc,$prod,'cProd',normalizarTexto(texto($item['codigoProduto'] ?? ($i+1)),60)); $cEAN=digitos($item['codigoBarras'] ?? ''); add($doc,$prod,'cEAN',in_array(strlen($cEAN),[8,12,13,14],true)?$cEAN:'SEM GTIN'); add($doc,$prod,'xProd',normalizarTexto(texto($item['descricao']),120)); add($doc,$prod,'NCM',digitos($item['ncm'])); if(strlen(digitos($item['cest'] ?? ''))===7) add($doc,$prod,'CEST',digitos($item['cest'])); add($doc,$prod,'CFOP',digitos($item['cfop'])); $un=normalizarTexto(texto($item['unidade'] ?? 'UN'),6); add($doc,$prod,'uCom',$un); add($doc,$prod,'qCom',quantidade($q)); add($doc,$prod,'vUnCom',number_format($vUn,10,'.','')); add($doc,$prod,'vProd',moeda($vProd)); add($doc,$prod,'cEANTrib',in_array(strlen($cEAN),[8,12,13,14],true)?$cEAN:'SEM GTIN'); add($doc,$prod,'uTrib',normalizarTexto(texto($item['unidadeTributavel'] ?? $un),6)); add($doc,$prod,'qTrib',quantidade($q)); add($doc,$prod,'vUnTrib',number_format($vUn,10,'.','')); add($doc,$prod,'indTot','1');
      $imposto=$doc->createElement('imposto'); $det->appendChild($imposto); $icms=$doc->createElement('ICMS'); $imposto->appendChild($icms); $g=$doc->createElement('ICMSSN102'); $icms->appendChild($g); add($doc,$g,'orig','0'); add($doc,$g,'CSOSN','102'); $pis=$doc->createElement('PIS'); $imposto->appendChild($pis); $p=$doc->createElement('PISOutr'); $pis->appendChild($p); add($doc,$p,'CST','49'); add($doc,$p,'vBC','0.00'); add($doc,$p,'pPIS','0.0000'); add($doc,$p,'vPIS','0.00'); $cof=$doc->createElement('COFINS'); $imposto->appendChild($cof); $c=$doc->createElement('COFINSOutr'); $cof->appendChild($c); add($doc,$c,'CST','49'); add($doc,$c,'vBC','0.00'); add($doc,$c,'pCOFINS','0.0000'); add($doc,$c,'vCOFINS','0.00'); }

    $frete=numero($venda['frete'] ?? 0); $desc=numero($venda['descontoValor'] ?? 0); $outros=numero($venda['outrosCustos'] ?? 0); $vNF=round($totalProdutos+$frete+$outros-$desc,2);
    $total=$doc->createElement('total'); $inf->appendChild($total); $icmst=$doc->createElement('ICMSTot'); $total->appendChild($icmst); foreach(['vBC'=>0,'vICMS'=>0,'vICMSDeson'=>0,'vFCPUFDest'=>0,'vICMSUFDest'=>0,'vICMSUFRemet'=>0,'vFCP'=>0,'vBCST'=>0,'vST'=>0,'vFCPST'=>0,'vFCPSTRet'=>0] as $k=>$v) add($doc,$icmst,$k,moeda((float)$v)); add($doc,$icmst,'vProd',moeda($totalProdutos)); add($doc,$icmst,'vFrete',moeda($frete)); add($doc,$icmst,'vSeg','0.00'); add($doc,$icmst,'vDesc',moeda($desc)); add($doc,$icmst,'vII','0.00'); add($doc,$icmst,'vIPI','0.00'); add($doc,$icmst,'vIPIDevol','0.00'); add($doc,$icmst,'vPIS','0.00'); add($doc,$icmst,'vCOFINS','0.00'); add($doc,$icmst,'vOutro',moeda($outros)); add($doc,$icmst,'vNF',moeda($vNF));
    $transp=$doc->createElement('transp'); $inf->appendChild($transp); $modFrete = texto($venda['modalidadeFrete'] ?? '0'); if (!in_array($modFrete, ['0','1','2'], true)) $modFrete = '0'; add($doc,$transp,'modFrete',$modFrete);
    $pag=$doc->createElement('pag'); $inf->appendChild($pag); $detPag=$doc->createElement('detPag'); $pag->appendChild($detPag); add($doc,$detPag,'indPag','1'); add($doc,$detPag,'tPag','99'); add($doc,$detPag,'vPag',moeda($vNF));
    $infAdic=$doc->createElement('infAdic'); $inf->appendChild($infAdic); add($doc,$infAdic,'infCpl',normalizarTexto('DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NAO GERA DIREITO A CREDITO FISCAL DE ICMS, ISS E IPI. Pedido: '.texto($venda['numeroPedido'] ?? ''),2000));

    $xml=$doc->saveXML();
    if (!is_string($xml) || $xml==='') throw new RuntimeException('Falha ao serializar XML.');
    $avisos[]='XML gerado sem assinatura digital.'; $avisos[]='Nenhuma numeração foi consumida e nenhuma transmissão foi realizada.';
    responder(200,['ok'=>true,'pronto'=>true,'ambiente'=>'HOMOLOGACAO','versao'=>NFE_XML_PREVIEW_VERSION,'chaveAcesso'=>$chave,'numero'=>(string)$nNF,'serie'=>(string)$serie,'xml'=>$xml,'xmlBase64'=>base64_encode($xml),'erros'=>[],'avisos'=>$avisos,'geradoEm'=>gmdate('c')]);
} catch(Throwable $e){ error_log('[Synergias NF-e XML V51] '.$e->getMessage()); responder(500,['ok'=>false,'mensagem'=>'Não foi possível montar o XML seguro da NF-e.']); }
