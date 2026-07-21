<?php
if (!defined('SYNERGIAS_AUTH_BOOTSTRAP')) {
    http_response_code(404);
    exit;
}

// Copie este arquivo para auth-config.php somente no servidor e preencha
// os valores usando credenciais próprias. Nunca envie auth-config.php ao Git.
return [
    'admin_name' => 'Administrador',
    'admin_user' => 'admin',
    'admin_password_hash' => '',
    'admin_password_salt' => '',
    'totp_secret' => '',
    'turnstile_site_key' => '',
    'turnstile_secret_key' => '',
    'smtp_host' => '',
    'smtp_encryption' => 'tls',
    'smtp_secure' => false,
    'smtp_starttls' => true,
    'smtp_user' => '',
    'smtp_pass' => '',
    'smtp_from' => '',
    'smtp_from_name' => 'Synergias ERP',
    'admin_email' => '',
    'smtp_port' => 587,
    'admin_password_php_hash' => '',
    'email_otp_enabled' => false,
    'admin_password_iterations' => 310000,
];
