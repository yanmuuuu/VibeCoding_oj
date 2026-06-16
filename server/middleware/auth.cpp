#include "auth.hpp"
#include "../db/pool.hpp"
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
    if (token.empty()) return u;
    auto db = g_db->acquire();
    std::string sql = "SELECT u.id, u.username, u.is_admin FROM sessions s "
                      "JOIN users u ON s.user_id = u.id WHERE s.token = '" +
                      db->escape(token) + "'";
    db->query(sql);
    MYSQL_RES* res = db->store_result();
    if (!res) return u;
    MYSQL_ROW row = mysql_fetch_row(res);
    if (row) {
        u.id = std::stoi(row[0]);
        u.username = row[1] ? row[1] : "";
        u.is_admin = row[2] ? (std::stoi(row[2]) != 0) : false;
        u.valid = true;
    }
    mysql_free_result(res);
    return u;
}
