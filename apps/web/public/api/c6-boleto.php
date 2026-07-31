<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
exigirAutenticacao();
require_once __DIR__ . '/c6-client.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function c6BoletoResponder(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function c6BoletoBody(): array {
    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) c6BoletoResponder(422, ['ok' => false, 'error' => 'Corpo JSON inválido.']);
    return $body;
}
function c6Digitos(mixed $v): string { return (string)preg_replace('/\D+/', '', (string)$v); }
function c6Texto(mixed $v, int $max): string { return mb_substr(trim((string)$v), 0, $max); }
function c6Primeiro(array $fontes, array $chaves): mixed {
    foreach ($fontes as $fonte) foreach ($chaves as $chave) {
        if (is_array($fonte) && trim((string)($fonte[$chave] ?? '')) !== '') return $fonte[$chave];
    }
    return '';
}
function c6Normalizar(array $r): array {
    return [
        'c6Id' => (string)($r['id'] ?? ''),
        'externalReferenceId' => (string)($r['external_reference_id'] ?? ''),
        'nossoNumero' => (string)($r['our_number'] ?? ''),
        'linhaDigitavel' => (string)($r['digitable_line'] ?? ''),
        'codigoBarras' => (string)($r['bar_code'] ?? ''),
        'status' => (string)($r['status'] ?? ''),
        'valor' => isset($r['amount']) ? (float)$r['amount'] : null,
        'vencimento' => (string)($r['due_date'] ?? ''),
        'pagamentos' => is_array($r['payments'] ?? null) ? $r['payments'] : [],
        'raw' => $r,
    ];
}
function c6PayloadEmissao(array $body): array {
    $pedido = is_array($body['pedido'] ?? null) ? $body['pedido'] : [];
    $parcela = is_array($body['parcela'] ?? null) ? $body['parcela'] : [];
    $cliente = is_array($pedido['clienteAtual'] ?? null) ? $pedido['clienteAtual'] : [];
    $dest = is_array($pedido['destinatarioFiscal'] ?? null) ? $pedido['destinatarioFiscal'] : [];
    $end = is_array($pedido['enderecoFiscal'] ?? null) ? $pedido['enderecoFiscal'] : [];
    $fontes = [$cliente, $dest, $pedido];
    $fontesEnd = [$end, $dest, $cliente, $pedido];

    $taxId = c6Digitos(c6Primeiro($fontes, ['cnpj', 'cpf', 'cpfCnpj', 'documento', 'clienteDocumento']));
    $cep = c6Digitos(c6Primeiro($fontesEnd, ['cep', 'faturamentoCep']));
    $nome = c6Texto(c6Primeiro($fontes, ['razaoSocial', 'nomeFantasia', 'nome', 'clienteNome']), 40);
    $rua = c6Texto(c6Primeiro($fontesEnd, ['logradouro', 'endereco', 'faturamentoEndereco']), 33);
    $numeroTexto = c6Digitos(c6Primeiro($fontesEnd, ['numero', 'faturamentoNumero']));
    $cidade = c6Texto(c6Primeiro($fontesEnd, ['cidade', 'municipio', 'faturamentoCidade']), 40);
    $uf = strtoupper(c6Texto(c6Primeiro($fontesEnd, ['uf', 'estado', 'faturamentoEstado']), 2));
    $valor = round((float)($parcela['valor'] ?? 0), 2);
    $vencimento = c6Texto($parcela['vencimento'] ?? '', 10);
    $erros = [];
    if (!in_array(strlen($taxId), [11, 14], true)) $erros[] = 'CPF/CNPJ inválido.';
    if ($nome === '') $erros[] = 'Nome/razão social ausente.';
    if ($rua === '' || $numeroTexto === '') $erros[] = 'Logradouro ou número ausente.';
    if ($cidade === '' || strlen($uf) !== 2 || strlen($cep) !== 8) $erros[] = 'Cidade, UF ou CEP inválido.';
    if ($valor <= 0) $erros[] = 'Valor da parcela inválido.';
    $dt = DateTimeImmutable::createFromFormat('Y-m-d', $vencimento);
    if (!$dt || $dt->format('Y-m-d') !== $vencimento) $erros[] = 'Vencimento inválido.';
    if ($erros) throw new C6ApiException(implode(' ', $erros), 422);

    $pedidoId = (string)($pedido['id'] ?? $pedido['numeroPedido'] ?? '');
    $parcelaNumero = (string)max(1, (int)($parcela['numero'] ?? 1));
    $recuperarPdf = (bool)(is_array($body['opcoes'] ?? null) ? ($body['opcoes']['recuperarPdf'] ?? false) : false);
    $sufixoReferencia = $recuperarPdf ? '|pdf-v1' : '';
    $referencia = 'S' . strtoupper(substr(hash('sha256', $pedidoId . '|' . $parcelaNumero . $sufixoReferencia), 0, 9));
    $payload = [
        'external_reference_id' => $referencia,
        'amount' => $valor,
        'due_date' => $vencimento,
        'billing_scheme' => '21',
        'payer' => [
            'name' => $nome,
            'tax_id' => $taxId,
            'address' => [
                'street' => $rua,
                'number' => (int)$numeroTexto,
                'city' => $cidade,
                'state' => $uf,
                'zip_code' => $cep,
            ],
        ],
    ];
    $complemento = c6Texto(c6Primeiro($fontesEnd, ['complemento', 'faturamentoComplemento']), 24);
    if ($complemento !== '') $payload['payer']['address']['complement'] = $complemento;
    $email = strtolower(c6Texto(c6Primeiro($fontes, ['email', 'emailNotaFiscal', 'clienteEmail']), 200));
    if (filter_var($email, FILTER_VALIDATE_EMAIL)) $payload['payer']['email'] = $email;
    $instrucoes = array_values(array_filter(array_map(
        fn($v) => c6Texto($v, 80),
        is_array($body['instructions'] ?? null) ? array_slice($body['instructions'], 0, 4) : []
    )));
    if ($instrucoes) $payload['instructions'] = $instrucoes;
    $jurosValor = round((float)($pedido['jurosBoletoValor'] ?? 0), 2);
    if ($jurosValor > 0) {
        $payload['interest'] = [
            'type' => strtoupper((string)($pedido['jurosBoletoTipo'] ?? 'P')) === 'V' ? 'V' : 'P',
            'value' => $jurosValor,
            'dead_line' => max(0, (int)($pedido['jurosBoletoPrazo'] ?? 0)),
        ];
    }
    $multaValor = round((float)($pedido['multaBoletoValor'] ?? 0), 2);
    if ($multaValor > 0) {
        $payload['fine'] = [
            'type' => strtoupper((string)($pedido['multaBoletoTipo'] ?? 'P')) === 'V' ? 'V' : 'P',
            'value' => $multaValor,
            'dead_line' => max(0, (int)($pedido['multaBoletoPrazo'] ?? 0)),
        ];
    }
    $descontoValor = round((float)($pedido['descontoBoletoValor'] ?? 0), 2);
    if ($descontoValor > 0) {
        $payload['discount'] = [
            'discount_type' => strtoupper((string)($pedido['descontoBoletoTipo'] ?? 'P')) === 'V' ? 'V' : 'P',
            'first' => [
                'value' => $descontoValor,
                'dead_line' => max(1, (int)($pedido['descontoBoletoPrazo'] ?? 1)),
            ],
        ];
    }
    return $payload;
}

$action = (string)($_GET['action'] ?? 'diagnostico');
try {
    $client = new C6ApiClient();
    if ($action === 'diagnostico') c6BoletoResponder(200, ['ok' => true, 'c6' => $client->diagnostico()]);
    $body = c6BoletoBody();
    if ($action === 'testar-token') c6BoletoResponder(200, ['ok' => true, 'c6' => $client->testarToken()]);
    if ($action === 'cadastrar-webhook') {
        $url = 'https://erp-teste.synergias.com.br/api/c6-webhook.php';
        c6BoletoResponder(200, ['ok' => true, 'webhook' => $client->cadastrarWebhook($url), 'url' => $url]);
    }
    if ($action === 'emitir') c6BoletoResponder(200, ['ok' => true, 'cobranca' => c6Normalizar($client->emitir(c6PayloadEmissao($body)))]);
    $id = trim((string)($body['c6Id'] ?? ''));
    if ($action === 'consultar') c6BoletoResponder(200, ['ok' => true, 'cobranca' => c6Normalizar($client->consultar($id))]);
    if ($action === 'cancelar') c6BoletoResponder(200, ['ok' => true, 'cobranca' => c6Normalizar($client->cancelar($id))]);
    if ($action === 'pdf') c6BoletoResponder(200, ['ok' => true, 'pdf' => $client->pdf($id)]);
    if ($action === 'alterar') {
        $permitidos = ['amount', 'due_date', 'discount', 'interest', 'fine'];
        $alteracao = array_intersect_key(is_array($body['alteracao'] ?? null) ? $body['alteracao'] : [], array_flip($permitidos));
        if (!$alteracao) throw new C6ApiException('Nenhuma alteração válida informada.', 422);
        c6BoletoResponder(200, ['ok' => true, 'cobranca' => c6Normalizar($client->alterar($id, $alteracao))]);
    }
    c6BoletoResponder(404, ['ok' => false, 'error' => 'Ação C6 inválida.']);
} catch (C6ApiException $e) {
    c6BoletoResponder(in_array($e->httpStatus, range(400, 599), true) ? $e->httpStatus : 502, ['ok' => false, 'error' => $e->getMessage(), 'details' => $e->payload]);
} catch (Throwable $e) {
    c6BoletoResponder(500, ['ok' => false, 'error' => $e->getMessage()]);
}
