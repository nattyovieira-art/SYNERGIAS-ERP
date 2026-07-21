param([string]$ProjectRoot = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

$project = (Resolve-Path -LiteralPath $ProjectRoot).Path
$source = Join-Path $project 'public\api\fiscal\nfe-xml-preview-v63.php'
$configFile = Join-Path $env:USERPROFILE '.synergias-deploy\hostgator.secure.xml'
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Arquivo fiscal não encontrado: $source" }
if (-not (Select-String -LiteralPath $source -SimpleMatch "NFE_XML_PREVIEW_VERSION = 'V154'" -Quiet)) { throw 'O arquivo fiscal local não é a V154.' }
if (-not (Test-Path -LiteralPath $configFile -PathType Leaf)) { throw 'Configuração FTP não encontrada.' }

$config = Import-Clixml -LiteralPath $configFile
$securePassword = ConvertTo-SecureString ([string]$config.Password)
$credential = New-Object System.Management.Automation.PSCredential([string]$config.Username, $securePassword)
$password = $credential.GetNetworkCredential().Password
$winscp = @(
    (Join-Path $env:ProgramFiles 'WinSCP\WinSCP.com'),
    (Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'WinSCP\WinSCP.com'),
    (Join-Path $env:LOCALAPPDATA 'Programs\WinSCP\WinSCP.com')
) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $winscp) { throw 'WinSCP.com não foi localizado.' }

$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$runtime = Join-Path $env:TEMP "SYNERGIAS_NFE_V154_$stamp"
$scriptFile = Join-Path $runtime 'deploy.txt'
$download = Join-Path $runtime 'nfe-xml-preview-v63.online.php'
$logDir = Join-Path (Split-Path -Parent (Split-Path -Parent $project)) '_deploy_logs_synergias'
$logFile = Join-Path $logDir "winscp_nfe_v154_$stamp.log"
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

try {
    $remote = '/' + ([string]$config.RemotePath).Trim('/').Replace('\','/')
    if ([string]::IsNullOrWhiteSpace([string]$config.RemotePath) -or [string]$config.RemotePath -eq '/') { $remote = '' }
    $remoteFile = "$remote/api/fiscal/nfe-xml-preview-v63.php"
    $user = [Uri]::EscapeDataString([string]$config.Username)
    $pass = [Uri]::EscapeDataString($password)
    $lines = @(
        'option batch abort',
        'option confirm off',
        'option transfer binary',
        "open ftpes://${user}:${pass}@$($config.Host):$($config.Port)/ -passive=on",
        ('put -nopreservetime -transfer=binary "{0}" "{1}"' -f $source, $remoteFile),
        ('get -transfer=binary "{0}" "{1}"' -f $remoteFile, $download),
        'exit'
    )
    [IO.File]::WriteAllLines($scriptFile, $lines, (New-Object Text.UTF8Encoding($false)))
    & $winscp "/script=$scriptFile" "/log=$logFile" '/loglevel=1' | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { throw "WinSCP falhou. Consulte: $logFile" }
    $localHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $onlineHash = (Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash
    if ($localHash -ne $onlineHash) { throw "Arquivo online difere do local. Local=$localHash Online=$onlineHash" }
    if (-not (Select-String -LiteralPath $download -SimpleMatch "NFE_XML_PREVIEW_VERSION = 'V154'" -Quiet)) { throw 'A V154 não foi encontrada no arquivo baixado do servidor.' }
    Write-Host "NFE V154 PUBLICADA E CONFIRMADA. SHA-256: $localHash" -ForegroundColor Green
    Write-Host "Log: $logFile" -ForegroundColor DarkGray
}
finally {
    $password = $null
    $credential = $null
    Remove-Item -LiteralPath $runtime -Recurse -Force -ErrorAction SilentlyContinue
}
