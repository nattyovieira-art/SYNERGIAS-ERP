<?php
/* SYNERGIAS_EMAIL_NFE_XML_VERSION = V310_MULTIPLOS_BOLETOS_PIX_TRANSFERENCIA */
declare(strict_types=1);

define('SYNERGIAS_AUTH_BOOTSTRAP', true);
require __DIR__ . '/bootstrap.php';
exigirAutenticacao();

const EMAIL_REQUEST_MAX_BYTES = 15728640;
const EMAIL_MAX_RECIPIENTS = 10;
const EMAIL_MAX_ATTACHMENTS = 6;
const EMAIL_MAX_ATTACHMENT_BYTES = 8388608;
const EMAIL_MAX_SENDS_PER_HOUR = 30;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Synergias-Email-Version: V310');
header('Cache-Control: no-store');

function resposta(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function lerCorpo(): array {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '{}', true);
    if (!is_array($body)) resposta(422, ['ok' => false, 'message' => 'Corpo JSON inválido.']);
    return $body;
}

function texto(mixed $valor): string { return trim((string)$valor); }

function configEmail(): array {
    $localProtegido = __DIR__ . '/email-config.php';
    if (is_file($localProtegido)) {
        $config = require $localProtegido;
        if (!is_array($config)) throw new RuntimeException('Configuração protegida de e-mail inválida.');
    } else {
        $central = carregarConfigAuth();
        $config = [
            'host' => $central['smtp_host'] ?? '',
            'port' => $central['smtp_port'] ?? 587,
            'user' => $central['smtp_user'] ?? '',
            'pass' => $central['smtp_pass'] ?? '',
            'from' => $central['smtp_from'] ?? '',
            'from_name' => $central['smtp_from_name'] ?? 'Synergias ERP',
            'encryption' => $central['smtp_encryption'] ?? 'starttls',
        ];
    }

    foreach (['host','port','user','pass','from'] as $campo) {
        if (!array_key_exists($campo, $config) || texto($config[$campo]) === '') {
            throw new RuntimeException("Configuração SMTP incompleta: {$campo}.");
        }
    }
    return $config;
}

function emailSmtpLer($socket): string {
    $texto = '';
    while (($linha = fgets($socket, 8192)) !== false) {
        $texto .= $linha;
        if (strlen($linha) < 4 || $linha[3] === ' ') break;
    }
    return $texto;
}

function emailSmtpEsperar($socket, array $codigos): string {
    $resposta = emailSmtpLer($socket);
    $codigo = (int)substr($resposta, 0, 3);
    if (!in_array($codigo, $codigos, true)) {
        throw new RuntimeException('Servidor SMTP recusou a operação: ' . trim($resposta));
    }
    return $resposta;
}

function emailSmtpComando($socket, string $comando, array $codigos): string {
    fwrite($socket, $comando . "\r\n");
    return emailSmtpEsperar($socket, $codigos);
}

function normalizarEmails(mixed $valor): array {
    $lista = is_array($valor) ? $valor : preg_split('/[;,\n]+/', (string)$valor);
    $saida = [];
    foreach ($lista ?: [] as $email) {
        $email = strtolower(texto($email));
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) $saida[$email] = true;
    }
    return array_keys($saida);
}

function limparBase64(string $valor): string {
    $valor = trim($valor);
    if (str_contains($valor, ',')) $valor = substr($valor, strpos($valor, ',') + 1);
    return preg_replace('/\s+/', '', $valor) ?: '';
}

function origemPublica(): string {
    $https = strtolower((string)($_SERVER['HTTPS'] ?? ''));
    $forwarded = strtolower(trim(explode(',', (string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0] ?? ''));
    $cfVisitor = strtolower((string)($_SERVER['HTTP_CF_VISITOR'] ?? ''));

    $seguro = ($https !== '' && $https !== 'off')
        || $forwarded === 'https'
        || str_contains($cfVisitor, '"scheme":"https"');

    $host = texto($_SERVER['HTTP_HOST'] ?? '');
    return $host !== '' ? ($seguro ? 'https' : 'http') . '://' . $host : '';
}

function baixarUrlSegura(string $url): string {
    $url = texto($url);
    if ($url === '') return '';
    if (str_starts_with($url, '/')) {
        $origem = origemPublica();
        if ($origem === '') return '';
        $url = $origem . $url;
    }
    if (!preg_match('#^https://#i', $url)) return '';

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 40,
            CURLOPT_USERAGENT => 'SynergiasERP/151I',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => array_values(array_filter([
                'Accept: application/pdf,application/octet-stream;q=0.9,*/*;q=0.5',
                (parse_url($url, PHP_URL_HOST) === texto($_SERVER['HTTP_HOST'] ?? '') && texto($_SERVER['HTTP_COOKIE'] ?? '') !== '')
                    ? 'Cookie: ' . texto($_SERVER['HTTP_COOKIE'])
                    : null,
            ])),
        ]);
        $conteudo = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $tipo = strtolower((string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE));
        curl_close($ch);
        if (!is_string($conteudo) || $conteudo === '' || $status < 200 || $status >= 300) return '';
        if (!str_starts_with($conteudo, '%PDF-') && !str_contains($tipo, 'pdf')) return '';
        return $conteudo;
    }

    $ctx = stream_context_create(['http' => [
        'timeout' => 40,
        'follow_location' => 1,
        'max_redirects' => 5,
        'header' => "User-Agent: SynergiasERP/151I\r\nAccept: application/pdf,application/octet-stream;q=0.9,*/*;q=0.5\r\n",
    ]]);
    $conteudo = @file_get_contents($url, false, $ctx);
    return is_string($conteudo) && str_starts_with($conteudo, '%PDF-') ? $conteudo : '';
}

function montarMensagem(array $body, array $config, array $para, array $cc): string {
    $boundary = 'SYA_' . bin2hex(random_bytes(12));
    $assunto = texto($body['assunto'] ?? 'Documentos Synergias');
    $html = texto($body['html'] ?? '');
    $textoPlano = texto($body['texto'] ?? '');
    $from = texto($config['from']);
    $fromName = texto($config['from_name'] ?? 'SYNERGIAS DISTRIBUIDORA');

    $headers = [
        'From: ' . $fromName . ' <' . $from . '>',
        'To: ' . implode(', ', $para),
        'Subject: =?UTF-8?B?' . base64_encode($assunto) . '?=',
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
        'Date: ' . date(DATE_RFC2822),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@synergias.com.br>',
    ];
    if ($cc !== []) $headers[] = 'Cc: ' . implode(', ', $cc);

    $partes = [];
    $partes[] = '--' . $boundary . "\r\n" .
        'Content-Type: multipart/alternative; boundary="' . $boundary . '_ALT"' . "\r\n\r\n" .
        '--' . $boundary . "_ALT\r\n" .
        "Content-Type: text/plain; charset=UTF-8\r\n" .
        "Content-Transfer-Encoding: base64\r\n\r\n" .
        chunk_split(base64_encode($textoPlano)) .
        '--' . $boundary . "_ALT\r\n" .
        "Content-Type: text/html; charset=UTF-8\r\n" .
        "Content-Transfer-Encoding: base64\r\n\r\n" .
        chunk_split(base64_encode($html !== '' ? $html : nl2br(htmlspecialchars($textoPlano)))) .
        '--' . $boundary . "_ALT--\r\n";

    $logo = is_array($body['logo'] ?? null) ? $body['logo'] : [];
    $logoCid = texto($logo['cid'] ?? '');
    $logoPublico = texto($logo['caminhoPublico'] ?? '');
    if ($logoCid !== '' && $logoPublico !== '') {
        $logoPath = '';
        if (str_starts_with($logoPublico, '/')) {
            $documentRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
            if ($documentRoot !== '') $logoPath = $documentRoot . $logoPublico;
        } elseif (preg_match('#^[A-Za-z]:\\\\#', $logoPublico) || str_starts_with($logoPublico, DIRECTORY_SEPARATOR)) {
            $logoPath = $logoPublico;
        }
        if ($logoPath !== '' && is_file($logoPath)) {
            $logoBin = @file_get_contents($logoPath);
            if (is_string($logoBin) && $logoBin !== '') {
                $logoMime = function_exists('mime_content_type') ? (mime_content_type($logoPath) ?: 'image/png') : 'image/png';
                $logoNome = preg_replace('/[^A-Za-z0-9._-]+/', '_', basename($logoPath)) ?: 'logo.png';
                $partes[] = '--' . $boundary . "\r\n" .
                    'Content-Type: ' . $logoMime . '; name="' . $logoNome . '"' . "\r\n" .
                    "Content-Transfer-Encoding: base64\r\n" .
                    'Content-ID: <' . $logoCid . '>' . "\r\n" .
                    'Content-Disposition: inline; filename="' . $logoNome . '"' . "\r\n\r\n" .
                    chunk_split(base64_encode($logoBin));
            }
        }
    }

    $anexados = [];
    $anexos = is_array($body['anexos'] ?? null) ? array_slice($body['anexos'], 0, EMAIL_MAX_ATTACHMENTS) : [];
    foreach ($anexos as $anexo) {
        if (!is_array($anexo)) continue;
        $tipo = texto($anexo['tipo'] ?? '');
        if (!in_array($tipo, ['notaFiscal', 'boleto'], true)) continue;
        $nome = preg_replace('/[^A-Za-z0-9._-]+/', '_', texto($anexo['nomeArquivo'] ?? 'documento.pdf')) ?: 'documento.pdf';
        $conteudoInformado = texto($anexo['conteudoBase64'] ?? '');
        $base64 = preg_match('#^(https?:)?//#i', $conteudoInformado) || str_starts_with($conteudoInformado, '/')
            ? ''
            : limparBase64($conteudoInformado);
        $binario = $base64 !== '' ? base64_decode($base64, true) : false;
        if (!is_string($binario) || !str_starts_with($binario, '%PDF-')) {
            $url = texto($anexo['url'] ?? '');
            if ($url === '' && $tipo === 'notaFiscal' && !empty($anexo['gerarNoBackend'])) {
                $pedido = is_array($body['pedido'] ?? null) ? $body['pedido'] : [];
                $chavePedido = preg_replace('/\D+/', '', texto(
                    $pedido['chaveAcessoNotaFiscal'] ?? $pedido['chaveAcesso'] ?? $body['chaveAcessoNotaFiscal'] ?? ''
                )) ?: '';
                if (preg_match('/^\d{44}$/', $chavePedido)) {
                    $assinaturaInterna = assinarAcessoDanfe($chavePedido);
                    $url = '/api/fiscal/nfe-danfe-pdf.php?chave='
                        . rawurlencode($chavePedido)
                        . '&layout=V231D&internal='
                        . rawurlencode($assinaturaInterna);
                }
            }
            if ($url === '' && (str_starts_with($conteudoInformado, '/') || preg_match('#^https://#i', $conteudoInformado))) {
                $url = $conteudoInformado;
            }
            $binario = baixarUrlSegura($url);
        }
        if (!is_string($binario) || !str_starts_with($binario, '%PDF-')) continue;
        if (strlen($binario) > EMAIL_MAX_ATTACHMENT_BYTES) {
            throw new RuntimeException('Um dos anexos excede o limite permitido.');
        }
        $partes[] = '--' . $boundary . "\r\nContent-Type: application/pdf; name=\"{$nome}\"\r\nContent-Disposition: attachment; filename=\"{$nome}\"\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($binario));
        $anexados[$tipo] = (int)($anexados[$tipo] ?? 0) + 1;
    }

    /*
     * V170: anexa automaticamente o XML autorizado/processado da NF-e.
     * O arquivo é o procNFe salvo após a autorização da SEFAZ.
     */
    $pedidoXml = is_array($body['pedido'] ?? null) ? $body['pedido'] : [];
    $chaveXml = preg_replace('/\D+/', '', texto(
        $pedidoXml['chaveAcessoNotaFiscal']
        ?? $pedidoXml['chaveAcesso']
        ?? $body['chaveAcessoNotaFiscal']
        ?? $body['chaveAcesso']
        ?? ''
    )) ?: '';

    $xmlAutorizado = '';
    if (preg_match('/^\d{44}$/', $chaveXml)) {
        $homeXml = rtrim((string)(getenv('HOME') ?: ''), '/\\');
        if ($homeXml === '' || !is_dir($homeXml)) {
            $homeXml = dirname(rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\'));
        }

        $arquivoXmlAutorizado = $homeXml . '/synergias_private/fiscal-nfe/' . $chaveXml . '-procNFe.xml';
        if (is_file($arquivoXmlAutorizado)) {
            $conteudoPrivado = @file_get_contents($arquivoXmlAutorizado);
            if (is_string($conteudoPrivado)) $xmlAutorizado = trim($conteudoPrivado);
        }
    }

    // NF-es importadas ou vinculadas manualmente guardam o procNFe no pedido.
    if ($xmlAutorizado === '') {
        $xmlPedido = trim(texto(
            $pedidoXml['xmlNotaFiscal']
            ?? $pedidoXml['xmlNfe']
            ?? $body['xmlNotaFiscal']
            ?? ''
        ));
        if ($xmlPedido === '' && is_array($pedidoXml['historicoNotaFiscal'] ?? null)) {
            foreach (array_reverse($pedidoXml['historicoNotaFiscal']) as $eventoFiscal) {
                if (!is_array($eventoFiscal)) continue;
                $xmlHistorico = trim(texto($eventoFiscal['xml'] ?? $eventoFiscal['xmlNotaFiscal'] ?? ''));
                if ($xmlHistorico !== '') {
                    $xmlPedido = $xmlHistorico;
                    break;
                }
            }
        }
        if ($xmlPedido !== '' && !str_starts_with($xmlPedido, '<')) {
            $xmlPedido = preg_replace('#^data:[^,]+,#i', '', $xmlPedido) ?? '';
            $decodificado = base64_decode(preg_replace('/\s+/', '', $xmlPedido) ?? '', true);
            $xmlPedido = is_string($decodificado) ? trim($decodificado) : '';
        }
        $xmlAutorizado = $xmlPedido;
    }

    // Ultima fonte: registro central do pedido importado no MySQL.
    if ($xmlAutorizado === '') {
        try {
            $pdoEmail = obterPdo();
            $consultaVendas = $pdoEmail->prepare("SELECT payload FROM erp_storage WHERE collection='vendas' LIMIT 1");
            $consultaVendas->execute();
            $payloadVendas = $consultaVendas->fetchColumn();
            $vendasCentrais = is_string($payloadVendas) ? json_decode($payloadVendas, true) : null;
            $idPedido = texto($pedidoXml['id'] ?? $body['pedidoId'] ?? '');
            $numeroPedido = preg_replace('/\D+/', '', texto(
                $pedidoXml['numeroPedido'] ?? $body['numeroPedido'] ?? ''
            )) ?: '';
            if (is_array($vendasCentrais)) {
                foreach ($vendasCentrais as $vendaCentral) {
                    if (!is_array($vendaCentral)) continue;
                    $idCentral = texto($vendaCentral['id'] ?? '');
                    $numeroCentral = preg_replace('/\D+/', '', texto($vendaCentral['numeroPedido'] ?? '')) ?: '';
                    $chaveCentral = preg_replace('/\D+/', '', texto(
                        $vendaCentral['chaveAcessoNotaFiscal'] ?? $vendaCentral['chaveAcesso'] ?? ''
                    )) ?: '';
                    $mesmoPedido = ($idPedido !== '' && hash_equals($idPedido, $idCentral))
                        || ($numeroPedido !== '' && hash_equals($numeroPedido, $numeroCentral))
                        || ($chaveXml !== '' && hash_equals($chaveXml, $chaveCentral));
                    if (!$mesmoPedido) continue;
                    $xmlCentral = trim(texto($vendaCentral['xmlNotaFiscal'] ?? $vendaCentral['xmlNfe'] ?? ''));
                    if ($xmlCentral === '' && is_array($vendaCentral['historicoNotaFiscal'] ?? null)) {
                        foreach (array_reverse($vendaCentral['historicoNotaFiscal']) as $eventoCentral) {
                            if (!is_array($eventoCentral)) continue;
                            $xmlCentral = trim(texto($eventoCentral['xml'] ?? $eventoCentral['xmlNotaFiscal'] ?? ''));
                            if ($xmlCentral !== '') break;
                        }
                    }
                    if ($xmlCentral !== '') {
                        $xmlAutorizado = $xmlCentral;
                        break;
                    }
                }
            }
        } catch (Throwable $erroXmlCentral) {
            error_log('[SYNERGIAS EMAIL XML MYSQL] ' . $erroXmlCentral->getMessage());
        }
    }

    if ($xmlAutorizado !== '' && !str_starts_with($xmlAutorizado, '<')) {
        $xmlAutorizado = preg_replace('#^data:[^,]+,#i', '', $xmlAutorizado) ?? '';
        $xmlDecodificado = base64_decode(preg_replace('/\s+/', '', $xmlAutorizado) ?? '', true);
        $xmlAutorizado = is_string($xmlDecodificado) ? trim($xmlDecodificado) : '';
    }

    if ($xmlAutorizado !== '' && str_contains($xmlAutorizado, '<nfeProc')) {
        $chaveConteudo = '';
        if (preg_match('/<chNFe>(\d{44})<\/chNFe>/i', $xmlAutorizado, $matchChave)) {
            $chaveConteudo = $matchChave[1];
        } elseif (preg_match('/Id=["\']NFe(\d{44})["\']/i', $xmlAutorizado, $matchChave)) {
            $chaveConteudo = $matchChave[1];
        }
        if ($chaveConteudo !== '' && ($chaveXml === '' || hash_equals($chaveXml, $chaveConteudo))) {
            $nomeXml = 'NFe_' . $chaveConteudo . '.xml';
            $partes[] = '--' . $boundary . "\r\n" .
                'Content-Type: application/xml; charset=UTF-8; name="' . $nomeXml . '"' . "\r\n" .
                'Content-Disposition: attachment; filename="' . $nomeXml . '"' . "\r\n" .
                "Content-Transfer-Encoding: base64\r\n\r\n" .
                chunk_split(base64_encode($xmlAutorizado));
            $anexados['xmlNotaFiscal'] = 1;
        }
    }

    /*
     * SYNERGIAS_EMAIL_BOLETO_OPCIONAL_V229
     * O boleto é opcional. A ausência dele nunca bloqueia o envio da NF-e.
     * DANFE e XML continuam obrigatórios para manter o envio fiscal completo.
     */
    $faltantes = [];
    if (empty($anexados['notaFiscal'])) $faltantes[] = 'PDF da Nota Fiscal';
    if (empty($anexados['xmlNotaFiscal'])) $faltantes[] = 'XML autorizado da Nota Fiscal';

    $exigirBoleto = !empty($body['exigirBoletoAnexo']);
    $quantidadeBoletosEsperada = max(0, (int)($body['quantidadeBoletosEsperada'] ?? 0));
    $quantidadeBoletosAnexada = (int)($anexados['boleto'] ?? 0);
    if ($exigirBoleto && $quantidadeBoletosEsperada < 1) {
        $faltantes[] = 'quantidade válida de boletos';
    } elseif ($exigirBoleto && $quantidadeBoletosAnexada !== $quantidadeBoletosEsperada) {
        $faltantes[] = "todos os boletos ({$quantidadeBoletosAnexada}/{$quantidadeBoletosEsperada} anexados)";
    }
    if (!$exigirBoleto && $quantidadeBoletosAnexada > 0) {
        throw new RuntimeException('O envio por PIX ou transferência não pode conter boleto anexado.');
    }

    if ($faltantes !== []) {
        throw new RuntimeException(
            'Não foi possível anexar: ' . implode(' e ', $faltantes) .
            '. Confirme se a NF-e está autorizada e se o DANFE e o XML estão disponíveis no pedido.'
        );
    }

    $partes[] = '--' . $boundary . '--';
    return implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $partes);
}

try {
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') resposta(405, ['ok' => false, 'message' => 'Método não permitido.']);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > EMAIL_REQUEST_MAX_BYTES) resposta(413, ['ok' => false, 'message' => 'Solicitação de e-mail excede o limite permitido.']);
    iniciarSessaoSegura();
    $agora = time();
    $enviosRecentes = array_values(array_filter((array)($_SESSION['email_send_times'] ?? []), static fn($timestamp): bool => is_int($timestamp) && $timestamp > $agora - 3600));
    if (count($enviosRecentes) >= EMAIL_MAX_SENDS_PER_HOUR) resposta(429, ['ok' => false, 'message' => 'Limite temporário de envios atingido. Tente novamente mais tarde.']);
    if ($enviosRecentes !== [] && end($enviosRecentes) > $agora - 5) resposta(429, ['ok' => false, 'message' => 'Aguarde alguns segundos antes de enviar outro e-mail.']);
    $enviosRecentes[] = $agora;
    $_SESSION['email_send_times'] = $enviosRecentes;
    $body = lerCorpo();
    $config = configEmail();
    $para = normalizarEmails($body['destinatario'] ?? $body['emailCliente'] ?? '');
    $cc = normalizarEmails($body['cc'] ?? $body['copia'] ?? []);
    if ($para === []) resposta(422, ['ok' => false, 'message' => 'E-mail principal do cliente inválido.']);
    if (count(array_unique(array_merge($para, $cc))) > EMAIL_MAX_RECIPIENTS) resposta(422, ['ok' => false, 'message' => 'Quantidade de destinatários excede o limite permitido.']);

    $host = texto($config['host']);
    $port = (int)$config['port'];
    $contexto = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'peer_name' => $host,
            'SNI_enabled' => true,
        ],
    ]);

    $socket = @stream_socket_client(
        'tcp://' . $host . ':' . $port,
        $errno,
        $errstr,
        20,
        STREAM_CLIENT_CONNECT,
        $contexto
    );
    if (!$socket) {
        throw new RuntimeException("Conexão SMTP {$host}:{$port} falhou ({$errno}): {$errstr}");
    }

    stream_set_timeout($socket, 30);
    emailSmtpEsperar($socket, [220]);
    emailSmtpComando($socket, 'EHLO erp.synergias.com.br', [250]);
    emailSmtpComando($socket, 'STARTTLS', [220]);

    if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
        fclose($socket);
        throw new RuntimeException('Falha ao ativar STARTTLS na porta 587.');
    }

    emailSmtpComando($socket, 'EHLO erp.synergias.com.br', [250]);

    $usuario = texto($config['user']);
    $senha = (string)$config['pass'];

    try {
        $payload = base64_encode("\0" . $usuario . "\0" . $senha);
        emailSmtpComando($socket, 'AUTH PLAIN ' . $payload, [235]);
    } catch (Throwable $erroPlain) {
        emailSmtpComando($socket, 'AUTH LOGIN', [334]);
        emailSmtpComando($socket, base64_encode($usuario), [334]);
        emailSmtpComando($socket, base64_encode($senha), [235]);
    }
    emailSmtpComando($socket, 'MAIL FROM:<' . texto($config['from']) . '>', [250]);
    foreach (array_merge($para, $cc) as $email) emailSmtpComando($socket, 'RCPT TO:<' . $email . '>', [250, 251]);
    emailSmtpComando($socket, 'DATA', [354]);
    $mensagem = montarMensagem($body, $config, $para, $cc);
    $mensagem = preg_replace('/(?m)^\./', '..', $mensagem) ?: $mensagem;
    fwrite($socket, $mensagem . "\r\n.\r\n");
    emailSmtpEsperar($socket, [250]);
    emailSmtpComando($socket, 'QUIT', [221]);
    fclose($socket);

    resposta(200, ['ok' => true, 'message' => 'E-mail enviado pelo servidor do Synergias.', 'destinatarios' => $para, 'cc' => $cc]);
} catch (Throwable $erro) {
    $id = bin2hex(random_bytes(6));
    error_log('[Synergias ERP Email][' . $id . '] ' . $erro->getMessage());
    resposta(500, ['ok' => false, 'message' => 'Falha ao enviar o e-mail. Informe o código ' . $id . ' ao suporte.']);
}
