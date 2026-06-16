#include "pool.hpp"
#include <cstring>
#include <iostream>

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

DbPool::DbPool(const std::string& host, int port, const std::string& user,
               const std::string& pass, const std::string& db, int size)
    : pool_size_(size) {
    for (int i = 0; i < size; ++i) {
        MYSQL* conn = mysql_init(nullptr);
        if (!conn) {
            throw std::runtime_error("mysql_init failed");
        }
        mysql_options(conn, MYSQL_SET_CHARSET_NAME, "utf8mb4");
        if (!mysql_real_connect(conn, host.c_str(), user.c_str(), pass.c_str(),
                                db.c_str(), port, nullptr, 0)) {
            std::string err = mysql_error(conn);
            mysql_close(conn);
            throw std::runtime_error("MySQL connect failed: " + err);
        }
        pool_.push(conn);
    }
}

DbPool::~DbPool() {
    while (!pool_.empty()) {
        mysql_close(pool_.front());
        pool_.pop();
    }
}

std::shared_ptr<DbConn> DbPool::acquire() {
    std::unique_lock<std::mutex> lock(mutex_);
    cv_.wait(lock, [this]{ return !pool_.empty(); });
    MYSQL* conn = pool_.front();
    pool_.pop();
    return std::shared_ptr<DbConn>(new DbConn(conn), [this](DbConn* dc) {
        release(dc->get());
        delete dc;
    });
}

void DbPool::release(MYSQL* conn) {
    {
        std::lock_guard<std::mutex> lock(mutex_);
        pool_.push(conn);
    }
    cv_.notify_one();
}

DbPool* g_db = nullptr;
