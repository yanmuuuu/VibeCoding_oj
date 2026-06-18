#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/json_extract.hpp"
#include <sstream>
#include <algorithm>

void register_message_routes(httplib::Server& svr) {
    // 获取当前用户的会话列表
    svr.Get("/api/messages/conversations", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        std::string uid = std::to_string(user.id);
        db->query(
            "SELECT c.id, "
            "  CASE WHEN c.user1_id=" + uid + " THEN c.user2_id ELSE c.user1_id END AS peer_id, "
            "  pu.username AS peer_username, pu.avatar_url AS peer_avatar, "
            "  c.last_message_at, "
            "  (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id!=" + uid + " AND m.is_read=0) AS unread_count, "
            "  (SELECT CASE WHEN m2.is_recalled=1 THEN '[已撤回]' ELSE LEFT(m2.content, 50) END FROM messages m2 WHERE m2.conversation_id=c.id ORDER BY m2.created_at DESC LIMIT 1) AS last_msg, "
            "  (SELECT m2.created_at FROM messages m2 WHERE m2.conversation_id=c.id ORDER BY m2.created_at DESC LIMIT 1) AS last_msg_time "
            "FROM conversations c "
            "JOIN users pu ON (CASE WHEN c.user1_id=" + uid + " THEN c.user2_id ELSE c.user1_id END)=pu.id "
            "WHERE c.user1_id=" + uid + " OR c.user2_id=" + uid + " "
            "ORDER BY c.last_message_at DESC"
        );

        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        while ((row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            json << "{"
                 << "\"id\":" << (row[0] ? row[0] : "0")
                 << ",\"peer_id\":" << (row[1] ? row[1] : "0")
                 << ",\"peer_username\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                 << ",\"peer_avatar\":\"" << json_escape(row[3] ? row[3] : "") << "\""
                 << ",\"last_message_at\":\"" << (row[4] ? row[4] : "") << "\""
                 << ",\"unread_count\":" << (row[5] ? row[5] : "0")
                 << ",\"last_msg\":\"" << json_escape(row[6] ? row[6] : "") << "\""
                 << ",\"last_msg_time\":\"" << (row[7] ? row[7] : "") << "\""
                 << "}";
        }
        json << "]";
        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    // 获取/创建与指定用户的会话
    svr.Post("/api/messages/conversations", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        int peer_id = extract_json_int(req.body, "peer_id");
        if (peer_id <= 0 || peer_id == user.id) {
            res.status = 400;
            res.set_content("{\"error\":\"无效的用户ID\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        std::string uid = std::to_string(user.id);
        std::string pid = std::to_string(peer_id);

        // 确保 user1_id < user2_id
        int u1 = std::min(user.id, peer_id);
        int u2 = std::max(user.id, peer_id);

        // 检查对方是否存在
        db->query("SELECT id FROM users WHERE id=" + pid + " AND is_banned=0");
        MYSQL_RES* checkRes = db->store_result();
        if (!checkRes || mysql_num_rows(checkRes) == 0) {
            if (checkRes) mysql_free_result(checkRes);
            res.status = 404;
            res.set_content("{\"error\":\"用户不存在或已被封禁\"}", "application/json");
            return;
        }
        mysql_free_result(checkRes);

        // 查找已有会话或创建新会话
        db->query(
            "SELECT id FROM conversations WHERE user1_id=" + std::to_string(u1) +
            " AND user2_id=" + std::to_string(u2)
        );
        MYSQL_RES* convRes = db->store_result();
        int conv_id = 0;
        MYSQL_ROW crow = mysql_fetch_row(convRes);
        if (crow && crow[0]) {
            conv_id = std::stoi(crow[0]);
        }
        mysql_free_result(convRes);

        if (conv_id == 0) {
            db->query(
                "INSERT INTO conversations (user1_id, user2_id) VALUES (" +
                std::to_string(u1) + "," + std::to_string(u2) + ")"
            );
            conv_id = db->last_insert_id();
        }

        std::ostringstream json;
        json << "{\"id\":" << conv_id << ",\"ok\":true}";
        res.status = 201;
        res.set_content(json.str(), "application/json");
    });

    // 获取会话消息列表（分页）
    svr.Get(R"(/api/messages/conversations/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        int conv_id = std::stoi(req.matches[1]);
        auto db = g_db->acquire();
        std::string uid = std::to_string(user.id);

        // 验证用户属于此会话
        db->query(
            "SELECT id FROM conversations WHERE id=" + std::to_string(conv_id) +
            " AND (user1_id=" + uid + " OR user2_id=" + uid + ")"
        );
        MYSQL_RES* checkRes = db->store_result();
        if (!checkRes || mysql_num_rows(checkRes) == 0) {
            if (checkRes) mysql_free_result(checkRes);
            res.status = 403;
            res.set_content("{\"error\":\"无权访问此会话\"}", "application/json");
            return;
        }
        mysql_free_result(checkRes);

        int page = 1, page_size = 50;
        if (req.has_param("page")) try { page = std::stoi(req.get_param_value("page")); } catch (...) {}
        if (req.has_param("page_size")) try { page_size = std::stoi(req.get_param_value("page_size")); } catch (...) {}
        int offset = (page - 1) * page_size;

        db->query(
            "SELECT m.id, m.sender_id, u.username, u.avatar_url, m.content, m.is_read, m.is_recalled, m.created_at, "
            "CASE WHEN m.sender_id=" + uid + " AND m.is_recalled=0 AND TIMESTAMPDIFF(SECOND, m.created_at, NOW()) <= 60 "
            "THEN 1 ELSE 0 END AS can_recall "
            "FROM messages m JOIN users u ON m.sender_id=u.id "
            "WHERE m.conversation_id=" + std::to_string(conv_id) + " "
            "ORDER BY m.created_at DESC "
            "LIMIT " + std::to_string(page_size) + " OFFSET " + std::to_string(offset)
        );

        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        while ((row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            json << "{"
                 << "\"id\":" << (row[0] ? row[0] : "0")
                 << ",\"sender_id\":" << (row[1] ? row[1] : "0")
                 << ",\"username\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                 << ",\"avatar_url\":\"" << json_escape(row[3] ? row[3] : "") << "\""
                 << ",\"content\":\"" << json_escape(row[4] ? row[4] : "") << "\""
                 << ",\"is_read\":" << (row[5] && std::string(row[5]) == "1" ? "true" : "false")
                 << ",\"is_recalled\":" << (row[6] && std::string(row[6]) == "1" ? "true" : "false")
                 << ",\"created_at\":\"" << (row[7] ? row[7] : "") << "\""
                 << ",\"is_me\":" << (row[1] && std::string(row[1]) == uid ? "true" : "false")
                 << ",\"can_recall\":" << (row[8] && std::string(row[8]) == "1" ? "true" : "false")
                 << "}";
        }
        json << "]";
        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    // 发送消息
    svr.Post(R"(/api/messages/conversations/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        int conv_id = std::stoi(req.matches[1]);
        std::string content = extract_json_string(req.body, "content");
        if (content.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"消息内容不能为空\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        std::string uid = std::to_string(user.id);

        // 验证用户属于此会话
        db->query(
            "SELECT id FROM conversations WHERE id=" + std::to_string(conv_id) +
            " AND (user1_id=" + uid + " OR user2_id=" + uid + ")"
        );
        MYSQL_RES* checkRes = db->store_result();
        if (!checkRes || mysql_num_rows(checkRes) == 0) {
            if (checkRes) mysql_free_result(checkRes);
            res.status = 403;
            res.set_content("{\"error\":\"无权访问此会话\"}", "application/json");
            return;
        }
        mysql_free_result(checkRes);

        db->query(
            "INSERT INTO messages (conversation_id, sender_id, content) VALUES (" +
            std::to_string(conv_id) + "," + uid + ",'" + db->escape(content) + "')"
        );
        int msg_id = db->last_insert_id();

        // 更新会话最后消息时间
        db->query("UPDATE conversations SET last_message_at=NOW() WHERE id=" + std::to_string(conv_id));

        std::ostringstream json;
        json << "{\"id\":" << msg_id << ",\"ok\":true}";
        res.status = 201;
        res.set_content(json.str(), "application/json");
    });

    // 获取未读消息总数
    svr.Get("/api/messages/unread-count", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        std::string uid = std::to_string(user.id);
        db->query(
            "SELECT COUNT(*) FROM messages m "
            "JOIN conversations c ON m.conversation_id=c.id "
            "WHERE (c.user1_id=" + uid + " OR c.user2_id=" + uid + ") "
            "AND m.sender_id!=" + uid + " AND m.is_read=0"
        );

        MYSQL_RES* result = db->store_result();
        MYSQL_ROW row = mysql_fetch_row(result);
        int count = (row && row[0]) ? std::stoi(row[0]) : 0;
        mysql_free_result(result);

        res.set_content("{\"count\":" + std::to_string(count) + "}", "application/json");
    });

    // 标记会话所有消息为已读
    svr.Post(R"(/api/messages/read/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        int conv_id = std::stoi(req.matches[1]);
        auto db = g_db->acquire();
        std::string uid = std::to_string(user.id);

        db->query(
            "UPDATE messages SET is_read=1 "
            "WHERE conversation_id=" + std::to_string(conv_id) +
            " AND sender_id!=" + uid + " AND is_read=0"
        );

        res.set_content("{\"ok\":true}", "application/json");
    });

    // 撤回消息（发送后 60 秒内，仅发送者）
    svr.Post(R"(/api/messages/recall/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        int msg_id = std::stoi(req.matches[1]);
        auto db = g_db->acquire();
        std::string uid = std::to_string(user.id);

        db->query(
            "SELECT m.id, m.conversation_id FROM messages m "
            "JOIN conversations c ON m.conversation_id=c.id "
            "WHERE m.id=" + std::to_string(msg_id) +
            " AND m.sender_id=" + uid +
            " AND m.is_recalled=0 "
            " AND TIMESTAMPDIFF(SECOND, m.created_at, NOW()) <= 60 "
            " AND (c.user1_id=" + uid + " OR c.user2_id=" + uid + ")"
        );
        MYSQL_RES* checkRes = db->store_result();
        if (!checkRes || mysql_num_rows(checkRes) == 0) {
            if (checkRes) mysql_free_result(checkRes);
            res.status = 400;
            res.set_content("{\"error\":\"无法撤回：非本人消息、已撤回或已超过 1 分钟\"}", "application/json");
            return;
        }
        MYSQL_ROW row = mysql_fetch_row(checkRes);
        int conv_id = row[1] ? std::stoi(row[1]) : 0;
        mysql_free_result(checkRes);

        db->query(
            "UPDATE messages SET content='', is_recalled=1 WHERE id=" + std::to_string(msg_id)
        );

        std::ostringstream json;
        json << "{\"ok\":true,\"conversation_id\":" << conv_id << "}";
        res.set_content(json.str(), "application/json");
    });

    // 搜索用户（用于发起私信）
    svr.Get("/api/messages/search-users", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        std::string q = req.get_param_value("q");
        if (q.empty()) {
            res.set_content("[]", "application/json");
            return;
        }

        auto db = g_db->acquire();
        db->query(
            "SELECT id, username, avatar_url FROM users "
            "WHERE username LIKE '%" + db->escape(q) + "%' "
            "AND id!=" + std::to_string(user.id) + " AND is_banned=0 "
            "LIMIT 20"
        );

        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        while ((row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            json << "{"
                 << "\"id\":" << (row[0] ? row[0] : "0")
                 << ",\"username\":\"" << json_escape(row[1] ? row[1] : "") << "\""
                 << ",\"avatar_url\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                 << "}";
        }
        json << "]";
        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });
}
