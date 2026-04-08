# MinIO — Cấu Hình và Hướng Dẫn Sử Dụng

> Cập nhật: Tháng 4/2026
> Nguồn: Kết quả test thực tế

---

## 1. Tổng Quan

MinIO là object storage service dùng để lưu trữ file tài liệu (PDF, DOCX, XLSX, images...) trong knowledge-service. Nó hoạt động như một S3-compatible storage.

---

## 2. Trạng Thái Hiện Tại Trong Dự Án

### 2.1. Kiến Trúc Code

**MinIO SDK dependency** đã có trong `knowledge-service/pom.xml`:

```xml
<dependency>
    <groupId>io.minio</groupId>
    <artifactId>minio</artifactId>
    <version>8.5.14</version>
</dependency>
```

**Các file liên quan:**

| File | Mô tả |
|------|--------|
| `config/MinioConfig.java` | Khởi tạo MinioClient, tạo bucket tự động |
| `service/StorageService.java` | Upload, download, delete, pre-signed URL |
| `service/DocumentService.java` | Sử dụng StorageService để lưu file |

### 2.2. Cấu Hình (MinioConfig.java)

```java
@Value("${minio.endpoint:http://localhost:9000}")
private String endpoint;

@Value("${minio.access-key:minioadmin}")
private String accessKey;

@Value("${minio.secret-key:minioadmin}")
private String secretKey;

@Value("${minio.bucket-name:poliwise-documents}")
private String bucketName;
```

**Lưu ý:** Không có config MinIO trong `application.yml` — service dùng giá trị mặc định.

### 2.3. Cấu Trúc Lưu Trữ Trong MinIO

```
poliwise-documents/                    ← Bucket
└── documents/                         ← Thư mục gốc
    └── {documentId}/                  ← Theo document ID
        └── {timestamp}.{extension}   ← File gốc
```

### 2.4. Trạng Thái Trong docker-compose.yml

**MinIO KHÔNG có trong docker-compose.yml.** Khi chạy `docker-compose up`, knowledge-service sẽ fail hoặc log warning khi cố upload file.

---

## 3. Cách Bật MinIO

### 3.1. Chạy MinIO Bằng Docker

```bash
docker run -d --name poliwise-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -v C:/Poliwise/data/minio:/data \
  minio/minio:latest server /data --console-address ":9001"
```

### 3.2. Kiểm Tra Bucket

```bash
# Tạo bucket (nếu chưa có)
docker exec poliwise-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec poliwise-minio mc mb local/poliwise-documents
```

### 3.3. MinIO Console

- **API:** http://localhost:9000
- **Console (Web UI):** http://localhost:9001
- **Credentials:** `minioadmin` / `minioadmin`

---

## 4. Cấu Hình Cho Từng Môi Trường

### 4.1. Chạy Local (Maven)

Set environment variables trước khi chạy:

```bash
$env:MINIO_ENDPOINT="http://localhost:9000"
$env:MINIO_ACCESS_KEY="minioadmin"
$env:MINIO_SECRET_KEY="minioadmin"
$env:MINIO_BUCKET_NAME="poliwise-documents"

cd services/knowledge-service
./mvnw spring-boot:run
```

Hoặc thêm vào `application.yml`:

```yaml
minio:
  endpoint: ${MINIO_ENDPOINT:http://localhost:9000}
  access-key: ${MINIO_ACCESS_KEY:minioadmin}
  secret-key: ${MINIO_SECRET_KEY:minioadmin}
  bucket-name: ${MINIO_BUCKET_NAME:poliwise-documents}
```

### 4.2. Chạy Trong Docker Compose

Thêm service MinIO vào `docker-compose.yml`:

```yaml
  minio:
    image: minio/minio:latest
    container_name: poliwise-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console
    networks:
      - poliwise
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5

  knowledge-service:
    environment:
      MINIO_ENDPOINT: http://minio:9000
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
      MINIO_BUCKET_NAME: poliwise-documents
    depends_on:
      minio:
        condition: service_healthy

volumes:
  minio_data:
```

---

## 5. Vị Trí Lưu Dữ Liệu

### 5.1. Trên Host (Windows)

Khi mount volume `-v C:/Poliwise/data/minio:/data`:

```
C:\Poliwise\data\minio\
└── poliwise-documents/
    └── documents/
        └── {documentId}/
            └── {timestamp}.{extension}
```

### 5.2. Trong Docker Volume (mặc định)

```
/var/lib/docker/volumes/{volume-id}/_data/
└── poliwise-documents/
    └── documents/
        └── {documentId}/
            └── {timestamp}.{extension}
```

### 5.3. Kiểm Tra Dữ Liệu

```bash
# Qua MinIO client
docker exec poliwise-minio mc ls local/poliwise-documents/

# Trên host
ls C:/Poliwise/data/minio/poliwise-documents/
```

---

## 6. Kết Quả Test Thực Tế

| Bước | Kết quả |
|-------|----------|
| Bật MinIO bằng Docker | ✅ Thành công |
| Tạo bucket `poliwise-documents` | ✅ Thành công |
| Knowledge-service kết nối MinIO | ✅ Thành công (log: "MinIO bucket already exists") |
| Upload file qua API `/api/v1/documents` | ✅ Thành công (trả về document ID) |
| File lưu vào MinIO | ✅ Thành công |
| Download file từ MinIO | ✅ Chưa test |
| Pre-signed URL | ✅ Chưa test |

---

## 7. API Endpoints Liên Quan

### 7.1. Upload Document

```http
POST http://localhost:8083/api/v1/documents
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data

file: {file}
```

### 7.2. Get Document

```http
GET http://localhost:8083/api/v1/documents/{documentId}
Authorization: Bearer {jwt_token}
```

### 7.3. Delete Document

```http
DELETE http://localhost:8083/api/v1/documents/{documentId}
Authorization: Bearer {jwt_token}
```

---

## 8. Các Vấn Đề Cần Lưu Ý

### 8.1. Anonymous Access
MinIO có thể trả về "Access Denied" khi dùng `mc` client từ container khác. Giải pháp: chạy `mc` từ bên trong MinIO container:

```bash
docker exec poliwise-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec poliwise-minio mc mb local/poliwise-documents
```

### 8.2. Credentials
- **Mặc định:** `minioadmin` / `minioadmin`
- **Đổi password:** Đặt biến `MINIO_ROOT_PASSWORD` khi khởi tạo container
- **Lưu ý:** Không đổi sau khi tạo bucket vì dữ liệu cũ sẽ không đọc được

### 8.3. Docker Desktop (Windows)
Docker Desktop chạy trong WSL2, nên network `host` không hoạt động giữa các containers. Khi dùng `docker run` với `--network host`, có thể gặp lỗi kết nối.

### 8.4. Production
- Nên sử dụng MinIO trong cluster mode cho production
- Backup dữ liệu thường xuyên
- Cấu hình TLS cho MinIO API
