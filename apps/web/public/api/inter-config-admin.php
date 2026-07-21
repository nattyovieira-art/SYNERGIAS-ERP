<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function interAdminResponder(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function interAdminUsuario(): array {
    $usuario = exigirAutenticacao();
    if (strcasecmp((string)($usuario['perfil'] ?? ''), 'Administrador') !== 0) {
        interAdminResponder(403, ['ok' => false, 'error' => 'Apenas Administrador pode configurar o Banco Inter.']);
    }
    return $usuario;
}

function interAdminValidarOrigem(): void {
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') return;
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    if ($host === '' || $originHost === '' || !hash_equals($host, $originHost)) {
        interAdminResponder(403, ['ok' => false, 'error' => 'Origem não autorizada.']);
    }
}

function interAdminHome(): string {
    $home = rtrim((string)(getenv('HOME') ?: ''), '/\\');
    if ($home !== '' && is_dir($home) && is_writable($home)) return $home;

    $docRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
    if ($docRoot !== '') {
        $parent = dirname($docRoot);
        if (is_dir($parent) && is_writable($parent)) return $parent;
    }

    throw new RuntimeException('Diretório privado do servidor indisponível para gravação.');
}

function interAdminDiretorio(): string {
    return interAdminHome() . '/synergias_private/inter';
}

function interAdminGarantirDiretorio(string $dir): void {
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Não foi possível criar o diretório privado do Banco Inter.');
    }
    @chmod($dir, 0700);
    @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n", LOCK_EX);
    @file_put_contents($dir . '/index.html', '', LOCK_EX);
    @chmod($dir . '/.htaccess', 0600);
    @chmod($dir . '/index.html', 0600);
}

function interAdminUpload(string $campo, int $maxBytes): array {
    if (!isset($_FILES[$campo]) || !is_array($_FILES[$campo])) {
        throw new RuntimeException("Selecione o arquivo {$campo}.");
    }
    $arquivo = $_FILES[$campo];
    $erro = (int)($arquivo['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($erro !== UPLOAD_ERR_OK) throw new RuntimeException("Falha no upload de {$campo} (código {$erro}).");
    $tamanho = (int)($arquivo['size'] ?? 0);
    if ($tamanho <= 0 || $tamanho > $maxBytes) throw new RuntimeException("O arquivo {$campo} está vazio ou excede o limite permitido.");
    $tmp = (string)($arquivo['tmp_name'] ?? '');
    if ($tmp === '' || !is_uploaded_file($tmp)) throw new RuntimeException("Upload inválido para {$campo}.");
    $conteudo = file_get_contents($tmp);
    if (!is_string($conteudo) || $conteudo === '') throw new RuntimeException("Não foi possível ler {$campo}.");
    return ['name' => basename((string)($arquivo['name'] ?? $campo)), 'content' => $conteudo];
}

function interAdminTexto(string $campo, int $max, bool $obrigatorio = true): string {
    $valor = trim((string)($_POST[$campo] ?? ''));
    if ($obrigatorio && $valor === '') throw new RuntimeException("Informe {$campo}.");
    if (strlen($valor) > $max) throw new RuntimeException("O campo {$campo} excede o tamanho permitido.");
    return $valor;
}

function interAdminSomenteDigitos(string $valor): string {
    return (string)preg_replace('/\D+/', '', $valor);
}

function interAdminAuditar(string $acao, string $resultado): void {
    try {
        $dir = interAdminDiretorio();
        interAdminGarantirDiretorio($dir);
        $usuario = usuarioAutenticado();
        $registro = [
            'em' => gmdate('c'),
            'acao' => $acao,
            'resultado' => $resultado,
            'usuario' => (string)($usuario['usuario'] ?? ''),
            'ipHash' => hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '')),
        ];
        @file_put_contents($dir . '/auditoria.log', json_encode($registro, JSON_UNESCAPED_UNICODE) . PHP_EOL, FILE_APPEND | LOCK_EX);
        @chmod($dir . '/auditoria.log', 0600);
    } catch (Throwable $ignored) {}
}

function interAdminGerarCsr(): void {
    if (!function_exists('openssl_pkey_new') || !function_exists('openssl_csr_new')) {
        throw new RuntimeException('A extensão OpenSSL do PHP não está disponível no servidor.');
    }

    $razaoSocial = interAdminTexto('razaoSocial', 180);
    $cnpj = interAdminSomenteDigitos(interAdminTexto('cnpj', 30));
    if (strlen($cnpj) !== 14) throw new RuntimeException('Informe um CNPJ válido com 14 dígitos.');

    $dir = interAdminDiretorio();
    interAdminGarantirDiretorio($dir);

    $configOpenSsl = [
        'private_key_bits' => 2048,
        'private_key_type' => OPENSSL_KEYTYPE_RSA,
        'digest_alg' => 'sha256',
    ];
    $privateKey = openssl_pkey_new($configOpenSsl);
    if ($privateKey === false) throw new RuntimeException('Não foi possível gerar a chave privada da integração.');

    $dn = [
        'countryName' => 'BR',
        'stateOrProvinceName' => 'Rio Grande do Sul',
        'localityName' => 'Porto Alegre',
        'organizationName' => $razaoSocial,
        'organizationalUnitName' => 'SYNERGIAS ERP',
        'commonName' => $cnpj,
    ];
    $csr = openssl_csr_new($dn, $privateKey, $configOpenSsl);
    if ($csr === false) throw new RuntimeException('Não foi possível gerar a solicitação CSR.');

    $keyPem = '';
    $csrPem = '';
    if (!openssl_pkey_export($privateKey, $keyPem, null, $configOpenSsl) || $keyPem === '') {
        throw new RuntimeException('Não foi possível proteger a chave privada gerada.');
    }
    if (!openssl_csr_export($csr, $csrPem) || $csrPem === '') {
        throw new RuntimeException('Não foi possível exportar o arquivo CSR.');
    }

    $keyPath = $dir . '/inter-chave.key';
    $csrPath = $dir . '/inter-solicitacao.csr';
    foreach ([$keyPath, $csrPath] as $arquivo) {
        if (is_file($arquivo)) @copy($arquivo, $arquivo . '.bak-' . gmdate('Ymd-His'));
    }
    if (file_put_contents($keyPath, $keyPem, LOCK_EX) === false) throw new RuntimeException('Falha ao gravar a chave privada no servidor.');
    if (file_put_contents($csrPath, $csrPem, LOCK_EX) === false) throw new RuntimeException('Falha ao gravar o CSR no servidor.');
    @chmod($keyPath, 0600);
    @chmod($csrPath, 0600);

    interAdminAuditar('GERAR_CSR_BANCO_INTER', 'SUCESSO');
    interAdminResponder(200, [
        'ok' => true,
        'message' => 'Chave privada criada e guardada no servidor. Baixe o CSR e use-o na nova integração do Banco Inter.',
        'csrBase64' => base64_encode($csrPem),
        'fileName' => 'SYNERGIAS_BANCO_INTER_' . $cnpj . '.csr',
    ]);
}



function interAdminLerPacoteCertificado(): array {
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('A extensão ZIP do PHP não está disponível no servidor.');
    }
    if (!isset($_FILES['pacoteCertificado']) || !is_array($_FILES['pacoteCertificado'])) {
        throw new RuntimeException('Selecione o ZIP com o certificado e a chave do Banco Inter.');
    }
    $arquivo = $_FILES['pacoteCertificado'];
    $erro = (int)($arquivo['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($erro !== UPLOAD_ERR_OK) throw new RuntimeException("Falha no upload do ZIP (código {$erro}).");
    $tamanho = (int)($arquivo['size'] ?? 0);
    if ($tamanho <= 0 || $tamanho > 5 * 1024 * 1024) throw new RuntimeException('O ZIP está vazio ou excede 5 MB.');
    $tmp = (string)($arquivo['tmp_name'] ?? '');
    if ($tmp === '' || !is_uploaded_file($tmp)) throw new RuntimeException('Upload inválido do ZIP.');

    $zip = new ZipArchive();
    if ($zip->open($tmp) !== true) throw new RuntimeException('Não foi possível abrir o ZIP enviado.');
    $cert = '';
    $key = '';
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $nome = (string)$zip->getNameIndex($i);
        $ext = strtolower(pathinfo($nome, PATHINFO_EXTENSION));
        if ($ext === 'crt' && $cert === '') $cert = (string)$zip->getFromIndex($i);
        if ($ext === 'key' && $key === '') $key = (string)$zip->getFromIndex($i);
    }
    $zip->close();
    if ($cert === '' || $key === '') throw new RuntimeException('O ZIP precisa conter um arquivo .crt e um arquivo .key.');
    return ['cert' => $cert, 'key' => $key];
}

function interAdminTestarIntegracaoTemporaria(): void {
    if (!function_exists('curl_init')) throw new RuntimeException('A extensão cURL do PHP não está disponível no servidor.');

    $pacote = interAdminLerPacoteCertificado();
    $clientId = interAdminTexto('clientIdTeste', 200);
    $clientSecret = interAdminTexto('clientSecretTeste', 500);

    $certResource = @openssl_x509_read($pacote['cert']);
    if ($certResource === false) throw new RuntimeException('O .crt do ZIP não é um certificado X.509 válido.');
    $keyResource = @openssl_pkey_get_private($pacote['key']);
    if ($keyResource === false) throw new RuntimeException('O .key do ZIP não é uma chave privada válida.');
    if (!@openssl_x509_check_private_key($certResource, $keyResource)) {
        throw new RuntimeException('O certificado e a chave do ZIP não pertencem ao mesmo par.');
    }

    $dir = interAdminDiretorio() . '/teste-temporario';
    interAdminGarantirDiretorio($dir);
    $sufixo = bin2hex(random_bytes(8));
    $certPath = $dir . '/cert-' . $sufixo . '.crt';
    $keyPath = $dir . '/key-' . $sufixo . '.key';
    if (file_put_contents($certPath, $pacote['cert'], LOCK_EX) === false || file_put_contents($keyPath, $pacote['key'], LOCK_EX) === false) {
        throw new RuntimeException('Não foi possível preparar os arquivos temporários no servidor.');
    }
    @chmod($certPath, 0600);
    @chmod($keyPath, 0600);

    $tokenUrl = 'https://cdpj.partners.bancointer.com.br/oauth/v2/token';
    $escopos = ['boleto-cobranca.read boleto-cobranca.write', 'cobranca.read cobranca.write'];
    $ultima = ['http' => 0, 'body' => '', 'curlError' => '', 'scope' => ''];

    try {
        foreach ($escopos as $scope) {
            $ch = curl_init($tokenUrl);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query([
                    'client_id' => $clientId,
                    'client_secret' => $clientSecret,
                    'grant_type' => 'client_credentials',
                    'scope' => $scope,
                ]),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
                CURLOPT_SSLCERT => $certPath,
                CURLOPT_SSLKEY => $keyPath,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_CONNECTTIMEOUT => 20,
                CURLOPT_TIMEOUT => 45,
            ]);
            $body = curl_exec($ch);
            $http = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
            $ultima = ['http' => $http, 'body' => is_string($body) ? $body : '', 'curlError' => $curlError, 'scope' => $scope];

            if ($body === false) continue;
            $json = json_decode((string)$body, true);
            if ($http >= 200 && $http < 300 && is_array($json) && !empty($json['access_token'])) {
                interAdminAuditar('TESTAR_INTEGRACAO_TEMPORARIA_BANCO_INTER', 'SUCESSO');
                interAdminResponder(200, [
                    'ok' => true,
                    'authenticated' => true,
                    'httpStatus' => $http,
                    'scopeRequested' => $scope,
                    'scopeReturned' => (string)($json['scope'] ?? ''),
                    'expiresIn' => (int)($json['expires_in'] ?? 0),
                    'message' => 'A outra integração autenticou com sucesso. A integração instalada não foi alterada.',
                ]);
            }
            if (!in_array($http, [400, 401, 403], true)) break;
        }

        $json = json_decode((string)$ultima['body'], true);
        $detalhe = '';
        if (is_array($json)) {
            $detalhe = (string)($json['error_description'] ?? $json['detail'] ?? $json['descricao'] ?? $json['message'] ?? $json['error'] ?? '');
        }
        if ($detalhe === '') $detalhe = $ultima['curlError'] !== '' ? $ultima['curlError'] : mb_substr((string)$ultima['body'], 0, 600);
        interAdminAuditar('TESTAR_INTEGRACAO_TEMPORARIA_BANCO_INTER', 'ERRO_HTTP_' . (string)$ultima['http']);
        interAdminResponder(422, [
            'ok' => false,
            'authenticated' => false,
            'httpStatus' => (int)$ultima['http'],
            'scopeRequested' => (string)$ultima['scope'],
            'error' => $detalhe !== '' ? $detalhe : 'O Banco Inter não confirmou a autenticação.',
        ]);
    } finally {
        @unlink($certPath);
        @unlink($keyPath);
    }
}


function interAdminAtivarIntegracaoTemporaria(): void {
    if (!function_exists('curl_init')) throw new RuntimeException('A extensão cURL do PHP não está disponível no servidor.');
    $pacote = interAdminLerPacoteCertificado();
    $clientId = interAdminTexto('clientIdTeste', 200);
    $clientSecret = interAdminTexto('clientSecretTeste', 500);
    $integrationId = interAdminTexto('integrationId', 200, false);
    $contaCorrente = interAdminSomenteDigitos(interAdminTexto('contaCorrente', 30));
    if ($contaCorrente === '') throw new RuntimeException('Informe a conta corrente do Banco Inter.');

    $certResource = @openssl_x509_read($pacote['cert']);
    $keyResource = @openssl_pkey_get_private($pacote['key']);
    if ($certResource === false || $keyResource === false || !@openssl_x509_check_private_key($certResource, $keyResource)) {
        throw new RuntimeException('O certificado e a chave do ZIP não pertencem ao mesmo par.');
    }

    $dir = interAdminDiretorio();
    interAdminGarantirDiretorio($dir);
    $tempDir = $dir . '/teste-temporario';
    interAdminGarantirDiretorio($tempDir);
    $sufixo = bin2hex(random_bytes(8));
    $certTmp = $tempDir . '/cert-' . $sufixo . '.crt';
    $keyTmp = $tempDir . '/key-' . $sufixo . '.key';
    file_put_contents($certTmp, $pacote['cert'], LOCK_EX);
    file_put_contents($keyTmp, $pacote['key'], LOCK_EX);
    @chmod($certTmp, 0600); @chmod($keyTmp, 0600);

    $scope = 'boleto-cobranca.read boleto-cobranca.write';
    try {
        $ch = curl_init('https://cdpj.partners.bancointer.com.br/oauth/v2/token');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query(['client_id'=>$clientId,'client_secret'=>$clientSecret,'grant_type'=>'client_credentials','scope'=>$scope]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded','Accept: application/json'],
            CURLOPT_SSLCERT => $certTmp,
            CURLOPT_SSLKEY => $keyTmp,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_TIMEOUT => 45,
        ]);
        $body = curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        $json = is_string($body) ? json_decode($body, true) : null;
        if ($body === false || $http < 200 || $http >= 300 || !is_array($json) || empty($json['access_token'])) {
            $detalhe = is_array($json) ? (string)($json['error_description'] ?? $json['message'] ?? $json['error'] ?? '') : '';
            if ($detalhe === '') $detalhe = $curlError !== '' ? $curlError : 'O Banco Inter não confirmou a autenticação.';
            interAdminResponder(422, ['ok'=>false,'activated'=>false,'httpStatus'=>$http,'error'=>$detalhe]);
        }

        $certPath = $dir . '/inter-certificado.crt';
        $keyPath = $dir . '/inter-chave.key';
        $configPath = $dir . '/config.php';
        $stamp = gmdate('Ymd-His');
        foreach ([$certPath,$keyPath,$configPath] as $arquivo) {
            if (is_file($arquivo)) @copy($arquivo, $arquivo . '.bak-' . $stamp);
        }
        if (file_put_contents($certPath, $pacote['cert'], LOCK_EX) === false) throw new RuntimeException('Falha ao gravar o certificado ativo.');
        if (file_put_contents($keyPath, $pacote['key'], LOCK_EX) === false) throw new RuntimeException('Falha ao gravar a chave ativa.');
        @chmod($certPath,0600); @chmod($keyPath,0600);
        $config = [
            'base_url'=>'https://cdpj.partners.bancointer.com.br/cobranca/v3',
            'token_url'=>'https://cdpj.partners.bancointer.com.br/oauth/v2/token',
            'cert_path'=>$certPath,'key_path'=>$keyPath,'client_id'=>$clientId,'client_secret'=>$clientSecret,
            'integration_id'=>$integrationId,'conta_corrente'=>$contaCorrente,
            'scope_candidates'=>['boleto-cobranca.read boleto-cobranca.write','cobranca.read cobranca.write'],
            'timeout_seconds'=>45,
        ];
        $php = "<?php\nreturn " . var_export($config, true) . ";\n";
        if (file_put_contents($configPath, $php, LOCK_EX) === false) throw new RuntimeException('Falha ao gravar a configuração ativa.');
        @chmod($configPath,0600);
        foreach (glob($dir . '/token-cache*') ?: [] as $cache) @unlink($cache);
        $agora = time();
        $expiresIn = max(0, (int)($json['expires_in'] ?? 0));
        $clientIdMask = substr($clientId, 0, 8) . '…' . substr($clientId, -4);
        $status = [
            'authenticationValidated' => true,
            'lastAuthAt' => gmdate('c', $agora),
            'tokenExpiresAt' => $expiresIn > 0 ? gmdate('c', $agora + $expiresIn) : '',
            'activeClientIdMasked' => $clientIdMask,
            'activeClientIdHash' => hash('sha256', $clientId),
            'scope' => (string)($json['scope'] ?? $scope),
        ];
        @file_put_contents($dir . '/status.json', json_encode($status, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
        @chmod($dir . '/status.json', 0600);
        interAdminAuditar('ATIVAR_INTEGRACAO_VALIDADA_BANCO_INTER','SUCESSO');
        interAdminResponder(200,[
            'ok'=>true,
            'activated'=>true,
            'httpStatus'=>$http,
            'scopeReturned'=>(string)($json['scope'] ?? $scope),
            'activeClientIdMasked'=>$clientIdMask,
            'message'=>'INTEGRAÇÃO ATIVADA COM SUCESSO — Client ID ativo: ' . $clientIdMask . '. Backup da configuração anterior criado no servidor.',
        ]);
    } finally {
        @unlink($certTmp); @unlink($keyTmp);
    }
}

function interAdminInstalarCertificado(): void {
    $cert = interAdminUpload('certificado', 2 * 1024 * 1024);
    $key = interAdminUpload('chavePrivada', 2 * 1024 * 1024);
    $clientId = interAdminTexto('clientId', 200);
    $clientSecret = interAdminTexto('clientSecret', 500);
    $integrationId = interAdminTexto('integrationId', 200, false);
    $contaCorrente = interAdminSomenteDigitos(interAdminTexto('contaCorrente', 30));
    if ($contaCorrente === '') throw new RuntimeException('Informe a conta corrente do Banco Inter.');

    $certResource = @openssl_x509_read($cert['content']);
    if ($certResource === false) throw new RuntimeException('O certificado selecionado não é um certificado X.509 válido.');
    $keyResource = @openssl_pkey_get_private($key['content']);
    if ($keyResource === false) throw new RuntimeException('A chave privada selecionada não é válida. Selecione o arquivo .key baixado da mesma integração.');
    if (!@openssl_x509_check_private_key($certResource, $keyResource)) {
        throw new RuntimeException('O certificado .crt e a chave .key não pertencem ao mesmo par. Baixe os dois arquivos da mesma integração do Banco Inter.');
    }

    $dir = interAdminDiretorio();
    interAdminGarantirDiretorio($dir);
    $certPath = $dir . '/inter-certificado.crt';
    $keyPath = $dir . '/inter-chave.key';
    $configPath = $dir . '/config.php';
    foreach ([$certPath, $keyPath, $configPath] as $arquivo) {
        if (is_file($arquivo)) @copy($arquivo, $arquivo . '.bak-' . gmdate('Ymd-His'));
    }

    if (file_put_contents($certPath, $cert['content'], LOCK_EX) === false) throw new RuntimeException('Falha ao gravar o certificado no diretório privado.');
    if (file_put_contents($keyPath, $key['content'], LOCK_EX) === false) throw new RuntimeException('Falha ao gravar a chave privada no diretório privado.');
    @chmod($certPath, 0600);
    @chmod($keyPath, 0600);

    $config = [
        'base_url' => 'https://cdpj.partners.bancointer.com.br/cobranca/v3',
        'token_url' => 'https://cdpj.partners.bancointer.com.br/oauth/v2/token',
        'cert_path' => $certPath,
        'key_path' => $keyPath,
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'integration_id' => $integrationId,
        'conta_corrente' => $contaCorrente,
        'scope_candidates' => ['cobranca.read cobranca.write', 'boleto-cobranca.read boleto-cobranca.write'],
        'timeout_seconds' => 45,
    ];
    $php = "<?php\nreturn " . var_export($config, true) . ";\n";
    if (file_put_contents($configPath, $php, LOCK_EX) === false) throw new RuntimeException('Falha ao gravar a configuração privada.');
    @chmod($configPath, 0600);

    interAdminAuditar('INSTALAR_CERTIFICADO_E_CHAVE_BANCO_INTER', 'SUCESSO');
    interAdminResponder(200, [
        'ok' => true,
        'message' => 'Certificado, chave privada e credenciais do Banco Inter instalados com sucesso.',
        'configured' => true,
    ]);
}

interAdminUsuario();
interAdminValidarOrigem();
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    interAdminResponder(405, ['ok' => false, 'error' => 'Método não permitido.']);
}

$action = strtolower(trim((string)($_GET['action'] ?? $_POST['action'] ?? '')));

try {
    if ($action === 'gerar-csr') interAdminGerarCsr();
    if ($action === 'instalar-certificado') interAdminInstalarCertificado();
    if ($action === 'testar-integracao-temporaria') interAdminTestarIntegracaoTemporaria();
    if ($action === 'ativar-integracao-temporaria') interAdminAtivarIntegracaoTemporaria();
    interAdminResponder(404, ['ok' => false, 'error' => 'Ação de configuração do Banco Inter não encontrada.']);
} catch (Throwable $e) {
    interAdminAuditar($action !== '' ? strtoupper($action) : 'CONFIGURAR_BANCO_INTER', 'ERRO');
    interAdminResponder(422, ['ok' => false, 'error' => $e->getMessage()]);
}
