#pragma once
#include "threadpool.hpp"
#include <string>
#include <memory>

class JudgeEngine {
public:
    JudgeEngine(size_t workers);
    ~JudgeEngine();
    void submit(int submission_id, const std::string& code, int question_id,
                int time_limit, int memory_limit);

private:
    void process(int submission_id, const std::string& code, int question_id,
                 int time_limit, int memory_limit);

    ThreadPool pool_;
};
