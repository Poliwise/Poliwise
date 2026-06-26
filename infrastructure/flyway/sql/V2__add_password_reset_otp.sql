-- Create password_reset_otp table for OTP-based password reset
CREATE TABLE IF NOT EXISTS core.password_reset_otp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    reset_token VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_otp_email ON core.password_reset_otp(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otp_email_used ON core.password_reset_otp(email, used) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_password_reset_otp_expires ON core.password_reset_otp(expires_at);

COMMENT ON TABLE core.password_reset_otp IS 'Stores OTP codes for password reset functionality';
COMMENT ON COLUMN core.password_reset_otp.otp_code IS '6-digit OTP code sent to user email';
COMMENT ON COLUMN core.password_reset_otp.reset_token IS 'Unique token to prevent race conditions during reset';
COMMENT ON COLUMN core.password_reset_otp.expires_at IS 'Timestamp when OTP expires (default 5 minutes)';
