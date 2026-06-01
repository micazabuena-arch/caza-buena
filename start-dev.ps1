# Start Caza Buena — API + Website (requires XAMPP MySQL running)
Write-Host "Starting Caza Buena API (port 5000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev"

Start-Sleep -Seconds 2

Write-Host "Starting Caza Buena Website (port 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "Website:  http://localhost:5173" -ForegroundColor Green
Write-Host "Admin:    http://localhost:5173/admin/login" -ForegroundColor Green
Write-Host "API:      http://localhost:5000/api/health" -ForegroundColor Green
