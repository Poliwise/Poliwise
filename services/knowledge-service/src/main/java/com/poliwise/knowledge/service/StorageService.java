package com.poliwise.knowledge.service;

import com.poliwise.knowledge.config.MinioConfig;
import com.poliwise.knowledge.enums.FileType;
import io.minio.*;
import io.minio.errors.MinioException;
import io.minio.http.Method;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.UUID;

@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);

    private final MinioClient minioClient;
    private final String bucketName;

    public StorageService(MinioClient minioClient) {
        this.minioClient = minioClient;
        this.bucketName = MinioConfig.BUCKET_NAME;
    }

    public String uploadFile(MultipartFile file, UUID documentId) {
        String extension = getExtension(file.getOriginalFilename());
        String fileKey = "documents/" + documentId + "/" + System.currentTimeMillis() + "." + extension;

        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(fileKey)
                            .stream(file.getInputStream(), file.getSize(), -1)
                            .contentType(file.getContentType())
                            .build()
            );
            log.info("Uploaded file to MinIO: bucket={}, key={}", bucketName, fileKey);
            return fileKey;
        } catch (Exception e) {
            log.error("Failed to upload file to MinIO: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to upload file: " + e.getMessage(), e);
        }
    }

    public InputStream downloadFile(String fileKey) {
        try {
            return minioClient.getObject(
                    GetObjectArgs.builder()
                            .bucket(bucketName)
                            .object(fileKey)
                            .build()
            );
        } catch (Exception e) {
            log.error("Failed to download file from MinIO: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to download file: " + e.getMessage(), e);
        }
    }

    public void deleteFile(String fileKey) {
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(bucketName)
                            .object(fileKey)
                            .build()
            );
            log.info("Deleted file from MinIO: bucket={}, key={}", bucketName, fileKey);
        } catch (Exception e) {
            log.error("Failed to delete file from MinIO: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to delete file: " + e.getMessage(), e);
        }
    }

    public String getFileUrl(String fileKey) {
        try {
            return minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .bucket(bucketName)
                            .object(fileKey)
                            .method(Method.GET)
                            .expiry(3600) // 1 hour
                            .build()
            );
        } catch (Exception e) {
            log.error("Failed to generate presigned URL: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to generate file URL: " + e.getMessage(), e);
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "bin";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}