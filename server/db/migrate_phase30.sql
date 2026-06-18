-- Phase 30: 私信消息撤回
USE vibeoj;

ALTER TABLE messages
    ADD COLUMN is_recalled TINYINT(1) NOT NULL DEFAULT 0 AFTER is_read;
