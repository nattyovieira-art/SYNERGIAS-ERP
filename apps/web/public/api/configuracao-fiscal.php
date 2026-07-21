<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
exigirAutenticacao();

$pdo = obterPdo();
$pdo->exec("CREATE TABLE IF NOT EXISTS configuracoes_erp (chave VARCHAR(120) PRIMARY KEY, valor LONGTEXT NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

function somenteNumerosFiscal($valor): string {
    return preg_replace('/\D+/', '', (string)$valor) ?? '';
}

function configuracaoFiscalValidaServidor(array $configuracao): bool {
    return trim((string)($configuracao['razaoSocial'] ?? '')) !== ''
        && strlen(somenteNumerosFiscal($configuracao['cnpj'] ?? '')) === 14
        && trim((string)($configuracao['inscricaoEstadual'] ?? '')) !== ''
        && trim((string)($configuracao['uf'] ?? '')) !== ''
        && trim((string)($configuracao['municipio'] ?? '')) !== ''
        && trim((string)($configuracao['codigoIbgeMunicipio'] ?? '')) !== ''
        && strlen(somenteNumerosFiscal($configuracao['cep'] ?? '')) === 8
        && trim((string)($configuracao['logradouro'] ?? '')) !== ''
        && trim((string)($configuracao['numero'] ?? '')) !== ''
        && trim((string)($configuracao['bairro'] ?? '')) !== '';
}

function lerConfiguracaoFiscal(PDO $pdo, string $chave): ?array {
    $stmt = $pdo->prepare('SELECT valor FROM configuracoes_erp WHERE chave = ? LIMIT 1');
    $stmt->execute([$chave]);
    $valor = $stmt->fetchColumn();
    if (!$valor) return null;
    $decodificada = json_decode((string)$valor, true);
    return is_array($decodificada) ? $decodificada : null;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $principal = lerConfiguracaoFiscal($pdo, 'configuracao_fiscal');
    $backup = lerConfiguracaoFiscal($pdo, 'configuracao_fiscal_backup');
    $configuracao = configuracaoFiscalValidaServidor($principal ?? [])
        ? $principal
        : (configuracaoFiscalValidaServidor($backup ?? []) ? $backup : null);

    responder(200, [
        'ok' => true,
        'configuracao' => $configuracao,
        'origem' => $configuracao === $principal ? 'principal' : ($configuracao === $backup ? 'backup' : 'nenhuma'),
    ]);
}

$raw = file_get_contents('php://input');
$body = json_decode($raw ?: '{}', true);
if (!is_array($body) || !is_array($body['configuracao'] ?? null)) {
    responder(422, ['ok' => false, 'error' => 'Configuração fiscal inválida.']);
}

$configuracao = $body['configuracao'];
if (!configuracaoFiscalValidaServidor($configuracao)) {
    responder(422, [
        'ok' => false,
        'error' => 'Configuração fiscal incompleta. O cadastro válido existente foi preservado.',
    ]);
}

$atual = lerConfiguracaoFiscal($pdo, 'configuracao_fiscal');
$jsonNovo = json_encode($configuracao, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

$pdo->beginTransaction();
try {
    if (configuracaoFiscalValidaServidor($atual ?? [])) {
        $jsonBackup = json_encode($atual, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $backupStmt = $pdo->prepare('INSERT INTO configuracoes_erp (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = CURRENT_TIMESTAMP');
        $backupStmt->execute(['configuracao_fiscal_backup', $jsonBackup]);
    }

    $stmt = $pdo->prepare('INSERT INTO configuracoes_erp (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = CURRENT_TIMESTAMP');
    $stmt->execute(['configuracao_fiscal', $jsonNovo]);
    $pdo->commit();
} catch (Throwable $erro) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    responder(500, ['ok' => false, 'error' => 'Falha ao proteger e salvar a configuração fiscal.']);
}

$confirmada = lerConfiguracaoFiscal($pdo, 'configuracao_fiscal');
if (!configuracaoFiscalValidaServidor($confirmada ?? [])) {
    responder(500, ['ok' => false, 'error' => 'O servidor não confirmou os dados fiscais salvos.']);
}

responder(200, ['ok' => true, 'configuracao' => $confirmada, 'bloqueado' => false, 'versao' => 'SYNERGIAS_FISCAL_CENTRAL_V228']);
