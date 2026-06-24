# SPEC.md — MioOJ 仿 LeetCode OJ 系统

## 1. 项目概述

| 属性 | 值 |
|---|---|
| **项目名称** | MioOJ（用户可见品牌名；后端二进制/数据库等内部标识仍为 `vibeoj`） |
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
- 搜索筛选：支持按**题目编号**（`1`、`#3`）、**标题关键词**、**难度文字**搜索 + 难度下拉筛选（客户端实时过滤，可组合）
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
- Tab 导航布局：统计 | 题目管理 | 用户管理 | 公告管理 | **讨论管理**
- **统计仪表盘**：总用户数、总题目数、总提交数 + **最近动态**（最新提交/新用户/新讨论各 10 条）
- **题目管理**：列表（含难度/可见/隐藏）、批量操作、**三步向导新建**（基本信息 → 标程 → 测试用例，可暂存草稿）、**单页编辑**
- **录题/标程**：`questions.reference_code` 持久化；ACE 编辑器录入 C++ 标程；一键编译运行生成期望输出并 **AC 校验**
- **发布校验**：设为「可见」须 **≥1 测试用例 + 已保存标程**，否则后端直接拒绝
- **标程变更提示**：编辑页修改标程后提示「期望输出可能过期，请重新生成」
- **题目描述**：Markdown 录入 + 实时预览；**预览做题页**（新标签打开 `#/problems/:id`，管理员可查看隐藏题）
- **测试用例管理**：增删改查、**连续添加**（序号从 0 自动递增）、行内编辑、截断预览 + **展开全文弹窗**（统一 `showAlert`/`showConfirm`，LeetCode 白模式为白底简约）
- **题目展示编号**：用户可见 `#` 为 `display_index`（**从 0 开始**），与数据库自增 `id` 解耦；新建题目时自动分配 `MAX(display_index)+1`
- **用户管理**：列表（分页+搜索）、删除用户（级联删库 + 清理 `user_*` 文件）、升降管理员、**封禁/解封**（立即踢 session）、**管理员重置密码**（设定新密码并清 session）
- **讨论管理**：列表 + 搜索、删帖/删回复、跳转原帖
- **系统公告**：管理员发布/编辑/删除公告
- **管理员导航栏**：隐藏「我的」链接，显示：题目 | 排行榜 | 公告 | 讨论 | 管理 | 退出 + 私信图标
- **普通用户导航栏**：题目 | 排行榜 | 公告 | 讨论 | 我的 | 退出 + 私信图标（含未读计数角标）
- **未登录导航栏**：公告 | 讨论 | 登录（公告和讨论为公开页）
- 管理页需要管理员权限

### 2.6 通用
- 404 页面（路由未匹配）
- 500 页面（服务器异常友好提示）
- 服务端 HTTP 异常处理：`set_error_handler` 返回 JSON 格式错误（对 API 消费者友好）；SPA Hash Router 渲染 `#/404` 和 `#/500` 客户端 HTML 错误页
- 后端错误信息中文化（大部分 API 响应 message 已中文化，少数边缘路径保留英文）
- 登录页仅提示"用户名或密码错误"，不区分具体原因（防枚举攻击）
- **网站图标（favicon）**：从 `web/icons/` 目录随机选取一张图片作为浏览器标签页图标；用户向该目录放入图片后刷新页面即可生效
- **确认/提示弹窗**：全站统一 `showConfirm` / `showAlert` / `showPrompt`（`utils.js`），替代浏览器原生 `confirm` / `alert` / `prompt`
  - **相册模式**：黑金双层金边弹窗，与导航栏/设置面板风格一致；删除/封禁/重置等危险操作确认按钮红色强调
  - **LeetCode 白模式**（`body.lc-white`）：白底简约卡片弹窗，与页面浅色风格一致
  - 支持 Esc 取消、Enter 确认、点击遮罩关闭（alert 仅确定）
  - 轻量操作反馈仍使用 Toast（`showToast`），不阻塞页面

### 2.7 讨论系统

（内容同上，保持不变）

### 2.8 排行榜

- Top 100 积分排名表：按积分降序、AC 题数降序、总提交数升序、注册时间升序
- **仅展示有积分（>0）的用户**；0 分用户不出现在榜单中
- 积分规则：简单题 1 分 / 中等题 2 分 / 困难题 3 分，**每道题 AC 只计一次**（去重）
- 当前用户积分卡片：显示自己的**名次**、积分、AC 数、总提交数（即使未上榜也显示）
- 导航栏入口：「排行榜」链接 → `#/leaderboard`

### 2.9 私信/消息系统

- 用户会话列表：显示对方用户名/头像、最后消息预览、未读计数
- 聊天窗口：支持 Markdown 消息、分页加载历史（50 条/页）、10s 轮询刷新
- 发起私信：① 私信页搜索用户；② **从他人公开主页点击「发私信」**
- **他人公开主页** `#/users/:id`：仅展示头像、用户名、积分/AC 等公开统计，**不暴露**邮箱、管理员身份、提交历史等敏感信息；点击讨论/排行榜等处他人头像进入
- 未读角标：导航栏邮件图标显示未读消息总数 → 进入会话自动标记已读
- **消息撤回**：发送者可在 **1 分钟内** 右键自己的消息选择「撤回」；双方均显示「你/对方撤回了一条消息」占位；会话列表预览显示 `[已撤回]`
- 数据库表：`conversations`（用户配对 + UNIQUE 约束）+ `messages`（含 `is_read`、`is_recalled` 标记）

---

## 3. 延迟功能（V2）

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
│  │                │  │  /api/discussions/*       │ │
│  │                │  │  /api/.../comments/*      │ │
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
               │  - discussions  │
                │  - comments     │
                │  - conversations│
                │  - messages     │
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
    is_banned       TINYINT(1)   NOT NULL DEFAULT 0,
    background_url  VARCHAR(512) DEFAULT NULL,       -- 用户自定义背景图路径，NULL=使用系统相册随机图
    avatar_url      VARCHAR(512) DEFAULT NULL,       -- 用户头像路径，注册时随机分配系统默认头像
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

> **用户媒体文件存储**：壁纸/头像的图片二进制存于 `web/backgrounds/`、`web/avatars/` 目录；数据库仅保存路径（`background_url` / `avatar_url`）。管理员删除用户时，除 `ON DELETE CASCADE` 清理关联表外，还会删除该用户的 `user_{id}.*` 上传文件（系统默认头像 `at*.webp` 不受影响）。

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
    display_index   INT          NOT NULL DEFAULT 0,   -- 用户可见题号，从 0 开始
    title           VARCHAR(256) NOT NULL,
    description     TEXT         NOT NULL,
    input_format    TEXT,                             -- 输入格式说明
    output_format   TEXT,                             -- 输出格式说明
    sample_input    TEXT,
    sample_output   TEXT,
    difficulty      ENUM('简单','中等','困难') NOT NULL DEFAULT '简单',  -- 难度分级（中文字段值）
    reference_code  TEXT         DEFAULT NULL,       -- 标程 C++ 代码
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
    compile_error   TEXT,
    total_time      INT,
    total_memory    INT,
    passed_count    INT,
    total_count     INT,
    detail_json     JSON,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);
```

### 5.6 announcements
```sql
CREATE TABLE announcements (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(256) NOT NULL,
    content         TEXT         NOT NULL,
    is_pinned       TINYINT(1)   NOT NULL DEFAULT 0,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 5.7 discussions — 大讨论帖子
```sql
CREATE TABLE discussions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT      NOT NULL,
    content     TEXT     NOT NULL,        -- Markdown 正文
    like_count  INT      NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 5.8 discussion_replies — 大讨论回复（二级嵌套）
```sql
CREATE TABLE discussion_replies (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    discussion_id   INT      NOT NULL,
    user_id         INT      NOT NULL,
    parent_reply_id INT      DEFAULT NULL,  -- NULL=直接回复帖子，非NULL=回复某条回复（仅一级）
    content         TEXT     NOT NULL,
    like_count      INT      NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (discussion_id)  REFERENCES discussions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)        REFERENCES users(id)       ON DELETE CASCADE,
    FOREIGN KEY (parent_reply_id) REFERENCES discussion_replies(id) ON DELETE CASCADE
);
```

### 5.9 discussion_likes — 大讨论点赞
```sql
CREATE TABLE discussion_likes (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL,
    target_type ENUM('discussion','reply') NOT NULL,  -- 点赞目标类型
    target_id   INT          NOT NULL,                -- 点赞目标 ID
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_target (user_id, target_type, target_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 5.10 problem_comments — 题目评论
```sql
CREATE TABLE problem_comments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT      NOT NULL,
    user_id     INT      NOT NULL,
    content     TEXT     NOT NULL,
    like_count  INT      NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE
);
```

### 5.11 comment_replies — 题目评论回复（二级嵌套）
```sql
CREATE TABLE comment_replies (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    comment_id       INT      NOT NULL,
    user_id          INT      NOT NULL,
    parent_reply_id  INT      DEFAULT NULL,
    content          TEXT     NOT NULL,
    like_count       INT      NOT NULL DEFAULT 0,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id)       REFERENCES problem_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)          REFERENCES users(id)            ON DELETE CASCADE,
    FOREIGN KEY (parent_reply_id)  REFERENCES comment_replies(id)  ON DELETE CASCADE
);
```

### 5.12 comment_likes — 题目评论点赞
```sql
CREATE TABLE comment_likes (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL,
    target_type ENUM('comment','reply') NOT NULL,
    target_id   INT          NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_target (user_id, target_type, target_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 5.13 conversations — 私信会话
```sql
CREATE TABLE conversations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user1_id        INT NOT NULL,
    user2_id        INT NOT NULL,
    last_message_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_pair (user1_id, user2_id)
);
```

### 5.14 messages — 私信消息
```sql
CREATE TABLE messages (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id       INT NOT NULL,
    content         TEXT NOT NULL,
    is_read         TINYINT(1) NOT NULL DEFAULT 0,
    is_recalled     TINYINT(1) NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_conv_time (conversation_id, created_at),
    INDEX idx_unread (conversation_id, sender_id, is_read)
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
| GET | `/api/user/profile` | 当前用户信息（含 avatar_url） | 需要 |
| GET | `/api/user/ac-code/:question_id` | 获取用户在某题下最新 AC 提交的代码（返回 {found, code}） | 需要 |
| GET | `/api/user/ac-codes/:question_id` | 获取用户在某题下所有 AC 提交的代码列表（返回 [{id, code, total_time, total_memory, created_at}]，按提交时间倒序） | 需要 |
| POST | `/api/user/avatar/upload` | 上传自定义头像（multipart form，field: avatar），裁剪后提交（1:1 正方形） | 需要 |
| DELETE | `/api/user/avatar` | 删除自定义头像 → 重新随机分配一个系统默认头像 | 需要 |

### 6.5 背景管理

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/backgrounds` | 获取系统背景图片列表（无需登录；仅返回系统图片，不包含用户上传的 `user_*` 文件） | 无 |
| POST | `/api/backgrounds/upload` | 上传自定义背景图（multipart form，field: background） | 需要 |
| POST | `/api/backgrounds/delete` | 删除用户自定义背景图（删除文件 + 清空 `users.background_url`） | 需要 |

### 6.6 管理员

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/admin/stats` | 统计仪表盘 + 最近动态（提交/用户/讨论各 10 条） | 需要 + admin |
| GET | `/api/admin/questions` | 题目列表（含隐藏题目、难度） | 需要 + admin |
| GET | `/api/admin/questions/:id` | 单题详情（含隐藏题目） | 需要 + admin |
| POST | `/api/admin/questions` | 创建题目（草稿，`is_visible` 强制为 0；必填难度） | 需要 + admin |
| PUT | `/api/admin/questions/:id` | 编辑题目（含 `difficulty`、`reference_code`；发布时校验用例+标程） | 需要 + admin |
| DELETE | `/api/admin/questions/:id` | 删除题目 | 需要 + admin |
| POST | `/api/admin/questions/batch` | 批量操作（hide/show/delete，body: {action, ids}）；`show` 时逐题校验发布条件 | 需要 + admin |
| GET | `/api/admin/questions/:id/testcases` | 获取测试用例列表 | 需要 + admin |
| POST | `/api/admin/questions/:id/testcases` | 添加测试用例 | 需要 + admin |
| PUT | `/api/admin/questions/:id/testcases/:tc_id` | 编辑测试用例 | 需要 + admin |
| DELETE | `/api/admin/questions/:id/testcases/:tc_id` | 删除测试用例 | 需要 + admin |
| POST | `/api/admin/reference/generate` | 编译运行标程生成期望输出（body: {code, input_data}，多组输入用 \|\|\| 分隔）；返回 `outputs` + `statuses`（逐用例 AC 校验） | 需要 + admin |
| GET | `/api/admin/users` | 用户列表（分页+搜索，含 `is_banned`） | 需要 + admin |
| DELETE | `/api/admin/users/:id` | 删除用户（级联删除 sessions/submissions/讨论/评论等关联数据；删除 `web/backgrounds/user_{id}.*` 与 `web/avatars/user_{id}.*` 上传文件） | 需要 + admin |
| PUT | `/api/admin/users/:id/admin` | 提升/取消管理员（body: {is_admin: bool}） | 需要 + admin |
| PUT | `/api/admin/users/:id/ban` | 封禁/解封用户（body: {is_banned: bool}）；封禁时删除其全部 session | 需要 + admin |
| PUT | `/api/admin/users/:id/password` | 管理员重置用户密码（body: {password}，≥8 位）；重置后删除其全部 session | 需要 + admin |
| GET | `/api/admin/discussions` | 讨论列表（分页+搜索，参数: page, search） | 需要 + admin |
| GET | `/api/admin/discussions/:id/replies` | 某帖全部回复（管理用） | 需要 + admin |
| GET | `/api/admin/announcements` | 公告列表（管理员视图） | 需要 + admin |
| POST | `/api/admin/announcements` | 发布公告 | 需要 + admin |
| PUT | `/api/admin/announcements/:id` | 编辑公告 | 需要 + admin |
| DELETE | `/api/admin/announcements/:id` | 删除公告 | 需要 + admin |

### 6.7 公告（公开）

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/announcements` | 获取所有公告（按置顶+创建时间排序） | 无 |

### 6.8 大讨论

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/discussions?page=&page_size=` | 帖子列表（含用户名、头像、回复数、当前用户点赞状态） | 需要 |
| POST | `/api/discussions` | 发帖 `{content}` | 需要 |
| GET | `/api/discussions/:id` | 帖子详情 + 回复列表（二级嵌套，含用户信息、点赞状态） | 需要 |
| DELETE | `/api/discussions/:id` | 删帖（本人或 admin） | 需要 |
| POST | `/api/discussions/:id/like` | 点赞帖子（幂等） | 需要 |
| DELETE | `/api/discussions/:id/like` | 取消点赞 | 需要 |
| POST | `/api/discussions/:id/replies` | 回复帖子 `{content, parent_reply_id?}` | 需要 |
| DELETE | `/api/discussions/:id/replies/:rid` | 删回复（本人或 admin） | 需要 |
| POST | `/api/discussions/:id/replies/:rid/like` | 点赞回复 | 需要 |
| DELETE | `/api/discussions/:id/replies/:rid/like` | 取消点赞 | 需要 |

### 6.9 题目评论区

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/problems/:id/comments?page=&page_size=` | 评论列表（二级嵌套回复，含用户信息、点赞状态） | 需要 |
| POST | `/api/problems/:id/comments` | 发表评论 `{content}` | 需要 |
| POST | `/api/problems/:id/comments/:cid/replies` | 回复评论 `{content, parent_reply_id?}` | 需要 |
| DELETE | `/api/problems/:id/comments/:cid` | 删评论（本人或 admin） | 需要 |
| DELETE | `/api/problems/:id/comments/:cid/replies/:rid` | 删回复 | 需要 |
| POST | `/api/problems/:id/comments/:cid/like` | 点赞评论 | 需要 |
| DELETE | `/api/problems/:id/comments/:cid/like` | 取消点赞 | 需要 |
| POST | `/api/problems/:id/comments/:cid/replies/:rid/like` | 点赞回复 | 需要 |
| DELETE | `/api/problems/:id/comments/:cid/replies/:rid/like` | 取消点赞 | 需要 |

### 6.10 网站图标

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/icons` | 获取系统网站图标列表（无需登录；返回 `web/icons/` 下所有图片路径数组） | 无 |
| GET | `/favicon.ico` | 浏览器默认 favicon 请求；从 `web/icons/` 随机选取一张图片返回（目录为空时 404） | 无 |

### 6.11 排行榜

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/leaderboard` | Top 100 积分排名（简单1分/中等2分/困难3分，**每题 AC 去重**；**仅 points>0**；按积分降序、AC数降序、提交数升序、注册时间升序） | 需要 |
| GET | `/api/leaderboard/my-rank` | 当前用户排名与积分（返回 **rank**、points、ac_count、total_subs；未上榜时 rank 可为 null/-1） | 需要 |
| GET | `/api/users/:id/public` | 他人公开资料（username、avatar_url、points、ac_count；不含邮箱/管理员/提交详情） | 需要 |

### 6.12 私信/消息

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/messages/conversations` | 会话列表（含对方用户名/头像、最后消息、未读数） | 需要 |
| POST | `/api/messages/conversations` | 获取或创建与指定用户的会话 `{peer_id}` | 需要 |
| GET | `/api/messages/conversations/:id?page=&page_size=` | 会话消息列表（分页，50条/页，含发送者信息 + `is_me` 标记） | 需要 |
| POST | `/api/messages/conversations/:id` | 发送消息 `{content}`（支持 Markdown） | 需要 |
| GET | `/api/messages/unread-count` | 获取当前用户未读消息总数 | 需要 |
| POST | `/api/messages/read/:id` | 标记会话所有对方消息为已读 | 需要 |
| POST | `/api/messages/recall/:id` | 撤回消息（仅发送者、发送后 60 秒内、未撤回过） | 需要 |
| GET | `/api/messages/search-users?q=` | 搜索用户（按用户名模糊搜索，排除自己+封禁用户，最多20条） | 需要 |

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
|---|---|---|---|
| `#/` 或 `#/login` | 登录页 | 未登录默认 |
| `#/register` | 注册页 | |
| `#/problems` | 题目列表 | 需要登录 |
| `#/problems/:id` | 题目详情 + 提交区 | 左右分栏：左题目描述，右 ACE 代码编辑器 |
| `#/result/:submissionId` | 判题结果页 | 测试点方块网格 + 详情展开（提交后跳转到此页） |
| `#/user` | 用户中心 | 提交历史（管理员不可见，导航栏隐藏） |
| `#/announcements` | 系统公告页 | 公开页面，展示所有公告 |
| `#/admin` | 后台管理首页 | 仅管理员，Tab：统计/题目/用户/公告/讨论 |
| `#/admin/stats` | 管理员 → 统计 | |
| `#/admin/questions` | 管理员 → 题目管理 | 列表+批量操作+创建 |
| `#/admin/announcements` | 管理员 → 公告管理 | 发布/编辑/删除公告 |
| `#/admin/questions/new` | 管理员 → 新建题目向导 | 三步：基本信息 → 标程 → 测试用例 |
| `#/admin/questions/:id` | 管理员 → 编辑题目 | 单页：基本信息+Markdown预览+ACE标程+测试用例+预览做题页 |
| `#/admin/users` | 管理员 → 用户管理 | 分页+搜索+封禁+重置密码+删除 |
| `#/admin/discussions` | 管理员 → 讨论管理 | 搜索+删帖/删回复 |
| `#/discussions` | 大讨论列表页 | 卡片式信息流，20条/页，需要登录 |
| `#/discussions/:id` | 帖子详情页 | Markdown 正文渲染 + 回复列表（二级嵌套）+ 点赞 |
| `#/leaderboard` | 排行榜页 | Top 100 积分排名表格（仅 >0 分用户）+ 当前用户积分/名次卡片，需要登录 |
| `#/messages` | 私信页 | 左侧会话列表（搜索+发起）+ 右侧聊天窗口（分页+轮询），需要登录 |
| `#/users/:id` | 他人公开主页 | 头像、用户名、积分/AC 等公开统计 +「发私信」按钮（非本人）；不展示敏感信息，需要登录 |
| `#/404` | 404 页面 | 路由未匹配 |
| `#/500` | 500 页面 | 服务器异常 |

> ctemplate 用于初始 HTML 骨架 `<head>/<script>` 注入，SPA 路由由前端 JS Hash Router 驱动。

---

## 9. 项目目录结构（实际实现）

```
MioOJ/
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
│   │   ├── schema.sql               # 建表脚本（14 张表）
│   │   ├── seed.sql                 # 种子数据（2 道示例题 + 15 个测试点）
│   │   ├── migrate_phase13.sql      # Phase 13 迁移：新增 conversations + messages 表
│   │   └── migrate_phase27.sql      # Phase 27 迁移：questions.reference_code + users.is_banned
│   ├── handler/
│   │   ├── auth.cpp                  # 注册（Argon2id 哈希）、登录（Token+Cookie）、退出
│   │   ├── problem.cpp               # 题目列表（仅 is_visible=1）、题目详情
│   │   ├── submission.cpp            # 提交代码 → 入库 → 投递判题引擎、结果查询
│   │   ├── user.cpp                  # 个人资料、提交历史（分页）
│   │   ├── admin.cpp                 # 题目 CRUD + 测试用例 CRUD + 统计 + 批量操作 + 标程生成 + 用户管理（含删用户时清理上传文件）
│   │   ├── announcement.cpp          # 公告 CRUD（管理员/公开）
│   │   ├── background.cpp             # 背景图片管理：系统相册列表、上传、删除
│   │   ├── icon.cpp                   # 网站图标管理：系统图标列表、随机 favicon 服务
│   │   ├── avatar.cpp                 # 头像管理：默认头像随机分配、上传、删除
│   │   ├── discussion.cpp              # 大讨论：帖子 CRUD + 回复 + 点赞（`handler/discussion.cpp`）
│   │   ├── comment.cpp                 # 题目评论区：评论 CRUD + 回复 + 点赞（`handler/comment.cpp`）
│   │   ├── leaderboard.cpp              # 排行榜：Top 100 积分排名 + 当前用户排名（`handler/leaderboard.cpp`）
│   │   ├── message.cpp                  # 私信/消息：会话 CRUD + 消息收发 + 未读计数 + 用户搜索（`handler/message.cpp`）
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
│       ├── logger.hpp               # 日志系统（线程安全、分级、控制台+文件双输出）
│       └── tmpfile.hpp/.cpp          # 临时文件管理（mkstemps + RAII 自动清理）
├── web/                              # 前端静态文件（SPA）
│   ├── backgrounds/                   # 背景相册目录（用户可放入图片，自动虚化作为随机背景）
│   ├── icons/                         # 网站图标目录（用户可放入图片，随机选取作为 favicon）
│   ├── avatars/                       # 头像目录：系统默认头像 (at*.webp) + 用户自定义头像 (user_*.*)
│   ├── index.html                    # SPA 入口（ctemplate 渲染 → Hash Router 接管，含 ACE CDN 引入；页面加载时随机设置 favicon）
│   ├── css/
│   │   └── style.css                 # 全局样式（LeetCode 风格简约浅色主题）
│   └── js/
│       ├── router.js                 # Hash Router：路由匹配、Auth 守卫、页面调度、设置面板
│       ├── api.js                    # HTTP 请求封装（fetch + JSON）
│       ├── utils.js                  # DOM 工具函数
│       ├── effects.js               # 背景管理系统（系统相册+自定义上传+图片裁剪+图片预加载+登录后刷新+虚化滑块+LeetCode白模式切换+使用我的壁纸开关）
│       ├── pages/
│       │   ├── login.js              # 登录页
│       │   ├── register.js           # 注册页
│       │   ├── problems.js           # 题目列表
│       │   ├── problemDetail.js      # 题目详情 + ACE 代码编辑器 + 提交
│       │   ├── result.js             # 判题结果（方块网格 + 轮询 + 详情展开）
│       │   ├── userCenter.js         # 用户中心（提交历史分页）
│       │   ├── admin.js              # 后台管理首页 Tab 布局（统计 + 题目管理 + 批量操作）
│       │   ├── adminQuestions.js     # 新建题目表单（Tab 内嵌或独立打开）
│       │   ├── adminQuestionEdit.js  # 编辑题目 + 测试用例管理（行内编辑）+ 标程自动生成
│       │   ├── adminUsers.js         # 用户管理（分页+搜索+权限切换+删除）
│       │   ├── adminAnnouncements.js # 公告管理（发布+编辑+删除）
│       │   ├── announcements.js      # 公示公告展示页
│       │   ├── discussions.js        # 大讨论列表页（卡片式信息流）
│       │   ├── discussionDetail.js   # 帖子详情页（Markdown 渲染 + 二级回复 + 点赞）
│       │   └── problemComments.js    # 题目讨论 Tab（复用回复/点赞组件）
│       │   ├── leaderboard.js         # 排行榜页（排名表格 + 用户积分卡）
│       │   ├── userProfile.js         # 他人公开主页（积分/名次 + 发私信）
│       │   └── messages.js            # 私信页（会话列表 + 聊天窗口 + 轮询 + 搜索）
└── test/                             # 测试用例示例（预留）
    └── cases/
```

---

## 10. 前端页面线框

> **视觉风格（MioOJ 黑金主题）**：支持两种背景模式，通过导航栏 ⚙ 设置面板切换：
>   - **相册模式（默认）**：从 `web/backgrounds/` 目录随机选取图片作为页面背景；独立暗色遮罩层 `#bg-overlay` 确保前景可读。**相册模式下**导航栏、登录框、设置面板采用**双层金边镶嵌**（外金线 + 内暗框）；整体黑金奢华配色（暖金 `#d4af37` / `#fcd9b8` 强调，替代旧版亮黄 `#fdbb2d`）。
>   - **LeetCode 经典白模式**：纯白/浅灰配色，白色背景 (#f7f8fa)，无毛玻璃效果，面板使用纯白卡片+浅灰边框，**不显示金边镶嵌**。
>   - 品牌 Logo：**MioOJ** + 可爱猫耳吉祥物 SVG；设置面板开关为青蓝→浅粉长条样式（与黑金主色并存）。
>   - 支持用户通过设置面板上传自定义背景图（存储到 `web/backgrounds/` 目录），上传前弹出 Canvas 裁剪对话框。
>   - **网站图标**：从 `web/icons/` 目录随机选取一张图片作为浏览器标签页 favicon（每次刷新随机；建议 32×32 或 64×64 正方形 ICO/PNG 等格式）。

### 设计 Token（相册模式）

| Token | 值 | 用途 |
|---|---|---|
| `--gold-light` | `#fcd9b8` | Logo、标题、导航 hover |
| `--gold-mid` | `#d4af37` | 主按钮、强调边框、选中态 |
| `--gold-dark` | `#b8860b` | 按钮渐变深色端 |
| 金边镶嵌 | 外 `rgba(212,175,55,0.45)` + 内暗框 | `#navbar` / `.auth-box` / `#settings-panel` |
| 难度标签 | `.diff-easy` / `.diff-medium` / `.diff-hard` | 全站统一 CSS 类（暗/白模式各一套） |

### 登录页 `#/login`
```
┌─────────────────────────────────┐
│      🐱 MioOJ                    │
│  ┌─金边───────────────────┐    │
│  │ 用户名: [            ]   │    │
│  │ 密码:   [            ]   │    │
│  │  [ 登 录 ]               │    │
│  │ 没有账号？[去注册]·[公告] │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

### 题目列表 `#/problems`
```
┌──────────────────────────────────────────────────────┐
│ 🐱 MioOJ   [题目*] [公告] [我的] [管理] [退出]  ⚙      │  ← * 当前页高亮
├──────────────────────────────────────────────────────┤
│  [🔍 搜索题目...]  [▼ 全部难度]                        │
│  #  标题              难度    时间限制  内存限制       │
│  1  A+B Problem       简单     1s       256MB        │
│  ...                                                 │
│  （无题目时显示引导文案）                              │
└──────────────────────────────────────────────────────┘
```

> 搜索框支持编号（`1` / `#3`）、标题关键词、难度文字；难度下拉可组合筛选，客户端即时过滤无需请求后端。

### 题目详情 + 提交 `#/problems/1`（左右分栏布局）

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← 返回题目列表     A+B Problem                                          │
├─────────────────────────┬──┤────────────────────────────────────────────┤
│  左侧：题目面板 (可调宽度) │║│  右侧：ACE 代码编辑器面板                      │
│                            │║│  [主题: Monokai ▼]                           │
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

> **左右分栏可调**：题目详情页中间有金色 `layout-resizer` 拖拽条，宽度比例持久化到 `localStorage`（键 `miooj_split_ratio`，默认 0.5）。
>
> **编辑器主题**：编辑器工具栏提供主题下拉（Chrome / Tomorrow / Monokai / One Dark），持久化到 `localStorage`（键 `miooj_editor_theme`）。
>
> **提交反馈**：提交时按钮进入 loading 态，成功/失败通过 Toast 通知（非 alert）。
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
- 当前选中的方块有高亮边框（相册模式为金色 `#d4af37`；▶ 标记）
- 点击方块 → 详情面板带展开动画
- 结果页提供「再试一次」按钮，跳转回 `#/problems/:id`
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

### 大讨论列表 `#/discussions`
```
┌──────────────────────────────────────────────────────┐
│ 🐱 MioOJ   [题目] [公告] [讨论*] [我的] [退出]  ⚙     │
├──────────────────────────────────────────────────────┤
│  ← 返回题目列表              [发帖]                    │
│                                                      │
│  ┌─ 讨论帖 ─────────────────────────────────────────┐ │
│  │ 🐱 用户名    2026-01-15 10:30                    │ │
│  │ 这是帖子内容的前 100 字预览...                    │ │
│  │ ♥ 12  |  💬 5 条回复                             │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ 讨论帖 ─────────────────────────────────────────┐ │
│  │ ...                                              │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  [加载更多]                                           │
└──────────────────────────────────────────────────────┘
```

### 帖子详情 `#/discussions/1`
```
┌──────────────────────────────────────────────────────┐
│  ← 返回讨论列表                                       │
│                                                      │
│  ┌─ 帖子 ───────────────────────────────────────────┐ │
│  │ 🐱 用户名    2026-01-15 10:30                    │ │
│  │                                                  │ │
│  │ **Markdown** 渲染的正文内容...                     │ │
│  │ ```cpp                                           │ │
│  │ // 支持代码块语法高亮                               │ │
│  │ ```                                              │ │
│  │                                                  │ │
│  │ [♥ 12 赞]  [回复楼主]  [删除]                      │ │
│  └──────────────────────────────────────────────────┘ │
│  （点击「回复楼主」后才出现行内回复框，进入详情页不自动展示） │
│                                                      │
│  ┌─ 5 条回复 ───────────────────────────────────────┐ │
│  │ 🐱 用户A  回复内容...  ♥ 3  [回复] [删除]        │ │
│  │   └ 🐱 用户B  @用户A 回复的回复  ♥ 1  [删除]    │ │  ← 二级嵌套
│  │ 🐱 用户C  另一条回复...  ♥ 0  [回复] [删除]       │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  [加载更多回复]                                        │
└──────────────────────────────────────────────────────┘
```

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

## 11. TODO 清单

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
- [x] 管理页 Tab 导航布局（统计 | 题目管理 | 用户管理 | 公告管理）
- [x] 统计仪表盘（总用户/题目/提交数）
- [x] 题目批量操作（全选/隐藏/显示/删除）

### Phase 6.1 — 后台管理增强（录题 + 用户 + 公告）
- [x] 录题标程：录入 C++ 标程 → 一键编译运行 → 自动填充每组输入的期望输出
- [x] 测试用例行内编辑 UI（点击编辑按钮行内修改 input/expected_output/order_index）
- [x] 用户管理：用户列表（分页+搜索）+ 删除用户 + 提升/取消管理员权限
- [x] 系统公告：管理员发布/编辑/删除公告，`#/announcements` 公共公告展示页
- [x] 管理员导航栏隐藏「我的」链接
- [x] announcements 数据库表 + CRUD API + 公开列表 API

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

### Phase 13 — 排行榜与私信（部分完成 → Phase 29 补完）

**后端 / 基础设施（已完成）**
- [x] 排行榜 API 骨架：`GET /api/leaderboard`、`GET /api/leaderboard/my-rank`（`handler/leaderboard.cpp`）
- [x] 私信/消息系统：7 个 API（会话列表、创建会话、消息列表分页、发送消息、未读计数、标记已读、搜索用户）；数据库 `conversations` + `messages` 表（`migrate_phase13.sql`）（`handler/message.cpp`）
- [x] 导航栏「排行榜」链接 + 私信邮件图标；`router.js` 注册 `#/leaderboard` / `#/messages` 路由
- [x] `style_v2.css` 排行榜/私信 CSS（相册+白模式）；`api.js` 9 个 API 方法

**前端 / 业务逻辑（Phase 13 初版未完成，Phase 29 已补完）**
- [x] 排行榜积分按题 AC 去重（Phase 29 修复 SQL）
- [x] `my-rank` 返回真实名次（Phase 29）
- [x] 排行榜仅展示 points>0 用户；顶部卡片显示自己的名次（Phase 29）
- [x] 前端排行榜页 `#/leaderboard` 正确渲染（Phase 29 修复 `escapeHtml`）
- [x] 前端私信页 `#/messages` 正确渲染（Phase 29）
- [x] 他人公开主页 `#/users/:id` + 从讨论/排行榜等处点击头像进入（Phase 29）
- [x] 公开主页「发私信」按钮（对他人显示；对自己隐藏）（Phase 29）
- [x] 私信页 `#/messages?user=:id` 深链自动打开会话（Phase 29）

> 多语言、Docker 化已移至 §3 延迟功能（V2），不属于 Phase 13 交付范围。

### Phase 14 — 体验优化
- [x] 测试数据隐私保护：`detail_json` 移除 `input`/`expected`/`actual` 字段，结果页只显示状态、耗时、内存
- [x] 代码持久化：每个用户、每题代码自动保存到浏览器 `localStorage`（键 `code_{用户ID}_{题目ID}`），离开/刷新页面自动恢复，提交后不清除；**同浏览器换账号互不干扰**
- [x] 用户中心改进：两层视图（问题状态总览 + 可展开提交历史），增加提交统计（总次数/通过题数/尝试题数），表格增加耗时/内存列和跳转提示
- [x] 用户中心 API：`title` 字段 JSON 转义，修复特殊字符导致前端解析失败
- [x] 登录页改进：移除用户名长度提示和 `minlength`（该校验仅注册页需要），placeholder 改中文，错误提示中文化
- [x] 后端错误信息中文化：注册/登录/提交/鉴权核心路径返回消息已中文化

### Phase 15 — 已知限制（V2 改进）
- [ ] 判题引擎编译阶段未检查二进制文件大小（Spec 要求 ≤ 50MB）
- [ ] `submission.cpp`/`problem.cpp`/`user.cpp` handler 缺少外层 try/catch，异常可能传播到 cpp-httplib 导致空响应
- [ ] 部分 API 边缘路径错误消息仍为英文（如空 body 检测、404 not found 等）
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

### Phase 19 — 背景系统改造
- [x] 移除 Canvas 粒子漂浮动画、CSS 飘云层、星星层等旧特效（`index.html` + `style.css` + `effects.js`）
- [x] 创建 `web/backgrounds/` 相册目录，支持用户放入 JPG/PNG/WebP 等图片
- [x] 后端 `GET /api/backgrounds`：列出系统相册 `web/backgrounds/` 下所有图片（`handler/background.cpp`）
- [x] 后端 `POST /api/backgrounds/upload`：上传自定义背景图（multipart form），写入 `users.background_url`，替换时自动删除旧文件（`handler/background.cpp`）
- [x] `users` 表新增 `background_url` 字段（VARCHAR(512) DEFAULT NULL）：NULL=使用系统相册随机图，非NULL=使用该用户专属背景
- [x] 用户 profile 接口新增返回 `background_url` 字段（`handler/user.cpp`）
- [x] 前端背景优先级：`users.background_url`（非NULL）> 系统相册随机图 > 无图时默认暗色背景（`effects.js`）
- [x] 前端背景系统：图片保持原画质（默认无虚化），通过独立暗色遮罩层 `#bg-overlay`（rgba(0,0,0,0.45)）确保前景文字可读，避免 brightness 滤镜损伤画质（`effects.js` + `style.css` + `index.html`）
- [x] LeetCode 经典白模式：设置面板关闭「相册背景」后切换到纯白/浅灰配色，卡片去除毛玻璃效果（`style.css` body.lc-white 系列规则）
- [x] 设置面板改动：「背景特效」→「相册背景」toggle + 「上传背景」按钮 + 「代码自动补全」修复联动（`router.js` + `index.html`）
- [x] 代码自动补全修复：设置面板开关通过 `window.setAutocompleteEnabled()` 真正控制 ACE 编辑器（`router.js` + `problemDetail.js`）
- [x] 设置面板新增「背景虚化」滑块（0~30px，默认 0px），用户可自定义高斯模糊强度，独立于暗色遮罩层，实时生效并持久化到 localStorage（`effects.js` + `router.js` + `index.html` + `style.css`）
- [x] 登录页自动跳转：已登录用户（Cookie 有效）访问 `#/login` 或 `#/register` 时自动跳转到 `#/problems`（`router.js`）
- [x] 图片裁剪功能：上传背景图时弹出 Canvas 裁剪对话框，裁剪框锁定视口宽高比（`window.innerWidth / window.innerHeight`），确保裁出的区域能完美填充整个页面背景。支持拖拽移动裁剪框、四角+四边缩放（保持宽高比），金色半透明遮罩+手柄交互。裁剪后转为 JPEG（92%质量）上传，无外部依赖，纯 Canvas API 实现（`effects.js` + `index.html` + `style.css` + `router.js`）
- [x] 图片预加载：背景图片通过 `Image()` 对象预加载，`onload` 完成后再设置 `background-image`，避免 CSS transition 期间图片未准备好的空白闪烁（`effects.js`）
- [x] 登录后背景刷新：`App.loadUser()` 完成后调用 `window.refreshBackground()`，确保登录/注册成功后立即检查并加载用户的个性化背景，无需手动刷新页面（`effects.js` + `router.js`）
- [x] BUILD PASS：编译通过

### Phase 20 — 壁纸管理增强
- [x] 后端 `GET /api/backgrounds` 去掉鉴权：未登录用户也能获取系统壁纸列表，确保登录/注册页面可显示系统背景图
- [x] 后端 `GET /api/backgrounds` 过滤 `user_*` 文件：只返回系统图片（排除其他用户上传的 `user_{id}.*` 文件），保护用户隐私
- [x] 前端导航栏始终显示齿轮按钮：`#nav-settings-btn` 移到 `#nav-links` 外部，未登录时 `#nav-links` 隐藏但齿轮仍可点击，登录/注册页面用户也能开关壁纸
- [x] 前端 `loadBackground()` 未登录兜底：profile 接口 401 时直接请求系统壁纸列表（`GET /api/backgrounds`），确保未登录时也能显示系统壁纸
- [x] 新增「使用我的壁纸」toggle：设置面板中独立于「相册背景」toggle 的新开关，仅当用户上传过自定义壁纸时显示
  - ON（默认）：显示用户上传的自定义壁纸
  - OFF：显示系统随机壁纸（不显示自定义壁纸）
  - 关闭再打开：恢复之前上传的自定义壁纸（无需重新上传）
- [x] 上传壁纸后自动开启「使用我的壁纸」开关，立即显示自定义壁纸
- [x] 图片预加载始终加载目标壁纸（自定义壁纸 ON→加载自定义，OFF→加载系统随机），避免短暂闪烁
- [x] `vibeoj_custom_bg_url` localStorage 缓存：持久化用户自定义壁纸 URL，刷新页面后开关状态和壁纸选择正确恢复
- [x] BUILD PASS：编译通过，0 warning

### Phase 21 — 壁纸删除与恢复默认
- [x] 后端 `POST /api/backgrounds/delete`：删除用户自定义背景文件并清空 DB 中 `users.background_url`（`handler/background.cpp`）
- [x] 前端新增「删除」按钮：位于「使用我的壁纸」行右侧，仅当存在自定义壁纸时显示，点击确认后删除自定义壁纸并恢复系统背景（`effects.js` + `router.js` + `index.html` + `style.css`）
- [x] 前端新增「恢复默认」按钮：位于设置面板底部，一键重置所有背景设置（删除自定义壁纸 + 开启相册模式 + 虚化归零 + 加载系统背景）（`effects.js` + `router.js` + `index.html` + `style.css`）
- [x] `window.deleteCustomBackground()`：调用 delete API → 清空 localStorage 缓存 → 隐藏「使用我的壁纸」行和「删除」按钮 → 切换为系统背景（`effects.js`）
- [x] `window.resetAllBackgrounds()`：合并删除 + 重置模式/虚化 + 恢复 UI 状态（`effects.js`）
- [x] 删除按钮状态由 `updateDeleteBgBtn()` 统一管理，在 `updateUseCustomBgToggle()` 中联动调用，确保 UI 一致性（`effects.js`）
- [x] 新按钮 CSS 适配 LeetCode 白色模式（`style.css`）
- [x] BUILD PASS：编译通过，0 error

### Phase 22 — MioOJ 品牌重塑与前端体验优化
- [x] 用户可见品牌名 VibeOJ → **MioOJ**（`<title>`、导航 Logo、登录/注册标题）；保留内部 `vibeoj_*` localStorage 键与数据库名不变
- [x] 导航栏新增可爱猫耳吉祥物 SVG + 品牌链接样式（`.brand-link` / `.brand-mascot`）
- [x] **黑金奢华主题**：主强调色由亮黄 `#fdbb2d` 改为暖金 `#d4af37`；CSS 变量 `--gold-light/mid/dark`
- [x] **相册模式金边镶嵌**（双层：外金线 + 内暗框）：`#navbar`、`.auth-box`、`#settings-panel`；白模式不显示
- [x] 导航栏：字号略放大、当前页 `.nav-active` 高亮；顺序 题目 | 公告 | 我的 | 管理 | 退出；未登录 公告 | 登录
- [x] 页面切换流畅过渡（`page-leaving` / `page-enter` 动画）
- [x] 全局 Toast 通知组件（`showToast()`，`#toast-container`）；上传背景/提交代码等使用 Toast
- [x] 题目列表：统一难度标签 CSS 类（`.diff-badge`）；搜索/筛选框聚焦金边；空状态引导文案
- [x] 题目详情：可拖拽调节左右分栏（`miooj_split_ratio`）；编辑器主题四选一（`miooj_editor_theme`）；样例代码块金边左条；提交 loading
- [x] 结果页：测试点详情展开动画；「再试一次」按钮
- [x] 用户中心：统计数字改为金边卡片（`.stats-cards`）
- [x] 公告页：置顶公告 `.announce-card-pinned` 金边高亮
- [x] 设置面板开关：青蓝→浅粉长条 toggle + 点击流动拖尾（关闭态白色底）

### Phase 23 — 用户头像系统 ✅
- [x] 数据库 `users` 表新增 `avatar_url VARCHAR(512)` 字段
- [x] 系统默认头像：`web/avatars/` 目录，6 个 WebP 头像（at1~at6.webp）
- [x] 注册时随机分配系统默认头像路径写入 `users.avatar_url`
- [x] 后端 `POST /api/user/avatar/upload`：上传自定义头像（multipart），保存为 `web/avatars/user_{id}.jpg`，更新 DB（`handler/avatar.cpp`）
- [x] 后端 `DELETE /api/user/avatar`：删除自定义头像文件 → 重新随机分配系统默认头像（`handler/avatar.cpp`）
- [x] `GET /api/user/profile` 返回 `avatar_url` 字段（`handler/user.cpp`）
- [x] 前端导航栏显示圆形头像（`.nav-avatar`），点击跳转用户中心
- [x] 设置面板新增「上传头像」按钮 + 「恢复默认头像」按钮
- [x] 用户中心页显示大头像（`.user-avatar-large`），点击可上传
- [x] 头像裁剪：`showCropModalWithRatio(file, 1, true)` — 1:1 正方形裁剪框 + 圆形遮罩视觉反馈，4 个方向拖拽手柄
- [x] 前端 `api.js` 新增 `uploadAvatar()` / `deleteAvatar()` 方法
- [x] `router.js` 新增 `updateNavAvatar()` / `updateResetAvatarBtn()` 方法，与 `loadUser` 联动
- [x] 头像样式适配 LeetCode 白模式
- [x] BUILD PASS：编译通过，0 error

### Phase 24 — 讨论功能 ✅
- [x] 数据库：新建 6 张表（discussions / discussion_replies / discussion_likes / problem_comments / comment_replies / comment_likes）
- [x] 后端 `handler/discussion.cpp`：大讨论 10 个 API（帖子 CRUD + 回复 + 点赞 toggle/取消点赞）
- [x] 后端 `handler/comment.cpp`：题目评论区 9 个 API（评论 CRUD + 回复 + 点赞 toggle/取消点赞）
- [x] `main.cpp` 注册 `register_discussion_routes` + `register_comment_routes`
- [x] 前端 `web/js/pages/discussions.js`：大讨论列表页（卡片式信息流，20条/页，发帖表单）
- [x] 前端 `web/js/pages/discussionDetail.js`：帖子详情页（Markdown 渲染 + 二级嵌套回复 + 点赞；进入详情仅浏览，点击楼主帖「回复楼主」才出现行内回复框；楼中楼仍通过各条回复的「回复」触发）
- [x] 前端 `web/js/pages/problemComments.js`：题目讨论 Tab（与大讨论一致：卡片列表 + 点击进入详情 + 发帖按钮 + Markdown + 二级回复 + 点赞 + 回复楼主；修复列表加载时清空发帖表单的 bug）
- [x] 前端 `web/js/router.js`：新增 `#/discussions` + `#/discussions/:id` 路由 + `nav-discussions` 导航高亮 + `updateNav` 讨论链接显隐
- [x] 前端 `web/js/api.js`：新增 20 个讨论/评论/点赞 API 方法
- [x] `web/index.html`：引入 marked.js CDN (v11.1.1)，导航栏新增「讨论」链接，题目详情页新增 Tab 结构
- [x] `problemDetail.js`：「题目描述 | 讨论」Tab 切换，讨论 Tab 委托 `initProblemCommentsTab()` 加载
- [x] `style_v2.css`：讨论卡片/帖子详情/评论/回复/点赞/问题 Tab/Markdown 渲染 6 套样式（相册+白模式双主题）
- [x] BUILD PASS：编译通过，0 error 0 warning

### Phase 25 — 网站图标系统 ✅
- [x] 创建 `web/icons/` 图标目录，支持用户放入 ICO/PNG/JPG/JPEG/WebP/GIF/SVG 图片（`web/icons/README.txt`）
- [x] 后端 `GET /api/icons`：列出 `web/icons/` 下所有图标文件路径（`handler/icon.cpp`）
- [x] 后端 `GET /favicon.ico`：从 `web/icons/` 随机选取一张图片返回，按扩展名设置正确 Content-Type（`handler/icon.cpp`）
- [x] `main.cpp` 注册 `register_icon_routes`
- [x] 前端 `index.html`：页面加载时请求 `/api/icons`，随机设置 `<link rel="icon">`；默认 href 回退 `/favicon.ico`
- [x] BUILD PASS：编译通过，0 error

### Phase 26 — 删除用户时清理上传文件 ✅
- [x] 管理员 `DELETE /api/admin/users/:id`：删除用户前先读取 `background_url` / `avatar_url`，删除对应 `user_*` 上传文件（`handler/admin.cpp`）
- [x] 兜底扫描 `web/backgrounds/`、`web/avatars/` 下 `user_{id}.*` 文件并删除，避免历史孤儿文件残留
- [x] 系统默认资源不受影响：系统壁纸（非 `user_*`）、系统默认头像（`at*.webp`）保留
- [x] BUILD PASS：编译通过，0 error

### Phase 27 — 管理员后台增强 ✅
- [x] 数据库：`questions.reference_code TEXT`；`users.is_banned TINYINT(1)`（`migrate_phase27.sql`）
- [x] 新建题目 **三步向导**：基本信息（Markdown 预览）→ ACE 标程 → 测试用例；每步可暂存草稿
- [x] 编辑题目 **单页分区**：难度必选、ACE 标程持久化、标程变更过期提示、预览做题页（新标签）
- [x] **发布校验**：`is_visible=1` 须 ≥1 测试用例 + 非空 `reference_code`；批量「显示」同样校验
- [x] 标程生成增强：`POST /api/admin/reference/generate` 返回 `statuses` 逐用例 AC 校验
- [x] 统计 Tab：最近提交/新用户/新讨论各 10 条
- [x] 新增 **讨论管理** Tab：列表+搜索+删帖/删回复
- [x] 用户管理：封禁/解封（踢 session + 禁止登录）、管理员设定新密码并重置 session
- [x] 管理员可预览隐藏题目：`GET /api/problems/:id` 对 admin 跳过 `is_visible` 过滤
- [x] BUILD PASS：编译通过

### Phase 28 — 确认/提示弹窗 UI 统一 ✅
- [x] `utils.js` 新增 `showConfirm` / `showAlert` / `showPrompt`，Promise 异步 API
- [x] 相册模式：黑金双层金边 `.mio-dialog`；危险操作（删除/封禁/重置）确认按钮红色强调
- [x] LeetCode 白模式：白底简约卡片弹窗，与 `body.lc-white` 主题一致
- [x] 全站替换原生 `confirm` / `alert` / `prompt`（管理后台、讨论、设置面板等）
- [x] 管理员重置密码使用 `showPrompt` + `password` 输入框

### Phase 29 — 排行榜与私信修复 ✅
- [x] **排行榜 SQL 修复**：按 `user_id + question_id` 去重后再计分；榜单仅 `points > 0` 用户；`my-rank` / 公开资料返回真实 `rank`（未上榜为 `null`）
- [x] **公开资料 API**：`GET /api/users/:id/public`（username、avatar_url、points、ac_count、total_subs、rank；不含邮箱/管理员/提交详情）
- [x] **前端修复**：`leaderboard.js` / `messages.js` 统一使用 `escapeHtml`（原 `escHtml` 未定义导致页面报错）
- [x] **他人公开主页** `#/users/:id`（`userProfile.js`）：展示头像、用户名、排行榜名次、积分/AC/提交；「发私信」按钮；访问自己时跳转 `#/user`
- [x] **头像跳转**：讨论区/题目评论区/排行榜点击他人头像或用户名 → `#/users/:id`（`attachUserProfileNav` in `utils.js`）
- [x] **私信深链**：`#/messages?user=:id` 自动创建/打开会话；公开主页「发私信」跳转此深链
- [x] `style_v2.css`：公开主页卡片、我的名次标签样式（相册+白模式）

### Phase 30 — 私信消息撤回 ✅
- [x] 数据库：`messages.is_recalled TINYINT(1)`（`migrate_phase30.sql`）
- [x] `POST /api/messages/recall/:id`：仅发送者、60 秒内、清空正文并标记 `is_recalled=1`
- [x] 消息列表返回 `is_recalled`、`can_recall`；会话列表最后预览对撤回消息显示 `[已撤回]`
- [x] 前端：右键自己的消息弹出「撤回」菜单；双方看到占位文案「你/对方撤回了一条消息」
- [x] `api.js` 新增 `recallMessage()`；`.msg-context-menu` / `.msg-bubble-recalled` 样式

### Phase 31 — 录题体验优化 ✅
- [x] 数据库：`questions.display_index INT`（`migrate_phase31.sql`）；已有题目按 `id` 升序回填 0,1,2…
- [x] 新建题目：`display_index = MAX(display_index)+1`（首题为 0）；API 返回 `display_index`；列表/向导/编辑页 `#` 均展示 `display_index`
- [x] 测试用例：添加时 **order_index 自动递增**（从 0 起）；向导/编辑页可 **连续添加** 多条；删除前 **showConfirm** 确认
- [x] 测试用例展开/删除弹窗统一走 `mio-dialog`（相册+LeetCode 白模式自适应）

### Phase 32 — 代码草稿按用户隔离 ✅
- [x] `localStorage` 键由 `code_{题目ID}` 改为 `code_{用户ID}_{题目ID}`（`utils.js` → `codeDraftStorageKey()`）
- [x] 同浏览器切换账号后，各用户恢复各自草稿，不再串用他人代码

## 12. 验收标准

| 编号 | 验收项 | 标准 |
|---|---|---|
| AC-1 | 注册/登录 | 用户名 ≥3 字符 + 密码 ≥8 字符 ≥2 种字符类型，注册后登录获得 token，刷新保持登录态 |
| AC-2 | 未登录拦截 | 未登录访问任何需鉴权页面跳转 `#/login` |
| AC-3 | 题目列表 | 仅显示 `is_visible=1` 的题目，含 **展示编号 `display_index`（从 0 起）**、标题、限制 |
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
| AC-20 | 代码持久化 | 离开题目详情页再返回，代码编辑器恢复**当前登录用户**之前内容（localStorage 键 `code_{用户ID}_{题目ID}`）；换账号后不显示他人草稿 |
| AC-21 | 用户中心统计 | 用户中心顶部显示提交总次数、已通过题数、尝试过的题数 |
| AC-22 | 加载已通过代码 | 题目详情页点击「加载已通过代码」→ 从后端获取最新 AC 代码并填入编辑器；无 AC 记录时弹窗提示 |
| AC-23 | 多版本 AC 代码列表 | 点击「加载已通过代码」弹出下拉列表展示用户在该题所有 AC 提交（含 ID、时间、性能），点击任一条填入编辑器 |
| AC-24 | AC 代码撤销 | 加载 AC 代码后「↩ 撤销」按钮出现，点击恢复到加载前用户自己的代码 |
| AC-25 | 自动补全开关 | 编辑器旁复选框 + 设置面板开关可控制 ACE 自动补全开/关，状态持久化到 localStorage，两者双向同步 |
| AC-26 | 相册背景 | 从 `web/backgrounds/` 目录随机选取图片作为页面背景，自动施加 CSS 模糊（blur 18px）+ 暗化（brightness 0.35），确保前景文字清晰可读 |
| AC-27 | LeetCode 经典白模式 | 关闭「相册背景」开关后页面切换到纯白/浅灰 LeetCode 风格：白色背景、纯白卡片面板、无毛玻璃效果、文字深色 |
| AC-28 | 自定义背景上传+裁剪 | 设置面板中可上传图片，上传前弹出裁剪对话框（锁定视口宽高比），用户可拖拽/缩放选取区域，确认后裁剪并上传，立即设置为背景 |
| AC-29 | 背景模式持久化 | 背景模式（相册/LeetCode白）和自定义背景 URL 持久化到 localStorage，刷新后恢复 |
| AC-30 | 背景虚化可调节 | 设置面板滑块可调节背景虚化强度（0~30px，默认 0），实时预览，持久化到 localStorage |
| AC-31 | 登录页自动跳转 | 已登录用户（Cookie 有效 Session 未过期）访问 `#/login` 或 `#/register` 自动跳转到 `#/problems` |
| AC-32 | 图片预加载 | 背景图片通过 Image 对象预加载完成后才设置 CSS background-image，消除加载过程中的空白闪烁 |
| AC-33 | 登录后背景刷新 | 登录/注册成功后自动调用 `refreshBackground()` 加载用户个性化背景，无需手动刷新页面 |
| AC-34 | 未登录壁纸可见 | 未登录时登录/注册页面能正常显示系统壁纸（`GET /api/backgrounds` 无需鉴权，仅返回系统图片） |
| AC-35 | 未登录可开关壁纸 | 登录/注册页面导航栏显示齿轮按钮，用户可打开设置面板切换「相册背景」开关 |
| AC-36 | 使用我的壁纸开关 | 上传自定义壁纸后，设置面板出现「使用我的壁纸」toggle；开启显示自定义壁纸，关闭显示系统随机壁纸；关闭后再开启，恢复之前上传的自定义壁纸 |
| AC-37 | 系统壁纸不泄露 | `GET /api/backgrounds` 仅返回系统图片（`pt*.jpg` 等），不返回其他用户上传的 `user_*` 文件 |
| AC-46 | 删除自定义壁纸 | 设置面板「使用我的壁纸」行右侧显示「删除」按钮；点击确认后删除自定义壁纸文件并清空 DB 记录，恢复系统背景 |
| AC-47 | 恢复默认背景 | 设置面板底部「恢复默认」按钮；一键删除自定义壁纸 + 开启相册模式 + 虚化归零 + 加载系统背景 |
| AC-48 | 删除/恢复操作可逆 | 删除自定义壁纸后可通过重新上传恢复；恢复默认后可通过重新开启相册背景恢复系统壁纸显示 |
| AC-38 | 管理员统计仪表盘 | 管理员访问 `#/admin` 默认显示统计 Tab，展示总用户数、总题目数、总提交数 |
| AC-39 | 题目批量操作 | 管理员可在题目管理 Tab 全选题目，批量执行隐藏/显示/删除操作 |
| AC-40 | 测试用例行内编辑 | 在题目编辑页点击测试用例行的「编辑」按钮，行内切换为编辑模式，可修改 input/expected_output/order_index，点击「保存」提交更新 |
| AC-41 | 标程自动生成期望输出 | 在题目编辑页粘贴 C++ 标程代码，点击「编译运行，生成期望输出」→ 后端编译运行标程对每组输入生成输出 → 自动填充到对应测试用例的 expected_output |
| AC-42 | 用户管理 | 管理员在用户管理 Tab 查看分页用户列表（含搜索），可删除用户、提升/取消管理员权限；删除用户时级联清理数据库关联数据及 `user_{id}.*` 上传文件 |
| AC-43 | 系统公告 | 管理员可在公告管理 Tab 发布/编辑/删除公告；任何用户访问 `#/announcements` 查看所有公告（置顶优先） |
| AC-44 | 管理员导航栏 | 管理员导航栏不显示「我的」，显示：题目 \| 公告 \| 管理 \| 退出 |
| AC-45 | 管理员 Tab 导航 | 管理页顶部四个 Tab（统计/题目管理/用户管理/公告管理），点击切换对应的管理模块 |
| AC-49 | MioOJ 品牌 | 用户可见界面显示 MioOJ + 猫耳吉祥物；内部 API/DB 标识可仍为 vibeoj |
| AC-50 | 相册模式金边 | 相册背景下导航栏/登录框/设置面板显示双层金边；LeetCode 白模式无金边 |
| AC-51 | 导航高亮 | 当前路由对应导航项 `.nav-active` 高亮（题目详情页高亮「题目」） |
| AC-52 | 页面过渡 | Hash 路由切换时有淡入淡出过渡动画 |
| AC-53 | Toast 通知 | 提交成功/失败、背景上传成功等使用 Toast，非阻塞 alert |
| AC-54 | 分栏可调 | 题目详情页拖拽中间分隔条调节左右宽度，刷新后保持 |
| AC-55 | 编辑器主题 | 题目详情页可选择 ACE 主题（至少浅色+深色各一种），选择持久化 |
| AC-56 | 结果页再试 | 判题结果页提供「再试一次」按钮回到对应题目 |
| AC-57 | 公告导航入口 | 导航栏「公告」链接跳转 `#/announcements`；未登录也可访问 |
| AC-58 | 默认头像分配 | 新用户注册后随机分配一个系统默认头像，显示在导航栏和用户中心 |
| AC-59 | 自定义头像上传 | 用户可在设置面板或用户中心上传自定义头像，支持裁剪（1:1 正方形），上传后立即生效 |
| AC-60 | 头像恢复默认 | 用户可点击「恢复默认头像」删除自定义头像，重新随机分配系统默认头像 |
| AC-61 | 大讨论发帖 | 登录用户在 `#/discussions` 点击「发帖」输入 Markdown 正文提交 |
| AC-62 | Markdown 渲染 | 帖子/回复的 Markdown 正文正确渲染（标题、粗体、代码块、链接等） |
| AC-63 | 二级嵌套回复 | 用户可回复帖子（一级），也可回复别人的回复（二级），UI 缩进展示 |
| AC-64 | 点赞去重 | 每人每帖/每条回复只能点赞一次，再次点击取消点赞，后端 UNIQUE 约束兜底 |
| AC-65 | 讨论权限 | 用户可删除自己的帖子/回复；管理员可删除任意帖子/回复 |
| AC-66 | 讨论分页 | 讨论列表和回复列表分页加载（20条/页） |
| AC-67 | 题目讨论 Tab | 题目详情页展示「题目描述」和「讨论」两个 Tab，切换流畅 |
| AC-68 | 讨论导航 | 导航栏「讨论」链接跳转 `#/discussions`，当前页高亮 |
| AC-69 | 随机网站图标 | 向 `web/icons/` 放入至少一张图片后，刷新页面浏览器标签页显示随机选取的 favicon |
| AC-70 | favicon API | `GET /api/icons` 无需登录，返回图标路径数组；`GET /favicon.ico` 随机返回目录中的一张图片 |
| AC-71 | 删用户清文件 | 管理员删除用户后，该用户在 `web/backgrounds/`、`web/avatars/` 下的 `user_{id}.*` 上传文件被删除；系统默认壁纸/头像不受影响 |
| AC-72 | 录题向导 | 新建题目三步向导可暂存草稿；发布前须有用例+标程 |
| AC-73 | 标程持久化 | 编辑页回显 `reference_code`；修改标程后提示重新生成期望输出 |
| AC-74 | 发布拦截 | 无标程或无测试用例时勾选「可见」或批量显示，后端返回 400 拒绝 |
| AC-75 | 标程校验 | 生成期望输出后返回逐用例 `statuses`，全部 AC 时前端提示成功 |
| AC-76 | 统计动态 | 管理统计页展示最近 10 条提交/用户/讨论 |
| AC-77 | 讨论管理 | 管理后台讨论 Tab 可搜索、删帖、删回复 |
| AC-78 | 用户封禁 | 封禁用户无法登录；现有 session 立即失效；可解封 |
| AC-79 | 重置密码 | 管理员可为用户设定新密码（≥8 位），并重置其登录态 |
| AC-80 | 主题弹窗 | 相册模式下删除/确认操作显示黑金风格自定义弹窗，非浏览器原生框 |
| AC-81 | 白模式弹窗 | LeetCode 白模式下确认/提示/输入弹窗为白底简约卡片，与页面风格一致；危险操作确认按钮红色强调 |
| AC-82 | 排行榜 | 登录用户访问 `#/leaderboard` 查看 Top 100（**仅 >0 分**；积分按题去重）；顶部卡片显示自己的**名次**/积分/AC/提交数 |
| AC-83 | 私信会话 | 登录用户可通过搜索或他人公开主页「发私信」发起会话；左侧列表显示最后消息与未读数 |
| AC-84 | 私信收发 | 聊天窗口支持 Markdown、分页历史（50条/页）、10s 轮询 |
| AC-85 | 私信未读 | 导航栏邮件图标未读角标；进入会话自动已读 |
| AC-86 | 公开主页 | `#/users/:id` 仅展示头像/用户名/积分/AC 等公开信息；讨论/排行榜等处点击他人头像可进入；主页有「发私信」按钮（本人无此按钮） |
| AC-87 | 私信撤回 | 发送后 1 分钟内右键自己的消息可撤回；双方见占位提示；会话列表预览显示 `[已撤回]`；超时或非本人返回 400 |
| AC-88 | 题号从 0 起 | 题目列表/管理页 `#` 显示 `display_index`（0,1,2…），新建题目自动分配，不暴露数据库自增 id 作为题号 |
| AC-89 | 测试用例连续添加 | 录题向导/编辑页添加用例后表单清空并可继续添加；`order_index` 从 0 自动递增 |
| AC-90 | 删用例确认弹窗 | 删除测试用例前弹出 `showConfirm`；LeetCode 白模式下为白底简约卡片，非相册黑金背景 |
| AC-91 | 代码草稿隔离 | 账号 A/B 在同一浏览器交替登录同一题，编辑器分别恢复各自草稿，互不可见 |

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
| `marked.js` | Markdown 渲染（讨论功能） | CDN (cdnjs) | ⬜ 讨论功能开发时引入 |

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
CREATE USER IF NOT EXISTS 'VibeOJUser'@'localhost' IDENTIFIED BY 'YOUR_DB_PASSWORD';
GRANT ALL PRIVILEGES ON vibeoj.* TO 'VibeOJUser'@'localhost';
FLUSH PRIVILEGES;
EOF

# 导入表结构（将 YOUR_DB_PASSWORD 换成实际密码，或改用 mysql -p 交互输入）
mysql -u VibeOJUser -p vibeoj < server/db/schema.sql

# 导入种子数据（2 道例题 + 15 个测试点）
mysql -u VibeOJUser -p vibeoj < server/db/seed.sql

# 导入 Phase 13 迁移（私信/消息表）
mysql -u VibeOJUser -p vibeoj < server/db/migrate_phase13.sql

# 导入 Phase 30 迁移（私信撤回 is_recalled 字段）
mysql -u VibeOJUser -p vibeoj < server/db/migrate_phase30.sql

# 导入 Phase 31 迁移（题目 display_index 展示编号）
mysql -u VibeOJUser -p vibeoj < server/db/migrate_phase31.sql

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

敏感信息（数据库密码等）**不要**写进 `config.hpp` 或提交 Git。使用环境变量文件：

```bash
cp deploy/config.example.env deploy/local.env    # 本地测试
# 编辑 deploy/local.env，填写 VIBEOJ_DB_PASSWORD

make run-local   # 本地启动（读 deploy/local.env）
```

生产环境在服务器上维护 `deploy/production.env`（已加入 `.gitignore`），示例字段：

```bash
VIBEOJ_DB_PASSWORD=your_password_here
DOMAIN=rinr.top
PUBLIC_IP=your.public.ip.here
```

`server/config.hpp` 仅保留非敏感默认值；启动时由 `load_config_from_env()` 覆盖：

```cpp
struct Config {
    int         port          = 8080;
    std::string db_host       = "127.0.0.1";
    std::string db_password   = "";   // 来自 VIBEOJ_DB_PASSWORD
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

---

## 15. 日志系统

### 15.1 概述

`server/util/logger.hpp` 提供了一个 header-only、线程安全的日志系统，支持分级输出至控制台（stdout/stderr）和文件。

### 15.2 日志级别

| 级别 | 枚举值 | 输出目标 | 用途 |
|---|---|---|---|
| `DEBUG` | 0 | stdout + 文件 | 调试信息（Auth 细节、编译路径等） |
| `INFO` | 1 (默认) | stdout + 文件 | 常规操作（登录、提交、CRUD 操作） |
| `WARNING` | 2 | stderr + 文件 | 警告（登录失败、编译错误、权限拒绝） |
| `ERROR` | 3 | stderr + 文件 | 严重错误（连接失败、fork 失败、系统异常） |

### 15.3 日志格式

```
[2026-06-17 23:15:30.123] [INFO ] [main.cpp:42] MioOJ server starting...
[2026-06-17 23:15:31.456] [WARN ] [auth.cpp:35] Login failed for user: hacker (password mismatch)
[2026-06-17 23:15:32.789] [ERROR] [engine.cpp:61] Submission #42 SE: no test cases for question #1
```

格式：`[时间戳] [级别] [文件名:行号] 消息`

时间戳精度为毫秒，级别固定宽度 5 字符。

### 15.4 配置

在 `server/config.hpp` 中配置：

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `log_file` | `std::string` | `""` | 日志文件路径，空字符串 = 仅控制台输出 |
| `log_level` | `int` | `1` | 最低输出级别：0=DEBUG 1=INFO 2=WARNING 3=ERROR |

### 15.5 日志覆盖点

| 模块 | 记录内容 |
|---|---|
| **启动/关闭** (`main.cpp`) | 服务启动/停止、临时目录/DB/判题引擎初始化失败 |
| **认证中间件** (`middleware/auth.cpp`) | Auth 成功（DEBUG）、封禁用户拦截（WARNING）、无 Token（DEBUG） |
| **认证处理器** (`handler/auth.cpp`) | 注册成功（INFO）、登录成功/失败/封禁（INFO/WARNING）、退出（INFO） |
| **提交** (`handler/submission.cpp`) | 提交创建（INFO）、越权访问（WARNING） |
| **管理后台** (`handler/admin.cpp`) | 题目 CRUD（INFO）、批量操作（INFO）、用户管理（INFO） |
| **判题引擎** (`judge/engine.cpp`) | 入队（INFO）、编译错误（WARNING）、无用例（ERROR）、判题完成（INFO） |
| **编译模块** (`judge/compiler.cpp`) | 编译成功/超时/失败（DEBUG/WARNING）、二进制大小 |
| **运行模块** (`judge/runner.cpp`) | fork 失败（ERROR）、临时文件失败（ERROR） |
| **数据库连接池** (`db/pool.cpp`) | 连接池初始化/销毁（INFO）、连接失败（ERROR） |

### 15.6 使用示例

```cpp
#include "util/logger.hpp"

LOG_DEBUG("Processing request for user_id=" + std::to_string(uid));
LOG_INFO("User " + username + " logged in");
LOG_WARNING("Rate limit exceeded for IP " + ip);
LOG_ERROR("Failed to connect to database: " + std::string(e.what()));
```

宏 `LOG_DEBUG/INFO/WARNING/ERROR` 自动携带 `__FILE__` 和 `__LINE__` 信息。

### 15.7 线程安全

`Logger` 为单例模式，所有写操作使用 `std::mutex` 保护，支持多线程并发写入（判题线程池 + HTTP 请求线程并行场景）。
