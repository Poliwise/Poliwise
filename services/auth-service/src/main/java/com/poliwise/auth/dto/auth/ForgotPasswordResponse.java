package com.poliwise.auth.dto.auth;

import java.util.UUID;

public record ForgotPasswordResponse(
        String message,
        boolean emailSent
) {
    public static ForgotPasswordResponse success() {
        return new ForgotPasswordResponse("Nếu email tồn tại trong hệ thống, mật khẩu mới sẽ được gửi đến email của bạn.", true);
    }

    public static ForgotPasswordResponse notFound() {
        return new ForgotPasswordResponse("Nếu email tồn tại trong hệ thống, mật khẩu mới sẽ được gửi đến email của bạn.", true);
    }
}
