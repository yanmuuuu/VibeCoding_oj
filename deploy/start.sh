#!/usr/bin/env bash
# 启动脚本：按环境加载 deploy/*.env 后运行 vibeoj
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p /tmp/oj logs

pick_env_file() {
    if [ -n "${VIBEOJ_ENV_FILE:-}" ] && [ -f "$VIBEOJ_ENV_FILE" ]; then
        echo "$VIBEOJ_ENV_FILE"
        return
    fi
    if [ "${VIBEOJ_ENV:-}" = "local" ]; then
        if [ -f "$ROOT/deploy/local.env" ]; then
            echo "$ROOT/deploy/local.env"
            return
        fi
        echo "deploy/local.env not found. Run: cp deploy/config.example.env deploy/local.env && edit VIBEOJ_DB_PASSWORD" >&2
        exit 1
    fi
    if [ -f "$ROOT/deploy/production.env" ] && [ "${VIBEOJ_ENV:-}" != "local" ]; then
        echo "$ROOT/deploy/production.env"
        return
    fi
    if [ -f "$ROOT/deploy/local.env" ]; then
        echo "$ROOT/deploy/local.env"
        return
    fi
    echo "$ROOT/deploy/config.example.env"
}

ENV_FILE="$(pick_env_file)"
if [ ! -f "$ENV_FILE" ]; then
    echo "Missing env file. Run: cp deploy/config.example.env deploy/local.env" >&2
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# 防止同时启动两个实例导致端口冲突
PORT="${VIBEOJ_PORT:-8080}"
if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
    echo "ERROR: Port ${PORT} is already in use. Another vibeoj instance may be running." >&2
    echo "  Check: sudo systemctl status vibeoj" >&2
    echo "  Or:    ss -tlnp | grep :${PORT}" >&2
    exit 1
fi

exec "$ROOT/vibeoj"
