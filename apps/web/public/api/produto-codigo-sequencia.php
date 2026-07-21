<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
exigirAutenticacao();

const SEQUENCIA_PRODUTO_RAPIDO = 'produto_rapido_codigo_barras';
const CODIGO_INICIAL_CONFIRMADO = 7901211469;

$pdo = obterPdo();
$pdo->exec('CREATE TABLE IF NOT EXISTS erp_storage (
 collection VARCHAR(40) NOT NULL PRIMARY KEY,
 payload LONGTEXT NOT NULL,
 item_count INT UNSIGNED NOT NULL DEFAULT 0,
 payload_hash CHAR(64) NOT NULL DEFAULT "",
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
$pdo->exec('CREATE TABLE IF NOT EXISTS erp_storage_history (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 collection VARCHAR(40) NOT NULL,
 payload LONGTEXT NOT NULL,
 item_count INT UNSIGNED NOT NULL DEFAULT 0,
 payload_hash CHAR(64) NOT NULL DEFAULT "",
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_storage_history_collection (collection, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
$pdo->exec('CREATE TABLE IF NOT EXISTS erp_sequences (
 sequence_name VARCHAR(80) NOT NULL PRIMARY KEY,
 current_value BIGINT UNSIGNED NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

function listaProdutos(?string $payload): array {
    if ($payload === null || trim($payload) === '') return [];
    $dados = json_decode($payload, true);
    return is_array($dados) ? array_values($dados) : [];
}

function codigoProduto(array $produto): string {
    foreach (['codigoBarras', 'codigo_barra', 'ean', 'gtin', 'codigo'] as $campo) {
        $codigo = preg_replace('/\D+/', '', (string)($produto[$campo] ?? '')) ?? '';
        if ($codigo !== '') return $codigo;
    }
    return '';
}

function codigosUsados(array $produtos): array {
    $usados = [];
    foreach ($produtos as $produto) {
        if (!is_array($produto)) continue;
        $codigo = codigoProduto($produto);
        if ($codigo !== '') $usados[$codigo] = true;
    }
    return $usados;
}

function obterAtualSequencia(PDO $pdo, bool $bloquear): int {
    $sql = 'SELECT current_value FROM erp_sequences WHERE sequence_name=:nome' . ($bloquear ? ' FOR UPDATE' : '');
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['nome' => SEQUENCIA_PRODUTO_RAPIDO]);
    $registro = $stmt->fetch();
    if (!$registro) {
        $insert = $pdo->prepare('INSERT IGNORE INTO erp_sequences (sequence_name,current_value) VALUES (:nome,:valor)');
        $insert->execute(['nome' => SEQUENCIA_PRODUTO_RAPIDO, 'valor' => CODIGO_INICIAL_CONFIRMADO]);
        $stmt->execute(['nome' => SEQUENCIA_PRODUTO_RAPIDO]);
        $registro = $stmt->fetch();
    }
    return max(CODIGO_INICIAL_CONFIRMADO, (int)($registro['current_value'] ?? CODIGO_INICIAL_CONFIRMADO));
}

function proximoLivre(int $atual, array $usados): int {
    $proximo = $atual + 1;
    while (isset($usados[(string)$proximo])) $proximo++;
    return $proximo;
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT payload FROM erp_storage WHERE collection="produtos" LIMIT 1');
    $stmt->execute();
    $registro = $stmt->fetch();
    $produtos = listaProdutos(is_array($registro) ? (string)$registro['payload'] : null);
    $codigo = proximoLivre(obterAtualSequencia($pdo, false), codigosUsados($produtos));
    responder(200, ['ok' => true, 'codigo' => (string)$codigo, 'origem' => 'sequencia_mysql']);
}

if ($method !== 'POST') responder(405, ['ok' => false, 'error' => 'Método não permitido.']);

$raw = file_get_contents('php://input') ?: '{}';
$body = json_decode($raw, true);
$produtoEntrada = is_array($body) && is_array($body['produto'] ?? null) ? $body['produto'] : null;
if (!$produtoEntrada) responder(422, ['ok' => false, 'error' => 'Produto não informado.']);
$nome = trim((string)($produtoEntrada['descricao'] ?? $produtoEntrada['nome'] ?? ''));
if ($nome === '') responder(422, ['ok' => false, 'error' => 'Nome do produto não informado.']);

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('SELECT payload FROM erp_storage WHERE collection="produtos" FOR UPDATE');
    $stmt->execute();
    $registro = $stmt->fetch();
    $produtos = listaProdutos(is_array($registro) ? (string)$registro['payload'] : null);
    $codigo = proximoLivre(obterAtualSequencia($pdo, true), codigosUsados($produtos));

    $agora = gmdate('c');
    $produto = $produtoEntrada;
    $produto['id'] = trim((string)($produto['id'] ?? '')) ?: ('produto-' . bin2hex(random_bytes(12)));
    $produto['codigo'] = (string)$codigo;
    $produto['codigoBarras'] = (string)$codigo;
    $produto['nome'] = trim((string)($produto['nome'] ?? $nome)) ?: $nome;
    $produto['descricao'] = $nome;
    $produto['origemCadastro'] = 'orcamento-rapido';
    $produto['criadoEm'] = trim((string)($produto['criadoEm'] ?? '')) ?: $agora;
    $produto['atualizadoEm'] = $agora;
    $produtos[] = $produto;

    $payloadAnterior = is_array($registro) ? (string)$registro['payload'] : '[]';
    if (count(listaProdutos($payloadAnterior)) > 0) {
        $hist = $pdo->prepare('INSERT INTO erp_storage_history (collection,payload,item_count,payload_hash) VALUES ("produtos",:payload,:count,:hash)');
        $hist->execute(['payload' => $payloadAnterior, 'count' => count(listaProdutos($payloadAnterior)), 'hash' => hash('sha256', $payloadAnterior)]);
    }

    $payload = json_encode(array_values($produtos), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $hash = hash('sha256', $payload);
    $up = $pdo->prepare('INSERT INTO erp_storage (collection,payload,item_count,payload_hash) VALUES ("produtos",:payload,:count,:hash) ON DUPLICATE KEY UPDATE payload=VALUES(payload),item_count=VALUES(item_count),payload_hash=VALUES(payload_hash),updated_at=CURRENT_TIMESTAMP');
    $up->execute(['payload' => $payload, 'count' => count($produtos), 'hash' => $hash]);
    $seq = $pdo->prepare('UPDATE erp_sequences SET current_value=:valor WHERE sequence_name=:nome');
    $seq->execute(['valor' => $codigo, 'nome' => SEQUENCIA_PRODUTO_RAPIDO]);

    $pdo->commit();
    responder(200, [
        'ok' => true,
        'codigo' => (string)$codigo,
        'produto' => $produto,
        'data' => array_values($produtos),
        'count' => count($produtos),
        'verified' => true,
        'storage' => 'mysql',
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}
