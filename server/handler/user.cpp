#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include <sstream>

void register_user_routes(httplib::Server& svr) {
    svr.Get("/api/user/profile", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"Not authenticated\"}", "application/json");
            return;
        }
        res.set_content("{\"id\":" + std::to_string(user.id) +
                        ",\"username\":\"" + user.username + "\"" +
                        ",\"is_admin\":" + (user.is_admin ? "true" : "false") + "}",
                        "application/json");
    });

    svr.Get("/api/user/submissions", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"Not authenticated\"}", "application/json");
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
        db->query("SELECT s.id, s.question_id, q.title, s.status, "
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
                 << ",\"title\":\"" << (row[2] ? row[2] : "") << "\""
                 << ",\"status\":\"" << (row[3] ? row[3] : "") << "\""
                 << ",\"total_time\":" << (row[4] ? row[4] : "0")
                 << ",\"total_memory\":" << (row[5] ? row[5] : "0")
                 << ",\"created_at\":\"" << (row[6] ? row[6] : "") << "\""
                 << "}";
        }
        json << "]";
        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });
}
