package com.poliwise.auth.service;

import com.poliwise.auth.config.EmailProperties;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final EmailProperties emailProperties;

    public EmailService(JavaMailSender mailSender, EmailProperties emailProperties) {
        this.mailSender = mailSender;
        this.emailProperties = emailProperties;
    }

    public CompletableFuture<Boolean> sendAccountCredentials(String toEmail, String username, String password) {
        log.info("[EMAIL] sendAccountCredentials called - to: {}, username: {}", maskEmail(toEmail), username);
        if (!emailProperties.enabled()) {
            log.warn("[EMAIL DISABLED] Would send credentials to {} for user {}", maskEmail(toEmail), username);
            return CompletableFuture.completedFuture(false);
        }

        return sendEmailAsync(toEmail, "Tài khoản Poliwise của bạn đã được tạo",
                buildCredentialsEmail(username, password));
    }

    public CompletableFuture<Boolean> sendPasswordReset(String toEmail, String username, String newPassword) {
        if (!emailProperties.enabled()) {
            log.warn("[EMAIL DISABLED] Would send password reset to {} for user {}", toEmail, username);
            return CompletableFuture.completedFuture(false);
        }

        return sendEmailAsync(toEmail, "Khôi phục mật khẩu Poliwise",
                buildPasswordResetEmail(username, newPassword));
    }

    public CompletableFuture<Boolean> sendBulkAccountCredentials(
            String toEmail,
            String username,
            String password,
            String adminName
    ) {
        if (!emailProperties.enabled()) {
            log.warn("[EMAIL DISABLED] Would send bulk credentials to {} for user {}", toEmail, username);
            return CompletableFuture.completedFuture(false);
        }

        return sendEmailAsync(toEmail, "Tài khoản Poliwise - Thông tin đăng nhập",
                buildBulkCredentialsEmail(username, password, adminName));
    }

    /**
     * Gửi email thông báo khi tài khoản bị vô hiệu hóa (DEACTIVATED).
     */
    public CompletableFuture<Boolean> sendAccountDeactivatedEmail(String toEmail, String username, String adminName) {
        if (!emailProperties.enabled()) {
            log.warn("[EMAIL DISABLED] Would send deactivated email to {} for user {}", toEmail, username);
            return CompletableFuture.completedFuture(false);
        }

        return sendEmailAsync(toEmail, "Thông báo: Tài khoản Poliwise của bạn đã bị tạm ngưng",
                buildAccountDeactivatedEmail(username, adminName));
    }

    /**
     * Gửi email thông báo khi tài khoản được kích hoạt lại (ACTIVE).
     */
    public CompletableFuture<Boolean> sendAccountReactivatedEmail(String toEmail, String username, String adminName) {
        if (!emailProperties.enabled()) {
            log.warn("[EMAIL DISABLED] Would send reactivated email to {} for user {}", toEmail, username);
            return CompletableFuture.completedFuture(false);
        }

        return sendEmailAsync(toEmail, "Thông báo: Tài khoản Poliwise của bạn đã được kích hoạt lại",
                buildAccountReactivatedEmail(username, adminName));
    }

    /**
     * Gửi email thông báo khi tài khoản bị thu hồi (REVOKED).
     */
    public CompletableFuture<Boolean> sendAccountRevokedEmail(String toEmail, String username, String adminName) {
        if (!emailProperties.enabled()) {
            log.warn("[EMAIL DISABLED] Would send revoked email to {} for user {}", toEmail, username);
            return CompletableFuture.completedFuture(false);
        }

        return sendEmailAsync(toEmail, "Thông báo: Tài khoản Poliwise của bạn đã bị thu hồi",
                buildAccountRevokedEmail(username, adminName));
    }

    /**
     * Gửi email thông báo khi tài khoản bị xóa (SOFT DELETED).
     */
    public CompletableFuture<Boolean> sendAccountDeletedEmail(String toEmail, String username, String adminName) {
        if (!emailProperties.enabled()) {
            log.warn("[EMAIL DISABLED] Would send deleted email to {} for user {}", toEmail, username);
            return CompletableFuture.completedFuture(false);
        }

        return sendEmailAsync(toEmail, "Thông báo: Tài khoản Poliwise của bạn đã bị xóa",
                buildAccountDeletedEmail(username, adminName));
    }

    private String buildAccountDeactivatedEmail(String username, String adminName) {
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .alert { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f39c12; }
                .info { background: #e8f4f8; padding: 15px; border-radius: 8px; margin-top: 20px; }
                .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Tài khoản bị tạm ngưng</h1>
                <p>Thông báo từ hệ thống Poliwise</p>
            </div>
            <div class="content">
                <p>Xin chào <strong>__USERNAME__</strong>,</p>
                <p>Tài khoản Poliwise của bạn đã bị <strong>tạm ngưng</strong> bởi quản trị viên <strong>__ADMINNAME__</strong>.</p>

                <div class="alert">
                    <h3>Tình trạng tài khoản</h3>
                    <ul>
                        <li>Tên đăng nhập: <strong>__USERNAME__</strong></li>
                        <li>Trạng thái: <span style="color: #e67e22;">TẠM NGƯNG</span></li>
                    </ul>
                </div>

                <div class="info">
                    <strong>Lưu ý:</strong>
                    <ul>
                        <li>Bạn hiện không thể đăng nhập vào hệ thống</li>
                        <li>Liên hệ quản trị viên nếu bạn cần được hỗ trợ</li>
                        <li>Tài khoản có thể được kích hoạt lại trong tương lai</li>
                    </ul>
                </div>
            </div>
            <div class="footer">
                <p>Email này được gửi tự động từ hệ thống Poliwise.</p>
                <p>Không trả lời email này.</p>
            </div>
        </body>
        </html>
        """.replace("__USERNAME__", escapeHtml(username))
          .replace("__ADMINNAME__", escapeHtml(adminName));
    }

    private String buildAccountReactivatedEmail(String username, String adminName) {
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .success { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60; }
                .info { background: #e8f8f5; padding: 15px; border-radius: 8px; margin-top: 20px; }
                .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
                a { color: #27ae60; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Tài khoản đã được kích hoạt lại</h1>
                <p>Thông báo từ hệ thống Poliwise</p>
            </div>
            <div class="content">
                <p>Xin chào <strong>__USERNAME__</strong>,</p>
                <p>Tài khoản Poliwise của bạn đã được <strong>kích hoạt lại</strong> bởi quản trị viên <strong>__ADMINNAME__</strong>.</p>

                <div class="success">
                    <h3>Tình trạng tài khoản</h3>
                    <ul>
                        <li>Tên đăng nhập: <strong>__USERNAME__</strong></li>
                        <li>Trạng thái: <span style="color: #27ae60;">HOẠT ĐỘNG</span></li>
                    </ul>
                </div>

                <div class="info">
                    <strong>Bạn có thể:</strong>
                    <ul>
                        <li>Đăng nhập vào hệ thống Poliwise</li>
                        <li>Sử dụng tất cả các tính năng như bình thường</li>
                    </ul>
                    <p>Đăng nhập tại: <a href="#">https://poliwise.vn</a></p>
                </div>
            </div>
            <div class="footer">
                <p>Email này được gửi tự động từ hệ thống Poliwise.</p>
                <p>Không trả lời email này.</p>
            </div>
        </body>
        </html>
        """.replace("__USERNAME__", escapeHtml(username))
          .replace("__ADMINNAME__", escapeHtml(adminName));
    }

    private String buildAccountRevokedEmail(String username, String adminName) {
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .alert { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #c0392b; }
                .warning { background: #fdf2f2; border: 1px solid #f5c6cb; padding: 15px; border-radius: 8px; margin-top: 20px; }
                .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Tài khoản đã bị thu hồi</h1>
                <p>Thông báo từ hệ thống Poliwise</p>
            </div>
            <div class="content">
                <p>Xin chào <strong>__USERNAME__</strong>,</p>
                <p>Tài khoản Poliwise của bạn đã bị <strong>thu hồi</strong> bởi quản trị viên <strong>__ADMINNAME__</strong>.</p>

                <div class="alert">
                    <h3>Tình trạng tài khoản</h3>
                    <ul>
                        <li>Tên đăng nhập: <strong>__USERNAME__</strong></li>
                        <li>Trạng thái: <span style="color: #c0392b;">THU HỒI</span></li>
                    </ul>
                </div>

                <div class="warning">
                    <strong>Lưu ý quan trọng:</strong>
                    <ul>
                        <li>Bạn không thể đăng nhập vào hệ thống</li>
                        <li>Tất cả các phiên đăng nhập đã bị thu hồi</li>
                        <li>Liên hệ quản trị viên nếu bạn cần được hỗ trợ</li>
                    </ul>
                </div>
            </div>
            <div class="footer">
                <p>Email này được gửi tự động từ hệ thống Poliwise.</p>
                <p>Không trả lời email này.</p>
            </div>
        </body>
        </html>
        """.replace("__USERNAME__", escapeHtml(username))
          .replace("__ADMINNAME__", escapeHtml(adminName));
    }

    private String buildAccountDeletedEmail(String username, String adminName) {
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .alert { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8e44ad; }
                .warning { background: #f5eef8; border: 1px solid #d7bde2; padding: 15px; border-radius: 8px; margin-top: 20px; }
                .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Tài khoản đã bị xóa</h1>
                <p>Thông báo từ hệ thống Poliwise</p>
            </div>
            <div class="content">
                <p>Xin chào <strong>__USERNAME__</strong>,</p>
                <p>Tài khoản Poliwise của bạn đã bị <strong>xóa</strong> bởi quản trị viên <strong>__ADMINNAME__</strong>.</p>

                <div class="alert">
                    <h3>Tình trạng tài khoản</h3>
                    <ul>
                        <li>Tên đăng nhập: <strong>[ĐÃ XÓA]</strong></li>
                        <li>Trạng thái: <span style="color: #8e44ad;">ĐÃ XÓA</span></li>
                    </ul>
                </div>

                <div class="warning">
                    <strong>Thông tin quan trọng:</strong>
                    <ul>
                        <li>Tài khoản và thông tin cá nhân đã được xóa khỏi hệ thống</li>
                        <li>Bạn không thể đăng nhập hoặc khôi phục tài khoản</li>
                        <li>Liên hệ quản trị viên nếu bạn cần được hỗ trợ</li>
                    </ul>
                </div>
            </div>
            <div class="footer">
                <p>Email này được gửi tự động từ hệ thống Poliwise.</p>
                <p>Không trả lời email này.</p>
            </div>
        </body>
        </html>
        """.replace("__USERNAME__", escapeHtml(username))
          .replace("__ADMINNAME__", escapeHtml(adminName));
    }

    private CompletableFuture<Boolean> sendEmailAsync(String to, String subject, String htmlBody) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                log.info("[EMAIL] Attempting to send - to: {}, subject: {}", maskEmail(to), subject);

                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

                helper.setFrom(emailProperties.fromAddress());
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(htmlBody, true);

                mailSender.send(message);

                log.info("[EMAIL] SUCCESS - Email sent to {}", maskEmail(to));
                return true;
            } catch (MessagingException e) {
                log.error("[EMAIL] FAILED - Messaging error for {}: {}", maskEmail(to), e.getMessage(), e);
                return false;
            } catch (Exception e) {
                log.error("[EMAIL] FAILED - Unexpected error for {}: {}", maskEmail(to), e.getMessage(), e);
                return false;
            }
        });
    }

    private String maskEmail(String email) {
        if (email == null || email.length() < 4) return "***";
        int atIndex = email.indexOf('@');
        if (atIndex <= 1) return "***" + email.substring(atIndex);
        return email.substring(0, 2) + "***" + email.substring(atIndex);
    }

    private String buildCredentialsEmail(String username, String password) {
        String html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                .credentials-row { display: flex; justify-content: space-between; margin: 10px 0; }
                .label { font-weight: bold; color: #555; }
                .value { font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 4px; }
                .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin-top: 20px; }
                .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
                a { color: #667eea; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Poliwise</h1>
                <p>Tài khoản của bạn đã được tạo thành công</p>
            </div>
            <div class="content">
                <p>Xin chào,</p>
                <p>Tài khoản Poliwise của bạn đã được tạo. Vui lòng sử dụng thông tin đăng nhập bên dưới:</p>

                <div class="credentials">
                    <div class="credentials-row">
                        <span class="label">Tên đăng nhập:</span>
                        <span class="value">__USERNAME__</span>
                    </div>
                    <div class="credentials-row">
                        <span class="label">Mật khẩu:</span>
                        <span class="value">__PASSWORD__</span>
                    </div>
                </div>

                <div class="warning">
                    <strong>Vì lý do bảo mật:</strong>
                    <ul>
                        <li>Đổi mật khẩu ngay sau khi đăng nhập lần đầu</li>
                        <li>Không chia sẻ thông tin đăng nhập với người khác</li>
                        <li>Sử dụng mật khẩu mạnh (ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt)</li>
                    </ul>
                </div>

                <p>Đăng nhập tại: <a href="#">https://poliwise.vn</a></p>
            </div>
            <div class="footer">
                <p>Email này được gửi tự động từ hệ thống Poliwise.</p>
                <p>Không trả lời email này.</p>
            </div>
        </body>
        </html>
        """;
        return html
                .replace("__USERNAME__", escapeHtml(username))
                .replace("__PASSWORD__", escapeHtml(password));
    }

    private String buildPasswordResetEmail(String username, String newPassword) {
        String html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c; }
                .credentials-row { display: flex; justify-content: space-between; margin: 10px 0; }
                .label { font-weight: bold; color: #555; }
                .value { font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 4px; }
                .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin-top: 20px; }
                .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
                a { color: #e74c3c; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Khôi phục mật khẩu</h1>
                <p>Yêu cầu đặt lại mật khẩu của bạn</p>
            </div>
            <div class="content">
                <p>Xin chào <strong>__USERNAME__</strong>,</p>
                <p>Chúng tôi đã nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn. Dưới đây là mật khẩu mới:</p>

                <div class="credentials">
                    <div class="credentials-row">
                        <span class="label">Mật khẩu mới:</span>
                        <span class="value">__NEWPASSWORD__</span>
                    </div>
                </div>

                <div class="warning">
                    <strong>Quan trọng:</strong>
                    <ul>
                        <li>Đổi mật khẩu ngay sau khi đăng nhập</li>
                        <li>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng liên hệ quản trị viên ngay</li>
                        <li>Mật khẩu này chỉ có giá trị trong 24 giờ</li>
                    </ul>
                </div>

                <p>Đăng nhập tại: <a href="#">https://poliwise.vn</a></p>
            </div>
            <div class="footer">
                <p>Email này được gửi tự động từ hệ thống Poliwise.</p>
                <p>Không trả lời email này.</p>
            </div>
        </body>
        </html>
        """;
        return html
                .replace("__USERNAME__", escapeHtml(username))
                .replace("__NEWPASSWORD__", escapeHtml(newPassword));
    }

    private String buildBulkCredentialsEmail(String username, String password, String adminName) {
        String html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db; }
                .credentials-row { display: flex; justify-content: space-between; margin: 10px 0; }
                .label { font-weight: bold; color: #555; }
                .value { font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 4px; }
                .warning { background: #d1ecf1; border: 1px solid #17a2b8; padding: 15px; border-radius: 8px; margin-top: 20px; }
                .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Tài khoản Poliwise</h1>
                <p>Thông tin đăng nhập mới</p>
            </div>
            <div class="content">
                <p>Xin chào,</p>
                <p>Tài khoản Poliwise của bạn đã được tạo bởi <strong>__ADMINNAME__</strong>. Dưới đây là thông tin đăng nhập:</p>

                <div class="credentials">
                    <div class="credentials-row">
                        <span class="label">Tên đăng nhập:</span>
                        <span class="value">__USERNAME__</span>
                    </div>
                    <div class="credentials-row">
                        <span class="label">Mật khẩu:</span>
                        <span class="value">__PASSWORD__</span>
                    </div>
                </div>

                <div class="warning">
                    <strong>Mẹo bảo mật:</strong>
                    <ul>
                        <li>Đổi mật khẩu ngay sau khi đăng nhập lần đầu</li>
                        <li>Đăng nhập tại: <strong>https://poliwise.vn</strong></li>
                    </ul>
                </div>
            </div>
            <div class="footer">
                <p>Email này được gửi tự động từ hệ thống Poliwise.</p>
            </div>
        </body>
        </html>
        """;
        return html
                .replace("__ADMINNAME__", escapeHtml(adminName))
                .replace("__USERNAME__", escapeHtml(username))
                .replace("__PASSWORD__", escapeHtml(password));
    }

    private String escapeHtml(String input) {
        if (input == null) return "";
        return input
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
