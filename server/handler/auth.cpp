#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/crypto.hpp"
#include "../util/json_extract.hpp"
#include <string>

void register_auth_routes(httplib::Server& svr) {
    svr.Post("/api/register", [](const httplib::Request& req, httplib::Response& res) {
        try {
            if (req.body.empty()) {
                res.status = 400;
                res.set_content("{\"error\":\"Request body is empty\"}", "application/json");
                return;
            }
            std::string username = extract_json_string(req.body, "username");
            std::string password = extract_json_string(req.body, "password");

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

            ValidationResult v = validate_password(username, password);
            if (!v.valid) {
                res.status = 400;
                res.set_content("{\"error\":\"" + json_escape(v.error) + "\"}", "application/json");
                return;
            }

            auto db = g_db->acquire();
            std::string escaped_user = db->escape(username);

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
            try {
                db->query("INSERT INTO users (username, password_hash) VALUES ('" +
                          escaped_user + "', '" + escaped_hash + "')");
            } catch (const std::exception& e) {
                std::string err = e.what();
                if (err.find("Duplicate") != std::string::npos ||
                    err.find("duplicate") != std::string::npos) {
                    res.status = 409;
                    res.set_content("{\"error\":\"Username already exists\"}", "application/json");
                } else {
                    res.status = 500;
                    res.set_content("{\"error\":\"" + json_escape(err) + "\"}", "application/json");
                }
                return;
            }

            res.status = 201;
            res.set_content("{\"ok\":true}", "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content("{\"error\":\"" + json_escape(std::string(e.what())) + "\"}", "application/json");
        } catch (...) {
            res.status = 500;
            res.set_content("{\"error\":\"Internal Server Error\"}", "application/json");
        }
    });

    svr.Post("/api/login", [](const httplib::Request& req, httplib::Response& res) {
        try {
            if (req.body.empty()) {
                res.status = 400;
                res.set_content("{\"error\":\"Request body is empty\"}", "application/json");
                return;
            }
            std::string username = extract_json_string(req.body, "username");
            std::string password = extract_json_string(req.body, "password");

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
            std::string db_username = row[1] ? row[1] : "";
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

            res.set_header("Set-Cookie", "token=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400");

            std::string resp = "{\"ok\":true,\"username\":\"" + json_escape(db_username) +
                               "\",\"is_admin\":" + (is_admin ? "true" : "false") + "}";
            res.set_content(resp, "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content("{\"error\":\"" + json_escape(std::string(e.what())) + "\"}", "application/json");
        } catch (...) {
            res.status = 500;
            res.set_content("{\"error\":\"Internal Server Error\"}", "application/json");
        }
    });

    svr.Post("/api/logout", [](const httplib::Request& req, httplib::Response& res) {
        try {
            AuthUser user = authenticate(req);
            if (!user.valid) {
                res.status = 401;
                res.set_content("{\"error\":\"Not authenticated\"}", "application/json");
                return;
            }

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
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content("{\"error\":\"" + json_escape(std::string(e.what())) + "\"}", "application/json");
        } catch (...) {
            res.status = 500;
            res.set_content("{\"error\":\"Internal Server Error\"}", "application/json");
        }
    });
}
