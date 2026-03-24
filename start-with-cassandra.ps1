# ========================================
# LiteNote + Cassandra 启动脚本 (PowerShell 版本)
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LiteNote Analytics System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Docker 是否运行
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker 未运行"
    }
    Write-Host "Docker 正在运行。" -ForegroundColor Green
} catch {
    Write-Host "错误: Docker 未运行，请先启动 Docker Desktop" -ForegroundColor Red
    exit 1
}

# 启动 Cassandra
Write-Host "正在启动 Cassandra..." -ForegroundColor Yellow
Set-Location -Path "cassandra"
docker-compose up -d

# 等待 Cassandra 启动
Write-Host "等待 Cassandra 启动（约30秒）..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# 检查 Cassandra 状态
Write-Host "检查 Cassandra 状态..." -ForegroundColor Yellow
docker-compose ps

# 返回项目根目录
Set-Location -Path ".."

# 启动 Next.js 应用
Write-Host "" 
Write-Host "正在启动 Next.js 应用..." -ForegroundColor Yellow
npm run dev