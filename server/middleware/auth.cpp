#include "auth.hpp"
#include "../db/pool.hpp"
#include "../util/logger.hpp"
#include <cstring>
#include <sstream>

static std::string extract_token(const httplib::Request& req) {
    auto it = req.headers.find("Cookie");
    if (it == req.headers.end()) return "";
    const std::string& cookie = it->second;
    const char* key = "token=";
    size_t pos = cookie.find(key);
    if (pos == std::string::npos) return "";
    pos += strlen(key);
    size_t end = cookie.find(';', pos);
    if (end == std::string::npos) end = cookie.size();
    return cookie.substr(pos, end - pos);
}

AuthUser authenticate(const httplib::Request& req) {
    AuthUser u;
    u.valid = false;
    std::string token = extract_token(req);
    if (token.empty()) {
        LOG_DEBUG("Auth failed: no token in request");
        return u;
    }
    auto db = g_db->acquire();
    std::string sql = "SELECT u.id, u.username, u.is_admin, u.is_banned FROM sessions s "
                      "JOIN users u ON s.user_id = u.id WHERE s.token = '" +
                      db->escape(token) + "'";
    db->query(sql);
    MYSQL_RES* res = db->store_result();
    if (!res) {
        LOG_DEBUG("Auth failed: session query returned null");
        return u;
    }
    MYSQL_ROW row = mysql_fetch_row(res);
    if (row) {
        if (row[3] && std::stoi(row[3]) != 0) {
            mysql_free_result(res);
            LOG_WARNING("Auth rejected: banned user id=" + std::string(row[0] ? row[0] : "?") + " attempted access");
            return u;
        }
        if (!row[0]) {
            mysql_free_result(res);
            LOG_WARNING("Auth rejected: null user_id in session");
            return u;
        }
        u.id = std::stoi(row[0]);
        u.username = row[1] ? row[1] : "";
        u.is_admin = row[2] ? (std::stoi(row[2]) != 0) : false;
        u.valid = true;
        LOG_DEBUG("Auth success: user_id=" + std::to_string(u.id) + " username=" + u.username + " admin=" + (u.is_admin ? "true" : "false"));
    }
    mysql_free_result(res);
    return u;
}
