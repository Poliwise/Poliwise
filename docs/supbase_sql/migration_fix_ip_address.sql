-- Migration: Change ip_address from INET to VARCHAR
-- Date: 2026-04-06

-- Change login_history.ip_address from INET to VARCHAR
ALTER TABLE core.login_history
ALTER COLUMN ip_address TYPE VARCHAR(45);

-- Change refresh_tokens.ip_address from INET to VARCHAR
ALTER TABLE core.refresh_tokens
ALTER COLUMN ip_address TYPE VARCHAR(45);
