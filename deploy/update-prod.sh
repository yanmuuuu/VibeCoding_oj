#!/usr/bin/env bash
# 生产环境日常更新：停服 → 拉代码 → 编译 → 重启（在服务器上执行）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SERVICE_ACTIVE=false
if systemctl is-active --quiet vibeoj 2>/dev/null; then
    SERVICE_ACTIVE=true
    echo "==> stop vibeoj (prevent port conflict during build)"
    sudo systemctl stop vibeoj
    sleep 1
fi

echo "==> git pull"
git pull

echo "==> make clean && make"
make clean
make -j"$(nproc)"

echo "==> start vibeoj"
if $SERVICE_ACTIVE; then
    sudo systemctl start vibeoj
    sudo systemctl status vibeoj --no-pager -l | head -15
else
    echo "systemd 服务未安装，使用 production.env 前台启动："
    VIBEOJ_ENV=production bash deploy/start.sh
fi

echo "==> 完成。访问 https://${DOMAIN:-rinr.top} 或 production.env 中的 PUBLIC_IP"
