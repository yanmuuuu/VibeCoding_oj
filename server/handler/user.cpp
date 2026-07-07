#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/json_extract.hpp"
#include <sstream>

void register_user_routes(httplib::Server& svr) {
    svr.Get("/api/user/profile", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }
        std::string bg_url = "null";
        std::string av_url = "null";
        auto db = g_db->acquire();
        db->query("SELECT background_url, avatar_url FROM users WHERE id=" + std::to_string(user.id));
        MYSQL_RES* result = db->store_result();
        if (result) {
            MYSQL_ROW row = mysql_fetch_row(result);
            if (row) {
                if (row[0]) {
                    bg_url = "\"" + json_escape(row[0]) + "\"";
                }
                if (row[1]) {
                    av_url = "\"" + json_escape(row[1]) + "\"";
                }
            }
            mysql_free_result(result);
        }
        res.set_content("{\"id\":" + std::to_string(user.id) +
                        ",\"username\":\"" + json_escape(user.username) + "\"" +
                        ",\"is_admin\":" + (user.is_admin ? "true" : "false") +
                        ",\"background_url\":" + bg_url +
                        ",\"avatar_url\":" + av_url + "}",
                        "application/json");
    });

    svr.Get("/api/user/submissions", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        int page = 1;
        int per_page = 20;
        if (req.has_param("page")) {
            try { page = std::stoi(req.get_param_value("page")); } catch (...) { page = 1; }
        }
        if (req.has_param("per_page")) {
            try { per_page = std::stoi(req.get_param_value("per_page")); } catch (...) { per_page = 20; }
        }
        int offset = (page - 1) * per_page;

        auto db = g_db->acquire();
        db->query("SELECT s.id, s.question_id, q.title, q.difficulty, s.status, "
                  "s.total_time, s.total_memory, s.created_at "
                  "FROM submissions s JOIN questions q ON s.question_id = q.id "
                  "WHERE s.user_id=" + std::to_string(user.id) +
                  " ORDER BY s.id DESC LIMIT " + std::to_string(per_page) +
                  " OFFSET " + std::to_string(offset));

        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        while ((row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            json << "{\"id\":" << row[0]
                 << ",\"question_id\":" << row[1]
                 << ",\"title\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                 << ",\"difficulty\":\"" << (row[3] ? row[3] : "简单") << "\""
                 << ",\"status\":\"" << (row[4] ? row[4] : "") << "\""
                 << ",\"total_time\":" << (row[5] ? row[5] : "0")
                 << ",\"total_memory\":" << (row[6] ? row[6] : "0")
                 << ",\"created_at\":\"" << (row[7] ? row[7] : "") << "\""
                 << "}";
        }
        json << "]";
        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    svr.Get(R"(/api/user/ac-code/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        int question_id = std::stoi(req.matches[1]);
        auto db = g_db->acquire();
        db->query("SELECT code FROM submissions WHERE user_id=" + std::to_string(user.id) +
                  " AND question_id=" + std::to_string(question_id) +
                  " AND status='AC' ORDER BY id DESC LIMIT 1");

        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        if (result && mysql_num_rows(result) > 0) {
            MYSQL_ROW row = mysql_fetch_row(result);
            json << "{\"found\":true,\"code\":\"" << json_escape(row[0] ? row[0] : "") << "\"}";
        } else {
            json << "{\"found\":false,\"code\":\"\"}";
        }
        if (result) mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    svr.Get(R"(/api/user/ac-codes/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        int question_id = std::stoi(req.matches[1]);
        auto db = g_db->acquire();
        db->query("SELECT id, code, total_time, total_memory, created_at "
                  "FROM submissions WHERE user_id=" + std::to_string(user.id) +
                  " AND question_id=" + std::to_string(question_id) +
                  " AND status='AC' ORDER BY id DESC");

        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        while (result && (row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            json << "{\"id\":" << (row[0] ? row[0] : "0")
                 << ",\"code\":\"" << json_escape(row[1] ? row[1] : "") << "\""
                 << ",\"total_time\":" << (row[2] ? row[2] : "0")
                 << ",\"total_memory\":" << (row[3] ? row[3] : "0")
                 << ",\"created_at\":\"" << (row[4] ? row[4] : "") << "\""
                 << "}";
        }
        json << "]";
        if (result) mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    svr.Get("/api/user/problem-status", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        db->query(
            "SELECT q.id, q.title, q.difficulty, "
            "EXISTS(SELECT 1 FROM submissions s2 WHERE s2.question_id=q.id AND s2.user_id=" + std::to_string(user.id) + " AND s2.status='AC') AS solved, "
            "COUNT(s.id) AS attempt_count "
            "FROM questions q "
            "JOIN submissions s ON q.id = s.question_id AND s.user_id=" + std::to_string(user.id) + " "
            "GROUP BY q.id "
            "ORDER BY solved DESC, q.id ASC"
        );

        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        while (result && (row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            json << "{\"id\":" << (row[0] ? row[0] : "0")
                 << ",\"title\":\"" << json_escape(row[1] ? row[1] : "") << "\""
                 << ",\"difficulty\":\"" << (row[2] ? row[2] : "简单") << "\""
                 << ",\"solved\":" << (row[3] && std::string(row[3]) == "1" ? "true" : "false")
                 << ",\"attempt_count\":" << (row[4] ? row[4] : "0")
                 << "}";
        }
        json << "]";
        if (result) mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    svr.Get("/api/user/progress", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        std::ostringstream json;
        json << "{\"difficulty\":[";

        db->query("SELECT q.difficulty, COUNT(q.id) AS total_count, "
                  "SUM(CASE WHEN EXISTS(SELECT 1 FROM submissions s WHERE s.question_id=q.id AND s.user_id=" + std::to_string(user.id) + " AND s.status='AC') THEN 1 ELSE 0 END) AS solved_count "
                  "FROM questions q WHERE q.is_visible=1 GROUP BY q.difficulty "
                  "ORDER BY FIELD(q.difficulty,'简单','中等','困难')");
        MYSQL_RES* result = db->store_result();
        bool first = true;
        MYSQL_ROW row;
        while (result && (row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            json << "{\"difficulty\":\"" << (row[0] ? row[0] : "简单") << "\""
                 << ",\"total_count\":" << (row[1] ? row[1] : "0")
                 << ",\"solved_count\":" << (row[2] ? row[2] : "0") << "}";
        }
        if (result) mysql_free_result(result);

        json << "],\"heatmap\":[";
        db->query("SELECT DATE(created_at) AS d, COUNT(*) "
                  "FROM submissions WHERE user_id=" + std::to_string(user.id) +
                  " AND created_at >= DATE_SUB(CURDATE(), INTERVAL 364 DAY) "
                  "GROUP BY DATE(created_at) ORDER BY d ASC");
        result = db->store_result();
        first = true;
        while (result && (row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            json << "{\"date\":\"" << (row[0] ? row[0] : "") << "\""
                 << ",\"count\":" << (row[1] ? row[1] : "0") << "}";
        }
        if (result) mysql_free_result(result);

        json << "],\"wrongbook\":[";
        db->query("SELECT q.id, q.display_index, q.title, q.difficulty, COUNT(s.id) AS attempt_count, "
                  "(SELECT s2.status FROM submissions s2 WHERE s2.user_id=" + std::to_string(user.id) + " AND s2.question_id=q.id ORDER BY s2.id DESC LIMIT 1) AS last_status, "
                  "MAX(s.created_at) AS last_submit_at "
                  "FROM questions q JOIN submissions s ON s.question_id=q.id AND s.user_id=" + std::to_string(user.id) + " "
                  "WHERE q.is_visible=1 "
                  "GROUP BY q.id "
                  "HAVING SUM(CASE WHEN s.status='AC' THEN 1 ELSE 0 END)=0 "
                  "ORDER BY last_submit_at DESC LIMIT 30");
        result = db->store_result();
        first = true;
        while (result && (row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            json << "{\"id\":" << (row[0] ? row[0] : "0")
                 << ",\"display_index\":" << (row[1] ? row[1] : "0")
                 << ",\"title\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                 << ",\"difficulty\":\"" << (row[3] ? row[3] : "简单") << "\""
                 << ",\"attempt_count\":" << (row[4] ? row[4] : "0")
                 << ",\"last_status\":\"" << (row[5] ? row[5] : "") << "\""
                 << ",\"last_submit_at\":\"" << (row[6] ? row[6] : "") << "\"}";
        }
        if (result) mysql_free_result(result);

        json << "]}";
        res.set_content(json.str(), "application/json");
    });
}
