# BusNext Database Setup Script (run from PowerShell; Docker Engine must be available in WSL)

Write-Host "=== BusNext Database Setup ===" -ForegroundColor Cyan
Write-Host "This script uses Docker Engine through WSL; Docker Desktop is not required." -ForegroundColor Gray
Write-Host ""

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) {
    Write-Host "WSL is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$projectRootWsl = (wsl.exe wslpath -a ($projectRoot -replace '\\','/') | Out-String).Trim()
if (-not $projectRootWsl) {
    Write-Host "Could not translate project path to WSL." -ForegroundColor Red
    exit 1
}

Write-Host "Starting PostgreSQL/PostGIS and Redis in WSL..." -ForegroundColor Yellow
wsl.exe bash -lc "cd '$projectRootWsl' && sudo service docker start >/dev/null 2>&1 || true; docker compose up -d postgres redis"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start backend containers." -ForegroundColor Red
    exit 1
}

Write-Host "Waiting for PostgreSQL..." -ForegroundColor Yellow
$ready = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    wsl.exe bash -lc "cd '$projectRootWsl' && docker compose exec -T postgres pg_isready -U busnext -d busnext >/dev/null 2>&1"
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    Write-Host "PostgreSQL did not become ready. Check: wsl bash -lc 'cd $projectRootWsl && docker compose logs postgres'" -ForegroundColor Red
    exit 1
}

Write-Host "Running Laravel migrations and demo seed..." -ForegroundColor Yellow
wsl.exe bash -lc "cd '$projectRootWsl/backend' && composer install --no-interaction && test -f .env || cp .env.example .env; php artisan key:generate --force; php artisan migrate:fresh --seed"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Laravel setup failed." -ForegroundColor Red
    exit 1
}

Write-Host "Backend database is ready." -ForegroundColor Green
Write-Host "Database: busnext / User: busnext / Password: busnext" -ForegroundColor White
Write-Host "Run API from WSL: cd $projectRootWsl/backend; php artisan serve --host=0.0.0.0 --port=8000" -ForegroundColor White

