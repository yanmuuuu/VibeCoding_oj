#!/usr/bin/env bash
# 生产环境首次安装 / 重装 Nginx + systemd（需要 sudo）
set -euo pipefail

ROOT="/home/user1/VibeCoding_oj"
DEPLOY="$ROOT/deploy"
PROD_ENV="$DEPLOY/production.env"

echo "==> [1/6] 检查环境与配置..."
test -x "$ROOT/vibeoj" || { echo "错误: 请先 cd $ROOT && make"; exit 1; }
test -f "$PROD_ENV" || { echo "错误: 缺少 $PROD_ENV，请从 config.example.env 复制并填写"; exit 1; }
chmod +x "$DEPLOY/start.sh" "$DEPLOY/update-prod.sh"

set -a
# shellcheck disable=SC1090
source "$PROD_ENV"
set +a

: "${DOMAIN:?请在 production.env 中设置 DOMAIN=rinr.top}"
SERVER_NAME="${DOMAIN} www.${DOMAIN}"

echo "==> [2/6] 生成 Nginx 配置（域名: ${SERVER_NAME}）..."
sed "s/__SERVER_NAME__/${SERVER_NAME}/" "$DEPLOY/nginx-vibeoj.conf.template" > /tmp/vibeoj.nginx
cp /tmp/vibeoj.nginx /etc/nginx/sites-available/vibeoj
ln -sf /etc/nginx/sites-available/vibeoj /etc/nginx/sites-enabled/vibeoj
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> [3/6] 安装 systemd 服务..."
cp "$DEPLOY/vibeoj.system.service" /etc/systemd/system/vibeoj.service
mkdir -p /tmp/oj "$ROOT/logs"
chown -R user1:user1 "$ROOT/web/backgrounds" "$ROOT/web/avatars" "$ROOT/logs" 2>/dev/null || true
chmod 755 /tmp/oj

echo "==> [4/6] 启用并启动 vibeoj..."
systemctl daemon-reload
systemctl enable vibeoj
systemctl restart vibeoj

echo "==> [5/6] 设置登出后仍运行..."
loginctl enable-linger user1 2>/dev/null || true

echo "==> [6/6] 完成"
echo ""
echo "=========================================="
echo "  MioOJ 生产环境已就绪"
echo "  域名: http://${DOMAIN}"
echo "  公网 IP: http://${PUBLIC_IP:-（未设置 PUBLIC_IP）}"
echo "  更新代码: bash deploy/update-prod.sh"
echo "=========================================="
