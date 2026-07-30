<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

try {
    exigirAutenticacao();
    $cnpj = preg_replace('/\D+/', '', (string)($_GET['cnpj'] ?? '')) ?? '';
    if (strlen($cnpj) !== 14) responder(422, ['ok' => false, 'error' => 'Informe um CNPJ com 14 números.']);
    $ch = curl_init('https://brasilapi.com.br/api/cnpj/v1/' . rawurlencode($cnpj));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => ['Accept: application/json'], CURLOPT_USERAGENT => 'SynergiasERP/1.0']);
    $conteudo = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    $dados = is_string($conteudo) ? json_decode($conteudo, true) : null;
    if ($status === 404) responder(404, ['ok' => false, 'error' => 'CNPJ não encontrado na consulta automática.']);
    if ($status < 200 || $status >= 300 || !is_array($dados)) responder(503, ['ok' => false, 'error' => 'A consulta automática de CNPJ está temporariamente indisponível.']);
    responder(200, ['ok' => true, 'data' => $dados]);
} catch (Throwable $erro) {
    error_log('[SYNERGIAS CNPJ] ' . $erro->getMessage());
    responder(503, ['ok' => false, 'error' => 'A consulta automática está indisponível. Preencha e salve os dados manualmente.']);
}
