-- Seed data for VibeOJ
-- Run after schema.sql

-- Admin user (password: admin123) - you need to generate the hash via the server
-- INSERT INTO users (username, password_hash, is_admin) VALUES ('admin', '$argon2id$...', 1);

-- Sample problems
INSERT INTO questions (title, description, input_format, output_format, sample_input, sample_output, difficulty, time_limit, memory_limit, is_visible) VALUES
('A+B Problem', '给定两个整数 a 和 b，输出 a+b 的结果。', '一行，包含两个整数 a 和 b，以空格分隔。', '一个整数，表示 a+b 的结果。', '1 2', '3', '简单', 1, 256, 1),
('最大子数组和', '给定一个整数数组，找到和最大的连续子数组，并返回其最大和。', '第一行一个整数 n，表示数组长度。第二行 n 个整数，以空格分隔。', '一个整数，表示最大子数组和。', '9\n-2 1 -3 4 -1 2 1 -5 4', '6', '中等', 1, 256, 1);

-- Test cases for Problem 1 (A+B Problem)
INSERT INTO test_cases (question_id, input_data, expected_output, order_index) VALUES
(1, '1 2', '3', 0),
(1, '10 20', '30', 1),
(1, '-5 5', '0', 2),
(1, '100 200', '300', 3),
(1, '0 0', '0', 4),
(1, '-10 -20', '-30', 5),
(1, '999 1', '1000', 6),
(1, '50 -50', '0', 7),
(1, '123456 654321', '777777', 8),
(1, '-100 -100', '-200', 9);

-- Test cases for Problem 2 (Max Subarray)
INSERT INTO test_cases (question_id, input_data, expected_output, order_index) VALUES
(2, '9\n-2 1 -3 4 -1 2 1 -5 4', '6', 0),
(2, '1\n5', '5', 1),
(2, '5\n-1 -2 -3 -4 -5', '-1', 2),
(2, '6\n1 2 3 4 5 6', '21', 3),
(2, '5\n2 -1 2 -1 2', '4', 4);
