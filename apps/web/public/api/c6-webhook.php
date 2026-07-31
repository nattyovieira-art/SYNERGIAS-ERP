<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/c6-config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(['ok' => true, 'service' => 'BANK_SLIP'], JSON_UNESCAPED_SLASHES);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método não permitido.']);
    exit;
}

$evento = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($evento)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON inválido.']);
    exit;
}
$config = carregarConfigC6();
$arquivo = dirname((string)$config['cert_path']) . '/webhook-events.jsonl';
$registro = ['receivedAt' => gmdate('c'), 'service' => 'BANK_SLIP', 'event' => $evento];
if (@file_put_contents($arquivo, json_encode($registro, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND | LOCK_EX) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Não foi possível registrar o evento.']);
    exit;
}
@chmod($arquivo, 0600);
echo json_encode(['ok' => true], JSON_UNESCAPED_SLASHES);
