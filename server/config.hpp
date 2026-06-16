#pragma once
#include <string>

struct Config {
    int         port          = 8080;
    std::string db_host       = "127.0.0.1";
    int         db_port       = 3306;
    std::string db_user       = "VibeOJUser";
    std::string db_password   = "347191964YM";
    std::string db_name       = "vibeoj";
    int         db_pool_size  = 8;
    std::string web_root      = "web";
    std::string tmp_dir       = "/tmp/oj";
    int         judge_workers = 4;
    int         default_time_limit   = 1;
    int         default_memory_limit = 256;
    int         compile_timeout      = 10;
    int         max_binary_size      = 50 * 1024 * 1024;
};

extern Config g_config;
