<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

exigirAutenticacao();
require_once __DIR__ . '/inter-client.php';

const SYNERGIAS_INTER_API_VERSION = 'V233-INTER-V3-FORMA-BOLETO-20260805';

function corpoJson(): array
{
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '{}', true);

    if (!is_array($body)) {
        responder(422, ['ok' => false, 'error' => 'Corpo JSON inválido.']);
    }

    return $body;
}

function somenteDigitos(mixed $valor): string
{
    return preg_replace('/\D+/', '', (string)$valor) ?: '';
}

function texto(mixed $valor, int $max = 255): string
{
    return mb_substr(trim((string)$valor), 0, $max);
}


function removerChaveRecursiva(array &$dados, string $chaveProibida): void
{
    foreach (array_keys($dados) as $chave) {
        if (strcasecmp((string)$chave, $chaveProibida) === 0) {
            unset($dados[$chave]);
            continue;
        }
        if (isset($dados[$chave]) && is_array($dados[$chave])) {
            removerChaveRecursiva($dados[$chave], $chaveProibida);
        }
    }
}

/* SYNERGIAS_INTER_EMAIL_VALIDO_MAX50_V238
 * O Banco Inter aceita no maximo 50 caracteres e somente um endereco valido.
 * Campos antigos podem conter nome do contato e varios emails separados por ; ou ,.
 */
function normalizarEmailBancoInter(mixed $valor): string
{
    $bruto = trim((string)$valor);
    if ($bruto === '') return '';

    $partes = preg_split('/[;,\r\n]+/u', $bruto) ?: [$bruto];

    foreach ($partes as $parte) {
        $parte = trim((string)$parte);
        if ($parte === '') continue;

        // Remove rotulos comuns antes do endereco, preservando o trecho depois do ultimo separador.
        $segmentos = preg_split('/\s+-\s+|\s{2,}/u', $parte) ?: [$parte];
        $candidato = trim((string)end($segmentos));

        // Converte acentos eventualmente colados ao endereco em caracteres ASCII.
        if (function_exists('iconv')) {
            $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $candidato);
            if (is_string($ascii) && $ascii !== '') $candidato = $ascii;
        }

        if (preg_match('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $candidato, $achado)) {
            $email = strtolower(trim($achado[0]));
            if (strlen($email) <= 50 && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return $email;
            }
        }
    }

    return '';
}

function primeiroValor(array $fontes, array $chaves): mixed
{
    foreach ($fontes as $fonte) {
        if (!is_array($fonte)) continue;
        foreach ($chaves as $chave) {
            if (array_key_exists($chave, $fonte) && trim((string)$fonte[$chave]) !== '') {
                return $fonte[$chave];
            }
        }
    }
    return '';
}


function mesAnoDescricaoBoleto(array $pedido): string
{
    $dataBase = texto(primeiroValor([$pedido], [
        'dataEmissao',
        'emissao',
        'dataPedido',
        'criadoEm',
    ]), 30);

    try {
        $data = $dataBase !== '' ? new DateTimeImmutable($dataBase) : new DateTimeImmutable('now');
    } catch (Throwable) {
        $data = new DateTimeImmutable('now');
    }

    $meses = [
        1 => 'JAN', 2 => 'FEV', 3 => 'MAR', 4 => 'ABR',
        5 => 'MAI', 6 => 'JUN', 7 => 'JUL', 8 => 'AGO',
        9 => 'SET', 10 => 'OUT', 11 => 'NOV', 12 => 'DEZ',
    ];

    $mes = $meses[(int)$data->format('n')] ?? strtoupper($data->format('M'));
    return $mes . ' ' . $data->format('y');
}

function numeroNotaFiscalBoleto(array $pedido): string
{
    return texto(primeiroValor([$pedido], [
        'numeroNotaFiscal',
        'numeroNFe',
        'notaFiscalNumero',
        'nfeNumero',
    ]), 30);
}

function codigoCobranca(array $pedido, array $parcela): string
{
    $pedidoNumero = somenteDigitos($pedido['numeroPedido'] ?? $pedido['id'] ?? '0');
    $pedidoNumero = ltrim($pedidoNumero, '0');
    $pedidoNumero = $pedidoNumero !== '' ? $pedidoNumero : '0';
    $numeroParcela = max(1, (int)($parcela['numero'] ?? 1));

    $codigo = 'P' . $pedidoNumero . 'P' . str_pad((string)$numeroParcela, 2, '0', STR_PAD_LEFT);
    return mb_substr($codigo, 0, 15);
}

function montarPayloadInter(array $body): array
{
    $pedido = is_array($body['pedido'] ?? null) ? $body['pedido'] : [];
    $parcela = is_array($body['parcela'] ?? null) ? $body['parcela'] : [];

    $cliente = is_array($pedido['clienteAtual'] ?? null) ? $pedido['clienteAtual'] : [];
    $destinatario = is_array($pedido['destinatarioFiscal'] ?? null) ? $pedido['destinatarioFiscal'] : [];
    $enderecoFiscal = is_array($pedido['enderecoFiscal'] ?? null) ? $pedido['enderecoFiscal'] : [];
    $fontes = [$cliente, $destinatario, $pedido];
    $fontesEndereco = [$enderecoFiscal, $destinatario, $cliente, $pedido];

    $documento = somenteDigitos(primeiroValor($fontes, ['cnpj', 'cpf', 'cpfCnpj', 'cnpjCpf', 'documento', 'clienteDocumento']));
    $cep = somenteDigitos(primeiroValor($fontesEndereco, ['cep', 'faturamentoCep']));
    $telefone = somenteDigitos(primeiroValor($fontes, ['telefone', 'celular', 'clienteTelefone']));
    $ddd = strlen($telefone) >= 10 ? substr($telefone, 0, 2) : '';
    $numeroTelefone = strlen($telefone) >= 10 ? substr($telefone, 2) : $telefone;
    $valor = round((float)($parcela['valor'] ?? 0), 2);
    $vencimento = texto($parcela['vencimento'] ?? '', 10);

    $nomePagador = texto(primeiroValor($fontes, ['razaoSocial', 'nomeFantasia', 'nome', 'clienteNome']), 100);
    $enderecoPagador = texto(primeiroValor($fontesEndereco, ['logradouro', 'endereco', 'faturamentoEndereco']), 90);
    $numeroPagador = texto(primeiroValor($fontesEndereco, ['numero', 'faturamentoNumero']), 20);
    $complementoPagador = texto(primeiroValor($fontesEndereco, ['complemento', 'faturamentoComplemento']), 30);
    $bairroPagador = texto(primeiroValor($fontesEndereco, ['bairro', 'faturamentoBairro']), 60);
    $cidadePagador = texto(primeiroValor($fontesEndereco, ['cidade', 'municipio', 'faturamentoCidade']), 60);
    $ufPagador = strtoupper(texto(primeiroValor($fontesEndereco, ['uf', 'estado', 'faturamentoEstado']), 2));
    $emailPagador = normalizarEmailBancoInter(primeiroValor($fontes, ['email', 'emailNotaFiscal', 'clienteEmail']));

    $erros = [];
    if ($documento === '' || !in_array(strlen($documento), [11, 14], true)) $erros[] = 'CPF/CNPJ do cliente inválido.';
    if ($nomePagador === '') $erros[] = 'Nome do cliente não informado.';
    if ($enderecoPagador === '') $erros[] = 'Endereço de faturamento não informado.';
    if ($numeroPagador === '') $erros[] = 'Número do endereço não informado.';
    if ($bairroPagador === '') $erros[] = 'Bairro não informado.';
    if ($cidadePagador === '') $erros[] = 'Cidade não informada.';
    if (strlen($ufPagador) !== 2) $erros[] = 'UF não informada ou inválida.';
    if (strlen($cep) !== 8) $erros[] = 'CEP não informado ou inválido.';
    if ($valor <= 0) $erros[] = 'Valor da parcela inválido.';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $vencimento)) $erros[] = 'Data de vencimento inválida.';

    if ($erros !== []) {
        responder(422, [
            'ok' => false,
            'error' => 'Dados insuficientes para emitir cobrança no Banco Inter.',
            'details' => $erros,
            'camposRecebidos' => [
                'documento' => $documento,
                'nome' => $nomePagador,
                'cep' => $cep,
                'endereco' => $enderecoPagador,
                'numero' => $numeroPagador,
                'bairro' => $bairroPagador,
                'cidade' => $cidadePagador,
                'uf' => $ufPagador,
            ],
        ]);
    }

    $seuNumero = codigoCobranca($pedido, $parcela);
    $numeroPedido = texto($pedido['numeroPedido'] ?? $pedido['id'] ?? '', 30);
    $numeroParcela = max(1, (int)($parcela['numero'] ?? 1));
    $totalParcelas = max(1, count(is_array($pedido['parcelas'] ?? null) ? $pedido['parcelas'] : []));

    $payload = [
        'seuNumero' => $seuNumero,
        'valorNominal' => $valor,
        'dataVencimento' => $vencimento,
        'numDiasAgenda' => 60,
        'formasRecebimento' => ['BOLETO'],
        'pagador' => [
            'cpfCnpj' => $documento,
            'tipoPessoa' => strlen($documento) === 14 ? 'JURIDICA' : 'FISICA',
            'nome' => $nomePagador,
            'endereco' => $enderecoPagador,
            'numero' => $numeroPagador,
            'complemento' => $complementoPagador,
            'bairro' => $bairroPagador,
            'cidade' => $cidadePagador,
            'uf' => $ufPagador,
            'cep' => $cep,
            'email' => $emailPagador,
            'ddd' => $ddd,
            'telefone' => $numeroTelefone,
        ],
        'multa' => [
            'codigo' => 'PERCENTUAL',
            'taxa' => 2.0,
        ],
        'mora' => [
            'codigo' => 'TAXAMENSAL',
            'taxa' => 1.0,
        ],
        'mensagem' => [
            'linha1' => texto('COMPRA DE MATERIAIS - ' . mesAnoDescricaoBoleto($pedido), 78),
            'linha2' => texto('PED' . $numeroPedido . ' NF' . (numeroNotaFiscalBoleto($pedido) ?: '-'), 78),
            'linha3' => texto('Parcela ' . $numeroParcela . '/' . $totalParcelas, 78),
        ],
    ];

    if ($payload['pagador']['email'] === '') unset($payload['pagador']['email']);
    if ($payload['pagador']['ddd'] === '') unset($payload['pagador']['ddd']);
    if ($payload['pagador']['telefone'] === '') unset($payload['pagador']['telefone']);
    if ($payload['pagador']['complemento'] === '') unset($payload['pagador']['complemento']);

    // V122: o Banco Inter não aceita bloco de desconto quando não há desconto.
    // Remove defensivamente qualquer ocorrência, inclusive se algum dado antigo chegar do frontend.
    removerChaveRecursiva($payload, 'desconto');

    return [$payload, $pedido, $parcela, $seuNumero];
}

function normalizarCobranca(array $retorno, ?array $pdf = null): array
{
    $pick = static function (array $data, array $keys) use (&$pick): mixed {
        foreach ($keys as $key) {
            if (array_key_exists($key, $data) && !is_array($data[$key])) return $data[$key];
        }
        foreach ($data as $value) {
            if (is_array($value)) {
                $encontrado = $pick($value, $keys);
                if ($encontrado !== null) return $encontrado;
            }
        }
        return null;
    };

    return [
        'codigoSolicitacao' => (string)($pick($retorno, ['codigoSolicitacao', 'idCobranca', 'id']) ?? ''),
        'nossoNumero' => (string)($pick($retorno, ['nossoNumero']) ?? ''),
        'seuNumero' => (string)($pick($retorno, ['seuNumero']) ?? ''),
        'linhaDigitavel' => (string)($pick($retorno, ['linhaDigitavel', 'linhaDigitavelBoleto']) ?? ''),
        'codigoBarras' => (string)($pick($retorno, ['codigoBarras', 'codigoBarrasBoleto']) ?? ''),
        'pixCopiaECola' => (string)($pick($retorno, ['pixCopiaECola', 'pixCopiaEColaQrCode', 'qrCodePix']) ?? ''),
        'txid' => (string)($pick($retorno, ['txid', 'txId']) ?? ''),
        'status' => (string)($pick($retorno, ['situacao', 'status']) ?? ''),
        'valorRecebido' => (float)($pick($retorno, ['valorRecebido', 'valorPago']) ?? 0),
        'dataPagamento' => (string)($pick($retorno, ['dataPagamento', 'dataRecebimento']) ?? ''),
        'pdfBase64' => (string)($pdf['pdfBase64'] ?? ''),
        'raw' => $retorno,
    ];
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = strtolower(trim((string)($_GET['action'] ?? '')));
$client = new InterApiClient();

try {
    if ($method === 'GET' && $action === 'diagnostico') {
        responder(200, ['ok' => true, 'apiVersion' => SYNERGIAS_INTER_API_VERSION, 'inter' => $client->diagnostico()]);
    }

    if ($method === 'POST' && $action === 'testar-token') {
        responder(200, ['ok' => true, 'apiVersion' => SYNERGIAS_INTER_API_VERSION, 'inter' => $client->testarToken()]);
    }

    if ($method === 'POST' && $action === 'emitir') {
        limitarTentativas('inter_emitir', 12, 300);
        [$payload, $pedido, $parcela, $seuNumero] = montarPayloadInter(corpoJson());
        removerChaveRecursiva($payload, 'desconto');
        error_log('[Synergias ERP Inter ' . SYNERGIAS_INTER_API_VERSION . '] emitir payload=' . json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $retorno = $client->emitirCobranca($payload);
        $normalizada = normalizarCobranca($retorno);
        $codigo = $normalizada['codigoSolicitacao'];

        if ($codigo === '') {
            throw new InterApiException('Banco Inter não retornou o código da solicitação da cobrança.', 502, $retorno);
        }

        // A criação é considerada concluída assim que o Inter devolve codigoSolicitacao.
        // Consulta e PDF são etapas posteriores e não podem transformar uma cobrança criada em erro 500.
        $normalizada['seuNumero'] = $normalizada['seuNumero'] ?: $seuNumero;
        $normalizada['status'] = $normalizada['status'] ?: 'CRIADA';

        $pdo = obterPdo();
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS inter_cobrancas (
                codigo_solicitacao VARCHAR(120) NOT NULL PRIMARY KEY,
                pedido_id VARCHAR(120) NOT NULL,
                pedido_numero VARCHAR(80) NULL,
                parcela_numero INT NOT NULL,
                seu_numero VARCHAR(30) NULL,
                status_inter VARCHAR(80) NULL,
                payload LONGTEXT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        $stmt = $pdo->prepare(
            'INSERT INTO inter_cobrancas
                (codigo_solicitacao, pedido_id, pedido_numero, parcela_numero, seu_numero, status_inter, payload)
             VALUES
                (:codigo, :pedido_id, :pedido_numero, :parcela, :seu_numero, :status_inter, :payload)
             ON DUPLICATE KEY UPDATE
                status_inter = VALUES(status_inter), payload = VALUES(payload), updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([
            'codigo' => $codigo,
            'pedido_id' => texto($pedido['id'] ?? '', 120),
            'pedido_numero' => texto($pedido['numeroPedido'] ?? '', 80),
            'parcela' => (int)($parcela['numero'] ?? 1),
            'seu_numero' => $normalizada['seuNumero'],
            'status_inter' => $normalizada['status'],
            'payload' => json_encode($normalizada['raw'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        responder(200, ['ok' => true, 'apiVersion' => SYNERGIAS_INTER_API_VERSION, 'cobranca' => $normalizada]);
    }

    if ($method === 'POST' && $action === 'consultar') {
        $body = corpoJson();
        $codigo = texto($body['codigoSolicitacao'] ?? '', 120);
        if ($codigo === '') responder(422, ['ok' => false, 'error' => 'Código da solicitação não informado.']);

        $retorno = $client->consultarCobranca($codigo);
        responder(200, ['ok' => true, 'cobranca' => normalizarCobranca($retorno)]);
    }

    if ($method === 'POST' && $action === 'pdf') {
        $body = corpoJson();
        $codigo = texto($body['codigoSolicitacao'] ?? '', 120);
        if ($codigo === '') responder(422, ['ok' => false, 'error' => 'Código da solicitação não informado.']);

        responder(200, ['ok' => true, 'pdf' => $client->obterPdfCobranca($codigo)]);
    }

    if ($method === 'POST' && $action === 'cancelar') {
        $body = corpoJson();
        $codigo = texto($body['codigoSolicitacao'] ?? '', 120);
        $motivo = texto($body['motivo'] ?? 'ACERTOS', 80);
        if ($codigo === '') responder(422, ['ok' => false, 'error' => 'Código da solicitação não informado.']);

        $retorno = $client->cancelarCobranca($codigo, $motivo);
        responder(200, ['ok' => true, 'cobranca' => normalizarCobranca($retorno)]);
    }

    responder(404, ['ok' => false, 'error' => 'Ação da API Inter não encontrada.']);
} catch (InterApiException $erro) {
    error_log('[Synergias ERP Inter] ' . $erro->getMessage());

    $payloadSeguro = is_array($erro->interPayload) ? $erro->interPayload : [];
    $diagnostico = [
        'tipo' => (string)($payloadSeguro['tipo'] ?? 'ERRO_INTER'),
        'codigo' => (string)($payloadSeguro['codigo'] ?? $payloadSeguro['error'] ?? ''),
        'descricao' => (string)($payloadSeguro['descricao'] ?? $payloadSeguro['error_description'] ?? $payloadSeguro['detail'] ?? $erro->getMessage()),
        'httpStatus' => (int)($payloadSeguro['httpStatus'] ?? $erro->httpStatus),
    ];

    responder(
        $erro->httpStatus >= 400 && $erro->httpStatus <= 599 ? $erro->httpStatus : 502,
        [
            'ok' => false,
            'apiVersion' => SYNERGIAS_INTER_API_VERSION,
            'error' => $erro->getMessage(),
            'interStatus' => $erro->httpStatus,
            'diagnostico' => $diagnostico,
            'details' => $payloadSeguro,
        ]
    );
}
