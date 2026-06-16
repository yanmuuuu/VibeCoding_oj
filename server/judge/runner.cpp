#include "runner.hpp"
#include "../util/tmpfile.hpp"
#include <unistd.h>
#include <sys/wait.h>
#include <sys/time.h>
#include <signal.h>
#include <fcntl.h>
#include <cstring>
#include <iostream>

RunResult run_single(const std::string& binary_path, const TestCase& tc,
                     int time_limit_sec, int memory_limit_mb) {
    RunResult result;
    result.index = tc.order_index;
    result.expected_output = tc.expected_output;
    result.input_data = tc.input_data;
    result.time_ms = 0;
    result.memory_kb = 0;

    TmpFile input_file("/tmp/oj", "oj_in_", ".txt");
    TmpFile output_file("/tmp/oj", "oj_out_", ".txt");
    TmpFile err_file("/tmp/oj", "oj_err_", ".txt");

    if (!input_file.valid() || !output_file.valid() || !err_file.valid()) {
        result.status = "SE";
        return result;
    }

    // Write input data
    write(input_file.fd(), tc.input_data.c_str(), tc.input_data.size());
    input_file.close();
    output_file.close();
    err_file.close();

    // Reopen input for reading
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
        // Child process
        // Set resource limits
        struct rlimit rl;

        // CPU time limit (seconds)
        rl.rlim_cur = time_limit_sec;
        rl.rlim_max = time_limit_sec + 1;
        setrlimit(RLIMIT_CPU, &rl);

        // Address space limit (memory in bytes)
        rlim_t mem_bytes = (rlim_t)memory_limit_mb * 1024 * 1024;
        rl.rlim_cur = mem_bytes;
        rl.rlim_max = mem_bytes + (1 * 1024 * 1024);
        setrlimit(RLIMIT_AS, &rl);

        // No core dump
        rl.rlim_cur = 0;
        rl.rlim_max = 0;
        setrlimit(RLIMIT_CORE, &rl);

        // No fork
        rl.rlim_cur = 1;
        rl.rlim_max = 1;
        setrlimit(RLIMIT_NPROC, &rl);

        // No file writing
        rl.rlim_cur = 0;
        rl.rlim_max = 0;
        setrlimit(RLIMIT_FSIZE, &rl);

        // No file descriptors beyond stdio
        rl.rlim_cur = 0;
        rl.rlim_max = 0;
        setrlimit(RLIMIT_NOFILE, &rl);

        // Redirect stdin/stdout/stderr
        dup2(input_fd, STDIN_FILENO);
        dup2(output_fd, STDOUT_FILENO);
        dup2(err_fd, STDERR_FILENO);

        // Close all other file descriptors
        close(input_fd);
        close(output_fd);
        close(err_fd);

        // Execute
        execl(binary_path.c_str(), binary_path.c_str(), nullptr);
        _exit(127);
    } else if (pid > 0) {
        close(input_fd);
        close(output_fd);
        close(err_fd);

        int status;
        struct rusage rusage;
        wait4(pid, &status, 0, &rusage);

        gettimeofday(&end_tv, nullptr);

        // Calculate time
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

        // Trim trailing newlines for comparison
        auto trim = [](std::string& s) {
            while (!s.empty() && (s.back() == '\n' || s.back() == '\r' || s.back() == ' ')) {
                s.pop_back();
            }
        };
        trim(result.actual_output);
        trim(result.expected_output);

        // Determine status
        if (WIFEXITED(status)) {
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
                // Could be TLE or MLE - check if time exceeded
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
    }

    return result;
}
