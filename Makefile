# 本地测试:  make clean && make && make run-local   → http://127.0.0.1:8081
# 生产更新:  bash deploy/update-prod.sh              → http://rinr.top
CXXFLAGS = -std=c++17 -O2 -Wall -Wextra -Wno-deprecated-declarations \
           -Iserver/include -I/usr/include/mysql \
           -DCPPHTTPLIB_OPENSSL_SUPPORT
LDFLAGS  = -lmysqlclient -lssl -lcrypto -largon2 \
           -L/usr/local/lib -lctemplate -lpthread -lz -lrt

SERVER_SRC = $(shell find server -name '*.cpp')
SERVER_OBJ = $(SERVER_SRC:.cpp=.o)
TARGET     = vibeoj

.PHONY: all clean run run-local

all: $(TARGET)

$(TARGET): $(SERVER_OBJ)
	$(CXX) $(CXXFLAGS) -o $@ $^ $(LDFLAGS)

server/%.o: server/%.cpp
	$(CXX) $(CXXFLAGS) -c -o $@ $<

clean:
	rm -f $(SERVER_OBJ) $(TARGET)

run: $(TARGET)
	mkdir -p /tmp/oj logs
	bash deploy/start.sh

run-local: $(TARGET)
	@mkdir -p /tmp/oj logs
	@if [ ! -f deploy/local.env ]; then \
		echo "请先创建 deploy/local.env："; \
		echo "  cp deploy/config.example.env deploy/local.env"; \
		echo "  编辑其中的 VIBEOJ_DB_PASSWORD（本地测试建议 VIBEOJ_PORT=8081）"; \
		exit 1; \
	fi
	VIBEOJ_ENV=local bash deploy/start.sh
