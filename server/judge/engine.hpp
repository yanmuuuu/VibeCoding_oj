#pragma once
#include "threadpool.hpp"
#include <string>
#include <memory>

class JudgeEngine {
public:
    JudgeEngine(size_t workers);
    ~JudgeEngine();
    void submit(int submission_id, const std::string& code, int question_id,
                int time_limit, int memory_limit, bool run_all_tests);

private:
    void process(int submission_id, const std::string& code, int question_id,
                 int time_limit, int memory_limit, bool run_all_tests);
    void mark_system_error(int submission_id, const std::string& message);

    ThreadPool pool_;
};
