#pragma once
#include <string>

struct CompileResult {
    bool success = false;
    std::string error;
    std::string binary_path;
};

CompileResult compile_code(const std::string& code, const std::string& tmp_dir, int timeout_sec);
