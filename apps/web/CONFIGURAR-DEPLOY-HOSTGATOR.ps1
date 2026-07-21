param(
    [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'

function Read-Required([string]$Prompt, [string]$Default = '') {
    while ($true) {
        $label = if ($Default) { "$Prompt [$Default]" } else { $Prompt }
        $value = Read-Host $label
        if ([string]::IsNullOrWhiteSpace($value)) { $value = $Default }
        if (-not [string]::IsNullOrWhiteSpace($value)) { return $value.Trim() }
        Write-Host 'Valor obrigatorio.' -ForegroundColor Yellow
    }
}

$project = (Resolve-Path $ProjectRoot).Path
$configDir = Join-Path $env:USERPROFILE '.synergias-deploy'
$configFile = Join-Path $configDir 'hostgator.secure.xml'
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

Write-Host ''
Write-Host 'SYNERGIAS ERP - CONFIGURACAO UNICA DO DEPLOY HOSTGATOR' -ForegroundColor Cyan
Write-Host 'A senha sera criptografada pelo Windows para este usuario e este computador.' -ForegroundColor DarkGray
Write-Host ''

$hostFtp = Read-Required 'Servidor FTP/FTPS da HostGator (ex.: ftp.seudominio.com.br)'
$usuario = Read-Required 'Usuario FTP/FTPS'
$senha = Read-Host 'Senha FTP/FTPS' -AsSecureString
$remotePath = Read-Required 'Pasta remota do ERP' '/erp-teste.synergias.com.br'
$tlsResposta = Read-Host 'Usar FTPS/TLS? [S/n]'
$useTls = -not ($tlsResposta -match '^[Nn]$')
$portDefault = if ($useTls) { '21' } else { '21' }
$port = [int](Read-Required 'Porta FTP/FTPS' $portDefault)

$config = [pscustomobject]@{
    Host = $hostFtp
    Port = $port
    Username = $usuario
    Password = ($senha | ConvertFrom-SecureString)
    RemotePath = '/' + $remotePath.Trim('/').Replace('\\','/')
    UseTls = $useTls
    PublicUrl = 'https://erp-teste.synergias.com.br/'
    ProjectRoot = $project
    UpdatedAt = (Get-Date).ToString('o')
}

$config | Export-Clixml -Path $configFile

Write-Host ''
Write-Host "Configuracao salva em: $configFile" -ForegroundColor Green
Write-Host 'Agora o deploy pode ser executado sem digitar a senha novamente.' -ForegroundColor Green
Write-Host ''
Write-Host 'COMANDO DE PUBLICACAO:' -ForegroundColor Yellow
Write-Host 'powershell -ExecutionPolicy Bypass -File .\PUBLICAR-ERP.ps1' -ForegroundColor White
