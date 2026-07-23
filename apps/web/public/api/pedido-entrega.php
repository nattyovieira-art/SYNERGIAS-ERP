<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
exigirAutenticacao();

const MENSAGEM_ESTOQUE_JA_BAIXADO = 'O estoque deste Pedido já foi baixado anteriormente.';

function listaEntrega(?string $payload): array {
    if ($payload === null || trim($payload) === '') return [];
    $data = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
    return is_array($data) ? array_values($data) : [];
}

function jsonEntrega(array $data): string {
    return json_encode(array_values($data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function textoEntrega(mixed $valor): string { return trim((string)($valor ?? '')); }

function numeroEntrega(mixed $valor): float {
    if (is_int($valor) || is_float($valor)) return is_finite((float)$valor) ? (float)$valor : 0.0;
    $texto = trim((string)($valor ?? ''));
    if ($texto === '') return 0.0;
    if (str_contains($texto, ',') && str_contains($texto, '.')) $texto = str_replace('.', '', $texto);
    $numero = (float)str_replace(',', '.', preg_replace('/[^0-9,.-]/', '', $texto));
    return is_finite($numero) ? $numero : 0.0;
}

function quantidadeEntrega(float $valor): float { return round($valor, 4); }

function booleanoEntrega(mixed $valor): bool {
    if (is_bool($valor)) return $valor;
    return in_array(mb_strtolower(textoEntrega($valor), 'UTF-8'), ['1', 'true', 'sim', 'yes'], true);
}

function uuidEntrega(): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}

function saldoEntrega(array $produto): float {
    foreach (['estoqueAtual', 'estoque', 'quantidadeEstoque', 'saldoEstoque', 'quantidade'] as $campo) {
        if (array_key_exists($campo, $produto)) return numeroEntrega($produto[$campo]);
    }
    return 0.0;
}

function chaveItemEntrega(array $item): string {
    foreach ([['produtoId', 'id'], ['codigoProduto', 'codigo'], ['codigo', 'codigo'], ['codigoBarras', 'barras']] as [$campo, $prefixo]) {
        $valor = textoEntrega($item[$campo] ?? '');
        if ($valor !== '') return $prefixo . ':' . mb_strtolower($valor, 'UTF-8');
    }
    $descricao = textoEntrega($item['descricao'] ?? $item['nome'] ?? '');
    return $descricao === '' ? '' : 'descricao:' . mb_strtolower($descricao, 'UTF-8');
}

function localizarProdutoEntrega(array $produtos, array $item): ?int {
    $comparacoes = [
        ['item' => textoEntrega($item['produtoId'] ?? ''), 'campos' => ['id']],
        ['item' => textoEntrega($item['codigoProduto'] ?? $item['codigo'] ?? ''), 'campos' => ['codigo']],
        ['item' => textoEntrega($item['codigoBarras'] ?? ''), 'campos' => ['codigoBarras']],
    ];
    foreach ($comparacoes as $comparacao) {
        if ($comparacao['item'] === '') continue;
        foreach ($produtos as $indice => $produto) {
            if (!is_array($produto)) continue;
            foreach ($comparacao['campos'] as $campo) if (textoEntrega($produto[$campo] ?? '') === $comparacao['item']) return $indice;
        }
    }
    $descricao = mb_strtolower(textoEntrega($item['descricao'] ?? $item['nome'] ?? ''), 'UTF-8');
    if ($descricao !== '') foreach ($produtos as $indice => $produto) {
        if (is_array($produto) && mb_strtolower(textoEntrega($produto['descricao'] ?? $produto['nome'] ?? ''), 'UTF-8') === $descricao) return $indice;
    }
    return null;
}

function salvarSnapshotEntrega(PDO $pdo, string $collection, array $data): void {
    if ($data === []) return;
    $payload = jsonEntrega($data);
    $stmt = $pdo->prepare('INSERT INTO erp_storage_history (collection,payload,item_count,payload_hash) VALUES (:collection,:payload,:count,:hash)');
    $stmt->execute(['collection' => $collection, 'payload' => $payload, 'count' => count($data), 'hash' => hash('sha256', $payload)]);
}

function substituirColecaoEntrega(PDO $pdo, string $collection, array $data): void {
    $payload = jsonEntrega($data);
    $stmt = $pdo->prepare('UPDATE erp_storage SET payload=:payload,item_count=:count,payload_hash=:hash,updated_at=CURRENT_TIMESTAMP WHERE collection=:collection');
    $stmt->execute(['payload' => $payload, 'count' => count($data), 'hash' => hash('sha256', $payload), 'collection' => $collection]);
    if ($stmt->rowCount() < 1) throw new RuntimeException("Coleção central {$collection} não encontrada.");
}

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') responder(405, ['ok' => false, 'error' => 'Método não permitido.']);
$body = json_decode(file_get_contents('php://input') ?: '{}', true, 512, JSON_THROW_ON_ERROR);
$pedidoId = textoEntrega($body['pedidoId'] ?? '');
if ($pedidoId === '') responder(422, ['ok' => false, 'error' => 'pedidoId é obrigatório.']);

$pdo = obterPdo();
$pdo->exec('CREATE TABLE IF NOT EXISTS erp_estoque_movimentacoes (
 id CHAR(36) NOT NULL PRIMARY KEY,
 pedido_id VARCHAR(191) NOT NULL,
 numero_pedido VARCHAR(80) NOT NULL,
 produto_id VARCHAR(191) NOT NULL,
 produto_codigo VARCHAR(120) NOT NULL DEFAULT "",
 produto_descricao VARCHAR(500) NOT NULL DEFAULT "",
 quantidade DECIMAL(18,4) NOT NULL,
 tipo VARCHAR(32) NOT NULL,
 origem VARCHAR(32) NOT NULL,
 estoque_anterior DECIMAL(18,4) NOT NULL,
 estoque_atual DECIMAL(18,4) NOT NULL,
 movimento_original_id CHAR(36) NULL,
 usuario VARCHAR(120) NOT NULL DEFAULT "Synergias",
 criado_em DATETIME(6) NOT NULL,
 UNIQUE KEY uk_estoque_pedido_produto_tipo_origem (pedido_id,produto_id,tipo,origem),
 KEY idx_estoque_numero_pedido (numero_pedido),
 KEY idx_estoque_produto_data (produto_id,criado_em),
 KEY idx_estoque_movimento_original (movimento_original_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

$pdo->beginTransaction();
try {
    $stmt = $pdo->query("SELECT collection,payload FROM erp_storage WHERE collection IN ('produtos','vendas') ORDER BY collection FOR UPDATE");
    $colecoes = [];
    foreach ($stmt as $registro) $colecoes[(string)$registro['collection']] = listaEntrega((string)$registro['payload']);
    $vendas = $colecoes['vendas'] ?? null;
    $produtos = $colecoes['produtos'] ?? null;
    if (!is_array($vendas) || !is_array($produtos)) throw new RuntimeException('Coleções centrais de vendas e produtos não estão disponíveis.');

    $indicesPedido = [];
    foreach ($vendas as $indice => $venda) if (is_array($venda) && textoEntrega($venda['id'] ?? '') === $pedidoId) $indicesPedido[] = $indice;
    if ($indicesPedido === []) responder(404, ['ok' => false, 'error' => 'Pedido não encontrado.']);
    $pedido = $vendas[$indicesPedido[0]];
    foreach ($indicesPedido as $indice) {
        $statusPedido = mb_strtolower(textoEntrega($vendas[$indice]['statusPedido'] ?? $vendas[$indice]['status'] ?? ''), 'UTF-8');
        if (str_contains($statusPedido, 'cancel')) {
            responder(409, ['ok' => false, 'cancelled' => true, 'error' => 'Pedido cancelado. A entrega está bloqueada.']);
        }
    }
    if (!is_array($pedido) || !str_contains(mb_strtolower(textoEntrega($pedido['tipo'] ?? ''), 'UTF-8'), 'pedido')) responder(422, ['ok' => false, 'error' => 'O registro informado não é um Pedido.']);
    foreach ($indicesPedido as $indice) {
        $registro = $vendas[$indice];
        if (booleanoEntrega($registro['estoqueBaixado'] ?? false) || mb_strtolower(textoEntrega($registro['statusPedido'] ?? ''), 'UTF-8') === 'entregue') {
            responder(409, ['ok' => false, 'alreadyDelivered' => true, 'error' => MENSAGEM_ESTOQUE_JA_BAIXADO]);
        }
    }

    $existente = $pdo->prepare("SELECT id FROM erp_estoque_movimentacoes WHERE pedido_id=:pedido_id AND tipo='saida' AND origem='pedido' LIMIT 1 FOR UPDATE");
    $existente->execute(['pedido_id' => $pedidoId]);
    if ($existente->fetch()) {
        $agoraReparo = new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo'));
        foreach ($indicesPedido as $indice) {
            $vendas[$indice]['estoqueBaixado'] = true;
            $vendas[$indice]['statusPedido'] = 'Entregue';
            $vendas[$indice]['dataEntregaRealizada'] = $vendas[$indice]['dataEntregaRealizada'] ?? $agoraReparo->format('Y-m-d');
            $vendas[$indice]['horarioEntregaRealizada'] = $vendas[$indice]['horarioEntregaRealizada'] ?? $agoraReparo->format('H:i:s');
            $vendas[$indice]['atualizadoEm'] = $agoraReparo->format(DATE_ATOM);
        }
        salvarSnapshotEntrega($pdo, 'vendas', $colecoes['vendas']);
        substituirColecaoEntrega($pdo, 'vendas', $vendas);
        salvarSnapshotEntrega($pdo, 'vendas', $vendas);
        $pdo->commit();
        responder(200, ['ok' => true, 'alreadyDelivered' => true, 'message' => MENSAGEM_ESTOQUE_JA_BAIXADO, 'pedidoId' => $pedidoId, 'numeroPedido' => textoEntrega($pedido['numeroPedido'] ?? $pedidoId), 'pedido' => $vendas[$indicesPedido[0]], 'movimentos' => []]);
    }
    if (mb_strtolower(textoEntrega($pedido['statusPedido'] ?? ''), 'UTF-8') !== 'concluído') responder(409, ['ok' => false, 'error' => 'O pedido precisa estar concluído antes de ser entregue.']);

    $agrupados = [];
    foreach (($pedido['itens'] ?? []) as $item) {
        if (!is_array($item)) continue;
        $chave = chaveItemEntrega($item);
        $qtd = abs(numeroEntrega($item['quantidade'] ?? 0));
        if ($chave === '' || $qtd <= 0) continue;
        if (!isset($agrupados[$chave])) $agrupados[$chave] = ['item' => $item, 'quantidade' => 0.0];
        $agrupados[$chave]['quantidade'] = quantidadeEntrega($agrupados[$chave]['quantidade'] + $qtd);
    }
    if ($agrupados === []) responder(422, ['ok' => false, 'error' => 'Pedido sem itens válidos para baixar.']);

    $resolvidos = [];
    $produtoIds = [];
    foreach ($agrupados as $grupo) {
        $indiceProduto = localizarProdutoEntrega($produtos, $grupo['item']);
        if ($indiceProduto === null) responder(422, ['ok' => false, 'error' => 'Produto não encontrado: ' . textoEntrega($grupo['item']['descricao'] ?? $grupo['item']['codigoProduto'] ?? '') . '.']);
        $produto = $produtos[$indiceProduto];
        $produtoId = textoEntrega($produto['id'] ?? $produto['codigo'] ?? '');
        if ($produtoId === '') responder(422, ['ok' => false, 'error' => 'Produto sem identificação central.']);
        if (isset($produtoIds[$produtoId])) {
            $posicao = $produtoIds[$produtoId];
            $resolvidos[$posicao]['quantidade'] = quantidadeEntrega($resolvidos[$posicao]['quantidade'] + $grupo['quantidade']);
        } else {
            $produtoIds[$produtoId] = count($resolvidos);
            $resolvidos[] = ['indice' => $indiceProduto, 'produtoId' => $produtoId, 'quantidade' => $grupo['quantidade']];
        }
    }

    // O ERP permite saldo negativo: a entrega registra a saída real mesmo quando
    // o estoque disponível é insuficiente. A chave única da movimentação continua
    // impedindo uma segunda baixa para o mesmo pedido/produto.

    $agora = new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo'));
    $numeroPedido = textoEntrega($pedido['numeroPedido'] ?? $pedidoId);
    $usuario = textoEntrega($body['usuario'] ?? 'Synergias') ?: 'Synergias';
    $movimentos = [];
    $inserir = $pdo->prepare('INSERT INTO erp_estoque_movimentacoes (id,pedido_id,numero_pedido,produto_id,produto_codigo,produto_descricao,quantidade,tipo,origem,estoque_anterior,estoque_atual,movimento_original_id,usuario,criado_em) VALUES (:id,:pedido_id,:numero_pedido,:produto_id,:produto_codigo,:produto_descricao,:quantidade,:tipo,:origem,:estoque_anterior,:estoque_atual,NULL,:usuario,:criado_em)');
    foreach ($resolvidos as $resolvido) {
        $indice = $resolvido['indice'];
        $produto = $produtos[$indice];
        $anterior = quantidadeEntrega(saldoEntrega($produto));
        $atual = quantidadeEntrega($anterior - $resolvido['quantidade']);
        $idMovimento = uuidEntrega();
        $codigo = textoEntrega($produto['codigo'] ?? '');
        $descricao = textoEntrega($produto['descricao'] ?? $produto['nome'] ?? 'Produto');
        $inserir->execute(['id' => $idMovimento, 'pedido_id' => $pedidoId, 'numero_pedido' => $numeroPedido, 'produto_id' => $resolvido['produtoId'], 'produto_codigo' => $codigo, 'produto_descricao' => $descricao, 'quantidade' => -$resolvido['quantidade'], 'tipo' => 'saida', 'origem' => 'pedido', 'estoque_anterior' => $anterior, 'estoque_atual' => $atual, 'usuario' => $usuario, 'criado_em' => $agora->format('Y-m-d H:i:s.u')]);
        foreach (['estoqueAtual', 'estoque', 'quantidadeEstoque', 'saldoEstoque'] as $campo) $produtos[$indice][$campo] = $atual;
        $produtos[$indice]['atualizadoEm'] = $agora->format(DATE_ATOM);
        $movimentos[] = ['id' => $idMovimento, 'pedidoId' => $pedidoId, 'numeroPedido' => $numeroPedido, 'produtoId' => $resolvido['produtoId'], 'produtoCodigo' => $codigo, 'produtoDescricao' => $descricao, 'quantidade' => -$resolvido['quantidade'], 'tipo' => 'saida', 'origem' => 'pedido', 'estoqueAnterior' => $anterior, 'estoqueAtual' => $atual, 'movimentoOriginalId' => null, 'usuario' => $usuario, 'documentoOrigem' => $numeroPedido, 'motivo' => 'Entrega do pedido ' . $numeroPedido, 'observacao' => 'Movimentação autoritativa do MySQL.', 'data' => $agora->format('Y-m-d'), 'hora' => $agora->format('H:i:s'), 'criadoEm' => $agora->format(DATE_ATOM)];
    }

    foreach ($indicesPedido as $indice) {
        $vendas[$indice]['estoqueBaixado'] = true;
        $vendas[$indice]['dataEntregaRealizada'] = $agora->format('Y-m-d');
        $vendas[$indice]['horarioEntregaRealizada'] = $agora->format('H:i:s');
        $vendas[$indice]['statusPedido'] = 'Entregue';
        $vendas[$indice]['atualizadoEm'] = $agora->format(DATE_ATOM);
    }

    salvarSnapshotEntrega($pdo, 'produtos', $colecoes['produtos']);
    salvarSnapshotEntrega($pdo, 'vendas', $colecoes['vendas']);
    substituirColecaoEntrega($pdo, 'produtos', $produtos);
    substituirColecaoEntrega($pdo, 'vendas', $vendas);
    salvarSnapshotEntrega($pdo, 'produtos', $produtos);
    salvarSnapshotEntrega($pdo, 'vendas', $vendas);
    $pdo->commit();
    responder(200, ['ok' => true, 'message' => 'Produtos entregues', 'pedidoId' => $pedidoId, 'numeroPedido' => $numeroPedido, 'pedido' => $vendas[$indicesPedido[0]], 'movimentos' => $movimentos]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ((string)$e->getCode() === '23000') responder(409, ['ok' => false, 'alreadyDelivered' => true, 'error' => MENSAGEM_ESTOQUE_JA_BAIXADO]);
    throw $e;
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}
