-- Phase 34: 用户录题申请 + 管理员审核
USE vibeoj;

CREATE TABLE problem_proposals (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT          NOT NULL,
    title           VARCHAR(256) NOT NULL,
    description     TEXT         NOT NULL,
    input_format    TEXT,
    output_format   TEXT,
    sample_input    TEXT,
    sample_output   TEXT,
    difficulty      ENUM('简单','中等','困难') NOT NULL DEFAULT '简单',
    time_limit      INT          NOT NULL DEFAULT 1,
    memory_limit    INT          NOT NULL DEFAULT 256,
    reference_code  TEXT         DEFAULT NULL,
    status          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    admin_reason    TEXT         DEFAULT NULL,
    question_id     INT          DEFAULT NULL,
    reviewed_by     INT          DEFAULT NULL,
    reviewed_at     DATETIME     DEFAULT NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_proposals_user (user_id),
    INDEX idx_proposals_status (status)
);

CREATE TABLE proposal_test_cases (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    proposal_id     INT  NOT NULL,
    input_data      TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    order_index     INT  NOT NULL DEFAULT 0,
    FOREIGN KEY (proposal_id) REFERENCES problem_proposals(id) ON DELETE CASCADE
);
