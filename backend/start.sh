#!/bin/bash

# 安装必要的系统依赖
echo "Installing system dependencies..."
pkg update -y
pkg upgrade -y
pkg install -y openssl nodejs

# 检查 node 是否安装
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# 安装依赖
echo "Installing dependencies..."
npm install --yes

# 启动服务器
echo "Starting server..."
node server.js
