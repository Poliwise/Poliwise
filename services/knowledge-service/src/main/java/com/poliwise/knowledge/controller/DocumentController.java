package com.poliwise.knowledge.controller;

import com.poliwise.knowledge.dto.DocumentListResponse;
import com.poliwise.knowledge.dto.DocumentSummaryDto;
import com.poliwise.knowledge.dto.PaginationDto;
import com.poliwise.knowledge.entity.Document;
import com.poliwise.knowledge.enums.FileType;
import com.poliwise.knowledge.enums.ProcessingStatus;
import com.poliwise.knowledge.repository.DocumentRepository;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentRepository documentRepository;

    @GetMapping
    public DocumentListResponse list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status) {
        int pageIndex = Math.max(0, page - 1);
        int pageSize = Math.min(Math.max(1, limit), 100);
        Pageable pageable = PageRequest.of(pageIndex, pageSize, Sort.by(Sort.Direction.DESC, "updatedAt"));

        Specification<Document> spec = (root, query, cb) -> cb.isNull(root.get("deletedAt"));

        if (search != null && !search.isBlank()) {
            String pat = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.and(cb.isNotNull(root.get("originalFilename")),
                            cb.like(cb.lower(root.get("originalFilename")), pat)),
                    cb.and(cb.isNotNull(root.get("fileKey")), cb.like(cb.lower(root.get("fileKey")), pat))));
        }

        if (status != null && !status.isBlank()) {
            String u = status.trim().toUpperCase(Locale.ROOT);
            if ("PUBLISHED".equals(u)) {
                spec = spec.and((root, query, cb) -> root.get("status").in(ProcessingStatus.READY, ProcessingStatus.INDEXED));
            } else if ("DRAFT".equals(u)) {
                spec = spec.and((root, query, cb) -> cb.not(
                        root.get("status").in(ProcessingStatus.READY, ProcessingStatus.INDEXED)));
            } else if ("ARCHIVED".equals(u) || "EXPIRED".equals(u)) {
                spec = spec.and((root, query, cb) -> cb.equal(cb.literal(1), cb.literal(0)));
            }
        }

        Page<Document> result = documentRepository.findAll(spec, pageable);
        List<DocumentSummaryDto> data = result.getContent().stream().map(this::toDto).toList();
        PaginationDto pagination = new PaginationDto(
                pageIndex + 1,
                pageSize,
                result.getTotalElements(),
                result.getTotalPages());
        return new DocumentListResponse(data, pagination);
    }

    private DocumentSummaryDto toDto(Document d) {
        String title = d.getOriginalFilename() != null && !d.getOriginalFilename().isBlank()
                ? d.getOriginalFilename()
                : (d.getFileKey() != null ? d.getFileKey() : d.getId().toString());
        String fileName = d.getOriginalFilename() != null ? d.getOriginalFilename() : title;
        long size = d.getFileSizeBytes() != null ? d.getFileSizeBytes() : 0L;
        int ver = d.getCurrentVersion() != null ? d.getCurrentVersion() : 0;
        String uploaded = d.getCreatedAt() != null ? d.getCreatedAt().toString() : "";
        String updated = d.getUpdatedAt() != null ? d.getUpdatedAt().toString() : uploaded;
        return new DocumentSummaryDto(
                d.getId().toString(),
                title,
                fileName,
                size,
                toUiFileType(d.getFileType()),
                toUiStatus(d.getStatus()),
                ver,
                uploaded,
                updated);
    }

    private static String toUiFileType(FileType ft) {
        if (ft == null) {
            return "PDF";
        }
        return switch (ft) {
            case JPEG -> "JPG";
            case DOC -> "DOCX";
            case XLS -> "XLSX";
            case TXT -> "PDF";
            default -> ft.getValue();
        };
    }

    private static String toUiStatus(ProcessingStatus s) {
        if (s == null) {
            return "DRAFT";
        }
        if (s == ProcessingStatus.READY || s == ProcessingStatus.INDEXED) {
            return "PUBLISHED";
        }
        return "DRAFT";
    }
}
