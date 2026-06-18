#include <httplib.h>
#include <ctemplate/template.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include <csignal>
#include <cstdlib>
#include <ctime>
#include <sys/stat.h>

#include "config.hpp"
#include "db/pool.hpp"
#include "middleware/auth.hpp"
#include "judge/engine.hpp"
#include "util/tmpfile.hpp"
#include "util/logger.hpp"
#include "util/config_loader.hpp"

Config g_config;
JudgeEngine* g_judge = nullptr;

void register_auth_routes(httplib::Server& svr);
void register_problem_routes(httplib::Server& svr);
void register_submission_routes(httplib::Server& svr);
void register_user_routes(httplib::Server& svr);
void register_admin_routes(httplib::Server& svr);
void register_background_routes(httplib::Server& svr);
void register_icon_routes(httplib::Server& svr);
void register_announcement_routes(httplib::Server& svr);
void register_avatar_routes(httplib::Server& svr);
void register_discussion_routes(httplib::Server& svr);
void register_comment_routes(httplib::Server& svr);
void register_leaderboard_routes(httplib::Server& svr);
void register_message_routes(httplib::Server& svr);

static std::string render_template(const std::string& path) {
    ctemplate::Template* tpl = ctemplate::Template::GetTemplate(path, ctemplate::DO_NOT_STRIP);
    if (!tpl) {
        return "";
    }
    std::string output;
    tpl->Expand(&output, nullptr);
    delete tpl;
    return output;
}

static void serve_spa(httplib::Server& svr) {
    svr.set_mount_point("/", g_config.web_root.c_str());

    svr.Get("/", [](const httplib::Request&, httplib::Response& res) {
        std::string html = render_template(g_config.web_root + "/index.html");
        if (html.empty()) {
            std::ifstream file(g_config.web_root + "/index.html");
            if (file) {
                std::ostringstream ss;
                ss << file.rdbuf();
                html = ss.str();
            }
        }
        res.set_header("Cache-Control", "no-cache, no-store, must-revalidate");
        res.set_header("Pragma", "no-cache");
        res.set_header("Expires", "0");
        res.set_content(html.empty() ? "<h1>VibeOJ</h1>" : html, "text/html");
    });
}

int main() {
    // Ignore SIGPIPE to prevent crashes when clients disconnect mid-response
    signal(SIGPIPE, SIG_IGN);
    srand(static_cast<unsigned int>(time(nullptr)));

    load_config_from_env(g_config);
    if (g_config.db_password.empty()) {
        std::cerr << "VIBEOJ_DB_PASSWORD is not set. Copy deploy/config.example.env to deploy/local.env "
                     "or deploy/production.env and fill in credentials.\n";
        return 1;
    }

    // Init logger
    Logger::instance().set_min_level(static_cast<LogLevel>(g_config.log_level));
    if (!g_config.log_file.empty()) {
        Logger::instance().set_log_file(g_config.log_file);
    }
    LOG_INFO("MioOJ server starting...");

    // Init temp directory
    if (!init_tmp_dir(g_config.tmp_dir)) {
        LOG_ERROR("Failed to create temp directory: " + g_config.tmp_dir);
        return 1;
    }

    // Init database pool
    try {
        g_db = new DbPool(g_config.db_host, g_config.db_port, g_config.db_user,
                          g_config.db_password, g_config.db_name, g_config.db_pool_size);
    } catch (const std::exception& e) {
        LOG_ERROR("Database connection failed: " + std::string(e.what()));
        return 1;
    }

    // Init judge engine
    g_judge = new JudgeEngine(g_config.judge_workers);
    LOG_INFO("Judge engine started with " + std::to_string(g_config.judge_workers) + " workers");

    httplib::Server svr;

    // Keep-alive timeout to prevent stale connections
    svr.set_keep_alive_timeout(5);

    // Error handler: always return valid JSON for API routes, HTML for others
    svr.set_error_handler([](const httplib::Request& /*req*/, httplib::Response& res) {
        // Only set content if handler didn't already set it
        if (res.body.empty()) {
            if (res.status == 404) {
                res.set_content(R"({"error":"Not Found"})", "application/json");
            } else if (res.status >= 500) {
                res.set_content(R"({"error":"Internal Server Error"})", "application/json");
            } else {
                res.set_content(R"({"error":"Request failed"})", "application/json");
            }
        }
    });

    register_auth_routes(svr);
    register_problem_routes(svr);
    register_submission_routes(svr);
    register_user_routes(svr);
    register_admin_routes(svr);
    register_background_routes(svr);
    register_icon_routes(svr);
    register_announcement_routes(svr);
    register_avatar_routes(svr);
    register_discussion_routes(svr);
    register_comment_routes(svr);
    register_leaderboard_routes(svr);
    register_message_routes(svr);

    serve_spa(svr);

    LOG_INFO("MioOJ Server running on http://0.0.0.0:" + std::to_string(g_config.port));
    std::cout << "VibeOJ Server running on http://0.0.0.0:" << g_config.port << std::endl;
    svr.listen("0.0.0.0", g_config.port);

    LOG_INFO("MioOJ Server shut down");
    delete g_judge;
    delete g_db;
    return 0;
}
