cmake_minimum_required(VERSION 3.14)
project(VibeOJ LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O2 -Wall -Wextra -Wno-deprecated-declarations")

# cpp-httplib OpenSSL 支持（header-only，不需链接）
add_definitions(-DCPPHTTPLIB_OPENSSL_SUPPORT)

# 查找系统库
find_package(PkgConfig REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(ZLIB REQUIRED)

# MySQL C 客户端
pkg_check_modules(MYSQL REQUIRED mysqlclient)

# Argon2
find_library(ARGON2_LIB argon2 REQUIRED)

# ctemplate（安装于 /usr/local）
pkg_check_modules(CTEMPLATE libctemplate)
if(NOT CTEMPLATE_FOUND)
    set(CTEMPLATE_INCLUDE_DIRS /usr/local/include)
    set(CTEMPLATE_LIBRARIES /usr/local/lib/libctemplate.so)
endif()

# 源文件（CONFIGURE_DEPENDS 确保新增 .cpp 文件时 cmake 自动重新扫描）
file(GLOB_RECURSE SERVER_SOURCES CONFIGURE_DEPENDS "server/*.cpp")

# 编译目标
add_executable(vibeoj ${SERVER_SOURCES})

target_include_directories(vibeoj PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/server/include
    /usr/include/mysql
    ${MYSQL_INCLUDE_DIRS}
    ${OPENSSL_INCLUDE_DIR}
    /usr/include
    ${CTEMPLATE_INCLUDE_DIRS}
)

target_link_libraries(vibeoj
    ${MYSQL_LIBRARIES}
    ${OPENSSL_LIBRARIES}
    ${ARGON2_LIB}
    ${CTEMPLATE_LIBRARIES}
    ${ZLIB_LIBRARIES}
    pthread
    rt
)
