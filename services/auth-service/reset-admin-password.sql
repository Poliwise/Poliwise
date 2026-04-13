-- ===========================================
-- Reset Admin Password Script
-- Run this if admin account exists but password is unknown
-- ===========================================

-- Default password: Admin@123456
-- BCrypt hash for 'Admin@123456' (cost factor 10)
UPDATE auth.users 
SET 
    password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    failed_login_attempts = 0,
    status = 'ACTIVE',
    updated_at = NOW()
WHERE username = 'admin';

-- Verify the update
SELECT username, email, role, status, created_at, updated_at 
FROM auth.users 
WHERE username = 'admin';

-- If you need to set a custom password, generate a BCrypt hash for it first
-- Example: password = 'MyNewPassword123' -> generate hash using BCrypt tool
