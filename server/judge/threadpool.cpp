#include "threadpool.hpp"
#include "../util/logger.hpp"

ThreadPool::ThreadPool(size_t threads) {
    for (size_t i = 0; i < threads; ++i) {
        workers_.emplace_back([this] {
            while (true) {
                Task task;
                {
                    std::unique_lock<std::mutex> lock(mutex_);
                    cv_.wait(lock, [this] { return stop_.load() || !tasks_.empty(); });
                    if (stop_.load() && tasks_.empty()) return;
                    task = std::move(tasks_.front());
                    tasks_.pop();
                }
                try {
                    task();
                } catch (const std::exception& e) {
                    LOG_ERROR("Judge worker task threw exception: " + std::string(e.what()));
                } catch (...) {
                    LOG_ERROR("Judge worker task threw unknown exception");
                }
            }
        });
    }
}

ThreadPool::~ThreadPool() {
    stop_.store(true);
    cv_.notify_all();
    for (auto& w : workers_) {
        if (w.joinable()) w.join();
    }
}

void ThreadPool::enqueue(Task task) {
    {
        std::lock_guard<std::mutex> lock(mutex_);
        tasks_.push(std::move(task));
    }
    cv_.notify_one();
}
