#pragma once
#include <string>

bool init_tmp_dir(const std::string& dir);

class TmpFile {
public:
    TmpFile(const std::string& dir, const std::string& prefix, const std::string& suffix);
    ~TmpFile();
    const std::string& path() const { return path_; }
    bool valid() const { return fd_ >= 0; }
    int fd() const { return fd_; }
    void close();

private:
    std::string path_;
    int fd_ = -1;
};
