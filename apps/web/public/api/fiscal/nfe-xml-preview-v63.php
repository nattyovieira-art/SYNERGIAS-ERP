<?php
declare(strict_types=1);

define('SYNERGIAS_AUTH_BOOTSTRAP', true);
require dirname(__DIR__) . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Referrer-Policy: no-referrer');

const NFE_XML_PREVIEW_VERSION = 'V152';
const NFE_VERPROC = 'SYNERGIAS-ERP-140';
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

function sxV62Responder(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function sxV62CodigoBarrasItem(array $item): string {
    $candidatos = [
        $item['codigoBarras'] ?? '',
        $item['codigo_barra'] ?? '',
        $item['ean'] ?? '',
        $item['gtin'] ?? '',
        $item['codigo'] ?? '',
    ];
    foreach ($candidatos as $candidato) {
        $digitos = sxV62Digitos($candidato);
        if (in_array(strlen($digitos), [8, 12, 13, 14], true)) {
            return $digitos;
        }
    }
    return '';
}

function sxV62Texto(mixed $v): string { return trim((string)($v ?? '')); }
function sxV62Digitos(mixed $v): string { return preg_replace('/\D+/', '', sxV62Texto($v)) ?: ''; }
function sxV62Numero(mixed $v): float {
    if (is_int($v) || is_float($v)) return (float)$v;
    $s = sxV62Texto($v);
    if ($s === '') return 0.0;
    if (str_contains($s, ',') && str_contains($s, '.')) $s = str_replace(['.', ','], ['', '.'], $s);
    elseif (str_contains($s, ',')) $s = str_replace(',', '.', $s);
    return is_numeric($s) ? (float)$s : 0.0;
}
function sxV62Moeda(float $v): string { return number_format(round($v + 0.00000001, 2), 2, '.', ''); }
function sxV62FormatarQuantidade(float $v): string { return number_format($v, 4, '.', ''); }
function sxV62FormatarAliquota(float $v): string { return number_format($v, 4, '.', ''); }
function sxV62DataIso(mixed $v): string { $s=sxV62Texto($v); if($s==='') return ''; try{$d=new DateTimeImmutable($s); return $d->format('Y-m-d');}catch(Throwable){return preg_match('/^\d{4}-\d{2}-\d{2}$/',$s)?$s:'';} }
function sxV62NormalizarTexto(string $v, int $max): string {
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}
function sxV62DvChave(string $base43): int {
    $peso = 2; $soma = 0;
    for ($i = strlen($base43) - 1; $i >= 0; $i--) {
        $soma += ((int)$base43[$i]) * $peso;
        $peso = $peso === 9 ? 2 : $peso + 1;
    }
    $resto = $soma % 11;
    $dv = 11 - $resto;
    return $dv >= 10 ? 0 : $dv;
}
function sxV62Add(DOMDocument $doc, DOMElement $pai, string $nome, string|int|float $valor): DOMElement {
    $el = $doc->createElement($nome);
    $el->appendChild($doc->createTextNode((string)$valor));
    $pai->appendChild($el);
    return $el;
}
function sxV62ValidarOrigem(): void {
    $origin = sxV62Texto($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === '') return;
    $host = strtolower(sxV62Texto($_SERVER['HTTP_HOST'] ?? ''));
    $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    if ($host === '' || $originHost === '' || !hash_equals($host, $originHost)) sxV62Responder(403, ['ok'=>false,'mensagem'=>'Origem não autorizada.']);
}

try {
    if (strtoupper(sxV62Texto($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') sxV62Responder(405, ['ok'=>false,'mensagem'=>'Método não permitido.']);
    sxV62ValidarOrigem();
    $usuario = exigirAutenticacao();
    if (strcasecmp(sxV62Texto($usuario['perfil'] ?? ''), 'Administrador') !== 0) sxV62Responder(403, ['ok'=>false,'mensagem'=>'Apenas Administrador pode montar o XML fiscal.']);
    if (!class_exists('DOMDocument')) sxV62Responder(500, ['ok'=>false,'mensagem'=>'Extensão DOM do PHP indisponível no servidor.']);

    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) sxV62Responder(400, ['ok'=>false,'mensagem'=>'Conteúdo inválido.']);
    $ambiente = strtoupper(sxV62Texto($body['ambiente'] ?? 'PRODUCAO'));
    $venda = is_array($body['venda'] ?? null) ? $body['venda'] : [];
    $fiscal = is_array($body['fiscal'] ?? null) ? $body['fiscal'] : [];
    $num = is_array($body['numeracao'] ?? null) ? $body['numeracao'] : [];
    $erros = []; $avisos = [];

    if ($ambiente !== 'PRODUCAO') $erros[] = 'A emissão fiscal está configurada para produção.';
    if ((strtoupper(sxV62Texto($fiscal['regimeTributario'] ?? 'SIMPLES_NACIONAL')) ?: 'SIMPLES_NACIONAL') !== 'SIMPLES_NACIONAL') $erros[] = 'A V53 está preparada somente para o Simples Nacional.';

    $cnpj = sxV62Digitos($fiscal['cnpj'] ?? '');
    $ie = sxV62Digitos($fiscal['inscricaoEstadual'] ?? '');
    $cMunEmit = sxV62Digitos($fiscal['codigoIbgeMunicipio'] ?? '');
    $cepEmit = sxV62Digitos($fiscal['cep'] ?? '');
    if (strlen($cnpj) !== 14) $erros[] = 'CNPJ emitente inválido.';
    if ($ie === '') $erros[] = 'IE emitente ausente.';
    if (strlen($cMunEmit) !== 7) $erros[] = 'Código IBGE do emitente inválido.';
    if (strlen($cepEmit) !== 8) $erros[] = 'CEP emitente inválido.';

    $nNF = max(2384, (int)($num['numero'] ?? 2384));
    $serie = max(1, (int)($num['serie'] ?? 1));
    if ($nNF > 999999999) $erros[] = 'Número da NF-e fora do limite.';
    if ($serie > 999) $erros[] = 'Série da NF-e fora do limite.';

    $destDoc = sxV62Digitos($venda['clienteDocumento'] ?? '');
    $cepDest = sxV62Digitos($venda['faturamentoCep'] ?? '');
    $ufDest = strtoupper(sxV62Texto($venda['faturamentoEstado'] ?? ''));
    $cidadeDest = mb_strtoupper(sxV62Texto($venda['faturamentoCidade'] ?? ''), 'UTF-8');
    $cidadeEmit = mb_strtoupper(sxV62Texto($fiscal['municipio'] ?? ''), 'UTF-8');
    $cMunDest = sxV62Digitos($venda['faturamentoCodigoIbge'] ?? $venda['clienteCodigoIbgeMunicipio'] ?? '');
    $cidadeDestNormalizada = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $cidadeDest) ?: $cidadeDest;
    $cidadeDestNormalizada = strtoupper(trim($cidadeDestNormalizada));
    if ($cMunDest === '' && $ufDest === 'RS' && $cidadeDestNormalizada === 'PORTO ALEGRE') $cMunDest = '4314902';
    if ($cMunDest === '' && $ufDest === 'RS' && $cidadeDest !== '' && $cidadeDest === $cidadeEmit) $cMunDest = $cMunEmit;
    if (!in_array(strlen($destDoc), [11,14], true)) $erros[] = 'CPF/CNPJ do destinatário inválido.';
    if (strlen($cepDest) !== 8) $erros[] = 'CEP do destinatário inválido.';
    if (strlen($cMunDest) !== 7) $erros[] = 'Código IBGE do destinatário ausente para '.$cidadeDest.'-'.$ufDest.'. Abra o cadastro do cliente, informe o Código IBGE do Município com 7 dígitos, salve e tente emitir novamente.';

    $itens = is_array($venda['itens'] ?? null) ? $venda['itens'] : [];
    if (!$itens) $erros[] = 'A NF-e precisa ter itens.';

    $totalProdutos = 0.0;
    foreach ($itens as $i => $item) {
        if (!is_array($item)) { $erros[] = 'Item '.($i+1).' inválido.'; continue; }
        $q = sxV62Numero($item['quantidade'] ?? 0);
        $vUn = sxV62Numero($item['valorUnitario'] ?? 0);
        $vProd = round($q * $vUn, 2);
        $totalProdutos += $vProd;
        $n = $i+1;
        if ($q <= 0) $erros[] = "Item {$n}: quantidade inválida.";
        if (strlen(sxV62Digitos($item['ncm'] ?? '')) !== 8) $erros[] = "Item {$n}: NCM inválido.";
        if (sxV62Digitos($item['cfop'] ?? '') !== ($ufDest === 'RS' ? '5102' : '6102')) $erros[] = "Item {$n}: CFOP incompatível com a UF do destinatário.";
        $origemItem = substr(sxV62Digitos($item['origem'] ?? ''),0,1);
        if (!preg_match('/^[0-8]$/', $origemItem)) $origemItem = '0';
        $csosnItem = sxV62Digitos($item['csosn'] ?? '102') ?: '102';
        $pisItem = sxV62Digitos($item['cstPis'] ?? '49') ?: '49';
        $cofinsItem = sxV62Digitos($item['cstCofins'] ?? '49') ?: '49';
        if ($origemItem !== '0') $erros[] = "Item {$n}: origem diferente de 0 exige regra fiscal específica cadastrada.";
        if ($csosnItem !== '102') $erros[] = "Item {$n}: CSOSN diferente de 102 exige regra fiscal específica cadastrada.";
        if ($pisItem !== '49') $erros[] = "Item {$n}: CST PIS diferente de 49 exige regra fiscal específica cadastrada.";
        if ($cofinsItem !== '49') $erros[] = "Item {$n}: CST COFINS diferente de 49 exige regra fiscal específica cadastrada.";
        if (sxV62Numero($item['aliquotaIcms'] ?? 0) != 0.0 || sxV62Numero($item['aliquotaPis'] ?? 0) != 0.0 || sxV62Numero($item['aliquotaCofins'] ?? 0) != 0.0) $erros[] = "Item {$n}: impostos devem permanecer sem destaque.";
    }
    if ($erros) sxV62Responder(200, ['ok'=>true,'pronto'=>false,'ambiente'=>'PRODUCAO','versao'=>NFE_XML_PREVIEW_VERSION,'chaveAcesso'=>'','numero'=>(string)$nNF,'serie'=>(string)$serie,'xml'=>'','xmlBase64'=>'','erros'=>array_values(array_unique($erros)),'avisos'=>$avisos,'geradoEm'=>gmdate('c')]);

    $dhEmi = (new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d\TH:i:sP');
    $aamm = substr(str_replace('-','',substr($dhEmi,0,7)),2,4);
    $cUF = '43'; $mod = '55'; $tpEmis = '1';
    $cNF = str_pad((string)(abs(crc32(sxV62Texto($venda['id'] ?? '') . '|' . $nNF . '|' . $serie)) % 100000000), 8, '0', STR_PAD_LEFT);
    $base43 = $cUF.$aamm.$cnpj.$mod.str_pad((string)$serie,3,'0',STR_PAD_LEFT).str_pad((string)$nNF,9,'0',STR_PAD_LEFT).$tpEmis.$cNF;
    $chave = $base43 . sxV62DvChave($base43);

    $doc = new DOMDocument('1.0','UTF-8'); $doc->formatOutput = true;
    $nfe = $doc->createElementNS(NFE_NS,'NFe'); $doc->appendChild($nfe);
    $inf = $doc->createElement('infNFe'); $inf->setAttribute('Id','NFe'.$chave); $inf->setAttribute('versao','4.00'); $nfe->appendChild($inf);
    $ide = $doc->createElement('ide'); $inf->appendChild($ide);
    sxV62Add($doc,$ide,'cUF',$cUF); sxV62Add($doc,$ide,'cNF',$cNF); sxV62Add($doc,$ide,'natOp','VENDA DE MERCADORIA'); sxV62Add($doc,$ide,'mod','55'); sxV62Add($doc,$ide,'serie',$serie); sxV62Add($doc,$ide,'nNF',$nNF); sxV62Add($doc,$ide,'dhEmi',$dhEmi); sxV62Add($doc,$ide,'tpNF','1'); sxV62Add($doc,$ide,'idDest',$ufDest==='RS'?'1':'2'); sxV62Add($doc,$ide,'cMunFG',$cMunEmit); sxV62Add($doc,$ide,'tpImp','1'); sxV62Add($doc,$ide,'tpEmis',$tpEmis); sxV62Add($doc,$ide,'cDV',substr($chave,-1)); sxV62Add($doc,$ide,'tpAmb','1'); sxV62Add($doc,$ide,'finNFe','1'); sxV62Add($doc,$ide,'indFinal','1'); sxV62Add($doc,$ide,'indPres','1'); sxV62Add($doc,$ide,'procEmi','0'); sxV62Add($doc,$ide,'verProc',NFE_VERPROC);

    $emit=$doc->createElement('emit'); $inf->appendChild($emit); sxV62Add($doc,$emit,'CNPJ',$cnpj); sxV62Add($doc,$emit,'xNome',sxV62NormalizarTexto(sxV62Texto($fiscal['razaoSocial'] ?? ''),60)); if(sxV62Texto($fiscal['nomeFantasia'] ?? '')!=='') sxV62Add($doc,$emit,'xFant',sxV62NormalizarTexto(sxV62Texto($fiscal['nomeFantasia']),60));
    $ender=$doc->createElement('enderEmit'); $emit->appendChild($ender); sxV62Add($doc,$ender,'xLgr',sxV62NormalizarTexto(sxV62Texto($fiscal['logradouro'] ?? ''),60)); sxV62Add($doc,$ender,'nro',sxV62NormalizarTexto(sxV62Texto($fiscal['sxV62Numero'] ?? 'S/N'),60)); if(sxV62Texto($fiscal['complemento'] ?? '')!=='') sxV62Add($doc,$ender,'xCpl',sxV62NormalizarTexto(sxV62Texto($fiscal['complemento']),60)); sxV62Add($doc,$ender,'xBairro',sxV62NormalizarTexto(sxV62Texto($fiscal['bairro'] ?? ''),60)); sxV62Add($doc,$ender,'cMun',$cMunEmit); sxV62Add($doc,$ender,'xMun',sxV62NormalizarTexto(sxV62Texto($fiscal['municipio'] ?? ''),60)); sxV62Add($doc,$ender,'UF','RS'); sxV62Add($doc,$ender,'CEP',$cepEmit); sxV62Add($doc,$ender,'cPais','1058'); sxV62Add($doc,$ender,'xPais','BRASIL'); if(sxV62Digitos($fiscal['telefone'] ?? '')!=='') sxV62Add($doc,$ender,'fone',sxV62Digitos($fiscal['telefone'])); sxV62Add($doc,$emit,'IE',$ie); sxV62Add($doc,$emit,'CRT','1');

    $dest=$doc->createElement('dest'); $inf->appendChild($dest); sxV62Add($doc,$dest,strlen($destDoc)===14?'CNPJ':'CPF',$destDoc); sxV62Add($doc,$dest,'xNome',sxV62NormalizarTexto(sxV62Texto($venda['clienteNome'] ?? ''),60));
    $enderD=$doc->createElement('enderDest'); $dest->appendChild($enderD); sxV62Add($doc,$enderD,'xLgr',sxV62NormalizarTexto(sxV62Texto($venda['faturamentoEndereco'] ?? ''),60)); sxV62Add($doc,$enderD,'nro',sxV62NormalizarTexto(sxV62Texto($venda['faturamentoNumero'] ?? 'S/N'),60)); if(sxV62Texto($venda['faturamentoComplemento'] ?? '')!=='') sxV62Add($doc,$enderD,'xCpl',sxV62NormalizarTexto(sxV62Texto($venda['faturamentoComplemento']),60)); sxV62Add($doc,$enderD,'xBairro',sxV62NormalizarTexto(sxV62Texto($venda['faturamentoBairro'] ?? ''),60)); sxV62Add($doc,$enderD,'cMun',$cMunDest); sxV62Add($doc,$enderD,'xMun',sxV62NormalizarTexto(sxV62Texto($venda['faturamentoCidade'] ?? ''),60)); sxV62Add($doc,$enderD,'UF',$ufDest); sxV62Add($doc,$enderD,'CEP',$cepDest); sxV62Add($doc,$enderD,'cPais','1058'); sxV62Add($doc,$enderD,'xPais','BRASIL'); if(sxV62Digitos($venda['clienteTelefone'] ?? '')!=='') sxV62Add($doc,$enderD,'fone',sxV62Digitos($venda['clienteTelefone'])); $indIEDest=sxV62Digitos($venda['clienteIndicadorIE'] ?? ''); if(!in_array($indIEDest,['1','2','9'],true)) $indIEDest=sxV62Digitos($venda['clienteIeRg'] ?? '')!==''?'1':'9'; sxV62Add($doc,$dest,'indIEDest',$indIEDest); if($indIEDest!=='9' && sxV62Digitos($venda['clienteIeRg'] ?? '')!=='') sxV62Add($doc,$dest,'IE',sxV62Digitos($venda['clienteIeRg'])); if(filter_var(sxV62Texto($venda['clienteEmailNotaFiscal'] ?? $venda['clienteEmail'] ?? ''),FILTER_VALIDATE_EMAIL)) sxV62Add($doc,$dest,'email',sxV62Texto($venda['clienteEmailNotaFiscal'] ?? $venda['clienteEmail']));

    foreach($itens as $i=>$item){
        $q=sxV62Numero($item['quantidade'] ?? $item['qtd'] ?? $item['quantity'] ?? $item['quantidadeProduto'] ?? 0);
        $vUn=sxV62Numero($item['valorUnitario'] ?? $item['precoUnitario'] ?? $item['unitPrice'] ?? $item['preco'] ?? 0);
        $vTotalInformado=sxV62Numero($item['valorTotal'] ?? $item['total'] ?? $item['subtotal'] ?? 0);
        if($q<=0 && $vUn>0 && $vTotalInformado>0){$q=$vTotalInformado/$vUn;}
        $vProd=round($q*$vUn,2); $det=$doc->createElement('det'); $det->setAttribute('nItem',(string)($i+1)); $inf->appendChild($det); $prod=$doc->createElement('prod'); $det->appendChild($prod); sxV62Add($doc,$prod,'cProd',sxV62NormalizarTexto(sxV62Texto($item['codigoProduto'] ?? ($i+1)),60)); $cEAN=sxV62CodigoBarrasItem($item); sxV62Add($doc,$prod,'cEAN',$cEAN!==''?$cEAN:'SEM GTIN'); sxV62Add($doc,$prod,'xProd',sxV62NormalizarTexto(sxV62Texto($item['descricao']),120)); sxV62Add($doc,$prod,'NCM',sxV62Digitos($item['ncm'])); if(strlen(sxV62Digitos($item['cest'] ?? ''))===7) sxV62Add($doc,$prod,'CEST',sxV62Digitos($item['cest'])); sxV62Add($doc,$prod,'CFOP',sxV62Digitos($item['cfop'])); $un=sxV62NormalizarTexto(sxV62Texto($item['unidade'] ?? 'UN'),6); sxV62Add($doc,$prod,'uCom',$un); sxV62Add($doc,$prod,'qCom',sxV62FormatarQuantidade($q)); sxV62Add($doc,$prod,'vUnCom',number_format($vUn,10,'.','')); sxV62Add($doc,$prod,'vProd',sxV62Moeda($vProd)); sxV62Add($doc,$prod,'cEANTrib',$cEAN!==''?$cEAN:'SEM GTIN'); sxV62Add($doc,$prod,'uTrib',sxV62NormalizarTexto(sxV62Texto($item['unidadeTributavel'] ?? $un),6)); sxV62Add($doc,$prod,'qTrib',sxV62FormatarQuantidade($q)); sxV62Add($doc,$prod,'vUnTrib',number_format($vUn,10,'.','')); sxV62Add($doc,$prod,'indTot','1');
      $imposto=$doc->createElement('imposto'); $det->appendChild($imposto); $icms=$doc->createElement('ICMS'); $imposto->appendChild($icms); $g=$doc->createElement('ICMSSN102'); $icms->appendChild($g); sxV62Add($doc,$g,'orig','0'); sxV62Add($doc,$g,'CSOSN','102'); $pis=$doc->createElement('PIS'); $imposto->appendChild($pis); $p=$doc->createElement('PISOutr'); $pis->appendChild($p); sxV62Add($doc,$p,'CST','49'); sxV62Add($doc,$p,'vBC','0.00'); sxV62Add($doc,$p,'pPIS','0.0000'); sxV62Add($doc,$p,'vPIS','0.00'); $cof=$doc->createElement('COFINS'); $imposto->appendChild($cof); $c=$doc->createElement('COFINSOutr'); $cof->appendChild($c); sxV62Add($doc,$c,'CST','49'); sxV62Add($doc,$c,'vBC','0.00'); sxV62Add($doc,$c,'pCOFINS','0.0000'); sxV62Add($doc,$c,'vCOFINS','0.00'); }

    $frete=sxV62Numero($venda['frete'] ?? 0); $desc=sxV62Numero($venda['descontoValor'] ?? 0); $outros=sxV62Numero($venda['outrosCustos'] ?? 0); $vNF=round($totalProdutos+$frete+$outros-$desc,2);
    $total=$doc->createElement('total'); $inf->appendChild($total); $icmst=$doc->createElement('ICMSTot'); $total->appendChild($icmst); foreach(['vBC'=>0,'vICMS'=>0,'vICMSDeson'=>0,'vFCPUFDest'=>0,'vICMSUFDest'=>0,'vICMSUFRemet'=>0,'vFCP'=>0,'vBCST'=>0,'vST'=>0,'vFCPST'=>0,'vFCPSTRet'=>0] as $k=>$v) sxV62Add($doc,$icmst,$k,sxV62Moeda((float)$v)); sxV62Add($doc,$icmst,'vProd',sxV62Moeda($totalProdutos)); sxV62Add($doc,$icmst,'vFrete',sxV62Moeda($frete)); sxV62Add($doc,$icmst,'vSeg','0.00'); sxV62Add($doc,$icmst,'vDesc',sxV62Moeda($desc)); sxV62Add($doc,$icmst,'vII','0.00'); sxV62Add($doc,$icmst,'vIPI','0.00'); sxV62Add($doc,$icmst,'vIPIDevol','0.00'); sxV62Add($doc,$icmst,'vPIS','0.00'); sxV62Add($doc,$icmst,'vCOFINS','0.00'); sxV62Add($doc,$icmst,'vOutro',sxV62Moeda($outros)); sxV62Add($doc,$icmst,'vNF',sxV62Moeda($vNF));
    $modalidadeFrete = (string)($venda['modalidadeFrete'] ?? '0'); if(!in_array($modalidadeFrete,['0','1','2'],true)) $modalidadeFrete='0'; $transp=$doc->createElement('transp'); $inf->appendChild($transp); sxV62Add($doc,$transp,'modFrete',$modalidadeFrete);

    $parcelasXml = is_array($venda['parcelas'] ?? null) ? $venda['parcelas'] : [];
    $duplicatasXml = [];
    foreach ($parcelasXml as $idxParcela => $parcelaXml) {
        if (!is_array($parcelaXml)) continue;
        $valorParcela = sxV62Numero($parcelaXml['valor'] ?? 0);
        $vencParcela = sxV62DataIso($parcelaXml['vencimento'] ?? $parcelaXml['dataVencimento'] ?? '');
        if ($valorParcela <= 0 || $vencParcela === '') continue;
        $duplicatasXml[] = [
            'numero' => str_pad((string)($parcelaXml['numero'] ?? ($idxParcela + 1)), 3, '0', STR_PAD_LEFT),
            'vencimento' => $vencParcela,
            'valor' => $valorParcela,
        ];
    }
    if ($duplicatasXml) {
        $cobr=$doc->createElement('cobr'); $inf->appendChild($cobr);
        $fat=$doc->createElement('fat'); $cobr->appendChild($fat);
        sxV62Add($doc,$fat,'nFat',sxV62NormalizarTexto(sxV62Texto($venda['numeroPedido'] ?? $nNF),60));
        sxV62Add($doc,$fat,'vOrig',sxV62Moeda($vNF)); sxV62Add($doc,$fat,'vDesc','0.00'); sxV62Add($doc,$fat,'vLiq',sxV62Moeda($vNF));
        foreach ($duplicatasXml as $dupXml) {
            $dup=$doc->createElement('dup'); $cobr->appendChild($dup);
            sxV62Add($doc,$dup,'nDup',$dupXml['numero']); sxV62Add($doc,$dup,'dVenc',$dupXml['vencimento']); sxV62Add($doc,$dup,'vDup',sxV62Moeda($dupXml['valor']));
        }
    }
    $formaPagamentoXml = mb_strtoupper(sxV62Texto($venda['formaPagamento'] ?? $venda['tipoCobranca'] ?? ''), 'UTF-8');
    $ehBoletoXml = str_contains($formaPagamentoXml, 'BOLETO') || $duplicatasXml;
    $pag=$doc->createElement('pag'); $inf->appendChild($pag); $detPag=$doc->createElement('detPag'); $pag->appendChild($detPag); sxV62Add($doc,$detPag,'indPag','1'); sxV62Add($doc,$detPag,'tPag',$ehBoletoXml?'15':'99'); if(!$ehBoletoXml) sxV62Add($doc,$detPag,'xPag','OUTROS - CONFORME PEDIDO'); sxV62Add($doc,$detPag,'vPag',sxV62Moeda($vNF));
    $infAdic=$doc->createElement('infAdic'); $inf->appendChild($infAdic); sxV62Add($doc,$infAdic,'infCpl',sxV62NormalizarTexto('DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NAO GERA DIREITO A CREDITO FISCAL DE ICMS, ISS E IPI. Pedido: '.sxV62Texto($venda['numeroPedido'] ?? ''),2000));

    $verProcNode = $doc->getElementsByTagName('verProc')->item(0);
    if (!$verProcNode instanceof DOMElement || trim($verProcNode->textContent) !== NFE_VERPROC || strlen(NFE_VERPROC) < 1 || strlen(NFE_VERPROC) > 20) {
        throw new RuntimeException('XML bloqueado: ide/verProc invalido para o Schema NF-e 4.00.');
    }
    $procEmiNode = $doc->getElementsByTagName('procEmi')->item(0);
    if (!$procEmiNode instanceof DOMElement || trim($procEmiNode->textContent) !== '0' || $procEmiNode->nextSibling !== $verProcNode) {
        throw new RuntimeException('XML bloqueado: procEmi/verProc fora da ordem exigida pelo Schema NF-e 4.00.');
    }
    $xml=$doc->saveXML();
    if (!is_string($xml) || $xml==='') throw new RuntimeException('Falha ao serializar XML.');
    $avisos[]='XML gerado sem assinatura digital.'; $avisos[]='Nenhuma numeração foi consumida e nenhuma transmissão foi realizada.';
    sxV62Responder(200,['ok'=>true,'pronto'=>true,'ambiente'=>'PRODUCAO','versao'=>NFE_XML_PREVIEW_VERSION,'chaveAcesso'=>$chave,'numero'=>(string)$nNF,'serie'=>(string)$serie,'xml'=>$xml,'xmlBase64'=>base64_encode($xml),'erros'=>[],'avisos'=>$avisos,'geradoEm'=>gmdate('c')]);
} catch(Throwable $e){
    $codigo = substr(hash('sha256', get_class($e).'|'.$e->getMessage().'|'.$e->getLine()), 0, 12);
    error_log('[Synergias NF-e XML V62]['.$codigo.'] '.get_class($e).': '.$e->getMessage());
    sxV62Responder(500,[
        'ok'=>false,
        'mensagem'=>'Não foi possível montar o XML seguro da NF-e.',
        'detalhe'=>$e->getMessage(),
        'arquivo'=>basename($e->getFile()),
        'linha'=>$e->getLine(),
        'codigoErro'=>$codigo,
        'versao'=>'V63'
    ]);
}
