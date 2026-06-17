-- Phase 27: 管理员后台增强
USE vibeoj;

ALTER TABLE questions ADD COLUMN reference_code TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN is_banned TINYINT(1) NOT NULL DEFAULT 0;
