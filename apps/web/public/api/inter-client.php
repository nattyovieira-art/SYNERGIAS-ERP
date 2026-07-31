<?php
declare(strict_types=1);

require_once __DIR__ . '/inter-config.php';

final class InterApiException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $httpStatus = 500,
        public readonly mixed $interPayload = null,
    ) {
        parent::__construct($message);
    }
}

final class InterApiClient
{
    private array $config;
    private ?string $accessToken = null;

    public function __construct()
    {
        $this->config = carregarConfigInter();
    }

    public function diagnostico(): array
    {
        $clientId = trim((string)$this->config['client_id']);
        $statusPath = dirname((string)$this->config['cert_path']) . '/status.json';
        $status = [];
        if (is_file($statusPath)) {
            $conteudo = @file_get_contents($statusPath);
            $json = is_string($conteudo) ? json_decode($conteudo, true) : null;
            if (is_array($json) && hash_equals((string)($json['activeClientIdHash'] ?? ''), hash('sha256', $clientId))) {
                $status = $json;
            }
        }

        return [
            'configured' => true,
            'certificate' => is_file($this->config['cert_path']),
            'privateKey' => is_file($this->config['key_path']),
            'baseUrl' => $this->config['base_url'],
            'integrationIdConfigured' => trim((string)$this->config['integration_id']) !== '',
            'clientIdConfigured' => $clientId !== '',
            'clientSecretConfigured' => trim((string)$this->config['client_secret']) !== '',
            'activeClientIdMasked' => (string)($status['activeClientIdMasked'] ?? ($clientId !== '' ? substr($clientId, 0, 8) . '…' . substr($clientId, -4) : '')),
            'authenticationValidated' => (bool)($status['authenticationValidated'] ?? false),
            'lastAuthAt' => (string)($status['lastAuthAt'] ?? ''),
            'tokenExpiresAt' => (string)($status['tokenExpiresAt'] ?? ''),
        ];
    }

    public function testarToken(): array
    {
        $token = $this->obterAccessToken();
        $valido = $token !== '';

        if ($valido) {
            $clientId = trim((string)$this->config['client_id']);
            $dir = dirname((string)$this->config['cert_path']);
            $status = [
                'authenticationValidated' => true,
                'lastAuthAt' => gmdate('c'),
                'tokenExpiresAt' => '',
                'activeClientIdMasked' => $clientId !== '' ? substr($clientId, 0, 8) . '…' . substr($clientId, -4) : '',
                'activeClientIdHash' => hash('sha256', $clientId),
            ];
            @file_put_contents($dir . '/status.json', json_encode($status, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
            @chmod($dir . '/status.json', 0600);
        }

        return [
            'ok' => $valido,
            'tokenReceived' => $valido,
        ];
    }

    public function emitirCobranca(array $payload): array
    {
        return $this->requestJson('POST', '/cobrancas', $payload);
    }

    public function consultarCobranca(string $codigoSolicitacao): array
    {
        return $this->requestJson(
            'GET',
            '/cobrancas/' . rawurlencode($codigoSolicitacao)
        );
    }

    public function obterPdfCobranca(string $codigoSolicitacao): array
    {
        $response = null;
        $ultimoErro = null;

        // O Inter pode confirmar a cobrança antes de concluir a geração do PDF.
        // Nessa situação a própria API orienta tentar novamente após o processamento.
        // Repetimos somente esse caso transitório, sem alterar os demais erros da integração.
        for ($tentativa = 1; $tentativa <= 5; $tentativa++) {
            try {
                $response = $this->requestRaw(
                    'GET',
                    '/cobrancas/' . rawurlencode($codigoSolicitacao) . '/pdf'
                );
                $ultimoErro = null;
                break;
            } catch (InterApiException $erro) {
                $ultimoErro = $erro;
                $payload = is_array($erro->interPayload) ? $erro->interPayload : [];
                $mensagem = mb_strtolower($this->extrairMensagemErro($payload) . ' ' . $erro->getMessage());
                $pdfEmProcessamento = $erro->httpStatus === 400
                    && str_contains($mensagem, 'pdf')
                    && (str_contains($mensagem, 'process') || str_contains($mensagem, 'tente novamente'));

                if (!$pdfEmProcessamento || $tentativa >= 5) {
                    if ($pdfEmProcessamento) {
                        throw new InterApiException(
                            'Boleto gerado com sucesso. O Banco Inter ainda está processando o PDF. Tente visualizar ou imprimir novamente em alguns segundos.',
                            409,
                            $payload,
                        );
                    }
                    throw $erro;
                }

                sleep(2);
            }
        }

        if (!is_array($response)) {
            throw $ultimoErro ?? new InterApiException('Não foi possível obter o PDF da cobrança no Banco Inter.', 502);
        }

        $contentType = strtolower((string)($response['contentType'] ?? ''));
        $body = (string)($response['body'] ?? '');

        if (str_contains($contentType, 'application/pdf') || str_starts_with($body, '%PDF')) {
            return [
                'pdfBase64' => base64_encode($body),
                'mimeType' => 'application/pdf',
            ];
        }

        $json = json_decode($body, true);

        if (!is_array($json)) {
            throw new InterApiException('A API Inter não retornou um PDF válido.', 502);
        }

        $base64 = $this->buscarPrimeiroValor($json, [
            'pdf', 'pdfBase64', 'arquivo', 'conteudo', 'base64', 'data',
        ]);

        if (!is_string($base64) || trim($base64) === '') {
            throw new InterApiException('O retorno da API Inter não contém o PDF da cobrança.', 502, $json);
        }

        if (str_contains($base64, ',')) {
            $base64 = substr($base64, strpos($base64, ',') + 1);
        }

        return [
            'pdfBase64' => trim($base64),
            'mimeType' => 'application/pdf',
            'raw' => $json,
        ];
    }

    public function cancelarCobranca(string $codigoSolicitacao, string $motivo = 'ACERTOS'): array
    {
        $path = '/cobrancas/' . rawurlencode($codigoSolicitacao);
        $payload = ['motivoCancelamento' => $motivo];

        try {
            return $this->requestJson('DELETE', $path, $payload);
        } catch (InterApiException $erro) {
            if (!in_array($erro->httpStatus, [404, 405], true)) {
                throw $erro;
            }
        }

        return $this->requestJson('POST', $path . '/cancelar', $payload);
    }

    private function obterAccessToken(): string
    {
        if ($this->accessToken !== null) {
            return $this->accessToken;
        }

        $clientId = trim((string)$this->config['client_id']);
        $cachePath = dirname((string)$this->config['cert_path']) . '/token-cache.json';
        if (is_file($cachePath)) {
            $cacheRaw = @file_get_contents($cachePath);
            $cache = is_string($cacheRaw) ? json_decode($cacheRaw, true) : null;
            if (is_array($cache)
                && hash_equals((string)($cache['clientHash'] ?? ''), hash('sha256', $clientId))
                && (int)($cache['expiresAt'] ?? 0) > time() + 90
                && trim((string)($cache['accessToken'] ?? '')) !== '') {
                $this->accessToken = trim((string)$cache['accessToken']);
                return $this->accessToken;
            }
        }
        $clientSecret = trim((string)$this->config['client_secret']);

        if ($clientId === '' || $clientSecret === '') {
            throw new InterApiException('Client ID ou Client Secret não configurado.', 422);
        }

        $certPem = @file_get_contents((string)$this->config['cert_path']);
        $keyPem = @file_get_contents((string)$this->config['key_path']);
        if (!is_string($certPem) || !is_string($keyPem) || $certPem === '' || $keyPem === '') {
            throw new InterApiException('Certificado ou chave privada do Banco Inter não pôde ser lido.', 422);
        }
        if (!openssl_x509_check_private_key($certPem, $keyPem)) {
            throw new InterApiException('O certificado .crt e a chave .key não pertencem ao mesmo conjunto.', 422);
        }

        $scopeCandidates = $this->config['scope_candidates'] ?? [];
        if (!is_array($scopeCandidates) || count($scopeCandidates) === 0) {
            $scopeCandidates = ['boleto-cobranca.read boleto-cobranca.write'];
        }

        $tentativas = [];
        foreach ($scopeCandidates as $scope) {
            $scope = trim((string)$scope);
            if ($scope === '') continue;

            $tentativas[] = ['modo' => 'body', 'scope' => $scope];
            $tentativas[] = ['modo' => 'basic', 'scope' => $scope];
        }

        $ultimoErro = null;

        foreach ($tentativas as $tentativa) {
            $modo = (string)$tentativa['modo'];
            $scope = (string)$tentativa['scope'];
            $body = [
                'grant_type' => 'client_credentials',
                'scope' => $scope,
            ];
            $headers = [
                'Accept: application/json',
                'Content-Type: application/x-www-form-urlencoded',
            ];

            if ($modo === 'body') {
                $body['client_id'] = $clientId;
                $body['client_secret'] = $clientSecret;
            } else {
                $headers[] = 'Authorization: Basic ' . base64_encode($clientId . ':' . $clientSecret);
            }

            try {
                $response = $this->curl(
                    'POST',
                    (string)$this->config['token_url'],
                    http_build_query($body, '', '&', PHP_QUERY_RFC1738),
                    $headers,
                    false,
                );

                $json = json_decode((string)$response['body'], true);
                if (!is_array($json)) {
                    throw new InterApiException('Resposta inválida ao solicitar token do Banco Inter.', 502);
                }

                $token = trim((string)($json['access_token'] ?? ''));
                if ($token === '') {
                    throw new InterApiException('Banco Inter não retornou access_token.', 502, $json);
                }

                $this->accessToken = $token;
                $expiresIn = max(300, (int)($json['expires_in'] ?? 3600));
                @file_put_contents($cachePath, json_encode([
                    'clientHash' => hash('sha256', $clientId),
                    'accessToken' => $token,
                    'expiresAt' => time() + $expiresIn,
                ], JSON_UNESCAPED_SLASHES), LOCK_EX);
                @chmod($cachePath, 0600);
                return $token;
            } catch (InterApiException $erro) {
                $ultimoErro = $erro;
                $payload = is_array($erro->interPayload) ? $erro->interPayload : [];
                $codigo = strtolower(trim((string)($payload['error'] ?? '')));

                if (!in_array($codigo, ['', 'invalid_client', 'invalid_scope', 'unauthorized_client'], true)) {
                    break;
                }
            }
        }

        if ($ultimoErro instanceof InterApiException) {
            throw $ultimoErro;
        }

        throw new InterApiException('Não foi possível autenticar na API do Banco Inter.', 502);
    }

    private function requestJson(string $method, string $path, ?array $payload = null): array
    {
        $response = $this->requestRaw($method, $path, $payload);
        $body = trim((string)($response['body'] ?? ''));

        if ($body === '') {
            return [];
        }

        $json = json_decode($body, true);

        if (!is_array($json)) {
            throw new InterApiException('A API Inter retornou JSON inválido.', 502);
        }

        return $json;
    }

    private function requestRaw(string $method, string $path, ?array $payload = null): array
    {
        $token = $this->obterAccessToken();
        $headers = [
            'Accept: application/json, application/pdf',
            'Authorization: Bearer ' . $token,
        ];

        $conta = trim((string)$this->config['conta_corrente']);
        if ($conta !== '') {
            $headers[] = 'x-conta-corrente: ' . $conta;
        }

        $body = null;
        if ($payload !== null) {
            $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            $headers[] = 'Content-Type: application/json';
        }

        $url = rtrim((string)$this->config['base_url'], '/') . '/' . ltrim($path, '/');

        return $this->curl($method, $url, $body, $headers, true);
    }

    private function curl(
        string $method,
        string $url,
        ?string $body,
        array $headers,
        bool $throwHttpError,
    ): array {
        $ch = curl_init($url);

        if ($ch === false) {
            throw new InterApiException('Não foi possível iniciar conexão com o Banco Inter.', 500);
        }

        $responseHeaders = [];

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => (int)$this->config['timeout_seconds'],
            CURLOPT_SSLCERT => $this->config['cert_path'],
            CURLOPT_SSLCERTTYPE => 'PEM',
            CURLOPT_SSLKEY => $this->config['key_path'],
            CURLOPT_SSLKEYTYPE => 'PEM',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_HEADERFUNCTION => static function ($curl, string $header) use (&$responseHeaders): int {
                $length = strlen($header);
                $parts = explode(':', $header, 2);
                if (count($parts) === 2) {
                    $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                }
                return $length;
            },
        ]);

        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }

        $responseBody = curl_exec($ch);
        $curlError = curl_error($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $contentType = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);

        if ($status === 429) {
            $retryAfter = max(1, min(20, (int)($responseHeaders['retry-after'] ?? 2)));
            sleep($retryAfter);
            $retryHeaders = array_values(array_filter($headers, static fn(string $h): bool => !str_starts_with(strtolower($h), 'authorization: bearer ')));
            if ($throwHttpError) {
                $this->accessToken = null;
                $retryHeaders[] = 'Authorization: Bearer ' . $this->obterAccessToken();
            }
            return $this->curl($method, $url, $body, $retryHeaders, $throwHttpError);
        }

        if ($responseBody === false) {
            throw new InterApiException('Falha de conexão com o Banco Inter: ' . $curlError, 502);
        }

        if ($throwHttpError && ($status < 200 || $status >= 300)) {
            $json = json_decode((string)$responseBody, true);
            $safePayload = is_array($json) ? $json : ['raw' => mb_substr((string)$responseBody, 0, 1500)];
            $message = $this->extrairMensagemErro($safePayload);

            throw new InterApiException(
                'Banco Inter recusou a operação' . ($message !== '' ? ': ' . $message : '.'),
                $status > 0 ? $status : 502,
                $safePayload,
            );
        }

        if (!$throwHttpError && ($status < 200 || $status >= 300)) {
            $json = json_decode((string)$responseBody, true);
            $safePayload = is_array($json) ? $json : ['raw' => mb_substr((string)$responseBody, 0, 1500)];
            $message = $this->extrairMensagemErro($safePayload);

            throw new InterApiException(
                'Falha ao autenticar no Banco Inter' . ($message !== '' ? ': ' . $message : '.'),
                $status > 0 ? $status : 502,
                $safePayload,
            );
        }

        return [
            'status' => $status,
            'body' => (string)$responseBody,
            'contentType' => $contentType,
            'headers' => $responseHeaders,
        ];
    }

    private function extrairMensagemErro(array $payload): string
    {
        foreach (['detail', 'message', 'mensagem', 'error_description', 'error'] as $key) {
            if (isset($payload[$key]) && is_scalar($payload[$key])) {
                return trim((string)$payload[$key]);
            }
        }

        if (isset($payload['violacoes']) && is_array($payload['violacoes'])) {
            $mensagens = [];
            foreach ($payload['violacoes'] as $violacao) {
                if (is_array($violacao)) {
                    $mensagens[] = trim((string)($violacao['razao'] ?? $violacao['mensagem'] ?? ''));
                }
            }
            return implode(' | ', array_filter($mensagens));
        }

        return '';
    }

    private function buscarPrimeiroValor(array $payload, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $payload) && !is_array($payload[$key])) {
                return $payload[$key];
            }
        }

        foreach ($payload as $value) {
            if (is_array($value)) {
                $found = $this->buscarPrimeiroValor($value, $keys);
                if ($found !== null && $found !== '') {
                    return $found;
                }
            }
        }

        return null;
    }
}
