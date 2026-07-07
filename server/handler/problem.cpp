#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/json_extract.hpp"
#include <sstream>

void register_problem_routes(httplib::Server& svr) {
    svr.Get("/api/problems", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        db->query("SELECT q.id, q.display_index, q.title, q.difficulty, q.time_limit, q.memory_limit, "
                  "COUNT(s.id) AS submit_count, "
                  "SUM(CASE WHEN s.status='AC' THEN 1 ELSE 0 END) AS accepted_count, "
                  "COUNT(DISTINCT CASE WHEN s.status='AC' THEN s.user_id ELSE NULL END) AS accepted_users "
                  "FROM questions q "
                  "LEFT JOIN submissions s ON s.question_id=q.id "
                  "WHERE q.is_visible=1 "
                  "GROUP BY q.id "
                  "ORDER BY q.display_index ASC, q.id ASC");
        MYSQL_RES* result = db->store_result();

        std::string json = "[";
        bool first = true;
        MYSQL_ROW row;
        if (result) {
            while ((row = mysql_fetch_row(result))) {
                if (!first) json += ",";
                first = false;
                int submit_count = row[6] ? std::stoi(row[6]) : 0;
                int accepted_count = row[7] ? std::stoi(row[7]) : 0;
                int rate = submit_count > 0 ? accepted_count * 100 / submit_count : 0;
                json += "{\"id\":" + std::string(row[0]) +
                        ",\"display_index\":" + std::string(row[1] ? row[1] : "0") +
                        ",\"title\":\"" + json_escape(row[2] ? row[2] : "") + "\"" +
                        ",\"difficulty\":\"" + (row[3] ? std::string(row[3]) : "简单") + "\"" +
                        ",\"time_limit\":" + std::string(row[4] ? row[4] : "1") +
                        ",\"memory_limit\":" + std::string(row[5] ? row[5] : "256") +
                        ",\"submit_count\":" + std::to_string(submit_count) +
                        ",\"accepted_count\":" + std::to_string(accepted_count) +
                        ",\"accepted_users\":" + std::string(row[8] ? row[8] : "0") +
                        ",\"acceptance_rate\":" + std::to_string(rate) + "}";
            }
        }
        json += "]";
        if (result) mysql_free_result(result);
        res.set_content(json, "application/json");
    });

    svr.Get("/api/problem-sets", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        struct BuiltinSet { const char* id; const char* title; const char* desc; const char* difficulty; };
        BuiltinSet sets[] = {
            {"all", "全部题目训练", "按题号顺序完成整站题库", ""},
            {"easy", "入门训练", "适合熟悉语法和基础输入输出", "简单"},
            {"medium", "进阶训练", "覆盖常见算法和综合思维", "中等"},
            {"hard", "挑战训练", "高难题集中突破", "困难"}
        };

        auto db = g_db->acquire();
        std::ostringstream json;
        json << "[";
        for (size_t i = 0; i < sizeof(sets) / sizeof(sets[0]); ++i) {
            std::string filter = sets[i].difficulty[0] ? " AND q.difficulty='" + db->escape(sets[i].difficulty) + "'" : "";
            db->query("SELECT COUNT(q.id), "
                      "SUM(CASE WHEN EXISTS(SELECT 1 FROM submissions s WHERE s.question_id=q.id AND s.user_id=" + std::to_string(user.id) + " AND s.status='AC') THEN 1 ELSE 0 END) "
                      "FROM questions q WHERE q.is_visible=1" + filter);
            MYSQL_RES* result = db->store_result();
            MYSQL_ROW row = result ? mysql_fetch_row(result) : nullptr;
            if (i > 0) json << ",";
            json << "{\"id\":\"" << sets[i].id << "\""
                 << ",\"title\":\"" << sets[i].title << "\""
                 << ",\"description\":\"" << sets[i].desc << "\""
                 << ",\"difficulty\":\"" << sets[i].difficulty << "\""
                 << ",\"total_count\":" << (row && row[0] ? row[0] : "0")
                 << ",\"solved_count\":" << (row && row[1] ? row[1] : "0") << "}";
            if (result) mysql_free_result(result);
        }
        json << "]";
        res.set_content(json.str(), "application/json");
    });

    svr.Get(R"(/api/problem-sets/([A-Za-z0-9_-]+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        std::string set_id = req.matches[1];
        std::string title = "全部题目训练";
        std::string description = "按题号顺序完成整站题库";
        std::string difficulty;
        if (set_id == "easy") {
            title = "入门训练";
            description = "适合熟悉语法和基础输入输出";
            difficulty = "简单";
        } else if (set_id == "medium") {
            title = "进阶训练";
            description = "覆盖常见算法和综合思维";
            difficulty = "中等";
        } else if (set_id == "hard") {
            title = "挑战训练";
            description = "高难题集中突破";
            difficulty = "困难";
        } else if (set_id != "all") {
            res.status = 404;
            res.set_content("{\"error\":\"题单不存在\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        std::string filter = difficulty.empty() ? "" : " AND q.difficulty='" + db->escape(difficulty) + "'";
        db->query("SELECT q.id, q.display_index, q.title, q.difficulty, q.time_limit, q.memory_limit, "
                  "COUNT(s.id) AS submit_count, "
                  "SUM(CASE WHEN s.status='AC' THEN 1 ELSE 0 END) AS accepted_count, "
                  "EXISTS(SELECT 1 FROM submissions us WHERE us.question_id=q.id AND us.user_id=" + std::to_string(user.id) + " AND us.status='AC') AS solved "
                  "FROM questions q "
                  "LEFT JOIN submissions s ON s.question_id=q.id "
                  "WHERE q.is_visible=1" + filter + " "
                  "GROUP BY q.id "
                  "ORDER BY q.display_index ASC, q.id ASC");
        MYSQL_RES* result = db->store_result();

        std::ostringstream json;
        json << "{\"id\":\"" << json_escape(set_id) << "\""
             << ",\"title\":\"" << json_escape(title) << "\""
             << ",\"description\":\"" << json_escape(description) << "\""
             << ",\"difficulty\":\"" << json_escape(difficulty) << "\""
             << ",\"problems\":[";
        bool first = true;
        MYSQL_ROW row;
        while (result && (row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            int submit_count = row[6] ? std::stoi(row[6]) : 0;
            int accepted_count = row[7] ? std::stoi(row[7]) : 0;
            int rate = submit_count > 0 ? accepted_count * 100 / submit_count : 0;
            json << "{\"id\":" << (row[0] ? row[0] : "0")
                 << ",\"display_index\":" << (row[1] ? row[1] : "0")
                 << ",\"title\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                 << ",\"difficulty\":\"" << (row[3] ? row[3] : "简单") << "\""
                 << ",\"time_limit\":" << (row[4] ? row[4] : "1")
                 << ",\"memory_limit\":" << (row[5] ? row[5] : "256")
                 << ",\"submit_count\":" << submit_count
                 << ",\"accepted_count\":" << accepted_count
                 << ",\"acceptance_rate\":" << rate
                 << ",\"solved\":" << (row[8] && std::string(row[8]) == "1" ? "true" : "false") << "}";
        }
        if (result) mysql_free_result(result);
        json << "]}";
        res.set_content(json.str(), "application/json");
    });

    svr.Get(R"(/api/problems/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        int id = std::stoi(req.matches[1]);
        auto db = g_db->acquire();
        std::string visibility = user.is_admin ? "" : " AND is_visible=1";
        db->query("SELECT q.id, q.display_index, q.title, q.description, q.input_format, q.output_format, "
                  "q.sample_input, q.sample_output, q.difficulty, q.time_limit, q.memory_limit, "
                  "COUNT(s.id) AS submit_count, "
                  "SUM(CASE WHEN s.status='AC' THEN 1 ELSE 0 END) AS accepted_count, "
                  "COUNT(DISTINCT CASE WHEN s.status='AC' THEN s.user_id ELSE NULL END) AS accepted_users "
                  "FROM questions q "
                  "LEFT JOIN submissions s ON s.question_id=q.id "
                  "WHERE q.id=" + std::to_string(id) + (user.is_admin ? "" : " AND q.is_visible=1") +
                  " GROUP BY q.id");

        MYSQL_RES* result = db->store_result();
        if (!result || mysql_num_rows(result) == 0) {
            if (result) mysql_free_result(result);
            res.status = 404;
            res.set_content("{\"error\":\"Problem not found\"}", "application/json");
            return;
        }

        MYSQL_ROW row = mysql_fetch_row(result);
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

        int submit_count = row[11] ? std::stoi(row[11]) : 0;
        int accepted_count = row[12] ? std::stoi(row[12]) : 0;
        int rate = submit_count > 0 ? accepted_count * 100 / submit_count : 0;
        std::string json = "{\"id\":" + std::string(row[0]) +
                           ",\"display_index\":" + std::string(row[1] ? row[1] : "0") +
                           ",\"title\":\"" + esc(row[2]) + "\"" +
                           ",\"description\":\"" + esc(row[3]) + "\"" +
                           ",\"input_format\":\"" + esc(row[4]) + "\"" +
                           ",\"output_format\":\"" + esc(row[5]) + "\"" +
                           ",\"sample_input\":\"" + esc(row[6]) + "\"" +
                           ",\"sample_output\":\"" + esc(row[7]) + "\"" +
                           ",\"difficulty\":\"" + (row[8] ? std::string(row[8]) : "简单") + "\"" +
                           ",\"time_limit\":" + std::string(row[9] ? row[9] : "1") +
                           ",\"memory_limit\":" + std::string(row[10] ? row[10] : "256") +
                           ",\"submit_count\":" + std::to_string(submit_count) +
                           ",\"accepted_count\":" + std::to_string(accepted_count) +
                           ",\"accepted_users\":" + std::string(row[13] ? row[13] : "0") +
                           ",\"acceptance_rate\":" + std::to_string(rate) + "}";
        mysql_free_result(result);
        res.set_content(json, "application/json");
    });
}
