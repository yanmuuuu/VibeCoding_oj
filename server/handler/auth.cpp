#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/crypto.hpp"
#include <string>

void register_auth_routes(httplib::Server& svr) {
    svr.Post("/api/register", [](const httplib::Request& req, httplib::Response& res) {
        std::string username;
        std::string password;
        // Parse JSON body
        auto body = req.body;
        auto extract = [&body](const std::string& key) -> std::string {
            std::string search = "\"" + key + "\":\"";
            auto pos = body.find(search);
            if (pos == std::string::npos) {
                search = "\"" + key + "\": \"";
                pos = body.find(search);
            }
            if (pos == std::string::npos) return "";
            pos += search.size();
            auto end = body.find("\"", pos);
            if (end == std::string::npos) return "";
            return body.substr(pos, end - pos);
        };
        username = extract("username");
        password = extract("password");

        if (username.empty() || password.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"Username and password required\"}", "application/json");
            return;
        }
        if (username.size() > 64) {
            res.status = 400;
            res.set_content("{\"error\":\"Username too long\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        std::string escaped_user = db->escape(username);

        // Check if username exists
        db->query("SELECT id FROM users WHERE username='" + escaped_user + "'");
        MYSQL_RES* check = db->store_result();
        if (check && mysql_num_rows(check) > 0) {
            mysql_free_result(check);
            res.status = 409;
            res.set_content("{\"error\":\"Username already exists\"}", "application/json");
            return;
        }
        if (check) mysql_free_result(check);

        std::string hash;
        try {
            hash = hash_password(password);
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content("{\"error\":\"Password hashing failed\"}", "application/json");
            return;
        }

        std::string escaped_hash = db->escape(hash);
        db->query("INSERT INTO users (username, password_hash) VALUES ('" +
                  escaped_user + "', '" + escaped_hash + "')");

        res.status = 201;
        res.set_content("{\"ok\":true}", "application/json");
    });

    svr.Post("/api/login", [](const httplib::Request& req, httplib::Response& res) {
        std::string username, password;
        auto body = req.body;
        auto extract = [&body](const std::string& key) -> std::string {
            std::string search = "\"" + key + "\":\"";
            auto pos = body.find(search);
            if (pos == std::string::npos) {
                search = "\"" + key + "\": \"";
                pos = body.find(search);
            }
            if (pos == std::string::npos) return "";
            pos += search.size();
            auto end = body.find("\"", pos);
            if (end == std::string::npos) return "";
            return body.substr(pos, end - pos);
        };
        username = extract("username");
        password = extract("password");

        if (username.empty() || password.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"Username and password required\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        std::string escaped = db->escape(username);
        db->query("SELECT id, username, password_hash, is_admin FROM users WHERE username='" + escaped + "'");
        MYSQL_RES* result = db->store_result();
        if (!result || mysql_num_rows(result) == 0) {
            if (result) mysql_free_result(result);
            res.status = 401;
            res.set_content("{\"error\":\"Invalid username or password\"}", "application/json");
            return;
        }

        MYSQL_ROW row = mysql_fetch_row(result);
        int user_id = std::stoi(row[0]);
        std::string hash = row[2] ? row[2] : "";
        bool is_admin = row[3] ? std::stoi(row[3]) : 0;
        mysql_free_result(result);

        if (!verify_password(password, hash)) {
            res.status = 401;
            res.set_content("{\"error\":\"Invalid username or password\"}", "application/json");
            return;
        }

        std::string token = generate_token(32);
        std::string escaped_token = db->escape(token);
        db->query("INSERT INTO sessions (user_id, token) VALUES (" +
                  std::to_string(user_id) + ", '" + escaped_token + "')");

        // Set cookie
        res.set_header("Set-Cookie", "token=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400");

        std::string resp = "{\"ok\":true,\"username\":\"" + std::string(row[1] ? row[1] : "") +
                           "\",\"is_admin\":" + (is_admin ? "true" : "false") + "}";
        res.set_content(resp, "application/json");
    });

    svr.Post("/api/logout", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"Not authenticated\"}", "application/json");
            return;
        }

        // Extract token
        auto it = req.headers.find("Cookie");
        if (it != req.headers.end()) {
            const std::string& cookie = it->second;
            size_t pos = cookie.find("token=");
            if (pos != std::string::npos) {
                pos += 6;
                size_t end = cookie.find(';', pos);
                if (end == std::string::npos) end = cookie.size();
                std::string token = cookie.substr(pos, end - pos);
                auto db = g_db->acquire();
                db->query("DELETE FROM sessions WHERE token='" + db->escape(token) + "'");
            }
        }

        res.set_header("Set-Cookie", "token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
        res.set_content("{\"ok\":true}", "application/json");
    });
}
