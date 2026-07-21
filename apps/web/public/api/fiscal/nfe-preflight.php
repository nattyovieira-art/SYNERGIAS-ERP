<?php
declare(strict_types=1);

define('SYNERGIAS_AUTH_BOOTSTRAP', true);
require dirname(__DIR__) . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Referrer-Policy: no-referrer');

const NFE_PREFLIGHT_VERSION = 'V53';

function nfePreflightResponder(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function texto(mixed $valor): string { return trim((string)($valor ?? '')); }
function digitos(mixed $valor): string { return preg_replace('/\D+/', '', texto($valor)) ?: ''; }
function numero(mixed $valor): float {
    if (is_int($valor) || is_float($valor)) return (float)$valor;
    $v = str_replace(['.', ','], ['', '.'], texto($valor));
    return is_numeric($v) ? (float)$v : 0.0;
}

function validarOrigem(): void {
    $origin = texto($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === '') return;
    $host = strtolower(texto($_SERVER['HTTP_HOST'] ?? ''));
    $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    if ($host === '' || $originHost === '' || !hash_equals($host, $originHost)) {
        nfePreflightResponder(403, ['ok' => false, 'mensagem' => 'Origem da solicitação não autorizada.']);
    }
}

function homeDir(): string {
    $home = rtrim((string)(getenv('HOME') ?: ''), '/\\');
    if ($home !== '' && is_dir($home)) return $home;
    $docRoot = rtrim(texto($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
    if ($docRoot !== '') return dirname($docRoot);
    throw new RuntimeException('Diretório privado do servidor indisponível.');
}

function metadataA1(): array {
    $arquivo = homeDir() . '/synergias_private/fiscal-a1/certificado.a1.enc.json';
    if (!is_file($arquivo) || !is_readable($arquivo)) {
        return ['configurado' => false, 'cnpj' => '', 'validTo' => ''];
    }
    $json = json_decode((string)file_get_contents($arquivo), true);
    $meta = is_array($json['metadata'] ?? null) ? $json['metadata'] : [];
    return [
        'configurado' => true,
        'cnpj' => digitos($meta['cnpj'] ?? ''),
        'validTo' => texto($meta['validTo'] ?? ''),
    ];
}

try {
    if (strtoupper(texto($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
        nfePreflightResponder(405, ['ok' => false, 'mensagem' => 'Método não permitido.']);
    }
    validarOrigem();
    $usuario = exigirAutenticacao();
    if (strcasecmp(texto($usuario['perfil'] ?? ''), 'Administrador') !== 0) {
        nfePreflightResponder(403, ['ok' => false, 'mensagem' => 'Apenas Administrador pode validar a pré-emissão fiscal.']);
    }

    $body = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($body)) nfePreflightResponder(400, ['ok' => false, 'mensagem' => 'Conteúdo inválido.']);

    $ambiente = strtoupper(texto($body['ambiente'] ?? 'HOMOLOGACAO'));
    $venda = is_array($body['venda'] ?? null) ? $body['venda'] : [];
    $fiscal = is_array($body['fiscal'] ?? null) ? $body['fiscal'] : [];
    $erros = [];
    $avisos = [];

    if ($ambiente !== 'HOMOLOGACAO') $erros[] = 'Somente o ambiente de homologação está liberado.';

    $cnpjEmitente = digitos($fiscal['cnpj'] ?? '');
    if (strlen($cnpjEmitente) !== 14) $erros[] = 'CNPJ do emitente inválido ou não informado na Configuração Fiscal.';
    if (texto($fiscal['razaoSocial'] ?? '') === '') $erros[] = 'Razão social do emitente não informada.';
    if (digitos($fiscal['inscricaoEstadual'] ?? '') === '') $erros[] = 'Inscrição Estadual do emitente não informada.';
    if (strtoupper(texto($fiscal['uf'] ?? '')) !== 'RS') $erros[] = 'UF do emitente deve ser RS nesta etapa.';
    if (strlen(digitos($fiscal['codigoIbgeMunicipio'] ?? '')) !== 7) $erros[] = 'Código IBGE do município do emitente deve ter 7 dígitos.';
    foreach (['cep' => 'CEP', 'logradouro' => 'logradouro', 'numero' => 'número', 'bairro' => 'bairro', 'municipio' => 'município'] as $campo => $rotulo) {
        if (texto($fiscal[$campo] ?? '') === '') $erros[] = "Endereço do emitente incompleto: {$rotulo}.";
    }

    $a1 = metadataA1();
    if (!$a1['configurado']) $erros[] = 'Certificado A1 não encontrado no armazenamento privado.';
    elseif ($cnpjEmitente !== '' && !hash_equals($cnpjEmitente, (string)$a1['cnpj'])) $erros[] = 'O CNPJ do emitente não corresponde ao certificado A1 instalado.';

    $destinatarioFiscal = is_array($venda['destinatarioFiscal'] ?? null) ? $venda['destinatarioFiscal'] : [];
    $clienteAtual = is_array($venda['clienteAtual'] ?? null) ? $venda['clienteAtual'] : [];
    $destDoc = '';
    foreach ([
        $clienteAtual['cnpj'] ?? '', $clienteAtual['cpf'] ?? '', $clienteAtual['cpfCnpj'] ?? '', $clienteAtual['documento'] ?? '',
        $destinatarioFiscal['cnpj'] ?? '', $destinatarioFiscal['cpf'] ?? '', $destinatarioFiscal['cpfCnpj'] ?? '', $destinatarioFiscal['documento'] ?? '',
        $venda['clienteDocumento'] ?? '', $venda['cpfCnpj'] ?? '', $venda['cnpj'] ?? '', $venda['cpf'] ?? ''
    ] as $candidatoDocumento) {
        $normalizado = digitos($candidatoDocumento);
        if (in_array(strlen($normalizado), [11, 14], true)) { $destDoc = $normalizado; break; }
        if ($destDoc === '' && $normalizado !== '') $destDoc = $normalizado;
    }
    if (!in_array(strlen($destDoc), [11, 14], true)) $erros[] = 'CPF/CNPJ do destinatário inválido. Documento recebido: ' . ($destDoc !== '' ? $destDoc : 'vazio') . '.';
    if (texto($venda['clienteNome'] ?? '') === '') $erros[] = 'Nome ou razão social do destinatário não informado.';
    foreach (['faturamentoCep' => 'CEP', 'faturamentoEndereco' => 'logradouro', 'faturamentoNumero' => 'número', 'faturamentoBairro' => 'bairro', 'faturamentoCidade' => 'município', 'faturamentoEstado' => 'UF'] as $campo => $rotulo) {
        if (texto($venda[$campo] ?? '') === '') $erros[] = "Endereço fiscal do destinatário incompleto: {$rotulo}.";
    }

    $itens = is_array($venda['itens'] ?? null) ? $venda['itens'] : [];
    if (!$itens) $erros[] = 'A NF-e precisa ter ao menos um item.';
    foreach ($itens as $i => $item) {
        if (!is_array($item)) { $erros[] = 'Item ' . ($i + 1) . ' inválido.'; continue; }
        $n = $i + 1;
        if (texto($item['descricao'] ?? '') === '') $erros[] = "Item {$n}: descrição não informada.";
        if (numero($item['quantidade'] ?? 0) <= 0) $erros[] = "Item {$n}: quantidade deve ser maior que zero.";
        if (numero($item['valorUnitario'] ?? 0) < 0) $erros[] = "Item {$n}: valor unitário inválido.";
        if (strlen(digitos($item['ncm'] ?? '')) !== 8) $erros[] = "Item {$n}: NCM deve ter 8 dígitos.";
        if (!preg_match('/^\d{4}$/', digitos($item['cfop'] ?? ''))) $erros[] = "Item {$n}: CFOP deve ter 4 dígitos.";
        if (texto($item['unidade'] ?? '') === '') $erros[] = "Item {$n}: unidade comercial não informada.";

        $origem = substr(digitos($item['origem'] ?? ''), 0, 1);
        if (!preg_match('/^[0-8]$/', $origem)) {
            // Venda comum: a origem comercial do item (ex.: brinde) não é a origem fiscal da mercadoria.
            $origem = '0';
        }

        $regime = strtoupper(texto($fiscal['regimeTributario'] ?? 'SIMPLES_NACIONAL')) ?: 'SIMPLES_NACIONAL';
        $csosn = digitos($item['csosn'] ?? '');
        $cstIcms = digitos($item['cstIcms'] ?? '');
        if ($regime === 'SIMPLES_NACIONAL') {
            if (!preg_match('/^(101|102|103|201|202|203|300|400|500|900)$/', $csosn)) {
                $erros[] = "Item {$n}: CSOSN obrigatório e inválido para empresa do Simples Nacional.";
            }
        } elseif (in_array($regime, ['LUCRO_PRESUMIDO', 'LUCRO_REAL'], true)) {
            if (!preg_match('/^\d{2}$/', $cstIcms)) $erros[] = "Item {$n}: CST de ICMS obrigatório para regime normal.";
        } else {
            $erros[] = "Regime tributário informado não é compatível com esta emissão.";
        }

        $cstPis = digitos($item['cstPis'] ?? '');
        $cstCofins = digitos($item['cstCofins'] ?? '');
        if (!preg_match('/^\d{2}$/', $cstPis)) $erros[] = "Item {$n}: CST de PIS obrigatório.";
        if (!preg_match('/^\d{2}$/', $cstCofins)) $erros[] = "Item {$n}: CST de COFINS obrigatório.";

        if ($regime === 'SIMPLES_NACIONAL' && $csosn === '102') {
            if ($cstPis !== '49') $erros[] = "Item {$n}: para o padrão fiscal confirmado da venda comum, CST PIS deve ser 49.";
            if ($cstCofins !== '49') $erros[] = "Item {$n}: para o padrão fiscal confirmado da venda comum, CST COFINS deve ser 49.";
            if (numero($item['aliquotaIcms'] ?? 0) != 0.0) $erros[] = "Item {$n}: CSOSN 102 deve permanecer sem destaque de ICMS nesta regra.";
            if (numero($item['aliquotaPis'] ?? 0) != 0.0) $erros[] = "Item {$n}: PIS deve permanecer sem destaque nesta regra.";
            if (numero($item['aliquotaCofins'] ?? 0) != 0.0) $erros[] = "Item {$n}: COFINS deve permanecer sem destaque nesta regra.";
        }

        foreach ([
            'aliquotaIcms' => 'alíquota de ICMS',
            'reducaoBcIcms' => 'redução da base de ICMS',
            'aliquotaPis' => 'alíquota de PIS',
            'aliquotaCofins' => 'alíquota de COFINS',
        ] as $campoTributo => $rotuloTributo) {
            $valorTributo = numero($item[$campoTributo] ?? 0);
            if ($valorTributo < 0 || $valorTributo > 100) $erros[] = "Item {$n}: {$rotuloTributo} inválida.";
        }

        $classificacao = strtoupper(texto($item['classificacao'] ?? ''));
        $cest = digitos($item['cest'] ?? '');
        if (str_contains($classificacao, 'SUBSTITUI') && strlen($cest) !== 7) {
            $erros[] = "Item {$n}: CEST com 7 dígitos é obrigatório para produto com Substituição Tributária.";
        }
    }

    $total = numero($venda['totalFinal'] ?? 0);
    if ($total <= 0) $erros[] = 'Valor total da NF-e deve ser maior que zero.';
    if (texto($venda['numeroPedido'] ?? '') === '') $avisos[] = 'Pedido sem número interno definido.';
    if (texto($venda['formaPagamento'] ?? '') === '') $avisos[] = 'Forma de pagamento não informada.';

    $pronto = count($erros) === 0;
    nfePreflightResponder(200, [
        'ok' => true,
        'pronto' => $pronto,
        'ambiente' => 'HOMOLOGACAO',
        'versao' => NFE_PREFLIGHT_VERSION,
        'erros' => array_values(array_unique($erros)),
        'avisos' => array_values(array_unique($avisos)),
        'resumo' => [
            'emitenteCnpj' => $cnpjEmitente,
            'destinatarioDocumento' => $destDoc,
            'itens' => count($itens),
            'valorTotal' => round($total, 2),
        ],
        'validadoEm' => gmdate('c'),
    ]);
} catch (Throwable $e) {
    error_log('[Synergias NF-e Preflight] ' . $e->getMessage());
    nfePreflightResponder(500, ['ok' => false, 'mensagem' => 'Não foi possível concluir a validação segura da pré-emissão.']);
}
