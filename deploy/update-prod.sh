#!/usr/bin/env bash
# 生产环境日常更新：拉代码 → 编译 → 重启（在服务器上执行）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> git pull"
git pull

echo "==> make"
make -j"$(nproc)"

echo "==> restart vibeoj (production.env)"
if systemctl is-active --quiet vibeoj 2>/dev/null; then
    sudo systemctl restart vibeoj
    sudo systemctl status vibeoj --no-pager -l | head -15
else
    echo "systemd 服务未安装，使用 production.env 前台测试："
    echo "  VIBEOJ_ENV=production bash deploy/start.sh"
fi

echo "==> 完成。访问 https://${DOMAIN:-rinr.top} 或 production.env 中的 PUBLIC_IP"
