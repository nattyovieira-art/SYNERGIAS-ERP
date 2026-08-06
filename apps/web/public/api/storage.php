<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
exigirAutenticacao();

$collectionsPermitidas = ['clientes', 'produtos', 'vendas', 'compras', 'movimentacoesEstoque'];
$collection = trim((string)($_GET['collection'] ?? ''));
if (!in_array($collection, $collectionsPermitidas, true)) {
    responder(400, ['ok' => false, 'error' => 'Coleção inválida.']);
}

$pdo = obterPdo();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

// Evita repetir comandos DDL em cada leitura feita durante a abertura do ERP.
// A verificação da estrutura continua sendo executada antes das gravações.
if (!in_array($method, ['GET', 'HEAD'], true)) {
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

function compraDigitos(mixed $valor): string {
    return preg_replace('/\D+/', '', trim((string)($valor ?? ''))) ?: '';
}

function compraNotaId(array $compra): string {
    $chave = compraDigitos($compra['chaveAcessoNFe'] ?? '');
    if (strlen($chave) === 44) return 'CHAVE:' . $chave;
    $numero = compraDigitos($compra['numeroNFe'] ?? '');
    if ($numero === '') return '';
    return 'NOTA:' . compraDigitos($compra['fornecedorDocumento'] ?? '') . ':' . compraDigitos($compra['serieNFe'] ?? '') . ':' . $numero;
}

function compraNotaComposta(array $compra): string {
    $numero = compraDigitos($compra['numeroNFe'] ?? '');
    if ($numero === '') return '';
    return 'NOTA:' . compraDigitos($compra['fornecedorDocumento'] ?? '') . ':' . compraDigitos($compra['serieNFe'] ?? '') . ':' . $numero;
}

function validarIntegridadeCompras(array $atual, array $nova): void {
    $ids = []; $notas = []; $novasPorId = [];
    foreach ($nova as $compra) {
        if (!is_array($compra)) responder(422, ['ok'=>false,'error'=>'Compra inválida na coleção.']);
        $id = trim((string)($compra['id'] ?? ''));
        if ($id === '') responder(422, ['ok'=>false,'error'=>'Toda compra precisa possuir ID.']);
        if (isset($ids[$id])) responder(409, ['ok'=>false,'error'=>'Compra duplicada pelo ID: '.$id]);
        $ids[$id] = true; $novasPorId[$id] = $compra;
        $identificadores = array_values(array_unique(array_filter([compraNotaId($compra), compraNotaComposta($compra)])));
        foreach ($identificadores as $nota) {
            if (isset($notas[$nota])) responder(409, ['ok'=>false,'error'=>'NF-e duplicada na coleção de compras.']);
            $notas[$nota] = true;
        }
    }
    foreach ($atual as $compra) {
        if (!is_array($compra) || empty($compra['movimentouEstoque'])) continue;
        $id = trim((string)($compra['id'] ?? ''));
        if (($id === '' || !isset($novasPorId[$id])) && !empty($compra['estoqueEstornado'])) continue;
        if ($id === '' || !isset($novasPorId[$id])) responder(409, ['ok'=>false,'error'=>'Compra com estoque movimentado não pode ser excluída.']);
        if (empty($novasPorId[$id]['movimentouEstoque'])) responder(409, ['ok'=>false,'error'=>'O vínculo de estoque de uma compra não pode ser removido.']);
    }
}

function validarIntegridadeMovimentacoes(array $nova): void {
    $ids = []; $entradasCompra = [];
    foreach ($nova as $movimento) {
        if (!is_array($movimento)) responder(422, ['ok'=>false,'error'=>'Movimentação de estoque inválida.']);
        $id = trim((string)($movimento['id'] ?? ''));
        if ($id === '' || isset($ids[$id])) responder(409, ['ok'=>false,'error'=>'Movimentação sem ID ou com ID duplicado.']);
        $ids[$id] = true;
        if (($movimento['origem'] ?? '') !== 'compra') continue;
        $assinatura = trim((string)($movimento['documentoOrigem'] ?? '')).'::'.trim((string)($movimento['produtoCodigo'] ?? ''));
        if ($assinatura !== '::' && isset($entradasCompra[$assinatura])) responder(409, ['ok'=>false,'error'=>'Entrada de compra duplicada para o mesmo documento e produto.']);
        if ($assinatura !== '::') $entradasCompra[$assinatura] = true;
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

function statusPedidoNormalizado(mixed $valor): string {
    $texto = mb_strtolower(trim((string)($valor ?? '')), 'UTF-8');
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $texto);
    return trim($ascii !== false ? $ascii : $texto);
}

function validarTransicaoStatusPedido(array $atual, array $novo): void {
    $tipo = mb_strtolower(trim((string)($atual['tipo'] ?? $novo['tipo'] ?? '')), 'UTF-8');
    if (!str_contains($tipo, 'pedido')) return;
    $origem = statusPedidoNormalizado($atual['statusPedido'] ?? $atual['status'] ?? '');
    $destino = statusPedidoNormalizado($novo['statusPedido'] ?? $novo['status'] ?? '');
    if ($origem === $destino) return;
    if (in_array($origem, ['cancelado', 'entregue'], true)) {
        responder(409, ['ok' => false, 'error' => 'Status bloqueado: Cancelado e Entregue são estados finais.']);
    }
    if ($origem === 'concluido' && !in_array($destino, ['cancelado', 'entregue'], true)) {
        responder(409, ['ok' => false, 'error' => 'Status bloqueado: Concluído só pode mudar para Cancelado ou Entregue.']);
    }
}

function vendaOrcamento(array $v): string {
    $tipo = mb_strtolower(trim((string)($v['tipo'] ?? '')), 'UTF-8');
    if (str_contains($tipo, 'pedido')) return '';
    foreach (['numeroOrcamento','orcamentoNumero','numero_orcamento'] as $k) {
        $n = vendaDigitos($v[$k] ?? '');
        if ($n !== '') return $n;
    }
    return vendaDigitos($v['numero'] ?? '');
}

function mesmoRegistroVendaCentral(array $a, array $b): bool {
    $idA = vendaId($a); $idB = vendaId($b);
    if ($idA !== '' && $idB !== '' && hash_equals($idA, $idB)) return true;
    $pedidoA = vendaPedido($a); $pedidoB = vendaPedido($b);
    if ($pedidoA !== '' && $pedidoB !== '' && $pedidoA === $pedidoB) return true;
    $orcamentoA = vendaOrcamento($a); $orcamentoB = vendaOrcamento($b);
    return $orcamentoA !== '' && $orcamentoB !== '' && $orcamentoA === $orcamentoB;
}

function vendaExisteNaLista(array $alvo, array $lista): bool {
    foreach ($lista as $item) {
        if (is_array($item) && mesmoRegistroVendaCentral($alvo, $item)) return true;
    }
    return false;
}

function vendasCentraisAusentes(array $central, array $recebida): array {
    $ausentes = [];
    foreach ($central as $item) {
        if (!is_array($item)) continue;
        if (!vendaExisteNaLista($item, $recebida)) {
            $ausentes[] = vendaId($item) ?: (vendaPedido($item) !== '' ? 'pedido:' . vendaPedido($item) : 'orcamento:' . vendaOrcamento($item));
        }
    }
    return $ausentes;
}

function mesclarVendasPreservandoCentral(array $central, array $recebida): array {
    // Em conflito, o MySQL vence para registros já conhecidos. A sessão antiga
    // pode acrescentar registros realmente novos, mas nunca apagar ou regredir os atuais.
    $mesclada = array_values($central);
    foreach ($recebida as $item) {
        if (!is_array($item) || vendaExisteNaLista($item, $mesclada)) continue;
        $mesclada[] = $item;
    }
    return $mesclada;
}

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

        $statusAntigo = mb_strtolower(trim((string)($antigo['statusPedido'] ?? '')), 'UTF-8');
        $statusNovo = mb_strtolower(trim((string)($novo['statusPedido'] ?? '')), 'UTF-8');
        $estoqueAntigoBaixado = filter_var($antigo['estoqueBaixado'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $estoqueNovoBaixado = filter_var($novo['estoqueBaixado'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if (($statusAntigo === 'entregue' || $estoqueAntigoBaixado) && ($statusNovo !== 'entregue' || !$estoqueNovoBaixado)) {
            responder(409, ['ok'=>false,'error'=>"Gravação bloqueada: o Pedido {$id} já foi entregue e não pode voltar para um status anterior."]);
        }

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
    $hash = hashPayload($payload);
    $ultimo = $pdo->prepare('SELECT payload_hash FROM erp_storage_history WHERE collection=:collection ORDER BY id DESC LIMIT 1');
    $ultimo->execute(['collection' => $collection]);
    if (hash_equals((string)($ultimo->fetchColumn() ?: ''), $hash)) return;
    $stmt = $pdo->prepare('INSERT INTO erp_storage_history (collection,payload,item_count,payload_hash) VALUES (:collection,:payload,:count,:hash)');
    $stmt->execute([
        'collection' => $collection,
        'payload' => $payload,
        'count' => count($data),
        'hash' => $hash,
    ]);
    $pdo->prepare('DELETE FROM erp_storage_history WHERE collection=:collection AND id NOT IN (SELECT id FROM (SELECT id FROM erp_storage_history WHERE collection=:collection2 ORDER BY id DESC LIMIT 40) x)')
        ->execute(['collection' => $collection, 'collection2' => $collection]);
}

function lerRegistro(PDO $pdo, string $collection): ?array {
    $stmt = $pdo->prepare('SELECT payload,item_count,payload_hash,updated_at FROM erp_storage WHERE collection=:collection LIMIT 1');
    $stmt->execute(['collection' => $collection]);
    $registro = $stmt->fetch();
    return is_array($registro) ? $registro : null;
}

function pontuarVinculoBoleto(array $parcela): int {
    $pontos = 0;
    foreach (['idCobranca','codigoSolicitacao','numeroBoleto','nossoNumero','seuNumero','linhaDigitavel','codigoBarras','linkBoleto','boletoPdfUrl','boletoPdfBase64','dataGeracaoBoleto'] as $campo) {
        if (trim((string)($parcela[$campo] ?? '')) !== '') $pontos++;
    }
    $status = mb_strtolower(trim((string)($parcela['statusBoleto'] ?? '')), 'UTF-8');
    if (in_array($status, ['gerado','enviado','pago','cancelado'], true)) $pontos += 2;
    if (trim((string)($parcela['bancoCobranca'] ?? '')) !== '') $pontos++;
    return $pontos;
}

function temVinculoBoletoConfirmado(array $parcela): bool {
    $identificadores = 0;
    foreach (['idCobranca','codigoSolicitacao','numeroBoleto','nossoNumero','seuNumero','linhaDigitavel','codigoBarras','linkBoleto','boletoPdfUrl','boletoPdfBase64'] as $campo) {
        if (trim((string)($parcela[$campo] ?? '')) !== '') $identificadores++;
    }
    $status = mb_strtolower(trim((string)($parcela['statusBoleto'] ?? '')), 'UTF-8');
    $emissaoConfirmada = in_array($status, ['gerado','enviado','pago','cancelado'], true)
        || trim((string)($parcela['dataGeracaoBoleto'] ?? '')) !== '';
    return $identificadores > 0 && ($emissaoConfirmada || $identificadores > 1);
}

function recuperarVinculosBoletoDoHistorico(PDO $pdo, array $atuais): array {
    if ($atuais === []) return [$atuais, false];
    $chavesProcuradas = [];
    foreach ($atuais as $vendaAtual) {
        if (!is_array($vendaAtual) || !is_array($vendaAtual['parcelas'] ?? null)) continue;
        $precisaRecuperar = false;
        foreach ($vendaAtual['parcelas'] as $parcelaAtual) {
            if (is_array($parcelaAtual) && !temVinculoBoletoConfirmado($parcelaAtual)) {
                $precisaRecuperar = true;
                break;
            }
        }
        if (!$precisaRecuperar) continue;
        $id = trim((string)($vendaAtual['id'] ?? ''));
        $numero = preg_replace('/\D+/', '', trim((string)($vendaAtual['numeroPedido'] ?? ''))) ?: '';
        if ($id !== '') $chavesProcuradas['id:' . $id] = true;
        if ($numero !== '') $chavesProcuradas['numero:' . $numero] = true;
    }
    if ($chavesProcuradas === []) return [$atuais, false];

    $consultaIds = $pdo->query("SELECT id FROM erp_storage_history WHERE collection='vendas' AND item_count>0 ORDER BY id DESC LIMIT 12");
    $idsHistoricos = $consultaIds ? $consultaIds->fetchAll(PDO::FETCH_COLUMN) : [];
    $consultaPayload = $pdo->prepare("SELECT payload FROM erp_storage_history WHERE id=:id AND collection='vendas' LIMIT 1");
    $parcelasHistoricas = [];
    foreach ($idsHistoricos as $idHistorico) {
        $consultaPayload->execute(['id' => $idHistorico]);
        $payload = $consultaPayload->fetchColumn();
        if (!is_string($payload) || $payload === '') continue;
        foreach (decodificarLista($payload) as $vendaHistorica) {
            if (!is_array($vendaHistorica)) continue;
            $id = trim((string)($vendaHistorica['id'] ?? ''));
            $numero = preg_replace('/\D+/', '', trim((string)($vendaHistorica['numeroPedido'] ?? ''))) ?: '';
            foreach (array_filter([$id !== '' ? 'id:' . $id : '', $numero !== '' ? 'numero:' . $numero : '']) as $chave) {
                if (!isset($chavesProcuradas[$chave])) continue;
                foreach (($vendaHistorica['parcelas'] ?? []) as $indice => $parcela) {
                    if (!is_array($parcela) || !temVinculoBoletoConfirmado($parcela)) continue;
                    $numeroParcela = (int)($parcela['numero'] ?? ($indice + 1));
                    $atual = $parcelasHistoricas[$chave][$numeroParcela] ?? null;
                    if (!is_array($atual) || pontuarVinculoBoleto($parcela) > pontuarVinculoBoleto($atual)) {
                        $parcelasHistoricas[$chave][$numeroParcela] = $parcela;
                    }
                }
            }
        }
        unset($payload);
    }

    $alterou = false;
    foreach ($atuais as &$vendaAtual) {
        if (!is_array($vendaAtual) || !is_array($vendaAtual['parcelas'] ?? null)) continue;
        $id = trim((string)($vendaAtual['id'] ?? ''));
        $numero = preg_replace('/\D+/', '', trim((string)($vendaAtual['numeroPedido'] ?? ''))) ?: '';
        $chavesVenda = array_filter([$id !== '' ? 'id:' . $id : '', $numero !== '' ? 'numero:' . $numero : '']);

        foreach ($vendaAtual['parcelas'] as $indice => &$parcelaAtual) {
            if (!is_array($parcelaAtual)) continue;
            $numeroParcela = (int)($parcelaAtual['numero'] ?? ($indice + 1));
            $melhor = $parcelaAtual;
            $melhorPontuacao = pontuarVinculoBoleto($parcelaAtual);
            foreach ($chavesVenda as $chave) {
                $parcelaHistorica = $parcelasHistoricas[$chave][$numeroParcela] ?? null;
                if (!is_array($parcelaHistorica)) continue;
                $pontuacao = pontuarVinculoBoleto($parcelaHistorica);
                if ($pontuacao > $melhorPontuacao) {
                    $melhor = array_replace($parcelaAtual, $parcelaHistorica);
                    $melhorPontuacao = $pontuacao;
                }
            }
            if ($melhor !== $parcelaAtual) {
                $parcelaAtual = $melhor;
                $alterou = true;
            }
        }
        unset($parcelaAtual);
    }
    unset($vendaAtual);
    return [$atuais, $alterou];
}

$maxPayloadBytes = 32 * 1024 * 1024;
if (!in_array($method, ['GET', 'HEAD'], true) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $maxPayloadBytes) {
    responder(413, ['ok' => false, 'error' => 'Payload excede o limite de 32 MB.']);
}

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

    $boletosRecuperados = false;
    if ($collection === 'vendas' && $data !== []) {
        $marcadorRecuperacao = '__boleto_links_recovery_v1';
        if (lerRegistro($pdo, $marcadorRecuperacao) === null) {
            [$data, $boletosRecuperados] = recuperarVinculosBoletoDoHistorico($pdo, $data);
            if ($boletosRecuperados) {
                $payloadRecuperado = codificarLista($data);
                $up = $pdo->prepare('UPDATE erp_storage SET payload=:payload,item_count=:count,payload_hash=:hash,updated_at=CURRENT_TIMESTAMP WHERE collection=:collection');
                $up->execute([
                    'collection' => $collection,
                    'payload' => $payloadRecuperado,
                    'count' => count($data),
                    'hash' => hashPayload($payloadRecuperado),
                ]);
                $registro = lerRegistro($pdo, $collection);
            }
            $payloadMarcador = codificarLista([['executadoEm' => gmdate('c'), 'recuperou' => $boletosRecuperados]]);
            $upMarcador = $pdo->prepare('INSERT INTO erp_storage (collection,payload,item_count,payload_hash) VALUES (:collection,:payload,1,:hash) ON DUPLICATE KEY UPDATE payload=VALUES(payload),item_count=1,payload_hash=VALUES(payload_hash),updated_at=CURRENT_TIMESTAMP');
            $upMarcador->execute([
                'collection' => $marcadorRecuperacao,
                'payload' => $payloadMarcador,
                'hash' => hashPayload($payloadMarcador),
            ]);
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
        'boletoLinksRecovered' => $boletosRecuperados,
        'storage' => 'mysql',
    ]);
}

if ($method === 'PATCH') {
    if ($collection === 'clientes') {
        $raw = file_get_contents('php://input') ?: '{}';
        $body = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        $record = $body['record'] ?? null;
        if (!is_array($record)) responder(422, ['ok' => false, 'error' => 'O campo record precisa ser um objeto de cliente.']);
        $recordId = trim((string)($record['codigo'] ?? $record['id'] ?? ''));
        if ($recordId === '') responder(422, ['ok' => false, 'error' => 'O cliente precisa possuir código.']);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT payload,item_count,payload_hash,updated_at FROM erp_storage WHERE collection=:collection FOR UPDATE');
            $stmt->execute(['collection' => 'clientes']);
            $central = $stmt->fetch();
            if (!is_array($central)) throw new RuntimeException('Coleção clientes não encontrada.');
            $atual = decodificarLista((string)$central['payload']);
            $indiceAlvo = null;
            foreach ($atual as $indice => $item) {
                if (!is_array($item)) continue;
                $itemId = trim((string)($item['codigo'] ?? $item['id'] ?? ''));
                if ($itemId === $recordId) {
                    if ($indiceAlvo !== null) responder(409, ['ok' => false, 'error' => 'Há clientes duplicados com este código no MySQL.']);
                    $indiceAlvo = $indice;
                }
            }
            if ($indiceAlvo === null) {
                $atual[] = $record;
                $indiceAlvo = array_key_last($atual);
            } else {
                $atual[$indiceAlvo] = $record;
            }

            salvarHistorico($pdo, 'clientes', decodificarLista((string)$central['payload']));
            $payload = codificarLista($atual);
            $hash = hashPayload($payload);
            $up = $pdo->prepare("UPDATE erp_storage SET payload=:payload,item_count=:count,payload_hash=:hash,updated_at=CURRENT_TIMESTAMP WHERE collection='clientes'");
            $up->execute(['payload' => $payload, 'count' => count($atual), 'hash' => $hash]);
            $confirmacao = lerRegistro($pdo, 'clientes');
            if (!$confirmacao || (int)$confirmacao['item_count'] !== count($atual) || !hash_equals($hash, (string)$confirmacao['payload_hash'])) {
                throw new RuntimeException('O MySQL não confirmou a atualização unitária do cliente.');
            }
            $pdo->commit();
            responder(200, [
                'ok' => true, 'verified' => true, 'collection' => 'clientes',
                'count' => count($atual), 'hash' => $hash,
                'updatedAt' => $confirmacao['updated_at'] ?? null, 'record' => $record,
            ]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }
    if ($collection !== 'vendas') responder(405, ['ok' => false, 'error' => 'Atualização unitária disponível somente para vendas.']);
    $raw = file_get_contents('php://input') ?: '{}';
    $body = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    $record = $body['record'] ?? null;
    $expectedRecord = $body['expectedRecord'] ?? null;
    $expectedHash = strtolower(trim((string)($body['expectedHash'] ?? '')));
    $expectedUpdatedAt = trim((string)($body['expectedUpdatedAt'] ?? ''));
    if (!is_array($record)) responder(422, ['ok' => false, 'error' => 'O campo record precisa ser um objeto de venda.']);
    $recordId = vendaId($record);
    if ($recordId === '') responder(422, ['ok' => false, 'error' => 'A venda precisa possuir ID.']);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT payload,item_count,payload_hash,updated_at FROM erp_storage WHERE collection=:collection FOR UPDATE');
        $stmt->execute(['collection' => 'vendas']);
        $central = $stmt->fetch();
        if (!is_array($central)) throw new RuntimeException('Coleção vendas não encontrada.');
        $hashCentral = strtolower((string)$central['payload_hash']);
        $updatedAtCentral = (string)$central['updated_at'];
        $atual = decodificarLista((string)$central['payload']);
        $colecaoMudou = ($expectedHash !== '' && !hash_equals($hashCentral, $expectedHash))
            || ($expectedUpdatedAt !== '' && $expectedUpdatedAt !== $updatedAtCentral);
        if ($colecaoMudou) {
            $registroAtual = null;
            foreach ($atual as $itemAtual) {
                if (is_array($itemAtual) && vendaId($itemAtual) === $recordId) {
                    $registroAtual = $itemAtual;
                    break;
                }
            }
            foreach ($atual as $itemAtual) {
                if ($registroAtual === null && is_array($itemAtual) && mesmoRegistroVendaCentral($itemAtual, $record)) {
                    $registroAtual = $itemAtual;
                    break;
                }
            }
            $mesmoRegistro = is_array($expectedRecord)
                && is_array($registroAtual)
                && hash_equals(
                    hash('sha256', json_encode($registroAtual, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
                    hash('sha256', json_encode($expectedRecord, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))
                );
            $novoAindaAusente = $registroAtual === null && $expectedRecord === null;
            if (!$mesmoRegistro && !$novoAindaAusente) {
                $pdo->rollBack();
                responder(409, [
                    'ok' => false, 'conflict' => true, 'reloadRequired' => true,
                    'error' => 'Conflito de versão: este pedido mudou no MySQL. Recarregue o pedido antes de salvar novamente.',
                    'currentHash' => $hashCentral, 'currentUpdatedAt' => $updatedAtCentral,
                ]);
            }
        }
        $indiceAlvo = null;
        foreach ($atual as $indice => $item) {
            if (!is_array($item)) continue;
            if (vendaId($item) === $recordId) {
                if ($indiceAlvo !== null) {
                    $pdo->rollBack();
                    responder(409, ['ok' => false, 'error' => 'O registro que está sendo editado possui duplicidade própria no MySQL.']);
                }
                $indiceAlvo = $indice;
            }
        }
        if ($indiceAlvo === null) {
            foreach ($atual as $item) {
                if (is_array($item) && vendaId($item) === $recordId) {
                    $pdo->rollBack();
                    responder(409, ['ok' => false, 'error' => "ID {$recordId} já pertence a outra venda."]);
                }
            }
            $atual[] = $record;
            $indiceAlvo = array_key_last($atual);
        } else {
            foreach ($atual as $indice => $item) {
                if ($indice !== $indiceAlvo && is_array($item) && vendaId($item) === $recordId) {
                    $pdo->rollBack();
                    responder(409, ['ok' => false, 'error' => "A atualização criaria ID duplicado ({$recordId})."]);
                }
            }
            validarTransicaoStatusPedido($atual[$indiceAlvo], $record);
            $atual[$indiceAlvo] = $record;
        }

        $payloadAnterior = (string)$central['payload'];
        salvarHistorico($pdo, 'vendas', decodificarLista($payloadAnterior));
        $payload = codificarLista($atual);
        $hash = hashPayload($payload);
        $up = $pdo->prepare("UPDATE erp_storage SET payload=:payload,item_count=:count,payload_hash=:hash,updated_at=CURRENT_TIMESTAMP WHERE collection='vendas'");
        $up->execute(['payload' => $payload, 'count' => count($atual), 'hash' => $hash]);
        $confirmacao = lerRegistro($pdo, 'vendas');
        if (!$confirmacao || (int)$confirmacao['item_count'] !== count($atual) || !hash_equals($hash, (string)$confirmacao['payload_hash'])) {
            throw new RuntimeException('O MySQL não confirmou a atualização unitária da venda.');
        }
        $releitura = decodificarLista((string)$confirmacao['payload']);
        $gravada = $releitura[$indiceAlvo] ?? null;
        if (!is_array($gravada) || vendaId($gravada) !== $recordId || hashPayload(codificarLista([$gravada])) !== hashPayload(codificarLista([$record]))) {
            throw new RuntimeException('A releitura do MySQL divergiu do registro enviado.');
        }
        $pdo->commit();
        responder(200, [
            'ok' => true, 'verified' => true, 'collection' => 'vendas',
            'count' => count($releitura), 'hash' => $hash,
            'updatedAt' => $confirmacao['updated_at'] ?? null, 'record' => $gravada,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

if ($method === 'DELETE') {
    if (!in_array($collection, ['vendas', 'compras'], true)) responder(405, ['ok' => false, 'error' => 'Exclusão unitária indisponível para esta coleção.']);
    $raw = file_get_contents('php://input') ?: '{}';
    $body = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    $recordId = trim((string)($body['id'] ?? ''));
    $expectedHash = strtolower(trim((string)($body['expectedHash'] ?? '')));
    $expectedUpdatedAt = trim((string)($body['expectedUpdatedAt'] ?? ''));
    if ($recordId === '') responder(422, ['ok' => false, 'error' => 'Informe o ID do registro que será excluído.']);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT payload,item_count,payload_hash,updated_at FROM erp_storage WHERE collection=:collection FOR UPDATE');
        $stmt->execute(['collection' => $collection]);
        $central = $stmt->fetch();
        if (!is_array($central)) throw new RuntimeException('Coleção não encontrada.');
        $hashCentral = strtolower((string)$central['payload_hash']);
        $updatedAtCentral = (string)$central['updated_at'];
        if (($expectedHash !== '' && !hash_equals($hashCentral, $expectedHash)) || ($expectedUpdatedAt !== '' && $expectedUpdatedAt !== $updatedAtCentral)) {
            $pdo->rollBack();
            responder(409, ['ok' => false, 'conflict' => true, 'reloadRequired' => true, 'error' => 'Conflito de versão: os dados mudaram no MySQL. Recarregue a tela antes de excluir.']);
        }

        $atual = decodificarLista((string)$central['payload']);
        $obterId = static fn($item): string => is_array($item)
            ? ($collection === 'vendas' ? vendaId($item) : trim((string)($item['id'] ?? '')))
            : '';
        $encontrados = array_values(array_filter($atual, static fn($item): bool => $obterId($item) === $recordId));
        if (count($encontrados) !== 1) {
            $pdo->rollBack();
            responder(count($encontrados) === 0 ? 404 : 409, ['ok' => false, 'error' => count($encontrados) === 0 ? 'Registro não encontrado no MySQL.' : 'Existem registros duplicados com este ID; exclusão bloqueada.']);
        }
        if ($collection === 'compras' && !empty($encontrados[0]['movimentouEstoque']) && empty($encontrados[0]['estoqueEstornado'])) {
            $pdo->rollBack();
            responder(409, ['ok' => false, 'error' => 'Compra com estoque movimentado não pode ser excluída antes do estorno.']);
        }
        $nova = array_values(array_filter($atual, static fn($item): bool => $obterId($item) !== $recordId));
        salvarHistorico($pdo, $collection, $atual);
        $payload = codificarLista($nova);
        $hash = hashPayload($payload);
        $up = $pdo->prepare('UPDATE erp_storage SET payload=:payload,item_count=:count,payload_hash=:hash,updated_at=CURRENT_TIMESTAMP WHERE collection=:collection');
        $up->execute(['payload' => $payload, 'count' => count($nova), 'hash' => $hash, 'collection' => $collection]);
        $confirmacao = lerRegistro($pdo, $collection);
        $releitura = $confirmacao ? decodificarLista((string)$confirmacao['payload']) : [];
        foreach ($releitura as $item) {
            if ($obterId($item) === $recordId) throw new RuntimeException('O MySQL não confirmou a exclusão do registro.');
        }
        salvarHistorico($pdo, $collection, $nova);
        $pdo->commit();
        responder(200, ['ok' => true, 'verified' => true, 'collection' => $collection, 'deletedId' => $recordId, 'count' => count($nova), 'hash' => $hash, 'updatedAt' => $confirmacao['updated_at'] ?? null, 'storage' => 'mysql']);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

if ($method === 'PUT') {
    $raw = file_get_contents('php://input') ?: '{}';
    $body = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    $data = $body['data'] ?? null;
    $allowEmpty = (bool)($body['allowEmpty'] ?? false);
    $expectedHash = strtolower(trim((string)($body['expectedHash'] ?? '')));
    $expectedUpdatedAt = trim((string)($body['expectedUpdatedAt'] ?? ''));
    if (!is_array($data)) responder(422, ['ok' => false, 'error' => 'O campo data precisa ser uma lista.']);
    $data = array_values($data);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT payload,payload_hash,updated_at FROM erp_storage WHERE collection=:collection FOR UPDATE');
        $stmt->execute(['collection' => $collection]);
        $registroAtual = $stmt->fetch();
        $atual = $registroAtual ? decodificarLista((string)$registroAtual['payload']) : [];

        if (is_array($registroAtual) && ($expectedHash === '' || $expectedUpdatedAt === '')) {
            $pdo->rollBack();
            responder(428, [
                'ok' => false,
                'conflict' => true,
                'reloadRequired' => true,
                'error' => 'Versão esperada ausente. Recarregue os dados antes de salvar.',
            ]);
        }

        if ($collection === 'vendas' && is_array($registroAtual)) {
            $hashAtual = strtolower((string)($registroAtual['payload_hash'] ?? ''));
            $updatedAtAtual = (string)($registroAtual['updated_at'] ?? '');
            $versaoMudou = ($expectedHash !== '' && !hash_equals($hashAtual, $expectedHash))
                || ($expectedUpdatedAt !== '' && $updatedAtAtual !== $expectedUpdatedAt);
            $ausentes = vendasCentraisAusentes($atual, $data);
            $payloadAntigo = count($ausentes) > 0;

            if ($versaoMudou || $payloadAntigo) {
                $mesclada = mesclarVendasPreservandoCentral($atual, $data);
                validarIntegridadeVendas($atual, $mesclada);
                salvarHistorico($pdo, $collection, $atual);
                $payloadMesclado = codificarLista($mesclada);
                $hashMesclado = hashPayload($payloadMesclado);
                $up = $pdo->prepare('UPDATE erp_storage SET payload=:payload,item_count=:count,payload_hash=:hash,updated_at=CURRENT_TIMESTAMP WHERE collection=:collection');
                $up->execute([
                    'payload' => $payloadMesclado,
                    'count' => count($mesclada),
                    'hash' => $hashMesclado,
                    'collection' => $collection,
                ]);
                salvarHistorico($pdo, $collection, $mesclada);
                $pdo->commit();
                responder(409, [
                    'ok' => false,
                    'error' => 'Conflito de versão: a coleção vendas mudou no MySQL. Os registros centrais foram preservados; recarregue o ERP antes de salvar novamente.',
                    'conflict' => true,
                    'reloadRequired' => true,
                    'mergedSafely' => true,
                    'currentCount' => count($atual),
                    'mergedCount' => count($mesclada),
                    'missingCentralRecords' => array_slice($ausentes, 0, 20),
                    'hash' => $hashMesclado,
                ]);
            }
        }

        if ($collection !== 'vendas' && is_array($registroAtual)) {
            $hashAtual = strtolower((string)($registroAtual['payload_hash'] ?? ''));
            $updatedAtAtual = (string)($registroAtual['updated_at'] ?? '');
            if (($expectedHash !== '' && !hash_equals($hashAtual, $expectedHash))
                || ($expectedUpdatedAt !== '' && $updatedAtAtual !== $expectedUpdatedAt)) {
                $pdo->rollBack();
                responder(409, ['ok'=>false,'conflict'=>true,'reloadRequired'=>true,'error'=>'Conflito de versão: os dados mudaram no servidor. Recarregue o ERP antes de salvar novamente.']);
            }
        }

        validarReducaoAnormal($collection, $atual, $data);
        if ($collection === 'vendas') validarIntegridadeVendas($atual, $data);
        if ($collection === 'compras') validarIntegridadeCompras($atual, $data);
        if ($collection === 'movimentacoesEstoque') validarIntegridadeMovimentacoes($data);

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
