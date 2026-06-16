#pragma once
#include <mysql/mysql.h>
#include <string>
#include <vector>
#include <memory>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <stdexcept>

class DbConn {
public:
    DbConn(MYSQL* conn) : conn_(conn) {}
    ~DbConn() {}
    MYSQL* get() { return conn_; }

    void query(const std::string& sql);
    MYSQL_RES* store_result();
    unsigned long long last_insert_id();
    unsigned long long affected_rows();
    std::string escape(const std::string& s);

private:
    MYSQL* conn_;
};

class DbPool {
public:
    DbPool(const std::string& host, int port, const std::string& user,
           const std::string& pass, const std::string& db, int size);
    ~DbPool();

    std::shared_ptr<DbConn> acquire();
    void release(MYSQL* conn);

private:
    std::queue<MYSQL*> pool_;
    std::mutex mutex_;
    std::condition_variable cv_;
    int pool_size_;
};

extern DbPool* g_db;
