#include <httplib.h>
#include "../config.hpp"
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/json_extract.hpp"
#include <string>
#include <vector>
#include <filesystem>
#include <fstream>
#include <ctime>
#include <cstdlib>
#include <algorithm>
#include <cctype>

namespace fs = std::filesystem;

static bool is_image_ext(const std::string& ext) {
    return ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" || ext == ".gif" || ext == ".bmp";
}

static bool is_system_background(const std::string& filename) {
    if (filename.size() > 5 && filename.substr(0, 5) == "user_") {
        return false;
    }
    return true;
}

void register_background_routes(httplib::Server& svr) {
    svr.Get("/api/backgrounds", [](const httplib::Request&, httplib::Response& res) {
        std::string bg_dir = g_config.web_root + "/backgrounds";
        std::vector<std::string> images;
        try {
            if (fs::exists(bg_dir) && fs::is_directory(bg_dir)) {
                for (const auto& entry : fs::directory_iterator(bg_dir)) {
                    if (entry.is_regular_file()) {
                        std::string fname = entry.path().filename().string();
                        std::string ext = entry.path().extension().string();
                        std::transform(ext.begin(), ext.end(), ext.begin(),
                                       [](unsigned char c) { return std::tolower(c); });
                        if (is_image_ext(ext) && is_system_background(fname)) {
                            images.push_back("/backgrounds/" + fname);
                        }
                    }
                }
            }
        } catch (...) {}

        std::string json = "[";
        for (size_t i = 0; i < images.size(); i++) {
            if (i > 0) json += ",";
            json += "\"" + images[i] + "\"";
        }
        json += "]";
        res.set_content(json, "application/json");
    });

    svr.Post("/api/backgrounds/upload", [](const httplib::Request& req, httplib::Response& res) {
        auto user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        if (!req.has_file("background")) {
            res.status = 400;
            res.set_content("{\"error\":\"未选择文件\"}", "application/json");
            return;
        }

        auto file = req.get_file_value("background");
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

        std::string bg_dir = g_config.web_root + "/backgrounds";
        try {
            if (!fs::exists(bg_dir)) {
                fs::create_directories(bg_dir);
            }
        } catch (...) {
            res.status = 500;
            res.set_content("{\"error\":\"创建目录失败\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();

        std::string old_url;
        db->query("SELECT background_url FROM users WHERE id=" + std::to_string(user.id));
        MYSQL_RES* old_result = db->store_result();
        if (old_result) {
            MYSQL_ROW row = mysql_fetch_row(old_result);
            if (row && row[0]) {
                old_url = row[0];
            }
            mysql_free_result(old_result);
        }

        if (!old_url.empty()) {
            std::string old_path = g_config.web_root + old_url;
            try {
                if (fs::exists(old_path)) {
                    fs::remove(old_path);
                }
            } catch (...) {}
        }

        std::string filename = "user_" + std::to_string(user.id) + ext;
        std::string filepath = bg_dir + "/" + filename;
        std::string url = "/backgrounds/" + filename;

        std::ofstream out(filepath, std::ios::binary);
        if (!out) {
            res.status = 500;
            res.set_content("{\"error\":\"写入文件失败\"}", "application/json");
            return;
        }
        out.write(file.content.data(), static_cast<std::streamsize>(file.content.size()));
        out.close();

        std::string escaped_url = db->escape(url);
        db->query("UPDATE users SET background_url='" + escaped_url + "' WHERE id=" + std::to_string(user.id));

        res.set_content("{\"url\":\"" + url + "\"}", "application/json");
    });

    svr.Post("/api/backgrounds/delete", [](const httplib::Request& req, httplib::Response& res) {
        auto user = authenticate(req);
        if (!user.valid) {
            res.status = 401;
            res.set_content("{\"error\":\"未登录\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();

        std::string old_url;
        db->query("SELECT background_url FROM users WHERE id=" + std::to_string(user.id));
        MYSQL_RES* old_result = db->store_result();
        if (old_result) {
            MYSQL_ROW row = mysql_fetch_row(old_result);
            if (row && row[0]) {
                old_url = row[0];
            }
            mysql_free_result(old_result);
        }

        if (!old_url.empty()) {
            std::string old_path = g_config.web_root + old_url;
            try {
                if (fs::exists(old_path)) {
                    fs::remove(old_path);
                }
            } catch (...) {}
        }

        db->query("UPDATE users SET background_url=NULL WHERE id=" + std::to_string(user.id));

        res.set_content("{\"success\":true}", "application/json");
    });
}
