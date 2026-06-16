CREATE DATABASE IF NOT EXISTS vibeoj DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vibeoj;

CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(64)  NOT NULL UNIQUE,
    password_hash   VARCHAR(256) NOT NULL,
    is_admin        TINYINT(1)   NOT NULL DEFAULT 0,
    background_url  VARCHAR(512) DEFAULT NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL,
    token       VARCHAR(128) NOT NULL UNIQUE,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE questions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(256) NOT NULL,
    description     TEXT         NOT NULL,
    input_format    TEXT,
    output_format   TEXT,
    sample_input    TEXT,
    sample_output   TEXT,
    difficulty      ENUM('简单','中等','困难') NOT NULL DEFAULT '简单',
    time_limit      INT          NOT NULL DEFAULT 1,
    memory_limit    INT          NOT NULL DEFAULT 256,
    is_visible      TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE test_cases (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    question_id     INT  NOT NULL,
    input_data      TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    order_index     INT  NOT NULL DEFAULT 0,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE submissions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT          NOT NULL,
    question_id     INT          NOT NULL,
    code            TEXT         NOT NULL,
    status          ENUM('PENDING','COMPILING','RUNNING','AC','WA','TLE','MLE','RE','CE','SE') NOT NULL DEFAULT 'PENDING',
    compile_error   TEXT,
    total_time      INT,
    total_memory    INT,
    passed_count    INT,
    total_count     INT,
    detail_json     JSON,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);
