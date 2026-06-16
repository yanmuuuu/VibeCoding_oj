#include <httplib.h>
#include <ctemplate/template.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include <csignal>
#include <sys/stat.h>

#include "config.hpp"
#include "db/pool.hpp"
#include "middleware/auth.hpp"
#include "judge/engine.hpp"
#include "util/tmpfile.hpp"

Config g_config;
JudgeEngine* g_judge = nullptr;

void register_auth_routes(httplib::Server& svr);
void register_problem_routes(httplib::Server& svr);
void register_submission_routes(httplib::Server& svr);
void register_user_routes(httplib::Server& svr);
void register_admin_routes(httplib::Server& svr);

static std::string render_template(const std::string& path) {
    ctemplate::Template* tpl = ctemplate::Template::GetTemplate(path, ctemplate::DO_NOT_STRIP);
    if (!tpl) {
        // Fallback: serve raw file
        return "";
    }
    std::string output;
    tpl->Expand(&output, nullptr);
    delete tpl;
    return output;
}

static void serve_spa(httplib::Server& svr) {
    // Serve static files from web/ directory
    svr.set_mount_point("/", g_config.web_root.c_str());

    // SPA fallback: for any non-API, non-file route, serve index.html
    svr.Get("/", [](const httplib::Request&, httplib::Response& res) {
        std::string html = render_template(g_config.web_root + "/index.html");
        if (html.empty()) {
            // Try direct file read
            std::ifstream file(g_config.web_root + "/index.html");
            if (file) {
                std::ostringstream ss;
                ss << file.rdbuf();
                html = ss.str();
            }
        }
        res.set_content(html.empty() ? "<h1>VibeOJ</h1>" : html, "text/html");
    });
}

int main() {
    // Init temp directory
    if (!init_tmp_dir(g_config.tmp_dir)) {
        std::cerr << "Failed to create temp directory: " << g_config.tmp_dir << std::endl;
        return 1;
    }

    // Init database pool
    try {
        g_db = new DbPool(g_config.db_host, g_config.db_port, g_config.db_user,
                          g_config.db_password, g_config.db_name, g_config.db_pool_size);
    } catch (const std::exception& e) {
        std::cerr << "Database connection failed: " << e.what() << std::endl;
        return 1;
    }

    // Init judge engine
    g_judge = new JudgeEngine(g_config.judge_workers);

    // Create HTTP server
    httplib::Server svr;

    // Set up error handlers
    svr.set_error_handler([](const httplib::Request&, httplib::Response& res) {
        if (res.status == 404) {
            res.set_content(R"({"error":"Not Found"})", "application/json");
        } else if (res.status >= 500) {
            res.set_content(R"({"error":"Internal Server Error"})", "application/json");
        }
    });

    // Register all API routes
    register_auth_routes(svr);
    register_problem_routes(svr);
    register_submission_routes(svr);
    register_user_routes(svr);
    register_admin_routes(svr);

    // Serve static files and SPA
    serve_spa(svr);

    std::cout << "VibeOJ Server running on http://0.0.0.0:" << g_config.port << std::endl;
    svr.listen("0.0.0.0", g_config.port);

    // Cleanup
    delete g_judge;
    delete g_db;
    return 0;
}
