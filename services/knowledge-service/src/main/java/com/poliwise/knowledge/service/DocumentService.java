package com.poliwise.knowledge.service;

import com.poliwise.knowledge.config.KnowledgeProperties;
import com.poliwise.knowledge.dto.event.DocumentUploadedEvent;
import com.poliwise.knowledge.dto.ProcessDocumentRequest;
import com.poliwise.knowledge.dto.UploadDocumentRequest;
import com.poliwise.knowledge.entity.Document;
import com.poliwise.knowledge.entity.DocumentVersion;
import com.poliwise.knowledge.entity.ProcessingJob;
import com.poliwise.knowledge.enums.ChunkingStrategy;
import com.poliwise.knowledge.enums.EmbeddingModel;
import com.poliwise.knowledge.enums.FileType;
import com.poliwise.knowledge.enums.ProcessingStatus;
import com.poliwise.knowledge.event.DocumentEventPublisher;
import com.poliwise.knowledge.repository.DocumentRepository;
import com.poliwise.knowledge.repository.DocumentVersionRepository;
import com.poliwise.knowledge.repository.ProcessingJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final ProcessingJobRepository jobRepository;
    private final StorageService storageService;
    private final DocumentParsingService parsingService;
    private final TextChunkingService chunkingService;
    private final DocumentEventPublisher eventPublisher;
    private final KnowledgeProperties properties;

    public DocumentService(
            DocumentRepository documentRepository,
            DocumentVersionRepository versionRepository,
            ProcessingJobRepository jobRepository,
            StorageService storageService,
            DocumentParsingService parsingService,
            TextChunkingService chunkingService,
            DocumentEventPublisher eventPublisher,
            KnowledgeProperties properties) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.jobRepository = jobRepository;
        this.storageService = storageService;
        this.parsingService = parsingService;
        this.chunkingService = chunkingService;
        this.eventPublisher = eventPublisher;
        this.properties = properties;
    }

    @Transactional
    public Document upload(MultipartFile file, UploadDocumentRequest request, UUID uploadedBy) {
        validateFile(file, request.fileType());

        // Generate document ID
        UUID documentId = UUID.randomUUID();

        // Upload to MinIO
        String fileKey = storageService.uploadFile(file, documentId);

        // Determine chunking and embedding settings
        ChunkingStrategy chunkingStrategy = request.chunkingStrategy() != null
                ? request.chunkingStrategy()
                : properties.getChunking().getDefaultStrategy();
        EmbeddingModel embeddingModel = request.embeddingModel() != null
                ? request.embeddingModel()
                : properties.getEmbedding().getDefaultModel();
        Integer chunkSize = request.chunkSize() != null
                ? request.chunkSize()
                : properties.getChunking().getDefaultChunkSize();
        Integer chunkOverlap = request.chunkOverlap() != null
                ? request.chunkOverlap()
                : properties.getChunking().getDefaultOverlap();

        OffsetDateTime now = OffsetDateTime.now();

        // Create document entity
        Document document = Document.builder()
                .id(documentId)
                .originalFilename(request.fileName())
                .fileType(request.fileType())
                .fileSizeBytes(request.fileSizeBytes())
                .mimeType(request.mimeType() != null ? request.mimeType() : file.getContentType())
                .fileKey(fileKey)
                .bucketName(StorageService.BUCKET_NAME)
                .status(ProcessingStatus.UPLOADED)
                .currentVersion(1)
                .language(request.language() != null ? request.language() : "vi")
                .chunkingStrategy(chunkingStrategy)
                .chunkSize(chunkSize)
                .chunkOverlap(chunkOverlap)
                .embeddingModel(embeddingModel)
                .uploadedBy(uploadedBy)
                .createdAt(now)
                .updatedAt(now)
                .build();

        Document saved = documentRepository.save(document);

        // Create first version
        DocumentVersion version = DocumentVersion.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .versionNumber(1)
                .fileKey(fileKey)
                .fileSizeBytes(request.fileSizeBytes())
                .changelog("Initial upload")
                .createdBy(uploadedBy)
                .createdAt(now)
                .build();
        versionRepository.save(version);

        // Publish event
        DocumentUploadedEvent event = DocumentUploadedEvent.create(
                documentId, request.fileName(), request.fileType(),
                request.fileSizeBytes(), fileKey, uploadedBy,
                chunkingStrategy, embeddingModel
        );
        eventPublisher.publishDocumentUploaded(event);

        log.info("Document uploaded: id={}, fileName={}", documentId, request.fileName());
        return saved;
    }

    @Transactional
    public void processDocument(UUID documentId, UUID processedBy) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found: " + documentId));

        // Create processing job
        UUID jobId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();

        ProcessingJob job = ProcessingJob.builder()
                .id(jobId)
                .documentId(documentId)
                .jobType(com.poliwise.knowledge.enums.ProcessingStep.PARSE)
                .status(ProcessingStatus.UPLOADED)
                .progressPercent(0)
                .startedAt(now)
                .maxRetries(properties.getProcessing().getMaxRetries())
                .retryCount(0)
                .createdAt(now)
                .updatedAt(now)
                .build();
        jobRepository.save(job);

        try {
            // Step 1: Parse document
            updateJobStatus(job, ProcessingStatus.PARSING, 10);
            InputStream fileStream = storageService.downloadFile(document.getFileKey());
            DocumentParsingService.ParsingResult parseResult = parsingService.parse(
                    fileStream, document.getFileType(), document.getOriginalFilename()
            );

            document.setExtractedText(parseResult.text());
            document.setPageCount(parseResult.pageCount());
            document.setWordCount(parseResult.wordCount());
            document.setOcrRequired(parseResult.ocrRequired());
            if (parseResult.ocrConfidence() != null) {
                document.setOcrConfidence(new java.math.BigDecimal(parseResult.ocrConfidence()));
            }
            document.setStatus(ProcessingStatus.PARSED);
            documentRepository.save(document);
            updateJobStatus(job, ProcessingStatus.PARSED, 30);

            // Step 2: Chunk text
            updateJobStatus(job, ProcessingStatus.CHUNKING, 30);
            List<TextChunkingService.Chunk> chunks = chunkingService.chunk(
                    parseResult.text(),
                    document.getChunkingStrategy(),
                    document.getChunkSize(),
                    document.getChunkOverlap()
            );
            updateJobStatus(job, ProcessingStatus.CHUNKED, 50);

            // Step 3: Generate embeddings (placeholder - would call vector search service)
            updateJobStatus(job, ProcessingStatus.EMBEDDING, 50);
            // TODO: Call vector search service to generate and store embeddings
            log.info("Would generate {} embeddings for document {}", chunks.size(), documentId);
            updateJobStatus(job, ProcessingStatus.EMBEDDED, 80);

            // Step 4: Index chunks (placeholder - would call vector search service)
            updateJobStatus(job, ProcessingStatus.INDEXING, 80);
            // TODO: Call vector search service to index chunks
            updateJobStatus(job, ProcessingStatus.INDEXED, 90);

            // Complete
            document.setStatus(ProcessingStatus.READY);
            documentRepository.save(document);
            completeJob(job, true, null);

            log.info("Document processed successfully: id={}, chunks={}", documentId, chunks.size());

        } catch (Exception e) {
            log.error("Failed to process document {}: {}", documentId, e.getMessage(), e);
            document.setStatus(ProcessingStatus.FAILED);
            documentRepository.save(document);
            failJob(job, e.getMessage());
            throw new RuntimeException("Failed to process document: " + e.getMessage(), e);
        }
    }

    private void updateJobStatus(ProcessingJob job, ProcessingStatus status, int progress) {
        job.setStatus(status);
        job.setProgressPercent(progress);
        job.setUpdatedAt(OffsetDateTime.now());
        jobRepository.save(job);
    }

    private void completeJob(ProcessingJob job, boolean success, String errorMessage) {
        job.setStatus(success ? ProcessingStatus.READY : ProcessingStatus.FAILED);
        job.setProgressPercent(100);
        job.setSuccess(success);
        job.setCompletedAt(OffsetDateTime.now());
        job.setErrorMessage(errorMessage);
        job.setUpdatedAt(OffsetDateTime.now());
        jobRepository.save(job);
    }

    private void failJob(ProcessingJob job, String errorMessage) {
        job.setStatus(ProcessingStatus.FAILED);
        job.setSuccess(false);
        job.setErrorMessage(errorMessage);
        job.setCompletedAt(OffsetDateTime.now());
        job.setUpdatedAt(OffsetDateTime.now());
        jobRepository.save(job);
    }

    @Transactional
    public void softDelete(UUID documentId, UUID deletedBy) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found: " + documentId));

        OffsetDateTime now = OffsetDateTime.now();
        document.setDeletedAt(now);
        document.setUpdatedAt(now);
        documentRepository.save(document);

        // Publish deletion event
        eventPublisher.publishDocumentDeleted(
                com.poliwise.knowledge.dto.event.DocumentDeletedEvent.create(documentId, deletedBy)
        );

        log.info("Document soft deleted: id={}", documentId);
    }

    public Optional<Document> findById(UUID documentId) {
        return documentRepository.findById(documentId);
    }

    public List<DocumentVersion> getVersions(UUID documentId) {
        return versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);
    }

    private void validateFile(MultipartFile file, FileType fileType) {
        // Check file size
        long maxSize = properties.getFileValidation().getMaxFileSizeBytes();
        if (file.getSize() > maxSize) {
            throw new IllegalArgumentException(
                    String.format("File size exceeds maximum allowed size of %d bytes", maxSize));
        }

        // Check file type
        if (fileType == null) {
            throw new IllegalArgumentException("Unsupported file type");
        }
    }
}