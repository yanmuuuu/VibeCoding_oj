-- Phase 31: 题目展示编号 display_index（从 0 开始，与数据库 id 解耦）
USE vibeoj;

ALTER TABLE questions
    ADD COLUMN display_index INT NOT NULL DEFAULT 0 AFTER id;

-- 已有题目按 id 升序赋 0, 1, 2...
SET @idx := -1;
UPDATE questions SET display_index = (@idx := @idx + 1) ORDER BY id ASC;

CREATE INDEX idx_questions_display_index ON questions (display_index);
