<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
exigirAutenticacao();

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
    responder(405, ['ok' => false, 'error' => 'Método não permitido.']);
}

$pdo = obterPdo();
$existe = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='erp_estoque_movimentacoes'")->fetchColumn();
if ((int)$existe === 0) responder(200, ['ok' => true, 'data' => [], 'count' => 0, 'storage' => 'mysql']);

$stmt = $pdo->query('SELECT id,pedido_id,numero_pedido,produto_id,produto_codigo,produto_descricao,quantidade,tipo,origem,estoque_anterior,estoque_atual,movimento_original_id,usuario,criado_em FROM erp_estoque_movimentacoes ORDER BY criado_em DESC,id DESC LIMIT 500');
$movimentos = [];
foreach ($stmt as $registro) {
    $criado = new DateTimeImmutable((string)$registro['criado_em'], new DateTimeZone('America/Sao_Paulo'));
    $movimentos[] = [
        'id' => (string)$registro['id'], 'pedidoId' => (string)$registro['pedido_id'],
        'numeroPedido' => (string)$registro['numero_pedido'], 'produtoId' => (string)$registro['produto_id'],
        'produtoCodigo' => (string)$registro['produto_codigo'], 'produtoDescricao' => (string)$registro['produto_descricao'],
        'quantidade' => (float)$registro['quantidade'], 'tipo' => (string)$registro['tipo'], 'origem' => (string)$registro['origem'],
        'estoqueAnterior' => (float)$registro['estoque_anterior'], 'estoqueAtual' => (float)$registro['estoque_atual'],
        'movimentoOriginalId' => $registro['movimento_original_id'] === null ? null : (string)$registro['movimento_original_id'],
        'usuario' => (string)$registro['usuario'], 'documentoOrigem' => (string)$registro['numero_pedido'],
        'motivo' => 'Entrega do pedido ' . (string)$registro['numero_pedido'],
        'observacao' => 'Movimentação autoritativa do MySQL.',
        'data' => $criado->format('Y-m-d'), 'hora' => $criado->format('H:i:s'), 'criadoEm' => $criado->format(DATE_ATOM),
    ];
}

responder(200, ['ok' => true, 'data' => $movimentos, 'count' => count($movimentos), 'storage' => 'mysql']);

