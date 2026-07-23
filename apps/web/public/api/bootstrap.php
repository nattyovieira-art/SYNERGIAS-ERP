<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
if ((!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') || ((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function responder(int $status, array $payload): void { http_response_code($status); echo json_encode($payload, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit; }
set_exception_handler(function(Throwable $erro): void { error_log('[SYNERGIAS AUTH] '.$erro->getMessage()); responder(503,['ok'=>false,'error'=>'Não foi possível enviar o código de segurança. Verifique a configuração do e-mail e tente novamente.']); });
function iniciarSessaoSegura(): void { if(session_status()===PHP_SESSION_ACTIVE)return; $secure=(!empty($_SERVER['HTTPS'])&&strtolower((string)$_SERVER['HTTPS'])!=='off')||((string)($_SERVER['HTTP_X_FORWARDED_PROTO']??'')==='https'); session_name('SYNERGIAS_ERP_SESSID'); session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Strict']); session_start(); }
function caminhoConfigAuth(): string { $cands=[__DIR__.'/auth-config.php',dirname(__DIR__,2).'/.private/auth-config.php',rtrim((string)(getenv('HOME')?:''),'/\\').'/synergias_private/auth/config.php',dirname(__DIR__,2).'/synergias_private/auth/config.php',dirname((string)($_SERVER['DOCUMENT_ROOT']??__DIR__)).'/synergias_private/auth/config.php',dirname(__DIR__,3).'/synergias_private/auth/config.php']; foreach(array_unique($cands) as $p){$r=realpath($p); if($r!==false&&is_file($r)) return $r;} throw new RuntimeException('Configuração privada de autenticação não encontrada.'); }
function caminhoSegredoDanfe(): string { $path=dirname(caminhoConfigAuth()).'/danfe-internal.key'; if(!is_file($path)){ $segredo=random_bytes(32); if(file_put_contents($path,base64_encode($segredo),LOCK_EX)===false) throw new RuntimeException('Não foi possível criar o segredo privado da DANFE.'); @chmod($path,0600); return $segredo; } $segredo=base64_decode(trim((string)file_get_contents($path)),true); if(!is_string($segredo)||strlen($segredo)<32) throw new RuntimeException('Segredo privado da DANFE inválido.'); return $segredo; }
function assinarAcessoDanfe(string $chave): string { return hash_hmac('sha256',$chave,caminhoSegredoDanfe()); }
function carregarConfigAuth(): array { $c=require caminhoConfigAuth(); if(!is_array($c)) throw new RuntimeException('Configuração de autenticação inválida.'); return $c; }
function salvarConfigAuth(array $cfg): void { $p=caminhoConfigAuth(); $guard="<?php\nif (!defined('SYNERGIAS_AUTH_BOOTSTRAP')) {\n    http_response_code(404);\n    exit;\n}\nreturn ".var_export($cfg,true).";\n"; if(file_put_contents($p,$guard,LOCK_EX)===false) throw new RuntimeException('Não foi possível salvar a configuração de autenticação.'); }
function obterPdo(): PDO { static $pdo=null; if($pdo instanceof PDO)return $pdo; $config=require __DIR__.'/config.php'; $pdo=new PDO(sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4',$config['host'],$config['database']),$config['username'],$config['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]); $pdo->exec('CREATE TABLE IF NOT EXISTS erp_trusted_devices (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, usuario VARCHAR(120) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, last_used_at TIMESTAMP NULL DEFAULT NULL, INDEX idx_auth_expires (expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'); $pdo->exec('CREATE TABLE IF NOT EXISTS erp_rate_limits (chave_hash CHAR(64) NOT NULL PRIMARY KEY, tentativas INT UNSIGNED NOT NULL DEFAULT 0, janela_inicio DATETIME NOT NULL, bloqueado_ate DATETIME NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_rate_updated (updated_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'); return $pdo; }
function limitarTentativasSessao(string $escopo,int $limite,int $janelaSegundos): void { iniciarSessaoSegura(); $agora=time(); $chave='rate_limit_'.$escopo; $r=$_SESSION[$chave]??null; $inicio=is_array($r)?(int)($r['inicio']??0):0; $tentativas=($inicio>0&&$agora-$inicio<$janelaSegundos)?(int)($r['tentativas']??0)+1:1; $inicio=($inicio>0&&$agora-$inicio<$janelaSegundos)?$inicio:$agora; $bloqueadoAte=$tentativas>$limite?$agora+900:(int)($r['bloqueado_ate']??0); $_SESSION[$chave]=['tentativas'=>$tentativas,'inicio'=>$inicio,'bloqueado_ate'=>$bloqueadoAte]; if($bloqueadoAte>$agora)responder(429,['ok'=>false,'error'=>'Muitas tentativas. Aguarde alguns minutos e tente novamente.']); }
function limitarTentativas(string $escopo,int $limite=8,int $janelaSegundos=900): void { $ip=(string)($_SERVER['REMOTE_ADDR']??'desconhecido'); $chave=hash('sha256',$escopo.'|'.$ip); try { $pdo=obterPdo(); $pdo->prepare('DELETE FROM erp_rate_limits WHERE updated_at < DATE_SUB(NOW(),INTERVAL 2 DAY)')->execute(); $stmt=$pdo->prepare('SELECT tentativas,janela_inicio,bloqueado_ate FROM erp_rate_limits WHERE chave_hash=:chave LIMIT 1'); $stmt->execute(['chave'=>$chave]); $r=$stmt->fetch(); if(is_array($r)&&!empty($r['bloqueado_ate'])&&strtotime((string)$r['bloqueado_ate'])>time())responder(429,['ok'=>false,'error'=>'Muitas tentativas. Aguarde alguns minutos e tente novamente.']); $inicio=is_array($r)?strtotime((string)$r['janela_inicio']):false; $tentativas=($inicio!==false&&time()-$inicio<$janelaSegundos)?(int)$r['tentativas']+1:1; $bloqueio=$tentativas>$limite?(new DateTimeImmutable('+15 minutes'))->format('Y-m-d H:i:s'):null; $up=$pdo->prepare('INSERT INTO erp_rate_limits (chave_hash,tentativas,janela_inicio,bloqueado_ate) VALUES (:chave,:tentativas,NOW(),:bloqueio) ON DUPLICATE KEY UPDATE tentativas=:tentativas2,janela_inicio=IF(:reiniciar=1,NOW(),janela_inicio),bloqueado_ate=:bloqueio2'); $up->execute(['chave'=>$chave,'tentativas'=>$tentativas,'bloqueio'=>$bloqueio,'tentativas2'=>$tentativas,'reiniciar'=>($inicio===false||time()-$inicio>=$janelaSegundos)?1:0,'bloqueio2'=>$bloqueio]); if($bloqueio!==null)responder(429,['ok'=>false,'error'=>'Muitas tentativas. Aguarde alguns minutos e tente novamente.']); } catch(Throwable $erro) { error_log('[SYNERGIAS AUTH] Rate limit MySQL indisponível; usando sessão: '.$erro->getMessage()); limitarTentativasSessao($escopo,$limite,$janelaSegundos); } }
function limparTentativas(string $escopo): void { iniciarSessaoSegura(); unset($_SESSION['rate_limit_'.$escopo]); $ip=(string)($_SERVER['REMOTE_ADDR']??'desconhecido'); try{obterPdo()->prepare('DELETE FROM erp_rate_limits WHERE chave_hash=:chave')->execute(['chave'=>hash('sha256',$escopo.'|'.$ip)]);}catch(Throwable $e){} }
function validarSenhaAdmin(string $senha,array $cfg): bool { $phpHash=trim((string)($cfg['admin_password_php_hash']??'')); if($phpHash!=='') return password_verify($senha,$phpHash); $salt=base64_decode((string)($cfg['admin_password_salt']??''),true); $expected=strtolower(trim((string)($cfg['admin_password_hash']??''))); $iter=max(210000,(int)($cfg['admin_password_iterations']??310000)); if($salt===false||$expected==='')return false; $derived=hash_pbkdf2('sha256',$senha,$salt,$iter,64,false); return hash_equals($expected,strtolower($derived)); }
function validarTurnstile(string $token,array $cfg): bool { if($token==='')return false; $payload=http_build_query(['secret'=>(string)$cfg['turnstile_secret_key'],'response'=>$token,'remoteip'=>(string)($_SERVER['REMOTE_ADDR']??'')]); $ch=curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify'); curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$payload,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15,CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded']]); $raw=curl_exec($ch); $status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE); curl_close($ch); $data=is_string($raw)?json_decode($raw,true):null; return $status>=200&&$status<300&&is_array($data)&&($data['success']??false)===true; }
function smtpLer($s): string {$t=''; while(($l=fgets($s,8192))!==false){$t.=$l; if(strlen($l)<4||$l[3]===' ')break;} return $t;}
function smtpEsperar($s,array $codes,string $etapa='operação'): string {$r=smtpLer($s);$c=(int)substr($r,0,3);if(!in_array($c,$codes,true)){error_log('[SYNERGIAS SMTP] '.$etapa.' recusada: '.trim($r));throw new RuntimeException('Falha na comunicação com o servidor de e-mail.');}return $r;}
function smtpCmd($s,string $cmd,array $codes,string $etapa='comando'): string {fwrite($s,$cmd."\r\n");return smtpEsperar($s,$codes,$etapa);}
function enviarCodigoEmail(string $codigo,array $cfg,string $finalidade='acesso'): void {
    foreach(['smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','admin_email'] as $k){if(trim((string)($cfg[$k]??''))==='')throw new RuntimeException("Configuração SMTP incompleta: {$k}.");}
    $host=trim((string)$cfg['smtp_host']);
    $port=(int)$cfg['smtp_port'];
    $modo=strtolower(trim((string)($cfg['smtp_encryption']??'')));
    if(in_array($modo,['tls','start-tls'],true))$modo='starttls';
    if($modo===''){$modo=filter_var($cfg['smtp_secure']??false,FILTER_VALIDATE_BOOLEAN)?'ssl':(!empty($cfg['smtp_starttls'])?'starttls':'none');}
    if(!in_array($modo,['ssl','starttls','none'],true))$modo='ssl';
    $target=($modo==='ssl'?'ssl://':'tcp://').$host.':'.$port;
    $context=stream_context_create(['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'allow_self_signed'=>false,'peer_name'=>$host]]);
    $s=@stream_socket_client($target,$errno,$errstr,20,STREAM_CLIENT_CONNECT,$context);
    if(!$s){error_log("[SYNERGIAS SMTP] conexão falhou ({$errno}): {$errstr}");throw new RuntimeException('Não foi possível conectar ao servidor de e-mail.');}
    stream_set_timeout($s,30);
    smtpEsperar($s,[220],'conexão');
    smtpCmd($s,'EHLO erp.synergias.com.br',[250],'EHLO');
    if($modo==='starttls'){
        smtpCmd($s,'STARTTLS',[220],'STARTTLS');
        if(!stream_socket_enable_crypto($s,true,STREAM_CRYPTO_METHOD_TLS_CLIENT)){fclose($s);throw new RuntimeException('Falha ao ativar a conexão segura do e-mail.');}
        smtpCmd($s,'EHLO erp.synergias.com.br',[250],'EHLO após TLS');
    }
    smtpCmd($s,'AUTH LOGIN',[334],'autenticação');
    smtpCmd($s,base64_encode((string)$cfg['smtp_user']),[334],'usuário SMTP');
    smtpCmd($s,base64_encode((string)$cfg['smtp_pass']),[235],'senha SMTP');
    smtpCmd($s,'MAIL FROM:<'.(string)$cfg['smtp_from'].'>',[250],'remetente');
    smtpCmd($s,'RCPT TO:<'.(string)$cfg['admin_email'].'>',[250,251],'destinatário');
    smtpCmd($s,'DATA',[354],'conteúdo');
    $subject='Código de segurança - Synergias ERP';
    $texto="Seu código de {$finalidade} no Synergias ERP é: {$codigo}\r\n\r\nEste código expira em 10 minutos e só pode ser usado uma vez.";
    $headers=['From: '.((string)($cfg['smtp_from_name']??'SYNERGIAS DISTRIBUIDORA')).' <'.(string)$cfg['smtp_from'].'>','To: '.(string)$cfg['admin_email'],'Subject: =?UTF-8?B?'.base64_encode($subject).'?=','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','Date: '.date(DATE_RFC2822)];
    $msg=implode("\r\n",$headers)."\r\n\r\n".chunk_split(base64_encode($texto));
    fwrite($s,$msg."\r\n.\r\n");
    smtpEsperar($s,[250],'envio');
    smtpCmd($s,'QUIT',[221],'encerramento');
    fclose($s);
}
function gerarOtpSessao(string $chave,string $finalidade,array $cfg): void { iniciarSessaoSegura(); $codigo=str_pad((string)random_int(0,999999),6,'0',STR_PAD_LEFT); $_SESSION[$chave]=['hash'=>hash('sha256',$codigo),'expires'=>time()+600,'attempts'=>0,'verified'=>false,'sent_at'=>time()]; enviarCodigoEmail($codigo,$cfg,$finalidade); }
function reenviarOtpSessao(string $chave,string $finalidade,array $cfg): void { iniciarSessaoSegura(); $atual=$_SESSION[$chave]??null; if(is_array($atual)){ $restante=60-(time()-(int)($atual['sent_at']??0)); if($restante>0)responder(429,['ok'=>false,'error'=>'Aguarde '.$restante.' segundos para reenviar o código.']); } gerarOtpSessao($chave,$finalidade,$cfg); }
function validarOtpSessao(string $chave,string $codigo): bool { iniciarSessaoSegura(); $d=$_SESSION[$chave]??null; if(!is_array($d)||time()>(int)($d['expires']??0)||($d['attempts']??0)>=6)return false; $_SESSION[$chave]['attempts']=(int)($d['attempts']??0)+1; if(!hash_equals((string)$d['hash'],hash('sha256',$codigo)))return false; $_SESSION[$chave]['verified']=true; return true; }
function usuarioAutenticado(): ?array { iniciarSessaoSegura(); $u=$_SESSION['auth_user']??null; return is_array($u)?$u:null; }
function exigirMesmaOrigem(): void { $metodo=strtoupper((string)($_SERVER['REQUEST_METHOD']??'GET')); if(in_array($metodo,['GET','HEAD','OPTIONS'],true))return; $site=strtolower(trim((string)($_SERVER['HTTP_SEC_FETCH_SITE']??''))); if($site!==''&&!in_array($site,['same-origin','same-site','none'],true))responder(403,['ok'=>false,'error'=>'Origem da requisição não autorizada.']); $origin=trim((string)($_SERVER['HTTP_ORIGIN']??'')); if($origin==='')return; $host=strtolower(preg_replace('/:\d+$/','',(string)($_SERVER['HTTP_HOST']??''))??''); $originHost=strtolower((string)(parse_url($origin,PHP_URL_HOST)??'')); if($host===''||$originHost===''||!hash_equals($host,$originHost))responder(403,['ok'=>false,'error'=>'Origem da requisição não autorizada.']); }
function exigirAutenticacao(): array { iniciarSessaoSegura(); $u=usuarioAutenticado(); if($u===null)responder(401,['ok'=>false,'error'=>'Sessão não autenticada.']); exigirMesmaOrigem(); return $u; }
function base64UrlEncode(string $valor): string {return rtrim(strtr(base64_encode($valor),'+/','-_'),'=');}
function base64UrlDecode(string $valor) {$resto=strlen($valor)%4;if($resto!==0)$valor.=str_repeat('=',4-$resto);return base64_decode(strtr($valor,'-_','+/'),true);}
function cookieSeguro(): bool {return (!empty($_SERVER['HTTPS'])&&strtolower((string)$_SERVER['HTTPS'])!=='off')||((string)($_SERVER['HTTP_X_FORWARDED_PROTO']??'')==='https');}
function revogarCookieDispositivoConfiavel(): void {setcookie('SYNERGIAS_TRUST','',['expires'=>time()-3600,'path'=>'/','secure'=>cookieSeguro(),'httponly'=>true,'samesite'=>'Lax']);}
function criarDispositivoConfiavel(string $usuario): void {
    $cfg=carregarConfigAuth();
    if(!hash_equals((string)$cfg['admin_user'],$usuario))throw new RuntimeException('Usuário inválido para dispositivo confiável.');
    $pdo=obterPdo();
    $token=bin2hex(random_bytes(32));
    $hash=hash('sha256',$token);
    $expira=(new DateTimeImmutable('+30 days'))->format('Y-m-d H:i:s');
    $pdo->prepare('DELETE FROM erp_trusted_devices WHERE expires_at < NOW()')->execute();
    $stmt=$pdo->prepare('INSERT INTO erp_trusted_devices (usuario,token_hash,expires_at,last_used_at) VALUES (:usuario,:hash,:expira,NOW())');
    $stmt->execute(['usuario'=>$usuario,'hash'=>$hash,'expira'=>$expira]);
    setcookie('SYNERGIAS_TRUST',$token,['expires'=>time()+2592000,'path'=>'/','secure'=>cookieSeguro(),'httponly'=>true,'samesite'=>'Lax']);
}
function usuarioDispositivoConfiavel(): ?string {
    $token=trim((string)($_COOKIE['SYNERGIAS_TRUST']??''));
    if($token===''||!preg_match('/^[a-f0-9]{64}$/',$token)){if($token!=='')revogarCookieDispositivoConfiavel();return null;}
    try {
        $pdo=obterPdo();
        $hash=hash('sha256',$token);
        $stmt=$pdo->prepare('SELECT id,usuario FROM erp_trusted_devices WHERE token_hash=:hash AND expires_at>NOW() LIMIT 1');
        $stmt->execute(['hash'=>$hash]);
        $registro=$stmt->fetch();
        $cfg=carregarConfigAuth();
        if(!is_array($registro)||!hash_equals((string)$cfg['admin_user'],(string)$registro['usuario'])){revogarCookieDispositivoConfiavel();return null;}
        $pdo->prepare('UPDATE erp_trusted_devices SET last_used_at=NOW() WHERE id=:id')->execute(['id'=>$registro['id']]);
        return (string)$registro['usuario'];
    } catch(Throwable $e) {
        error_log('[Synergias ERP] Falha ao validar dispositivo confiável: '.$e->getMessage());
        return null;
    }
}
function restaurarDispositivoConfiavel(): void {
    // Compatibilidade: dispositivo confiável não abre sessão sozinho.
    // Ele serve apenas para dispensar o código por e-mail após usuário e senha válidos.
}
function revogarDispositivoAtual(): void {
    $token=trim((string)($_COOKIE['SYNERGIAS_TRUST']??''));
    if($token!==''&&preg_match('/^[a-f0-9]{64}$/',$token)){
        try {obterPdo()->prepare('DELETE FROM erp_trusted_devices WHERE token_hash=:hash')->execute(['hash'=>hash('sha256',$token)]);} catch(Throwable $e) {}
    }
    revogarCookieDispositivoConfiavel();
}
function revogarTodosDispositivos(string $usuario): void {
    try {obterPdo()->prepare('DELETE FROM erp_trusted_devices WHERE usuario=:usuario')->execute(['usuario'=>$usuario]);} catch(Throwable $e) {}
    revogarCookieDispositivoConfiavel();
}
set_exception_handler(function(Throwable $erro): void { error_log('[SYNERGIAS AUTH] '.$erro->getMessage()); responder(503,['ok'=>false,'error'=>'Não foi possível concluir a autenticação. Se o código por e-mail estiver ativo, verifique a configuração do SMTP e tente novamente.']); });
