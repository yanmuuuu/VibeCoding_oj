#include <httplib.h>
#include "../config.hpp"
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/json_extract.hpp"
#include <string>
#include <vector>
#include <filesystem>
#include <fstream>
#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <ctime>
#include <mutex>

namespace fs = std::filesystem;

static std::mutex g_avatar_rand_mutex;

static std::string pick_random_default_avatar() {
    std::string avatar_dir = g_config.web_root + "/avatars";
    std::vector<std::string> defaults;
    try {
        if (fs::exists(avatar_dir) && fs::is_directory(avatar_dir)) {
            for (const auto& entry : fs::directory_iterator(avatar_dir)) {
                if (entry.is_regular_file()) {
                    std::string fname = entry.path().filename().string();
                    if (fname.size() >= 3 && fname.substr(0, 2) == "at" && fname.find("user_") == std::string::npos) {
                        std::string ext = entry.path().extension().string();
                        if (ext == ".webp" || ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".svg") {
                            defaults.push_back("/avatars/" + fname);
                        }
                    }
                }
            }
        }
    } catch (...) {}
    if (defaults.empty()) return "/avatars/at1.webp";
    int idx;
    {
        std::lock_guard<std::mutex> lock(g_avatar_rand_mutex);
        idx = rand() % defaults.size();
    }
    return defaults[idx];
}

static bool is_image_ext(const std::string& ext) {
    return ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" || ext == ".gif" || ext == ".bmp";
}

void register_avatar_routes(httplib::Server& svr) {
    svr.Post("/api/user/avatar/upload", [](const httplib::Request& req, httplib::Response& res) {
        auto user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        if (!req.has_file("avatar")) {
            res.status = 400;
            res.set_content("{\"error\":\"未选择文件\"}", "application/json");
            return;
        }

        auto file = req.get_file_value("avatar");
        if (file.filename.empty() || file.content.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"文件为空\"}", "application/json");
            return;
        }

        std::string fname = file.filename;
        std::string ext;
        size_t dot = fname.find_last_of('.');
        if (dot != std::string::npos) {
            ext = fname.substr(dot);
            std::transform(ext.begin(), ext.end(), ext.begin(),
                           [](unsigned char c) { return std::tolower(c); });
        }
        if (!is_image_ext(ext)) {
            res.status = 400;
            res.set_content("{\"error\":\"不支持的图片格式，仅支持 JPG/PNG/WebP/GIF/BMP\"}", "application/json");
            return;
        }

        std::string avatar_dir = g_config.web_root + "/avatars";
        try {
            if (!fs::exists(avatar_dir)) {
                fs::create_directories(avatar_dir);
            }
        } catch (...) {
            res.status = 500;
            res.set_content("{\"error\":\"创建目录失败\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();

        std::string old_url;
        db->query("SELECT avatar_url FROM users WHERE id=" + std::to_string(user.id));
        MYSQL_RES* old_result = db->store_result();
        if (old_result) {
            MYSQL_ROW row = mysql_fetch_row(old_result);
            if (row && row[0]) {
                old_url = row[0];
            }
            mysql_free_result(old_result);
        }

        if (!old_url.empty() && old_url.find("/avatars/user_") == 0) {
            std::string old_path = g_config.web_root + old_url;
            try {
                if (fs::exists(old_path)) {
                    fs::remove(old_path);
                }
            } catch (...) {}
        }

        std::string filename = "user_" + std::to_string(user.id) + ext;
        std::string filepath = avatar_dir + "/" + filename;
        std::string url = "/avatars/" + filename;

        std::ofstream out(filepath, std::ios::binary);
        if (!out) {
            res.status = 500;
            res.set_content("{\"error\":\"写入文件失败\"}", "application/json");
            return;
        }
        out.write(file.content.data(), static_cast<std::streamsize>(file.content.size()));
        out.close();

        std::string escaped_url = db->escape(url);
        db->query("UPDATE users SET avatar_url='" + escaped_url + "' WHERE id=" + std::to_string(user.id));

        res.set_content("{\"url\":\"" + json_escape(url) + "\"}", "application/json");
    });

    svr.Delete("/api/user/avatar", [](const httplib::Request& req, httplib::Response& res) {
        auto user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();

        std::string old_url;
        db->query("SELECT avatar_url FROM users WHERE id=" + std::to_string(user.id));
        MYSQL_RES* old_result = db->store_result();
        if (old_result) {
            MYSQL_ROW row = mysql_fetch_row(old_result);
            if (row && row[0]) {
                old_url = row[0];
            }
            mysql_free_result(old_result);
        }

        if (!old_url.empty() && old_url.find("/avatars/user_") == 0) {
            std::string old_path = g_config.web_root + old_url;
            try {
                if (fs::exists(old_path)) {
                    fs::remove(old_path);
                }
            } catch (...) {}
        }

        std::string default_avatar = pick_random_default_avatar();
        std::string escaped_url = db->escape(default_avatar);
        db->query("UPDATE users SET avatar_url='" + escaped_url + "' WHERE id=" + std::to_string(user.id));

        res.set_content("{\"url\":\"" + json_escape(default_avatar) + "\"}", "application/json");
    });
}
