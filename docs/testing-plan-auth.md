# Kế hoạch Testing - Authentication System

## 1. Tổng quan

Kế hoạch kiểm thử hệ thống Authentication theo yêu cầu từ giao diện người dùng (Frontend) đến backend và database.

## 2. Môi trường Testing

- **Backend**: `services/auth-service` (Spring Boot 3, Java 17)
- **API Gateway**: `services/api-gateway` (NestJS 11)
- **Frontend**: `frontend/web` (Next.js 16)
- **Database**: PostgreSQL (schema `core`)
- **Port mặc định**: API Gateway `3001`, Auth Service `8081`, Frontend `3000`

## 3. Dữ liệu Test

### 3.1 Tài khoản mặc định

```bash
# Admin mặc định (được bootstrap tự động)
Username: admin
Password: Admin@123456
```

### 3.2 Cấu trúc bảng cần test

```sql
-- Kiểm tra cấu trúc bảng
SELECT * FROM core.users LIMIT 5;
SELECT * FROM core.refresh_tokens LIMIT 5;
SELECT * FROM core.login_history LIMIT 5;
SELECT * FROM core.access_token_blacklist LIMIT 5;
```

## 4. Test Cases

---

### 4.1 Đăng nhập (Login)

**Endpoint**: `POST /api/v1/auth/login`

#### Test Case 4.1.1 - Đăng nhập thành công

| Trường | Giá trị |
|--------|---------|
| Input | `username: admin`, `password: Admin@123456` |
| Mong đợi | HTTP 200, trả về `accessToken`, `refreshToken`, `user` |
| Kiểm tra DB | `login_history` có record mới với `status = SUCCESS` |
| Kiểm tra Redis/DB | `refresh_tokens` có record mới với `revoked = false` |

#### Test Case 4.1.2 - Đăng nhập sai mật khẩu

| Trường | Giá trị |
|--------|---------|
| Input | `username: admin`, `password: WrongPassword123` |
| Mong đợi | HTTP 401 Unauthorized |
| Kiểm tra DB | `login_history` có record với `status = FAILED_CREDENTIALS` |
| Kiểm tra DB | `users.failed_login_attempts` tăng lên 1 |

#### Test Case 4.1.3 - Đăng nhập với tài khoản bị khóa

| Trường | Giá trị |
|--------|---------|
| Input | `username: locked_user`, `password: Admin@123456` |
| Mong đợi | HTTP 403 Forbidden ("Account is temporarily locked") |
| Kiểm tra DB | `users.locked_until` có giá trị tương lai |

#### Test Case 4.1.4 - Đăng nhập với tài khoản bị vô hiệu hóa

| Trường | Giá trị |
|--------|---------|
| Input | `username: deactivated_user`, `password: Admin@123456` |
| Mong đợi | HTTP 403 Forbidden ("Account is deactivated") |

#### Test Case 4.1.5 - Rate Limiting Login

| Trường | Giá trị |
|--------|---------|
| Input | 6 lần đăng nhập thất bại liên tiếp |
| Mong đợi | Lần thứ 6 trả về HTTP 429 Too Many Requests |
| Header kiểm tra | `X-RateLimit-Limit: 5`, `Retry-After: XX` |

#### Test Case 4.1.6 - Brute Force Protection

| Trường | Giá trị |
|--------|---------|
| Input | 5 lần đăng nhập thất bại |
| Mong đợi | Tài khoản bị khóa tạm thời 15 phút |
| Kiểm tra DB | `users.locked_until` = `NOW() + 15 minutes` |

---

### 4.2 Refresh Token

**Endpoint**: `POST /api/v1/auth/refresh`

#### Test Case 4.2.1 - Refresh thành công

| Trường | Giá trị |
|--------|---------|
| Input | `refreshToken: <valid_token>`, Header `X-User-Id: <user_id>` |
| Mong đợi | HTTP 200, trả về `accessToken` và `refreshToken` mới |
| Kiểm tra DB | Token cũ có `revoked = true`, token mới được tạo |

#### Test Case 4.2.2 - Refresh với token đã bị revoke

| Trường | Giá trị |
|--------|---------|
| Input | `refreshToken: <revoked_token>` |
| Mong đợi | HTTP 401 Unauthorized |

#### Test Case 4.2.3 - Refresh với token hết hạn

| Trường | Giá trị |
|--------|---------|
| Input | `refreshToken: <expired_token>` |
| Mong đợi | HTTP 401 Unauthorized |

---

### 4.3 Logout

#### Test Case 4.3.1 - Logout 1 thiết bị

**Endpoint**: `POST /api/v1/auth/logout`

| Trường | Giá trị |
|--------|---------|
| Input | `refreshToken: <current_token>`, Bearer token |
| Mong đợi | HTTP 200 |
| Kiểm tra DB | `refresh_tokens` có `revoked = true` |
| Kiểm tra DB | `access_token_blacklist` có record mới |

#### Test Case 4.3.2 - Logout tất cả thiết bị

**Endpoint**: `POST /api/v1/auth/logout-all`

| Trường | Giá trị |
|--------|---------|
| Input | Bearer token |
| Mong đợi | HTTP 200, `sessionsRevoked: N` |
| Kiểm tra DB | Tất cả `refresh_tokens` của user có `revoked = true` |

---

### 4.4 Token Blacklist

#### Test Case 4.4.1 - Token bị blacklist sau logout

| Trường | Giá trị |
|--------|---------|
| Input | Sử dụng access token đã bị logout |
| Mong đợi | HTTP 401 Unauthorized |
| Kiểm tra DB | `access_token_blacklist` có record với token đó |

#### Test Case 4.4.2 - Blacklist không ảnh hưởng refresh token khác

| Trường | Giá trị |
|--------|---------|
| Input | Đăng nhập 2 thiết bị, logout thiết bị 1 |
| Mong đợi | Thiết bị 2 vẫn hoạt động bình thường |

---

### 4.5 Quản lý nhiều Session

#### Test Case 4.5.1 - Đăng nhập nhiều thiết bị

| Trường | Giá trị |
|--------|---------|
| Input | Đăng nhập với 3 thiết bị khác nhau |
| Mong đợi | 3 `refresh_tokens` được tạo trong DB |
| Metadata | Mỗi token có `device_info`, `ip_address` khác nhau |

#### Test Case 4.5.2 - Xem danh sách Sessions

**Endpoint**: `GET /api/v1/auth/sessions`

| Trường | Giá trị |
|--------|---------|
| Input | Bearer token |
| Mong đợi | HTTP 200, danh sách tất cả sessions |
| Kiểm tra | Trường `isCurrent` đánh dấu session hiện tại |

#### Test Case 4.5.3 - Revoke 1 Session

**Endpoint**: `DELETE /api/v1/auth/sessions/{sessionId}`

| Trường | Giá trị |
|--------|---------|
| Input | Session ID cần revoke |
| Mong đợi | HTTP 200, session đó bị vô hiệu hóa |
| Kiểm tra | Các session khác vẫn hoạt động |

---

### 4.6 Forgot Password

**Endpoint**: `POST /api/v1/auth/forgot-password`

#### Test Case 4.6.1 - Forgot Password với email tồn tại

| Trường | Giá trị |
|--------|---------|
| Input | `email: user@example.com` |
| Mong đợi | HTTP 200, message xác nhận |
| Kiểm tra DB | `users.password_hash` đã được thay đổi |
| Kiểm tra DB | `users.must_change_password = true` |
| Kiểm tra Email | Email mới được gửi với mật khẩu mới |

#### Test Case 4.6.2 - Forgot Password với email không tồn tại

| Trường | Giá trị |
|--------|---------|
| Input | `email: nonexistent@example.com` |
| Mong đợi | HTTP 200, message giống như thành công (bảo mật) |

#### Test Case 4.6.3 - Rate Limiting Forgot Password

| Trường | Giá trị |
|--------|---------|
| Input | 4 lần request trong 5 phút |
| Mong đợi | Lần thứ 4 trả về HTTP 429 |

---

### 4.7 Reset Password (Change Password)

**Endpoint**: `POST /api/v1/auth/change-password`

#### Test Case 4.7.1 - Đổi mật khẩu thành công

| Trường | Giá trị |
|--------|---------|
| Input | `oldPassword: OldPass123`, `newPassword: NewPass456!`, `confirmPassword: NewPass456!` |
| Mong đợi | HTTP 200, `success: true` |
| Kiểm tra DB | `users.password_hash` đã thay đổi |
| Kiểm tra DB | `users.must_change_password = false` |

#### Test Case 4.7.2 - Đổi mật khẩu với mật khẩu cũ sai

| Trường | Giá trị |
|--------|---------|
| Input | `oldPassword: WrongOldPass`, `newPassword: NewPass456!`, `confirmPassword: NewPass456!` |
| Mong đợi | HTTP 400, `success: false`, message "Mat khau cu khong dung" |

#### Test Case 4.7.3 - Mật khẩu mới và xác nhận không khớp

| Trường | Giá trị |
|--------|---------|
| Input | `oldPassword: OldPass123`, `newPassword: NewPass456!`, `confirmPassword: DifferentPass!` |
| Mong đợi | HTTP 400, `success: false` |

#### Test Case 4.7.4 - Mật khẩu mới yếu

| Trường | Giá trị |
|--------|---------|
| Input | `oldPassword: OldPass123`, `newPassword: weak`, `confirmPassword: weak` |
| Mong đợi | HTTP 400, message về độ mạnh mật khẩu |

#### Test Case 4.7.5 - Mật khẩu mới trùng mật khẩu cũ

| Trường | Giá trị |
|--------|---------|
| Input | `oldPassword: OldPass123`, `newPassword: OldPass123`, `confirmPassword: OldPass123` |
| Mong đợi | HTTP 400, message "Mat khau moi khong duoc trung voi mat khau cu" |

---

### 4.8 Admin Tạo User (Single)

**Endpoint**: `POST /api/v1/users`

#### Test Case 4.8.1 - Admin tạo user thành công

| Trường | Giá trị |
|--------|---------|
| Input | `{username: "newuser", email: "new@test.com", fullName: "New User", role: "USER"}` |
| Header | `Authorization: Bearer <admin_token>` |
| Mong đợi | HTTP 201, trả về thông tin user |
| Kiểm tra DB | User mới trong `users` table |
| Kiểm tra Email | Email gửi thông tin tài khoản |

#### Test Case 4.8.2 - Non-admin không thể tạo user

| Trường | Giá trị |
|--------|---------|
| Input | `{username: "newuser", ...}` |
| Header | `Authorization: Bearer <user_token>` |
| Mong đợi | HTTP 403 Forbidden |

#### Test Case 4.8.3 - Tạo user với email trùng lặp

| Trường | Giá trị |
|--------|---------|
| Input | `{username: "another", email: "existing@test.com", ...}` |
| Mong đợi | HTTP 409 Conflict |

---

### 4.9 Admin Tạo Users (Bulk)

**Endpoint**: `POST /api/v1/users/bulk`

#### Test Case 4.9.1 - Bulk create thành công

| Trường | Giá trị |
|--------|---------|
| Input | 10 users cùng lúc |
| Mong đợi | HTTP 201, `totalRequested: 10`, `successCount: 10` |
| Kiểm tra Email | 10 emails được gửi |

#### Test Case 4.9.2 - Bulk create với dữ liệu hỗn hợp

| Trường | Giá trị |
|--------|---------|
| Input | 10 users (8 hợp lệ, 2 trùng username) |
| Mong đợi | HTTP 201, `successCount: 8`, `failureCount: 2` |

#### Test Case 4.9.3 - Bulk create vượt giới hạn

| Trường | Giá trị |
|--------|---------|
| Input | 101 users |
| Mong đợi | HTTP 400 Validation Error |

---

### 4.10 User Management

#### Test Case 4.10.1 - Admin xem danh sách users

**Endpoint**: `GET /api/v1/users`

| Trường | Giá trị |
|--------|---------|
| Query | `?search=viet&role=USER&status=ACTIVE&page=0&limit=20` |
| Mong đợi | HTTP 200, danh sách users có phân trang |

#### Test Case 4.10.2 - Admin xem chi tiết user

**Endpoint**: `GET /api/v1/users/{userId}`

| Trường | Giá trị |
|--------|---------|
| Input | User ID hợp lệ |
| Mong đợi | HTTP 200, thông tin chi tiết |

#### Test Case 4.10.3 - Admin cập nhật user

**Endpoint**: `PUT /api/v1/users/{userId}`

| Trường | Giá trị |
|--------|---------|
| Input | `{role: "MANAGER", status: "ACTIVE"}` |
| Mong đợi | HTTP 200, thông tin đã cập nhật |

#### Test Case 4.10.4 - Admin deactivate user

**Endpoint**: `POST /api/v1/users/{userId}/deactivate`

| Trường | Giá trị |
|--------|---------|
| Input | User ID |
| Mong đợi | HTTP 200 |
| Kiểm tra DB | `users.status = DEACTIVATED` |
| Kiểm tra DB | Tất cả refresh tokens bị revoke |

#### Test Case 4.10.5 - Admin revoke user

**Endpoint**: `POST /api/v1/users/{userId}/revoke`

| Trường | Giá trị |
|--------|---------|
| Input | User ID |
| Mong đợi | HTTP 200 |
| Kiểm tra DB | `users.status = REVOKED` |

#### Test Case 4.10.6 - Admin xóa user không hoạt động

**Endpoint**: `DELETE /api/v1/users/{userId}`

| Trường | Giá trị |
|--------|---------|
| Input | User đã bị REVOKED hoặc DEACTIVATED |
| Mong đợi | HTTP 200, user bị xóa khỏi DB |

#### Test Case 4.10.7 - Admin không thể xóa user đang hoạt động

| Trường | Giá trị |
|--------|---------|
| Input | User có `status = ACTIVE` |
| Mong đợi | HTTP 400, message lỗi |

---

### 4.11 Login History

**Endpoint**: `GET /api/v1/users/{userId}/login-history`

#### Test Case 4.11.1 - Xem lịch sử đăng nhập

| Trường | Giá trị |
|--------|---------|
| Input | User ID |
| Mong đợi | HTTP 200, danh sách lịch sử có phân trang |
| Kiểm tra DB | Mỗi lần đăng nhập có record riêng |

---

### 4.12 Get Profile

**Endpoint**: `GET /api/v1/auth/me`

#### Test Case 4.12.1 - Lấy thông tin profile

| Trường | Giá trị |
|--------|---------|
| Header | `Authorization: Bearer <token>` |
| Mong đợi | HTTP 200, thông tin user hiện tại |

---

### 4.13 Frontend Testing

#### Test Case 4.13.1 - Trang đăng nhập

- [ ] Nhập thông tin đăng nhập hợp lệ -> Chuyển hướng đến trang chủ
- [ ] Nhập thông tin sai -> Hiển thị thông báo lỗi
- [ ] Nhấn "Quên mật khẩu" -> Chuyển đến trang forgot-password

#### Test Case 4.13.2 - Trang Forgot Password

- [ ] Nhập email hợp lệ -> Hiển thị thông báo thành công
- [ ] Kiểm tra email được gửi (nếu email enabled)
- [ ] Redirect về trang đăng nhập

#### Test Case 4.13.3 - Trang Profile

- [ ] Hiển thị thông tin user hiện tại
- [ ] Tab "Thông tin cá nhân" hiển thị đúng dữ liệu
- [ ] Tab "Bảo mật" cho phép đổi mật khẩu
- [ ] Đổi mật khẩu thành công -> Thông báo và clear form

#### Test Case 4.13.4 - Trang Sessions

- [ ] Hiển thị danh sách phiên hoạt động
- [ ] Đánh dấu phiên hiện tại
- [ ] Nút "Đăng xuất" cho từng phiên
- [ ] Nút "Đăng xuất tất cả" có confirm dialog

---

## 5. Security Testing

### 5.1 Input Validation

```bash
# SQL Injection
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin\" OR 1=1--","password":"test"}'

# XSS trong username
curl -X POST http://localhost:3001/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"username":"<script>alert(1)</script>","email":"test@test.com","fullName":"Test"}'
```

### 5.2 JWT Testing

```bash
# Sử dụng token đã hết hạn
curl -X GET http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer <expired_token>"

# Sử dụng token không hợp lệ
curl -X GET http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer invalid.token.here"
```

### 5.3 Authorization Testing

```bash
# User thường cố gắng truy cập admin endpoint
curl -X POST http://localhost:3001/api/v1/users \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"username":"test","email":"test@test.com"}'

# Expected: HTTP 403 Forbidden
```

---

## 6. Test Scripts

### 6.1 Backend Test Script

```bash
# Chạy unit tests
cd services/auth-service
./mvnw test

# Chạy integration tests
./mvnw verify
```

### 6.2 API Test Script (curl)

```bash
#!/bin/bash
BASE_URL="http://localhost:3001"

# 1. Login
echo "=== Test Login ==="
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123456"}')
echo $LOGIN_RESPONSE

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')
echo "Access Token: $ACCESS_TOKEN"

# 2. Get Profile
echo "=== Test Get Profile ==="
curl -s -X GET "$BASE_URL/api/v1/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 3. Get Sessions
echo "=== Test Get Sessions ==="
curl -s -X GET "$BASE_URL/api/v1/auth/sessions" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 4. Logout
echo "=== Test Logout ==="
curl -s -X POST "$BASE_URL/api/v1/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"'$REFRESH_TOKEN'"}'
```

### 6.3 Frontend Test (Playwright)

```typescript
// tests/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('login with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-message')).toBeVisible();
  });
});
```

---

## 7. Bug Tracking Checklist

| ID | Mô tả | Severity | Status |
|----|-------|---------|--------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

## 8. Acceptance Criteria

### 8.1 Must Pass

- [ ] Login thành công với credentials hợp lệ
- [ ] Login thất bại với credentials không hợp lệ
- [ ] Refresh token hoạt động đúng
- [ ] Logout revoke token ngay lập tức
- [ ] Forgot password gửi email mới
- [ ] Change password yêu cầu mật khẩu cũ
- [ ] Admin có thể tạo user
- [ ] Admin có thể tạo bulk users
- [ ] Rate limiting hoạt động trên login/forgot-password
- [ ] Multiple sessions được quản lý đúng

### 8.2 Should Pass

- [ ] Frontend hiển thị đúng thông tin profile
- [ ] Frontend hiển thị danh sách sessions
- [ ] Frontend có thể revoke session riêng lẻ
- [ ] Frontend có thể revoke tất cả sessions

### 8.3 Nice to Have

- [ ] Email HTML đẹp và responsive
- [ ] Password strength indicator chính xác
- [ ] Session expiry countdown timer
