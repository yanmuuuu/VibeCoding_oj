#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/json_extract.hpp"
#include <sstream>

void register_discussion_routes(httplib::Server& svr) {
    svr.Get("/api/discussions", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }
        int page = 1, page_size = 20;
        if (req.has_param("page")) try { page = std::stoi(req.get_param_value("page")); } catch (...) {}
        if (req.has_param("page_size")) try { page_size = std::stoi(req.get_param_value("page_size")); } catch (...) {}
        int offset = (page - 1) * page_size;

        auto db = g_db->acquire();
        db->query(
            "SELECT d.id, d.user_id, u.username, u.avatar_url, d.content, d.like_count, d.created_at, "
            "(SELECT COUNT(*) FROM discussion_replies WHERE discussion_id=d.id) AS reply_count, "
            "EXISTS(SELECT 1 FROM discussion_likes WHERE user_id=" + std::to_string(user.id) +
            " AND target_type='discussion' AND target_id=d.id) AS liked "
            "FROM discussions d JOIN users u ON d.user_id=u.id "
            "ORDER BY d.id DESC LIMIT " + std::to_string(page_size) + " OFFSET " + std::to_string(offset)
        );
        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        while ((row = mysql_fetch_row(result))) {
            { if (!first) json << ","; } first = false;
            json << "{"
                 << "\"id\":" << (row[0] ? row[0] : "0")
                 << ",\"user_id\":" << (row[1] ? row[1] : "0")
                 << ",\"username\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                 << ",\"avatar_url\":\"" << json_escape(row[3] ? row[3] : "") << "\""
                 << ",\"content\":\"" << json_escape(row[4] ? row[4] : "") << "\""
                 << ",\"like_count\":" << (row[5] ? row[5] : "0")
                 << ",\"created_at\":\"" << (row[6] ? row[6] : "") << "\""
                 << ",\"reply_count\":" << (row[7] ? row[7] : "0")
                 << ",\"liked_by_me\":" << (row[8] && std::string(row[8]) == "1" ? "true" : "false")
                 << "}";
        }
        json << "]";
        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    svr.Post("/api/discussions", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        std::string content = extract_json_string(req.body, "content");
        if (content.empty()) { res.status = 400; res.set_content("{\"error\":\"内容不能为空\"}", "application/json"); return; }
        auto db = g_db->acquire();
        db->query("INSERT INTO discussions (user_id, content) VALUES (" + std::to_string(user.id) + ", '" + db->escape(content) + "')");
        int id = db->last_insert_id();
        std::ostringstream json;
        json << "{\"id\":" << id << ",\"ok\":true}";
        res.status = 201;
        res.set_content(json.str(), "application/json");
    });

    svr.Get(R"(/api/discussions/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int id = std::stoi(req.matches[1]);
        auto db = g_db->acquire();

        db->query(
            "SELECT d.id, d.user_id, u.username, u.avatar_url, d.content, d.like_count, d.created_at, "
            "EXISTS(SELECT 1 FROM discussion_likes WHERE user_id=" + std::to_string(user.id) +
            " AND target_type='discussion' AND target_id=d.id) AS liked "
            "FROM discussions d JOIN users u ON d.user_id=u.id WHERE d.id=" + std::to_string(id)
        );
        MYSQL_RES* dres = db->store_result();
        if (!dres || mysql_num_rows(dres) == 0) {
            if (dres) mysql_free_result(dres);
            res.status = 404;
            res.set_content("{\"error\":\"帖子不存在\"}", "application/json");
            return;
        }
        MYSQL_ROW drow = mysql_fetch_row(dres);

        db->query(
            "SELECT r.id, r.user_id, u.username, u.avatar_url, r.content, r.like_count, r.parent_reply_id, r.created_at, "
            "EXISTS(SELECT 1 FROM discussion_likes WHERE user_id=" + std::to_string(user.id) +
            " AND target_type='reply' AND target_id=r.id) AS liked "
            "FROM discussion_replies r JOIN users u ON r.user_id=u.id "
            "WHERE r.discussion_id=" + std::to_string(id) + " ORDER BY r.id ASC"
        );
        MYSQL_RES* rres = db->store_result();

        std::ostringstream json;
        json << "{"
             << "\"id\":" << (drow[0] ? drow[0] : "0")
             << ",\"user_id\":" << (drow[1] ? drow[1] : "0")
             << ",\"username\":\"" << json_escape(drow[2] ? drow[2] : "") << "\""
             << ",\"avatar_url\":\"" << json_escape(drow[3] ? drow[3] : "") << "\""
             << ",\"content\":\"" << json_escape(drow[4] ? drow[4] : "") << "\""
             << ",\"like_count\":" << (drow[5] ? drow[5] : "0")
             << ",\"created_at\":\"" << (drow[6] ? drow[6] : "") << "\""
             << ",\"liked_by_me\":" << (drow[7] && std::string(drow[7]) == "1" ? "true" : "false");

        std::vector<std::string> replyJsons;
        MYSQL_ROW rrow;
        while ((rrow = mysql_fetch_row(rres))) {
            int rid = rrow[0] ? std::stoi(rrow[0]) : 0;
            std::ostringstream rj;
            rj << "{"
               << "\"id\":" << rid
               << ",\"user_id\":" << (rrow[1] ? rrow[1] : "0")
               << ",\"username\":\"" << json_escape(rrow[2] ? rrow[2] : "") << "\""
               << ",\"avatar_url\":\"" << json_escape(rrow[3] ? rrow[3] : "") << "\""
               << ",\"content\":\"" << json_escape(rrow[4] ? rrow[4] : "") << "\""
               << ",\"like_count\":" << (rrow[5] ? rrow[5] : "0")
               << ",\"parent_reply_id\":" << (rrow[6] ? rrow[6] : "null")
               << ",\"created_at\":\"" << (rrow[7] ? rrow[7] : "") << "\""
               << ",\"liked_by_me\":" << (rrow[8] && std::string(rrow[8]) == "1" ? "true" : "false")
               << "}";
            replyJsons.push_back(rj.str());
        }

        json << ",\"replies\":[";
        for (size_t i = 0; i < replyJsons.size(); i++) {
            if (i > 0) json << ",";
            json << replyJsons[i];
        }
        json << "]}";

        mysql_free_result(rres);
        mysql_free_result(dres);
        res.set_content(json.str(), "application/json");
    });

    svr.Delete(R"(/api/discussions/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int id = std::stoi(req.matches[1]);
        auto db = g_db->acquire();
        if (!user.is_admin) {
            db->query("SELECT user_id FROM discussions WHERE id=" + std::to_string(id));
            MYSQL_RES* r = db->store_result();
            if (!r || mysql_num_rows(r) == 0) {
                if (r) mysql_free_result(r);
                res.status = 404; res.set_content("{\"error\":\"帖子不存在\"}", "application/json"); return;
            }
            MYSQL_ROW row = mysql_fetch_row(r);
            if (!row[0] || std::stoi(row[0]) != user.id) {
                mysql_free_result(r);
                res.status = 403; res.set_content("{\"error\":\"无权删除\"}", "application/json"); return;
            }
            mysql_free_result(r);
        }
        db->query("DELETE FROM discussions WHERE id=" + std::to_string(id));
        res.set_content("{\"ok\":true}", "application/json");
    });

    auto handleLike = [](AuthUser user, const std::string& target_type, int target_id, const std::string& table_prefix) -> std::string {
        auto db = g_db->acquire();
        std::string likeTable = table_prefix + "_likes";
        std::string mainTable = (target_type == "discussion" || target_type == "comment") ? table_prefix + "s" : table_prefix + "_replies";
        std::string countCol = (target_type == "discussion" || target_type == "comment") ? "discussions" : "discussion_replies";
        if (table_prefix == "comment") countCol = (target_type == "comment") ? "problem_comments" : "comment_replies";

        try {
            db->query("INSERT INTO " + likeTable + " (user_id, target_type, target_id) VALUES (" +
                      std::to_string(user.id) + ", '" + target_type + "', " + std::to_string(target_id) + ")");
            // Insert succeeded — user liked
            if (target_type == "discussion")
                db->query("UPDATE discussions SET like_count=like_count+1 WHERE id=" + std::to_string(target_id));
            else if (target_type == "reply")
                db->query("UPDATE discussion_replies SET like_count=like_count+1 WHERE id=" + std::to_string(target_id));
            else if (target_type == "comment")
                db->query("UPDATE problem_comments SET like_count=like_count+1 WHERE id=" + std::to_string(target_id));
            else
                db->query("UPDATE comment_replies SET like_count=like_count+1 WHERE id=" + std::to_string(target_id));
            return "{\"liked\":true}";
        } catch (...) {
            // Already liked — unlike
            db->query("DELETE FROM " + likeTable + " WHERE user_id=" + std::to_string(user.id) +
                      " AND target_type='" + target_type + "' AND target_id=" + std::to_string(target_id));
            if (target_type == "discussion")
                db->query("UPDATE discussions SET like_count=GREATEST(like_count-1,0) WHERE id=" + std::to_string(target_id));
            else if (target_type == "reply")
                db->query("UPDATE discussion_replies SET like_count=GREATEST(like_count-1,0) WHERE id=" + std::to_string(target_id));
            else if (target_type == "comment")
                db->query("UPDATE problem_comments SET like_count=GREATEST(like_count-1,0) WHERE id=" + std::to_string(target_id));
            else
                db->query("UPDATE comment_replies SET like_count=GREATEST(like_count-1,0) WHERE id=" + std::to_string(target_id));
            return "{\"liked\":false}";
        }
    };

    svr.Post(R"(/api/discussions/(\d+)/like)", [&](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int id = std::stoi(req.matches[1]);
        res.set_content(handleLike(user, "discussion", id, "discussion"), "application/json");
    });

    svr.Delete(R"(/api/discussions/(\d+)/like)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int id = std::stoi(req.matches[1]);
        auto db = g_db->acquire();
        db->query("DELETE FROM discussion_likes WHERE user_id=" + std::to_string(user.id) +
                  " AND target_type='discussion' AND target_id=" + std::to_string(id));
        db->query("UPDATE discussions SET like_count=GREATEST(like_count-1,0) WHERE id=" + std::to_string(id));
        res.set_content("{\"ok\":true}", "application/json");
    });

    svr.Post(R"(/api/discussions/(\d+)/replies)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int did = std::stoi(req.matches[1]);
        std::string content = extract_json_string(req.body, "content");
        if (content.empty()) { res.status = 400; res.set_content("{\"error\":\"内容不能为空\"}", "application/json"); return; }
        int parent_id = 0;
        try {
            std::string ps = extract_json_string(req.body, "parent_reply_id");
            if (!ps.empty()) parent_id = std::stoi(ps);
        } catch (...) {}

        auto db = g_db->acquire();
        db->query("SELECT id FROM discussions WHERE id=" + std::to_string(did));
        MYSQL_RES* check = db->store_result();
        if (!check || mysql_num_rows(check) == 0) {
            if (check) mysql_free_result(check);
            res.status = 404; res.set_content("{\"error\":\"帖子不存在\"}", "application/json"); return;
        }
        mysql_free_result(check);

        if (parent_id > 0) {
            db->query("SELECT id FROM discussion_replies WHERE id=" + std::to_string(parent_id) + " AND discussion_id=" + std::to_string(did));
            MYSQL_RES* pc = db->store_result();
            if (!pc || mysql_num_rows(pc) == 0) {
                if (pc) mysql_free_result(pc);
                res.status = 400; res.set_content("{\"error\":\"父回复不存在\"}", "application/json"); return;
            }
            mysql_free_result(pc);
        }

        db->query("INSERT INTO discussion_replies (discussion_id, user_id, parent_reply_id, content) VALUES (" +
                  std::to_string(did) + ", " + std::to_string(user.id) + ", " +
                  (parent_id > 0 ? std::to_string(parent_id) : "NULL") + ", '" + db->escape(content) + "')");
        int rid = db->last_insert_id();
        std::ostringstream json;
        json << "{\"id\":" << rid << ",\"ok\":true}";
        res.status = 201;
        res.set_content(json.str(), "application/json");
    });

    svr.Delete(R"(/api/discussions/(\d+)/replies/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int rid = std::stoi(req.matches[2]);
        auto db = g_db->acquire();
        if (!user.is_admin) {
            db->query("SELECT user_id FROM discussion_replies WHERE id=" + std::to_string(rid));
            MYSQL_RES* r = db->store_result();
            if (!r || mysql_num_rows(r) == 0) {
                if (r) mysql_free_result(r);
                res.status = 404; res.set_content("{\"error\":\"回复不存在\"}", "application/json"); return;
            }
            MYSQL_ROW row = mysql_fetch_row(r);
            if (!row[0] || std::stoi(row[0]) != user.id) {
                mysql_free_result(r);
                res.status = 403; res.set_content("{\"error\":\"无权删除\"}", "application/json"); return;
            }
            mysql_free_result(r);
        }
        db->query("DELETE FROM discussion_replies WHERE id=" + std::to_string(rid));
        res.set_content("{\"ok\":true}", "application/json");
    });

    svr.Post(R"(/api/discussions/(\d+)/replies/(\d+)/like)", [&](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int rid = std::stoi(req.matches[2]);
        res.set_content(handleLike(user, "reply", rid, "discussion"), "application/json");
    });

    svr.Delete(R"(/api/discussions/(\d+)/replies/(\d+)/like)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int rid = std::stoi(req.matches[2]);
        auto db = g_db->acquire();
        db->query("DELETE FROM discussion_likes WHERE user_id=" + std::to_string(user.id) +
                  " AND target_type='reply' AND target_id=" + std::to_string(rid));
        db->query("UPDATE discussion_replies SET like_count=GREATEST(like_count-1,0) WHERE id=" + std::to_string(rid));
        res.set_content("{\"ok\":true}", "application/json");
    });
}
