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

Write-Host "Root directory: $rootDir"
Write-Host "Compose file: $composeFile"
Write-Host "Archive path: $ArchivePath"

Invoke-DockerCommand -Arguments @("compose", "-f", $composeFile, "build") -Label "Building production image"
Invoke-DockerCommand -Arguments @("image", "save", "-o", $ArchivePath, "timetracker-app:prod") -Label "Exporting Docker image archive"

Write-Host "Archive created: $ArchivePath"
Write-Host "Import it on the target machine with: docker image load -i $ArchivePath"
