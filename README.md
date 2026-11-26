# MioOJ

仿 LeetCode 的 C++ 在线判题系统（ACM 模式：标准输入 / 标准输出）。

**线上地址：** [https://rinr.top](https://rinr.top)

---

## 技术栈

| 层 | 选型 |
|----|------|
| 后端 | C++17，单进程 `vibeoj`（[cpp-httplib](https://github.com/yhirose/cpp-httplib) 同时提供 REST API 与静态文件） |
| 数据库 | MySQL，自研连接池（`mysql_ping` 健康检查 + 获取超时） |
| 认证 | Argon2id 密码哈希，随机 token 写入 `sessions`，Cookie 维持登录态 |
| 判题 | `/usr/bin/g++ -O2 -std=c++17` 编译，线程池调度；每题 `fork` 子进程，`setrlimit` 限制 CPU / 内存 / 输出 |
| 模板 | ctemplate 渲染初始 HTML 骨架 |
| 前端 | 原生 HTML / CSS / JS，Hash 路由 SPA，无 npm 构建；代码编辑用 ACE Editor |
| 部署 | Nginx 反代 + systemd 常驻 + Certbot（Let's Encrypt）HTTPS |

对外品牌名是 **MioOJ**。二进制、数据库和 systemd 服务名仍是 `vibeoj`。

---

## 功能

- **做题：** 题目列表（编号、标题、难度、通过率）、搜索与难度筛选、题目详情、公开样例（多组样例用单独一行 `---` 分隔，可复制）
- **判题：** 提交 C++ 后异步判题，结果为 AC / WA / TLE / MLE / RE / CE / SE；默认首个非 AC 后停止，也可勾选「跑完全部测试点」。结果页用测试点网格展示状态、耗时和内存，不展示隐藏数据
- **练习：** 按难度的个人进度、近一年提交热力图、错题本、内置题单（全部 / 简单 / 中等 / 困难）
- **社区：** 讨论区与题目评论（Markdown、嵌套回复、点赞）、排行榜（简单 1 / 中等 2 / 困难 3，每题 AC 只计一次）、私信（未读角标、60 秒内撤回）、系统公告、他人公开主页
- **录题：** 用户提交题面，管理员补标程和测试用例后审核；通过后写入正式题库，可不立即公开
- **后台：** 统计、题目向导（基本信息 → 标程 → 测试用例）、标程一键生成期望输出、用户封禁与重置密码、公告与讨论管理
- **界面：** 默认相册风暗色主题，设置里可切到 LeetCode 白模式；确认框统一为站内弹窗。代码草稿按「用户 + 题目」存在本地，换账号不会串稿

用户可见题号是 `display_index`（从 0 起），和数据库自增 `id` 分开。

---

## 架构

```
浏览器 (Hash SPA)
    ↓ HTTPS
Nginx → vibeoj (:8080) → MySQL
              ↓
         判题线程池
         编译（限额）→ 每测试点 fork + setrlimit → 比对 stdout
```

- 前端静态资源在 `web/`，由同一进程直接提供
- 生产配置：`deploy/production.env`；本地：`deploy/local.env`（建议端口 8081）
- 密钥只放环境变量，不进 Git

---

## 快速开始

依赖：`g++`、`make`、MySQL、`libmysqlclient-dev`、`libargon2-dev`、`libctemplate`、OpenSSL、zlib。安装步骤见 [SPEC.md](SPEC.md) 第 14 节。

```bash
git clone git@github.com:yanmuuuu/VibeCoding_oj.git
cd VibeCoding_oj

cp deploy/config.example.env deploy/local.env
# 填写 VIBEOJ_DB_PASSWORD，本地建议 VIBEOJ_PORT=8081

make clean && make && make run-local
# http://127.0.0.1:8081
```

服务器更新：

```bash
git pull
bash deploy/update-prod.sh
```

运维命令（启停、日志、MySQL）见 [deploy/运维手册.md](deploy/运维手册.md)。

---

## 文档

| 文件 | 说明 |
|------|------|
| [SPEC.md](SPEC.md) | 需求、API、表结构、判题流程、验收标准 |
| [deploy/运维手册.md](deploy/运维手册.md) | 更新、暂停、重启、日志 |

---

## 作者

个人学习项目。[https://rinr.top](https://rinr.top)
