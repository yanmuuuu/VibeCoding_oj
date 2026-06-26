# MioOJ 面试问答参考

> 面向「你做过什么 / 技术细节 / 人机协作」类问题。答案结合本项目真实实现，可按面试时长裁剪。

---

## 一、项目概述

### Q1：用 1 分钟介绍这个项目。

**答：** MioOJ 是我做的 C++ 在线判题系统，类似 LeetCode 的 ACM 模式。用户注册登录后可以浏览题目、在 ACE 编辑器里写 C++、提交后自动判题，返回 AC/WA/TLE 等结果。除了 OJ 核心，还有排行榜、讨论区、私信、公告和管理员录题后台。后端是 C++ 单进程（cpp-httplib）+ MySQL，前端是原生 JS SPA，部署在阿里云，域名 **https://rinr.top**，Nginx + HTTPS + systemd。项目从 SPEC 驱动开发，我和 Cursor AI 结对完成实现与上线。

---

### Q2：为什么叫 MioOJ？和 vibeoj 的关系？

**答：** MioOJ 是对外品牌名（含猫耳吉祥物 UI）。内部二进制、数据库名等历史标识仍是 `vibeoj`，避免大规模重命名。用户看到的是 MioOJ，代码仓库名可以是 VibeCoding_oj。

---

### Q3：这个项目里 AI 做了什么，你做了什么？

**答：** **我**负责：定需求、写 SPEC、验收标准、选技术路线、域名部署、运维、产品细节（如题号从 0 起、换账号不串代码）。**AI**负责：按 SPEC 写 C++ handler、前端页面、SQL 迁移、部署脚本、排错。不是 AI 自动生成完我就不管——每个 Phase 都是我提需求、看效果、再迭代。这是「双向奔赴」：我保证方向和质量，AI 提高实现速度。

---

## 二、架构与后端

### Q4：整体架构是怎样的？

**答：** 浏览器 Hash 路由 SPA → Nginx 终结 HTTPS → 反代到本机 8080 的 `vibeoj` 进程。该进程同时提供 REST API 和静态文件。提交代码后写入 MySQL，判题任务进线程池：编译用户代码 → 对每个测试点 fork 子进程运行 → 比对 stdout 与期望输出 → 更新 submission 状态。前端轮询结果页。

---

### Q5：为什么用 C++ 写后端而不是 Go/Java？

**答：** 学习目的：OJ 判题本身就要调 g++、fork、setrlimit，用 C++ 写引擎更直接；cpp-httplib 可以单文件集成 HTTP + 静态服务，部署简单。trade-off 是开发效率不如框架型语言，所以用 AI 辅助补全 handler 和样板代码。

---

### Q6：判题流程详细步骤？

**答：**
1. `POST /api/submit` 写入 `submissions`，状态 PENDING  
2. 线程池 worker 取出任务  
3. `compiler.cpp`：代码写临时文件，`g++ -O2 -std=c++17` 编译，超时 10s  
4. CE 则直接返回编译错误  
5. 从 DB 读该题全部 `test_cases`，按 `order_index` 排序  
6. 每个点：`runner.cpp` fork → 子进程 setrlimit(CPU/内存) → dup2 重定向 stdin/stdout → exec 用户程序 → wait4  
7. 比对输出，记录每点状态/耗时/内存，写入 `detail_json`  
8. 汇总为 AC/WA/TLE/MLE/RE 等  

---

### Q7：如何保证用户代码不能搞破坏系统？

**答：** 学习级方案，非生产级沙箱：
- 每测试点 **fork 独立子进程**，崩溃不影响主服务  
- **setrlimit** 限制 CPU 时间、内存（RLIMIT_CPU、RLIMIT_AS）  
- 超时/wait 杀进程 → TLE  
- 非 0 退出/信号 → RE  

**局限：** 没有 namespace/cgroup/Docker，恶意代码仍可能有内核级风险；SPEC 里也写了 V2 可上 Docker。

---

### Q8：线程池怎么设计的？

**答：** 固定 4 个 worker（可配置），任务队列 + condition_variable。提交后异步判题，HTTP 立刻返回 submission_id，前端轮询。多用户同时提交不同题可并行，同一 worker 内顺序处理任务。

---

### Q9：数据库连接怎么管理？

**答：** 自研 `DbPool`：启动时创建 N 条 MySQL 连接，请求时 acquire/release，RAII 封装，mutex 保护。避免每请求 connect 的开销。

---

### Q10：密码和 Session 怎么做的？

**答：** 注册密码 **Argon2id** 哈希存 `users.password_hash`。登录成功生成随机 token（SHA256），写 `sessions` 表，Set-Cookie。之后请求从 Cookie 取 token 查 session。退出删 session。封禁用户会清 session 并拒绝登录。

---

### Q11：题目编号为什么不用自增 id？

**答：** 数据库 `id` 是内部主键，删题后会留空洞；用户可见的 `#` 用 **`display_index`**，从 0 递增分配，与 id 解耦。列表、搜索、录题向导都展示 display_index，路由仍用 id。

---

## 三、前端

### Q12：为什么不用 React/Vue？

**答：** 控制依赖、学习 SPA 原理。Hash 路由 + 原生 JS 模块加载各 page 的 `renderXxx(main)`。trade-off 是没有组件化生态，但项目规模可控，部署只需静态文件。

---

### Q13：代码编辑器怎么集成的？

**答：** ACE Editor CDN，C++ 模式，支持主题切换、自动补全开关（localStorage 持久化）。代码草稿按 **`code_{userId}_{problemId}`** 存 localStorage，避免同浏览器换账号串代码。

---

### Q14：双主题 UI 怎么实现？

**答：** 默认「相册模式」：背景图 + 暗色遮罩 + 黑金边框。设置里关「相册背景」给 `body` 加 `lc-white`，切换 LeetCode 风白底卡片。CSS 在 `style_v2.css`，弹窗 `mio-dialog` 两套样式。

---

## 四、部署与运维

### Q15：怎么部署上线的？

**答：** 阿里云 ECS，Ubuntu。MySQL 本地，编译 `vibeoj`，systemd 托管，`deploy/production.env` 注入数据库密码。Nginx 反代 80/443 → 8080。Certbot 申请 Let's Encrypt。日常 `git pull` + `bash deploy/update-prod.sh`（先 stop 服务再编译，避免端口冲突）。

---

### Q16：敏感配置怎么管理？

**答：** 不写进 `config.hpp` 提交 Git。`server/util/config_loader.hpp` 启动时读环境变量，`deploy/production.env` / `local.env` 在 `.gitignore`。Nginx/systemd 读 production.env。

---

### Q17：本地测试和生产会互相影响吗？

**答：** 默认共用同一 MySQL 库，但 **端口不同**：生产 systemd 占 8080，本地 `make run-local` 用 8081。`update-prod.sh` 会先 stop 再编译再 start。若要做数据隔离，可另建 `vibeoj_dev` 库改 local.env。

---

## 五、数据库

### Q18：有哪些核心表？

**答：** `users`、`sessions`、`questions`（含 display_index、reference_code）、`test_cases`、`submissions`、`announcements`；讨论相关 `discussions`、回复、点赞；私信 `conversations`、`messages`（含 is_recalled）；题目评论多一套 comment 表。详见 SPEC 第 5 节。

---

### Q19：排行榜积分怎么算？

**答：** 简单 1 分 / 中等 2 分 / 困难 3 分，**每题 AC 只计一次**（按 user_id + question_id 去重）。只展示积分 > 0 的用户 Top 100。我的名次 API 即使未上榜也返回自己的统计。

---

## 六、难点与改进

### Q20：开发中遇到的最大难点？

**答（示例，可结合真实经历）：**
1. **判题稳定性**：fork/wait、临时文件清理、编译超时  
2. **录题流程**：标程生成期望输出、发布前校验用例+标程  
3. **部署**：环境变量、systemd 与手动进程端口冲突 → update 脚本先 stop  
4. **体验**：localStorage 草稿未按用户隔离 → 改为 userId 维度  

---

### Q21：如果流量变大怎么优化？

**答：** 判题任务 Redis 队列 + 多 worker 机器；MySQL 读写分离；测试用例大输入迁对象存储；完整 Docker/seccomp 沙箱；CDN 静态资源；WebSocket 替代私信轮询。

---

### Q22：有什么已知不足？

**答：** 仅 C++；沙箱不够硬；localStorage 草稿不跨设备；同服务器 local/prod 共库；无自动化测试 CI。都在 SPEC V2 或后续计划里。

---

## 七、行为面试

### Q23：为什么做这个项目？

**答：** 想完整走一遍「需求 → 实现 → 上线」而不是只写算法题。OJ 覆盖后端、系统编程、前端、数据库、运维，且能真实给别人用（rinr.top）。

---

### Q24：SPEC 驱动开发的好处？

**答：** 需求不散、可验收（AC-1~AC-91）、AI 有上下文、面试能讲清楚边界。我改 SPEC 再让 AI 实现，减少「想到哪写到哪」的混乱。

---

### Q25：如果重做会有什么不同？

**答：** 更早引入 Docker 判题；自动化测试覆盖 API；前后端分离或至少 TypeScript；独立 dev 数据库；CI 自动跑 migrate + 编译。

---

## 八、快速技术词汇表

| 术语 | 本项目含义 |
|------|------------|
| display_index | 用户可见题号，从 0 起 |
| order_index | 测试点顺序，从 0 起 |
| reference_code | 管理员录入的标程 |
| vibeoj | 后端二进制名 |
| mio-dialog | 统一确认/提示弹窗 |
| update-prod.sh | 生产安全更新脚本 |

---

*配合 [README.md](README.md) 与 [SPEC.md](SPEC.md) 使用。*
