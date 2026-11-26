#include "pool.hpp"
#include "../util/logger.hpp"
#include <cstring>
#include <iostream>
#include <chrono>

void DbConn::query(const std::string& sql) {
    if (mysql_query(conn_, sql.c_str()) != 0) {
        throw std::runtime_error(std::string("MySQL query error: ") + mysql_error(conn_) + " | SQL: " + sql);
    }
}

MYSQL_RES* DbConn::store_result() {
    MYSQL_RES* res = mysql_store_result(conn_);
    if (!res && mysql_field_count(conn_) > 0) {
        throw std::runtime_error(std::string("mysql_store_result failed: ") + mysql_error(conn_));
    }
    return res;
}

unsigned long long DbConn::last_insert_id() {
    return mysql_insert_id(conn_);
}

unsigned long long DbConn::affected_rows() {
    return mysql_affected_rows(conn_);
}

std::string DbConn::escape(const std::string& s) {
    std::string buf(s.size() * 2 + 1, '\0');
    unsigned long len = mysql_real_escape_string(conn_, &buf[0], s.c_str(), s.size());
    buf.resize(len);
    return buf;
}

MYSQL* DbPool::create_connection() {
    MYSQL* conn = mysql_init(nullptr);
    if (!conn) {
        LOG_ERROR("DB pool: mysql_init() failed");
        throw std::runtime_error("mysql_init failed");
    }
    mysql_options(conn, MYSQL_SET_CHARSET_NAME, "utf8mb4");
    unsigned int connect_timeout = 3;
    mysql_options(conn, MYSQL_OPT_CONNECT_TIMEOUT, &connect_timeout);
    if (!mysql_real_connect(conn, host_.c_str(), user_.c_str(), pass_.c_str(),
                            db_.c_str(), port_, nullptr, 0)) {
        std::string err = mysql_error(conn);
        mysql_close(conn);
        LOG_ERROR("DB pool: mysql_real_connect() failed: " + err);
        throw std::runtime_error("MySQL connect failed: " + err);
    }
    if (mysql_query(conn, "SET time_zone = '+08:00'") != 0) {
        std::string err = mysql_error(conn);
        mysql_close(conn);
        LOG_ERROR("DB pool: SET time_zone failed: " + err);
        throw std::runtime_error("MySQL set time_zone failed: " + err);
    }
    return conn;
}

bool DbPool::validate_connection(MYSQL* conn) {
    if (mysql_ping(conn) == 0) return true;
    LOG_WARNING("DB pool: stale connection detected, will replace");
    mysql_close(conn);
    return false;
}

DbPool::DbPool(const std::string& host, int port, const std::string& user,
               const std::string& pass, const std::string& db, int size)
    : host_(host), port_(port), user_(user), pass_(pass), db_(db), pool_size_(size), in_use_(0) {
    for (int i = 0; i < size; ++i) {
        pool_.push(create_connection());
    }
    LOG_INFO("DB pool initialized with " + std::to_string(size) + " connections to " + host + ":" + std::to_string(port) + "/" + db);
}

DbPool::~DbPool() {
    while (!pool_.empty()) {
        mysql_close(pool_.front());
        pool_.pop();
    }
    LOG_INFO("DB pool destroyed");
}

std::shared_ptr<DbConn> DbPool::acquire(int timeout_ms) {
    MYSQL* conn = nullptr;
    bool need_create = false;
    {
        std::unique_lock<std::mutex> lock(mutex_);
        auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeout_ms);
        while (pool_.empty() && in_use_ >= pool_size_) {
            if (cv_.wait_until(lock, deadline) == std::cv_status::timeout &&
                pool_.empty() && in_use_ >= pool_size_) {
                throw std::runtime_error("DB pool: acquire timeout after " + std::to_string(timeout_ms) + "ms, all connections busy");
            }
        }
        if (!pool_.empty()) {
            conn = pool_.front();
            pool_.pop();
        } else {
            need_create = true;
        }
        ++in_use_;
    }

    try {
        if (need_create || !validate_connection(conn)) {
            conn = create_connection();
        }
    } catch (...) {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            --in_use_;
        }
        cv_.notify_one();
        throw;
    }

    try {
        return std::shared_ptr<DbConn>(new DbConn(conn), [this](DbConn* dc) {
            release(dc->get());
            delete dc;
        });
    } catch (...) {
        mysql_close(conn);
        {
            std::lock_guard<std::mutex> lock(mutex_);
            --in_use_;
        }
        cv_.notify_one();
        throw;
    }
}

void DbPool::release(MYSQL* conn) {
    {
        std::lock_guard<std::mutex> lock(mutex_);
        pool_.push(conn);
        --in_use_;
    }
    cv_.notify_one();
}

DbPool* g_db = nullptr;
