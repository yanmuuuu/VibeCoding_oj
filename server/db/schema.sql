CREATE DATABASE IF NOT EXISTS vibeoj DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vibeoj;

CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(64)  NOT NULL UNIQUE,
    password_hash   VARCHAR(256) NOT NULL,
    is_admin        TINYINT(1)   NOT NULL DEFAULT 0,
    is_banned       TINYINT(1)   NOT NULL DEFAULT 0,
    background_url  VARCHAR(512) DEFAULT NULL,
    avatar_url      VARCHAR(512) DEFAULT NULL,
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
    reference_code  TEXT         DEFAULT NULL,
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

CREATE TABLE announcements (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(256) NOT NULL,
    content         TEXT         NOT NULL,
    is_pinned       TINYINT(1)   NOT NULL DEFAULT 0,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE discussions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT      NOT NULL,
    content     TEXT     NOT NULL,
    like_count  INT      NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE discussion_replies (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    discussion_id   INT      NOT NULL,
    user_id         INT      NOT NULL,
    parent_reply_id INT      DEFAULT NULL,
    content         TEXT     NOT NULL,
    like_count      INT      NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (discussion_id)  REFERENCES discussions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)        REFERENCES users(id)       ON DELETE CASCADE,
    FOREIGN KEY (parent_reply_id) REFERENCES discussion_replies(id) ON DELETE CASCADE
);

CREATE TABLE discussion_likes (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL,
    target_type ENUM('discussion','reply') NOT NULL,
    target_id   INT          NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_dlike_user_target (user_id, target_type, target_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE problem_comments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT      NOT NULL,
    user_id     INT      NOT NULL,
    content     TEXT     NOT NULL,
    like_count  INT      NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE
);

CREATE TABLE comment_replies (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    comment_id       INT      NOT NULL,
    user_id          INT      NOT NULL,
    parent_reply_id  INT      DEFAULT NULL,
    content          TEXT     NOT NULL,
    like_count       INT      NOT NULL DEFAULT 0,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id)       REFERENCES problem_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)          REFERENCES users(id)            ON DELETE CASCADE,
    FOREIGN KEY (parent_reply_id)  REFERENCES comment_replies(id)  ON DELETE CASCADE
);

CREATE TABLE comment_likes (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL,
    target_type ENUM('comment','reply') NOT NULL,
    target_id   INT          NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_clike_user_target (user_id, target_type, target_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
