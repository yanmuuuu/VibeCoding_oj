# MioOJ 部署

**完整运维说明见：[运维手册.md](./运维手册.md)**（更新、暂停、重启、日志、MySQL 等）

## 快速命令

| 文件 | 用途 | 是否提交 Git |
|------|------|-------------|
| `deploy/config.example.env` | 配置模板 | 是 |
| `deploy/local.env` | 本地测试 | **否** |
| `deploy/production.env` | 服务器生产 | **否** |

```bash
cp deploy/config.example.env deploy/local.env
# 编辑 local.env，填写 VIBEOJ_DB_PASSWORD
make run-local          # 本地测试 → http://127.0.0.1:8080
```

## 生产环境（服务器）

`deploy/production.env` 示例：

```bash
VIBEOJ_DB_PASSWORD=...
DOMAIN=rinr.top
PUBLIC_IP=你的公网IP
```

```bash
# 首次部署
sudo bash deploy/install.sh

# 日常更新（拉代码 + 编译 + 重启）
bash deploy/update-prod.sh
```

## HTTPS（可选，需域名解析到服务器）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d rinr.top -d www.rinr.top
```

## 常用命令

```bash
sudo systemctl stop|start|restart vibeoj
sudo journalctl -u vibeoj -f
```
