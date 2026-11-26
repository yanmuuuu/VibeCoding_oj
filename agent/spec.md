# Agent SPEC — MioOJ 题目助手

状态：**方案已按评审修订，尚未写代码。**

本文只描述题目助手。OJ 本体（判题、用户、题目管理）仍以仓库根目录 `SPEC.md` 为准。

## 1. 目标

用户用自然语言从 **本站可见题库** 里找题，或针对某一道已有题目询问做法。例如：

- 「推荐几道二叉树的题」
- 「有没有适合练动态规划、我还没做过的中等题」
- 「第 12 题可以用什么方法做」
- 「讲一下第二道」

助手必须遵守：

- 只返回 `questions.is_visible = 1` 且 MySQL 中仍存在的题目。
- 用户看到的题号是 `display_index`（从 0 起）。页面路由 `#/problems/:id` 里的 id 是 `questions.id`。两个数字可以不同，回答、卡片和检索都不能混用。
- 一道题允许多种做法。推荐依据是「用户说的方法是不是合理做法之一」，不给题目贴唯一标签。
- 标程 `reference_code`、隐藏测试点 `test_cases`、用户提交的代码不参与生成、检索和回答。
- 「推荐题目」不读取、不返回完整解法。「讲解某一题」且用户在问做法时，才读取完整解法摘要。

## 2. 不做的事

- 不改判题、不代用户提交代码。
- 不把助手做进 C++ 进程。`vibeoj` 继续负责页面、登录、题目和判题。
- 不把 MySQL 迁到 PostgreSQL，不把题目原文搬到 Milvus。
- 第一版不索引讨论、私信、提交代码和标程。
- 第一版不在回答里贴可直接提交的完整代码。讲解只到做法、步骤和复杂度。
- 不给管理员开隐藏题通道。管理员使用助手时同样只看见可见题；做题页的隐藏题预览仍走 OJ 自己的接口。

## 3. 技术栈

| 层 | 选型 | 职责 |
|---|---|---|
| OJ | 现有 C++ / MySQL / 原生 JS | 题目与登录的唯一来源 |
| Agent 服务 | Python 3、FastAPI | HTTP 接口、配置、鉴权入口。进程只听 `127.0.0.1` |
| 编排 | LangGraph | 固定步骤：意图、检索、权限裁剪、生成。模型不能自行加工具 |
| 模型接入 | LangChain 的 Chat Model / Embedding / Reranker | 摘要生成、问句向量、召回后重排、最终回答 |
| 题目库 | MySQL（已有） | 只读视图：题目公开字段、登录态、当前用户提交状态 |
| 助手库 | PostgreSQL | 摘要、关键词、对话、待清理队列、LangGraph checkpoint |
| 向量库 | Milvus 单机 | 方法摘要的向量，主键为 `question_id`。度量用 **COSINE**，题量按单机小库建 HNSW |

对话、嵌入、重排分开配置，密钥只放环境变量。重排模型只对召回结果打分，不生成给用户看的文字。

| 用途 | 模型名 | 接口 |
|---|---|---|
| 对话、摘要生成 | `deepseek-flash`（DeepSeek-V4.1-Flash） | `https://api.deepseek.com`，OpenAI 兼容。调用时关闭思考模式；参数名以当时的官方接口为准，关闭失败则本轮视为失败，不能带着思考模式继续 |
| 嵌入 | `text-embedding-v4` | 千问 OpenAI 兼容嵌入接口。每次请求显式传 `dimensions=1024`。入库文本和问句用同一模型、同一维度，问句不加额外指令前缀 |
| 重排 | `qwen3.7-text-rerank` | 千问文本排序接口，不是对话补全接口 |

嵌入和重排使用同一把千问密钥、各自的 base_url。密钥不写入本文件。

关键词检索使用 PostgreSQL `pg_trgm`。中文不依赖数据库默认的英文分词：对「标题 + 关键词 + 方法摘要」建 GIN trigram 索引，用子串 `ILIKE` 取候选，`similarity` 只作同路排序。

## 4. 数据归属

```
浏览器
  │  Cookie: token
  ▼
Nginx（只反代公开路径）
  ├─ /api/* 、页面 ──────────────► vibeoj (C++) ──► MySQL
  └─ /api/agent/health|chat|prefs ► agent (127.0.0.1)
                                      │ 只读视图          │ 读写
                                      ▼                   ▼
                                    MySQL            PostgreSQL
                                      │                   │
                                      └──── question_id ──┴──► Milvus

vibeoj ──本机、共享密钥──► http://127.0.0.1:<agent端口>/internal/reindex|delete
```

MySQL 是题目事实来源。PostgreSQL 和 Milvus 是派生物，可以整库重建。

Nginx 不转发 `/internal/*`。Agent 不监听公网网卡。浏览器会话不能调用内部接口。

### 4.1 MySQL 只读视图

Agent 使用单独账号，只有下列视图的 `SELECT`，没有基表权限，因此 `SELECT *` 也碰不到标程、测试点、密码和提交代码。

`agent_question_public`：

- `id`、`display_index`、`title`、`description`、`input_format`、`output_format`
- `sample_input`、`sample_output`、`difficulty`、`time_limit`、`memory_limit`
- `is_visible`、`updated_at`

`agent_session_auth`：`user_id`、`username`、`is_banned`、`token`。来自 `sessions` 与 `users` 的连接，不含 `password_hash`。

`agent_submission_status`：`user_id`、`question_id`、`status`。不含 `code`、`compile_error`、`detail_json`。查询必须带当前登录用户的 `user_id`。

`display_index` 在 OJ 里只是普通索引，不是唯一约束。助手不自行改号。可见题里同一个 `display_index` 命中多行时，本轮不讲解、不把这些行混进推荐，只列出它们的展示题号和标题，让用户选择。

### 4.2 PostgreSQL

`question_profiles`，一题一行：

| 字段 | 说明 |
|---|---|
| `question_id` | 主键，对应 `questions.id` |
| `display_index` | 用户看到的题号 |
| `title` | 入库时的标题 |
| `difficulty` | 简单 / 中等 / 困难 |
| `source_updated_at` | 写入档案时看到的 `questions.updated_at`，只作记录。任何列更新都会改这个时间，包括只改标程，所以不能用它决定是否调用模型 |
| `method_summary` | 给检索和推荐用的方法摘要 |
| `keywords` | 题型与方法关键词，空格分隔 |
| `solution_summary` | 完整解法摘要。只在讲解意图、并且用户在问做法时读取 |
| `content_hash` | 题面哈希，见第 5 节。决定是否重新调用摘要模型 |
| `milvus_synced` | 当前 `method_summary` 是否已成功写入 Milvus。失败为 false |
| `created_at` / `updated_at` | 档案自身的时间 |

`agent_pending_deletes`：`question_id` 主键，外加失败时间。PostgreSQL 或 Milvus 有一边没删掉时插入；两边都删掉后移除。

`agent_conversations`：`id`、`user_id`、`created_at`。`user_id` 只表示这串对话属于谁。不用用户 id 把该用户的全部历史合成一份长期记忆。

`agent_messages` 按会话保存记忆。每条助手消息分两份：

- `content_public`：用户在页面上翻看的原文。
- `content_for_model`：以后轮次能放进提示词的文本。推荐轮与 `content_public` 相同，且不含解法。讲解轮只留「讲解了展示题号 N（question_id=…）」，不留步骤、样例走法和 `solution_summary`。

另外保存本轮返回的有序 `question_id` 列表、对应的 `display_index`，以及本轮实际用过的难度和是否跳过已 AC。

生成时只把当前会话最近 8 轮的用户原话和 `content_for_model` 放进上下文。更早的轮次仍留在 PostgreSQL，供页面翻看。已 AC 题目不从聊天记录推断，每轮仍查 MySQL。

LangGraph checkpoint 按 `conversation_id` 只保存图的步骤状态：意图、本轮候选 `question_id`、筛选条件。checkpoint 不保存 `solution_summary`，也不把其中的文本再塞进提示词。多轮上下文只有 `agent_messages` 那一份。

跨会话不读取其他会话的原文，也不把历史聊天摘要塞进提示词。每个用户另有一行 `user_agent_prefs`：

| 字段 | 说明 |
|---|---|
| `user_id` | 主键 |
| `default_difficulty` | 默认难度，空表示不限 |
| `skip_solved` | 是否默认跳过已 AC。只影响推荐 |
| `focus_topics` | 用户说「最近在练」的知识点。最多 5 个，每个不超过 16 个字，新的一组整组覆盖旧值 |
| `updated_at` | 最近一次写入时间 |

只有用户表达持续偏好时才写入，例如「以后都跳过我做过的」「我最近在练二叉树」。本句里的一次性条件（「这次来点困难的」）只留在当前会话。已做题目仍每轮查 MySQL，不写进这张表。这张表不进 Milvus，也不保存解法、推荐过的题号和聊天原文。

### 4.3 Milvus

集合 `question_methods`：

| 字段 | 说明 |
|---|---|
| `question_id` | 主键，对应 `questions.id` |
| `display_index` | 与档案同步的副本，供过滤 |
| `difficulty` | 与档案同步的副本，供过滤 |
| `embedding` | **只嵌入方法摘要**。维度 1024，度量 COSINE |
| `method_text` | `method_summary` 的副本，只供核对。重排和生成不读这列 |

文本以 PostgreSQL 的 `method_summary` 为准。两边不一致时重建会用 PostgreSQL 覆盖 Milvus。

完整解法摘要不进 Milvus，也不进关键词索引。它只能在讲解意图已经锁定唯一的 `question_id` 之后，从 PostgreSQL 按主键读取。

## 5. 摘要内容

`content_hash` 是下列字段按固定顺序、用 UTF-8 和明确分隔符拼起来之后的 SHA-256：

`title`、`description`、`input_format`、`output_format`、`sample_input`、`sample_output`、`difficulty`。

不包含 `display_index`、`time_limit`、`memory_limit`、`reference_code`、`is_visible`、`updated_at`。只有这七项变化才重新调用摘要模型。

哈希未变时仍要回写档案里的 `display_index`、`title`、`difficulty`、`source_updated_at`。若 `milvus_synced = false`，用档案里已有的 `method_summary` 重新嵌入并 upsert，不再调用摘要模型。

题目第一次入库，或上述七项变化后，生成一次，两段分开存。

**方法摘要**（PostgreSQL，并向量化到 Milvus）只写：

- 题型
- 可用方法，多种都写上
- 每种方法对应的题目特征（例如「层序遍历」「区间 DP」）
- 关键词

**完整解法摘要**（只进 PostgreSQL）只写：

- 每种做法的步骤、状态或数据结构、复杂度
- 公开样例上的走法
- 一句固定说明：这是根据题面生成的讲法，不是站内标程，也不保证与判题数据一致

两段都不写可直接提交的完整程序，都不原样抄录题面里的祈使句。生成输入只有 `agent_question_public` 的公开字段。题面和模型输出都放在数据分隔符里：其中的「忽略规则」「改检索范围」之类句子不能改变工具、系统提示或入库范围。输出对不上这两个固定结构，或任一段为空，则本次失败。

没有旧档案时失败不插入行。已有旧档案时失败保留旧行，不更新 `content_hash`，不把 `milvus_synced` 改成 true。

## 6. 入库流程

触发方是 C++，在 MySQL 提交成功之后调用本机内部接口。助手调用失败只记日志，不回滚已经成功的题目保存；隐藏题不会因此被推荐出去，因为回答前还会再查 MySQL。管理员用全量重建补数据。

必须调用的路径：

- 管理端创建、编辑并保存题目（含改为可见或不可见）
- `POST /api/admin/questions/batch` 的 show、hide、delete
- 单题删除
- 录题审核通过并 `INSERT` 正式题目

`is_visible = 0` 不生成档案。Agent 删除该题的 PostgreSQL 行和 Milvus 向量；失败则写入 `agent_pending_deletes`。

可见题：

1. 读 `agent_question_public`。
2. 计算 `content_hash`。
3. 哈希与档案一致且 `method_summary` 非空：跳过摘要模型，仍回写展示题号、标题、难度和时间记录。`milvus_synced = false` 时用现有方法摘要补写 Milvus。
4. 哈希变化、没有档案、或方法摘要为空：调用模型生成两段摘要和关键词。
5. 只对 `method_summary` 做 embedding，请求带 `dimensions=1024`。
6. 先写 PostgreSQL（此时 `milvus_synced = false`），再 upsert Milvus。Milvus 成功后把 `milvus_synced` 改为 true。失败则保持 false。

删除：

1. MySQL 删除成功后，C++ 把被删的全部 `question_id` 发给 `/internal/delete`。单题和批量都走这里。
2. Agent 同时删除 `question_profiles` 行和 Milvus 主键。只删一边视为失败，把 id 写入 `agent_pending_deletes`。
3. 两边都成功后，从待清理队列去掉该 id。

全量重建对照 MySQL，不受「哈希相同就整题返回」的限制：

- 可见且档案缺失、哈希变化或 `milvus_synced = false`：按上面的单题规则补齐。哈希相同且向量已同步时，不调用摘要模型。
- MySQL 中不存在，或 `is_visible = 0`：删除 PostgreSQL 档案和 Milvus 向量。隐藏题的行还在 MySQL 里，也同样清掉。
- 处理 `agent_pending_deletes` 里的每一个 id。

问答进行中若同步尚未完成：重排之前按 MySQL 丢掉不存在或不可见的 `question_id`。这些题的方法摘要和解法都不进入提示词。

内部接口使用请求头 `X-Agent-Key`。比较必须是常量时间，密钥不写日志。错误的密钥返回 401，正文不区分「没有密钥」和「密钥错误」。

## 7. 问答流程

LangGraph 固定为下面几步，不给模型自由增加工具。当前用户只来自 Cookie 对应的会话，不来自模型，也不来自请求体里的用户 id。

1. **鉴权。** 读取 Cookie 中的 `token`，查 `agent_session_auth`。没有这条会话，或 `is_banned != 0`，返回 401。OJ 的 `sessions` 没有过期列，服务端也不按 24 小时作废 token；`Max-Age=86400` 只让浏览器停止发送 Cookie。这一点与 `vibeoj` 的鉴权一致。
2. **会话。** `conversation_id` 为空则新建。有值时必须属于当前用户，否则 404。不存在和不属于本人都返回 404。
3. **识别意图。**
   - `recommend`：找一批题。
   - `explain`：讲解或询问已经点名的一道题。
   - `chitchat`：与题库无关。直接说明能力范围，不检索。
4. **解析对象和约束。** 在召回之前完成。
   - `第 N 题`、`#N`、单独一个数字：按 `display_index` 查找可见题。这与题目列表的编号搜索一致。
   - `#/problems/N`：N 是 `questions.id`。
   - `第二道`、`第 2 个`：取本会话上一轮推荐返回的有序列表，1 起计，换成那个 `question_id`。没有上一轮列表就不再检索，请用户给出展示题号。
   - 讲解且本轮没有新对象：沿用本会话上一轮已经锁定的那一个 `question_id`。
   - 讲解解析出多道题：不讲解，请用户指定其中一道。
   - 难度、是否跳过已 AC：问句里的明确要求优先；否则用请求里真正带上的字段；字段省略时用 `user_agent_prefs`；再没有则难度不限、不跳过已 AC。模型不猜测用户是谁。
5. **召回。** 这一步只求覆盖，不决定最终顺序。过滤在取 top-k 之前生效。
   - `explain`：只锁定解析出的那一个可见 `question_id`。不因难度、已 AC 或向量分数丢掉它。题不存在或不可见则停止，回复「题号不存在或未公开」，不说明两者中是哪一种。
   - `recommend`：难度和跳过已 AC 同时作用于关键词和向量。已 AC 的 id 列表来自 `agent_submission_status`，条件是当前 `user_id` 且 `status = 'AC'`。关键词 SQL 在 `LIMIT` 之前写上难度和排除 id。Milvus 用标量过滤（难度、`question_id not in 已 AC`）之后再取默认 20 条。两路按 `question_id` 取并集。
   - 推荐问句里点名的展示题号：可见、难度相符、且没被「跳过已 AC」排除时，并入候选。被难度或已 AC 排除时，回答里说明没放进列表。点名的题不可见时，说明题号不存在或未公开，推荐的其余部分继续。
6. **可见性复核。** 重排之前再查 MySQL。不存在或 `is_visible != 1` 的题从候选删除，不占用重排名额。
7. **重排。** 重排模型阅读用户原话，以及每道候选题在 PostgreSQL 中的标题、难度、`method_summary`。不读 `solution_summary`，不读 Milvus 的 `method_text`。按分数留下默认 5 题。`explain` 锁定的那一题不参与淘汰。
8. **裁剪上下文。**
   - `recommend`：每题只给 `question_id`、展示题号、标题、难度、方法摘要。提示里写明模型必须原样返回 `question_id`，展示题号只用于叙述。
   - `explain` 且用户在问做法、步骤、复杂度或「怎么做」：只给锁定的那一题，可以附带 `solution_summary`。
   - `explain` 且只问时间限制、内存限制、难度或题意：只读 MySQL 公开字段，不读 `solution_summary`。
   - 用户点名的做法不在该方法摘要中：回答先说明摘要里没有这种方法，再只讲摘要里已有的做法。不把没写上的做法讲成这道题的做法。
9. **生成。** 对话模型只看到这一轮留下的题目，加上最近 8 轮的用户原话和 `content_for_model`。组织中文回答，并给出 `question_id` 列表。理由只能使用对应方法摘要里写过的做法。用户可见的正文按第 7.1 节流式推送。题号列表留在服务端，不逐字推给浏览器。
10. **校验。** 在发出 `done` 之前完成。丢掉不在本轮候选里的 `question_id`。模型若回了展示题号而该数字不是候选 `question_id`，同样丢掉。通过的 id 由服务端重新查库，填上 `display_index`、标题、难度和 `#/problems/{id}`。推荐的 `done` 没有 `explanation`，也没有 `solution_summary`。代码围栏按第 7.1 节处理后再推送。

每一轮推荐都重新检索。不沿用上一轮没有被点名的候选题，也不读取该用户其他会话的消息。

### 7.1 流式输出

`POST /api/agent/chat` 在鉴权、会话校验通过并取得并发名额之后，返回 `text/event-stream`。检索和重排完成后再推正文。每条事件的 `data` 是一行 JSON。

| 事件 | 何时 | data |
|---|---|---|
| `meta` | 正文开始前，只发一次 | `conversation_id`、`intent` |
| `delta` | 生成过程中，可多次 | `{ "field": "reply" 或 "explanation", "text": "这一小段" }` |
| `done` | 校验结束，只发一次 | 与第 8 节的完整 JSON 相同 |
| `error` | 流已经打开之后失败 | `{ "message": "笼统原因" }`，随后关闭流 |

`reply` 始终逐段推送。只有讲解做法时才推送 `explanation`。推荐的事件里没有 `explanation`，也没有 `solution_summary`。`problems` 只出现在 `done`。题目卡片不从已经推送的正文里解析题号。

普通正文收到增量就转发。Markdown 代码围栏先缓冲到围栏结束。围栏内容里有 `#include` 或 `main` 时，改为推送「这里只讲步骤，不提供可提交代码」；其余围栏在结束后整段推送。

401、404，以及第 7.2 节的排队失败，在打开流之前返回 JSON。流打开之后的失败只用 `error` 事件。事件里不写数据库语句、密钥和模型原始报错。

浏览器断开时取消尚未结束的模型调用。`agent_messages` 和 checkpoint 只在 `done` 组装完成之后写入。失败或断开不保存助手正文，半截文字不进入下一轮提示词。

### 7.2 并发

一个 Agent 进程用异步同时处理多路问答。

- 问答接口是异步的。图使用异步流式接口。DeepSeek 和千问的 HTTP 调用在等待响应时交出事件循环。
- MySQL、PostgreSQL、Milvus 若使用同步驱动，只放到线程池里调用。线程池大小不超过同时进行上限。
- 等待模型期间不占用数据库连接。鉴权、召回、写入各自借用后归还。
- 全进程同时进行中的问答最多 **20** 路，所有用户合在一起计数。名额已满时排队最多 5 秒。到时仍没有名额，返回 HTTP 429 和 `{"message":"助手忙，请稍后再试"}`。
- 同一个 `conversation_id` 同时只跑一轮。该会话已在回答时，新请求返回 HTTP 429 和 `{"message":"上一轮还在回答"}`。不同用户、不同会话并行，互不等待。
- 一轮结束、失败或浏览器断开后，立刻释放名额和该会话的进行中标记。
- 第 9 节的每人每分钟次数仍然有效，与这 20 路分开计算。

入库和删除不占用这 20 路。全量重建可以和问答同时进行。问答仍按第 6 节在重排前复核可见性。

## 8. 对外接口

公开前缀 `/api/agent`，由 Nginx 转发到本机 Agent，并转发 Cookie。

| 方法 | 路径 | 鉴权 | 作用 |
|---|---|---|---|
| `GET` | `/api/agent/health` | 无 | 进程、MySQL、PostgreSQL、Milvus 是否可连接。不返回版本、密钥和错误详情 |
| `POST` | `/api/agent/chat` | 登录 | 一轮问答。成功时响应为 SSE |
| `GET` | `/api/agent/prefs` | 登录 | 读取当前用户偏好。没有行则返回空难度、`skip_solved: false`、空的 `focus_topics` |
| `DELETE` | `/api/agent/prefs` | 登录 | 清空当前用户偏好 |
| `POST` | `/internal/reindex` | 共享密钥，仅本机 | 入库。正文是 `{ "all": true }` 或 `{ "question_ids": [1, 2] }` |
| `POST` | `/internal/delete` | 共享密钥，仅本机 | 按 `question_ids` 删除档案和向量 |

`POST /api/agent/chat` 的筛选项省略表示「用偏好」：

```json
{
  "conversation_id": null,
  "message": "推荐几道二叉树的题，跳过我做过的"
}
```

用户改过控件之后才带上对应字段。`difficulty` 为空字符串表示本轮不限，会盖过偏好。`skip_solved` 必须是 JSON 布尔值才算带上；`false` 表示本轮不跳过，会盖过「以后都跳过」。问句里的明确要求再盖过请求字段。`skip_solved` 只作用于 `recommend`。

成功时响应类型是 `text/event-stream`，不是一次性 JSON。`done` 的 `data` 使用下面的结构。推荐例：

```
event: meta
data: {"conversation_id":1,"intent":"recommend"}

event: delta
data: {"field":"reply","text":"从题库里挑了这些二叉树题，都还没 AC。"}

event: done
data: {"conversation_id":1,"intent":"recommend","reply":"从题库里挑了这些二叉树题，都还没 AC。","problems":[...]}
```

推荐类 `done`：

```json
{
  "conversation_id": 1,
  "intent": "recommend",
  "reply": "从题库里挑了这些二叉树题，都还没 AC。",
  "problems": [
    {
      "id": 12,
      "display_index": 11,
      "title": "二叉树的层序遍历",
      "difficulty": "中等",
      "reason": "可以用 BFS，也可以用 DFS 逐层记录",
      "href": "#/problems/12"
    }
  ]
}
```

`id` 是 `questions.id`，卡片上给用户看的编号是 `display_index`，链接使用 `href`。`reason` 是模型根据方法摘要写的说明，不是第二份题面。

讲解类 `done` 的 `problems` 只有一道。`explanation` 在顶层，是解法摘要的转述，不是 `solution_summary` 原文字段名，也不含标程和测试点。只问公开字段时没有 `explanation`。

```json
{
  "conversation_id": 1,
  "intent": "explain",
  "reply": "按题库里的方法笔记讲展示题号 11。这不是标程。",
  "explanation": "可以用 BFS 分层；也可以 DFS 时记录深度。时间复杂度……",
  "problems": [
    {
      "id": 12,
      "display_index": 11,
      "title": "二叉树的层序遍历",
      "difficulty": "中等",
      "reason": "笔记里的做法是 BFS 或 DFS",
      "href": "#/problems/12"
    }
  ]
}
```

前端页面 `#/assistant`：输入框、逐段增长的回复、题目卡片。`meta` 到达后保存 `conversation_id`，同一轮对话原样带回；新对话发送 `null`。`delta` 按 `field` 追加到回复或讲解。`done` 之后才画卡片。卡片文字用 `display_index`，点击用 `href`。流没有结束时不能再次发送。收到 `error` 时保留已经出现的文字，标明本轮没有完成，不画卡片。进入页面时读 `GET /api/agent/prefs` 设置难度和「跳过已 AC」。该勾选默认不勾。用户没有改过控件时，请求里不带这两个字段。

## 9. 安全限制

- **登录。** 与 OJ 共用 `sessions.token`。Agent 不签发自己的用户登录态。
- **会话归属。** 读写会话和偏好时都带当前 `user_id`。
- **最小权限。** MySQL 只有第 4.1 节三个视图的 `SELECT`。PostgreSQL、Milvus 使用独立账号。
- **秘密。** 模型密钥、数据库密码、内部密钥只放环境变量或 `deploy` 下不入库的 env 文件。
- **题面和摘要都当数据。** 放在分隔符内，不能改变检索范围、工具或系统规则。摘要只保留第 5 节的固定结构。
- **可见性。** 隐藏题、已删题不进索引。同步未完成时，重排前的 MySQL 复核把它们丢掉。
- **解法隔离。** 推荐链路的检索文本、提示词、checkpoint、`delta` 和 `done` 都不含 `solution_summary`。历史讲解只以 `content_for_model` 的一行占位进入后续提示词。日志只记录这份占位，不记录 `solution_summary` 和讲解正文。
- **ID 白名单。** 只接受本轮候选集中的 `question_id`，并由服务端重新查库后才返回卡片。
- **无执行能力。** 图里没有壳命令、没有文件写入、没有提交代码的工具。
- **限额。** 每用户每分钟问答次数、单条消息长度、召回条数和重排条数设上限。对话、嵌入、重排三次调用都设置超时。同时进行中的问答按第 7.2 节最多 20 路。
- **入库接口。** 只绑本机，只接受 `X-Agent-Key`。不出现在 Nginx 的公开 location 里。
- **错误对外。** 失败时返回笼统原因。数据库语句、密钥、模型原始报错不返回给浏览器。

## 10. 部署

开发与生产都是：

- MySQL 沿用现有库，并增加第 4.1 节的只读视图和账号。
- PostgreSQL、Milvus 单机跑在本机。PostgreSQL 启用 `pg_trgm`。
- Agent 由 systemd 单独管理，只听 `127.0.0.1`。
- Nginx 只把 `/api/agent/health`、`/api/agent/chat`、`/api/agent/prefs` 反代过去，并转发 Cookie。`/internal/` 没有公开 location。
- `/api/agent/chat` 关闭代理缓冲，`proxy_read_timeout` 大于对话、嵌入、重排三次超时之和。Agent 对该响应加上 `X-Accel-Buffering: no` 和 `Cache-Control: no-cache`，避免正文被攒到结束才到达浏览器。
- 配置放在 `agent/.env.example`（只含键名）和本机不入库的 env。

Milvus 用单机部署，不搭集群。更新 OJ 时不要求同时重建向量。摘要缺失或 `milvus_synced = false` 的题不参与召回，由重建命令补齐。回答前的可见性复核仍然生效。

## 11. 验收

- 问「推荐二叉树」时，返回的都是可见题。顺序来自重排分数。`reason` 里的做法能在该方法摘要中找到。卡片展示 `display_index`，链接里的 id 是 `questions.id`。
- 回答以 SSE 逐段出现。题目卡片只在 `done` 之后出现，且只含校验通过的 `question_id`。推荐的 `delta` 和 `done` 里没有完整解法摘要。
- 两名用户同时提问时，两路都逐段返回，会话和题目卡片互不混用。已有 20 路在回答时，新请求排队超时后得到 429 和「助手忙，请稍后再试」。同一会话在上一轮未结束时再次发送，得到「上一轮还在回答」。
- 生成中途断开后，下一轮提示词里没有这轮的半截正文。
- 向量召回靠前但方法对不上的题，重排后排到后面或被丢掉。
- 一题多种做法时，用户点名其中一种也能被检索到。用户点名的做法不在摘要里时，回答先说明没有这种方法，再只讲摘要里已有的做法。
- 点名隐藏题号或不存在的题号时，不返回题目内容，回复不区分「没有」和「未公开」。题目改为不可见之后，推荐和讲解都不再出现它。
- 「跳过已 AC」打开时，推荐结果里没有当前用户已 AC 的题，且这是在取 20 条之前排除的。同一开关下，点名讲解一道已 AC 的可见题，仍然返回讲解。
- 「讲一下第二道」定位到上一轮返回列表的第 2 个 `question_id`。没有上一轮列表时不检索。
- 模型返回的数字若只是展示题号、且不等于候选 `question_id`，该数字被丢掉。编造的 id 也被丢掉。
- 推荐响应、推荐提示词、checkpoint，以及后续轮次的 `content_for_model` 中，没有完整解法摘要、标程、测试点和上一轮讲解步骤。
- 点名可见题并要求讲解时，回答包含做法步骤，并标明不是标程。回答里带 `#include` 或 `main` 的代码围栏不会原样返回。
- 未登录的 chat、prefs 返回 401。别人的 `conversation_id` 返回 404。
- 题面七项未变化时，重复入库不调用摘要模型；`milvus_synced = false` 时同一次入库会补写向量。
- 只修改 `display_index` 后，档案和 Milvus 中的展示题号更新，且不调用摘要模型。
- 管理员删除、批量删除、批量隐藏之后，这些 `question_id` 在 PostgreSQL 和 Milvus 中都不存在。全量重建也会清掉「MySQL 仍在但已隐藏」的档案和向量。
- 省略 `skip_solved` 时沿用偏好；请求显式传 `false` 时本轮不跳过。
- 内部入库地址从公网 Nginx 访问不到。

## 12. 已确认

1. 第一版入口是 `#/assistant`。
2. 「跳过已 AC」默认关闭，由用户勾选或在句子里说明。它只影响推荐。
3. 对话用 `deepseek-flash`，嵌入用 `text-embedding-v4`（请求显式传 1024 维，Milvus 用 COSINE），重排用 `qwen3.7-text-rerank`。
4. 题目创建、编辑、批量显示/隐藏/删除，以及录题审核通过后，由 C++ 调本机内部接口。失败时题目保存仍然有效，管理员可手动重建。隐藏和删除按第 6 节同步去掉档案与向量。
5. 问答使用 SSE 流式输出。一个 Agent 进程异步处理，同时进行最多 20 路；同一会话同时只跑一轮。
