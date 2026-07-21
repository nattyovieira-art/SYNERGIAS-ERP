<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

exigirAutenticacao();

$pdo = obterPdo();
$pdo->query('SELECT 1');

responder(200, [
    'ok' => true,
    'service' => 'Synergias ERP API',
    'database' => 'connected',
]);
