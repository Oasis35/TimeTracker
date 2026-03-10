param(
    [string]$ArchivePath
)

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
$composeFile = Join-Path $rootDir "docker-compose.prod.yml"

if (-not $ArchivePath) {
    $ArchivePath = Join-Path $rootDir "timetracker-app-prod.tar"
}

docker image load -i $ArchivePath
docker compose -f $composeFile up -d --no-build

Write-Host "Stack started. Open http://localhost:8088"
