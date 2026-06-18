#include "engine.hpp"
#include "compiler.hpp"
#include "runner.hpp"
#include "../db/pool.hpp"
#include "../config.hpp"
#include "../util/logger.hpp"
#include <mysql/mysql.h>
#include <unistd.h>
#include <sstream>
#include <iostream>

JudgeEngine::JudgeEngine(size_t workers) : pool_(workers) {}

JudgeEngine::~JudgeEngine() {}

    // Submit to judge engine
    void JudgeEngine::submit(int submission_id, const std::string& code, int question_id,
                             int time_limit, int memory_limit) {
        LOG_INFO("Judge enqueued: submission #" + std::to_string(submission_id) + " question #" + std::to_string(question_id));
        pool_.enqueue([this, submission_id, code, question_id, time_limit, memory_limit] {
            process(submission_id, code, question_id, time_limit, memory_limit);
        });
    }

void JudgeEngine::process(int submission_id, const std::string& code, int question_id,
                          int time_limit, int memory_limit) {
    auto db = g_db->acquire();

    // Update status to COMPILING
    db->query("UPDATE submissions SET status='COMPILING' WHERE id=" + std::to_string(submission_id));

    // Compile
    CompileResult comp = compile_code(code, g_config.tmp_dir, g_config.compile_timeout);
    if (!comp.success) {
        std::string err = db->escape(comp.error);
        db->query("UPDATE submissions SET status='CE', compile_error='" + err + "', total_count=0, passed_count=0 WHERE id=" + std::to_string(submission_id));
        LOG_WARNING("Submission #" + std::to_string(submission_id) + " compile error: " + comp.error);
        return;
    }

    // Get test cases
    db->query("SELECT id, order_index, input_data, expected_output FROM test_cases WHERE question_id=" +
              std::to_string(question_id) + " ORDER BY order_index ASC");
    MYSQL_RES* res = db->store_result();
    if (!res) {
        unlink(comp.binary_path.c_str());
        db->query("UPDATE submissions SET status='SE' WHERE id=" + std::to_string(submission_id));
        return;
    }

    std::vector<TestCase> test_cases;
    MYSQL_ROW row;
    while ((row = mysql_fetch_row(res))) {
        TestCase tc;
        tc.id = std::stoi(row[0]);
        tc.order_index = std::stoi(row[1]);
        tc.input_data = row[2] ? row[2] : "";
        tc.expected_output = row[3] ? row[3] : "";
        test_cases.push_back(tc);
    }
    mysql_free_result(res);

    if (test_cases.empty()) {
        unlink(comp.binary_path.c_str());
        db->query("UPDATE submissions SET status='SE' WHERE id=" + std::to_string(submission_id));
        LOG_ERROR("Submission #" + std::to_string(submission_id) + " SE: no test cases for question #" + std::to_string(question_id));
        return;
    }

    // Update status to RUNNING
    db->query("UPDATE submissions SET status='RUNNING', total_count=" +
              std::to_string(test_cases.size()) + " WHERE id=" + std::to_string(submission_id));

    // Run all test cases
    std::vector<RunResult> results;
    std::string final_status = "AC";
    int passed = 0;
    int max_time = 0;
    int max_mem = 0;

    for (const auto& tc : test_cases) {
        RunResult rr = run_single(comp.binary_path, tc, time_limit, memory_limit);
        results.push_back(rr);

        if (rr.status != "AC" && final_status == "AC") {
            final_status = rr.status;
        }
        if (rr.status == "AC") passed++;
        if (rr.time_ms > max_time) max_time = rr.time_ms;
        if (rr.memory_kb > max_mem) max_mem = rr.memory_kb;

        if (rr.status != "AC") break; // Stop on first failure
    }

    // Clean up binary
    unlink(comp.binary_path.c_str());

    // Build detail JSON
    std::ostringstream json;
    json << "[";
    for (size_t i = 0; i < results.size(); ++i) {
        if (i > 0) json << ",";
        json << "{\"index\":" << results[i].index
             << ",\"status\":\"" << results[i].status << "\""
             << ",\"time_ms\":" << results[i].time_ms
             << ",\"memory_kb\":" << results[i].memory_kb
             << "}";
    }
    json << "]";
    std::string detail = db->escape(json.str());

    // Update submission
    std::ostringstream sql;
    sql << "UPDATE submissions SET status='" << final_status << "',"
        << "total_time=" << max_time << ","
        << "total_memory=" << max_mem << ","
        << "passed_count=" << passed << ","
        << "total_count=" << test_cases.size() << ","
         << "detail_json='" << detail << "'"
         << " WHERE id=" << submission_id;
    db->query(sql.str());

    LOG_INFO("Submission #" + std::to_string(submission_id) + " judged: " + final_status + " (" + std::to_string(passed) + "/" + std::to_string(test_cases.size()) + " passed, " + std::to_string(max_time) + "ms, " + std::to_string(max_mem) + "KB)");
}
