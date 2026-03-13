# Ma Trận Phân Quyền Hệ Thống (RBAC)

Bảng dưới đây chi tiết hóa các quyền hạn và chức năng dành cho từng nhóm người dùng: **User**, **Manager**, và **Admin**.

| STT | Chức năng                      | User | Manager | Admin |
| :-- | :----------------------------- | :--: | :-----: | :---: |
| 01  | Hỏi đáp AI                     |  ✅  |   ✅    |  ✅   |
| 02  | Xem lịch sử hỏi đáp cá nhân    |  ✅  |   ✅    |  ✅   |
| 03  | Like / Dislike câu trả lời     |  ✅  |   ✅    |  ✅   |
| 04  | Xem thông tin cá nhân          |  ✅  |   ✅    |  ✅   |
| 05  | Cập nhật thông tin cá nhân     |  ✅  |   ✅    |  ✅   |
| 06  | Xem báo cáo thống kê           |  ❌  |   ✅    |  ✅   |
| 07  | Xem dashboard analytics        |  ❌  |   ✅    |  ✅   |
| 08  | Xem câu hỏi chưa trả lời       |  ❌  |   ✅    |  ✅   |
| 09  | Upload tài liệu tri thức       |  ❌  |   ❌    |  ✅   |
| 10  | Quản lý metadata tài liệu      |  ❌  |   ❌    |  ✅   |
| 11  | Tạo / khóa / thu hồi tài khoản |  ❌  |   ❌    |  ✅   |
| 12  | Quản lý phiên bản tài liệu     |  ❌  |   ❌    |  ✅   |

---

## 📌 Mô tả vai trò

### 1. User (Người dùng)

- Tập trung vào việc khai thác và tương tác với AI.
- Quản lý dữ liệu cá nhân cơ bản.

### 2. Manager (Quản lý)

- Bao gồm tất cả quyền của **User**.
- Có thêm các công cụ giám sát, đo lường hiệu quả hệ thống (Analytics, Report).
- Theo dõi các câu hỏi chưa được giải quyết để tối ưu tri thức.

### 3. Admin (Quản trị viên)

- Nắm quyền cao nhất trong hệ thống.
- Quản lý hạ tầng dữ liệu (Upload, Metadata, Versioning).
- Quản trị người dùng và bảo mật tài khoản.
