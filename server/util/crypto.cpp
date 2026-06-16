#include "crypto.hpp"
#include <openssl/evp.h>
#include <openssl/sha.h>
#include <openssl/rand.h>
#include <argon2.h>
#include <cstring>
#include <sstream>
#include <iomanip>
#include <stdexcept>

static const uint32_t ARGON2_T = 3;
static const uint32_t ARGON2_M = 1 << 16; // 64 MB
static const uint32_t ARGON2_P = 4;
static const size_t   SALT_LEN = 16;
static const size_t   HASH_LEN = 32;

std::string hash_password(const std::string& password) {
    unsigned char salt[SALT_LEN];
    if (RAND_bytes(salt, SALT_LEN) != 1) {
        throw std::runtime_error("RAND_bytes failed");
    }
    size_t encoded_len = argon2_encodedlen(ARGON2_T, ARGON2_M, ARGON2_P, SALT_LEN, HASH_LEN, Argon2_id);
    std::string encoded(encoded_len, '\0');
    int ret = argon2id_hash_encoded(ARGON2_T, ARGON2_M, ARGON2_P,
                                    password.c_str(), password.size(),
                                    salt, SALT_LEN, HASH_LEN,
                                    &encoded[0], encoded_len);
    if (ret != ARGON2_OK) {
        throw std::runtime_error(std::string("argon2id_hash_encoded failed: ") + argon2_error_message(ret));
    }
    // Remove trailing nulls
    encoded.resize(std::strlen(encoded.c_str()));
    return encoded;
}

bool verify_password(const std::string& password, const std::string& hash) {
    int ret = argon2id_verify(hash.c_str(), password.c_str(), password.size());
    return ret == ARGON2_OK;
}

std::string sha256(const std::string& data) {
    unsigned char digest[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char*>(data.c_str()), data.size(), digest);
    std::ostringstream oss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; ++i) {
        oss << std::hex << std::setfill('0') << std::setw(2) << (int)digest[i];
    }
    return oss.str();
}

std::string generate_token(int length) {
    std::string buf(length, '\0');
    if (RAND_bytes(reinterpret_cast<unsigned char*>(&buf[0]), length) != 1) {
        throw std::runtime_error("RAND_bytes for token failed");
    }
    std::ostringstream oss;
    for (int i = 0; i < length; ++i) {
        oss << std::hex << std::setfill('0') << std::setw(2) << (int)(unsigned char)buf[i];
    }
    return oss.str();
}
