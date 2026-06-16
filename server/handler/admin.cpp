#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include <sstream>
#include <string>

static bool check_admin(const httplib::Request& req, httplib::Response& res) {
    AuthUser user = authenticate(req);
    if (!user.valid) {
        res.status = 401;
        res.set_content("{\"error\":\"Not authenticated\"}", "application/json");
        return false;
    }
    if (!user.is_admin) {
        res.status = 403;
        res.set_content("{\"error\":\"Admin only\"}", "application/json");
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
        int time_limit = extract_int(body, "time_limit");
        if (time_limit <= 0) time_limit = 1;
        int memory_limit = extract_int(body, "memory_limit");
        if (memory_limit <= 0) memory_limit = 256;
        bool is_visible = extract_bool(body, "is_visible");

        auto db = g_db->acquire();
        std::ostringstream sql;
        sql << "INSERT INTO questions (title, description, input_format, output_format, "
            << "sample_input, sample_output, time_limit, memory_limit, is_visible) VALUES ('"
            << db->escape(title) << "', '"
            << db->escape(description) << "', '"
            << db->escape(input_format) << "', '"
            << db->escape(output_format) << "', '"
            << db->escape(sample_input) << "', '"
            << db->escape(sample_output) << "', "
            << time_limit << ", " << memory_limit << ", "
            << (is_visible ? 1 : 0) << ")";
        db->query(sql.str());
        int new_id = db->last_insert_id();
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
        int tl = extract_int(body, "time_limit");
        int ml = extract_int(body, "memory_limit");
        bool vis = extract_bool(body, "is_visible");

        add("title", title, false);
        add("description", desc, false);
        add("input_format", infmt, false);
        add("output_format", outfmt, false);
        add("sample_input", sin, false);
        add("sample_output", sout, false);
        if (tl > 0) add("time_limit", std::to_string(tl), true);
        if (ml > 0) add("memory_limit", std::to_string(ml), true);
        add("is_visible", vis ? "1" : "0", true);

        sql << " WHERE id=" << qid;
        db->query(sql.str());
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
        res.set_content("{\"ok\":true}", "application/json");
    });

    // List all questions (admin view, including hidden)
    svr.Get("/api/admin/questions", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;

        auto db = g_db->acquire();
        db->query("SELECT id, title, is_visible, time_limit, memory_limit FROM questions ORDER BY id ASC");
        MYSQL_RES* result = db->store_result();

        std::string json = "[";
        bool first = true;
        MYSQL_ROW row;
        while ((row = mysql_fetch_row(result))) {
            if (!first) json += ",";
            first = false;
            json += "{\"id\":" + std::string(row[0]) +
                    ",\"title\":\"" + std::string(row[1] ? row[1] : "") + "\"" +
                    ",\"is_visible\":" + std::string(row[2] ? row[2] : "1") +
                    ",\"time_limit\":" + std::string(row[3] ? row[3] : "1") +
                    ",\"memory_limit\":" + std::string(row[4] ? row[4] : "256") + "}";
        }
        json += "]";
        mysql_free_result(result);
        res.set_content(json, "application/json");
    });

    // Get single question (admin view)
    svr.Get(R"(/api/admin/questions/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int qid = std::stoi(req.matches[1]);

        auto db = g_db->acquire();
        db->query("SELECT id, title, description, input_format, output_format, "
                  "sample_input, sample_output, time_limit, memory_limit, is_visible "
                  "FROM questions WHERE id=" + std::to_string(qid));

        MYSQL_RES* result = db->store_result();
        if (!result || mysql_num_rows(result) == 0) {
            if (result) mysql_free_result(result);
            res.status = 404;
            res.set_content("{\"error\":\"Question not found\"}", "application/json");
            return;
        }

        MYSQL_ROW row = mysql_fetch_row(result);
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

        std::ostringstream json;
        json << "{\"id\":" << row[0]
             << ",\"title\":\"" << esc(row[1]) << "\""
             << ",\"description\":\"" << esc(row[2]) << "\""
             << ",\"input_format\":\"" << esc(row[3]) << "\""
             << ",\"output_format\":\"" << esc(row[4]) << "\""
             << ",\"sample_input\":\"" << esc(row[5]) << "\""
             << ",\"sample_output\":\"" << esc(row[6]) << "\""
             << ",\"time_limit\":" << (row[7] ? row[7] : "1")
             << ",\"memory_limit\":" << (row[8] ? row[8] : "256")
             << ",\"is_visible\":" << (row[9] ? (std::stoi(row[9]) ? "true" : "false") : "true")
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
        while ((row = mysql_fetch_row(result))) {
            if (!first) json += ",";
            first = false;
            json += "{\"id\":" + std::string(row[0]) +
                    ",\"input_data\":\"" + esc(row[1]) + "\"" +
                    ",\"expected_output\":\"" + esc(row[2]) + "\"" +
                    ",\"order_index\":" + std::string(row[3] ? row[3] : "0") + "}";
        }
        json += "]";
        mysql_free_result(result);
        res.set_content(json, "application/json");
    });
}
