<?php
declare(strict_types=1);

define('SYNERGIAS_AUTH_BOOTSTRAP', true);
require dirname(__DIR__) . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

const NFE_DIST_URL_PRODUCAO = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const NFE_DIST_URL_HOMOLOGACAO = 'https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const NFE_DIST_NS = 'http://www.portalfiscal.inf.br/nfe';
const NFE_DIST_WSDL_NS = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe';

function dfeOut(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function dfeTxt(mixed $value): string { return trim((string)($value ?? '')); }
function dfeDigits(mixed $value): string { return preg_replace('/\D+/', '', dfeTxt($value)) ?: ''; }
function dfeAdmin(): array {
    $usuario = exigirAutenticacao();
    if (strcasecmp((string)($usuario['perfil'] ?? ''), 'Administrador') !== 0) {
        dfeOut(403, ['ok' => false, 'mensagem' => 'Apenas Administrador pode consultar NF-e emitidas.']);
    }
    return $usuario;
}
function dfeValidarOrigem(): void {
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') return;
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    if ($host === '' || $originHost === '' || !hash_equals($host, $originHost)) {
        dfeOut(403, ['ok' => false, 'mensagem' => 'Origem da solicitação não autorizada.']);
    }
}
function dfeHome(): string {
    $home = rtrim((string)(getenv('HOME') ?: ''), '/\\');
    if ($home !== '' && is_dir($home) && is_writable($home)) return $home;
    $docRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
    if ($docRoot !== '') {
        $parent = dirname($docRoot);
        if (is_dir($parent) && is_writable($parent)) return $parent;
    }
    throw new RuntimeException('Diretório privado indisponível.');
}
function dfePaths(): array {
    $home = dfeHome();
    return [
        'secret' => $home . '/.synergias-secrets/fiscal-a1.key',
        'data' => $home . '/synergias_private/fiscal-a1/certificado.a1.enc.json',
        'tmp' => $home . '/synergias_private/fiscal-dfe',
        'ca' => __DIR__ . '/cacert.pem',
    ];
}
function dfeMaterialA1(): array {
    $p = dfePaths();
    if (!is_file($p['secret']) || !is_file($p['data'])) {
        throw new RuntimeException('Certificado A1 não instalado.');
    }
    $key = base64_decode(trim((string)file_get_contents($p['secret'])), true);
    $envelope = json_decode((string)file_get_contents($p['data']), true);
    if (!is_string($key) || strlen($key) !== 32 || !is_array($envelope)) {
        throw new RuntimeException('Armazenamento A1 inválido.');
    }
    $iv = base64_decode((string)($envelope['iv'] ?? ''), true);
    $tag = base64_decode((string)($envelope['tag'] ?? ''), true);
    $cipher = base64_decode((string)($envelope['data'] ?? ''), true);
    $aad = base64_decode((string)($envelope['aad'] ?? ''), true);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, $aad);
    $material = is_string($plain) ? json_decode($plain, true) : null;
    if (!is_array($material)) throw new RuntimeException('Não foi possível abrir o A1.');
    $cert = (string)($material['certificatePem'] ?? '');
    $privateKey = (string)($material['privateKeyPem'] ?? '');
    if ($cert === '' || $privateKey === '' || !openssl_x509_check_private_key($cert, $privateKey)) {
        throw new RuntimeException('Certificado e chave privada não correspondem.');
    }
    return [
        'cert' => $cert,
        'key' => $privateKey,
        'extras' => (array)($material['extraCertificates'] ?? []),
        'meta' => (array)($envelope['metadata'] ?? []),
    ];
}
function dfeCnpjCertificado(array $material): string {
    $meta = (array)($material['meta'] ?? []);
    foreach (['cnpj', 'documento', 'cpfCnpj'] as $campo) {
        $cnpj = dfeDigits($meta[$campo] ?? '');
        if (strlen($cnpj) === 14) return $cnpj;
    }
    $parsed = openssl_x509_parse((string)$material['cert']);
    $subject = is_array($parsed) ? (array)($parsed['subject'] ?? []) : [];
    foreach ($subject as $value) {
        foreach ((array)$value as $item) {
            if (preg_match_all('/\d[\d\.\/\-\s]{12,20}\d/', (string)$item, $matches)) {
                foreach ($matches[0] as $match) {
                    $cnpj = dfeDigits($match);
                    if (strlen($cnpj) === 14) return $cnpj;
                }
            }
        }
    }
    throw new RuntimeException('Não foi possível identificar o CNPJ do certificado A1.');
}
function dfeTempPem(string $name, string $content): string {
    $p = dfePaths();
    if (!is_dir($p['tmp']) && !mkdir($p['tmp'], 0700, true) && !is_dir($p['tmp'])) {
        throw new RuntimeException('Falha ao preparar diretório fiscal temporário.');
    }
    $file = $p['tmp'] . '/.' . $name . '-' . bin2hex(random_bytes(8)) . '.pem';
    if (file_put_contents($file, $content, LOCK_EX) === false) {
        throw new RuntimeException('Falha ao preparar certificado temporário.');
    }
    @chmod($file, 0600);
    return $file;
}
function dfeGarantirTabelas(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS erp_nfe_emitidas (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        chave CHAR(44) NOT NULL UNIQUE,
        nsu VARCHAR(20) NOT NULL DEFAULT '',
        ambiente VARCHAR(20) NOT NULL,
        numero VARCHAR(20) NOT NULL DEFAULT '',
        serie VARCHAR(10) NOT NULL DEFAULT '',
        protocolo VARCHAR(30) NOT NULL DEFAULT '',
        emitida_em DATETIME NULL,
        destinatario_documento VARCHAR(20) NOT NULL DEFAULT '',
        destinatario_nome VARCHAR(255) NOT NULL DEFAULT '',
        valor_total DECIMAL(15,2) NOT NULL DEFAULT 0,
        schema_dfe VARCHAR(100) NOT NULL DEFAULT '',
        xml LONGTEXT NULL,
        status_importacao VARCHAR(30) NOT NULL DEFAULT 'ARQUIVADA',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_nfe_emitidas_nsu (nsu),
        INDEX idx_nfe_emitidas_emissao (emitida_em)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS erp_nfe_emitidas_sync (
        ambiente VARCHAR(20) NOT NULL PRIMARY KEY,
        ult_nsu VARCHAR(20) NOT NULL DEFAULT '000000000000000',
        max_nsu VARCHAR(20) NOT NULL DEFAULT '000000000000000',
        ultimo_cstat VARCHAR(10) NOT NULL DEFAULT '',
        ultima_mensagem VARCHAR(255) NOT NULL DEFAULT '',
        atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS erp_nfe_dfe_documentos (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ambiente VARCHAR(20) NOT NULL,
        nsu VARCHAR(20) NOT NULL,
        schema_dfe VARCHAR(100) NOT NULL DEFAULT '',
        tipo_documento VARCHAR(30) NOT NULL DEFAULT 'OUTRO',
        chave VARCHAR(44) NOT NULL DEFAULT '',
        cnpj_emitente VARCHAR(20) NOT NULL DEFAULT '',
        xml LONGTEXT NOT NULL,
        recebido_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_dfe_ambiente_nsu (ambiente, nsu),
        INDEX idx_dfe_chave (chave),
        INDEX idx_dfe_tipo (tipo_documento)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function dfeSoap(string $cnpj, string $ultNsu, int $tpAmb): string {
    $xml = '<distDFeInt xmlns="' . NFE_DIST_NS . '" versao="1.01">'
        . '<tpAmb>' . $tpAmb . '</tpAmb>'
        . '<cUFAutor>43</cUFAutor>'
        . '<CNPJ>' . htmlspecialchars($cnpj, ENT_XML1) . '</CNPJ>'
        . '<distNSU><ultNSU>' . str_pad(dfeDigits($ultNsu), 15, '0', STR_PAD_LEFT) . '</ultNSU></distNSU>'
        . '</distDFeInt>';
    return '<?xml version="1.0" encoding="UTF-8"?>'
        . '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">'
        . '<soap12:Body><nfeDistDFeInteresse xmlns="' . NFE_DIST_WSDL_NS . '">'
        . '<nfeDadosMsg>' . $xml . '</nfeDadosMsg>'
        . '</nfeDistDFeInteresse></soap12:Body></soap12:Envelope>';
}
function dfeTransmitir(array $material, string $cnpj, string $ultNsu, int $tpAmb): string {
    $cert = (string)$material['cert'];
    foreach ((array)$material['extras'] as $extra) {
        if (is_string($extra) && trim($extra) !== '') $cert .= "\n" . trim($extra) . "\n";
    }
    $certFile = dfeTempPem('cert', $cert);
    $keyFile = dfeTempPem('key', (string)$material['key']);
    $url = $tpAmb === 2 ? NFE_DIST_URL_HOMOLOGACAO : NFE_DIST_URL_PRODUCAO;
    $errosTransitórios = [7, 18, 28, 35, 52, 55, 56, 92];
    $ultimaFalha = 'Falha desconhecida na comunicação com a SEFAZ.';

    try {
        for ($tentativa = 1; $tentativa <= 2; $tentativa++) {
            $ch = curl_init($url);
            $opts = [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => dfeSoap($cnpj, $ultNsu, $tpAmb),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 100,
                CURLOPT_CONNECTTIMEOUT => 35,
                CURLOPT_NOSIGNAL => true,
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_SSLCERT => $certFile,
                CURLOPT_SSLKEY => $keyFile,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/soap+xml; charset=utf-8; action="' . NFE_DIST_WSDL_NS . '/nfeDistDFeInteresse"',
                    'Accept: application/soap+xml, application/xml',
                    'Connection: close',
                ],
            ];
            $paths = dfePaths();
            if (is_file($paths['ca'])) $opts[CURLOPT_CAINFO] = $paths['ca'];
            curl_setopt_array($ch, $opts);
            $response = curl_exec($ch);
            $errno = curl_errno($ch);
            $error = trim((string)curl_error($ch));
            $http = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $tempoTotal = (float)curl_getinfo($ch, CURLINFO_TOTAL_TIME);
            curl_close($ch);

            if ($errno === 0 && is_string($response) && trim($response) !== '' && $http >= 200 && $http < 300) {
                return $response;
            }

            if ($errno === 28) {
                $ultimaFalha = "Tempo limite excedido aguardando resposta da SEFAZ após " . number_format($tempoTotal, 1, ',', '.') . " segundos (cURL 28, HTTP {$http}).";
            } elseif ($errno !== 0) {
                $detalhe = $error !== '' ? $error : 'sem detalhe retornado pelo cURL';
                $ultimaFalha = "Falha de comunicação com a SEFAZ: {$detalhe} (cURL {$errno}, HTTP {$http}).";
            } elseif (!is_string($response) || trim($response) === '') {
                $ultimaFalha = "A SEFAZ encerrou a conexão sem enviar resposta (HTTP {$http}).";
            } else {
                $ultimaFalha = "SEFAZ retornou HTTP {$http}.";
            }

            $podeRepetir = $tentativa === 1 && (($errno !== 0 && in_array($errno, $errosTransitórios, true)) || $http === 0 || $http >= 500);
            if (!$podeRepetir) break;
            usleep(1500000);
        }
        throw new RuntimeException($ultimaFalha);
    } finally {
        @unlink($certFile);
        @unlink($keyFile);
    }
}
function dfeNodeText(DOMXPath $xp, string $name, ?DOMNode $context = null): string {
    $query = $context ? './/*[local-name()="' . $name . '"]' : '//*[local-name()="' . $name . '"]';
    $nodes = $xp->query($query, $context);
    return $nodes && $nodes->length ? trim((string)$nodes->item(0)?->textContent) : '';
}
function dfeValor(string $value): float { return (float)str_replace(',', '.', trim($value)); }
function dfeDataMysql(string $value): ?string {
    if ($value === '') return null;
    try { return (new DateTimeImmutable($value))->format('Y-m-d H:i:s'); } catch (Throwable) { return null; }
}
function dfeNumeroPedidoHistorico(DOMXPath $xp, DOMElement $inf, string $numeroNfe): string {
    $candidatos = [];
    $infAdic = $xp->query('.//*[local-name()="infAdic"]', $inf)->item(0);
    $textoAdicional = $infAdic ? trim((string)$infAdic->textContent) : '';
    if ($textoAdicional !== '') {
        foreach ([
            '/\\bPEDIDO\\s*(?:N[º°O.]*)?\\s*[:#-]?\\s*(\\d{1,12})\\b/iu',
            '/\\bPED\\s*[:#-]?\\s*(\\d{1,12})\\b/iu',
            '/\\bN[º°]\\s*DO\\s*PEDIDO\\s*[:#-]?\\s*(\\d{1,12})\\b/iu',
        ] as $regex) {
            if (preg_match($regex, $textoAdicional, $m) === 1) {
                $candidatos[] = ltrim((string)$m[1], '0') ?: '0';
                break;
            }
        }
    }

    $xPedNodes = $xp->query('.//*[local-name()="det"]/*[local-name()="prod"]/*[local-name()="xPed"]', $inf);
    if ($xPedNodes) {
        foreach ($xPedNodes as $node) {
            $valor = trim((string)$node->textContent);
            if (preg_match('/(\\d{1,12})/', $valor, $m) === 1) {
                $candidatos[] = ltrim((string)$m[1], '0') ?: '0';
            }
        }
    }

    $candidatos = array_values(array_unique(array_filter($candidatos, fn($v) => $v !== '')));
    if (count($candidatos) === 1) return $candidatos[0];
    return 'HIST-NFE-' . ($numeroNfe !== '' ? $numeroNfe : substr(hash('sha256', (string)$inf->getAttribute('Id')), 0, 12));
}
function dfePedidoDoXml(string $xml, string $nsu, string $origem): ?array {
    $doc = new DOMDocument();
    if (!@$doc->loadXML($xml, LIBXML_NONET | LIBXML_NOBLANKS)) return null;
    $xp = new DOMXPath($doc);
    $inf = $xp->query('//*[local-name()="infNFe"]')->item(0);
    if (!$inf instanceof DOMElement) return null;
    $emit = $xp->query('.//*[local-name()="emit"]', $inf)->item(0);
    $dest = $xp->query('.//*[local-name()="dest"]', $inf)->item(0);
    $ide = $xp->query('.//*[local-name()="ide"]', $inf)->item(0);
    $total = $xp->query('.//*[local-name()="ICMSTot"]', $inf)->item(0);
    $prot = $xp->query('//*[local-name()="protNFe"]')->item(0);
    $id = $inf->getAttribute('Id');
    $chave = preg_replace('/\D+/', '', str_replace('NFe', '', $id)) ?: '';
    if (strlen($chave) !== 44) $chave = dfeDigits(dfeNodeText($xp, 'chNFe', $prot));
    if (strlen($chave) !== 44) return null;
    $itens = [];
    $detNodes = $xp->query('.//*[local-name()="det"]', $inf);
    if ($detNodes) foreach ($detNodes as $det) {
        $prod = $xp->query('./*[local-name()="prod"]', $det)->item(0);
        if (!$prod) continue;
        $qtd = dfeValor(dfeNodeText($xp, 'qCom', $prod));
        $unit = dfeValor(dfeNodeText($xp, 'vUnCom', $prod));
        $totalItem = dfeValor(dfeNodeText($xp, 'vProd', $prod));
        $codigo = dfeNodeText($xp, 'cProd', $prod);
        $descricao = dfeNodeText($xp, 'xProd', $prod);
        $itens[] = [
            'codigoProduto' => $codigo,
            'codigoProdutoHistorico' => $codigo,
            'codigoBarras' => dfeNodeText($xp, 'cEAN', $prod),
            'descricao' => $descricao,
            'descricaoHistorica' => $descricao,
            'chaveProdutoHistorico' => $codigo . '::' . $descricao,
            'produtoVinculado' => false,
            'vinculoProdutoOrigem' => 'NAO_VINCULADO',
            'quantidade' => $qtd,
            'unidade' => dfeNodeText($xp, 'uCom', $prod) ?: 'UN',
            'valorUnitario' => $unit,
            'valorTotal' => $totalItem,
            'ncm' => dfeNodeText($xp, 'NCM', $prod),
            'cfop' => dfeNodeText($xp, 'CFOP', $prod),
        ];
    }
    $docDest = dfeDigits(dfeNodeText($xp, 'CNPJ', $dest) ?: dfeNodeText($xp, 'CPF', $dest));
    $dhEmi = dfeNodeText($xp, 'dhEmi', $ide) ?: dfeNodeText($xp, 'dEmi', $ide);
    $dataEmissao = $dhEmi !== '' ? substr($dhEmi, 0, 10) : date('Y-m-d');
    $valorTotal = dfeValor(dfeNodeText($xp, 'vNF', $total));
    $numeroNfe = dfeNodeText($xp, 'nNF', $ide);
    $numeroPedidoHistorico = dfeNumeroPedidoHistorico($xp, $inf, $numeroNfe);
    return [
        'id' => 'nfe-historica-' . $chave,
        'tipo' => 'Pedido',
        'numeroPedido' => $numeroPedidoHistorico,
        'dataEmissao' => $dataEmissao,
        'statusPedido' => 'Concluído',
        'vendedor' => 'IMPORTAÇÃO FISCAL',
        'clienteNome' => dfeNodeText($xp, 'xNome', $dest) ?: 'DESTINATÁRIO NÃO INFORMADO',
        'clienteDocumento' => $docDest,
        'clienteIeRg' => dfeNodeText($xp, 'IE', $dest),
        'clienteEmail' => dfeNodeText($xp, 'email', $dest),
        'clienteTelefone' => dfeNodeText($xp, 'fone', $dest),
        'faturamentoCep' => dfeNodeText($xp, 'CEP', $dest),
        'faturamentoEndereco' => dfeNodeText($xp, 'xLgr', $dest),
        'faturamentoNumero' => dfeNodeText($xp, 'nro', $dest),
        'faturamentoComplemento' => dfeNodeText($xp, 'xCpl', $dest),
        'faturamentoBairro' => dfeNodeText($xp, 'xBairro', $dest),
        'faturamentoCidade' => dfeNodeText($xp, 'xMun', $dest),
        'faturamentoEstado' => dfeNodeText($xp, 'UF', $dest),
        'itens' => $itens,
        'parcelas' => [],
        'subtotal' => array_sum(array_map(fn($i) => (float)$i['valorTotal'], $itens)),
        'totalFinal' => $valorTotal,
        'statusNotaFiscal' => 'Autorizada',
        'numeroNotaFiscal' => $numeroNfe,
        'serieNotaFiscal' => dfeNodeText($xp, 'serie', $ide),
        'chaveAcessoNotaFiscal' => $chave,
        'protocoloNotaFiscal' => dfeNodeText($xp, 'nProt', $prot),
        'dataEmissaoNotaFiscal' => $dhEmi,
        'xmlNotaFiscal' => $xml,
        'ambienteNotaFiscal' => dfeNodeText($xp, 'tpAmb', $ide) === '2' ? 'HOMOLOGACAO' : 'PRODUCAO',
        'cStatNotaFiscal' => dfeNodeText($xp, 'cStat', $prot),
        'estoqueBaixado' => false,
        'movimentarEstoqueHistorico' => false,
        'movimentacaoEstoqueHistoricaAutorizada' => false,
        'origemPedido' => $origem,
        'importacaoHistorica' => true,
        'nsuDFe' => $nsu,
        'observacaoInterna' => 'NF-e histórica importada e vinculada ao pedido original. Não movimentou estoque e não gerou financeiro. A baixa depende de autorização manual.',
        'criadoEm' => gmdate('c'),
        'atualizadoEm' => gmdate('c'),
    ];
}
function dfeArquivar(PDO $pdo, array $pedido, string $xml, string $schema, string $nsu, string $ambiente): bool {
    $chave = (string)$pedido['chaveAcessoNotaFiscal'];
    $check = $pdo->prepare('SELECT id FROM erp_nfe_emitidas WHERE chave=:chave LIMIT 1');
    $check->execute(['chave' => $chave]);
    $existia = (bool)$check->fetchColumn();
    $stmt = $pdo->prepare("INSERT INTO erp_nfe_emitidas
        (chave,nsu,ambiente,numero,serie,protocolo,emitida_em,destinatario_documento,destinatario_nome,valor_total,schema_dfe,xml,status_importacao)
        VALUES (:chave,:nsu,:ambiente,:numero,:serie,:protocolo,:emitida_em,:doc,:nome,:valor,:schema,:xml,'ARQUIVADA')
        ON DUPLICATE KEY UPDATE nsu=VALUES(nsu), protocolo=VALUES(protocolo), xml=VALUES(xml), schema_dfe=VALUES(schema_dfe), updated_at=CURRENT_TIMESTAMP");
    $stmt->execute([
        'chave' => $chave,
        'nsu' => $nsu,
        'ambiente' => $ambiente,
        'numero' => (string)($pedido['numeroNotaFiscal'] ?? ''),
        'serie' => (string)($pedido['serieNotaFiscal'] ?? ''),
        'protocolo' => (string)($pedido['protocoloNotaFiscal'] ?? ''),
        'emitida_em' => dfeDataMysql((string)($pedido['dataEmissaoNotaFiscal'] ?? '')),
        'doc' => (string)($pedido['clienteDocumento'] ?? ''),
        'nome' => (string)($pedido['clienteNome'] ?? ''),
        'valor' => (float)($pedido['totalFinal'] ?? 0),
        'schema' => $schema,
        'xml' => $xml,
    ]);
    return !$existia;
}
function dfeTipoDocumento(string $schema, string $xml): string {
    $schemaLower = strtolower($schema);
    if (str_contains($schemaLower, 'procnfe') || str_contains($xml, '<nfeProc')) return 'XML_COMPLETO';
    if (str_contains($schemaLower, 'resnfe') || str_contains($xml, '<resNFe')) return 'RESUMO_NFE';
    if (str_contains($schemaLower, 'resevento') || str_contains($xml, '<resEvento')) return 'RESUMO_EVENTO';
    if (str_contains($schemaLower, 'procevento') || str_contains($xml, '<procEventoNFe')) return 'EVENTO_COMPLETO';
    return 'OUTRO';
}
function dfeArquivarDocumentoBruto(PDO $pdo, string $ambiente, string $nsu, string $schema, string $xml): array {
    $doc = new DOMDocument();
    @$doc->loadXML($xml, LIBXML_NONET | LIBXML_NOBLANKS);
    $xp = new DOMXPath($doc);
    $chave = dfeDigits(dfeNodeText($xp, 'chNFe'));
    if (strlen($chave) !== 44) {
        $inf = $xp->query('//*[local-name()="infNFe"]')->item(0);
        if ($inf instanceof DOMElement) $chave = dfeDigits(str_replace('NFe', '', $inf->getAttribute('Id')));
    }
    $emit = $xp->query('//*[local-name()="emit"]')->item(0);
    $cnpjEmitente = $emit ? dfeDigits(dfeNodeText($xp, 'CNPJ', $emit)) : dfeDigits(dfeNodeText($xp, 'CNPJ'));
    $tipo = dfeTipoDocumento($schema, $xml);
    $stmt = $pdo->prepare("INSERT INTO erp_nfe_dfe_documentos (ambiente,nsu,schema_dfe,tipo_documento,chave,cnpj_emitente,xml)
        VALUES (:ambiente,:nsu,:schema,:tipo,:chave,:cnpj,:xml)
        ON DUPLICATE KEY UPDATE schema_dfe=VALUES(schema_dfe),tipo_documento=VALUES(tipo_documento),chave=VALUES(chave),cnpj_emitente=VALUES(cnpj_emitente),xml=VALUES(xml),recebido_em=CURRENT_TIMESTAMP");
    $stmt->execute(['ambiente'=>$ambiente,'nsu'=>$nsu,'schema'=>$schema,'tipo'=>$tipo,'chave'=>$chave,'cnpj'=>$cnpjEmitente,'xml'=>$xml]);
    return ['tipo'=>$tipo,'chave'=>$chave,'cnpjEmitente'=>$cnpjEmitente];
}
function dfeParseLote(string $soap, PDO $pdo, string $cnpjEmitente, string $ambiente): array {
    $doc = new DOMDocument();
    if (!@$doc->loadXML($soap, LIBXML_NONET | LIBXML_NOBLANKS)) throw new RuntimeException('Resposta XML inválida da SEFAZ.');
    $xp = new DOMXPath($doc);
    $cStat = dfeNodeText($xp, 'cStat');
    $motivo = dfeNodeText($xp, 'xMotivo');
    $ultNsu = dfeNodeText($xp, 'ultNSU') ?: '000000000000000';
    $maxNsu = dfeNodeText($xp, 'maxNSU') ?: $ultNsu;
    $pedidos = [];
    $rejeitados = [];
    $novos = 0;
    $recebidos = 0;
    $xmlCompletos = 0;
    $resumosNFe = 0;
    $eventos = 0;
    $outros = 0;
    $emitenteDiferente = 0;
    $docs = $xp->query('//*[local-name()="docZip"]');
    if ($docs) foreach ($docs as $index => $docZip) {
        $recebidos++;
        $nsu = $docZip instanceof DOMElement ? $docZip->getAttribute('NSU') : '';
        $schema = $docZip instanceof DOMElement ? $docZip->getAttribute('schema') : '';
        $compressed = base64_decode(trim((string)$docZip->textContent), true);
        $xml = is_string($compressed) ? @gzdecode($compressed) : false;
        if (!is_string($xml) || $xml === '') {
            $rejeitados[] = ['indice' => $index + 1, 'motivo' => 'Documento compactado inválido.', 'nsu'=>$nsu, 'schema'=>$schema];
            continue;
        }
        $meta = dfeArquivarDocumentoBruto($pdo, $ambiente, $nsu, $schema, $xml);
        if ($meta['tipo'] === 'XML_COMPLETO') $xmlCompletos++;
        elseif ($meta['tipo'] === 'RESUMO_NFE') $resumosNFe++;
        elseif (in_array($meta['tipo'], ['RESUMO_EVENTO','EVENTO_COMPLETO'], true)) $eventos++;
        else $outros++;

        $pedido = dfePedidoDoXml($xml, $nsu, 'SEFAZ_DFE');
        if (!$pedido) continue;
        $xmlDoc = new DOMDocument();
        if (!@$xmlDoc->loadXML($xml, LIBXML_NONET | LIBXML_NOBLANKS)) continue;
        $xmlXp = new DOMXPath($xmlDoc);
        $emitCnpj = dfeDigits(dfeNodeText($xmlXp, 'CNPJ', $xmlXp->query('//*[local-name()="emit"]')->item(0)));
        if ($emitCnpj !== $cnpjEmitente) { $emitenteDiferente++; continue; }
        if (dfeArquivar($pdo, $pedido, $xml, $schema, $nsu, $ambiente)) {
            $pedidos[] = $pedido;
            $novos++;
        }
    }
    return compact('cStat','motivo','ultNsu','maxNsu','pedidos','rejeitados','novos','recebidos','xmlCompletos','resumosNFe','eventos','outros','emitenteDiferente');
}
function dfeGarantirControleConsulta(PDO $pdo): void {
    $colunas = [
        'bloqueado_ate' => "DATETIME NULL",
        'consulta_em_andamento' => "TINYINT(1) NOT NULL DEFAULT 0",
        'consulta_iniciada_em' => "DATETIME NULL",
        'ultima_tentativa_em' => "DATETIME NULL",
        'cnpj_consultado' => "VARCHAR(20) NOT NULL DEFAULT ''",
    ];
    foreach ($colunas as $nome => $definicao) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'erp_nfe_emitidas_sync' AND COLUMN_NAME = :nome");
        $stmt->execute(['nome' => $nome]);
        if ((int)$stmt->fetchColumn() === 0) {
            $colunaSegura = str_replace('`', '', $nome);
            $pdo->exec("ALTER TABLE erp_nfe_emitidas_sync ADD COLUMN `{$colunaSegura}` {$definicao}");
        }
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS erp_nfe_dfe_consultas_log (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ambiente VARCHAR(20) NOT NULL,
        cnpj VARCHAR(20) NOT NULL DEFAULT '',
        ult_nsu_enviado VARCHAR(20) NOT NULL DEFAULT '',
        cstat VARCHAR(10) NOT NULL DEFAULT '',
        motivo VARCHAR(500) NOT NULL DEFAULT '',
        ult_nsu_retorno VARCHAR(20) NOT NULL DEFAULT '',
        max_nsu_retorno VARCHAR(20) NOT NULL DEFAULT '',
        documentos_recebidos INT NOT NULL DEFAULT 0,
        chamada_sefaz TINYINT(1) NOT NULL DEFAULT 0,
        http_status INT NOT NULL DEFAULT 0,
        erro_tecnico TEXT NULL,
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_dfe_log_ambiente_data (ambiente, criado_em)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function dfeDataIso(?string $mysql): ?string {
    if (!$mysql) return null;
    try { return (new DateTimeImmutable($mysql, new DateTimeZone('America/Sao_Paulo')))->format(DATE_ATOM); }
    catch (Throwable) { return null; }
}
function dfeRegistrarConsulta(PDO $pdo, array $dados): void {
    $stmt = $pdo->prepare("INSERT INTO erp_nfe_dfe_consultas_log
        (ambiente,cnpj,ult_nsu_enviado,cstat,motivo,ult_nsu_retorno,max_nsu_retorno,documentos_recebidos,chamada_sefaz,http_status,erro_tecnico)
        VALUES (:ambiente,:cnpj,:ult,:cstat,:motivo,:ultRet,:maxRet,:docs,:chamada,:http,:erro)");
    $stmt->execute([
        'ambiente'=>(string)($dados['ambiente'] ?? ''), 'cnpj'=>(string)($dados['cnpj'] ?? ''),
        'ult'=>(string)($dados['ult'] ?? ''), 'cstat'=>(string)($dados['cstat'] ?? ''),
        'motivo'=>mb_substr((string)($dados['motivo'] ?? ''),0,500),
        'ultRet'=>(string)($dados['ultRet'] ?? ''), 'maxRet'=>(string)($dados['maxRet'] ?? ''),
        'docs'=>(int)($dados['docs'] ?? 0), 'chamada'=>(int)($dados['chamada'] ?? 0),
        'http'=>(int)($dados['http'] ?? 0), 'erro'=>(string)($dados['erro'] ?? ''),
    ]);
}
function dfeEstadoConsulta(): never {
    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) $body = [];
    $ambiente = strtoupper(dfeTxt($body['ambiente'] ?? 'PRODUCAO')) === 'HOMOLOGACAO' ? 'HOMOLOGACAO' : 'PRODUCAO';
    $pdo = obterPdo();
    dfeGarantirTabelas($pdo);
    dfeGarantirControleConsulta($pdo);

    $material = dfeMaterialA1();
    $cnpj = dfeCnpjCertificado($material);
    $pdo->prepare("INSERT INTO erp_nfe_emitidas_sync (ambiente,ult_nsu,max_nsu,cnpj_consultado) VALUES (:ambiente,'000000000000000','000000000000000',:cnpj) ON DUPLICATE KEY UPDATE cnpj_consultado=VALUES(cnpj_consultado)")
        ->execute(['ambiente'=>$ambiente,'cnpj'=>$cnpj]);

    $stmt = $pdo->prepare('SELECT ult_nsu,max_nsu,ultimo_cstat,ultima_mensagem,bloqueado_ate,cnpj_consultado FROM erp_nfe_emitidas_sync WHERE ambiente=:ambiente LIMIT 1');
    $stmt->execute(['ambiente'=>$ambiente]);
    $sync = $stmt->fetch() ?: [];
    $agora = new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo'));
    $bloqueadoAte = !empty($sync['bloqueado_ate']) ? new DateTimeImmutable((string)$sync['bloqueado_ate'], new DateTimeZone('America/Sao_Paulo')) : null;
    $bloqueado = $bloqueadoAte && $bloqueadoAte > $agora;

    dfeOut(200, [
        'ok'=>true,
        'codigo'=>(string)($sync['ultimo_cstat'] ?? ''),
        'mensagem'=>(string)($sync['ultima_mensagem'] ?? 'Nenhuma consulta realizada neste ambiente.'),
        'cnpjConsultado'=>(string)($sync['cnpj_consultado'] ?: $cnpj),
        'ambienteConsulta'=>$ambiente,
        'ultNSU'=>str_pad(dfeDigits($sync['ult_nsu'] ?? ''),15,'0',STR_PAD_LEFT),
        'maxNSU'=>str_pad(dfeDigits($sync['max_nsu'] ?? ''),15,'0',STR_PAD_LEFT),
        'proximaConsultaEm'=>$bloqueado ? $bloqueadoAte->format(DATE_ATOM) : null,
        'servidorAgora'=>$agora->format(DATE_ATOM),
        'chamadaSefazExecutada'=>false,
        'documentosRecebidos'=>0,'xmlCompletos'=>0,'resumosNFe'=>0,'eventosRecebidos'=>0,'outrosDocumentos'=>0,'nsuAvancou'=>false,
    ]);
}


function dfeListarDocumentos(): never {
    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) $body = [];
    $ambiente = strtoupper(dfeTxt($body['ambiente'] ?? 'HOMOLOGACAO')) === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO';
    $pdo = obterPdo();
    dfeGarantirTabelas($pdo);
    $material = dfeMaterialA1();
    $cnpjProprio = dfeCnpjCertificado($material);

    $stmt = $pdo->prepare("SELECT id,ambiente,nsu,schema_dfe,tipo_documento,chave,cnpj_emitente,xml,recebido_em
        FROM erp_nfe_dfe_documentos
        WHERE ambiente=:ambiente AND REPLACE(REPLACE(REPLACE(cnpj_emitente,'.',''),'/',''),'-','')=:cnpj
        ORDER BY id DESC LIMIT 500");
    $stmt->execute(['ambiente'=>$ambiente,'cnpj'=>$cnpjProprio]);
    $documentos = [];

    foreach ($stmt->fetchAll() as $row) {
        $xml = (string)($row['xml'] ?? '');
        $doc = new DOMDocument();
        $carregou = @$doc->loadXML($xml, LIBXML_NONET | LIBXML_NOBLANKS);
        $xp = $carregou ? new DOMXPath($doc) : null;
        $texto = static function(string $nome, ?DOMNode $context = null) use ($xp): string {
            if (!$xp) return '';
            $query = $context ? './/*[local-name()="'.$nome.'"]' : '//*[local-name()="'.$nome.'"]';
            $nodes = $xp->query($query, $context);
            return $nodes && $nodes->length ? trim((string)$nodes->item(0)?->textContent) : '';
        };
        $emit = $xp ? $xp->query('//*[local-name()="emit"]')->item(0) : null;
        $ide = $xp ? $xp->query('//*[local-name()="ide"]')->item(0) : null;
        $prot = $xp ? $xp->query('//*[local-name()="protNFe"]')->item(0) : null;
        $numero = $texto('nNF', $ide);
        $serie = $texto('serie', $ide);
        $emissao = $texto('dhEmi', $ide) ?: $texto('dEmi', $ide) ?: $texto('dhEmi');
        $emitenteNome = $texto('xNome', $emit) ?: $texto('xNome');
        $emitenteDoc = $texto('CNPJ', $emit) ?: $texto('CPF', $emit) ?: (string)($row['cnpj_emitente'] ?? '');
        if (dfeDigits($emitenteDoc) !== $cnpjProprio) continue;
        $valor = $texto('vNF') ?: '0';
        $chave = dfeDigits((string)($row['chave'] ?? ''));
        if (strlen($chave) !== 44) $chave = dfeDigits($texto('chNFe'));
        $documentos[] = [
            'id'=>(string)$row['id'],
            'ambiente'=>(string)$row['ambiente'],
            'nsu'=>(string)$row['nsu'],
            'schema'=>(string)$row['schema_dfe'],
            'tipo'=>(string)$row['tipo_documento'],
            'chave'=>$chave,
            'numero'=>$numero,
            'serie'=>$serie,
            'emitenteNome'=>$emitenteNome,
            'emitenteDocumento'=>$emitenteDoc,
            'emissao'=>$emissao,
            'valor'=>(float)str_replace(',', '.', $valor),
            'protocolo'=>$texto('nProt', $prot),
            'cStat'=>$texto('cStat', $prot) ?: $texto('cStat'),
            'motivo'=>$texto('xMotivo', $prot) ?: $texto('xMotivo'),
            'recebidoEm'=>(string)$row['recebido_em'],
            'xmlCompleto'=>(string)$row['tipo_documento'] === 'XML_COMPLETO',
        ];
    }

    $totais = ['total'=>0,'xmlCompletos'=>0,'resumosNFe'=>0,'eventos'=>0,'outros'=>0];
    foreach ($documentos as $item) {
        $totais['total']++;
        if ($item['tipo'] === 'XML_COMPLETO') $totais['xmlCompletos']++;
        elseif ($item['tipo'] === 'RESUMO_NFE') $totais['resumosNFe']++;
        elseif (in_array($item['tipo'], ['RESUMO_EVENTO','EVENTO_COMPLETO'], true)) $totais['eventos']++;
        else $totais['outros']++;
    }

    dfeOut(200, [
        'ok'=>true,
        'mensagem'=>'Somente NF-e emitidas pelo CNPJ do certificado foram carregadas do MySQL.',
        'cnpjEmitenteFiltrado'=>$cnpjProprio,
        'ambienteConsulta'=>$ambiente,
        'documentos'=>$documentos,
        'totais'=>$totais,
        'chamadaSefazExecutada'=>false,
    ]);
}

function dfeSincronizar(): never {
    @set_time_limit(230);
    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) $body = [];
    $ambiente = strtoupper(dfeTxt($body['ambiente'] ?? 'PRODUCAO')) === 'HOMOLOGACAO' ? 'HOMOLOGACAO' : 'PRODUCAO';
    $tpAmb = $ambiente === 'HOMOLOGACAO' ? 2 : 1;
    $pdo = obterPdo();
    dfeGarantirTabelas($pdo);
    dfeGarantirControleConsulta($pdo);
    $material = dfeMaterialA1();
    $cnpj = dfeCnpjCertificado($material);
    $lockName = 'synergias_dfe_' . strtolower($ambiente);
    $lock = $pdo->prepare('SELECT GET_LOCK(:nome, 0)');
    $lock->execute(['nome'=>$lockName]);
    if ((int)$lock->fetchColumn() !== 1) {
        dfeOut(409, ['ok'=>false,'codigo'=>'CONSULTA_EM_ANDAMENTO','mensagem'=>'Já existe uma consulta SEFAZ em andamento para este ambiente.','cnpjConsultado'=>$cnpj,'ambienteConsulta'=>$ambiente,'chamadaSefazExecutada'=>false]);
    }
    $ultNsuPersistido = '000000000000000';
    $maxNsuPersistido = '000000000000000';
    try {
        $pdo->prepare("INSERT INTO erp_nfe_emitidas_sync (ambiente,ult_nsu,max_nsu,cnpj_consultado) VALUES (:ambiente,'000000000000000','000000000000000',:cnpj) ON DUPLICATE KEY UPDATE cnpj_consultado=VALUES(cnpj_consultado)")
            ->execute(['ambiente'=>$ambiente,'cnpj'=>$cnpj]);
        $stmt = $pdo->prepare('SELECT ult_nsu,max_nsu,bloqueado_ate,consulta_em_andamento,consulta_iniciada_em FROM erp_nfe_emitidas_sync WHERE ambiente=:ambiente LIMIT 1');
        $stmt->execute(['ambiente'=>$ambiente]);
        $sync = $stmt->fetch() ?: [];
        $ultNsuPersistido = str_pad(dfeDigits($sync['ult_nsu'] ?? ''),15,'0',STR_PAD_LEFT);
        $maxNsuPersistido = str_pad(dfeDigits($sync['max_nsu'] ?? ''),15,'0',STR_PAD_LEFT);
        $agora = new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo'));
        $bloqueadoAte = !empty($sync['bloqueado_ate']) ? new DateTimeImmutable((string)$sync['bloqueado_ate'], new DateTimeZone('America/Sao_Paulo')) : null;
        if ($bloqueadoAte && $bloqueadoAte > $agora) {
            dfeRegistrarConsulta($pdo,['ambiente'=>$ambiente,'cnpj'=>$cnpj,'ult'=>$ultNsuPersistido,'cstat'=>'656','motivo'=>'Consulta bloqueada localmente até o prazo oficial.','chamada'=>0,'http'=>429]);
            dfeOut(429,[
                'ok'=>false,'codigo'=>'656','mensagem'=>'Consulta bloqueada para evitar Consumo Indevido. Aguarde até o horário informado.',
                'cnpjConsultado'=>$cnpj,'ambienteConsulta'=>$ambiente,'ultNSU'=>$ultNsuPersistido,'maxNSU'=>$maxNsuPersistido,
                'proximaConsultaEm'=>$bloqueadoAte->format(DATE_ATOM),'servidorAgora'=>$agora->format(DATE_ATOM),
                'chamadaSefazExecutada'=>false,'documentosRecebidos'=>0,'xmlCompletos'=>0,'resumosNFe'=>0,'eventosRecebidos'=>0,'outrosDocumentos'=>0,'nsuAvancou'=>false,
            ]);
        }
        $pdo->prepare('UPDATE erp_nfe_emitidas_sync SET consulta_em_andamento=1,consulta_iniciada_em=NOW(),ultima_tentativa_em=NOW(),cnpj_consultado=:cnpj WHERE ambiente=:ambiente')
            ->execute(['cnpj'=>$cnpj,'ambiente'=>$ambiente]);
        $resposta = dfeTransmitir($material, $cnpj, $ultNsuPersistido, $tpAmb);
        $lote = dfeParseLote($resposta, $pdo, $cnpj, $ambiente);
        $cStat=(string)$lote['cStat']; $motivo=(string)$lote['motivo'];
        $novoUlt=str_pad(dfeDigits($lote['ultNsu']),15,'0',STR_PAD_LEFT);
        $maxRet=str_pad(dfeDigits($lote['maxNsu']),15,'0',STR_PAD_LEFT);
        $consultaValida=in_array($cStat,['137','138'],true);
        $ultParaSalvar=$consultaValida ? $novoUlt : $ultNsuPersistido;
        $maxParaSalvar=($consultaValida && $maxRet !== '000000000000000') ? $maxRet : $maxNsuPersistido;
        $proximaConsulta=null;
        if (in_array($cStat,['137','656'],true)) $proximaConsulta=$agora->modify('+1 hour');
        $up=$pdo->prepare("UPDATE erp_nfe_emitidas_sync SET ult_nsu=:ult,max_nsu=:max,ultimo_cstat=:cstat,ultima_mensagem=:mensagem,bloqueado_ate=:bloqueado,consulta_em_andamento=0,consulta_iniciada_em=NULL,cnpj_consultado=:cnpj WHERE ambiente=:ambiente");
        $up->execute(['ult'=>$ultParaSalvar,'max'=>$maxParaSalvar,'cstat'=>$cStat,'mensagem'=>$motivo,'bloqueado'=>$proximaConsulta?->format('Y-m-d H:i:s'),'cnpj'=>$cnpj,'ambiente'=>$ambiente]);
        dfeRegistrarConsulta($pdo,['ambiente'=>$ambiente,'cnpj'=>$cnpj,'ult'=>$ultNsuPersistido,'cstat'=>$cStat,'motivo'=>$motivo,'ultRet'=>$novoUlt,'maxRet'=>$maxRet,'docs'=>(int)$lote['recebidos'],'chamada'=>1,'http'=>200]);
        $statusHttp=$cStat==='656' ? 429 : 200;
        dfeOut($statusHttp,[
            'ok'=>$consultaValida,'mensagem'=>$motivo !== '' ? $motivo : 'Consulta concluída.','codigo'=>$cStat,
            'cnpjConsultado'=>$cnpj,'pedidos'=>$lote['pedidos'],'totalPedidosHistoricos'=>count($lote['pedidos']),'rejeitados'=>$lote['rejeitados'],
            'ultNSU'=>$ultParaSalvar,'maxNSU'=>$maxParaSalvar,'lotesConsultados'=>1,
            'documentosRecebidos'=>(int)$lote['recebidos'],'xmlCompletos'=>(int)$lote['xmlCompletos'],'resumosNFe'=>(int)$lote['resumosNFe'],
            'eventosRecebidos'=>(int)$lote['eventos'],'outrosDocumentos'=>(int)$lote['outros'],'documentosOutroEmitente'=>(int)$lote['emitenteDiferente'],
            'nsuAvancou'=>$consultaValida && $ultParaSalvar !== $ultNsuPersistido,'movimentouEstoque'=>false,'gerouFinanceiro'=>false,'alterouPedidosExistentes'=>false,
            'ambienteConsulta'=>$ambiente,'proximaConsultaEm'=>$proximaConsulta?->format(DATE_ATOM),'servidorAgora'=>$agora->format(DATE_ATOM),'chamadaSefazExecutada'=>true,
        ]);
    } catch (Throwable $e) {
        try {
            $pdo->prepare('UPDATE erp_nfe_emitidas_sync SET consulta_em_andamento=0,consulta_iniciada_em=NULL WHERE ambiente=:ambiente')->execute(['ambiente'=>$ambiente]);
            dfeRegistrarConsulta($pdo,['ambiente'=>$ambiente,'cnpj'=>$cnpj,'ult'=>$ultNsuPersistido,'cstat'=>'ERRO','motivo'=>'Falha técnica','chamada'=>1,'http'=>500,'erro'=>$e->getMessage()]);
        } catch (Throwable) {}
        dfeOut(500,['ok'=>false,'codigo'=>'ERRO_TECNICO','mensagem'=>$e->getMessage(),'cnpjConsultado'=>$cnpj,'ambienteConsulta'=>$ambiente,'ultNSU'=>$ultNsuPersistido,'maxNSU'=>$maxNsuPersistido,'chamadaSefazExecutada'=>true,'documentosRecebidos'=>0,'xmlCompletos'=>0,'resumosNFe'=>0,'eventosRecebidos'=>0,'outrosDocumentos'=>0,'nsuAvancou'=>false,'proximaConsultaEm'=>null]);
    } finally {
        try { $pdo->prepare('SELECT RELEASE_LOCK(:nome)')->execute(['nome'=>$lockName]); } catch (Throwable) {}
    }
}
function dfeImportarXml(): never {
    $body = json_decode((string)file_get_contents('php://input'), true);
    $xmls = is_array($body) && is_array($body['xmls'] ?? null) ? $body['xmls'] : [];
    if (count($xmls) > 100) dfeOut(422, ['ok'=>false,'mensagem'=>'Envie no máximo 100 XML por lote.']);
    $pdo = obterPdo();
    dfeGarantirTabelas($pdo);
    $material = dfeMaterialA1();
    $cnpj = dfeCnpjCertificado($material);
    $pedidos=[]; $rejeitados=[];
    foreach ($xmls as $i => $xml) {
        if (!is_string($xml) || strlen($xml) > 5_000_000) { $rejeitados[]=['indice'=>$i+1,'motivo'=>'XML ausente ou acima de 5 MB.']; continue; }
        $pedido = dfePedidoDoXml($xml, '', 'XML_NFE');
        if (!$pedido) { $rejeitados[]=['indice'=>$i+1,'motivo'=>'XML não contém NF-e processada completa.']; continue; }
        $doc = new DOMDocument(); @$doc->loadXML($xml, LIBXML_NONET | LIBXML_NOBLANKS); $xp = new DOMXPath($doc);
        $emitCnpj = dfeDigits(dfeNodeText($xp, 'CNPJ', $xp->query('//*[local-name()="emit"]')->item(0)));
        if ($emitCnpj !== $cnpj) { $rejeitados[]=['indice'=>$i+1,'motivo'=>'XML não foi emitido pelo CNPJ do certificado A1.']; continue; }
        $ambiente = ($pedido['ambienteNotaFiscal'] ?? '') === 'HOMOLOGACAO' ? 'HOMOLOGACAO' : 'PRODUCAO';
        if (dfeArquivar($pdo, $pedido, $xml, 'importacao_manual', '', $ambiente)) $pedidos[]=$pedido;
    }
    dfeOut(200,['ok'=>true,'mensagem'=>'XML processados com segurança.','pedidos'=>$pedidos,'totalPedidosHistoricos'=>count($pedidos),'rejeitados'=>$rejeitados,'movimentouEstoque'=>false,'gerouFinanceiro'=>false,'alterouPedidosExistentes'=>false]);
}

try {
    dfeAdmin();
    dfeValidarOrigem();
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') dfeOut(405, ['ok'=>false,'mensagem'=>'Método não permitido.']);
    $action = strtolower(dfeTxt($_GET['action'] ?? 'sincronizar'));
    if ($action === 'estado') dfeEstadoConsulta();
    if ($action === 'listar-documentos') dfeListarDocumentos();
    if ($action === 'sincronizar') dfeSincronizar();
    if ($action === 'importar-xml') dfeImportarXml();
    dfeOut(404, ['ok'=>false,'mensagem'=>'Ação fiscal não encontrada.']);
} catch (Throwable $e) {
    error_log('[Synergias ERP DFe] ' . $e->getMessage());
    dfeOut(500, ['ok'=>false,'mensagem'=>$e->getMessage()]);
}
