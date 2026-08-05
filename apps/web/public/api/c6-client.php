<?php
declare(strict_types=1);

require_once __DIR__ . '/c6-config.php';

final class C6ApiException extends RuntimeException
{
    public function __construct(string $message, public readonly int $httpStatus = 500, public readonly mixed $payload = null)
    {
        parent::__construct($message);
    }
}

final class C6ApiClient
{
    private array $config;
    private ?string $token = null;

    public function __construct() { $this->config = carregarConfigC6(); }

    public function diagnostico(): array
    {
        $cert = @openssl_x509_parse((string)@file_get_contents((string)$this->config['cert_path']));
        return [
            'configured' => true,
            'environment' => $this->config['environment'],
            'certificate' => is_file($this->config['cert_path']),
            'privateKey' => is_file($this->config['key_path']),
            'certificateExpiresAt' => is_array($cert) ? gmdate('c', (int)($cert['validTo_time_t'] ?? 0)) : '',
            'clientIdConfigured' => trim((string)$this->config['client_id']) !== '',
            'clientSecretConfigured' => trim((string)$this->config['client_secret']) !== '',
            'billingScheme' => (int)$this->config['billing_scheme'],
        ];
    }

    public function testarToken(): array
    {
        return ['ok' => $this->obterToken() !== '', 'tokenReceived' => true];
    }

    public function emitir(array $payload): array { return $this->json('POST', '', $payload); }
    public function consultar(string $id): array { return $this->json('GET', '/' . rawurlencode($this->id($id))); }
    public function alterar(string $id, array $payload): array { return $this->json('PUT', '/' . rawurlencode($this->id($id)), $payload); }
    public function cancelar(string $id): array
    {
        $idValidado = $this->id($id);
        try {
            $this->raw('PUT', '/' . rawurlencode($idValidado) . '/cancel');
        } catch (C6ApiException $e) {
            $detalhe = strtolower(json_encode($e->payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');
            $cancelamentoJaSolicitado = str_contains($detalhe, 'requisi')
                && str_contains($detalhe, 'cip')
                && str_contains($detalhe, 'aprova');
            $jaCancelado = str_contains($detalhe, 'cancelled') || str_contains($detalhe, 'canceled');
            if (!$cancelamentoJaSolicitado && !$jaCancelado) throw $e;
        }
        // O cancelamento e processado de forma assincrona pela CIP. Consultar
        // imediatamente pode retornar 400 enquanto a solicitacao esta pendente.
        return ['id' => $idValidado, 'status' => 'CANCELLED'];
    }
    public function pdf(string $id): array
    {
        $res = $this->raw('GET', '/' . rawurlencode($this->id($id)) . '/pdf');
        $body = (string)$res['body'];
        if (!str_starts_with($body, '%PDF')) throw new C6ApiException('O C6 não retornou um PDF válido.', 502);
        return ['pdfBase64' => base64_encode($body), 'mimeType' => 'application/pdf'];
    }
    public function cadastrarWebhook(string $url): array
    {
        $base = (string)preg_replace('#/v1/bank_slips/?$#', '', (string)$this->config['base_url']);
        $res = $this->rawUrl('POST', $base . '/v1/webhooks/', ['url' => $url, 'service' => 'BANK_SLIP']);
        $json = json_decode((string)$res['body'], true);
        return ['status' => (int)$res['status'], 'response' => is_array($json) ? $json : (string)$res['body']];
    }

    private function id(string $id): string
    {
        $id = trim($id);
        if ($id === '' || !preg_match('/^[A-Za-z0-9_-]{1,100}$/', $id)) throw new C6ApiException('Identificador C6 inválido.', 422);
        return $id;
    }

    private function obterToken(): string
    {
        if ($this->token !== null) return $this->token;
        $clientId = trim((string)$this->config['client_id']);
        $secret = trim((string)$this->config['client_secret']);
        if ($clientId === '' || $secret === '') throw new C6ApiException('Client ID ou Client Secret do C6 não configurado.', 422);

        $cachePath = dirname((string)$this->config['cert_path']) . '/token-cache.json';
        $cache = is_file($cachePath) ? json_decode((string)@file_get_contents($cachePath), true) : null;
        if (is_array($cache)
            && hash_equals((string)($cache['clientHash'] ?? ''), hash('sha256', $clientId))
            && (int)($cache['expiresAt'] ?? 0) > time() + 30
            && trim((string)($cache['accessToken'] ?? '')) !== '') {
            return $this->token = trim((string)$cache['accessToken']);
        }

        $body = http_build_query([
            'client_id' => $clientId,
            'client_secret' => $secret,
            'scope' => (string)$this->config['scopes'],
            'grant_type' => 'client_credentials',
        ], '', '&', PHP_QUERY_RFC1738);
        $res = $this->curl('POST', (string)$this->config['token_url'], $body, [
            'Accept: application/json',
            'Content-Type: application/x-www-form-urlencoded',
        ]);
        $json = json_decode((string)$res['body'], true);
        $token = is_array($json) ? trim((string)($json['access_token'] ?? '')) : '';
        if ($token === '') throw new C6ApiException('O C6 não retornou o token de acesso.', 502, $json);
        $this->token = $token;
        @file_put_contents($cachePath, json_encode([
            'clientHash' => hash('sha256', $clientId),
            'accessToken' => $token,
            'expiresAt' => time() + max(60, (int)($json['expires_in'] ?? 300)),
        ], JSON_UNESCAPED_SLASHES), LOCK_EX);
        @chmod($cachePath, 0600);
        return $token;
    }

    private function json(string $method, string $path, ?array $payload = null): array
    {
        $res = $this->raw($method, $path, $payload);
        $json = json_decode((string)$res['body'], true);
        if (!is_array($json)) throw new C6ApiException('Resposta JSON inválida do C6.', 502);
        return $json;
    }

    private function raw(string $method, string $path, ?array $payload = null): array
    {
        return $this->rawUrl($method, (string)$this->config['base_url'] . $path, $payload);
    }

    private function rawUrl(string $method, string $url, ?array $payload = null): array
    {
        $headers = [
            'Accept: application/json, application/pdf',
            'Authorization: Bearer ' . $this->obterToken(),
            'partner-software-name: ' . (string)$this->config['partner_software_name'],
            'partner-software-version: ' . (string)$this->config['partner_software_version'],
        ];
        $body = null;
        if ($payload !== null) {
            $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $headers[] = 'Content-Type: application/json';
        }
        return $this->curl($method, $url, $body, $headers);
    }

    private function curl(string $method, string $url, ?string $body, array $headers): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => false,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_SSLCERT => (string)$this->config['cert_path'],
            CURLOPT_SSLKEY => (string)$this->config['key_path'],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => (int)$this->config['timeout_seconds'],
        ]);
        if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        $response = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $contentType = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $erro = curl_error($ch);
        curl_close($ch);
        if ($response === false) throw new C6ApiException('Falha de comunicação mTLS com o C6: ' . $erro, 502);
        if ($status < 200 || $status >= 300) {
            $json = json_decode((string)$response, true);
            throw new C6ApiException('C6 recusou a operação (HTTP ' . $status . ').', $status ?: 502, $json ?: $response);
        }
        return ['body' => (string)$response, 'status' => $status, 'contentType' => $contentType];
    }
}
