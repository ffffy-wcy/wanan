#!/bin/bash
# =============================================
# 晚安 · Oracle Cloud 免费服务器一键部署脚本
# =============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   晚安 · Oracle Cloud 一键部署脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检测是否以 root 运行
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}请使用 sudo 运行此脚本${NC}"
  echo "示例: sudo bash deploy.sh"
  exit 1
fi

# 1. 更新系统并安装 Node.js
echo -e "${YELLOW}[1/6] 安装系统依赖...${NC}"
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx git

# 2. 创建应用目录
echo -e "${YELLOW}[2/6] 创建应用目录...${NC}"
APP_DIR="/opt/wanan"
mkdir -p $APP_DIR/data
cd $APP_DIR

# 3. 创建 package.json
echo -e "${YELLOW}[3/6] 初始化项目...${NC}"
cat > package.json << 'EOF'
{
  "name": "wanan",
  "version": "1.0.0",
  "description": "晚安 · 异地情侣数据同步",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "restart": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "cors": "^2.8.5"
  }
}
EOF

# 4. 创建 server.js（复制当前目录的）
echo -e "${YELLOW}[4/6] 复制服务端代码...${NC}"
if [ -f "/root/server.js" ]; then
    cp /root/server.js $APP_DIR/server.js
elif [ -f "$(dirname "$0")/server.js" ]; then
    cp "$(dirname "$0")/server.js" $APP_DIR/server.js
else
    echo -e "${RED}未找到 server.js，请先将项目文件上传到服务器${NC}"
    echo "可以使用 scp 命令上传:"
    echo "  scp -r ./user@your-server:/opt/wanan"
    exit 1
fi

# 5. 安装依赖
echo -e "${YELLOW}[5/6] 安装 Node.js 依赖...${NC}"
npm install

# 6. 配置防火墙
echo -e "${YELLOW}[6/6] 配置防火墙...${NC}"
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # App 端口
ufw --force enable

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}启动服务:${NC}"
echo "  cd $APP_DIR && npm start"
echo ""
echo -e "${BLUE}或者使用 PM2（后台运行，推荐）:${NC}"
echo "  npm install -g pm2"
echo "  pm2 start $APP_DIR/server.js --name wanan"
echo "  pm2 save"
echo "  pm2 startup"
echo ""
echo -e "${BLUE}查看日志:${NC}"
echo "  pm2 logs wanan"
echo ""
echo -e "${BLUE}重启服务:${NC}"
echo "  pm2 restart wanan"
echo ""
echo -e "${YELLOW}如果需要配置域名和 HTTPS:${NC}"
echo "  1. 在 DNS 服务商添加 A 记录指向服务器 IP"
echo "  2. 运行: certbot --nginx -d your-domain.com"
echo "  3. 重启 nginx: systemctl restart nginx"
echo ""
