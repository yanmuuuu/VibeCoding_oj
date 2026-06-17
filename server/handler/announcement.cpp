#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/json_extract.hpp"
#include <sstream>

void register_announcement_routes(httplib::Server& svr) {
    // Public: list all announcements (no auth)
    svr.Get("/api/announcements", [](const httplib::Request& req, httplib::Response& res) {
        auto db = g_db->acquire();
        db->query("SELECT id, title, content, is_pinned, created_at FROM announcements ORDER BY is_pinned DESC, id DESC");
        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        if (result) {
            while ((row = mysql_fetch_row(result))) {
                if (!first) json << ",";
                first = false;
                json << "{\"id\":" << (row[0] ? row[0] : "0")
                     << ",\"title\":\"" << json_escape(row[1] ? row[1] : "") << "\""
                     << ",\"content\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                     << ",\"is_pinned\":" << (row[3] && std::stoi(row[3]) ? "true" : "false")
                     << ",\"created_at\":\"" << (row[4] ? row[4] : "") << "\""
                     << "}";
            }
        }
        json << "]";
        if (result) mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    // Admin: list announcements
    svr.Get("/api/admin/announcements", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        if (!user.is_admin) { res.status = 403; res.set_content("{\"error\":\"需要管理员权限\"}", "application/json"); return; }

        auto db = g_db->acquire();
        db->query("SELECT id, title, content, is_pinned, created_at FROM announcements ORDER BY id DESC");
        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        if (result) {
            while ((row = mysql_fetch_row(result))) {
                if (!first) json << ",";
                first = false;
                json << "{\"id\":" << (row[0] ? row[0] : "0")
                     << ",\"title\":\"" << json_escape(row[1] ? row[1] : "") << "\""
                     << ",\"content\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                     << ",\"is_pinned\":" << (row[3] && std::stoi(row[3]) ? "true" : "false")
                     << ",\"created_at\":\"" << (row[4] ? row[4] : "") << "\""
                     << "}";
            }
        }
        json << "]";
        if (result) mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    // Admin: create announcement
    svr.Post("/api/admin/announcements", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        if (!user.is_admin) { res.status = 403; res.set_content("{\"error\":\"需要管理员权限\"}", "application/json"); return; }

        std::string title = extract_json_string(req.body, "title");
        std::string content = extract_json_string(req.body, "content");
        bool is_pinned = extract_json_bool(req.body, "is_pinned");

        if (title.empty() || content.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"标题和内容不能为空\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        std::ostringstream sql;
        sql << "INSERT INTO announcements (title, content, is_pinned) VALUES ('"
            << db->escape(title) << "', '"
            << db->escape(content) << "', "
            << (is_pinned ? 1 : 0) << ")";
        db->query(sql.str());
        res.status = 201;
        res.set_content("{\"ok\":true,\"id\":" + std::to_string(db->last_insert_id()) + "}", "application/json");
    });

    // Admin: edit announcement
    svr.Put(R"(/api/admin/announcements/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        if (!user.is_admin) { res.status = 403; res.set_content("{\"error\":\"需要管理员权限\"}", "application/json"); return; }

        int id = std::stoi(req.matches[1]);
        std::string title = extract_json_string(req.body, "title");
        std::string content = extract_json_string(req.body, "content");
        bool is_pinned = extract_json_bool(req.body, "is_pinned");

        auto db = g_db->acquire();
        std::ostringstream sql;
        sql << "UPDATE announcements SET ";
        bool first = true;
        if (!title.empty()) {
            sql << "title='" << db->escape(title) << "'";
            first = false;
        }
        if (!content.empty()) {
            if (!first) sql << ", ";
            sql << "content='" << db->escape(content) << "'";
            first = false;
        }
        {
            if (!first) sql << ", ";
            sql << "is_pinned=" << (is_pinned ? 1 : 0);
        }
        sql << " WHERE id=" << id;
        db->query(sql.str());
        res.set_content("{\"ok\":true}", "application/json");
    });

    // Admin: delete announcement
    svr.Delete(R"(/api/admin/announcements/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        if (!user.is_admin) { res.status = 403; res.set_content("{\"error\":\"需要管理员权限\"}", "application/json"); return; }

        int id = std::stoi(req.matches[1]);
        auto db = g_db->acquire();
        db->query("DELETE FROM announcements WHERE id=" + std::to_string(id));
        res.set_content("{\"ok\":true}", "application/json");
    });
}
