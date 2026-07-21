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

const SEFAZ_STATUS_VERSION = 'V34';
const SEFAZ_RS_CUF = '43';
const SEFAZ_RS_HOMOLOGACAO_STATUS_URL = 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx';
const SEFAZ_CONTROLE_PUBLICO_URL = 'https://dfe-portal.svrs.rs.gov.br/Nfe/Servicos';
const SEFAZ_SVRS_HOMOLOGACAO_STATUS_URL = 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx';

function sefazResponder(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sefazUsuarioAdmin(): array {
    $usuario = exigirAutenticacao();
    if (strcasecmp((string)($usuario['perfil'] ?? ''), 'Administrador') !== 0) {
        sefazResponder(403, ['ok' => false, 'mensagem' => 'Apenas Administrador pode testar a comunicação fiscal.']);
    }
    return $usuario;
}

function sefazValidarOrigem(): void {
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'GET') return;
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') return;
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    if ($host === '' || $originHost === '' || !hash_equals($host, $originHost)) {
        sefazResponder(403, ['ok' => false, 'mensagem' => 'Origem da solicitação não autorizada.']);
    }
}

function sefazSomenteDigitos(string $valor): string {
    return preg_replace('/\D+/', '', $valor) ?: '';
}

function sefazHomeDir(): string {
    $home = rtrim((string)(getenv('HOME') ?: ''), '/\\');
    if ($home !== '' && is_dir($home) && is_writable($home)) return $home;
    $docRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
    if ($docRoot !== '') {
        $parent = dirname($docRoot);
        if (is_dir($parent) && is_writable($parent)) return $parent;
    }
    throw new RuntimeException('Diretório privado do servidor indisponível.');
}

function sefazPaths(): array {
    $home = sefazHomeDir();
    return [
        'secretFile' => $home . '/.synergias-secrets/fiscal-a1.key',
        'dataDir' => $home . '/synergias_private/fiscal-a1',
        'dataFile' => $home . '/synergias_private/fiscal-a1/certificado.a1.enc.json',
        'auditFile' => $home . '/synergias_private/fiscal-a1/auditoria-sefaz.log',
    ];
}

function sefazAuditar(string $resultado, array $extra = []): void {
    try {
        $paths = sefazPaths();
        if (!is_dir($paths['dataDir'])) @mkdir($paths['dataDir'], 0700, true);
        $usuario = usuarioAutenticado();
        $registro = [
            'em' => gmdate('c'),
            'acao' => 'STATUS_SERVICO_HOMOLOGACAO',
            'resultado' => $resultado,
            'usuario' => (string)($usuario['usuario'] ?? ''),
            'ipHash' => hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '')),
        ];
        foreach ($extra as $k => $v) {
            if (in_array(strtolower((string)$k), ['senha', 'certificado', 'chave', 'xml', 'conteudo'], true)) continue;
            $registro[$k] = $v;
        }
        @file_put_contents($paths['auditFile'], json_encode($registro, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND | LOCK_EX);
        @chmod($paths['auditFile'], 0600);
    } catch (Throwable $ignored) {
    }
}

function sefazLerMaterialA1(): array {
    $paths = sefazPaths();
    if (!is_file($paths['secretFile']) || !is_file($paths['dataFile'])) {
        sefazResponder(422, ['ok' => false, 'mensagem' => 'Certificado A1 não instalado ou incompleto.']);
    }

    $keyRaw = trim((string)file_get_contents($paths['secretFile']));
    $key = base64_decode($keyRaw, true);
    if (!is_string($key) || strlen($key) !== 32) {
        throw new RuntimeException('Chave mestra do certificado inválida.');
    }

    $envelopeRaw = file_get_contents($paths['dataFile']);
    $envelope = is_string($envelopeRaw) ? json_decode($envelopeRaw, true) : null;
    if (!is_array($envelope) || (int)($envelope['version'] ?? 0) < 2 || (string)($envelope['format'] ?? '') !== 'PEM_ENCRYPTED') {
        sefazResponder(422, ['ok' => false, 'mensagem' => 'Reinstale o certificado A1 para prepará-lo para a SEFAZ.']);
    }

    $iv = base64_decode((string)($envelope['iv'] ?? ''), true);
    $tag = base64_decode((string)($envelope['tag'] ?? ''), true);
    $cipher = base64_decode((string)($envelope['data'] ?? ''), true);
    $aad = base64_decode((string)($envelope['aad'] ?? ''), true);
    if (!is_string($iv) || !is_string($tag) || !is_string($cipher) || !is_string($aad)) {
        throw new RuntimeException('Envelope criptográfico inválido.');
    }

    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, $aad);
    if (!is_string($plain) || $plain === '') {
        throw new RuntimeException('Não foi possível abrir o certificado protegido.');
    }

    $material = json_decode($plain, true);
    $plain = '';
    if (!is_array($material)) throw new RuntimeException('Material criptográfico inválido.');

    $cert = (string)($material['certificatePem'] ?? '');
    $pkey = (string)($material['privateKeyPem'] ?? '');
    $extras = is_array($material['extraCertificates'] ?? null) ? $material['extraCertificates'] : [];
    $meta = is_array($envelope['metadata'] ?? null) ? $envelope['metadata'] : [];

    if ($cert === '' || $pkey === '' || !openssl_x509_check_private_key($cert, $pkey)) {
        throw new RuntimeException('Certificado e chave privada não correspondem.');
    }

    return ['cert' => $cert, 'pkey' => $pkey, 'extras' => $extras, 'metadata' => $meta];
}

function sefazTempPem(string $prefix, string $content): string {
    $paths = sefazPaths();
    if (!is_dir($paths['dataDir']) && !mkdir($paths['dataDir'], 0700, true) && !is_dir($paths['dataDir'])) {
        throw new RuntimeException('Não foi possível preparar o diretório temporário privado.');
    }
    $path = $paths['dataDir'] . '/.' . $prefix . '-' . bin2hex(random_bytes(12)) . '.pem';
    if (file_put_contents($path, $content, LOCK_EX) === false) throw new RuntimeException('Falha ao preparar comunicação segura.');
    @chmod($path, 0600);
    return $path;
}

function sefazApagarSeguro(?string $path): void {
    if (!$path || !is_file($path)) return;
    $size = (int)@filesize($path);
    if ($size > 0 && $size <= 10485760) @file_put_contents($path, str_repeat("\0", $size), LOCK_EX);
    @unlink($path);
}


function sefazCaBundles(): array {
    $candidates = [
        ['path' => __DIR__ . '/cacert.pem', 'origem' => 'bundle_privado_erp'],
    ];

    $curlIni = trim((string)ini_get('curl.cainfo'));
    if ($curlIni !== '') $candidates[] = ['path' => $curlIni, 'origem' => 'curl.cainfo'];

    $opensslIni = trim((string)ini_get('openssl.cafile'));
    if ($opensslIni !== '') $candidates[] = ['path' => $opensslIni, 'origem' => 'openssl.cafile'];

    $candidates[] = ['path' => '/etc/ssl/certs/ca-certificates.crt', 'origem' => 'sistema_debian'];
    $candidates[] = ['path' => '/etc/pki/tls/certs/ca-bundle.crt', 'origem' => 'sistema_rhel'];
    $candidates[] = ['path' => '/etc/ssl/cert.pem', 'origem' => 'sistema_unix'];

    $result = [];
    $seen = [];
    foreach ($candidates as $candidate) {
        $path = trim((string)($candidate['path'] ?? ''));
        if ($path === '' || !is_file($path) || !is_readable($path)) continue;
        $real = realpath($path) ?: $path;
        if (isset($seen[$real])) continue;
        $seen[$real] = true;
        $size = (int)@filesize($path);
        if ($size < 1024) continue;
        $head = (string)@file_get_contents($path, false, null, 0, 8192);
        if (strpos($head, 'BEGIN CERTIFICATE') === false) continue;
        $result[] = ['path' => $path, 'origem' => (string)$candidate['origem'], 'size' => $size];
    }

    // Última tentativa segura: usa a cadeia padrão compilada no próprio cURL/OpenSSL.
    $result[] = ['path' => null, 'origem' => 'padrao_curl_sistema', 'size' => 0];
    return $result;
}

function sefazCertInfoResumo(array $certInfo): array {
    $resumo = [];
    foreach ($certInfo as $cert) {
        if (!is_array($cert)) continue;
        $item = [];
        foreach (['Subject', 'Issuer', 'Start date', 'Expire date'] as $campo) {
            if (isset($cert[$campo]) && is_scalar($cert[$campo])) {
                $valor = trim((string)$cert[$campo]);
                if ($valor !== '') $item[$campo] = mb_substr($valor, 0, 500);
            }
        }
        if ($item) $resumo[] = $item;
        if (count($resumo) >= 5) break;
    }
    return $resumo;
}

function sefazCaResumo(array $ca): array {
    $path = is_string($ca['path'] ?? null) ? (string)$ca['path'] : '';
    $resumo = [
        'origem' => (string)($ca['origem'] ?? 'nao_identificado'),
        'arquivoConfigurado' => $path !== '',
        'legivel' => $path !== '' ? (is_file($path) && is_readable($path)) : true,
        'tamanho' => $path !== '' && is_file($path) ? (int)@filesize($path) : 0,
    ];
    if ($path !== '' && is_file($path) && is_readable($path)) {
        $hash = @hash_file('sha256', $path);
        if (is_string($hash) && $hash !== '') $resumo['sha256Prefixo'] = substr($hash, 0, 16);
    }
    return $resumo;
}

function sefazDnsResumo(string $host): array {
    $ips = [];
    $v4 = @gethostbynamel($host);
    if (is_array($v4)) {
        foreach ($v4 as $ip) if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) $ips[] = $ip;
    }
    if (function_exists('dns_get_record') && defined('DNS_AAAA')) {
        $v6 = @dns_get_record($host, DNS_AAAA);
        if (is_array($v6)) {
            foreach ($v6 as $record) {
                $ip = (string)($record['ipv6'] ?? '');
                if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) $ips[] = $ip;
            }
        }
    }
    return array_values(array_unique(array_slice($ips, 0, 12)));
}


function sefazNomeX509(array $nome): string {
    $partes = [];
    foreach (['CN', 'O', 'OU', 'C', 'ST', 'L'] as $campo) {
        if (!isset($nome[$campo])) continue;
        $valor = $nome[$campo];
        if (is_array($valor)) $valor = implode(' | ', array_map('strval', $valor));
        $valor = trim((string)$valor);
        if ($valor !== '') $partes[] = $campo . '=' . mb_substr($valor, 0, 250);
    }
    return implode(', ', $partes);
}

function sefazHostnameCoberto(string $host, string $pattern): bool {
    $host = strtolower(rtrim(trim($host), '.'));
    $pattern = strtolower(rtrim(trim($pattern), '.'));
    if ($host === '' || $pattern === '') return false;
    if (hash_equals($host, $pattern)) return true;
    if (!str_starts_with($pattern, '*.')) return false;
    $suffix = substr($pattern, 1); // preserva o ponto inicial
    if (!str_ends_with($host, $suffix)) return false;
    $prefix = substr($host, 0, -strlen($suffix));
    return $prefix !== '' && strpos($prefix, '.') === false;
}

function sefazCertificadoCobreHost(array $parsed, string $host): array {
    $nomes = [];
    $extensions = is_array($parsed['extensions'] ?? null) ? $parsed['extensions'] : [];
    $san = trim((string)($extensions['subjectAltName'] ?? ''));
    if ($san !== '') {
        foreach (preg_split('/\s*,\s*/', $san) ?: [] as $item) {
            if (stripos($item, 'DNS:') === 0) $nomes[] = trim(substr($item, 4));
        }
    }
    $subject = is_array($parsed['subject'] ?? null) ? $parsed['subject'] : [];
    $cn = trim((string)($subject['CN'] ?? ''));
    if (!$nomes && $cn !== '') $nomes[] = $cn;
    $nomes = array_values(array_unique(array_filter($nomes)));
    $cobre = false;
    foreach ($nomes as $nome) {
        if (sefazHostnameCoberto($host, $nome)) { $cobre = true; break; }
    }
    return ['cobreHostname' => $cobre, 'nomes' => array_slice($nomes, 0, 30)];
}

function sefazNormalizarNomeX509(array $nome): string {
    $map = [
        'CN' => ['CN', 'commonName'],
        'O' => ['O', 'organizationName'],
        'OU' => ['OU', 'organizationalUnitName'],
        'C' => ['C', 'countryName'],
        'ST' => ['ST', 'stateOrProvinceName'],
        'L' => ['L', 'localityName'],
    ];
    $partes = [];
    foreach ($map as $rotulo => $aliases) {
        $valor = null;
        foreach ($aliases as $alias) {
            if (array_key_exists($alias, $nome)) { $valor = $nome[$alias]; break; }
        }
        if ($valor === null) continue;
        if (is_array($valor)) $valor = implode(' | ', array_map('strval', $valor));
        $valor = trim((string)$valor);
        if ($valor !== '') $partes[] = $rotulo . '=' . mb_substr($valor, 0, 250);
    }
    return implode(', ', $partes);
}

function sefazExtrairAia(array $parsed): array {
    $extensions = is_array($parsed['extensions'] ?? null) ? $parsed['extensions'] : [];
    $raw = trim((string)($extensions['authorityInfoAccess'] ?? ''));
    if ($raw === '') return [];
    preg_match_all('~https?://[^\s,;]+~i', $raw, $matches);
    $urls = [];
    foreach (($matches[0] ?? []) as $url) {
        $url = rtrim((string)$url, ".)\]\r\n\t ");
        if ($url !== '') $urls[] = mb_substr($url, 0, 500);
    }
    return array_values(array_unique(array_slice($urls, 0, 10)));
}

function sefazCapturarCadeiaRemota(string $url): array {
    $host = (string)(parse_url($url, PHP_URL_HOST) ?? '');
    $port = (int)(parse_url($url, PHP_URL_PORT) ?: 443);
    if ($host === '') return ['ok' => false, 'erro' => 'hostname_ausente'];

    $context = stream_context_create([
        'ssl' => [
            'capture_peer_cert' => true,
            'capture_peer_cert_chain' => true,
            'SNI_enabled' => true,
            'peer_name' => $host,
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true,
            'disable_compression' => true,
        ],
    ]);
    $errno = 0;
    $errstr = '';
    $socket = @stream_socket_client('tls://' . $host . ':' . $port, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
    if (!is_resource($socket)) {
        return ['ok' => false, 'host' => $host, 'erroCodigo' => $errno, 'erro' => mb_substr($errstr, 0, 300)];
    }
    $params = stream_context_get_params($socket);
    fclose($socket);
    $ssl = is_array($params['options']['ssl'] ?? null) ? $params['options']['ssl'] : [];
    $chain = is_array($ssl['peer_certificate_chain'] ?? null) ? $ssl['peer_certificate_chain'] : [];
    if (!$chain && isset($ssl['peer_certificate'])) $chain = [$ssl['peer_certificate']];

    $resumo = [];
    $pems = [];
    foreach ($chain as $index => $cert) {
        if (!is_resource($cert) && !($cert instanceof OpenSSLCertificate)) continue;
        $parsed = openssl_x509_parse($cert, true);
        if (!is_array($parsed)) continue;
        $pem = '';
        if (!@openssl_x509_export($cert, $pem, false) || trim($pem) === '') continue;
        $pems[] = $pem;
        $hostCheck = $index === 0 ? sefazCertificadoCobreHost($parsed, $host) : ['cobreHostname' => null, 'nomes' => []];
        $fingerprint = function_exists('openssl_x509_fingerprint') ? @openssl_x509_fingerprint($cert, 'sha256') : false;
        $resumo[] = [
            'posicao' => $index,
            'subject' => sefazNormalizarNomeX509(is_array($parsed['subject'] ?? null) ? $parsed['subject'] : []),
            'issuer' => sefazNormalizarNomeX509(is_array($parsed['issuer'] ?? null) ? $parsed['issuer'] : []),
            'serialHex' => mb_substr((string)($parsed['serialNumberHex'] ?? ''), 0, 100),
            'validoDe' => isset($parsed['validFrom_time_t']) ? gmdate('c', (int)$parsed['validFrom_time_t']) : '',
            'validoAte' => isset($parsed['validTo_time_t']) ? gmdate('c', (int)$parsed['validTo_time_t']) : '',
            'sha256' => is_string($fingerprint) && $fingerprint !== '' ? strtolower(str_replace(':', '', $fingerprint)) : hash('sha256', $pem),
            'cobreHostname' => $hostCheck['cobreHostname'],
            'nomesDns' => $hostCheck['nomes'],
            'aiaCaIssuers' => sefazExtrairAia($parsed),
        ];
        if (count($resumo) >= 10) break;
    }
    return [
        'ok' => count($resumo) > 0,
        'host' => $host,
        'porta' => $port,
        'capturaSomenteDiagnostica' => true,
        'usavelOperacionalmente' => false,
        'cadeia' => $resumo,
        '_pems' => $pems,
    ];
}

function sefazExecutarOpenSslVerify(array $captura, array $bundles): array {
    $pems = is_array($captura['_pems'] ?? null) ? $captura['_pems'] : [];
    if (!$pems) return ['executado' => false, 'motivo' => 'cadeia_nao_capturada'];
    if (!function_exists('proc_open')) return ['executado' => false, 'motivo' => 'proc_open_indisponivel'];

    if (!function_exists('shell_exec')) return ['executado' => false, 'motivo' => 'shell_exec_indisponivel'];
    $openssl = trim((string)@shell_exec('command -v openssl 2>/dev/null'));
    if ($openssl === '') $openssl = trim((string)@shell_exec('which openssl 2>/dev/null'));
    if ($openssl === '' || !is_executable($openssl)) return ['executado' => false, 'motivo' => 'openssl_cli_indisponivel'];

    $leafFile = sefazTempPem('sefaz-leaf', (string)$pems[0]);
    $untrustedFile = null;
    if (count($pems) > 1) $untrustedFile = sefazTempPem('sefaz-untrusted', implode("\n", array_slice($pems, 1)));
    $resultados = [];
    try {
        foreach ($bundles as $bundle) {
            $caPath = is_string($bundle['path'] ?? null) ? (string)$bundle['path'] : '';
            if ($caPath === '' || !is_file($caPath) || !is_readable($caPath)) continue;
            $cmd = [$openssl, 'verify', '-verbose', '-purpose', 'sslserver', '-CAfile', $caPath];
            if ($untrustedFile !== null) { $cmd[] = '-untrusted'; $cmd[] = $untrustedFile; }
            $cmd[] = $leafFile;
            $pipes = [];
            $proc = @proc_open($cmd, [0 => ['pipe','r'], 1 => ['pipe','w'], 2 => ['pipe','w']], $pipes, null, null, ['bypass_shell' => true]);
            if (!is_resource($proc)) continue;
            fclose($pipes[0]);
            $stdout = stream_get_contents($pipes[1]); fclose($pipes[1]);
            $stderr = stream_get_contents($pipes[2]); fclose($pipes[2]);
            $exit = proc_close($proc);
            $texto = trim((string)$stdout . "\n" . (string)$stderr);
            $resultados[] = [
                'ca' => sefazCaResumo($bundle),
                'ok' => $exit === 0,
                'exitCode' => $exit,
                'resultado' => mb_substr(preg_replace('/\s+/', ' ', $texto) ?: '', 0, 800),
            ];
            if ($exit === 0) break;
        }
    } finally {
        sefazApagarSeguro($leafFile);
        sefazApagarSeguro($untrustedFile);
    }
    return ['executado' => true, 'openssl' => basename($openssl), 'resultados' => $resultados];
}

function sefazLimparPemsDiagnostico(array $captura): array {
    unset($captura['_pems']);
    return $captura;
}

function sefazResumoCadeia(array $captura): string {
    $chain = is_array($captura['cadeia'] ?? null) ? $captura['cadeia'] : [];
    if (!$chain) return 'SEM_CADEIA';
    $leaf = is_array($chain[0] ?? null) ? $chain[0] : [];
    $subject = trim((string)($leaf['subject'] ?? ''));
    $issuer = trim((string)($leaf['issuer'] ?? ''));
    $host = ($leaf['cobreHostname'] ?? null) === true ? 'HOST_OK' : (($leaf['cobreHostname'] ?? null) === false ? 'HOST_DIVERGENTE' : 'HOST_ND');
    $subj = $subject !== '' ? mb_substr($subject, 0, 90) : 'NAO_LIDO';
    $iss = $issuer !== '' ? mb_substr($issuer, 0, 90) : 'NAO_LIDO';
    return $host . '/SUBJ_' . $subj . '/ISS_' . $iss . '/N_' . count($chain);
}

function sefazExecutarDiagnosticoCurl(
    string $nome,
    string $url,
    array $ca,
    ?string $certFile = null,
    ?string $keyFile = null,
    ?string $postBody = null,
    bool $forcarIpv4 = false
): array {
    $ch = curl_init($url);
    if ($ch === false) throw new RuntimeException('Falha ao iniciar diagnóstico fiscal.');

    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => false,
        CURLOPT_CONNECTTIMEOUT => 12,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_MAXREDIRS => 0,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CERTINFO => true,
        CURLOPT_USERAGENT => 'SynergiasERP-SEFAZ-Diagnostico/' . SEFAZ_STATUS_VERSION,
        CURLOPT_HTTPHEADER => ['Accept: application/soap+xml, text/xml, text/html', 'Connection: close'],
    ];
    if ($forcarIpv4 && defined('CURL_IPRESOLVE_V4')) $options[CURLOPT_IPRESOLVE] = CURL_IPRESOLVE_V4;
    if (is_string($ca['path'] ?? null) && (string)$ca['path'] !== '') $options[CURLOPT_CAINFO] = (string)$ca['path'];
    if ($certFile !== null && $keyFile !== null) {
        $options[CURLOPT_SSLCERT] = $certFile;
        $options[CURLOPT_SSLKEY] = $keyFile;
        $options[CURLOPT_SSLCERTTYPE] = 'PEM';
        $options[CURLOPT_SSLKEYTYPE] = 'PEM';
    }
    if ($postBody !== null) {
        $options[CURLOPT_POST] = true;
        $options[CURLOPT_POSTFIELDS] = $postBody;
        $options[CURLOPT_HTTPHEADER] = [
            'Content-Type: application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
            'Accept: application/soap+xml, text/xml',
            'Connection: close',
        ];
    }
    curl_setopt_array($ch, $options);
    $response = curl_exec($ch);
    $info = curl_getinfo($ch);
    $result = [
        'nome' => $nome,
        'comA1' => $certFile !== null,
        'metodo' => $postBody !== null ? 'POST' : 'GET',
        'ipv4Forcado' => $forcarIpv4,
        'ca' => sefazCaResumo($ca),
        'codigoTransporte' => curl_errno($ch),
        'erroTransporte' => mb_substr(trim((string)curl_error($ch)), 0, 300),
        'httpStatus' => (int)($info['http_code'] ?? 0),
        'sslVerifyResult' => isset($info['ssl_verify_result']) ? (int)$info['ssl_verify_result'] : null,
        'urlEfetiva' => mb_substr((string)($info['url'] ?? $url), 0, 500),
        'redirectUrl' => mb_substr((string)($info['redirect_url'] ?? ''), 0, 500),
        'redirects' => (int)($info['redirect_count'] ?? 0),
        'ipRemoto' => (string)($info['primary_ip'] ?? ''),
        'portaRemota' => (int)($info['primary_port'] ?? 0),
        'ipLocal' => (string)($info['local_ip'] ?? ''),
        'tlsOk' => curl_errno($ch) === 0,
        'respostaRecebida' => is_string($response) && $response !== '',
        'bytesResposta' => is_string($response) ? strlen($response) : 0,
        'duracaoMs' => (int)round(((float)($info['total_time'] ?? 0)) * 1000),
        'cadeiaRemota' => sefazCertInfoResumo((array)($info['certinfo'] ?? [])),
    ];
    curl_close($ch);
    return $result;
}

function sefazExecutarComFallbacks(
    string $nome,
    string $url,
    array $bundles,
    ?string $certFile = null,
    ?string $keyFile = null,
    ?string $postBody = null
): array {
    $tentativas = [];
    $selecionados = [];
    foreach ($bundles as $bundle) {
        $origem = (string)($bundle['origem'] ?? '');
        if ($origem === 'bundle_privado_erp' || $origem === 'padrao_curl_sistema') $selecionados[] = $bundle;
    }
    if (!$selecionados && $bundles) $selecionados[] = $bundles[0];
    foreach ($selecionados as $bundle) {
        $trial = sefazExecutarDiagnosticoCurl($nome, $url, $bundle, $certFile, $keyFile, $postBody, false);
        $tentativas[] = $trial;
        if ((int)$trial['codigoTransporte'] === 0) break;
        if ((int)$trial['codigoTransporte'] === 60) {
            $trial4 = sefazExecutarDiagnosticoCurl($nome . '_ipv4', $url, $bundle, $certFile, $keyFile, $postBody, true);
            $tentativas[] = $trial4;
            if ((int)$trial4['codigoTransporte'] === 0) break;
        }
    }
    return $tentativas;
}

function sefazResumoFalha(array $diagnostico): string {
    $partes = [];
    foreach (['controlePublico', 'sefazSemA1', 'sefazComA1'] as $chave) {
        $tentativas = is_array($diagnostico[$chave] ?? null) ? $diagnostico[$chave] : [];
        $ultima = $tentativas ? end($tentativas) : null;
        if (!is_array($ultima)) continue;
        $codigo = (int)($ultima['codigoTransporte'] ?? -1);
        $http = (int)($ultima['httpStatus'] ?? 0);
        $partes[] = $chave . '=' . ($codigo === 0 ? 'TLS_OK/HTTP_' . $http : 'CURL_' . $codigo);
    }
    return implode('; ', $partes);
}

function sefazSoapStatus(string $tpAmb): string {
    return '<?xml version="1.0" encoding="UTF-8"?>'
        . '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">'
        . '<soap12:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">'
        . '<cUF>' . SEFAZ_RS_CUF . '</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header>'
        . '<soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">'
        . '<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">'
        . '<tpAmb>' . $tpAmb . '</tpAmb><cUF>' . SEFAZ_RS_CUF . '</cUF><xServ>STATUS</xServ>'
        . '</consStatServ></nfeDadosMsg></soap12:Body></soap12:Envelope>';
}

function sefazValorXpath(DOMXPath $xpath, string $localName): string {
    $nodes = $xpath->query('//*[local-name()="' . $localName . '"]');
    if (!$nodes || $nodes->length === 0) return '';
    return trim((string)$nodes->item(0)?->textContent);
}

function sefazConsultarStatus(): never {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    $body = is_array($body) ? $body : [];
    $ambiente = strtoupper(trim((string)($body['ambiente'] ?? 'HOMOLOGACAO')));
    $uf = strtoupper(trim((string)($body['uf'] ?? 'RS')));
    $cnpjConfigurado = sefazSomenteDigitos((string)($body['cnpj'] ?? ''));

    if ($ambiente !== 'HOMOLOGACAO') {
        sefazResponder(422, ['ok' => false, 'mensagem' => 'Nesta etapa, somente o ambiente de homologação está liberado.']);
    }
    if ($uf !== 'RS') {
        sefazResponder(422, ['ok' => false, 'mensagem' => 'Nesta etapa, a consulta está configurada exclusivamente para a SEFAZ-RS.']);
    }
    if (!preg_match('/^\d{14}$/', $cnpjConfigurado)) {
        sefazResponder(422, ['ok' => false, 'mensagem' => 'CNPJ fiscal inválido.']);
    }
    if (!extension_loaded('curl') || !extension_loaded('openssl') || !class_exists('DOMDocument')) {
        throw new RuntimeException('Extensões necessárias para comunicação fiscal não estão disponíveis.');
    }

    $material = sefazLerMaterialA1();
    $metaCnpj = sefazSomenteDigitos((string)($material['metadata']['cnpj'] ?? ''));
    if ($metaCnpj === '' || !hash_equals($cnpjConfigurado, $metaCnpj)) {
        sefazResponder(422, ['ok' => false, 'mensagem' => 'O CNPJ da Configuração Fiscal não corresponde ao certificado A1 instalado.']);
    }

    $certContent = (string)$material['cert'];
    foreach ($material['extras'] as $extra) {
        if (is_string($extra) && trim($extra) !== '') $certContent .= "\n" . trim($extra) . "\n";
    }

    $certFile = null;
    $keyFile = null;
    try {
        $certFile = sefazTempPem('sefaz-cert', $certContent);
        $keyFile = sefazTempPem('sefaz-key', (string)$material['pkey']);
        $soap = sefazSoapStatus('2');
        $caBundles = sefazCaBundles();
        $hostSefaz = (string)(parse_url(SEFAZ_RS_HOMOLOGACAO_STATUS_URL, PHP_URL_HOST) ?? '');
        $hostControle = (string)(parse_url(SEFAZ_CONTROLE_PUBLICO_URL, PHP_URL_HOST) ?? '');

        // Teste 1: HTTPS público confiável da própria SVRS, sem A1 e sem dados fiscais.
        $controlePublico = sefazExecutarComFallbacks('controle_publico_svrs', SEFAZ_CONTROLE_PUBLICO_URL, $caBundles);
        // Teste 2: mesmo host do Web Service, sem A1 e sem SOAP. Um HTTP 4xx ainda confirma TLS válido.
        $sefazSemA1 = sefazExecutarComFallbacks('sefaz_sem_a1', SEFAZ_RS_HOMOLOGACAO_STATUS_URL, $caBundles);
        // Teste 3: host alternativo oficial SVRS, apenas para diagnóstico comparativo e sem A1.
        $svrsSemA1 = sefazExecutarComFallbacks('svrs_homologacao_sem_a1', SEFAZ_SVRS_HOMOLOGACAO_STATUS_URL, $caBundles);
        // Teste 4: chamada oficial RS com A1 e SOAP de status.
        $sefazComA1 = sefazExecutarComFallbacks('sefaz_com_a1', SEFAZ_RS_HOMOLOGACAO_STATUS_URL, $caBundles, $certFile, $keyFile, $soap);
        // Captura pública passiva da cadeia para descobrir emissor/intermediária/hostname.
        $cadeiaRs = sefazCapturarCadeiaRemota(SEFAZ_RS_HOMOLOGACAO_STATUS_URL);
        $cadeiaSvrs = sefazCapturarCadeiaRemota(SEFAZ_SVRS_HOMOLOGACAO_STATUS_URL);
        $verifyRs = sefazExecutarOpenSslVerify($cadeiaRs, $caBundles);
        $verifySvrs = sefazExecutarOpenSslVerify($cadeiaSvrs, $caBundles);

        $curlResult = null;
        foreach ($sefazComA1 as $trial) {
            if (is_array($trial)) $curlResult = $trial;
            if (is_array($trial) && (int)($trial['codigoTransporte'] ?? -1) === 0 && !empty($trial['respostaRecebida'])) break;
        }
        if (!is_array($curlResult)) throw new RuntimeException('Nenhuma tentativa TLS com A1 foi executada.');

        $response = '';
        // Reexecuta somente a chamada operacional vencedora para obter o corpo SOAP sem armazená-lo no diagnóstico.
        if ((int)$curlResult['codigoTransporte'] === 0) {
            $caVencedora = null;
            $origemVencedora = (string)($curlResult['ca']['origem'] ?? '');
            foreach ($caBundles as $bundle) if ((string)($bundle['origem'] ?? '') === $origemVencedora) { $caVencedora = $bundle; break; }
            if (!is_array($caVencedora)) $caVencedora = ['path' => null, 'origem' => 'padrao_curl_sistema'];
            $ch = curl_init(SEFAZ_RS_HOMOLOGACAO_STATUS_URL);
            if ($ch === false) throw new RuntimeException('Falha ao iniciar consulta operacional.');
            $opts = [
                CURLOPT_POST => true, CURLOPT_POSTFIELDS => $soap, CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 15, CURLOPT_TIMEOUT => 40,
                CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_SSLCERT => $certFile, CURLOPT_SSLKEY => $keyFile,
                CURLOPT_SSLCERTTYPE => 'PEM', CURLOPT_SSLKEYTYPE => 'PEM',
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
                    'Accept: application/soap+xml, text/xml', 'Connection: close',
                    'User-Agent: SynergiasERP-SEFAZ/' . SEFAZ_STATUS_VERSION,
                ],
            ];
            if (is_string($caVencedora['path'] ?? null) && (string)$caVencedora['path'] !== '') $opts[CURLOPT_CAINFO] = (string)$caVencedora['path'];
            if (!empty($curlResult['ipv4Forcado']) && defined('CURL_IPRESOLVE_V4')) $opts[CURLOPT_IPRESOLVE] = CURL_IPRESOLVE_V4;
            curl_setopt_array($ch, $opts);
            $bodyOperacional = curl_exec($ch);
            $response = is_string($bodyOperacional) ? $bodyOperacional : '';
            $curlErrNo = curl_errno($ch);
            $httpStatus = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $totalTime = (float)curl_getinfo($ch, CURLINFO_TOTAL_TIME);
            curl_close($ch);
        } else {
            $curlErrNo = (int)$curlResult['codigoTransporte'];
            $httpStatus = (int)$curlResult['httpStatus'];
            $totalTime = ((int)$curlResult['duracaoMs']) / 1000;
        }
        $caOrigemUsada = (string)($curlResult['ca']['origem'] ?? 'nao_identificado');

        if ($response === '' || $curlErrNo !== 0) {
            $curlVersion = curl_version();
            $diagnostico = [
                'versaoEndpoint' => SEFAZ_STATUS_VERSION,
                'endpointOficial' => SEFAZ_RS_HOMOLOGACAO_STATUS_URL,
                'endpointAlternativoOficialSomenteDiagnostico' => SEFAZ_SVRS_HOMOLOGACAO_STATUS_URL,
                'dns' => [
                    'controlePublico' => ['host' => $hostControle, 'ips' => sefazDnsResumo($hostControle)],
                    'sefaz' => ['host' => $hostSefaz, 'ips' => sefazDnsResumo($hostSefaz)],
                    'svrsAlternativo' => ['host' => (string)(parse_url(SEFAZ_SVRS_HOMOLOGACAO_STATUS_URL, PHP_URL_HOST) ?? ''), 'ips' => sefazDnsResumo((string)(parse_url(SEFAZ_SVRS_HOMOLOGACAO_STATUS_URL, PHP_URL_HOST) ?? ''))],
                ],
                'ambienteServidor' => [
                    'php' => PHP_VERSION,
                    'opensslPhp' => defined('OPENSSL_VERSION_TEXT') ? OPENSSL_VERSION_TEXT : '',
                    'curl' => (string)($curlVersion['version'] ?? ''),
                    'sslBackendCurl' => (string)($curlVersion['ssl_version'] ?? ''),
                    'libz' => (string)($curlVersion['libz_version'] ?? ''),
                    'curlCaInfoConfigurado' => trim((string)ini_get('curl.cainfo')) !== '',
                    'opensslCaFileConfigurado' => trim((string)ini_get('openssl.cafile')) !== '',
                ],
                'controlePublico' => $controlePublico,
                'sefazSemA1' => $sefazSemA1,
                'svrsSemA1' => $svrsSemA1,
                'sefazComA1' => $sefazComA1,
                'cadeiaRs' => sefazLimparPemsDiagnostico($cadeiaRs),
                'cadeiaSvrs' => sefazLimparPemsDiagnostico($cadeiaSvrs),
                'opensslVerifyRs' => $verifyRs,
                'opensslVerifySvrs' => $verifySvrs,
            ];
            $resumo = sefazResumoFalha($diagnostico);
            $svrsUltima = $svrsSemA1 ? end($svrsSemA1) : null;
            $svrsCodigo = is_array($svrsUltima) ? (int)($svrsUltima['codigoTransporte'] ?? -1) : -1;
            $svrsHttp = is_array($svrsUltima) ? (int)($svrsUltima['httpStatus'] ?? 0) : 0;
            $svrsResumo = $svrsCodigo === 0 ? 'TLS_OK/HTTP_' . $svrsHttp : 'CURL_' . $svrsCodigo;
            $cadeiaRsResumo = sefazResumoCadeia($cadeiaRs);
            $cadeiaSvrsResumo = sefazResumoCadeia($cadeiaSvrs);
            sefazAuditar('FALHA_DIAGNOSTICO_V34', ['resumo' => $resumo, 'svrs' => $svrsResumo, 'cadeiaRs' => $cadeiaRsResumo, 'cadeiaSvrs' => $cadeiaSvrsResumo]);
            $verifyRsResumo = 'ND';
            if (!empty($verifyRs['resultados']) && is_array($verifyRs['resultados'])) {
                $ultimoVerify = end($verifyRs['resultados']);
                if (is_array($ultimoVerify)) $verifyRsResumo = !empty($ultimoVerify['ok']) ? 'VERIFY_OK' : 'VERIFY_FALHOU_' . (int)($ultimoVerify['exitCode'] ?? -1);
            } elseif (($verifyRs['executado'] ?? false) === false) {
                $verifyRsResumo = 'VERIFY_NAO_EXECUTADO_' . (string)($verifyRs['motivo'] ?? 'ND');
            }
            $bundlePrivado = ['origem' => 'bundle_privado_erp', 'arquivoConfigurado' => false, 'legivel' => false, 'tamanho' => 0];
            foreach ($caBundles as $bundleItem) {
                if ((string)($bundleItem['origem'] ?? '') === 'bundle_privado_erp') {
                    $bundlePrivado = sefazCaResumo($bundleItem);
                    $bundlePath = is_string($bundleItem['path'] ?? null) ? (string)$bundleItem['path'] : '';
                    if ($bundlePath !== '' && is_file($bundlePath) && is_readable($bundlePath)) {
                        $bundleRaw = (string)@file_get_contents($bundlePath);
                        $bundlePrivado['certificadosPem'] = substr_count($bundleRaw, '-----BEGIN CERTIFICATE-----');
                        $bundlePrivado['contemSerproSslV1'] = stripos($bundleRaw, 'SERPRO SSLv1') !== false;
                        $bundlePrivado['contemRaizV10'] = stripos($bundleRaw, 'Raiz Brasileira v10') !== false || stripos($bundleRaw, 'AC Raiz da ICP-Brasil v10') !== false;
                    }
                    break;
                }
            }
            $verifyDetalhe = 'ND';
            if (!empty($verifyRs['resultados']) && is_array($verifyRs['resultados'])) {
                $ultimoVerifyDetalhe = end($verifyRs['resultados']);
                if (is_array($ultimoVerifyDetalhe)) {
                    $verifyDetalhe = trim((string)($ultimoVerifyDetalhe['resultado'] ?? ''));
                    $verifyDetalhe = mb_substr(preg_replace('/\s+/', ' ', $verifyDetalhe) ?: 'ND', 0, 300);
                }
            }
            $diagnostico['bundlePrivadoEfetivo'] = $bundlePrivado;
            $diagnostico['marcadorVersaoAtiva'] = 'SYNERGIAS_SEFAZ_ENDPOINT_V34_ATIVO';
            sefazResponder(502, [
                'ok' => false,
                'mensagem' => 'Diagnóstico V34 — bundle PEM corrigido e endpoint V34 ativo. ' . $resumo . '; svrsAlternativo=' . $svrsResumo . '; cadeiaRS=' . $cadeiaRsResumo . '; cadeiaSVRS=' . $cadeiaSvrsResumo . '; opensslRS=' . $verifyRsResumo . '; detalheOpenSSL=' . $verifyDetalhe . '; bundleHash=' . (string)($bundlePrivado['sha256Prefixo'] ?? 'ND') . '; bundleCerts=' . (string)($bundlePrivado['certificadosPem'] ?? 'ND') . '. A validação TLS operacional permanece obrigatória.',
                'diagnostico' => $diagnostico,
            ]);
        }
        if ($httpStatus < 200 || $httpStatus >= 500) {
            sefazAuditar('FALHA_HTTP', ['http' => $httpStatus]);
            sefazResponder(502, ['ok' => false, 'mensagem' => 'A SEFAZ-RS respondeu com erro HTTP.', 'diagnostico' => ['httpStatus' => $httpStatus]]);
        }

        libxml_use_internal_errors(true);
        $dom = new DOMDocument();
        if (!@$dom->loadXML($response, LIBXML_NONET | LIBXML_NOBLANKS)) {
            libxml_clear_errors();
            sefazAuditar('FALHA_XML', ['http' => $httpStatus]);
            sefazResponder(502, ['ok' => false, 'mensagem' => 'A resposta da SEFAZ-RS não pôde ser interpretada.']);
        }
        libxml_clear_errors();
        $xpath = new DOMXPath($dom);
        $cStat = sefazValorXpath($xpath, 'cStat');
        $xMotivo = sefazValorXpath($xpath, 'xMotivo');
        $tpAmb = sefazValorXpath($xpath, 'tpAmb');
        $cUF = sefazValorXpath($xpath, 'cUF');
        $dhRecbto = sefazValorXpath($xpath, 'dhRecbto');
        $tMed = sefazValorXpath($xpath, 'tMed');
        $versao = sefazValorXpath($xpath, 'verAplic');

        if ($cStat === '') {
            sefazAuditar('SEM_CSTAT', ['http' => $httpStatus]);
            sefazResponder(502, ['ok' => false, 'mensagem' => $xMotivo !== '' ? $xMotivo : 'A SEFAZ-RS não retornou o status esperado.']);
        }

        $operacional = $cStat === '107';
        sefazAuditar($operacional ? 'SUCESSO_107' : 'RETORNO_' . $cStat, ['cStat' => $cStat, 'http' => $httpStatus]);
        sefazResponder(200, [
            'ok' => true,
            'operacional' => $operacional,
            'ambiente' => $tpAmb === '2' ? 'HOMOLOGACAO' : $tpAmb,
            'uf' => $cUF === SEFAZ_RS_CUF ? 'RS' : $cUF,
            'cStat' => $cStat,
            'xMotivo' => $xMotivo,
            'dhRecbto' => $dhRecbto,
            'tempoMedio' => $tMed,
            'versaoAplicacao' => $versao,
            'httpStatus' => $httpStatus,
            'duracaoMs' => (int)round($totalTime * 1000),
            'consultadoEm' => gmdate('c'),
            'endpoint' => 'SEFAZ-RS / NFeStatusServico4 / Homologação',
            'versaoEndpoint' => SEFAZ_STATUS_VERSION,
            'caBundle' => $caOrigemUsada,
        ]);
    } finally {
        sefazApagarSeguro($certFile);
        sefazApagarSeguro($keyFile);
        $material = [];
        $certContent = '';
    }
}

try {
    sefazValidarOrigem();
    sefazUsuarioAdmin();
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $action = strtolower(trim((string)($_GET['action'] ?? 'status')));

    if ($method === 'GET' && $action === 'info') {
        sefazResponder(200, [
            'ok' => true,
            'versaoEndpoint' => SEFAZ_STATUS_VERSION,
            'ambienteLiberado' => 'HOMOLOGACAO',
            'ufLiberada' => 'RS',
            'servico' => 'NFeStatusServico4',
            'diagnosticoSeparado' => true,
            'opensslVerifyCadeia' => true,
            'marcadorVersaoAtiva' => 'SYNERGIAS_SEFAZ_ENDPOINT_V34_ATIVO',
            'capturaCadeiaRemota' => true,
            'endpointAlternativoSomenteDiagnostico' => SEFAZ_SVRS_HOMOLOGACAO_STATUS_URL,
        ]);
    }
    if ($method === 'POST' && $action === 'consultar') sefazConsultarStatus();

    sefazResponder(404, ['ok' => false, 'mensagem' => 'Operação SEFAZ não encontrada.']);
} catch (Throwable $e) {
    error_log('[Synergias SEFAZ Status] ' . $e->getMessage());
    sefazAuditar('ERRO_INTERNO');
    sefazResponder(500, ['ok' => false, 'mensagem' => 'Não foi possível concluir o teste seguro com a SEFAZ-RS.']);
}
