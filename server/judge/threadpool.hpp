#pragma once
#include <functional>
#include <thread>
#include <vector>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <atomic>

class ThreadPool {
public:
    using Task = std::function<void()>;

    ThreadPool(size_t threads);
    ~ThreadPool();

    void enqueue(Task task);

private:
    std::vector<std::thread> workers_;
    std::queue<Task> tasks_;
    std::mutex mutex_;
    std::condition_variable cv_;
    std::atomic<bool> stop_{false};
};
