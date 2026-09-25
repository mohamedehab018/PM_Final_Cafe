# ============================================================================
# PM Cafe - Stop script
# بيوقف بس عمليات Python اللي شغّالة الباك إند (manage.py runserver) والفرونت
# إند (http.server) بتوع PM Cafe، من غير ما يلمس أي عملية Python تانية على
# الجهاز (زي إضافات VS Code مثلًا).
# ============================================================================

$stopped = 0
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | ForEach-Object {
    if ($_.CommandLine -match 'manage\.py\s+runserver' -or $_.CommandLine -match 'http\.server\s+5510') {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        $stopped++
    }
}
Write-Host "$stopped عملية(عمليات) بتاعت PM Cafe اتوقفت."
