<?php
declare(strict_types=1);

function localizarDiretorioPrivadoC6(): string
{
    $documentRoot = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? '')) ?: '';
    $candidatos = [
        rtrim((string)(getenv('HOME') ?: ''), '/\\') . '/synergias_private/c6',
        dirname((string)($_SERVER['DOCUMENT_ROOT'] ?? __DIR__)) . '/synergias_private/c6',
        dirname(__DIR__, 3) . '/synergias_private/c6',
    ];

    foreach (array_unique($candidatos) as $candidato) {
        $real = realpath($candidato);
        if ($real === false || !is_file($real . '/config.php')) continue;
        if ($documentRoot !== '' && str_starts_with($real, $documentRoot . DIRECTORY_SEPARATOR)) continue;
        return $real;
    }

    throw new RuntimeException('Integração C6 Bank não configurada. Instale as credenciais pela área administrativa.');
}

function validarUrlC6(string $url, array $hostsPermitidos): string
{
    $partes = parse_url(trim($url));
    $host = strtolower((string)($partes['host'] ?? ''));
    if (($partes['scheme'] ?? '') !== 'https' || !in_array($host, $hostsPermitidos, true)) {
        throw new RuntimeException('Endereço da API C6 inválido ou não autorizado.');
    }
    return rtrim($url, '/');
}

function carregarConfigC6(): array
{
    $privateRoot = localizarDiretorioPrivadoC6();
    $config = require $privateRoot . '/config.php';
    if (!is_array($config)) throw new RuntimeException('Configuração privada do C6 Bank inválida.');

    $ambiente = ($config['environment'] ?? 'sandbox') === 'production' ? 'production' : 'sandbox';
    $defaults = [
        'environment' => $ambiente,
        'base_url' => $ambiente === 'production'
            ? 'https://baas-api.c6bank.info/v1/bank_slips'
            : 'https://baas-api-sandbox.c6bank.info/v1/bank_slips',
        'token_url' => $ambiente === 'production'
            ? 'https://baas-api.c6bank.info/v1/auth'
            : 'https://baas-api-sandbox.c6bank.info/v1/auth',
        'cert_path' => $privateRoot . '/client.crt',
        'key_path' => $privateRoot . '/client.key',
        'client_id' => '',
        'client_secret' => '',
        'partner_software_name' => 'Synergias ERP',
        'partner_software_version' => '1.0.0',
        'billing_scheme' => $ambiente === 'production' ? 15 : 21,
        'scopes' => 'bankslip.write bankslip.read',
        'timeout_seconds' => 45,
    ];
    $config = array_replace($defaults, $config);
    $hosts = $ambiente === 'production'
        ? ['baas-api.c6bank.info']
        : ['baas-api-sandbox.c6bank.info'];
    $config['base_url'] = validarUrlC6((string)$config['base_url'], $hosts);
    $config['token_url'] = validarUrlC6((string)$config['token_url'], $hosts);
    if ($ambiente === 'sandbox' && $config['token_url'] === 'https://baas-api-sandbox.c6bank.info/auth') {
        $config['token_url'] = 'https://baas-api-sandbox.c6bank.info/v1/auth';
    }
    if ($ambiente === 'production' && $config['token_url'] === 'https://baas-api.c6bank.info/auth') {
        $config['token_url'] = 'https://baas-api.c6bank.info/v1/auth';
    }

    foreach (['cert_path', 'key_path'] as $campo) {
        if (!is_file((string)$config[$campo])) throw new RuntimeException('Certificado ou chave privada do C6 Bank não encontrado.');
        $real = realpath((string)$config[$campo]);
        $doc = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
        if ($doc && $real && str_starts_with($real, $doc . DIRECTORY_SEPARATOR)) {
            throw new RuntimeException('Credencial C6 localizada dentro da pasta pública.');
        }
    }
    return $config;
}
