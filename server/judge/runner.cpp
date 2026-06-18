#include "runner.hpp"
#include "../util/tmpfile.hpp"
#include "../config.hpp"
#include "../util/logger.hpp"
#include <unistd.h>
#include <sys/wait.h>
#include <sys/time.h>
#include <signal.h>
#include <fcntl.h>
#include <cstring>
#include <iostream>
#include <errno.h>

extern Config g_config;

RunResult run_single(const std::string& binary_path, const TestCase& tc,
                     int time_limit_sec, int memory_limit_mb) {
    RunResult result;
    result.index = tc.order_index;
    result.expected_output = tc.expected_output;
    result.input_data = tc.input_data;
    result.time_ms = 0;
    result.memory_kb = 0;

    TmpFile input_file(g_config.tmp_dir, "oj_in_", ".txt");
    TmpFile output_file(g_config.tmp_dir, "oj_out_", ".txt");
    TmpFile err_file(g_config.tmp_dir, "oj_err_", ".txt");

    if (!input_file.valid() || !output_file.valid() || !err_file.valid()) {
        result.status = "SE";
        LOG_ERROR("Runner: failed to create temp files for test case #" + std::to_string(tc.order_index));
        return result;
    }

    write(input_file.fd(), tc.input_data.c_str(), tc.input_data.size());
    input_file.close();
    output_file.close();
    err_file.close();

    int input_fd = open(input_file.path().c_str(), O_RDONLY);
    int output_fd = open(output_file.path().c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0600);
    int err_fd = open(err_file.path().c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0600);

    if (input_fd < 0 || output_fd < 0 || err_fd < 0) {
        if (input_fd >= 0) close(input_fd);
        if (output_fd >= 0) close(output_fd);
        if (err_fd >= 0) close(err_fd);
        result.status = "SE";
        return result;
    }

    struct timeval start_tv, end_tv;
    gettimeofday(&start_tv, nullptr);

    pid_t pid = fork();
    if (pid == 0) {
        struct rlimit rl;

        rl.rlim_cur = time_limit_sec;
        rl.rlim_max = time_limit_sec + 1;
        setrlimit(RLIMIT_CPU, &rl);

        rlim_t mem_bytes = (rlim_t)memory_limit_mb * 1024 * 1024;
        rl.rlim_cur = mem_bytes;
        rl.rlim_max = mem_bytes + (1 * 1024 * 1024);
        setrlimit(RLIMIT_AS, &rl);

        rl.rlim_cur = 0;
        rl.rlim_max = 0;
        setrlimit(RLIMIT_CORE, &rl);

        rl.rlim_cur = 1;
        rl.rlim_max = 1;
        setrlimit(RLIMIT_NPROC, &rl);

        // Allow file writes up to 10MB for output buffering
        rl.rlim_cur = 10 * 1024 * 1024;
        rl.rlim_max = 10 * 1024 * 1024;
        setrlimit(RLIMIT_FSIZE, &rl);

        dup2(input_fd, STDIN_FILENO);
        dup2(output_fd, STDOUT_FILENO);
        dup2(err_fd, STDERR_FILENO);

        close(input_fd);
        close(output_fd);
        close(err_fd);

        execl(binary_path.c_str(), binary_path.c_str(), nullptr);
        _exit(127);
    } else if (pid > 0) {
        close(input_fd);
        close(output_fd);
        close(err_fd);

        int status = 0;
        struct rusage rusage;
        memset(&rusage, 0, sizeof(rusage));

        // Wall-clock timeout: poll with WNOHANG, kill child if exceeded
        int max_wait_ms = (time_limit_sec + 2) * 1000;
        int waited = 0;
        bool timed_out = false;

        while (waited < max_wait_ms) {
            pid_t w = wait4(pid, &status, WNOHANG, &rusage);
            if (w > 0) break;
            if (w < 0) {
                if (errno != EINTR && errno != EAGAIN) break;
            }
            usleep(50000); // 50ms
            waited += 50;
        }

        if (waited >= max_wait_ms) {
            timed_out = true;
            kill(pid, SIGKILL);
            waitpid(pid, &status, 0);
        }

        gettimeofday(&end_tv, nullptr);

        result.time_ms = (rusage.ru_utime.tv_sec + rusage.ru_stime.tv_sec) * 1000 +
                         (rusage.ru_utime.tv_usec + rusage.ru_stime.tv_usec) / 1000;
        result.memory_kb = rusage.ru_maxrss;

        // Read output
        {
            int fd = open(output_file.path().c_str(), O_RDONLY);
            if (fd >= 0) {
                char buf[8192];
                ssize_t n;
                while ((n = read(fd, buf, sizeof(buf))) > 0) {
                    result.actual_output.append(buf, n);
                }
                close(fd);
            }
        }

        auto trim = [](std::string& s) {
            while (!s.empty() && (s.back() == '\n' || s.back() == '\r' || s.back() == ' ')) {
                s.pop_back();
            }
        };
        trim(result.actual_output);
        trim(result.expected_output);

        if (timed_out) {
            result.status = "TLE";
        } else if (WIFEXITED(status)) {
            int exit_code = WEXITSTATUS(status);
            if (exit_code == 0) {
                if (result.actual_output == result.expected_output) {
                    result.status = "AC";
                } else {
                    result.status = "WA";
                }
            } else {
                result.status = "RE";
            }
        } else if (WIFSIGNALED(status)) {
            int sig = WTERMSIG(status);
            if (sig == SIGXCPU || sig == SIGKILL) {
                long wall_ms = (end_tv.tv_sec - start_tv.tv_sec) * 1000 +
                               (end_tv.tv_usec - start_tv.tv_usec) / 1000;
                if (wall_ms >= time_limit_sec * 1000) {
                    result.status = "TLE";
                } else {
                    result.status = "MLE";
                }
            } else if (sig == SIGSEGV) {
                result.status = "RE";
            } else {
                result.status = "RE";
            }
        } else {
            result.status = "SE";
        }
    } else {
        if (input_fd >= 0) close(input_fd);
        if (output_fd >= 0) close(output_fd);
        if (err_fd >= 0) close(err_fd);
        result.status = "SE";
        LOG_ERROR("Runner: fork() failed for test case #" + std::to_string(tc.order_index));
    }

    return result;
}
