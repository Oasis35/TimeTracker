param(
    [string]$ArchivePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-DockerCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    Write-Host "==> $Label"
    Write-Host "docker $($Arguments -join ' ')"
    & docker @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed: docker $($Arguments -join ' ')"
    }
}

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
$composeFile = Join-Path $rootDir "docker-compose.prod.yml"

if (-not $ArchivePath) {
    $ArchivePath = Join-Path $rootDir "timetracker-app-prod.tar"
}

if (-not (Test-Path $ArchivePath)) {
    throw "Archive not found: $ArchivePath"
}

Write-Host "Root directory: $rootDir"
Write-Host "Compose file: $composeFile"
Write-Host "Archive path: $ArchivePath"

Invoke-DockerCommand -Arguments @("image", "load", "-i", $ArchivePath) -Label "Loading Docker image archive"
Invoke-DockerCommand -Arguments @("compose", "-f", $composeFile, "up", "-d", "--no-build") -Label "Starting container"

Write-Host "Stack started. Open http://localhost:8088"
