<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$finalizado = false;

function responderDiagnostico(int $status, array $dados): never {
    global $finalizado;
    $finalizado = true;
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

register_shutdown_function(static function (): void {
    global $finalizado;
    if ($finalizado) {
        return;
    }

    $erro = error_get_last();
    if (!$erro) {
        return;
    }

    $tiposFatais = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($erro['type'] ?? 0, $tiposFatais, true)) {
        return;
    }

    $codigo = substr(hash('sha256', ($erro['message'] ?? '') . '|' . ($erro['file'] ?? '') . '|' . ($erro['line'] ?? '')), 0, 12);
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'mensagem' => 'Falha fatal do PHP ao montar o XML.',
        'detalhe' => $erro['message'] ?? 'Erro fatal sem mensagem.',
        'arquivo' => basename((string)($erro['file'] ?? '')),
        'linha' => (int)($erro['line'] ?? 0),
        'codigoErro' => $codigo,
        'versao' => 'V58-DIAGNOSTICO',
        'phpVersion' => PHP_VERSION,
        'extensoes' => [
            'dom' => class_exists('DOMDocument'),
            'openssl' => extension_loaded('openssl'),
            'libxml' => extension_loaded('libxml'),
            'mbstring' => extension_loaded('mbstring'),
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
});

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

try {
    $alvo = __DIR__ . '/nfe-xml-preview-v57.php';

    if (!is_file($alvo)) {
        responderDiagnostico(500, [
            'ok' => false,
            'mensagem' => 'O endpoint XML V57 não foi encontrado no servidor.',
            'arquivoEsperado' => basename($alvo),
            'versao' => 'V58-DIAGNOSTICO',
            'phpVersion' => PHP_VERSION,
        ]);
    }

    require $alvo;
} catch (Throwable $e) {
    $codigo = substr(hash('sha256', get_class($e) . '|' . $e->getMessage() . '|' . $e->getFile() . '|' . $e->getLine()), 0, 12);

    responderDiagnostico(500, [
        'ok' => false,
        'mensagem' => 'Falha capturada ao montar o XML.',
        'tipo' => get_class($e),
        'detalhe' => $e->getMessage(),
        'arquivo' => basename($e->getFile()),
        'linha' => $e->getLine(),
        'codigoErro' => $codigo,
        'versao' => 'V58-DIAGNOSTICO',
        'phpVersion' => PHP_VERSION,
        'extensoes' => [
            'dom' => class_exists('DOMDocument'),
            'openssl' => extension_loaded('openssl'),
            'libxml' => extension_loaded('libxml'),
            'mbstring' => extension_loaded('mbstring'),
        ],
    ]);
}
