#include <httplib.h>
#include "../config.hpp"
#include <string>
#include <vector>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <cstdlib>
#include <algorithm>
#include <cctype>
#include <mutex>

namespace fs = std::filesystem;

static std::mutex g_icon_rand_mutex;

static bool is_icon_ext(const std::string& ext) {
    return ext == ".ico" || ext == ".png" || ext == ".jpg" || ext == ".jpeg"
        || ext == ".webp" || ext == ".gif" || ext == ".svg";
}

static std::string icon_mime_type(const std::string& ext) {
    if (ext == ".ico") return "image/x-icon";
    if (ext == ".png") return "image/png";
    if (ext == ".jpg" || ext == ".jpeg") return "image/jpeg";
    if (ext == ".webp") return "image/webp";
    if (ext == ".gif") return "image/gif";
    if (ext == ".svg") return "image/svg+xml";
    return "application/octet-stream";
}

static std::vector<std::string> list_icon_files() {
    std::vector<std::string> icons;
    std::string icon_dir = g_config.web_root + "/icons";
    try {
        if (fs::exists(icon_dir) && fs::is_directory(icon_dir)) {
            for (const auto& entry : fs::directory_iterator(icon_dir)) {
                if (!entry.is_regular_file()) continue;
                std::string fname = entry.path().filename().string();
                std::string ext = entry.path().extension().string();
                std::transform(ext.begin(), ext.end(), ext.begin(),
                               [](unsigned char c) { return std::tolower(c); });
                if (is_icon_ext(ext)) {
                    icons.push_back("/icons/" + fname);
                }
            }
        }
    } catch (...) {}
    std::sort(icons.begin(), icons.end());
    return icons;
}

static bool read_file_binary(const std::string& path, std::string& out) {
    std::ifstream file(path, std::ios::binary);
    if (!file) return false;
    std::ostringstream ss;
    ss << file.rdbuf();
    out = ss.str();
    return true;
}

void register_icon_routes(httplib::Server& svr) {
    svr.Get("/api/icons", [](const httplib::Request&, httplib::Response& res) {
        auto icons = list_icon_files();
        std::string json = "[";
        for (size_t i = 0; i < icons.size(); i++) {
            if (i > 0) json += ",";
            json += "\"" + icons[i] + "\"";
        }
        json += "]";
        res.set_content(json, "application/json");
    });

    svr.Get("/favicon.ico", [](const httplib::Request&, httplib::Response& res) {
        auto icons = list_icon_files();
        if (icons.empty()) {
            res.status = 404;
            return;
        }

        size_t idx;
        {
            std::lock_guard<std::mutex> lock(g_icon_rand_mutex);
            idx = static_cast<size_t>(rand()) % icons.size();
        }
        std::string filepath = g_config.web_root + icons[idx];
        std::string ext = fs::path(filepath).extension().string();
        std::transform(ext.begin(), ext.end(), ext.begin(),
                       [](unsigned char c) { return std::tolower(c); });

        std::string content;
        if (!read_file_binary(filepath, content)) {
            res.status = 404;
            return;
        }

        res.set_content(content, icon_mime_type(ext).c_str());
    });
}
