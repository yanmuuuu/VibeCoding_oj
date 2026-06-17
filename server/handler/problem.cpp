#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/json_extract.hpp"

void register_problem_routes(httplib::Server& svr) {
    svr.Get("/api/problems", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        db->query("SELECT id, title, difficulty, time_limit, memory_limit FROM questions WHERE is_visible=1 ORDER BY id ASC");
        MYSQL_RES* result = db->store_result();

        std::string json = "[";
        bool first = true;
        MYSQL_ROW row;
        if (result) {
            while ((row = mysql_fetch_row(result))) {
                if (!first) json += ",";
                first = false;
                json += "{\"id\":" + std::string(row[0]) +
                        ",\"title\":\"" + json_escape(row[1] ? row[1] : "") + "\"" +
                        ",\"difficulty\":\"" + (row[2] ? std::string(row[2]) : "简单") + "\"" +
                        ",\"time_limit\":" + std::string(row[3] ? row[3] : "1") +
                        ",\"memory_limit\":" + std::string(row[4] ? row[4] : "256") + "}";
            }
        }
        json += "]";
        if (result) mysql_free_result(result);
        res.set_content(json, "application/json");
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
        db->query("SELECT id, title, description, input_format, output_format, "
                  "sample_input, sample_output, difficulty, time_limit, memory_limit "
                  "FROM questions WHERE id=" + std::to_string(id) + visibility);

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

        std::string json = "{\"id\":" + std::string(row[0]) +
                           ",\"title\":\"" + esc(row[1]) + "\"" +
                           ",\"description\":\"" + esc(row[2]) + "\"" +
                           ",\"input_format\":\"" + esc(row[3]) + "\"" +
                           ",\"output_format\":\"" + esc(row[4]) + "\"" +
                           ",\"sample_input\":\"" + esc(row[5]) + "\"" +
                           ",\"sample_output\":\"" + esc(row[6]) + "\"" +
                           ",\"difficulty\":\"" + (row[7] ? std::string(row[7]) : "简单") + "\"" +
                           ",\"time_limit\":" + std::string(row[8] ? row[8] : "1") +
                           ",\"memory_limit\":" + std::string(row[9] ? row[9] : "256") + "}";
        mysql_free_result(result);
        res.set_content(json, "application/json");
    });
}
