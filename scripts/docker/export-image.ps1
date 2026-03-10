param(
    [string]$ArchivePath
)

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
$composeFile = Join-Path $rootDir "docker-compose.prod.yml"

if (-not $ArchivePath) {
    $ArchivePath = Join-Path $rootDir "timetracker-app-prod.tar"
}

docker compose -f $composeFile build
docker image save -o $ArchivePath timetracker-app:prod

Write-Host "Archive created: $ArchivePath"
Write-Host "Import it on the target machine with: docker image load -i $ArchivePath"
