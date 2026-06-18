#include "compiler.hpp"
#include "../util/tmpfile.hpp"
#include "../util/logger.hpp"
#include <unistd.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <signal.h>
#include <fcntl.h>
#include <cstring>
#include <iostream>

CompileResult compile_code(const std::string& code, const std::string& tmp_dir, int timeout_sec) {
    CompileResult result;
    TmpFile src(tmp_dir, "oj_", ".cpp");
    if (!src.valid()) {
        result.error = "Failed to create source temp file";
        LOG_ERROR("Compile: failed to create source temp file");
        return result;
    }
    // Write code to temp file
    if (write(src.fd(), code.c_str(), code.size()) < 0) {
        result.error = "Failed to write source code";
        LOG_ERROR("Compile: failed to write source code to temp file");
        return result;
    }
    src.close();

    // Output binary path
    std::string bin_path = src.path().substr(0, src.path().size() - 4);
    // Remove .cpp suffix for binary
    size_t dot_pos = bin_path.rfind('.');
    if (dot_pos != std::string::npos && bin_path.substr(dot_pos) == ".cpp") {
        bin_path = bin_path.substr(0, dot_pos);
    }

    // Create stderr capture file
    TmpFile err_file(tmp_dir, "oj_ce_", ".txt");
    if (!err_file.valid()) {
        result.error = "Failed to create stderr temp file";
        return result;
    }

    pid_t pid = fork();
    if (pid == 0) {
        // Child: run g++
        dup2(err_file.fd(), STDERR_FILENO);
        close(err_file.fd());
        execlp("g++", "g++", "-O2", "-std=c++17", "-o", bin_path.c_str(),
               src.path().c_str(), nullptr);
        _exit(1);
    } else if (pid > 0) {
        err_file.close();

        // Wait with timeout
        int status;
        bool timed_out = false;
        int waited = 0;
        while (waited < timeout_sec * 10) {
            pid_t w = waitpid(pid, &status, WNOHANG);
            if (w == pid) break;
            if (w < 0) break;
            usleep(100000); // 100ms
            waited++;
        }
        if (waited >= timeout_sec * 10) {
            timed_out = true;
            kill(pid, SIGKILL);
            waitpid(pid, &status, 0);
        }

        // Read stderr
        std::string stderr_output;
        {
            int fd = open(err_file.path().c_str(), O_RDONLY);
            if (fd >= 0) {
                char buf[4096];
                ssize_t n;
                while ((n = read(fd, buf, sizeof(buf))) > 0) {
                    stderr_output.append(buf, n);
                }
                close(fd);
            }
        }

        if (timed_out) {
            result.error = "Compilation timed out";
            LOG_WARNING("Compile: timed out after " + std::to_string(timeout_sec) + "s");
            return result;
        }

        if (!WIFEXITED(status) || WEXITSTATUS(status) != 0) {
            result.error = stderr_output.empty() ? "Compilation failed" : stderr_output;
            LOG_WARNING("Compile: failed - " + result.error);
            return result;
        }

        // Check binary exists
        struct stat st;
        if (stat(bin_path.c_str(), &st) != 0) {
            result.error = "Binary not found after compilation";
            LOG_ERROR("Compile: binary not found at " + bin_path + " after successful compilation");
            return result;
        }

        result.success = true;
        result.binary_path = bin_path;
        LOG_DEBUG("Compile: success -> " + bin_path + " (" + std::to_string(st.st_size) + " bytes)");
        return result;
    } else {
        result.error = "fork() failed";
        LOG_ERROR("Compile: fork() failed");
        return result;
    }
}
