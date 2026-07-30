param(
    [string]$ProjectRoot = (Get-Location).Path,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

function Find-WinSCPCom {
    $candidates = @(
        (Join-Path $env:ProgramFiles 'WinSCP\WinSCP.com'),
        (Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'WinSCP\WinSCP.com'),
        (Join-Path $env:LOCALAPPDATA 'Programs\WinSCP\WinSCP.com')
    ) | Where-Object { $_ }

    $cmd = Get-Command 'WinSCP.com' -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { $candidates += $cmd.Source }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw 'WinSCP.com não foi localizado.'
}

function Encode-WinSCPUrlValue([string]$Value) {
    [Uri]::EscapeDataString($Value)
}

function Write-Utf8NoBom([string]$Path, [string[]]$Lines) {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($Path, $Lines, $utf8)
}

$project = (Resolve-Path -LiteralPath $ProjectRoot).Path
$configFile = Join-Path $env:USERPROFILE '.synergias-deploy\hostgator.secure.xml'
if (-not (Test-Path -LiteralPath $configFile -PathType Leaf)) {
    throw 'Configuração FTP não encontrada em ~/.synergias-deploy/hostgator.secure.xml.'
}

$config = Import-Clixml -LiteralPath $configFile
$securePassword = ConvertTo-SecureString ([string]$config.Password)
$credential = New-Object System.Management.Automation.PSCredential([string]$config.Username, $securePassword)
$passwordPlain = $credential.GetNetworkCredential().Password

$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$releaseId = "V233_$stamp"
$dist = Join-Path $project 'dist'
$runtime = Join-Path $env:TEMP "SYNERGIAS_DEPLOY_V233_$stamp"
$stage = Join-Path $runtime 'stage'
$scriptFile = Join-Path $runtime 'deploy.txt'
$logDir = Join-Path (Split-Path -Parent (Split-Path -Parent $project)) '_deploy_logs_synergias'
$logFile = Join-Path $logDir "winscp_$stamp.log"
$htaccessErro500 = Join-Path $project '.htaccess.erro500'
$pedidoForm = Join-Path $project 'src\pages\Vendas\PedidoForm.tsx'
$cabecalhoMarker = 'SYNERGIAS_CABECALHO_PEDIDO_RESPONSIVO_V244'
$protectedDir = Join-Path $project '.synergias-protected'
$protectedPedidoForm = Join-Path $protectedDir 'PedidoForm_CABECALHO_V230.tsx'
$htaccessHashAntes = $null

if (Test-Path -LiteralPath $htaccessErro500 -PathType Leaf) {
    $htaccessHashAntes = (Get-FileHash -LiteralPath $htaccessErro500 -Algorithm SHA256).Hash
}

if (-not (Test-Path -LiteralPath $pedidoForm -PathType Leaf)) {
    throw "Proteção V230: arquivo obrigatório não encontrado: $pedidoForm"
}

$pedidoSource = Get-Content -LiteralPath $pedidoForm -Raw -Encoding UTF8
if (-not $pedidoSource.Contains($cabecalhoMarker)) {
    throw 'PUBLICAÇÃO BLOQUEADA: o cabeçalho estrutural atual do Pedido desapareceu. Nenhum arquivo foi publicado.'
}

New-Item -ItemType Directory -Path $protectedDir -Force | Out-Null
Copy-Item -LiteralPath $pedidoForm -Destination $protectedPedidoForm -Force

$protectedBackupDir = Join-Path $project ".synergias-backups\PUBLICACAO_PROTEGIDA_V230_$stamp"
New-Item -ItemType Directory -Path (Join-Path $protectedBackupDir 'src\pages\Vendas') -Force | Out-Null
Copy-Item -LiteralPath $pedidoForm -Destination (Join-Path $protectedBackupDir 'src\pages\Vendas\PedidoForm.tsx') -Force

New-Item -ItemType Directory -Path $runtime -Force | Out-Null
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

try {
    Write-Host ''
    Write-Host 'SYNERGIAS ERP - PUBLICAÇÃO SEGURA V233' -ForegroundColor Cyan
    Write-Host "Release exclusiva: $releaseId" -ForegroundColor DarkGray
    Write-Host '.htaccess.erro500 será preservado; nenhum .htaccess será enviado.' -ForegroundColor DarkGray

    if (-not $SkipBuild) {
        Write-Host '[1/7] Gerando build com bundle exclusivo...' -ForegroundColor Yellow
        Push-Location $project
        try {
            $env:SYNERGIAS_RELEASE_ID = $releaseId
            & npm run build
            if ($LASTEXITCODE -ne 0) { throw "npm run build falhou com código $LASTEXITCODE" }
        }
        finally {
            Remove-Item Env:SYNERGIAS_RELEASE_ID -ErrorAction SilentlyContinue
            Pop-Location
        }
    }
    else {
        Write-Host '[1/7] Build já gerado; seguindo com publicação...' -ForegroundColor Yellow
    }

    $indexLocal = Join-Path $dist 'index.html'
    if (-not (Test-Path -LiteralPath $indexLocal -PathType Leaf)) {
        throw 'Build inválido: dist\index.html não foi encontrado.'
    }

    $indexText = Get-Content -LiteralPath $indexLocal -Raw
    $bundleMatch = [regex]::Match($indexText, 'src=["''](?<url>/assets/[^"'']+\.js)["'']')
    if (-not $bundleMatch.Success) { throw 'Bundle JS não encontrado em dist\index.html.' }

    $bundleUrl = $bundleMatch.Groups['url'].Value
    $bundleName = [IO.Path]::GetFileName($bundleUrl)
    $bundleLocal = Join-Path $dist ('assets\' + $bundleName)
    if (-not (Test-Path -LiteralPath $bundleLocal -PathType Leaf)) {
        throw "Bundle local não encontrado: $bundleLocal"
    }

    $bundleComCabecalho = Get-ChildItem -LiteralPath (Join-Path $dist 'assets') -Filter '*.js' -File |
        Select-String -SimpleMatch $cabecalhoMarker -Quiet
    if (-not $bundleComCabecalho) {
        throw 'PUBLICAÇÃO BLOQUEADA: o build não contém o cabeçalho estrutural atual do Pedido.'
    }

    Write-Host "[OK] Bundle novo: $bundleName" -ForegroundColor Green
    Write-Host '[OK] Cabeçalho estrutural atual confirmado no fonte e no bundle.' -ForegroundColor Green

    Write-Host '[2/7] Preparando publicação sem arquivos privados...' -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $stage 'assets') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $stage 'api') -Force | Out-Null

    Copy-Item -LiteralPath $indexLocal -Destination (Join-Path $stage 'index.html') -Force
    Copy-Item -Path (Join-Path $dist 'assets\*') -Destination (Join-Path $stage 'assets') -Recurse -Force

    $apiFiscalLocal = Join-Path $dist 'api\configuracao-fiscal.php'
    if (-not (Test-Path -LiteralPath $apiFiscalLocal -PathType Leaf)) {
        throw 'A API api\configuracao-fiscal.php não foi encontrada no dist.'
    }
    Copy-Item -LiteralPath $apiFiscalLocal -Destination (Join-Path $stage 'api\configuracao-fiscal.php') -Force

    if (Test-Path -LiteralPath (Join-Path $stage '.htaccess')) {
        Remove-Item -LiteralPath (Join-Path $stage '.htaccess') -Force
    }
    if (Test-Path -LiteralPath (Join-Path $stage 'api\.htaccess')) {
        Remove-Item -LiteralPath (Join-Path $stage 'api\.htaccess') -Force
    }

    $winscp = Find-WinSCPCom
    $remote = '/' + ([string]$config.RemotePath).Trim('/').Replace('\','/')
    if ([string]::IsNullOrWhiteSpace([string]$config.RemotePath) -or [string]$config.RemotePath -eq '/') { $remote = '/' }
    $remoteBase = $remote.TrimEnd('/')
    if (-not $remoteBase) { $remoteBase = '' }

    $env:SYNERGIAS_FTP_USER = Encode-WinSCPUrlValue ([string]$config.Username)
    $env:SYNERGIAS_FTP_PASS = Encode-WinSCPUrlValue $passwordPlain
    $env:SYNERGIAS_FTP_HOST = [string]$config.Host
    $env:SYNERGIAS_FTP_PORT = [string]$config.Port

    $assetsLocal = Join-Path $stage 'assets\*'
    $indexStage = Join-Path $stage 'index.html'
    $apiFiscalStage = Join-Path $stage 'api\configuracao-fiscal.php'
    $apiNumeracaoLocal = Join-Path $dist 'api\numeracao-fiscal.php'
    $apiNumeracaoStage = Join-Path $stage 'api\numeracao-fiscal.php'
    $apiEntregaLocal = Join-Path $dist 'api\pedido-entrega.php'
    $apiEntregaStage = Join-Path $stage 'api\pedido-entrega.php'
    $apiMovimentosLocal = Join-Path $dist 'api\estoque-movimentacoes.php'
    $apiMovimentosStage = Join-Path $stage 'api\estoque-movimentacoes.php'
    $apiStorageLocal = Join-Path $dist 'api\storage.php'
    $apiStorageStage = Join-Path $stage 'api\storage.php'
    $apiCnpjLocal = Join-Path $dist 'api\cnpj-consulta.php'
    $apiCnpjStage = Join-Path $stage 'api\cnpj-consulta.php'
    $apiBootstrapLocal = Join-Path $dist 'api\bootstrap.php'
    $apiBootstrapStage = Join-Path $stage 'api\bootstrap.php'
    $apiEmailLocal = Join-Path $dist 'api\enviar-nota-boleto-cliente.php'
    $apiEmailStage = Join-Path $stage 'api\enviar-nota-boleto-cliente.php'
    $apiDanfeLocal = Join-Path $dist 'api\fiscal\nfe-danfe-pdf.php'
    $apiDanfeStageDir = Join-Path $stage 'api\fiscal'
    $apiDanfeStage = Join-Path $apiDanfeStageDir 'nfe-danfe-pdf.php'
    $apiDanfeHtmlLocal = Join-Path $dist 'api\fiscal\nfe-danfe.php'
    $apiDanfeHtmlStage = Join-Path $apiDanfeStageDir 'nfe-danfe.php'
    $apiXmlPreviewLocal = Join-Path $dist 'api\fiscal\nfe-xml-preview-v63.php'
    $apiXmlPreviewStage = Join-Path $apiDanfeStageDir 'nfe-xml-preview-v63.php'
    if (-not (Test-Path -LiteralPath $apiNumeracaoLocal -PathType Leaf)) {
        throw 'A API api\numeracao-fiscal.php não foi encontrada no dist.'
    }
    Copy-Item -LiteralPath $apiNumeracaoLocal -Destination $apiNumeracaoStage -Force
    if (-not (Test-Path -LiteralPath $apiEntregaLocal -PathType Leaf)) {
        throw 'A API api\pedido-entrega.php não foi encontrada no dist.'
    }
    Copy-Item -LiteralPath $apiEntregaLocal -Destination $apiEntregaStage -Force
    if (-not (Test-Path -LiteralPath $apiMovimentosLocal -PathType Leaf)) {
        throw 'A API api\estoque-movimentacoes.php não foi encontrada no dist.'
    }
    Copy-Item -LiteralPath $apiMovimentosLocal -Destination $apiMovimentosStage -Force
    if (-not (Test-Path -LiteralPath $apiStorageLocal -PathType Leaf)) {
        throw 'A API api\storage.php não foi encontrada no dist.'
    }
    Copy-Item -LiteralPath $apiStorageLocal -Destination $apiStorageStage -Force
    if (-not (Test-Path -LiteralPath $apiCnpjLocal -PathType Leaf)) {
        throw 'A API api\cnpj-consulta.php não foi encontrada no dist.'
    }
    Copy-Item -LiteralPath $apiCnpjLocal -Destination $apiCnpjStage -Force
    foreach ($apiObrigatoria in @($apiBootstrapLocal, $apiEmailLocal, $apiDanfeLocal, $apiDanfeHtmlLocal, $apiXmlPreviewLocal)) {
        if (-not (Test-Path -LiteralPath $apiObrigatoria -PathType Leaf)) {
            throw "API de segurança não encontrada no build: $apiObrigatoria"
        }
    }
    New-Item -ItemType Directory -Path $apiDanfeStageDir -Force | Out-Null
    Copy-Item -LiteralPath $apiBootstrapLocal -Destination $apiBootstrapStage -Force
    Copy-Item -LiteralPath $apiEmailLocal -Destination $apiEmailStage -Force
    Copy-Item -LiteralPath $apiDanfeLocal -Destination $apiDanfeStage -Force
    Copy-Item -LiteralPath $apiDanfeHtmlLocal -Destination $apiDanfeHtmlStage -Force
    Copy-Item -LiteralPath $apiXmlPreviewLocal -Destination $apiXmlPreviewStage -Force

    $lines = @(
        'option batch abort',
        'option confirm off',
        'option transfer binary',
        'open ftpes://%SYNERGIAS_FTP_USER%:%SYNERGIAS_FTP_PASS%@%SYNERGIAS_FTP_HOST%:%SYNERGIAS_FTP_PORT%/ -passive=on',
        ('cd "{0}"' -f ($(if ($remoteBase) { $remoteBase } else { '/' }))),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/assets/"' -f $assetsLocal, $remoteBase),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/api/configuracao-fiscal.php"' -f $apiFiscalStage, $remoteBase),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/api/numeracao-fiscal.php"' -f $apiNumeracaoStage, $remoteBase),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/api/pedido-entrega.php"' -f $apiEntregaStage, $remoteBase),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/api/estoque-movimentacoes.php"' -f $apiMovimentosStage, $remoteBase),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/api/storage.php"' -f $apiStorageStage, $remoteBase),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/api/cnpj-consulta.php"' -f $apiCnpjStage, $remoteBase),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/api/bootstrap.php"' -f $apiBootstrapStage, $remoteBase),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/api/enviar-nota-boleto-cliente.php"' -f $apiEmailStage, $remoteBase),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/api/fiscal/nfe-danfe-pdf.php"' -f $apiDanfeStage, $remoteBase),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/api/fiscal/nfe-danfe.php"' -f $apiDanfeHtmlStage, $remoteBase),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/api/fiscal/nfe-xml-preview-v63.php"' -f $apiXmlPreviewStage, $remoteBase),
        ('put -nopreservetime -transfer=binary "{0}" "{1}/index.html"' -f $indexStage, $remoteBase),
        'exit'
    )

    Write-Utf8NoBom $scriptFile $lines

    Write-Host '[3/7] Publicando bundle, index e API fiscal...' -ForegroundColor Yellow
    & $winscp "/script=$scriptFile" "/log=$logFile" '/loglevel=1' | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { throw "WinSCP não concluiu a publicação. Consulte: $logFile" }

    Write-Host '[4/7] Confirmando site sem Erro 500...' -ForegroundColor Yellow
    $publicUrl = ([string]$config.PublicUrl).TrimEnd('/')
    $headers = @{ 'Cache-Control' = 'no-cache, no-store, must-revalidate'; 'Pragma' = 'no-cache' }
    $indexOnline = Invoke-WebRequest -Uri "$publicUrl/?release=$releaseId" -UseBasicParsing -TimeoutSec 60 -Headers $headers
    if ($indexOnline.StatusCode -lt 200 -or $indexOnline.StatusCode -ge 400) {
        throw "O site respondeu HTTP $($indexOnline.StatusCode)."
    }

    Write-Host '[5/7] Confirmando bundle novo no index online...' -ForegroundColor Yellow
    if ([string]$indexOnline.Content -notmatch [regex]::Escape($bundleName)) {
        throw "O index online não aponta para o bundle novo $bundleName."
    }

    Write-Host '[6/7] Comparando SHA-256 do bundle...' -ForegroundColor Yellow
    $onlineTemp = Join-Path $runtime $bundleName
    Invoke-WebRequest -Uri "${publicUrl}${bundleUrl}?release=$releaseId" -OutFile $onlineTemp -UseBasicParsing -TimeoutSec 120 -Headers $headers
    $shaLocal = (Get-FileHash -LiteralPath $bundleLocal -Algorithm SHA256).Hash.ToLowerInvariant()
    $shaOnline = (Get-FileHash -LiteralPath $onlineTemp -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($shaLocal -ne $shaOnline) { throw "Bundle diferente após publicação. SHA local=$shaLocal; SHA online=$shaOnline." }

    if (-not (Select-String -LiteralPath $onlineTemp -SimpleMatch $cabecalhoMarker -Quiet)) {
        $bundleMarcador = Get-ChildItem -LiteralPath (Join-Path $stage 'assets') -Filter '*.js' -File |
            Where-Object { Select-String -LiteralPath $_.FullName -SimpleMatch $cabecalhoMarker -Quiet } |
            Select-Object -First 1
        if (-not $bundleMarcador) {
            throw 'O build local não contém o cabeçalho estrutural atual.'
        }
        $onlineMarcador = Join-Path $runtime $bundleMarcador.Name
        Invoke-WebRequest -Uri "${publicUrl}/assets/$($bundleMarcador.Name)?release=$releaseId" -OutFile $onlineMarcador -UseBasicParsing -TimeoutSec 120 -Headers $headers
        if (-not (Select-String -LiteralPath $onlineMarcador -SimpleMatch $cabecalhoMarker -Quiet)) {
            throw 'Publicação concluída, mas o módulo online de Pedidos não contém o cabeçalho estrutural atual.'
        }
    }

    Write-Host '[7/7] Validando API fiscal e preservação do .htaccess.erro500...' -ForegroundColor Yellow
    try {
        $apiResponse = Invoke-WebRequest -Uri "$publicUrl/api/configuracao-fiscal.php?release=$releaseId" -UseBasicParsing -TimeoutSec 60 -Headers $headers
        if ($apiResponse.StatusCode -ge 500) { throw "A API fiscal respondeu HTTP $($apiResponse.StatusCode)." }
    }
    catch {
        $response = $_.Exception.Response
        if ($response -and [int]$response.StatusCode -lt 500) {
            # 401/403 sem sessão confirma que o endpoint PHP está ativo.
        }
        else {
            throw
        }
    }

    if ($htaccessHashAntes) {
        if (-not (Test-Path -LiteralPath $htaccessErro500 -PathType Leaf)) { throw '.htaccess.erro500 foi removido.' }
        $htaccessHashDepois = (Get-FileHash -LiteralPath $htaccessErro500 -Algorithm SHA256).Hash
        if ($htaccessHashAntes -ne $htaccessHashDepois) { throw '.htaccess.erro500 foi alterado.' }
    }

    Write-Host ''
    Write-Host 'PUBLICAÇÃO SEGURA V233 CONCLUÍDA.' -ForegroundColor Green
    Write-Host "ERP: $publicUrl/" -ForegroundColor Green
    Write-Host "Bundle confirmado: $bundleName" -ForegroundColor Green
    Write-Host "SHA-256 confirmado: $shaLocal" -ForegroundColor Green
    Write-Host "Log WinSCP: $logFile" -ForegroundColor DarkGray
    Write-Host '.htaccess.erro500, Banco Inter, certificados e arquivos privados foram preservados.' -ForegroundColor Cyan
}
finally {
    Remove-Item Env:SYNERGIAS_FTP_USER -ErrorAction SilentlyContinue
    Remove-Item Env:SYNERGIAS_FTP_PASS -ErrorAction SilentlyContinue
    Remove-Item Env:SYNERGIAS_FTP_HOST -ErrorAction SilentlyContinue
    Remove-Item Env:SYNERGIAS_FTP_PORT -ErrorAction SilentlyContinue
    $passwordPlain = $null
    $credential = $null
    Remove-Item -LiteralPath $runtime -Recurse -Force -ErrorAction SilentlyContinue
}

# SYNERGIAS_PUBLICADOR_TRAVA_CABECALHO_V230C_RELATORIOS_V233
