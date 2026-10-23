-- 002_auth —— 服务端真鉴权所需列
ALTER TABLE students ADD COLUMN password_hash TEXT;
ALTER TABLE students ADD COLUMN username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_username_unique ON students(username);