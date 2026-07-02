#include <httplib.h>
#include "../db/pool.hpp"
#include "../middleware/auth.hpp"
#include "../util/json_extract.hpp"
#include "../util/logger.hpp"
#include <sstream>
#include <string>
#include <algorithm>
#include <cctype>

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

static bool check_auth(const httplib::Request& req, httplib::Response& res, AuthUser& user) {
    user = authenticate(req);
    if (!user.valid) {
        res.status = 401;
        res.set_content("{\"error\":\"未登录\"}", "application/json");
        return false;
    }
    return true;
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

static int next_display_index(DbConn& db) {
    db.query("SELECT COALESCE(MAX(display_index), -1) + 1 FROM questions");
    MYSQL_RES* result = db.store_result();
    int next_idx = 0;
    if (result) {
        MYSQL_ROW row = mysql_fetch_row(result);
        if (row && row[0]) next_idx = std::stoi(row[0]);
        mysql_free_result(result);
    }
    return next_idx;
}

static int next_proposal_tc_order(DbConn& db, int pid) {
    db.query("SELECT COALESCE(MAX(order_index), -1) + 1 FROM proposal_test_cases WHERE proposal_id=" + std::to_string(pid));
    MYSQL_RES* result = db.store_result();
    int next_idx = 0;
    if (result) {
        MYSQL_ROW row = mysql_fetch_row(result);
        if (row && row[0]) next_idx = std::stoi(row[0]);
        mysql_free_result(result);
    }
    return next_idx;
}

static int count_pending_proposals(DbConn& db, int uid) {
    db.query("SELECT COUNT(*) FROM problem_proposals WHERE user_id=" + std::to_string(uid) + " AND status='pending'");
    MYSQL_RES* r = db.store_result();
    int count = 0;
    if (r) {
        MYSQL_ROW row = mysql_fetch_row(r);
        if (row && row[0]) count = std::stoi(row[0]);
        mysql_free_result(r);
    }
    return count;
}

static int count_proposal_test_cases(DbConn& db, int pid) {
    db.query("SELECT COUNT(*) FROM proposal_test_cases WHERE proposal_id=" + std::to_string(pid));
    MYSQL_RES* r = db.store_result();
    int count = 0;
    if (r) {
        MYSQL_ROW row = mysql_fetch_row(r);
        if (row && row[0]) count = std::stoi(row[0]);
        mysql_free_result(r);
    }
    return count;
}

static std::string proposal_status_label(const char* status) {
    if (!status) return "";
    std::string s(status);
    if (s == "pending") return "待审核";
    if (s == "approved") return "已通过";
    if (s == "rejected") return "未通过";
    return s;
}

static std::string build_proposal_json(MYSQL_ROW row) {
    std::ostringstream json;
    json << "{\"id\":" << (row[0] ? row[0] : "0")
         << ",\"user_id\":" << (row[1] ? row[1] : "0")
         << ",\"title\":\"" << json_escape(row[2] ? row[2] : "") << "\""
         << ",\"description\":\"" << json_escape(row[3] ? row[3] : "") << "\""
         << ",\"input_format\":\"" << json_escape(row[4] ? row[4] : "") << "\""
         << ",\"output_format\":\"" << json_escape(row[5] ? row[5] : "") << "\""
         << ",\"sample_input\":\"" << json_escape(row[6] ? row[6] : "") << "\""
         << ",\"sample_output\":\"" << json_escape(row[7] ? row[7] : "") << "\""
         << ",\"difficulty\":\"" << json_escape(row[8] ? row[8] : "简单") << "\""
         << ",\"time_limit\":" << (row[9] ? row[9] : "1")
         << ",\"memory_limit\":" << (row[10] ? row[10] : "256")
         << ",\"reference_code\":\"" << json_escape(row[11] ? row[11] : "") << "\""
         << ",\"status\":\"" << (row[12] ? row[12] : "pending") << "\""
         << ",\"status_label\":\"" << proposal_status_label(row[12]) << "\""
         << ",\"admin_reason\":\"" << json_escape(row[13] ? row[13] : "") << "\""
         << ",\"question_id\":" << (row[14] && row[14][0] ? row[14] : "null")
         << ",\"reviewed_by\":" << (row[15] && row[15][0] ? row[15] : "null")
         << ",\"reviewed_at\":" << (row[16] ? ("\"" + json_escape(row[16]) + "\"") : "null")
         << ",\"created_at\":\"" << json_escape(row[17] ? row[17] : "") << "\""
         << ",\"updated_at\":\"" << json_escape(row[18] ? row[18] : "") << "\"";
    return json.str();
}

static bool fetch_proposal(DbConn& db, int pid, MYSQL_ROW& out_row, MYSQL_RES*& out_res) {
    db.query("SELECT id, user_id, title, description, input_format, output_format, "
             "sample_input, sample_output, difficulty, time_limit, memory_limit, reference_code, "
             "status, admin_reason, question_id, reviewed_by, reviewed_at, created_at, updated_at "
             "FROM problem_proposals WHERE id=" + std::to_string(pid));
    out_res = db.store_result();
    if (!out_res) return false;
    out_row = mysql_fetch_row(out_res);
    return out_row != nullptr;
}

static void parse_basic_fields(const std::string& body,
                               std::string& title, std::string& description,
                               std::string& input_format, std::string& output_format,
                               std::string& sample_input, std::string& sample_output,
                               std::string& difficulty, int& time_limit, int& memory_limit) {
    title = extract_json_string(body, "title");
    description = extract_json_string(body, "description");
    input_format = extract_json_string(body, "input_format");
    output_format = extract_json_string(body, "output_format");
    sample_input = extract_json_string(body, "sample_input");
    sample_output = extract_json_string(body, "sample_output");
    difficulty = extract_json_string(body, "difficulty");
    time_limit = extract_json_int(body, "time_limit");
    if (time_limit <= 0) time_limit = 1;
    memory_limit = extract_json_int(body, "memory_limit");
    if (memory_limit <= 0) memory_limit = 256;
    if (difficulty.empty()) difficulty = "简单";
}

void register_proposal_routes(httplib::Server& svr) {
    // User: list my proposals
    svr.Get("/api/user/proposals", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user;
        if (!check_auth(req, res, user)) return;

        auto db = g_db->acquire();
        db->query("SELECT p.id, p.user_id, p.title, p.description, p.input_format, p.output_format, "
                  "p.sample_input, p.sample_output, p.difficulty, p.time_limit, p.memory_limit, p.reference_code, "
                  "p.status, p.admin_reason, p.question_id, p.reviewed_by, p.reviewed_at, p.created_at, p.updated_at, "
                  "q.display_index "
                  "FROM problem_proposals p "
                  "LEFT JOIN questions q ON p.question_id = q.id "
                  "WHERE p.user_id=" + std::to_string(user.id) +
                  " ORDER BY p.id DESC");

        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        while ((row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            json << build_proposal_json(row);
            json << ",\"question_display_index\":" << (row[19] && row[19][0] ? row[19] : "null") << "}";
        }
        if (result) mysql_free_result(result);
        json << "]";
        res.set_content(json.str(), "application/json");
    });

    // User: create proposal
    svr.Post("/api/user/proposals", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user;
        if (!check_auth(req, res, user)) return;

        std::string title, description, input_format, output_format, sample_input, sample_output, difficulty;
        int time_limit, memory_limit;
        parse_basic_fields(req.body, title, description, input_format, output_format,
                           sample_input, sample_output, difficulty, time_limit, memory_limit);

        if (title.empty() || description.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"标题和描述为必填\"}", "application/json");
            return;
        }
        if (!valid_difficulty(difficulty)) {
            res.status = 400;
            res.set_content("{\"error\":\"难度必须为：简单、中等、困难\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        if (count_pending_proposals(*db, user.id) >= 3) {
            res.status = 400;
            res.set_content("{\"error\":\"最多同时有 3 条待审核录题，请等待审核完成后再提交\"}", "application/json");
            return;
        }

        std::ostringstream sql;
        sql << "INSERT INTO problem_proposals (user_id, title, description, input_format, output_format, "
            << "sample_input, sample_output, difficulty, time_limit, memory_limit) VALUES ("
            << user.id << ", '"
            << db->escape(title) << "', '"
            << db->escape(description) << "', '"
            << db->escape(input_format) << "', '"
            << db->escape(output_format) << "', '"
            << db->escape(sample_input) << "', '"
            << db->escape(sample_output) << "', '"
            << db->escape(difficulty) << "', "
            << time_limit << ", " << memory_limit << ")";
        db->query(sql.str());
        int new_id = db->last_insert_id();
        LOG_INFO("User " + user.username + " submitted problem proposal #" + std::to_string(new_id));
        res.status = 201;
        res.set_content("{\"ok\":true,\"id\":" + std::to_string(new_id) + "}", "application/json");
    });

    // User: get single proposal
    svr.Get(R"(/api/user/proposals/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user;
        if (!check_auth(req, res, user)) return;
        int pid = std::stoi(req.matches[1]);

        auto db = g_db->acquire();
        MYSQL_ROW row;
        MYSQL_RES* result = nullptr;
        if (!fetch_proposal(*db, pid, row, result)) {
            res.status = 404;
            res.set_content("{\"error\":\"录题申请不存在\"}", "application/json");
            return;
        }
        if (std::stoi(row[1]) != user.id) {
            mysql_free_result(result);
            res.status = 403;
            res.set_content("{\"error\":\"无权查看\"}", "application/json");
            return;
        }
        std::ostringstream json;
        json << build_proposal_json(row) << "}";
        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    // User: edit rejected proposal and resubmit
    svr.Put(R"(/api/user/proposals/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser user;
        if (!check_auth(req, res, user)) return;
        int pid = std::stoi(req.matches[1]);

        auto db = g_db->acquire();
        db->query("SELECT user_id, status FROM problem_proposals WHERE id=" + std::to_string(pid));
        MYSQL_RES* check = db->store_result();
        if (!check || mysql_num_rows(check) == 0) {
            if (check) mysql_free_result(check);
            res.status = 404;
            res.set_content("{\"error\":\"录题申请不存在\"}", "application/json");
            return;
        }
        MYSQL_ROW crow = mysql_fetch_row(check);
        int owner_id = std::stoi(crow[0]);
        std::string status = crow[1] ? crow[1] : "";
        mysql_free_result(check);

        if (owner_id != user.id) {
            res.status = 403;
            res.set_content("{\"error\":\"无权修改\"}", "application/json");
            return;
        }
        if (status != "rejected") {
            res.status = 400;
            res.set_content("{\"error\":\"仅未通过的录题可修改后重新提交\"}", "application/json");
            return;
        }

        if (count_pending_proposals(*db, user.id) >= 3) {
            res.status = 400;
            res.set_content("{\"error\":\"最多同时有 3 条待审核录题\"}", "application/json");
            return;
        }

        std::string title, description, input_format, output_format, sample_input, sample_output, difficulty;
        int time_limit, memory_limit;
        parse_basic_fields(req.body, title, description, input_format, output_format,
                           sample_input, sample_output, difficulty, time_limit, memory_limit);

        if (title.empty() || description.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"标题和描述为必填\"}", "application/json");
            return;
        }
        if (!valid_difficulty(difficulty)) {
            res.status = 400;
            res.set_content("{\"error\":\"难度必须为：简单、中等、困难\"}", "application/json");
            return;
        }

        std::ostringstream sql;
        sql << "UPDATE problem_proposals SET "
            << "title='" << db->escape(title) << "', "
            << "description='" << db->escape(description) << "', "
            << "input_format='" << db->escape(input_format) << "', "
            << "output_format='" << db->escape(output_format) << "', "
            << "sample_input='" << db->escape(sample_input) << "', "
            << "sample_output='" << db->escape(sample_output) << "', "
            << "difficulty='" << db->escape(difficulty) << "', "
            << "time_limit=" << time_limit << ", "
            << "memory_limit=" << memory_limit << ", "
            << "status='pending', admin_reason=NULL, question_id=NULL, reviewed_by=NULL, reviewed_at=NULL "
            << "WHERE id=" << pid;
        db->query(sql.str());
        LOG_INFO("User " + user.username + " resubmitted proposal #" + std::to_string(pid));
        res.set_content("{\"ok\":true}", "application/json");
    });

    // Admin: list proposals
    svr.Get("/api/admin/proposals", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;

        std::string status_filter = req.has_param("status") ? req.get_param_value("status") : "all";
        int page = 1;
        if (req.has_param("page")) {
            try { page = std::stoi(req.get_param_value("page")); } catch (...) { page = 1; }
        }
        if (page < 1) page = 1;
        int per_page = 20;
        int offset = (page - 1) * per_page;

        std::string where = "1=1";
        if (status_filter == "pending" || status_filter == "approved" || status_filter == "rejected") {
            where = "p.status='" + status_filter + "'";
        }

        auto db = g_db->acquire();
        db->query("SELECT p.id, p.user_id, p.title, p.description, p.input_format, p.output_format, "
                  "p.sample_input, p.sample_output, p.difficulty, p.time_limit, p.memory_limit, p.reference_code, "
                  "p.status, p.admin_reason, p.question_id, p.reviewed_by, p.reviewed_at, p.created_at, p.updated_at, "
                  "u.username, q.display_index "
                  "FROM problem_proposals p "
                  "JOIN users u ON p.user_id = u.id "
                  "LEFT JOIN questions q ON p.question_id = q.id "
                  "WHERE " + where + " ORDER BY p.id DESC LIMIT " + std::to_string(per_page) +
                  " OFFSET " + std::to_string(offset));

        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        while ((row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            json << build_proposal_json(row);
            json << ",\"username\":\"" << json_escape(row[19] ? row[19] : "") << "\""
                 << ",\"question_display_index\":" << (row[20] && row[20][0] ? row[20] : "null") << "}";
        }
        if (result) mysql_free_result(result);
        json << "]";
        res.set_content(json.str(), "application/json");
    });

    // Admin: get single proposal
    svr.Get(R"(/api/admin/proposals/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int pid = std::stoi(req.matches[1]);

        auto db = g_db->acquire();
        MYSQL_ROW row;
        MYSQL_RES* result = nullptr;
        if (!fetch_proposal(*db, pid, row, result)) {
            res.status = 404;
            res.set_content("{\"error\":\"录题申请不存在\"}", "application/json");
            return;
        }

        db->query("SELECT username FROM users WHERE id=" + std::string(row[1]));
        MYSQL_RES* ur = db->store_result();
        std::string username;
        if (ur) {
            MYSQL_ROW urow = mysql_fetch_row(ur);
            if (urow && urow[0]) username = urow[0];
            mysql_free_result(ur);
        }

        std::ostringstream json;
        json << build_proposal_json(row);
        json << ",\"username\":\"" << json_escape(username) << "\"";
        if (row[14] && row[14][0]) {
            db->query("SELECT display_index FROM questions WHERE id=" + std::string(row[14]));
            MYSQL_RES* qr = db->store_result();
            if (qr) {
                MYSQL_ROW qrow = mysql_fetch_row(qr);
                json << ",\"question_display_index\":" << (qrow && qrow[0] ? qrow[0] : "null");
                mysql_free_result(qr);
            }
        }
        json << "}";
        mysql_free_result(result);
        res.set_content(json.str(), "application/json");
    });

    // Admin: edit proposal (basic + reference_code)
    svr.Put(R"(/api/admin/proposals/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int pid = std::stoi(req.matches[1]);

        auto db = g_db->acquire();
        db->query("SELECT status FROM problem_proposals WHERE id=" + std::to_string(pid));
        MYSQL_RES* check = db->store_result();
        if (!check || mysql_num_rows(check) == 0) {
            if (check) mysql_free_result(check);
            res.status = 404;
            res.set_content("{\"error\":\"录题申请不存在\"}", "application/json");
            return;
        }
        MYSQL_ROW crow = mysql_fetch_row(check);
        std::string status = crow[0] ? crow[0] : "";
        mysql_free_result(check);

        if (status != "pending") {
            res.status = 400;
            res.set_content("{\"error\":\"仅待审核的录题可编辑\"}", "application/json");
            return;
        }

        std::string title, description, input_format, output_format, sample_input, sample_output, difficulty;
        int time_limit, memory_limit;
        parse_basic_fields(req.body, title, description, input_format, output_format,
                           sample_input, sample_output, difficulty, time_limit, memory_limit);
        std::string reference_code = extract_json_string(req.body, "reference_code");

        if (!title.empty() && !description.empty()) {
            if (!valid_difficulty(difficulty)) {
                res.status = 400;
                res.set_content("{\"error\":\"难度必须为：简单、中等、困难\"}", "application/json");
                return;
            }
        }

        std::ostringstream sql;
        sql << "UPDATE problem_proposals SET ";
        bool first_field = true;
        auto append_field = [&](const std::string& fragment) {
            if (!first_field) sql << ", ";
            sql << fragment;
            first_field = false;
        };

        if (!title.empty()) append_field("title='" + db->escape(title) + "'");
        if (!description.empty()) append_field("description='" + db->escape(description) + "'");
        if (req.body.find("\"input_format\"") != std::string::npos)
            append_field("input_format='" + db->escape(input_format) + "'");
        if (req.body.find("\"output_format\"") != std::string::npos)
            append_field("output_format='" + db->escape(output_format) + "'");
        if (req.body.find("\"sample_input\"") != std::string::npos)
            append_field("sample_input='" + db->escape(sample_input) + "'");
        if (req.body.find("\"sample_output\"") != std::string::npos)
            append_field("sample_output='" + db->escape(sample_output) + "'");
        if (!difficulty.empty()) append_field("difficulty='" + db->escape(difficulty) + "'");
        if (req.body.find("\"time_limit\"") != std::string::npos)
            append_field("time_limit=" + std::to_string(time_limit));
        if (req.body.find("\"memory_limit\"") != std::string::npos)
            append_field("memory_limit=" + std::to_string(memory_limit));
        if (req.body.find("\"reference_code\"") != std::string::npos)
            append_field("reference_code='" + db->escape(reference_code) + "'");

        if (first_field) {
            res.status = 400;
            res.set_content("{\"error\":\"无有效更新字段\"}", "application/json");
            return;
        }
        sql << " WHERE id=" << pid;
        db->query(sql.str());
        res.set_content("{\"ok\":true}", "application/json");
    });

    // Admin: proposal test cases CRUD
    svr.Get(R"(/api/admin/proposals/(\d+)/testcases)", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int pid = std::stoi(req.matches[1]);

        auto db = g_db->acquire();
        db->query("SELECT id, input_data, expected_output, order_index FROM proposal_test_cases WHERE proposal_id=" +
                  std::to_string(pid) + " ORDER BY order_index ASC, id ASC");
        MYSQL_RES* result = db->store_result();
        std::ostringstream json;
        json << "[";
        bool first = true;
        MYSQL_ROW row;
        while ((row = mysql_fetch_row(result))) {
            if (!first) json << ",";
            first = false;
            json << "{\"id\":" << row[0]
                 << ",\"input_data\":\"" << json_escape(row[1] ? row[1] : "") << "\""
                 << ",\"expected_output\":\"" << json_escape(row[2] ? row[2] : "") << "\""
                 << ",\"order_index\":" << (row[3] ? row[3] : "0") << "}";
        }
        if (result) mysql_free_result(result);
        json << "]";
        res.set_content(json.str(), "application/json");
    });

    svr.Post(R"(/api/admin/proposals/(\d+)/testcases)", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int pid = std::stoi(req.matches[1]);

        std::string input_data = extract_json_string(req.body, "input_data");
        std::string expected_output = extract_json_string(req.body, "expected_output");
        if (input_data.empty() || expected_output.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"输入和期望输出为必填\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        int order_index = next_proposal_tc_order(*db, pid);
        std::ostringstream sql;
        sql << "INSERT INTO proposal_test_cases (proposal_id, input_data, expected_output, order_index) VALUES ("
            << pid << ", '" << db->escape(input_data) << "', '" << db->escape(expected_output) << "', " << order_index << ")";
        db->query(sql.str());
        res.status = 201;
        res.set_content("{\"ok\":true,\"id\":" + std::to_string(db->last_insert_id()) + "}", "application/json");
    });

    svr.Put(R"(/api/admin/proposals/(\d+)/testcases/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int pid = std::stoi(req.matches[1]);
        int tid = std::stoi(req.matches[2]);

        std::string input_data = extract_json_string(req.body, "input_data");
        std::string expected_output = extract_json_string(req.body, "expected_output");
        int order_index = extract_json_int(req.body, "order_index");

        auto db = g_db->acquire();
        std::ostringstream sql;
        sql << "UPDATE proposal_test_cases SET ";
        bool first_field = true;
        if (req.body.find("\"input_data\"") != std::string::npos) {
            sql << "input_data='" << db->escape(input_data) << "'";
            first_field = false;
        }
        if (req.body.find("\"expected_output\"") != std::string::npos) {
            if (!first_field) sql << ", ";
            sql << "expected_output='" << db->escape(expected_output) << "'";
            first_field = false;
        }
        if (req.body.find("\"order_index\"") != std::string::npos) {
            if (!first_field) sql << ", ";
            sql << "order_index=" << order_index;
        }
        sql << " WHERE id=" << tid << " AND proposal_id=" << pid;
        db->query(sql.str());
        res.set_content("{\"ok\":true}", "application/json");
    });

    svr.Delete(R"(/api/admin/proposals/(\d+)/testcases/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!check_admin(req, res)) return;
        int pid = std::stoi(req.matches[1]);
        int tid = std::stoi(req.matches[2]);

        auto db = g_db->acquire();
        db->query("DELETE FROM proposal_test_cases WHERE id=" + std::to_string(tid) +
                  " AND proposal_id=" + std::to_string(pid));
        res.set_content("{\"ok\":true}", "application/json");
    });

    // Admin: approve proposal
    svr.Post(R"(/api/admin/proposals/(\d+)/approve)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser admin;
        if (!check_auth(req, res, admin) || !admin.is_admin) {
            if (admin.valid && !admin.is_admin) {
                res.status = 403;
                res.set_content("{\"error\":\"需要管理员权限\"}", "application/json");
            }
            return;
        }
        int pid = std::stoi(req.matches[1]);
        std::string reason = extract_json_string(req.body, "reason");
        bool publish_immediately = extract_json_bool(req.body, "publish_immediately");

        auto db = g_db->acquire();
        MYSQL_ROW row;
        MYSQL_RES* result = nullptr;
        if (!fetch_proposal(*db, pid, row, result)) {
            res.status = 404;
            res.set_content("{\"error\":\"录题申请不存在\"}", "application/json");
            return;
        }

        std::string status = row[12] ? row[12] : "";
        if (status != "pending") {
            mysql_free_result(result);
            res.status = 400;
            res.set_content("{\"error\":\"该录题已审核完成\"}", "application/json");
            return;
        }

        std::string ref_code = row[11] ? row[11] : "";
        if (trim_copy(ref_code).empty()) {
            mysql_free_result(result);
            res.status = 400;
            res.set_content("{\"error\":\"通过前请先补充标程代码\"}", "application/json");
            return;
        }
        if (count_proposal_test_cases(*db, pid) <= 0) {
            mysql_free_result(result);
            res.status = 400;
            res.set_content("{\"error\":\"通过前请至少添加一个测试用例\"}", "application/json");
            return;
        }
        if (publish_immediately && (trim_copy(ref_code).empty() || count_proposal_test_cases(*db, pid) <= 0)) {
            mysql_free_result(result);
            res.status = 400;
            res.set_content("{\"error\":\"立即发布需要标程和至少一个测试用例\"}", "application/json");
            return;
        }

        int display_index = next_display_index(*db);
        std::ostringstream sql;
        sql << "INSERT INTO questions (display_index, title, description, input_format, output_format, "
            << "sample_input, sample_output, difficulty, reference_code, time_limit, memory_limit, is_visible) VALUES ("
            << display_index << ", '"
            << db->escape(row[2] ? row[2] : "") << "', '"
            << db->escape(row[3] ? row[3] : "") << "', '"
            << db->escape(row[4] ? row[4] : "") << "', '"
            << db->escape(row[5] ? row[5] : "") << "', '"
            << db->escape(row[6] ? row[6] : "") << "', '"
            << db->escape(row[7] ? row[7] : "") << "', '"
            << db->escape(row[8] ? row[8] : "简单") << "', '"
            << db->escape(ref_code) << "', "
            << (row[9] ? row[9] : "1") << ", "
            << (row[10] ? row[10] : "256") << ", "
            << (publish_immediately ? "1" : "0") << ")";
        db->query(sql.str());
        int qid = db->last_insert_id();

        db->query("SELECT input_data, expected_output, order_index FROM proposal_test_cases WHERE proposal_id=" +
                  std::to_string(pid) + " ORDER BY order_index ASC, id ASC");
        MYSQL_RES* tc_res = db->store_result();
        MYSQL_ROW tc_row;
        while ((tc_row = mysql_fetch_row(tc_res))) {
            std::ostringstream tc_sql;
            tc_sql << "INSERT INTO test_cases (question_id, input_data, expected_output, order_index) VALUES ("
                   << qid << ", '" << db->escape(tc_row[0] ? tc_row[0] : "") << "', '"
                   << db->escape(tc_row[1] ? tc_row[1] : "") << "', "
                   << (tc_row[2] ? tc_row[2] : "0") << ")";
            db->query(tc_sql.str());
        }
        if (tc_res) mysql_free_result(tc_res);

        std::ostringstream upd;
        upd << "UPDATE problem_proposals SET status='approved', admin_reason='" << db->escape(reason)
            << "', question_id=" << qid << ", reviewed_by=" << admin.id
            << ", reviewed_at=NOW() WHERE id=" << pid;
        db->query(upd.str());
        mysql_free_result(result);

        LOG_INFO("Admin approved proposal #" + std::to_string(pid) + " -> question #" + std::to_string(qid));
        std::ostringstream resp;
        resp << "{\"ok\":true,\"question_id\":" << qid << ",\"display_index\":" << display_index << "}";
        res.set_content(resp.str(), "application/json");
    });

    // Admin: reject proposal
    svr.Post(R"(/api/admin/proposals/(\d+)/reject)", [](const httplib::Request& req, httplib::Response& res) {
        AuthUser admin;
        if (!check_auth(req, res, admin) || !admin.is_admin) {
            if (admin.valid && !admin.is_admin) {
                res.status = 403;
                res.set_content("{\"error\":\"需要管理员权限\"}", "application/json");
            }
            return;
        }
        int pid = std::stoi(req.matches[1]);
        std::string reason = extract_json_string(req.body, "reason");
        if (trim_copy(reason).empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"请填写不通过理由\"}", "application/json");
            return;
        }

        auto db = g_db->acquire();
        db->query("SELECT status FROM problem_proposals WHERE id=" + std::to_string(pid));
        MYSQL_RES* check = db->store_result();
        if (!check || mysql_num_rows(check) == 0) {
            if (check) mysql_free_result(check);
            res.status = 404;
            res.set_content("{\"error\":\"录题申请不存在\"}", "application/json");
            return;
        }
        MYSQL_ROW crow = mysql_fetch_row(check);
        std::string status = crow[0] ? crow[0] : "";
        mysql_free_result(check);

        if (status != "pending") {
            res.status = 400;
            res.set_content("{\"error\":\"该录题已审核完成\"}", "application/json");
            return;
        }

        std::ostringstream sql;
        sql << "UPDATE problem_proposals SET status='rejected', admin_reason='" << db->escape(reason)
            << "', reviewed_by=" << admin.id << ", reviewed_at=NOW() WHERE id=" << pid;
        db->query(sql.str());
        LOG_INFO("Admin rejected proposal #" + std::to_string(pid));
        res.set_content("{\"ok\":true}", "application/json");
    });
}
