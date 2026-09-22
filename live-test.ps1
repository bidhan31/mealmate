$ts = (Get-Date).ToString('HHmmss')
$email = "live-$ts@mealmate.live"
$body = @{ name = "Live Test"; email = $email; password = "Test1234!" } | ConvertTo-Json -Compress
$body | Set-Content -Path "$env:TEMP\lr.json"

Write-Output "=== REGISTER (live-$ts) ==="
curl.exe -s -X POST https://mealmate-nv30.onrender.com/api/auth/register -H 'Content-Type: application/json' --data "@$env:TEMP\lr.json"
Write-Output ''

Write-Output "=== LOGIN (live-$ts) ==="
$login = @{ email = $email; password = "Test1234!" } | ConvertTo-Json -Compress
$login | Set-Content -Path "$env:TEMP\ll.json"
curl.exe -s -X POST https://mealmate-nv30.onrender.com/api/auth/login -H 'Content-Type: application/json' --data "@$env:TEMP\ll.json"
Write-Output ''
