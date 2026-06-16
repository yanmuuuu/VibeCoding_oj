#pragma once
#include <string>

std::string hash_password(const std::string& password);
bool verify_password(const std::string& password, const std::string& hash);
std::string generate_token(int length = 32);
std::string sha256(const std::string& data);
