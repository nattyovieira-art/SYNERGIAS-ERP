<?php
declare(strict_types=1);

$localConfig = __DIR__ . '/config.local.php';

if (!is_file($localConfig)) {
    throw new RuntimeException(
        'API do Synergias ERP ainda não configurada. Crie api/config.local.php com as credenciais MySQL.'
    );
}

$config = require $localConfig;

if (!is_array($config)) {
    throw new RuntimeException('Configuração MySQL inválida.');
}

foreach (['host', 'database', 'username', 'password'] as $requiredKey) {
    if (!array_key_exists($requiredKey, $config)) {
        throw new RuntimeException("Campo obrigatório ausente na configuração: {$requiredKey}");
    }
}

return $config;
