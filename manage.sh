#!/bin/bash
# =============================================
# 晚安 · 服务器管理脚本
# =============================================

APP_DIR="/opt/wanan"
APP_NAME="wanan"

case "$1" in
  start)
    echo "启动服务..."
    cd $APP_DIR && pm2 start server.js --name $APP_NAME
    ;;
  stop)
    echo "停止服务..."
    pm2 stop $APP_NAME
    ;;
  restart)
    echo "重启服务..."
    pm2 restart $APP_NAME
    ;;
  status)
    pm2 status $APP_NAME
    ;;
  logs)
    pm2 logs $APP_NAME --lines 50
    ;;
  clean-logs)
    pm2 flush
    echo "日志已清理"
    ;;
  *)
    echo "用法: ./manage.sh {start|stop|restart|status|logs|clean-logs}"
    exit 1
    ;;
esac
