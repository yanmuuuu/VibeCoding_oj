#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/json_extract.hpp"
#include <sstream>
#include <map>
#include <vector>

static std::string handle_comment_like(AuthUser user, const std::string& target_type, int target_id) {
    auto db = g_db->acquire();
    try {
        db->query("INSERT INTO comment_likes (user_id, target_type, target_id) VALUES (" +
                  std::to_string(user.id) + ", '" + target_type + "', " + std::to_string(target_id) + ")");
        if (target_type == "comment")
            db->query("UPDATE problem_comments SET like_count=like_count+1 WHERE id=" + std::to_string(target_id));
        else
            db->query("UPDATE comment_replies SET like_count=like_count+1 WHERE id=" + std::to_string(target_id));
        return "{\"liked\":true}";
    } catch (...) {
        db->query("DELETE FROM comment_likes WHERE user_id=" + std::to_string(user.id) +
                  " AND target_type='" + target_type + "' AND target_id=" + std::to_string(target_id));
        if (target_type == "comment")
            db->query("UPDATE problem_comments SET like_count=GREATEST(like_count-1,0) WHERE id=" + std::to_string(target_id));
        else
            db->query("UPDATE comment_replies SET like_count=GREATEST(like_count-1,0) WHERE id=" + std::to_string(target_id));
        return "{\"liked\":false}";
    }
}

void register_comment_routes(httplib::Server& svr) {
    svr.Get(R"(/api/problems/(\d+)/comments)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int qid = std::stoi(req.matches[1]);
        int page = 1, page_size = 20;
        if (req.has_param("page")) try { page = std::stoi(req.get_param_value("page")); } catch (...) {}
        if (req.has_param("page_size")) try { page_size = std::stoi(req.get_param_value("page_size")); } catch (...) {}
        int offset = (page - 1) * page_size;

        auto db = g_db->acquire();
        db->query(
            "SELECT c.id, c.user_id, u.username, u.avatar_url, c.content, c.like_count, c.created_at, "
            "EXISTS(SELECT 1 FROM comment_likes WHERE user_id=" + std::to_string(user.id) +
            " AND target_type='comment' AND target_id=c.id) AS liked "
            "FROM problem_comments c JOIN users u ON c.user_id=u.id "
            "WHERE c.question_id=" + std::to_string(qid) +
            " ORDER BY c.id DESC LIMIT " + std::to_string(page_size) + " OFFSET " + std::to_string(offset)
        );
        MYSQL_RES* cres = db->store_result();

        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW crow;
        while ((crow = mysql_fetch_row(cres))) {
            { if (!first) json << ","; } first = false;
            int cid = crow[0] ? std::stoi(crow[0]) : 0;
            json << "{"
                 << "\"id\":" << cid
                 << ",\"user_id\":" << (crow[1] ? crow[1] : "0")
                 << ",\"username\":\"" << json_escape(crow[2] ? crow[2] : "") << "\""
                 << ",\"avatar_url\":\"" << json_escape(crow[3] ? crow[3] : "") << "\""
                 << ",\"content\":\"" << json_escape(crow[4] ? crow[4] : "") << "\""
                 << ",\"like_count\":" << (crow[5] ? crow[5] : "0")
                 << ",\"created_at\":\"" << (crow[6] ? crow[6] : "") << "\""
                 << ",\"liked_by_me\":" << (crow[7] && std::string(crow[7]) == "1" ? "true" : "false");

            db->query(
                "SELECT r.id, r.user_id, u.username, u.avatar_url, r.content, r.like_count, r.parent_reply_id, r.created_at, "
                "EXISTS(SELECT 1 FROM comment_likes WHERE user_id=" + std::to_string(user.id) +
                " AND target_type='reply' AND target_id=r.id) AS liked "
                "FROM comment_replies r JOIN users u ON r.user_id=u.id "
                "WHERE r.comment_id=" + std::to_string(cid) + " ORDER BY r.id ASC"
            );
            MYSQL_RES* rres = db->store_result();
            json << ",\"replies\":[";
            bool firstR = true;
            MYSQL_ROW rrow;
            while ((rrow = mysql_fetch_row(rres))) {
                { if (!firstR) json << ","; } firstR = false;
                int pr = rrow[6] ? std::stoi(rrow[6]) : 0;
                json << "{"
                     << "\"id\":" << (rrow[0] ? rrow[0] : "0")
                     << ",\"user_id\":" << (rrow[1] ? rrow[1] : "0")
                     << ",\"username\":\"" << json_escape(rrow[2] ? rrow[2] : "") << "\""
                     << ",\"avatar_url\":\"" << json_escape(rrow[3] ? rrow[3] : "") << "\""
                     << ",\"content\":\"" << json_escape(rrow[4] ? rrow[4] : "") << "\""
                     << ",\"like_count\":" << (rrow[5] ? rrow[5] : "0")
                     << ",\"parent_reply_id\":" << (pr > 0 ? std::to_string(pr) : "null")
                     << ",\"created_at\":\"" << (rrow[7] ? rrow[7] : "") << "\""
                     << ",\"liked_by_me\":" << (rrow[8] && std::string(rrow[8]) == "1" ? "true" : "false")
                     << "}";
            }
            json << "]}";
            mysql_free_result(rres);
        }
        json << "]";
        mysql_free_result(cres);
        res.set_content(json.str(), "application/json");
    });

    svr.Post(R"(/api/problems/(\d+)/comments)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int qid = std::stoi(req.matches[1]);
        std::string content = extract_json_string(req.body, "content");
        if (content.empty()) { res.status = 400; res.set_content("{\"error\":\"内容不能为空\"}", "application/json"); return; }
        auto db = g_db->acquire();
        db->query("INSERT INTO problem_comments (question_id, user_id, content) VALUES (" +
                  std::to_string(qid) + ", " + std::to_string(user.id) + ", '" + db->escape(content) + "')");
        int id = db->last_insert_id();
        std::ostringstream json;
        json << "{\"id\":" << id << ",\"ok\":true}";
        res.status = 201;
        res.set_content(json.str(), "application/json");
    });

    svr.Post(R"(/api/problems/(\d+)/comments/(\d+)/replies)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int cid = std::stoi(req.matches[2]);
        std::string content = extract_json_string(req.body, "content");
        if (content.empty()) { res.status = 400; res.set_content("{\"error\":\"内容不能为空\"}", "application/json"); return; }
        int parent_id = 0;
        try {
            std::string ps = extract_json_string(req.body, "parent_reply_id");
            if (!ps.empty()) parent_id = std::stoi(ps);
        } catch (...) {}
        auto db = g_db->acquire();
        db->query("INSERT INTO comment_replies (comment_id, user_id, parent_reply_id, content) VALUES (" +
                  std::to_string(cid) + ", " + std::to_string(user.id) + ", " +
                  (parent_id > 0 ? std::to_string(parent_id) : "NULL") + ", '" + db->escape(content) + "')");
        int rid = db->last_insert_id();
        std::ostringstream json;
        json << "{\"id\":" << rid << ",\"ok\":true}";
        res.status = 201;
        res.set_content(json.str(), "application/json");
    });

    svr.Delete(R"(/api/problems/(\d+)/comments/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int cid = std::stoi(req.matches[2]);
        auto db = g_db->acquire();
        if (!user.is_admin) {
            db->query("SELECT user_id FROM problem_comments WHERE id=" + std::to_string(cid));
            MYSQL_RES* r = db->store_result();
            if (!r || mysql_num_rows(r) == 0) { if (r) mysql_free_result(r); res.status = 404; res.set_content("{\"error\":\"评论不存在\"}", "application/json"); return; }
            MYSQL_ROW row = mysql_fetch_row(r);
            if (!row[0] || std::stoi(row[0]) != user.id) { mysql_free_result(r); res.status = 403; res.set_content("{\"error\":\"无权删除\"}", "application/json"); return; }
            mysql_free_result(r);
        }
        db->query("DELETE FROM problem_comments WHERE id=" + std::to_string(cid));
        res.set_content("{\"ok\":true}", "application/json");
    });

    svr.Delete(R"(/api/problems/(\d+)/comments/(\d+)/replies/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int rid = std::stoi(req.matches[3]);
        auto db = g_db->acquire();
        if (!user.is_admin) {
            db->query("SELECT user_id FROM comment_replies WHERE id=" + std::to_string(rid));
            MYSQL_RES* r = db->store_result();
            if (!r || mysql_num_rows(r) == 0) { if (r) mysql_free_result(r); res.status = 404; res.set_content("{\"error\":\"回复不存在\"}", "application/json"); return; }
            MYSQL_ROW row = mysql_fetch_row(r);
            if (!row[0] || std::stoi(row[0]) != user.id) { mysql_free_result(r); res.status = 403; res.set_content("{\"error\":\"无权删除\"}", "application/json"); return; }
            mysql_free_result(r);
        }
        db->query("DELETE FROM comment_replies WHERE id=" + std::to_string(rid));
        res.set_content("{\"ok\":true}", "application/json");
    });

    svr.Post(R"(/api/problems/(\d+)/comments/(\d+)/like)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int cid = std::stoi(req.matches[2]);
        res.set_content(handle_comment_like(user, "comment", cid), "application/json");
    });

    svr.Delete(R"(/api/problems/(\d+)/comments/(\d+)/like)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int cid = std::stoi(req.matches[2]);
        auto db = g_db->acquire();
        db->query("DELETE FROM comment_likes WHERE user_id=" + std::to_string(user.id) + " AND target_type='comment' AND target_id=" + std::to_string(cid));
        db->query("UPDATE problem_comments SET like_count=GREATEST(like_count-1,0) WHERE id=" + std::to_string(cid));
        res.set_content("{\"ok\":true}", "application/json");
    });

    svr.Post(R"(/api/problems/(\d+)/comments/(\d+)/replies/(\d+)/like)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int rid = std::stoi(req.matches[3]);
        res.set_content(handle_comment_like(user, "reply", rid), "application/json");
    });

    svr.Delete(R"(/api/problems/(\d+)/comments/(\d+)/replies/(\d+)/like)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) { res.status = 401; res.set_content("{\"error\":\"未登录\"}", "application/json"); return; }
        int rid = std::stoi(req.matches[3]);
        auto db = g_db->acquire();
        db->query("DELETE FROM comment_likes WHERE user_id=" + std::to_string(user.id) + " AND target_type='reply' AND target_id=" + std::to_string(rid));
        db->query("UPDATE comment_replies SET like_count=GREATEST(like_count-1,0) WHERE id=" + std::to_string(rid));
        res.set_content("{\"ok\":true}", "application/json");
    });
}
