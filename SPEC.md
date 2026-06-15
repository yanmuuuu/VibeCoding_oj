# SPEC.md — VibeOJ 仿 LeetCode OJ 系统

## 1. 项目概述

| 属性 | 值 |
|---|---|
| **项目名称** | VibeOJ |
| **定位** | 个人学习项目 |
| **模式** | ACM（stdin/stdout），仅 C++ |
| **前端** | 原生 HTML + CSS + JS（SPA + Hash 路由） |
| **后端** | C++ (cpp-httplib) 一体化：API Server + 静态文件 + ctemplate 模板 |
| **数据库** | MySQL |
| **部署** | 单机 |

---

## 2. 核心功能（MVP）

### 2.1 用户系统
- 注册：用户名 + 密码（bcrypt 哈希存储）
- 登录：验证密码 → 生成随机 Token → 写入 `sessions` 表 → Set-Cookie 返回
- 退出：清除 Cookie + 删除 sessions 记录
- 管理员：`users.is_admin` 字段区分，可登录后台管理页
- 每次请求从 Cookie 读 token 查 `sessions` 表校验登录态

### 2.2 题目浏览
- 题目列表页：展示所有题目（编号、标题、难度可选）
- 题目详情页：描述、输入/输出/样例、时间限制、内存限制

### 2.3 代码提交与判题
- 用户在题目详情页粘贴/编写代码 → 提交
- 后端接收代码 → 判题管道 → 返回结果
- 判题状态码：`AC` / `WA` / `TLE` / `MLE` / `RE` / `CE` / `SE`
- 结果页：**测试点方块网格** — 提交后跳转到 `#/result/:id`，N个彩色方块（7个/行），点击展开详情

### 2.4 用户中心
- 我的提交历史列表（题目、状态、时间）

### 2.5 后台管理（管理员）
- 题目 CRUD（创建、编辑、删除）
- 测试用例管理（每个题目下增删测试点，input/expected_output 分别存储）
- 管理页需要管理员权限

### 2.6 通用
- 404 页面（路由未匹配）
- 500 页面（服务器异常友好提示）

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
    password_hash   VARCHAR(256) NOT NULL,          -- bcrypt
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
    detail_json     JSON,                              -- 每题点结果：[{index,status,time_ms,memory_kb,expected,actual}]
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
| GET | `/api/submissions/:id` | 获取单次提交详情（含每题点结果） | 需要 |

### 6.4 用户中心

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/user/submissions` | 我的提交历史（分页） | 需要 |
| GET | `/api/user/profile` | 当前用户信息 | 需要 |

### 6.5 管理员

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| POST | `/api/admin/questions` | 创建题目 | 需要 + admin |
| PUT | `/api/admin/questions/:id` | 编辑题目 | 需要 + admin |
| DELETE | `/api/admin/questions/:id` | 删除题目 | 需要 + admin |
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
  │ 2. 运行阶段 (RUNNING)          │           │
  │  for each test_case:          │           │
  │    - fork() 子进程             │           │
  │    - setrlimit:                │           │
  │      · RLIMIT_CPU = time_limit│           │
  │      · RLIMIT_AS  = mem_limit │           │
  │      · RLIMIT_CORE = 0        │           │
  │      · RLIMIT_NPROC = 0       │           │
  │      · RLIMIT_FSIZE = 0       │           │
  │    - dup2 stdin → input_data   │           │
  │    - dup2 stdout → output_buf │           │
  │    - exec(binary)              │           │
  │    - wait4 → 获取时间/内存/退出码│          │
  │    - 判断结果:                  │           │
  │      · 超时 → TLE              │           │
  │      · 内存超 → MLE            │           │
  │      · 非0退出 → RE            │           │
  │      · 输出 ≠ 期望 → WA        │           │
  │      · 输出 = 期望 → AC ✅     │           │
  │  any failure → 更新status=XX   │           │
  │  all pass → 更新status=AC     │           │
  └──────────────┬───────────────┘           │
                 │                            │
                 ▼                            │
  更新 submissions 表                          │
  (status, detail_json,                       │
   total_time, total_memory,                  │
   passed_count, total_count)                  │
```

**setrlimit 限制矩阵：**

| rlimit | 值 | 防御场景 |
|---|---|---|
| `RLIMIT_CPU` | time_limit 秒 | 死循环、无限递归 |
| `RLIMIT_AS` | memory_limit MB | 内存炸弹、大数组 |
| `RLIMIT_CORE` | 0 | 禁止 core dump 生成大文件 |
| `RLIMIT_NPROC` | 1 或 0 | 禁止 `fork()` 炸弹 |
| `RLIMIT_FSIZE` | 0（运行阶段） | 禁止创建/写入文件 |
| `RLIMIT_NOFILE` | 0 | 禁止打开除 stdin/stdout/stderr 外的文件 |

---

## 8. 前端路由与页面（SPA + Hash）

| Hash 路由 | 页面 | 说明 |
|---|---|---|
| `#/` 或 `#/login` | 登录页 | 未登录默认 |
| `#/register` | 注册页 | |
| `#/problems` | 题目列表 | 需要登录 |
| `#/problems/:id` | 题目详情 + 提交区 | 左右分栏：左题目描述，右代码编辑器 |
| `#/result/:submissionId` | 判题结果页 | 测试点方块网格 + 详情展开（提交后跳转到此页） |
| `#/user` | 用户中心 | 提交历史 |
| `#/admin` | 后台管理首页 | 仅管理员 |
| `#/admin/questions` | 题目管理 | |
| `#/admin/questions/:id` | 编辑题目 + 测试用例管理 | |
| `#/404` | 404 页面 | 路由未匹配 |
| `#/500` | 500 页面 | 服务器异常 |

> ctemplate 用于初始 HTML 骨架 `<head>/<script>` 注入，SPA 路由由前端 JS Hash Router 驱动。

---

## 9. 项目目录结构

```
VibeOJ/
├── SPEC.md
├── README.md
├── Makefile                          # 编译后端
├── server/
│   ├── main.cpp                      # 入口
│   ├── config.hpp                    # 全局配置（端口、数据库连接、默认限制）
│   ├── db/
│   │   ├── pool.hpp/.cpp            # MySQL 连接池
│   │   └── schema.sql               # 建表脚本
│   ├── handler/
│   │   ├── auth.cpp                  # 注册、登录、退出
│   │   ├── problem.cpp               # 题目列表、详情
│   │   ├── submission.cpp            # 提交、结果查询
│   │   ├── user.cpp                  # 用户中心
│   │   └── admin.cpp                 # 后台管理 CRUD
│   ├── judge/
│   │   ├── engine.hpp/.cpp           # 判题引擎入口
│   │   ├── compiler.hpp/.cpp         # 编译模块
│   │   ├── runner.hpp/.cpp           # 运行模块（fork/setrlimit/exec）
│   │   └── threadpool.hpp           # 线程池
│   ├── middleware/
│   │   └── auth.cpp                  # Token 校验中间件
│   └── util/
│       ├── crypto.hpp/.cpp           # SHA256、bcrypt
│       └── tmpfile.hpp/.cpp          # 临时文件管理
├── web/                              # 前端静态文件
│   ├── index.html                    # SPA 入口（ctemplate 模板）
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── router.js                 # Hash Router
│       ├── api.js                    # HTTP 请求封装
│       ├── pages/
│       │   ├── login.js
│       │   ├── register.js
│       │   ├── problems.js
│       │   ├── problemDetail.js
│       │   ├── result.js
│       │   ├── userCenter.js
│       │   ├── admin.js
│       │   ├── adminQuestions.js
│       │   └── adminQuestionEdit.js
│       └── utils.js
└── test/                             # 测试脚本
    └── cases/                        # 测试用例示例
```

---

## 10. 前端页面线框

### 登录页 `#/login`
```
┌─────────────────────────────────┐
│          VibeOJ                  │
│  ┌─────────────────────────┐    │
│  │ 用户名: [            ]   │    │
│  │ 密码:   [            ]   │    │
│  │                          │    │
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
│  #  标题                时间限制  内存限制    │
│  1  A+B Problem          1s        256MB   │
│  2  最大子数组和          1s        256MB   │
│  ...                                       │
└────────────────────────────────────────────┘
```

### 题目详情 + 提交 `#/problems/1`（左右分栏布局）

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← 返回题目列表     A+B Problem               [ 提交代码 ]               │
├────────────────────────────┬─────────────────────────────────────────────┤
│  左侧：题目面板 (scroll)     │  右侧：代码编辑器                             │
│                            │                                              │
│  【题目描述】                │  ┌──────────────────────────────────────┐   │
│  给定两个整数 a 和 b，      │  │ #include <iostream>                  │   │
│  输出 a+b。                 │  │ using namespace std;                 │   │
│                            │  │ int main() {                         │   │
│  【输入】                   │  │     int a, b;                        │   │
│  一行两个整数。              │  │     cin >> a >> b;                   │   │
│                            │  │     cout << a + b << endl;           │   │
│  【输出】                   │  │     return 0;                        │   │
│  一个整数。                  │  │ }                                    │   │
│                            │  └──────────────────────────────────────┘   │
│  【样例】                   │                                              │
│  输入: 1 2                  │                                              │
│  输出: 3                    │                                              │
│                            │                                              │
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

**测试点方块规则：**
- 一排最多 7 个方块，超出自动换行
- 颜色按状态区分：AC=绿色, WA=红色, TLE=黄色, MLE=橙色, RE=紫色, CE=灰色, PENDING/COMPILING/RUNNING=旋转动画
- 点击某个方块 → 下方展开该测试点的输入/期望输出/实际输出/耗时/内存详情
- 当前选中的方块有高亮边框（▶ 标记）
- 页面底部折叠展示提交的源代码

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
│  │                                                                   │    │
│  │  输入:                                                            │    │
│  │  ┌─────────────────────────────────────────────────────────────┐  │    │
│  │  │ -5 5                                                        │  │    │
│  │  └─────────────────────────────────────────────────────────────┘  │    │
│  │  期望输出:                                                        │    │
│  │  ┌─────────────────────────────────────────────────────────────┐  │    │
│  │  │ 0                                                           │  │    │
│  │  └─────────────────────────────────────────────────────────────┘  │    │
│  │  实际输出:                                                        │    │
│  │  ┌─────────────────────────────────────────────────────────────┐  │    │
│  │  │ 10                                                          │  │    │
│  │  └─────────────────────────────────────────────────────────────┘  │    │
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
```
┌────────────────────────────────────────────┐
│  用户名: alice                              │
│                                            │
│  【我的提交】                               │
│  题目          状态     时间                 │
│  A+B Problem    AC     2026-01-15 10:20    │
│  A+B Problem    WA     2026-01-15 10:15    │
│  最大子数组和    TLE    2026-01-15 09:50    │
│                                            │
│  [加载更多]                                 │
└────────────────────────────────────────────┘
```

### 后台管理 `#/admin`
```
┌────────────────────────────────────────────┐
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

## 11. TODO 清单

### Phase 0 — 基础设施
- [ ] 项目目录创建，Makefile 配置
- [ ] MySQL schema.sql 编写并初始化数据库
- [ ] cpp-httplib 集成（git submodule / 包管理）
- [ ] MySQL 连接池实现 (`db/pool`)
- [ ] 配置管理 (`config.hpp`)

### Phase 1 — 用户认证
- [ ] `users` 表对应数据访问层
- [ ] bcrypt 密码哈希 (`util/crypto`)
- [ ] 注册 handler: 校验 → 哈希 → INSERT
- [ ] 登录 handler: 查用户 → 验证密码 → 生成 token → INSERT sessions → Set-Cookie
- [ ] Token 鉴权中间件：读 Cookie → 查 sessions → 挂载 user 信息
- [ ] 退出 handler: 删 session → 清 Cookie
- [ ] 前端登录/注册页 (HTML + JS)

### Phase 2 — 题目浏览
- [ ] `questions` 和 `test_cases` 表数据访问层
- [ ] API: GET `/api/problems` (列表)
- [ ] API: GET `/api/problems/:id` (详情)
- [ ] 前端题目列表页
- [ ] 前端题目详情页 — 左右分栏布局（左题目描述，右代码编辑器）

### Phase 3 — 判题引擎（核心）
- [ ] 线程池实现 (`judge/threadpool`)
- [ ] 编译模块: 临时文件 → g++ → 检查结果 (`judge/compiler`)
- [ ] 运行模块: fork → setrlimit → dup2 → exec → wait4 → 分析结果 (`judge/runner`)
- [ ] 判题引擎主循环: 投递 → 编译 → 遍历测试点 → 运行 → 比对 → 写结果 (`judge/engine`)
- [ ] API: POST `/api/submit` (接收入库 → 投递线程池)
- [ ] API: GET `/api/submissions/:id` (返回详情含每题点)

### Phase 4 — 判题结果展示
- [ ] 前端 `#/result/:id` 页面：测试点方块网格组件
- [ ] 方块网格：每行 7 个，颜色按状态区分（AC绿/WA红/TLE黄/MLE橙/RE紫/CE灰），超出自动换行
- [ ] 点击方块展开该测试点详情（输入/期望输出/实际输出/耗时/内存）
- [ ] 页面底部折叠展示提交的源代码
- [ ] 轮询机制：提交后跳转 `#/result/:id`，2s 间隔轮询直到判题完成

### Phase 5 — 用户中心
- [ ] API: GET `/api/user/submissions` (分页提交历史)
- [ ] API: GET `/api/user/profile`
- [ ] 前端用户中心页

### Phase 6 — 后台管理
- [ ] admin 鉴权中间件（检查 is_admin）
- [ ] API: 题目 CRUD
- [ ] API: 测试用例 CRUD
- [ ] 前端后台管理页

### Phase 7 — 错误处理与打磨
- [ ] 404/500 页面
- [ ] 全局错误处理中间件
- [ ] 编译限制增强（二进制大小检查）
- [ ] 安全加固审查
- [ ] 前端 UI 打磨

### Phase 8 — 延后（V2）
- [ ] 私信/消息系统
- [ ] 排行榜
- [ ] 多语言
- [ ] Docker 化

---

## 12. 验收标准

| 编号 | 验收项 | 标准 |
|---|---|---|
| AC-1 | 注册/登录 | 用户名+密码注册，登录后获得 token，刷新浏览器保持登录态 |
| AC-2 | 未登录拦截 | 未登录访问任何需鉴权页面跳转 `#/login` |
| AC-3 | 题目列表 | 仅显示 `is_visible=1` 的题目，含编号、标题、限制 |
| AC-4 | 题目详情 | 显示完整描述、输入输出格式、样例、限制 |
| AC-5 | 代码提交 | 提交 C++ 代码，返回 submission_id，前端跳转到 `#/result/:id` 页面 |
| AC-6 | AC 判定 | 所有测试点输出完全匹配 → 总状态 AC |
| AC-7 | WA 判定 | 任一测试点输出不匹配 → 总状态 WA，展示 diff |
| AC-8 | TLE 判定 | 用户代码运行超时 → 进程被 RLIMIT_CPU 杀死 → 总状态 TLE |
| AC-9 | MLE 判定 | 用户代码内存超限 → 进程被 RLIMIT_AS 杀死 → 总状态 MLE |
| AC-10 | RE 判定 | 用户代码非 0 退出 / 段错误 → 总状态 RE |
| AC-11 | CE 判定 | 编译失败 → 返回编译错误信息 |
| AC-12 | 结果页每题点 | 测试点以彩色方块网格展示（7个/行），点击方块可展开该点输入/期望/实际输出、耗时、内存 |
| AC-13 | 用户中心 | 登录用户能看到自己的提交历史列表 |
| AC-14 | 管理员 CRUD | admin 用户可创建/编辑/删除非题目及测试用例 |
| AC-15 | 非 admin 防问 | 普通用户访问 `/api/admin/*` 返回 403 |
| AC-16 | 判题并发 | 3 个用户同时提交不同题目，判题引擎并行处理，互不阻塞 |
| AC-17 | 404/500 | 无效路由返回 404 页，服务端异常返回 500 页 |
| AC-18 | 安全防线 | 用户代码无法读写文件系统、无法 fork 子进程、无法访问网络 |
| AC-19 | 结果轮询 | 跳转到 `#/result/:id` 后前端轮询 `/api/submissions/:id`（2s 间隔），状态非 PENDING/COMPILING/RUNNING 时停止，渲染结果方块网格 |

---

## 13. 风险与权衡

| 风险 | 影响 | 缓解策略 |
|---|---|---|
| 线程池只能并行有限任务 | 大量提交时延迟大 | MVP 可接受；后期可加 Redis 队列 |
| setrlimit 不是完整沙箱 | 仍有逃逸风险（内核漏洞） | 个人学习项目可接受；V2 上 Docker |
| MySQL BLOB/TEXT 存储大输入输出 | 慢查询，DB 膨胀 | 设置 `max_allowed_packet`；V2 可迁文件系统 |
| 无 HTTPS | 密码明文传输 | 单机可用；生产环境加 Nginx 反代 |
| ctemplate 学习成本 | 初期上手慢 | 仅用于骨架注入，复杂度低 |
