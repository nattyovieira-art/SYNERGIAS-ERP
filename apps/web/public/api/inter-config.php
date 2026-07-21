<?php
declare(strict_types=1);

function localizarDiretorioPrivadoInter(): string
{
    $documentRoot = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? '')) ?: '';
    $candidatos = [
        rtrim((string)(getenv('HOME') ?: ''), '/\\') . '/synergias_private/inter',
        dirname(__DIR__, 2) . '/synergias_private/inter',
        dirname((string)($_SERVER['DOCUMENT_ROOT'] ?? __DIR__)) . '/synergias_private/inter',
        dirname(__DIR__, 3) . '/synergias_private/inter',
    ];

    foreach (array_unique($candidatos) as $candidato) {
        $real = realpath($candidato);
        if ($real === false || !is_file($real . '/config.php')) continue;
        if ($documentRoot !== '' && str_starts_with($real, $documentRoot . DIRECTORY_SEPARATOR)) continue;
        return $real;
    }

    throw new RuntimeException(
        'Integração Banco Inter não configurada. Instale synergias_private/inter fora da raiz pública do ERP.'
    );
}

function carregarConfigInter(): array
{
    $privateRoot = localizarDiretorioPrivadoInter();
    $configPath = $privateRoot . '/config.php';

    $config = require $configPath;

    if (!is_array($config)) {
        throw new RuntimeException('Configuração privada do Banco Inter inválida.');
    }

    $defaults = [
        'base_url' => 'https://cdpj.partners.bancointer.com.br/cobranca/v3',
        'token_url' => 'https://cdpj.partners.bancointer.com.br/oauth/v2/token',
        'cert_path' => $privateRoot . '/Inter API_Certificado.crt',
        'key_path' => $privateRoot . '/Inter API_Chave.key',
        'client_id' => '',
        'client_secret' => '',
        'integration_id' => '',
        'conta_corrente' => '287384420',
        'scope_candidates' => [
            'boleto-cobranca.read boleto-cobranca.write',
        ],
        'timeout_seconds' => 45,
    ];

    $config = array_replace($defaults, $config);

    foreach (['base_url', 'token_url', 'cert_path', 'key_path'] as $required) {
        if (!is_string($config[$required]) || trim($config[$required]) === '') {
            throw new RuntimeException("Campo obrigatório ausente na configuração Inter: {$required}");
        }
    }

    if (!is_file($config['cert_path'])) {
        throw new RuntimeException('Certificado da API Inter não encontrado no diretório privado.');
    }

    if (!is_file($config['key_path'])) {
        throw new RuntimeException('Chave privada da API Inter não encontrada no diretório privado.');
    }

    $documentRoot = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $certReal = realpath($config['cert_path']);
    $keyReal = realpath($config['key_path']);

    if ($documentRoot && $certReal && str_starts_with($certReal, $documentRoot . DIRECTORY_SEPARATOR)) {
        throw new RuntimeException('O certificado Inter está dentro da pasta pública. Mova-o para o diretório privado.');
    }

    if ($documentRoot && $keyReal && str_starts_with($keyReal, $documentRoot . DIRECTORY_SEPARATOR)) {
        throw new RuntimeException('A chave privada Inter está dentro da pasta pública. Mova-a para o diretório privado.');
    }

    return $config;
}
