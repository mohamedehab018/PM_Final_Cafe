# Starts the complete local demo using the included SQLite development database.
# PostgreSQL remains configured for production in backend/.env.example.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Join-Path $projectRoot 'backend'
$venvRoot = Join-Path $backendRoot '.venv'
$pythonExe = Join-Path $venvRoot 'Scripts\python.exe'

if (-not (Test-Path -LiteralPath $pythonExe)) {
    python -m venv $venvRoot
    & $pythonExe -m pip install -r (Join-Path $backendRoot 'requirements.txt')
}

Push-Location $backendRoot
$env:PM_CAFE_SQLITE = '1'
& $pythonExe manage.py migrate --noinput
& $pythonExe manage.py seed_cafe
Pop-Location

Start-Process -FilePath $pythonExe -WorkingDirectory $backendRoot -ArgumentList 'manage.py', 'runserver', '127.0.0.1:8010' -WindowStyle Hidden
Start-Process -FilePath $pythonExe -WorkingDirectory $projectRoot -ArgumentList '-m', 'http.server', '5510' -WindowStyle Hidden
Start-Sleep -Seconds 2
Start-Process 'http://127.0.0.1:5510'
