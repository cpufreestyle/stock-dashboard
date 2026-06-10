# Stock Dashboard 本地服务器
# 用于本地测试 Dashboard

$port = 8080
$dashboardDir = "C:\Users\michael\.qclaw\workspace\wiki\stock-dashboard"

Write-Host "启动 Stock Dashboard 服务器..." -ForegroundColor Green
Write-Host "访问地址: http://localhost:$port" -ForegroundColor Cyan
Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Yellow
Write-Host ""

# 使用 Python 的 http.server
Set-Location $dashboardDir
python -m http.server $port
