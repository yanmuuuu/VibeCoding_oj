#pragma once
#include <string>
#include <mutex>
#include <fstream>
#include <iostream>
#include <sstream>
#include <ctime>
#include <chrono>
#include <cstring>
#include <cstdio>

enum class LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARNING = 2,
    ERROR = 3
};

class Logger {
public:
    static Logger& instance() {
        static Logger logger;
        return logger;
    }

    void set_log_file(const std::string& path) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (log_file_.is_open()) log_file_.close();
        if (path.empty()) return;
        log_file_.open(path, std::ios::app);
        if (!log_file_.is_open()) {
            std::cerr << "Logger: failed to open log file: " << path << std::endl;
        }
    }

    void set_min_level(LogLevel level) {
        min_level_ = level;
    }

    LogLevel min_level() const { return min_level_; }

    void log(LogLevel level, const char* file, int line, const std::string& msg) {
        if (level < min_level_) return;

        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()) % 1000;

        std::tm tm;
        localtime_r(&time_t, &tm);

        char time_buf[64];
        std::snprintf(time_buf, sizeof(time_buf), "%04d-%02d-%02d %02d:%02d:%02d.%03d",
                      tm.tm_year + 1900, tm.tm_mon + 1, tm.tm_mday,
                      tm.tm_hour, tm.tm_min, tm.tm_sec,
                      static_cast<int>(ms.count()));

        const char* level_str = "INFO ";
        switch (level) {
            case LogLevel::DEBUG:   level_str = "DEBUG"; break;
            case LogLevel::INFO:    level_str = "INFO "; break;
            case LogLevel::WARNING: level_str = "WARN "; break;
            case LogLevel::ERROR:   level_str = "ERROR"; break;
        }

        // Extract filename from path
        const char* fname = std::strrchr(file, '/');
        if (fname) fname++; else fname = file;

        std::ostringstream line_stream;
        line_stream << "[" << time_buf << "] [" << level_str << "] [" << fname << ":" << line << "] " << msg;
        std::string line_str = line_stream.str();

        {
            std::lock_guard<std::mutex> lock(mutex_);
            if (level >= LogLevel::WARNING) {
                std::cerr << line_str << std::endl;
            } else {
                std::cout << line_str << std::endl;
            }
            if (log_file_.is_open()) {
                log_file_ << line_str << std::endl;
                log_file_.flush();
            }
        }
    }

private:
    Logger() = default;
    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;

    std::mutex mutex_;
    std::ofstream log_file_;
    LogLevel min_level_ = LogLevel::DEBUG;
};

#define LOG_DEBUG(msg)   Logger::instance().log(LogLevel::DEBUG,   __FILE__, __LINE__, msg)
#define LOG_INFO(msg)    Logger::instance().log(LogLevel::INFO,    __FILE__, __LINE__, msg)
#define LOG_WARNING(msg) Logger::instance().log(LogLevel::WARNING, __FILE__, __LINE__, msg)
#define LOG_ERROR(msg)   Logger::instance().log(LogLevel::ERROR,   __FILE__, __LINE__, msg)
