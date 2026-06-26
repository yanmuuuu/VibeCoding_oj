# MioOJ

> 一个由**程序员 × AI 双向奔赴**完成的在线判题系统 —— 我负责想清楚、验收到位、推上线；AI 负责加速实现与迭代。

**线上体验：** https://rinr.top

---

## 这是什么

**MioOJ** 是一个仿 LeetCode 的 C++ 在线判题平台（ACM 模式：标准输入/输出），包含：

- 题目浏览、代码提交、自动判题（AC / WA / TLE / MLE / RE / CE）
- 用户系统、排行榜、讨论区、私信、公告
- 管理员后台：录题向导、标程生成、测试用例、用户/讨论管理
- 相册风 / LeetCode 白模式双主题 UI

技术栈：**C++ (cpp-httplib) + MySQL + 原生 JS SPA + ACE Editor**，单机 Nginx + HTTPS 部署。

---

## 人机协作：我的角色 vs AI 的角色

这个项目不是「AI 一键生成」，而是**我主导、AI 结对**：

| 我（程序员）负责 | AI（Cursor）辅助 |
|------------------|------------------|
| 产品方向：要做什么 OJ、哪些功能优先 | 根据 SPEC 快速出骨架与接口 |
| 写/维护 **SPEC.md**：需求、表结构、验收标准 | 按 SPEC 实现 handler、前端页面、SQL 迁移 |
| 关键决策：判题模型、安全边界、部署架构 | 排查 bug、补边界 case、改 Nginx/systemd |
| 验收：AC 标准、UI 细节、录题流程是否顺手 | 重构、统一弹窗、按用户隔离代码草稿 |
| **部署上线**：域名、HTTPS、服务器运维 | 生成 `deploy/` 脚本与运维文档 |
| 面试叙事、文档、Git 管理 | 解释原理、写 interview 参考答案 |

**双向奔赴**的含义：不是我丢一句话就完事，也不是 AI 替我写 spec —— 而是我不断**提需求、纠偏差、验结果**，AI 在循环里**实现、修复、文档化**，最终把 MioOJ 从 SPEC 推到 **https://rinr.top** 真正跑起来。

---

## 架构一览

```
浏览器 (Hash SPA)
    ↓ HTTPS
Nginx → vibeoj(:8080) → MySQL
              ↓
         判题引擎 (fork + setrlimit + 线程池)
```

- 前端：`web/` 静态资源，无 npm 构建
- 后端：单二进制 `vibeoj`，API + 静态文件一体
- 配置：`deploy/production.env`（生产）/ `deploy/local.env`（本地 8081）

---

## 快速开始

### 克隆与依赖

```bash
git clone git@github.com:yanmuuuu/VibeCoding_oj.git
cd VibeCoding_oj
# 依赖：g++、make、MySQL、libmysqlclient-dev、libargon2-dev、ctemplate 等
# 详见 SPEC.md 第 14 节
```

### 本地试跑

```bash
cp deploy/config.example.env deploy/local.env
# 编辑 local.env 填写 VIBEOJ_DB_PASSWORD，建议 VIBEOJ_PORT=8081

make clean && make && make run-local
# → http://127.0.0.1:8081
```

### 生产更新（服务器）

```bash
git pull
bash deploy/update-prod.sh
```

更多：**[deploy/运维手册.md](deploy/运维手册.md)**

---

## 文档索引

| 文件 | 说明 |
|------|------|
| [SPEC.md](SPEC.md) | 完整需求、API、表结构、Phase 记录、验收标准 |
| [interview.md](interview.md) | 面试可能问到的问题与参考答案 |
| [deploy/运维手册.md](deploy/运维手册.md) | 更新、暂停、重启、日志、MySQL |

---

## 功能亮点（面试可讲）

1. **自研判题管道**：编译 → 多测试点 fork 运行 → 输出比对，线程池并发
2. **安全约束**：`setrlimit` 限制 CPU/内存，判题进程隔离（学习级沙箱）
3. **录题闭环**：Markdown 描述 + ACE 标程 + 一键生成期望输出 + 发布校验
4. **工程化部署**：环境变量隔离密钥、systemd 常驻、Certbot HTTPS
5. **体验细节**：代码草稿按用户隔离、统一 mio-dialog、display_index 从 0 起

---

## 作者

个人学习项目，欢迎 Issue / Star。

**开发方式：** 需求与验收在我，实现与迭代在人机协作中完成 —— 这是 Vibe Coding，也是 MioOJ 真实的诞生方式。
