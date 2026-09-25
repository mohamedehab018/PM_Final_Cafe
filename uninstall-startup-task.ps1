# شغّله كـ Administrator لو عايز تلغي التشغيل التلقائي.
Unregister-ScheduledTask -TaskName 'PM Cafe Auto Start' -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "تم إلغاء التشغيل التلقائي بتاع PM Cafe."
