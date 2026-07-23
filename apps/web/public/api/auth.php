<?php
declare(strict_types=1);

define('SYNERGIAS_AUTH_BOOTSTRAP', true);
require __DIR__ . '/bootstrap.php';

$action = strtolower(trim((string)($_GET['action'] ?? 'status')));

if ($action === 'config') {
    $cfg = carregarConfigAuth();
    responder(200, [
        'ok' => true,
        'turnstileSiteKey' => (string)$cfg['turnstile_site_key'],
        'adminEmailMasked' => preg_replace('/(^.).*(@.*$)/', '$1***$2', (string)($cfg['admin_email'] ?? '')),
    ]);
}

if ($action === 'status') {
    iniciarSessaoSegura();
    responder(200, ['ok' => true, 'authenticated' => usuarioAutenticado() !== null, 'user' => usuarioAutenticado()]);
}

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    responder(405, ['ok' => false, 'error' => 'Método não permitido.']);
}
exigirMesmaOrigem();

$body = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($body)) responder(422, ['ok' => false, 'error' => 'Corpo JSON inválido.']);
$cfg = carregarConfigAuth();

if ($action === 'reauthenticate') {
    iniciarSessaoSegura();
    if (usuarioAutenticado() === null) responder(401, ['ok' => false, 'error' => 'Sessão expirada. Entre novamente no ERP.']);
    limitarTentativas('reauthenticate', 8, 900);
    if (!validarSenhaAdmin((string)($body['senha'] ?? ''), $cfg)) responder(401, ['ok' => false, 'error' => 'Senha administrativa inválida.']);
    limparTentativas('reauthenticate');
    $_SESSION['fiscal_edit_authorized_until'] = time() + 600;
    responder(200, ['ok' => true, 'authorizedUntil' => (int)$_SESSION['fiscal_edit_authorized_until']]);
}

if ($action === 'login') {
    iniciarSessaoSegura();
    limitarTentativas('login', 8, 900);
    $usuario = trim((string)($body['usuario'] ?? ''));
    $senha = (string)($body['senha'] ?? '');
    $turnstile = trim((string)($body['turnstileToken'] ?? ''));
    if (!validarTurnstile($turnstile, $cfg)) responder(422, ['ok' => false, 'error' => 'A verificação de segurança não foi validada.']);
    if (!hash_equals((string)$cfg['admin_user'], $usuario) || !validarSenhaAdmin($senha, $cfg)) {
        responder(401, ['ok' => false, 'error' => 'Usuário ou senha inválidos.']);
    }
    limparTentativas('login');
    $user = ['nome' => (string)$cfg['admin_name'], 'perfil' => 'Administrador', 'usuario' => (string)$cfg['admin_user']];
    $otpAtivo = !isset($cfg['email_otp_enabled']) || filter_var($cfg['email_otp_enabled'], FILTER_VALIDATE_BOOLEAN);
    if (!$otpAtivo) {
        session_regenerate_id(true);
        $_SESSION['auth_user'] = $user;
        unset($_SESSION['auth_pending'], $_SESSION['login_otp']);
        responder(200, ['ok' => true, 'requiresEmailCode' => false, 'authenticated' => true, 'emailCodeDisabled' => true, 'user' => $user]);
    }
    $confiavel = usuarioDispositivoConfiavel();
    if ($confiavel !== null && hash_equals($usuario, $confiavel)) {
        session_regenerate_id(true);
        $_SESSION['auth_user'] = $user;
        unset($_SESSION['auth_pending'], $_SESSION['login_otp']);
        responder(200, ['ok' => true, 'requiresEmailCode' => false, 'authenticated' => true, 'trustedDevice' => true, 'user' => $user]);
    }
    session_regenerate_id(true);
    $_SESSION['auth_pending'] = ['usuario' => $usuario, 'created_at' => time()];
    unset($_SESSION['auth_user']);
    gerarOtpSessao('login_otp', 'acesso', $cfg);
    responder(200, ['ok' => true, 'requiresEmailCode' => true, 'authenticated' => false]);
}

if ($action === 'email-resend') {
    iniciarSessaoSegura();
    $pendente = $_SESSION['auth_pending'] ?? null;
    if (!is_array($pendente) || time() - (int)($pendente['created_at'] ?? 0) > 600) responder(401, ['ok' => false, 'error' => 'A etapa de login expirou. Volte ao login.']);
    reenviarOtpSessao('login_otp', 'acesso', $cfg);
    responder(200, ['ok' => true]);
}

if ($action === 'email-code') {
    iniciarSessaoSegura();
    $pendente = $_SESSION['auth_pending'] ?? null;
    if (!is_array($pendente) || time() - (int)($pendente['created_at'] ?? 0) > 600) responder(401, ['ok' => false, 'error' => 'A etapa de login expirou.']);
    $codigo = preg_replace('/\D+/', '', (string)($body['codigo'] ?? '')) ?: '';
    if (!preg_match('/^\d{6}$/', $codigo) || !validarOtpSessao('login_otp', $codigo)) responder(401, ['ok' => false, 'error' => 'Código inválido ou expirado.']);
    $user = ['nome' => (string)$cfg['admin_name'], 'perfil' => 'Administrador', 'usuario' => (string)$cfg['admin_user']];
    session_regenerate_id(true);
    $_SESSION['auth_user'] = $user;
    unset($_SESSION['auth_pending'], $_SESSION['login_otp']);
    if (!empty($body['confiarDispositivo'])) criarDispositivoConfiavel($user['usuario']);
    responder(200, ['ok' => true, 'authenticated' => true, 'user' => $user]);
}

if ($action === 'forgot-start') {
    iniciarSessaoSegura();
    limitarTentativas('forgot-start', 5, 1800);
    $usuario = trim((string)($body['usuario'] ?? ''));
    if (!validarTurnstile(trim((string)($body['turnstileToken'] ?? '')), $cfg)) responder(422, ['ok' => false, 'error' => 'A verificação de segurança não foi validada.']);
    if (!hash_equals((string)$cfg['admin_user'], $usuario)) responder(200, ['ok' => true]);
    $_SESSION['reset_user'] = $usuario;
    gerarOtpSessao('reset_otp', 'recuperação de senha', $cfg);
    responder(200, ['ok' => true]);
}

if ($action === 'forgot-resend') {
    iniciarSessaoSegura();
    $usuario = (string)($_SESSION['reset_user'] ?? '');
    if ($usuario === '' || !hash_equals((string)$cfg['admin_user'], $usuario)) responder(401, ['ok' => false, 'error' => 'A recuperação de senha expirou. Volte e solicite um novo código.']);
    reenviarOtpSessao('reset_otp', 'recuperação de senha', $cfg);
    responder(200, ['ok' => true]);
}

if ($action === 'forgot-verify') {
    iniciarSessaoSegura();
    $codigo = preg_replace('/\D+/', '', (string)($body['codigo'] ?? '')) ?: '';
    if (!preg_match('/^\d{6}$/', $codigo) || !validarOtpSessao('reset_otp', $codigo)) responder(401, ['ok' => false, 'error' => 'Código inválido ou expirado.']);
    $_SESSION['reset_verified_at'] = time();
    responder(200, ['ok' => true]);
}

if ($action === 'forgot-reset') {
    iniciarSessaoSegura();
    if (time() - (int)($_SESSION['reset_verified_at'] ?? 0) > 600) responder(401, ['ok' => false, 'error' => 'A autorização para redefinir a senha expirou.']);
    $senha = (string)($body['senha'] ?? '');
    $confirmar = (string)($body['confirmar'] ?? '');
    if (strlen($senha) < 12) responder(422, ['ok' => false, 'error' => 'A senha precisa ter no mínimo 12 caracteres.']);
    if (!hash_equals($senha, $confirmar)) responder(422, ['ok' => false, 'error' => 'As senhas não conferem.']);
    $cfg['admin_password_php_hash'] = password_hash($senha, PASSWORD_DEFAULT);
    salvarConfigAuth($cfg);
    revogarTodosDispositivos((string)$cfg['admin_user']);
    unset($_SESSION['reset_user'], $_SESSION['reset_otp'], $_SESSION['reset_verified_at']);
    responder(200, ['ok' => true]);
}

if ($action === 'logout') {
    iniciarSessaoSegura();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 42000, 'path' => $params['path'] ?: '/', 'domain' => $params['domain'] ?? '', 'secure' => (bool)$params['secure'], 'httponly' => (bool)$params['httponly'], 'samesite' => $params['samesite'] ?? 'Strict']);
    }
    session_destroy();
    responder(200, ['ok' => true, 'trustedDevicePreserved' => true]);
}

responder(404, ['ok' => false, 'error' => 'Ação de autenticação inválida.']);
