CXX      = g++
CXXFLAGS = -std=c++17 -O2 -Wall -Wextra -Wno-deprecated-declarations \
           -Iserver/include -I/usr/include/mysql \
           -DCPPHTTPLIB_OPENSSL_SUPPORT
LDFLAGS  = -lmysqlclient -lssl -lcrypto -largon2 \
           -L/usr/local/lib -lctemplate -lpthread -lz -lrt

SERVER_SRC = $(shell find server -name '*.cpp')
SERVER_OBJ = $(SERVER_SRC:.cpp=.o)
TARGET     = vibeoj

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(SERVER_OBJ)
	$(CXX) $(CXXFLAGS) -o $@ $^ $(LDFLAGS)

server/%.o: server/%.cpp
	$(CXX) $(CXXFLAGS) -c -o $@ $<

clean:
	rm -f $(SERVER_OBJ) $(TARGET)

run: $(TARGET)
	mkdir -p /tmp/oj
	./$(TARGET)
