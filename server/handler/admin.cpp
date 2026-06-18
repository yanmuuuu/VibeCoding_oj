#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/json_extract.hpp"
#include "../judge/compiler.hpp"
#include "../judge/runner.hpp"
#include "../config.hpp"
#include "../util/crypto.hpp"
#include "../util/logger.hpp"
#include <sstream>
#include <string>
#include <cstdlib>
#include <filesystem>
#include <vector>
#include <algorithm>
#include <cctype>

namespace fs = std::filesystem;

static void remove_user_uploaded_file(const std::string& url) {
    if (url.empty()) return;
    if (url.find("/backgrounds/user_") != 0 && url.find("/avatars/user_") != 0) return;
    std::string path = g_config.web_root + url;
    try {
        if (fs::exists(path)) {
            fs::remove(path);
        }
    } catch (...) {}
}

static void remove_user_uploaded_files_by_id(int uid) {
    std::string prefix = "user_" + std::to_string(uid) + ".";
    const char* dirs[] = {"/backgrounds", "/avatars"};
    for (const char* dir : dirs) {
        std::string dir_path = g_config.web_root + dir;
        try {
            if (!fs::exists(dir_path) || !fs::is_directory(dir_path)) continue;
            for (const auto& entry : fs::directory_iterator(dir_path)) {
                if (!entry.is_regular_file()) continue;
                std::string fname = entry.path().filename().string();
                if (fname.size() >= prefix.size() && fname.compare(0, prefix.size(), prefix) == 0) {
                    try {
                        fs::remove(entry.path());
                    } catch (...) {}
                }
            }
        } catch (...) {}
    }
}

static bool check_admin(const httplib::Request& req, httplib::Response& res) {
    AuthUser user = authenticate(req);
    if (!user.valid) {
        res.status = 401;
        res.set_content("{\"error\":\"未登录\"}", "application/json");
        return false;
    }
    if (!user.is_admin) {
        res.status = 403;
        res.set_content("{\"error\":\"需要管理员权限\"}", "application/json");
        return false;
    }
    return true;
}

static std::string extract_str(const std::string& body, const std::string& key) {
    std::string search = "\"" + key + "\":\"";
    auto pos = body.find(search);
    if (pos == std::string::npos) {
        search = "\"" + key + "\": \"";
        pos = body.find(search);
    }
    if (pos == std::string::npos) return "";
    pos += search.size();
    std::string out;
    while (pos < body.size()) {
        if (body[pos] == '\\' && pos + 1 < body.size()) {
            pos++;
            switch (body[pos]) {
                case '"': out += '"'; break;
                case '\\': out += '\\'; break;
                case 'n': out += '\n'; break;
                case 'r': out += '\r'; break;
                case 't': out += '\t'; break;
                default: out += body[pos];
            }
        } else if (body[pos] == '"') {
            break;
        } else {
            out += body[pos];
        }
        pos++;
    }
    return out;
}

static int extract_int(const std::string& body, const std::string& key) {
    std::string search = "\"" + key + "\":";
    auto pos = body.find(search);
    if (pos == std::string::npos) return -1;
    pos += search.size();
    while (pos < body.size() && (body[pos] == ' ' || body[pos] == '\t')) pos++;
    auto end = body.find_first_of(",}\n\r", pos);
    std::string num = body.substr(pos, end - pos);
    try { return std::stoi(num); } catch (...) { return -1; }
}

static bool extract_bool(const std::string& body, const std::string& key) {
    std::string search = "\"" + key + "\":";
    auto pos = body.find(search);
    if (pos == std::string::npos) return true;
    pos += search.size();
    while (pos < body.size() && (body[pos] == ' ' || body[pos] == '\t')) pos++;
    if (body.substr(pos, 4) == "true") return true;
    if (body.substr(pos, 5) == "false") return false;
    return true;
}

static bool body_has_key(const std::string& body, const std::string& key) {
    return body.find("\"" + key + "\"") != std::string::npos;
}

static bool valid_difficulty(const std::string& d) {
    return d == "简单" || d == "中等" || d == "困难";
}

static std::string trim_copy(const std::string& s) {
    size_t start = 0;
    while (start < s.size() && std::isspace(static_cast<unsigned char>(s[start]))) start++;
    size_t end = s.size();
    while (end > start && std::isspace(static_cast<unsigned char>(s[end - 1]))) end--;
    return s.substr(start, end - start);
}

static std::string json_escape_str(const char* s) {
    if (!s) return "";
    std::string out;
    for (const char* p = s; *p; ++p) {
        switch (*p) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out += *p;
        }
    }
    return out;
}

static int count_test_cases_for_question(DbConn& db, int qid) {
    db.query("SELECT COUNT(*) FROM test_cases WHERE question_id=" + std::to_string(qid));
    MYSQL_RES* r = db.store_result();
    int count = 0;
    if (r) {
        MYSQL_ROW row = mysql_fetch_row(r);
        if (row && row[0]) count = std::stoi(row[0]);
        mysql_free_result(r);
    }
    return count;
}

static std::string get_saved_reference_code(DbConn& db, int qid) {
    db.query("SELECT reference_code FROM questions WHERE id=" + std::to_string(qid));
    MYSQL_RES* r = db.store_result();
    std::string ref;
    if (r) {
        MYSQL_ROW row = mysql_fetch_row(r);
        if (row && row[0]) ref = row[0];
        mysql_free_result(r);
    }
    return ref;
}

static std::string validate_publish_requirements(DbConn& db, int qid, bool want_visible,
                                                 const std::string& ref_override,
                                                 bool has_ref_override) {
    if (!want_visible) return "";
    std::string ref = has_ref_override ? ref_override : get_saved_reference_code(db, qid);
    if (trim_copy(ref).empty()) {
        return "设为可见需要先保存标程代码";
    }
    if (count_test_cases_for_question(db, qid) <= 0) {
        return "设为可见需要至少一个测试用例";
    }
    return "";
}

void register_admin_routes(httplib::Server& svr) {
    // Create question
    svr.Post("/api/admin/questions", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;

        auto& body = req.body;
        std::string title = extract_str(body, "title");
        std::string description = extract_str(body, "description");
        std::string input_format = extract_str(body, "input_format");
        std::string output_format = extract_str(body, "output_format");
        std::string sample_input = extract_str(body, "sample_input");
        std::string sample_output = extract_str(body, "sample_output");
        std::string difficulty = extract_str(body, "difficulty");
        std::string reference_code = extract_str(body, "reference_code");
        int time_limit = extract_int(body, "time_limit");
        if (time_limit <= 0) time_limit = 1;
        int memory_limit = extract_int(body, "memory_limit");
        if (memory_limit <= 0) memory_limit = 256;
        bool is_visible = extract_bool(body, "is_visible");

        if (title.empty() || description.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"标题和描述为必填\"}", "application/json");
            return;
        }
        if (difficulty.empty()) difficulty = "简单";
        if (!valid_difficulty(difficulty)) {
            res.status = 400;
            res.set_content("{\"error\":\"难度必须为：简单、中等、困难\"}", "application/json");
            return;
        }
        if (is_visible) {
            res.status = 400;
            res.set_content("{\"error\":\"新建题目请先保存为草稿，添加测试用例后再发布\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        std::ostringstream sql;
        sql << "INSERT INTO questions (title, description, input_format, output_format, "
            << "sample_input, sample_output, difficulty, reference_code, time_limit, memory_limit, is_visible) VALUES ('"
            << db->escape(title) << "', '"
            << db->escape(description) << "', '"
            << db->escape(input_format) << "', '"
            << db->escape(output_format) << "', '"
            << db->escape(sample_input) << "', '"
            << db->escape(sample_output) << "', '"
            << db->escape(difficulty) << "', '"
            << db->escape(reference_code) << "', "
            << time_limit << ", " << memory_limit << ", 0)";
        db->query(sql.str());
        int new_id = db->last_insert_id();
        LOG_INFO("Admin: question #" + std::to_string(new_id) + " created (title: " + title + ")");
        res.status = 201;
        res.set_content("{\"ok\":true,\"id\":" + std::to_string(new_id) + "}", "application/json");
    });

    // Edit question
    svr.Put(R"(/api/admin/questions/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int qid = std::stoi(req.matches[1]);

        auto& body = req.body;
        auto db = g_db->acquire();

        // Verify question exists
        db->query("SELECT id FROM questions WHERE id=" + std::to_string(qid));
        MYSQL_RES* check = db->store_result();
        if (!check || mysql_num_rows(check) == 0) {
            if (check) mysql_free_result(check);
            res.status = 404;
            res.set_content("{\"error\":\"Question not found\"}", "application/json");
            return;
        }
        mysql_free_result(check);

        std::ostringstream sql;
        sql << "UPDATE questions SET ";
        bool first = true;

        auto add = [&](const std::string& col, const std::string& val, bool is_int) {
            if (val.empty()) return;
            if (!first) sql << ", ";
            first = false;
            if (is_int) {
                sql << col << "=" << val;
            } else {
                sql << col << "='" << db->escape(val) << "'";
            }
        };

        std::string title = extract_str(body, "title");
        std::string desc = extract_str(body, "description");
        std::string infmt = extract_str(body, "input_format");
        std::string outfmt = extract_str(body, "output_format");
        std::string sin = extract_str(body, "sample_input");
        std::string sout = extract_str(body, "sample_output");
        std::string difficulty = extract_str(body, "difficulty");
        std::string reference_code = extract_str(body, "reference_code");
        bool has_reference_code = body_has_key(body, "reference_code");
        int tl = extract_int(body, "time_limit");
        int ml = extract_int(body, "memory_limit");
        bool vis = extract_bool(body, "is_visible");

        if (!difficulty.empty() && !valid_difficulty(difficulty)) {
            res.status = 400;
            res.set_content("{\"error\":\"难度必须为：简单、中等、困难\"}", "application/json");
            return;
        }

        std::string publish_err = validate_publish_requirements(*db, qid, vis, reference_code, has_reference_code);
        if (!publish_err.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"" + json_escape(publish_err) + "\"}", "application/json");
            return;
        }

        add("title", title, false);
        add("description", desc, false);
        add("input_format", infmt, false);
        add("output_format", outfmt, false);
        add("sample_input", sin, false);
        add("sample_output", sout, false);
        if (!difficulty.empty()) add("difficulty", difficulty, false);
        if (has_reference_code) {
            if (!first) sql << ", ";
            first = false;
            sql << "reference_code='" << db->escape(reference_code) << "'";
        }
        if (tl > 0) add("time_limit", std::to_string(tl), true);
        if (ml > 0) add("memory_limit", std::to_string(ml), true);
        add("is_visible", vis ? "1" : "0", true);

        sql << " WHERE id=" << qid;
        db->query(sql.str());
        LOG_INFO("Admin: question #" + std::to_string(qid) + " edited (visible: " + (vis ? "true" : "false") + ")");
        res.set_content("{\"ok\":true}", "application/json");
    });

    // Delete question
    svr.Delete(R"(/api/admin/questions/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int qid = std::stoi(req.matches[1]);

        auto db = g_db->acquire();
        db->query("DELETE FROM questions WHERE id=" + std::to_string(qid));
        if (db->affected_rows() == 0) {
            res.status = 404;
            res.set_content("{\"error\":\"Question not found\"}", "application/json");
            return;
        }
        LOG_INFO("Admin: question #" + std::to_string(qid) + " deleted");
        res.set_content("{\"ok\":true}", "application/json");
    });

    // List all questions (admin view, including hidden)
    svr.Get("/api/admin/questions", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;

        auto db = g_db->acquire();
        db->query("SELECT id, title, is_visible, time_limit, memory_limit, difficulty FROM questions ORDER BY id ASC");
        MYSQL_RES* result = db->store_result();

        std::string json = "[";
        bool first = true;
        MYSQL_ROW row;
        if (result) {
            while ((row = mysql_fetch_row(result))) {
                if (!first) json += ",";
                first = false;
                json += "{\"id\":" + std::string(row[0]) +
                        ",\"title\":\"" + std::string(row[1] ? row[1] : "") + "\"" +
                        ",\"is_visible\":" + std::string(row[2] ? row[2] : "1") +
                        ",\"time_limit\":" + std::string(row[3] ? row[3] : "1") +
                        ",\"memory_limit\":" + std::string(row[4] ? row[4] : "256") +
                        ",\"difficulty\":\"" + std::string(row[5] ? row[5] : "简单") + "\"}";
            }
        }
        json += "]";
        if (result) mysql_free_result(result);
        res.set_content(json, "application/json");
    });

    // Get single question (admin view)
    svr.Get(R"(/api/admin/questions/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int qid = std::stoi(req.matches[1]);

        auto db = g_db->acquire();
        db->query("SELECT id, title, description, input_format, output_format, "
                  "sample_input, sample_output, difficulty, reference_code, time_limit, memory_limit, is_visible "
                  "FROM questions WHERE id=" + std::to_string(qid));

        MYSQL_RES* result = db->store_result();
        if (!result || mysql_num_rows(result) == 0) {
            if (result) mysql_free_result(result);
            res.status = 404;
            res.set_content("{\"error\":\"Question not found\"}", "application/json");
            return;
        }

        MYSQL_ROW row = mysql_fetch_row(result);
        std::ostringstream json;
        json << "{\"id\":" << row[0]
             << ",\"title\":\"" << json_escape_str(row[1]) << "\""
             << ",\"description\":\"" << json_escape_str(row[2]) << "\""
             << ",\"input_format\":\"" << json_escape_str(row[3]) << "\""
             << ",\"output_format\":\"" << json_escape_str(row[4]) << "\""
             << ",\"sample_input\":\"" << json_escape_str(row[5]) << "\""
             << ",\"sample_output\":\"" << json_escape_str(row[6]) << "\""
             << ",\"difficulty\":\"" << json_escape_str(row[7] ? row[7] : "简单") << "\""
             << ",\"reference_code\":\"" << json_escape_str(row[8]) << "\""
             << ",\"time_limit\":" << (row[9] ? row[9] : "1")
             << ",\"memory_limit\":" << (row[10] ? row[10] : "256")
             << ",\"is_visible\":" << (row[11] ? (std::stoi(row[11]) ? "true" : "false") : "true")
             << "}";
        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    // ===== Test Case CRUD =====

    // Add test case
    svr.Post(R"(/api/admin/questions/(\d+)/testcases)", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int qid = std::stoi(req.matches[1]);

        std::string input_data = extract_str(req.body, "input_data");
        std::string expected_output = extract_str(req.body, "expected_output");
        int order_index = extract_int(req.body, "order_index");
        if (order_index < 0) order_index = 0;

        auto db = g_db->acquire();
        std::ostringstream sql;
        sql << "INSERT INTO test_cases (question_id, input_data, expected_output, order_index) VALUES ("
            << qid << ", '" << db->escape(input_data) << "', '" << db->escape(expected_output) << "', "
            << order_index << ")";
        db->query(sql.str());
        res.status = 201;
        res.set_content("{\"ok\":true,\"id\":" + std::to_string(db->last_insert_id()) + "}", "application/json");
    });

    // Edit test case
    svr.Put(R"(/api/admin/questions/(\d+)/testcases/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int tid = std::stoi(req.matches[2]);

        auto& body = req.body;
        auto db = g_db->acquire();

        std::ostringstream sql;
        sql << "UPDATE test_cases SET ";
        bool first = true;

        auto add = [&](const std::string& col, const std::string& val, bool is_int) {
            if (val.empty()) return;
            if (!first) sql << ", ";
            first = false;
            if (is_int) sql << col << "=" << val;
            else sql << col << "='" << db->escape(val) << "'";
        };

        std::string input_data = extract_str(body, "input_data");
        std::string expected_output = extract_str(body, "expected_output");
        int order_index = extract_int(body, "order_index");

        add("input_data", input_data, false);
        add("expected_output", expected_output, false);
        if (order_index >= 0) add("order_index", std::to_string(order_index), true);

        sql << " WHERE id=" << tid;
        db->query(sql.str());
        res.set_content("{\"ok\":true}", "application/json");
    });

    // Delete test case
    svr.Delete(R"(/api/admin/questions/(\d+)/testcases/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int tid = std::stoi(req.matches[2]);

        auto db = g_db->acquire();
        db->query("DELETE FROM test_cases WHERE id=" + std::to_string(tid));
        res.set_content("{\"ok\":true}", "application/json");
    });

    // List test cases
    svr.Get(R"(/api/admin/questions/(\d+)/testcases)", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int qid = std::stoi(req.matches[1]);

        auto db = g_db->acquire();
        db->query("SELECT id, input_data, expected_output, order_index FROM test_cases WHERE question_id=" +
                  std::to_string(qid) + " ORDER BY order_index ASC");

        MYSQL_RES* result = db->store_result();
        auto esc = [](const char* s) -> std::string {
            if (!s) return "";
            std::string out;
            for (const char* p = s; *p; ++p) {
                switch (*p) {
                    case '"': out += "\\\""; break;
                    case '\\': out += "\\\\"; break;
                    case '\n': out += "\\n"; break;
                    case '\r': out += "\\r"; break;
                    case '\t': out += "\\t"; break;
                    default: out += *p;
                }
            }
            return out;
        };

        std::string json = "[";
        bool first = true;
        MYSQL_ROW row;
        if (result) {
            while ((row = mysql_fetch_row(result))) {
                if (!first) json += ",";
                first = false;
                json += "{\"id\":" + std::string(row[0]) +
                        ",\"input_data\":\"" + esc(row[1]) + "\"" +
                        ",\"expected_output\":\"" + esc(row[2]) + "\"" +
                        ",\"order_index\":" + std::string(row[3] ? row[3] : "0") + "}";
            }
        }
        json += "]";
        if (result) mysql_free_result(result);
        res.set_content(json, "application/json");
    });

    // ===== Statistics =====

    svr.Get("/api/admin/stats", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;

        auto db = g_db->acquire();
        int total_users = 0, total_questions = 0, total_submissions = 0;

        db->query("SELECT COUNT(*) FROM users");
        MYSQL_RES* r = db->store_result();
        if (r) { MYSQL_ROW row = mysql_fetch_row(r); if (row && row[0]) total_users = std::stoi(row[0]); mysql_free_result(r); }

        db->query("SELECT COUNT(*) FROM questions");
        r = db->store_result();
        if (r) { MYSQL_ROW row = mysql_fetch_row(r); if (row && row[0]) total_questions = std::stoi(row[0]); mysql_free_result(r); }

        db->query("SELECT COUNT(*) FROM submissions");
        r = db->store_result();
        if (r) { MYSQL_ROW row = mysql_fetch_row(r); if (row && row[0]) total_submissions = std::stoi(row[0]); mysql_free_result(r); }

        bool first = true;
        MYSQL_ROW row = nullptr;
        std::ostringstream json;
        json << "{\"total_users\":" << total_users
             << ",\"total_questions\":" << total_questions
             << ",\"total_submissions\":" << total_submissions
             << ",\"recent_submissions\":[";
        db->query(
            "SELECT s.id, u.username, q.title, s.status, s.created_at "
            "FROM submissions s JOIN users u ON s.user_id=u.id "
            "JOIN questions q ON s.question_id=q.id "
            "ORDER BY s.id DESC LIMIT 10");
        r = db->store_result();
        first = true;
        if (r) {
            while ((row = mysql_fetch_row(r))) {
                if (!first) json << ",";
                first = false;
                json << "{\"id\":" << (row[0] ? row[0] : "0")
                     << ",\"username\":\"" << json_escape(row[1] ? row[1] : "") << "\""
                     << ",\"question_title\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                     << ",\"status\":\"" << json_escape(row[3] ? row[3] : "") << "\""
                     << ",\"created_at\":\"" << (row[4] ? row[4] : "") << "\"}";
            }
            mysql_free_result(r);
        }
        json << "],\"recent_users\":[";
        db->query("SELECT id, username, created_at FROM users ORDER BY id DESC LIMIT 10");
        r = db->store_result();
        first = true;
        if (r) {
            while ((row = mysql_fetch_row(r))) {
                if (!first) json << ",";
                first = false;
                json << "{\"id\":" << (row[0] ? row[0] : "0")
                     << ",\"username\":\"" << json_escape(row[1] ? row[1] : "") << "\""
                     << ",\"created_at\":\"" << (row[2] ? row[2] : "") << "\"}";
            }
            mysql_free_result(r);
        }
        json << "],\"recent_discussions\":[";
        db->query(
            "SELECT d.id, u.username, LEFT(d.content, 80) AS preview, d.created_at "
            "FROM discussions d JOIN users u ON d.user_id=u.id "
            "ORDER BY d.id DESC LIMIT 10");
        r = db->store_result();
        first = true;
        if (r) {
            while ((row = mysql_fetch_row(r))) {
                if (!first) json << ",";
                first = false;
                json << "{\"id\":" << (row[0] ? row[0] : "0")
                     << ",\"username\":\"" << json_escape(row[1] ? row[1] : "") << "\""
                     << ",\"preview\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                     << ",\"created_at\":\"" << (row[3] ? row[3] : "") << "\"}";
            }
            mysql_free_result(r);
        }
        json << "]}";
        res.set_content(json.str(), "application/json");
    });

    // ===== Batch Question Operations =====

    svr.Post("/api/admin/questions/batch", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;

        std::string action = extract_json_string(req.body, "action");
        if (action != "hide" && action != "show" && action != "delete") {
            res.status = 400;
            res.set_content("{\"error\":\"无效操作\"}", "application/json");
            return;
        }

        std::string ids_str = extract_json_string(req.body, "ids");
        if (ids_str.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"未提供题目ID\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        if (action == "delete") {
            db->query("DELETE FROM questions WHERE id IN (" + ids_str + ")");
        } else if (action == "show") {
            std::vector<int> ids;
            size_t start = 0;
            while (start < ids_str.size()) {
                size_t comma = ids_str.find(',', start);
                std::string part = ids_str.substr(start, comma == std::string::npos ? std::string::npos : comma - start);
                if (!part.empty()) {
                    try { ids.push_back(std::stoi(part)); } catch (...) {}
                }
                if (comma == std::string::npos) break;
                start = comma + 1;
            }
            for (int qid : ids) {
                std::string err = validate_publish_requirements(*db, qid, true, "", false);
                if (!err.empty()) {
                    res.status = 400;
                    res.set_content("{\"error\":\"题目 #" + std::to_string(qid) + "：" + json_escape(err) + "\"}", "application/json");
                    return;
                }
            }
            db->query("UPDATE questions SET is_visible=1 WHERE id IN (" + ids_str + ")");
        } else {
            db->query("UPDATE questions SET is_visible=0 WHERE id IN (" + ids_str + ")");
        }
        LOG_INFO("Admin: batch operation '" + action + "' on questions [" + ids_str + "]");
        res.set_content("{\"ok\":true}", "application/json");
    });

    // ===== Reference Code Generation =====

    svr.Post("/api/admin/reference/generate", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;

        std::string code = extract_json_string(req.body, "code");
        std::string inputs_json = extract_json_string(req.body, "input_data");
        if (code.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"请提供参考代码\"}", "application/json");
            return;
        }

        // Compile the reference code
        auto compile_res = compile_code(code, g_config.tmp_dir, g_config.compile_timeout);
        if (!compile_res.success) {
            std::ostringstream json;
            json << "{\"ok\":false,\"compile_error\":\"" << json_escape(compile_res.error) << "\"}";
            res.set_content(json.str(), "application/json");
            return;
        }

        // Parse input data lines separated by |||
        std::string outputs_json;
        // inputs_json contains all test inputs separated by |||
        // We return outputs separated by |||
        auto esc = [](const std::string& s) -> std::string {
            return json_escape(s);
        };

        std::ostringstream json;
        json << "{\"ok\":true,\"outputs\":[";
        std::ostringstream statuses;
        statuses << "[";
        bool first_out = true;
        bool first_status = true;

        if (!inputs_json.empty()) {
            std::vector<std::string> inputs;
            size_t start = 0;
            size_t pos;
            const std::string delim = "|||";
            while ((pos = inputs_json.find(delim, start)) != std::string::npos) {
                inputs.push_back(inputs_json.substr(start, pos - start));
                start = pos + delim.size();
            }
            inputs.push_back(inputs_json.substr(start));

            for (size_t i = 0; i < inputs.size(); i++) {
                TestCase tc;
                tc.id = static_cast<int>(i);
                tc.order_index = static_cast<int>(i);
                tc.input_data = inputs[i];
                tc.expected_output = "";

                auto run_res = run_single(compile_res.binary_path, tc, 5, 512);
                if (!first_out) json << ",";
                first_out = false;
                json << "\"" << esc(run_res.actual_output) << "\"";

                TestCase verify_tc = tc;
                verify_tc.expected_output = run_res.actual_output;
                auto verify_res = run_single(compile_res.binary_path, verify_tc, 5, 512);
                std::string status = (verify_res.status == "AC") ? "AC" : verify_res.status;
                if (!first_status) statuses << ",";
                first_status = false;
                statuses << "\"" << esc(status) << "\"";
            }
        }

        json << "],\"statuses\":" << statuses.str() << "]}";

        // Clean up binary
        if (!compile_res.binary_path.empty()) {
            unlink(compile_res.binary_path.c_str());
        }

        res.set_content(json.str(), "application/json");
    });

    // ===== User Management =====

    svr.Get("/api/admin/users", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;

        int page = 1;
        int per_page = 20;
        std::string search;
        if (req.has_param("page")) try { page = std::stoi(req.get_param_value("page")); } catch (...) {}
        if (req.has_param("per_page")) try { per_page = std::stoi(req.get_param_value("per_page")); } catch (...) {}
        if (req.has_param("search")) search = req.get_param_value("search");
        int offset = (page - 1) * per_page;

        auto db = g_db->acquire();

        // Count total
        std::string count_sql = "SELECT COUNT(*) FROM users";
        if (!search.empty()) {
            count_sql += " WHERE username LIKE '%" + db->escape(search) + "%'";
        }
        db->query(count_sql);
        int total = 0;
        MYSQL_RES* cr = db->store_result();
        if (cr) { MYSQL_ROW row = mysql_fetch_row(cr); if (row && row[0]) total = std::stoi(row[0]); mysql_free_result(cr); }

        std::string sql = "SELECT id, username, is_admin, is_banned, created_at FROM users";
        if (!search.empty()) {
            sql += " WHERE username LIKE '%" + db->escape(search) + "%'";
        }
        sql += " ORDER BY id ASC LIMIT " + std::to_string(per_page) + " OFFSET " + std::to_string(offset);
        db->query(sql);

        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "{\"total\":" << total << ",\"users\":[";
        bool first = true;
        MYSQL_ROW row;
        if (result) {
            while ((row = mysql_fetch_row(result))) {
                if (!first) json << ",";
                first = false;
                json << "{\"id\":" << (row[0] ? row[0] : "0")
                     << ",\"username\":\"" << json_escape(row[1] ? row[1] : "") << "\""
                     << ",\"is_admin\":" << (row[2] && std::stoi(row[2]) ? "true" : "false")
                     << ",\"is_banned\":" << (row[3] && std::stoi(row[3]) ? "true" : "false")
                     << ",\"created_at\":\"" << (row[4] ? row[4] : "") << "\""
                     << "}";
            }
        }
        json << "]}";
        if (result) mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    svr.Delete(R"(/api/admin/users/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int uid = std::stoi(req.matches[1]);

        auto db = g_db->acquire();

        std::string bg_url;
        std::string av_url;
        db->query("SELECT background_url, avatar_url FROM users WHERE id=" + std::to_string(uid));
        MYSQL_RES* result = db->store_result();
        if (!result) {
            res.status = 404;
            res.set_content("{\"error\":\"用户不存在\"}", "application/json");
            return;
        }
        MYSQL_ROW row = mysql_fetch_row(result);
        if (!row) {
            mysql_free_result(result);
            res.status = 404;
            res.set_content("{\"error\":\"用户不存在\"}", "application/json");
            return;
        }
        if (row[0]) bg_url = row[0];
        if (row[1]) av_url = row[1];
        mysql_free_result(result);

        remove_user_uploaded_file(bg_url);
        remove_user_uploaded_file(av_url);
        remove_user_uploaded_files_by_id(uid);

        db->query("DELETE FROM users WHERE id=" + std::to_string(uid));
        LOG_INFO("Admin: user #" + std::to_string(uid) + " deleted");
        res.set_content("{\"ok\":true}", "application/json");
    });

    svr.Put(R"(/api/admin/users/(\d+)/admin)", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int uid = std::stoi(req.matches[1]);

        bool set_admin = extract_json_bool(req.body, "is_admin");

        auto db = g_db->acquire();
        db->query("UPDATE users SET is_admin=" + std::string(set_admin ? "1" : "0") + " WHERE id=" + std::to_string(uid));
        if (db->affected_rows() == 0) {
            res.status = 404;
            res.set_content("{\"error\":\"用户不存在\"}", "application/json");
            return;
        }
        LOG_INFO("Admin: user #" + std::to_string(uid) + " admin status changed to " + (set_admin ? "true" : "false"));
        res.set_content("{\"ok\":true}", "application/json");
    });

    svr.Put(R"(/api/admin/users/(\d+)/ban)", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int uid = std::stoi(req.matches[1]);
        bool banned = extract_json_bool(req.body, "is_banned");

        auto db = g_db->acquire();
        db->query("UPDATE users SET is_banned=" + std::string(banned ? "1" : "0") + " WHERE id=" + std::to_string(uid));
        if (db->affected_rows() == 0) {
            res.status = 404;
            res.set_content("{\"error\":\"用户不存在\"}", "application/json");
            return;
        }
        if (banned) {
            db->query("DELETE FROM sessions WHERE user_id=" + std::to_string(uid));
        }
        LOG_INFO("Admin: user #" + std::to_string(uid) + " ban status changed to " + (banned ? "true" : "false"));
        res.set_content("{\"ok\":true}", "application/json");
    });

    svr.Put(R"(/api/admin/users/(\d+)/password)", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int uid = std::stoi(req.matches[1]);
        std::string password = extract_json_string(req.body, "password");
        if (password.size() < 8) {
            res.status = 400;
            res.set_content("{\"error\":\"密码至少 8 位\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        std::string hash = hash_password(password);
        db->query("UPDATE users SET password_hash='" + db->escape(hash) + "' WHERE id=" + std::to_string(uid));
        if (db->affected_rows() == 0) {
            res.status = 404;
            res.set_content("{\"error\":\"用户不存在\"}", "application/json");
            return;
        }
        db->query("DELETE FROM sessions WHERE user_id=" + std::to_string(uid));
        LOG_INFO("Admin: user #" + std::to_string(uid) + " password reset");
        res.set_content("{\"ok\":true}", "application/json");
    });

    svr.Get("/api/admin/discussions", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;

        int page = 1;
        int per_page = 20;
        std::string search;
        if (req.has_param("page")) try { page = std::stoi(req.get_param_value("page")); } catch (...) {}
        if (req.has_param("search")) search = req.get_param_value("search");
        int offset = (page - 1) * per_page;

        auto db = g_db->acquire();
        std::string where;
        if (!search.empty()) {
            std::string esc = db->escape(search);
            where = " WHERE d.content LIKE '%" + esc + "%' OR u.username LIKE '%" + esc + "%'";
        }

        db->query("SELECT COUNT(*) FROM discussions d JOIN users u ON d.user_id=u.id" + where);
        int total = 0;
        MYSQL_RES* cr = db->store_result();
        if (cr) { MYSQL_ROW row = mysql_fetch_row(cr); if (row && row[0]) total = std::stoi(row[0]); mysql_free_result(cr); }

        std::string sql =
            "SELECT d.id, d.user_id, u.username, d.content, d.like_count, d.created_at, "
            "(SELECT COUNT(*) FROM discussion_replies WHERE discussion_id=d.id) AS reply_count "
            "FROM discussions d JOIN users u ON d.user_id=u.id" + where +
            " ORDER BY d.id DESC LIMIT " + std::to_string(per_page) + " OFFSET " + std::to_string(offset);
        db->query(sql);
        MYSQL_RES* result = db->store_result();

        std::ostringstream json;
        json << "{\"total\":" << total << ",\"discussions\":[";
        bool first = true;
        MYSQL_ROW row;
        if (result) {
            while ((row = mysql_fetch_row(result))) {
                if (!first) json << ",";
                first = false;
                json << "{\"id\":" << (row[0] ? row[0] : "0")
                     << ",\"user_id\":" << (row[1] ? row[1] : "0")
                     << ",\"username\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                     << ",\"content\":\"" << json_escape(row[3] ? row[3] : "") << "\""
                     << ",\"like_count\":" << (row[4] ? row[4] : "0")
                     << ",\"created_at\":\"" << (row[5] ? row[5] : "") << "\""
                     << ",\"reply_count\":" << (row[6] ? row[6] : "0")
                     << "}";
            }
            mysql_free_result(result);
        }
        json << "]}";
        res.set_content(json.str(), "application/json");
    });

    svr.Get(R"(/api/admin/discussions/(\d+)/replies)", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int did = std::stoi(req.matches[1]);

        auto db = g_db->acquire();
        db->query(
            "SELECT r.id, r.user_id, u.username, r.content, r.parent_reply_id, r.like_count, r.created_at "
            "FROM discussion_replies r JOIN users u ON r.user_id=u.id "
            "WHERE r.discussion_id=" + std::to_string(did) + " ORDER BY r.id ASC");
        MYSQL_RES* result = db->store_result();

        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        if (result) {
            while ((row = mysql_fetch_row(result))) {
                if (!first) json << ",";
                first = false;
                json << "{\"id\":" << (row[0] ? row[0] : "0")
                     << ",\"user_id\":" << (row[1] ? row[1] : "0")
                     << ",\"username\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                     << ",\"content\":\"" << json_escape(row[3] ? row[3] : "") << "\""
                     << ",\"parent_reply_id\":" << (row[4] ? row[4] : "null")
                     << ",\"like_count\":" << (row[5] ? row[5] : "0")
                     << ",\"created_at\":\"" << (row[6] ? row[6] : "") << "\"}";
            }
            mysql_free_result(result);
        }
        json << "]";
        res.set_content(json.str(), "application/json");
    });
}
