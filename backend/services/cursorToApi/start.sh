#!/bin/bash

# 设置环境变量
export GIN_MODE=debug
export PORT=3000

# 检查是否已经有服务在运行
if lsof -i:$PORT > /dev/null; then
    echo "Port $PORT is already in use. Stopping existing process..."
    kill $(lsof -t -i:$PORT)
    sleep 2
fi

# 编译并运行 Go 服务
echo "Starting Go server in debug mode..."
go run server.go 2>&1 | tee server.log 