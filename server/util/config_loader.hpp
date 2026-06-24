#pragma once
#include "../config.hpp"
#include <cstdlib>
#include <string>

inline std::string cfg_env(const char* key, const std::string& fallback) {
    const char* v = std::getenv(key);
    return (v && *v) ? std::string(v) : fallback;
}

inline int cfg_env_int(const char* key, int fallback) {
    const char* v = std::getenv(key);
    if (!v || !*v) return fallback;
    try {
        return std::stoi(v);
    } catch (...) {
        return fallback;
    }
}

inline void load_config_from_env(Config& c) {
    c.port = cfg_env_int("VIBEOJ_PORT", c.port);
    c.db_host = cfg_env("VIBEOJ_DB_HOST", c.db_host);
    c.db_port = cfg_env_int("VIBEOJ_DB_PORT", c.db_port);
    c.db_user = cfg_env("VIBEOJ_DB_USER", c.db_user);
    c.db_password = cfg_env("VIBEOJ_DB_PASSWORD", c.db_password);
    c.db_name = cfg_env("VIBEOJ_DB_NAME", c.db_name);
    c.db_pool_size = cfg_env_int("VIBEOJ_DB_POOL_SIZE", c.db_pool_size);
    c.web_root = cfg_env("VIBEOJ_WEB_ROOT", c.web_root);
    c.tmp_dir = cfg_env("VIBEOJ_TMP_DIR", c.tmp_dir);
    c.judge_workers = cfg_env_int("VIBEOJ_JUDGE_WORKERS", c.judge_workers);
    c.default_time_limit = cfg_env_int("VIBEOJ_DEFAULT_TIME_LIMIT", c.default_time_limit);
    c.default_memory_limit = cfg_env_int("VIBEOJ_DEFAULT_MEMORY_LIMIT", c.default_memory_limit);
    c.compile_timeout = cfg_env_int("VIBEOJ_COMPILE_TIMEOUT", c.compile_timeout);
    c.max_binary_size = cfg_env_int("VIBEOJ_MAX_BINARY_SIZE", c.max_binary_size);
    c.log_file = cfg_env("VIBEOJ_LOG_FILE", c.log_file);
    c.log_level = cfg_env_int("VIBEOJ_LOG_LEVEL", c.log_level);
}
