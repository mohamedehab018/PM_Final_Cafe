# ============================================================================
# PM Cafe - Startup script (LAN mode, PostgreSQL)
# شغّل الباك إند والفرونت إند تلقائيًا على الشبكة المحلية، مقروء منه ملف .env
# بدل ما الباسورد يتكتب صريح هنا. حط الملف ده في فولدر Cafe_Prpm (جنب index.html).
# ============================================================================

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Join-Path $projectRoot 'backend'
$envFile     = Join-Path $backendRoot '.env'

# ── سجل بداية التشغيل (مفيد لو حصلت مشكلة وعايز تعرف وقتها) ──────────────────
$logFile = Join-Path $projectRoot 'startup.log'
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting PM Cafe..." | Out-File -FilePath $logFile -Append

# ── 1) لاقي الـ Python بتاع الـ venv (venv أو .venv الاتنين مقبولين) ─────────
$pythonExe = $null
foreach ($venvName in @('.venv', 'venv')) {
    $candidate = Join-Path $backendRoot "$venvName\Scripts\python.exe"
    if (Test-Path -LiteralPath $candidate) {
        $pythonExe = $candidate
        break
    }
}
if (-not $pythonExe) {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: No venv found under backend\.venv or backend\venv." | Out-File -FilePath $logFile -Append
    Write-Error "مفيش venv موجود جوه backend\.venv أو backend\venv. شغّل الإعداد الأول مرة واحدة يدوي."
    exit 1
}

# ── 2) اقرا ملف .env وحط القيم كمتغيرات بيئة لهذه الجلسة بس ──────────────────
if (-not (Test-Path -LiteralPath $envFile)) {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: backend\.env not found." | Out-File -FilePath $logFile -Append
    Write-Error "ملف backend\.env مش موجود. انسخ .env.example وسمّيه .env واملأ بياناتك."
    exit 1
}
Get-Content -LiteralPath $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
        $parts = $line.Split('=', 2)
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

# ── 3) تأكد إن سيرفيس PostgreSQL شغّال؛ لو واقف حاول تشغّله ──────────────────
$pgService = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgService -and $pgService.Status -ne 'Running') {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] PostgreSQL service was stopped, starting it..." | Out-File -FilePath $logFile -Append
    try {
        Start-Service -Name $pgService.Name
        Start-Sleep -Seconds 3
    } catch {
        "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: could not start PostgreSQL service: $_" | Out-File -FilePath $logFile -Append
    }
}

# ── 4) طبّق أي migrations لسه ماتعملتش (آمن، مش بيمسح بيانات) ────────────────
Push-Location $backendRoot
try {
    & $pythonExe manage.py migrate --noinput 2>&1 | Out-File -FilePath $logFile -Append
} catch {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] WARNING: migrate step failed: $_" | Out-File -FilePath $logFile -Append
}
Pop-Location

# ── 5) شغّل الباك إند على الشبكة كلها (مش الجهاز ده بس) ──────────────────────
Start-Process -FilePath $pythonExe `
    -WorkingDirectory $backendRoot `
    -ArgumentList 'manage.py', 'runserver', '0.0.0.0:8010' `
    -WindowStyle Hidden

# ── 6) شغّل الفرونت إند على الشبكة كلها ──────────────────────────────────────
Start-Process -FilePath $pythonExe `
    -WorkingDirectory $projectRoot `
    -ArgumentList '-m', 'http.server', '5510', '--bind', '0.0.0.0' `
    -WindowStyle Hidden

Start-Sleep -Seconds 3
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] PM Cafe started (backend :8010, frontend :5510)." | Out-File -FilePath $logFile -Append

# ── 7) افتح المتصفح على جهاز الكاشير نفسه بس (مفيدة لو التشغيل يدوي، مش هتعمل حاجة لو تشغيل تلقائي بدون شاشة) ──
Start-Process 'http://127.0.0.1:5510'
