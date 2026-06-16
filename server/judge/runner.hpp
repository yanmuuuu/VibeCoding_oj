#pragma once
#include <string>
#include <sys/resource.h>

struct TestCase {
    int id;
    int order_index;
    std::string input_data;
    std::string expected_output;
};

struct RunResult {
    int index;
    std::string status; // AC, WA, TLE, MLE, RE
    int time_ms;
    int memory_kb;
    std::string actual_output;
    std::string expected_output;
    std::string input_data;
};

RunResult run_single(const std::string& binary_path, const TestCase& tc,
                     int time_limit_sec, int memory_limit_mb);
