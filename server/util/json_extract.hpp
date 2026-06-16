#pragma once
#include <string>
#include <cctype>

inline std::string json_escape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    out += "\\u00";
                    out += "0123456789abcdef"[(c >> 4) & 0xf];
                    out += "0123456789abcdef"[c & 0xf];
                } else {
                    out += c;
                }
                break;
        }
    }
    return out;
}

inline std::string extract_json_string(const std::string& body, const std::string& key) {
    std::string key_pattern = "\"" + key + "\"";
    size_t pos = body.find(key_pattern);
    if (pos == std::string::npos) return "";
    pos += key_pattern.size();

    while (pos < body.size() && std::isspace(body[pos])) pos++;
    if (pos >= body.size() || body[pos] != ':') return "";
    pos++;
    while (pos < body.size() && std::isspace(body[pos])) pos++;

    if (pos >= body.size() || body[pos] != '"') return "";
    pos++;

    std::string value;
    while (pos < body.size()) {
        if (body[pos] == '\\' && pos + 1 < body.size()) {
            switch (body[pos + 1]) {
                case '"':  value += '"';  break;
                case '\\': value += '\\'; break;
                case 'n':  value += '\n'; break;
                case 'r':  value += '\r'; break;
                case 't':  value += '\t'; break;
                default:   value += body[pos + 1]; break;
            }
            pos += 2;
        } else if (body[pos] == '"') {
            break;
        } else {
            value += body[pos];
            pos++;
        }
    }
    return value;
}

inline int extract_json_int(const std::string& body, const std::string& key) {
    std::string key_pattern = "\"" + key + "\"";
    size_t pos = body.find(key_pattern);
    if (pos == std::string::npos) return -1;
    pos += key_pattern.size();

    while (pos < body.size() && std::isspace(body[pos])) pos++;
    if (pos >= body.size() || body[pos] != ':') return -1;
    pos++;
    while (pos < body.size() && std::isspace(body[pos])) pos++;

    auto end = body.find_first_of(",}\n\r ", pos);
    if (end == std::string::npos) end = body.size();
    std::string num = body.substr(pos, end - pos);
    try { return std::stoi(num); } catch (...) { return -1; }
}

struct ValidationResult {
    bool valid = true;
    std::string error;
};

inline bool is_special_char(char c) {
    // Non-ambiguous special characters: _ - . @ ! # $ % ^ & * + = ~
    static const char specials[] = "_- .@!#$%^&*+=~";
    for (const char* p = specials; *p; ++p) {
        if (c == *p) return true;
    }
    return false;
}

inline ValidationResult validate_password(const std::string& username, const std::string& password) {
    ValidationResult r;

    if (username.size() < 3) {
        r.valid = false;
        r.error = "Username must be at least 3 characters";
        return r;
    }

    if (password.size() < 8) {
        r.valid = false;
        r.error = "Password must be at least 8 characters";
        return r;
    }

    bool has_digit = false, has_lower = false, has_upper = false, has_special = false;

    for (char c : password) {
        if (c >= '0' && c <= '9') has_digit = true;
        else if (c >= 'a' && c <= 'z') has_lower = true;
        else if (c >= 'A' && c <= 'Z') has_upper = true;
        else if (is_special_char(c)) has_special = true;
        else {
            r.valid = false;
            r.error = "Password contains invalid character: '" + std::string(1, c) +
                      "'. Allowed: a-z, A-Z, 0-9, _ - . @ ! # $ % ^ & * + = ~";
            return r;
        }
    }

    int types = (has_digit ? 1 : 0) + (has_lower ? 1 : 0) + (has_upper ? 1 : 0) + (has_special ? 1 : 0);
    if (types < 2) {
        r.valid = false;
        r.error = "Password must contain at least 2 character types (digit, lowercase, uppercase, special)";
        return r;
    }

    return r;
}
