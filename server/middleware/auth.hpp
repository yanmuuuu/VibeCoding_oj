#pragma once
#include <string>
#include <httplib.h>

struct AuthUser {
    int id;
    std::string username;
    bool is_admin;
    bool valid;
};

AuthUser authenticate(const httplib::Request& req);
