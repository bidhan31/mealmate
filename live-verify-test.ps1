$ts = (Get-Date).ToString('HHmmss')
$email = "live-$ts@mealmate.live"
$rbody = @{ name = "Verify Test"; email = $email; password = "Test1234!" } | ConvertTo-Json -Compress
$rbody | Set-Content -Path "$env:TEMP\rvr.json"

Write-Output "=== REGISTER ==="
$reg = curl.exe -s -X POST https://mealmate-nv30.onrender.com/api/auth/register -H 'Content-Type: application/json' --data "@$env:TEMP\rvr.json"
$json = $reg | ConvertFrom-Json
$url = $json.data.verificationUrl
$token = ($url -split 'token=')[-1]

Write-Output "verificationUrl=$url"
Write-Output "token=$token"

Write-Output '=== VERIFY (via Vercel proxy) ==='
@{ token = $token } | ConvertTo-Json -Compress | Set-Content -Path "$env:TEMP\vcode.json"
curl.exe -s -X POST https://mealmate-client-three.vercel.app/api/auth/verify-email -H 'Content-Type: application/json' --data "@$env:TEMP\vcode.json"
Write-Output ''

Write-Output '=== LOGIN AFTER VERIFY (via Vercel proxy) ==='
@{ email = $email; password = "Test1234!" } | ConvertTo-Json -Compress | Set-Content -Path "$env:TEMP\vlogin.json"
curl.exe -s -X POST https://mealmate-client-three.vercel.app/api/auth/login -H 'Content-Type: application/json' --data "@$env:TEMP\vlogin.json"
Write-Output ''
