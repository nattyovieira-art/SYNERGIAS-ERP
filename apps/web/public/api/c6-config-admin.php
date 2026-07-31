<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function c6Responder(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function c6Admin(): void {
    $u = exigirAutenticacao();
    if (strcasecmp((string)($u['perfil'] ?? ''), 'Administrador') !== 0) c6Responder(403, ['ok' => false, 'error' => 'Apenas Administrador pode configurar o C6 Bank.']);
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '' && strtolower((string)parse_url($origin, PHP_URL_HOST)) !== strtolower((string)($_SERVER['HTTP_HOST'] ?? ''))) {
        c6Responder(403, ['ok' => false, 'error' => 'Origem não autorizada.']);
    }
}
function c6Diretorio(): string {
    $home = rtrim((string)(getenv('HOME') ?: ''), '/\\');
    if ($home === '' || !is_dir($home) || !is_writable($home)) $home = dirname(rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\'));
    if ($home === '' || !is_writable($home)) throw new RuntimeException('Diretório privado do servidor indisponível.');
    return $home . '/synergias_private/c6';
}
function c6Upload(string $nome): string {
    $f = $_FILES[$nome] ?? null;
    if (!is_array($f) || (int)($f['error'] ?? 1) !== UPLOAD_ERR_OK || (int)($f['size'] ?? 0) <= 0 || (int)$f['size'] > 65536) {
        throw new RuntimeException("Arquivo {$nome} inválido.");
    }
    $tmp = (string)$f['tmp_name'];
    if (!is_uploaded_file($tmp)) throw new RuntimeException("Upload {$nome} inválido.");
    return (string)file_get_contents($tmp);
}

c6Admin();
$action = (string)($_GET['action'] ?? 'diagnostico');
try {
    if ($action === 'diagnostico') {
        require_once __DIR__ . '/c6-client.php';
        c6Responder(200, ['ok' => true, 'c6' => (new C6ApiClient())->diagnostico()]);
    }
    if ($action !== 'instalar' || $_SERVER['REQUEST_METHOD'] !== 'POST') c6Responder(404, ['ok' => false, 'error' => 'Ação inválida.']);

    $clientId = trim((string)($_POST['clientId'] ?? ''));
    $secret = trim((string)($_POST['clientSecret'] ?? ''));
    if ($clientId === '' || $secret === '' || strlen($clientId) > 255 || strlen($secret) > 500) throw new RuntimeException('Informe Client ID e Client Secret válidos.');
    $cert = c6Upload('certificado');
    $key = c6Upload('chavePrivada');
    if (!openssl_x509_read($cert) || !openssl_pkey_get_private($key) || !openssl_x509_check_private_key($cert, $key)) {
        throw new RuntimeException('O certificado e a chave privada C6 são inválidos ou não pertencem ao mesmo conjunto.');
    }
    $info = openssl_x509_parse($cert);
    if (!is_array($info) || (int)($info['validTo_time_t'] ?? 0) <= time()) throw new RuntimeException('O certificado C6 está vencido.');
    $cn = strtolower((string)($info['subject']['CN'] ?? ''));
    if (!str_contains($cn, 'baas-api-sandbox.c6bank.info')) throw new RuntimeException('Este certificado não pertence ao sandbox oficial do C6.');

    $dir = c6Diretorio();
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) throw new RuntimeException('Não foi possível criar o diretório privado C6.');
    @chmod($dir, 0700);
    file_put_contents($dir . '/client.crt', $cert, LOCK_EX);
    file_put_contents($dir . '/client.key', $key, LOCK_EX);
    $config = "<?php\nreturn " . var_export([
        'environment' => 'sandbox',
        'base_url' => 'https://baas-api-sandbox.c6bank.info/v1/bank_slips',
        'token_url' => 'https://baas-api-sandbox.c6bank.info/v1/auth',
        'cert_path' => $dir . '/client.crt',
        'key_path' => $dir . '/client.key',
        'client_id' => $clientId,
        'client_secret' => $secret,
        'billing_scheme' => 21,
        'scopes' => 'bankslip.write bankslip.read',
    ], true) . ";\n";
    file_put_contents($dir . '/config.php', $config, LOCK_EX);
    @unlink($dir . '/token-cache.json');
    foreach (['client.crt', 'client.key', 'config.php'] as $f) @chmod($dir . '/' . $f, 0600);
    c6Responder(200, ['ok' => true, 'message' => 'Credenciais C6 instaladas com segurança no sandbox.']);
} catch (Throwable $e) {
    c6Responder(422, ['ok' => false, 'error' => $e->getMessage()]);
}
