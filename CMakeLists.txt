cmake_minimum_required(VERSION 3.14)
project(VibeOJ LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O2 -Wall -Wextra -Wno-deprecated-declarations")

# 头文件路径
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/server/include)
include_directories(/usr/include/mysql)

# cpp-httplib OpenSSL 支持（header-only，不需链接）
add_definitions(-DCPPHTTPLIB_OPENSSL_SUPPORT)

# 查找系统库
find_package(PkgConfig REQUIRED)

# MySQL C 客户端
pkg_check_modules(MYSQL REQUIRED mysqlclient)
include_directories(${MYSQL_INCLUDE_DIRS})

# OpenSSL（SHA256、随机数）
find_package(OpenSSL REQUIRED)
include_directories(${OPENSSL_INCLUDE_DIR})

# Argon2
find_library(ARGON2_LIB argon2 REQUIRED)
include_directories(/usr/include)

# ctemplate（安装于 /usr/local）
pkg_check_modules(CTEMPLATE libctemplate)
if(NOT CTEMPLATE_FOUND)
    set(CTEMPLATE_INCLUDE_DIRS /usr/local/include)
    set(CTEMPLATE_LIBRARIES /usr/local/lib/libctemplate.so)
endif()
include_directories(${CTEMPLATE_INCLUDE_DIRS})

# Zlib（MySQL 依赖）
find_package(ZLIB REQUIRED)

# 源文件
file(GLOB_RECURSE SERVER_SOURCES "server/*.cpp")

# 编译目标
add_executable(vibeoj ${SERVER_SOURCES})

# 链接库
target_link_libraries(vibeoj
    ${MYSQL_LIBRARIES}
    ${OPENSSL_LIBRARIES}
    ${ARGON2_LIB}
    ${CTEMPLATE_LIBRARIES}
    ${ZLIB_LIBRARIES}
    pthread
    rt
)
