param(
    [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Find-WinScp {
    $candidates = @(
        (Join-Path $env:ProgramFiles 'WinSCP\WinSCP.com'),
        (Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'WinSCP\WinSCP.com'),
        (Join-Path $env:LOCALAPPDATA 'Programs\WinSCP\WinSCP.com')
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw 'WinSCP.com não encontrado.'
}

$project = (Resolve-Path -LiteralPath $ProjectRoot).Path
$source = Join-Path $project 'public\api\fiscal\nfe-xml-preview-v63.php'
$configFile = Join-Path $env:USERPROFILE '.synergias-deploy\hostgator.secure.xml'

if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Arquivo fiscal não encontrado: $source"
}
if (-not (Select-String -Path $source -Pattern "NFE_XML_PREVIEW_VERSION = 'V155'" -SimpleMatch -Quiet)) {
    throw 'Arquivo fiscal local não é V155.'
}
if (-not (Test-Path -LiteralPath $configFile -PathType Leaf)) {
    throw "Configuração de deploy não encontrada: $configFile"
}

$config = Import-Clixml -LiteralPath $configFile
$securePassword = ConvertTo-SecureString ([string]$config.Password)
$credential = New-Object System.Management.Automation.PSCredential([string]$config.Username, $securePassword)
$password = $credential.GetNetworkCredential().Password
$winscp = Find-WinScp
$remoteBase = '/' + ([string]$config.RemotePath).Trim('/').Replace('\', '/')
if ($remoteBase -eq '/') { $remoteBase = '' }
$remote = "$remoteBase/api/fiscal/nfe-xml-preview-v63.php"
$runtime = Join-Path $env:TEMP ('synergias-nfe-v155-' + [guid]::NewGuid().ToString('N'))
$scriptFile = Join-Path $runtime 'deploy.txt'
$download = Join-Path $runtime 'online.php'

New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$user = [Uri]::EscapeDataString([string]$config.Username)
$pass = [Uri]::EscapeDataString($password)
$ftpHost = [string]$config.Host
$port = [string]$config.Port
$open = "open ftpes://${user}:${pass}@${ftpHost}:${port}/ -passive=on"
$lines = @(
    'option batch abort',
    'option confirm off',
    $open,
    ('put -nopreservetime -transfer=binary "{0}" "{1}"' -f $source, $remote),
    ('get -transfer=binary "{0}" "{1}"' -f $remote, $download),
    'exit'
)
[IO.File]::WriteAllLines($scriptFile, $lines, (New-Object Text.UTF8Encoding($false)))

try {
    Write-Host 'Publicando gerador XML fiscal V155...' -ForegroundColor Cyan
    & $winscp "/script=$scriptFile" /loglevel=1
    if ($LASTEXITCODE -ne 0) { throw 'WinSCP não concluiu a publicação fiscal.' }

    $localHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $onlineHash = (Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash
    if ($localHash -ne $onlineHash) {
        throw "SHA-256 remoto diferente do local. Local=$localHash; remoto=$onlineHash"
    }
    if (-not (Select-String -Path $download -Pattern "NFE_XML_PREVIEW_VERSION = 'V155'" -SimpleMatch -Quiet)) {
        throw 'O arquivo remoto não confirmou a versão V155.'
    }

    Write-Host "NFE V155 PUBLICADA E CONFIRMADA. SHA-256: $localHash" -ForegroundColor Green
}
finally {
    $password = $null
    Remove-Item -LiteralPath $runtime -Recurse -Force -ErrorAction SilentlyContinue
}
