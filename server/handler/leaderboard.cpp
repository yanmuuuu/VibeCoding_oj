#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/json_extract.hpp"
#include <sstream>

namespace {

const char* kAcStatsJoin =
    "LEFT JOIN ("
    "  SELECT ac.user_id, "
    "    SUM(CASE q.difficulty WHEN '简单' THEN 1 WHEN '中等' THEN 2 WHEN '困难' THEN 3 ELSE 0 END) AS points, "
    "    COUNT(*) AS ac_count "
    "  FROM ("
    "    SELECT user_id, question_id FROM submissions WHERE status='AC' GROUP BY user_id, question_id"
    "  ) ac JOIN questions q ON q.id = ac.question_id "
    "  GROUP BY ac.user_id"
    ") ac_stats ON u.id = ac_stats.user_id "
    "LEFT JOIN ("
    "  SELECT user_id, COUNT(*) AS total_subs FROM submissions GROUP BY user_id"
    ") sub_stats ON u.id = sub_stats.user_id ";

std::string build_ranked_subquery() {
    return std::string(
        "SELECT u.id AS user_id, "
        "ac_stats.points, ac_stats.ac_count, "
        "COALESCE(sub_stats.total_subs, 0) AS total_subs, "
        "ROW_NUMBER() OVER ("
        "  ORDER BY ac_stats.points DESC, ac_stats.ac_count DESC, "
        "  COALESCE(sub_stats.total_subs, 0) ASC, u.created_at ASC"
        ") AS rank_num "
        "FROM users u "
        "INNER JOIN ("
        "  SELECT ac.user_id, "
        "    SUM(CASE q.difficulty WHEN '简单' THEN 1 WHEN '中等' THEN 2 WHEN '困难' THEN 3 ELSE 0 END) AS points, "
        "    COUNT(*) AS ac_count "
        "  FROM ("
        "    SELECT user_id, question_id FROM submissions WHERE status='AC' GROUP BY user_id, question_id"
        "  ) ac JOIN questions q ON q.id = ac.question_id "
        "  GROUP BY ac.user_id"
        ") ac_stats ON u.id = ac_stats.user_id AND ac_stats.points > 0 "
        "LEFT JOIN ("
        "  SELECT user_id, COUNT(*) AS total_subs FROM submissions GROUP BY user_id"
        ") sub_stats ON u.id = sub_stats.user_id "
        "WHERE u.is_banned = 0"
    );
}

} // namespace

void register_leaderboard_routes(httplib::Server& svr) {
    svr.Get("/api/leaderboard", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        db->query(
            "SELECT u.id, u.username, u.avatar_url, "
            "ac_stats.points, ac_stats.ac_count, "
            "COALESCE(sub_stats.total_subs, 0) AS total_subs "
            "FROM users u "
            "INNER JOIN ("
            "  SELECT ac.user_id, "
            "    SUM(CASE q.difficulty WHEN '简单' THEN 1 WHEN '中等' THEN 2 WHEN '困难' THEN 3 ELSE 0 END) AS points, "
            "    COUNT(*) AS ac_count "
            "  FROM ("
            "    SELECT user_id, question_id FROM submissions WHERE status='AC' GROUP BY user_id, question_id"
            "  ) ac JOIN questions q ON q.id = ac.question_id "
            "  GROUP BY ac.user_id "
            "  HAVING points > 0"
            ") ac_stats ON u.id = ac_stats.user_id "
            "LEFT JOIN ("
            "  SELECT user_id, COUNT(*) AS total_subs FROM submissions GROUP BY user_id"
            ") sub_stats ON u.id = sub_stats.user_id "
            "WHERE u.is_banned = 0 "
            "ORDER BY ac_stats.points DESC, ac_stats.ac_count DESC, total_subs ASC, u.created_at ASC "
            "LIMIT 100"
        );

        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        int rank = 0;
        MYSQL_ROW row;
        while ((row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            rank++;
            json << "{"
                 << "\"rank\":" << rank
                 << ",\"user_id\":" << (row[0] ? row[0] : "0")
                 << ",\"username\":\"" << json_escape(row[1] ? row[1] : "") << "\""
                 << ",\"avatar_url\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                 << ",\"points\":" << (row[3] ? row[3] : "0")
                 << ",\"ac_count\":" << (row[4] ? row[4] : "0")
                 << ",\"total_subs\":" << (row[5] ? row[5] : "0")
                 << "}";
        }
        json << "]";
        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    svr.Get("/api/leaderboard/my-rank", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        std::string uid = std::to_string(user.id);
        db->query(
            "SELECT COALESCE(ac_stats.points, 0), COALESCE(ac_stats.ac_count, 0), "
            "COALESCE(sub_stats.total_subs, 0), ranked.rank_num "
            "FROM users u "
            + std::string(kAcStatsJoin) +
            "LEFT JOIN (" + build_ranked_subquery() + ") ranked ON ranked.user_id = u.id "
            "WHERE u.id=" + uid + " AND u.is_banned = 0"
        );

        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        MYSQL_ROW row = mysql_fetch_row(result);
        if (row) {
            int points = row[0] ? std::stoi(row[0]) : 0;
            json << "{\"user_id\":" << uid
                 << ",\"points\":" << points
                 << ",\"ac_count\":" << (row[1] ? row[1] : "0")
                 << ",\"total_subs\":" << (row[2] ? row[2] : "0")
                 << ",\"rank\":";
            if (points > 0 && row[3]) {
                json << row[3];
            } else {
                json << "null";
            }
            json << "}";
        } else {
            json << "{\"user_id\":" << uid << ",\"points\":0,\"ac_count\":0,\"total_subs\":0,\"rank\":null}";
        }
        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    svr.Get(R"(/api/users/(\d+)/public)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser viewer = authenticate(req);
        if (!viewer.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        int target_id = std::stoi(req.matches[1]);
        if (target_id <= 0) {
            res.status = 400;
            res.set_content("{\"error\":\"无效的用户ID\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        db->query(
            "SELECT u.id, u.username, u.avatar_url, "
            "COALESCE(ac_stats.points, 0), COALESCE(ac_stats.ac_count, 0), "
            "COALESCE(sub_stats.total_subs, 0), ranked.rank_num "
            "FROM users u "
            + std::string(kAcStatsJoin) +
            "LEFT JOIN (" + build_ranked_subquery() + ") ranked ON ranked.user_id = u.id "
            "WHERE u.id=" + std::to_string(target_id) + " AND u.is_banned = 0"
        );

        MYSQL_RES* result = db->store_result();
        MYSQL_ROW row = mysql_fetch_row(result);
        if (!row) {
            if (result) mysql_free_result(result);
            res.status = 404;
            res.set_content("{\"error\":\"用户不存在\"}", "application/json");
            return;
        }

        int points = row[3] ? std::stoi(row[3]) : 0;
        std::ostringstream json;
        json << "{\"id\":" << (row[0] ? row[0] : "0")
             << ",\"username\":\"" << json_escape(row[1] ? row[1] : "") << "\""
             << ",\"avatar_url\":\"" << json_escape(row[2] ? row[2] : "") << "\""
             << ",\"points\":" << points
             << ",\"ac_count\":" << (row[4] ? row[4] : "0")
             << ",\"total_subs\":" << (row[5] ? row[5] : "0")
             << ",\"rank\":";
        if (points > 0 && row[6]) {
            json << row[6];
        } else {
            json << "null";
        }
        json << ",\"is_self\":" << (target_id == viewer.id ? "true" : "false") << "}";

        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });
}
