# SPEC.md — VibeOJ 仿 LeetCode OJ 系统

## 1. 项目概述

| 属性 | 值 |
|---|---|
| **项目名称** | VibeOJ |
| **定位** | 个人学习项目 |
| **模式** | ACM（stdin/stdout），仅 C++ |
| **前端** | 原生 HTML + CSS + JS（SPA + Hash 路由）+ ACE Editor (CDN) |
| **后端** | C++ (cpp-httplib) 一体化：API Server + 静态文件 + ctemplate 模板 |
| **数据库** | MySQL |
| **部署** | 单机 |

---

## 2. 核心功能（MVP）

### 2.1 用户系统
- 注册：用户名 + 密码（Argon2id 哈希存储）
- 登录：验证密码 → 生成随机 Token → 写入 `sessions` 表 → Set-Cookie 返回
- 退出：清除 Cookie + 删除 sessions 记录
- 管理员：`users.is_admin` 字段区分，可登录后台管理页
- 每次请求从 Cookie 读 token 查 `sessions` 表校验登录态
- **账号规则**（仅注册时校验）：
  - 用户名：≥3 字符，≤64 字符（VARCHAR(64)）
  - 密码：≥8 字符，必须包含至少两种字符类型（数字 0-9、小写 a-z、大写 A-Z、特殊符号 `_` `-` (空格) `.` `@` `!` `#` `$` `%` `^` `&` `*` `+` `=` `~`）
  - 前后端双重校验，非法字符返回 400 并提示具体原因
  - 登录页仅校验非空，不校验长度/格式（避免泄露验证规则）

### 2.2 题目浏览
- 题目列表页：展示所有题目（编号、标题、难度）
- 搜索筛选：支持按标题关键词搜索 + 按难度下拉筛选（客户端实时过滤）
- 题目详情页：描述、输入/输出/样例、时间限制、内存限制

### 2.3 代码提交与判题
- 用户在题目详情页粘贴/编写代码 → 提交
- 后端接收代码 → 判题管道 → 返回结果
- 判题状态码：`AC` / `WA` / `TLE` / `MLE` / `RE` / `CE` / `SE`
- 结果页：**测试点方块网格** — 提交后跳转到 `#/result/:id`，N个彩色方块（7个/行），点击展开状态/耗时/内存（不展示测试数据，防泄题）

### 2.4 用户中心
- 我的提交历史列表（题目、状态、耗时/内存、时间），顶部显示提交统计（总次数/通过题数/尝试题数）
- 统计语义："通过" = 有 AC 记录的题目数，"尝试" = 有提交但无 AC 的题目数（二者互斥不重复计数）

### 2.5 后台管理（管理员）
- 题目 CRUD（创建、编辑、删除）
- 测试用例管理（每个题目下增删测试点，input/expected_output 分别存储）
- 管理页需要管理员权限

### 2.6 通用
- 404 页面（路由未匹配）
- 500 页面（服务器异常友好提示）
- 服务端 HTTP 异常处理：`set_error_handler` 返回 JSON 格式错误（对 API 消费者友好）；SPA Hash Router 渲染 `#/404` 和 `#/500` 客户端 HTML 错误页
- 后端错误信息中文化（大部分 API 响应 message 已中文化，少数边缘路径保留英文）
- 登录页仅提示"用户名或密码错误"，不区分具体原因（防枚举攻击）

---

## 3. 延迟功能（V2）

- 私信/消息系统
- 排行榜
- 通过率统计
- 多语言支持
- Docker 化部署

---

## 4. 架构图

```
┌─────────────────────────────────────────────────┐
│                    浏览器 (SPA)                    │
│         Hash Router (#/login, #/problems/1...)   │
└──────────────────────┬──────────────────────────┘
                       │ HTTP (Cookie: token)
                       ▼
┌─────────────────────────────────────────────────┐
│              cpp-httplib Server                   │
│  ┌───────────────┐  ┌──────────────────────────┐ │
│  │  静态文件服务   │  │     API Handlers          │ │
│  │  .html/.css/.js│  │  /api/login               │ │
│  │                │  │  /api/register            │ │
│  │                │  │  /api/problems/*          │ │
│  │                │  │  /api/submit              │ │
│  │                │  │  /api/result/:id          │ │
│  │                │  │  /api/admin/*             │ │
│  └───────────────┘  └───────────┬──────────────┘ │
│                                  │                │
│  ┌───────────────────────────────▼─────────────┐ │
│  │              判题引擎 (Judge Engine)          │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │  线程池 (ThreadPool)                      │ │ │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │ │ │
│  │  │  │Worker│ │Worker│ │Worker│ │Worker│   │ │ │
│  │  │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘   │ │ │
│  │  │     │ fork() │        │        │        │ │ │
│  │  │     ▼        ▼        ▼        ▼        │ │ │
│  │  │  compile ──► run ──► compare            │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │     MySQL       │
              │  - users        │
              │  - sessions     │
              │  - questions    │
              │  - test_cases   │
              │  - submissions  │
              └────────────────┘
```

---

## 5. 数据库表设计

### 5.1 users
```sql
CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(64)  NOT NULL UNIQUE,
    password_hash   VARCHAR(256) NOT NULL,          -- Argon2id
    is_admin        TINYINT(1)   NOT NULL DEFAULT 0,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 sessions
```sql
CREATE TABLE sessions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL,
    token       VARCHAR(128) NOT NULL UNIQUE,       -- SHA256 随机字符串
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 5.3 questions
```sql
CREATE TABLE questions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(256) NOT NULL,
    description     TEXT         NOT NULL,
    input_format    TEXT,                             -- 输入格式说明
    output_format   TEXT,                             -- 输出格式说明
    sample_input    TEXT,
    sample_output   TEXT,
    difficulty      ENUM('简单','中等','困难') NOT NULL DEFAULT '简单',  -- 难度分级（中文字段值）
    time_limit      INT          NOT NULL DEFAULT 1,   -- 秒
    memory_limit    INT          NOT NULL DEFAULT 256, -- MB
    is_visible      TINYINT(1)   NOT NULL DEFAULT 1,   -- 0=隐藏
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 5.4 test_cases
```sql
CREATE TABLE test_cases (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    question_id     INT  NOT NULL,
    input_data      TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    order_index     INT  NOT NULL DEFAULT 0,          -- 测试点顺序
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);
```

### 5.5 submissions
```sql
CREATE TABLE submissions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT          NOT NULL,
    question_id     INT          NOT NULL,
    code            TEXT         NOT NULL,
    status          ENUM('PENDING','COMPILING','RUNNING','AC','WA','TLE','MLE','RE','CE','SE') NOT NULL DEFAULT 'PENDING',
    compile_error   TEXT,                              -- CE 时的编译器输出
    total_time      INT,                               -- ms（最慢测试点）
    total_memory    INT,                               -- KB（最大内存测试点）
    passed_count    INT,                               -- 通过测试点数
    total_count     INT,                               -- 总测试点数
    detail_json     JSON,                              -- 每题点结果：[{index,status,time_ms,memory_kb}]（不存储输入/输出，防泄题）
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);
```

---

## 6. API 接口清单

### 6.1 认证

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| POST | `/api/register` | 注册 | 无 |
| POST | `/api/login` | 登录 | 无 |
| POST | `/api/logout` | 退出 | 需要 |

### 6.2 题目（公开）

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/problems` | 题目列表（仅 is_visible=1） | 需要 |
| GET | `/api/problems/:id` | 题目详情 | 需要 |

### 6.3 提交与结果

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| POST | `/api/submit` | 提交代码（body: {question_id, code}） | 需要 |
| GET | `/api/submissions/:id` | 获取单次提交详情（每题点状态/耗时/内存，不含输入输出） | 需要 |

### 6.4 用户中心

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/user/submissions` | 我的提交历史（分页） | 需要 |
| GET | `/api/user/problem-status` | 每题汇总提交状态（id, title, difficulty, solved, attempt_count） | 需要 |
| GET | `/api/user/profile` | 当前用户信息 | 需要 |
| GET | `/api/user/ac-code/:question_id` | 获取用户在某题下最新 AC 提交的代码（返回 {found, code}） | 需要 |
| GET | `/api/user/ac-codes/:question_id` | 获取用户在某题下所有 AC 提交的代码列表（返回 [{id, code, total_time, total_memory, created_at}]，按提交时间倒序） | 需要 |

### 6.5 管理员

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/admin/questions` | 题目列表（含隐藏题目） | 需要 + admin |
| GET | `/api/admin/questions/:id` | 单题详情（含隐藏题目） | 需要 + admin |
| POST | `/api/admin/questions` | 创建题目 | 需要 + admin |
| PUT | `/api/admin/questions/:id` | 编辑题目 | 需要 + admin |
| DELETE | `/api/admin/questions/:id` | 删除题目 | 需要 + admin |
| GET | `/api/admin/questions/:id/testcases` | 获取测试用例列表 | 需要 + admin |
| POST | `/api/admin/questions/:id/testcases` | 添加测试用例 | 需要 + admin |
| PUT | `/api/admin/questions/:id/testcases/:tc_id` | 编辑测试用例 | 需要 + admin |
| DELETE | `/api/admin/questions/:id/testcases/:tc_id` | 删除测试用例 | 需要 + admin |

---

## 7. 判题管道详细流程

```
用户提交代码 (POST /api/submit)
        │
        ▼
  ┌─ 写入 submissons 表 (status=PENDING) ─┐
  │                                         │
  ▼                                         │
  投递到线程池 Worker                         │
        │                                    │
        ▼                                    │
  ┌──────────────────────────────┐           │
  │ 1. 编译阶段 (COMPILING)        │           │
  │  - 写临时文件 /tmp/oj_xxx.cpp  │           │
  │  - g++ -O2 -std=c++17          │           │
  │  - 限制: 编译超时 10s          │           │
  │  - 限制: 二进制大小 ≤ 50MB    │           │
  │  - 失败 → 更新 status=CE       │           │
  │  - 存入 compile_error         │           │
  └──────────────┬───────────────┘           │
                 │ success                    │
                 ▼                            │
  ┌──────────────────────────────┐           │
│  2. 运行阶段 (RUNNING)          │           │
│  for each test_case:          │           │
│    - fork() 子进程             │           │
│    - setrlimit:                │           │
│      · RLIMIT_CPU = time_limit│           │
│      · RLIMIT_AS  = mem_limit │           │
│      · RLIMIT_CORE = 0        │           │
│      · RLIMIT_NPROC = 1       │           │
│      · RLIMIT_FSIZE = 10MB    │           │
│    - dup2 stdin → input_data   │           │
│    - dup2 stdout → output_buf │           │
│    - exec(binary)              │           │
│    - wait4 (WNOHANG 轮询 +      │           │
│      墙钟超时 time_limit+2s,    │           │
│      超时则 SIGKILL)            │           │
│    - 获取时间/内存/退出码       │           │
│    - 判断结果:                  │           │
│      · 超时 → TLE              │           │
│      · 内存超 → MLE            │           │
│      · 非0退出 → RE            │           │
│      · 输出 ≠ 期望 → WA        │           │
│      · 输出 = 期望 → AC ✅     │           │
│    - 遇到首个非AC结果 → 停止运行 │           │
│      剩余测试点（节省判题资源）   │           │
  │  any failure → 更新status=XX   │           │
  │  all pass → 更新status=AC     │           │
  └──────────────┬───────────────┘           │
                 │                            │
                 ▼                            │
   更新 submissions 表                          │
   (status, detail_json [{index,status,          │
    time_ms,memory_kb}],                         │
    total_time, total_memory,                    │
    passed_count, total_count)                   │
```

**setrlimit 限制矩阵：**

| rlimit | 软限制 | 硬限制 | 防御场景 |
|---|---|---|---|
| `RLIMIT_CPU` | time_limit 秒 | time_limit+1 秒 | 死循环、无限递归 |
| `RLIMIT_AS` | memory_limit MB | memory_limit+1 MB | 内存炸弹、大数组 |
| `RLIMIT_CORE` | 0 | 0 | 禁止 core dump 生成大文件 |
| `RLIMIT_NPROC` | 1 | 1 | 禁止 `fork()` 炸弹 |
| `RLIMIT_FSIZE` | 10MB | 10MB | 限制文件写入大小，同时允许正常输出

> **早期停止**：判题引擎遇到首个非 AC 结果后立即停止运行剩余测试点，`detail_json` 仅包含已运行的测试点结果。这样可以节省判题资源，但用户需要多次提交才能看到后续测试点的结果。

> **二进制大小检查**：Spec 要求限制二进制 ≤ 50MB，当前未实现（仅检查二进制是否存在）。后续版本计划补充。

---

## 8. 前端路由与页面（SPA + Hash）

| Hash 路由 | 页面 | 说明 |
|---|---|---|
| `#/` 或 `#/login` | 登录页 | 未登录默认 |
| `#/register` | 注册页 | |
| `#/problems` | 题目列表 | 需要登录 |
| `#/problems/:id` | 题目详情 + 提交区 | 左右分栏：左题目描述，右 ACE 代码编辑器 |
| `#/result/:submissionId` | 判题结果页 | 测试点方块网格 + 详情展开（提交后跳转到此页） |
| `#/user` | 用户中心 | 提交历史 |
| `#/admin` | 后台管理首页 | 仅管理员 |
| `#/admin/questions` | 题目管理 | |
| `#/admin/questions/:id` | 编辑题目 + 测试用例管理 | |
| `#/404` | 404 页面 | 路由未匹配 |
| `#/500` | 500 页面 | 服务器异常 |

> ctemplate 用于初始 HTML 骨架 `<head>/<script>` 注入，SPA 路由由前端 JS Hash Router 驱动。

---

## 9. 项目目录结构（实际实现）

```
VibeOJ/
├── SPEC.md
├── CMakeLists.txt                    # CMake 构建配置
├── Makefile                          # Makefile 构建配置（二选一）
├── vibeoj                            # 编译产物（二进制）
├── build/                            # CMake 构建目录
├── server/
│   ├── main.cpp                      # 入口：HTTP 服务 + 路由注册 + SPA 渲染
│   ├── config.hpp                    # 全局配置（端口 8080、数据库连接、默认限制）
│   ├── include/
│   │   └── httplib.h                # cpp-httplib (header-only)
│   ├── db/
│   │   ├── pool.hpp/.cpp            # MySQL 连接池（线程安全，RAII 封装）
│   │   ├── schema.sql               # 建表脚本（5 张表）
│   │   └── seed.sql                 # 种子数据（2 道示例题 + 15 个测试点）
│   ├── handler/
│   │   ├── auth.cpp                  # 注册（Argon2id 哈希）、登录（Token+Cookie）、退出
│   │   ├── problem.cpp               # 题目列表（仅 is_visible=1）、题目详情
│   │   ├── submission.cpp            # 提交代码 → 入库 → 投递判题引擎、结果查询
│   │   ├── user.cpp                  # 个人资料、提交历史（分页）
│   │   └── admin.cpp                 # 题目 CRUD + 测试用例 CRUD（admin 鉴权）
│   ├── judge/
│   │   ├── engine.hpp/.cpp           # 判题引擎：接收任务 → 编译 → 遍历测试点 → 运行 → 写结果
│   │   ├── compiler.hpp/.cpp         # 编译模块：临时文件 → g++ -O2 -std=c++17 → 超时 10s
│   │   ├── runner.hpp/.cpp           # 运行模块：fork → setrlimit → dup2 I/O → exec → wait4 → 比对
│   │   ├── threadpool.hpp/.cpp       # 线程池（4 个 Worker，condition_variable）
│   ├── middleware/
│   │   ├── auth.hpp                  # AuthUser 结构体定义
│   │   └── auth.cpp                  # Token 校验：Cookie 提取 → sessions 表查询 → 挂载用户
│   └── util/
│       ├── crypto.hpp/.cpp           # Argon2id 密码哈希、SHA256 Token 生成、OpenSSL 随机数
│       ├── json_extract.hpp          # 健壮 JSON 字符串/整数提取器（处理空格、转义字符）
│       └── tmpfile.hpp/.cpp          # 临时文件管理（mkstemps + RAII 自动清理）
├── web/                              # 前端静态文件（SPA）
│   ├── index.html                    # SPA 入口（ctemplate 渲染 → Hash Router 接管，含 ACE CDN 引入）
│   ├── css/
│   │   └── style.css                 # 全局样式（LeetCode 风格简约浅色主题）
│   └── js/
│       ├── router.js                 # Hash Router：路由匹配、Auth 守卫、页面调度、设置面板
│       ├── api.js                    # HTTP 请求封装（fetch + JSON）
│       ├── utils.js                  # DOM 工具函数
│       ├── effects.js               # 背景特效系统（Canvas 粒子漂浮 + CSS 云层动画 + 特效开关
│       ├── pages/
│       │   ├── login.js              # 登录页
│       │   ├── register.js           # 注册页
│       │   ├── problems.js           # 题目列表
│       │   ├── problemDetail.js      # 题目详情 + ACE 代码编辑器 + 提交
│       │   ├── result.js             # 判题结果（方块网格 + 轮询 + 详情展开）
│       │   ├── userCenter.js         # 用户中心（提交历史分页）
│       │   ├── admin.js              # 后台管理首页（题目列表 + 删除）
│       │   ├── adminQuestions.js     # 新建题目表单
│       │   └── adminQuestionEdit.js  # 编辑题目 + 测试用例管理
└── test/                             # 测试用例示例（预留）
    └── cases/
```

---

## 10. 前端页面线框

> **视觉风格**：全局采用新海诚（Makoto Shinkai）动画风格——动态天空渐变背景（深蓝 → 暖橙 → 金色）、毛玻璃面板 (backdrop-filter)、暖金 (#fdbb2d) 主色调、柔和阴影与圆角设计。背景特效包括 Canvas 粒子漂浮动画（白色光点 + 金色辉光脉冲）和 CSS 飘云层（6 朵交错漂浮云）。用户可通过导航栏 ⚙ 设置面板手动关闭背景特效。

### 登录页 `#/login`
```
┌─────────────────────────────────┐
│          VibeOJ                  │
│  ┌─────────────────────────┐    │
│  │ 用户名: [            ]   │    │
│  │ 密码:   [            ]   │    │
│  │  [ 登 录 ]               │    │
│  │                          │    │
│  │ 没有账号？[去注册]        │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

### 题目列表 `#/problems`
```
┌────────────────────────────────────────────┐
│  VibeOJ    [题目] [我的] [管理] [退出]       │
├────────────────────────────────────────────┤
│  [🔍 搜索题目...]  [▼ 全部难度]              │
│                                              │
│  #  标题                时间限制  内存限制    │
│  1  A+B Problem          1s        256MB   │
│  2  最大子数组和          1s        256MB   │
│  ...                                       │
└────────────────────────────────────────────┘
```

> 搜索框输入关键词实时过滤标题，难度下拉筛选（全部/简单/中等/困难），客户端即时过滤无需请求后端。

### 题目详情 + 提交 `#/problems/1`（左右分栏布局）

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← 返回题目列表     A+B Problem                                          │
├────────────────────────────┬─────────────────────────────────────────────┤
│  左侧：题目面板 (scroll)     │  右侧：ACE 代码编辑器面板                     │
│                            │  ┌──────────────────────────────────────┐   │
│  【题目描述】                │  │ 代码编辑器 (C++) - ACE Editor         │   │
│  给定两个整数 a 和 b，      │  │ ┌──────────────────────────────────┐ │   │
│  输出 a+b。                 │  │ │ #include <iostream>              │ │   │
│                            │  │ │ using namespace std;             │ │   │
│  【输入】                   │  │ │ int main() {                     │ │   │
│  一行两个整数。              │  │ │     int a, b;                    │ │   │
│                            │  │ │     cin >> a >> b;               │ │   │
│  【输出】                   │  │ │     cout << a + b << endl;       │ │   │
│  一个整数。                  │  │ │     return 0;                    │ │   │
│                            │  │ │ }                                │ │   │
│  【样例】                   │  │ └──────────────────────────────────┘ │   │
│  输入: 1 2                  │  │                                      │   │
│  输出: 3                    │  │ [ 提交代码 ] [加载已通过代码] [↩撤销] │   │
│                            │  │ [✓ 自动补全]    Ctrl+Enter 提交  │   │
│                            │  └──────────────────────────────────────┘   │
│  限制: 1s / 256MB          │                                              │
│                            │  ┌─ 测试样例 ───────────────────────────┐   │
│                            │  │ 样例 1:                              │   │
│                            │  │   输入: 1 2                          │   │
│                            │  │   输出: 3                            │   │
│                            │  │                                      │   │
│                            │  │ 样例 2:                              │   │
│                            │  │   输入: 10 20                        │   │
│                            │  │   输出: 30                           │   │
│                            │  │                          (可滚动)    │   │
│                            │  └──────────────────────────────────────┘   │
└────────────────────────────┴─────────────────────────────────────────────┘
```

> **代码持久化**：每个题目的代码自动保存到浏览器 `localStorage`（键 `code_{题目ID}`）。切换题目或返回时自动恢复，提交后不清除（500ms debounce）。
>
> **加载已通过代码**：提交按钮旁提供「加载已通过代码」按钮，点击后通过 `GET /api/user/ac-codes/:question_id` 获取当前用户在该题下**所有** AC 提交记录，以弹出下拉列表展示（含提交 ID、时间、性能数据），点击任一条即自动填入 ACE 编辑器；若用户尚无 AC 记录则提示「该题目暂无已通过的提交」。加载后「↩撤销」按钮出现，点击可回退到加载前的用户自己编写的代码（单级撤销）。
>
> **自动补全开关**：编辑器旁提供「自动补全」复选框，可手动关闭/开启 ACE 编辑器的代码自动补全功能（包括 basic autocompletion 和 live autocompletion）。开关状态持久化到 `localStorage`。
>
> **测试样例**：公开样例来自 `questions.sample_input`/`sample_output`。完整测试用例列表仅在管理员编辑页通过 `GET /api/admin/questions/:id/testcases` 获取，普通用户不可见。

**测试点方块规则：**
- 一排最多 7 个方块，超出自动换行
- 颜色按状态区分：AC=绿色, WA=红色, TLE=橙色, MLE=深橙, RE=紫色, CE=灰色, PENDING/COMPILING/RUNNING=旋转动画
- 点击某个方块 → 下方展开该测试点的状态/耗时/内存详情（不展示测试数据，防泄题）
- 当前选中的方块有高亮边框（▶ 标记）
- 页面底部折叠展示提交的源代码

> **隐私保护**：测试点的输入、期望输出、实际输出不存储到 `detail_json` 中，也不在前端展示。用户只能看到每个测试点的判题结果（状态、耗时、内存）。

### 判题结果 `#/result/42`（测试点方块网格）

提交后跳转到此页面，以方块网格展示每个测试点的判题结果：

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← 返回题目     提交 #42  |  A+B Problem  |  2026-01-15 10:30            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  状态: Wrong Answer            通过: 7/10                                 │
│  耗时: 15ms  |  内存: 2560KB                                              │
│                                                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │  AC  │ │  AC  │ │  AC  │ │  WA  │ │  AC  │ │  WA  │ │  AC  │        │
│  │ #1   │ │ #2   │ │ #3   │ │ #4 ▶ │ │ #5   │ │ #6   │ │ #7   │        │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │
│  ┌──────┐ ┌──────┐ ┌──────┐                                             │
│  │  AC  │ │  WA  │ │  TLE │                                             │
│  │ #8   │ │ #9   │ │ #10  │                                             │
│  └──────┘ └──────┘ └──────┘                                             │
│                                                                          │
│  ┌─ 测试点 #4 (已选中) ─────────────────────────────────────────────┐    │
│  │  状态: WA  |  耗时: 12ms  |  内存: 2048KB                         │    │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─ 提交代码 [展开/折叠] ────────────────────────────────────────────┐    │
│  │ #include <iostream>                                               │    │
│  │ using namespace std;                                              │    │
│  │ int main() {                                                      │    │
│  │     int a, b; cin >> a >> b; cout << a + b; return 0;             │    │
│  │ }                                                                 │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 用户中心 `#/user`

用户中心分为两层视图：

**第一层：问题状态总览（默认显示）**

```
┌────────────────────────────────────────────┐
│  ← 返回题目列表                              │
│                                            │
│  用户名: alice                              │
│                                            │
│  共 15 次提交，通过 2 题，尝试 3 题           │
│                                            │
│  【问题状态】                               │
│  #  题目          难度    状态               │
│  1  A+B Problem   简单   已通过  5次          │
│  2  最大子数组和  中等   未通过  3次           │
│  3  回文数判定    简单   未通过  7次           │
│                                            │
│  [ 查看提交历史 ]                            │
└────────────────────────────────────────────┘
```

- 问题状态表格：每行显示编号、标题、难度（简单/中等/困难 彩色标签）、通过状态（已通过绿色/未通过红色）、提交次数
- 顶部统计栏：总提交次数、已通过题数、尝试过的题数
- 点击某行跳转到对应题目详情页
- 通过 `/api/user/problem-status` 接口获取数据

**第二层：提交历史（点击「查看提交历史」展开）**

```
┌────────────────────────────────────────────┐
│  【提交历史】                                │
│  题目          难度   状态       耗时             时间        │
│  A+B Problem   简单   AC 通过   15ms/2560KB   2026-01-15  │
│  A+B Problem   简单   WA 答案错误  12ms/2048KB   2026-01-15  │
│  最大子数组和  中等   TLE 超时   1200ms/512KB  2026-01-15  │
│                                            │
│  状态颜色：AC=绿, WA=红, TLE=橙, MLE=深橙,   │
│           RE=紫, CE=灰                      │
│                                            │
│  [加载更多]                                 │
└────────────────────────────────────────────┘
```

- 展开后异步加载提交历史（分页，每页 20 条）
- 每行含状态颜色+中文描述 + 耗时/内存列 + "查看详情 →" 链接
- 点击行跳转到 `#/result/:id`
- 可折叠/展开

> **用户中心统计**：统计信息来自 `/api/user/problem-status` 接口，统计已解决题数（有 AC 记录 = 已通过）和尝试题数（有提交记录 = 尝试过）。

### 后台管理 `#/admin`
```
┌────────────────────────────────────────────┐
│  ← 返回题目列表                              │
│                                            │
│  管理后台                                   │
│                                            │
│  [题目管理]                                 │
│                                            │
│  #  标题          可见   操作               │
│  1  A+B Problem   是    [编辑] [删除]       │
│  2  新题目         否    [编辑] [删除]       │
│                                            │
│  [+ 新建题目]                               │
└────────────────────────────────────────────┘
```

---

## 11. TODO 清单（✅ 全部完成）

### Phase 0 — 基础设施
- [x] 项目目录创建，Makefile 配置
- [x] MySQL schema.sql 编写并初始化数据库
- [x] cpp-httplib 集成（复制头文件到 server/include/）
- [x] MySQL 连接池实现 (`db/pool`)
- [x] 配置管理 (`config.hpp`)

### Phase 1 — 用户认证
- [x] `users` 表对应数据访问层
- [x] Argon2id 密码哈希 (`util/crypto`)
- [x] 注册 handler: 校验 → 哈希 → INSERT
- [x] 登录 handler: 查用户 → 验证密码 → 生成 token → INSERT sessions → Set-Cookie
- [x] Token 鉴权中间件：读 Cookie → 查 sessions → 挂载 user 信息
- [x] 退出 handler: 删 session → 清 Cookie
- [x] 前端登录/注册页 (HTML + JS)

### Phase 2 — 题目浏览
- [x] `questions` 和 `test_cases` 表数据访问层
- [x] API: GET `/api/problems` (列表)
- [x] API: GET `/api/problems/:id` (详情)
- [x] 前端题目列表页
- [x] 前端题目详情页 — 左右分栏布局（左题目描述，右代码编辑器）

### Phase 3 — 判题引擎（核心）
- [x] 线程池实现 (`judge/threadpool`)
- [x] 编译模块: 临时文件 → g++ → 检查结果 (`judge/compiler`)
- [x] 运行模块: fork → setrlimit → dup2 → exec → wait4 → 分析结果 (`judge/runner`)
- [x] 判题引擎主循环: 投递 → 编译 → 遍历测试点 → 运行 → 比对 → 写结果 (`judge/engine`)
- [x] API: POST `/api/submit` (接收入库 → 投递线程池)
- [x] API: GET `/api/submissions/:id` (返回详情含每题点)

### Phase 4 — 判题结果展示
- [x] 前端 `#/result/:id` 页面：测试点方块网格组件
- [x] 方块网格：颜色按状态区分（AC绿/WA红/TLE橙/MLE深橙/RE紫/CE灰），flexbox 自动换行
- [x] 点击方块展开该测试点详情（状态、耗时、内存；不展示输入/输出，防泄题）
- [x] 页面底部折叠展示提交的源代码
- [x] 轮询机制：提交后跳转 `#/result/:id`，2s 间隔轮询直到判题完成

### Phase 5 — 用户中心
- [x] API: GET `/api/user/submissions` (分页提交历史)
- [x] API: GET `/api/user/profile`
- [x] API: GET `/api/user/problem-status` (每题的汇总提交状态，含 solved/attempt_count)
- [x] 前端用户中心页（两层视图：问题状态总览 + 可展开的提交历史）
- [x] 用户统计（总提交次数/已通过题数/尝试题数）
- [x] 提交历史分页（每页 20 条）+ "加载更多"按钮

### Phase 6 — 后台管理
- [x] admin 鉴权中间件（检查 is_admin）
- [x] API: 题目 CRUD
- [x] API: 测试用例 CRUD
- [x] 前端后台管理页

### Phase 7 — 错误处理与打磨
- [x] 404/500 页面
- [x] 全局错误处理中间件
- [x] 编译超时控制（10s）
- [x] 安全加固（setrlimit 全六项限制）

### Phase 8 — UI 优化
- [x] LeetCode 风格简约浅色主题（白底黑字，绿/蓝强调色代替红色）
- [x] 题目详情页：ACE Editor 替代 textarea，支持语法高亮、行号
- [x] ACE Editor：加载 ext-language_tools.js 扩展，支持 C++ 自动补全、代码片段、实时提示
- [x] 题目详情页：提交按钮紧跟编辑器下方（Ctrl+Enter 快捷提交）
- [x] 用户中心页：添加返回题目列表链接
- [x] 后台管理页：添加返回题目列表链接
- [x] 导航栏深色配色（#282c34），与 LeetCode 一致

### Phase 9 — 稳定性修复
- [x] DB 连接池生命周期修复：DbConn 析构不再关闭连接，由 DbPool 统一管理（修复使用 8 次连接后全池枯竭导致 500 的严重 bug）
- [x] JSON 解析器重构：`extract_json_string/int` 统一实现至 `util/json_extract.hpp`，正确处理冒号前后空格、转义字符
- [x] 注册接口：INSERT 捕获 Duplicate 异常，消除 check-then-act 竞态条件
- [x] 提交接口：JSON 解析改用共享工具函数

### Phase 10 — Segfault 修复
- [x] `db/pool.cpp` escape(): 用 `mysql_real_escape_string()` 返回值替代 `strlen()`，修复非 null-terminated 缓冲区溢出导致 segfault
- [x] `judge/runner.cpp` 移除 `RLIMIT_NOFILE=0`：该 rlimit 阻断子进程 `dup2` I/O 重定向，导致子进程继承父进程 MySQL socket 等 fd，污染连接引发 segfault
- [x] `judge/runner.cpp` `RLIMIT_FSIZE` 改为 10MB：旧值 0 禁止子进程写入任何输出
- [x] `judge/runner.cpp` 添加墙钟超时：`wait4(WNOHANG)` 轮询 + `time_limit+2s` 超时后 `SIGKILL`，防止子进程 `sleep()` 等零 CPU 挂起耗尽判题线程
- [x] `judge/runner.cpp` 临时目录改用 `g_config.tmp_dir`，不再硬编码 `/tmp/oj`
- [x] `judge/threadpool.cpp` worker 函数外添加 try/catch，防止异常终止整个 worker 线程
- [x] `handler/submission.cpp` / `problem.cpp` / `admin.cpp`：`mysql_fetch_row()` 返回值和 `row[i]` 加 NULL 守卫，消除空指针解引用

### Phase 11 — 连接稳定性修复
- [x] `main.cpp` 添加 `signal(SIGPIPE, SIG_IGN)`：忽略 SIGPIPE 信号，修复客户端断开连接时服务端被 SIGPIPE 杀死导致 segfault 和前端 "Unexpected end of JSON input" 错误
- [x] `main.cpp` 添加 `set_keep_alive_timeout(5)`：5 秒 keep-alive 超时，防止僵死连接积累
- [x] `main.cpp` error handler 仅对空 body 响应设置默认 JSON body，不再覆盖 handler 已设置的自定义错误内容
- [x] `handler/auth.cpp` 注册/登录/退出 handler 全部添加外层 try/catch，异常不再向上传播导致 cpp-httplib 返回空响应体
- [x] `util/json_extract.hpp` 新增 `json_escape()` 函数，对 `"`, `\`, `\n`, `\r`, `\t`, 控制字符进行 JSON 转义
- [x] `handler/auth.cpp` 响应 JSON 拼接处全部使用 `json_escape()`：用户名 `row[1]`、`e.what()` 异常消息等动态值统一转义，杜绝特殊字符破坏 JSON 结构
- [x] `handler/auth.cpp` 增加 `req.body.empty()` 空 body 检测，提前返回 400 而非静默返回空响应

### Phase 12 — 密码强度校验
- [x] `util/json_extract.hpp` 新增 `validate_password()` 函数，校验用户名 ≥3 字符、密码 ≥8 字符、至少 2 种字符类型（数字/小写/大写/特殊符号）、无非法字符
- [x] `handler/auth.cpp` 注册 handler 调用 `validate_password()`，不合格返回 400 + 具体原因
- [x] `web/js/pages/register.js` 前端注册页展示密码规则提示 + 客户端预校验

### Phase 13 — 延后（V2）
- [ ] 私信/消息系统
- [ ] 排行榜
- [ ] 多语言
- [ ] Docker 化

### Phase 14 — 体验优化
- [x] 测试数据隐私保护：`detail_json` 移除 `input`/`expected`/`actual` 字段，结果页只显示状态、耗时、内存
- [x] 代码持久化：每个题目代码自动保存到浏览器 `localStorage`（键 `code_{题目ID}`），离开/刷新页面自动恢复，提交后不清除
- [x] 用户中心改进：两层视图（问题状态总览 + 可展开提交历史），增加提交统计（总次数/通过题数/尝试题数），表格增加耗时/内存列和跳转提示
- [x] 用户中心 API：`title` 字段 JSON 转义，修复特殊字符导致前端解析失败
- [x] 登录页改进：移除用户名长度提示和 `minlength`（该校验仅注册页需要），placeholder 改中文，错误提示中文化
- [x] 后端错误信息中文化：注册/登录/提交/鉴权核心路径返回消息已中文化

### Phase 15 — 已知限制（V2 改进）
- [ ] 判题引擎编译阶段未检查二进制文件大小（Spec 要求 ≤ 50MB）
- [ ] `submission.cpp`/`problem.cpp`/`user.cpp` handler 缺少外层 try/catch，异常可能传播到 cpp-httplib 导致空响应
- [ ] 部分 API 边缘路径错误消息仍为英文（如空 body 检测、404 not found 等）
- [ ] 方块网格 "7个/行" 未在 CSS 中硬约束，实际由 flexbox 容器宽度决定（900px 下约 9-10 个/行）
- [ ] 测试用例完整列表只对管理员可见（公开样例来自 `questions.sample_input`/`sample_output`）
- [ ] 判题引擎早期停止机制：首个非 AC 结果后不再运行剩余测试点，用户需多次提交查看后续失败详情

### Phase 16 — 解题状态统计与题目搜索修复
- [x] 用户中心 `el()` 数组参数未展开导致 `appendChild` 错误，修复为展开传参（`userCenter.js` line 49/93）
- [x] 用户中心统计：`attemptedCount` 改为仅统计 `!p.solved` 的题目，避免已通过题目同时计入"通过"和"尝试"（互斥语义）
- [x] 题目列表页新增搜索框（标题关键词实时过滤）+ 难度下拉筛选（全部/简单/中等/困难），客户端即时过滤

### Phase 17 — 已通过代码加载
- [x] 后端 `GET /api/user/ac-code/:question_id`：查询用户在某题下最新 AC 提交 (`user.cpp`)
- [x] 前端 API `getAcceptedCode(qid)` (`api.js`)
- [x] 题目详情页「加载已通过代码」按钮，点击加载并填入 ACE 编辑器 (`problemDetail.js`)

### Phase 18 — 多版本 AC 代码加载 + 撤销 + 新海诚风格视觉改造
- [x] 后端 `GET /api/user/ac-codes/:question_id`：查询用户在某题下所有 AC 提交，返回 id/code/total_time/total_memory/created_at 列表 (`user.cpp`)
- [x] 前端 API `getAcceptedCodes(qid)` (`api.js`)
- [x] 题目详情页「加载已通过代码」按钮改为弹出下拉列表展示所有 AC 提交（含提交 ID、时间、性能）；点击任一条自动填入编辑器 (`problemDetail.js`)
- [x] 新增「↩ 撤销」按钮：加载 AC 代码后出现，点击恢复加载前用户自己的代码（单级撤销）(`problemDetail.js`)
- [x] ACE 编辑器旁新增「自动补全」复选框，可手动关闭/开启自动补全，状态持久化到 `localStorage` (`problemDetail.js`)
- [x] 新增设置面板：导航栏 ⚙ 按钮弹出下拉面板，含「背景特效」「代码自动补全」两个开关，自定义 toggle-switch 组件 (`router.js`)
- [x] 全局 CSS 改造为新海诚（Makoto Shinkai）动画风格：动态天空渐变背景、毛玻璃面板 (backdrop-filter)、暖金 (#fdbb2d) 主色调、柔和阴影、圆角设计、透明/半透明 UI 元素 (`style.css`)
- [x] 背景特效系统：Canvas 粒子漂浮动画（80 粒子，脉冲光晕 + 暖色辉光）+ CSS 飘云层（6 朵云交错漂浮动画）(`effects.js`)
- [x] 设置面板开关：背景特效（控制 Canvas 粒子 + CSS 云层显示/隐藏，持久化到 `localStorage`）、代码自动补全开关与编辑器内复选框双向同步 (`router.js` + `effects.js` + `problemDetail.js`)
- [x] `index.html` 新增 Canvas 粒子层、云层、星星层、设置面板 DOM (`index.html`)
- [x] BUILD PASS：编译通过，服务启动正常

---

## 12. 验收标准

| 编号 | 验收项 | 标准 |
|---|---|---|
| AC-1 | 注册/登录 | 用户名 ≥3 字符 + 密码 ≥8 字符 ≥2 种字符类型，注册后登录获得 token，刷新保持登录态 |
| AC-2 | 未登录拦截 | 未登录访问任何需鉴权页面跳转 `#/login` |
| AC-3 | 题目列表 | 仅显示 `is_visible=1` 的题目，含编号、标题、限制 |
| AC-4 | 题目详情 | 显示完整描述、输入输出格式、样例、限制 |
| AC-5 | 代码提交 | 提交 C++ 代码，返回 submission_id，前端跳转到 `#/result/:id` 页面 |
| AC-6 | AC 判定 | 所有测试点输出完全匹配 → 总状态 AC |
| AC-7 | WA 判定 | 任一测试点输出不匹配 → 总状态 WA |
| AC-8 | TLE 判定 | 用户代码运行超时 → 进程被 RLIMIT_CPU 杀死 → 总状态 TLE |
| AC-9 | MLE 判定 | 用户代码内存超限 → 进程被 RLIMIT_AS 杀死 → 总状态 MLE |
| AC-10 | RE 判定 | 用户代码非 0 退出 / 段错误 → 总状态 RE |
| AC-11 | CE 判定 | 编译失败 → 返回编译错误信息 |
| AC-12 | 结果页每题点 | 测试点以彩色方块网格展示（7个/行），点击方块可展开该点状态、耗时、内存；不展示输入/输出数据 |
| AC-13 | 用户中心 | 登录用户能看到自己的问题状态总览（通过/未通过）+ 可展开的提交历史列表 |
| AC-14 | 管理员 CRUD | admin 用户可创建/编辑/删除非题目及测试用例 |
| AC-15 | 非 admin 防问 | 普通用户访问 `/api/admin/*` 返回 403 |
| AC-16 | 判题并发 | 3 个用户同时提交不同题目，判题引擎并行处理，互不阻塞 |
| AC-17 | 404/500 | 无效路由返回 404 页，服务端异常返回 500 页 |
| AC-18 | 安全防线 | 用户代码无法读写文件系统、无法 fork 子进程、无法访问网络 |
| AC-19 | 结果轮询 | 跳转到 `#/result/:id` 后前端轮询 `/api/submissions/:id`（2s 间隔），状态非 PENDING/COMPILING/RUNNING 时停止，渲染结果方块网格 |
| AC-20 | 代码持久化 | 离开题目详情页再返回，代码编辑器恢复之前内容（localStorage 保存/读取） |
| AC-21 | 用户中心统计 | 用户中心顶部显示提交总次数、已通过题数、尝试过的题数 |
| AC-22 | 加载已通过代码 | 题目详情页点击「加载已通过代码」→ 从后端获取最新 AC 代码并填入编辑器；无 AC 记录时弹窗提示 |
| AC-23 | 多版本 AC 代码列表 | 点击「加载已通过代码」弹出下拉列表展示用户在该题所有 AC 提交（含 ID、时间、性能），点击任一条填入编辑器 |
| AC-24 | AC 代码撤销 | 加载 AC 代码后「↩ 撤销」按钮出现，点击恢复到加载前用户自己的代码 |
| AC-25 | 自动补全开关 | 编辑器旁复选框 + 设置面板开关可控制 ACE 自动补全开/关，状态持久化到 localStorage，两者双向同步 |
| AC-26 | 新海诚视觉风格 | 全局动态天空渐变背景 + 毛玻璃面板 + 暖金主色调 (#fdbb2d) + Canvas 粒子漂浮 + CSS 飘云动画 |
| AC-27 | 特效开关 | 导航栏 ⚙ 设置面板中「背景特效」开关可关闭/开启 Canvas 粒子与 CSS 云层动画，状态持久化到 localStorage |

---

## 13. 风险与权衡

| 风险 | 影响 | 缓解策略 |
|---|---|---|
| 线程池只能并行有限任务 | 大量提交时延迟大 | MVP 可接受；后期可加 Redis 队列 |
| setrlimit 不是完整沙箱 | 仍有逃逸风险（内核漏洞） | 个人学习项目可接受；V2 上 Docker |
| MySQL BLOB/TEXT 存储大输入输出 | 慢查询，DB 膨胀 | 设置 `max_allowed_packet`；V2 可迁文件系统 |
| 无 HTTPS | 密码明文传输 | 单机可用；生产环境加 Nginx 反代 |
| ctemplate 学习成本 | 初期上手慢 | 仅用于骨架注入，复杂度低 |

---

## 14. 依赖清单与安装指南

### 14.1 依赖矩阵

| 依赖 | 用途 | 获取方式 | 状态 |
|---|---|---|---|
| `g++` (≥13) | C++ 编译器 | 系统包 | ✅ 已安装 (13.3.0) |
| `make` | 构建工具 | 系统包 | ✅ 已安装 |
| `libmysqlclient-dev` | MySQL C 客户端 | apt | ✅ 已安装 (8.4.9) |
| `mysql-server` | MySQL 数据库服务 | apt | ✅ 已安装 (8.4.9) |
| `zlib1g-dev` | 压缩库（MySQL 依赖） | apt | ✅ 已安装 |
| `libargon2-dev` | Argon2 密码哈希 | apt | ✅ 已安装 |
| `cpp-httplib` | HTTP Server + 静态文件 | 已有头文件 | ✅ 已有（需复制到项目） |
| `ctemplate` | HTML 模板引擎（骨架注入） | 源码编译到 `/usr/local` | ✅ 已安装 |
| `libssl-dev` | OpenSSL 头文件（SHA256 / 随机数） | apt | ✅ 已安装 |

| `ACE Editor` | 代码编辑器（语法高亮/自动补全） | CDN (cdnjs) | ✅ 已集成（v1.36.2） |

| `cmake` (≥3.14) | 构建系统（二选一） | apt | ⬜ 可选安装 |

### 14.2 依赖安装（全部已完成）

```bash
# libssl-dev 已安装（若缺失则执行）
# sudo apt update && sudo apt install -y libssl-dev
```

### 14.3 各依赖详情

#### libssl-dev（需安装）
- 提供 `<openssl/evp.h>` `<openssl/sha.h>` `<openssl/rand.h>`
- 用于 Token 生成（SHA256）、安全随机数
- 链接：`-lssl -lcrypto`

#### libargon2-dev（已安装）
- 头文件：`/usr/include/argon2.h`
- 库文件：`/lib/x86_64-linux-gnu/libargon2.so`
- 密码哈希算法 Argon2id（比 bcrypt 更现代，2015 年 PHC 冠军）
- 链接：`-largon2`
- 替代原 SPEC 中的 bcrypt 方案

#### cpp-httplib（已有头文件）
- 源文件：`/home/user1/OnlineJudge/comm/httplib.h`（6708 行，header-only）
- **操作**：复制到项目中，例如 `server/include/httplib.h`
- HTTP Server、路由匹配、静态文件服务、Cookie 解析
- 不需要链接库，编译宏启用 OpenSSL：`-DCPPHTTPLIB_OPENSSL_SUPPORT`

#### ctemplate（源码编译到 /usr/local）
- 头文件：`/usr/local/include/ctemplate/template.h`
- 库文件：`/usr/local/lib/libctemplate.so` `/usr/local/lib/libctemplate.a`
- pkg-config：`/usr/local/lib/pkgconfig/libctemplate.pc`
- 用于服务端 HTML 模板渲染（SPA 骨架注入）
- 链接：`-L/usr/local/lib -lctemplate -lpthread`

### 14.4 编译链接参考

**方式一：CMake（推荐）**

```bash
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
# 可执行文件: build/vibeoj
```

**方式二：Makefile**

```makefile
CXX      = g++
CXXFLAGS = -std=c++17 -O2 -Wall -Wextra \
           -Iserver/include \
           -DCPPHTTPLIB_OPENSSL_SUPPORT
LDFLAGS  = -lmysqlclient -lssl -lcrypto -largon2 \
           -L/usr/local/lib -lctemplate -lpthread -lz
```

### 14.5 快速开始（首次运行）

```bash
# =============================================
# 步骤 1: 安装系统依赖（如未安装）
# =============================================
sudo apt update && sudo apt install -y libssl-dev

# =============================================
# 步骤 2: 复制 cpp-httplib 头文件
# =============================================
mkdir -p server/include
cp /home/user1/OnlineJudge/comm/httplib.h server/include/

# =============================================
# 步骤 3: 启动 MySQL 并创建数据库
# =============================================
sudo systemctl start mysql

sudo mysql <<EOF
CREATE DATABASE IF NOT EXISTS vibeoj DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'VibeOJUser'@'localhost' IDENTIFIED BY '347191964YM';
GRANT ALL PRIVILEGES ON vibeoj.* TO 'VibeOJUser'@'localhost';
FLUSH PRIVILEGES;
EOF

# 导入表结构
mysql -u VibeOJUser -p347191964YM vibeoj < server/db/schema.sql

# 导入种子数据（2 道例题 + 15 个测试点）
mysql -u VibeOJUser -p347191964YM vibeoj < server/db/seed.sql

# =============================================
# 步骤 4: 编译项目
# =============================================

# 方式 A: CMake（推荐）
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
cd ..

# 方式 B: Makefile（传统）
make

# =============================================
# 步骤 5: 启动服务器
# =============================================
./build/vibeoj    # CMake 编译的产物在 build/ 目录
# 或
./vibeoj          # Makefile 编译的产物在当前目录

# =============================================
# 访问: http://localhost:8080
# 停止: Ctrl+C
# =============================================
```

### 14.6 日常开发运行

```bash
# CMake 方式
cd build && make -j$(nproc) && cd .. && ./build/vibeoj

# Makefile 方式
make && ./vibeoj

# 一键（Makefile）
make run    # 自动创建 /tmp/oj 临时目录并启动
```

### 14.7 配置说明

编辑 `server/config.hpp` 修改数据库连接参数：

```cpp
struct Config {
    int         port          = 8080;
    std::string db_host       = "127.0.0.1";
    int         db_port       = 3306;
    std::string db_user       = "VibeOJUser";
    std::string db_password   = "347191964YM";
    std::string db_name       = "vibeoj";
    // ...
};
```

### 14.8 验证安装

```bash
# 头文件
ls server/include/httplib.h              # cpp-httplib (header-only)
ls /usr/local/include/ctemplate/template.h  # ctemplate
ls /usr/include/openssl/evp.h            # OpenSSL
ls /usr/include/argon2.h                 # Argon2
ls /usr/include/mysql/mysql.h            # MySQL client

# 链接库
pkg-config --libs mysqlclient
pkg-config --libs openssl
PKG_CONFIG_PATH=/usr/local/lib/pkgconfig pkg-config --libs libctemplate
ldconfig -p | grep -E "libargon2|libctemplate"
```
