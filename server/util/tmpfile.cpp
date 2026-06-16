#include "tmpfile.hpp"
#include <unistd.h>
#include <cstdlib>
#include <cstring>
#include <sys/stat.h>

bool init_tmp_dir(const std::string& dir) {
    struct stat st;
    if (stat(dir.c_str(), &st) == 0) {
        return S_ISDIR(st.st_mode);
    }
    return mkdir(dir.c_str(), 0700) == 0;
}

TmpFile::TmpFile(const std::string& dir, const std::string& prefix, const std::string& suffix) {
    path_ = dir + "/" + prefix + "XXXXXX" + suffix;
    fd_ = mkstemps(&path_[0], suffix.size());
}

TmpFile::~TmpFile() {
    if (fd_ >= 0) {
        close();
    }
    if (!path_.empty()) {
        unlink(path_.c_str());
    }
}

void TmpFile::close() {
    if (fd_ >= 0) {
        ::close(fd_);
        fd_ = -1;
    }
}
