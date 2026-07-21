<?php
declare(strict_types=1);

define('SYNERGIAS_AUTH_BOOTSTRAP', true);
require dirname(__DIR__) . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

const A1_MAX_BYTES = 5242880;
const A1_OTP_SESSION_KEY = 'certificado_a1_otp';
const A1_OTP_ATTEMPTS_KEY = 'certificado_a1_otp_tentativas';
const A1_OTP_MAX_CRYPTO_ATTEMPTS = 5;

function a1Responder(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function a1UsuarioAdmin(): array {
    $usuario = exigirAutenticacao();
    if (strcasecmp((string)($usuario['perfil'] ?? ''), 'Administrador') !== 0) {
        a1Responder(403, ['ok' => false, 'mensagem' => 'Apenas Administrador pode gerenciar o certificado digital.']);
    }
    return $usuario;
}

function a1ValidarOrigem(): void {
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'GET') return;

    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') return;

    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    if ($host === '' || $originHost === '' || !hash_equals($host, $originHost)) {
        a1Responder(403, ['ok' => false, 'mensagem' => 'Origem da solicitação não autorizada.']);
    }
}

function a1HomeDir(): string {
    $home = rtrim((string)(getenv('HOME') ?: ''), '/\\');
    if ($home !== '' && is_dir($home) && is_writable($home)) return $home;

    $docRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
    if ($docRoot !== '') {
        $parent = dirname($docRoot);
        if (is_dir($parent) && is_writable($parent)) return $parent;
    }

    throw new RuntimeException('Diretório privado do servidor indisponível.');
}

function a1Paths(): array {
    $home = a1HomeDir();
    return [
        'secretDir' => $home . '/.synergias-secrets',
        'secretFile' => $home . '/.synergias-secrets/fiscal-a1.key',
        'dataDir' => $home . '/synergias_private/fiscal-a1',
        'dataFile' => $home . '/synergias_private/fiscal-a1/certificado.a1.enc.json',
        'auditFile' => $home . '/synergias_private/fiscal-a1/auditoria.log',
    ];
}

function a1GarantirDiretorio(string $path): void {
    if (!is_dir($path) && !mkdir($path, 0700, true) && !is_dir($path)) {
        throw new RuntimeException('Não foi possível preparar o armazenamento privado.');
    }
    @chmod($path, 0700);
    $htaccess = $path . '/.htaccess';
    if (!is_file($htaccess)) {
        @file_put_contents($htaccess, "Require all denied\nDeny from all\n", LOCK_EX);
        @chmod($htaccess, 0600);
    }
    $index = $path . '/index.html';
    if (!is_file($index)) {
        @file_put_contents($index, '', LOCK_EX);
        @chmod($index, 0600);
    }
}

function a1ChaveMestra(): string {
    $paths = a1Paths();
    a1GarantirDiretorio($paths['secretDir']);

    if (!is_file($paths['secretFile'])) {
        $key = random_bytes(32);
        if (file_put_contents($paths['secretFile'], base64_encode($key), LOCK_EX) === false) {
            throw new RuntimeException('Não foi possível criar a chave mestra privada.');
        }
        @chmod($paths['secretFile'], 0600);
        return $key;
    }

    $encoded = trim((string)file_get_contents($paths['secretFile']));
    $key = base64_decode($encoded, true);
    if (!is_string($key) || strlen($key) !== 32) {
        throw new RuntimeException('Chave mestra privada inválida.');
    }
    return $key;
}

function a1Auditar(string $acao, string $resultado, array $extra = []): void {
    try {
        $paths = a1Paths();
        a1GarantirDiretorio($paths['dataDir']);
        $usuario = usuarioAutenticado();
        $registro = [
            'em' => gmdate('c'),
            'acao' => $acao,
            'resultado' => $resultado,
            'usuario' => (string)($usuario['usuario'] ?? ''),
            'ipHash' => hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '')),
        ];
        foreach ($extra as $k => $v) {
            if (in_array(strtolower((string)$k), ['senha', 'conteudo', 'arquivo', 'chave'], true)) continue;
            $registro[$k] = $v;
        }
        @file_put_contents($paths['auditFile'], json_encode($registro, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND | LOCK_EX);
        @chmod($paths['auditFile'], 0600);
    } catch (Throwable $ignored) {
    }
}

function a1SomenteDigitos(string $valor): string {
    return preg_replace('/\D+/', '', $valor) ?: '';
}

function a1CnpjValido(string $cnpj): bool {
    if (!preg_match('/^\d{14}$/', $cnpj) || preg_match('/^(\d)\1{13}$/', $cnpj)) return false;
    for ($tamanho = 12; $tamanho <= 13; $tamanho++) {
        $soma = 0;
        $peso = $tamanho - 7;
        for ($i = 0; $i < $tamanho; $i++) {
            $soma += ((int)$cnpj[$i]) * $peso--;
            if ($peso < 2) $peso = 9;
        }
        $digito = $soma % 11;
        $digito = $digito < 2 ? 0 : 11 - $digito;
        if ((int)$cnpj[$tamanho] !== $digito) return false;
    }
    return true;
}

function a1ExtrairCnpj(array $parsed, string $cnpjEsperado = ''): string {
    $subject = is_array($parsed['subject'] ?? null) ? $parsed['subject'] : [];
    $prioridades = [];

    $adicionar = function ($value, int $prioridade) use (&$prioridades): void {
        $itens = is_array($value) ? $value : [$value];
        foreach ($itens as $item) {
            $texto = (string)$item;
            if (!preg_match_all('/(?<!\d)\d[\d\.\/\-\s]{12,20}\d(?!\d)/', $texto, $matches)) continue;
            foreach ($matches[0] as $match) {
                $digits = a1SomenteDigitos((string)$match);
                if (strlen($digits) !== 14 || !a1CnpjValido($digits)) continue;
                $prioridades[$digits] = min($prioridades[$digits] ?? 999, $prioridade);
            }
        }
    };

    // ICP-Brasil: OID 2.16.76.1.3.3 representa o CNPJ do titular.
    foreach (['2.16.76.1.3.3', 'OID.2.16.76.1.3.3', 'serialNumber'] as $key) {
        if (array_key_exists($key, $subject)) $adicionar($subject[$key], 1);
    }
    if (array_key_exists('CN', $subject)) $adicionar($subject['CN'], 2);
    if (array_key_exists('O', $subject)) $adicionar($subject['O'], 3);
    if (array_key_exists('OU', $subject)) $adicionar($subject['OU'], 4);
    $adicionar($parsed['name'] ?? '', 5);

    if ($cnpjEsperado !== '' && isset($prioridades[$cnpjEsperado])) return $cnpjEsperado;
    if (!$prioridades) return '';

    asort($prioridades, SORT_NUMERIC);
    return (string)array_key_first($prioridades);
}

function a1NomeEmissor(array $parsed): string {
    $issuer = is_array($parsed['issuer'] ?? null) ? $parsed['issuer'] : [];
    foreach (['CN', 'O', 'OU'] as $key) {
        if (!empty($issuer[$key])) return is_array($issuer[$key]) ? implode(' / ', $issuer[$key]) : (string)$issuer[$key];
    }
    return '';
}

function a1RazaoSocial(array $parsed): string {
    $subject = is_array($parsed['subject'] ?? null) ? $parsed['subject'] : [];
    foreach (['CN', 'O'] as $key) {
        if (!empty($subject[$key])) return is_array($subject[$key]) ? (string)($subject[$key][0] ?? '') : (string)$subject[$key];
    }
    return '';
}

function a1StatusVazio(): array {
    return [
        'configurado' => false,
        'status' => 'NAO_CONFIGURADO',
        'cnpj' => '',
        'razaoSocial' => '',
        'emissor' => '',
        'validoDe' => '',
        'validoAte' => '',
        'diasRestantes' => null,
        'instaladoEm' => '',
    ];
}

function a1LerEnvelope(): ?array {
    $paths = a1Paths();
    if (!is_file($paths['dataFile'])) return null;
    $raw = file_get_contents($paths['dataFile']);
    $data = is_string($raw) ? json_decode($raw, true) : null;
    return is_array($data) ? $data : null;
}

function a1StatusAtual(): array {
    $env = a1LerEnvelope();
    if ($env === null) return a1StatusVazio();
    $meta = is_array($env['metadata'] ?? null) ? $env['metadata'] : [];
    $validTo = (int)($meta['validToTime'] ?? 0);
    $dias = $validTo > 0 ? (int)floor(($validTo - time()) / 86400) : null;
    $status = 'ATIVO';
    if ($dias !== null && $dias < 0) $status = 'VENCIDO';
    elseif ($dias !== null && $dias <= 30) $status = 'VENCENDO';

    return [
        'configurado' => true,
        'status' => $status,
        'cnpj' => (string)($meta['cnpj'] ?? ''),
        'razaoSocial' => (string)($meta['razaoSocial'] ?? ''),
        'emissor' => (string)($meta['emissor'] ?? ''),
        'validoDe' => (string)($meta['validoDe'] ?? ''),
        'validoAte' => (string)($meta['validoAte'] ?? ''),
        'diasRestantes' => $dias,
        'instaladoEm' => (string)($meta['instaladoEm'] ?? ''),
    ];
}

function a1EnviarCodigo(): never {
    iniciarSessaoSegura();
    $cfg = carregarConfigAuth();
    reenviarOtpSessao(A1_OTP_SESSION_KEY, 'confirmação para gerenciar o Certificado Digital A1', $cfg);
    $_SESSION[A1_OTP_ATTEMPTS_KEY] = 0;
    a1Auditar('SOLICITAR_CODIGO', 'SUCESSO');
    a1Responder(200, ['ok' => true, 'mensagem' => 'Código enviado ao e-mail administrativo.']);
}

function a1ValidarCodigo(string $codigo): void {
    iniciarSessaoSegura();
    $codigo = a1SomenteDigitos($codigo);
    if (!preg_match('/^\d{6}$/', $codigo) || !validarOtpSessao(A1_OTP_SESSION_KEY, $codigo)) {
        a1Auditar('VALIDAR_CODIGO', 'FALHA');
        a1Responder(401, ['ok' => false, 'mensagem' => 'Código de segurança inválido ou expirado.']);
    }
}

function a1ConsumirCodigo(): void {
    unset($_SESSION[A1_OTP_SESSION_KEY], $_SESSION[A1_OTP_ATTEMPTS_KEY]);
}

function a1RegistrarFalhaCriptografica(): int {
    iniciarSessaoSegura();
    $tentativas = (int)($_SESSION[A1_OTP_ATTEMPTS_KEY] ?? 0) + 1;
    $_SESSION[A1_OTP_ATTEMPTS_KEY] = $tentativas;
    $restantes = max(0, A1_OTP_MAX_CRYPTO_ATTEMPTS - $tentativas);
    if ($restantes === 0) a1ConsumirCodigo();
    return $restantes;
}

function a1LimparErrosOpenSsl(): void {
    while (openssl_error_string() !== false) {
    }
}

function a1FuncaoPermitida(string $nome): bool {
    if (!function_exists($nome)) return false;
    $desabilitadas = array_filter(array_map('trim', explode(',', (string)ini_get('disable_functions'))));
    return !in_array($nome, $desabilitadas, true);
}

function a1LerPkcs12Legado(string $arquivo, string $senha, array &$certs): string {
    if (!a1FuncaoPermitida('proc_open')) return 'INDISPONIVEL';

    $paths = a1Paths();
    a1GarantirDiretorio($paths['dataDir']);
    $saida = $paths['dataDir'] . '/.a1-conversao-' . bin2hex(random_bytes(12)) . '.pem';
    $descritores = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $processo = null;
    $pipes = [];
    try {
        $comando = ['openssl', 'pkcs12', '-legacy', '-in', $arquivo, '-nodes', '-passin', 'stdin', '-out', $saida];
        $processo = @proc_open($comando, $descritores, $pipes, null, ['LC_ALL' => 'C']);
        if (!is_resource($processo)) return 'INDISPONIVEL';

        fwrite($pipes[0], $senha . PHP_EOL);
        fclose($pipes[0]);
        stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        stream_get_contents($pipes[2]);
        fclose($pipes[2]);
        $codigo = proc_close($processo);
        $processo = null;

        if ($codigo !== 0 || !is_file($saida)) return 'FALHA';
        @chmod($saida, 0600);
        $pem = file_get_contents($saida);
        if (!is_string($pem) || $pem === '') return 'FALHA';

        if (!preg_match('/-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----/s', $pem, $mCert)) return 'FALHA';
        if (!preg_match('/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----.*?-----END (?:RSA |EC )?PRIVATE KEY-----/s', $pem, $mKey)) return 'FALHA';

        $certs = ['cert' => $mCert[0], 'pkey' => $mKey[0]];
        return 'SUCESSO';
    } catch (Throwable $e) {
        return 'FALHA';
    } finally {
        foreach ($pipes as $pipe) {
            if (is_resource($pipe)) @fclose($pipe);
        }
        if (is_resource($processo)) @proc_terminate($processo);
        if (is_file($saida)) {
            @file_put_contents($saida, str_repeat("\0", (int)filesize($saida)), LOCK_EX);
            @unlink($saida);
        }
    }
}

function a1LerPkcs12(string $bytes, string $arquivoTemporario, string $senha, array &$certs): array {
    a1LimparErrosOpenSsl();
    if (@openssl_pkcs12_read($bytes, $certs, $senha)) {
        return ['ok' => true, 'modo' => 'PADRAO'];
    }
    a1LimparErrosOpenSsl();

    $legado = a1LerPkcs12Legado($arquivoTemporario, $senha, $certs);
    if ($legado === 'SUCESSO') return ['ok' => true, 'modo' => 'LEGADO_CONTROLADO'];
    return ['ok' => false, 'modo' => $legado];
}

function a1Instalar(): never {
    $codigo = (string)($_POST['codigoSeguranca'] ?? '');
    a1ValidarCodigo($codigo);

    $cnpjConfigurado = a1SomenteDigitos((string)($_POST['cnpjConfigurado'] ?? ''));
    if (!preg_match('/^\d{14}$/', $cnpjConfigurado)) {
        a1Responder(422, ['ok' => false, 'mensagem' => 'CNPJ fiscal configurado inválido.']);
    }

    if (!isset($_FILES['certificado']) || !is_array($_FILES['certificado'])) {
        a1Responder(422, ['ok' => false, 'mensagem' => 'Arquivo do certificado não recebido.']);
    }

    $upload = $_FILES['certificado'];
    $error = (int)($upload['error'] ?? UPLOAD_ERR_NO_FILE);
    $size = (int)($upload['size'] ?? 0);
    $tmp = (string)($upload['tmp_name'] ?? '');
    $name = strtolower((string)($upload['name'] ?? ''));

    if ($error !== UPLOAD_ERR_OK || $tmp === '' || !is_uploaded_file($tmp)) {
        a1Responder(422, ['ok' => false, 'mensagem' => 'Falha segura no recebimento do certificado.']);
    }
    if ($size <= 0 || $size > A1_MAX_BYTES) {
        a1Responder(422, ['ok' => false, 'mensagem' => 'O certificado deve ter no máximo 5 MB.']);
    }
    if (!preg_match('/\.(pfx|p12)$/', $name)) {
        a1Responder(422, ['ok' => false, 'mensagem' => 'Use um certificado A1 no formato .pfx ou .p12.']);
    }

    $senha = (string)($_POST['senha'] ?? '');
    if ($senha === '') a1Responder(422, ['ok' => false, 'mensagem' => 'Informe a senha do certificado.']);

    $bytes = file_get_contents($tmp);
    if (!is_string($bytes) || strlen($bytes) !== $size) {
        a1Responder(422, ['ok' => false, 'mensagem' => 'Não foi possível validar o conteúdo do certificado.']);
    }

    $certs = [];
    $leituraPkcs12 = a1LerPkcs12($bytes, $tmp, $senha, $certs);
    $senha = '';
    if (!($leituraPkcs12['ok'] ?? false)) {
        $restantes = a1RegistrarFalhaCriptografica();
        $modo = (string)($leituraPkcs12['modo'] ?? 'FALHA');
        a1Auditar('INSTALAR', 'FALHA_PKCS12', ['fallback' => $modo, 'tentativasRestantes' => $restantes]);
        $sufixo = $restantes > 0
            ? ' O mesmo código por e-mail continua válido. Tentativas restantes: ' . $restantes . '.'
            : ' Solicite um novo código por e-mail.';
        if ($modo === 'INDISPONIVEL') {
            a1Responder(422, ['ok' => false, 'mensagem' => 'O servidor não conseguiu abrir este formato PKCS#12 e o modo compatível não está disponível na hospedagem.' . $sufixo]);
        }
        a1Responder(422, ['ok' => false, 'mensagem' => 'Não foi possível abrir o certificado PKCS#12. A senha pode estar correta, mas o arquivo pode usar um algoritmo não aceito pela hospedagem.' . $sufixo]);
    }

    $certPem = (string)($certs['cert'] ?? '');
    $privateKey = (string)($certs['pkey'] ?? '');
    if ($certPem === '' || $privateKey === '') {
        a1Responder(422, ['ok' => false, 'mensagem' => 'O arquivo não contém certificado e chave privada válidos.']);
    }
    if (!openssl_x509_check_private_key($certPem, $privateKey)) {
        a1Auditar('INSTALAR', 'FALHA_CHAVE_PRIVADA');
        a1Responder(422, ['ok' => false, 'mensagem' => 'A chave privada não corresponde ao certificado informado.']);
    }

    $parsed = openssl_x509_parse($certPem, false);
    if (!is_array($parsed)) {
        a1Responder(422, ['ok' => false, 'mensagem' => 'Não foi possível interpretar o certificado digital.']);
    }

    $cnpjCert = a1ExtrairCnpj($parsed, $cnpjConfigurado);
    if ($cnpjCert === '' || !hash_equals($cnpjConfigurado, $cnpjCert)) {
        a1Auditar('INSTALAR', 'FALHA_CNPJ', ['cnpjEncontrado' => $cnpjCert !== '' ? substr($cnpjCert, -4) : 'NAO_ENCONTRADO']);
        a1Responder(422, ['ok' => false, 'mensagem' => 'O CNPJ do certificado não corresponde ao CNPJ salvo na Configuração Fiscal.']);
    }

    $validFrom = (int)($parsed['validFrom_time_t'] ?? 0);
    $validTo = (int)($parsed['validTo_time_t'] ?? 0);
    if ($validFrom <= 0 || $validTo <= 0 || time() < $validFrom || time() > $validTo) {
        a1Auditar('INSTALAR', 'FALHA_VALIDADE');
        a1Responder(422, ['ok' => false, 'mensagem' => 'O certificado ainda não é válido ou está vencido.']);
    }

    // V24: guarda apenas o material PEM necessário para assinatura e mTLS,
    // sempre criptografado. A senha do A1 continua sendo descartada e nunca é salva.
    $material = json_encode([
        'certificatePem' => $certPem,
        'privateKeyPem' => $privateKey,
        'extraCertificates' => is_array($certs['extracerts'] ?? null) ? $certs['extracerts'] : [],
    ], JSON_UNESCAPED_SLASHES);
    if (!is_string($material) || $material === '') {
        throw new RuntimeException('Falha interna ao preparar o material criptográfico do A1.');
    }

    $key = a1ChaveMestra();
    $iv = random_bytes(12);
    $tag = '';
    $aad = 'SYNERGIAS-A1-V2|' . $cnpjCert;
    $cipher = openssl_encrypt($material, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, $aad, 16);
    if (!is_string($cipher) || strlen($tag) !== 16) {
        throw new RuntimeException('Falha interna ao criptografar o certificado.');
    }

    $instaladoEm = gmdate('c');
    $envelope = [
        'version' => 2,
        'format' => 'PEM_ENCRYPTED',
        'cipher' => 'AES-256-GCM',
        'aad' => base64_encode($aad),
        'iv' => base64_encode($iv),
        'tag' => base64_encode($tag),
        'data' => base64_encode($cipher),
        'metadata' => [
            'cnpj' => $cnpjCert,
            'razaoSocial' => a1RazaoSocial($parsed),
            'emissor' => a1NomeEmissor($parsed),
            'validoDe' => gmdate('c', $validFrom),
            'validoAte' => gmdate('c', $validTo),
            'validToTime' => $validTo,
            'instaladoEm' => $instaladoEm,
            'fingerprintSha256' => openssl_x509_fingerprint($certPem, 'sha256') ?: '',
        ],
    ];

    $paths = a1Paths();
    a1GarantirDiretorio($paths['dataDir']);
    $tempFile = $paths['dataFile'] . '.tmp.' . bin2hex(random_bytes(6));
    $json = json_encode($envelope, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || file_put_contents($tempFile, $json, LOCK_EX) === false) {
        throw new RuntimeException('Não foi possível salvar o certificado criptografado.');
    }
    @chmod($tempFile, 0600);
    if (!rename($tempFile, $paths['dataFile'])) {
        @unlink($tempFile);
        throw new RuntimeException('Não foi possível concluir a instalação protegida.');
    }
    @chmod($paths['dataFile'], 0600);

    $bytes = '';
    $material = '';
    $certPem = '';
    $certs = [];
    $privateKey = '';
    a1ConsumirCodigo();
    a1Auditar('INSTALAR', 'SUCESSO', ['cnpj' => $cnpjCert, 'fingerprint' => $envelope['metadata']['fingerprintSha256'], 'leitura' => (string)($leituraPkcs12['modo'] ?? '')]);
    a1Responder(200, ['ok' => true, 'certificado' => a1StatusAtual()]);
}

function a1Remover(): never {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    $codigo = is_array($body) ? (string)($body['codigoSeguranca'] ?? '') : '';
    a1ValidarCodigo($codigo);

    $paths = a1Paths();
    if (is_file($paths['dataFile']) && !unlink($paths['dataFile'])) {
        throw new RuntimeException('Não foi possível remover o certificado criptografado.');
    }
    a1ConsumirCodigo();
    a1Auditar('REMOVER', 'SUCESSO');
    a1Responder(200, ['ok' => true]);
}

try {
    a1ValidarOrigem();
    a1UsuarioAdmin();
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $action = strtolower(trim((string)($_GET['action'] ?? 'status')));

    if ($method === 'GET' && $action === 'status') {
        a1Responder(200, ['ok' => true, 'certificado' => a1StatusAtual()]);
    }
    if ($method === 'POST' && $action === 'codigo') a1EnviarCodigo();
    if ($method === 'POST' && $action === 'instalar') a1Instalar();
    if ($method === 'POST' && $action === 'remover') a1Remover();

    a1Responder(404, ['ok' => false, 'mensagem' => 'Operação de certificado não encontrada.']);
} catch (Throwable $e) {
    error_log('[Synergias A1] ' . $e->getMessage());
    a1Auditar('ERRO_INTERNO', 'FALHA');
    a1Responder(500, ['ok' => false, 'mensagem' => 'Não foi possível concluir a operação segura do certificado.']);
}
