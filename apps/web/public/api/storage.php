<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
exigirAutenticacao();

$collectionsPermitidas = ['clientes', 'produtos', 'vendas'];
$collection = trim((string)($_GET['collection'] ?? ''));
if (!in_array($collection, $collectionsPermitidas, true)) {
    responder(400, ['ok' => false, 'error' => 'Coleção inválida.']);
}

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

// Compatibilidade com instalações anteriores.
foreach ([
    'ALTER TABLE erp_storage ADD COLUMN item_count INT UNSIGNED NOT NULL DEFAULT 0',
    'ALTER TABLE erp_storage ADD COLUMN payload_hash CHAR(64) NOT NULL DEFAULT ""',
    'ALTER TABLE erp_storage ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE erp_storage ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    'ALTER TABLE erp_storage_history ADD COLUMN payload_hash CHAR(64) NOT NULL DEFAULT ""'
] as $sqlCompatibilidade) {
    try { $pdo->exec($sqlCompatibilidade); } catch (Throwable $ignorado) {}
}

function decodificarLista(?string $payload): array {
    if ($payload === null || trim($payload) === '') return [];
    $data = json_decode($payload, true);
    return is_array($data) ? array_values($data) : [];
}

function codificarLista(array $data): string {
    return json_encode(array_values($data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function hashPayload(string $payload): string {
    return hash('sha256', $payload);
}

function contarTipoVenda(array $dados, string $tipoAlvo): int {
    $total = 0;
    foreach ($dados as $item) {
        if (!is_array($item)) continue;
        $tipo = mb_strtolower(trim((string)($item['tipo'] ?? '')), 'UTF-8');
        $status = mb_strtolower(trim((string)($item['status'] ?? '')), 'UTF-8');
        $ehPedido = str_contains($tipo, 'pedido') || $status === 'pedido';
        $ehOrcamento = str_contains($tipo, 'orçamento') || str_contains($tipo, 'orcamento') || (!$ehPedido && !empty($item['numeroOrcamento']));
        if (($tipoAlvo === 'pedido' && $ehPedido) || ($tipoAlvo === 'orcamento' && $ehOrcamento)) $total++;
    }
    return $total;
}

function validarReducaoAnormal(string $collection, array $atual, array $nova): void {
    if ($collection !== 'vendas' || count($atual) === 0 || count($nova) >= count($atual)) return;
    $quedaTotal = count($atual) - count($nova);
    $limiteTotal = max(3, (int)ceil(count($atual) * 0.10));
    $pedidosAtuais = contarTipoVenda($atual, 'pedido');
    $pedidosNovos = contarTipoVenda($nova, 'pedido');
    $orcamentosAtuais = contarTipoVenda($atual, 'orcamento');
    $orcamentosNovos = contarTipoVenda($nova, 'orcamento');
    $limitePedidos = max(1, (int)ceil($pedidosAtuais * 0.10));
    $limiteOrcamentos = max(2, (int)ceil($orcamentosAtuais * 0.10));
    if ($quedaTotal > $limiteTotal || ($pedidosAtuais - $pedidosNovos) > $limitePedidos || ($orcamentosAtuais - $orcamentosNovos) > $limiteOrcamentos) {
        responder(409, [
            'ok' => false,
            'error' => 'Gravação bloqueada: redução anormal da coleção vendas.',
            'currentCount' => count($atual),
            'newCount' => count($nova),
            'currentOrders' => $pedidosAtuais,
            'newOrders' => $pedidosNovos,
            'currentQuotes' => $orcamentosAtuais,
            'newQuotes' => $orcamentosNovos,
        ]);
    }
}


function vendaDigitos(mixed $v): string {
    $n = preg_replace('/\D+/', '', trim((string)($v ?? ''))) ?: '';
    return ltrim($n, '0') ?: '';
}
function vendaPedido(array $v): string {
    $tipo = mb_strtolower(trim((string)($v['tipo'] ?? '')), 'UTF-8');
    $ehPedido = str_contains($tipo, 'pedido');
    if (!$ehPedido) return '';
    foreach (['numeroPedido','pedidoNumero','numero_pedido'] as $k) {
        $n = vendaDigitos($v[$k] ?? '');
        if ($n !== '') return $n;
    }
    return vendaDigitos($v['numero'] ?? '');
}
function vendaNfe(array $v): string {
    foreach (['numeroNotaFiscal','numeroNFe','notaFiscalNumero','nfeNumero','numero_nf'] as $k) {
        $n = vendaDigitos($v[$k] ?? '');
        if ($n !== '') return $n;
    }
    return '';
}
function vendaChave(array $v): string {
    foreach (['chaveAcessoNotaFiscal','chaveAcesso','chaveNFe','chave_nfe'] as $k) {
        $n = preg_replace('/\D+/', '', trim((string)($v[$k] ?? ''))) ?: '';
        if (strlen($n) === 44) return $n;
    }
    return '';
}
function vendaId(array $v): string { return trim((string)($v['id'] ?? '')); }

function validarIntegridadeVendas(array $atual, array $nova): void {
    $pedidoSeen = [];
    $nfeSeen = [];
    $chaveSeen = [];
    $novaPorId = [];
    $novaPorNfe = [];

    foreach ($nova as $i => $v) {
        if (!is_array($v)) continue;
        $id = vendaId($v);
        if ($id !== '') {
            if (isset($novaPorId[$id])) responder(409, ['ok'=>false,'error'=>"Gravação bloqueada: ID de venda duplicado ({$id})."]);
            $novaPorId[$id] = $v;
        }

        $pedido = vendaPedido($v);
        if ($pedido !== '') {
            if (isset($pedidoSeen[$pedido])) {
                responder(409, ['ok'=>false,'error'=>"Gravação bloqueada: Pedido {$pedido} duplicado. Cada pedido deve ter número único."]);
            }
            $pedidoSeen[$pedido] = $i;
        }

        $nfe = vendaNfe($v);
        if ($nfe !== '') {
            if (isset($nfeSeen[$nfe])) {
                responder(409, ['ok'=>false,'error'=>"Gravação bloqueada: NF-e {$nfe} duplicada em mais de um registro."]);
            }
            $nfeSeen[$nfe] = $i;
            $novaPorNfe[$nfe] = $v;
        }

        $chave = vendaChave($v);
        if ($chave !== '') {
            if (isset($chaveSeen[$chave])) {
                responder(409, ['ok'=>false,'error'=>'Gravação bloqueada: chave de acesso da NF-e duplicada.']);
            }
            $chaveSeen[$chave] = $i;
        }
    }

    foreach ($atual as $antigo) {
        if (!is_array($antigo)) continue;
        $id = vendaId($antigo);
        $nfe = vendaNfe($antigo);
        $chave = vendaChave($antigo);

        if ($id !== '' && !isset($novaPorId[$id])) {
            responder(409, [
                'ok'=>false,
                'error'=>"Gravação bloqueada: o registro {$id} desapareceria. Exclusões de vendas precisam de rotina explícita e auditada."
            ]);
        }

        $novo = $id !== '' ? ($novaPorId[$id] ?? null) : ($nfe !== '' ? ($novaPorNfe[$nfe] ?? null) : null);
        if (!is_array($novo)) continue;

        if ($nfe !== '' && vendaNfe($novo) !== $nfe) {
            responder(409, ['ok'=>false,'error'=>"Gravação bloqueada: a NF-e {$nfe} seria removida ou trocada do registro {$id}."]);
        }
        if ($chave !== '' && vendaChave($novo) !== $chave) {
            responder(409, ['ok'=>false,'error'=>"Gravação bloqueada: a chave da NF-e {$nfe} seria removida ou alterada."]);
        }
        foreach (['protocoloNotaFiscal','xmlNotaFiscal'] as $campo) {
            $antes = trim((string)($antigo[$campo] ?? ''));
            $depois = trim((string)($novo[$campo] ?? ''));
            if ($antes !== '' && $depois === '') {
                responder(409, ['ok'=>false,'error'=>"Gravação bloqueada: {$campo} da NF-e {$nfe} seria apagado."]);
            }
        }
    }
}

function salvarHistorico(PDO $pdo, string $collection, array $data): void {
    if (count($data) === 0) return;
    $payload = codificarLista($data);
    $stmt = $pdo->prepare('INSERT INTO erp_storage_history (collection,payload,item_count,payload_hash) VALUES (:collection,:payload,:count,:hash)');
    $stmt->execute([
        'collection' => $collection,
        'payload' => $payload,
        'count' => count($data),
        'hash' => hashPayload($payload),
    ]);
    $pdo->prepare('DELETE FROM erp_storage_history WHERE collection=:collection AND id NOT IN (SELECT id FROM (SELECT id FROM erp_storage_history WHERE collection=:collection2 ORDER BY id DESC LIMIT 300) x)')
        ->execute(['collection' => $collection, 'collection2' => $collection]);
}

function lerRegistro(PDO $pdo, string $collection): ?array {
    $stmt = $pdo->prepare('SELECT payload,item_count,payload_hash,updated_at FROM erp_storage WHERE collection=:collection LIMIT 1');
    $stmt->execute(['collection' => $collection]);
    $registro = $stmt->fetch();
    return is_array($registro) ? $registro : null;
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    $registro = lerRegistro($pdo, $collection);
    $data = $registro ? decodificarLista((string)$registro['payload']) : [];
    $recovered = false;

    if (count($data) === 0) {
        $hist = $pdo->prepare('SELECT payload FROM erp_storage_history WHERE collection=:collection AND item_count>0 ORDER BY id DESC LIMIT 1');
        $hist->execute(['collection' => $collection]);
        $historico = $hist->fetch();
        if ($historico) {
            $data = decodificarLista((string)$historico['payload']);
            if (count($data) > 0) {
                $payload = codificarLista($data);
                $up = $pdo->prepare('INSERT INTO erp_storage (collection,payload,item_count,payload_hash) VALUES (:collection,:payload,:count,:hash) ON DUPLICATE KEY UPDATE payload=VALUES(payload),item_count=VALUES(item_count),payload_hash=VALUES(payload_hash),updated_at=CURRENT_TIMESTAMP');
                $up->execute([
                    'collection' => $collection,
                    'payload' => $payload,
                    'count' => count($data),
                    'hash' => hashPayload($payload),
                ]);
                $registro = lerRegistro($pdo, $collection);
                $recovered = true;
            }
        }
    }

    responder(200, [
        'ok' => true,
        'collection' => $collection,
        'exists' => $registro !== null || count($data) > 0,
        'data' => $data,
        'count' => count($data),
        'hash' => $registro['payload_hash'] ?? ($data ? hashPayload(codificarLista($data)) : ''),
        'updatedAt' => $registro['updated_at'] ?? null,
        'recovered' => $recovered,
        'storage' => 'mysql',
    ]);
}

if ($method === 'PUT') {
    $raw = file_get_contents('php://input') ?: '{}';
    $body = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    $data = $body['data'] ?? null;
    $allowEmpty = (bool)($body['allowEmpty'] ?? false);
    if (!is_array($data)) responder(422, ['ok' => false, 'error' => 'O campo data precisa ser uma lista.']);
    $data = array_values($data);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT payload FROM erp_storage WHERE collection=:collection FOR UPDATE');
        $stmt->execute(['collection' => $collection]);
        $registroAtual = $stmt->fetch();
        $atual = $registroAtual ? decodificarLista((string)$registroAtual['payload']) : [];

        validarReducaoAnormal($collection, $atual, $data);
        if ($collection === 'vendas') validarIntegridadeVendas($atual, $data);

        if (count($data) === 0 && count($atual) > 0 && !$allowEmpty) {
            $pdo->rollBack();
            responder(409, [
                'ok' => false,
                'error' => 'Gravação vazia bloqueada para proteger os dados existentes.',
                'currentCount' => count($atual),
            ]);
        }

        salvarHistorico($pdo, $collection, $atual);
        $payload = codificarLista($data);
        $hash = hashPayload($payload);
        $up = $pdo->prepare('INSERT INTO erp_storage (collection,payload,item_count,payload_hash) VALUES (:collection,:payload,:count,:hash) ON DUPLICATE KEY UPDATE payload=VALUES(payload),item_count=VALUES(item_count),payload_hash=VALUES(payload_hash),updated_at=CURRENT_TIMESTAMP');
        $up->execute([
            'collection' => $collection,
            'payload' => $payload,
            'count' => count($data),
            'hash' => $hash,
        ]);
        salvarHistorico($pdo, $collection, $data);

        $confirmacao = lerRegistro($pdo, $collection);
        if (!$confirmacao || (int)$confirmacao['item_count'] !== count($data) || !hash_equals($hash, (string)$confirmacao['payload_hash'])) {
            throw new RuntimeException('O servidor não conseguiu confirmar a persistência integral da coleção.');
        }

        $dadosConfirmados = decodificarLista((string)$confirmacao['payload']);
        if (count($dadosConfirmados) !== count($data)) {
            throw new RuntimeException('A releitura do banco retornou uma quantidade diferente da lista enviada.');
        }

        $pdo->commit();
        responder(200, [
            'ok' => true,
            'collection' => $collection,
            'count' => count($data),
            'hash' => $hash,
            'updatedAt' => $confirmacao['updated_at'] ?? null,
            'verified' => true,
            'storage' => 'mysql',
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

responder(405, ['ok' => false, 'error' => 'Método não permitido.']);
