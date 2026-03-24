#!/bin/bash

# ========================================
# LiteNote + Cassandra 启动脚本
# ========================================

echo "========================================"
echo "LiteNote Analytics System"
echo "========================================"
echo ""

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
  echo "错误: Docker未运行，请先启动Docker Desktop"
  exit 1
fi

# 启动Cassandra
echo "正在启动Cassandra..."
cd cassandra
docker-compose up -d

# 等待Cassandra启动
echo "等待Cassandra启动（约30秒）..."
sleep 30

# 检查Cassandra状态
echo "检查Cassandra状态..."
docker-compose ps

# 返回项目根目录
cd ..

# 启动Next.js应用
echo ""
echo "正在启动Next.js应用..."
npm run dev
