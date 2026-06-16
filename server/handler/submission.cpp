#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../judge/engine.hpp"
#include "../config.hpp"
#include "../util/json_extract.hpp"
#include <string>
#include <sstream>

extern JudgeEngine* g_judge;

void register_submission_routes(httplib::Server& svr) {
    svr.Post("/api/submit", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"Not authenticated\"}", "application/json");
            return;
        }

        auto body = req.body;
        int question_id = extract_json_int(body, "question_id");
        std::string code = extract_json_string(body, "code");

        if (question_id <= 0 || code.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"question_id and code required\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();

        // Verify question exists and is visible (or user is admin)
        db->query("SELECT id, time_limit, memory_limit, is_visible FROM questions WHERE id=" +
                  std::to_string(question_id));
        MYSQL_RES* qres = db->store_result();
        if (!qres || mysql_num_rows(qres) == 0) {
            if (qres) mysql_free_result(qres);
            res.status = 404;
            res.set_content("{\"error\":\"Problem not found\"}", "application/json");
            return;
        }

        MYSQL_ROW qrow = mysql_fetch_row(qres);
        int time_limit = qrow[1] ? std::stoi(qrow[1]) : g_config.default_time_limit;
        int memory_limit = qrow[2] ? std::stoi(qrow[2]) : g_config.default_memory_limit;
        bool is_visible = qrow[3] ? std::stoi(qrow[3]) : 1;
        mysql_free_result(qres);

        if (!is_visible && !user.is_admin) {
            res.status = 404;
            res.set_content("{\"error\":\"Problem not found\"}", "application/json");
            return;
        }

        // Insert submission
        std::string escaped_code = db->escape(code);
        db->query("INSERT INTO submissions (user_id, question_id, code, status) VALUES (" +
                  std::to_string(user.id) + ", " + std::to_string(question_id) +
                  ", '" + escaped_code + "', 'PENDING')");

        int sub_id = db->last_insert_id();

        // Submit to judge engine
        g_judge->submit(sub_id, code, question_id, time_limit, memory_limit);

        res.set_content("{\"ok\":true,\"submission_id\":" + std::to_string(sub_id) + "}", "application/json");
    });

    svr.Get(R"(/api/submissions/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"Not authenticated\"}", "application/json");
            return;
        }

        int id = std::stoi(req.matches[1]);
        auto db = g_db->acquire();
        db->query("SELECT s.id, s.user_id, s.question_id, s.code, s.status, "
                  "s.compile_error, s.total_time, s.total_memory, s.passed_count, "
                  "s.total_count, s.detail_json, s.created_at, q.title "
                  "FROM submissions s JOIN questions q ON s.question_id = q.id "
                  "WHERE s.id=" + std::to_string(id));

        MYSQL_RES* result = db->store_result();
        if (!result || mysql_num_rows(result) == 0) {
            if (result) mysql_free_result(result);
            res.status = 404;
            res.set_content("{\"error\":\"Submission not found\"}", "application/json");
            return;
        }

        MYSQL_ROW row = mysql_fetch_row(result);

        // Only owner or admin can view
        int owner_id = row[1] ? std::stoi(row[1]) : 0;
        if (owner_id != user.id && !user.is_admin) {
            mysql_free_result(result);
            res.status = 403;
            res.set_content("{\"error\":\"Forbidden\"}", "application/json");
            return;
        }

        auto esc = [](const char* s) -> std::string {
            if (!s) return "";
            std::string out;
            for (const char* p = s; *p; ++p) {
                switch (*p) {
                    case '"': out += "\\\""; break;
                    case '\\': out += "\\\\"; break;
                    case '\n': out += "\\n"; break;
                    case '\r': out += "\\r"; break;
                    case '\t': out += "\\t"; break;
                    default: out += *p;
                }
            }
            return out;
        };

        std::ostringstream json;
        json << "{\"id\":" << (row[0] ? row[0] : "0")
             << ",\"user_id\":" << (row[1] ? row[1] : "0")
             << ",\"question_id\":" << (row[2] ? row[2] : "0")
             << ",\"code\":\"" << esc(row[3]) << "\""
             << ",\"status\":\"" << (row[4] ? row[4] : "") << "\""
             << ",\"compile_error\":\"" << esc(row[5]) << "\""
             << ",\"total_time\":" << (row[6] ? row[6] : "0")
             << ",\"total_memory\":" << (row[7] ? row[7] : "0")
             << ",\"passed_count\":" << (row[8] ? row[8] : "0")
             << ",\"total_count\":" << (row[9] ? row[9] : "0")
             << ",\"detail_json\":" << (row[10] ? row[10] : "[]")
             << ",\"created_at\":\"" << (row[11] ? row[11] : "") << "\""
             << ",\"title\":\"" << esc(row[12]) << "\""
             << "}";
        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });
}
