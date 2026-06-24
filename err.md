# VibeOJ 后端代码错误分析与修复报告

## 已修复的严重问题

### 1. SQL 注入漏洞 — `server/handler/admin.cpp` 批量操作
**严重程度：CRITICAL**

批量题目操作（删除/显示/隐藏）中，`ids_str` 直接从 JSON 提取后拼接到 SQL `IN (...)` 子句中，没有任何校验或转义。

```cpp
// 修复前（危险）
db->query("DELETE FROM questions WHERE id IN (" + ids_str + ")");
```

攻击者发送 `{"action":"delete","ids":"1) OR 1=1;--}` 即可删除全部题目。

**修复：** 先将 `ids_str` 解析为 `std::vector<int>`，再用 `std::to_string` 重新拼接为纯数字列表后才放入 SQL，确保每个 ID 都是合法整数。

---

### 2. 数据库连接池无健康检查 — `server/db/pool.cpp`
**严重程度：CRITICAL**

- `DbPool::acquire()` 从队列取出连接后直接返回，不检查连接是否存活。
- MySQL 默认 `wait_timeout=8h`，超时后服务端会关闭连接，下次查询将抛出 `"MySQL server has gone away"` 异常，导致请求 500。
- `acquire()` 无限期等待空闲连接，若 8 个连接全部被占用且不释放，所有请求线程将永久阻塞，无超时机制。

**修复：**
- 新增 `validate_connection()` 方法，使用 `mysql_ping()` 检测连接存活。
- 新增 `get_valid_connection()` 方法：从池中取连接 → ping 检测 → 死连接则关闭并尝试下一个 → 池空则新建连接。
- `acquire()` 增加 `timeout_ms` 参数（默认 5s），使用 `cv_.wait_for()` 替代 `cv_.wait()`，超时抛出 `std::runtime_error`。

---

### 3. Judge 线程池异常静默吞噬 — `server/judge/threadpool.cpp`
**严重程度：HIGH**

Judge worker 线程中的 `task()` 调用被 `catch(...)` 捕获后完全不记录日志：
```cpp
} catch (const std::exception& e) {
    // Log but don't kill the worker thread  <-- 注释说 log，实际没有
} catch (...) {
    // Ignore unknown exceptions              <-- 完全忽略
}
```
导致判题任务异常失败后提交永远卡在 `COMPILING`/`RUNNING` 状态，运维人员无法排查。

**修复：** 添加 `LOG_ERROR` 记录异常信息。

---

### 4. Judge 内存超限误判 — `server/judge/runner.cpp`
**严重程度：HIGH**

- 使用 `RLIMIT_AS`（虚拟地址空间限制）作为内存限制。当程序超过限制时，`malloc` 返回 NULL，若未检查则 SIGSEGV 崩溃。
- 原代码将 SIGSEGV 一律判为 `RE`（Runtime Error），但实际可能是 `MLE`（Memory Limit Exceeded）。

**修复：** 当信号为 SIGSEGV 且 `ru_maxrss` 已达到内存限制的 80% 以上时，判定为 `MLE` 而非 `RE`。

- 修复了 `wait4()` 循环中错误的 errno 判断（`EAGAIN` 不是 `wait4` 的有效 errno，仅需处理 `EINTR`）。

---

### 5. 缺少 `VIBEOJ_MAX_BINARY_SIZE` 配置项 — `server/util/config_loader.hpp`
**严重程度：MEDIUM**

`Config::max_binary_size` 字段定义了但从未通过环境变量加载，且编译后的二进制文件大小也从未检查。可能导致恶意用户提交超大二进制文件耗尽磁盘。

**修复：**
- `config_loader.hpp` 新增 `VIBEOJ_MAX_BINARY_SIZE` 环境变量读取。
- `engine.cpp` 编译成功后检查 `binary_size > max_binary_size`，超限则判 `CE`。
- `compiler.hpp` 的 `CompileResult` 新增 `binary_size` 字段。

---

## 已修复的中等问题

### 6. `rand()` 非线程安全 — `auth.cpp`, `avatar.cpp`, `icon.cpp`
**严重程度：MEDIUM**

`rand()` 在 glibc 中使用全局状态，多线程并发调用（如多个用户同时注册选头像）会导致数据竞争。

**修复：** 三个文件各自添加 `static std::mutex` 保护 `rand()` 调用。

---

### 7. `std::stoi(nullptr)` 潜在风险 — `server/middleware/auth.cpp`
**严重程度：MEDIUM**

```cpp
u.id = std::stoi(row[0]);  // 若 row[0] 为 NULL，UB
```

虽然 `users.id` 列是 `NOT NULL`，但防御性编程应为 NULL 加检查。

**修复：** 在 `std::stoi(row[0])` 前增加 `row[0]` 的 NULL 检查，若为空则拒绝认证。

---

### 8. 重复 systemd 服务导致端口冲突 — 部署配置
**严重程度：MEDIUM**

系统中存在两个 vibeoj 服务：
- `/etc/systemd/system/vibeoj.service`（系统级，enabled）
- `/home/user1/.config/systemd/user/vibeoj.service`（用户级，disabled 但被手动启动过）

两个服务同时启动时都能绑定 8080 端口（httplib 使用了 SO_REUSEPORT），导致请求随机分发到两个进程。

**修复：** 已停止并禁用用户级服务，仅保留系统级服务。

---

### 9. `pick_random_default_avatar()` 硬编码路径 — `server/handler/auth.cpp`
原代码使用 `"web/avatars"` 硬编码，但应使用 `g_config.web_root + "/avatars"` 以支持自定义 web_root。

**修复：** 改为使用 `g_config.web_root`，与 `avatar.cpp` 中同名函数保持一致。

---

## 其他已知但未修复的问题（低优先级/需更大改动）

| 问题 | 位置 | 说明 |
|------|------|------|
| 编译子进程无资源限制 | `compiler.cpp` | fork 后的 g++ 子进程没有 `setrlimit`，恶意代码可能通过 `#pragma` 耗尽资源 |
| `execlp` 搜索 PATH | `compiler.cpp:45` | 应使用 `/usr/bin/g++` 绝对路径，避免 PATH 劫持 |
| 判题无超时看门狗 | `engine.cpp` | 若 judge worker 崩溃，提交永远卡在 RUNNING 状态 |
| `write()` 未处理部分写入 | `runner.cpp:35`, `compiler.cpp:21` | 大输入数据时 write 可能只写入部分字节 |
| `extract_json_bool` 默认值 | `admin.cpp:108` | 找不到 key 时默认返回 `true`，可能导致 `is_visible` 意外变为 true |
| `extract_json_int` 错误值混淆 | `json_extract.hpp` | 错误和有效值 -1 无法区分 |
