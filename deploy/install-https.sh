#!/usr/bin/env bash
# 使用阿里云下载的 SSL 证书启用 HTTPS（需要 sudo）
#
# 准备工作（阿里云控制台）：
#   1. SSL 证书 → 已签发 → 下载 → 服务器类型选「Nginx」
#   2. 得到 xxx.pem（证书）和 xxx.key（私钥）
#   3. 上传到本目录并重命名：
#        deploy/ssl/rinr.top.pem
#        deploy/ssl/rinr.top.key
#   4. 执行: sudo bash deploy/install-https.sh
set -euo pipefail

ROOT="/home/user1/VibeCoding_oj"
DEPLOY="$ROOT/deploy"
PROD_ENV="$DEPLOY/production.env"
SSL_DIR="$DEPLOY/ssl"

test -f "$PROD_ENV" || { echo "缺少 $PROD_ENV"; exit 1; }
set -a
# shellcheck disable=SC1090
source "$PROD_ENV"
set +a

: "${DOMAIN:?请在 production.env 设置 DOMAIN=rinr.top}"
SERVER_NAME="${DOMAIN} www.${DOMAIN}"
CERT_SRC="${SSL_CERT_SRC:-$SSL_DIR/${DOMAIN}.pem}"
KEY_SRC="${SSL_KEY_SRC:-$SSL_DIR/${DOMAIN}.key}"
CERT_DST="/etc/nginx/ssl/${DOMAIN}.pem"
KEY_DST="/etc/nginx/ssl/${DOMAIN}.key"

echo "==> [1/4] 检查证书文件..."
if [ ! -f "$CERT_SRC" ] || [ ! -f "$KEY_SRC" ]; then
    echo "错误: 未找到证书文件，请先上传：" >&2
    echo "  $CERT_SRC" >&2
    echo "  $KEY_SRC" >&2
    echo "" >&2
    echo "阿里云下载 Nginx 格式后，放到 deploy/ssl/ 并重命名为 ${DOMAIN}.pem / ${DOMAIN}.key" >&2
    exit 1
fi

echo "==> [2/4] 安装证书到 /etc/nginx/ssl/ ..."
mkdir -p /etc/nginx/ssl
cp "$CERT_SRC" "$CERT_DST"
cp "$KEY_SRC" "$KEY_DST"
chmod 644 "$CERT_DST"
chmod 600 "$KEY_DST"

echo "==> [3/4] 生成 Nginx HTTPS 配置..."
sed -e "s|__SERVER_NAME__|${SERVER_NAME}|g" \
    -e "s|__SSL_CERT__|${CERT_DST}|g" \
    -e "s|__SSL_KEY__|${KEY_DST}|g" \
    "$DEPLOY/nginx-vibeoj-ssl.conf.template" > /tmp/vibeoj-nginx-ssl
cp /tmp/vibeoj-nginx-ssl /etc/nginx/sites-available/vibeoj
ln -sf /etc/nginx/sites-available/vibeoj /etc/nginx/sites-enabled/vibeoj
rm -f /etc/nginx/sites-enabled/default

echo "==> [4/4] 测试并重载 Nginx..."
nginx -t
systemctl reload nginx

echo ""
echo "=========================================="
echo "  HTTPS 已启用（阿里云证书）"
echo "  访问: https://${DOMAIN}"
echo "  请确认阿里云安全组已放行 443"
echo "=========================================="
