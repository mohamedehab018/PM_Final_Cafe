# ============================================================================
# PM Cafe - تثبيت التشغيل التلقائي
# شغّل الملف ده *مرة واحدة بس* (كـ Administrator) عشان يسجّل عند وندوز إنه
# يشغّل start-cafe.ps1 أوتوماتيك كل ما جهاز الكاشير يفتح ويتم تسجيل الدخول.
# بعد كده، مش محتاج تشغّل أي حاجة يدوي تاني أبدًا.
# ============================================================================

$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "شغّل الملف ده كـ Administrator (كليك يمين -> Run as administrator)."
    exit 1
}

$projectRoot   = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript   = Join-Path $projectRoot 'start-cafe.ps1'
$taskName      = 'PM Cafe Auto Start'

if (-not (Test-Path -LiteralPath $startScript)) {
    Write-Error "مش لاقي start-cafe.ps1 في نفس الفولدر ده."
    exit 1
}

$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null

Write-Host "تم. PM Cafe هيشتغل أوتوماتيك كل مرة جهاز الكاشير يفتح ويتسجل دخول."
Write-Host "لو عايز تجرب المهمة دلوقتي من غير ما تعمل logout/login، شغّل:"
Write-Host "  Start-ScheduledTask -TaskName `"$taskName`""
